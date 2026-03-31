import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useOrganization } from '../components/OrganizationProvider';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  Trophy,
  Clock,
  Save,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface TournamentFormData {
  // Basic Info
  name: string;
  year: number;
  edition: string;
  status: 'draft' | 'open';
  
  // Date & Location
  event_date: string;
  registration_time: string;
  start_time: string;
  check_in_time: string;
  location_name: string;
  location_address: string;
  
  // Format
  tournament_format: string;
  scoring_type: string;
  team_size: number;
  shotgun_start: boolean;
  
  // Capacity
  max_capacity: number;
  reserved_slots: number;
  waitlist_enabled: boolean;
  waitlist_max: number;
  
  // Pricing
  entry_fee: number;
  early_bird_fee: number;
  early_bird_deadline: string;
  
  // Payment Options
  allow_cash: boolean;
  allow_check: boolean;
  allow_card: boolean;
  checks_payable_to: string;
  payment_instructions: string;
  
  // Registration
  registration_deadline: string;
  
  // Contact
  contact_name: string;
  contact_phone: string;
  fee_includes: string;
}

const defaultFormData: TournamentFormData = {
  name: '',
  year: new Date().getFullYear(),
  edition: '',
  status: 'draft',
  
  event_date: '',
  registration_time: '07:00',
  start_time: '08:00',
  check_in_time: '06:30',
  location_name: '',
  location_address: '',
  
  tournament_format: 'scramble',
  scoring_type: 'gross',
  team_size: 4,
  shotgun_start: true,
  
  max_capacity: 144,
  reserved_slots: 0,
  waitlist_enabled: true,
  waitlist_max: 20,
  
  entry_fee: 150,
  early_bird_fee: 0,
  early_bird_deadline: '',
  
  allow_cash: true,
  allow_check: true,
  allow_card: true,
  checks_payable_to: '',
  payment_instructions: '',
  
  registration_deadline: '',
  
  contact_name: '',
  contact_phone: '',
  fee_includes: '',
};

