import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useOrganization } from '../components/OrganizationProvider';
import { 
  Users, 
  DollarSign, 
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  Building2,
  UserCheck,
  UserPlus,
  CreditCard,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AddGolferModal } from '../components/AddGolferModal';
import { EditGolferModal } from '../components/EditGolferModal';

interface Golfer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  registration_status: 'confirmed' | 'waitlist' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | 'refunded';
  payment_method: string | null;
  payment_type: string | null;
  notes: string | null;
  checked_in_at: string | null;
  created_at: string;
}

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
  confirmed: number;
  waitlisted: number;
  cancelled: number;
  paid: number;
  unpaid: number;
  checked_in: number;
  revenue: number;
}

export const OrgTournamentAdmin: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getToken } = useAuthToken();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [checkinFilter, setCheckinFilter] = useState('all');
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<'name' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Selected golfer for detail view
  const [selectedGolfer, setSelectedGolfer] = useState<Golfer | null>(null);
  
  // Add golfer modal
  const [showAddGolferModal, setShowAddGolferModal] = useState(false);
  
  // Edit golfer modal
  const [editingGolfer, setEditingGolfer] = useState<Golfer | null>(null);
  
  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    if (!organization || !tournamentSlug) return;

    try {
      setLoading(true);
      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tournament data');
      }

      const data = await response.json();
      setTournament(data.tournament);
      setGolfers(data.golfers || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organization, tournamentSlug, getToken]);

  // Filtered and sorted golfers
  const filteredGolfers = useMemo(() => {
    let filtered = [...golfers];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        g => g.name.toLowerCase().includes(term) ||
             g.email.toLowerCase().includes(term) ||
             g.phone.includes(term) ||
             (g.company && g.company.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.registration_status === statusFilter);
    }

    // Payment filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(g => g.payment_status === paymentFilter);
    }

    // Check-in filter
    if (checkinFilter === 'checked_in') {
      filtered = filtered.filter(g => g.checked_in_at);
    } else if (checkinFilter === 'not_checked_in') {
      filtered = filtered.filter(g => !g.checked_in_at);
    }

    // Sort
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
  }, [golfers, searchTerm, statusFilter, paymentFilter, checkinFilter, sortColumn, sortDirection]);

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
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to check in golfer');

      toast.success(`${golfer.name} checked in!`);
      fetchData(); // Refresh data
    } catch (err) {
      toast.error('Failed to check in golfer');
    }
  };

  const handleCancelRegistration = async (golfer: Golfer) => {
    if (!confirm(`Cancel registration for ${golfer.name}? This cannot be undone.`)) {
      return;
    }

    setActionLoading(`cancel-${golfer.id}`);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization?.slug}/tournaments/${tournamentSlug}/golfers/${golfer.id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
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
    if (!confirm(`Refund ${golfer.name}? This will mark the payment as refunded and cancel the registration.`)) {
      return;
    }

    setActionLoading(`refund-${golfer.id}`);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization?.slug}/tournaments/${tournamentSlug}/golfers/${golfer.id}/refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
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
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Payment', 'Checked In', 'Registered'];
    const rows = filteredGolfers.map(g => [
      g.name,
      g.email,
      g.phone,
      g.company || '',
      g.registration_status,
      g.payment_status,
      g.checked_in_at ? 'Yes' : 'No',
      new Date(g.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournamentSlug}-registrations.csv`;
    a.click();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Pacific/Guam',
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      confirmed: 'bg-green-100 text-green-700',
      waitlist: 'bg-yellow-100 text-yellow-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getPaymentBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      unpaid: 'bg-red-100 text-red-700',
      refunded: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (orgLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !organization || !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Tournament not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="text-white py-6 px-4"
        style={{ backgroundColor: organization.primary_color || '#1e40af' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={`/${organization.slug}/admin`}
                className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dashboard</span>
              </Link>
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <p className="text-white/80 mt-1">Tournament Management</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddGolferModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 font-medium"
              >
                <UserPlus className="w-5 h-5" />
                <span>Add Golfer</span>
              </button>
              <Link
                to={`/${organization.slug}/admin/tournaments/${tournamentSlug}/checkin`}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 font-semibold"
              >
                <UserCheck className="w-5 h-5" />
                <span>Check-In Mode</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-brand-500" />
                <div>
                  <p className="text-sm text-gray-500">Registered</p>
                  <p className="text-xl font-bold">{stats.confirmed}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-500">Paid</p>
                  <p className="text-xl font-bold">{stats.paid}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-500">Checked In</p>
                  <p className="text-xl font-bold">{stats.checked_in}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-500">Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(stats.revenue)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters & Actions */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="waitlist">Waitlist</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Payment</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>

                <select
                  value={checkinFilter}
                  onChange={(e) => setCheckinFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">All Check-in</option>
                  <option value="checked_in">Checked In</option>
                  <option value="not_checked_in">Not Checked In</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={fetchData}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Refresh"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>

          {/* Results count */}
          <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600">
            Showing {filteredGolfers.length} of {golfers.length} registrations
          </div>
        </div>

        {/* Golfers Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Contact</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Payment</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Check-in</th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      Registered
                      {sortColumn === 'created_at' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredGolfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {golfers.length === 0 ? 'No registrations yet' : 'No results match your filters'}
                    </td>
                  </tr>
                ) : (
                  filteredGolfers.map((golfer) => (
                    <tr 
                      key={golfer.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedGolfer(golfer)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{golfer.name}</p>
                          {golfer.company && (
                            <p className="text-sm text-gray-500">{golfer.company}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="text-gray-900">{golfer.email}</p>
                          <p className="text-gray-500">{golfer.phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(golfer.registration_status)}
                      </td>
                      <td className="px-4 py-3">
                        {getPaymentBadge(golfer.payment_status)}
                      </td>
                      <td className="px-4 py-3">
                        {golfer.checked_in_at ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-300" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(golfer.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {!golfer.checked_in_at && golfer.registration_status === 'confirmed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckIn(golfer);
                            }}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Check In
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Golfer Detail Modal */}
        {selectedGolfer && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedGolfer(null)}
          >
            <div 
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">{selectedGolfer.name}</h3>
                <div className="flex gap-2 mt-2">
                  {getStatusBadge(selectedGolfer.registration_status)}
                  {getPaymentBadge(selectedGolfer.payment_status)}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span>{selectedGolfer.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span>{selectedGolfer.phone}</span>
                </div>
                {selectedGolfer.company && (
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <span>{selectedGolfer.company}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span>Registered: {formatDate(selectedGolfer.created_at)}</span>
                </div>
                {selectedGolfer.checked_in_at && (
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-5 h-5 text-green-500" />
                    <span>Checked in: {formatDate(selectedGolfer.checked_in_at)}</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 space-y-3">
                {/* Primary Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedGolfer(null)}
                    className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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
                  {!selectedGolfer.checked_in_at && selectedGolfer.registration_status === 'confirmed' && (
                    <button
                      onClick={() => {
                        handleCheckIn(selectedGolfer);
                        setSelectedGolfer(null);
                      }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Check In
                    </button>
                  )}
                </div>

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
      </main>

      {/* Add Golfer Modal */}
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

      {/* Edit Golfer Modal */}
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
