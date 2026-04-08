import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useOrganization } from '../components/OrganizationProvider';
import { useGolferChannel } from '../hooks/useGolferChannel';
import {
  Search,
  UserCheck,
  UserX,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  DollarSign,
  Users,
  Clock,
  AlertTriangle,
  Loader2,
  PartyPopper
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminEventPath } from '../utils/adminRoutes';

interface Golfer {
  id: number;
  name: string;
  partner_name?: string | null;
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
  const [tournamentName, setTournamentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCheckedIn, setShowCheckedIn] = useState(false);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  // Real-time updates via WebSocket
  useGolferChannel({
    onGolferUpdated: (updatedGolfer) => {
      setGolfers(prev => prev.map(g =>
        g.id === updatedGolfer.id ? { ...g, ...updatedGolfer } : g
      ));
    },
    onGolferCreated: (newGolfer) => {
      if (newGolfer.registration_status === 'confirmed') {
        setGolfers(prev => [...prev.filter(g => g.id !== newGolfer.id), newGolfer as unknown as Golfer]);
      }
    },
    onGolferDeleted: (golferId) => {
      setGolfers(prev => prev.filter(g => g.id !== golferId));
    },
  });

  const fetchData = useCallback(async (options?: { background?: boolean; silent?: boolean }) => {
    if (!organization || !tournamentSlug) return;

    const background = options?.background ?? false;

    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = await getToken();
      if (!token) throw new Error('You need to be signed in to access check-in.');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to load check-in roster');

      const data = await response.json();
      setTournamentName(data.tournament?.name || '');

      const confirmed = (data.golfers || []).filter(
        (g: Golfer) => g.registration_status === 'confirmed'
      );
      setGolfers(confirmed);
      setError(null);
      setLastLoadedAt(new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load golfers';
      setError(message);
      if (!options?.silent) {
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => {
    void fetchData();
    const interval = setInterval(() => {
      void fetchData({ background: true, silent: true });
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const stats = useMemo<Stats>(() => {
    const checkedIn = golfers.filter((golfer) => golfer.checked_in_at).length;
    const paid = golfers.filter((golfer) => golfer.payment_status === 'paid').length;

    return {
      total: golfers.length,
      checked_in: checkedIn,
      remaining: golfers.length - checkedIn,
      paid,
      unpaid: golfers.length - paid,
    };
  }, [golfers]);

  const lastLoadedLabel = lastLoadedAt
    ? new Date(lastLoadedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

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

      await fetchData({ background: true });
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
        (g.partner_name && g.partner_name.toLowerCase().includes(term)) ||
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
      <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-gray-900">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-green-500" />
          <p className="mt-4 text-sm font-medium text-white">Loading check-in roster…</p>
          <p className="mt-1 text-sm text-gray-400">Pulling the latest confirmed golfers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 lg:pb-0 text-white">

      <section className="overflow-hidden rounded-[28px] bg-gray-900 shadow-sm">
        <div className="border-b border-gray-700 bg-gray-800 px-4 py-4">
          <div className="max-w-4xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <Link
              to={adminEventPath(tournamentSlug || '')}
              className="flex items-center gap-2 text-gray-400 transition hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Admin</span>
            </Link>
            <button
              onClick={() => void fetchData({ background: true })}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 transition hover:bg-gray-600 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </div>

          <h1 className="mb-1 text-center text-2xl font-bold">{tournamentName}</h1>
          <p className="text-center text-gray-400">Check-In Station</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm text-gray-400">
            <span>{refreshing ? 'Syncing roster…' : lastLoadedLabel ? `Updated ${lastLoadedLabel}` : 'Live roster'}</span>
            <span>Auto-refreshes every 30s</span>
          </div>
          </div>
        </div>

        {error && (
          <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            <div className="mx-auto flex max-w-4xl items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Stats Bar */}
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
      </section>

      {/* Search & Filters */}
      <div className="sticky top-0 z-10 rounded-[28px] border border-gray-700 bg-gray-900 px-4 py-4 shadow-sm">
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
                  {golfer.partner_name && (
                    <p className="text-gray-500 text-sm truncate">Partner: {golfer.partner_name}</p>
                  )}
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
      <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-700 bg-gray-800 px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap justify-between gap-2 text-sm text-gray-400">
          <span>Showing {sortedGolfers.length} of {golfers.length} golfers</span>
          <span>{stats.unpaid > 0 ? `${stats.unpaid} unpaid team${stats.unpaid === 1 ? '' : 's'} need attention` : 'All visible teams are paid'}</span>
        </div>
      </footer>
    </div>
  );
};
