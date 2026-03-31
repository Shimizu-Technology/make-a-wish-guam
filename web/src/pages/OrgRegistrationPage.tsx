import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Button, Input, Card, PageTransition } from '../components/ui';
import { LiabilityWaiver } from '../components/LiabilityWaiver';
import { Trophy, AlertCircle, Loader2, Calendar, MapPin, ChevronLeft, Check, DollarSign } from 'lucide-react';
import { api, Tournament } from '../services/api';
import { useOrganization } from '../components/OrganizationProvider';
import { hexToRgba, adjustColor } from '../utils/colors';
import { formatEventDate } from '../utils/dates';

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
  player1TshirtSize: string;
  player2Name: string;
  player2Email: string;
  player2Phone: string;
  player2TshirtSize: string;
  teamName: string;
  player1WaiverAccepted: boolean;
  player2WaiverAccepted: boolean;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const OrgRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const orgSlug = organization?.slug || 'make-a-wish-guam';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState<FormData>({
    player1Name: '',
    player1Email: '',
    player1Phone: '',
    player1TshirtSize: '',
    player2Name: '',
    player2Email: '',
    player2Phone: '',
    player2TshirtSize: '',
    teamName: '',
    player1WaiverAccepted: false,
    player2WaiverAccepted: false,
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

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.player1Name.trim()) newErrors.player1Name = 'Full name is required';
    if (!formData.player1Email.trim()) {
      newErrors.player1Email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.player1Email)) {
      newErrors.player1Email = 'Please enter a valid email address';
    }
    if (!formData.player1Phone.trim()) newErrors.player1Phone = 'Phone number is required';

    if (!formData.player2Name.trim()) newErrors.player2Name = 'Full name is required';
    if (!formData.player2Email.trim()) {
      newErrors.player2Email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.player2Email)) {
      newErrors.player2Email = 'Please enter a valid email address';
    }
    if (!formData.player2Phone.trim()) newErrors.player2Phone = 'Phone number is required';

    if (!formData.player1WaiverAccepted) newErrors.player1WaiverAccepted = 'Player 1 must accept the waiver';
    if (!formData.player2WaiverAccepted) newErrors.player2WaiverAccepted = 'Player 2 must accept the waiver';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !tournament) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await api.registerGolfer({
        golfer: {
          name: formData.player1Name,
          email: formData.player1Email,
          phone: formData.player1Phone,
          payment_type: 'swipe_simple' as any,
          partner_name: formData.player2Name,
          partner_email: formData.player2Email,
          partner_phone: formData.player2Phone,
          partner_waiver_accepted_at: new Date().toISOString(),
          team_name: formData.teamName || undefined,
          tshirt_size: formData.player1TshirtSize || undefined,
          partner_tshirt_size: formData.player2TshirtSize || undefined,
        } as any,
        waiver_accepted: true,
        tournament_id: tournament.id,
      });

      const checkoutResponse = await api.createSwipeSimpleCheckout(result.golfer.id);

      if (checkoutResponse.redirect_url) {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  const tshirtSizes = ['S', 'M', 'L', 'XL', 'XXL'];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-[#004B8D]" />
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Card className="p-8 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Registration Closed</h1>
          <p className="text-neutral-600 mb-4">
            Registration for {tournament.name} is currently closed.
            {tournament.at_capacity && ' The tournament is at capacity.'}
          </p>
          <Button onClick={() => navigate('/')}>
            View Other Tournaments
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <PageTransition>
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* ================================================================= */}
      {/* HERO HEADER                                                        */}
      {/* ================================================================= */}
      <header
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #004B8D 0%, #003a6e 100%)' }}
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
            className="flex items-center gap-4 text-white/80 text-sm"
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
      {/* TWO-COLUMN LAYOUT                                                  */}
      {/* ================================================================= */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT — Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Error Display */}
            <AnimatePresence>
              {submitError && (
                <motion.div
                  className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {submitError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Player sections side by side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player 1 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease }}
              >
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="border-l-4 border-[#E31837] pl-3">
                      <h2 className="text-lg font-semibold text-neutral-900">Player 1 (Captain)</h2>
                      <p className="text-sm text-neutral-500">Primary contact</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name *</label>
                      <input
                        name="player1Name"
                        value={formData.player1Name}
                        onChange={handleInputChange}
                        placeholder="John Smith"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
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
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                      />
                      {errors.player1Email && <p className="text-red-500 text-xs mt-1">{errors.player1Email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone Number *</label>
                      <input
                        name="player1Phone"
                        type="tel"
                        value={formData.player1Phone}
                        onChange={handleInputChange}
                        placeholder="671-123-4567"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                      />
                      {errors.player1Phone && <p className="text-red-500 text-xs mt-1">{errors.player1Phone}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">T-Shirt Size</label>
                      <select
                        name="player1TshirtSize"
                        value={formData.player1TshirtSize}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                      >
                        <option value="">Select size (optional)</option>
                        {tshirtSizes.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Player 2 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease }}
              >
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="border-l-4 border-[#E31837] pl-3">
                      <h2 className="text-lg font-semibold text-neutral-900">Player 2 (Partner)</h2>
                      <p className="text-sm text-neutral-500">Your teammate</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Full Name *</label>
                      <input
                        name="player2Name"
                        value={formData.player2Name}
                        onChange={handleInputChange}
                        placeholder="Jane Doe"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                      />
                      {errors.player2Name && <p className="text-red-500 text-xs mt-1">{errors.player2Name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Email Address *</label>
                      <input
                        name="player2Email"
                        type="email"
                        value={formData.player2Email}
                        onChange={handleInputChange}
                        placeholder="jane@example.com"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                      />
                      {errors.player2Email && <p className="text-red-500 text-xs mt-1">{errors.player2Email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Phone Number *</label>
                      <input
                        name="player2Phone"
                        type="tel"
                        value={formData.player2Phone}
                        onChange={handleInputChange}
                        placeholder="671-234-5678"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                      />
                      {errors.player2Phone && <p className="text-red-500 text-xs mt-1">{errors.player2Phone}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">T-Shirt Size</label>
                      <select
                        name="player2TshirtSize"
                        value={formData.player2TshirtSize}
                        onChange={handleInputChange}
                        className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                      >
                        <option value="">Select size (optional)</option>
                        {tshirtSizes.map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Team Name */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3, ease }}
            >
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <div className="border-l-4 border-[#E31837] pl-3 mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900">Team Name</h2>
                </div>
                <input
                  name="teamName"
                  value={formData.teamName}
                  onChange={handleInputChange}
                  placeholder="Defaults to Player 1 & Player 2"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 focus:outline-none focus:border-[#004B8D] focus:ring-2 focus:ring-[#004B8D]/20 transition-colors"
                />
              </div>
            </motion.div>

            {/* Liability Waiver */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4, ease }}
            >
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <div className="border-l-4 border-[#E31837] pl-3 mb-4">
                  <h2 className="text-lg font-semibold text-neutral-900">Liability Waiver</h2>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
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
                        className="mt-1 w-5 h-5 rounded border-neutral-300 accent-[#004B8D]"
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
                        className="mt-1 w-5 h-5 rounded border-neutral-300 accent-[#004B8D]"
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

            {/* Submit Button — mobile only (desktop has it in sidebar) */}
            <div className="lg:hidden">
              <motion.button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-[#E31837] hover:bg-[#c41230] disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-full text-lg transition-colors"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="animate-spin w-5 h-5" />
                    Processing...
                  </span>
                ) : (
                  'Register & Pay'
                )}
              </motion.button>
            </div>
          </div>

          {/* RIGHT — Sticky Summary Card */}
          <div className="hidden lg:block">
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
                    <Trophy className="w-5 h-5 mt-0.5 shrink-0 text-[#004B8D]" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium text-neutral-900 text-sm">{tournament.name}</p>
                    </div>
                  </div>
                  {tournament.event_date && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 shrink-0 text-[#004B8D]" strokeWidth={1.5} />
                      <p className="text-sm text-neutral-600">{formatEventDate(tournament.event_date)}</p>
                    </div>
                  )}
                  {tournament.location_name && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 shrink-0 text-[#004B8D]" strokeWidth={1.5} />
                      <p className="text-sm text-neutral-600">{tournament.location_name}</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-100 pt-4 mb-6">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-neutral-500 text-sm">Entry Fee</span>
                    <span className="text-2xl font-bold text-neutral-900">$300</span>
                  </div>
                  <p className="text-xs text-neutral-400">per team (2 players)</p>

                  {tournament.fee_includes && (
                    <div className="mt-4 space-y-1.5">
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Includes</p>
                      <p className="text-sm text-neutral-600 leading-relaxed">{tournament.fee_includes}</p>
                    </div>
                  )}
                </div>

                <div className="bg-[#004B8D]/5 rounded-2xl p-3 mb-6">
                  <p className="text-xs text-neutral-600">
                    Payment processed via Bank of Guam SwipeSimple. You will be redirected after submitting.
                  </p>
                </div>

                <motion.button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full bg-[#E31837] hover:bg-[#c41230] disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-full text-lg transition-colors"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin w-5 h-5" />
                      Processing...
                    </span>
                  ) : (
                    'Register & Pay'
                  )}
                </motion.button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-neutral-400">
          Powered by <span className="font-medium text-neutral-600">Shimizu Technology</span>
        </div>
      </footer>
    </div>
    </PageTransition>
    </MotionConfig>
  );
};
