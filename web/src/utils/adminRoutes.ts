export type AdminEventSection =
  | 'overview'
  | 'registrations'
  | 'payments'
  | 'checkin'
  | 'groups'
  | 'raffle'
  | 'sponsors'
  | 'settings';

export const adminOrgRoutes = {
  dashboard: '/admin',
  events: '/admin/events',
  createEvent: '/admin/events/new',
  sponsors: '/admin/sponsors',
  settings: '/admin/settings',
} as const;

export function adminEventPath(slug: string, section: AdminEventSection = 'overview') {
  const base = `/admin/events/${slug}`;

  switch (section) {
    case 'overview':
      return base;
    case 'registrations':
      return `${base}/registrations`;
    case 'payments':
      return `${base}/payments`;
    case 'checkin':
      return `${base}/checkin`;
    case 'groups':
      return `${base}/groups`;
    case 'raffle':
      return `${base}/raffle`;
    case 'sponsors':
      return `${base}/sponsors`;
    case 'settings':
      return `${base}/settings`;
    default:
      return base;
  }
}

export function getAdminEventSlug(pathname: string) {
  const match = pathname.match(/^\/admin\/(?:events|tournaments)\/([^/]+)/);
  return match?.[1] ?? null;
}

export function getAdminEventSection(pathname: string): AdminEventSection | null {
  if (!pathname.startsWith('/admin/events/') && !pathname.startsWith('/admin/tournaments/')) {
    return null;
  }

  if (pathname.includes('/payments')) return 'payments';
  if (pathname.includes('/checkin')) return 'checkin';
  if (pathname.includes('/groups') || pathname.includes('/scorecard')) return 'groups';
  if (pathname.includes('/raffle')) return 'raffle';
  if (pathname.includes('/sponsors')) return 'sponsors';
  if (pathname.includes('/settings')) return 'settings';
  if (pathname.includes('/registrations')) return 'registrations';

  return 'overview';
}
