import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Button, Card, PageTransition } from '../components/ui';
import { LiabilityWaiver } from '../components/LiabilityWaiver';
import { Trophy, AlertCircle, Loader2, Calendar, MapPin, ChevronLeft, Check, DollarSign, ChevronRight, Ticket, Plus, Minus } from 'lucide-react';
import { api, Tournament } from '../services/api';
import { useOrganization } from '../components/OrganizationProvider';
import { formatEventDate } from '../utils/dates';
import { SignedInAdminBar } from '../components/SignedInAdminBar';

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

const ease = [0.22, 1, 0.36, 1] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormData {
  player1Name: string;
  player1Email: string;
  player1Phone: string;
  player2Name: string;
  player2Email: string;
  player2Phone: string;
  teamName: string;
  player1WaiverAccepted: boolean;
  player2WaiverAccepted: boolean;
  raffleTickets: number;
  raffleBundleLabel: string;
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const stepNames = ['Team Captain', 'Partner', 'Waiver', 'Review & Pay'];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {stepNames.map((stepName, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm
              ${currentStep > index + 1 ? 'bg-[#0057B8] text-white' :
                currentStep === index + 1 ? 'bg-[#E31837] text-white' :
                'bg-neutral-200 text-neutral-500'}`}>
              {currentStep > index + 1 ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            <span className="text-xs mt-1.5 font-medium text-neutral-600 hidden sm:block">{stepName}</span>
          </div>
          {index < stepNames.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${currentStep > index + 1 ? 'bg-[#0057B8]' : 'bg-neutral-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const OrgRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const orgSlug = organization?.slug || 'make-a-wish-guam';

  const [currentStep, setCurrentStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'redirecting'>('idle');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    player1Name: '',
    player1Email: '',
    player1Phone: '+1671',
    player2Name: '',
    player2Email: '',
    player2Phone: '+1671',
    teamName: '',
    player1WaiverAccepted: false,
    player2WaiverAccepted: false,
    raffleTickets: 0,
    raffleBundleLabel: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (step === 1) {
      if (!formData.player1Name.trim()) newErrors.player1Name = 'Full name is required';
      if (!formData.player1Email.trim()) {
        newErrors.player1Email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.player1Email)) {
        newErrors.player1Email = 'Please enter a valid email address';
      }
      if (!formData.player1Phone.trim() || !formData.player1Phone.startsWith('+') || formData.player1Phone.replace(/\D/g, '').length < 10) {
        newErrors.player1Phone = 'Phone number must start with + and have at least 10 digits';
      }
    }

    if (step === 2) {
      if (!formData.player2Name.trim()) newErrors.player2Name = 'Full name is required';
      if (formData.player2Email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.player2Email)) {
        newErrors.player2Email = 'Please enter a valid email address';
      }
    }

    if (step === 3) {
      if (!formData.player1WaiverAccepted) newErrors.player1WaiverAccepted = 'Player 1 must accept the waiver';
      if (!formData.player2WaiverAccepted) newErrors.player2WaiverAccepted = 'Player 2 must accept the waiver';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!tournament) return;

    setSubmitState('submitting');
    setSubmitError(null);

    try {
      const result = await api.registerGolfer({
        golfer: {
          name: formData.player1Name,
          email: formData.player1Email,
          phone: formData.player1Phone,
          payment_type: 'swipe_simple' as any,
          partner_name: formData.player2Name,
          partner_email: formData.player2Email || undefined,
          partner_phone: formData.player2Phone && formData.player2Phone !== '+1671' ? formData.player2Phone : undefined,
          partner_waiver_accepted_at: new Date().toISOString(),
          team_name: formData.teamName || undefined,
          raffle_tickets_requested: formData.raffleTickets > 0 ? formData.raffleTickets : undefined,
          raffle_bundle_label: formData.raffleBundleLabel || undefined,
        } as any,
        waiver_accepted: true,
        tournament_id: tournament.id,
      });

      const isWaitlisted = result.golfer.registration_status === 'waitlist';

      if (isWaitlisted) {
        navigate(`/${tournamentSlug}/success`, {
          state: {
            golfer: result.golfer,
            tournament: tournament,
            waitlisted: true,
          }
        });
        return;
      }

      const checkoutResponse = await api.createSwipeSimpleCheckout(result.golfer.id);

      if (checkoutResponse.redirect_url) {
        setSubmitState('redirecting');
        setPaymentUrl(checkoutResponse.redirect_url);
        // Redirect immediately - no delay
        window.location.href = checkoutResponse.redirect_url;
      } else {
        navigate(`/${tournamentSlug}/success`, {
          state: {
            golfer: result.golfer,
            tournament: tournament,
            swipeSimpleRedirect: true,
          }
        });
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Registration failed. Please try again.');
      setSubmitState('idle');
    }
  };

  const inputClass = "w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 focus:outline-none focus:border-[#0057B8] focus:ring-2 focus:ring-[#0057B8]/20 transition-colors min-h-[44px]";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-[#0057B8]" />
          <p className="mt-4 text-sm text-neutral-500 tracking-wide uppercase">Loading registration</p>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Tournament Not Found</h1>
          <p className="text-neutral-600 mb-4">{submitError || 'The tournament you are looking for does not exist.'}</p>
          <Button onClick={() => navigate('/')}>
            Back to Tournaments
          </Button>
        </Card>
      </div>
    );
  }

  if (!tournament.can_register) {
    const isAtCapacity = tournament.at_capacity || tournament.public_at_capacity;
    const waitlistEnabled = tournament.waitlist_enabled;
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-900 mb-2">
            {isAtCapacity && !waitlistEnabled ? 'Event Full' : 'Registration Closed'}
          </h1>
          <p className="text-neutral-600 mb-4">
            {isAtCapacity && !waitlistEnabled
              ? `${tournament.name} has reached maximum capacity.`
              : `Registration for ${tournament.name} is currently closed.`}
          </p>
          {tournament.contact_name && (
            <p className="text-sm text-neutral-500 mb-4">
              Questions? Contact {tournament.contact_name}
              {tournament.contact_phone && ` at ${tournament.contact_phone}`}
              {tournament.contact_email && ` or ${tournament.contact_email}`}
            </p>
          )}
          <Button onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  const displayTeamName = formData.teamName || (formData.player1Name && formData.player2Name
    ? `${formData.player1Name} & ${formData.player2Name}`
    : 'TBD');

  return (
    <MotionConfig reducedMotion="user">
    <PageTransition>
    <div className="min-h-screen bg-[#F5F5F5]">
      <SignedInAdminBar />
      {/* ================================================================= */}
      {/* HERO HEADER                                                        */}
      {/* ================================================================= */}
      <header
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0057B8 0%, #003a6e 100%)' }}
      >
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 sm:py-10">
          <button
            onClick={() => navigate(`/${tournamentSlug}`)}
            className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors duration-200 mb-4"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            Back to Tournament
          </button>

          <motion.h1
            className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease }}
          >
            Register for {tournament.name}
          </motion.h1>

          <motion.div
            className="flex flex-wrap items-center gap-4 text-white/80 text-sm"
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

      {(tournament.at_capacity || tournament.public_at_capacity) && tournament.waitlist_enabled && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-6 py-3">
            <p className="text-sm text-amber-800 font-medium text-center">
              This event is at capacity. You will be placed on the waitlist and notified if a spot opens up.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TWO-COLUMN LAYOUT                                                  */}
      {/* ================================================================= */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT — Form */}
          <div className="lg:col-span-2 order-last lg:order-first">
            {/* Step Indicator */}
            <StepIndicator currentStep={currentStep} />

            {/* Error Display */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm mb-6"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {submitError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              {/* ---- STEP 1: Team Captain ---- */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8">
                    <div className="border-l-4 border-[#E31837] pl-3 mb-6">
                      <h2 className="text-lg font-semibold text-neutral-900">Team Captain (Player 1)</h2>
                      <p className="text-sm text-neutral-500">Primary contact for the team</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name *</label>
                        <input
                          name="player1Name"
                          value={formData.player1Name}
                          onChange={handleInputChange}
                          placeholder="John Smith"
                          className={inputClass}
                        />
                        {errors.player1Name && <p className="text-red-500 text-xs mt-1">{errors.player1Name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email Address *</label>
                        <input
                          name="player1Email"
                          type="email"
                          value={formData.player1Email}
                          onChange={handleInputChange}
                          placeholder="john@example.com"
                          className={inputClass}
                        />
                        {errors.player1Email && <p className="text-red-500 text-xs mt-1">{errors.player1Email}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone Number * (Guam: +1671, CNMI: +1670)</label>
                        <input
                          name="player1Phone"
                          type="tel"
                          value={formData.player1Phone}
                          onChange={handleInputChange}
                          placeholder="+1671 xxx-xxxx"
                          className={inputClass}
                        />
                        {errors.player1Phone && <p className="text-red-500 text-xs mt-1">{errors.player1Phone}</p>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ---- STEP 2: Partner ---- */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8">
                    <div className="border-l-4 border-[#E31837] pl-3 mb-6">
                      <h2 className="text-lg font-semibold text-neutral-900">Playing Partner (Player 2)</h2>
                      <p className="text-sm text-neutral-500">Your teammate</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name *</label>
                        <input
                          name="player2Name"
                          value={formData.player2Name}
                          onChange={handleInputChange}
                          placeholder="Jane Doe"
                          className={inputClass}
                        />
                        {errors.player2Name && <p className="text-red-500 text-xs mt-1">{errors.player2Name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email Address (optional)</label>
                        <input
                          name="player2Email"
                          type="email"
                          value={formData.player2Email}
                          onChange={handleInputChange}
                          placeholder="jane@example.com"
                          className={inputClass}
                        />
                        {errors.player2Email && <p className="text-red-500 text-xs mt-1">{errors.player2Email}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone Number (optional) (Guam: +1671, CNMI: +1670)</label>
                        <input
                          name="player2Phone"
                          type="tel"
                          value={formData.player2Phone}
                          onChange={handleInputChange}
                          placeholder="+1671 xxx-xxxx"
                          className={inputClass}
                        />
                      </div>
                      <p className="text-xs text-neutral-500 -mt-2">If left blank, all team communications will go to the Team Captain.</p>
                      <div className="pt-2">
                        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Team Name</label>
                        <input
                          name="teamName"
                          value={formData.teamName}
                          onChange={handleInputChange}
                          placeholder={`Defaults to "${formData.player1Name || 'Player 1'} & ${formData.player2Name || 'Player 2'}"`}
                          className={inputClass}
                        />
                        <p className="text-xs text-neutral-400 mt-1">Optional — defaults to both player names</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ---- STEP 3: Waiver ---- */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8">
                    <div className="border-l-4 border-[#E31837] pl-3 mb-6">
                      <h2 className="text-lg font-semibold text-neutral-900">Liability Waiver</h2>
                      <p className="text-sm text-neutral-500">Both players must agree</p>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 max-h-64 overflow-y-auto">
                      <LiabilityWaiver
                        organizationName={organization?.name || 'the tournament organizer'}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-[#F5F5F5] rounded-2xl">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            name="player1WaiverAccepted"
                            checked={formData.player1WaiverAccepted}
                            onChange={handleInputChange}
                            className="mt-1 w-5 h-5 min-w-[20px] rounded border-neutral-300 accent-[#0057B8]"
                          />
                          <span className="text-sm text-neutral-700">
                            I, <strong>{formData.player1Name || 'Player 1'}</strong>, have read and agree to the liability waiver
                          </span>
                        </label>
                        {errors.player1WaiverAccepted && (
                          <p className="text-red-500 text-sm mt-2">{errors.player1WaiverAccepted}</p>
                        )}
                      </div>
                      <div className="p-4 bg-[#F5F5F5] rounded-2xl">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            name="player2WaiverAccepted"
                            checked={formData.player2WaiverAccepted}
                            onChange={handleInputChange}
                            className="mt-1 w-5 h-5 min-w-[20px] rounded border-neutral-300 accent-[#0057B8]"
                          />
                          <span className="text-sm text-neutral-700">
                            I, <strong>{formData.player2Name || 'Player 2'}</strong>, have read and agree to the liability waiver
                          </span>
                        </label>
                        {errors.player2WaiverAccepted && (
                          <p className="text-red-500 text-sm mt-2">{errors.player2WaiverAccepted}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ---- STEP 4: Review & Pay ---- */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8">
                    <div className="border-l-4 border-[#E31837] pl-3 mb-6">
                      <h2 className="text-lg font-semibold text-neutral-900">Review & Pay</h2>
                      <p className="text-sm text-neutral-500">Confirm your details before payment</p>
                    </div>

                    <div className="space-y-5">
                      {/* Player 1 summary */}
                      <div className="p-4 bg-[#F5F5F5] rounded-2xl">
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Team Captain (Player 1)</p>
                        <p className="font-medium text-neutral-900">{formData.player1Name}</p>
                        <p className="text-sm text-neutral-600">{formData.player1Email}</p>
                        <p className="text-sm text-neutral-600">{formData.player1Phone}</p>
                      </div>

                      {/* Player 2 summary */}
                      <div className="p-4 bg-[#F5F5F5] rounded-2xl">
                        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Playing Partner (Player 2)</p>
                        <p className="font-medium text-neutral-900">{formData.player2Name}</p>
                        {formData.player2Email && <p className="text-sm text-neutral-600">{formData.player2Email}</p>}
                        {formData.player2Phone && formData.player2Phone !== '+1671' && <p className="text-sm text-neutral-600">{formData.player2Phone}</p>}
                      </div>

                      {/* Team & fee */}
                      <div className="p-4 bg-[#F5F5F5] rounded-2xl">
                        <div className="flex justify-between items-baseline mb-2">
                          <span className="text-sm text-neutral-500">Team Name</span>
                          <span className="font-medium text-neutral-900">{displayTeamName}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm text-neutral-500">Entry Fee</span>
                          <span className="text-lg font-bold text-neutral-900">{(tournament as any).entry_fee_display || `$${((tournament.entry_fee || 0) / 100).toFixed(0)}/team`}</span>
                        </div>
                      </div>

                      {/* Raffle ticket add-on */}
                      {tournament.raffle_enabled && (() => {
                        const bundles = tournament.raffle_bundles?.length
                          ? tournament.raffle_bundles
                          : [
                              { quantity: 4,  price_cents: 2000,  label: '$20 for 4 tickets' },
                              { quantity: 12, price_cents: 5000,  label: '$50 for 12 tickets' },
                              { quantity: 25, price_cents: 10000, label: '$100 for 25 tickets' },
                            ];
                        const ticketPrice = tournament.raffle_ticket_price_cents || 500;
                        const raffleCostCents = formData.raffleTickets > 0
                          ? (bundles.find(b => b.quantity === formData.raffleTickets)?.price_cents ?? formData.raffleTickets * ticketPrice)
                          : 0;

                        return (
                          <div className="p-4 bg-gradient-to-br from-[#F5A800]/5 to-[#F5A800]/10 rounded-2xl border border-[#F5A800]/20">
                            <div className="flex items-center gap-2 mb-3">
                              <Ticket className="w-5 h-5 text-[#F5A800]" />
                              <p className="text-sm font-semibold text-neutral-900">Add Raffle Tickets</p>
                            </div>
                            <p className="text-xs text-neutral-600 mb-4">
                              Pre-purchase raffle tickets for a chance to win prizes at the event. ${(ticketPrice / 100).toFixed(0)} per ticket.
                            </p>

                            {/* Bundle options */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                              {bundles.map((bundle, idx) => {
                                const isSelected = formData.raffleTickets === bundle.quantity;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      if (isSelected) {
                                        setFormData(prev => ({ ...prev, raffleTickets: 0, raffleBundleLabel: '' }));
                                      } else {
                                        setFormData(prev => ({ ...prev, raffleTickets: bundle.quantity, raffleBundleLabel: bundle.label }));
                                      }
                                    }}
                                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all text-center ${
                                      isSelected
                                        ? 'border-[#F5A800] bg-[#F5A800]/10'
                                        : 'border-neutral-200 bg-white hover:border-[#F5A800]/40'
                                    }`}
                                  >
                                    <span className="text-lg font-bold text-neutral-900">{bundle.quantity}</span>
                                    <span className="text-[11px] text-neutral-500">tickets</span>
                                    <span className="text-sm font-bold text-[#F5A800] mt-1">${(bundle.price_cents / 100).toFixed(0)}</span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Custom quantity */}
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-neutral-500">Or custom:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    raffleTickets: Math.max(0, prev.raffleTickets - 1),
                                    raffleBundleLabel: '',
                                  }))}
                                  className="w-8 h-8 rounded-lg border border-neutral-300 flex items-center justify-center hover:bg-neutral-100 transition-colors"
                                  disabled={formData.raffleTickets <= 0}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-10 text-center text-sm font-semibold text-neutral-900">
                                  {formData.raffleTickets}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    raffleTickets: prev.raffleTickets + 1,
                                    raffleBundleLabel: '',
                                  }))}
                                  className="w-8 h-8 rounded-lg border border-neutral-300 flex items-center justify-center hover:bg-neutral-100 transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {formData.raffleTickets > 0 && !bundles.find(b => b.quantity === formData.raffleTickets) && (
                                <span className="text-xs font-medium text-[#F5A800]">
                                  = ${((formData.raffleTickets * ticketPrice) / 100).toFixed(0)}
                                </span>
                              )}
                            </div>

                            {formData.raffleTickets > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#F5A800]/20 flex justify-between items-baseline">
                                <span className="text-sm text-neutral-600">Raffle tickets ({formData.raffleTickets})</span>
                                <span className="text-sm font-bold text-[#F5A800]">${(raffleCostCents / 100).toFixed(0)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Order total */}
                      {(() => {
                        const entryFeeCents = tournament.entry_fee || 0;
                        const bundles = tournament.raffle_bundles?.length
                          ? tournament.raffle_bundles
                          : [
                              { quantity: 4,  price_cents: 2000,  label: '' },
                              { quantity: 12, price_cents: 5000,  label: '' },
                              { quantity: 25, price_cents: 10000, label: '' },
                            ];
                        const ticketPrice = tournament.raffle_ticket_price_cents || 500;
                        const raffleCostCents = formData.raffleTickets > 0
                          ? (bundles.find(b => b.quantity === formData.raffleTickets)?.price_cents ?? formData.raffleTickets * ticketPrice)
                          : 0;
                        const totalCents = entryFeeCents + raffleCostCents;

                        return (
                          <div className="p-4 bg-[#F5F5F5] rounded-2xl">
                            {formData.raffleTickets > 0 && (
                              <>
                                <div className="flex justify-between items-baseline text-sm mb-1">
                                  <span className="text-neutral-500">Entry fee</span>
                                  <span className="text-neutral-700">${(entryFeeCents / 100).toFixed(0)}</span>
                                </div>
                                <div className="flex justify-between items-baseline text-sm mb-2">
                                  <span className="text-neutral-500">Raffle tickets ({formData.raffleTickets})</span>
                                  <span className="text-neutral-700">${(raffleCostCents / 100).toFixed(0)}</span>
                                </div>
                                <div className="border-t border-neutral-300 pt-2" />
                              </>
                            )}
                            <div className="flex justify-between items-baseline">
                              <span className="text-sm font-medium text-neutral-700">Total</span>
                              <span className="text-xl font-bold text-neutral-900">${(totalCents / 100).toFixed(0)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Payment note */}
                      <div className="bg-[#0057B8]/5 rounded-2xl p-4">
                        <p className="text-sm text-neutral-600">
                          Payment processed via Bank of Guam SwipeSimple. You will be redirected to complete payment.
                          {formData.raffleTickets > 0 && ' Your raffle tickets will be activated once payment is confirmed.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-6">
              {currentStep > 1 ? (
                <button
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 border border-neutral-300 text-neutral-700 font-medium text-sm rounded-full px-6 py-3 hover:bg-neutral-50 transition-colors min-h-[44px] w-full sm:w-auto justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 4 ? (
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-1 bg-[#0057B8] hover:bg-[#003a6e] text-white font-semibold text-sm rounded-full px-6 py-3 transition-colors min-h-[44px] w-full sm:w-auto justify-center"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <motion.button
                  onClick={handleSubmit}
                  disabled={submitState !== 'idle'}
                  className={`inline-flex items-center gap-2 ${(tournament.at_capacity || tournament.public_at_capacity) && tournament.waitlist_enabled ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#E31837] hover:bg-[#c41230]'} text-white font-semibold text-sm rounded-full px-8 py-3 transition-colors min-h-[44px] w-full sm:w-auto justify-center ${submitState !== 'idle' ? 'opacity-75 cursor-not-allowed' : ''}`}
                  whileHover={submitState === 'idle' ? { scale: 1.01 } : {}}
                  whileTap={submitState === 'idle' ? { scale: 0.98 } : {}}
                >
                  {submitState === 'idle' && (
                    <>
                      {(tournament.at_capacity || tournament.public_at_capacity) && tournament.waitlist_enabled ? 'Join Waitlist' : 'Register & Pay'}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                  {submitState === 'submitting' && (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  )}
                  {submitState === 'redirecting' && (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Redirecting to payment...
                    </span>
                  )}
                </motion.button>
              )}

              {/* Fallback payment link if auto-redirect doesn't work */}
              {submitState === 'redirecting' && paymentUrl && (
                <div className="mt-4 p-4 bg-[#0057B8]/5 rounded-2xl text-center">
                  <p className="text-sm text-neutral-600 mb-2">
                    Registration complete! If you are not automatically redirected:
                  </p>
                  <a
                    href={paymentUrl}
                    className="inline-flex items-center gap-2 text-[#0057B8] font-semibold text-sm hover:underline"
                  >
                    <DollarSign className="w-4 h-4" />
                    Tap here to proceed to payment
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Sticky Summary Card */}
          <div className="order-first lg:order-last">
            <div className="sticky top-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease }}
                className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6"
              >
                <h3 className="font-bold text-lg text-neutral-900 mb-4">Registration Summary</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3">
                    <Trophy className="w-5 h-5 mt-0.5 shrink-0 text-[#0057B8]" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium text-neutral-900 text-sm">{tournament.name}</p>
                    </div>
                  </div>
                  {tournament.event_date && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 shrink-0 text-[#0057B8]" strokeWidth={1.5} />
                      <p className="text-sm text-neutral-600">{formatEventDate(tournament.event_date)}</p>
                    </div>
                  )}
                  {tournament.location_name && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 shrink-0 text-[#0057B8]" strokeWidth={1.5} />
                      <p className="text-sm text-neutral-600">{tournament.location_name}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-100 pt-4 mb-6">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-neutral-500 text-sm">Entry Fee</span>
                    <span className="text-2xl font-bold text-neutral-900">{(tournament as any).entry_fee_display || `$${((tournament.entry_fee || 0) / 100).toFixed(0)}/team`}</span>
                  </div>
                  <p className="text-xs text-neutral-400">per team (2 players)</p>

                  {tournament.fee_includes && (
                    <div className="mt-4 space-y-1.5">
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Includes</p>
                      <p className="text-sm text-neutral-600 leading-relaxed">{tournament.fee_includes}</p>
                    </div>
                  )}
                </div>

                {(tournament.at_capacity || tournament.public_at_capacity) && tournament.waitlist_enabled ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                    <p className="text-xs text-amber-800 font-medium mb-1">Waitlist Registration</p>
                    <p className="text-xs text-amber-700">
                      This event is at capacity. Your team will be added to the waitlist and you'll be notified if a spot opens up. No payment is required until confirmed.
                    </p>
                  </div>
                ) : (
                  <div className="bg-[#0057B8]/5 rounded-2xl p-3">
                    <p className="text-xs text-neutral-600">
                      Payment processed via Bank of Guam SwipeSimple. You will be redirected after submitting.
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-neutral-400">
          <p>Powered by <span className="font-medium text-neutral-600">Shimizu Technology</span></p>
          <Link to="/admin" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
            Admin
          </Link>
        </div>
      </footer>
    </div>
    </PageTransition>
    </MotionConfig>
  );
};
