import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createConsumer } from '@rails/actioncable';
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
  X,
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

const TIERS = ['grand', 'platinum', 'gold', 'silver', 'standard'];
const TIER_RANK = TIERS.reduce<Record<string, number>>((acc, tier, index) => {
  acc[tier] = index;
  return acc;
}, {});
const PUBLIC_PRIZES_PER_PAGE = 12;
const SPINNING_TICKET_COUNT = 16;
const SPINNING_TICKET_ROTATE_STEP = 8;
const FALLBACK_SPINNING_TICKETS = ['TIX-0001', 'TIX-0002', 'TIX-0003', 'TIX-0004'];

type PublicPrizeStatusFilter = '' | 'available' | 'won';
type PublicPrizeSort = 'tier' | 'position' | 'name' | 'value_desc' | 'value_asc';
type DrawPhase = 'spinning' | 'revealing';

interface LiveDrawState {
  drawId: string;
  phase: DrawPhase;
  prizeId: number;
  prizeName: string;
  eligibleTicketCount: number;
  previewTicketNumbers: string[];
  winnerName?: string;
  winnerTicketNumber?: string;
  startedAt: number;
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
  const [prizeSearch, setPrizeSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<PublicPrizeStatusFilter>('');
  const [sortBy, setSortBy] = useState<PublicPrizeSort>('tier');
  const [page, setPage] = useState(1);
  const [liveDraw, setLiveDraw] = useState<LiveDrawState | null>(null);
  const [spinSampleOffset, setSpinSampleOffset] = useState(0);
  const revealTimeoutRef = useRef<number | null>(null);
  const drawSafetyTimeoutRef = useRef<number | null>(null);

  const clearLiveDrawTimers = useCallback(() => {
    if (revealTimeoutRef.current) {
      window.clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    if (drawSafetyTimeoutRef.current) {
      window.clearTimeout(drawSafetyTimeoutRef.current);
      drawSafetyTimeoutRef.current = null;
    }
  }, []);

  const dismissLiveDraw = useCallback(() => {
    clearLiveDrawTimers();
    setLiveDraw(null);
  }, [clearLiveDrawTimers]);

  const fetchData = useCallback(async () => {
    try {
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/organizations/${orgSlug}/tournaments/${tournamentSlug}`
      );
      if (!tournamentRes.ok) throw new Error('Tournament not found');
      const tournamentData = await tournamentRes.json();
      const tournamentId = tournamentData.id || tournamentData.tournament?.id;

      const boardRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/raffle/board`,
        { cache: 'no-store' }
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!data?.tournament?.id) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/cable`;
    const consumer = createConsumer(wsUrl);
    const subscription = consumer.subscriptions.create(
      { channel: 'RaffleChannel', tournament_id: data.tournament.id },
      {
        received(event: {
          action: string;
          draw_id?: string;
          eligible_ticket_count?: number;
          preview_ticket_numbers?: string[];
          started_at?: string;
          prize?: {
            id: number;
            name: string;
            winner_name?: string;
            winning_ticket?: { ticket_number?: string };
          };
        }) {
          if (event.action === 'draw_started' && event.draw_id && event.prize) {
            const drawId = event.draw_id;
            clearLiveDrawTimers();
            setSpinSampleOffset(0);
            setLiveDraw({
              drawId,
              phase: 'spinning',
              prizeId: event.prize.id,
              prizeName: event.prize.name,
              eligibleTicketCount: event.eligible_ticket_count || 0,
              previewTicketNumbers: event.preview_ticket_numbers || [],
              startedAt: Date.now(),
            });
            drawSafetyTimeoutRef.current = window.setTimeout(() => {
              setLiveDraw((current) => (
                current?.drawId === drawId && current.phase === 'spinning' ? null : current
              ));
              void fetchData();
            }, 15000);
          }

          if (event.action === 'prize_won' && event.draw_id && event.prize) {
            const drawId = event.draw_id;
            const prize = event.prize;
            const eligibleTicketCount = event.eligible_ticket_count || 0;
            if (drawSafetyTimeoutRef.current) {
              window.clearTimeout(drawSafetyTimeoutRef.current);
              drawSafetyTimeoutRef.current = null;
            }
            setLiveDraw((current) => {
              const startedAt = current?.drawId === drawId ? current.startedAt : Date.now();
              const elapsed = Date.now() - startedAt;
              const revealDelay = Math.max(0, 3600 - elapsed);

              if (revealTimeoutRef.current) {
                window.clearTimeout(revealTimeoutRef.current);
                revealTimeoutRef.current = null;
              }
              revealTimeoutRef.current = window.setTimeout(() => {
                setSpinSampleOffset(0);
                setLiveDraw((latest) => latest?.drawId === drawId ? {
                  ...latest,
                  phase: 'revealing',
                  winnerName: prize.winner_name,
                  winnerTicketNumber: prize.winning_ticket?.ticket_number,
                } : latest);
                void fetchData();
              }, revealDelay);

              return current || {
                drawId,
                phase: 'spinning',
                prizeId: prize.id,
                prizeName: prize.name,
                eligibleTicketCount,
                previewTicketNumbers: [],
                startedAt,
              };
            });
          }
        },
      }
    );

    return () => {
      clearLiveDrawTimers();
      subscription.unsubscribe();
      consumer.disconnect();
    };
  }, [clearLiveDrawTimers, data?.tournament?.id, fetchData]);

  const visiblePrizes = useMemo(() => {
    const query = prizeSearch.trim().toLowerCase();
    return (data?.prizes || [])
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
        if (tierFilter && prize.tier !== tierFilter) return false;
        if (statusFilter === 'available' && prize.won) return false;
        if (statusFilter === 'won' && !prize.won) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'position':
            return a.position - b.position || (TIER_RANK[a.tier] ?? 99) - (TIER_RANK[b.tier] ?? 99);
          case 'name':
            return a.name.localeCompare(b.name);
          case 'value_desc':
            return b.value_dollars - a.value_dollars || a.position - b.position;
          case 'value_asc':
            return a.value_dollars - b.value_dollars || a.position - b.position;
          case 'tier':
          default:
            return (TIER_RANK[a.tier] ?? 99) - (TIER_RANK[b.tier] ?? 99) || a.position - b.position;
        }
      });
  }, [data?.prizes, prizeSearch, tierFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(visiblePrizes.length / PUBLIC_PRIZES_PER_PAGE));
  const paginatedPrizes = visiblePrizes.slice((page - 1) * PUBLIC_PRIZES_PER_PAGE, page * PUBLIC_PRIZES_PER_PAGE);
  const spinningTicketNumbers = useMemo(() => {
    const source = liveDraw?.previewTicketNumbers.length
      ? liveDraw.previewTicketNumbers
      : FALLBACK_SPINNING_TICKETS;

    if (source.length <= SPINNING_TICKET_COUNT) return source;

    return Array.from({ length: SPINNING_TICKET_COUNT }, (_, index) => (
      source[(spinSampleOffset + index) % source.length]
    ));
  }, [liveDraw?.previewTicketNumbers, spinSampleOffset]);

  useEffect(() => {
    setPage(1);
  }, [prizeSearch, tierFilter, statusFilter, sortBy]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (liveDraw?.phase !== 'revealing') return;

    const timeout = window.setTimeout(() => setLiveDraw(null), 9000);
    return () => window.clearTimeout(timeout);
  }, [liveDraw?.phase, liveDraw?.drawId]);

  useEffect(() => {
    if (liveDraw?.phase !== 'spinning') return;
    const previewCount = liveDraw.previewTicketNumbers.length;
    if (previewCount <= SPINNING_TICKET_COUNT) return;

    const interval = window.setInterval(() => {
      setSpinSampleOffset((current) => (current + SPINNING_TICKET_ROTATE_STEP) % previewCount);
    }, 520);

    return () => window.clearInterval(interval);
  }, [liveDraw?.phase, liveDraw?.drawId, liveDraw?.previewTicketNumbers.length]);

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
      {liveDraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={dismissLiveDraw}
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/70"
              aria-label="Dismiss live draw"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="bg-[#0057B8] px-5 py-4 text-white sm:px-8 sm:py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F5A800]">Live raffle draw</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">{liveDraw.prizeName}</h2>
              <p className="mt-2 text-sm text-white/75">
                Drawing from {liveDraw.eligibleTicketCount.toLocaleString()} ticket{liveDraw.eligibleTicketCount === 1 ? '' : 's'} in this draw.
              </p>
            </div>

            <div className="p-5 sm:p-8">
              {liveDraw.phase === 'spinning' ? (
                <>
                  <div className="rounded-3xl border border-neutral-200 bg-neutral-950 p-4 text-white sm:p-6">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {spinningTicketNumbers.map((ticketNumber, index) => (
                        <div
                          key={`${liveDraw.drawId}-${spinSampleOffset}-${ticketNumber}-${index}`}
                          className={`${index >= 8 ? 'hidden sm:block' : ''} rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-center font-mono text-sm font-semibold text-white shadow-sm animate-pulse`}
                          style={{ animationDelay: `${(index % 8) * 90}ms`, animationDuration: '700ms' }}
                        >
                          {ticketNumber}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-center gap-3 text-sm font-medium text-neutral-600">
                    <Loader2 className="h-5 w-5 animate-spin text-[#0057B8]" />
                    Shuffling {liveDraw.eligibleTicketCount.toLocaleString()} ticket{liveDraw.eligibleTicketCount === 1 ? '' : 's'} in this draw
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <PartyPopper className="mx-auto h-14 w-14 text-[#F5A800]" />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#0057B8]">Winner</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-950 sm:text-5xl">{liveDraw.winnerName || 'Winner selected'}</p>
                  {liveDraw.winnerTicketNumber && (
                    <p className="mt-3 font-mono text-lg font-semibold text-neutral-600">Ticket #{liveDraw.winnerTicketNumber}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                    placeholder="Enter your email, phone, or ticket #..."
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
                    <p className="text-sm text-neutral-500">No tickets found. Try searching by email, phone number, or ticket number.</p>
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

        {/* Prize Filters */}
        <div className="mb-5 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={prizeSearch}
                onChange={(e) => setPrizeSearch(e.target.value)}
                placeholder="Search prizes or sponsors..."
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-10 pr-4 text-sm focus:border-[#0057B8] focus:outline-none focus:ring-2 focus:ring-[#0057B8]/20"
              />
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm focus:border-[#0057B8] focus:outline-none focus:ring-2 focus:ring-[#0057B8]/20"
            >
              <option value="">All tiers</option>
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>{tier.charAt(0).toUpperCase() + tier.slice(1)}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PublicPrizeStatusFilter)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm focus:border-[#0057B8] focus:outline-none focus:ring-2 focus:ring-[#0057B8]/20"
            >
              <option value="">All prizes</option>
              <option value="available">Available</option>
              <option value="won">Won</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as PublicPrizeSort)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm focus:border-[#0057B8] focus:outline-none focus:ring-2 focus:ring-[#0057B8]/20"
            >
              <option value="tier">Sort by tier</option>
              <option value="position">Sort by list order</option>
              <option value="name">Sort by name</option>
              <option value="value_desc">Value high to low</option>
              <option value="value_asc">Value low to high</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
            <span>
              Showing {paginatedPrizes.length ? ((page - 1) * PUBLIC_PRIZES_PER_PAGE) + 1 : 0}
              –{Math.min(page * PUBLIC_PRIZES_PER_PAGE, visiblePrizes.length)} of {visiblePrizes.length} prizes
            </span>
            {(prizeSearch || tierFilter || statusFilter || sortBy !== 'tier') && (
              <button
                type="button"
                onClick={() => {
                  setPrizeSearch('');
                  setTierFilter('');
                  setStatusFilter('');
                  setSortBy('tier');
                }}
                className="font-medium text-[#0057B8] hover:text-[#003a6e]"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Prize Grid */}
        {prizes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
            <Gift className="w-12 h-12 text-neutral-300 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-neutral-500">No prizes yet. Check back soon!</p>
          </div>
        ) : visiblePrizes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
            <Search className="w-12 h-12 text-neutral-300 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-neutral-500">No prizes match those filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {paginatedPrizes.map((prize) => (
              <div
                key={prize.id}
                className={`relative flex flex-col bg-white rounded-2xl border border-neutral-200 overflow-hidden transition-all duration-200 ${
                  prize.won ? 'opacity-75' : 'hover:shadow-lg hover:-translate-y-0.5'
                }`}
              >
                {/* Prize Image or Placeholder */}
                <div className="relative h-44 bg-white sm:h-48">
                  {prize.image_url ? (
                    <img
                      src={prize.image_url}
                      alt={prize.name}
                      className="h-full w-full object-contain p-3"
                      loading="lazy"
                    />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center ${getTierPlaceholderBg(prize.tier)}`}>
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

        {visiblePrizes.length > PUBLIC_PRIZES_PER_PAGE && (
          <div className="mt-5 flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-neutral-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
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
          <p className="text-xs">Updates every 5 seconds</p>
        </div>
      </footer>
    </div>
  );
};
