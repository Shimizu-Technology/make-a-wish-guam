import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Types
export interface GolferInfo {
  id: number;
  name: string;
  email: string;
  phone: string;
  registration_status: string;
  payment_status: string;
  checked_in: boolean;
  group_id: number | null;
  hole_position: string | null;
}

export interface TournamentInfo {
  id: number;
  name: string;
  slug?: string;
  year: number;
  status: string;
  event_date: string | null;
  location_name: string | null;
  start_time: string | null;
  format: string | null;
  team_size: number | null;
  total_holes: number;
  total_par: number;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface GroupInfo {
  id: number;
  group_number: number;
  hole_number: number | null;
  golfers: {
    id: number;
    name: string;
    checked_in: boolean;
  }[];
}

interface GolferAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  golfer: GolferInfo | null;
  tournament: TournamentInfo | null;
  group: GroupInfo | null;
  token: string | null;
}

interface GolferAuthContextType extends GolferAuthState {
  requestMagicLink: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyMagicLink: (token: string) => Promise<boolean>;
  refreshSession: () => Promise<boolean>;
  logout: () => void;
  getAuthHeader: () => { Authorization: string } | {};
}

export const GolferAuthContext = createContext<GolferAuthContextType | null>(null);

const STORAGE_KEY = 'pacific_golf_golfer_session';

export function GolferAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GolferAuthState>({
    isAuthenticated: false,
    isLoading: true,
    golfer: null,
    tournament: null,
    group: null,
    token: null,
  });

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.token) {
          // Verify the session is still valid
          verifySession(session.token);
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Verify existing session
  const verifySession = async (token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/golfer_auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            golfer: data.golfer,
            tournament: data.tournament,
            group: data.group,
            token,
          });
          return;
        }
      }

      // Session invalid - clear it
      localStorage.removeItem(STORAGE_KEY);
      setState({
        isAuthenticated: false,
        isLoading: false,
        golfer: null,
        tournament: null,
        group: null,
        token: null,
      });
    } catch (error) {
      console.error('Session verification failed:', error);
      localStorage.removeItem(STORAGE_KEY);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Request magic link
  const requestMagicLink = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/golfer_auth/request_link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      return {
        success: data.success || false,
        message: data.message || data.error || 'Something went wrong',
      };
    } catch (error) {
      console.error('Request magic link failed:', error);
      return {
        success: false,
        message: 'Failed to send access link. Please try again.',
      };
    }
  }, []);

  // Verify magic link
  const verifyMagicLink = useCallback(async (magicToken: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/golfer_auth/verify?token=${encodeURIComponent(magicToken)}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.token) {
        // Store session
        const session = {
          token: data.token,
          golfer: data.golfer,
          tournament: data.tournament,
          group: data.group,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

        setState({
          isAuthenticated: true,
          isLoading: false,
          golfer: data.golfer,
          tournament: data.tournament,
          group: data.group,
          token: data.token,
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Verify magic link failed:', error);
      return false;
    }
  }, []);

  // Refresh session
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!state.token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/golfer_auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success && data.token) {
        const session = {
          token: data.token,
          golfer: state.golfer,
          tournament: state.tournament,
          group: state.group,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setState(prev => ({ ...prev, token: data.token }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Refresh session failed:', error);
      return false;
    }
  }, [state.token, state.golfer, state.tournament, state.group]);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      isAuthenticated: false,
      isLoading: false,
      golfer: null,
      tournament: null,
      group: null,
      token: null,
    });
  }, []);

  // Get auth header for API calls
  const getAuthHeader = useCallback(() => {
    if (state.token) {
      return { Authorization: `Bearer ${state.token}` };
    }
    return {};
  }, [state.token]);

  const value: GolferAuthContextType = {
    ...state,
    requestMagicLink,
    verifyMagicLink,
    refreshSession,
    logout,
    getAuthHeader,
  };

  return (
    <GolferAuthContext.Provider value={value}>
      {children}
    </GolferAuthContext.Provider>
  );
}

export function useGolferAuth() {
  const context = useContext(GolferAuthContext);
  if (!context) {
    throw new Error('useGolferAuth must be used within a GolferAuthProvider');
  }
  return context;
}
