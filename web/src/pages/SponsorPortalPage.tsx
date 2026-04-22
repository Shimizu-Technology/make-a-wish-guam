import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail, Loader2, CheckCircle, ArrowRight, User, Phone, Save,
  AlertCircle, Clock, Building2, ExternalLink, Users, Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  clearSponsorPortalSession,
  loadSponsorPortalSession,
  saveSponsorPortalSession,
} from './sponsorPortalSession';

const API_URL = import.meta.env.VITE_API_URL;

interface SponsorSlot {
  id: number;
  slot_number: number;
  player_name: string | null;
  player_email: string | null;
  player_phone: string | null;
}

interface SponsorInfo {
  id: number;
  name: string;
  tier: string;
  tier_display: string;
  slot_count: number;
  tournament_id: number;
  logo_url: string | null;
  website_url: string | null;
}

interface TournamentInfo {
  name: string;
  event_date: string | null;
  sponsor_edit_deadline: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

interface OrgInfo {
  name: string;
  primary_color: string;
}

type VerifiedSponsorPortalData = {
  sponsor: SponsorInfo;
  tournament: TournamentInfo;
  organization: OrgInfo;
  sessionToken: string;
};

// ---------------------------------------------------------------------------
// Login Screen
// ---------------------------------------------------------------------------
const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error('Please enter your email address'); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/sponsor_access/request_link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) { setLinkSent(true); toast.success('Check your email for an access link!'); }
      else { const data = await res.json().catch(() => null); toast.error(data?.error || 'Could not send access link.'); }
    } catch { toast.error('Something went wrong. Please try again.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] flex flex-col">
      {/* Minimal header */}
      <header className="px-6 py-5">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <img src="/images/maw-star-icon.png" alt="Make-A-Wish" className="h-8 rounded" />
          <div>
            <div className="font-bold text-gray-900 text-sm">Sponsor Portal</div>
            <div className="text-gray-500 text-xs">Make-A-Wish Guam & CNMI</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          {!linkSent ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              {/* Branded top accent */}
              <div className="h-1.5 bg-gradient-to-r from-[#0057B8] to-[#003a6e]" />
              <div className="p-8">
                <div className="text-center mb-8">
                  <div className="w-14 h-14 bg-[#0057B8]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-7 h-7 text-[#0057B8]" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Sponsor Portal Login</h1>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Enter the email address associated with your sponsorship. We'll send you a secure access link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Sponsor Email
                    </label>
                    <input
                      type="email" id="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@company.com"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm"
                      disabled={isSubmitting} autoComplete="email" autoFocus
                    />
                  </div>
                  <button
                    type="submit" disabled={isSubmitting || !email.trim()}
                    className="w-full bg-[#0057B8] hover:bg-[#004494] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>) : (<>Send Access Link <ArrowRight className="w-4 h-4" /></>)}
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-gray-400">
                  The link will be valid for 7 days. Contact your event organizer if you need help.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-green-500 to-emerald-500" />
              <div className="p-8 text-center">
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h2>
                <p className="text-gray-500 text-sm mb-6">
                  We've sent an access link to <strong className="text-gray-700">{email}</strong>. Click the link in the email to access your portal.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left">
                  <p className="text-xs text-amber-700">
                    <strong>Don't see it?</strong> Check your spam/junk folder, or wait a minute and try again.
                  </p>
                </div>
                <button onClick={() => { setLinkSent(false); setEmail(''); }} className="text-sm text-[#0057B8] hover:underline font-medium">
                  Try a different email
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Slot Card — compact, two-column layout on desktop
// ---------------------------------------------------------------------------
const SlotCard: React.FC<{
  slot: SponsorSlot;
  playerName: string;
  playerEmail: string;
  playerPhone: string;
  onChangeField: (field: string, value: string) => void;
  onSave: () => void;
  saving: boolean;
  disabled?: boolean;
  brandColor: string;
}> = ({ slot, playerName, playerEmail, playerPhone, onChangeField, onSave, saving, disabled, brandColor }) => {
  const isFilled = !!(slot.player_name?.trim());

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Slot header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: brandColor }}>
            {slot.slot_number}
          </div>
          <span className="font-semibold text-gray-800 text-sm">Player {slot.slot_number}</span>
        </div>
        {isFilled && (
          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
            Filled
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="p-5 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            <User className="w-3 h-3 inline-block mr-1 -mt-0.5" /> Player Name *
          </label>
          <input
            type="text" placeholder="Full name" value={playerName}
            onChange={(e) => onChangeField('player_name', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Mail className="w-3 h-3 inline-block mr-1 -mt-0.5" /> Email
            </label>
            <input
              type="email" placeholder="email@example.com" value={playerEmail}
              onChange={(e) => onChangeField('player_email', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <Phone className="w-3 h-3 inline-block mr-1 -mt-0.5" /> Phone
            </label>
            <input
              type="tel" placeholder="+1671 xxx-xxxx" value={playerPhone}
              onChange={(e) => onChangeField('player_phone', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      {!disabled && (
        <div className="px-5 pb-4">
          <button
            onClick={onSave} disabled={saving}
            className="w-full py-2 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{ backgroundColor: brandColor }}
          >
            {saving ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>) : (<><Save className="w-3.5 h-3.5" /> Save Player {slot.slot_number}</>)}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared confirm helper — calls POST /confirm and returns full data
// ---------------------------------------------------------------------------
async function confirmAccess(token: string, email: string): Promise<
  { ok: true; data: VerifiedSponsorPortalData }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${API_URL}/api/v1/sponsor_access/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Verification failed.' };
    return {
      ok: true,
      data: {
        sponsor: data.sponsor,
        tournament: data.tournament,
        organization: data.organization,
        sessionToken: data.session_token,
      },
    };
  } catch {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// Email Verification Gate — shown after clicking magic link, before dashboard
// ---------------------------------------------------------------------------
const EmailVerification: React.FC<{
  token: string;
  sponsorName: string;
  onVerified: (data: VerifiedSponsorPortalData) => void;
}> = ({ token, sponsorName, onVerified }) => {
  const [email, setEmail] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setVerifying(true);
    setErrorMsg('');

    const result = await confirmAccess(token, email.trim());
    if (!result.ok) {
      setErrorMsg(result.error);
      setVerifying(false);
      return;
    }

    saveSponsorPortalSession(token, result.data);
    onVerified(result.data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] flex flex-col">
      <header className="px-6 py-5">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <img src="/images/maw-star-icon.png" alt="Make-A-Wish" className="h-8 rounded" />
          <div>
            <div className="font-bold text-gray-900 text-sm">Sponsor Portal</div>
            <div className="text-gray-500 text-xs">Make-A-Wish Guam & CNMI</div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#0057B8] to-[#003a6e]" />
            <div className="p-8">
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-[#0057B8]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-7 h-7 text-[#0057B8]" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-1">Verify Your Identity</h1>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Welcome, <strong className="text-gray-700">{sponsorName}</strong>. For security, please confirm your email address to access the portal.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="verify-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Sponsor Email Address
                  </label>
                  <input
                    type="email" id="verify-email" value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrorMsg(''); }}
                    placeholder="your@company.com"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm ${
                      errorMsg ? 'border-red-300' : 'border-gray-200'
                    }`}
                    disabled={verifying} autoComplete="email" autoFocus
                  />
                  {errorMsg && (
                    <p className="mt-2 text-sm text-red-600 flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {errorMsg}
                    </p>
                  )}
                </div>

                <button
                  type="submit" disabled={verifying || !email.trim()}
                  className="w-full bg-[#0057B8] hover:bg-[#004494] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {verifying ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>) : (<><Shield className="w-4 h-4" /> Verify & Continue</>)}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-gray-400">
                Enter the email address your organization used to set up this sponsorship.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard (fully authenticated view)
// ---------------------------------------------------------------------------
const Dashboard: React.FC<{
  sessionToken: string;
  initialSponsor: SponsorInfo;
  initialTournament: TournamentInfo;
  initialOrg: OrgInfo;
  onSessionExpired: () => void;
}> = ({ sessionToken, initialSponsor, initialTournament, initialOrg, onSessionExpired }) => {
  const [sponsor] = useState<SponsorInfo>(initialSponsor);
  const [tournamentInfo] = useState<TournamentInfo>(initialTournament);
  const [orgInfo] = useState<OrgInfo>(initialOrg);
  const [slots, setSlots] = useState<SponsorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [localEdits, setLocalEdits] = useState<Record<number, { player_name: string; player_email: string; player_phone: string }>>({});
  const [savingSlots, setSavingSlots] = useState<Record<number, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);

  const brandColor = orgInfo?.primary_color || '#0057B8';
  const deadlinePassed = tournamentInfo?.sponsor_edit_deadline
    ? new Date(tournamentInfo.sponsor_edit_deadline) < new Date()
    : false;

  const formatDeadline = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  };

  const initLocalEdits = (slotsData: SponsorSlot[]) => {
    const edits: Record<number, { player_name: string; player_email: string; player_phone: string }> = {};
    slotsData.forEach(s => {
      edits[s.id] = {
        player_name: s.player_name || '',
        player_email: s.player_email || '',
        player_phone: s.player_phone || '',
      };
    });
    setLocalEdits(edits);
  };

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/sponsor_slots`, { headers: { 'X-Sponsor-Session': sessionToken } });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const slotsData = data.slots || data;
        setSlots(slotsData);
        initLocalEdits(slotsData);
      }
    } catch { /* silent */ }
  }, [onSessionExpired, sessionToken]);

  useEffect(() => {
    fetchSlots().then(() => setLoading(false));
  }, [fetchSlots]);

  const updateSlotInPlace = (slotId: number, saved: { player_name: string | null; player_email: string | null; player_phone: string | null }) => {
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, ...saved } : s));
    setLocalEdits(prev => ({
      ...prev,
      [slotId]: {
        player_name: saved.player_name || '',
        player_email: saved.player_email || '',
        player_phone: saved.player_phone || '',
      },
    }));
  };

  const saveSlot = async (slot: SponsorSlot) => {
    const edits = localEdits[slot.id];
    if (!edits) return;
    const trimmed = { player_name: edits.player_name.trim() || null, player_email: edits.player_email.trim() || null, player_phone: edits.player_phone.trim() || null };
    setSavingSlots(prev => ({ ...prev, [slot.id]: true }));
    try {
      const res = await fetch(`${API_URL}/api/v1/sponsor_slots/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Sponsor-Session': sessionToken },
        body: JSON.stringify(trimmed),
      });
      if (res.status === 401) {
        onSessionExpired();
        return;
      }
      if (res.ok) { toast.success(`Player ${slot.slot_number} saved`); updateSlotInPlace(slot.id, trimmed); }
      else { const data = await res.json().catch(() => null); toast.error(data?.error || 'Failed to save.'); }
    } catch { toast.error('Something went wrong.'); }
    finally { setSavingSlots(prev => ({ ...prev, [slot.id]: false })); }
  };

  const saveAllSlots = async () => {
    setSavingAll(true);
    let success = 0, failed = 0;
    try {
      for (const slot of slots) {
        const edits = localEdits[slot.id];
        if (!edits) continue;
        const trimmed = { player_name: edits.player_name.trim() || null, player_email: edits.player_email.trim() || null, player_phone: edits.player_phone.trim() || null };
        try {
          const res = await fetch(`${API_URL}/api/v1/sponsor_slots/${slot.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Sponsor-Session': sessionToken },
            body: JSON.stringify(trimmed),
          });
          if (res.status === 401) {
            onSessionExpired();
            return;
          }
          if (res.ok) { success++; updateSlotInPlace(slot.id, trimmed); }
          else failed++;
        } catch { failed++; }
      }
      if (failed === 0) toast.success(`All ${success} players saved!`);
      else toast.error(`${failed} slot(s) failed to save`);
    } finally {
      setSavingAll(false);
    }
  };

  const updateLocalEdit = (slotId: number, field: string, value: string) => {
    setLocalEdits(prev => ({ ...prev, [slotId]: { ...prev[slotId], [field]: value } }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0057B8] mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading your portal...</p>
        </div>
      </div>
    );
  }

  const teamCount = Math.floor(sponsor.slot_count / 2);
  const filledCount = slots.filter(s => s.player_name?.trim()).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] flex flex-col">
      {/* Header */}
      <header className="text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${darkenColor(brandColor, 20)} 100%)` }}>
        <div className="max-w-4xl mx-auto px-5 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/maw-star-icon.png" alt="" className="h-8 rounded opacity-90" />
              <div>
                <div className="text-white/70 text-xs font-medium tracking-wide uppercase">{orgInfo?.name || 'Make-A-Wish Guam & CNMI'}</div>
                <div className="font-bold text-base">{tournamentInfo?.name || 'Sponsor Portal'}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sponsor identity card */}
      <div className="max-w-4xl mx-auto w-full px-5 mt-5">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
          <div className="flex items-center gap-4">
            {sponsor.logo_url ? (
              <img src={sponsor.logo_url} alt={sponsor.name} className="w-14 h-14 object-contain rounded-xl bg-gray-50 p-1.5 flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-lg truncate">{sponsor.name}</h1>
              <p className="text-sm text-gray-500">{sponsor.tier_display}</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
              <Users className="w-3.5 h-3.5" />
              {teamCount} team{teamCount !== 1 ? 's' : ''} ({sponsor.slot_count} player{sponsor.slot_count !== 1 ? 's' : ''})
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
              filledCount === sponsor.slot_count ? 'bg-green-50 text-green-700' : filledCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'
            }`}>
              <CheckCircle className="w-3.5 h-3.5" />
              {filledCount}/{sponsor.slot_count} filled
            </div>
            {sponsor.website_url && (
              <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100">
                <ExternalLink className="w-3.5 h-3.5" /> Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Deadline warning */}
      {tournamentInfo?.sponsor_edit_deadline && (
        <div className="max-w-4xl mx-auto w-full px-5 mt-4">
          {deadlinePassed ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-800 text-sm">Deadline Passed</div>
                <div className="text-red-600 text-xs mt-0.5">
                  The deadline was {formatDeadline(tournamentInfo.sponsor_edit_deadline)}. Changes are no longer accepted.
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-800 text-sm">
                  Deadline: {formatDeadline(tournamentInfo.sponsor_edit_deadline)}
                </div>
                <div className="text-amber-600 text-xs mt-0.5">Please submit all player information before this date.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Teams & Slots */}
      <main className="flex-1 px-5 pt-6 pb-28">
        <div className="max-w-4xl mx-auto space-y-6">
          {(() => {
            const teams: SponsorSlot[][] = [];
            for (let i = 0; i < slots.length; i += 2) {
              teams.push(slots.slice(i, i + 2));
            }
            return teams.map((teamSlots, teamIdx) => (
              <div key={teamIdx}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: brandColor }}>
                    {teamIdx + 1}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700">Team {teamIdx + 1}</h3>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {teamSlots.map((slot) => (
                    <SlotCard
                      key={slot.id}
                      slot={slot}
                      playerName={localEdits[slot.id]?.player_name || ''}
                      playerEmail={localEdits[slot.id]?.player_email || ''}
                      playerPhone={localEdits[slot.id]?.player_phone || ''}
                      onChangeField={(field, value) => updateLocalEdit(slot.id, field, value)}
                      onSave={() => saveSlot(slot)}
                      saving={savingSlots[slot.id] || false}
                      disabled={deadlinePassed}
                      brandColor={brandColor}
                    />
                  ))}
                </div>
              </div>
            ));
          })()}

          {slots.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No player slots have been assigned yet.</p>
              <p className="text-gray-400 text-xs mt-1">Please contact the event organizer.</p>
            </div>
          )}
        </div>
      </main>

      {/* Save All sticky footer */}
      {slots.length > 0 && !deadlinePassed && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 z-20">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={saveAllSlots} disabled={savingAll}
              className="w-full text-white rounded-xl py-3 font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: brandColor }}
            >
              {savingAll ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving All...</>) : (<><Save className="w-4 h-4" /> Save All Changes</>)}
            </button>
            {tournamentInfo?.contact_email && (
              <p className="text-center text-[10px] text-gray-400 mt-2">
                Need help? Contact <a href={`mailto:${tournamentInfo.contact_email}`} className="text-blue-500 hover:underline">{tournamentInfo.contact_name || tournamentInfo.contact_email}</a>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Simple color utility
function darkenColor(hex: string, percent: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#000000';
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * (1 - percent / 100)));
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * (1 - percent / 100)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Authenticated Flow — verify token, then email gate, then dashboard
// ---------------------------------------------------------------------------
const AuthenticatedFlow: React.FC<{ token: string }> = ({ token }) => {
  type Phase = 'loading' | 'email_verify' | 'dashboard' | 'error';
  const [phase, setPhase] = useState<Phase>('loading');
  const [sponsorName, setSponsorName] = useState('');
  const [error, setError] = useState('');
  const [verifiedData, setVerifiedData] = useState<VerifiedSponsorPortalData | null>(null);

  const handleSessionExpired = useCallback(() => {
    clearSponsorPortalSession(token);
    setSponsorName((prev) => prev || verifiedData?.sponsor.name || 'Sponsor');
    setVerifiedData(null);
    setPhase('email_verify');
    toast.error('Your sponsor session expired. Please verify your email again.');
  }, [token, verifiedData?.sponsor.name]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedSession = loadSponsorPortalSession<VerifiedSponsorPortalData>(token);
      if (savedSession) {
        if (!cancelled) {
          setVerifiedData(savedSession);
          setSponsorName(savedSession.sponsor.name);
          setPhase('dashboard');
        }
        return;
      }

      if (cancelled) return;

      try {
        const res = await fetch(`${API_URL}/api/v1/sponsor_access/verify?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
          if (!cancelled) { setError('Invalid or expired access link. Please request a new one.'); setPhase('error'); }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setSponsorName(data.sponsor_name || 'Sponsor');
          setPhase('email_verify');
        }
      } catch {
        if (!cancelled) { setError('Could not verify your access link. Please try again.'); setPhase('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0057B8] mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verifying your access link...</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] px-6">
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="font-bold text-gray-900 text-lg mb-2">Access Denied</h2>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <a href="/sponsor-portal" className="inline-flex items-center gap-2 text-[#0057B8] font-medium text-sm hover:underline">
            <ArrowRight className="w-4 h-4 rotate-180" /> Request a new link
          </a>
        </div>
      </div>
    );
  }

  if (phase === 'email_verify') {
    return (
      <EmailVerification
        token={token}
        sponsorName={sponsorName}
        onVerified={(data) => {
          setVerifiedData(data);
          setPhase('dashboard');
        }}
      />
    );
  }

  if (phase === 'dashboard' && verifiedData) {
    return (
      <Dashboard
        sessionToken={verifiedData.sessionToken}
        initialSponsor={verifiedData.sponsor}
        initialTournament={verifiedData.tournament}
        initialOrg={verifiedData.organization}
        onSessionExpired={handleSessionExpired}
      />
    );
  }

  return null;
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export const SponsorPortalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return token ? <AuthenticatedFlow token={token} /> : <LoginScreen />;
};

export default SponsorPortalPage;
