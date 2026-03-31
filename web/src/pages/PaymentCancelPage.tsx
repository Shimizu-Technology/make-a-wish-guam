import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button, Card } from '../components/ui';

export const PaymentCancelPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const golferId = searchParams.get('golfer_id');

  const handleTryAgain = () => {
    // Navigate back to registration with a flag to retry payment
    navigate('/register', { state: { retryPayment: true, golferId } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 relative overflow-hidden py-8 sm:py-12">
      {/* Subtle pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23166534' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div className="relative z-10 container mx-auto px-4 max-w-2xl">
        <Card className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-amber-600" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            Payment Cancelled
          </h1>

          <p className="text-gray-600 mb-6">
            Your payment was cancelled. Don't worry - your registration has been saved.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">What happens now?</h2>
            <ul className="text-sm text-gray-600 text-left space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-brand-600">•</span>
                Your registration is saved with "Pay on Day" status
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-600">•</span>
                You can pay online anytime by contacting us
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-600">•</span>
                Or pay at check-in on tournament day
              </li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={() => navigate('/')}>
              Return to Home
              <ArrowRight size={16} />
            </Button>
            {golferId && (
              <Button onClick={handleTryAgain}>
                <RefreshCw size={16} />
                Try Payment Again
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

