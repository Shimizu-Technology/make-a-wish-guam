import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Trophy, 
  Users, 
  MapPin, 
  Calendar, 
  Clock, 
  Flag,
  ChevronRight,
  LogOut,
  BarChart3,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { useGolferAuth } from '../contexts/GolferAuthContext';
import { formatEventDate } from '../utils/dates';

export const GolferDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    isAuthenticated, 
    isLoading, 
    golfer, 
    tournament, 
    group, 
    logout 
  } = useGolferAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/score');
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/score');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!golfer || !tournament) {
    return null;
  }

  const orgSlug = tournament.organization?.slug || 'default';
  const tournamentSlug = tournament.slug || tournament.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-700 text-white sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold">{tournament.name}</h1>
                <p className="text-green-200 text-sm">{tournament.year}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-green-600 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Welcome Card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-gray-600 mb-1">Welcome back,</p>
          <h2 className="text-2xl font-bold text-gray-900">{golfer.name}</h2>
          <div className="flex items-center gap-4 mt-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              golfer.registration_status === 'confirmed' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              {golfer.registration_status === 'confirmed' ? (
                <><CheckCircle className="w-3 h-3" /> Confirmed</>
              ) : (
                <><Clock className="w-3 h-3" /> Waitlist</>
              )}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
              golfer.payment_status === 'paid' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-amber-100 text-amber-700'
            }`}>
              {golfer.payment_status === 'paid' ? (
                <><CheckCircle className="w-3 h-3" /> Paid</>
              ) : (
                <><XCircle className="w-3 h-3" /> Unpaid</>
              )}
            </span>
            {golfer.checked_in && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                <CheckCircle className="w-3 h-3" /> Checked In
              </span>
            )}
          </div>
        </div>

        {/* Group Assignment Card */}
        {group ? (
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-green-100">Your Starting Position</h3>
              <Flag className="w-6 h-6 text-green-200" />
            </div>
            
            <div className="text-center py-4">
              <div className="text-6xl font-bold mb-2">
                {golfer.hole_position || `Group ${group.group_number}`}
              </div>
              {group.hole_number && (
                <p className="text-green-200">
                  Starting at Hole {group.hole_number}
                </p>
              )}
            </div>

            {/* Teammates */}
            {group.golfers && group.golfers.length > 1 && (
              <div className="mt-4 pt-4 border-t border-green-500">
                <h4 className="text-sm font-medium text-green-200 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Your Group ({group.golfers.length})
                </h4>
                <ul className="space-y-1">
                  {group.golfers.map((teammate) => (
                    <li 
                      key={teammate.id} 
                      className={`text-sm flex items-center gap-2 ${
                        teammate.id === golfer.id ? 'text-white font-medium' : 'text-green-100'
                      }`}
                    >
                      {teammate.checked_in && (
                        <CheckCircle className="w-3 h-3 text-green-300" />
                      )}
                      {teammate.name}
                      {teammate.id === golfer.id && ' (you)'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-center gap-3 text-amber-800">
              <Clock className="w-6 h-6" />
              <div>
                <h3 className="font-semibold">Group Not Yet Assigned</h3>
                <p className="text-sm text-amber-700">
                  Your group and starting hole will be assigned closer to tournament day.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Enter Scores - Only show if group assigned and tournament in progress */}
          {group && (tournament.status === 'open' || tournament.status === 'in_progress') && (
            <Link
              to={`/golfer/scorecard?group=${group.id}&tournament=${tournament.id}`}
              className="flex items-center justify-between w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl font-semibold transition-colors"
            >
              <span className="flex items-center gap-3">
                <Flag className="w-5 h-5" />
                Enter Scores
              </span>
              <ChevronRight className="w-5 h-5" />
            </Link>
          )}

          {/* View Leaderboard */}
          <Link
            to={`/${orgSlug}/tournaments/${tournamentSlug}/leaderboard`}
            className="flex items-center justify-between w-full bg-white hover:bg-gray-50 text-gray-900 p-4 rounded-xl font-semibold border border-gray-200 transition-colors"
          >
            <span className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-green-600" />
              View Leaderboard
            </span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </div>

        {/* Tournament Info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Tournament Details
          </h3>
          <div className="space-y-3">
            {tournament.event_date && (
              <div className="flex items-center gap-3 text-gray-700">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span>{formatEventDate(tournament.event_date)}</span>
              </div>
            )}
            {tournament.location_name && (
              <div className="flex items-center gap-3 text-gray-700">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span>{tournament.location_name}</span>
              </div>
            )}
            {tournament.start_time && (
              <div className="flex items-center gap-3 text-gray-700">
                <Clock className="w-5 h-5 text-gray-400" />
                <span>Start: {tournament.start_time}</span>
              </div>
            )}
            {tournament.format && (
              <div className="flex items-center gap-3 text-gray-700">
                <Trophy className="w-5 h-5 text-gray-400" />
                <span className="capitalize">{tournament.format.replace('_', ' ')}</span>
                {tournament.team_size && (
                  <span className="text-gray-500">
                    ({tournament.team_size}-person teams)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-500">
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

export default GolferDashboardPage;
