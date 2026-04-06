import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOrganization } from '../components/OrganizationProvider';
import {
  Building2, Plus, Trash2, Edit, ArrowLeft, RefreshCw, Loader2,
  ExternalLink, Flag, Star, Award, Medal, X, Mail, Upload, Users,
  ChevronDown, ChevronUp, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminEventPath } from '../utils/adminRoutes';

interface SponsorSlot {
  id: number;
  slot_number: number;
  player_name: string | null;
  player_email: string | null;
  player_phone: string | null;
  confirmed_at: string | null;
}

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
  slot_count: number;
  login_email: string | null;
  slots_filled: number;
}

interface TierDefinition {
  key: string;
  label: string;
  sort_order: number;
}

interface Tournament {
  id: string;
  name: string;
  sponsor_tiers?: TierDefinition[];
}

const DEFAULT_TIERS: TierDefinition[] = [
  { key: 'title', label: 'Title Sponsor', sort_order: 0 },
  { key: 'platinum', label: 'Platinum', sort_order: 1 },
  { key: 'gold', label: 'Gold', sort_order: 2 },
  { key: 'silver', label: 'Silver', sort_order: 3 },
  { key: 'bronze', label: 'Bronze', sort_order: 4 },
  { key: 'hole', label: 'Hole Sponsor', sort_order: 5 },
];

const TIER_COLORS = [
  'text-yellow-500 bg-yellow-50',
  'text-slate-500 bg-slate-50',
  'text-amber-500 bg-amber-50',
  'text-gray-400 bg-gray-50',
  'text-orange-600 bg-orange-50',
  'text-green-500 bg-green-50',
  'text-blue-500 bg-blue-50',
  'text-purple-500 bg-purple-50',
];

const TIER_ICONS = [Star, Award, Medal, Medal, Medal, Flag, Medal, Medal];

function buildTiers(tierDefs: TierDefinition[]) {
  return tierDefs
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t, i) => ({
      value: t.key,
      label: t.label,
      icon: TIER_ICONS[i % TIER_ICONS.length],
      color: TIER_COLORS[i % TIER_COLORS.length],
    }));
}

