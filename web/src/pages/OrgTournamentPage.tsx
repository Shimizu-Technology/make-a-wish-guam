import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import { api, Tournament, Sponsor } from '../services/api';
import { motion, MotionConfig, useInView } from 'framer-motion';
import { 
  Calendar, MapPin, Users, DollarSign, Clock, 
  Trophy, AlertCircle, ChevronLeft, Star, Building2, ExternalLink, Check
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { hexToRgba, adjustColor } from '../utils/colors';
import { formatEventDate } from '../utils/dates';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

// ---------------------------------------------------------------------------
// Noise overlay
// ---------------------------------------------------------------------------

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
// Scroll-triggered wrapper
// ---------------------------------------------------------------------------

function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      custom={delay}
      variants={fadeUp}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function OrgTournamentPage() {
  const { orgSlug, tournamentSlug } = useParams<{ orgSlug: string; tournamentSlug: string }>();
  const { organization, isLoading: orgLoading } = useOrganization();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTournament() {
      if (!orgSlug || !tournamentSlug) return;
      
      setIsLoading(true);
      try {
        const data = await api.getOrganizationTournament(orgSlug, tournamentSlug);
        setTournament(data);
      } catch (err: any) {
        console.error('Failed to fetch tournament:', err);
        setError(err.message || 'Failed to load tournament');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTournament();
  }, [orgSlug, tournamentSlug]);

  const primaryColor = organization?.primary_color || '#1e3a2f';
  const primaryDark = adjustColor(primaryColor, -0.15);

  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-300 border-t-stone-700 mx-auto" />
          <p className="mt-5 text-sm text-stone-500 tracking-wide uppercase">Loading tournament</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Tournament Not Found</h1>
          <p className="mt-3 text-stone-500 leading-relaxed">{error || 'The tournament does not exist.'}</p>
          <Link
            to={`/${orgSlug}`}
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200"
            style={{ backgroundColor: primaryColor }}
          >
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; dot: string }> = {
    open: { label: 'Registration Open', dot: 'bg-emerald-500' },
    closed: { label: 'Registration Closed', dot: 'bg-red-400' },
    in_progress: { label: 'In Progress', dot: 'bg-amber-500' },
    completed: { label: 'Completed', dot: 'bg-stone-400' },
    draft: { label: 'Coming Soon', dot: 'bg-sky-400' },
  };

  const status = statusConfig[tournament.status] || { label: tournament.status, dot: 'bg-stone-400' };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* ================================================================= */}
      {/* HERO                                                               */}
      {/* ================================================================= */}
      <header className="relative overflow-hidden">
        {organization?.banner_url ? (
          <>
            <div className="absolute inset-0">
              <img
                src={organization.banner_url}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
            </div>
            <NoiseOverlay />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(145deg, ${primaryDark} 0%, ${primaryColor} 40%, ${adjustColor(primaryColor, 0.08)} 100%)`,
              }}
            />
            <NoiseOverlay />
          </>
        )}

        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 py-12 sm:py-20">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease }}
          >
            <Link
              to={`/${orgSlug}`}
              className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white transition-colors duration-200 mb-6"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              Back to {organization?.name || 'Tournaments'}
            </Link>
          </motion.div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease }}
                className="mb-4"
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
                >
                  <Trophy className="w-6 h-6 text-white" strokeWidth={1.5} />
                </div>
              </motion.div>

              <motion.h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-3"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease }}
              >
                {tournament.display_name}
              </motion.h1>

              {tournament.event_date && (
                <motion.p
                  className="text-lg text-white/80"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.25, ease }}
                >
                  {formatEventDate(tournament.event_date)}
                </motion.p>
              )}
            </div>

            <motion.span
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/15 backdrop-blur-sm text-white rounded-full px-3 py-1.5 ring-1 ring-white/20"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </motion.span>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                       */}
      {/* ================================================================= */}
      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-10 sm:py-14 -mt-4">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Details Card */}
          <ScrollReveal className="md:col-span-2">
            <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-7">
              <h2 className="text-xl font-bold tracking-tight mb-5">Tournament Details</h2>

              <div className="space-y-4">
                {tournament.location_name && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 mt-0.5 shrink-0" style={{ color: primaryColor }} strokeWidth={1.5} />
                    <div>
                      <p className="font-medium text-stone-900">{tournament.location_name}</p>
                      {tournament.location_address && (
                        <p className="text-stone-500 text-sm">{tournament.location_address}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 mt-0.5 shrink-0" style={{ color: primaryColor }} strokeWidth={1.5} />
                  <div>
                    <p className="font-medium text-stone-900">{formatEventDate(tournament.event_date) || 'Date TBA'}</p>
                    {tournament.registration_time && (
                      <p className="text-stone-500 text-sm">Registration: {tournament.registration_time}</p>
                    )}
                    {tournament.start_time && (
                      <p className="text-stone-500 text-sm">Start: {tournament.start_time}</p>
                    )}
                  </div>
                </div>

                {tournament.format_name && (
                  <div className="flex items-start gap-3">
                    <Trophy className="w-5 h-5 mt-0.5 shrink-0" style={{ color: primaryColor }} strokeWidth={1.5} />
                    <div>
                      <p className="font-medium text-stone-900">Format: {tournament.format_name}</p>
                      {tournament.tournament_format && (
                        <p className="text-stone-500 text-sm capitalize">
                          {tournament.tournament_format.replace('_', ' ')}
                          {tournament.team_size && tournament.team_size > 1 && ` (${tournament.team_size}-person teams)`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {tournament.fee_includes && (
                  <div
                    className="mt-6 p-4 rounded-xl"
                    style={{ backgroundColor: hexToRgba(primaryColor, 0.05) }}
                  >
                    <p className="font-medium text-stone-900 mb-1">Entry Fee Includes:</p>
                    <p className="text-stone-600 text-sm leading-relaxed">{tournament.fee_includes}</p>
                  </div>
                )}

                {tournament.contact_name && (
                  <div className="mt-6 pt-5 border-t border-stone-100">
                    <p className="font-medium text-stone-900">{tournament.contact_name}</p>
                    {tournament.contact_phone && (
                      <p className="text-stone-500 text-sm">{tournament.contact_phone}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollReveal>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <ScrollReveal delay={0.1}>
              <motion.div
                className="bg-white rounded-2xl border border-stone-200 p-6 transition-shadow duration-300"
                whileHover={{ scale: 1.015, boxShadow: `0 8px 30px ${hexToRgba(primaryColor, 0.12)}` }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="font-bold tracking-tight mb-4">Registration</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-baseline">
                    <span className="text-stone-500 text-sm">Entry Fee</span>
                    <span className="font-bold text-lg text-stone-900">
                      ${tournament.current_fee_dollars?.toFixed(2) || tournament.entry_fee_dollars?.toFixed(2)}
                    </span>
                  </div>

                  {tournament.early_bird_active && tournament.early_bird_deadline && (
                    <div
                      className="text-sm p-2.5 rounded-lg flex items-center gap-1.5"
                      style={{ backgroundColor: hexToRgba('#10b981', 0.08), color: '#059669' }}
                    >
                      <Check className="w-4 h-4" />
                      Early bird pricing active until {new Date(tournament.early_bird_deadline).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-stone-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Capacity
                    </span>
                    <span className="text-stone-600">
                      {tournament.confirmed_count || 0} / {tournament.public_capacity || tournament.max_capacity} registered
                    </span>
                  </div>

                  {tournament.waitlist_count > 0 && (
                    <div className="text-sm text-amber-600">
                      {tournament.waitlist_count} on waitlist
                    </div>
                  )}
                </div>

                {tournament.can_register ? (
                  <Link
                    to={`/${orgSlug}/tournaments/${tournamentSlug}/register`}
                    className="block w-full text-center px-5 py-3 text-sm font-semibold text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                    style={{
                      backgroundColor: primaryColor,
                      boxShadow: `0 2px 8px ${hexToRgba(primaryColor, 0.25)}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px ${hexToRgba(primaryColor, 0.35)}`;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${hexToRgba(primaryColor, 0.25)}`;
                    }}
                  >
                    Register Now
                  </Link>
                ) : tournament.at_capacity ? (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-stone-400 bg-stone-100 rounded-xl cursor-not-allowed">
                    At Capacity
                  </div>
                ) : tournament.status === 'open' ? (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-stone-400 bg-stone-100 rounded-xl cursor-not-allowed">
                    Registration Opening Soon
                  </div>
                ) : (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-stone-400 bg-stone-100 rounded-xl cursor-not-allowed">
                    Registration Closed
                  </div>
                )}

                {tournament.registration_deadline && (
                  <p className="text-xs text-stone-400 mt-3 text-center">
                    Registration deadline: {new Date(tournament.registration_deadline).toLocaleDateString()}
                  </p>
                )}
              </motion.div>
            </ScrollReveal>

            {/* Payment Options */}
            <ScrollReveal delay={0.2}>
              <div className="bg-white rounded-2xl border border-stone-200 p-6">
                <h3 className="font-bold tracking-tight mb-4">Payment Options</h3>
                <ul className="space-y-2.5 text-sm text-stone-600">
                  {tournament.allow_card && (
                    <li className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: hexToRgba(primaryColor, 0.08) }}
                      >
                        <Check className="w-3 h-3" style={{ color: primaryColor }} />
                      </div>
                      Credit/Debit Card
                    </li>
                  )}
                  {tournament.allow_cash && (
                    <li className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: hexToRgba(primaryColor, 0.08) }}
                      >
                        <Check className="w-3 h-3" style={{ color: primaryColor }} />
                      </div>
                      Cash (on tournament day)
                    </li>
                  )}
                  {tournament.allow_check && (
                    <li className="flex items-center gap-2.5">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: hexToRgba(primaryColor, 0.08) }}
                      >
                        <Check className="w-3 h-3" style={{ color: primaryColor }} />
                      </div>
                      <span>
                        Check
                        {tournament.checks_payable_to && (
                          <span className="text-stone-400"> (payable to {tournament.checks_payable_to})</span>
                        )}
                      </span>
                    </li>
                  )}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </main>

      {/* ================================================================= */}
      {/* SPONSORS                                                           */}
      {/* ================================================================= */}
      {tournament.sponsors && tournament.sponsors.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 lg:px-8 pb-12 sm:pb-16">
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-8">
              <Star className="w-5 h-5" style={{ color: primaryColor }} strokeWidth={2} />
              <h2 className="text-2xl font-bold tracking-tight">Our Sponsors</h2>
            </div>
          </ScrollReveal>

          {/* Major Sponsors */}
          {tournament.sponsors.filter(s => s.major).length > 0 && (
            <SponsorGrid
              sponsors={tournament.sponsors.filter(s => s.major)}
              size="large"
              columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              primaryColor={primaryColor}
            />
          )}

          {/* Supporting Sponsors */}
          {tournament.sponsors.filter(s => !s.major && s.tier !== 'hole').length > 0 && (
            <div className="mt-8">
              <ScrollReveal>
                <h3 className="text-lg font-semibold text-stone-700 tracking-tight mb-4">Supporting Sponsors</h3>
              </ScrollReveal>
              <SponsorGrid
                sponsors={tournament.sponsors.filter(s => !s.major && s.tier !== 'hole')}
                size="small"
                columns="grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                primaryColor={primaryColor}
              />
            </div>
          )}

          {/* Hole Sponsors */}
          {tournament.sponsors.filter(s => s.tier === 'hole').length > 0 && (
            <div className="mt-8">
              <ScrollReveal>
                <h3 className="text-lg font-semibold text-stone-700 tracking-tight mb-4">Hole Sponsors</h3>
              </ScrollReveal>
              <HoleSponsorGrid
                sponsors={tournament.sponsors.filter(s => s.tier === 'hole')}
                primaryColor={primaryColor}
              />
            </div>
          )}
        </section>
      )}

      {/* ================================================================= */}
      {/* FOOTER                                                             */}
      {/* ================================================================= */}
      <footer className="border-t border-stone-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 flex items-center justify-between text-sm text-stone-400">
          <p>
            Powered by{' '}
            <span className="font-medium text-stone-600">Pacific Golf</span>
          </p>
          <p className="hidden sm:block">Tournament management made simple</p>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}

