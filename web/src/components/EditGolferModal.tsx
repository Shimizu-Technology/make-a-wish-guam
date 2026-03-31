import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { X, Loader2, Save, Banknote, CreditCard, Building2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Golfer {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  registration_status: 'confirmed' | 'waitlist' | 'cancelled';
  payment_status: 'paid' | 'unpaid' | 'refunded';
  payment_method: string | null;
  payment_type: string | null;
  notes: string | null;
  checked_in_at: string | null;
  created_at: string;
}

interface EditGolferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  golfer: Golfer | null;
  tournamentSlug: string;
  orgSlug: string;
  entryFee: number;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  payment_status: 'paid' | 'unpaid' | 'refunded';
  payment_method: string;
  notes: string;
}

export const EditGolferModal: React.FC<EditGolferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  golfer,
  tournamentSlug,
  orgSlug,
  entryFee,
}) => {
  const { getToken } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    payment_status: 'unpaid',
    payment_method: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when golfer changes
  useEffect(() => {
    if (golfer) {
      setFormData({
        name: golfer.name || '',
        email: golfer.email || '',
        phone: golfer.phone || '',
        company: golfer.company || '',
        payment_status: golfer.payment_status || 'unpaid',
        payment_method: golfer.payment_method || '',
        notes: golfer.notes || '',
      });
    }
  }, [golfer]);

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

    if (!validate() || !golfer) {
      toast.error('Please fix the errors');
      return;
    }

    setSaving(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/admin/organizations/${orgSlug}/tournaments/${tournamentSlug}/golfers/${golfer.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ golfer: formData }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update golfer');
      }

      toast.success('Golfer updated successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update golfer');
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

  if (!isOpen || !golfer) return null;

  const isCancelled = golfer.registration_status === 'cancelled';
  const isRefunded = golfer.payment_status === 'refunded';

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
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Golfer</h2>
            <p className="text-sm text-gray-500">Update registration details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Warnings */}
        {(isCancelled || isRefunded) && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              {isCancelled && <p>This registration has been cancelled.</p>}
              {isRefunded && <p>This registration has been refunded.</p>}
            </div>
          </div>
        )}

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
                    disabled={isRefunded}
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
                    disabled={isRefunded}
                    className="w-4 h-4 text-brand-600"
                  />
                  <span className="text-gray-700">Paid</span>
                </label>
                {isRefunded && (
                  <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded text-sm">
                    Refunded
                  </span>
                )}
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
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
