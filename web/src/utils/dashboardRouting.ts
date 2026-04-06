import { api } from '../services/api';

const DEFAULT_DASHBOARD_PATH = '/admin';

type TokenGetter = (options?: { template?: string }) => Promise<string | null>;

export async function resolveBestDashboardPath(
  getToken: TokenGetter,
  explicitPath?: string
): Promise<string> {
  if (explicitPath) return explicitPath;

  try {
    const token = await getToken();
    if (!token) return DEFAULT_DASHBOARD_PATH;

    const organizations = await api.getMyOrganizationsWithToken(token);

    if (Array.isArray(organizations) && organizations.length === 1 && organizations[0]?.slug) {
      return '/admin';
    }

    if (Array.isArray(organizations) && organizations.length > 1) {
      return DEFAULT_DASHBOARD_PATH;
    }

    return DEFAULT_DASHBOARD_PATH;
  } catch {
    return DEFAULT_DASHBOARD_PATH;
  }
}
