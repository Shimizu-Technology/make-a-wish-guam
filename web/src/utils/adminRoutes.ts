export type AdminEventSection =
  | 'overview'
  | 'registrations'
  | 'payments'
  | 'checkin'
  | 'groups'
  | 'raffle'
  | 'sponsors'
  | 'reports'
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
    case 'reports':
      return `${base}/reports`;
    case 'settings':
      return `${base}/settings`;
    default:
      return base;
  }
}

export function getAdminEventSlug(pathname: string) {
  const match = pathname.match(/^\/admin\/(?:events|tournaments)\/([^/]+)/);
  const slug = match?.[1] ?? null;

  if (!slug || slug === 'new') return null;

  return slug;
}

export function getAdminEventSection(pathname: string): AdminEventSection | null {
  const match = pathname.match(/^\/admin\/(?:events|tournaments)\/[^/]+(?:\/(.+))?$/);
  if (!match) return null;

  const rawSection = match[1] ?? '';
  const section = rawSection.split('/')[0];

  switch (section) {
    case '':
      return 'overview';
    case 'registrations':
      return 'registrations';
    case 'payments':
      return 'payments';
    case 'checkin':
      return 'checkin';
    case 'groups':
    case 'scorecard':
      return 'groups';
    case 'raffle':
      return 'raffle';
    case 'sponsors':
      return 'sponsors';
    case 'reports':
      return 'reports';
    case 'settings':
      return 'settings';
    default:
      return 'overview';
  }
}
