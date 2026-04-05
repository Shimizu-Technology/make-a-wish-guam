import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, HandCoins } from 'lucide-react';
import { useTournament } from '../contexts';
import { adminEventPath, adminOrgRoutes } from '../utils/adminRoutes';

export const SponsorsOverviewPage: React.FC = () => {
  const { tournaments, currentTournament } = useTournament();
  const activeTournaments = tournaments.filter((tournament) => tournament.status !== 'archived');

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">Sponsors</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">Sponsor relationships at the org level</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
          This gives admins a clean home for sponsor work without pretending the data model is fully org-wide yet.
          For launch, use it to jump into the current event’s sponsor management flow and keep navigation predictable.
        </p>
      </section>

      {currentTournament && (
        <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">Current event sponsor workspace</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{currentTournament.name}</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Manage sponsor tiers, logos, hole sponsors, and portal access for the currently selected event.
              </p>
            </div>
            <Link
              to={adminEventPath(currentTournament.slug, 'sponsors')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-medium text-white whitespace-nowrap flex-shrink-0 transition hover:bg-brand-700"
            >
              <HandCoins className="h-4 w-4" />
              Open sponsor management
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-[28px] bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-neutral-900">Jump into event sponsor pages</h2>
          <p className="mt-1 text-sm text-neutral-500">Useful while MAW is still event-first behind the scenes.</p>
        </div>

        {activeTournaments.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto h-12 w-12 text-neutral-300" />
            <h3 className="mt-4 text-lg font-semibold text-neutral-900">No events available</h3>
            <p className="mt-2 text-sm text-neutral-500">Create an event first, then manage sponsors for it here.</p>
            <Link
              to={adminOrgRoutes.createEvent}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <Calendar className="h-4 w-4" />
              Create event
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {activeTournaments.map((tournament) => (
              <Link
                key={tournament.id}
                to={adminEventPath(tournament.slug, 'sponsors')}
                className="flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-neutral-50"
              >
                <div>
                  <p className="font-medium text-neutral-900">{tournament.name}</p>
                  <p className="mt-1 text-sm text-neutral-500 capitalize">{tournament.status.replace('_', ' ')}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-400" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default SponsorsOverviewPage;
