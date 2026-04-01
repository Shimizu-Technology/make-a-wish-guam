import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import { SignedInAdminBar } from '../components/SignedInAdminBar';
import { api, Tournament } from '../services/api';
import { motion, MotionConfig, useInView } from 'framer-motion';
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  ChevronRight,
  Clock,
  Mail,
  Phone,
  Globe,
  Flag,
  DollarSign,
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
  visible: { transition: { staggerChildren: 0.1 } },
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

export function OrganizationLandingPage() {
  const { organization, isLoading: orgLoading } = useOrganization();
  const orgSlug = organization?.slug || 'make-a-wish-guam';
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Make-A-Wish Guam & CNMI — Events';
  }, []);

  useEffect(() => {
    async function fetchTournaments() {
      if (!orgSlug) return;
      setIsLoading(true);
      try {
        const data = await api.getOrganizationTournaments(orgSlug);
        setTournaments(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load tournaments';
        console.error('Failed to fetch tournaments:', err);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTournaments();
  }, [orgSlug]);

  // Loading state
  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#0057B8]/20 border-t-[#0057B8] mx-auto" />
          <p className="mt-5 text-sm text-neutral-500 tracking-wide uppercase">Loading</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <Flag className="w-12 h-12 text-neutral-300 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            Organization Not Found
          </h1>
          <p className="mt-3 text-neutral-500 leading-relaxed">
            The requested organization does not exist or may have been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-white text-neutral-900">
      <SignedInAdminBar dashboardPath="/admin" />

      {/* ================================================================= */}
      {/* HERO — MAW Blue header                                            */}
      {/* ================================================================= */}
      <header
        className="relative overflow-hidden min-h-[280px] lg:min-h-[360px] flex items-center"
        style={{
          background: 'linear-gradient(135deg, #0057B8 0%, #003a6e 100%)',
        }}
      >
        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 py-10 lg:py-20 w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease }}
            className="mb-8"
          >
            <img
              src="/images/maw-star-icon.png"
              alt="Make-A-Wish Guam & CNMI"
              className="h-12 rounded-lg"
            />
          </motion.div>

          <motion.h1
            className="text-3xl lg:text-5xl font-bold tracking-tight text-white mb-3"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
          >
            {organization.name}
          </motion.h1>

          <motion.p
            className="text-base sm:text-lg text-white/90 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25, ease }}
          >
            Granting wishes since 1988
          </motion.p>

          <motion.p
            className="text-base sm:text-lg text-white/75 max-w-2xl leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35, ease }}
          >
            Together we create life-changing wishes for children with critical illnesses
          </motion.p>

          <motion.div
            className="flex gap-8 mt-8 pt-8 border-t border-white/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease }}
          >
            <div>
              <div className="text-2xl font-bold text-white">38+</div>
              <div className="text-sm text-white/70">Years granting wishes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">100s</div>
              <div className="text-sm text-white/70">Wishes granted in Guam</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">May 2</div>
              <div className="text-sm text-white/70">Golf for Wishes</div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* UPCOMING EVENTS                                                    */}
      {/* ================================================================= */}
      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
        <ScrollReveal>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-[#0057B8]/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-[#0057B8]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Upcoming Events</h2>
              <p className="text-sm text-neutral-500">Register for Make-A-Wish Guam & CNMI charity events</p>
            </div>
          </div>
        </ScrollReveal>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-2xl mb-8 text-sm">
            {error}
          </div>
        )}

        {tournaments.length === 0 ? (
          <ScrollReveal>
            <div className="text-center py-20 bg-[#F5F5F5] rounded-2xl border border-neutral-200">
              <Flag className="w-10 h-10 text-[#0057B8] mx-auto mb-5" strokeWidth={1.5} />
              <p className="text-neutral-600 font-medium">No tournaments available at this time.</p>
              <p className="text-sm text-neutral-400 mt-2">Check back soon for upcoming events.</p>
            </div>
          </ScrollReveal>
        ) : (
          <TournamentList
            tournaments={tournaments}
          />
        )}
      </main>

      {/* ================================================================= */}
      {/* CONTACT                                                            */}
      {/* ================================================================= */}
      {(organization.contact_email || organization.contact_phone || organization.website_url) && (
        <section className="bg-[#F5F5F5]">
          <div className="max-w-5xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
            <ScrollReveal>
              <h3 className="text-xl font-semibold tracking-tight mb-8">Get in Touch</h3>
            </ScrollReveal>

            <div className="grid sm:grid-cols-3 gap-4">
              {organization.contact_email && (
                <ScrollReveal delay={0}>
                  <a
                    href={`mailto:${organization.contact_email}`}
                    className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-neutral-200 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#0057B8]/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-[#0057B8]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">
                        Email
                      </p>
                      <p className="text-sm text-neutral-700 group-hover:text-neutral-900 truncate transition-colors">
                        {organization.contact_email}
                      </p>
                    </div>
                  </a>
                </ScrollReveal>
              )}
              {organization.contact_phone && (
                <ScrollReveal delay={0.08}>
                  <a
                    href={`tel:${organization.contact_phone}`}
                    className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-neutral-200 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#0057B8]/10 flex items-center justify-center">
                      <Phone className="w-5 h-5 text-[#0057B8]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">
                        Phone
                      </p>
                      <p className="text-sm text-neutral-700 group-hover:text-neutral-900 transition-colors">
                        {organization.contact_phone}
                      </p>
                    </div>
                  </a>
                </ScrollReveal>
              )}
              {organization.website_url && (
                <ScrollReveal delay={0.16}>
                  <a
                    href={organization.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4 p-5 bg-white rounded-2xl border border-neutral-200 hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="shrink-0 w-10 h-10 rounded-full bg-[#0057B8]/10 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-[#0057B8]" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">
                        Website
                      </p>
                      <p className="text-sm text-neutral-700 group-hover:text-neutral-900 truncate transition-colors">
                        {organization.website_url.replace(/^https?:\/\//, '')}
                      </p>
                    </div>
                  </a>
                </ScrollReveal>
              )}
            </div>
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
// Tournament list with staggered entrance
// ---------------------------------------------------------------------------

function TournamentList({
  tournaments,
}: {
  tournaments: Tournament[];
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });

  return (
    <motion.div
      ref={ref}
      className="space-y-5"
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
    >
      {tournaments.map((tournament) => (
        <motion.div key={tournament.id} variants={staggerItem}>
          <TournamentCard
            tournament={tournament}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tournament card
// ---------------------------------------------------------------------------

interface TournamentCardProps {
  tournament: Tournament;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: 'Registration Open', bg: 'bg-[#E31837]', text: 'text-white' },
  closed: { label: 'Registration Closed', bg: 'bg-neutral-200', text: 'text-neutral-600' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-500', text: 'text-white' },
  completed: { label: 'Completed', bg: 'bg-neutral-200', text: 'text-neutral-600' },
  draft: { label: 'Coming Soon', bg: 'bg-[#0057B8]', text: 'text-white' },
};

function TournamentCard({ tournament }: TournamentCardProps) {
  const status = statusConfig[tournament.status] || {
    label: tournament.status,
    bg: 'bg-neutral-200',
    text: 'text-neutral-600',
  };

  const capacityPercent =
    tournament.max_capacity && tournament.confirmed_count != null
      ? Math.min(100, Math.round((tournament.confirmed_count / tournament.max_capacity) * 100))
      : null;

  return (
    <div className="rounded-2xl border border-neutral-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-[#E31837] to-[#0057B8]" />
      <div className="p-6 sm:p-7">
        {/* Top row: status badge + name */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <span className={`inline-flex items-center text-xs font-semibold rounded-full px-3 py-1 mb-3 ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            <h3 className="text-xl font-bold tracking-tight text-neutral-900">
              {tournament.name}
            </h3>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-sm">
          {tournament.event_date && (
            <Detail icon={Calendar} label="Date" value={formatEventDate(tournament.event_date)} />
          )}
          {tournament.location_name && (
            <Detail icon={MapPin} label="Location" value={tournament.location_name} />
          )}
          {tournament.format_name && (
            <Detail icon={Flag} label="Format" value={tournament.format_name} />
          )}
          <Detail
              icon={DollarSign}
              label="Entry Fee"
              value="$300/team"
            />
        </div>

        {/* Capacity bar */}
        {tournament.max_capacity != null && capacityPercent != null && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                {tournament.confirmed_count ?? 0} / {tournament.max_capacity} registered
              </span>
              <span>{capacityPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0057B8] transition-all duration-700 ease-out"
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {tournament.can_register ? (
            <>
              <Link
                to={`/${tournament.slug}/register`}
                className="inline-flex items-center justify-center gap-2 bg-[#E31837] hover:bg-[#c41230] text-white font-semibold text-sm rounded-full px-6 py-2.5 transition-colors duration-200 w-full sm:w-auto min-h-[44px]"
              >
                Register Now
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </Link>
              <Link
                to={`/${tournament.slug}`}
                className="inline-flex items-center justify-center gap-2 border border-[#0057B8] text-[#0057B8] font-medium text-sm rounded-full px-6 py-2.5 hover:bg-[#0057B8]/5 transition-colors duration-200 w-full sm:w-auto min-h-[44px]"
              >
                View Details
              </Link>
            </>
          ) : (
            <Link
              to={`/${tournament.slug}`}
              className="inline-flex items-center justify-center gap-2 border border-[#0057B8] text-[#0057B8] font-medium text-sm rounded-full px-6 py-2.5 hover:bg-[#0057B8]/5 transition-colors duration-200 w-full sm:w-auto min-h-[44px]"
            >
              View Details
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail row helper
// ---------------------------------------------------------------------------

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string; style?: React.CSSProperties }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#0057B8]" strokeWidth={1.5} />
      <div>
        <p className="text-xs text-neutral-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-neutral-700 font-medium">{value}</p>
      </div>
    </div>
  );
}
