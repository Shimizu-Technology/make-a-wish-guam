import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  Calendar,
  ChevronRight,
  Copy,
  CreditCard,
  Loader2,
  Plus,
  Power,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTournament } from '../contexts';
import { adminEventPath, adminOrgRoutes } from '../utils/adminRoutes';
import { formatShortDate } from '../utils/dates';
import { api, type Tournament } from '../services/api';

export const EventsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { tournaments, currentTournament, isLoading, error, refreshTournaments } = useTournament();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        (sum, tournament) => sum + (tournament.registration_count || tournament.confirmed_count || 0),
        0
      ),
      total_revenue: tournaments.reduce(
        (sum, tournament) => sum + (tournament.revenue ?? tournament.paid_count * Math.round((tournament.entry_fee_dollars || 0) * 100)),
        0
      ),
    }),
    [activeTournaments.length, tournaments]
  );

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

  const eventTypeLabel = (eventType?: Tournament['event_type']) => {
    switch (eventType) {
      case 'gala':
        return 'Gala';
      case 'golf_tournament':
      default:
        return 'Golf tournament';
    }
  };

  const canOpenRegistration = (status: Tournament['status']) => status === 'draft' || status === 'closed';

  const runEventAction = async (
    tournament: Tournament,
    action: 'open' | 'close' | 'complete' | 'archive' | 'copy'
  ) => {
    const actionCopy = {
      open: {
        confirm: `Open registration for "${tournament.name}"? This will make the public registration page available.`,
        success: 'Registration opened',
      },
      close: {
        confirm: `Close registration for "${tournament.name}"? This shuts off online and walk-in registration.`,
        success: 'Registration closed',
      },
      complete: {
        confirm: `Mark "${tournament.name}" complete? This shuts off registration and keeps the event available for review.`,
        success: 'Event marked complete',
      },
      archive: {
        confirm: `Archive "${tournament.name}"? It will move to historical events but remain available for reference.`,
        success: 'Event archived',
      },
      copy: {
        confirm: `Clone "${tournament.name}" for next year? Registrations, tickets, winners, groups, and scores will not be copied.`,
        success: 'Event cloned',
      },
    }[action];

    if (!confirm(actionCopy.confirm)) return;

    setActionLoading(`${action}-${tournament.id}`);
    try {
      const result = await ({
        open: () => api.openTournament(tournament.id),
        close: () => api.closeTournament(tournament.id),
        complete: () => api.completeTournament(tournament.id),
        archive: () => api.archiveTournament(tournament.id),
        copy: () => api.copyTournament(tournament.id),
      }[action]());

      toast.success(actionCopy.success);
      await refreshTournaments();

      if (action === 'copy') {
        navigate(adminEventPath(result.slug, 'settings'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Event action failed');
    } finally {
      setActionLoading(null);
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">Events</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">Manage your event calendar</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600 sm:text-base">
              Keep org-wide oversight here, then jump directly into the current event workspace for registrations,
              payments, check-in, sponsors, and raffle operations.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
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
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 sm:px-6 py-4 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-neutral-900">Active and recent events</h2>
            <p className="mt-0.5 sm:mt-1 text-sm text-neutral-500">Your operators should mostly live here.</p>
          </div>
          <Link to={adminOrgRoutes.createEvent} className="text-sm font-medium text-brand-600 hover:text-brand-700 flex-shrink-0">
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
              <div key={tournament.id} className="px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-neutral-900">{tournament.name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(tournament.status)}`}>
                        {tournament.status}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                        {eventTypeLabel(tournament.event_type)}
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
                        {tournament.event_date ? formatShortDate(tournament.event_date) : 'Date TBD'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {tournament.confirmed_count || 0}
                        {tournament.max_capacity ? ` / ${tournament.max_capacity}` : ''} teams
                        {tournament.sponsor_reserved_teams > 0 && (
                          <span className="text-brand-600">({tournament.sponsor_reserved_teams} sponsor)</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4" />
                        {formatCurrency(tournament.paid_count * Math.round((tournament.entry_fee_dollars || 0) * 100))}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      to={adminEventPath(tournament.slug)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                      Registrations
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
                      to={adminEventPath(tournament.slug, 'raffle')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                    >
                      <Ticket className="h-4 w-4" />
                      Raffle
                    </Link>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Event lifecycle</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Close registration, mark the event complete, archive it, or clone the setup for next year.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      {canOpenRegistration(tournament.status) && (
                        <button
                          onClick={() => runEventAction(tournament, 'open')}
                          disabled={actionLoading === `open-${tournament.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {actionLoading === `open-${tournament.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                          Open
                        </button>
                      )}
                      {(tournament.status === 'open' || tournament.status === 'in_progress') && (
                        <button
                          onClick={() => runEventAction(tournament, 'close')}
                          disabled={actionLoading === `close-${tournament.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                        >
                          {actionLoading === `close-${tournament.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                          Close
                        </button>
                      )}
                      {tournament.status !== 'completed' && tournament.status !== 'archived' && (
                        <button
                          onClick={() => runEventAction(tournament, 'complete')}
                          disabled={actionLoading === `complete-${tournament.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-50"
                        >
                          {actionLoading === `complete-${tournament.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                          Complete
                        </button>
                      )}
                      {tournament.status !== 'archived' && (
                        <button
                          onClick={() => runEventAction(tournament, 'archive')}
                          disabled={actionLoading === `archive-${tournament.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-white disabled:opacity-50"
                        >
                          {actionLoading === `archive-${tournament.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                          Archive
                        </button>
                      )}
                      <button
                        onClick={() => runEventAction(tournament, 'copy')}
                        disabled={actionLoading === `copy-${tournament.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                      >
                        {actionLoading === `copy-${tournament.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        Clone
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {archivedTournaments.length > 0 && (
        <section className="rounded-[28px] bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-4 sm:px-6 py-4 sm:py-5">
            <h2 className="text-base sm:text-lg font-semibold text-neutral-900">Archived events</h2>
            <p className="mt-0.5 sm:mt-1 text-sm text-neutral-500">Historical events remain available for reference.</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {archivedTournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 sm:py-4 transition hover:bg-neutral-50"
              >
                <Link to={adminEventPath(tournament.slug)} className="min-w-0 flex-1">
                  <p className="font-medium text-sm sm:text-base text-neutral-900 truncate">{tournament.name}</p>
                  <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-neutral-500">{tournament.event_date ? formatShortDate(tournament.event_date) : 'Date TBD'}</p>
                </Link>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    runEventAction(tournament, 'copy');
                  }}
                  disabled={actionLoading === `copy-${tournament.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-white disabled:opacity-50"
                >
                  {actionLoading === `copy-${tournament.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  Clone
                </button>
                <Link to={adminEventPath(tournament.slug)} className="rounded-lg p-2 text-neutral-400 hover:bg-white">
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default EventsManagementPage;
