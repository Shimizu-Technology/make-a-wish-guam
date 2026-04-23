import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useOrganization } from '../components/OrganizationProvider';
import { 
  Users, 
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Building2,
  UserCheck,
  UserPlus,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Flag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AddGolferModal } from '../components/AddGolferModal';
import { EditGolferModal } from '../components/EditGolferModal';
import type { ActivityLog, Golfer as ApiGolfer } from '../services/api';
import { adminEventPath, adminOrgRoutes } from '../utils/adminRoutes';
import { formatDateTime, formatShortDate } from '../utils/dates';

type Golfer = ApiGolfer;

interface Tournament {
  id: string;
  name: string;
  slug: string;
  event_date: string;
  status: string;
  entry_fee: number;
  max_golfers: number | null;
}

interface Stats {
  total_registrations: number;
  registered: number;
  confirmed: number;
  public_confirmed: number;
  sponsor_confirmed: number;
  pending_payment: number;
  waitlisted: number;
  cancelled: number;
  paid: number;
  checked_in: number;
  revenue: number;
  max_capacity: number | null;
  sponsor_reserved_teams: number;
  public_capacity: number | null;
  capacity_remaining: number | null;
  public_capacity_remaining: number | null;
  at_capacity: boolean;
  public_at_capacity: boolean;
}

