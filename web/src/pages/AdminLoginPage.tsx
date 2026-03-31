import React, { useEffect, useState } from 'react';
import { SignIn, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Zap } from 'lucide-react';
import { api } from '../services/api';
import { getDevToken, setDevToken } from '../components/ProtectedRoute';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const isDev = import.meta.env.DEV;

interface DevUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

const DevLoginPanel: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<DevUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/v1/dev/users`)
      .then(res => res.json())
      .then(data => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleDevLogin = async (user: DevUser) => {
    setLoggingIn(user.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/dev/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.token) {
        setDevToken(data.token);
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(null);
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading dev users...</p>;
  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>;
  if (users.length === 0) return <p className="text-gray-500 text-sm">No users found. Create users via Rails console first.</p>;

  return (
    <div className="space-y-2">
      {users.map(user => (
        <button
          key={user.id}
          onClick={() => handleDevLogin(user)}
          disabled={loggingIn !== null}
          className="w-full flex items-center justify-between p-3 bg-white border-2 border-amber-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors text-left disabled:opacity-50"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">{user.name || user.email}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
            user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
            user.role === 'org_admin' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {user.role}
          </span>
        </button>
      ))}
    </div>
  );
};

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [tournamentName, setTournamentName] = useState<string | null>(null);

  // If already have a dev token, redirect
  useEffect(() => {
    if (isDev && getDevToken()) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  // Fetch tournament name
  useEffect(() => {
    api.getRegistrationStatus()
      .then(status => setTournamentName(status.tournament_name))
      .catch(() => {});
  }, []);

  // Redirect to dashboard if already signed in via Clerk
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isSignedIn, isLoaded, navigate]);

  // Show loading while checking auth status
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 to-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800"></div>
      </div>
    );
  }

  // If already signed in, show loading (redirect will happen via useEffect)
  if (isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4">
            <Trophy className="text-brand-800" size={48} />
          </div>
          <h1 className="text-3xl font-bold text-brand-800 mb-2">
            Admin Portal
          </h1>
          <p className="text-gray-600">
            {tournamentName || 'Edward A.P. Muna II Memorial Golf Tournament'}
          </p>
        </div>

        {/* Dev Login Panel - only shown in development */}
        {isDev && (
          <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="text-amber-600" size={18} />
              <h3 className="font-semibold text-amber-800 text-sm">Dev Login (bypasses Clerk)</h3>
            </div>
            <DevLoginPanel />
          </div>
        )}

        <div className="flex justify-center">
          <SignIn 
            forceRedirectUrl="/admin/dashboard"
            signUpForceRedirectUrl="/admin/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-lg rounded-lg",
                headerTitle: "text-brand-800",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton: "border-gray-300 hover:bg-gray-50",
                formButtonPrimary: "bg-brand-800 hover:bg-brand-700",
                footerActionLink: "text-brand-800 hover:text-brand-800",
              },
            }}
          />
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-brand-800 hover:underline text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
