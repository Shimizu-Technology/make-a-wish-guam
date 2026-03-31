import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Button, Input, Card, PageTransition } from '../components/ui';
import { LiabilityWaiver } from '../components/LiabilityWaiver';
import { PaymentModal } from '../components/PaymentModal';
import { ChevronLeft, ChevronRight, Trophy, AlertCircle, CheckCircle, Loader2, Check, MapPin, Calendar } from 'lucide-react';
import { api, Tournament } from '../services/api';
import { useOrganization } from '../components/OrganizationProvider';
import { hexToRgba, adjustColor } from '../utils/colors';
import { formatEventDate } from '../utils/dates';

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

const ease = [0.22, 1, 0.36, 1] as const;

function NoiseOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.035]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
    transition: { duration: 0.3, ease },
  }),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  fullName: string;
  company: string;
  mailingAddress: string;
  phone: string;
  email: string;
  paymentOption: 'pay-now' | 'pay-on-day' | '';
  waiverAccepted: boolean;
  handicap?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const OrgRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const { orgSlug, tournamentSlug } = useParams<{ orgSlug: string; tournamentSlug: string }>();
  const { organization } = useOrganization();
  
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    company: '',
    mailingAddress: '',
    phone: '',
    email: '',
    paymentOption: '',
    waiverAccepted: false,
    handicap: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Fetch tournament data on mount
  useEffect(() => {
    async function fetchTournament() {
      if (!orgSlug || !tournamentSlug) return;
      
      setIsLoading(true);
      try {
        const data = await api.getOrganizationTournament(orgSlug, tournamentSlug);
        setTournament(data);
      } catch (err: any) {
        console.error('Failed to fetch tournament:', err);
        setSubmitError(err.message || 'Failed to load tournament');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTournament();
  }, [orgSlug, tournamentSlug]);

  const entryFee = tournament?.current_fee_dollars ?? tournament?.entry_fee_dollars ?? 0;
  const primaryColor = organization?.primary_color || '#1e3a2f';
  const primaryDark = adjustColor(primaryColor, -0.15);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.waiverAccepted) newErrors.waiverAccepted = 'You must accept the waiver to continue';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!formData.paymentOption) newErrors.paymentOption = 'Please select a payment option';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setDirection(1);
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setDirection(1);
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep3() || !tournament) return;
    if (formData.paymentOption === 'pay-now') {
      setShowPaymentModal(true);
    } else {
      await submitRegistration();
    }
  };

  const submitRegistration = async () => {
    if (!tournament) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.registerGolfer({
        golfer: {
          name: formData.fullName,
          company: formData.company,
          address: formData.mailingAddress,
          phone: formData.phone,
          email: formData.email,
          payment_type: formData.paymentOption === 'pay-now' ? 'stripe' : 'pay_on_day',
          notes: formData.handicap ? `Handicap: ${formData.handicap}` : undefined,
        },
        waiver_accepted: formData.waiverAccepted,
        tournament_id: tournament.id,
      });
      navigate(`/${orgSlug}/tournaments/${tournamentSlug}/success`, {
        state: {
          golfer: result.golfer,
          tournament: tournament,
          paymentPending: formData.paymentOption === 'pay-on-day',
        }
      });
    } catch (error: any) {
      setSubmitError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    navigate(`/${orgSlug}/tournaments/${tournamentSlug}/success`, {
      state: {
        tournament: tournament,
        paymentComplete: true,
      }
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: primaryColor }} />
          <p className="mt-4 text-sm text-stone-500 tracking-wide uppercase">Loading registration</p>
        </div>
      </div>
    );
  }

  // Error state or no tournament
  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-stone-900 mb-2">Tournament Not Found</h1>
          <p className="text-stone-600 mb-4">{submitError || 'The tournament you are looking for does not exist.'}</p>
          <Button onClick={() => navigate(`/${orgSlug}`)}>
            Back to Tournaments
          </Button>
        </Card>
      </div>
    );
  }

  // Registration closed
  if (!tournament.can_register) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-stone-900 mb-2">Registration Closed</h1>
          <p className="text-stone-600 mb-4">
            Registration for {tournament.display_name} is currently closed.
            {tournament.at_capacity && ' The tournament is at capacity.'}
          </p>
          <Button onClick={() => navigate(`/${orgSlug}`)}>
            View Other Tournaments
          </Button>
        </Card>
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Your Info' },
    { num: 2, label: 'Waiver' },
    { num: 3, label: 'Payment' },
  ];

  return (
    <MotionConfig reducedMotion="user">
    <PageTransition>
    <div className="min-h-screen bg-stone-50">
      {/* ================================================================= */}
      {/* HERO HEADER                                                        */}
      {/* ================================================================= */}
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(145deg, ${primaryDark} 0%, ${primaryColor} 40%, ${adjustColor(primaryColor, 0.08)} 100%)`,
          }}
        />
        <NoiseOverlay />

        <div className="relative z-10 max-w-3xl mx-auto px-6 py-12 sm:py-16 text-center text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease }}
          >
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
            >
              <Trophy className="h-7 w-7 text-white" strokeWidth={1.5} />
            </div>
          </motion.div>

          <motion.h1
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-3"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            {tournament.display_name}
          </motion.h1>

          <motion.div
            className="flex items-center justify-center gap-4 text-white/80 text-sm sm:text-base"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease }}
          >
            {tournament.event_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" strokeWidth={1.5} />
                {formatEventDate(tournament.event_date)}
              </span>
            )}
            {tournament.location_name && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4" strokeWidth={1.5} />
                {tournament.location_name}
              </span>
            )}
          </motion.div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* STEP INDICATOR                                                     */}
      {/* ================================================================= */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center">
                <motion.div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                  animate={{
                    backgroundColor: step >= s.num ? primaryColor : '#e7e5e4',
                    color: step >= s.num ? '#ffffff' : '#78716c',
                    scale: step === s.num ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3, ease }}
                >
                  {step > s.num ? <CheckCircle size={20} /> : s.num}
                </motion.div>
                <motion.span
                  className="text-xs mt-1"
                  animate={{
                    color: step === s.num ? primaryColor : '#78716c',
                    fontWeight: step === s.num ? 600 : 400,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {s.label}
                </motion.span>
              </div>
              {idx < 2 && (
                <motion.div
                  className="flex-1 h-1 mx-2 rounded-full"
                  animate={{
                    backgroundColor: step > s.num ? primaryColor : '#e7e5e4',
                  }}
                  transition={{ duration: 0.4, ease }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {submitError && (
            <motion.div
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {submitError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================================================================= */}
        {/* STEP CONTENT with AnimatePresence                                  */}
        {/* ================================================================= */}
        <AnimatePresence mode="wait" custom={direction}>
          {/* Step 1: Personal Information */}
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-4">Golfer Information</h2>
                <div className="space-y-4">
                  <Input
                    label="Full Name *"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    error={errors.fullName}
                    placeholder="John Smith"
                  />
                  <Input
                    label="Company/Organization"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    placeholder="Optional"
                  />
                  <Input
                    label="Mailing Address"
                    name="mailingAddress"
                    value={formData.mailingAddress}
                    onChange={handleInputChange}
                    placeholder="Optional"
                  />
                  <Input
                    label="Phone Number *"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    error={errors.phone}
                    placeholder="671-123-4567"
                  />
                  <Input
                    label="Email Address *"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    error={errors.email}
                    placeholder="john@example.com"
                  />
                  {tournament.handicap_required && (
                    <Input
                      label="Handicap Index"
                      name="handicap"
                      value={formData.handicap}
                      onChange={handleInputChange}
                      placeholder="e.g., 15.2"
                    />
                  )}
                </div>
                <div className="flex justify-end mt-6">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button onClick={handleNext}>
                      Continue <ChevronRight size={18} className="ml-1" />
                    </Button>
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Waiver */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-4">Liability Waiver</h2>
                <LiabilityWaiver 
                  organizationName={organization?.name || 'the tournament organizer'}
                />
                <div className="mt-6 p-4 bg-stone-50 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="waiverAccepted"
                      checked={formData.waiverAccepted}
                      onChange={handleInputChange}
                      className="mt-1 w-5 h-5 rounded border-stone-300"
                      style={{ accentColor: primaryColor }}
                    />
                    <span className="text-sm text-stone-700">
                      I have read and agree to the terms of the liability waiver above.
                    </span>
                  </label>
                  {errors.waiverAccepted && (
                    <p className="text-red-500 text-sm mt-2">{errors.waiverAccepted}</p>
                  )}
                </div>
                <div className="flex justify-between mt-6">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" onClick={handleBack}>
                      <ChevronLeft size={18} className="mr-1" /> Back
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button onClick={handleNext} disabled={!formData.waiverAccepted}>
                      Continue <ChevronRight size={18} className="ml-1" />
                    </Button>
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <Card className="p-6">
                <h2 className="text-xl font-bold text-stone-900 mb-4">Payment</h2>
                
                {/* Fee Summary */}
                <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: hexToRgba(primaryColor, 0.05) }}>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-600">Entry Fee</span>
                    <span className="text-2xl font-bold text-stone-900">${entryFee.toFixed(2)}</span>
                  </div>
                  {tournament.early_bird_active && (
                    <p className="text-sm mt-1 flex items-center gap-1" style={{ color: adjustColor(primaryColor, 0.1) }}>
                      <Check className="w-4 h-4" /> Early bird pricing applied
                    </p>
                  )}
                  {tournament.fee_includes && (
                    <p className="text-sm text-stone-500 mt-2">
                      Includes: {tournament.fee_includes}
                    </p>
                  )}
                </div>

                {/* Payment Options */}
                <div className="space-y-3">
                  {tournament.allow_card && (
                    <label
                      className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors duration-200"
                      style={{
                        borderColor: formData.paymentOption === 'pay-now' ? primaryColor : '#e7e5e4',
                        backgroundColor: formData.paymentOption === 'pay-now' ? hexToRgba(primaryColor, 0.04) : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentOption"
                        value="pay-now"
                        checked={formData.paymentOption === 'pay-now'}
                        onChange={handleInputChange}
                        className="w-5 h-5"
                        style={{ accentColor: primaryColor }}
                      />
                      <div>
                        <span className="font-medium text-stone-900">Pay Now with Card</span>
                        <p className="text-sm text-stone-500">Secure payment via Stripe</p>
                      </div>
                    </label>
                  )}

                  {(tournament.allow_cash || tournament.allow_check) && (
                    <label
                      className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-colors duration-200"
                      style={{
                        borderColor: formData.paymentOption === 'pay-on-day' ? primaryColor : '#e7e5e4',
                        backgroundColor: formData.paymentOption === 'pay-on-day' ? hexToRgba(primaryColor, 0.04) : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentOption"
                        value="pay-on-day"
                        checked={formData.paymentOption === 'pay-on-day'}
                        onChange={handleInputChange}
                        className="w-5 h-5"
                        style={{ accentColor: primaryColor }}
                      />
                      <div>
                        <span className="font-medium text-stone-900">Pay on Tournament Day</span>
                        <p className="text-sm text-stone-500">
                          {tournament.allow_cash && tournament.allow_check 
                            ? 'Cash or check accepted'
                            : tournament.allow_cash 
                            ? 'Cash accepted'
                            : 'Check accepted'}
                          {tournament.checks_payable_to && ` (checks payable to ${tournament.checks_payable_to})`}
                        </p>
                      </div>
                    </label>
                  )}
                </div>
                {errors.paymentOption && (
                  <p className="text-red-500 text-sm mt-2">{errors.paymentOption}</p>
                )}

                {tournament.payment_instructions && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-xl text-sm text-yellow-800">
                    {tournament.payment_instructions}
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button variant="outline" onClick={handleBack}>
                      <ChevronLeft size={18} className="mr-1" /> Back
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button 
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={18} />
                          Processing...
                        </>
                      ) : (
                        formData.paymentOption === 'pay-now' ? 'Proceed to Payment' : 'Complete Registration'
                      )}
                    </Button>
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        golferData={{
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          address: formData.mailingAddress,
        }}
        entryFee={entryFee}
        stripePublicKey={import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY}
        tournamentId={tournament?.id}
      />

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm text-stone-400">
          Powered by <span className="font-medium text-stone-600">Pacific Golf</span>
        </div>
      </footer>
    </div>
    </PageTransition>
    </MotionConfig>
  );
};
