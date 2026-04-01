import { useAuth } from '@clerk/clerk-react';
import { useContext, useCallback } from 'react';

import { GolferAuthContext } from '../contexts/GolferAuthContext';

/**
 * Hook that provides an auth token from either:
 * 1. Clerk (for admin users)
 * 2. Golfer session (for golfers accessing their scorecard)
 * 
 * Safe to use outside GolferAuthProvider (golfer auth will just be unavailable).
 */
export function useAuthToken() {
  const { getToken: getClerkToken, isSignedIn: isClerkSignedIn } = useAuth();
  
  const golferContext = useContext(GolferAuthContext);
  const isGolferAuthenticated = golferContext?.isAuthenticated ?? false;
  const golferToken = golferContext?.token ?? null;

  const authType = isClerkSignedIn ? 'clerk' : isGolferAuthenticated ? 'golfer' : null;
  const isAuthenticated = isClerkSignedIn || isGolferAuthenticated;

  const getToken = useCallback(async (): Promise<string | null> => {
    if (isClerkSignedIn) {
      try {
        const token = await getClerkToken();
        return token;
      } catch (error) {
        console.error('Failed to get Clerk token:', error);
        return null;
      }
    }

    if (isGolferAuthenticated && golferToken) {
      return golferToken;
    }

    return null;
  }, [isClerkSignedIn, getClerkToken, isGolferAuthenticated, golferToken]);

  return {
    getToken,
    isAuthenticated,
    authType,
    isClerkAuth: !!isClerkSignedIn,
    isGolferAuth: isGolferAuthenticated && !isClerkSignedIn,
  };
}

export default useAuthToken;
