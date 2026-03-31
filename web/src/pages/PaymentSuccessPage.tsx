import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * PaymentSuccessPage - Redirects to RegistrationSuccessPage
 * 
 * This page exists for backward compatibility with the old Stripe redirect flow.
 * The new embedded checkout flow goes directly to /registration/success.
 * 
 * This page simply redirects to /registration/success with the session_id,
 * which handles the payment confirmation and displays the detailed success view.
 */
export const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Redirect to the main success page with session_id
    if (sessionId) {
      navigate(`/registration/success?session_id=${sessionId}`, { replace: true });
    } else {
      // No session ID, just go to registration success
      navigate('/registration/success', { replace: true });
    }
  }, [sessionId, navigate]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
        <p className="text-gray-600">Completing your registration...</p>
      </div>
    </div>
  );
};
