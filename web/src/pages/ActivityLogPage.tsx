import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useTournament } from '../contexts';
import type { ActivityLog } from '../services/api';
import {
  Clock,
  RefreshCw,
  Loader2,
  Filter,
  DollarSign,
  UserPlus,
  ShieldCheck,
  Play,
  Ban,
  Send,
  CheckCircle,
  Flag,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDateTime } from '../utils/dates';

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  raffle_tickets_sold: DollarSign,
  raffle_ticket_voided: Ban,
  raffle_prize_drawn: Play,
  raffle_prize_reset: RefreshCw,
  raffle_prize_claimed: CheckCircle,
  raffle_draw_all: Play,
  raffle_winner_notification_resent: Send,
  raffle_tickets_synced: RefreshCw,
  golfer_created: UserPlus,
  golfer_updated: Users,
  golfer_checked_in: ShieldCheck,
  payment_verified: DollarSign,
  group_assigned: Flag,
};

const ACTION_COLORS: Record<string, string> = {
  raffle_tickets_sold: 'bg-green-100 text-green-600',
  raffle_ticket_voided: 'bg-red-100 text-red-600',
  raffle_prize_drawn: 'bg-yellow-100 text-yellow-600',
  raffle_prize_reset: 'bg-gray-100 text-gray-600',
  raffle_prize_claimed: 'bg-emerald-100 text-emerald-600',
  raffle_draw_all: 'bg-yellow-100 text-yellow-600',
  raffle_winner_notification_resent: 'bg-blue-100 text-blue-600',
  raffle_tickets_synced: 'bg-purple-100 text-purple-600',
  golfer_created: 'bg-brand-100 text-brand-600',
  golfer_updated: 'bg-blue-100 text-blue-600',
  golfer_checked_in: 'bg-green-100 text-green-600',
  payment_verified: 'bg-green-100 text-green-600',
  group_assigned: 'bg-brand-100 text-brand-600',
};

const ACTION_CATEGORIES = [
  { key: '', label: 'All Activity' },
  { key: 'raffle', label: 'Raffle' },
  { key: 'golfer', label: 'Registrations' },
  { key: 'payment', label: 'Payments' },
  { key: 'check', label: 'Check-In' },
  { key: 'group', label: 'Groups' },
  { key: 'sponsor', label: 'Sponsors' },
];

export const ActivityLogPage: React.FC = () => {
  const { getToken } = useAuth();
  const { activeTournament } = useTournament();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (activeTournament?.id) {
        params.set('tournament_id', String(activeTournament.id));
      } else {
        params.set('all_tournaments', 'true');
      }
      if (categoryFilter) {
        params.set('action_type', categoryFilter);
      }
      params.set('page', String(page));
      params.set('per_page', '30');

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/activity_logs?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.activity_logs || []);
        setTotalPages(data.meta?.total_pages || 1);
        setTotalCount(data.meta?.total_count || 0);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [getToken, activeTournament?.id, categoryFilter, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter]);

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || Clock;
    return Icon;
  };

  const getActionColor = (action: string) => {
    if (ACTION_COLORS[action]) return ACTION_COLORS[action];
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.startsWith(key.split('_')[0])) return color;
    }
    return 'bg-gray-100 text-gray-600';
  };

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-600" />
            Activity Log
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {activeTournament
              ? `Showing activity for ${activeTournament.name}`
              : 'Showing all activity'}
            {totalCount > 0 && ` — ${totalCount} total`}
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-neutral-400 shrink-0" />
        {ACTION_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategoryFilter(cat.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              categoryFilter === cat.key
                ? 'bg-brand-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No activity recorded yet.</p>
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter('')}
                className="mt-2 text-sm text-brand-600 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {logs.map((log) => {
              const Icon = getActionIcon(log.action);
              const colorClass = getActionColor(log.action);
              return (
                <div key={log.id} className="px-4 py-3 sm:px-5 sm:py-4 hover:bg-neutral-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-900">
                        {log.details || formatAction(log.action)}
                      </p>
                      {log.target_name && !log.details?.includes(log.target_name) && (
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Target: {log.target_name}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-600 font-medium">
                          <Users className="w-3 h-3" />
                          {log.admin_name || 'System'}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {formatDateTime(log.created_at)}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded font-mono">
                          {log.action}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-neutral-50">
            <p className="text-sm text-neutral-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-sm font-medium text-neutral-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
