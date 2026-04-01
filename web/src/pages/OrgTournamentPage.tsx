import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import { api, Tournament, Sponsor } from '../services/api';
import { motion, MotionConfig, useInView } from 'framer-motion';
import {
  Calendar, MapPin, Users, DollarSign, Clock,
  Trophy, AlertCircle, ChevronLeft, ChevronRight, Star, Building2, ExternalLink, Check, Flag
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { hexToRgba } from '../utils/colors';
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
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization, isLoading: orgLoading } = useOrganization();
  const orgSlug = organization?.slug || 'make-a-wish-guam';
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

  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#0057B8]/20 border-t-[#0057B8] mx-auto" />
          <p className="mt-5 text-sm text-neutral-500 tracking-wide uppercase">Loading tournament</p>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Tournament Not Found</h1>
          <p className="mt-3 text-neutral-500 leading-relaxed">{error || 'The tournament does not exist.'}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 text-sm font-semibold text-white bg-[#0057B8] rounded-full transition-colors hover:bg-[#003a6e]"
          >
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    open: { label: 'Registration Open', bg: 'bg-[#E31837]', text: 'text-white' },
    closed: { label: 'Registration Closed', bg: 'bg-neutral-200', text: 'text-neutral-600' },
    in_progress: { label: 'In Progress', bg: 'bg-amber-500', text: 'text-white' },
    completed: { label: 'Completed', bg: 'bg-neutral-200', text: 'text-neutral-600' },
    draft: { label: 'Coming Soon', bg: 'bg-[#0057B8]', text: 'text-white' },
  };

  const status = statusConfig[tournament.status] || { label: tournament.status, bg: 'bg-neutral-200', text: 'text-neutral-600' };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-white text-neutral-900">
      {/* ================================================================= */}
      {/* HERO — MAW blue gradient (no photo)                               */}
      {/* ================================================================= */}
      <div className="relative bg-gradient-to-br from-[#0057B8] via-[#00408a] to-[#002d63] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="flex items-start gap-6">
            <img
              src="/images/maw-star-icon.png"
              alt="Make-A-Wish Guam & CNMI"
              className="h-10 rounded-lg hidden sm:block flex-shrink-0 mt-1"
            />
            <div>
              <Link to="/" className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition-colors">
                <ChevronLeft className="w-4 h-4" />
                Back to Events
              </Link>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
                {tournament.name}
              </h1>
              <p className="text-white/80 text-lg mb-4">{formatEventDate(tournament.event_date)} · {tournament.location_name}</p>
              <span className="inline-flex items-center gap-1.5 bg-[#E31837] text-white text-sm font-semibold px-3 py-1.5 rounded-full">
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* KEY STATS BAR                                                      */}
      {/* ================================================================= */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-8 text-sm">
            {tournament.event_date && (
              <div className="flex items-center gap-2 text-neutral-600">
                <Calendar className="w-4 h-4 text-[#0057B8]" strokeWidth={1.5} />
                <span>{formatEventDate(tournament.event_date)}</span>
              </div>
            )}
            {tournament.location_name && (
              <div className="flex items-center gap-2 text-neutral-600">
                <MapPin className="w-4 h-4 text-[#0057B8]" strokeWidth={1.5} />
                <span>{tournament.location_name}</span>
              </div>
            )}
            {tournament.format_name && (
              <div className="flex items-center gap-2 text-neutral-600">
                <Flag className="w-4 h-4 text-[#0057B8]" strokeWidth={1.5} />
                <span>{tournament.format_name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-neutral-600">
              <DollarSign className="w-4 h-4 text-[#0057B8]" strokeWidth={1.5} />
              <span>$300/team</span>
            </div>
            {tournament.max_capacity && (
              <div className="flex items-center gap-2 text-neutral-600">
                <Users className="w-4 h-4 text-[#0057B8]" strokeWidth={1.5} />
                <span>{tournament.confirmed_count || 0} / {tournament.max_capacity} registered</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAIN CONTENT — Two columns                                        */}
      {/* ================================================================= */}
      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Details Column */}
          <ScrollReveal className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8">
              <h2 className="text-xl font-bold tracking-tight mb-6">Tournament Details</h2>

              <div className="space-y-5">
                {tournament.location_name && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 mt-0.5 shrink-0 text-[#0057B8]" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium text-neutral-900">{tournament.location_name}</p>
                      {tournament.location_address && (
                        <p className="text-neutral-500 text-sm">{tournament.location_address}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 mt-0.5 shrink-0 text-[#0057B8]" strokeWidth={1.5} />
                  <div>
                    <p className="font-medium text-neutral-900">{formatEventDate(tournament.event_date) || 'Date TBA'}</p>
                    {tournament.registration_time && (
                      <p className="text-neutral-500 text-sm">Registration: {tournament.registration_time}</p>
                    )}
                    {tournament.start_time && (
                      <p className="text-neutral-500 text-sm">Start: {tournament.start_time}</p>
                    )}
                  </div>
                </div>

                {tournament.format_name && (
                  <div className="flex items-start gap-3">
                    <Trophy className="w-5 h-5 mt-0.5 shrink-0 text-[#0057B8]" strokeWidth={1.5} />
                    <div>
                      <p className="font-medium text-neutral-900">Format: {tournament.format_name}</p>
                      {tournament.tournament_format && (
                        <p className="text-neutral-500 text-sm capitalize">
                          {tournament.tournament_format.replace('_', ' ')}
                          {tournament.team_size && tournament.team_size > 1 && ` (${tournament.team_size}-person teams)`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {tournament.fee_includes && (
                  <div className="mt-6 p-4 rounded-2xl bg-[#F5F5F5]">
                    <p className="font-medium text-neutral-900 mb-1">Entry Fee Includes:</p>
                    <p className="text-neutral-600 text-sm leading-relaxed">{tournament.fee_includes}</p>
                  </div>
                )}

                {tournament.contact_name && (
                  <div className="mt-6 pt-5 border-t border-neutral-100">
                    <p className="font-medium text-neutral-900">{tournament.contact_name}</p>
                    {tournament.contact_phone && (
                      <p className="text-neutral-500 text-sm">{tournament.contact_phone}</p>
                    )}
                  </div>
                )}

                {(tournament.check_in_time || tournament.start_time) && (
                  <div className="mt-6 p-4 rounded-2xl bg-[#F5F5F5]">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-5 h-5 text-[#0057B8]" strokeWidth={1.5} />
                      <p className="font-medium text-neutral-900">Event Schedule</p>
                    </div>
                    <ul className="space-y-1.5 text-sm text-neutral-600">
                      <li>7:00 AM &mdash; Check-in</li>
                      <li>8:00 AM &mdash; Shotgun Start</li>
                      <li>1:30 PM &mdash; Banquet &amp; Awards</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </ScrollReveal>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration CTA Card */}
            <ScrollReveal delay={0.1}>
              <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-6">
                <h3 className="font-bold tracking-tight mb-4 text-lg">Registration</h3>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-baseline">
                    <span className="text-neutral-500 text-sm">Entry Fee</span>
                    <span className="font-bold text-xl text-neutral-900">
                      $300/team
                    </span>
                  </div>

                  {tournament.early_bird_active && tournament.early_bird_deadline && (
                    <div className="text-sm p-2.5 rounded-xl bg-emerald-50 text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      Early bird pricing active until {new Date(tournament.early_bird_deadline).toLocaleDateString()}
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Capacity
                    </span>
                    <span className="text-neutral-600">
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
                    to={`/${tournamentSlug}/register`}
                    className="flex items-center justify-center gap-2 w-full text-center px-5 py-3 text-sm font-semibold text-white bg-[#E31837] hover:bg-[#c41230] rounded-full transition-colors duration-200"
                  >
                    Register Now
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </Link>
                ) : tournament.at_capacity ? (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-neutral-400 bg-neutral-100 rounded-full cursor-not-allowed">
                    At Capacity
                  </div>
                ) : tournament.status === 'open' ? (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-neutral-400 bg-neutral-100 rounded-full cursor-not-allowed">
                    Registration Opening Soon
                  </div>
                ) : (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-neutral-400 bg-neutral-100 rounded-full cursor-not-allowed">
                    Registration Closed
                  </div>
                )}

                {tournament.registration_deadline && (
                  <p className="text-xs text-neutral-400 mt-3 text-center">
                    Registration deadline: {new Date(tournament.registration_deadline).toLocaleDateString()}
                  </p>
                )}
              </div>
            </ScrollReveal>

            {/* Payment Options */}
            <ScrollReveal delay={0.2}>
              <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                <h3 className="font-bold tracking-tight mb-4">Payment Options</h3>
                <ul className="space-y-2.5 text-sm text-neutral-600">
                  {tournament.allow_card && (
                    <li className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#0057B8]/10">
                        <Check className="w-3 h-3 text-[#0057B8]" />
                      </div>
                      Credit/Debit Card
                    </li>
                  )}
                  {tournament.allow_cash && (
                    <li className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#0057B8]/10">
                        <Check className="w-3 h-3 text-[#0057B8]" />
                      </div>
                      Cash (on tournament day)
                    </li>
                  )}
                  {tournament.allow_check && (
                    <li className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-[#0057B8]/10">
                        <Check className="w-3 h-3 text-[#0057B8]" />
                      </div>
                      <span>
                        Check
                        {tournament.checks_payable_to && (
                          <span className="text-neutral-400"> (payable to {tournament.checks_payable_to})</span>
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
        <section className="bg-[#F5F5F5]">
          <div className="max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
            <ScrollReveal>
              <div className="flex items-center gap-3 mb-8">
                <Star className="w-5 h-5 text-[#F5A800]" strokeWidth={2} />
                <h2 className="text-2xl font-bold tracking-tight">Our Sponsors</h2>
              </div>
            </ScrollReveal>

            {/* Title Sponsors */}
            {tournament.sponsors.filter(s => s.tier === 'title').length > 0 && (
              <div className="mb-10">
                <ScrollReveal>
                  <h3 className="text-lg font-semibold text-neutral-700 tracking-tight mb-4">Title Sponsors</h3>
                </ScrollReveal>
                <SponsorGrid
                  sponsors={tournament.sponsors.filter(s => s.tier === 'title')}
                  size="large"
                  columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                />
              </div>
            )}

            {/* Platinum/Gold */}
            {tournament.sponsors.filter(s => s.tier === 'platinum' || s.tier === 'gold').length > 0 && (
              <div className="mb-10">
                <ScrollReveal>
                  <h3 className="text-lg font-semibold text-neutral-700 tracking-tight mb-4">Major Sponsors</h3>
                </ScrollReveal>
                <SponsorGrid
                  sponsors={tournament.sponsors.filter(s => s.tier === 'platinum' || s.tier === 'gold')}
                  size="large"
                  columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                />
              </div>
            )}

            {/* Silver/Bronze */}
            {tournament.sponsors.filter(s => s.tier === 'silver' || s.tier === 'bronze').length > 0 && (
              <div className="mb-10">
                <ScrollReveal>
                  <h3 className="text-lg font-semibold text-neutral-700 tracking-tight mb-4">Supporting Sponsors</h3>
                </ScrollReveal>
                <SponsorGrid
                  sponsors={tournament.sponsors.filter(s => s.tier === 'silver' || s.tier === 'bronze')}
                  size="small"
                  columns="grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
                />
              </div>
            )}

            {/* Other major sponsors */}
            {tournament.sponsors.filter(s => s.major && !['title', 'platinum', 'gold', 'silver', 'bronze', 'hole'].includes(s.tier)).length > 0 && (
              <SponsorGrid
                sponsors={tournament.sponsors.filter(s => s.major && !['title', 'platinum', 'gold', 'silver', 'bronze', 'hole'].includes(s.tier))}
                size="large"
                columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              />
            )}

            {/* Hole Sponsors */}
            {tournament.sponsors.filter(s => s.tier === 'hole').length > 0 && (
              <div className="mt-8">
                <ScrollReveal>
                  <h3 className="text-lg font-semibold text-neutral-700 tracking-tight mb-4">Hole Sponsors</h3>
                </ScrollReveal>
                <HoleSponsorGrid
                  sponsors={tournament.sponsors.filter(s => s.tier === 'hole')}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* FOOTER                                                             */}
      {/* ================================================================= */}
      <footer className="border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 flex items-center justify-between text-sm text-neutral-400">
          <p>
            Powered by{' '}
            <span className="font-medium text-neutral-600">Shimizu Technology</span>
          </p>
          <div className="flex items-center gap-4">
            <p className="hidden sm:block">Supporting children with critical illnesses</p>
            <Link to="/admin" className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
              Admin
            </Link>
          </div>
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
}: {
  sponsors: Sponsor[];
  size: 'large' | 'small';
  columns: string;
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
}: {
  sponsors: Sponsor[];
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
          className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-neutral-200 transition-shadow duration-200 hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-[#0057B8]/10 text-[#0057B8]">
            {sponsor.hole_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-neutral-900 truncate text-sm">{sponsor.name}</p>
            {sponsor.website_url && (
              <a
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0057B8] hover:underline"
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
    silver: 'from-neutral-50 to-neutral-100/60 border-neutral-200',
    bronze: 'from-orange-50/80 to-orange-100/60 border-orange-200',
  };

  const tierBadgeColors: Record<string, string> = {
    title: 'bg-amber-500 text-white',
    platinum: 'bg-slate-500 text-white',
    gold: 'bg-amber-500 text-white',
    silver: 'bg-neutral-400 text-white',
    bronze: 'bg-orange-400 text-white',
  };

  const card = (
    <div
      className={`
        relative p-4 rounded-2xl border bg-gradient-to-br transition-shadow duration-200
        hover:shadow-md
        ${tierColors[sponsor.tier] || 'from-white to-neutral-50 border-neutral-200'}
        ${size === 'large' ? 'min-h-[120px]' : 'min-h-[80px]'}
      `}
    >
      <span className={`
        absolute -top-2 -right-2 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm
        ${tierBadgeColors[sponsor.tier] || 'bg-neutral-500 text-white'}
      `}>
        {sponsor.tier === 'title' ? 'Title' : sponsor.tier.charAt(0).toUpperCase() + sponsor.tier.slice(1)}
      </span>

      {sponsor.logo_url ? (
        <div className="flex items-center justify-center h-full">
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            className={`max-w-full object-contain ${size === 'large' ? 'max-h-16' : 'max-h-8'}`}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Building2 className={`text-neutral-400 mb-1 ${size === 'large' ? 'w-8 h-8' : 'w-5 h-5'}`} strokeWidth={1.5} />
          <p className={`font-semibold text-neutral-700 ${size === 'large' ? 'text-sm' : 'text-xs'}`}>
            {sponsor.name}
          </p>
        </div>
      )}

      {sponsor.website_url && (
        <ExternalLink className="absolute bottom-2 right-2 w-3 h-3 text-neutral-300" strokeWidth={1.5} />
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