// ---------------------------------------------------------------------------
// Sponsor grid with stagger
// ---------------------------------------------------------------------------

function SponsorGrid({
  sponsors,
  size,
  columns,
  primaryColor,
}: {
  sponsors: Sponsor[];
  size: 'large' | 'small';
  columns: string;
  primaryColor: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });

  return (
    <motion.div
      ref={ref}
      className={`grid ${columns} gap-4`}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
    >
      {sponsors.map((sponsor) => (
        <motion.div key={sponsor.id} variants={staggerItem}>
          <SponsorCard sponsor={sponsor} size={size} />
        </motion.div>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Hole sponsor grid with stagger
// ---------------------------------------------------------------------------

function HoleSponsorGrid({
  sponsors,
  primaryColor,
}: {
  sponsors: Sponsor[];
  primaryColor: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });

  const sorted = [...sponsors].sort((a, b) => (a.hole_number || 0) - (b.hole_number || 0));

  return (
    <motion.div
      ref={ref}
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
    >
      {sorted.map((sponsor) => (
        <motion.div
          key={sponsor.id}
          variants={staggerItem}
          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-stone-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-stone-200/60"
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{
              backgroundColor: hexToRgba(primaryColor, 0.08),
              color: primaryColor,
            }}
          >
            {sponsor.hole_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-stone-900 truncate text-sm">{sponsor.name}</p>
            {sponsor.website_url && (
              <a
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs hover:underline"
                style={{ color: primaryColor }}
              >
                Visit Website
              </a>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sponsor card
// ---------------------------------------------------------------------------

function SponsorCard({ sponsor, size }: { sponsor: Sponsor; size: 'large' | 'small' }) {
  const tierColors: Record<string, string> = {
    title: 'from-amber-50 to-amber-100/60 border-amber-200',
    platinum: 'from-slate-50 to-slate-100/60 border-slate-200',
    gold: 'from-amber-50/80 to-yellow-100/60 border-amber-200',
    silver: 'from-stone-50 to-stone-100/60 border-stone-200',
    bronze: 'from-orange-50/80 to-orange-100/60 border-orange-200',
  };

  const tierBadgeColors: Record<string, string> = {
    title: 'bg-amber-500 text-white',
    platinum: 'bg-slate-500 text-white',
    gold: 'bg-amber-500 text-white',
    silver: 'bg-stone-400 text-white',
    bronze: 'bg-orange-400 text-white',
  };

  const card = (
    <div
      className={`
        relative p-4 rounded-xl border bg-gradient-to-br transition-all duration-200
        hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60
        ${tierColors[sponsor.tier] || 'from-white to-stone-50 border-stone-200'}
        ${size === 'large' ? 'min-h-[120px]' : 'min-h-[80px]'}
      `}
    >
      <span className={`
        absolute -top-2 -right-2 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm
        ${tierBadgeColors[sponsor.tier] || 'bg-stone-500 text-white'}
      `}>
        {sponsor.tier === 'title' ? 'Title' : sponsor.tier.charAt(0).toUpperCase() + sponsor.tier.slice(1)}
      </span>

      {sponsor.logo_url ? (
        <div className="flex items-center justify-center h-full">
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            className={`max-w-full object-contain ${size === 'large' ? 'max-h-16' : 'max-h-10'}`}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Building2 className={`text-stone-400 mb-1 ${size === 'large' ? 'w-8 h-8' : 'w-5 h-5'}`} strokeWidth={1.5} />
          <p className={`font-semibold text-stone-700 ${size === 'large' ? 'text-sm' : 'text-xs'}`}>
            {sponsor.name}
          </p>
        </div>
      )}

      {sponsor.website_url && (
        <ExternalLink className="absolute bottom-2 right-2 w-3 h-3 text-stone-300" strokeWidth={1.5} />
      )}
    </div>
  );

  if (sponsor.website_url) {
    return (
      <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="block">
        {card}
      </a>
    );
  }

  return card;
}
