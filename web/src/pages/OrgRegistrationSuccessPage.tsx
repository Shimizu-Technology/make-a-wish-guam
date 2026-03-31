import { useEffect } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import { CheckCircle, Calendar, MapPin, Mail, CreditCard, ArrowLeft, Share2, Check } from 'lucide-react';
import { Button, Card } from '../components/ui';
import confetti from 'canvas-confetti';
import { formatEventDate } from '../utils/dates';

export function OrgRegistrationSuccessPage() {
  const { orgSlug, tournamentSlug } = useParams<{ orgSlug: string; tournamentSlug: string }>();
  const { organization } = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  
  const { golfer, tournament, paymentPending, paymentComplete } = location.state || {};
  
  const primaryColor = organization?.primary_color || '#1e40af';

  // Confetti on mount
  useEffect(() => {
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Fire again after a delay
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      });
    }, 250);
  }, []);

  // If no state, redirect to tournament page
  useEffect(() => {
    if (!tournament && !golfer) {
      navigate(`/${orgSlug}/tournaments/${tournamentSlug}`);
    }
  }, [tournament, golfer, navigate, orgSlug, tournamentSlug]);

  if (!tournament) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="text-white py-8 px-4"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <CheckCircle className="h-16 w-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Registration Complete!</h1>
          <p className="text-lg opacity-90">
            You're registered for {tournament.display_name}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 -mt-4">
        <Card className="p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Registration Details</h2>
          
          {golfer && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="font-medium text-lg">{golfer.name}</p>
              {golfer.email && (
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                  <Mail size={16} />
                  {golfer.email}
                </p>
              )}
              {golfer.company && (
                <p className="text-gray-500 text-sm mt-1">{golfer.company}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="text-gray-400 mt-1" size={20} />
              <div>
                <p className="font-medium">{tournament.event_date || 'Date TBA'}</p>
                {tournament.registration_time && (
                  <p className="text-gray-500 text-sm">Registration: {tournament.registration_time}</p>
                )}
                {tournament.start_time && (
                  <p className="text-gray-500 text-sm">Start: {tournament.start_time}</p>
                )}
              </div>
            </div>

            {tournament.location_name && (
              <div className="flex items-start gap-3">
                <MapPin className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="font-medium">{tournament.location_name}</p>
                  {tournament.location_address && (
                    <p className="text-gray-500 text-sm">{tournament.location_address}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Payment Status Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-3">
            <CreditCard className="text-gray-400 mt-1" size={20} />
            <div className="flex-1">
              <h3 className="font-bold mb-2">Payment Status</h3>
              
              {paymentComplete ? (
                <div className="bg-green-50 text-green-800 p-3 rounded-lg">
                  <p className="font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Payment Complete</p>
                  <p className="text-sm">Thank you! Your payment has been processed.</p>
                </div>
              ) : paymentPending ? (
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg">
                  <p className="font-medium">Payment Due on Tournament Day</p>
                  <p className="text-sm">
                    Please bring ${tournament.entry_fee_dollars?.toFixed(2)} 
                    {tournament.allow_cash && tournament.allow_check 
                      ? ' (cash or check)'
                      : tournament.allow_cash 
                      ? ' (cash)'
                      : ' (check)'}
                  </p>
                  {tournament.checks_payable_to && (
                    <p className="text-sm mt-1">
                      Checks payable to: {tournament.checks_payable_to}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 text-gray-700 p-3 rounded-lg">
                  <p className="text-sm">Payment status will be confirmed via email.</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* What's Next Card */}
        <Card className="p-6 mb-6">
          <h3 className="font-bold mb-4">What's Next?</h3>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-3">
              <span className="bg-brand-100 text-brand-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">1</span>
              <span>Check your email for a confirmation message</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-brand-100 text-brand-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">2</span>
              <span>Mark your calendar for {formatEventDate(tournament.event_date)}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-brand-100 text-brand-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">3</span>
              <span>
                Arrive at {tournament.location_name || 'the venue'} by {tournament.registration_time || 'the registration time'}
              </span>
            </li>
            {paymentPending && (
              <li className="flex items-start gap-3">
                <span className="bg-yellow-100 text-yellow-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">4</span>
                <span>Bring payment: ${tournament.entry_fee_dollars?.toFixed(2)}</span>
              </li>
            )}
          </ul>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to={`/${orgSlug}`} className="flex-1">
            <Button variant="outline" className="w-full">
              <ArrowLeft size={18} className="mr-2" />
              View More Tournaments
            </Button>
          </Link>
          <Button 
            className="flex-1"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: tournament.display_name,
                  text: `I just registered for ${tournament.display_name}!`,
                  url: window.location.origin + `/${orgSlug}/tournaments/${tournamentSlug}`,
                });
              }
            }}
          >
            <Share2 size={18} className="mr-2" />
            Share
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6 px-4 mt-12">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-400">
            Powered by <span className="text-white font-semibold">Pacific Golf</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
