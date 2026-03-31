import React, { useState, useEffect, useCallback } from 'react';
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
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

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
}

interface Stats {
  total: number;
  paid: number;
  pending: number;
  winners: number;
}

interface Tournament {
  id: string;
  name: string;
  raffle_enabled: boolean;
  raffle_ticket_price_cents: number;
}

const TIERS = ['grand', 'platinum', 'gold', 'silver', 'standard'];

export const RaffleManagementPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const { getToken } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'prizes' | 'tickets'>('prizes');
  
  // Modals
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  
  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      const token = await getToken();
      
      // Get tournament via admin endpoint so raffle_enabled is always present
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${tournamentSlug}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const tournamentData = await tournamentRes.json();
      const tid = tournamentData.id || tournamentData.tournament?.id;
      setTournament({ ...tournamentData, id: tid });

      // Get prizes
      const prizesRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tid}/raffle/prizes`
      );
      const prizesData = await prizesRes.json();
      setPrizes(prizesData.prizes || []);

      // Get tickets (admin)
      const ticketsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tid}/raffle/admin/tickets`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const ticketsData = await ticketsRes.json();
      setTickets(ticketsData.tickets || []);
      setStats(ticketsData.stats || null);

    } catch (err) {
      toast.error('Failed to load raffle data');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="text-white py-6 px-4"
        style={{ backgroundColor: organization?.primary_color || '#7c3aed' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={`/${organization?.slug}/admin/tournaments/${tournamentSlug}`}
                className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Tournament
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Gift className="w-8 h-8" />
                Raffle Management
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/${organization?.slug}/tournaments/${tournamentSlug}/raffle`}
                className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20"
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
      </header>

      {/* Stats */}
      {stats && (
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <Gift className="w-8 h-8 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Prizes</p>
                <p className="text-xl font-bold">{prizes.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <Ticket className="w-8 h-8 text-brand-500" />
              <div>
                <p className="text-sm text-gray-500">Tickets Sold</p>
                <p className="text-xl font-bold">{stats.paid}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Winners</p>
                <p className="text-xl font-bold">{stats.winners}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Revenue</p>
                <p className="text-xl font-bold">
                  ${((stats.paid * (tournament?.raffle_ticket_price_cents || 500)) / 100).toFixed(0)}
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
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('prizes')}
              className={`pb-3 px-1 border-b-2 font-medium ${
                activeTab === 'prizes'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Gift className="w-5 h-5 inline mr-2" />
              Prizes ({prizes.length})
            </button>
            <button
              onClick={() => setActiveTab('tickets')}
              className={`pb-3 px-1 border-b-2 font-medium ${
                activeTab === 'tickets'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Ticket className="w-5 h-5 inline mr-2" />
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
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { setEditingPrize(null); setShowPrizeModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-5 h-5" />
                Add Prize
              </button>
              {prizes.filter(p => !p.won).length > 0 && (
                <button
                  onClick={handleDrawAll}
                  disabled={actionLoading === 'draw-all'}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
                >
                  {actionLoading === 'draw-all' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5" />
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
                  className={`bg-white rounded-xl shadow-sm p-4 flex items-center justify-between ${
                    prize.won ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      prize.tier === 'grand' ? 'bg-yellow-100 text-yellow-600' :
                      prize.tier === 'platinum' ? 'bg-slate-100 text-slate-600' :
                      prize.tier === 'gold' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{prize.name}</h3>
                      <p className="text-sm text-gray-500">
                        {prize.tier_display}
                        {prize.value_dollars > 0 && ` • $${prize.value_dollars}`}
                        {prize.sponsor_name && ` • Sponsored by ${prize.sponsor_name}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {prize.won ? (
                      <>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                          Won by {prize.winner?.name}
                        </span>
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
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
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

        {activeTab === 'tickets' && (
          <div>
            {/* Actions */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setShowTicketModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-5 h-5" />
                Sell Tickets
              </button>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Ticket #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Purchaser</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Winner</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Purchased</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-sm">{ticket.ticket_number}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{ticket.purchaser_name}</p>
                        <p className="text-sm text-gray-500">{ticket.purchaser_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          ticket.payment_status === 'paid' 
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {ticket.payment_status}
                        </span>
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
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {ticket.purchased_at 
                          ? new Date(ticket.purchased_at).toLocaleDateString()
                          : '-'
                        }
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                        No tickets sold yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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

      {/* Ticket Modal - simplified for now */}
      {showTicketModal && (
        <TicketModal
          tournamentId={tournament?.id || ''}
          ticketPrice={tournament?.raffle_ticket_price_cents || 500}
          onClose={() => setShowTicketModal(false)}
          onSuccess={() => { setShowTicketModal(false); fetchData(); }}
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
  const [form, setForm] = useState({
    name: prize?.name || '',
    description: prize?.description || '',
    value_cents: prize?.value_cents || 0,
    tier: prize?.tier || 'standard',
    image_url: prize?.image_url || '',
    sponsor_name: prize?.sponsor_name || '',
    position: prize?.position || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getToken();
      const url = prize
        ? `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/raffle/prizes/${prize.id}`
        : `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/raffle/prizes`;

      const res = await fetch(url, {
        method: prize ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prize: form }),
      });

      if (!res.ok) throw new Error('Failed to save');
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
      <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
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
                value={form.value_cents / 100}
                onChange={e => setForm({ ...form, value_cents: Number(e.target.value) * 100 })}
                className="w-full border rounded-lg px-3 py-2"
                min={0}
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
              onChange={e => setForm({ ...form, image_url: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="https://..."
            />
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
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (prize ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Ticket Modal Component
const TicketModal: React.FC<{
  tournamentId: string;
  ticketPrice: number;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ tournamentId, ticketPrice, onClose, onSuccess }) => {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    purchaser_name: '',
    purchaser_email: '',
    purchaser_phone: '',
    quantity: 1,
    mark_paid: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/raffle/tickets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        }
      );

      if (!res.ok) throw new Error('Failed to create tickets');
      const data = await res.json();
      toast.success(data.message);
      onSuccess();
    } catch (err) {
      toast.error('Failed to create tickets');
    } finally {
      setSaving(false);
    }
  };

  const total = (form.quantity * ticketPrice) / 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Sell Raffle Tickets</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Purchaser Name *</label>
            <input
              type="text"
              value={form.purchaser_name}
              onChange={e => setForm({ ...form, purchaser_name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              type="email"
              value={form.purchaser_email}
              onChange={e => setForm({ ...form, purchaser_email: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              value={form.purchaser_phone}
              onChange={e => setForm({ ...form, purchaser_phone: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Quantity</label>
            <input
              type="number"
              value={form.quantity}
              onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
              className="w-full border rounded-lg px-3 py-2"
              min={1}
              max={100}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mark_paid"
              checked={form.mark_paid}
              onChange={e => setForm({ ...form, mark_paid: e.target.checked })}
            />
            <label htmlFor="mark_paid" className="text-sm">Mark as paid (cash sale)</label>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <p className="text-sm text-purple-600">
              {form.quantity} ticket(s) × ${(ticketPrice / 100).toFixed(2)}
            </p>
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
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Sell Tickets'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
