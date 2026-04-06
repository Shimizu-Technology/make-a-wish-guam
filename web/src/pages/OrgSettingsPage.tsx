import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import { useOrganizationStore } from '../stores/organizationStore';
import { useAuthToken } from '../hooks/useAuthToken';
import {
  ArrowLeft,
  Loader2,
  Save,
  Mail,
  Phone,
  Globe,
  Settings,
  Users,
  UserPlus,
  Shield,
  Trash2,
  Crown,
  Calendar,
  Gift,
  Send,
  Clock,
  ToggleLeft,
  ToggleRight,
  Home,
  Plus,
  X,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface OrgMember {
  id: string;
  user_id: number;
  name: string;
  email: string;
  role: string;
  invitation_pending?: boolean;
  created_at: string;
}

interface HomepageStat {
  value: string;
  label: string;
}

interface FormData {
  name: string;
  slug: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  homepage_tagline: string;
  homepage_mission: string;
  homepage_stats: HomepageStat[];
}

type RegistrationMode = 'regular' | 'walkin' | 'closed';

interface TournamentSettings {
  id: string;
  name: string;
  event_date: string;
  location_name: string;
  location_address: string;
  format_name: string;
  tournament_format: string;
  team_size: string;
  registration_mode: RegistrationMode;
  registration_deadline: string;
  entry_fee_display: string;
  walkin_fee: string;
  walkin_fee_display: string;
  max_capacity: string;
  swipe_simple_url: string;
  walkin_swipe_simple_url: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  waitlist_enabled: boolean;
  waitlist_max: string;
  raffle_enabled: boolean;
  raffle_description: string;
  raffle_draw_time: string;
  raffle_ticket_price_cents: string;
  sponsor_edit_deadline: string;
  event_schedule: string;
  payment_instructions: string;
  check_in_time: string;
  start_time: string;
  fee_includes: string;
}

function deriveRegistrationMode(registration_open: boolean, walkin_registration_open: boolean): RegistrationMode {
  if (registration_open) return 'regular';
  if (walkin_registration_open) return 'walkin';
  return 'closed';
}

export const OrgSettingsPage: React.FC = () => {
  const { organization } = useOrganization();
  const { getToken } = useAuthToken();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [tournamentSettings, setTournamentSettings] = useState<TournamentSettings | null>(null);
  const [sponsorReservedTeams, setSponsorReservedTeams] = useState(0);

  useEffect(() => {
    if (organization) {
      const settings = (organization as any).settings || {};
      setFormData({
        name: organization.name || '',
        slug: organization.slug || '',
        contact_email: organization.contact_email || '',
        contact_phone: organization.contact_phone || '',
        website_url: organization.website_url || '',
        homepage_tagline: settings.homepage_tagline || '',
        homepage_mission: settings.homepage_mission || '',
        homepage_stats: settings.homepage_stats || [
          { value: '', label: '' },
          { value: '', label: '' },
          { value: '', label: '' },
        ],
      });
    }
  }, [organization]);

  const fetchMembers = async () => {
    if (!organization?.slug) return;
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  useEffect(() => {
    if (organization?.slug) {
      fetchMembers();
      fetchTournamentSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.slug]);

  const fetchTournamentSettings = async () => {
    if (!organization?.slug) return;
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const tournaments = data.tournaments || [];
        const active = tournaments.find((t: any) => t.status !== 'archived') || tournaments[0];
        if (active) {
          const detailRes = await fetch(
            `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${active.slug}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const t = detail.tournament || detail;
            setSponsorReservedTeams(t.sponsor_reserved_teams || 0);
            setTournamentSettings({
              id: t.id?.toString() || '',
              name: t.name || '',
              event_date: t.event_date || '',
              location_name: t.location_name || '',
              location_address: t.location_address || '',
              format_name: t.format_name || '',
              tournament_format: t.tournament_format || '',
              team_size: t.team_size?.toString() || '2',
              registration_mode: deriveRegistrationMode(t.registration_open ?? false, t.walkin_registration_open ?? false),
              registration_deadline: t.registration_deadline || '',
              entry_fee_display: t.entry_fee_display || '',
              walkin_fee: t.walkin_fee != null ? (t.walkin_fee / 100).toString() : '',
              walkin_fee_display: t.walkin_fee != null ? `$${(t.walkin_fee / 100).toFixed(0)}/team` : '',
              max_capacity: t.max_capacity?.toString() || '',
              waitlist_enabled: t.waitlist_enabled ?? false,
              waitlist_max: t.waitlist_max?.toString() || '',
              swipe_simple_url: t.swipe_simple_url || '',
              walkin_swipe_simple_url: t.walkin_swipe_simple_url || '',
              contact_name: t.contact_name || '',
              contact_phone: t.contact_phone || '',
              contact_email: t.contact_email || '',
              raffle_enabled: t.raffle_enabled ?? false,
              raffle_description: t.raffle_description || '',
              raffle_draw_time: t.raffle_draw_time || '',
              raffle_ticket_price_cents: t.raffle_ticket_price_cents?.toString() || '500',
              sponsor_edit_deadline: t.sponsor_edit_deadline || '',
              event_schedule: t.event_schedule || '',
              payment_instructions: t.payment_instructions || '',
              check_in_time: t.check_in_time || '',
              start_time: t.start_time || '',
              fee_includes: t.fee_includes || '',
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch tournament settings:', err);
    }
  };

  const handleTournamentChange = (field: keyof TournamentSettings, value: string | boolean) => {
    setTournamentSettings(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
      if (field === 'registration_mode' && value === 'closed') {
        updated.waitlist_enabled = false;
      }
      return updated;
    });
  };

  const saveTournamentSettings = async (token: string): Promise<boolean> => {
    if (!tournamentSettings?.id) return true;

    const isRegular = tournamentSettings.registration_mode === 'regular';
    const isWalkin = tournamentSettings.registration_mode === 'walkin';

    const body: Record<string, unknown> = {
      name: tournamentSettings.name || null,
      event_date: tournamentSettings.event_date || null,
      location_name: tournamentSettings.location_name || null,
      location_address: tournamentSettings.location_address || null,
      format_name: tournamentSettings.format_name || null,
      registration_open: isRegular,
      walkin_registration_open: isWalkin,
      registration_deadline: tournamentSettings.registration_deadline || null,
      entry_fee_display: tournamentSettings.entry_fee_display || null,
      walkin_fee: tournamentSettings.walkin_fee ? Math.round(parseFloat(tournamentSettings.walkin_fee) * 100) : null,
      max_capacity: tournamentSettings.max_capacity ? parseInt(tournamentSettings.max_capacity) : null,
      waitlist_enabled: tournamentSettings.waitlist_enabled,
      waitlist_max: tournamentSettings.waitlist_max ? parseInt(tournamentSettings.waitlist_max) : null,
      swipe_simple_url: tournamentSettings.swipe_simple_url || null,
      walkin_swipe_simple_url: tournamentSettings.walkin_swipe_simple_url || null,
      contact_name: tournamentSettings.contact_name || null,
      contact_phone: tournamentSettings.contact_phone || null,
      contact_email: tournamentSettings.contact_email || null,
      raffle_enabled: tournamentSettings.raffle_enabled,
      raffle_description: tournamentSettings.raffle_description || null,
      raffle_draw_time: tournamentSettings.raffle_draw_time || null,
      raffle_ticket_price_cents: tournamentSettings.raffle_ticket_price_cents ? parseInt(tournamentSettings.raffle_ticket_price_cents) : 500,
      sponsor_edit_deadline: tournamentSettings.sponsor_edit_deadline || null,
      event_schedule: tournamentSettings.event_schedule || null,
      payment_instructions: tournamentSettings.payment_instructions || null,
      check_in_time: tournamentSettings.check_in_time || null,
      start_time: tournamentSettings.start_time || null,
      fee_includes: tournamentSettings.fee_includes || null,
    };
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentSettings.id}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament: body }),
      }
    );
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.errors?.join(', ') || 'Failed to save event settings');
    }
    return true;
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim() || !organization?.slug) return;
    setAddingMember(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/members`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: newMemberEmail.trim(), role: 'admin' }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setMembers(prev => [...prev, data.member]);
        setNewMemberEmail('');
        toast.success(data.invitation_sent ? 'Admin added — invitation email sent!' : 'Admin added successfully');
      } else {
        toast.error(data.error || 'Failed to add admin');
      }
    } catch (err) {
      toast.error('Failed to add admin');
    } finally {
      setAddingMember(false);
    }
  };

  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  const handleResendInvite = async (memberId: string) => {
    if (!organization?.slug) return;
    setResendingInvite(memberId);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/members/${memberId}/resend_invite`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        toast.success('Invitation email sent!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to resend invitation');
      }
    } catch {
      toast.error('Failed to resend invitation');
    } finally {
      setResendingInvite(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!organization?.slug) return;
    if (!confirm('Are you sure you want to remove this admin?')) return;
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/members/${memberId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setMembers(prev => prev.filter(m => m.id !== memberId));
        toast.success('Admin removed');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove admin');
      }
    } catch (err) {
      toast.error('Failed to remove admin');
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'slug') {
      const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      setFormData(prev => prev ? { ...prev, [name]: cleanSlug } : null);
    } else {
      setFormData(prev => prev ? { ...prev, [name]: value } : null);
    }

    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = (): boolean => {
    if (!formData) return false;
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Organization name is required';
    if (!formData.slug.trim()) newErrors.slug = 'URL slug is required';
    else if (!/^[a-z0-9-]+$/.test(formData.slug))
      newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email))
      newErrors.contact_email = 'Invalid email format';
    if (formData.website_url && !formData.website_url.startsWith('http'))
      newErrors.website_url = 'Website URL must start with http:// or https://';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAll = async () => {
    if (!validate() || !formData || !organization) {
      toast.error('Please fix the errors before saving');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();

      const orgRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization: {
              name: formData.name,
              slug: formData.slug,
              contact_email: formData.contact_email,
              contact_phone: formData.contact_phone,
              website_url: formData.website_url,
              settings: {
                homepage_tagline: formData.homepage_tagline,
                homepage_mission: formData.homepage_mission,
                homepage_stats: formData.homepage_stats.filter(s => s.value || s.label),
              },
            },
          }),
        }
      );
      if (!orgRes.ok) {
        const data = await orgRes.json();
        throw new Error(data.errors?.join(', ') || 'Failed to save organization settings');
      }

      const updatedOrg = await orgRes.json();
      useOrganizationStore.getState().setOrganization(updatedOrg);

      await saveTournamentSettings(token);

      toast.success('All settings saved!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!organization || !formData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const registrationModeOptions: { value: RegistrationMode; label: string; description: string }[] = [
    { value: 'regular', label: 'Regular Registration', description: 'Public registration is open for teams to sign up and pay.' },
    { value: 'walkin', label: 'Walk-in Only', description: 'Online registration is closed. Walk-ins accepted on event day at a separate rate.' },
    { value: 'closed', label: 'Registration Closed', description: 'No registrations accepted — neither online nor walk-in.' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Link
            to={"/admin"}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-3 sm:mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white text-lg sm:text-xl font-bold bg-brand-600 flex-shrink-0"
            >
              {organization.name?.charAt(0) || 'O'}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 flex-shrink-0" />
                <span className="truncate">Organization Settings</span>
              </h1>
              <p className="text-gray-500 text-sm truncate">{organization.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-5 sm:space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Basic Information</h2>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="px-3 sm:px-4 py-2 sm:py-3 bg-gray-100 border border-gray-300 rounded-t-xl sm:rounded-t-none sm:rounded-l-xl sm:border-r-0 text-gray-500 text-sm">
                    maw-guam.events/
                  </span>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className={`flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border rounded-b-xl sm:rounded-b-none sm:rounded-r-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      errors.slug ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug}</p>}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  <Mail className="w-4 h-4 inline mr-1" /> Contact Email
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.contact_email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.contact_email && <p className="mt-1 text-sm text-red-600">{errors.contact_email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  <Phone className="w-4 h-4 inline mr-1" /> Contact Phone
                </label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  <Globe className="w-4 h-4 inline mr-1" /> Website
                </label>
                <input
                  type="url"
                  name="website_url"
                  value={formData.website_url}
                  onChange={handleChange}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors.website_url ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.website_url && <p className="mt-1 text-sm text-red-600">{errors.website_url}</p>}
              </div>
            </div>
          </div>

          {/* Homepage Content */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
              <Home className="w-5 h-5 text-gray-400" />
              Homepage Content
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mb-4">These fields control what appears on the public homepage hero section.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tagline
                </label>
                <input
                  type="text"
                  value={formData.homepage_tagline}
                  onChange={(e) => setFormData(prev => prev ? { ...prev, homepage_tagline: e.target.value } : null)}
                  placeholder="e.g. Granting wishes since 1988"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mission Statement
                </label>
                <input
                  type="text"
                  value={formData.homepage_mission}
                  onChange={(e) => setFormData(prev => prev ? { ...prev, homepage_mission: e.target.value } : null)}
                  placeholder="e.g. Together we create life-changing wishes for children with critical illnesses"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Highlight Stats
                </label>
                <p className="text-xs text-gray-500 mb-3">Up to 3 stats shown on the homepage hero.</p>
                <div className="space-y-3">
                  {formData.homepage_stats.map((stat, i) => (
                    <div key={i} className="relative flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50 rounded-xl p-3 pr-10 sm:pr-3 sm:bg-transparent sm:p-0">
                      <input
                        type="text"
                        value={stat.value}
                        onChange={(e) => {
                          const updated = [...formData.homepage_stats];
                          updated[i] = { ...updated[i], value: e.target.value };
                          setFormData(prev => prev ? { ...prev, homepage_stats: updated } : null);
                        }}
                        placeholder="Value (e.g. 38+)"
                        className="w-full sm:w-28 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <input
                        type="text"
                        value={stat.label}
                        onChange={(e) => {
                          const updated = [...formData.homepage_stats];
                          updated[i] = { ...updated[i], label: e.target.value };
                          setFormData(prev => prev ? { ...prev, homepage_stats: updated } : null);
                        }}
                        placeholder="Label (e.g. Years granting wishes)"
                        className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      {formData.homepage_stats.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = formData.homepage_stats.filter((_, idx) => idx !== i);
                            setFormData(prev => prev ? { ...prev, homepage_stats: updated } : null);
                          }}
                          className="absolute top-2 right-2 sm:relative sm:top-auto sm:right-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {formData.homepage_stats.length < 4 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => prev ? { ...prev, homepage_stats: [...prev.homepage_stats, { value: '', label: '' }] } : null);
                      }}
                      className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add stat
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── EVENT SETTINGS DIVIDER ─── */}
          {tournamentSettings && (
            <>
            <div className="flex items-center gap-3 pt-6">
              <div className="p-2 bg-brand-50 rounded-lg">
                <Calendar className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Event Settings</h2>
                <p className="text-sm text-gray-500">{tournamentSettings.name}</p>
              </div>
            </div>

            {/* Event Information */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-sm sm:text-md font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
                Event Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Name
                  </label>
                  <input
                    type="text"
                    value={tournamentSettings.name}
                    onChange={(e) => handleTournamentChange('name', e.target.value)}
                    placeholder="e.g. Golf for Wishes 2026"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Date
                    </label>
                    <input
                      type="date"
                      value={tournamentSettings.event_date ? tournamentSettings.event_date.slice(0, 10) : ''}
                      onChange={(e) => handleTournamentChange('event_date', e.target.value)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Format Name
                    </label>
                    <input
                      type="text"
                      value={tournamentSettings.format_name}
                      onChange={(e) => handleTournamentChange('format_name', e.target.value)}
                      placeholder="e.g. Two-Person Scramble"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue Name
                    </label>
                    <input
                      type="text"
                      value={tournamentSettings.location_name}
                      onChange={(e) => handleTournamentChange('location_name', e.target.value)}
                      placeholder="e.g. LeoPalace Resort Country Club"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue Address
                    </label>
                    <input
                      type="text"
                      value={tournamentSettings.location_address}
                      onChange={(e) => handleTournamentChange('location_address', e.target.value)}
                      placeholder="e.g. Yona, Guam"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Format Type
                    </label>
                    <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl text-base bg-gray-50 text-gray-600 capitalize">
                      {tournamentSettings.tournament_format?.replace('_', ' ') || 'Scramble'}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Contact support to change format type</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Size
                    </label>
                    <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-200 rounded-xl text-base bg-gray-50 text-gray-600">
                      {tournamentSettings.team_size || '2'} players per team
                    </div>
                    <p className="mt-1 text-xs text-gray-400">Contact support to change team size</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Registration Mode */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-sm sm:text-md font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                {tournamentSettings.registration_mode === 'closed' ? (
                  <ToggleLeft className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ToggleRight className="w-5 h-5 text-green-500 flex-shrink-0" />
                )}
                Registration Mode
              </h3>

              <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
                {registrationModeOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      tournamentSettings.registration_mode === opt.value
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="registration_mode"
                      value={opt.value}
                      checked={tournamentSettings.registration_mode === opt.value}
                      onChange={() => handleTournamentChange('registration_mode', opt.value)}
                      className="mt-0.5 w-4 h-4 text-brand-600 focus:ring-brand-500 flex-shrink-0"
                    />
                    <div>
                      <span className="font-medium text-sm sm:text-base text-gray-900">{opt.label}</span>
                      <p className="text-xs sm:text-sm text-gray-500">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Regular registration fields */}
              {tournamentSettings.registration_mode === 'regular' && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Entry Fee Display Label
                    </label>
                    <input
                      type="text"
                      value={tournamentSettings.entry_fee_display}
                      onChange={(e) => handleTournamentChange('entry_fee_display', e.target.value)}
                      placeholder="e.g. $300/team"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="mt-1 text-xs sm:text-sm text-gray-500">Shown on the public event page, registration form, and emails</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SwipeSimple Payment URL
                    </label>
                    <input
                      type="url"
                      value={tournamentSettings.swipe_simple_url}
                      onChange={(e) => handleTournamentChange('swipe_simple_url', e.target.value)}
                      placeholder="https://swipesimple.com/links/..."
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="mt-1 text-xs sm:text-sm text-gray-500">Registrants are redirected here after signing up</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Registration Deadline
                    </label>
                    <input
                      type="datetime-local"
                      value={tournamentSettings.registration_deadline ? tournamentSettings.registration_deadline.slice(0, 16) : ''}
                      onChange={(e) => handleTournamentChange('registration_deadline', e.target.value)}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="mt-1 text-xs sm:text-sm text-gray-500">After this date, online registration automatically closes</p>
                  </div>
                </div>
              )}

              {/* Walk-in fields */}
              {tournamentSettings.registration_mode === 'walkin' && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Walk-in Fee ($)
                    </label>
                    <input
                      type="number"
                      value={tournamentSettings.walkin_fee}
                      onChange={(e) => handleTournamentChange('walkin_fee', e.target.value)}
                      placeholder="e.g. 350"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="mt-1 text-xs sm:text-sm text-gray-500">Amount charged for day-of walk-in registrations</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Walk-in SwipeSimple URL
                    </label>
                    <input
                      type="url"
                      value={tournamentSettings.walkin_swipe_simple_url}
                      onChange={(e) => handleTournamentChange('walkin_swipe_simple_url', e.target.value)}
                      placeholder="https://swipesimple.com/links/..."
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="mt-1 text-xs sm:text-sm text-gray-500">Payment link for walk-in registrations</p>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Capacity (teams)
                  </label>
                  <input
                    type="number"
                    value={tournamentSettings.max_capacity}
                    onChange={(e) => handleTournamentChange('max_capacity', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  {sponsorReservedTeams > 0 && tournamentSettings.max_capacity && (
                    <p className="mt-1 text-xs text-gray-500">
                      {sponsorReservedTeams} team{sponsorReservedTeams !== 1 ? 's' : ''} reserved for sponsors
                      {' \u2022 '}
                      {Math.max(0, parseInt(tournamentSettings.max_capacity) - sponsorReservedTeams)} available for public registration
                    </p>
                  )}
                </div>

                {tournamentSettings.registration_mode !== 'closed' && (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={tournamentSettings.waitlist_enabled}
                        onChange={(e) => handleTournamentChange('waitlist_enabled', e.target.checked)}
                        className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                      />
                      <label className="text-sm font-medium text-gray-700">
                        Enable waitlist when at capacity
                      </label>
                    </div>
                    {tournamentSettings.waitlist_enabled && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Waitlist Size
                        </label>
                        <input
                          type="number"
                          value={tournamentSettings.waitlist_max}
                          onChange={(e) => handleTournamentChange('waitlist_max', e.target.value)}
                          placeholder="Leave blank for unlimited"
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">Leave blank for unlimited waitlist</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Event Contact */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-sm sm:text-md font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
                Event Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={tournamentSettings.contact_name}
                    onChange={(e) => handleTournamentChange('contact_name', e.target.value)}
                    placeholder="e.g. Eric Tydingco"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="tel"
                    value={tournamentSettings.contact_phone}
                    onChange={(e) => handleTournamentChange('contact_phone', e.target.value)}
                    placeholder="e.g. 671-649-9474"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={tournamentSettings.contact_email}
                  onChange={(e) => handleTournamentChange('contact_email', e.target.value)}
                  placeholder="e.g. etydingco@guam.wish.org"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <p className="mt-2 text-xs sm:text-sm text-gray-500">Shown in emails and on the event page. All fields are optional.</p>
            </div>

            {/* Event Details */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-sm sm:text-md font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                Event Details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Check-in Time
                    </label>
                    <input
                      type="text"
                      value={tournamentSettings.check_in_time}
                      onChange={(e) => handleTournamentChange('check_in_time', e.target.value)}
                      placeholder="e.g. 7:00 AM"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="text"
                      value={tournamentSettings.start_time}
                      onChange={(e) => handleTournamentChange('start_time', e.target.value)}
                      placeholder="e.g. 8:00 AM Shotgun Start"
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event Schedule
                  </label>
                  <textarea
                    value={tournamentSettings.event_schedule}
                    onChange={(e) => handleTournamentChange('event_schedule', e.target.value)}
                    rows={4}
                    placeholder={"7:00 AM — Check-in\n8:00 AM — Shotgun Start\n1:30 PM — Banquet & Awards"}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">One item per line. Shown on the public event page.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry Fee Includes
                  </label>
                  <input
                    type="text"
                    value={tournamentSettings.fee_includes}
                    onChange={(e) => handleTournamentChange('fee_includes', e.target.value)}
                    placeholder="e.g. Green Fee, Cart, Lunch, Awards Banquet, and Raffle Entry"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">Shown on the public event page under tournament details</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Instructions
                  </label>
                  <textarea
                    value={tournamentSettings.payment_instructions}
                    onChange={(e) => handleTournamentChange('payment_instructions', e.target.value)}
                    rows={2}
                    placeholder="e.g. Payment will be processed securely online after registration."
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">Replaces the default payment options list on the public page</p>
                </div>
              </div>
            </div>

            {/* Raffle Settings */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-sm sm:text-md font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-[#F5A800] flex-shrink-0" />
                Raffle Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="raffle_enabled"
                    checked={tournamentSettings.raffle_enabled}
                    onChange={(e) => handleTournamentChange('raffle_enabled', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="raffle_enabled" className="text-sm font-medium text-gray-700">
                    Raffle Enabled
                  </label>
                </div>

                {tournamentSettings.raffle_enabled && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Raffle Description
                      </label>
                      <textarea
                        value={tournamentSettings.raffle_description}
                        onChange={(e) => handleTournamentChange('raffle_description', e.target.value)}
                        rows={3}
                        placeholder="Description shown on public raffle page..."
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ticket Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={tournamentSettings.raffle_ticket_price_cents ? (parseInt(tournamentSettings.raffle_ticket_price_cents) / 100).toFixed(2) : ''}
                        onChange={(e) => {
                          const cents = Math.round(parseFloat(e.target.value || '0') * 100);
                          handleTournamentChange('raffle_ticket_price_cents', cents.toString());
                        }}
                        placeholder="5.00"
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <p className="mt-1 text-xs sm:text-sm text-gray-500">Price for extra raffle tickets sold at the event. Registrants get complimentary tickets included with registration.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Draw Time
                      </label>
                      <input
                        type="datetime-local"
                        value={tournamentSettings.raffle_draw_time ? tournamentSettings.raffle_draw_time.slice(0, 16) : ''}
                        onChange={(e) => handleTournamentChange('raffle_draw_time', e.target.value)}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Sponsor Settings */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-sm sm:text-md font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-brand-500 flex-shrink-0" />
                Sponsor Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sponsor Slot Edit Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={tournamentSettings.sponsor_edit_deadline ? tournamentSettings.sponsor_edit_deadline.slice(0, 16) : ''}
                    onChange={(e) => handleTournamentChange('sponsor_edit_deadline', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">After this time, sponsors can no longer edit their player slots</p>
                </div>
              </div>
            </div>

            </>
          )}

          {/* Single Save Button */}
          <div className="flex items-center justify-between gap-3 pt-2 pb-4">
            <Link
              to={"/admin"}
              className="px-4 sm:px-6 py-2.5 sm:py-3 text-gray-700 hover:text-gray-900 font-medium text-sm sm:text-base"
            >
              Cancel
            </Link>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-sm sm:text-base transition-colors shadow-lg shadow-brand-600/25"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                  Save All Settings
                </>
              )}
            </button>
          </div>
        </div>

        {/* Admin Management Section */}
        <div className="mt-6 sm:mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8">
          <div className="flex items-start gap-3 mb-5 sm:mb-6">
            <div className="p-2 bg-brand-50 rounded-lg flex-shrink-0">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Organization Admins</h2>
              <p className="text-xs sm:text-sm text-gray-500">Invite admins by email. They'll receive a link to create their account.</p>
            </div>
          </div>

          {/* Add admin */}
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 mb-5 sm:mb-6">
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="Enter email address..."
              className="flex-1 px-3 sm:px-4 py-2.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            />
            <button
              onClick={handleAddMember}
              disabled={addingMember || !newMemberEmail.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-xl font-medium text-sm transition-colors flex-shrink-0"
            >
              {addingMember ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Invite Admin
            </button>
          </div>

          {/* Member list */}
          <div className="space-y-2.5 sm:space-y-3">
            {members.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No admins configured yet.</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-2 p-3 sm:p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="p-1.5 sm:p-2 bg-white rounded-lg border border-gray-200 flex-shrink-0">
                      {member.role === 'admin' ? (
                        <Crown className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Shield className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <p className="font-medium text-sm sm:text-base text-gray-900 truncate">{member.name}</p>
                        {member.invitation_pending && (
                          <span className="text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5 flex-shrink-0">
                            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            Pending
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <span className={`text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${
                      member.role === 'admin'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {member.role}
                    </span>
                    {member.invitation_pending && (
                      <button
                        onClick={() => handleResendInvite(member.id)}
                        disabled={resendingInvite === member.id}
                        className="p-1 sm:p-1.5 text-brand-500 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Resend invitation email"
                      >
                        {resendingInvite === member.id ? (
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </button>
                    )}
                    {!(member.role === 'admin' && members.filter(m => m.role === 'admin').length <= 1) && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 sm:p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrgSettingsPage;
