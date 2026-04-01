import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail,
  Loader2,
  CheckCircle,
  ArrowRight,
  User,
  Phone,
  Save,
  AlertCircle,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
}

// ---------------------------------------------------------------------------
// Login Screen
// ---------------------------------------------------------------------------
const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/sponsor_access/request_link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (res.ok) {
        setLinkSent(true);
        toast.success('Check your email for an access link!');
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Could not send access link. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {!linkSent ? (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-[#0057B8]" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Sponsor Portal
              </h2>
              <p className="text-gray-600">
                Enter your sponsor email to receive a magic link and manage your
                player slots.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Enter your sponsor email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sponsor@example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0057B8] focus:border-[#0057B8] text-lg"
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="w-full bg-[#0057B8] hover:bg-[#003a6e] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Access Link
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              The link will be valid for 7 days.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Check Your Email!
            </h2>
            <p className="text-gray-600 mb-6">
              We've sent an access link to <strong>{email}</strong>. Click the
              link in the email to manage your player slots.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>Don't see the email?</strong> Check your spam folder, or
                wait a minute and try again.
              </p>
            </div>

            <button
              onClick={() => {
                setLinkSent(false);
                setEmail('');
              }}
              className="text-[#0057B8] hover:text-[#003a6e] font-medium"
            >
              Try a different email
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

// ---------------------------------------------------------------------------
// Slot Card
// ---------------------------------------------------------------------------
interface SlotCardProps {
  slot: SponsorSlot;
  playerName: string;
  playerEmail: string;
  playerPhone: string;
  onChangeField: (field: string, value: string) => void;
  onSave: () => void;
  saving: boolean;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, playerName, playerEmail, playerPhone, onChangeField, onSave, saving }) => {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#0057B8] text-white flex items-center justify-center text-sm font-bold">
            {slot.slot_number}
          </div>
          <span className="font-semibold text-neutral-900">Player Slot {slot.slot_number}</span>
        </div>
        {slot.player_name && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            Filled
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            <User className="w-3 h-3 inline-block mr-1" />
            Player Name *
          </label>
          <input
            type="text"
            placeholder="Player Name *"
            value={playerName}
            onChange={(e) => onChangeField('player_name', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            <Mail className="w-3 h-3 inline-block mr-1" />
            Email Address
          </label>
          <input
            type="email"
            placeholder="Email Address"
            value={playerEmail}
            onChange={(e) => onChangeField('player_email', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            <Phone className="w-3 h-3 inline-block mr-1" />
            Phone
          </label>
          <input
            type="tel"
            placeholder="+1671 xxx-xxxx"
            value={playerPhone}
            onChange={(e) => onChangeField('player_phone', e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#0057B8]/20 focus:border-[#0057B8] text-sm"
          />
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="mt-4 w-full bg-[#0057B8] text-white rounded-xl py-2.5 font-medium hover:bg-[#003a6e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Player {slot.slot_number}
          </>
        )}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard (authenticated view)
// ---------------------------------------------------------------------------
const Dashboard: React.FC<{ token: string }> = ({ token }) => {
  const [sponsor, setSponsor] = useState<SponsorInfo | null>(null);
  const [slots, setSlots] = useState<SponsorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<number, { player_name: string; player_email: string; player_phone: string }>>({});
  const [savingSlots, setSavingSlots] = useState<Record<number, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);

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
      const res = await fetch(`${API_URL}/api/v1/sponsor_slots`, {
        headers: { 'X-Sponsor-Token': token },
      });
      if (res.ok) {
        const data = await res.json();
        const slotsData = data.slots || data;
        setSlots(slotsData);
        initLocalEdits(slotsData);
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/v1/sponsor_access/verify?token=${encodeURIComponent(token)}`
        );

        if (!res.ok) {
          setError('Invalid or expired access link. Please request a new one.');
          setLoading(false);
          return;
        }

        const data = await res.json();

        if (!cancelled) {
          setSponsor(data.sponsor);
          const slotsRes = await fetch(`${API_URL}/api/v1/sponsor_slots`, {
            headers: { 'X-Sponsor-Token': token },
          });
          if (slotsRes.ok) {
            const slotsData = await slotsRes.json();
            const slotsList = slotsData.slots || slotsData;
            setSlots(slotsList);
            initLocalEdits(slotsList);
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Could not verify your access link. Please try again.');
          setLoading(false);
        }
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [token]);

  const saveSlot = async (slot: SponsorSlot) => {
    const edits = localEdits[slot.id];
    if (!edits) return;

    setSavingSlots(prev => ({ ...prev, [slot.id]: true }));
    try {
      const res = await fetch(`${API_URL}/api/v1/sponsor_slots/${slot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Sponsor-Token': token,
        },
        body: JSON.stringify({
          player_name: edits.player_name.trim() || null,
          player_email: edits.player_email.trim() || null,
          player_phone: edits.player_phone.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success(`Slot ${slot.slot_number} saved`);
        await fetchSlots();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to save. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSavingSlots(prev => ({ ...prev, [slot.id]: false }));
    }
  };

  const saveAllSlots = async () => {
    setSavingAll(true);
    let success = 0;
    let failed = 0;

    for (const slot of slots) {
      const edits = localEdits[slot.id];
      if (!edits) continue;

      try {
        const res = await fetch(`${API_URL}/api/v1/sponsor_slots/${slot.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Sponsor-Token': token,
          },
          body: JSON.stringify({
            player_name: edits.player_name.trim() || null,
            player_email: edits.player_email.trim() || null,
            player_phone: edits.player_phone.trim() || null,
          }),
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }

    if (failed === 0) {
      toast.success(`All ${success} slots saved!`);
    } else {
      toast.error(`${failed} slot(s) failed to save`);
    }

    await fetchSlots();
    setSavingAll(false);
  };

  const updateLocalEdit = (slotId: number, field: string, value: string) => {
    setLocalEdits(prev => ({
      ...prev,
      [slotId]: { ...prev[slotId], [field]: value },
    }));
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0057B8] mx-auto mb-3" />
          <p className="text-gray-600">Verifying your access link...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-[#E31837]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href="/sponsor-portal"
            className="inline-flex items-center gap-2 text-[#0057B8] hover:text-[#003a6e] font-medium"
          >
            Request a new access link
          </a>
        </div>
      </main>
    );
  }

  if (!sponsor) return null;

  return (
    <>
      {/* Deadline warning */}
      <div className="max-w-3xl mx-auto px-6 pt-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-900">Deadline: May 2, 2026 at 7:30 AM</div>
            <div className="text-amber-700 text-sm">Changes to player slots must be submitted before check-in begins.</div>
          </div>
        </div>
      </div>

      {/* Slots */}
      <main className="flex-1 px-6 pb-28">
        <div className="max-w-3xl mx-auto">
          <p className="text-neutral-600 mb-6">
            You have <strong>{sponsor.slot_count}</strong> player {sponsor.slot_count === 1 ? 'slot' : 'slots'} to fill.
            {sponsor.slot_count >= 2 && <span className="text-neutral-400 ml-1">({Math.floor(sponsor.slot_count / 2)} team{Math.floor(sponsor.slot_count / 2) !== 1 ? 's' : ''})</span>}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                playerName={localEdits[slot.id]?.player_name || ''}
                playerEmail={localEdits[slot.id]?.player_email || ''}
                playerPhone={localEdits[slot.id]?.player_phone || ''}
                onChangeField={(field, value) => updateLocalEdit(slot.id, field, value)}
                onSave={() => saveSlot(slot)}
                saving={savingSlots[slot.id] || false}
              />
            ))}
          </div>

          {slots.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200">
              <p className="text-neutral-400">No player slots have been assigned yet. Please contact the organizer.</p>
            </div>
          )}
        </div>
      </main>

      {/* Save All sticky footer */}
      {slots.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-4">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={saveAllSlots}
              disabled={savingAll}
              className="w-full bg-[#E31837] text-white rounded-xl py-3.5 font-semibold text-lg hover:bg-[#c41230] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingAll ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving All...
                </>
              ) : (
                'Save All Changes'
              )}
            </button>
            <p className="text-center text-xs text-neutral-400 mt-2">
              Changes are saved individually per slot or all at once with this button
            </p>
          </div>
        </div>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export const SponsorPortalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#0057B8] text-white px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/maw-star-icon.png" alt="Make-A-Wish" className="h-8 rounded" />
            <div>
              <div className="font-bold text-lg">Sponsor Portal</div>
              <div className="text-white/70 text-sm">Golf for Wishes 2026</div>
            </div>
          </div>
        </div>
      </header>

      {token ? <Dashboard token={token} /> : <LoginScreen />}
    </div>
  );
};

export default SponsorPortalPage;