const VerifyPaymentModal: React.FC<{
  golfer: Golfer;
  onConfirm: (method: string, notes: string) => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ golfer, onConfirm, onCancel, loading }) => {
  const [method, setMethod] = useState('swipe_simple_confirmed');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Verify Payment</h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Confirming payment for <span className="font-medium">{golfer.name}</span>
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              <option value="swipe_simple_confirmed">SwipeSimple Confirmed</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit">Credit Card (Venue)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(method, notes)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {loading ? 'Verifying...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const OrgTournamentAdmin: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getToken } = useAuthToken();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [checkinFilter, setCheckinFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'male' | 'female' | 'co-ed' | 'unset'
  >('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'admin' | 'public'>('all');
  
  const [sortColumn, setSortColumn] = useState<'name' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const [selectedGolfer, setSelectedGolfer] = useState<Golfer | null>(null);
  const [showAddGolferModal, setShowAddGolferModal] = useState(false);
  const [editingGolfer, setEditingGolfer] = useState<Golfer | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [verifyingGolfer, setVerifyingGolfer] = useState<Golfer | null>(null);
  const [confirmingCheckIn, setConfirmingCheckIn] = useState<Golfer | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchActivityLogs = useCallback(async (golferId: number) => {
    setLoadingLogs(true);
    setActivityLogs([]);
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/activity_logs/golfer/${golferId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data.activity_logs || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingLogs(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (selectedGolfer) {
      fetchActivityLogs(selectedGolfer.id);
    } else {
      setActivityLogs([]);
    }
  }, [fetchActivityLogs, selectedGolfer]);

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch tournament data');

      const data = await response.json();
      setTournament(data.tournament);
      setGolfers(data.golfers || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [getToken, organization, tournamentSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredGolfers = useMemo(() => {
    let filtered = [...golfers];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        g => g.name.toLowerCase().includes(term) ||
             g.email.toLowerCase().includes(term) ||
             g.phone.includes(term) ||
             (g.company && g.company.toLowerCase().includes(term)) ||
             (g.partner_name && g.partner_name.toLowerCase().includes(term))
      );
    }

    if (statusFilter === 'pending_payment') {
      filtered = filtered.filter(g =>
        (g.registration_status === 'confirmed' || g.registration_status === 'pending') &&
        g.payment_status !== 'paid' && g.payment_status !== 'refunded'
      );
    } else if (statusFilter === 'confirmed') {
      filtered = filtered.filter(g => g.registration_status === 'confirmed' && g.payment_status === 'paid');
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.registration_status === statusFilter);
    }

    if (paymentFilter !== 'all') {
      if (paymentFilter === 'pending') {
        filtered = filtered.filter(g => g.payment_status !== 'paid' && g.payment_status !== 'refunded');
      } else {
        filtered = filtered.filter(g => g.payment_status === paymentFilter);
      }
    }

    if (checkinFilter === 'checked_in') {
      filtered = filtered.filter(g => g.checked_in_at);
    } else if (checkinFilter === 'not_checked_in') {
      filtered = filtered.filter(g => !g.checked_in_at);
    }

    if (categoryFilter === 'male') {
      filtered = filtered.filter(g => g.team_category === 'Male');
    } else if (categoryFilter === 'female') {
      filtered = filtered.filter(g => g.team_category === 'Female');
    } else if (categoryFilter === 'co-ed') {
      filtered = filtered.filter(g => g.team_category === 'Co-Ed');
    } else if (categoryFilter === 'unset') {
      filtered = filtered.filter(g => !g.team_category);
    }

    if (sourceFilter === 'admin') {
      filtered = filtered.filter(g => g.registration_source === 'admin');
    } else if (sourceFilter === 'public') {
      filtered = filtered.filter(g => !g.registration_source || g.registration_source === 'public');
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortColumn === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [golfers, searchTerm, statusFilter, paymentFilter, checkinFilter, categoryFilter, sourceFilter, sortColumn, sortDirection]);

  const handleSort = (column: 'name' | 'created_at') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleCheckIn = async (golfer: Golfer) => {
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

      if (!response.ok) throw new Error('Failed to check in golfer');

      toast.success(`${golfer.name} checked in!`);
      setSelectedGolfer(null);
      fetchData();
    } catch {
      toast.error('Failed to check in golfer');
    }
  };

  const handleVerifyPayment = async (golfer: Golfer, method: string, notes: string) => {
    setActionLoading(`verify-${golfer.id}`);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/golfers/${golfer.id}/verify_payment`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_method: method, notes }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify payment');
      }

      toast.success(`Payment verified for ${golfer.name}`);
      setVerifyingGolfer(null);
      setSelectedGolfer(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to verify payment');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRegistration = async (golfer: Golfer) => {
    if (!confirm(`Cancel registration for ${golfer.name}? This cannot be undone.`)) return;

    setActionLoading(`cancel-${golfer.id}`);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization?.slug}/tournaments/${tournamentSlug}/golfers/${golfer.id}/cancel`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel registration');
      }

      toast.success(`${golfer.name}'s registration cancelled`);
      setSelectedGolfer(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel registration');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async (golfer: Golfer) => {
    if (!confirm(`Refund ${golfer.name}? This will mark the payment as refunded and cancel the registration.`)) return;

    setActionLoading(`refund-${golfer.id}`);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization?.slug}/tournaments/${tournamentSlug}/golfers/${golfer.id}/refund`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to process refund');
      }

      toast.success(`Refund recorded for ${golfer.name}`);
      setSelectedGolfer(null);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process refund');
    } finally {
      setActionLoading(null);
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Partner Name', 'Category', 'Starting Position', 'Source', 'Status', 'Payment', 'Payment Method', 'Checked In', 'Registered'];
    const rows = filteredGolfers.map(g => [
      g.name,
      g.email,
      g.phone,
      g.company || '',
      g.partner_name || '',
      g.team_category || '',
      startingPositionSummary(g) || 'Unassigned',
      g.registration_source === 'admin' ? 'Admin' : 'Public',
      g.payment_status === 'paid' ? 'Confirmed' : 'Pending Payment',
      g.payment_status,
      g.payment_method || g.payment_type || '',
      g.checked_in_at ? 'Yes' : 'No',
      formatShortDate(g.created_at),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournamentSlug}-registrations.csv`;
    a.click();
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  const getDisplayStatus = (golfer: Golfer) => {
    if (golfer.registration_status === 'cancelled') return { label: 'Cancelled', style: 'bg-red-100 text-red-700' };
    if (golfer.registration_status === 'waitlist') return { label: 'Waitlist', style: 'bg-yellow-100 text-yellow-700' };
    if (golfer.payment_status === 'paid') return { label: 'Confirmed', style: 'bg-green-100 text-green-700' };
    if (golfer.payment_status === 'refunded') return { label: 'Refunded', style: 'bg-gray-100 text-gray-700' };
    return { label: 'Pending Payment', style: 'bg-amber-100 text-amber-700' };
  };

  const getPaymentBadge = (golfer: Golfer) => {
    if (golfer.payment_type === 'sponsor') return { label: 'Sponsored', style: 'bg-blue-100 text-blue-700' };
    if (golfer.payment_status === 'paid') return { label: 'Paid', style: 'bg-green-100 text-green-700' };
    if (golfer.payment_status === 'refunded') return { label: 'Refunded', style: 'bg-gray-100 text-gray-700' };
    return { label: 'Pending', style: 'bg-amber-100 text-amber-700' };
  };

  const startingPositionSummary = (golfer: Golfer) => {
    if (!golfer.hole_position_label && !golfer.starting_hole_description) return null;

    return golfer.starting_hole_description
      ? `${golfer.hole_position_label || 'Assigned'} · ${golfer.starting_hole_description}`
      : golfer.hole_position_label;
  };

  if (orgLoading || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center rounded-3xl bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !organization || !tournament) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center rounded-3xl bg-white">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Tournament not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Hero */}
      <section className="rounded-[28px] bg-brand-600 px-6 py-5 text-white shadow-sm sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Link
                to={adminOrgRoutes.events}
                className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Link>
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <p className="text-white/80 mt-1">Tournament Management</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowAddGolferModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 font-medium"
              >
                <UserPlus className="w-5 h-5" />
                <span>Add Team</span>
              </button>
              <Link
                to={adminEventPath(tournamentSlug || '', 'checkin')}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-brand-700 rounded-lg hover:bg-brand-50 font-semibold"
              >
                <UserCheck className="w-5 h-5" />
                <span>Check-In Mode</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {stats && (
          <div className="space-y-3 mb-6">
            {/* ── Capacity section (only when max_capacity is set) ── */}
            {stats.max_capacity != null && stats.max_capacity > 0 && (() => {
              const cap = stats.max_capacity!;
              const slotsUsed = stats.registered;
              const pct = Math.min(100, Math.round((slotsUsed / cap) * 100));
              const isFull = stats.at_capacity || stats.public_at_capacity;
              const sponsorTeams = stats.sponsor_reserved_teams || 0;
              const sponsorFilled = stats.sponsor_confirmed || 0;
              const publicCap = stats.public_capacity ?? (cap - sponsorTeams);
              const publicFilled = stats.public_confirmed || 0;
              const publicOpen = Math.max(0, publicCap - publicFilled);
              const sponsorOpen = Math.max(0, sponsorTeams - sponsorFilled);
              const statusLabel = stats.at_capacity
                ? (stats.waitlisted > 0 ? `Waitlist Active (${stats.waitlisted})` : 'At Capacity')
                : (stats.public_at_capacity ? 'Public Registration Full' : `${publicOpen} public spots open`);

              return (
                <>
                  {/* ── Mobile capacity ── */}
                  <div className="lg:hidden bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 pb-3">
                      <div className="flex items-baseline justify-between mb-1">
                        <p className="text-sm text-gray-600">
                          <span className="text-xl font-bold text-gray-900">{slotsUsed}</span>
                          <span className="text-gray-400"> / {cap} teams</span>
                        </p>
                        <span className={`text-xs font-semibold ${isFull ? 'text-amber-600' : 'text-green-600'}`}>
                          {isFull ? statusLabel : `${pct}% full`}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isFull ? 'bg-amber-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    {sponsorTeams > 0 && (
                      <div className="px-4 pb-3 flex gap-4 text-xs">
                        <div className="flex-1 bg-brand-50 rounded-lg px-3 py-2">
                          <p className="text-brand-400 font-medium mb-0.5">Public</p>
                          <p className="text-brand-900 font-bold">{publicFilled}<span className="font-normal text-brand-400"> / {publicCap}</span></p>
                          <p className="text-brand-500">{publicOpen} open</p>
                        </div>
                        <div className="flex-1 bg-purple-50 rounded-lg px-3 py-2">
                          <p className="text-purple-400 font-medium mb-0.5">Sponsor</p>
                          <p className="text-purple-900 font-bold">{sponsorFilled}<span className="font-normal text-purple-400"> / {sponsorTeams}</span></p>
                          <p className="text-purple-500">{sponsorOpen} open</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Desktop capacity ── */}
                  <div className={`hidden lg:block rounded-xl shadow-sm border overflow-hidden ${
                    isFull ? 'bg-amber-50/50 border-amber-200' : 'bg-green-50/50 border-green-200'
                  }`}>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-8">
                          <div className="flex items-center gap-3">
                            <Users className={`w-6 h-6 ${isFull ? 'text-amber-600' : 'text-green-600'}`} />
                            <div>
                              <p className="text-sm text-gray-500">Slots Taken</p>
                              <p className="text-2xl font-bold text-gray-900">
                                {slotsUsed} <span className="text-lg font-normal text-gray-400">/ {cap} teams</span>
                              </p>
                            </div>
                          </div>
                          <div className="h-12 w-px bg-gray-200" />
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className={`text-lg font-semibold ${isFull ? 'text-amber-600' : 'text-green-600'}`}>
                              {statusLabel}
                            </p>
                          </div>
                        </div>
                        <div className="w-56">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>0</span>
                            <span>{pct}% full</span>
                            <span>{cap}</span>
                          </div>
                          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isFull ? 'bg-amber-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Slot breakdown */}
                      {sponsorTeams > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200/60 flex gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                            <span className="text-gray-600">Public:</span>
                            <span className="font-semibold text-gray-900">{publicFilled} / {publicCap}</span>
                            <span className="text-gray-400">({publicOpen} open)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                            <span className="text-gray-600">Sponsor reserved:</span>
                            <span className="font-semibold text-gray-900">{sponsorFilled} / {sponsorTeams}</span>
                            <span className="text-gray-400">({sponsorOpen} open)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* ── Stat cards ── */}
            {/* Mobile: compact grid + revenue row */}
            <div className="lg:hidden space-y-2">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded-xl shadow-sm p-3 text-center">
                  <p className="text-lg font-bold text-green-600">{stats.confirmed}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Paid / Sponsored</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-3 text-center">
                  <p className="text-lg font-bold text-orange-500">{stats.pending_payment}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Pending</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-3 text-center">
                  <p className="text-lg font-bold text-teal-600">{stats.checked_in}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Checked In</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">{stats.waitlisted}</p>
                  <p className="text-[10px] text-gray-500 leading-tight">Waitlist</p>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Revenue</span>
                <span className="text-base font-bold text-gray-900">{formatCurrency(stats.revenue)}</span>
              </div>
            </div>

            {/* Desktop: 5-column stat cards */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-3">
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-500 mb-1">Paid / Sponsored</p>
                <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
                <p className="text-xs text-gray-400 mt-0.5">confirmed and financially cleared</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-orange-400">
                <p className="text-sm text-gray-500 mb-1">Pending Payment</p>
                <p className="text-2xl font-bold text-orange-500">{stats.pending_payment}</p>
                <p className="text-xs text-gray-400 mt-0.5">awaiting payment</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-amber-500">
                <p className="text-sm text-gray-500 mb-1">Waitlist</p>
                <p className="text-2xl font-bold text-amber-600">{stats.waitlisted}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-teal-500">
                <p className="text-sm text-gray-500 mb-1">Checked In</p>
                <p className="text-2xl font-bold text-teal-600">{stats.checked_in}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-yellow-500 min-w-0">
                <p className="text-sm text-gray-500 mb-1">Revenue</p>
                <p className="text-2xl font-bold text-gray-900 truncate">{formatCurrency(stats.revenue)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Filters & Actions */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone, partner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed (Paid)</option>
                <option value="pending_payment">Pending Payment</option>
                <option value="waitlist">Waitlist</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="flex-shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Payment</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>

              <select
                value={checkinFilter}
                onChange={(e) => setCheckinFilter(e.target.value)}
                className="flex-shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Check-in</option>
                <option value="checked_in">Checked In</option>
                <option value="not_checked_in">Not Checked In</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as 'all' | 'male' | 'female' | 'co-ed' | 'unset')
                }
                className="flex-shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Categories</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="co-ed">Co-Ed</option>
                <option value="unset">Unset</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as 'all' | 'admin' | 'public')}
                className="flex-shrink-0 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Sources</option>
                <option value="public">Public</option>
                <option value="admin">Admin</option>
              </select>

              <div className="flex-shrink-0 flex items-center gap-2 ml-auto">
                <button onClick={fetchData} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Refresh">
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600">
            Showing {filteredGolfers.length} of {golfers.length} registrations
          </div>
        </div>

        {/* Golfers Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100 min-w-[160px]"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Team
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 min-w-[100px]">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 min-w-[200px]">Contact</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 min-w-[140px]">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 min-w-[100px]">Payment</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 min-w-[80px]">Check-in</th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100 min-w-[130px]"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Registered
                      {sortColumn === 'created_at' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 min-w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredGolfers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      {golfers.length === 0 ? 'No registrations yet' : 'No results match your filters'}
                    </td>
                  </tr>
                ) : (
                  filteredGolfers.map((golfer) => {
                    const displayStatus = getDisplayStatus(golfer);
                    const paymentBadge = getPaymentBadge(golfer);
                    const isPending = golfer.payment_status !== 'paid' && golfer.payment_status !== 'refunded' && golfer.registration_status !== 'cancelled';
                    const isPaid = golfer.payment_status === 'paid';

                    return (
                      <tr 
                        key={golfer.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedGolfer(golfer)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {golfer.name}
                              {golfer.partner_name && (
                                <span className="text-gray-400 font-normal"> &amp; {golfer.partner_name}</span>
                              )}
                            </p>
                            {golfer.company && <p className="text-sm text-gray-500">{golfer.company}</p>}
                            {startingPositionSummary(golfer) && (
                              <p className="text-sm text-brand-700 mt-0.5">Start {startingPositionSummary(golfer)}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {golfer.sponsor_display_name && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                  Sponsored by {golfer.sponsor_display_name}
                                </span>
                              )}
                              {golfer.registration_source === 'admin' && (
                                <span className="inline-flex items-center text-[10px] font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full">
                                  Admin
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {golfer.team_category || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <p className="text-gray-900">{golfer.email}</p>
                            <p className="text-gray-500">{golfer.phone}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${displayStatus.style}`}>
                            {displayStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${paymentBadge.style}`}>
                            {paymentBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {golfer.checked_in_at ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-300" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDateTime(golfer.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          {isPending && golfer.registration_status === 'confirmed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setVerifyingGolfer(golfer);
                              }}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Verify Payment
                            </button>
                          )}
                          {isPaid && !golfer.checked_in_at && golfer.registration_status === 'confirmed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingCheckIn(golfer);
                              }}
                              className="px-3 py-1 text-sm bg-brand-600 text-white rounded hover:bg-brand-700"
                            >
                              Check In
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Golfer Detail Modal */}
        {selectedGolfer && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 sm:p-4"
            onClick={() => setSelectedGolfer(null)}
          >
            <div 
              className="bg-white shadow-xl w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:rounded-xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">
                  {selectedGolfer.name}
                  {selectedGolfer.partner_name && (
                    <span className="text-gray-400 font-normal"> &amp; {selectedGolfer.partner_name}</span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(() => {
                    const s = getDisplayStatus(selectedGolfer);
                    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.style}`}>{s.label}</span>;
                  })()}
                  {(() => {
                    const p = getPaymentBadge(selectedGolfer);
                    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.style}`}>{p.label}</span>;
                  })()}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedGolfer.registration_source === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {selectedGolfer.registration_source === 'admin' ? 'Admin Registered' : 'Public'}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {selectedGolfer.team_category && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Category</p>
                    <p className="text-sm text-gray-900">{selectedGolfer.team_category}</p>
                  </div>
                )}
                {startingPositionSummary(selectedGolfer) && (
                  <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Flag className="w-4 h-4 text-brand-600 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">Starting Position</p>
                        {selectedGolfer.hole_position_label && (
                          <p className="text-sm font-medium text-brand-900">Start {selectedGolfer.hole_position_label}</p>
                        )}
                        {selectedGolfer.starting_hole_description && (
                          <p className="text-sm text-brand-800">{selectedGolfer.starting_hole_description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {/* Team Members */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Team Members</p>
                  {/* Player 1 (Captain) */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold">1</span>
                      <p className="font-medium text-gray-900 text-sm">{selectedGolfer.name}</p>
                    </div>
                    <div className="pl-7 space-y-0.5">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <span>{selectedGolfer.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <span>{selectedGolfer.phone}</span>
                      </div>
                    </div>
                  </div>
                  {/* Player 2 (Partner) */}
                  <div className={`rounded-lg p-3 space-y-1.5 ${selectedGolfer.partner_name ? 'bg-gray-50' : 'bg-gray-50/50 border border-dashed border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold">2</span>
                      <p className={`text-sm ${selectedGolfer.partner_name ? 'font-medium text-gray-900' : 'text-gray-400 italic'}`}>
                        {selectedGolfer.partner_name || 'No partner assigned'}
                      </p>
                    </div>
                    {selectedGolfer.partner_name && (
                      <div className="pl-7 space-y-0.5">
                        {selectedGolfer.partner_email && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>{selectedGolfer.partner_email}</span>
                          </div>
                        )}
                        {selectedGolfer.partner_phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{selectedGolfer.partner_phone}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedGolfer.company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <span>{selectedGolfer.company}</span>
                  </div>
                )}

                {/* Activity History */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity History</p>
                  {loadingLogs ? (
                    <div className="text-center py-3 text-gray-500 text-sm">Loading...</div>
                  ) : activityLogs.length === 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg p-2">
                        <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${selectedGolfer.payment_type === 'sponsor' ? 'bg-blue-500' : 'bg-brand-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-700 text-xs">
                            {selectedGolfer.payment_type === 'sponsor'
                              ? `Registered via sponsor portal`
                              : 'Registered'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDateTime(selectedGolfer.created_at)}
                            {selectedGolfer.sponsor_display_name && ` \u2022 Sponsor: ${selectedGolfer.sponsor_display_name}`}
                          </p>
                        </div>
                      </div>
                      {selectedGolfer.payment_verified_at && (
                        <div className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg p-2">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 text-xs">Payment verified</p>
                            <p className="text-xs text-gray-400">
                              {formatDateTime(selectedGolfer.payment_verified_at)}
                              {selectedGolfer.payment_verified_by_name && ` \u2022 ${selectedGolfer.payment_verified_by_name}`}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedGolfer.checked_in_at && (
                        <div className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg p-2">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 text-xs">Checked in</p>
                            <p className="text-xs text-gray-400">
                              {formatDateTime(selectedGolfer.checked_in_at)}
                              {selectedGolfer.checked_in_by_name && ` \u2022 ${selectedGolfer.checked_in_by_name}`}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedGolfer.payment_notes && (
                        <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                          {selectedGolfer.payment_notes}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg p-2">
                          <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-700 text-xs">{log.details}</p>
                            <p className="text-xs text-gray-400">
                              {formatDateTime(log.created_at)}
                              {log.admin_name && ` \u2022 ${log.admin_name}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sponsor audit trail (from notes field) */}
                {selectedGolfer.notes && selectedGolfer.payment_type === 'sponsor' && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sponsor Change Log</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedGolfer.notes.split('\n').filter(Boolean).map((line: string, i: number) => (
                        <p key={i} className="text-[11px] text-gray-500 bg-blue-50/50 rounded px-2 py-1 font-mono">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 space-y-3">
                {/* Primary Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedGolfer(null)}
                    className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setEditingGolfer(selectedGolfer);
                      setSelectedGolfer(null);
                    }}
                    className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                  >
                    Edit
                  </button>
                  {/* Verify Payment — only for pending payment */}
                  {selectedGolfer.payment_status !== 'paid' && 
                   selectedGolfer.payment_status !== 'refunded' && 
                   selectedGolfer.registration_status !== 'cancelled' && (
                    <button
                      onClick={() => setVerifyingGolfer(selectedGolfer)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Verify Payment
                    </button>
                  )}
                  {/* Check In — only for paid, not yet checked in */}
                  {selectedGolfer.payment_status === 'paid' && 
                   !selectedGolfer.checked_in_at && 
                   selectedGolfer.registration_status === 'confirmed' && (
                    <button
                      onClick={() => {
                        setConfirmingCheckIn(selectedGolfer);
                        setSelectedGolfer(null);
                      }}
                      className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                    >
                      Check In
                    </button>
                  )}
                </div>

                {/* Resend Payment Link — for unpaid, non-cancelled golfers */}
                {selectedGolfer.payment_status !== 'paid' && 
                 selectedGolfer.payment_status !== 'refunded' && 
                 selectedGolfer.registration_status !== 'cancelled' && (
                  <div className="pt-3 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        setActionLoading(`send-link-${selectedGolfer.id}`);
                        try {
                          const token = await getToken();
                          if (!token) throw new Error('Not authenticated');
                          const res = await fetch(
                            `${import.meta.env.VITE_API_URL}/api/v1/golfers/${selectedGolfer.id}/send_payment_link`,
                            {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            }
                          );
                          if (res.ok) {
                            toast.success(`Payment link sent to ${selectedGolfer.email}`);
                          } else {
                            const data = await res.json();
                            toast.error(data.error || 'Failed to send payment link');
                          }
                        } catch {
                          toast.error('Failed to send payment link');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === `send-link-${selectedGolfer.id}`}
                      className="w-full px-4 py-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {actionLoading === `send-link-${selectedGolfer.id}` ? 'Sending...' : `Send Payment Link to ${selectedGolfer.email}`}
                    </button>
                  </div>
                )}

                {/* Waitlist Actions */}
                {selectedGolfer.registration_status === 'waitlist' && (
                  <div className="flex gap-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        setActionLoading(`promote-${selectedGolfer.id}`);
                        try {
                          const token = await getToken();
                          if (!token) throw new Error('Not authenticated');
                          const response = await fetch(
                            `${import.meta.env.VITE_API_URL}/api/v1/golfers/${selectedGolfer.id}/promote`,
                            {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            }
                          );
                          if (!response.ok) {
                            const data = await response.json().catch(() => ({}));
                            throw new Error(data.error || 'Failed to promote');
                          }
                          toast.success(`${selectedGolfer.name} promoted from waitlist!`);
                          setSelectedGolfer(null);
                          fetchData();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed to promote');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === `promote-${selectedGolfer.id}`}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionLoading === `promote-${selectedGolfer.id}` ? 'Promoting...' : 'Promote to Confirmed'}
                    </button>
                  </div>
                )}
                {selectedGolfer.registration_status === 'confirmed' && !selectedGolfer.checked_in_at && selectedGolfer.payment_status !== 'paid' && (
                  <div className="flex gap-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={async () => {
                        setActionLoading(`demote-${selectedGolfer.id}`);
                        try {
                          const token = await getToken();
                          if (!token) throw new Error('Not authenticated');
                          const response = await fetch(
                            `${import.meta.env.VITE_API_URL}/api/v1/golfers/${selectedGolfer.id}/demote`,
                            {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            }
                          );
                          if (!response.ok) {
                            const data = await response.json().catch(() => ({}));
                            throw new Error(data.error || 'Failed to demote');
                          }
                          toast.success(`${selectedGolfer.name} moved to waitlist`);
                          setSelectedGolfer(null);
                          fetchData();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Failed to demote');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === `demote-${selectedGolfer.id}`}
                      className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                    >
                      {actionLoading === `demote-${selectedGolfer.id}` ? 'Moving...' : 'Move to Waitlist'}
                    </button>
                  </div>
                )}

                {/* Danger Actions */}
                {selectedGolfer.registration_status !== 'cancelled' && (
                  <div className="flex gap-3 pt-3 border-t border-gray-200">
                    {selectedGolfer.payment_status === 'paid' && (
                      <button
                        onClick={() => handleRefund(selectedGolfer)}
                        disabled={actionLoading === `refund-${selectedGolfer.id}`}
                        className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                      >
                        {actionLoading === `refund-${selectedGolfer.id}` ? 'Processing...' : 'Refund'}
                      </button>
                    )}
                    <button
                      onClick={() => handleCancelRegistration(selectedGolfer)}
                      disabled={actionLoading === `cancel-${selectedGolfer.id}`}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading === `cancel-${selectedGolfer.id}` ? 'Cancelling...' : 'Cancel Registration'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verify Payment Modal */}
        {verifyingGolfer && (
          <VerifyPaymentModal
            golfer={verifyingGolfer}
            onConfirm={(method, notes) => handleVerifyPayment(verifyingGolfer, method, notes)}
            onCancel={() => setVerifyingGolfer(null)}
            loading={actionLoading === `verify-${verifyingGolfer.id}`}
          />
        )}

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
                  <p className="text-gray-500 text-sm mt-1">
                    Team: {confirmingCheckIn.name} & {confirmingCheckIn.partner_name}
                  </p>
                )}
              </div>
              <div className="flex border-t border-gray-200">
                <button
                  onClick={() => setConfirmingCheckIn(null)}
                  className="flex-1 px-4 py-3 text-gray-600 font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleCheckIn(confirmingCheckIn);
                    setConfirmingCheckIn(null);
                  }}
                  className="flex-1 px-4 py-3 text-green-600 font-semibold hover:bg-green-50 transition border-l border-gray-200"
                >
                  Confirm Check-In
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {tournament && (
        <AddGolferModal
          isOpen={showAddGolferModal}
          onClose={() => setShowAddGolferModal(false)}
          onSuccess={fetchData}
          tournamentId={tournament.id}
          tournamentSlug={tournamentSlug || ''}
          orgSlug={organization?.slug || ''}
          entryFee={tournament.entry_fee || 0}
        />
      )}

      {tournament && (
        <EditGolferModal
          isOpen={editingGolfer !== null}
          onClose={() => setEditingGolfer(null)}
          onSuccess={fetchData}
          golfer={editingGolfer}
          tournamentSlug={tournamentSlug || ''}
          orgSlug={organization?.slug || ''}
          entryFee={tournament.entry_fee || 0}
        />
      )}
    </div>
  );
};
