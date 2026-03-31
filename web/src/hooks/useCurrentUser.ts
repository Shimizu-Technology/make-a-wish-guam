import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getDevToken } from '../components/ProtectedRoute';

interface CurrentUser {
  id: string;
  clerk_id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'org_admin' | 'tournament_admin';
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export function useCurrentUser() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const devToken = getDevToken();

      // Dev token bypass: use dev token directly
      if (devToken) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL}/api/v1/admins/me`,
            {
              headers: {
                'Authorization': `Bearer ${devToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error('Failed to fetch user');
          }

          const data = await response.json();
          setUser(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch user');
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!isLoaded) return;
      
      if (!isSignedIn) {
        setLoading(false);
        return;
      }

      try {
        const token = await getToken();
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/admins/me`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch user');
        }

        const data = await response.json();
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch user');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [isLoaded, isSignedIn, getToken]);

  return { user, loading, error, isSuperAdmin: user?.is_super_admin ?? false };
}
