import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  CreditCard,
  Loader2,
  Settings,
  ShieldCheck,
  Ticket,
  Trophy,
  UserPlus,
  Users,
  CheckCircle,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrganization } from '../components/OrganizationProvider';
import { useTournament, useAdmin } from '../contexts';
import { useAuthToken } from '../hooks/useAuthToken';
import { adminEventPath, adminOrgRoutes } from '../utils/adminRoutes';

interface TournamentSummary {
  id: string;
  name: string;
  slug: string;
  date: string;
  status: 'draft' | 'open' | 'closed' | 'completed' | 'archived';
  registration_count: number;
  capacity: number | null;
  revenue: number;
  walkin_fee?: number;
  walkin_swipe_simple_url?: string;
  entry_fee_display?: string;
  sponsor_reserved_teams?: number;
}

interface OrgStats {
  total_tournaments: number;
  active_tournaments: number;
  total_registrations: number;
  total_revenue: number;
}

const WalkInModal: React.FC<{
  tournament: TournamentSummary;
  organizationSlug: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ tournament, organizationSlug, getToken, onClose, onSuccess }) => {
  const [saving, setSaving] = useState(false);
  const defaultAmount = tournament.walkin_fee
    ? (tournament.walkin_fee / 100).toString()
    : '';

  const [form, setForm] = useState({
    captainName: '',
    captainEmail: '',
    captainPhone: '+1671',
    partnerName: '',
    partnerEmail: '',
    partnerPhone: '',
    paymentMethod: 'cash' as 'cash' | 'check' | 'swipesimple',
    amount: defaultAmount,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.captainName || !form.captainEmail || !form.captainPhone) {
      toast.error('Captain name, email, and phone are required');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();

      const createResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organizationSlug}/tournaments/${tournament.slug}/golfers`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            golfer: {
              name: form.captainName,
              email: form.captainEmail,
              phone: form.captainPhone,
              partner_name: form.partnerName || undefined,
              partner_email: form.partnerEmail || undefined,
              partner_phone: form.partnerPhone || undefined,
              payment_type: 'walk_in',
              payment_status: 'paid',
            },
            waiver_accepted: true,
          }),
        }
      );

      if (!createResponse.ok) {
        const data = await createResponse.json();
        throw new Error(data.errors?.join(', ') || data.error || 'Failed to create walk-in');
      }

      const data = await createResponse.json();
      const golferId = data.golfer?.id || data.id;

      if (golferId) {
        await fetch(`${import.meta.env.VITE_API_URL}/api/v1/golfers/${golferId}/mark_paid`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_method: form.paymentMethod,
            payment_amount_cents: Math.round(parseFloat(form.amount || '300') * 100),
            payment_notes: `Walk-in registration - ${form.paymentMethod}`,
          }),
        });
      }

      toast.success('Walk-in registered successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to register walk-in');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-neutral-900">Walk-in registration</h3>
          <button onClick={onClose} className="rounded-xl p-1 transition hover:bg-neutral-100">
            <X className="h-5 w-5 text-neutral-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {[
            { label: 'Captain Name', field: 'captainName', required: true },
            { label: 'Captain Email', field: 'captainEmail', required: true },
            { label: 'Captain Phone', field: 'captainPhone', required: true },
            { label: 'Partner Name', field: 'partnerName', required: false },
            { label: 'Partner Email', field: 'partnerEmail', required: false },
            { label: 'Partner Phone', field: 'partnerPhone', required: false },
          ].map(({ label, field, required }) => (
            <div key={field}>
              <label className="mb-1 block text-sm font-medium text-neutral-700">{label}</label>
              <input
                type={field.toLowerCase().includes('email') ? 'email' : field.toLowerCase().includes('phone') ? 'tel' : 'text'}
                value={form[field as keyof typeof form] as string}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                required={required}
                className="w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-base text-neutral-900 outline-none transition focus:border-brand-400"
              />
            </div>
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Payment method</label>
              <select
                value={form.paymentMethod}
                onChange={(event) =>
                  setForm({ ...form, paymentMethod: event.target.value as 'cash' | 'check' | 'swipesimple' })
                }
                className="w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-base text-neutral-900 outline-none transition focus:border-brand-400"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="swipesimple">SwipeSimple</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                className="w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-base text-neutral-900 outline-none transition focus:border-brand-400"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60">
              {saving ? 'Saving…' : 'Register walk-in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const OrgAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { currentTournament } = useTournament();
  const { getToken } = useAuthToken();
  const { isVolunteer } = useAdmin();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWalkIn, setShowWalkIn] = useState<TournamentSummary | null>(null);

  useEffect(() => {
    if (!organization) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) throw new Error('Failed to fetch dashboard data');

        const data = await response.json();
        setTournaments(data.tournaments || []);
        setStats(data.stats || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getToken, organization]);

  const activeTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.status !== 'archived'),
    [tournaments]
  );
  const nextTournament =
    activeTournaments.find((tournament) => tournament.slug === currentTournament?.slug) ??
    activeTournaments[0] ??
    null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);

  if (orgLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Unable to load admin dashboard</h1>
            <p className="mt-2 text-sm text-neutral-600">{error || 'Organization not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-[28px] bg-white p-5 sm:p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">Organization dashboard</p>
            <h1 className="mt-1.5 sm:mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">{organization.name}</h1>
            <p className="mt-2 sm:mt-3 text-sm leading-6 text-neutral-600">
              See overall event health, jump into the current event workspace, and keep launch-day operations moving.
            </p>
          </div>

          {!isVolunteer && (
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3 flex-shrink-0">
              {nextTournament && (
                <button
                  onClick={() => setShowWalkIn(nextTournament)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Walk-in registration
                </button>
              )}
              <Link
                to={adminOrgRoutes.settings}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                <Settings className="h-4 w-4" />
                Organization settings
              </Link>
            </div>
          )}
        </div>
      </section>

      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {[
            { label: 'Events', value: stats.total_tournaments, icon: Trophy, tone: 'bg-brand-50 text-brand-700' },
            { label: 'Active now', value: stats.active_tournaments, icon: Calendar, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Confirmed', value: stats.total_registrations, icon: Users, tone: 'bg-violet-50 text-violet-700' },
            { label: 'Revenue', value: formatCurrency(stats.total_revenue), icon: CreditCard, tone: 'bg-amber-50 text-amber-700' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-3xl bg-white p-4 sm:p-5 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`rounded-2xl p-2.5 sm:p-3 flex-shrink-0 ${item.tone}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-neutral-500">{item.label}</p>
                    <p className="mt-0.5 sm:mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 truncate">{item.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="rounded-[28px] bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 px-5 sm:px-6 py-4 sm:py-5">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900">Current event workspace</h2>
              <p className="mt-0.5 sm:mt-1 text-sm text-neutral-500">Operator tasks are one click away.</p>
            </div>
            {!isVolunteer && (
              <Link to={adminOrgRoutes.events} className="text-sm font-medium text-brand-600 hover:text-brand-700 flex-shrink-0">
                View all events
              </Link>
            )}
          </div>

          {nextTournament ? (
            <div className="space-y-4 sm:space-y-5 p-4 sm:p-6">
              <div className="rounded-2xl sm:rounded-3xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">Selected event</p>
                    <h3 className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">{nextTournament.name}</h3>
                    <div className="mt-2 sm:mt-3 flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1.5 text-xs sm:text-sm text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {formatDate(nextTournament.date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {nextTournament.registration_count}
                        {nextTournament.capacity ? ` / ${nextTournament.capacity}` : ''} teams
                        {(nextTournament.sponsor_reserved_teams ?? 0) > 0 && (
                          <span className="text-brand-600">({nextTournament.sponsor_reserved_teams} sponsor)</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {formatCurrency(nextTournament.revenue)}
                      </span>
                    </div>
                    {nextTournament.capacity && nextTournament.capacity > 0 && (
                      <div className="mt-2.5">
                        <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              nextTournament.registration_count >= nextTournament.capacity
                                ? 'bg-amber-500'
                                : nextTournament.registration_count / nextTournament.capacity > 0.8
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round((nextTournament.registration_count / nextTournament.capacity) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-medium capitalize text-brand-700 flex-shrink-0">
                    {nextTournament.status}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  { label: 'Registrations', icon: Users, path: adminEventPath(nextTournament.slug), adminOnly: true },
                  { label: 'Payments', icon: CreditCard, path: adminEventPath(nextTournament.slug, 'payments'), adminOnly: true },
                  { label: 'Check-In', icon: ShieldCheck, path: adminEventPath(nextTournament.slug, 'checkin'), adminOnly: false },
                  { label: 'Raffle', icon: Ticket, path: adminEventPath(nextTournament.slug, 'raffle'), adminOnly: false },
                ] as const).filter(item => !isVolunteer || !item.adminOnly).map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      className="flex items-center justify-between rounded-2xl sm:rounded-3xl border border-neutral-200 px-3.5 sm:px-4 py-3.5 sm:py-4 transition hover:bg-neutral-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl sm:rounded-2xl bg-neutral-100 p-2 sm:p-2.5 text-neutral-700">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-sm sm:text-base text-neutral-900">{item.label}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-neutral-400" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-10 text-center">
              <Trophy className="mx-auto h-12 w-12 text-neutral-300" />
              <h3 className="mt-4 text-lg font-semibold text-neutral-900">No current event selected</h3>
              <p className="mt-2 text-sm text-neutral-500">Create or select an event to unlock the operator workspace.</p>
              <button
                onClick={() => navigate(adminOrgRoutes.events)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Calendar className="h-4 w-4" />
                Go to events
              </button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {!isVolunteer && (
            <section className="rounded-[28px] bg-white shadow-sm">
              <div className="border-b border-neutral-200 px-5 sm:px-6 py-4 sm:py-5">
                <h2 className="text-base sm:text-lg font-semibold text-neutral-900">Org management</h2>
                <p className="mt-0.5 sm:mt-1 text-sm text-neutral-500">Tasks that stay true even as MAW adds more event types.</p>
              </div>
              <div className="space-y-3 p-4 sm:p-6">
                {[
                  { label: 'Manage events', icon: Calendar, path: adminOrgRoutes.events, description: 'Create events and monitor active or archived ones.' },
                  { label: 'Sponsor relationships', icon: Building2, path: adminOrgRoutes.sponsors, description: 'Jump into sponsor work without hunting through event pages.' },
                  { label: 'Organization settings', icon: Settings, path: adminOrgRoutes.settings, description: 'Branding, admins, links, and operational defaults.' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.label} to={item.path} className="block rounded-2xl sm:rounded-3xl border border-neutral-200 p-3.5 sm:p-4 transition hover:bg-neutral-50">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl sm:rounded-2xl bg-neutral-100 p-2 sm:p-2.5 text-neutral-700 flex-shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm sm:text-base text-neutral-900">{item.label}</p>
                          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-neutral-500">{item.description}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-[28px] bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-5 sm:px-6 py-4 sm:py-5">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-900">Upcoming / recent events</h2>
              <p className="mt-0.5 sm:mt-1 text-sm text-neutral-500">A quick pulse check without turning this into the full events page.</p>
            </div>
            <div className="divide-y divide-neutral-200">
              {activeTournaments.slice(0, 4).map((tournament) => (
                <Link key={tournament.id} to={adminEventPath(tournament.slug)} className="flex items-center justify-between gap-4 px-5 sm:px-6 py-3.5 sm:py-4 transition hover:bg-neutral-50">
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base text-neutral-900 truncate">{tournament.name}</p>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-neutral-500">{formatDate(tournament.date)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-neutral-400 flex-shrink-0" />
                </Link>
              ))}
              {activeTournaments.length === 0 && (
                <div className="p-5 sm:p-6 text-sm text-neutral-500">No active events yet.</div>
              )}
            </div>
          </section>
        </div>
      </section>

      {showWalkIn && organization && (
        <WalkInModal
          tournament={showWalkIn}
          organizationSlug={organization.slug}
          getToken={getToken}
          onClose={() => setShowWalkIn(null)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
};

export default OrgAdminDashboard;
