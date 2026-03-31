import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Gift, 
  Trophy,
  Clock,
  Ticket,
  ArrowLeft,
  RefreshCw,
  Star,
  Sparkles,
  PartyPopper
} from 'lucide-react';

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

export const RaffleBoardPage: React.FC = () => {
  const { orgSlug, tournamentSlug } = useParams<{ orgSlug: string; tournamentSlug: string }>();
  const [data, setData] = useState<RaffleBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWinnerAnimation, setShowWinnerAnimation] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Get tournament ID first
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/organizations/${orgSlug}/tournaments/${tournamentSlug}`
      );
      if (!tournamentRes.ok) throw new Error('Tournament not found');
      const tournamentData = await tournamentRes.json();
      const tournamentId = tournamentData.id || tournamentData.tournament?.id;

      // Get raffle board
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
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case 'grand':
        return 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-white border-yellow-300';
      case 'platinum':
        return 'bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 text-white border-slate-200';
      case 'gold':
        return 'bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 text-white border-yellow-400';
      case 'silver':
        return 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 text-white border-gray-200';
      default:
        return 'bg-white text-gray-900 border-gray-200';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'grand':
        return <Trophy className="w-6 h-6" />;
      case 'platinum':
        return <Star className="w-6 h-6" />;
      case 'gold':
        return <Sparkles className="w-6 h-6" />;
      default:
        return <Gift className="w-6 h-6" />;
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-brand-900 flex items-center justify-center">
        <div className="text-center">
          <Gift className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
          <p className="text-white text-xl">Loading raffle...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-brand-900 flex items-center justify-center">
        <div className="text-center">
          <Gift className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Raffle Unavailable</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <Link
            to={`/${orgSlug}/tournaments/${tournamentSlug}`}
            className="text-yellow-400 hover:text-yellow-300"
          >
            ← Back to Tournament
          </Link>
        </div>
      </div>
    );
  }

  const { tournament, prizes, stats } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-brand-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={`/${orgSlug}/tournaments/${tournamentSlug}`}
                className="inline-flex items-center gap-1 text-white/60 hover:text-white text-sm mb-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Gift className="w-8 h-8 text-yellow-400" />
                {tournament.name} Raffle
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {tournament.raffle_draw_time && (
                <div className="text-right">
                  <p className="text-white/60 text-xs">Drawing in</p>
                  <p className="text-xl font-bold text-yellow-400 flex items-center gap-1">
                    <Clock className="w-5 h-5" />
                    {formatCountdown(tournament.raffle_draw_time)}
                  </p>
                </div>
              )}
              <button
                onClick={fetchData}
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-white"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-black/20 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-yellow-400">{stats.total_prizes}</p>
              <p className="text-white/60 text-sm">Total Prizes</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-3xl font-bold text-green-400">{stats.prizes_won}</p>
              <p className="text-white/60 text-sm">Won</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-3xl font-bold text-brand-400">{stats.prizes_remaining}</p>
              <p className="text-white/60 text-sm">Remaining</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-3xl font-bold text-purple-400 flex items-center gap-1">
                <Ticket className="w-6 h-6" />
                {stats.total_tickets_sold}
              </p>
              <p className="text-white/60 text-sm">Tickets Sold</p>
            </div>
          </div>
        </div>
      </div>

      {/* Prizes Grid */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {tournament.raffle_description && (
          <p className="text-center text-white/80 mb-8 max-w-2xl mx-auto">
            {tournament.raffle_description}
          </p>
        )}

        {prizes.length === 0 ? (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">No prizes yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {prizes.map((prize) => (
              <div
                key={prize.id}
                className={`relative rounded-xl border-2 overflow-hidden transition-all duration-300 ${
                  prize.won 
                    ? 'opacity-75 scale-95' 
                    : 'hover:scale-105 hover:shadow-2xl'
                } ${getTierStyle(prize.tier)}`}
              >
                {/* Tier Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1">
                  {getTierIcon(prize.tier)}
                  <span className="text-sm font-medium">{prize.tier_display}</span>
                </div>

                {/* Prize Image or Placeholder */}
                {prize.image_url ? (
                  <img
                    src={prize.image_url}
                    alt={prize.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-black/20 flex items-center justify-center">
                    <Gift className="w-16 h-16 opacity-30" />
                  </div>
                )}

                {/* Prize Info */}
                <div className="p-4">
                  <h3 className="text-xl font-bold mb-1">{prize.name}</h3>
                  {prize.description && (
                    <p className="text-sm opacity-80 mb-2">{prize.description}</p>
                  )}
                  {prize.value_dollars > 0 && (
                    <p className="text-lg font-semibold">
                      ${prize.value_dollars.toLocaleString()} Value
                    </p>
                  )}

                  {/* Sponsor */}
                  {prize.sponsor_name && (
                    <div className="mt-3 pt-3 border-t border-current/20 flex items-center gap-2">
                      {prize.sponsor_logo_url ? (
                        <img
                          src={prize.sponsor_logo_url}
                          alt={prize.sponsor_name}
                          className="h-6 object-contain"
                        />
                      ) : (
                        <span className="text-xs opacity-60">Sponsored by</span>
                      )}
                      <span className="text-sm font-medium">{prize.sponsor_name}</span>
                    </div>
                  )}
                </div>

                {/* Winner Overlay */}
                {prize.won && prize.winner && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
                    <PartyPopper className="w-12 h-12 text-yellow-400 mb-3" />
                    <p className="text-sm uppercase tracking-wider text-yellow-400 mb-1">Winner!</p>
                    <p className="text-2xl font-bold text-center">{prize.winner.name}</p>
                    <p className="text-sm text-white/60 mt-1">
                      Ticket #{prize.winner.ticket_number}
                    </p>
                    {prize.claimed && (
                      <span className="mt-3 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
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

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-black/30 backdrop-blur-sm border-t border-white/10 py-3">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-white/40 text-sm">
            Powered by Pacific Golf • Updates every 10 seconds
          </p>
        </div>
      </footer>
    </div>
  );
};
