import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { X, Loader2, UserPlus, CreditCard, Banknote, Building2 } from 'lucide-react';
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

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  payment_status: 'paid' | 'unpaid';
  payment_method: 'cash' | 'check' | 'card' | 'online' | '';
  notes: string;
}

const defaultFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  company: '',
  payment_status: 'unpaid',
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
  const [formData, setFormData] = useState<FormData>(defaultFormData);
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
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    }
    if (formData.payment_status === 'paid' && !formData.payment_method) {
      newErrors.payment_method = 'Payment method is required when marked as paid';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

      const payload = {
        golfer: {
          ...formData,
          tournament_id: tournamentId,
          registration_status: 'confirmed',
          payment_type: 'pay_on_day', // Manual registrations are always pay on day
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
        throw new Error(data.error || 'Failed to add golfer');
      }

      toast.success(`${formData.name} added successfully!`);
      setFormData(defaultFormData);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add golfer');
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
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-100 rounded-lg">
              <UserPlus className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Add Golfer</h2>
              <p className="text-sm text-gray-500">Manual registration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
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

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
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
                placeholder="(671) 555-1234"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
            </div>
          </div>

          {/* Company */}
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

          {/* Payment Section */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">Entry Fee</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(entryFee)}</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Status
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payment_status"
                    value="unpaid"
                    checked={formData.payment_status === 'unpaid'}
                    onChange={handleChange}
                    className="w-4 h-4 text-brand-600"
                  />
                  <span className="text-gray-700">Unpaid</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payment_status"
                    value="paid"
                    checked={formData.payment_status === 'paid'}
                    onChange={handleChange}
                    className="w-4 h-4 text-brand-600"
                  />
                  <span className="text-gray-700">Paid</span>
                </label>
              </div>
            </div>

            {formData.payment_status === 'paid' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cash', label: 'Cash', icon: Banknote },
                    { value: 'check', label: 'Check', icon: CreditCard },
                    { value: 'card', label: 'Card', icon: CreditCard },
                    { value: 'online', label: 'Online', icon: CreditCard },
                  ].map(({ value, label, icon: Icon }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                        formData.payment_method === value
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-300 hover:bg-gray-50'
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
                      <Icon className={`w-4 h-4 ${formData.payment_method === value ? 'text-brand-600' : 'text-gray-400'}`} />
                      <span className={formData.payment_method === value ? 'text-brand-700 font-medium' : 'text-gray-700'}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.payment_method && (
                  <p className="mt-1 text-sm text-red-500">{errors.payment_method}</p>
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
              onClick={onClose}
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
                  <UserPlus className="w-5 h-5" />
                  Add Golfer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
