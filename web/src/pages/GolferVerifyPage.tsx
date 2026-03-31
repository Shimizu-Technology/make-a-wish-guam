import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { useGolferAuth } from '../contexts/GolferAuthContext';

export const GolferVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyMagicLink, isAuthenticated, isLoading } = useGolferAuth();
  
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (!isLoading && isAuthenticated) {
      navigate('/golfer/dashboard');
      return;
    }

    // Verify the magic link token
    if (!isLoading && token) {
      verifyToken();
    } else if (!isLoading && !token) {
      setVerifying(false);
      setError('Invalid link. No access token provided.');
    }
  }, [isLoading, isAuthenticated, token]);

  const verifyToken = async () => {
    try {
      const result = await verifyMagicLink(token!);
      
      if (result) {
        setSuccess(true);
        // Short delay to show success message, then redirect
        setTimeout(() => {
          navigate('/golfer/dashboard');
        }, 1500);
      } else {
        setError('This link is invalid or has expired. Please request a new one.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Loading state
  if (isLoading || verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md mx-4">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Verifying Your Access
          </h2>
          <p className="text-gray-600">
            Please wait while we confirm your identity...
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md mx-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            You're In!
          </h2>
          <p className="text-gray-600 mb-4">
            Redirecting you to your dashboard...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-green-600 mx-auto" />
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Link Invalid or Expired
        </h2>
        <p className="text-gray-600 mb-6">
          {error}
        </p>
        
        <button
          onClick={() => navigate('/score')}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          Request New Link
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default GolferVerifyPage;
