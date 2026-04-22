import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { X, Loader2, CreditCard, Banknote, Building2, Users, Send, CheckCircle, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface AddGolferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tournamentId?: string | number;
  tournamentSlug?: string;
  orgSlug?: string;
  entryFee?: number;
  tournamentName?: string;
}

type PaymentOption = 'send_link' | 'already_paid';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  partner_name: string;
  partner_email: string;
  partner_phone: string;
  team_category: string;
  payment_option: PaymentOption;
  payment_method: 'swipe_simple' | 'cash' | 'check' | 'card' | '';
  notes: string;
}

const defaultFormData: FormData = {
  name: '',
  email: '',
  phone: '+1671',
  company: '',
  partner_name: '',
  partner_email: '',
  partner_phone: '',
  team_category: '',
  payment_option: 'send_link',
  payment_method: '',
  notes: '',
};

export const AddGolferModal: React.FC<AddGolferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  tournamentSlug,
  orgSlug,
  entryFee = 0,
  tournamentId,
}) => {
  const { getToken } = useAuth();
  const [formData, setFormData] = useState<FormData>({ ...defaultFormData });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const phoneIsEmpty = (val: string) => {
    const stripped = val.replace(/\D/g, '');
    return !stripped || stripped === '1671' || stripped === '1670';
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }
    if (phoneIsEmpty(formData.phone)) {
      newErrors.phone = 'Phone is required';
    }
    if (!formData.team_category) {
      newErrors.team_category = 'Team category is required';
    }
    if (formData.payment_option === 'already_paid' && !formData.payment_method) {
      newErrors.payment_method = 'Payment method is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClose = () => {
    setFormData({ ...defaultFormData });
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix the errors');
      return;
    }

    setSaving(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const usingOrgScopedEndpoint = Boolean(orgSlug && tournamentSlug);
      const endpoint = usingOrgScopedEndpoint
        ? `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${orgSlug}/tournaments/${tournamentSlug}/golfers`
        : `${import.meta.env.VITE_API_URL}/api/v1/golfers`;

      const isPaid = formData.payment_option === 'already_paid';

      const payload = {
        golfer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company || undefined,
          partner_name: formData.partner_name || undefined,
          partner_email: formData.partner_email || undefined,
          partner_phone: formData.partner_phone || undefined,
          team_category: formData.team_category || undefined,
          notes: formData.notes || undefined,
          tournament_id: tournamentId,
          registration_status: isPaid ? 'confirmed' : 'pending',
          registration_source: 'admin',
          payment_type: isPaid ? (formData.payment_method === 'swipe_simple' ? 'swipe_simple' : 'pay_on_day') : 'stripe',
          payment_status: isPaid ? 'paid' : 'unpaid',
          payment_method: isPaid ? formData.payment_method : undefined,
          is_team_captain: true,
          waiver_accepted_at: new Date().toISOString(),
        },
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add team');
      }

      const golferData = await response.json();
      const golferId = golferData.id || golferData.golfer?.id;

      if (formData.payment_option === 'send_link' && golferId) {
        try {
          const linkRes = await fetch(
            `${import.meta.env.VITE_API_URL}/api/v1/golfers/${golferId}/send_payment_link`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            }
          );
          if (linkRes.ok) {
            toast.success(`${formData.name} added and payment link sent to ${formData.email}!`);
          } else {
            toast.success(`${formData.name} added! Payment link could not be sent — you can resend from their details.`);
          }
        } catch {
          toast.success(`${formData.name} added! Payment link could not be sent — you can resend from their details.`);
        }
      } else if (isPaid && golferId) {
        try {
          await fetch(
            `${import.meta.env.VITE_API_URL}/api/v1/golfers/${golferId}/mark_paid`,
            {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                payment_method: formData.payment_method,
                payment_notes: `Marked paid on registration (${formData.payment_method})`,
              }),
            }
          );
        } catch {
          // already created as paid; mark_paid is best-effort for audit
        }
        toast.success(`${formData.name} added and marked as paid!`);
      }

      setFormData({ ...defaultFormData });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add team');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-100 rounded-lg">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add Team</h2>
              <p className="text-sm text-gray-500">Manual team registration</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Player 1 (Captain) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">1</span>
              <p className="text-sm font-semibold text-gray-700">Player 1 (Team Captain)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Smith"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1671"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
              </div>
            </div>
          </div>

          {/* Player 2 (Partner) */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">2</span>
              <p className="text-sm font-semibold text-gray-700">Player 2 (Partner)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                name="partner_name"
                value={formData.partner_name}
                onChange={handleChange}
                placeholder="Partner's full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="partner_email"
                  value={formData.partner_email}
                  onChange={handleChange}
                  placeholder="partner@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="partner_phone"
                  value={formData.partner_phone}
                  onChange={handleChange}
                  placeholder="(671) 555-1234"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Company & Category */}
          <div className="pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company / Organization
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Optional"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="team_category"
                  value={formData.team_category}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                    errors.team_category ? 'border-red-400 ring-2 ring-red-100' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Co-Ed">Co-Ed</option>
                </select>
                {errors.team_category && <p className="text-xs text-red-500 mt-1">{errors.team_category}</p>}
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="pt-4 border-t border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Payment</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(entryFee)}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Send Payment Link */}
              <label
                className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.payment_option === 'send_link'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment_option"
                  value="send_link"
                  checked={formData.payment_option === 'send_link'}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4 text-brand-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-medium text-gray-900 text-sm">Send Payment Link</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Email golfer a link to pay online</p>
                </div>
              </label>

              {/* Already Paid */}
              <label
                className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.payment_option === 'already_paid'
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="payment_option"
                  value="already_paid"
                  checked={formData.payment_option === 'already_paid'}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4 text-brand-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="font-medium text-gray-900 text-sm">Already Paid</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Mark as paid immediately</p>
                </div>
              </label>
            </div>

            {/* Payment method selector for "Already Paid" */}
            {formData.payment_option === 'already_paid' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: 'swipe_simple' as const, label: 'SwipeSimple', icon: Smartphone },
                    { value: 'cash' as const, label: 'Cash', icon: Banknote },
                    { value: 'check' as const, label: 'Check', icon: CreditCard },
                    { value: 'card' as const, label: 'Card', icon: CreditCard },
                  ].map(({ value, label, icon: Icon }) => (
                    <label
                      key={value}
                      className={`flex items-center justify-center gap-1.5 p-2.5 border-2 rounded-lg cursor-pointer transition-colors text-sm ${
                        formData.payment_method === value
                          ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={value}
                        checked={formData.payment_method === value}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <Icon className="w-4 h-4" />
                      {label}
                    </label>
                  ))}
                </div>
                {errors.payment_method && (
                  <p className="text-sm text-red-500">{errors.payment_method}</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Add Team
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