export const SponsorManagementPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const { getToken } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [expandedSponsor, setExpandedSponsor] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;
    try {
      const token = await getToken();
      const tournamentRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/organizations/${organization.slug}/tournaments/${tournamentSlug}`
      );
      const tournamentData = await tournamentRes.json();
      const tid = tournamentData.id || tournamentData.tournament?.id;
      setTournament({ ...tournamentData, id: tid, sponsor_tiers: tournamentData.sponsor_tiers });

      const sponsorsRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tid}/sponsors`,
        { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
      );
      const sponsorsData = await sponsorsRes.json();
      setSponsors(sponsorsData.sponsors || []);
    } catch {
      toast.error('Failed to load sponsors');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug, getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendAccessLink = async (sponsor: Sponsor) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/sponsor_access/request_link`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: sponsor.login_email }) }
      );
      if (res.ok) toast.success('Access link sent!');
      else toast.error('Failed to send access link');
    } catch { toast.error('Failed to send access link'); }
  };

  const handleDelete = async (sponsor: Sponsor) => {
    if (!confirm(`Delete sponsor "${sponsor.name}"?`)) return;
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament?.id}/sponsors/${sponsor.id}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Sponsor deleted');
      fetchData();
    } catch { toast.error('Failed to delete sponsor'); }
  };

  const TIERS = buildTiers(tournament?.sponsor_tiers || DEFAULT_TIERS);

  const sponsorsByTier = TIERS.reduce((acc, tier) => {
    acc[tier.value] = sponsors.filter(s => s.tier === tier.value);
    return acc;
  }, {} as Record<string, Sponsor[]>);

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
        style={{ backgroundColor: organization?.primary_color || '#0057B8' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Link to={adminEventPath(tournamentSlug || '')} className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-1 sm:mb-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to Tournament
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
                <Building2 className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" /> Sponsor Management
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button onClick={fetchData} className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
                <RefreshCw className="w-5 h-5" />
              </button>
              <button onClick={() => { setEditingSponsor(null); setShowModal(true); }} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-brand-600 rounded-lg hover:bg-brand-50 font-medium text-sm">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Sponsor
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <Building2 className="w-6 h-6 sm:w-8 sm:h-8 text-brand-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">Total Sponsors</p>
              <p className="text-lg sm:text-xl font-bold">{sponsors.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <Star className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">Major Sponsors</p>
              <p className="text-lg sm:text-xl font-bold">{sponsors.filter(s => s.major).length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 col-span-2 sm:col-span-1">
            <Flag className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500">Hole Sponsors</p>
              <p className="text-lg sm:text-xl font-bold">{sponsors.filter(s => s.tier === 'hole').length}</p>
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
                <span className={`p-2 rounded-lg ${tier.color}`}><TierIcon className="w-5 h-5" /></span>
                {tier.label} ({tierSponsors.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tierSponsors.map(sponsor => (
                  <SponsorCard
                    key={sponsor.id}
                    sponsor={sponsor}
                    tournamentId={tournament?.id || ''}
                    expanded={expandedSponsor === sponsor.id}
                    onToggleExpand={() => setExpandedSponsor(expandedSponsor === sponsor.id ? null : sponsor.id)}
                    onEdit={() => { setEditingSponsor(sponsor); setShowModal(true); }}
                    onDelete={() => handleDelete(sponsor)}
                    onSendPortalLink={() => handleSendAccessLink(sponsor)}
                    onSlotsUpdated={fetchData}
                  />
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

      {showModal && (
        <SponsorModal
          sponsor={editingSponsor}
          tournamentId={tournament?.id || ''}
          tiers={TIERS}
          onClose={() => { setShowModal(false); setEditingSponsor(null); }}
          onSuccess={() => { setShowModal(false); setEditingSponsor(null); fetchData(); }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sponsor Card with expandable player slots
// ---------------------------------------------------------------------------
const SponsorCard: React.FC<{
  sponsor: Sponsor;
  tournamentId: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSendPortalLink: () => void;
  onSlotsUpdated: () => void;
}> = ({ sponsor, tournamentId, expanded, onToggleExpand, onEdit, onDelete, onSendPortalLink, onSlotsUpdated }) => {
  const { getToken } = useAuth();
  const teamCount = Math.floor(sponsor.slot_count / 2);
  const hasPortal = !!sponsor.login_email;
  const hasTeams = sponsor.slot_count > 0;

  const [slots, setSlots] = useState<SponsorSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [slotForm, setSlotForm] = useState({ player_name: '', player_email: '', player_phone: '' });
  const [savingSlot, setSavingSlot] = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!tournamentId) return;
    setLoadingSlots(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/sponsors/${sponsor.id}/slots`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch { /* silent */ } finally {
      setLoadingSlots(false);
    }
  }, [tournamentId, sponsor.id, getToken]);

  useEffect(() => {
    if (expanded && hasTeams) fetchSlots();
  }, [expanded, hasTeams, fetchSlots]);

  const startEditing = (slot: SponsorSlot) => {
    setEditingSlotId(slot.id);
    setSlotForm({
      player_name: slot.player_name || '',
      player_email: slot.player_email || '',
      player_phone: slot.player_phone || '',
    });
  };

  const saveSlot = async (slotId: number) => {
    setSavingSlot(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/sponsors/${sponsor.id}/slots/${slotId}`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(slotForm),
        }
      );
      if (res.ok) {
        toast.success('Player updated');
        setEditingSlotId(null);
        fetchSlots();
        onSlotsUpdated();
      } else {
        toast.error('Failed to update');
      }
    } catch { toast.error('Failed to update'); } finally {
      setSavingSlot(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        {sponsor.logo_url ? (
          <img src={sponsor.logo_url} alt={sponsor.name} className="w-10 h-10 object-contain rounded-lg bg-gray-50 flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-sm">{sponsor.name}</h3>
          <p className="text-xs text-gray-500">{sponsor.display_label}</p>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-gray-100 rounded-lg">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metadata pills */}
      {(hasTeams || hasPortal || sponsor.website_url) && (
        <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
          {hasTeams && (
            <button
              onClick={onToggleExpand}
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium transition ${
                (sponsor.slots_filled || 0) >= sponsor.slot_count
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : (sponsor.slots_filled || 0) > 0
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Users className="w-2.5 h-2.5" />
              {teamCount} team{teamCount !== 1 ? 's' : ''} ({sponsor.slots_filled || 0}/{sponsor.slot_count})
              {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </button>
          )}
          {sponsor.website_url && (
            <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
              <ExternalLink className="w-2.5 h-2.5" /> Website
            </a>
          )}
          {hasPortal && (
            <button onClick={onSendPortalLink} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 hover:bg-brand-100 font-medium">
              <Mail className="w-2.5 h-2.5" /> Send Portal Link
            </button>
          )}
        </div>
      )}

      {/* Expandable player slots */}
      {expanded && hasTeams && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <div className="px-4 py-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sponsored Players</p>
          </div>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : slots.length === 0 ? (
            <p className="px-4 pb-3 text-xs text-gray-400">No player slots configured.</p>
          ) : (
            <div className="px-3 pb-3 space-y-3">
              {(() => {
                const teams: typeof slots[] = [];
                for (let i = 0; i < slots.length; i += 2) teams.push(slots.slice(i, i + 2));
                return teams.map((teamSlots, teamIdx) => (
                  <div key={teamIdx}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 px-1">Team {teamIdx + 1}</p>
                    <div className="space-y-1.5">
                      {teamSlots.map(slot => (
                        <div key={slot.id} className="bg-white rounded-lg border border-gray-200 p-2.5">
                          {editingSlotId === slot.id ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">#{slot.slot_number}</span>
                                <input
                                  type="text"
                                  placeholder="Player name"
                                  value={slotForm.player_name}
                                  onChange={e => setSlotForm({ ...slotForm, player_name: e.target.value })}
                                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-brand-400 focus:outline-none"
                                />
                              </div>
                              <div className="flex gap-2 pl-6">
                                <input
                                  type="email"
                                  placeholder="Email"
                                  value={slotForm.player_email}
                                  onChange={e => setSlotForm({ ...slotForm, player_email: e.target.value })}
                                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-brand-400 focus:outline-none"
                                />
                                <input
                                  type="tel"
                                  placeholder="Phone"
                                  value={slotForm.player_phone}
                                  onChange={e => setSlotForm({ ...slotForm, player_phone: e.target.value })}
                                  className="w-28 text-xs border border-gray-200 rounded px-2 py-1.5 focus:border-brand-400 focus:outline-none"
                                />
                              </div>
                              <div className="flex justify-end gap-1.5 pl-6">
                                <button onClick={() => setEditingSlotId(null)} className="text-[11px] px-2 py-1 rounded text-gray-500 hover:bg-gray-100">Cancel</button>
                                <button
                                  onClick={() => saveSlot(slot.id)}
                                  disabled={savingSlot}
                                  className="text-[11px] px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <Save className="w-2.5 h-2.5" /> Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">#{slot.slot_number}</span>
                              {slot.player_name ? (
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-gray-900 truncate">{slot.player_name}</p>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {[slot.player_email, slot.player_phone].filter(Boolean).join(' · ') || 'No contact info'}
                                  </p>
                                </div>
                              ) : (
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-400 italic">Empty slot</p>
                                </div>
                              )}
                              <button
                                onClick={() => startEditing(slot)}
                                className="p-1 text-gray-400 hover:text-brand-600 hover:bg-gray-100 rounded flex-shrink-0"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sponsor Modal (Create / Edit)
// ---------------------------------------------------------------------------
const SponsorModal: React.FC<{
  sponsor: Sponsor | null;
  tournamentId: string;
  tiers: { value: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ sponsor, tournamentId, tiers, onClose, onSuccess }) => {
  const { getToken } = useAuth();
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: sponsor?.name || '',
    tier: sponsor?.tier || tiers[tiers.length - 1]?.value || 'bronze',
    logo_url: sponsor?.logo_url || '',
    website_url: sponsor?.website_url || '',
    description: sponsor?.description || '',
    hole_number: sponsor?.hole_number || '',
    active: sponsor?.active ?? true,
    login_email: (sponsor as any)?.login_email || '',
    team_count: Math.floor((sponsor?.slot_count || 0) / 2),
  });

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setForm({ ...form, logo_url: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      const url = sponsor
        ? `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/sponsors/${sponsor.id}`
        : `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/sponsors`;
      const slotCount = form.team_count * 2;
      let res: Response;

      if (logoFile) {
        const fd = new FormData();
        fd.append('sponsor[name]', form.name);
        fd.append('sponsor[tier]', form.tier);
        fd.append('sponsor[logo_url]', '');
        fd.append('sponsor[website_url]', form.website_url);
        fd.append('sponsor[description]', form.description);
        fd.append('sponsor[hole_number]', form.tier === 'hole' ? String(form.hole_number) : '');
        fd.append('sponsor[active]', String(form.active));
        fd.append('sponsor[login_email]', form.login_email);
        fd.append('sponsor[slot_count]', String(slotCount));
        fd.append('sponsor[logo]', logoFile);
        res = await fetch(url, { method: sponsor ? 'PATCH' : 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      } else {
        const payload = { ...form, slot_count: slotCount, hole_number: form.tier === 'hole' ? Number(form.hole_number) : null };
        delete (payload as any).team_count;
        res = await fetch(url, {
          method: sponsor ? 'PATCH' : 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ sponsor: payload }),
        });
      }

      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to save'); }
      toast.success(sponsor ? 'Sponsor updated' : 'Sponsor created');
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save sponsor');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{sponsor ? 'Edit Sponsor' : 'Add Sponsor'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tier</label>
            <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className="w-full border rounded-lg px-3 py-2">
              {tiers.map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>

          {form.tier === 'hole' && (
            <div>
              <label className="block text-sm font-medium mb-1">Hole Number *</label>
              <select value={form.hole_number} onChange={e => setForm({ ...form, hole_number: e.target.value })} className="w-full border rounded-lg px-3 py-2" required>
                <option value="">Select hole...</option>
                {Array.from({ length: 18 }, (_, i) => i + 1).map(h => (<option key={h} value={h}>Hole {h}</option>))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Sponsor Logo</label>
            <div className="space-y-2">
              <label className="flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-neutral-300 rounded-xl cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition text-sm text-neutral-500">
                <Upload className="w-4 h-4" /> {logoFile ? logoFile.name : 'Upload image'}
                <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
              </label>
              {!logoFile && (
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Or paste a URL:</p>
                  <input type="url" placeholder="https://example.com/logo.png" value={form.logo_url}
                    onChange={e => { setForm({ ...form, logo_url: e.target.value }); setLogoFile(null); setLogoPreview(null); }}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#0057B8] focus:outline-none focus:ring-2 focus:ring-[#0057B8]/20" />
                </div>
              )}
              {(logoPreview || form.logo_url) && (
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 flex items-center gap-3">
                  <img src={logoPreview || form.logo_url} alt="Preview" className="max-h-10 max-w-24 object-contain" />
                  <span className="text-xs text-neutral-500">Logo preview</span>
                  {logoFile && (<button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); }} className="ml-auto text-xs text-red-500 hover:underline">Remove</button>)}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Website URL</label>
            <input type="url" value={form.website_url} onChange={e => setForm({ ...form, website_url: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={2} />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Portal Login Email <span className="text-xs text-neutral-400 ml-1">(sponsor receives a magic link to manage their teams)</span>
            </label>
            <input type="email" placeholder="sponsor@company.com" value={form.login_email || ''}
              onChange={e => setForm({ ...form, login_email: e.target.value })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#0057B8] focus:outline-none focus:ring-2 focus:ring-[#0057B8]/20" />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Sponsored Teams <span className="text-xs text-neutral-400 ml-1">(each team = 2 players)</span>
            </label>
            <input type="number" min="0" max="10" placeholder="0" value={form.team_count || 0}
              onChange={e => setForm({ ...form, team_count: parseInt(e.target.value) || 0 })}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#0057B8] focus:outline-none focus:ring-2 focus:ring-[#0057B8]/20" />
            {form.team_count > 0 && (<p className="text-xs text-neutral-500 mt-1">= {form.team_count * 2} player slots in the sponsor portal</p>)}
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            <label htmlFor="active" className="text-sm">Active (visible on public pages)</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : (sponsor ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
