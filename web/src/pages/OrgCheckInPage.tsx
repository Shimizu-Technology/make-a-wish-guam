import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useOrganization } from '../components/OrganizationProvider';
import {
  Search,
  UserCheck,
  UserX,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  Loader2,
  PartyPopper
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Golfer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  registration_status: 'confirmed' | 'waitlist' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | 'refunded';
  checked_in_at: string | null;
}

interface Stats {
  total: number;
  checked_in: number;
  remaining: number;
  paid: number;
  unpaid: number;
}

export const OrgCheckInPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const { getToken } = useAuthToken();

  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCheckedIn, setShowCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTournamentName(data.tournament?.name || '');
      
      // Filter to only confirmed golfers
      const confirmed = (data.golfers || []).filter(
        (g: Golfer) => g.registration_status === 'confirmed'
      );
      setGolfers(confirmed);

      // Calculate stats
      const checkedIn = confirmed.filter((g: Golfer) => g.checked_in_at).length;
      const paid = confirmed.filter((g: Golfer) => g.payment_status === 'paid').length;
      setStats({
        total: confirmed.length,
        checked_in: checkedIn,
        remaining: confirmed.length - checkedIn,
        paid,
        unpaid: confirmed.length - paid,
      });
    } catch (err) {
      toast.error('Failed to load golfers');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCheckIn = async (golfer: Golfer) => {
    if (golfer.checked_in_at) return;

    setCheckingIn(golfer.id);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/golfers/${golfer.id}/check_in`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to check in');

      // Play success sound (optional)
      try {
        const audio = new Audio('/check-in-success.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {}

      toast.success(`${golfer.name} checked in!`, {
        icon: '✅',
        duration: 2000,
      });

      // Refresh data
      await fetchData();
    } catch (err) {
      toast.error(`Failed to check in ${golfer.name}`);
    } finally {
      setCheckingIn(null);
    }
  };

  // Filter golfers
  const filteredGolfers = golfers.filter((g) => {
    // Hide already checked in unless showing all
    if (!showCheckedIn && g.checked_in_at) return false;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        g.name.toLowerCase().includes(term) ||
        g.email.toLowerCase().includes(term) ||
        g.phone.includes(term) ||
        (g.company && g.company.toLowerCase().includes(term))
      );
    }
    return true;
  });

  // Sort: unchecked first, then by name
  const sortedGolfers = [...filteredGolfers].sort((a, b) => {
    if (a.checked_in_at && !b.checked_in_at) return 1;
    if (!a.checked_in_at && b.checked_in_at) return -1;
    return a.name.localeCompare(b.name);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link
              to={`/${organization?.slug}/admin/tournaments/${tournamentSlug}`}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Admin</span>
            </Link>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>

          <h1 className="text-2xl font-bold text-center mb-1">{tournamentName}</h1>
          <p className="text-gray-400 text-center">Check-In Station</p>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
          <div className="max-w-4xl mx-auto grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                <UserCheck className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.checked_in}</span>
              </div>
              <p className="text-xs text-gray-400">Checked In</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-yellow-400 mb-1">
                <Clock className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.remaining}</span>
              </div>
              <p className="text-xs text-gray-400">Remaining</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-brand-400 mb-1">
                <Users className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
              <p className="text-xs text-gray-400">Total</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-400 mb-1">
                <DollarSign className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.paid}</span>
              </div>
              <p className="text-xs text-gray-400">Paid</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="max-w-4xl mx-auto mt-4">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.checked_in / stats.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-400 mt-2">
              {stats.total > 0
                ? `${Math.round((stats.checked_in / stats.total) * 100)}% checked in`
                : 'No golfers registered'}
            </p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-4 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                autoFocus
              />
            </div>
            <button
              onClick={() => setShowCheckedIn(!showCheckedIn)}
              className={`px-4 py-3 rounded-xl font-medium transition ${
                showCheckedIn
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              {showCheckedIn ? 'Showing All' : 'Hide Checked In'}
            </button>
          </div>
        </div>
      </div>

      {/* Golfer List */}
      <main className="max-w-4xl mx-auto px-4 py-4">
        <div className="space-y-3">
          {sortedGolfers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm
                ? 'No golfers match your search'
                : showCheckedIn
                ? 'No golfers found'
                : <span className="flex items-center justify-center gap-2">All golfers checked in! <PartyPopper className="w-5 h-5 text-yellow-500" /></span>}
            </div>
          ) : (
            sortedGolfers.map((golfer) => (
              <div
                key={golfer.id}
                className={`flex items-center gap-4 p-4 rounded-xl transition ${
                  golfer.checked_in_at
                    ? 'bg-gray-800/50 opacity-60'
                    : 'bg-gray-800 hover:bg-gray-750'
                }`}
              >
                {/* Status Icon */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    golfer.checked_in_at
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {golfer.checked_in_at ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <UserX className="w-6 h-6" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg truncate">{golfer.name}</h3>
                    {golfer.payment_status === 'unpaid' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">
                        <AlertTriangle className="w-3 h-3" />
                        Unpaid
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm truncate">
                    {golfer.phone} • {golfer.email}
                  </p>
                  {golfer.company && (
                    <p className="text-gray-500 text-sm truncate">{golfer.company}</p>
                  )}
                </div>

                {/* Check-in Button */}
                {golfer.checked_in_at ? (
                  <div className="flex items-center gap-2 text-green-400 px-4">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Checked In</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckIn(golfer)}
                    disabled={checkingIn === golfer.id}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-lg transition ${
                      checkingIn === golfer.id
                        ? 'bg-gray-600 cursor-wait'
                        : golfer.payment_status === 'unpaid'
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-black'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {checkingIn === golfer.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <UserCheck className="w-5 h-5" />
                    )}
                    <span>Check In</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Footer Stats */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-between text-sm text-gray-400">
          <span>Showing {sortedGolfers.length} of {golfers.length} golfers</span>
          <span>Auto-refreshes every 30s</span>
        </div>
      </footer>
    </div>
  );
};
