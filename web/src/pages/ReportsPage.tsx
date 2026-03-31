import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, Button, Input } from '../components/ui';
import { api, Golfer, Group, GolferStats } from '../services/api';
import { useGolferChannel } from '../hooks/useGolferChannel';
import { 
  RefreshCw, 
  Download, 
  Users, 
  CheckCircle, 
  DollarSign,
  MapPin,
  Phone,
  Search,
  List,
  Grid3X3,
  ClipboardList,
  ArrowUp,
  ArrowDown,
  UserCheck,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

type ReportTab = 'registrations' | 'checkin' | 'payments' | 'groups' | 'contacts';

export const ReportsPage: React.FC = () => {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<GolferStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('registrations');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'cancelled' | 'waitlist'>('all');
  const [groupsSortDirection, setGroupsSortDirection] = useState<'asc' | 'desc'>('asc');
  // Payment report filters
  const [paymentTimingFilter, setPaymentTimingFilter] = useState<'all' | 'pre_paid' | 'day_of'>('all');
  const [paymentChannelFilter, setPaymentChannelFilter] = useState<'all' | 'stripe_online' | 'credit_venue' | 'cash' | 'check'>('all');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [golfersResponse, groupsData, statsData] = await Promise.all([
        api.getGolfers({ per_page: 1000 }),
        api.getGroups(),
        api.getGolferStats(),
      ]);
      
      setGolfers(golfersResponse.golfers);
      setGroups(groupsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time updates via ActionCable
  const handleGolferUpdated = useCallback((updatedGolfer: Golfer) => {
    setGolfers(prev => prev.map(g => g.id === updatedGolfer.id ? updatedGolfer : g));
    // Also refresh groups since Groups by Hole has embedded golfer data
    api.getGroups().then(setGroups).catch(console.error);
    api.getGolferStats().then(setStats).catch(console.error);
  }, []);

  const handleGolferCreated = useCallback((newGolfer: Golfer) => {
    setGolfers(prev => [...prev, newGolfer]);
    api.getGroups().then(setGroups).catch(console.error);
    api.getGolferStats().then(setStats).catch(console.error);
  }, []);

  const handleGolferDeleted = useCallback((golferId: number) => {
    setGolfers(prev => prev.filter(g => g.id !== golferId));
    api.getGroups().then(setGroups).catch(console.error);
    api.getGolferStats().then(setStats).catch(console.error);
  }, []);

  useGolferChannel({
    onGolferUpdated: handleGolferUpdated,
    onGolferCreated: handleGolferCreated,
    onGolferDeleted: handleGolferDeleted,
  });

  // Filter golfers based on search and status
  const filteredGolfers = useMemo(() => {
    let filtered = golfers;
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(g => g.registration_status === statusFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(search) ||
        g.email?.toLowerCase().includes(search) ||
        g.company?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [golfers, searchTerm, statusFilter]);

  // Compute report data
  // Only include confirmed golfers for check-in sheet (exclude cancelled and waitlist)
  const confirmedGolfers = useMemo(() => 
    filteredGolfers.filter(g => g.registration_status === 'confirmed'), 
    [filteredGolfers]
  );

  // All paid golfers (unfiltered)
  const allPaidGolfers = useMemo(() => 
    confirmedGolfers.filter(g => g.payment_status === 'paid'), 
    [confirmedGolfers]
  );

  // Filtered paid golfers based on timing and channel filters
  const paidGolfers = useMemo(() => {
    let filtered = allPaidGolfers;
    
    // Apply timing filter
    if (paymentTimingFilter !== 'all') {
      filtered = filtered.filter(g => g.payment_timing === paymentTimingFilter);
    }
    
    // Apply channel filter
    if (paymentChannelFilter !== 'all') {
      filtered = filtered.filter(g => g.payment_channel === paymentChannelFilter);
    }
    
    return filtered;
  }, [allPaidGolfers, paymentTimingFilter, paymentChannelFilter]);
  
  const unpaidGolfers = useMemo(() => 
    confirmedGolfers.filter(g => g.payment_status !== 'paid'), 
    [confirmedGolfers]
  );
  
  // Calculate payment statistics
  const paymentStats = useMemo(() => {
    const prePaid = allPaidGolfers.filter(g => g.payment_timing === 'pre_paid');
    const dayOf = allPaidGolfers.filter(g => g.payment_timing === 'day_of');
    const stripeOnline = allPaidGolfers.filter(g => g.payment_channel === 'stripe_online');
    const creditVenue = allPaidGolfers.filter(g => g.payment_channel === 'credit_venue');
    const cash = allPaidGolfers.filter(g => g.payment_channel === 'cash');
    const check = allPaidGolfers.filter(g => g.payment_channel === 'check');
    
    const sumAmount = (golfers: typeof allPaidGolfers) => 
      golfers.reduce((sum, g) => sum + (g.payment_amount_cents || 0), 0);
    
    return {
      total: { count: allPaidGolfers.length, amount: sumAmount(allPaidGolfers) },
      prePaid: { count: prePaid.length, amount: sumAmount(prePaid) },
      dayOf: { count: dayOf.length, amount: sumAmount(dayOf) },
      stripeOnline: { count: stripeOnline.length, amount: sumAmount(stripeOnline) },
      creditVenue: { count: creditVenue.length, amount: sumAmount(creditVenue) },
      cash: { count: cash.length, amount: sumAmount(cash) },
      check: { count: check.length, amount: sumAmount(check) },
    };
  }, [allPaidGolfers]);
  
  const checkedInGolfers = useMemo(() => 
    confirmedGolfers.filter(g => g.checked_in), 
    [confirmedGolfers]
  );

  // Groups sorted by hole position label (e.g., "1A", "1B", "2A", etc.)
  const groupsByHole = useMemo(() => {
    const sorted = [...groups].sort((a, b) => {
      // Parse hole_position_label to sort numerically then alphabetically
      // e.g., "1A" < "1B" < "2A" < "10A"
      const labelA = a.hole_position_label || 'ZZZ'; // Unassigned at end
      const labelB = b.hole_position_label || 'ZZZ';
      
      // Extract number and letter parts
      const matchA = labelA.match(/^(\d+)([A-Z]?)$/i);
      const matchB = labelB.match(/^(\d+)([A-Z]?)$/i);
      
      if (matchA && matchB) {
        const numA = parseInt(matchA[1]);
        const numB = parseInt(matchB[1]);
        if (numA !== numB) return numA - numB;
        // Same hole number, sort by letter
        return (matchA[2] || '').localeCompare(matchB[2] || '');
      }
      
      // Fallback to string comparison
      return labelA.localeCompare(labelB);
    });
    
    return groupsSortDirection === 'asc' ? sorted : sorted.reverse();
  }, [groups, groupsSortDirection]);

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    
    switch (activeTab) {
      case 'registrations': {
        const data = filteredGolfers.map(g => ({
          'Name': g.name,
          'Email': g.email,
          'Phone': g.phone || '-',
          'Company': g.company || '-',
          'Status': g.registration_status,
          'Payment': g.payment_status,
          'Checked In': g.checked_in ? 'Yes' : 'No',
          'Hole': g.hole_position_label || 'Unassigned',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
        break;
      }
      case 'checkin': {
        const data = confirmedGolfers.map(g => ({
          'Name': g.name,
          'Company': g.company || '-',
          'Hole': g.hole_position_label || 'Unassigned',
          'Paid': g.payment_status === 'paid' ? '✓' : '',
          'Checked In': g.checked_in ? '✓' : '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Check-In Sheet');
        break;
      }
      case 'payments': {
        const formatPaymentChannel = (channel: string | null) => {
          switch (channel) {
            case 'stripe_online': return 'Stripe (Online)';
            case 'credit_venue': return 'Credit Card (Venue)';
            case 'cash': return 'Cash';
            case 'check': return 'Check';
            default: return '-';
          }
        };
        
        const paidData = paidGolfers.map(g => ({
          'Name': g.name,
          'Company': g.company || '-',
          'Timing': g.payment_timing === 'day_of' ? 'Day-Of' : 'Pre-Paid',
          'Payment Method': formatPaymentChannel(g.payment_channel),
          'Paid At': g.paid_at ? new Date(g.paid_at).toLocaleString() : '-',
          'Amount': g.payment_amount_cents ? `$${(g.payment_amount_cents / 100).toFixed(2)}` : '-',
          'Receipt #': g.receipt_number || '-',
          'Notes': g.payment_notes || '-',
        }));
        const unpaidData = unpaidGolfers.map(g => ({
          'Name': g.name,
          'Email': g.email,
          'Phone': g.phone || '-',
          'Company': g.company || '-',
        }));
        const ws1 = XLSX.utils.json_to_sheet(paidData);
        const ws2 = XLSX.utils.json_to_sheet(unpaidData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Paid');
        XLSX.utils.book_append_sheet(wb, ws2, 'Unpaid');
        break;
      }
      case 'groups': {
        const data: any[] = [];
        groupsByHole.forEach(group => {
          data.push({
            'Hole': group.hole_position_label || 'Unassigned',
            'Player 1': group.golfers?.[0]?.name || '',
            'Player 2': group.golfers?.[1]?.name || '',
            'Player 3': group.golfers?.[2]?.name || '',
            'Player 4': group.golfers?.[3]?.name || '',
          });
        });
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Groups by Hole');
        break;
      }
      case 'contacts': {
        // Only export confirmed registrants for contact list
        const data = confirmedGolfers.map(g => ({
          'Name': g.name,
          'Email': g.email,
          'Phone': g.phone || '-',
          'Company': g.company || '-',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Contact List');
        break;
      }
    }
    
    XLSX.writeFile(wb, `${activeTab}-report-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const tabs: { id: ReportTab; label: string; icon: React.ReactNode; mobileLabel: string }[] = [
    { id: 'registrations', label: 'All Registrations', icon: <List size={14} />, mobileLabel: 'All' },
    { id: 'checkin', label: 'Check-In Sheet', icon: <ClipboardList size={14} />, mobileLabel: 'Check-In' },
    { id: 'payments', label: 'Payment Summary', icon: <DollarSign size={14} />, mobileLabel: 'Payments' },
    { id: 'groups', label: 'Groups by Hole', icon: <Grid3X3 size={14} />, mobileLabel: 'Groups' },
    { id: 'contacts', label: 'Contact List', icon: <Phone size={14} />, mobileLabel: 'Contacts' },
  ];

  // Mobile card component for golfer display
  const GolferCard = ({ golfer, showPayment = true, showStatus = true, showGroup = false }: { 
    golfer: Golfer; 
    showPayment?: boolean; 
    showStatus?: boolean;
    showGroup?: boolean;
  }) => (
    <div className="p-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{golfer.name}</p>
          {golfer.company && (
            <p className="text-xs text-gray-500 truncate">{golfer.company}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {showStatus && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              golfer.registration_status === 'confirmed' 
                ? 'bg-green-100 text-green-700' 
                : golfer.registration_status === 'cancelled'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {golfer.registration_status === 'confirmed' ? 'conf' : golfer.registration_status === 'cancelled' ? 'canc' : 'wait'}
            </span>
          )}
          {showPayment && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              golfer.payment_status === 'paid' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {golfer.payment_status === 'paid' ? 'paid' : 'unpaid'}
            </span>
          )}
          {showGroup && golfer.hole_position_label && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700">
              {golfer.hole_position_label}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-3 lg:space-y-6">
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg lg:text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-xs lg:text-sm text-gray-600">View and export tournament data</p>
          </div>
          <div className="flex gap-1.5 lg:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="px-2 lg:px-3"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="px-2 lg:px-3"
            >
              <Download size={16} />
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Summary Cards - Compact 4-column grid on mobile */}
        {stats && (
          <div className="grid grid-cols-4 gap-2 lg:gap-4">
            <div className="bg-gradient-to-br from-brand-50 to-brand-100 rounded-lg p-2 lg:p-4 border border-brand-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:gap-3">
                <div className="hidden lg:block p-2 bg-brand-500 rounded-lg">
                  <Users className="text-white" size={18} />
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-[10px] lg:text-xs text-brand-600 font-medium">Registered</p>
                  <p className="text-lg lg:text-2xl font-bold text-brand-800">{stats.total}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-2 lg:p-4 border border-green-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:gap-3">
                <div className="hidden lg:block p-2 bg-green-500 rounded-lg">
                  <DollarSign className="text-white" size={18} />
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-[10px] lg:text-xs text-green-600 font-medium">Paid</p>
                  <p className="text-lg lg:text-2xl font-bold text-green-900">{stats.paid}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-2 lg:p-4 border border-emerald-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:gap-3">
                <div className="hidden lg:block p-2 bg-emerald-500 rounded-lg">
                  <CheckCircle className="text-white" size={18} />
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-[10px] lg:text-xs text-emerald-600 font-medium">Checked In</p>
                  <p className="text-lg lg:text-2xl font-bold text-emerald-900">{stats.checked_in}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-2 lg:p-4 border border-purple-200">
              <div className="flex flex-col lg:flex-row lg:items-center lg:gap-3">
                <div className="hidden lg:block p-2 bg-purple-500 rounded-lg">
                  <MapPin className="text-white" size={18} />
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-[10px] lg:text-xs text-purple-600 font-medium">Groups</p>
                  <p className="text-lg lg:text-2xl font-bold text-purple-900">{groups.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs - Sticky on mobile */}
        <div className="sticky top-0 z-10 bg-gray-50 -mx-4 px-4 py-2 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:bg-transparent">
          <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 lg:px-3 lg:py-2 rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#1e3a5f] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.icon}
                <span className="lg:hidden">{tab.mobileLabel}</span>
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        {activeTab !== 'groups' && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 py-2 text-sm"
            />
          </div>
        )}

        {/* Report Content */}
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
              Loading...
            </div>
          ) : (
            <>
              {/* Registrations Tab */}
              {activeTab === 'registrations' && (
                <>
                  <div className="p-2 lg:p-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs lg:text-sm text-gray-600">{filteredGolfers.length} registrations</span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">Status:</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'confirmed' | 'cancelled' | 'waitlist')}
                        className="text-xs lg:text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="all">All</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="waitlist">Waitlist</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Mobile View - Card layout */}
                  <div className="lg:hidden max-h-[60vh] overflow-y-auto">
                    {filteredGolfers.map(g => (
                      <GolferCard key={g.id} golfer={g} showGroup />
                    ))}
                    {filteredGolfers.length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">No registrations found</div>
                    )}
                  </div>

                  {/* Desktop View - Table */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Payment</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Hole</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredGolfers.map(g => (
                          <tr key={g.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{g.name}</td>
                            <td className="px-3 py-2 text-gray-600">{g.email}</td>
                            <td className="px-3 py-2 text-gray-600">{g.company || '-'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                g.registration_status === 'confirmed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : g.registration_status === 'cancelled'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {g.registration_status}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                g.payment_status === 'paid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {g.payment_status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {g.hole_position_label || 'Unassigned'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Check-In Sheet Tab */}
              {activeTab === 'checkin' && (
                <>
                  <div className="p-2 lg:p-4 border-b bg-gray-50 flex justify-between items-center">
                    <span className="text-xs lg:text-sm text-gray-600">{confirmedGolfers.length} players</span>
                    <span className="text-xs lg:text-sm font-medium text-green-700">
                      {checkedInGolfers.length} checked in
                    </span>
                  </div>
                  
                  {/* Mobile View */}
                  <div className="lg:hidden max-h-[60vh] overflow-y-auto">
                    {confirmedGolfers.map(g => (
                      <div key={g.id} className={`p-3 border-b border-gray-100 last:border-b-0 ${g.checked_in ? 'bg-green-50' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">{g.name}</p>
                            <p className="text-xs text-gray-500">Hole {g.hole_position_label || 'Unassigned'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {g.payment_status === 'paid' && (
                              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                                <DollarSign size={12} className="text-green-600" />
                              </div>
                            )}
                            {g.checked_in && (
                              <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center">
                                <CheckCircle size={12} className="text-brand-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Hole</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500">Paid</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500"><Check className="w-4 h-4 mx-auto" /></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {confirmedGolfers.map(g => (
                          <tr key={g.id} className={`hover:bg-gray-50 ${g.checked_in ? 'bg-green-50' : ''}`}>
                            <td className="px-3 py-2 font-medium">{g.name}</td>
                            <td className="px-3 py-2 text-gray-600">{g.company || '-'}</td>
                            <td className="px-3 py-2 text-gray-600">{g.hole_position_label || 'Unassigned'}</td>
                            <td className="px-3 py-2 text-center">
                              {g.payment_status === 'paid' && (
                                <CheckCircle size={16} className="text-green-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {g.checked_in && (
                                <CheckCircle size={16} className="text-brand-600 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Payments Tab */}
              {activeTab === 'payments' && (
                <>
                  {/* Payment Stats Summary */}
                  <div className="p-3 lg:p-4 border-b bg-gray-50">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-3">
                      <div className="bg-white rounded-lg p-2 lg:p-3 border">
                        <p className="text-[10px] lg:text-xs text-gray-500 uppercase">Total Paid</p>
                        <p className="text-lg lg:text-xl font-bold text-green-600">{paymentStats.total.count}</p>
                        <p className="text-xs text-gray-500">${(paymentStats.total.amount / 100).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 lg:p-3 border">
                        <p className="text-[10px] lg:text-xs text-gray-500 uppercase">Pre-Paid</p>
                        <p className="text-lg lg:text-xl font-bold text-brand-600">{paymentStats.prePaid.count}</p>
                        <p className="text-xs text-gray-500">${(paymentStats.prePaid.amount / 100).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 lg:p-3 border">
                        <p className="text-[10px] lg:text-xs text-gray-500 uppercase">Day-Of</p>
                        <p className="text-lg lg:text-xl font-bold text-amber-600">{paymentStats.dayOf.count}</p>
                        <p className="text-xs text-gray-500">${(paymentStats.dayOf.amount / 100).toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 lg:p-3 border">
                        <p className="text-[10px] lg:text-xs text-gray-500 uppercase">Unpaid</p>
                        <p className="text-lg lg:text-xl font-bold text-red-600">{unpaidGolfers.length}</p>
                      </div>
                    </div>
                    
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={paymentTimingFilter}
                        onChange={(e) => setPaymentTimingFilter(e.target.value as typeof paymentTimingFilter)}
                        className="text-xs lg:text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="all">All Timing</option>
                        <option value="pre_paid">Pre-Paid ({paymentStats.prePaid.count})</option>
                        <option value="day_of">Day-Of ({paymentStats.dayOf.count})</option>
                      </select>
                      <select
                        value={paymentChannelFilter}
                        onChange={(e) => setPaymentChannelFilter(e.target.value as typeof paymentChannelFilter)}
                        className="text-xs lg:text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="all">All Methods</option>
                        <option value="stripe_online">Stripe Online ({paymentStats.stripeOnline.count})</option>
                        <option value="credit_venue">Credit at Venue ({paymentStats.creditVenue.count})</option>
                        <option value="cash">Cash ({paymentStats.cash.count})</option>
                        <option value="check">Check ({paymentStats.check.count})</option>
                      </select>
                      {(paymentTimingFilter !== 'all' || paymentChannelFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setPaymentTimingFilter('all');
                            setPaymentChannelFilter('all');
                          }}
                          className="text-xs text-brand-600 hover:text-brand-800 underline"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="max-h-[60vh] lg:max-h-none overflow-y-auto">
                    {/* Paid Section */}
                    <div className="border-b">
                      <div className="p-2 lg:p-3 bg-green-50 font-medium text-green-800 flex items-center gap-2 text-sm">
                        <CheckCircle size={14} />
                        Paid ({paidGolfers.length}{(paymentTimingFilter !== 'all' || paymentChannelFilter !== 'all') ? ` of ${allPaidGolfers.length}` : ''})
                      </div>
                      
                      {/* Mobile */}
                      <div className="lg:hidden">
                        {paidGolfers.map(g => (
                          <div key={g.id} className="p-3 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 truncate">{g.name}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    g.payment_timing === 'day_of' 
                                      ? 'bg-amber-100 text-amber-700' 
                                      : 'bg-brand-100 text-brand-700'
                                  }`}>
                                    {g.payment_timing === 'day_of' ? 'Day-Of' : 'Pre-Paid'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">
                                    {g.payment_channel === 'stripe_online' ? 'Stripe' : 
                                     g.payment_channel === 'credit_venue' ? 'Credit' : 
                                     g.payment_channel || 'Unknown'}
                                  </span>
                                </div>
                                {g.paid_at && (
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    {new Date(g.paid_at).toLocaleDateString('en-US', { 
                                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                                    })}
                                  </p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                {g.payment_amount_cents && (
                                  <p className="text-sm font-medium text-green-600">
                                    ${(g.payment_amount_cents / 100).toFixed(0)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {paidGolfers.length === 0 && (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            {(paymentTimingFilter !== 'all' || paymentChannelFilter !== 'all') 
                              ? 'No golfers match the selected filters' 
                              : 'No paid golfers'}
                          </div>
                        )}
                      </div>

                      {/* Desktop */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Timing</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Method</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Paid At</th>
                              <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {paidGolfers.map(g => (
                              <tr key={g.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium">{g.name}</td>
                                <td className="px-3 py-2 text-gray-600">{g.company || '-'}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    g.payment_timing === 'day_of' 
                                      ? 'bg-amber-100 text-amber-700' 
                                      : 'bg-brand-100 text-brand-700'
                                  }`}>
                                    {g.payment_timing === 'day_of' ? 'Day-Of' : 'Pre-Paid'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {g.payment_channel === 'stripe_online' ? 'Stripe (Online)' : 
                                   g.payment_channel === 'credit_venue' ? 'Credit Card (Venue)' : 
                                   g.payment_channel === 'cash' ? 'Cash' :
                                   g.payment_channel === 'check' ? 'Check' : '-'}
                                </td>
                                <td className="px-3 py-2 text-gray-600 text-xs">
                                  {g.paid_at ? new Date(g.paid_at).toLocaleDateString('en-US', { 
                                    month: 'short', day: 'numeric', year: 'numeric',
                                    hour: 'numeric', minute: '2-digit'
                                  }) : '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-green-600">
                                  {g.payment_amount_cents ? `$${(g.payment_amount_cents / 100).toFixed(0)}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Unpaid Section */}
                    <div>
                      <div className="p-2 lg:p-3 bg-red-50 font-medium text-red-800 flex items-center gap-2 text-sm">
                        <DollarSign size={14} />
                        Unpaid ({unpaidGolfers.length})
                      </div>
                      
                      {/* Mobile */}
                      <div className="lg:hidden">
                        {unpaidGolfers.map(g => (
                          <div key={g.id} className="p-3 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 truncate">{g.name}</p>
                                <p className="text-xs text-gray-500 truncate">{g.phone || g.email}</p>
                              </div>
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">
                                unpaid
                              </span>
                            </div>
                          </div>
                        ))}
                        {unpaidGolfers.length === 0 && (
                          <div className="p-4 text-center text-gray-500 text-sm">Everyone is paid!</div>
                        )}
                      </div>

                      {/* Desktop */}
                      <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Phone</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {unpaidGolfers.map(g => (
                              <tr key={g.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 font-medium">{g.name}</td>
                                <td className="px-3 py-2 text-gray-600">{g.email}</td>
                                <td className="px-3 py-2 text-gray-600">{g.phone || '-'}</td>
                                <td className="px-3 py-2 text-gray-600">{g.company || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Groups Tab */}
              {activeTab === 'groups' && (
                <>
                  <div className="p-2 lg:p-4 border-b bg-gray-50 flex items-center justify-between">
                    <span className="text-xs lg:text-sm text-gray-600">{groups.length} groups</span>
                    <button
                      onClick={() => setGroupsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      title={groupsSortDirection === 'asc' ? 'Sorted: Hole 1 → 18' : 'Sorted: Hole 18 → 1'}
                    >
                      {groupsSortDirection === 'asc' ? (
                        <>
                          <ArrowUp size={14} />
                          <span className="hidden sm:inline">1 → 18</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown size={14} />
                          <span className="hidden sm:inline">18 → 1</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-3 lg:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] lg:max-h-none overflow-y-auto">
                    {groupsByHole.map(group => {
                      const checkedInCount = group.golfers?.filter(g => g.checked_in).length || 0;
                      const totalCount = group.golfers?.length || 0;
                      const allCheckedIn = totalCount > 0 && checkedInCount === totalCount;
                      
                      return (
                        <div 
                          key={group.id} 
                          className={`border rounded-lg p-3 bg-white hover:shadow-md transition-shadow ${allCheckedIn ? 'border-green-300 bg-green-50/30' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold text-sm ${group.hole_position_label && group.hole_position_label !== 'Unassigned' ? 'text-gray-900' : 'text-amber-600'}`}>
                              Hole {group.hole_position_label || 'Unassigned'}
                            </span>
                            {totalCount > 0 && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                                allCheckedIn 
                                  ? 'bg-green-100 text-green-700' 
                                  : checkedInCount > 0 
                                    ? 'bg-brand-100 text-brand-700'
                                    : 'bg-gray-100 text-gray-500'
                              }`}>
                                {checkedInCount}/{totalCount} <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {group.golfers && group.golfers.length > 0 ? (
                              group.golfers.map((golfer, idx) => (
                                <div 
                                  key={golfer.id} 
                                  className={`flex items-center gap-2 text-sm ${golfer.checked_in ? 'text-green-700' : 'text-gray-700'}`}
                                >
                                  {golfer.checked_in ? (
                                    <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                      <UserCheck size={10} className="text-white" />
                                    </span>
                                  ) : (
                                    <span className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-medium text-brand-600">
                                      {String.fromCharCode(65 + idx)}
                                    </span>
                                  )}
                                  <span className={`truncate ${golfer.checked_in ? 'font-medium' : ''}`}>{golfer.name}</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-gray-400 italic">Empty</p>
                            )}
                            {/* Empty slots */}
                            {group.golfers && group.golfers.length < 4 && group.golfers.length > 0 && (
                              Array.from({ length: 4 - group.golfers.length }).map((_, idx) => (
                                <div 
                                  key={`empty-${idx}`} 
                                  className="flex items-center gap-2 text-sm text-gray-300"
                                >
                                  <span className="w-4 h-4 rounded-full bg-gray-50 flex items-center justify-center text-[10px] font-medium">
                                    {String.fromCharCode(65 + group.golfers!.length + idx)}
                                  </span>
                                  <span className="italic text-xs">Empty</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Contacts Tab - Only show confirmed registrants */}
              {activeTab === 'contacts' && (
                <>
                  <div className="p-2 lg:p-4 border-b bg-gray-50">
                    <span className="text-xs lg:text-sm text-gray-600">{confirmedGolfers.length} contacts</span>
                  </div>
                  
                  {/* Mobile */}
                  <div className="lg:hidden max-h-[60vh] overflow-y-auto">
                    {confirmedGolfers.map(g => (
                      <div key={g.id} className="p-3 border-b border-gray-100 last:border-b-0">
                        <p className="font-medium text-gray-900">{g.name}</p>
                        <div className="mt-1 space-y-0.5">
                          <a href={`mailto:${g.email}`} className="block text-xs text-brand-600 truncate">
                            {g.email}
                          </a>
                          {g.phone && (
                            <a href={`tel:${g.phone}`} className="block text-xs text-brand-600">
                              {g.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                    {confirmedGolfers.length === 0 && (
                      <div className="p-4 text-center text-gray-500 text-sm">No contacts found</div>
                    )}
                  </div>

                  {/* Desktop */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Phone</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Company</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {confirmedGolfers.map(g => (
                          <tr key={g.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium">{g.name}</td>
                            <td className="px-3 py-2">
                              <a href={`mailto:${g.email}`} className="text-brand-600 hover:underline">
                                {g.email}
                              </a>
                            </td>
                            <td className="px-3 py-2">
                              {g.phone ? (
                                <a href={`tel:${g.phone}`} className="text-brand-600 hover:underline">
                                  {g.phone}
                                </a>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-600">
                              {g.company || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};
