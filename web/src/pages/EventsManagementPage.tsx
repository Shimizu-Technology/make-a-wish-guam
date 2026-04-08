import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  Target,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';
import { useOrganization } from '../components/OrganizationProvider';
import { useTournament } from '../contexts';
import { adminEventPath, adminOrgRoutes } from '../utils/adminRoutes';
import type { Tournament } from '../services/api';

export const EventsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { tournaments, currentTournament, isLoading, error } = useTournament();

  const activeTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.status !== 'archived'),
    [tournaments]
  );
  const archivedTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.status === 'archived'),
    [tournaments]
  );

  const stats = useMemo(
    () => ({
      total_tournaments: tournaments.length,
      active_tournaments: activeTournaments.length,
      total_registrations: tournaments.reduce(
        (sum, tournament) => sum + tournament.confirmed_count + tournament.waitlist_count,
        0
      ),
      total_revenue: tournaments.reduce(
        (sum, tournament) => sum + tournament.paid_count * Math.round((tournament.entry_fee_dollars || 0) * 100),
        0
      ),
    }),
    [activeTournaments.length, tournaments]
  );

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

  const getStatusClasses = (status: Tournament['status']) => {
    switch (status) {
      case 'open':
        return 'bg-emerald-100 text-emerald-700';
      case 'closed':
        return 'bg-amber-100 text-amber-700';
      case 'completed':
        return 'bg-brand-100 text-brand-700';
      case 'archived':
        return 'bg-neutral-200 text-neutral-600';
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Unable to load events</h1>
        <p className="mt-2 text-sm text-neutral-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">Events</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">Manage your event calendar</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600 sm:text-base">
              Keep org-wide oversight here, then jump directly into the current event workspace for registrations,
              payments, check-in, groups, sponsors, and raffle operations.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {currentTournament && (
              <button
                onClick={() => navigate(adminEventPath(currentTournament.slug))}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Calendar className="h-4 w-4" />
                Open current event
              </button>
            )}
            <button
              onClick={() => navigate(adminOrgRoutes.createEvent)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              New event
            </button>
          </div>
        </div>
      </section>

      {stats && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total events', value: stats.total_tournaments, icon: Trophy, tone: 'bg-brand-50 text-brand-700' },
            { label: 'Active events', value: stats.active_tournaments, icon: Calendar, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Registrations', value: stats.total_registrations, icon: Users, tone: 'bg-violet-50 text-violet-700' },
            { label: 'Revenue', value: formatCurrency(stats.total_revenue), icon: CreditCard, tone: 'bg-amber-50 text-amber-700' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`rounded-2xl p-3 ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{item.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="rounded-[28px] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Active and recent events</h2>
            <p className="mt-1 text-sm text-neutral-500">Your operators should mostly live here.</p>
          </div>
          <Link to={adminOrgRoutes.createEvent} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Create event
          </Link>
        </div>

        {activeTournaments.length === 0 ? (
          <div className="p-10 text-center">
            <Trophy className="mx-auto h-12 w-12 text-neutral-300" />
            <h3 className="mt-4 text-lg font-semibold text-neutral-900">No events yet</h3>
            <p className="mt-2 text-sm text-neutral-500">Create your first event to start collecting registrations.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {activeTournaments.map((tournament) => (
              <div key={tournament.id} className="px-6 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-neutral-900">{tournament.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(tournament.status)}`}>
                        {tournament.status}
                      </span>
                      {currentTournament?.slug === tournament.slug && (
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                          Current event
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {tournament.event_date ? formatDate(tournament.event_date) : 'Date TBD'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {tournament.confirmed_count + tournament.waitlist_count}
                        {tournament.max_capacity ? ` / ${tournament.max_capacity}` : ''} registrations
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4" />
                        {formatCurrency(tournament.paid_count * Math.round((tournament.entry_fee_dollars || 0) * 100))}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={adminEventPath(tournament.slug)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                      Overview
                    </Link>
                    <Link
                      to={adminEventPath(tournament.slug, 'checkin')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Check-In
                    </Link>
                    <Link
                      to={adminEventPath(tournament.slug, 'payments')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <CreditCard className="h-4 w-4" />
                      Payments
                    </Link>
                    <Link
                      to={adminEventPath(tournament.slug, 'groups')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <Target className="h-4 w-4" />
                      Groups
                    </Link>
                    <Link
                      to={adminEventPath(tournament.slug, 'raffle')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <Ticket className="h-4 w-4" />
                      Raffle
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {archivedTournaments.length > 0 && (
        <section className="rounded-[28px] bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-neutral-900">Archived events</h2>
            <p className="mt-1 text-sm text-neutral-500">Historical events remain available for reference.</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {archivedTournaments.map((tournament) => (
              <Link
                key={tournament.id}
                to={adminEventPath(tournament.slug)}
                className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-neutral-50"
              >
                <div>
                  <p className="font-medium text-neutral-900">{tournament.name}</p>
                  <p className="mt-1 text-sm text-neutral-500">{tournament.event_date ? formatDate(tournament.event_date) : 'Date TBD'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-400" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default EventsManagementPage;
