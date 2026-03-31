import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import { Button, Input, Card, PageTransition } from '../components/ui';
import { LiabilityWaiver } from '../components/LiabilityWaiver';
import { Trophy, AlertCircle, Loader2, Calendar, MapPin } from 'lucide-react';
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
  const { orgSlug, tournamentSlug } = useParams<{ orgSlug: string; tournamentSlug: string }>();
  const { organization } = useOrganization();

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

  const primaryColor = organization?.primary_color || '#1e3a2f';
  const primaryDark = adjustColor(primaryColor, -0.15);

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

    // Player 1
    if (!formData.player1Name.trim()) newErrors.player1Name = 'Full name is required';
    if (!formData.player1Email.trim()) {
      newErrors.player1Email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.player1Email)) {
      newErrors.player1Email = 'Please enter a valid email address';
    }
    if (!formData.player1Phone.trim()) newErrors.player1Phone = 'Phone number is required';

    // Player 2
    if (!formData.player2Name.trim()) newErrors.player2Name = 'Full name is required';
    if (!formData.player2Email.trim()) {
      newErrors.player2Email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.player2Email)) {
      newErrors.player2Email = 'Please enter a valid email address';
    }
    if (!formData.player2Phone.trim()) newErrors.player2Phone = 'Phone number is required';

    // Waivers
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
      // Step 1: Register golfer
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

      // Step 2: Create SwipeSimple checkout
      const checkoutResponse = await api.createSwipeSimpleCheckout(result.golfer.id);

      // Step 3: Redirect to SwipeSimple
      if (checkoutResponse.redirect_url) {
        window.location.href = checkoutResponse.redirect_url;
      } else {
        // Fallback: navigate to success page
        navigate(`/${orgSlug}/tournaments/${tournamentSlug}/success`, {
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
      {/* FORM                                                               */}
      {/* ================================================================= */}
      <div className="max-w-3xl mx-auto px-4 py-8">
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

        {/* Player 1 (Team Captain) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease }}
        >
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-stone-900 mb-1">Player 1 (Team Captain)</h2>
            <p className="text-sm text-stone-500 mb-4">Primary contact for the team</p>
            <div className="space-y-4">
              <Input
                label="Full Name *"
                name="player1Name"
                value={formData.player1Name}
                onChange={handleInputChange}
                error={errors.player1Name}
                placeholder="John Smith"
              />
              <Input
                label="Email Address *"
                name="player1Email"
                type="email"
                value={formData.player1Email}
                onChange={handleInputChange}
                error={errors.player1Email}
                placeholder="john@example.com"
              />
              <Input
                label="Phone Number *"
                name="player1Phone"
                type="tel"
                value={formData.player1Phone}
                onChange={handleInputChange}
                error={errors.player1Phone}
                placeholder="671-123-4567"
              />
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">T-Shirt Size</label>
                <select
                  name="player1TshirtSize"
                  value={formData.player1TshirtSize}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ focusRingColor: primaryColor } as any}
                >
                  <option value="">Select size (optional)</option>
                  {tshirtSizes.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Player 2 (Playing Partner) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease }}
        >
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-stone-900 mb-1">Player 2 (Playing Partner)</h2>
            <p className="text-sm text-stone-500 mb-4">Your teammate for the event</p>
            <div className="space-y-4">
              <Input
                label="Full Name *"
                name="player2Name"
                value={formData.player2Name}
                onChange={handleInputChange}
                error={errors.player2Name}
                placeholder="Jane Doe"
              />
              <Input
                label="Email Address *"
                name="player2Email"
                type="email"
                value={formData.player2Email}
                onChange={handleInputChange}
                error={errors.player2Email}
                placeholder="jane@example.com"
              />
              <Input
                label="Phone Number *"
                name="player2Phone"
                type="tel"
                value={formData.player2Phone}
                onChange={handleInputChange}
                error={errors.player2Phone}
                placeholder="671-234-5678"
              />
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">T-Shirt Size</label>
                <select
                  name="player2TshirtSize"
                  value={formData.player2TshirtSize}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ focusRingColor: primaryColor } as any}
                >
                  <option value="">Select size (optional)</option>
                  {tshirtSizes.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Team Name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease }}
        >
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">Team Name</h2>
            <Input
              label=""
              name="teamName"
              value={formData.teamName}
              onChange={handleInputChange}
              placeholder="Defaults to Player 1 & Player 2"
            />
          </Card>
        </motion.div>

        {/* Liability Waivers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4, ease }}
        >
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">Liability Waiver</h2>
            <LiabilityWaiver
              organizationName={organization?.name || 'the tournament organizer'}
            />
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-stone-50 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="player1WaiverAccepted"
                    checked={formData.player1WaiverAccepted}
                    onChange={handleInputChange}
                    className="mt-1 w-5 h-5 rounded border-stone-300"
                    style={{ accentColor: primaryColor }}
                  />
                  <span className="text-sm text-stone-700">
                    I, <strong>{formData.player1Name || 'Player 1'}</strong>, have read and agree to the liability waiver
                  </span>
                </label>
                {errors.player1WaiverAccepted && (
                  <p className="text-red-500 text-sm mt-2">{errors.player1WaiverAccepted}</p>
                )}
              </div>
              <div className="p-4 bg-stone-50 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="player2WaiverAccepted"
                    checked={formData.player2WaiverAccepted}
                    onChange={handleInputChange}
                    className="mt-1 w-5 h-5 rounded border-stone-300"
                    style={{ accentColor: primaryColor }}
                  />
                  <span className="text-sm text-stone-700">
                    I, <strong>{formData.player2Name || 'Player 2'}</strong>, have read and agree to the liability waiver
                  </span>
                </label>
                {errors.player2WaiverAccepted && (
                  <p className="text-red-500 text-sm mt-2">{errors.player2WaiverAccepted}</p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Payment Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5, ease }}
        >
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-bold text-stone-900 mb-4">Payment</h2>
            <div className="rounded-xl p-4" style={{ backgroundColor: hexToRgba(primaryColor, 0.05) }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-stone-600">Registration Fee</span>
                <span className="text-2xl font-bold text-stone-900">$300/team</span>
              </div>
              <p className="text-sm text-stone-500">
                Payment processed via Bank of Guam SwipeSimple. You will be redirected after submitting.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6, ease }}
          className="flex justify-end"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  Processing...
                </>
              ) : (
                'Register & Pay'
              )}
            </Button>
          </motion.div>
        </motion.div>
      </div>

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
