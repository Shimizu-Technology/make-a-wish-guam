import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrganization } from '../components/OrganizationProvider';
import { useAuthToken } from '../hooks/useAuthToken';
import { ImageUpload } from '../components/ImageUpload';
import {
  ArrowLeft,
  Building2,
  Loader2,
  Save,
  Palette,
  Mail,
  Phone,
  Globe,
  FileText,
  Settings,
  Users,
  UserPlus,
  Shield,
  Trash2,
  Crown,
  DollarSign,
  Calendar,
  Gift,
  CreditCard,
  Link as LinkIcon,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface OrgMember {
  id: string;
  user_id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  primary_color: string;
  contact_email: string;
  contact_phone: string;
  website_url: string;
  logo_url: string;
  banner_url: string;
  walkin_fee: string;
  walkin_registration_open: boolean;
}

interface TournamentSettings {
  id: string;
  name: string;
  registration_open: boolean;
  registration_deadline: string;
  walkin_fee: string;
  max_capacity: string;
  swipe_simple_url: string;
  walkin_swipe_simple_url: string;
  entry_fee_display: string;
  raffle_enabled: boolean;
  raffle_description: string;
  raffle_draw_time: string;
  raffle_auto_draw: boolean;
}

const colorPresets = [
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Pink', value: '#db2777' },
];

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
  const [savingTournament, setSavingTournament] = useState(false);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        slug: organization.slug || '',
        description: organization.description || '',
        primary_color: organization.primary_color || '#16a34a',
        contact_email: organization.contact_email || '',
        contact_phone: organization.contact_phone || '',
        website_url: organization.website_url || '',
        logo_url: organization.logo_url || '',
        banner_url: organization.banner_url || '',
        walkin_fee: (organization as any).walkin_fee?.toString() || '',
        walkin_registration_open: (organization as any).walkin_registration_open || false,
      });
    }
  }, [organization]);

  // Fetch members
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
        // Find the first active (non-archived) tournament
        const active = tournaments.find((t: any) => t.status !== 'archived') || tournaments[0];
        if (active) {
          // Fetch full tournament details
          const detailRes = await fetch(
            `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.slug}/tournaments/${active.slug}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const t = detail.tournament || detail;
            setTournamentSettings({
              id: t.id?.toString() || '',
              name: t.name || '',
              registration_open: t.registration_open ?? false,
              registration_deadline: t.registration_deadline || '',
              walkin_fee: t.walkin_fee != null ? (t.walkin_fee / 100).toString() : '',
              max_capacity: t.max_capacity?.toString() || '',
              swipe_simple_url: t.swipe_simple_url || '',
              walkin_swipe_simple_url: t.walkin_swipe_simple_url || '',
              entry_fee_display: t.entry_fee_display || '$300/team',
              raffle_enabled: t.raffle_enabled ?? false,
              raffle_description: t.raffle_description || '',
              raffle_draw_time: t.raffle_draw_time || '',
              raffle_auto_draw: t.raffle_auto_draw ?? false,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch tournament settings:', err);
    }
  };

  const handleTournamentChange = (field: keyof TournamentSettings, value: string | boolean) => {
    setTournamentSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSaveTournament = async () => {
    if (!tournamentSettings?.id) return;
    setSavingTournament(true);
    try {
      const token = await getToken();
      const body: Record<string, unknown> = {
        registration_open: tournamentSettings.registration_open,
        registration_deadline: tournamentSettings.registration_deadline || null,
        walkin_fee: tournamentSettings.walkin_fee ? Math.round(parseFloat(tournamentSettings.walkin_fee) * 100) : null,
        max_capacity: tournamentSettings.max_capacity ? parseInt(tournamentSettings.max_capacity) : null,
        swipe_simple_url: tournamentSettings.swipe_simple_url || null,
        walkin_swipe_simple_url: tournamentSettings.walkin_swipe_simple_url || null,
        entry_fee_display: tournamentSettings.entry_fee_display || '$300/team',
        raffle_enabled: tournamentSettings.raffle_enabled,
        raffle_description: tournamentSettings.raffle_description || null,
        raffle_draw_time: tournamentSettings.raffle_draw_time || null,
        raffle_auto_draw: tournamentSettings.raffle_auto_draw,
      };
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentSettings.id}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tournament: body }),
        }
      );
      if (res.ok) {
        toast.success('Tournament settings saved!');
      } else {
        const data = await res.json();
        toast.error(data.errors?.join(', ') || 'Failed to save tournament settings');
      }
    } catch (err) {
      toast.error('Failed to save tournament settings');
    } finally {
      setSavingTournament(false);
    }
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
        toast.success('Admin added successfully');
      } else {
        toast.error(data.error || 'Failed to add admin');
      }
    } catch (err) {
      toast.error('Failed to add admin');
    } finally {
      setAddingMember(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !formData || !organization) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organization: formData }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.errors?.join(', ') || 'Failed to update organization');
      }

      toast.success('Organization settings saved!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!organization || !formData) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link
            to={"/admin"}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            {organization.logo_url ? (
              <img
                src={organization.logo_url}
                alt={organization.name}
                className="w-14 h-14 rounded-xl object-contain bg-gray-100"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: organization.primary_color || '#16a34a' }}
              >
                {organization.name?.charAt(0) || 'O'}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-6 h-6 text-gray-400" />
                Organization Settings
              </h1>
              <p className="text-gray-500">{organization.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit}>
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <span className="px-4 py-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl text-gray-500">
                    maw-guam.events/
                  </span>
                  <input
                    type="text"
                    name="slug"
                    value={formData.slug}
                    onChange={handleChange}
                    className={`flex-1 px-4 py-3 border rounded-r-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${
                      errors.slug ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Branding */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              <Palette className="w-5 h-5 inline mr-2" />
              Branding
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Color</label>
                <div className="flex items-center gap-4 flex-wrap">
                  {colorPresets.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData(prev => prev ? { ...prev, primary_color: color.value } : null)}
                      className={`w-10 h-10 rounded-xl border-2 transition-all ${
                        formData.primary_color === color.value
                          ? 'border-gray-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData(prev => prev ? { ...prev, primary_color: e.target.value } : null)}
                      className="w-10 h-10 rounded-xl cursor-pointer"
                    />
                    <span className="text-sm text-gray-500">{formData.primary_color}</span>
                  </div>
                </div>
              </div>

              <ImageUpload
                label="Logo"
                value={formData.logo_url}
                onChange={(url) => setFormData(prev => prev ? { ...prev, logo_url: url } : null)}
                getToken={getToken}
                placeholder="Upload logo (PNG or SVG recommended)"
                helpText="Square image works best. Max 5MB."
              />

              <ImageUpload
                label="Banner Image"
                value={formData.banner_url}
                onChange={(url) => setFormData(prev => prev ? { ...prev, banner_url: url } : null)}
                getToken={getToken}
                placeholder="Upload banner image"
                helpText="Wide image (e.g. 1200×400) works best. Max 5MB."
              />
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" /> Contact Email
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.contact_email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.contact_email && <p className="mt-1 text-sm text-red-600">{errors.contact_email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" /> Contact Phone
                </label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="w-4 h-4 inline mr-1" /> Website
                </label>
                <input
                  type="url"
                  name="website_url"
                  value={formData.website_url}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.website_url ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.website_url && <p className="mt-1 text-sm text-red-600">{errors.website_url}</p>}
              </div>
            </div>
          </div>

          {/* Walk-in Pricing */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              <DollarSign className="w-5 h-5 inline mr-2" />
              Walk-in Pricing
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Walk-in Fee (cents)
                </label>
                <input
                  type="number"
                  name="walkin_fee"
                  value={formData.walkin_fee}
                  onChange={handleChange}
                  placeholder="e.g. 35000 = $350"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter the amount in cents (e.g. 35000 = $350.00)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="walkin_registration_open"
                  checked={formData.walkin_registration_open}
                  onChange={(e) =>
                    setFormData(prev =>
                      prev ? { ...prev, walkin_registration_open: e.target.checked } : null
                    )
                  }
                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="walkin_registration_open" className="text-sm font-medium text-gray-700">
                  Walk-in Registration Open
                </label>
              </div>
            </div>
          </div>

          {/* Submit Org Settings */}
          <div className="flex items-center justify-between mb-8">
            <Link
              to={"/admin"}
              className="px-6 py-3 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-green-600/25"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>

        {/* Tournament Settings Section */}
        {tournamentSettings && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Tournament Settings</h2>
                <p className="text-sm text-gray-500">{tournamentSettings.name}</p>
              </div>
            </div>

            {/* Registration Settings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Registration Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="registration_open"
                    checked={tournamentSettings.registration_open}
                    onChange={(e) => handleTournamentChange('registration_open', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="registration_open" className="text-sm font-medium text-gray-700">
                    Registration Open
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={tournamentSettings.registration_deadline ? tournamentSettings.registration_deadline.slice(0, 16) : ''}
                    onChange={(e) => handleTournamentChange('registration_deadline', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">After this, walk-in rate applies</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Walk-in Fee ($)
                  </label>
                  <input
                    type="number"
                    value={tournamentSettings.walkin_fee}
                    onChange={(e) => handleTournamentChange('walkin_fee', e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">Amount charged for day-of walk-in registrations</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    value={tournamentSettings.max_capacity}
                    onChange={(e) => handleTournamentChange('max_capacity', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Payment Settings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-gray-400" />
                Payment Settings
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SwipeSimple Payment URL
                  </label>
                  <input
                    type="url"
                    value={tournamentSettings.swipe_simple_url}
                    onChange={(e) => handleTournamentChange('swipe_simple_url', e.target.value)}
                    placeholder="https://swipesimple.com/links/..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">Link for team registrations ($300)</p>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">Separate link for walk-in registrations (higher price)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entry Fee Display Label
                  </label>
                  <input
                    type="text"
                    value={tournamentSettings.entry_fee_display}
                    onChange={(e) => handleTournamentChange('entry_fee_display', e.target.value)}
                    placeholder="$300/team"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">What's shown to registrants</p>
                </div>
              </div>
            </div>

            {/* Raffle Settings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-500" />
                Raffle Settings
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="raffle_enabled"
                    checked={tournamentSettings.raffle_enabled}
                    onChange={(e) => handleTournamentChange('raffle_enabled', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="raffle_enabled" className="text-sm font-medium text-gray-700">
                    Raffle Enabled
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Raffle Description
                  </label>
                  <textarea
                    value={tournamentSettings.raffle_description}
                    onChange={(e) => handleTournamentChange('raffle_description', e.target.value)}
                    rows={3}
                    placeholder="Description shown on public raffle page..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Draw Time
                  </label>
                  <input
                    type="datetime-local"
                    value={tournamentSettings.raffle_draw_time ? tournamentSettings.raffle_draw_time.slice(0, 16) : ''}
                    onChange={(e) => handleTournamentChange('raffle_draw_time', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="raffle_auto_draw"
                    checked={tournamentSettings.raffle_auto_draw}
                    onChange={(e) => handleTournamentChange('raffle_auto_draw', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="raffle_auto_draw" className="text-sm font-medium text-gray-700">
                    Auto-draw at scheduled time
                  </label>
                </div>
              </div>
            </div>

            {/* Save Tournament Settings */}
            <div className="flex justify-end">
              <button
                onClick={handleSaveTournament}
                disabled={savingTournament}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-blue-600/25"
              >
                {savingTournament ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Tournament Settings
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Admin Management Section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-50 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Organization Admins</h2>
              <p className="text-sm text-gray-500">Manage who can administer this organization</p>
            </div>
          </div>

          {/* Add admin */}
          <div className="flex gap-3 mb-6">
            <input
              type="email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="Enter email address..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            />
            <button
              onClick={handleAddMember}
              disabled={addingMember || !newMemberEmail.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors"
            >
              {addingMember ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Add Admin
            </button>
          </div>

          {/* Member list */}
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No admins configured yet.</p>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      {member.role === 'admin' ? (
                        <Crown className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Shield className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      member.role === 'admin'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {member.role}
                    </span>
                    {!(member.role === 'admin' && members.filter(m => m.role === 'admin').length <= 1) && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
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
