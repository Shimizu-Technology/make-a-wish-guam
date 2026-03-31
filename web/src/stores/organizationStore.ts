import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  primary_color?: string;
  banner_url?: string;
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  tournament_count?: number;
}

interface OrganizationState {
  organization: Organization | null;
  isLoading: boolean;
  error: string | null;
  setOrganization: (org: Organization | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearOrganization: () => void;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      organization: null,
      isLoading: false,
      error: null,
      setOrganization: (org) => set({ organization: org, error: null }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),
      clearOrganization: () => set({ organization: null, error: null }),
    }),
    {
      name: 'pacific-golf-organization',
      partialize: (state) => ({ organization: state.organization }),
    }
  )
);

// Helper to get org slug from URL path
export function getOrgSlugFromPath(pathname: string): string | null {
  // Expected format: /:org_slug/...
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0) {
    // Skip known non-org routes
    const nonOrgRoutes = ['admin', 'login', 'pay', 'payment', 'registration'];
    if (!nonOrgRoutes.includes(parts[0])) {
      return parts[0];
    }
  }
  return null;
}

// Helper to build org-scoped path
export function buildOrgPath(orgSlug: string, path: string): string {
  return `/${orgSlug}${path.startsWith('/') ? path : `/${path}`}`;
}
