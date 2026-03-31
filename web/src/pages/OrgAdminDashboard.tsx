import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { PageTransition } from '../components/ui';
import { useOrganization } from '../components/OrganizationProvider';
import { useAuthToken } from '../hooks/useAuthToken';
import { hexToRgba } from '../utils/colors';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  ChevronRight, 
  Plus,
  Settings,
  Trophy,
  AlertCircle,
  Loader2
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

interface TournamentSummary {
  id: string;
  name: string;
  slug: string;
  date: string;
  status: 'draft' | 'open' | 'closed' | 'completed';
  registration_count: number;
  capacity: number | null;
  revenue: number;
}

interface OrgStats {
  total_tournaments: number;
  active_tournaments: number;
  total_registrations: number;
  total_revenue: number;
}

export const OrgAdminDashboard: React.FC = () => {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getToken } = useAuthToken();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Get Clerk token
        const token = await getToken();
        if (!token) {
          throw new Error('Not authenticated');
        }
        
        // Fetch tournaments for this organization
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch tournaments');
        }

        const data = await response.json();
        setTournaments(data.tournaments || []);
        setStats(data.stats || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organization, getToken]);

  if (orgLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Organization not found</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      open: 'bg-green-100 text-green-700',
      closed: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-brand-100 text-brand-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const primaryColor = organization.primary_color || '#1e40af';

  return (
    <MotionConfig reducedMotion="user">
    <PageTransition>
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease }}
        className="text-white py-8 px-4"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{organization.name}</h1>
              <p className="text-white/80 mt-1">Admin Dashboard</p>
            </div>
            <Link
              to={`/${organization.slug}/admin/settings`}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          >
            <motion.div variants={fadeUp} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: hexToRgba(primaryColor, 0.1) }}>
                  <Trophy className="w-6 h-6" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Tournaments</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_tournaments}</p>
                </div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Now</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.active_tournaments}</p>
                </div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Registrations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_registrations}</p>
                </div>
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_revenue)}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Tournaments Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease }}
          className="bg-white rounded-xl shadow-sm"
        >
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Tournaments</h2>
            <button
              onClick={() => navigate(`/${organization.slug}/admin/tournaments/new`)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-4 h-4" />
              <span>New Tournament</span>
            </button>
          </div>

          {tournaments.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments yet</h3>
              <p className="text-gray-500 mb-6">Create your first tournament to get started.</p>
              <button
                onClick={() => navigate(`/${organization.slug}/admin/tournaments/new`)}
                className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus className="w-4 h-4" />
                <span>Create Tournament</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {tournaments.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 + index * 0.05, ease }}
                >
                  <Link
                    to={`/${organization.slug}/admin/tournaments/${tournament.slug}`}
                    className="flex items-center justify-between p-6 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg" style={{ backgroundColor: hexToRgba(primaryColor, 0.08) }}>
                        <Trophy className="w-6 h-6" style={{ color: primaryColor }} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{tournament.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(tournament.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {tournament.registration_count}
                            {tournament.capacity && ` / ${tournament.capacity}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {getStatusBadge(tournament.status)}
                      <span className="font-medium text-gray-900">
                        {formatCurrency(tournament.revenue)}
                      </span>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
    </PageTransition>
    </MotionConfig>
  );
};
