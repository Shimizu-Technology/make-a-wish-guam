import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useOrganization } from '../components/OrganizationProvider';
import {
  ArrowLeft,
  RefreshCw,
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  AlertCircle,
  X,
  FileText,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminEventPath } from '../utils/adminRoutes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Golfer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  partner_name: string | null;
  partner_email: string | null;
  partner_phone: string | null;
  registration_status: 'confirmed' | 'waitlist' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | 'pending' | 'refunded';
  payment_method: string | null;
  payment_type: string | null;
  payment_notes: string | null;
  payment_amount_cents: number | null;
  receipt_number: string | null;
  notes: string | null;
  checked_in_at: string | null;
  created_at: string;
  paid_at: string | null;
}

type PaymentMethod = 'swipesimple' | 'check' | 'cash' | 'comp';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  swipesimple: 'SwipeSimple Confirmed',
  check: 'Check',
  cash: 'Cash',
  comp: 'Comp',
};

type TabKey = 'pending' | 'paid' | 'summary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDateTime = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);

const getPaymentBadge = (method: string | null) => {
  const styles: Record<string, string> = {
    swipesimple: 'bg-blue-100 text-blue-700',
    check: 'bg-amber-100 text-amber-700',
    cash: 'bg-green-100 text-green-700',
    comp: 'bg-purple-100 text-purple-700',
    stripe: 'bg-indigo-100 text-indigo-700',
  };
  const label = method
    ? PAYMENT_METHOD_LABELS[method as PaymentMethod] || method
    : 'Unknown';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        styles[method || ''] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// "Mark as Paid" Modal
// ---------------------------------------------------------------------------

interface MarkPaidModalProps {
  golfer: Golfer;
  onClose: () => void;
  onConfirm: (data: {
    payment_method: PaymentMethod;
    payment_notes: string;
    receipt_number: string;
    payment_amount_cents: number;
  }) => Promise<void>;
}

const MarkPaidModal: React.FC<MarkPaidModalProps> = ({
  golfer,
  onClose,
  onConfirm,
}) => {
  const [method, setMethod] = useState<PaymentMethod>('swipesimple');
  const [checkNumber, setCheckNumber] = useState('');
  const [dateReceived, setDateReceived] = useState('');
  const [amount, setAmount] = useState('300.00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let finalNotes = notes;
      if (method === 'check') {
        const parts: string[] = [];
        if (checkNumber) parts.push(`Check #${checkNumber}`);
        if (dateReceived) parts.push(`Received: ${dateReceived}`);
        if (parts.length > 0) {
          finalNotes = [parts.join(' | '), notes].filter(Boolean).join(' -- ');
        }
      }

      await onConfirm({
        payment_method: method,
        payment_notes: finalNotes,
        receipt_number: method === 'check' ? checkNumber : '',
        payment_amount_cents: Math.round(parseFloat(amount || '300') * 100),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Mark as Paid
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Recording payment for <span className="font-medium text-gray-900">{golfer.name}</span>
            {golfer.partner_name && <span className="text-gray-500"> & {golfer.partner_name}</span>}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {method === 'check' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check Number
                </label>
                <input
                  type="text"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Received
                </label>
                <input
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export const PaymentReconciliationPage: React.FC = () => {
  const { tournamentSlug } = useParams<{
    tournamentSlug: string;
  }>();
  const { organization } = useOrganization();
  const { getToken } = useAuthToken();

  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [entryFee, setEntryFee] = useState(30000);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<Golfer | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      const t = data.tournament || data;
      setTournamentName(t.name || '');
      setTournamentId(t.id || null);
      setEntryFee(t.entry_fee || 30000);

      const confirmed = (data.golfers || []).filter(
        (g: Golfer) => g.registration_status !== 'cancelled'
      );
      setGolfers(confirmed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkPaid = async (
    golfer: Golfer,
    payload: {
      payment_method: PaymentMethod;
      payment_notes: string;
      receipt_number: string;
      payment_amount_cents: number;
    }
  ) => {
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL}/api/v1/golfers/${golfer.id}/mark_paid`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method: payload.payment_method,
          payment_notes: payload.payment_notes,
          receipt_number: payload.receipt_number,
          payment_amount_cents: payload.payment_amount_cents,
        }),
      }
    );

    if (!response.ok) throw new Error('Failed to update payment');

    toast.success(`${golfer.name} marked as paid`);
    setMarkingPaid(null);
    await fetchData();
  };

  // Derived data
  const pendingGolfers = golfers.filter(
    (g) => g.payment_status === 'pending' || g.payment_status === 'unpaid'
  );
  const paidGolfers = golfers.filter((g) => g.payment_status === 'paid');
  const walkinGolfers = golfers.filter((g) => g.payment_type === 'walk_in');
  const totalRevenue = paidGolfers.reduce(
    (sum, g) => sum + (g.payment_amount_cents || entryFee),
    0
  );

  const handleExportCSV = () => {
    const headers = ['Name', 'Partner', 'Email', 'Phone', 'Payment Status', 'Payment Method', 'Amount', 'Paid At', 'Registered At'];
    const rows = golfers.map((g) => [
      g.name,
      g.partner_name || '',
      g.email,
      g.phone,
      g.payment_status,
      g.payment_method || '',
      g.payment_amount_cents ? (g.payment_amount_cents / 100).toFixed(2) : '',
      g.paid_at || '',
      g.created_at,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournamentName.replace(/\s+/g, '_')}_payments.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link
              to={adminEventPath(tournamentSlug || '')}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Tournament</span>
            </Link>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{tournamentName}</h1>
          <p className="text-gray-500">Payment Reconciliation</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Registered</p>
                <p className="text-2xl font-bold text-gray-900">{golfers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Paid</p>
                <p className="text-2xl font-bold text-gray-900">{paidGolfers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{pendingGolfers.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-8">
            {([
              { key: 'pending' as TabKey, label: 'Pending Payments', count: pendingGolfers.length, icon: Clock },
              { key: 'paid' as TabKey, label: 'Paid Teams', count: paidGolfers.length, icon: CheckCircle },
              { key: 'summary' as TabKey, label: 'Summary', icon: FileText },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-3 px-1 border-b-2 font-medium flex items-center gap-2 ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab: Pending Payments */}
        {activeTab === 'pending' && (
          <section>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {pendingGolfers.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <p className="font-medium">All payments received</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-3">Team</th>
                        <th className="px-6 py-3">Captain Contact</th>
                        <th className="px-6 py-3">Partner Contact</th>
                        <th className="px-6 py-3">Registered</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingGolfers.map((golfer) => (
                        <tr key={golfer.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{golfer.name}</p>
                            {golfer.partner_name && (
                              <p className="text-sm text-gray-500">& {golfer.partner_name}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <p className="text-gray-600">{golfer.email}</p>
                            <p className="text-gray-400">{golfer.phone}</p>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {golfer.partner_email ? (
                              <>
                                <p className="text-gray-600">{golfer.partner_email}</p>
                                {golfer.partner_phone && <p className="text-gray-400">{golfer.partner_phone}</p>}
                              </>
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {formatDateTime(golfer.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setMarkingPaid(golfer)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
                            >
                              <DollarSign className="w-4 h-4" />
                              Mark as Paid
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab: Paid Teams */}
        {activeTab === 'paid' && (
          <section>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {paidGolfers.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-500">
                  <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="font-medium">No payments recorded yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
                        <th className="px-6 py-3">Team</th>
                        <th className="px-6 py-3">Payment Method</th>
                        <th className="px-6 py-3">Amount</th>
                        <th className="px-6 py-3">Receipt #</th>
                        <th className="px-6 py-3">Paid At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paidGolfers.map((golfer) => (
                        <tr key={golfer.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">{golfer.name}</p>
                            {golfer.partner_name && (
                              <p className="text-sm text-gray-500">& {golfer.partner_name}</p>
                            )}
                            <p className="text-xs text-gray-400">{golfer.email}</p>
                          </td>
                          <td className="px-6 py-4">
                            {getPaymentBadge(golfer.payment_method)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {golfer.payment_amount_cents
                              ? formatCurrency(golfer.payment_amount_cents)
                              : formatCurrency(entryFee)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {golfer.receipt_number || '--'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {golfer.paid_at
                              ? formatDateTime(golfer.paid_at)
                              : golfer.created_at
                              ? formatDateTime(golfer.created_at)
                              : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab: Summary */}
        {activeTab === 'summary' && (
          <section className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Payment Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Registered</span>
                    <span className="font-semibold text-gray-900">{golfers.length} teams ({golfers.length * 2} players)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Paid</span>
                    <span className="font-semibold text-green-600">{paidGolfers.length} teams</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Total Pending</span>
                    <span className="font-semibold text-amber-600">{pendingGolfers.length} teams</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Walk-ins</span>
                    <span className="font-semibold text-gray-900">{walkinGolfers.length} teams</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Revenue (Paid)</span>
                    <span className="font-bold text-2xl text-green-600">{formatCurrency(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Expected (All)</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(golfers.length * entryFee)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Outstanding</span>
                    <span className="font-semibold text-amber-600">{formatCurrency(pendingGolfers.length * entryFee)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment method breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">By Payment Method</h3>
              <div className="space-y-3">
                {Object.entries(
                  paidGolfers.reduce<Record<string, number>>((acc, g) => {
                    const method = g.payment_method || 'unknown';
                    acc[method] = (acc[method] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between py-2">
                    {getPaymentBadge(method)}
                    <span className="font-medium text-gray-900">{count} team{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
                {paidGolfers.length === 0 && (
                  <p className="text-gray-400 text-sm">No payments yet</p>
                )}
              </div>
            </div>

            {/* Export */}
            <div className="flex justify-end">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition font-medium"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Mark as Paid Modal */}
      {markingPaid && (
        <MarkPaidModal
          golfer={markingPaid}
          onClose={() => setMarkingPaid(null)}
          onConfirm={(data) => handleMarkPaid(markingPaid, data)}
        />
      )}
    </div>
  );
};
