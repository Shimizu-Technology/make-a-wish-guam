import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import {
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  HandCoins,
  Home,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Target,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { useOrganization } from './OrganizationProvider';
import { useTournament } from '../contexts';
import { adminEventPath, adminOrgRoutes, getAdminEventSection, getAdminEventSlug } from '../utils/adminRoutes';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { tournaments, currentTournament, setCurrentTournament, isLoading } = useTournament();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const routeTournamentSlug = getAdminEventSlug(location.pathname);
  const routeSection = getAdminEventSection(location.pathname) ?? 'overview';
  const isEventWorkspaceRoute = Boolean(routeTournamentSlug);

  const activeTournament = useMemo(() => {
    if (routeTournamentSlug) {
      return tournaments.find((tournament) => tournament.slug === routeTournamentSlug) ?? null;
    }

    return currentTournament;
  }, [currentTournament, routeTournamentSlug, tournaments]);

  const openTournaments = tournaments.filter((tournament) => tournament.status !== 'archived');
  const archivedTournaments = tournaments.filter((tournament) => tournament.status === 'archived');

  const organizationNav: NavItem[] = [
    {
      label: 'Dashboard',
      path: adminOrgRoutes.dashboard,
      icon: LayoutDashboard,
      match: (pathname) => pathname === adminOrgRoutes.dashboard,
    },
    {
      label: 'Events',
      path: adminOrgRoutes.events,
      icon: Calendar,
      match: (pathname) => {
        if (pathname === adminOrgRoutes.events) return true;
        if (pathname === adminOrgRoutes.createEvent) return true;
        return pathname.startsWith('/admin/events/') && !isEventWorkspaceRoute;
      },
    },
    {
      label: 'Sponsors',
      path: adminOrgRoutes.sponsors,
      icon: Building2,
      match: (pathname) => pathname === adminOrgRoutes.sponsors,
    },
    {
      label: 'Settings',
      path: adminOrgRoutes.settings,
      icon: Settings,
      match: (pathname) => pathname === adminOrgRoutes.settings || pathname.startsWith(`${adminOrgRoutes.settings}/`),
    },
  ];

  const eventNav: NavItem[] = activeTournament
    ? [
        {
          label: 'Overview',
          path: adminEventPath(activeTournament.slug),
          icon: Target,
          match: (pathname) => pathname === adminEventPath(activeTournament.slug),
        },
        {
          label: 'Registrations',
          path: adminEventPath(activeTournament.slug, 'registrations'),
          icon: ClipboardList,
          match: () => routeSection === 'registrations',
        },
        {
          label: 'Payments',
          path: adminEventPath(activeTournament.slug, 'payments'),
          icon: CreditCard,
          match: () => routeSection === 'payments',
        },
        {
          label: 'Check-In',
          path: adminEventPath(activeTournament.slug, 'checkin'),
          icon: ShieldCheck,
          match: () => routeSection === 'checkin',
        },
        {
          label: 'Groups',
          path: adminEventPath(activeTournament.slug, 'groups'),
          icon: Users,
          match: () => routeSection === 'groups',
        },
        {
          label: 'Raffle',
          path: adminEventPath(activeTournament.slug, 'raffle'),
          icon: Ticket,
          match: () => routeSection === 'raffle',
        },
        {
          label: 'Sponsors',
          path: adminEventPath(activeTournament.slug, 'sponsors'),
          icon: HandCoins,
          match: () => routeSection === 'sponsors',
        },
        {
          label: 'Event Settings',
          path: adminEventPath(activeTournament.slug, 'settings'),
          icon: Settings,
          match: () => routeSection === 'settings' && location.pathname.startsWith('/admin/events/'),
        },
      ]
    : [];

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleTournamentSelect = (tournamentId: string) => {
    const nextTournament = tournaments.find((tournament) => tournament.id === Number(tournamentId));
    if (!nextTournament) return;

    setCurrentTournament(nextTournament);

    if (isEventWorkspaceRoute && routeSection) {
      navigate(adminEventPath(nextTournament.slug, routeSection));
    }

    setMobileMenuOpen(false);
  };

  const renderNavSection = (title: string, items: NavItem[]) => {
    if (items.length === 0) return null;

    return (
      <div className="space-y-2">
        <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">{title}</p>
        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.match ? item.match(location.pathname) : location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="sticky top-0 z-40 border-b border-brand-900/10 bg-brand-800 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex rounded-xl p-2 text-white/90 transition hover:bg-white/10 lg:hidden"
              aria-label="Toggle admin navigation"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <button
              onClick={() => navigate(adminOrgRoutes.dashboard)}
              className="flex items-center gap-3 text-left transition hover:opacity-90"
            >
              <img src="/images/maw-star-icon.png" alt="Make-A-Wish Guam" className="h-10 w-10 rounded-xl bg-white/10 p-1.5" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-200">Make-A-Wish Guam</p>
                <h1 className="text-base font-semibold tracking-tight lg:text-lg">Admin Console</h1>
              </div>
            </button>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <div className="flex min-w-[320px] max-w-[440px] items-center gap-3 rounded-2xl bg-white/10 px-4 py-2.5">
              <Calendar className="h-4 w-4 text-brand-200" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-brand-200">Current event</p>
                <select
                  value={activeTournament?.id ?? ''}
                  onChange={(event) => handleTournamentSelect(event.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-white outline-none"
                >
                  {isLoading ? (
                    <option value="">Loading events...</option>
                  ) : openTournaments.length > 0 ? (
                    <>
                      {openTournaments.map((tournament) => (
                        <option key={tournament.id} value={tournament.id} className="text-neutral-900">
                          {tournament.short_name}
                        </option>
                      ))}
                      {archivedTournaments.map((tournament) => (
                        <option key={tournament.id} value={tournament.id} className="text-neutral-900">
                          {tournament.short_name} (Archived)
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="">No events yet</option>
                  )}
                </select>
              </div>
              {activeTournament && (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize text-white/90">
                  {activeTournament.status.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm text-brand-100 transition hover:bg-white/10 lg:inline-flex"
            >
              <Home className="h-4 w-4" />
              Public site
            </button>
            {user && (
              <div className="hidden text-right lg:block">
                <p className="max-w-[180px] truncate text-sm font-medium text-white">
                  {user.firstName || user.emailAddresses[0]?.emailAddress}
                </p>
                <p className="text-xs text-brand-200">{organization?.name || 'Organization admin'}</p>
              </div>
            )}
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'h-9 w-9',
                },
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-4 lg:px-6 lg:py-6">
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[88vw] max-w-sm transform border-r border-neutral-200 bg-white px-4 py-4 shadow-xl transition-transform duration-200 lg:static lg:w-72 lg:max-w-none lg:translate-x-0 lg:rounded-3xl lg:border lg:shadow-sm ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4 lg:hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Admin navigation</p>
              <p className="text-sm font-medium text-neutral-900">{organization?.name || 'Make-A-Wish Guam'}</p>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl p-2 text-neutral-500 transition hover:bg-neutral-100"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-6 lg:mt-0">
            <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Current event</p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                {activeTournament?.name || 'Select an event'}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {activeTournament
                  ? 'Use the event workspace below to manage registrations, payments, check-in, groups, sponsors, and raffle operations.'
                  : 'Create your first event to unlock the event workspace.'}
              </p>
              <div className="mt-3">
                <select
                  value={activeTournament?.id ?? ''}
                  onChange={(event) => handleTournamentSelect(event.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-brand-400"
                >
                  <option value="">{isLoading ? 'Loading events...' : 'Select event'}</option>
                  {openTournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.short_name}
                    </option>
                  ))}
                  {archivedTournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>
                      {tournament.short_name} (Archived)
                    </option>
                  ))}
                </select>
              </div>
              {activeTournament && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700">
                    {activeTournament.status.replace('_', ' ')}
                  </span>
                  <span className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600">
                    {activeTournament.confirmed_count} confirmed
                  </span>
                </div>
              )}

              <button
                onClick={() => handleNavigate('/')}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 lg:hidden"
              >
                <Home className="h-4 w-4" />
                Go to public site
              </button>
            </div>

            {renderNavSection('Organization', organizationNav)}
            {renderNavSection('Current event', eventNav)}
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="grid h-16 grid-cols-4">
          {organizationNav.map((item) => {
            const Icon = item.icon;
            const isActive = item.match ? item.match(location.pathname) : location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] transition ${
                  isActive ? 'text-brand-600' : 'text-neutral-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