export const CreateTournamentPage: React.FC = () => {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { getToken } = useAuthToken();
  
  const [formData, setFormData] = useState<TournamentFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    datetime: true,
    format: false,
    capacity: false,
    pricing: true,
    payment: false,
    contact: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Tournament name is required';
    }
    if (!formData.event_date) {
      newErrors.event_date = 'Event date is required';
    }
    if (!formData.location_name.trim()) {
      newErrors.location_name = 'Location name is required';
    }
    if (formData.entry_fee < 0) {
      newErrors.entry_fee = 'Entry fee cannot be negative';
    }
    if (formData.max_capacity < 1) {
      newErrors.max_capacity = 'Capacity must be at least 1';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Please fix the errors before saving');
      return;
    }
    
    setSaving(true);
    
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      
      // Convert entry_fee from dollars to cents for API
      const payload = {
        tournament: {
          ...formData,
          entry_fee: Math.round(formData.entry_fee * 100),
          early_bird_fee: formData.early_bird_fee ? Math.round(formData.early_bird_fee * 100) : null,
          organization_id: organization?.id,
        },
      };
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${organization?.slug}/tournaments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tournament');
      }
      
      const data = await response.json();
      toast.success('Tournament created successfully!');
      
      // Navigate to the new tournament's admin page
      navigate(`/${organization?.slug}/admin/tournaments/${data.tournament.slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tournament');
    } finally {
      setSaving(false);
    }
  };

  const SectionHeader: React.FC<{
    title: string;
    icon: React.ReactNode;
    section: keyof typeof expandedSections;
  }> = ({ title, icon, section }) => (
    <button
      type="button"
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
    >
      <div className="flex items-center gap-3">
        <div className="text-brand-600">{icon}</div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-5 h-5 text-gray-400" />
      ) : (
        <ChevronDown className="w-5 h-5 text-gray-400" />
      )}
    </button>
  );

  const InputField: React.FC<{
    label: string;
    name: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    value: string | number;
    error?: string;
  }> = ({ label, name, type = 'text', placeholder, required, min, max, step, value, error }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header
        className="text-white py-6 px-4"
        style={{ backgroundColor: organization?.primary_color || '#1e40af' }}
      >
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(`/${organization?.slug}/admin`)}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold">Create New Tournament</h1>
          <p className="text-white/80 mt-1">{organization?.name}</p>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <SectionHeader title="Basic Information" icon={<Trophy className="w-5 h-5" />} section="basic" />
            {expandedSections.basic && (
              <div className="p-6 space-y-4">
                <InputField
                  label="Tournament Name"
                  name="name"
                  placeholder="e.g., Annual Charity Golf Classic"
                  required
                  value={formData.name}
                  error={errors.name}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Year"
                    name="year"
                    type="number"
                    min={2024}
                    value={formData.year}
                  />
                  <InputField
                    label="Edition (optional)"
                    name="edition"
                    placeholder="e.g., 25th Annual"
                    value={formData.edition}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="draft">Draft (not visible to public)</option>
                    <option value="open">Open (registration available)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          
          {/* Date & Location */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <SectionHeader title="Date & Location" icon={<Calendar className="w-5 h-5" />} section="datetime" />
            {expandedSections.datetime && (
              <div className="p-6 space-y-4">
                <InputField
                  label="Event Date"
                  name="event_date"
                  type="date"
                  required
                  value={formData.event_date}
                  error={errors.event_date}
                />
                
                <div className="grid grid-cols-3 gap-4">
                  <InputField
                    label="Check-in Time"
                    name="check_in_time"
                    type="time"
                    value={formData.check_in_time}
                  />
                  <InputField
                    label="Registration Time"
                    name="registration_time"
                    type="time"
                    value={formData.registration_time}
                  />
                  <InputField
                    label="Start Time"
                    name="start_time"
                    type="time"
                    value={formData.start_time}
                  />
                </div>
                
                <InputField
                  label="Venue Name"
                  name="location_name"
                  placeholder="e.g., Country Club Golf Course"
                  required
                  value={formData.location_name}
                  error={errors.location_name}
                />
                
                <InputField
                  label="Address"
                  name="location_address"
                  placeholder="Full address"
                  value={formData.location_address}
                />
              </div>
            )}
          </div>
          
          {/* Format */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <SectionHeader title="Tournament Format" icon={<Trophy className="w-5 h-5" />} section="format" />
            {expandedSections.format && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                    <select
                      name="tournament_format"
                      value={formData.tournament_format}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="scramble">Scramble</option>
                      <option value="stroke">Stroke Play</option>
                      <option value="stableford">Stableford</option>
                      <option value="best_ball">Best Ball</option>
                      <option value="match">Match Play</option>
                      <option value="captain_choice">Captain's Choice</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scoring</label>
                    <select
                      name="scoring_type"
                      value={formData.scoring_type}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="gross">Gross</option>
                      <option value="net">Net</option>
                      <option value="both">Both</option>
                      <option value="stableford">Stableford Points</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Team Size"
                    name="team_size"
                    type="number"
                    min={1}
                    max={4}
                    value={formData.team_size}
                  />
                  
                  <div className="flex items-center gap-3 pt-6">
                    <input
                      type="checkbox"
                      name="shotgun_start"
                      checked={formData.shotgun_start}
                      onChange={handleChange}
                      className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <label className="text-sm font-medium text-gray-700">Shotgun Start</label>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Capacity */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <SectionHeader title="Capacity & Waitlist" icon={<Users className="w-5 h-5" />} section="capacity" />
            {expandedSections.capacity && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Maximum Capacity"
                    name="max_capacity"
                    type="number"
                    min={1}
                    value={formData.max_capacity}
                    error={errors.max_capacity}
                  />
                  <InputField
                    label="Reserved Slots"
                    name="reserved_slots"
                    type="number"
                    min={0}
                    value={formData.reserved_slots}
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="waitlist_enabled"
                    checked={formData.waitlist_enabled}
                    onChange={handleChange}
                    className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                  />
                  <label className="text-sm font-medium text-gray-700">Enable Waitlist</label>
                </div>
                
                {formData.waitlist_enabled && (
                  <InputField
                    label="Maximum Waitlist Size"
                    name="waitlist_max"
                    type="number"
                    min={0}
                    value={formData.waitlist_max}
                  />
                )}
              </div>
            )}
          </div>
          
          {/* Pricing */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <SectionHeader title="Pricing" icon={<DollarSign className="w-5 h-5" />} section="pricing" />
            {expandedSections.pricing && (
              <div className="p-6 space-y-4">
                <InputField
                  label="Entry Fee ($)"
                  name="entry_fee"
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.entry_fee}
                  error={errors.entry_fee}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Early Bird Fee ($)"
                    name="early_bird_fee"
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.early_bird_fee}
                  />
                  <InputField
                    label="Early Bird Deadline"
                    name="early_bird_deadline"
                    type="date"
                    value={formData.early_bird_deadline}
                  />
                </div>
                
                <InputField
                  label="Registration Deadline"
                  name="registration_deadline"
                  type="date"
                  value={formData.registration_deadline}
                />
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fee Includes
                  </label>
                  <textarea
                    name="fee_includes"
                    value={formData.fee_includes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="e.g., Green fees, cart, lunch, prizes, goody bag..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Payment Options */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <SectionHeader title="Payment Options" icon={<DollarSign className="w-5 h-5" />} section="payment" />
            {expandedSections.payment && (
              <div className="p-6 space-y-4">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="allow_card"
                      checked={formData.allow_card}
                      onChange={handleChange}
                      className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Credit Card (Stripe)</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="allow_cash"
                      checked={formData.allow_cash}
                      onChange={handleChange}
                      className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Cash</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="allow_check"
                      checked={formData.allow_check}
                      onChange={handleChange}
                      className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Check</span>
                  </label>
                </div>
                
                {formData.allow_check && (
                  <InputField
                    label="Make Checks Payable To"
                    name="checks_payable_to"
                    placeholder="Organization name"
                    value={formData.checks_payable_to}
                  />
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Instructions
                  </label>
                  <textarea
                    name="payment_instructions"
                    value={formData.payment_instructions}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Additional payment instructions..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Contact */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <SectionHeader title="Contact Information" icon={<MapPin className="w-5 h-5" />} section="contact" />
            {expandedSections.contact && (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InputField
                    label="Contact Name"
                    name="contact_name"
                    placeholder="Tournament coordinator"
                    value={formData.contact_name}
                  />
                  <InputField
                    label="Contact Phone"
                    name="contact_phone"
                    type="tel"
                    placeholder="(671) 555-1234"
                    value={formData.contact_phone}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(`/${organization?.slug}/admin`)}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>{saving ? 'Creating...' : 'Create Tournament'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};
