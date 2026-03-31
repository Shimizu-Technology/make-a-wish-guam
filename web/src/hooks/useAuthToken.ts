import { useAuth } from '@clerk/clerk-react';
import { useContext, useCallback } from 'react';
import { getDevToken } from '../components/ProtectedRoute';

// Import context directly to avoid throwing when outside provider
import { GolferAuthContext } from '../contexts/GolferAuthContext';

/**
 * Hook that provides an auth token from either:
 * 1. Dev token (for local development without Clerk)
 * 2. Clerk (for admin users)
 * 3. Golfer session (for golfers accessing their scorecard)
 * 
 * Safe to use outside GolferAuthProvider (golfer auth will just be unavailable).
 * 
 * Usage:
 * const { getToken, isAuthenticated, authType } = useAuthToken();
 * const token = await getToken();
 */
export function useAuthToken() {
  const { getToken: getClerkToken, isSignedIn: isClerkSignedIn } = useAuth();
  
  // Safe access to golfer auth - returns null if outside GolferAuthProvider
  const golferContext = useContext(GolferAuthContext);
  const isGolferAuthenticated = golferContext?.isAuthenticated ?? false;
  const golferToken = golferContext?.token ?? null;

  // Dev token check
  const devToken = getDevToken();
  const isDevAuth = !!devToken;

  // Determine auth type and status
  const authType = isDevAuth ? 'dev' : isClerkSignedIn ? 'clerk' : isGolferAuthenticated ? 'golfer' : null;
  const isAuthenticated = isDevAuth || isClerkSignedIn || isGolferAuthenticated;

  // Get token from available auth source
  const getToken = useCallback(async (): Promise<string | null> => {
    // Dev token bypass (local development)
    if (devToken) {
      return devToken;
    }

    // Prefer Clerk auth if available (admin)
    if (isClerkSignedIn) {
      try {
        const token = await getClerkToken();
        return token;
      } catch (error) {
        console.error('Failed to get Clerk token:', error);
        return null;
      }
    }

    // Fall back to golfer auth
    if (isGolferAuthenticated && golferToken) {
      return golferToken;
    }

    return null;
  }, [devToken, isClerkSignedIn, getClerkToken, isGolferAuthenticated, golferToken]);

  return {
    getToken,
    isAuthenticated,
    authType,
    isClerkAuth: isDevAuth || isClerkSignedIn,
    isGolferAuth: isGolferAuthenticated && !isClerkSignedIn && !isDevAuth,
  };
}

export default useAuthToken;
