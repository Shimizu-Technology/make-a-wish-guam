import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOrganization } from '../components/OrganizationProvider';
import { 
  Gift, 
  Plus,
  Trash2,
  Edit,
  Trophy,
  Ticket,
  Play,
  RotateCcw,
  CheckCircle,
  ArrowLeft,
  RefreshCw,
  Loader2,
  DollarSign,
  Search,
  X,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Ban,
  Send,
  Clock,
  User,
  ImageOff,
  Upload,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { ActivityLog } from '../services/api';
import { adminEventPath } from '../utils/adminRoutes';
import { formatDate, formatDateTime } from '../utils/dates';

interface Prize {
  id: number;
  name: string;
  description: string | null;
  value_cents: number;
  value_dollars: number;
  tier: string;
  tier_display: string;
  image_url: string | null;
  sponsor_name: string | null;
  position: number;
  won: boolean;
  claimed: boolean;
  winner?: {
    name: string;
    won_at: string;
    ticket_number: string;
  };
}

interface RaffleTicket {
  id: number;
  ticket_number: string;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string | null;
  payment_status: string;
  is_winner: boolean;
  purchased_at: string | null;
  prize_won?: string;
  price_cents?: number;
  voided_at?: string | null;
  void_reason?: string | null;
  sold_by?: string | null;
  created_at?: string | null;
}

interface Stats {
  total: number;
  paid: number;
  pending: number;
  winners: number;
  complimentary: number;
  purchased: number;
  additional_revenue_cents: number;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface RaffleBundleDef {
  quantity: number;
  price_cents: number;
  label: string;
}

interface Tournament {
  id: string;
  name: string;
  raffle_enabled: boolean;
  raffle_ticket_price_cents: number;
  raffle_include_with_registration: boolean;
  raffle_bundles: RaffleBundleDef[];
}

const TIERS = ['grand', 'platinum', 'gold', 'silver', 'standard'];
const PRIZE_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/avif';
const PRIZE_IMAGE_TYPES = new Set(PRIZE_IMAGE_ACCEPT.split(','));
const MAX_PRIZE_IMAGE_SIZE = 5 * 1024 * 1024;
const PRIZES_PER_PAGE = 10;
const TIER_RANK = TIERS.reduce<Record<string, number>>((acc, tier, index) => {
  acc[tier] = index;
  return acc;
}, {});

type PrizeStatusFilter = '' | 'available' | 'won' | 'claimed';
type PrizeSort = 'position' | 'tier' | 'name' | 'value_desc' | 'value_asc';

const DEFAULT_BUNDLES: RaffleBundleDef[] = [
  { quantity: 4,  price_cents: 2000,  label: '$20 for 4 tickets' },
  { quantity: 12, price_cents: 5000,  label: '$50 for 12 tickets' },
  { quantity: 25, price_cents: 10000, label: '$100 for 25 tickets' },
];

interface SellTicketsTabProps {
  tournament: Tournament;
  sellBuyerName: string;
  onBuyerNameChange: (v: string) => void;
  sellBuyerEmail: string;
  onBuyerEmailChange: (v: string) => void;
  sellBuyerPhone: string;
  onBuyerPhoneChange: (v: string) => void;
  sellLoading: boolean;
  lastSale: { quantity: number; total: string; buyer: string; ticketNumbers?: string[] } | null;
  onSellBundle: (bundle: RaffleBundleDef) => void;
  onSellCustom: (qty: number, priceCents: number) => void;
  stats: Stats | null;
}

function SellTicketsTab({
  tournament,
  sellBuyerName,
  onBuyerNameChange,
  sellBuyerEmail,
  onBuyerEmailChange,
  sellBuyerPhone,
  onBuyerPhoneChange,
  sellLoading,
  lastSale,
  onSellBundle,
  onSellCustom,
  stats,
}: SellTicketsTabProps) {
  const [customQty, setCustomQty] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const bundles = tournament.raffle_bundles?.length ? tournament.raffle_bundles : DEFAULT_BUNDLES;
  const phoneValue = sellBuyerPhone.trim().replace(/^\+1671$/, '');
  const hasContact = sellBuyerEmail.trim() !== '' || phoneValue !== '';

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-brand-600">{stats.paid}</p>
            <p className="text-xs text-gray-500 mt-1">Total tickets sold</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              ${((stats.additional_revenue_cents || 0) / 100).toFixed(0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Ticket revenue</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.purchased || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Purchased tickets</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.complimentary || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Complimentary</p>
          </div>
        </div>
      )}

      {/* Buyer info */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Buyer name</label>
          <input
            type="text"
            value={sellBuyerName}
            onChange={(e) => onBuyerNameChange(e.target.value)}
            placeholder="Walk-up buyer"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email {!sellBuyerPhone.trim() && <span className="text-red-500">*</span>}
            </label>
            <input
              type="email"
              value={sellBuyerEmail}
              onChange={(e) => onBuyerEmailChange(e.target.value)}
              placeholder="buyer@email.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone {!sellBuyerEmail.trim() && <span className="text-red-500">*</span>}
            </label>
            <input
              type="tel"
              value={sellBuyerPhone}
              onChange={(e) => onBuyerPhoneChange(e.target.value)}
              placeholder="+1671..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          At least one is required — ticket numbers and winner notifications are sent via email and/or text.
        </p>
      </div>

      {/* Quick-tap bundles */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick sell</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {bundles.map((bundle, idx) => (
            <button
              key={idx}
              onClick={() => onSellBundle(bundle)}
              disabled={sellLoading || !hasContact}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-brand-500 hover:bg-brand-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-3xl font-bold text-brand-600">{bundle.quantity}</span>
              <span className="text-sm text-gray-600">tickets</span>
              <span className="text-lg font-bold text-gray-900">
                ${(bundle.price_cents / 100).toFixed(0)}
              </span>
              {sellLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Custom sale</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={customQty}
              onChange={(e) => setCustomQty(e.target.value)}
              placeholder="10"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Total price ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={customPrice}
              onChange={(e) => setCustomPrice(e.target.value)}
              placeholder="50.00"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                const qty = parseInt(customQty) || 0;
                const cents = Math.round(parseFloat(customPrice || '0') * 100);
                if (qty > 0 && cents > 0) {
                  onSellCustom(qty, cents);
                  setCustomQty('');
                  setCustomPrice('');
                }
              }}
              disabled={sellLoading || !customQty || !customPrice || !hasContact}
              className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium text-sm hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {sellLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sell'}
            </button>
          </div>
        </div>
      </div>

      {/* Last sale confirmation */}
      {lastSale && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Sold {lastSale.quantity} tickets for {lastSale.total}
              </p>
              <p className="text-xs text-green-600">Buyer: {lastSale.buyer}</p>
            </div>
          </div>
          {lastSale.ticketNumbers && lastSale.ticketNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {lastSale.ticketNumbers.map((num, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 font-mono text-xs rounded-md">
                  #{num}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const RaffleManagementPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const { getToken } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [ticketSearchInput, setTicketSearchInput] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'' | 'purchased' | 'complimentary' | 'winners' | 'voided'>('');
  const [ticketPage, setTicketPage] = useState(1);
  const [prizeSearch, setPrizeSearch] = useState('');
  const [prizeTierFilter, setPrizeTierFilter] = useState('');
  const [prizeStatusFilter, setPrizeStatusFilter] = useState<PrizeStatusFilter>('');
  const [prizeSort, setPrizeSort] = useState<PrizeSort>('tier');
  const [prizePage, setPrizePage] = useState(1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prizes' | 'tickets' | 'sell' | 'activity'>('prizes');

  // Sell tickets state
  const [sellBuyerName, setSellBuyerName] = useState('');
  const [sellBuyerEmail, setSellBuyerEmail] = useState('');
  const [sellBuyerPhone, setSellBuyerPhone] = useState('+1671');
  const [sellLoading, setSellLoading] = useState(false);
  const [lastSale, setLastSale] = useState<{ quantity: number; total: string; buyer: string; ticketNumbers?: string[] } | null>(null);
  
  // Ticket detail expand
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  // Activity log
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Modals
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  
  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filteredPrizes = useMemo(() => {
    const query = prizeSearch.trim().toLowerCase();
    return prizes
      .filter((prize) => {
        if (query) {
          const haystack = [
            prize.name,
            prize.description || '',
            prize.sponsor_name || '',
            prize.tier_display,
          ].join(' ').toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (prizeTierFilter && prize.tier !== prizeTierFilter) return false;
        if (prizeStatusFilter === 'available' && prize.won) return false;
        if (prizeStatusFilter === 'won' && !prize.won) return false;
        if (prizeStatusFilter === 'claimed' && !prize.claimed) return false;
        return true;
      })
      .sort((a, b) => {
        switch (prizeSort) {
          case 'tier':
            return (TIER_RANK[a.tier] ?? 99) - (TIER_RANK[b.tier] ?? 99) || a.position - b.position;
          case 'name':
            return a.name.localeCompare(b.name);
          case 'value_desc':
            return b.value_dollars - a.value_dollars || a.position - b.position;
          case 'value_asc':
            return a.value_dollars - b.value_dollars || a.position - b.position;
          case 'position':
          default:
            return a.position - b.position || (TIER_RANK[a.tier] ?? 99) - (TIER_RANK[b.tier] ?? 99);
        }
      });
  }, [prizes, prizeSearch, prizeTierFilter, prizeStatusFilter, prizeSort]);

  const prizeTotalPages = Math.max(1, Math.ceil(filteredPrizes.length / PRIZES_PER_PAGE));
  const paginatedPrizes = filteredPrizes.slice((prizePage - 1) * PRIZES_PER_PAGE, prizePage * PRIZES_PER_PAGE);

  useEffect(() => {
    setPrizePage(1);
  }, [prizeSearch, prizeTierFilter, prizeStatusFilter, prizeSort]);

  useEffect(() => {
    if (prizePage > prizeTotalPages) setPrizePage(prizeTotalPages);
  }, [prizePage, prizeTotalPages]);

  const fetchTickets = useCallback(async (tournamentId?: string, search?: string, filter?: string, page?: number) => {
    const tid = tournamentId || tournament?.id;
    if (!tid) return;

    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filter) params.set('type', filter);
      params.set('page', String(page || 1));
      params.set('per_page', '50');

      const ticketsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tid}/raffle/admin/tickets?${params}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const ticketsData = await ticketsRes.json();
      setTickets(ticketsData.tickets || []);
      setStats(ticketsData.stats || null);
      setPagination(ticketsData.pagination || null);
    } catch {
      // stats/tickets fail silently - main data already loaded
    }
  }, [tournament?.id, getToken]);

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      const token = await getToken();
      
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const tournamentData = await tournamentRes.json();
      const t = tournamentData.tournament || tournamentData;
      const tid = t.id;
      setTournament({ ...t, id: tid });

      const prizesRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tid}/raffle/prizes`,
        { cache: 'no-store' }
      );
      const prizesData = await prizesRes.json();
      setPrizes(prizesData.prizes || []);
    } catch {
      toast.error('Failed to load raffle data');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setTicketSearch(ticketSearchInput);
      setTicketPage(1);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [ticketSearchInput]);

  useEffect(() => {
    if (tournament?.id) {
      setExpandedTicketId(null);
      fetchTickets(tournament.id, ticketSearch, ticketFilter, ticketPage);
    }
  }, [tournament?.id, ticketSearch, ticketFilter, ticketPage, fetchTickets]);

  const fetchActivityLogs = useCallback(async () => {
    if (!tournament?.id) return;
    setActivityLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/activity_logs?tournament_id=${tournament.id}&action_type=raffle&per_page=50`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.activity_logs || []);
      }
    } catch {
      // silently fail
    } finally {
      setActivityLoading(false);
    }
  }, [tournament?.id, getToken]);

  const refreshRaffle = useCallback(async () => {
    await fetchData();
    if (tournament?.id) {
      await fetchTickets(tournament.id, ticketSearch, ticketFilter, ticketPage);
    }
    if (activeTab === 'activity') {
      await fetchActivityLogs();
    }
  }, [activeTab, fetchActivityLogs, fetchData, fetchTickets, ticketFilter, ticketPage, ticketSearch, tournament?.id]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityLogs();
    }
  }, [activeTab, fetchActivityLogs]);

  const handleDrawPrize = async (prize: Prize) => {
    if (!confirm(`Draw a winner for "${prize.name}"?`)) return;

    setActionLoading(`draw-${prize.id}`);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament?.id}/raffle/prizes/${prize.id}/draw`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to draw winner');
      }

      const data = await res.json();
      toast.success(data.message);
      void refreshRaffle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to draw');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPrize = async (prize: Prize) => {
    if (!confirm(`Reset "${prize.name}"? This will undo the draw.`)) return;

    setActionLoading(`reset-${prize.id}`);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament?.id}/raffle/prizes/${prize.id}/reset`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error('Failed to reset');
      toast.success('Prize reset');
      void refreshRaffle();
    } catch {
      toast.error('Failed to reset prize');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClaimPrize = async (prize: Prize) => {
    setActionLoading(`claim-${prize.id}`);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament?.id}/raffle/prizes/${prize.id}/claim`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error('Failed to claim');
      toast.success('Prize marked as claimed');
      void refreshRaffle();
    } catch {
      toast.error('Failed to claim prize');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePrize = async (prize: Prize) => {
    if (!confirm(`Delete "${prize.name}"?`)) return;

    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament?.id}/raffle/prizes/${prize.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success('Prize deleted');
      void refreshRaffle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleDrawAll = async () => {
    const remaining = prizes.filter(p => !p.won).length;
    if (!confirm(`Draw winners for all ${remaining} remaining prizes?`)) return;

    setActionLoading('draw-all');
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament?.id}/raffle/draw_all`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to draw');
      }

      const data = await res.json();
      toast.success(data.message);
      void refreshRaffle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to draw');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleRaffle = async () => {
    if (!tournament) return;
    const newValue = !tournament.raffle_enabled;
    setActionLoading('toggle-raffle');
    try {
      const token = await getToken();
      // PATCH /api/v1/tournaments/:id is the correct authenticated endpoint
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tournament: { raffle_enabled: newValue } }),
        }
      );
      if (!res.ok) throw new Error('Failed to update raffle status');
      setTournament((prev) => prev ? { ...prev, raffle_enabled: newValue } : prev);
      toast.success(newValue ? 'Raffle enabled' : 'Raffle disabled');
    } catch {
      toast.error('Failed to update raffle status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncTickets = async () => {
    if (!tournament) return;
    setActionLoading('sync-tickets');
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament.id}/raffle/sync_tickets`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Failed to sync tickets');
      const data = await res.json();
      toast.success(data.message);
      void refreshRaffle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync tickets');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSellBundle = async (bundle: RaffleBundleDef) => {
    if (!tournament) return;
    const phoneForValidation = sellBuyerPhone.trim().replace(/^\+1671$/, '').replace(/^\+1670$/, '');
    if (!sellBuyerEmail.trim() && !phoneForValidation) {
      toast.error('Please enter an email or phone number');
      return;
    }
    const buyerLabel = sellBuyerName.trim() || 'Walk-up buyer';
    if (!confirm(`Sell ${bundle.quantity} tickets for $${(bundle.price_cents / 100).toFixed(0)} to "${buyerLabel}"?`)) return;
    setSellLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament.id}/raffle/sell`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity: bundle.quantity,
            price_cents: bundle.price_cents,
            buyer_name: sellBuyerName.trim() || undefined,
            buyer_email: sellBuyerEmail.trim() || undefined,
            buyer_phone: sellBuyerPhone.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sell tickets');
      }
      const data = await res.json();
      const totalDollars = `$${(bundle.price_cents / 100).toFixed(0)}`;
      const ticketNums = Array.isArray(data.tickets)
        ? data.tickets.map((ticket: { ticket_number: string }) => ticket.ticket_number)
        : [];
      setLastSale({
        quantity: bundle.quantity,
        total: totalDollars,
        buyer: sellBuyerName.trim() || 'Walk-up buyer',
        ticketNumbers: ticketNums,
      });
      setSellBuyerName('');
      setSellBuyerEmail('');
      setSellBuyerPhone('+1671');
      toast.success(`Sold ${bundle.quantity} tickets for ${totalDollars}`);
      void refreshRaffle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sell tickets');
    } finally {
      setSellLoading(false);
    }
  };

  const handleSellCustom = async (quantity: number, priceCents: number) => {
    if (!tournament || quantity <= 0 || priceCents <= 0) return;
    const phoneForValidation = sellBuyerPhone.trim().replace(/^\+1671$/, '').replace(/^\+1670$/, '');
    if (!sellBuyerEmail.trim() && !phoneForValidation) {
      toast.error('Please enter an email or phone number');
      return;
    }
    const buyerLabel = sellBuyerName.trim() || 'Walk-up buyer';
    if (!confirm(`Sell ${quantity} tickets for $${(priceCents / 100).toFixed(2)} to "${buyerLabel}"?`)) return;
    setSellLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament.id}/raffle/sell`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantity,
            price_cents: priceCents,
            buyer_name: sellBuyerName.trim() || undefined,
            buyer_email: sellBuyerEmail.trim() || undefined,
            buyer_phone: sellBuyerPhone.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sell tickets');
      }
      const data = await res.json();
      const totalDollars = `$${(priceCents / 100).toFixed(0)}`;
      const ticketNums = Array.isArray(data.tickets)
        ? data.tickets.map((ticket: { ticket_number: string }) => ticket.ticket_number)
        : [];
      setLastSale({
        quantity,
        total: totalDollars,
        buyer: sellBuyerName.trim() || 'Walk-up buyer',
        ticketNumbers: ticketNums,
      });
      setSellBuyerName('');
      setSellBuyerEmail('');
      setSellBuyerPhone('+1671');
      toast.success(`Sold ${quantity} tickets for ${totalDollars}`);
      void refreshRaffle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sell tickets');
    } finally {
      setSellLoading(false);
    }
  };

  const handleResendNotification = async (prize: Prize) => {
    if (!tournament) return;
    if (!confirm(`Resend winner notification to ${prize.winner?.name}?`)) return;

    setActionLoading(`resend-${prize.id}`);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament.id}/raffle/prizes/${prize.id}/resend_notification`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resend');
      }
      const data = await res.json();
      toast.success(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend notification');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVoidTicket = async (ticket: RaffleTicket) => {
    if (!tournament) return;
    const reason = prompt(`Void ticket ${ticket.ticket_number}? Enter reason (optional):`);
    if (reason === null) return;

    setActionLoading(`void-${ticket.id}`);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament.id}/raffle/tickets/${ticket.id}/void`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason || undefined }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to void ticket');
      }
      const data = await res.json();
      toast.success(data.message);
      fetchTickets(tournament.id, ticketSearch, ticketFilter, ticketPage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to void ticket');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center rounded-3xl bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section 
        className="rounded-[28px] px-4 sm:px-6 py-4 sm:py-5 text-white shadow-sm lg:px-8"
        style={{ backgroundColor: organization?.primary_color || '#7c3aed' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link
                to={adminEventPath(tournamentSlug || '')}
                className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-1 sm:mb-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Tournament
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
                <Gift className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" />
                Raffle Management
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to={`/${tournamentSlug}/raffle`}
                className="px-3 sm:px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 text-sm whitespace-nowrap"
                target="_blank"
              >
                View Public Board
              </Link>
              <button
                onClick={() => {
                  void refreshRaffle();
                }}
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-[#F5A800] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">Prizes</p>
                <p className="text-lg sm:text-xl font-bold">{prizes.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-brand-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">Total Tickets</p>
                <p className="text-lg sm:text-xl font-bold">{stats.total}</p>
                {stats.complimentary > 0 && stats.purchased > 0 && (
                  <p className="text-[10px] text-gray-400">{stats.complimentary} incl. / {stats.purchased} extra</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">Winners</p>
                <p className="text-lg sm:text-xl font-bold">{stats.winners}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-gray-500">Extra Sales</p>
                <p className="text-lg sm:text-xl font-bold truncate">
                  ${((stats.additional_revenue_cents || 0) / 100).toFixed(0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Raffle Enabled Toggle */}
      {tournament && (
        <div className="max-w-6xl mx-auto px-4 pb-2">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">Raffle Active</p>
              <p className="text-sm text-gray-500">
                {tournament.raffle_enabled
                  ? 'Raffle is visible on the public page'
                  : 'Raffle is hidden from the public page'}
              </p>
            </div>
            <button
              onClick={handleToggleRaffle}
              disabled={actionLoading === 'toggle-raffle'}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                tournament.raffle_enabled ? 'bg-green-500' : 'bg-gray-300'
              } disabled:opacity-50`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  tournament.raffle_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="border-b border-gray-200 mb-5 sm:mb-6">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('prizes')}
              className={`pb-3 px-1 border-b-2 font-medium whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'prizes'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Gift className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1.5 sm:mr-2" />
              Prizes ({prizes.length})
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`pb-3 px-1 border-b-2 font-medium whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'sell'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1.5 sm:mr-2" />
              Sell Tickets
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`pb-3 px-1 border-b-2 font-medium whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'tickets'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Ticket className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1.5 sm:mr-2" />
              Tickets ({stats?.paid || 0})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-3 px-1 border-b-2 font-medium whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'activity'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 inline mr-1.5 sm:mr-2" />
              Activity
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 pb-8">
        {activeTab === 'prizes' && (
          <div>
            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 mb-4">
              <button
                onClick={() => { setEditingPrize(null); setShowPrizeModal(true); }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                Add Prize
              </button>
              {prizes.filter(p => !p.won).length > 0 && (
                <button
                  onClick={handleDrawAll}
                  disabled={actionLoading === 'draw-all'}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 text-sm font-medium"
                >
                  {actionLoading === 'draw-all' ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  Draw All Remaining
                </button>
              )}
            </div>

            {/* Search + Filters */}
            <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search prizes, sponsors, descriptions..."
                    value={prizeSearch}
                    onChange={(e) => setPrizeSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {prizeSearch && (
                    <button
                      type="button"
                      onClick={() => setPrizeSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="Clear prize search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <select
                  value={prizeTierFilter}
                  onChange={(e) => setPrizeTierFilter(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All tiers</option>
                  {TIERS.map((tier) => (
                    <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
                  ))}
                </select>
                <select
                  value={prizeStatusFilter}
                  onChange={(e) => setPrizeStatusFilter(e.target.value as PrizeStatusFilter)}
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">All statuses</option>
                  <option value="available">Available</option>
                  <option value="won">Won</option>
                  <option value="claimed">Claimed</option>
                </select>
                <select
                  value={prizeSort}
                  onChange={(e) => setPrizeSort(e.target.value as PrizeSort)}
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="tier">Sort by tier</option>
                  <option value="position">Sort by list order</option>
                  <option value="name">Sort by name</option>
                  <option value="value_desc">Value high to low</option>
                  <option value="value_asc">Value low to high</option>
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>
                  Showing {paginatedPrizes.length ? ((prizePage - 1) * PRIZES_PER_PAGE) + 1 : 0}
                  –{Math.min(prizePage * PRIZES_PER_PAGE, filteredPrizes.length)} of {filteredPrizes.length} prizes
                </span>
                {(prizeSearch || prizeTierFilter || prizeStatusFilter || prizeSort !== 'tier') && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrizeSearch('');
                      setPrizeTierFilter('');
                      setPrizeStatusFilter('');
                      setPrizeSort('tier');
                    }}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {/* Prizes List */}
            <div className="space-y-3">
              {paginatedPrizes.map((prize) => (
                <div
                  key={prize.id}
                  className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                    prize.won ? 'border border-green-200' : ''
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border ${
                        prize.image_url
                          ? 'border-gray-200 bg-white'
                          : prize.tier === 'grand' ? 'border-yellow-100 bg-yellow-100 text-yellow-600' :
                            prize.tier === 'platinum' ? 'border-slate-100 bg-slate-100 text-slate-600' :
                            prize.tier === 'gold' ? 'border-amber-100 bg-amber-100 text-amber-600' :
                            'border-gray-100 bg-gray-100 text-gray-600'
                      }`}>
                        {prize.image_url ? (
                          <img
                            src={prize.image_url}
                            alt={prize.name}
                            className="h-full w-full object-contain p-1"
                            loading="lazy"
                          />
                        ) : (
                          <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900">{prize.name}</h3>
                        <p className="text-sm text-gray-500">
                          {prize.tier_display}
                          {prize.value_dollars > 0 && ` • $${prize.value_dollars.toLocaleString()}`}
                          {prize.sponsor_name && ` • ${prize.sponsor_name}`}
                        </p>
                      </div>
                      {/* Desktop action buttons inline */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        {prize.won ? (
                          <>
                            {!prize.claimed && (
                              <button
                                onClick={() => handleClaimPrize(prize)}
                                disabled={actionLoading === `claim-${prize.id}`}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                title="Mark as claimed"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleResetPrize(prize)}
                              disabled={actionLoading === `reset-${prize.id}`}
                              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"
                              title="Reset (undo draw)"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleDrawPrize(prize)}
                              disabled={actionLoading === `draw-${prize.id}`}
                              className="flex items-center gap-1 px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                            >
                              {actionLoading === `draw-${prize.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                              Draw
                            </button>
                            <button
                              onClick={() => { setEditingPrize(prize); setShowPrizeModal(true); }}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeletePrize(prize)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Mobile action buttons on their own row */}
                    <div className="flex sm:hidden items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      {prize.won ? (
                        <>
                          {!prize.claimed && (
                            <button
                              onClick={() => handleClaimPrize(prize)}
                              disabled={actionLoading === `claim-${prize.id}`}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Claim
                            </button>
                          )}
                          <button
                            onClick={() => handleResetPrize(prize)}
                            disabled={actionLoading === `reset-${prize.id}`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-lg"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDrawPrize(prize)}
                            disabled={actionLoading === `draw-${prize.id}`}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-white bg-yellow-500 rounded-lg"
                          >
                            {actionLoading === `draw-${prize.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            Draw
                          </button>
                          <button
                            onClick={() => { setEditingPrize(prize); setShowPrizeModal(true); }}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePrize(prize)}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-red-600 bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Winner banner */}
                  {prize.won && prize.winner && (
                    <div className="px-4 pb-3 pt-0">
                      <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                        prize.claimed ? 'bg-green-50' : 'bg-amber-50'
                      }`}>
                        <PartyPopper className={`w-4 h-4 shrink-0 ${prize.claimed ? 'text-green-500' : 'text-amber-500'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{prize.winner.name}</p>
                          <p className="text-xs text-gray-500">
                            Ticket #{prize.winner.ticket_number}
                            {prize.claimed && ' — Claimed'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleResendNotification(prize)}
                          disabled={actionLoading === `resend-${prize.id}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 shrink-0"
                          title="Resend winner notification"
                        >
                          {actionLoading === `resend-${prize.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Resend</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredPrizes.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl">
                  <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {prizes.length === 0 ? 'No prizes yet. Add your first prize!' : 'No prizes match your filters.'}
                  </p>
                </div>
              )}
            </div>

            {filteredPrizes.length > PRIZES_PER_PAGE && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-gray-600">
                  Page {prizePage} of {prizeTotalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPrizePage((page) => Math.max(1, page - 1))}
                    disabled={prizePage <= 1}
                    className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous prize page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrizePage((page) => Math.min(prizeTotalPages, page + 1))}
                    disabled={prizePage >= prizeTotalPages}
                    className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next prize page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'sell' && tournament && (
          <SellTicketsTab
            tournament={tournament}
            sellBuyerName={sellBuyerName}
            onBuyerNameChange={setSellBuyerName}
            sellBuyerEmail={sellBuyerEmail}
            onBuyerEmailChange={setSellBuyerEmail}
            sellBuyerPhone={sellBuyerPhone}
            onBuyerPhoneChange={setSellBuyerPhone}
            sellLoading={sellLoading}
            lastSale={lastSale}
            onSellBundle={handleSellBundle}
            onSellCustom={handleSellCustom}
            stats={stats}
          />
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {tournament?.raffle_include_with_registration && (
                <button
                  onClick={handleSyncTickets}
                  disabled={actionLoading === 'sync-tickets'}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {actionLoading === 'sync-tickets' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Sync Registration Tickets
                </button>
              )}
              <button
                onClick={() => setActiveTab('sell')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-5 h-5" />
                Sell Tickets
              </button>
            </div>

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or ticket #..."
                  value={ticketSearchInput}
                  onChange={(e) => setTicketSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {ticketSearchInput && (
                  <button
                    onClick={() => { setTicketSearchInput(''); setTicketSearch(''); setTicketPage(1); setExpandedTicketId(null); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1 overflow-x-auto">
                {([
                  { key: '' as const, label: 'All' },
                  { key: 'purchased' as const, label: 'Purchased' },
                  { key: 'complimentary' as const, label: 'Included' },
                  { key: 'winners' as const, label: 'Winners' },
                  { key: 'voided' as const, label: 'Voided' },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setTicketFilter(f.key); setTicketPage(1); }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      ticketFilter === f.key
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 whitespace-nowrap">Ticket #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Winner</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.map((ticket) => {
                    const isVoided = ticket.payment_status === 'voided';
                    const isComplimentary = !ticket.price_cents || ticket.price_cents === 0;
                    const isExpanded = expandedTicketId === ticket.id;
                    return (
                    <React.Fragment key={ticket.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${isVoided ? 'opacity-60' : ''}`}
                      onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                          <span className={`font-mono text-sm font-semibold whitespace-nowrap ${isVoided ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {ticket.ticket_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`font-medium text-sm ${isVoided ? 'text-gray-400' : 'text-gray-900'}`}>{ticket.purchaser_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        {ticket.purchaser_email && <p className="text-sm text-gray-500">{ticket.purchaser_email}</p>}
                        {ticket.purchaser_phone && <p className="text-sm text-gray-400">{ticket.purchaser_phone}</p>}
                        {!ticket.purchaser_email && !ticket.purchaser_phone && <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isVoided ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-50 text-red-600">
                            <Ban className="w-3 h-3" />
                            Voided
                          </span>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            isComplimentary
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {isComplimentary ? 'Included' : `$${((ticket.price_cents || 0) / 100).toFixed(0)}`}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {ticket.is_winner ? (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Trophy className="w-4 h-4" />
                            {ticket.prize_won || 'Yes'}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {ticket.purchased_at 
                          ? formatDate(ticket.purchased_at)
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {!isVoided && !ticket.is_winner && (
                          <button
                            onClick={() => handleVoidTicket(ticket)}
                            disabled={actionLoading === `void-${ticket.id}`}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Void ticket"
                          >
                            {actionLoading === `void-${ticket.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                            <div className="flex items-start gap-2">
                              <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-gray-500">Created</p>
                                <p className="text-gray-900">
                                  {ticket.created_at
                                    ? formatDateTime(ticket.created_at)
                                    : ticket.purchased_at
                                      ? formatDateTime(ticket.purchased_at)
                                      : 'Unknown'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-gray-500">Sold by</p>
                                <p className="text-gray-900">{ticket.sold_by || (isComplimentary ? 'System (registration)' : 'Unknown')}</p>
                              </div>
                            </div>
                            {/* Mobile-only contact info */}
                            <div className="sm:hidden flex items-start gap-2">
                              <Send className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-gray-500">Contact</p>
                                {ticket.purchaser_email && <p className="text-gray-900">{ticket.purchaser_email}</p>}
                                {ticket.purchaser_phone && <p className="text-gray-600">{ticket.purchaser_phone}</p>}
                                {!ticket.purchaser_email && !ticket.purchaser_phone && <p className="text-gray-400">None</p>}
                              </div>
                            </div>
                            {isVoided && (
                              <div className="flex items-start gap-2">
                                <Ban className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-gray-500">Voided</p>
                                  <p className="text-red-600">
                                    {ticket.voided_at ? formatDateTime(ticket.voided_at) : 'Unknown'}
                                    {ticket.void_reason && ` — ${ticket.void_reason}`}
                                  </p>
                                </div>
                              </div>
                            )}
                            {ticket.is_winner && ticket.prize_won && (
                              <div className="flex items-start gap-2">
                                <Trophy className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-gray-500">Prize won</p>
                                  <p className="text-yellow-700">{ticket.prize_won}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                    );
                  })}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        {ticketSearchInput || ticketFilter
                          ? 'No tickets match your search or filter.'
                          : 'No tickets yet. Use the "Sell Tickets" tab to start selling raffle tickets.'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.total_pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                  <p className="text-sm text-gray-600">
                    Showing {((pagination.page - 1) * pagination.per_page) + 1}–{Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTicketPage(p => Math.max(1, p - 1))}
                      disabled={pagination.page <= 1}
                      className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-sm font-medium text-gray-700">
                      {pagination.page} / {pagination.total_pages}
                    </span>
                    <button
                      onClick={() => setTicketPage(p => Math.min(pagination.total_pages, p + 1))}
                      disabled={pagination.page >= pagination.total_pages}
                      className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Raffle Activity Log</h2>
              <button
                onClick={fetchActivityLogs}
                disabled={activityLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${activityLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              {activityLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p>No raffle activity recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="px-4 py-3 sm:px-5 sm:py-4 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          log.action?.includes('sold') ? 'bg-green-100 text-green-600' :
                          log.action?.includes('paid') ? 'bg-green-100 text-green-600' :
                          log.action?.includes('drawn') || log.action?.includes('draw') ? 'bg-yellow-100 text-yellow-600' :
                          log.action?.includes('void') || log.action?.includes('deleted') ? 'bg-red-100 text-red-600' :
                          log.action?.includes('created') ? 'bg-blue-100 text-blue-600' :
                          log.action?.includes('updated') || log.action?.includes('settings') ? 'bg-purple-100 text-purple-600' :
                          log.action?.includes('resend') ? 'bg-blue-100 text-blue-600' :
                          log.action?.includes('claimed') ? 'bg-emerald-100 text-emerald-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {log.action?.includes('sold') ? <DollarSign className="w-4 h-4" /> :
                           log.action?.includes('paid') ? <DollarSign className="w-4 h-4" /> :
                           log.action?.includes('drawn') || log.action?.includes('draw') ? <Play className="w-3.5 h-3.5" /> :
                           log.action?.includes('void') ? <Ban className="w-4 h-4" /> :
                           log.action?.includes('deleted') ? <Trash2 className="w-4 h-4" /> :
                           log.action?.includes('created') ? <Gift className="w-4 h-4" /> :
                           log.action?.includes('settings') ? <Settings className="w-4 h-4" /> :
                           log.action?.includes('updated') ? <Edit className="w-4 h-4" /> :
                           log.action?.includes('resend') ? <Send className="w-4 h-4" /> :
                           log.action?.includes('claimed') ? <CheckCircle className="w-4 h-4" /> :
                           <Clock className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900">{log.details || log.action?.replace(/_/g, ' ')}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="text-xs text-gray-500">
                              <User className="w-3 h-3 inline mr-1" />
                              {log.admin_name || 'System'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Prize Modal - simplified for now */}
      {showPrizeModal && (
        <PrizeModal
          prize={editingPrize}
          tournamentId={tournament?.id || ''}
          onClose={() => { setShowPrizeModal(false); setEditingPrize(null); }}
          onSuccess={(savedPrize) => {
            setShowPrizeModal(false);
            setEditingPrize(null);
            if (savedPrize) {
              setPrizes((prev) => {
                const exists = prev.some((item) => item.id === savedPrize.id);
                return exists
                  ? prev.map((item) => item.id === savedPrize.id ? savedPrize : item)
                  : [savedPrize, ...prev];
              });
            }
            void refreshRaffle();
          }}
        />
      )}

      
    </div>
  );
};

// Prize Modal Component
const PrizeModal: React.FC<{
  prize: Prize | null;
  tournamentId: string;
  onClose: () => void;
  onSuccess: (savedPrize?: Prize) => void;
}> = ({ prize, tournamentId, onClose, onSuccess }) => {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(prize?.image_url || null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [imageDragOver, setImageDragOver] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [valueDollars, setValueDollars] = useState(prize ? (prize.value_cents / 100).toString() : '0');
  const [form, setForm] = useState({
    name: prize?.name || '',
    description: prize?.description || '',
    tier: prize?.tier || 'standard',
    image_url: prize?.image_url || '',
    sponsor_name: prize?.sponsor_name || '',
    position: prize?.position || 0,
  });

  useEffect(() => {
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageObjectUrl]);

  const validateImageFile = (file: File) => {
    if (!PRIZE_IMAGE_TYPES.has(file.type)) {
      toast.error('Please use a JPG, PNG, WebP, GIF, or AVIF image');
      return false;
    }

    if (file.size > MAX_PRIZE_IMAGE_SIZE) {
      toast.error('Prize image must be smaller than 5MB');
      return false;
    }

    return true;
  };

  const selectImageFile = (file: File) => {
    if (!validateImageFile(file)) return;

    const previewUrl = URL.createObjectURL(file);

    setImageFile(file);
    setRemoveImage(false);
    setForm({ ...form, image_url: '' });
    setImageObjectUrl(previewUrl);
    setImagePreview(previewUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectImageFile(file);
    e.target.value = '';
  };

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImageDragOver(true);
  };

  const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImageDragOver(false);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setImageDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) selectImageFile(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageObjectUrl(null);
    setRemoveImage(true);
    setForm({ ...form, image_url: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageUrlChange = (url: string) => {
    setForm({ ...form, image_url: url });
    setImageFile(null);
    setImageObjectUrl(null);
    setRemoveImage(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setImagePreview(url || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getToken();
      const url = prize
        ? `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/raffle/prizes/${prize.id}`
        : `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/raffle/prizes`;

      const valueCents = Math.round(parseFloat(valueDollars || '0') * 100);
      let savedPrize: Prize | undefined;

      if (imageFile) {
        // Use FormData for file upload
        const fd = new FormData();
        fd.append('prize[name]', form.name);
        fd.append('prize[description]', form.description);
        fd.append('prize[value_cents]', valueCents.toString());
        fd.append('prize[tier]', form.tier);
        fd.append('prize[image_url]', form.image_url);
        fd.append('prize[sponsor_name]', form.sponsor_name);
        fd.append('prize[position]', form.position.toString());
        fd.append('prize[remove_image]', 'false');
        fd.append('prize[image]', imageFile);

        const res = await fetch(url, {
          method: prize ? 'PATCH' : 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        savedPrize = data.prize;
      } else {
        const res = await fetch(url, {
          method: prize ? 'PATCH' : 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prize: { ...form, value_cents: valueCents, remove_image: removeImage } }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        savedPrize = data.prize;
      }

      toast.success(prize ? 'Prize updated' : 'Prize created');
      onSuccess(savedPrize);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save prize');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{prize ? 'Edit Prize' : 'Add Prize'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Value ($)</label>
              <input
                type="number"
                value={valueDollars}
                onChange={e => setValueDollars(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                min={0}
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tier</label>
              <select
                value={form.tier}
                onChange={e => setForm({ ...form, tier: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              >
                {TIERS.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Sponsor Name</label>
            <input
              type="text"
              value={form.sponsor_name}
              onChange={e => setForm({ ...form, sponsor_name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Image URL</label>
            <input
              type="url"
              value={form.image_url}
              onChange={e => handleImageUrlChange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Prize Image</label>
            <div
              className={`rounded-xl border p-3 transition ${
                imageDragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-gray-50'
              }`}
              onDragOver={handleImageDragOver}
              onDragLeave={handleImageDragLeave}
              onDrop={handleImageDrop}
            >
              {imagePreview ? (
                <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <img
                    src={imagePreview}
                    alt="Prize preview"
                    className="h-44 w-full object-contain"
                  />
                  {imageFile && (
                    <div className="absolute left-3 top-3 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                      New image
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-44 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white text-gray-400">
                  <ImageOff className="h-8 w-8" />
                  <p className="mt-2 text-sm font-medium text-gray-500">No prize image</p>
                  <p className="mt-1 text-xs text-gray-400">Drop an image here</p>
                </div>
              )}

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  {imagePreview ? 'Replace image' : 'Upload image'}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={!imagePreview && !form.image_url && !prize?.image_url}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageOff className="h-4 w-4" />
                  Remove image
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={PRIZE_IMAGE_ACCEPT}
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="mt-2 text-xs text-gray-500">
                JPG, PNG, WebP, GIF, or AVIF. Maximum 5MB.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (prize ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
