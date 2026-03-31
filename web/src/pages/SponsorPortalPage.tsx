import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail,
  Loader2,
  CheckCircle,
  ArrowRight,
  Star,
  User,
  Phone,
  Save,
  AlertCircle,
  Clock,
  Shield,
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
  slot_count: number;
}

// ---------------------------------------------------------------------------
// Login Screen (State A)
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
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-[#E31837]" />
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E31837] focus:border-[#E31837] text-lg"
                  disabled={isSubmitting}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !email.trim()}
                className="w-full bg-[#E31837] hover:bg-[#c21530] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-colors"
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
              The link will be valid for 24 hours.
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
              className="text-[#E31837] hover:text-[#c21530] font-medium"
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
// Tier Badge
// ---------------------------------------------------------------------------
const TierBadge: React.FC<{ tier: string }> = ({ tier }) => {
  const colors: Record<string, string> = {
    platinum: 'bg-purple-100 text-purple-800 border-purple-300',
    gold: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    silver: 'bg-gray-100 text-gray-700 border-gray-300',
    bronze: 'bg-orange-100 text-orange-800 border-orange-300',
  };
  const cls = colors[tier.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full border ${cls}`}
    >
      <Star className="w-3.5 h-3.5" />
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Slot Card
// ---------------------------------------------------------------------------
interface SlotCardProps {
  slot: SponsorSlot;
  token: string;
  onSaved: () => void;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, token, onSaved }) => {
  const [playerName, setPlayerName] = useState(slot.player_name || '');
  const [playerEmail, setPlayerEmail] = useState(slot.player_email || '');
  const [playerPhone, setPlayerPhone] = useState(slot.player_phone || '');
  const [saving, setSaving] = useState(false);

  // Sync local state when slot data changes from parent
  useEffect(() => {
    setPlayerName(slot.player_name || '');
    setPlayerEmail(slot.player_email || '');
    setPlayerPhone(slot.player_phone || '');
  }, [slot.player_name, slot.player_email, slot.player_phone]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/sponsor_slots/${slot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Sponsor-Token': token,
        },
        body: JSON.stringify({
          player_name: playerName.trim() || null,
          player_email: playerEmail.trim() || null,
          player_phone: playerPhone.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success(`Slot ${slot.slot_number} saved`);
        onSaved();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to save. Please try again.');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-[#E31837] text-white flex items-center justify-center text-sm font-bold">
          {slot.slot_number}
        </div>
        <h3 className="font-semibold text-gray-900">
          Player Slot {slot.slot_number}
        </h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <User className="w-3.5 h-3.5 inline-block mr-1" />
            Player Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Full name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E31837] focus:border-[#E31837] text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Mail className="w-3.5 h-3.5 inline-block mr-1" />
            Player Email
          </label>
          <input
            type="email"
            value={playerEmail}
            onChange={(e) => setPlayerEmail(e.target.value)}
            placeholder="player@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E31837] focus:border-[#E31837] text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Phone className="w-3.5 h-3.5 inline-block mr-1" />
            Player Phone
          </label>
          <input
            type="tel"
            value={playerPhone}
            onChange={(e) => setPlayerPhone(e.target.value)}
            placeholder="(671) 555-1234"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#E31837] focus:border-[#E31837] text-sm"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-1 bg-[#E31837] hover:bg-[#c21530] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard (State B)
// ---------------------------------------------------------------------------
const Dashboard: React.FC<{ token: string }> = ({ token }) => {
  const [sponsor, setSponsor] = useState<SponsorInfo | null>(null);
  const [slots, setSlots] = useState<SponsorSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/sponsor_slots`, {
        headers: { 'X-Sponsor-Token': token },
      });
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch {
      // Silently fail on slot refresh; user can retry individual saves
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
          // Fetch slots after verification
          const slotsRes = await fetch(`${API_URL}/api/v1/sponsor_slots`, {
            headers: { 'X-Sponsor-Token': token },
          });
          if (slotsRes.ok) {
            const slotsData = await slotsRes.json();
            setSlots(slotsData);
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

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#E31837] mx-auto mb-3" />
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href={window.location.pathname}
            className="inline-flex items-center gap-2 text-[#E31837] hover:text-[#c21530] font-medium"
          >
            Request a new access link
          </a>
        </div>
      </main>
    );
  }

  if (!sponsor) return null;

  return (
    <main className="flex-1 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome, {sponsor.name}
              </h2>
              <p className="text-gray-500 mt-1">
                Manage your {sponsor.slot_count} player{' '}
                {sponsor.slot_count === 1 ? 'slot' : 'slots'} below.
              </p>
            </div>
            <TierBadge tier={sponsor.tier} />
          </div>
        </div>

        {/* Player Slots */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#E31837]" />
            Your Player Slots
          </h3>
        </div>

        <div className="space-y-4 mb-8">
          {slots.length > 0 ? (
            slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                token={token}
                onSaved={fetchSlots}
              />
            ))
          ) : (
            // Show placeholder slots based on slot_count
            Array.from({ length: sponsor.slot_count }, (_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-center text-gray-400"
              >
                <p>Slot {i + 1} - Loading...</p>
              </div>
            ))
          )}
        </div>

        {/* Deadline Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Deadline:</strong> Changes must be submitted by 7:30 AM on
            May 2, 2026
          </p>
        </div>
      </div>
    </main>
  );
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------
export const SponsorPortalPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-[#E31837] text-white py-4 px-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-300" />
          <div>
            <h1 className="text-xl font-bold">Make-A-Wish Guam</h1>
            <p className="text-red-200 text-sm">Sponsor Portal</p>
          </div>
        </div>
      </header>

      {token ? <Dashboard token={token} /> : <LoginScreen />}
    </div>
  );
};

export default SponsorPortalPage;
