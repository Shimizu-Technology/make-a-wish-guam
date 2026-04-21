import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useOrganization } from '../components/OrganizationProvider';
import { useGolferChannel } from '../hooks/useGolferChannel';
import {
  Search,
  UserCheck,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  CreditCard,
  Users,
  Clock,
  Loader2,
  PartyPopper,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  X,
  AlertTriangle,
  CalendarClock,
  Flag,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminEventPath } from '../utils/adminRoutes';
import { formatDateTime } from '../utils/dates';

interface Golfer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  partner_name: string | null;
  partner_email: string | null;
  partner_phone: string | null;
  team_name: string | null;
  registration_status: 'confirmed' | 'waitlist' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | 'refunded';
  payment_type: string | null;
  payment_method: string | null;
  checked_in_at: string | null;
  created_at: string;
  paid_at: string | null;
  payment_verified_by_name: string | null;
  payment_verified_at: string | null;
  sponsor_display_name: string | null;
  checked_in_by_name: string | null;
  payment_notes: string | null;
  hole_position_label: string | null;
}

type QueueTab = 'not_checked_in' | 'paid' | 'not_paid' | 'checked_in' | 'all';

const QUEUE_CONFIG: { key: QueueTab; label: string; activeColor: string }[] = [
  { key: 'not_checked_in', label: 'Ready', activeColor: 'bg-brand-600 text-white' },
  { key: 'paid', label: 'Paid', activeColor: 'bg-green-600 text-white' },
  { key: 'not_paid', label: 'Not Paid', activeColor: 'bg-amber-500 text-white' },
  { key: 'checked_in', label: 'Checked In', activeColor: 'bg-brand-500 text-white' },
  { key: 'all', label: 'All', activeColor: 'bg-gray-700 text-white' },
];

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export const OrgCheckInPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const { getToken } = useAuthToken();

  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeQueue, setActiveQueue] = useState<QueueTab>('not_checked_in');
  const [checkingIn, setCheckingIn] = useState<number | null>(null);
  const [selectedGolfer, setSelectedGolfer] = useState<Golfer | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState('swipe_simple_confirmed');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [revenue, setRevenue] = useState<number>(0);
  const [confirmingCheckIn, setConfirmingCheckIn] = useState<Golfer | null>(null);

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

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTournamentName(data.tournament?.name || '');
      
      if (data.stats?.revenue != null) {
        setRevenue(data.stats.revenue);
      }

      const confirmed = (data.golfers || []).filter(
        (g: Golfer) => g.registration_status === 'confirmed'
      );
      setGolfers(confirmed);
    } catch (err) {
      toast.error('Failed to load golfers');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = golfers.length;
    const checkedIn = golfers.filter(g => g.checked_in_at).length;
    const paid = golfers.filter(g => g.payment_status === 'paid').length;
    const notPaid = golfers.filter(g => g.payment_status !== 'paid').length;
    return { total, checkedIn, paid, notPaid };
  }, [golfers]);

  const queueCounts: Record<QueueTab, number> = useMemo(() => ({
    not_checked_in: golfers.filter(g => !g.checked_in_at).length,
    paid: golfers.filter(g => g.payment_status === 'paid' && !g.checked_in_at).length,
    not_paid: golfers.filter(g => g.payment_status !== 'paid').length,
    checked_in: golfers.filter(g => g.checked_in_at).length,
    all: golfers.length,
  }), [golfers]);

  const filteredGolfers = useMemo(() => {
    let filtered = [...golfers];

    switch (activeQueue) {
      case 'not_checked_in':
        filtered = filtered.filter(g => !g.checked_in_at);
        break;
      case 'paid':
        filtered = filtered.filter(g => g.payment_status === 'paid' && !g.checked_in_at);
        break;
      case 'not_paid':
        filtered = filtered.filter(g => g.payment_status !== 'paid');
        break;
      case 'checked_in':
        filtered = filtered.filter(g => g.checked_in_at);
        break;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(term) ||
        g.email.toLowerCase().includes(term) ||
        g.phone.includes(term) ||
        (g.company && g.company.toLowerCase().includes(term)) ||
        (g.partner_name && g.partner_name.toLowerCase().includes(term)) ||
        (g.team_name && g.team_name.toLowerCase().includes(term))
      );
    }

    filtered.sort((a, b) => {
      if (a.checked_in_at && !b.checked_in_at) return 1;
      if (!a.checked_in_at && b.checked_in_at) return -1;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [golfers, activeQueue, searchTerm]);

  const requestCheckIn = (golfer: Golfer) => {
    if (golfer.checked_in_at) return;
    if (golfer.payment_status !== 'paid') {
      toast.error('Payment must be verified before check-in');
      setSelectedGolfer(golfer);
      return;
    }
    setConfirmingCheckIn(golfer);
  };

  const executeCheckIn = async (golfer: Golfer) => {
    setConfirmingCheckIn(null);
    setCheckingIn(golfer.id);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/golfers/${golfer.id}/check_in`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) throw new Error('Failed to check in');

      toast.success(`${golfer.name} checked in!`, { duration: 2000 });
      setSelectedGolfer(null);
      await fetchData();
    } catch (err) {
      toast.error(`Failed to check in ${golfer.name}`);
    } finally {
      setCheckingIn(null);
    }
  };

  const handleVerifyPayment = async (golfer: Golfer) => {
    setCheckingIn(golfer.id);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/golfers/${golfer.id}/verify_payment`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: verifyMethod, notes: verifyNotes }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify payment');
      }

      toast.success(`Payment verified for ${golfer.name}`);
      setVerifyingPayment(false);
      setVerifyMethod('swipe_simple_confirmed');
      setVerifyNotes('');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCheckingIn(null);
    }
  };

  const getRowStyle = (golfer: Golfer) => {
    if (golfer.checked_in_at) return 'bg-gray-50 opacity-60';
    if (golfer.payment_status === 'paid') return 'bg-white hover:bg-gray-50 border border-gray-200';
    return 'bg-white hover:bg-gray-50 border border-gray-200 border-l-4 border-l-amber-500';
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center rounded-[28px] bg-white">
        <Loader2 className="w-12 h-12 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20 lg:pb-0 text-gray-900 overflow-x-hidden">
      {/* Hero Header */}
      <section className="overflow-hidden rounded-[28px] shadow-sm">
        <div className="bg-brand-600 px-4 py-6">
          <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link
                to={adminEventPath(tournamentSlug || '')}
                className="flex items-center gap-2 text-white/80 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Admin</span>
            </Link>
            <button
              onClick={fetchData}
                className="flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
            <h1 className="text-2xl font-bold text-center text-white mb-1">{tournamentName}</h1>
            <p className="text-white/80 text-center">
              Check-In Station
              {revenue > 0 && (
                <span className="ml-2 text-white/90 font-medium">
                  &mdash; Total Revenue: {formatCurrency(revenue)}
                </span>
              )}
            </p>
          </div>
        </div>

      {/* Stats Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                <UserCheck className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.checkedIn}</span>
              </div>
              <p className="text-xs text-gray-500">Checked In</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                <CheckCircle className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.paid}</span>
              </div>
              <p className="text-xs text-gray-500">Paid</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-amber-600 mb-1">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.notPaid}</span>
              </div>
              <p className="text-xs text-gray-500">Not Paid</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-1">
                <Users className="w-5 h-5" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
              <p className="text-xs text-gray-500">All</p>
            </div>
          </div>

          <div className="max-w-6xl mx-auto mt-4">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.checkedIn / stats.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              {stats.total > 0
                ? `${Math.round((stats.checkedIn / stats.total) * 100)}% checked in`
                : 'No golfers registered'}
            </p>
          </div>
        </div>
      </section>

      {/* Queue Tabs */}
      <div className="rounded-[28px] border border-gray-200 bg-white px-4 py-3">
        <div className="max-w-6xl mx-auto flex gap-2 overflow-x-auto pb-1 -mb-1">
          {QUEUE_CONFIG.map((q) => (
            <button
              key={q.key}
              onClick={() => setActiveQueue(q.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                activeQueue === q.key
                  ? q.activeColor
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {q.label}
              <span className="ml-1.5 opacity-75">{queueCounts[q.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="sticky top-0 z-10 rounded-[28px] border border-gray-200 bg-white px-4 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, partner, team, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-lg"
              autoFocus
            />
          </div>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_380px] gap-4">
        {/* Left: Player List */}
        <div className="space-y-2">
          {filteredGolfers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {searchTerm
                ? 'No golfers match your search'
                : activeQueue === 'not_checked_in' && stats.checkedIn === stats.total && stats.total > 0
                ? <span className="flex items-center justify-center gap-2">All golfers checked in! <PartyPopper className="w-5 h-5 text-yellow-500" /></span>
                : 'No golfers in this queue'}
            </div>
          ) : (
            filteredGolfers.map((golfer) => (
              <div
                key={golfer.id}
                onClick={() => setSelectedGolfer(golfer)}
                className={`flex items-center gap-2.5 sm:gap-4 px-3 py-2.5 sm:p-4 rounded-xl transition cursor-pointer ${getRowStyle(golfer)} ${
                  selectedGolfer?.id === golfer.id ? 'ring-2 ring-brand-500' : ''
                }`}
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    golfer.checked_in_at
                    ? 'bg-green-100 text-green-600'
                    : golfer.payment_status === 'paid'
                    ? 'bg-brand-50 text-brand-600'
                    : 'bg-amber-100 text-amber-600'
                }`}>
                  {golfer.checked_in_at ? (
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : golfer.payment_status !== 'paid' ? (
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                      {golfer.name}
                      {golfer.partner_name && (
                        <span className="text-gray-400 font-normal"> &amp; {golfer.partner_name}</span>
                      )}
                    </h3>
                    {golfer.checked_in_at && (
                      <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">Done</span>
                    )}
                    {golfer.payment_status === 'paid' && !golfer.checked_in_at && (
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${
                        golfer.payment_type === 'sponsor' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>{golfer.payment_type === 'sponsor' ? 'Sponsored' : 'Paid'}</span>
                    )}
                    {golfer.payment_status !== 'paid' && (
                      <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Unpaid</span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs sm:text-sm truncate">
                    {golfer.phone} &bull; {golfer.email}
                  </p>
                  {golfer.company && <p className="text-gray-400 text-[11px] sm:text-xs truncate">{golfer.company}</p>}
                </div>

                {!golfer.checked_in_at && golfer.payment_status === 'paid' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); requestCheckIn(golfer); }}
                    disabled={checkingIn === golfer.id}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium text-sm transition flex-shrink-0"
                  >
                    {checkingIn === golfer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                    Check In
                  </button>
                )}
                {!golfer.checked_in_at && golfer.payment_status !== 'paid' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedGolfer(golfer); setVerifyingPayment(true); }}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition flex-shrink-0"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Verify
                  </button>
                )}

                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 sm:hidden" />
              </div>
            ))
          )}
        </div>

        {/* Right: Detail Panel */}
        <div className="hidden lg:block">
          {selectedGolfer ? (
            <div className="sticky top-24 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{selectedGolfer.name}</h3>
                  <button onClick={() => setSelectedGolfer(null)} className="p-1 text-gray-400 hover:text-gray-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  {selectedGolfer.checked_in_at ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Checked In</span>
                  ) : selectedGolfer.payment_status === 'paid' ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Paid - Ready</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Payment Pending</span>
                  )}
                </div>
              </div>

              <div className="p-5 space-y-3 text-sm">
                {/* Team Members */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Team Members</p>
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-[9px] font-bold flex-shrink-0">1</span>
                      <span className="font-medium text-gray-900 text-sm">{selectedGolfer.name}</span>
                    </div>
                    <p className="text-gray-500 text-xs pl-6">{selectedGolfer.email} &bull; {selectedGolfer.phone}</p>
                  </div>
                  <div className={`rounded-lg p-2.5 ${selectedGolfer.partner_name ? 'bg-gray-50' : 'bg-gray-50/50 border border-dashed border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex-shrink-0">2</span>
                      <span className={`text-sm ${selectedGolfer.partner_name ? 'font-medium text-gray-900' : 'text-gray-400 italic'}`}>
                        {selectedGolfer.partner_name || 'No partner assigned'}
                      </span>
                    </div>
                    {selectedGolfer.partner_name && (selectedGolfer.partner_email || selectedGolfer.partner_phone) && (
                      <p className="text-gray-500 text-xs pl-6">
                        {[selectedGolfer.partner_email, selectedGolfer.partner_phone].filter(Boolean).join(' \u2022 ')}
                      </p>
                    )}
                  </div>
                </div>

                {selectedGolfer.company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">{selectedGolfer.company}</span>
                  </div>
                )}
                {selectedGolfer.hole_position_label && (
                  <div className="flex items-center gap-3">
                    <Flag className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-700">Start {selectedGolfer.hole_position_label}</span>
                  </div>
                )}

                {/* Audit Trail */}
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Timeline</p>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                    <span className="text-gray-500 text-xs">Registered: {formatDateTime(selectedGolfer.created_at)}</span>
                  </div>
                  {selectedGolfer.payment_verified_at && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-500 text-xs">
                        Paid: {formatDateTime(selectedGolfer.payment_verified_at)}
                        {selectedGolfer.payment_verified_by_name && ` by ${selectedGolfer.payment_verified_by_name}`}
                      </span>
                    </div>
                  )}
                  {selectedGolfer.checked_in_at && (
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-500 text-xs">
                        Checked in: {formatDateTime(selectedGolfer.checked_in_at)}
                        {selectedGolfer.checked_in_by_name && ` by ${selectedGolfer.checked_in_by_name}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-5 border-t border-gray-200 space-y-3">
                {selectedGolfer.payment_status !== 'paid' && !selectedGolfer.checked_in_at && (
                  <>
                    {verifyingPayment ? (
                      <div className="space-y-3">
                        <select
                          value={verifyMethod}
                          onChange={(e) => setVerifyMethod(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 text-sm focus:ring-2 focus:ring-brand-500"
                        >
                          <option value="swipe_simple_confirmed">SwipeSimple Confirmed</option>
                          <option value="cash">Cash</option>
                          <option value="check">Check</option>
                          <option value="credit">Credit Card</option>
                        </select>
                        <textarea
                          value={verifyNotes}
                          onChange={(e) => setVerifyNotes(e.target.value)}
                          placeholder="Optional notes..."
                          rows={2}
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 text-sm resize-none focus:ring-2 focus:ring-brand-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setVerifyingPayment(false)}
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleVerifyPayment(selectedGolfer)}
                            disabled={checkingIn === selectedGolfer.id}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-500 text-sm font-medium disabled:opacity-50"
                          >
                            {checkingIn === selectedGolfer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                            Confirm
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setVerifyingPayment(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-500 font-semibold"
                      >
                        <ShieldCheck className="w-5 h-5" />
                        Verify Payment
                      </button>
                    )}
                  </>
                )}

                {selectedGolfer.payment_status === 'paid' && !selectedGolfer.checked_in_at && (
                  <button
                    onClick={() => requestCheckIn(selectedGolfer)}
                    disabled={checkingIn === selectedGolfer.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-500 font-semibold disabled:opacity-50"
                  >
                    {checkingIn === selectedGolfer.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                    Check In Player
                  </button>
                )}

                {selectedGolfer.checked_in_at && (
                  <div className="text-center text-green-600 py-2">
                    <CheckCircle className="w-8 h-8 mx-auto mb-1" />
                    <p className="font-medium">Already Checked In</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="sticky top-24 bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
              <Users className="w-12 h-12 text-brand-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-700">Select a Player</h3>
              <p className="text-sm text-gray-400 mt-1">Click on a player from the list to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Check-In Confirmation Dialog */}
      {confirmingCheckIn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Check In Player</h3>
              <p className="text-gray-600">
                Confirm check-in for <span className="font-semibold">{confirmingCheckIn.name}</span>?
              </p>
              {confirmingCheckIn.partner_name && (
                <p className="text-gray-500 text-sm mt-1">Team: {confirmingCheckIn.name} & {confirmingCheckIn.partner_name}</p>
              )}
              {confirmingCheckIn.hole_position_label && (
                <p className="text-gray-400 text-xs mt-1">Start {confirmingCheckIn.hole_position_label}</p>
              )}
            </div>
            <div className="flex border-t border-gray-200">
              <button
                onClick={() => setConfirmingCheckIn(null)}
                className="flex-1 px-4 py-3.5 text-gray-600 hover:bg-gray-50 font-medium text-base border-r border-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => executeCheckIn(confirmingCheckIn)}
                disabled={checkingIn === confirmingCheckIn.id}
                className="flex-1 px-4 py-3.5 text-green-600 hover:bg-green-50 font-semibold text-base disabled:opacity-50 transition"
              >
                {checkingIn === confirmingCheckIn.id ? 'Checking In...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Detail Sheet */}
      {selectedGolfer && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col">
          {/* Header with brand accent */}
          <div className="bg-brand-600 px-4 pt-3 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">Player Details</span>
              <button
                onClick={() => { setSelectedGolfer(null); setVerifyingPayment(false); }}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-xl font-bold text-white">
              {selectedGolfer.name}
              {selectedGolfer.partner_name && <span className="font-normal text-white/70"> &amp; {selectedGolfer.partner_name}</span>}
            </h3>
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedGolfer.checked_in_at ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/20 text-white font-medium">Checked In</span>
              ) : selectedGolfer.payment_status === 'paid' ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-green-400/30 text-white font-medium">Paid - Ready</span>
              ) : (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-400/30 text-white font-medium">Payment Pending</span>
              )}
              {selectedGolfer.hole_position_label && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/15 text-white font-medium">
                  Start {selectedGolfer.hole_position_label}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Team Members */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Team Members</p>
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-100 text-brand-700 text-[9px] font-bold flex-shrink-0">1</span>
                  <span className="font-medium text-gray-900 text-sm">{selectedGolfer.name}</span>
                </div>
                <p className="text-gray-500 text-xs pl-6">{selectedGolfer.email} &bull; {selectedGolfer.phone}</p>
              </div>
              <div className={`rounded-lg p-2.5 ${selectedGolfer.partner_name ? 'bg-gray-50' : 'bg-gray-50/50 border border-dashed border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[9px] font-bold flex-shrink-0">2</span>
                  <span className={`text-sm ${selectedGolfer.partner_name ? 'font-medium text-gray-900' : 'text-gray-400 italic'}`}>
                    {selectedGolfer.partner_name || 'No partner assigned'}
                  </span>
                </div>
                {selectedGolfer.partner_name && (selectedGolfer.partner_email || selectedGolfer.partner_phone) && (
                  <p className="text-gray-500 text-xs pl-6">
                    {[selectedGolfer.partner_email, selectedGolfer.partner_phone].filter(Boolean).join(' \u2022 ')}
                  </p>
                )}
              </div>
            </div>

            {selectedGolfer.company && (
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 text-sm">{selectedGolfer.company}</span>
              </div>
            )}

            {/* Timeline */}
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Timeline</p>
              <div className="flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                <span className="text-gray-500 text-xs">Registered: {formatDateTime(selectedGolfer.created_at)}</span>
              </div>
              {selectedGolfer.payment_verified_at && (
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-500 text-xs">
                    Paid: {formatDateTime(selectedGolfer.payment_verified_at)}
                    {selectedGolfer.payment_verified_by_name && ` by ${selectedGolfer.payment_verified_by_name}`}
                  </span>
                </div>
              )}
              {selectedGolfer.checked_in_at && (
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-500 text-xs">
                    Checked in: {formatDateTime(selectedGolfer.checked_in_at)}
                    {selectedGolfer.checked_in_by_name && ` by ${selectedGolfer.checked_in_by_name}`}
                  </span>
                </div>
              )}
            </div>

            {/* Inline Verify Payment Form */}
            {verifyingPayment && selectedGolfer.payment_status !== 'paid' && (
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3">
                <h4 className="font-semibold text-amber-900 text-sm">Verify Payment</h4>
                <select
                  value={verifyMethod}
                  onChange={(e) => setVerifyMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 text-base focus:ring-2 focus:ring-brand-500"
                >
                  <option value="swipe_simple_confirmed">SwipeSimple Confirmed</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="credit">Credit Card</option>
                </select>
                <textarea
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 text-base resize-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setVerifyingPayment(false)}
                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleVerifyPayment(selectedGolfer)}
                    disabled={checkingIn === selectedGolfer.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-500 text-sm font-medium disabled:opacity-50"
                  >
                    {checkingIn === selectedGolfer.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 pb-8 border-t border-gray-200">
            {!verifyingPayment && selectedGolfer.payment_status !== 'paid' && !selectedGolfer.checked_in_at && (
              <button
                onClick={() => setVerifyingPayment(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-amber-600 text-white rounded-xl font-semibold text-base"
              >
                <ShieldCheck className="w-5 h-5" />
                Verify Payment
              </button>
            )}
            {selectedGolfer.payment_status === 'paid' && !selectedGolfer.checked_in_at && (
              <button
                onClick={() => requestCheckIn(selectedGolfer)}
                disabled={checkingIn === selectedGolfer.id}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-green-600 text-white rounded-xl font-semibold disabled:opacity-50 text-base"
              >
                {checkingIn === selectedGolfer.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                Check In Player
              </button>
            )}
            {selectedGolfer.checked_in_at && (
              <div className="text-center text-green-600 py-2">
                <CheckCircle className="w-8 h-8 mx-auto mb-1" />
                <p className="font-medium">Already Checked In</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 lg:hidden">
        <div className="max-w-6xl mx-auto flex justify-between text-sm text-gray-500">
          <span>Showing {filteredGolfers.length} of {golfers.length} golfers</span>
          <span>Auto-refreshes every 30s</span>
        </div>
      </footer>
    </div>
  );
};
