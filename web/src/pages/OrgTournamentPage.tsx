import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import { PublicHero } from '../components/PublicHero';
import { api, Tournament, Sponsor, SponsorTier } from '../services/api';
import { motion, MotionConfig, useInView } from 'framer-motion';
import {
  Calendar, MapPin, Users, DollarSign, Clock,
  Trophy, AlertCircle, ChevronLeft, ChevronRight, Star, Building2, ExternalLink, Check, Flag, Gift, Ticket
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { formatDate, formatEventDate } from '../utils/dates';
import { SignedInAdminBar } from '../components/SignedInAdminBar';

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

const FALLBACK_SPONSOR_TIERS: SponsorTier[] = [
  { key: 'title', label: 'Title Sponsors', sort_order: 0 },
  { key: 'platinum', label: 'Major Sponsors', sort_order: 1 },
  { key: 'gold', label: 'Major Sponsors', sort_order: 2 },
  { key: 'silver', label: 'Supporting Sponsors', sort_order: 3 },
  { key: 'bronze', label: 'Supporting Sponsors', sort_order: 4 },
  { key: 'hole', label: 'Hole Sponsors', sort_order: 5 },
];

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
      } catch (err: unknown) {
        console.error('Failed to fetch tournament:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tournament');
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

  const getStatusBadge = () => {
    if (tournament.status === 'in_progress') return { label: 'In Progress', bg: 'bg-amber-500', text: 'text-white' };
    if (tournament.status === 'completed') return { label: 'Completed', bg: 'bg-neutral-200', text: 'text-neutral-600' };
    if (tournament.status === 'archived') return { label: 'Archived', bg: 'bg-neutral-200', text: 'text-neutral-600' };
    if (tournament.status === 'draft') return { label: 'Coming Soon', bg: 'bg-[#0057B8]', text: 'text-white' };
    if (!tournament.registration_open) return { label: 'Registration Closed', bg: 'bg-neutral-200', text: 'text-neutral-600' };
    const isFull = tournament.at_capacity || tournament.public_at_capacity;
    if (isFull && tournament.waitlist_enabled) return { label: 'Waitlist Open', bg: 'bg-amber-500', text: 'text-white' };
    if (isFull) return { label: 'At Capacity', bg: 'bg-neutral-200', text: 'text-neutral-600' };
    return { label: 'Registration Open', bg: 'bg-[#E31837]', text: 'text-white' };
  };

  const status = getStatusBadge();
  const heroBannerUrl = tournament.banner_url_override || null;
  const sponsorTiers = [...(tournament.sponsor_tiers || FALLBACK_SPONSOR_TIERS)].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-white text-neutral-900">
      <SignedInAdminBar />
      {/* ================================================================= */}
      {/* HERO — MAW blue gradient (no photo)                               */}
      {/* ================================================================= */}
      <PublicHero
        imageUrl={heroBannerUrl}
        imageAlt={`${tournament.name} header artwork`}
        imageDisplay="showcase"
        containerClassName="min-h-[320px] lg:min-h-[360px]"
        contentClassName="max-w-3xl"
      >
        <div className="flex items-start gap-4 sm:gap-6">
          <img
            src="/images/maw-star-icon.png"
            alt="Make-A-Wish Guam & CNMI"
            className="mt-1 hidden h-10 flex-shrink-0 rounded-lg sm:block"
          />
          <div>
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-white/70 transition-colors hover:text-white">
              <ChevronLeft className="w-4 h-4" />
              Back to Events
            </Link>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              {tournament.name}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-white/82 sm:text-lg">
              {formatEventDate(tournament.event_date)}{tournament.location_name ? ` · ${tournament.location_name}` : ''}
            </p>
            <span className={`mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${status.bg} ${status.text}`}>
              {status.label}
            </span>
          </div>
        </div>
      </PublicHero>

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
              <span>{tournament.entry_fee_display || `$${((tournament.entry_fee || 0) / 100).toFixed(0)}/team`}</span>
            </div>
            {tournament.max_capacity && (
              <div className="flex items-center gap-2 text-neutral-600">
                <Users className="w-4 h-4 text-[#0057B8]" strokeWidth={1.5} />
                <span>{tournament.confirmed_count || 0} / {tournament.max_capacity} teams registered</span>
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
                    {(tournament.check_in_time || tournament.registration_time) && (
                      <p className="text-neutral-500 text-sm">Check-in: {tournament.check_in_time || tournament.registration_time}</p>
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

                {tournament.tournament_info && (
                  <div className="mt-6 p-4 rounded-2xl bg-[#F5F5F5]">
                    <p className="font-medium text-neutral-900 mb-1">Tournament Info</p>
                    <p className="text-neutral-600 text-sm leading-relaxed whitespace-pre-line">{tournament.tournament_info}</p>
                  </div>
                )}

                {(tournament.contact_name || tournament.contact_phone || tournament.contact_email) && (
                  <div className="mt-6 pt-5 border-t border-neutral-100">
                    {tournament.contact_name && (
                      <p className="font-medium text-neutral-900">{tournament.contact_name}</p>
                    )}
                    {tournament.contact_phone && (
                      <p className="text-neutral-500 text-sm">{tournament.contact_phone}</p>
                    )}
                    {tournament.contact_email && (
                      <a href={`mailto:${tournament.contact_email}`} className="text-[#0057B8] hover:underline text-sm">{tournament.contact_email}</a>
                    )}
                  </div>
                )}

                {(tournament.event_schedule || tournament.check_in_time || tournament.start_time) && (
                  <div className="mt-6 p-4 rounded-2xl bg-[#F5F5F5]">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-5 h-5 text-[#0057B8]" strokeWidth={1.5} />
                      <p className="font-medium text-neutral-900">Event Schedule</p>
                    </div>
                    <ul className="space-y-1.5 text-sm text-neutral-600">
                      {tournament.event_schedule
                        ? tournament.event_schedule.split('\n').filter(Boolean).map((line: string, i: number) => (
                            <li key={i}>{line}</li>
                          ))
                        : (
                          <>
                            {tournament.check_in_time && <li>{tournament.check_in_time} — Check-in</li>}
                            {tournament.start_time && <li>{tournament.start_time}</li>}
                          </>
                        )
                      }
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
                      {tournament.entry_fee_display || `$${((tournament.entry_fee || 0) / 100).toFixed(0)}/team`}
                    </span>
                  </div>

                  {tournament.early_bird_active && tournament.early_bird_deadline && (
                    <div className="text-sm p-2.5 rounded-xl bg-emerald-50 text-emerald-700 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      Early bird pricing active until {formatDate(tournament.early_bird_deadline)}
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                      Capacity
                    </span>
                    <span className="text-neutral-600">
                      {tournament.confirmed_count || 0} / {tournament.max_capacity} teams registered
                    </span>
                  </div>

                  {tournament.waitlist_count > 0 && (
                    <div className="text-sm text-amber-600">
                      {tournament.waitlist_count} on waitlist
                    </div>
                  )}
                </div>

                {tournament.can_register ? (
                  (tournament.at_capacity || tournament.public_at_capacity) && tournament.waitlist_enabled ? (
                    <Link
                      to={`/${tournamentSlug}/register`}
                      className="flex items-center justify-center gap-2 w-full text-center px-5 py-3 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-full transition-colors duration-200"
                    >
                      Join Waitlist
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </Link>
                  ) : (
                    <Link
                      to={`/${tournamentSlug}/register`}
                      className="flex items-center justify-center gap-2 w-full text-center px-5 py-3 text-sm font-semibold text-white bg-[#E31837] hover:bg-[#c41230] rounded-full transition-colors duration-200"
                    >
                      Register Now
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </Link>
                  )
                ) : (tournament.at_capacity || tournament.public_at_capacity) ? (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-neutral-400 bg-neutral-100 rounded-full cursor-not-allowed">
                    At Capacity
                  </div>
                ) : !tournament.registration_open ? (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-neutral-400 bg-neutral-100 rounded-full cursor-not-allowed">
                    Registration Closed
                  </div>
                ) : (
                  <div className="w-full text-center px-5 py-3 text-sm font-semibold text-neutral-400 bg-neutral-100 rounded-full cursor-not-allowed">
                    Registration Closed
                  </div>
                )}

                {tournament.registration_deadline && (
                  <p className="text-xs text-neutral-400 mt-3 text-center">
                    Registration deadline: {formatDate(tournament.registration_deadline)}
                  </p>
                )}
              </div>
            </ScrollReveal>

            {/* Payment Options */}
            {(tournament.payment_instructions || tournament.allow_card || tournament.allow_cash || tournament.allow_check) && (
              <ScrollReveal delay={0.2}>
                <div className="bg-white rounded-2xl border border-neutral-200 p-6">
                  <h3 className="font-bold tracking-tight mb-4">Payment Options</h3>
                  {tournament.payment_instructions ? (
                    <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">{tournament.payment_instructions}</p>
                  ) : (
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
                  )}
                </div>
              </ScrollReveal>
            )}

            {/* Raffle CTA — only when raffle is enabled */}
            {tournament.raffle_enabled && (
              <ScrollReveal delay={0.3}>
                <Link
                  to={`/${tournamentSlug}/raffle`}
                  className="block bg-white rounded-2xl shadow-lg border border-neutral-200 p-6 transition-shadow hover:shadow-xl group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F5A800]/10 flex items-center justify-center">
                      <Gift className="w-5 h-5 text-[#F5A800]" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-bold tracking-tight text-lg text-neutral-900">Raffle Prizes</h3>
                  </div>
                  {tournament.raffle_description ? (
                    <p className="text-neutral-500 text-sm mb-4 line-clamp-2">{tournament.raffle_description}</p>
                  ) : (
                    <p className="text-neutral-500 text-sm mb-4">View prizes and check your tickets</p>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0057B8] group-hover:text-[#003a6e] transition-colors">
                    <Ticket className="w-4 h-4" strokeWidth={1.5} />
                    View Raffle Board
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </Link>
              </ScrollReveal>
            )}
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

            {/* Dynamic sponsor tiers */}
            {(() => {
              return sponsorTiers.map((tierDef) => {
                const tierSponsors = (tournament.sponsors || []).filter(s => s.tier === tierDef.key);
                if (tierSponsors.length === 0) return null;

                const isHoleTier = tierSponsors.some(s => s.hole_number != null);
                const isTopTier = tierDef.sort_order <= 1;

                return (
                  <div key={tierDef.key} className="mb-10">
                    <ScrollReveal>
                      <h3 className="text-lg font-semibold text-neutral-700 tracking-tight mb-4">
                        {tierDef.label}{tierDef.label.toLowerCase().includes('sponsor') ? '' : ' Sponsors'}
                      </h3>
                    </ScrollReveal>
                    {isHoleTier ? (
                      <HoleSponsorGrid sponsors={tierSponsors} />
                    ) : (
                      <SponsorGrid
                        sponsors={tierSponsors}
                        size={isTopTier ? 'large' : 'small'}
                        columns={isTopTier ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}
                      />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* FOOTER                                                             */}
      {/* ================================================================= */}
      <footer className="border-t border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-neutral-400">
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
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
    >
      {sorted.map((sponsor) => {
        const inner = (
          <motion.div
            key={sponsor.id}
            variants={staggerItem}
            className="relative bg-white rounded-2xl border border-neutral-200 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
          >
            {/* Logo area */}
            <div className="flex items-center justify-center bg-neutral-50/60 p-4 min-h-[80px]">
              {sponsor.logo_url ? (
                <img
                  src={sponsor.logo_url}
                  alt={sponsor.name}
                  className="max-w-full max-h-10 object-contain"
                />
              ) : (
                <Building2 className="w-8 h-8 text-neutral-300" strokeWidth={1.5} />
              )}
            </div>
            {/* Name */}
            <div className="text-center px-2 py-2">
              <p className="font-semibold text-neutral-800 text-xs truncate">{sponsor.name}</p>
              {sponsor.website_url && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#0057B8] mt-1">
                  <ExternalLink className="w-2.5 h-2.5" />
                  Visit
                </span>
              )}
            </div>
          </motion.div>
        );
        return sponsor.website_url ? (
          <a key={sponsor.id} href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="block">
            {inner}
          </a>
        ) : (
          <div key={sponsor.id}>{inner}</div>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sponsor card
// ---------------------------------------------------------------------------

function SponsorCard({ sponsor, size }: { sponsor: Sponsor; size: 'large' | 'small' }) {
  const isLarge = size === 'large';

  const card = (
    <div
      className={`
        group relative rounded-2xl border bg-white transition-all duration-200
        hover:shadow-lg hover:-translate-y-0.5
        border-neutral-200
        flex flex-col
      `}
    >
      {/* Logo / placeholder area */}
      <div className={`flex items-center justify-center bg-neutral-50/60 rounded-t-2xl ${
        isLarge ? 'p-5 min-h-[100px]' : 'p-4 min-h-[72px]'
      }`}>
        {sponsor.logo_url ? (
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            className={`max-w-full object-contain ${isLarge ? 'max-h-14' : 'max-h-9'}`}
          />
        ) : (
          <Building2
            className={`text-neutral-300 ${isLarge ? 'w-10 h-10' : 'w-7 h-7'}`}
            strokeWidth={1.5}
          />
        )}
      </div>

      {/* Name + description */}
      <div className={`text-center ${isLarge ? 'px-3 py-3' : 'px-2 py-2'}`}>
        <p className={`font-semibold text-neutral-800 leading-tight ${
          isLarge ? 'text-sm' : 'text-xs'
        }`}>
          {sponsor.name}
        </p>
        {sponsor.description && isLarge && (
          <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
            {sponsor.description}
          </p>
        )}
        {sponsor.website_url && (
          <span className={`inline-flex items-center gap-1 text-[#0057B8] mt-1.5 ${
            isLarge ? 'text-xs' : 'text-[10px]'
          }`}>
            <ExternalLink className="w-2.5 h-2.5" />
            Visit
          </span>
        )}
      </div>
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
