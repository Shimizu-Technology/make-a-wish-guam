import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOrganization } from '../components/OrganizationProvider';
import { 
  Building2, 
  Plus,
  Trash2,
  Edit,
  ArrowLeft,
  RefreshCw,
  Loader2,
  ExternalLink,
  Flag,
  Star,
  Award,
  Medal,
  X,
  GripVertical
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Sponsor {
  id: number;
  name: string;
  tier: string;
  tier_display: string;
  logo_url: string | null;
  website_url: string | null;
  description: string | null;
  hole_number: number | null;
  position: number;
  active: boolean;
  major: boolean;
  display_label: string;
}

interface Tournament {
  id: string;
  name: string;
}

const TIERS = [
  { value: 'title', label: 'Title Sponsor', icon: Star, color: 'text-yellow-500 bg-yellow-50' },
  { value: 'platinum', label: 'Platinum', icon: Award, color: 'text-slate-500 bg-slate-50' },
  { value: 'gold', label: 'Gold', icon: Medal, color: 'text-amber-500 bg-amber-50' },
  { value: 'silver', label: 'Silver', icon: Medal, color: 'text-gray-400 bg-gray-50' },
  { value: 'bronze', label: 'Bronze', icon: Medal, color: 'text-orange-600 bg-orange-50' },
  { value: 'hole', label: 'Hole Sponsor', icon: Flag, color: 'text-green-500 bg-green-50' },
];

export const SponsorManagementPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const { getToken } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    try {
      const token = await getToken();
      
      // Get tournament
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/organizations/${organization.slug}/tournaments/${tournamentSlug}`
      );
      const tournamentData = await tournamentRes.json();
      const tid = tournamentData.id || tournamentData.tournament?.id;
      setTournament({ ...tournamentData, id: tid });

      // Get sponsors
      const sponsorsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tid}/sponsors`,
        { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
      );
      const sponsorsData = await sponsorsRes.json();
      setSponsors(sponsorsData.sponsors || []);

    } catch (err) {
      toast.error('Failed to load sponsors');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (sponsor: Sponsor) => {
    if (!confirm(`Delete sponsor "${sponsor.name}"?`)) return;

    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament?.id}/sponsors/${sponsor.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Sponsor deleted');
      fetchData();
    } catch (err) {
      toast.error('Failed to delete sponsor');
    }
  };

  const getTierInfo = (tier: string) => {
    return TIERS.find(t => t.value === tier) || TIERS[4]; // Default to bronze
  };

  // Group sponsors by tier
  const sponsorsByTier = TIERS.reduce((acc, tier) => {
    acc[tier.value] = sponsors.filter(s => s.tier === tier.value);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header 
        className="text-white py-6 px-4"
        style={{ backgroundColor: organization?.primary_color || '#1e40af' }}
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
                <Building2 className="w-8 h-8" />
                Sponsor Management
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="p-2 bg-white/10 rounded-lg hover:bg-white/20"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setEditingSponsor(null); setShowModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-white text-brand-600 rounded-lg hover:bg-brand-50 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Sponsor
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-brand-500" />
            <div>
              <p className="text-sm text-gray-500">Total Sponsors</p>
              <p className="text-xl font-bold">{sponsors.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <Star className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">Major Sponsors</p>
              <p className="text-xl font-bold">{sponsors.filter(s => s.major).length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
            <Flag className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Hole Sponsors</p>
              <p className="text-xl font-bold">{sponsors.filter(s => s.tier === 'hole').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sponsors by Tier */}
      <main className="max-w-6xl mx-auto px-4 pb-8">
        {TIERS.map(tier => {
          const tierSponsors = sponsorsByTier[tier.value] || [];
          if (tierSponsors.length === 0) return null;

          const TierIcon = tier.icon;

          return (
            <div key={tier.value} className="mb-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                <span className={`p-2 rounded-lg ${tier.color}`}>
                  <TierIcon className="w-5 h-5" />
                </span>
                {tier.label} ({tierSponsors.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierSponsors.map(sponsor => (
                  <div
                    key={sponsor.id}
                    className="bg-white rounded-xl shadow-sm p-4 flex items-start gap-4"
                  >
                    {sponsor.logo_url ? (
                      <img
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        className="w-16 h-16 object-contain rounded-lg bg-gray-50"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{sponsor.name}</h3>
                      <p className="text-sm text-gray-500">{sponsor.display_label}</p>
                      {sponsor.website_url && (
                        <a
                          href={sponsor.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-brand-600 hover:underline flex items-center gap-1 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Website
                        </a>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingSponsor(sponsor); setShowModal(true); }}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(sponsor)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {sponsors.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No sponsors yet. Add your first sponsor!</p>
          </div>
        )}
      </main>

      {/* Sponsor Modal */}
      {showModal && (
        <SponsorModal
          sponsor={editingSponsor}
          tournamentId={tournament?.id || ''}
          onClose={() => { setShowModal(false); setEditingSponsor(null); }}
          onSuccess={() => { setShowModal(false); setEditingSponsor(null); fetchData(); }}
        />
      )}
    </div>
  );
};

// Sponsor Modal Component
const SponsorModal: React.FC<{
  sponsor: Sponsor | null;
  tournamentId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ sponsor, tournamentId, onClose, onSuccess }) => {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: sponsor?.name || '',
    tier: sponsor?.tier || 'bronze',
    logo_url: sponsor?.logo_url || '',
    website_url: sponsor?.website_url || '',
    description: sponsor?.description || '',
    hole_number: sponsor?.hole_number || '',
    active: sponsor?.active ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getToken();
      const url = sponsor
        ? `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/sponsors/${sponsor.id}`
        : `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/sponsors`;

      const payload = {
        ...form,
        hole_number: form.tier === 'hole' ? Number(form.hole_number) : null,
      };

      const res = await fetch(url, {
        method: sponsor ? 'PATCH' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sponsor: payload }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      toast.success(sponsor ? 'Sponsor updated' : 'Sponsor created');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save sponsor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{sponsor ? 'Edit Sponsor' : 'Add Sponsor'}</h2>
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
            <label className="block text-sm font-medium mb-1">Tier</label>
            <select
              value={form.tier}
              onChange={e => setForm({ ...form, tier: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              {TIERS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {form.tier === 'hole' && (
            <div>
              <label className="block text-sm font-medium mb-1">Hole Number *</label>
              <select
                value={form.hole_number}
                onChange={e => setForm({ ...form, hole_number: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              >
                <option value="">Select hole...</option>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(h => (
                  <option key={h} value={h}>Hole {h}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              type="url"
              value={form.logo_url}
              onChange={e => setForm({ ...form, logo_url: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Website URL</label>
            <input
              type="url"
              value={form.website_url}
              onChange={e => setForm({ ...form, website_url: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="https://..."
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })}
            />
            <label htmlFor="active" className="text-sm">Active (visible on public pages)</label>
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
              {saving ? 'Saving...' : (sponsor ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
