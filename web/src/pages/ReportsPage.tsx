import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ClipboardList,
  DollarSign,
  Download,
  Grid3X3,
  List,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  api,
  CombinedLedgerReportRow,
  Golfer,
  GolferStats,
  Group,
  PaymentReport,
  RaffleSaleReportRow,
  RegistrationPaymentReportRow,
  SponsoredRegistrationReportRow,
} from '../services/api';
import { useGolferChannel } from '../hooks/useGolferChannel';
import { useTournament } from '../contexts';
import { formatDate, formatShortDate } from '../utils/dates';

type ReportTab = 'registrations' | 'checkin' | 'payments' | 'groups' | 'contacts';

const startingPositionText = (golfer: Pick<Golfer, 'hole_position_label'>) =>
  golfer.hole_position_label || 'Unassigned';

const formatCents = (cents?: number | null) => `$${((cents || 0) / 100).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatReportDate = (value?: string | null) => (value ? formatShortDate(value) : '');

export function ReportsPage() {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const {
    activeTournament: contextActiveTournament,
    tournaments,
    isLoading: tournamentsLoading,
  } = useTournament();
  const activeTournament = useMemo(() => {
    if (!tournamentSlug) return contextActiveTournament;

    return tournaments.find((tournament) => tournament.slug === tournamentSlug) ?? null;
  }, [contextActiveTournament, tournamentSlug, tournaments]);

  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [stats, setStats] = useState<GolferStats | null>(null);
  const [paymentReport, setPaymentReport] = useState<PaymentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('registrations');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentTimingFilter, setPaymentTimingFilter] = useState<string>('all');
  const [paymentChannelFilter, setPaymentChannelFilter] = useState<string>('all');
  const [sortAscending, setSortAscending] = useState(true);

  const fetchData = useCallback(async () => {
    if (tournamentSlug && tournamentsLoading) return;

    setLoading(true);
    setPaymentReport(null);
    try {
      const tournamentId = activeTournament?.id;
      if (tournamentSlug && !tournamentId) {
        setGolfers([]);
        setGroups([]);
        setStats(null);
        return;
      }

      const [golfersRes, groupsData, statsData, paymentReportData] = await Promise.all([
        api.getGolfers({ per_page: 1000, ...(tournamentId ? { tournament_id: tournamentId } : {}) }),
        api.getGroups(tournamentId),
        api.getGolferStats(tournamentId),
        api.getPaymentReport(tournamentId),
      ]);
      setGolfers(golfersRes.golfers);
      setGroups(groupsData);
      setStats(statsData);
      setPaymentReport(paymentReportData);
    } catch (err) {
      console.error('Failed to load reports data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTournament?.id, tournamentSlug, tournamentsLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useGolferChannel({
    onGolferUpdated: (g) => setGolfers((prev) => prev.map((x) => (x.id === g.id ? g : x))),
    onGolferCreated: (g) => setGolfers((prev) => [...prev, g]),
    onGolferDeleted: (id) => setGolfers((prev) => prev.filter((x) => x.id !== id)),
  });

  // --- Derived data ---

  const filteredGolfers = useMemo(() => {
    let result = golfers;
    if (statusFilter !== 'all') {
      result = result.filter((g) => g.registration_status === statusFilter);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(s) ||
          g.email?.toLowerCase().includes(s) ||
          (g.company && g.company.toLowerCase().includes(s)) ||
          (g.sponsor_display_name && g.sponsor_display_name.toLowerCase().includes(s)) ||
          (g.partner_name && g.partner_name.toLowerCase().includes(s))
      );
    }
    return result;
  }, [golfers, statusFilter, searchTerm]);

  const confirmedGolfers = useMemo(
    () => filteredGolfers.filter((g) => g.registration_status === 'confirmed'),
    [filteredGolfers]
  );

  const allPaidConfirmed = useMemo(
    () => golfers.filter((g) => g.registration_status === 'confirmed' && g.payment_status === 'paid'),
    [golfers]
  );

  const paidGolfers = useMemo(() => {
    let result = confirmedGolfers.filter((g) => g.payment_status === 'paid' && g.payment_type !== 'sponsor');
    if (paymentTimingFilter !== 'all') {
      result = result.filter((g) => g.payment_timing === paymentTimingFilter);
    }
    if (paymentChannelFilter !== 'all') {
      result = result.filter((g) => g.payment_channel === paymentChannelFilter);
    }
    return result;
  }, [confirmedGolfers, paymentTimingFilter, paymentChannelFilter]);

  const unpaidGolfers = useMemo(
    () => confirmedGolfers.filter((g) => g.payment_status !== 'paid'),
    [confirmedGolfers]
  );

  const paymentStats = useMemo(() => {
    const totalAmount = allPaidConfirmed.reduce((s, g) => s + (g.payment_amount_cents || 0), 0);
    const prePaid = allPaidConfirmed.filter((g) => g.payment_timing === 'pre_paid');
    const dayOf = allPaidConfirmed.filter((g) => g.payment_timing === 'day_of');
    return {
      totalPaid: allPaidConfirmed.length,
      totalAmount: totalAmount / 100,
      prePaid: prePaid.length,
      prePaidAmount: prePaid.reduce((s, g) => s + (g.payment_amount_cents || 0), 0) / 100,
      dayOf: dayOf.length,
      dayOfAmount: dayOf.reduce((s, g) => s + (g.payment_amount_cents || 0), 0) / 100,
      unpaid: golfers.filter((g) => g.registration_status === 'confirmed' && g.payment_status !== 'paid').length,
    };
  }, [allPaidConfirmed, golfers]);

  const groupsByStart = useMemo(() => {
    const courseOrder = new Map<string, number>(
      (activeTournament?.course_configs || []).map((course: { key: string }, index: number) => [course.key, index])
    );

    const sorted = [...groups].sort((a, b) => {
      const courseA = a.starting_course_key ? (courseOrder.get(a.starting_course_key) ?? 999) : 999;
      const courseB = b.starting_course_key ? (courseOrder.get(b.starting_course_key) ?? 999) : 999;
      if (courseA !== courseB) return courseA - courseB;

      const holeA = a.hole_number ?? 999;
      const holeB = b.hole_number ?? 999;
      if (holeA !== holeB) return holeA - holeB;

      return a.group_number - b.group_number;
    });
    return sortAscending ? sorted : sorted.reverse();
  }, [activeTournament?.course_configs, groups, sortAscending]);

  // --- Export ---

  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0];
    const wb = XLSX.utils.book_new();

    switch (activeTab) {
      case 'registrations': {
        const data = filteredGolfers.map((g) => ({
          Name: g.name,
          Email: g.email,
          Phone: g.phone || '',
          Company: g.company || '',
          Sponsor: g.sponsor_display_name || '',
          'Partner Name': g.partner_name || '',
          Category: g.team_category || '',
          Source: g.registration_source === 'admin' ? 'Admin' : 'Public',
          Status: g.registration_status,
          Payment: g.payment_status,
          'Payment Method': g.payment_method || g.payment_type || '',
          'Starting Position': g.hole_position_label || 'Unassigned',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Registrations');
        break;
      }
      case 'checkin': {
        const data = confirmedGolfers.map((g) => ({
          Name: g.name,
          'Partner Name': g.partner_name || '',
          Company: g.company || '',
          Category: g.team_category || '',
          'Starting Position': g.hole_position_label || 'Unassigned',
          Paid: g.payment_status === 'paid' ? 'Yes' : 'No',
          'Checked In': g.checked_in ? 'Yes' : 'No',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Check-In Sheet');
        break;
      }
      case 'payments': {
        if (paymentReport) {
          const sponsoredRows = paymentReport.sponsored_registrations.filter((row) => row.registration_status !== 'cancelled');
          const summaryData = [
            { Metric: 'Net Registration Revenue', Value: formatCents(paymentReport.summary.registration_revenue_cents) },
            { Metric: 'Raffle Revenue', Value: formatCents(paymentReport.summary.raffle_revenue_cents) },
            { Metric: 'Net Total Collected', Value: formatCents(paymentReport.summary.total_revenue_cents) },
            { Metric: 'Refunded Registration Amount', Value: formatCents(paymentReport.summary.refunded_registration_amount_cents) },
            { Metric: 'Paid Registrations', Value: paymentReport.summary.registration_paid_count },
            { Metric: 'Pending Registrations', Value: paymentReport.summary.registration_pending_count },
            { Metric: 'Sponsored Registrations (Cleared)', Value: paymentReport.summary.sponsored_registration_count },
            { Metric: 'Sponsored Registration Rows', Value: sponsoredRows.length },
            { Metric: 'Paid Raffle Tickets', Value: paymentReport.summary.raffle_paid_ticket_count },
            { Metric: 'Purchased Raffle Tickets', Value: paymentReport.summary.raffle_purchased_ticket_count },
            { Metric: 'Included Raffle Tickets', Value: paymentReport.summary.raffle_complimentary_ticket_count },
            { Metric: 'Voided Raffle Tickets', Value: paymentReport.summary.raffle_voided_ticket_count },
          ];
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');

          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(paymentReport.registration_payments.map(registrationExportRow)),
            'Registration Payments'
          );
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(sponsoredRows.map(sponsorExportRow)),
            'Sponsored Registrations'
          );
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(paymentReport.raffle_sales.map(raffleExportRow)),
            'Raffle Sales'
          );
          XLSX.utils.book_append_sheet(
            wb,
            XLSX.utils.json_to_sheet(paymentReport.combined_ledger.map(ledgerExportRow)),
            'Combined Ledger'
          );
          break;
        }

        const paidData = paidGolfers.map((g) => ({
          'Player 1': g.name,
          'Player 2': g.partner_name || '',
          Company: g.company || '',
          Timing: g.payment_timing || '',
          Method: g.payment_channel || g.payment_type || '',
          'Paid At': g.paid_at ? formatShortDate(g.paid_at) : '',
          Amount: g.payment_amount_cents ? `$${(g.payment_amount_cents / 100).toFixed(2)}` : '',
        }));
        const unpaidData = unpaidGolfers.map((g) => ({
          'Player 1': g.name,
          'Player 2': g.partner_name || '',
          Email: g.email,
          Phone: g.phone || '',
          Company: g.company || '',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paidData), 'Paid');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unpaidData), 'Unpaid');
        break;
      }
      case 'groups': {
        const data = groupsByStart.flatMap((group) => {
          const players = group.golfers || [];
          const start = group.hole_position_label && group.hole_position_label !== 'Unassigned'
            ? group.hole_position_label
            : `Group ${group.group_number}`;
          if (players.length === 0) return [{ 'Starting Position': start, 'Player 1': '', 'Player 2': '' }];
          return players.map((p) => ({
            'Starting Position': start,
            'Player 1': p.name,
            'Player 2': p.partner_name || '',
            Category: p.team_category || '',
            'Sponsor Company': p.sponsor_display_name || p.sponsor_name || '',
          }));
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Groups by Start');
        break;
      }
      case 'contacts': {
        const data = confirmedGolfers.map((g) => ({
          Name: g.name,
          'Partner Name': g.partner_name || '',
          Email: g.email,
          Phone: g.phone || '',
          Company: g.company || '',
          Category: g.team_category || '',
          Sponsor: g.sponsor_display_name || '',
          Source: g.registration_source === 'admin' ? 'Admin' : 'Public',
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Contact List');
        break;
      }
    }

    XLSX.writeFile(wb, `${activeTab}-report-${date}.xlsx`);
  };

  // --- Tab config ---

  const tabs: { id: ReportTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'registrations', label: 'All Registrations', mobileLabel: 'All', icon: <List size={14} /> },
    { id: 'checkin', label: 'Check-In Sheet', mobileLabel: 'Check-In', icon: <ClipboardList size={14} /> },
    { id: 'payments', label: 'Payment Summary', mobileLabel: 'Payments', icon: <DollarSign size={14} /> },
    { id: 'groups', label: 'Pairings by Start', mobileLabel: 'Pairings', icon: <Grid3X3 size={14} /> },
    { id: 'contacts', label: 'Contact List', mobileLabel: 'Contacts', icon: <Phone size={14} /> },
  ];

  if (loading && golfers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">View and export event data</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
            title="Export to Excel"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 lg:gap-4">
          <div className="bg-blue-50 rounded-xl p-3 lg:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <List size={14} className="text-blue-600" />
              </div>
            </div>
            <p className="text-[10px] lg:text-xs text-blue-600 font-medium">Registered</p>
            <p className="text-lg lg:text-2xl font-bold text-blue-900">{stats.total}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 lg:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign size={14} className="text-green-600" />
              </div>
            </div>
            <p className="text-[10px] lg:text-xs text-green-600 font-medium">Paid</p>
            <p className="text-lg lg:text-2xl font-bold text-green-900">{stats.paid}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 lg:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <UserCheck size={14} className="text-emerald-600" />
              </div>
            </div>
            <p className="text-[10px] lg:text-xs text-emerald-600 font-medium">Checked In</p>
            <p className="text-lg lg:text-2xl font-bold text-emerald-900">{stats.checked_in}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-3 lg:p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 lg:w-8 lg:h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Grid3X3 size={14} className="text-purple-600" />
              </div>
            </div>
            <p className="text-[10px] lg:text-xs text-purple-600 font-medium">Pairings</p>
            <p className="text-lg lg:text-2xl font-bold text-purple-900">{groups.length}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.mobileLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & filters */}
      {activeTab !== 'groups' && (
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or company..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {activeTab === 'registrations' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="waitlist">Waitlist</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
        </div>
      )}

      {/* Tab content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {activeTab === 'registrations' && (
          <RegistrationsTab golfers={filteredGolfers} />
        )}
        {activeTab === 'checkin' && (
          <CheckInTab golfers={confirmedGolfers} />
        )}
        {activeTab === 'payments' && (
          <PaymentsTab
            paid={paidGolfers}
            unpaid={unpaidGolfers}
            stats={paymentStats}
            report={paymentReport}
            timingFilter={paymentTimingFilter}
            channelFilter={paymentChannelFilter}
            onTimingChange={setPaymentTimingFilter}
            onChannelChange={setPaymentChannelFilter}
          />
        )}
        {activeTab === 'groups' && (
          <GroupsTab
            groups={groupsByStart}
            ascending={sortAscending}
            onToggleSort={() => setSortAscending((p) => !p)}
          />
        )}
        {activeTab === 'contacts' && (
          <ContactsTab golfers={confirmedGolfers} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sub-components for each tab
// ============================================================

function RegistrationsTab({ golfers }: { golfers: Golfer[] }) {
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
        {golfers.length} registrations
      </div>
      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-gray-100">
        {golfers.map((g) => (
          <div key={g.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <span className="font-medium text-gray-900 text-sm">
                  {g.name}
                  {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
                </span>
                {g.sponsor_display_name && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium whitespace-nowrap">{g.sponsor_display_name}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{startingPositionText(g)}</span>
            </div>
            <div className="text-xs text-gray-500">{g.email}</div>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={g.registration_status} />
              <PaymentBadge status={g.payment_status} />
            </div>
          </div>
        ))}
        {golfers.length === 0 && <EmptyState />}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Company / Sponsor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Starting Position</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {golfers.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {g.name}
                  {g.partner_name && (
                    <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{g.email}</td>
                <td className="px-4 py-2.5 text-gray-500">
                  {g.company || '-'}
                  {g.sponsor_display_name && (
                    <span className="block text-[10px] text-blue-600 font-medium mt-0.5">Sponsored: {g.sponsor_display_name}</span>
                  )}
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={g.registration_status} /></td>
                <td className="px-4 py-2.5"><PaymentBadge status={g.payment_status} /></td>
                <td className="px-4 py-2.5 text-gray-500">{startingPositionText(g)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {golfers.length === 0 && <EmptyState />}
      </div>
    </>
  );
}

function CheckInTab({ golfers }: { golfers: Golfer[] }) {
  const checkedIn = golfers.filter((g) => g.checked_in).length;

  return (
    <>
      <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
        {golfers.length} confirmed &middot; {checkedIn} checked in
      </div>
      {/* Mobile */}
      <div className="sm:hidden divide-y divide-gray-100">
        {golfers.map((g) => (
          <div
            key={g.id}
            className={`px-4 py-3 flex items-center justify-between ${g.checked_in ? 'bg-green-50/50' : ''}`}
          >
            <div>
              <div className="font-medium text-sm text-gray-900">
                {g.name}
                {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
              </div>
              <div className="text-xs text-gray-400">{startingPositionText(g)}</div>
            </div>
            <div className="flex items-center gap-2">
              {g.payment_status === 'paid' && (
                <DollarSign size={14} className="text-green-500" />
              )}
              {g.checked_in && (
                <UserCheck size={14} className="text-green-600" />
              )}
            </div>
          </div>
        ))}
        {golfers.length === 0 && <EmptyState />}
      </div>
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Starting Position</th>
              <th className="px-4 py-3 font-medium text-center">Paid</th>
              <th className="px-4 py-3 font-medium text-center">Checked In</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {golfers.map((g) => (
              <tr key={g.id} className={`hover:bg-gray-50/50 ${g.checked_in ? 'bg-green-50/40' : ''}`}>
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {g.name}
                  {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{g.company || '-'}</td>
                <td className="px-4 py-2.5 text-gray-500">{startingPositionText(g)}</td>
                <td className="px-4 py-2.5 text-center">
                  {g.payment_status === 'paid' && <DollarSign size={14} className="inline text-green-500" />}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {g.checked_in && <UserCheck size={14} className="inline text-green-600" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {golfers.length === 0 && <EmptyState />}
      </div>
    </>
  );
}

function registrationExportRow(row: RegistrationPaymentReportRow) {
  return {
    Type: 'Registration',
    Team: row.name,
    Partner: row.partner_name || '',
    Email: row.email,
    Phone: row.phone || '',
    Company: row.company || '',
    'Registration Status': row.registration_status,
    'Payment Status': row.payment_status,
    'Payment Type': row.payment_type,
    'Payment Method': row.payment_method_label || row.payment_method || '',
    Amount: formatCents(row.amount_cents),
    'Paid At': formatReportDate(row.paid_at || row.verified_at),
    'Verified By': row.verified_by_name || '',
    'Receipt / Reference': row.receipt_number || '',
    Source: row.source || '',
    Notes: row.payment_notes || '',
  };
}

function sponsorExportRow(row: SponsoredRegistrationReportRow) {
  return {
    Type: 'Sponsored Registration',
    Team: row.name,
    Partner: row.partner_name || '',
    Sponsor: row.sponsor_name || '',
    'Registration Status': row.registration_status,
    'Financially Cleared': row.operationally_cleared ? 'Yes' : 'No',
    Source: row.source || '',
    Notes: row.notes || '',
  };
}

function raffleExportRow(row: RaffleSaleReportRow) {
  return {
    Type: row.complimentary ? (row.included_with_registration ? 'Included Raffle Ticket' : 'Complimentary Raffle Ticket') : 'Raffle Sale',
    'Ticket Number': row.ticket_number,
    Buyer: row.purchaser_name,
    Email: row.purchaser_email || '',
    Phone: row.purchaser_phone || '',
    'Linked Registration': row.golfer_name || '',
    'Payment Status': row.payment_status,
    'Payment Method': row.payment_method_label || row.payment_method || '',
    Amount: formatCents(row.amount_cents),
    'Purchased At': formatReportDate(row.purchased_at || row.created_at),
    'Sold By': row.sold_by_name || '',
    Winner: row.is_winner ? 'Yes' : 'No',
    Prize: row.prize_won || '',
    'Receipt / Reference': row.receipt_number || '',
    Notes: row.payment_notes || row.void_reason || '',
  };
}

function ledgerExportRow(row: CombinedLedgerReportRow) {
  return {
    Type: row.type === 'registration_refund' ? 'Registration Refund' : row.type === 'registration' ? 'Registration' : 'Raffle',
    Name: row.name,
    Detail: row.detail,
    Status: row.payment_status,
    Method: row.payment_method || '',
    Amount: formatCents(row.amount_cents),
    Date: formatReportDate(row.paid_at),
    Reference: row.reference || '',
    Notes: row.notes || '',
  };
}

interface PaymentsTabProps {
  paid: Golfer[];
  unpaid: Golfer[];
  report: PaymentReport | null;
  stats: {
    totalPaid: number;
    totalAmount: number;
    prePaid: number;
    prePaidAmount: number;
    dayOf: number;
    dayOfAmount: number;
    unpaid: number;
  };
  timingFilter: string;
  channelFilter: string;
  onTimingChange: (v: string) => void;
  onChannelChange: (v: string) => void;
}

function PaymentsTab({ paid, unpaid, report, stats, timingFilter, channelFilter, onTimingChange, onChannelChange }: PaymentsTabProps) {
  const hasFilter = timingFilter !== 'all' || channelFilter !== 'all';
  const paidRaffleSales = report?.raffle_sales.filter((row) => row.payment_status === 'paid' && row.amount_cents > 0) || [];
  const includedRaffleTickets = report?.raffle_sales.filter((row) => row.payment_status !== 'voided' && row.complimentary) || [];
  const sponsoredRegistrations = report?.sponsored_registrations.filter((row) => row.registration_status !== 'cancelled') || [];
  const clearedSponsoredRegistrations = sponsoredRegistrations.filter((row) => row.operationally_cleared);

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-4 border-b border-gray-100">
        <MiniCard label="Registration Revenue" value={report ? formatCents(report.summary.registration_revenue_cents) : formatCents(Math.round(stats.totalAmount * 100))} sub={`${report?.summary.registration_paid_count ?? stats.totalPaid} paid`} color="green" />
        <MiniCard label="Raffle Revenue" value={report ? formatCents(report.summary.raffle_revenue_cents) : 'Loading'} sub={report ? `${report.summary.raffle_purchased_ticket_count} paid tickets` : 'payment report'} color="blue" />
        <MiniCard label="Total Collected" value={report ? formatCents(report.summary.total_revenue_cents) : formatCents(Math.round(stats.totalAmount * 100))} sub="registrations + raffle" color="amber" />
        <MiniCard label="Outstanding" value={`${report?.summary.registration_pending_count ?? stats.unpaid}`} sub="pending registrations" color="red" />
      </div>

      {report && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-4 border-b border-gray-100 bg-gray-50/60">
          <MiniCard label="Sponsored Cleared" value={`${clearedSponsoredRegistrations.length}`} sub={`${sponsoredRegistrations.length} sponsored rows`} color="blue" />
          <MiniCard label="Included Tickets" value={`${report.summary.raffle_complimentary_ticket_count}`} sub="no added revenue" color="green" />
          <MiniCard label="Voided Tickets" value={`${report.summary.raffle_voided_ticket_count}`} sub="excluded" color="red" />
          <MiniCard label="Winners" value={`${report.summary.raffle_winner_count}`} sub="drawn tickets" color="amber" />
        </div>
      )}

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <select
          value={timingFilter}
          onChange={(e) => onTimingChange(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Timing</option>
          <option value="pre_paid">Pre-Paid</option>
          <option value="day_of">Day-Of</option>
        </select>
        <select
          value={channelFilter}
          onChange={(e) => onChannelChange(e.target.value)}
          className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">All Methods</option>
          <option value="stripe_online">Stripe</option>
          <option value="credit_venue">Credit (Venue)</option>
          <option value="cash">Cash</option>
          <option value="check">Check</option>
        </select>
        {hasFilter && (
          <button
            onClick={() => { onTimingChange('all'); onChannelChange('all'); }}
            className="text-xs text-brand-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Paid list */}
      <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
        Registration Payments ({paid.length})
      </div>
      {/* Mobile */}
      <div className="sm:hidden divide-y divide-gray-100">
        {paid.map((g) => (
          <div key={g.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-gray-900">
                {g.name}
                {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
              </span>
              <span className="text-xs font-medium text-green-700">
                {g.payment_amount_cents ? `$${(g.payment_amount_cents / 100).toFixed(2)}` : ''}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {g.payment_timing === 'pre_paid' ? 'Pre-Paid' : g.payment_timing === 'day_of' ? 'Day-Of' : ''}{' '}
              &middot; {formatChannel(g.payment_channel || g.payment_type)}
            </div>
          </div>
        ))}
        {paid.length === 0 && <EmptyState message="No paid registrations match filters" />}
      </div>
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2.5 font-medium">Team</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Timing</th>
              <th className="px-4 py-2.5 font-medium">Method</th>
              <th className="px-4 py-2.5 font-medium">Paid At</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paid.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {g.name}
                  {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{g.company || '-'}</td>
                <td className="px-4 py-2.5 text-gray-500">
                  {g.payment_timing === 'pre_paid' ? 'Pre-Paid' : g.payment_timing === 'day_of' ? 'Day-Of' : '-'}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{formatChannel(g.payment_channel || g.payment_type)}</td>
                <td className="px-4 py-2.5 text-gray-500">
                  {g.paid_at ? formatDate(g.paid_at) : '-'}
                </td>
                <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                  {g.payment_amount_cents ? `$${(g.payment_amount_cents / 100).toFixed(2)}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paid.length === 0 && <EmptyState message="No paid registrations match filters" />}
      </div>

      {/* Unpaid list */}
      <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-t border-gray-100">
        Unpaid ({unpaid.length})
      </div>
      <div className="sm:hidden divide-y divide-gray-100">
        {unpaid.map((g) => (
          <div key={g.id} className="px-4 py-3">
            <span className="font-medium text-sm text-gray-900">
              {g.name}
              {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
            </span>
            <div className="text-xs text-gray-400">{g.email} {g.phone ? `· ${g.phone}` : ''}</div>
          </div>
        ))}
        {unpaid.length === 0 && <EmptyState message="All confirmed registrations are paid" />}
      </div>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2.5 font-medium">Team</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {unpaid.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {g.name}
                  {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{g.email}</td>
                <td className="px-4 py-2.5 text-gray-500">{g.phone || '-'}</td>
                <td className="px-4 py-2.5 text-gray-500">{g.company || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {unpaid.length === 0 && <EmptyState message="All confirmed registrations are paid" />}
      </div>

      {report && (
        <>
          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-t border-gray-100">
            Sponsored Registrations ({sponsoredRegistrations.length} shown, {clearedSponsoredRegistrations.length} cleared)
          </div>
          <SponsoredRegistrationsTable rows={sponsoredRegistrations} />

          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-t border-gray-100">
            Raffle Sales ({paidRaffleSales.length})
          </div>
          <ReportRaffleTable rows={paidRaffleSales} emptyMessage="No paid raffle sales recorded" />

          <div className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-t border-gray-100">
            Included / Complimentary Raffle Tickets ({includedRaffleTickets.length})
          </div>
          <ReportRaffleTable rows={includedRaffleTickets} emptyMessage="No included raffle tickets recorded" />
        </>
      )}
    </div>
  );
}

function SponsoredRegistrationsTable({ rows }: { rows: SponsoredRegistrationReportRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2.5 font-medium">Team</th>
            <th className="px-4 py-2.5 font-medium">Sponsor</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-2.5 font-medium text-gray-900">
                {row.name}
                {row.partner_name && <span className="text-gray-400 font-normal"> &amp; {row.partner_name}</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-500">{row.sponsor_name || '-'}</td>
              <td className="px-4 py-2.5 text-gray-500">{row.operationally_cleared ? 'Financially cleared' : row.registration_status}</td>
              <td className="px-4 py-2.5 text-gray-500">{row.source || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState message="No sponsored registrations recorded" />}
    </div>
  );
}

function ReportRaffleTable({ rows, emptyMessage }: { rows: RaffleSaleReportRow[]; emptyMessage: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2.5 font-medium">Ticket</th>
            <th className="px-4 py-2.5 font-medium">Buyer</th>
            <th className="px-4 py-2.5 font-medium">Contact</th>
            <th className="px-4 py-2.5 font-medium">Method</th>
            <th className="px-4 py-2.5 font-medium">Sold By</th>
            <th className="px-4 py-2.5 font-medium text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-2.5 font-mono text-xs font-semibold text-gray-900">{row.ticket_number}</td>
              <td className="px-4 py-2.5 font-medium text-gray-900">
                {row.purchaser_name}
                {row.golfer_name && <span className="block text-[11px] font-normal text-gray-400">Registration: {row.golfer_name}</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-500">
                {row.purchaser_email || '-'}
                {row.purchaser_phone && <span className="block text-[11px] text-gray-400">{row.purchaser_phone}</span>}
              </td>
              <td className="px-4 py-2.5 text-gray-500">{row.payment_method_label || row.payment_method || (row.complimentary ? 'Included' : '-')}</td>
              <td className="px-4 py-2.5 text-gray-500">{row.sold_by_name || (row.included_with_registration ? 'System' : '-')}</td>
              <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCents(row.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <EmptyState message={emptyMessage} />}
    </div>
  );
}

function GroupsTab({
  groups,
  ascending,
  onToggleSort,
}: {
  groups: Group[];
  ascending: boolean;
  onToggleSort: () => void;
}) {
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm text-gray-500">{groups.length} pairings</span>
        <button
          onClick={onToggleSort}
          className="text-xs text-brand-600 hover:underline font-medium"
        >
          {ascending ? '↑ earliest start' : '↓ latest start'}
        </button>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((group) => {
          const players = group.golfers || [];
          const isFull = players.length >= (group.max_golfers || 2);

          return (
            <div
              key={group.id}
              className={`border rounded-xl p-3 ${
                isFull ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-gray-900">
                  {group.hole_position_label && group.hole_position_label !== 'Unassigned'
                    ? group.hole_position_label
                    : `Group ${group.group_number}`}
                </span>
                <span className={`text-xs font-medium ${isFull ? 'text-green-600' : 'text-gray-400'}`}>
                  {players.length} team{players.length !== 1 ? 's' : ''}
                </span>
              </div>
              {group.starting_hole_description && (
                <p className="mb-2 text-xs text-gray-500">{group.starting_hole_description}</p>
              )}
              <div className="space-y-2">
                {players.map((p) => (
                  <div key={p.id} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      {p.checked_in ? (
                        <UserCheck size={12} className="text-green-500 shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-full bg-brand-100 text-brand-700 text-[9px] font-bold flex items-center justify-center shrink-0">1</span>
                      )}
                      <span className={p.checked_in ? 'text-green-700 font-medium' : 'text-gray-800 font-medium'}>{p.name}</span>
                    </div>
                    {p.partner_name && (
                      <div className="flex items-center gap-2 text-sm mt-0.5 pl-5">
                        <span className="w-3 h-3 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold flex items-center justify-center shrink-0">2</span>
                        <span className="text-gray-600">{p.partner_name}</span>
                      </div>
                    )}
                    {(p.team_category || p.sponsor_display_name || p.sponsor_name) && (
                      <div className="mt-1 pl-5 text-[11px] text-gray-500">
                        {p.team_category}
                        {p.team_category && (p.sponsor_display_name || p.sponsor_name) ? ' · ' : ''}
                        {(p.sponsor_display_name || p.sponsor_name) && (
                          <span className="text-blue-600">{p.sponsor_display_name || p.sponsor_name}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {players.length === 0 && (
                  <div className="text-xs text-gray-300 italic text-center py-2">No teams assigned</div>
                )}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && (
          <div className="col-span-full text-center py-8 text-sm text-gray-400">
            No pairings created yet
          </div>
        )}
      </div>
    </>
  );
}

function ContactsTab({ golfers }: { golfers: Golfer[] }) {
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
        {golfers.length} confirmed registrants
      </div>
      {/* Mobile */}
      <div className="sm:hidden divide-y divide-gray-100">
        {golfers.map((g) => (
          <div key={g.id} className="px-4 py-3">
            <div className="font-medium text-sm text-gray-900">
              {g.name}
              {g.partner_name && <span className="text-gray-400 font-normal"> &amp; {g.partner_name}</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
              <a href={`mailto:${g.email}`} className="text-brand-600">{g.email}</a>
              {g.phone && <a href={`tel:${g.phone}`} className="text-brand-600">{g.phone}</a>}
            </div>
            {g.partner_email && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs">
                <a href={`mailto:${g.partner_email}`} className="text-brand-600">{g.partner_email}</a>
                {g.partner_phone && <a href={`tel:${g.partner_phone}`} className="text-brand-600">{g.partner_phone}</a>}
              </div>
            )}
            {(g.company || g.sponsor_display_name) && (
              <div className="text-xs text-gray-400 mt-0.5">
                {g.company}{g.company && g.sponsor_display_name ? ' · ' : ''}{g.sponsor_display_name && <span className="text-blue-500">Sponsor: {g.sponsor_display_name}</span>}
              </div>
            )}
          </div>
        ))}
        {golfers.length === 0 && <EmptyState />}
      </div>
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Player 1</th>
              <th className="px-4 py-3 font-medium">Player 2</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Company / Sponsor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {golfers.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{g.name}</td>
                <td className="px-4 py-2.5 text-gray-600">{g.partner_name || '-'}</td>
                <td className="px-4 py-2.5">
                  <div><a href={`mailto:${g.email}`} className="text-brand-600 hover:underline text-xs">{g.email}</a></div>
                  {g.partner_email && <div><a href={`mailto:${g.partner_email}`} className="text-brand-600 hover:underline text-xs">{g.partner_email}</a></div>}
                </td>
                <td className="px-4 py-2.5">
                  <div>{g.phone ? <a href={`tel:${g.phone}`} className="text-brand-600 hover:underline text-xs">{g.phone}</a> : '-'}</div>
                  {g.partner_phone && <div><a href={`tel:${g.partner_phone}`} className="text-brand-600 hover:underline text-xs">{g.partner_phone}</a></div>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">
                  {g.company || '-'}
                  {g.sponsor_display_name && (
                    <span className="block text-[10px] text-blue-600 font-medium mt-0.5">Sponsored: {g.sponsor_display_name}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {golfers.length === 0 && <EmptyState />}
      </div>
    </>
  );
}

// ============================================================
// Shared UI helpers
// ============================================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    waitlist: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  if (status === 'paid') {
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">paid</span>;
  }
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">unpaid</span>;
}

function MiniCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl p-3 ${colors[color] || 'bg-gray-50 text-gray-700'}`}>
      <p className="text-[10px] font-medium opacity-75">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs font-medium opacity-60">{sub}</p>}
    </div>
  );
}

function EmptyState({ message = 'No data found' }: { message?: string }) {
  return (
    <div className="text-center py-10 text-sm text-gray-400">
      {message}
    </div>
  );
}

function formatChannel(channel: string | null): string {
  if (!channel) return '-';
  const map: Record<string, string> = {
    stripe_online: 'Stripe',
    stripe: 'Stripe',
    credit_venue: 'Credit',
    cash: 'Cash',
    check: 'Check',
    swipe_simple: 'SwipeSimple',
    pay_on_day: 'Pay on Day',
  };
  return map[channel] || channel;
}
