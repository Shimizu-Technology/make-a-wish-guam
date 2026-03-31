import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  visible: { transition: { staggerChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

// ---------------------------------------------------------------------------
// Noise overlay for depth
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

export function OrganizationLandingPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { organization, isLoading: orgLoading } = useOrganization();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-300 border-t-stone-700 mx-auto" />
          <p className="mt-5 text-sm text-stone-500 tracking-wide uppercase">Loading</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center max-w-md px-6">
          <Flag className="w-12 h-12 text-stone-300 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">
            Organization Not Found
          </h1>
          <p className="mt-3 text-stone-500 leading-relaxed">
            The requested organization does not exist or may have been removed.
          </p>
        </div>
      </div>
    );
  }

  const primaryColor = organization.primary_color || '#1e3a2f';
  const primaryDark = adjustColor(primaryColor, -0.15);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <SignedInAdminBar dashboardPath={`/${orgSlug}/admin`} />
      {/* ================================================================= */}
      {/* HERO                                                               */}
      {/* ================================================================= */}
      <header className="relative overflow-hidden">
        {organization.banner_url ? (
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

        <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 py-16 sm:py-24 text-center">
          {organization.logo_url && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease }}
              className="mb-10"
            >
              <div className="inline-block rounded-2xl bg-white/10 backdrop-blur-md p-4 ring-1 ring-white/20">
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="h-16 sm:h-20 object-contain"
                />
              </div>
            </motion.div>
          )}

          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
          >
            {organization.name}
          </motion.h1>

          {organization.description && (
            <motion.p
              className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease }}
            >
              {organization.description}
            </motion.p>
          )}
        </div>
      </header>

      {/* ================================================================= */}
      {/* TOURNAMENTS                                                        */}
      {/* ================================================================= */}
      <main className="max-w-5xl mx-auto px-6 lg:px-8 py-12 sm:py-16">
        <ScrollReveal>
          <div className="flex items-center gap-3 mb-10">
            <Trophy className="w-5 h-5" style={{ color: primaryColor }} strokeWidth={2} />
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Tournaments</h2>
          </div>
        </ScrollReveal>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-8 text-sm">
            {error}
          </div>
        )}

        {tournaments.length === 0 ? (
          <ScrollReveal>
            <div className="text-center py-20 bg-white rounded-2xl border border-stone-200">
              <Flag
                className="w-10 h-10 mx-auto mb-5"
                style={{ color: primaryColor }}
                strokeWidth={1.5}
              />
              <p className="text-stone-600 font-medium">No tournaments available at this time.</p>
              <p className="text-sm text-stone-400 mt-2">Check back soon for upcoming events.</p>
            </div>
          </ScrollReveal>
        ) : (
          <TournamentList
            tournaments={tournaments}
            orgSlug={orgSlug!}
            primaryColor={primaryColor}
          />
        )}
      </main>

      {/* ================================================================= */}
      {/* CONTACT                                                            */}
      {/* ================================================================= */}
      {(organization.contact_email || organization.contact_phone || organization.website_url) && (
        <section className="max-w-5xl mx-auto px-6 lg:px-8 pb-16 sm:pb-20">
          <ScrollReveal>
            <h3 className="text-xl font-semibold tracking-tight mb-8">Get in Touch</h3>
          </ScrollReveal>

          <div className="grid sm:grid-cols-3 gap-4">
            {organization.contact_email && (
              <ScrollReveal delay={0}>
                <a
                  href={`mailto:${organization.contact_email}`}
                  className="group flex items-start gap-4 p-5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-colors duration-200"
                >
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: hexToRgba(primaryColor, 0.08) }}
                  >
                    <Mail className="w-5 h-5" style={{ color: primaryColor }} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">
                      Email
                    </p>
                    <p className="text-sm text-stone-700 group-hover:text-stone-900 truncate transition-colors">
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
                  className="group flex items-start gap-4 p-5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-colors duration-200"
                >
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: hexToRgba(primaryColor, 0.08) }}
                  >
                    <Phone className="w-5 h-5" style={{ color: primaryColor }} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">
                      Phone
                    </p>
                    <p className="text-sm text-stone-700 group-hover:text-stone-900 transition-colors">
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
                  className="group flex items-start gap-4 p-5 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition-colors duration-200"
                >
                  <div
                    className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: hexToRgba(primaryColor, 0.08) }}
                  >
                    <Globe className="w-5 h-5" style={{ color: primaryColor }} strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">
                      Website
                    </p>
                    <p className="text-sm text-stone-700 group-hover:text-stone-900 truncate transition-colors">
                      {organization.website_url.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                </a>
              </ScrollReveal>
            )}
          </div>
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
// Tournament list with staggered entrance
// ---------------------------------------------------------------------------

