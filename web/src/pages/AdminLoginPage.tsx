import React, { useEffect, useState } from 'react';
import { SignIn, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { api } from '../services/api';

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSignedIn, isLoaded } = useAuth();
  const [tournamentName, setTournamentName] = useState<string | null>(null);

  useEffect(() => {
    api.getRegistrationStatus()
      .then(status => setTournamentName(status.tournament_name))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate('/admin', { replace: true });
    }
  }, [isSignedIn, isLoaded, navigate]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 to-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
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
            <Star className="text-brand-600" size={48} />
          </div>
          <h1 className="text-3xl font-bold text-brand-800 mb-2">
            Admin Portal
          </h1>
          <p className="text-gray-600">
            {tournamentName || 'Make-A-Wish Guam & CNMI'}
          </p>
        </div>

        <div className="flex justify-center">
          <SignIn 
            forceRedirectUrl="/admin"
            signUpForceRedirectUrl="/admin"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-lg rounded-lg",
                headerTitle: "text-brand-800",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton: "border-gray-300 hover:bg-gray-50",
                formButtonPrimary: "bg-brand-600 hover:bg-brand-700",
                footerActionLink: "text-brand-600 hover:text-brand-700",
              },
            }}
          />
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-brand-600 hover:underline text-sm"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
