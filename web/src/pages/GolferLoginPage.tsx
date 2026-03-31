import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, CheckCircle, ArrowRight, Trophy } from 'lucide-react';
import { useGolferAuth } from '../contexts/GolferAuthContext';
import toast from 'react-hot-toast';

export const GolferLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, requestMagicLink } = useGolferAuth();
  
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/golfer/dashboard');
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await requestMagicLink(email.trim());
      
      if (result.success) {
        setLinkSent(true);
        toast.success('Check your email for the access link!');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col">
      {/* Header */}
      <header className="bg-green-700 text-white py-4 px-6 shadow-md">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-400" />
          <div>
            <h1 className="text-xl font-bold">Pacific Golf</h1>
            <p className="text-green-200 text-sm">Live Scoring</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {!linkSent ? (
            // Email Form
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Access Scoring
                </h2>
                <p className="text-gray-600">
                  Enter the email you used to register for the tournament.
                  We'll send you a link to access your scorecard.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg"
                    disabled={isSubmitting}
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Access Link
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                The link will be valid for 24 hours.
              </p>
            </div>
          ) : (
            // Success Message
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Check Your Email!
              </h2>
              <p className="text-gray-600 mb-6">
                We've sent an access link to <strong>{email}</strong>.
                Click the link in the email to access your scorecard.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800">
                  <strong>Don't see the email?</strong> Check your spam folder, 
                  or wait a minute and try again.
                </p>
              </div>

              <button
                onClick={() => {
                  setLinkSent(false);
                  setEmail('');
                }}
                className="text-green-600 hover:text-green-700 font-medium"
              >
                ← Try a different email
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-gray-500">
        <p className="flex items-center justify-center gap-1.5">
          Powered by Pacific Golf
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="3"/>
            <path d="M12 8v8"/>
            <path d="M8 21h8"/>
            <path d="M12 16l4-4"/>
            <path d="M16 12l2-6"/>
          </svg>
        </p>
      </footer>
    </div>
  );
};

export default GolferLoginPage;