function TournamentList({
  tournaments,
  orgSlug,
  primaryColor,
}: {
  tournaments: Tournament[];
  orgSlug: string;
  primaryColor: string;
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
            orgSlug={orgSlug}
            primaryColor={primaryColor}
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
  orgSlug: string;
  primaryColor: string;
}

const statusConfig: Record<string, { label: string; dot: string }> = {
  open: { label: 'Registration Open', dot: 'bg-emerald-500' },
  closed: { label: 'Registration Closed', dot: 'bg-red-400' },
  in_progress: { label: 'In Progress', dot: 'bg-amber-500' },
  completed: { label: 'Completed', dot: 'bg-stone-400' },
  draft: { label: 'Coming Soon', dot: 'bg-sky-400' },
};

function TournamentCard({ tournament, orgSlug, primaryColor }: TournamentCardProps) {
  const status = statusConfig[tournament.status] || {
    label: tournament.status,
    dot: 'bg-stone-400',
  };

  const capacityPercent =
    tournament.max_capacity && tournament.confirmed_count != null
      ? Math.min(100, Math.round((tournament.confirmed_count / tournament.max_capacity) * 100))
      : null;

  return (
    <div className="group bg-white rounded-2xl border border-stone-200 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-200/60">
      <div className="p-6 sm:p-7">
        {/* Top row: name + status */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-stone-900">
            {tournament.display_name}
          </h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-stone-100 rounded-full px-3 py-1">
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-sm">
          {tournament.event_date && (
            <Detail icon={Calendar} label="Date" value={formatEventDate(tournament.event_date)} color={primaryColor} />
          )}
          {tournament.location_name && (
            <Detail icon={MapPin} label="Location" value={tournament.location_name} color={primaryColor} />
          )}
          {tournament.format_name && (
            <Detail icon={Clock} label="Format" value={tournament.format_name} color={primaryColor} />
          )}
          {tournament.entry_fee_dollars !== undefined && (
            <Detail
              icon={DollarSign}
              label="Entry Fee"
              value={`$${tournament.entry_fee_dollars.toFixed(2)}`}
              color={primaryColor}
            />
          )}
        </div>

        {/* Capacity bar */}
        {tournament.max_capacity != null && capacityPercent != null && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                {tournament.confirmed_count ?? 0} / {tournament.max_capacity} registered
              </span>
              <span>{capacityPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${capacityPercent}%`,
                  backgroundColor: primaryColor,
                }}
              />
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-6 flex items-center gap-3">
          {tournament.can_register ? (
            <>
              <Link
                to={`/${orgSlug}/tournaments/${tournament.slug}/register`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
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
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </Link>
              <Link
                to={`/${orgSlug}/tournaments/${tournament.slug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
              >
                View Details
              </Link>
            </>
          ) : (
            <Link
              to={`/${orgSlug}/tournaments/${tournament.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-stone-600 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors duration-200"
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
  color,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 mt-0.5 shrink-0" style={{ color }} strokeWidth={1.5} />
      <div>
        <p className="text-xs text-stone-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-stone-700 font-medium">{value}</p>
      </div>
    </div>
  );
}
