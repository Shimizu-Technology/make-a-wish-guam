import React, { useEffect, useState, useRef } from 'react';
import { useAuth, useClerk } from '@clerk/clerk-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ShieldX, Home, LogOut } from 'lucide-react';

// Dev auth helpers
const DEV_TOKEN_KEY = 'pacific_golf_dev_token';
const isDev = import.meta.env.DEV;

export function getDevToken(): string | null {
  if (!isDev) return null;
  return localStorage.getItem(DEV_TOKEN_KEY);
}

export function setDevToken(token: string): void {
  localStorage.setItem(DEV_TOKEN_KEY, token);
}

export function clearDevToken(): void {
  localStorage.removeItem(DEV_TOKEN_KEY);
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type AuthStatus = 'loading' | 'authorized' | 'unauthorized' | 'not-signed-in';

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const authSetupRef = useRef(false);
  const devToken = getDevToken();

  // Set up API auth token getter
  useEffect(() => {
    if (devToken) {
      // Dev mode: use the dev token directly
      api.setAuthTokenGetter(async () => devToken);
      authSetupRef.current = true;
    } else {
      // Production: use Clerk's JWT template
      api.setAuthTokenGetter(async () => {
        try {
          return await getToken({ template: 'giaa-tournament' });
        } catch (error) {
          console.error('Failed to get auth token:', error);
          return null;
        }
      });
      authSetupRef.current = true;
    }
  }, [getToken, devToken]);

  useEffect(() => {
    const verifyAdminAccess = async () => {
      // Dev token bypass
      if (devToken) {
        // Wait for auth setup
        while (!authSetupRef.current) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        try {
          const admin = await api.getCurrentAdmin();
          console.log('Dev auth verified:', admin.email);
          setAuthStatus('authorized');
        } catch (error) {
          console.error('Dev auth failed:', error);
          clearDevToken();
          setAuthStatus('not-signed-in');
        }
        return;
      }

      if (!isLoaded) return;
      
      if (!isSignedIn) {
        setAuthStatus('not-signed-in');
        return;
      }

      // Wait for auth setup
      while (!authSetupRef.current) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Small delay to ensure token getter is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Retry logic to handle auth token initialization timing
      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Try to get current admin - this will fail if not authorized
          const admin = await api.getCurrentAdmin();
          console.log('Admin verified:', admin.email);
          setAuthStatus('authorized');
          return; // Success - exit the retry loop
        } catch (error) {
          lastError = error as Error;
          console.log(`Admin verification attempt ${attempt + 1} failed:`, lastError.message);
          
          // If it's a clear "not authorized" message, don't retry
          if (lastError.message?.includes('not authorized') || 
              lastError.message?.includes('Access denied')) {
            break;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }

      console.error('Admin verification failed after retries:', lastError);
      setAuthStatus('unauthorized');
    };

    verifyAdminAccess();
  }, [isLoaded, isSignedIn, devToken]);

  // Show loading state while checking
  if (authStatus === 'loading' || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not signed in
  if (authStatus === 'not-signed-in') {
    return <Navigate to="/admin/login" replace />;
  }

  // Show unauthorized page if signed in but not an admin
  if (authStatus === 'unauthorized') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <ShieldX className="text-red-600" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You are not authorized to access the admin dashboard. Please contact an existing admin to be added.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-800 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
            >
              <Home size={18} />
              Go to Home Page
            </button>
            <button
              onClick={() => signOut(() => navigate('/'))}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-6">
            If you believe this is an error, make sure your email address has been added by an admin.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
