import React, { useEffect, useState, useRef } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ShieldX, Home, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type AuthStatus = 'loading' | 'authorized' | 'unauthorized' | 'not-signed-in';

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const navigate = useNavigate();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const authSetupRef = useRef(false);

  useEffect(() => {
    api.setAuthTokenGetter(async () => {
      try {
        const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE || 'giaa-tournament';
        const customToken = await getToken({ template });
        if (customToken) return customToken;
        return await getToken();
      } catch {
        try {
          return await getToken();
        } catch {
          console.error('Failed to get auth token');
          return null;
        }
      }
    });
    authSetupRef.current = true;
  }, [getToken]);

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress || null;
    api.setUserEmail(email);
  }, [user]);

  useEffect(() => {
    const verifyAdminAccess = async () => {
      if (!isLoaded) return;
      
      if (!isSignedIn) {
        setAuthStatus('not-signed-in');
        return;
      }

      while (!authSetupRef.current) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const maxRetries = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const admin = await api.getCurrentAdmin();
          console.log('Admin verified:', admin.email);
          setAuthStatus('authorized');
          return;
        } catch (error) {
          lastError = error as Error;
          console.log(`Admin verification attempt ${attempt + 1} failed:`, lastError.message);
          
          if (lastError.message?.includes('not authorized') || 
              lastError.message?.includes('Access denied')) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }

      console.error('Admin verification failed after retries:', lastError);
      setAuthStatus('unauthorized');
    };

    verifyAdminAccess();
  }, [isLoaded, isSignedIn]);

  if (authStatus === 'loading' || !isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'not-signed-in') {
    return <Navigate to="/admin/login" replace />;
  }

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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
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
