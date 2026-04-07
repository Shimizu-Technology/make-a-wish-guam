import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  AlertCircle,
  Users,
  DollarSign,
  Search,
  X,
  PartyPopper,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminEventPath } from '../utils/adminRoutes';

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
  const hasContact = sellBuyerEmail.trim() !== '' || sellBuyerPhone.trim() !== '';

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
  const [ticketFilter, setTicketFilter] = useState<'' | 'purchased' | 'complimentary' | 'winners'>('');
  const [ticketPage, setTicketPage] = useState(1);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prizes' | 'tickets' | 'sell'>('prizes');

  // Sell tickets state
  const [sellBuyerName, setSellBuyerName] = useState('');
  const [sellBuyerEmail, setSellBuyerEmail] = useState('');
  const [sellBuyerPhone, setSellBuyerPhone] = useState('');
  const [sellLoading, setSellLoading] = useState(false);
  const [lastSale, setLastSale] = useState<{ quantity: number; total: string; buyer: string; ticketNumbers?: string[] } | null>(null);
  
  // Modals
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  
  
  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const fetchData = useCallback(async (skipTickets = false) => {
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
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tid}/raffle/prizes`
      );
      const prizesData = await prizesRes.json();
      setPrizes(prizesData.prizes || []);

      if (!skipTickets) {
        await fetchTickets(tid, ticketSearch, ticketFilter, ticketPage);
      }
    } catch (err) {
      toast.error('Failed to load raffle data');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken, fetchTickets, ticketSearch, ticketFilter, ticketPage]);

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
      fetchTickets(tournament.id, ticketSearch, ticketFilter, ticketPage);
    }
  }, [ticketSearch, ticketFilter, ticketPage]);

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
      fetchData();
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
      fetchData();
    } catch (err) {
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
      fetchData();
    } catch (err) {
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
      fetchData();
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
      fetchData();
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
    } catch (err) {
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
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync tickets');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSellBundle = async (bundle: RaffleBundleDef) => {
    if (!tournament) return;
    if (!sellBuyerEmail.trim() && !sellBuyerPhone.trim()) {
      toast.error('Please enter an email or phone number');
      return;
    }
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
      const ticketNums = data.tickets?.map((t: any) => t.ticket_number) || [];
      setLastSale({
        quantity: bundle.quantity,
        total: totalDollars,
        buyer: sellBuyerName.trim() || 'Walk-up buyer',
        ticketNumbers: ticketNums,
      });
      setSellBuyerName('');
      setSellBuyerEmail('');
      setSellBuyerPhone('');
      toast.success(`Sold ${bundle.quantity} tickets for ${totalDollars}`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sell tickets');
    } finally {
      setSellLoading(false);
    }
  };

  const handleSellCustom = async (quantity: number, priceCents: number) => {
    if (!tournament || quantity <= 0 || priceCents <= 0) return;
    if (!sellBuyerEmail.trim() && !sellBuyerPhone.trim()) {
      toast.error('Please enter an email or phone number');
      return;
    }
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
      const ticketNums = data.tickets?.map((t: any) => t.ticket_number) || [];
      setLastSale({
        quantity,
        total: totalDollars,
        buyer: sellBuyerName.trim() || 'Walk-up buyer',
        ticketNumbers: ticketNums,
      });
      setSellBuyerName('');
      setSellBuyerEmail('');
      setSellBuyerPhone('');
      toast.success(`Sold ${quantity} tickets for ${totalDollars}`);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sell tickets');
    } finally {
      setSellLoading(false);
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
                onClick={fetchData}
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

            {/* Prizes List */}
            <div className="space-y-3">
              {prizes.map((prize) => (
                <div
                  key={prize.id}
                  className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                    prize.won ? 'border border-green-200' : ''
                  }`}
                >
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
                        prize.tier === 'grand' ? 'bg-yellow-100 text-yellow-600' :
                        prize.tier === 'platinum' ? 'bg-slate-100 text-slate-600' :
                        prize.tier === 'gold' ? 'bg-amber-100 text-amber-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        <Trophy className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{prize.name}</h3>
                        <p className="text-sm text-gray-500">
                          {prize.tier_display}
                          {prize.value_dollars > 0 && ` • $${prize.value_dollars.toLocaleString()}`}
                          {prize.sponsor_name && ` • ${prize.sponsor_name}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {prizes.length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl">
                  <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No prizes yet. Add your first prize!</p>
                </div>
              )}
            </div>
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
                    onClick={() => { setTicketSearchInput(''); setTicketSearch(''); setTicketPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
                {([
                  { key: '' as const, label: 'All' },
                  { key: 'purchased' as const, label: 'Purchased' },
                  { key: 'complimentary' as const, label: 'Included' },
                  { key: 'winners' as const, label: 'Winners' },
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
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Ticket #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden sm:table-cell">Contact</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden sm:table-cell">Winner</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.map((ticket) => {
                    const isComplimentary = !ticket.price_cents || ticket.price_cents === 0;
                    return (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-gray-800">{ticket.ticket_number}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ticket.purchaser_name}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {ticket.purchaser_email && <p className="text-sm text-gray-500">{ticket.purchaser_email}</p>}
                        {ticket.purchaser_phone && <p className="text-sm text-gray-400">{ticket.purchaser_phone}</p>}
                        {!ticket.purchaser_email && !ticket.purchaser_phone && <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          isComplimentary
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {isComplimentary ? 'Included' : `$${((ticket.price_cents || 0) / 100).toFixed(0)}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {ticket.is_winner ? (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Trophy className="w-4 h-4" />
                            {ticket.prize_won || 'Yes'}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                        {ticket.purchased_at 
                          ? new Date(ticket.purchased_at).toLocaleDateString()
                          : '-'
                        }
                      </td>
                    </tr>
                    );
                  })}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        {ticketSearchInput || ticketFilter
                          ? 'No tickets match your search or filter.'
                          : 'No tickets yet. Click "Sync Registration Tickets" to generate tickets for paid registrants.'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

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
      </main>

      {/* Prize Modal - simplified for now */}
      {showPrizeModal && (
        <PrizeModal
          prize={editingPrize}
          tournamentId={tournament?.id || ''}
          onClose={() => { setShowPrizeModal(false); setEditingPrize(null); }}
          onSuccess={() => { setShowPrizeModal(false); setEditingPrize(null); fetchData(); }}
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
  onSuccess: () => void;
}> = ({ prize, tournamentId, onClose, onSuccess }) => {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(prize?.image_url || null);
  const [valueDollars, setValueDollars] = useState(prize ? (prize.value_cents / 100).toString() : '0');
  const [form, setForm] = useState({
    name: prize?.name || '',
    description: prize?.description || '',
    tier: prize?.tier || 'standard',
    image_url: prize?.image_url || '',
    sponsor_name: prize?.sponsor_name || '',
    position: prize?.position || 0,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
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
        fd.append('prize[image]', imageFile);

        const res = await fetch(url, {
          method: prize ? 'PATCH' : 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) throw new Error('Failed to save');
      } else {
        const res = await fetch(url, {
          method: prize ? 'PATCH' : 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prize: { ...form, value_cents: valueCents } }),
        });
        if (!res.ok) throw new Error('Failed to save');
      }

      toast.success(prize ? 'Prize updated' : 'Prize created');
      onSuccess();
    } catch (err) {
      toast.error('Failed to save prize');
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
              onChange={e => {
                setForm({ ...form, image_url: e.target.value });
                if (e.target.value && !imageFile) setImagePreview(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Or Upload Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {imagePreview && (
            <div>
              <label className="block text-sm font-medium mb-1">Preview</label>
              <img
                src={imagePreview}
                alt="Prize preview"
                className="w-full h-32 object-contain rounded-lg border bg-gray-50"
              />
            </div>
          )}

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

