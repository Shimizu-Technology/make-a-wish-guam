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
  Banknote,
  Gift,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Golfer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  registration_status: 'confirmed' | 'waitlist' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | 'pending' | 'refunded';
  payment_method: string | null;
  payment_type: string | null;
  payment_notes: string | null;
  receipt_number: string | null;
  notes: string | null;
  checked_in_at: string | null;
  created_at: string;
  paid_at: string | null;
}

type PaymentMethod = 'swipesimple' | 'check' | 'cash' | 'comp';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  swipesimple: 'SwipeSimple',
  check: 'Check',
  cash: 'Cash',
  comp: 'Comp',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

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
        {/* Header */}
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

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            Recording payment for <span className="font-medium text-gray-900">{golfer.name}</span>
          </p>

          {/* Payment Method */}
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

          {/* Check-specific fields */}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer */}
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
    orgSlug: string;
    tournamentSlug: string;
  }>();
  const { organization } = useOrganization();
  const { getToken } = useAuthToken();

  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<Golfer | null>(null);

  // -----------------------------------------------------------------------
  // Fetch data
  // -----------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTournamentName(data.tournament?.name || '');
      setTournamentId(data.tournament?.id || null);

      const confirmed = (data.golfers || []).filter(
        (g: Golfer) => g.registration_status === 'confirmed'
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

  // -----------------------------------------------------------------------
  // Mark as paid handler
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const pendingGolfers = golfers.filter(
    (g) => g.payment_status === 'pending' || g.payment_status === 'unpaid'
  );
  const paidGolfers = golfers.filter((g) => g.payment_status === 'paid');

  const TEAM_FEE_CENTS = 30000; // $300 per team
  const totalRevenue = paidGolfers.length * TEAM_FEE_CENTS;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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
      <Toaster position="top-center" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link
              to={`/${organization?.slug}/admin/tournaments/${tournamentSlug}`}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Registered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {golfers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Paid</p>
                <p className="text-2xl font-bold text-gray-900">
                  {paidGolfers.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pendingGolfers.length}
                </p>
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
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Payments */}
        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Pending Payments
              </h2>
              <span className="ml-auto text-sm text-gray-500">
                {pendingGolfers.length} team{pendingGolfers.length !== 1 ? 's' : ''}
              </span>
            </div>

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
                      <th className="px-6 py-3">Team / Name</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Company</th>
                      <th className="px-6 py-3">Registered</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingGolfers.map((golfer) => (
                      <tr
                        key={golfer.id}
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">
                            {golfer.name}
                          </p>
                          <p className="text-sm text-gray-500">{golfer.phone}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {golfer.email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {golfer.company || '--'}
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

        {/* Paid Teams */}
        <section>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Paid Teams
              </h2>
              <span className="ml-auto text-sm text-gray-500">
                {paidGolfers.length} team{paidGolfers.length !== 1 ? 's' : ''}
              </span>
            </div>

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
                      <th className="px-6 py-3">Team / Name</th>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Company</th>
                      <th className="px-6 py-3">Payment Method</th>
                      <th className="px-6 py-3">Paid At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paidGolfers.map((golfer) => (
                      <tr
                        key={golfer.id}
                        className="hover:bg-gray-50 transition"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">
                            {golfer.name}
                          </p>
                          <p className="text-sm text-gray-500">{golfer.phone}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {golfer.email}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {golfer.company || '--'}
                        </td>
                        <td className="px-6 py-4">
                          {getPaymentBadge(golfer.payment_method)}
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
