import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig, useInView } from 'framer-motion';
import {
  Trophy,
  RefreshCw,
  Users,
  Clock,
  ChevronUp,
  ChevronDown,
  Minus,
  ArrowLeft,
  Wifi,
  WifiOff,
  Award,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  position: number;
  golfer_id?: number;
  group_id?: number;
  name?: string;
  team_name?: string;
  group_number?: number;
  total_strokes: number;
  total_relative: number;
  holes_completed: number;
  thru: number;
  display_score: string | null;
  golfers?: { id: number; name: string }[];
}

interface Tournament {
  id: string;
  name: string;
  format: string;
  total_holes: number;
  total_par: number;
}

interface LeaderboardData {
  tournament: Tournament;
  scoring_type: 'individual' | 'team';
  leaderboard: LeaderboardEntry[];
  last_updated: string;
}

interface OrgInfo {
  primary_color?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Animation config
// ---------------------------------------------------------------------------

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const rowVariant = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.97,
    transition: { duration: 0.3, ease },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { hexToRgba } from '../utils/colors';

// ---------------------------------------------------------------------------
// Position badge (top 3 get medal-like glow badges)
// ---------------------------------------------------------------------------

function PositionBadge({ position }: { position: number }) {
  if (position <= 3) {
    const config = {
      1: {
        bg: 'bg-gradient-to-br from-yellow-300 to-amber-500',
        glow: '0 0 20px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.2)',
        text: 'text-amber-900',
        ring: 'ring-yellow-400/40',
      },
      2: {
        bg: 'bg-gradient-to-br from-gray-200 to-gray-400',
        glow: '0 0 20px rgba(156,163,175,0.4), 0 0 40px rgba(156,163,175,0.15)',
        text: 'text-gray-700',
        ring: 'ring-gray-300/40',
      },
      3: {
        bg: 'bg-gradient-to-br from-orange-300 to-amber-600',
        glow: '0 0 20px rgba(217,119,6,0.4), 0 0 40px rgba(217,119,6,0.15)',
        text: 'text-amber-900',
        ring: 'ring-orange-400/40',
      },
    }[position as 1 | 2 | 3];

    return (
      <motion.div
        className={`w-11 h-11 rounded-full ${config.bg} ${config.text} ring-2 ${config.ring} flex items-center justify-center font-bold text-sm`}
        style={{ boxShadow: config.glow }}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <Award className="w-5 h-5" strokeWidth={2.5} />
      </motion.div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
      <span className="text-gray-300 font-bold text-sm">{position}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score flash (pulses when score updates)
// ---------------------------------------------------------------------------

function ScoreDisplay({
  displayScore,
  totalRelative,
  totalStrokes,
  thru,
  entryKey,
}: {
  displayScore: string | null;
  totalRelative: number;
  totalStrokes: number;
  thru: number;
  entryKey: string;
}) {
  const getScoreColor = (relative: number) => {
    if (relative < 0) return 'text-red-400';
    if (relative > 0) return 'text-blue-400';
    return 'text-gray-100';
  };

  const getScoreIcon = (relative: number) => {
    if (relative < 0) return <ChevronDown className="w-4 h-4 text-red-400" />;
    if (relative > 0) return <ChevronUp className="w-4 h-4 text-blue-400" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="text-right">
      <div className="flex items-center gap-1 justify-end">
        {getScoreIcon(totalRelative)}
        <motion.span
          key={`${entryKey}-${displayScore}`}
          className={`text-2xl font-bold tabular-nums ${getScoreColor(totalRelative)}`}
          initial={{ scale: 1.3, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease }}
        >
          {displayScore || 'E'}
        </motion.span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5">
        {totalStrokes} strokes &middot; Thru {thru}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state with breathing animation
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="text-center py-16">
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Trophy className="w-16 h-16 text-gray-700 mx-auto" strokeWidth={1.5} />
      </motion.div>
      <motion.h2
        className="text-xl font-semibold text-gray-300 mt-5 mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease }}
      >
        No Scores Yet
      </motion.h2>
      <motion.p
        className="text-gray-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        Scores will appear here as they're entered.
      </motion.p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export const LeaderboardPage: React.FC = () => {
  const { orgSlug, tournamentSlug } = useParams<{ orgSlug: string; tournamentSlug: string }>();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [orgInfo, setOrgInfo] = useState<OrgInfo>({});

  const listRef = useRef(null);
  const isInView = useInView(listRef, { once: true, margin: '0px' });

  // Fetch org info for primaryColor
  useEffect(() => {
    if (!orgSlug) return;
    fetch(`${import.meta.env.VITE_API_URL}/api/v1/organizations/${orgSlug}`)
      .then((res) => res.ok ? res.json() : null)
      .then((d) => {
        if (d) setOrgInfo({ primary_color: d.primary_color, name: d.name });
      })
      .catch(() => {});
  }, [orgSlug]);

  const fetchLeaderboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/organizations/${orgSlug}/tournaments/${tournamentSlug}`
      );
      if (!tournamentRes.ok) throw new Error('Tournament not found');
      const tournamentData = await tournamentRes.json();

      const tournamentId = tournamentData.id || tournamentData.tournament?.id;
      const leaderboardRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/scores/leaderboard`
      );
      if (!leaderboardRes.ok) throw new Error('Failed to load leaderboard');
      const leaderboardData = await leaderboardRes.json();

      setData(leaderboardData);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgSlug, tournamentSlug]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLeaderboard(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLeaderboard]);

  const primaryColor = orgInfo.primary_color || '#16a34a';

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="w-10 h-10 text-green-500 mx-auto" />
          </motion.div>
          <motion.p
            className="text-gray-400 mt-4 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Loading leaderboard...
          </motion.p>
        </div>
      </div>
    );
  }

  // Error
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
        >
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-gray-600" strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Leaderboard Unavailable</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            {error || "The leaderboard is currently unavailable. This could be because the tournament hasn't started yet or scores haven't been entered."}
          </p>
          <Link
            to={`/${orgSlug}/tournaments/${tournamentSlug}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all shadow-lg shadow-green-600/25"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tournament
          </Link>
        </motion.div>
      </div>
    );
  }

  const { tournament, scoring_type, leaderboard } = data;

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-gray-900">
      {/* Header with org-color gradient */}
      <motion.header
        className="sticky top-0 z-10 border-b border-gray-700/50"
        style={{
          background: `linear-gradient(135deg, ${hexToRgba(primaryColor, 0.15)} 0%, rgba(31,41,55,1) 50%, rgba(31,41,55,1) 100%)`,
        }}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={`/${orgSlug}/tournaments/${tournamentSlug}`}
                className="inline-flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-1 transition-colors duration-200"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <motion.h1
                className="text-xl font-bold text-white"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.5, ease }}
              >
                {tournament.name}
              </motion.h1>
              <p className="text-gray-400 text-sm">
                Live Leaderboard &middot; Par {tournament.total_par}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  autoRefresh
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-gray-700 text-gray-400'
                }`}
                title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              >
                {autoRefresh ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => fetchLeaderboard(true)}
                className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors duration-200"
              >
                <motion.div
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={
                    refreshing
                      ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                      : { duration: 0.3 }
                  }
                >
                  <RefreshCw className="w-5 h-5" />
                </motion.div>
              </button>
            </div>
          </div>
          <motion.div
            className="flex items-center gap-4 mt-2 text-xs text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated {formatTime(lastRefresh)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {leaderboard.length} {scoring_type === 'team' ? 'teams' : 'players'}
            </span>
          </motion.div>
        </div>
      </motion.header>

      {/* Leaderboard */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-20">
        {leaderboard.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.div
            ref={listRef}
            className="space-y-2"
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={staggerContainer}
          >
            <AnimatePresence mode="popLayout">
              {leaderboard.map((entry) => {
                const entryKey = String(entry.golfer_id || entry.group_id || entry.position);
                const isTop3 = entry.position <= 3;

                return (
                  <motion.div
                    key={entryKey}
                    layout
                    layoutId={entryKey}
                    variants={rowVariant}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={`rounded-xl border p-4 transition-colors duration-300 ${
                      isTop3
                        ? 'bg-gray-800/80 border-gray-600/50 backdrop-blur-sm'
                        : 'bg-gray-800/40 border-gray-700/30'
                    }`}
                    style={
                      isTop3
                        ? {
                            boxShadow: `0 0 24px ${hexToRgba(
                              entry.position === 1
                                ? '#fbbf24'
                                : entry.position === 2
                                ? '#9ca3af'
                                : '#d97706',
                              0.08
                            )}`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <PositionBadge position={entry.position} />
                        <div>
                          <p className="font-semibold text-gray-100">
                            {scoring_type === 'team' ? entry.team_name : entry.name}
                          </p>
                          {scoring_type === 'team' && entry.golfers && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {entry.golfers.map((g) => g.name).join(' \u00B7 ')}
                            </p>
                          )}
                          {entry.group_number && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Group {entry.group_number}
                            </p>
                          )}
                        </div>
                      </div>

                      <ScoreDisplay
                        displayScore={entry.display_score}
                        totalRelative={entry.total_relative}
                        totalStrokes={entry.total_strokes}
                        thru={entry.thru}
                        entryKey={entryKey}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700/50 py-3">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            Powered by Pacific Golf &middot; Scores update every 30 seconds
          </p>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
};
