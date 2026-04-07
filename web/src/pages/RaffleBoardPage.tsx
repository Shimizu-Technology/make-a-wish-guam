import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import {
  Gift,
  Trophy,
  Clock,
  Ticket,
  ChevronLeft,
  RefreshCw,
  Star,
  Sparkles,
  PartyPopper,
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { SignedInAdminBar } from '../components/SignedInAdminBar';

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
  sponsor_logo_url: string | null;
  position: number;
  won: boolean;
  claimed: boolean;
  winner?: {
    name: string;
    won_at: string;
    ticket_number: string;
  };
}

interface RaffleBoardData {
  tournament: {
    id: string;
    name: string;
    raffle_enabled: boolean;
    raffle_draw_time: string | null;
    raffle_description: string | null;
  };
  prizes: Prize[];
  stats: {
    total_prizes: number;
    prizes_won: number;
    prizes_remaining: number;
    total_tickets_sold: number;
  };
  last_updated: string;
}

// ---------------------------------------------------------------------------
// Tier styling helpers
// ---------------------------------------------------------------------------

function getTierBadge(tier: string, tierDisplay: string) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    grand: {
      bg: 'bg-amber-500',
      text: 'text-white',
      icon: <Trophy className="w-3.5 h-3.5" />,
    },
    platinum: {
      bg: 'bg-slate-500',
      text: 'text-white',
      icon: <Star className="w-3.5 h-3.5" />,
    },
    gold: {
      bg: 'bg-amber-500',
      text: 'text-white',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    silver: {
      bg: 'bg-neutral-400',
      text: 'text-white',
      icon: <Star className="w-3.5 h-3.5" />,
    },
  };

  const c = config[tier] || {
    bg: 'bg-[#0057B8]',
    text: 'text-white',
    icon: <Gift className="w-3.5 h-3.5" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 ${c.bg} ${c.text} text-xs font-semibold px-2.5 py-1 rounded-full`}>
      {c.icon}
      {tierDisplay}
    </span>
  );
}

function getTierPlaceholderBg(tier: string) {
  switch (tier) {
    case 'grand':
      return 'bg-gradient-to-br from-amber-50 to-orange-50';
    case 'platinum':
      return 'bg-gradient-to-br from-slate-50 to-slate-100';
    case 'gold':
      return 'bg-gradient-to-br from-amber-50 to-yellow-50';
    case 'silver':
      return 'bg-gradient-to-br from-neutral-50 to-neutral-100';
    default:
      return 'bg-gradient-to-br from-neutral-50 to-neutral-100/50';
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const RaffleBoardPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const orgSlug = organization?.slug || 'make-a-wish-guam';
  const [data, setData] = useState<RaffleBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketEmail, setTicketEmail] = useState('');
  const [myTickets, setMyTickets] = useState<{ ticket_number: string; is_winner: boolean }[] | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [showMyTickets, setShowMyTickets] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/organizations/${orgSlug}/tournaments/${tournamentSlug}`
      );
      if (!tournamentRes.ok) throw new Error('Tournament not found');
      const tournamentData = await tournamentRes.json();
      const tournamentId = tournamentData.id || tournamentData.tournament?.id;

      const boardRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/raffle/board`
      );
      if (!boardRes.ok) throw new Error('Failed to load raffle');
      const boardData = await boardRes.json();

      setData(boardData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load raffle');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, tournamentSlug]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatCountdown = (drawTime: string) => {
    const now = new Date();
    const draw = new Date(drawTime);
    const diff = draw.getTime() - now.getTime();
    if (diff <= 0) return 'Drawing now!';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const lookupTickets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketEmail.trim() || !data?.tournament?.id) return;
    setTicketLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${data.tournament.id}/raffle/tickets?query=${encodeURIComponent(ticketEmail.trim())}`
      );
      if (res.ok) {
        const result = await res.json();
        setMyTickets(result.tickets || []);
      } else {
        setMyTickets([]);
      }
    } catch {
      setMyTickets([]);
    } finally {
      setTicketLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#0057B8]/20 border-t-[#0057B8] mx-auto" />
          <p className="mt-5 text-sm text-neutral-500 tracking-wide uppercase">Loading raffle</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <Gift className="w-12 h-12 text-neutral-300 mx-auto mb-6" strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Raffle Unavailable</h1>
          <p className="mt-3 text-neutral-500 leading-relaxed">{error}</p>
          <Link
            to={`/${tournamentSlug}`}
            className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 text-sm font-semibold text-white bg-[#0057B8] rounded-full transition-colors hover:bg-[#003a6e]"
          >
            Back to Tournament
          </Link>
        </div>
      </div>
    );
  }

  const { tournament, prizes, stats } = data;

  // ---------------------------------------------------------------------------
  // Raffle disabled state
  // ---------------------------------------------------------------------------
  if (!tournament.raffle_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <Gift className="w-12 h-12 text-neutral-300 mx-auto mb-6" strokeWidth={1.5} />
          <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Raffle Coming Soon</h2>
          <p className="mt-3 text-neutral-500 leading-relaxed">
            The raffle for {tournament.name} is not active yet. Check back closer to the event!
          </p>
          <Link
            to={`/${tournamentSlug}`}
            className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 text-sm font-semibold text-white bg-[#0057B8] rounded-full transition-colors hover:bg-[#003a6e]"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Tournament
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F5F5F5] text-neutral-900">
      <SignedInAdminBar />
      {/* ================================================================= */}
      {/* HERO HEADER                                                        */}
      {/* ================================================================= */}
      <div className="relative bg-gradient-to-br from-[#0057B8] via-[#00408a] to-[#002d63] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                to={`/${tournamentSlug}`}
                className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm transition-colors mb-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Tournament
              </Link>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
                <Gift className="w-6 h-6 sm:w-7 sm:h-7 text-[#F5A800] shrink-0" strokeWidth={1.5} />
                <span className="truncate">{tournament.name} Raffle</span>
              </h1>
              {tournament.raffle_description && (
                <p className="mt-2 text-white/70 text-sm sm:text-base max-w-xl">{tournament.raffle_description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 mt-6">
              {tournament.raffle_draw_time && (
                <div className="text-right hidden sm:block">
                  <p className="text-white/60 text-xs">Drawing in</p>
                  <p className="text-lg font-bold text-[#F5A800] flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatCountdown(tournament.raffle_draw_time)}
                  </p>
                </div>
              )}
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          {/* Mobile draw time */}
          {tournament.raffle_draw_time && (
            <div className="mt-3 flex items-center gap-2 text-sm sm:hidden">
              <Clock className="w-4 h-4 text-[#F5A800]" />
              <span className="text-white/70">Drawing in</span>
              <span className="font-bold text-[#F5A800]">{formatCountdown(tournament.raffle_draw_time)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* STATS BAR                                                          */}
      {/* ================================================================= */}
      <div className="bg-white border-b border-neutral-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
            <div className="flex items-center gap-3 p-3 sm:p-0">
              <div className="w-10 h-10 rounded-xl bg-[#F5A800]/10 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-[#F5A800]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.total_prizes}</p>
                <p className="text-xs text-neutral-500">Prizes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 sm:p-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.prizes_won}</p>
                <p className="text-xs text-neutral-500">Won</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 sm:p-0">
              <div className="w-10 h-10 rounded-xl bg-[#0057B8]/10 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-[#0057B8]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.prizes_remaining}</p>
                <p className="text-xs text-neutral-500">Remaining</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 sm:p-0">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0">
                <Ticket className="w-5 h-5 text-neutral-600" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold text-neutral-900">{stats.total_tickets_sold}</p>
                <p className="text-xs text-neutral-500">Tickets Sold</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAIN CONTENT                                                       */}
      {/* ================================================================= */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Check My Tickets */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => setShowMyTickets(!showMyTickets)}
            className="flex items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0057B8]/10 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-[#0057B8]" strokeWidth={1.5} />
            </div>
            Check My Tickets
            {showMyTickets
              ? <ChevronUp className="w-4 h-4 text-neutral-400" />
              : <ChevronDown className="w-4 h-4 text-neutral-400" />
            }
          </button>

          {showMyTickets && (
            <div className="mt-3 bg-white rounded-2xl border border-neutral-200 p-4 sm:p-6">
              <form onSubmit={lookupTickets} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={ticketEmail}
                    onChange={(e) => setTicketEmail(e.target.value)}
                    placeholder="Search by email, phone, name, or ticket #..."
                    className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#0057B8] focus:ring-2 focus:ring-[#0057B8]/20 transition-colors"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={ticketLoading}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#0057B8] text-white text-sm font-semibold rounded-xl hover:bg-[#003a6e] disabled:opacity-50 transition-colors shrink-0"
                >
                  {ticketLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Look Up
                </button>
              </form>

              {myTickets !== null && (
                <div className="mt-4 pt-4 border-t border-neutral-100">
                  {myTickets.length === 0 ? (
                    <p className="text-sm text-neutral-500">No tickets found. Try searching by email, phone number, name, or ticket number.</p>
                  ) : (
                    <div>
                      <p className="text-sm text-neutral-600 mb-3">
                        You have <strong className="text-neutral-900">{myTickets.length}</strong> ticket{myTickets.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {myTickets.map((t, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono font-medium ${
                              t.is_winner
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
                            }`}
                          >
                            #{t.ticket_number}
                            {t.is_winner && <Trophy className="w-3.5 h-3.5 text-amber-500" />}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Prize Grid */}
        {prizes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
            <Gift className="w-12 h-12 text-neutral-300 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-neutral-500">No prizes yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {prizes.map((prize) => (
              <div
                key={prize.id}
                className={`relative flex flex-col bg-white rounded-2xl border border-neutral-200 overflow-hidden transition-all duration-200 ${
                  prize.won ? 'opacity-75' : 'hover:shadow-lg hover:-translate-y-0.5'
                }`}
              >
                {/* Prize Image or Placeholder */}
                <div className="relative">
                  {prize.image_url ? (
                    <img
                      src={prize.image_url}
                      alt={prize.name}
                      className="w-full h-40 sm:h-44 object-cover"
                    />
                  ) : (
                    <div className={`w-full h-40 sm:h-44 flex items-center justify-center ${getTierPlaceholderBg(prize.tier)}`}>
                      <Gift className="w-10 h-10 text-neutral-300" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    {getTierBadge(prize.tier, prize.tier_display)}
                  </div>
                </div>

                {/* Prize Info — flex-1 so cards stretch equally */}
                <div className="flex flex-col flex-1 p-4 sm:p-5">
                  <h3 className="text-base font-bold text-neutral-900 leading-snug">{prize.name}</h3>
                  {prize.description && (
                    <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{prize.description}</p>
                  )}

                  {/* Sponsor */}
                  {prize.sponsor_name && (
                    <div className="flex items-center gap-1.5 mt-2">
                      {prize.sponsor_logo_url ? (
                        <img
                          src={prize.sponsor_logo_url}
                          alt={prize.sponsor_name}
                          className="h-4 object-contain"
                        />
                      ) : null}
                      <span className="text-xs text-neutral-400">
                        {prize.sponsor_logo_url ? prize.sponsor_name : `Sponsored by ${prize.sponsor_name}`}
                      </span>
                    </div>
                  )}

                  {/* Spacer pushes value to bottom */}
                  <div className="flex-1" />

                  {/* Value — always at bottom */}
                  {prize.value_dollars > 0 && (
                    <div className="mt-4 pt-3 border-t border-neutral-100">
                      <p className="text-lg font-bold text-neutral-900">
                        ${prize.value_dollars.toLocaleString()}
                        <span className="text-sm font-normal text-neutral-400 ml-1">value</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Winner Overlay */}
                {prize.won && prize.winner && (
                  <div className="absolute inset-0 bg-neutral-900/85 flex flex-col items-center justify-center text-white p-4 backdrop-blur-sm">
                    <PartyPopper className="w-10 h-10 text-[#F5A800] mb-3" />
                    <p className="text-xs uppercase tracking-widest text-[#F5A800] font-semibold mb-1">Winner</p>
                    <p className="text-xl font-bold text-center">{prize.winner.name}</p>
                    <p className="text-sm text-white/60 mt-1 font-mono">
                      Ticket #{prize.winner.ticket_number}
                    </p>
                    {prize.claimed && (
                      <span className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                        <Check className="w-3 h-3" />
                        Claimed
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ================================================================= */}
      {/* FOOTER                                                             */}
      {/* ================================================================= */}
      <footer className="border-t border-neutral-200 mt-8">
        <div className="max-w-5xl mx-auto px-6 lg:px-8 py-6 flex items-center justify-between text-sm text-neutral-400">
          <p>
            Powered by <span className="font-medium text-neutral-600">Shimizu Technology</span>
          </p>
          <p className="text-xs">Updates every 10 seconds</p>
        </div>
      </footer>
    </div>
  );
};
