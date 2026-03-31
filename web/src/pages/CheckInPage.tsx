import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, Button, Input, Select } from '../components/ui';
import { Search, CheckCircle, DollarSign, User, RefreshCw, X, UserCheck, CreditCard, Users, Clock, ArrowUpCircle, Send, Copy, Loader2, Pencil, AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, Golfer, GolferStats, ActivityLog } from '../services/api';
import { useGolferChannel } from '../hooks/useGolferChannel';
import { useTournament } from '../contexts/TournamentContext';

interface PaymentInfo {
  method: 'cash' | 'check' | 'credit';
  receiptNumber: string;
  notes: string;
}

type CheckInQueue = 'paid' | 'unpaid' | 'checked-in' | 'all' | 'waitlist';

// Player detail content - extracted to avoid re-render issues
const PlayerDetailPanel: React.FC<{
  golfer: Golfer;
  paymentInfo: PaymentInfo;
  setPaymentInfo: React.Dispatch<React.SetStateAction<PaymentInfo>>;
  isProcessing: boolean;
  onCheckIn: () => void;
  onRecordPayment: () => void;
  onClose: () => void;
  showCloseButton?: boolean;
  entryFee?: number;
  activityLogs?: ActivityLog[];
  loadingActivityLogs?: boolean;
  // Waitlist props
  isPromoting?: boolean;
  onPromote?: () => void;
  onPromotePayCheckIn?: () => void;
  capacityRemaining?: number;
  // Payment link props
  isSendingPaymentLink?: boolean;
  onSendPaymentLink?: () => void;
  onCopyPaymentLink?: () => void;
  // Employee toggle props
  isTogglingEmployee?: boolean;
  onToggleEmployee?: () => void;
  // Payment notes editing props
  isEditingPaymentNotes?: boolean;
  editPaymentNotesValue?: string;
  isSavingPaymentNotes?: boolean;
  onStartEditPaymentNotes?: () => void;
  onCancelEditPaymentNotes?: () => void;
  onSavePaymentNotes?: () => void;
  onPaymentNotesChange?: (value: string) => void;
}> = ({ golfer, paymentInfo, setPaymentInfo, isProcessing, onCheckIn, onRecordPayment, onClose, showCloseButton = true, entryFee = 125, activityLogs = [], loadingActivityLogs = false, isPromoting = false, onPromote, onPromotePayCheckIn, capacityRemaining = 0, isSendingPaymentLink = false, onSendPaymentLink, onCopyPaymentLink, isTogglingEmployee = false, onToggleEmployee, isEditingPaymentNotes = false, editPaymentNotesValue = '', isSavingPaymentNotes = false, onStartEditPaymentNotes, onCancelEditPaymentNotes, onSavePaymentNotes, onPaymentNotesChange }) => {
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3 lg:gap-4">
        <div className={`p-3 lg:p-4 rounded-full ${
          golfer.checked_in 
            ? 'bg-brand-100' 
            : golfer.payment_status === 'paid' 
            ? 'bg-green-100' 
            : 'bg-amber-100'
        }`}>
          <User className={
            golfer.checked_in 
              ? 'text-brand-600' 
              : golfer.payment_status === 'paid' 
              ? 'text-green-600' 
              : 'text-amber-600'
          } size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">
            {golfer.name}
          </h2>
          <p className="text-sm text-gray-600 truncate">{golfer.company || '-'}</p>
        </div>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="hidden lg:block text-gray-400 hover:text-gray-600 p-1 touch-manipulation"
          >
            <X size={24} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Email</p>
          <p className="font-medium text-gray-900 text-sm truncate">{golfer.email}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Phone</p>
          <p className="font-medium text-gray-900 text-sm">{golfer.phone || '-'}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">Hole</p>
          <p className="font-medium text-gray-900 text-sm">
            {golfer.hole_position_label && golfer.hole_position_label !== 'Unassigned' ? golfer.hole_position_label : 'Not Assigned'}
          </p>
        </div>
      </div>

      {golfer.checked_in ? (
        <div className="bg-brand-50 border-2 border-brand-500 rounded-lg p-4 lg:p-6 text-center">
          <CheckCircle className="mx-auto text-brand-600 mb-2" size={40} />
          <p className="text-lg font-bold text-brand-600">
            Already Checked In
          </p>
        </div>
      ) : golfer.registration_status === 'waitlist' ? (
        /* Waitlist Golfer UI */
        <div className="space-y-4">
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Clock className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-purple-900">Waitlist Player</p>
                <p className="text-sm text-purple-700">
                  {capacityRemaining > 0 
                    ? `${capacityRemaining} spots available - can promote now!`
                    : 'No spots available'}
                </p>
              </div>
            </div>

            {capacityRemaining > 0 && onPromote && (
              <Button
                onClick={onPromote}
                disabled={isPromoting}
                className="w-full bg-purple-600 hover:bg-purple-700 mb-2"
              >
                {isPromoting ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                    Promoting...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle size={18} className="mr-2" />
                    Promote to Confirmed (Send Email)
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Quick Day-Of Flow: Promote + Pay + Check-In */}
          {capacityRemaining > 0 && onPromotePayCheckIn && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 mb-3">
                Quick Check-In (Day-Of Walk-In)
              </p>
              <p className="text-xs text-amber-700 mb-3">
                Promote, record payment, and check-in all at once
              </p>
              
              <div className="space-y-3 mb-4">
                <Select
                  label="Payment Method"
                  value={paymentInfo.method}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, method: e.target.value as PaymentInfo['method'] }))}
                  options={[
                    { value: 'cash', label: 'Cash' },
                    { value: 'check', label: 'Check' },
                    { value: 'credit', label: 'Credit Card' },
                  ]}
                />
                
                <Input
                  label="Receipt # (optional)"
                  value={paymentInfo.receiptNumber}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, receiptNumber: e.target.value }))}
                  placeholder="Receipt number"
                />
              </div>
              
              <Button
                onClick={onPromotePayCheckIn}
                disabled={isProcessing}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={18} className="mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UserCheck size={18} className="mr-2" />
                    Promote + Pay ${entryFee} + Check-In
                  </>
                )}
              </Button>
            </div>
          )}

          {capacityRemaining <= 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-sm text-red-700 flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Tournament is at capacity. Cannot add more players until a spot opens.
              </p>
            </div>
          )}
        </div>
      ) : golfer.payment_status === 'paid' ? (
        <>
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-3 lg:p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={20} className="text-green-600" />
              <p className="font-semibold text-green-800">Payment Complete</p>
            </div>
            <p className="text-sm text-green-700">
              {golfer.payment_type === 'stripe' ? 'Paid online via Stripe' : 'Payment has been recorded'}
            </p>
            
            {/* Payment Details */}
            <div className="mt-3 pt-3 border-t border-green-200 space-y-1.5 text-sm">
              {golfer.payment_method && (
                <div className="flex justify-between">
                  <span className="text-green-600">Method:</span>
                  <span className="text-green-800 font-medium capitalize">{golfer.payment_method}</span>
                </div>
              )}
              {golfer.receipt_number && (
                <div className="flex justify-between">
                  <span className="text-green-600">Receipt #:</span>
                  <span className="text-green-800 font-medium">{golfer.receipt_number}</span>
                </div>
              )}
              {/* Payment Notes - Editable */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-green-600">Notes:</span>
                  {!isEditingPaymentNotes && onStartEditPaymentNotes && (
                    <button
                      onClick={onStartEditPaymentNotes}
                      className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-100"
                      title="Edit payment notes"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
                
                {isEditingPaymentNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={editPaymentNotesValue}
                      onChange={(e) => onPaymentNotesChange?.(e.target.value)}
                      className="w-full px-2 py-1.5 border border-green-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                      rows={3}
                      placeholder="Enter payment notes..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={onSavePaymentNotes}
                        disabled={isSavingPaymentNotes}
                        className="flex-1 py-1 px-2 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSavingPaymentNotes ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={onCancelEditPaymentNotes}
                        disabled={isSavingPaymentNotes}
                        className="flex-1 py-1 px-2 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-green-800 bg-green-100/50 p-2 rounded text-xs whitespace-pre-wrap">
                    {golfer.payment_notes || <span className="italic text-green-500">No notes</span>}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Button
            onClick={onCheckIn}
            className="w-full py-3 lg:py-4 text-base lg:text-lg bg-green-600 hover:bg-green-700"
            size="lg"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={20} className="mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle size={20} className="mr-2" />
                Check In Player
              </>
            )}
          </Button>
        </>
      ) : (
        <>
          <div className="bg-amber-50 border-2 border-amber-500 rounded-lg p-3 lg:p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={20} className="text-amber-600" />
              <p className="font-semibold text-amber-800">Payment Required</p>
            </div>
            <p className="text-sm text-amber-700">
              Collect ${entryFee.toFixed(2)} before checking in
              {golfer.is_employee && <span className="ml-1 text-purple-700">(Employee Rate)</span>}
            </p>
          </div>

          <div className="p-3 lg:p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3 lg:space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard size={18} />
              Record Payment
            </h3>

            {/* Employee Toggle */}
            {onToggleEmployee && (
              <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  <span className="text-sm text-gray-700">Employee Discount</span>
                </div>
                <button
                  onClick={onToggleEmployee}
                  disabled={isTogglingEmployee}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    golfer.is_employee
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {isTogglingEmployee ? 'Updating...' : golfer.is_employee ? (
                    <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Applied</span>
                  ) : 'Apply'}
                </button>
              </div>
            )}

            <Select
              label="Payment Method"
              value={paymentInfo.method}
              onChange={(e) =>
                setPaymentInfo(prev => ({ ...prev, method: e.target.value as PaymentInfo['method'] }))
              }
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'check', label: 'Check' },
                { value: 'credit', label: 'Credit Card' },
              ]}
            />

            <Input
              label="Receipt Number"
              value={paymentInfo.receiptNumber}
              onChange={(e) =>
                setPaymentInfo(prev => ({ ...prev, receiptNumber: e.target.value }))
              }
              placeholder="Enter receipt #"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={paymentInfo.notes}
                onChange={(e) =>
                  setPaymentInfo(prev => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Any notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-sm"
                rows={2}
              />
            </div>

            <Button
              onClick={onRecordPayment}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign size={18} className="mr-2" />
                  Mark as Paid (${entryFee.toFixed(0)})
                </>
              )}
            </Button>
          </div>

          {/* Send Payment Link Option */}
          {onSendPaymentLink && (
            <div className="p-3 lg:p-4 bg-brand-50 border border-brand-200 rounded-lg space-y-2">
              <h4 className="text-sm font-medium text-brand-800 flex items-center gap-2">
                <Send size={16} />
                Or Send Payment Link
              </h4>
              <p className="text-xs text-brand-700">
                Email a secure payment link to the golfer so they can pay online.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={onSendPaymentLink}
                  variant="outline"
                  className="flex-1 py-2 text-brand-700 border-brand-300 hover:bg-brand-100"
                  disabled={isSendingPaymentLink}
                >
                  {isSendingPaymentLink ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : (
                    <Send size={16} className="mr-2" />
                  )}
                  {isSendingPaymentLink ? 'Sending...' : 'Send Link'}
                </Button>
                {golfer.payment_token && onCopyPaymentLink && (
                  <Button
                    onClick={onCopyPaymentLink}
                    variant="outline"
                    className="py-2 px-3 text-gray-600 border-gray-300 hover:bg-gray-100"
                  >
                    <Copy size={16} />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Activity History */}
      <div className="pt-4 border-t border-gray-200 mt-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity History</h4>
        {loadingActivityLogs ? (
          <div className="text-center py-3 text-gray-500 text-sm">Loading...</div>
        ) : activityLogs.length === 0 ? (
          <div className="text-center py-3 text-gray-400 text-sm">No activity recorded</div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {activityLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg p-2">
                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 text-xs">{log.details}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(log.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: 'Pacific/Guam'
                    })} • {log.admin_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const CheckInPage: React.FC = () => {
  const { currentTournament } = useTournament();
  const [searchTerm, setSearchTerm] = useState('');
  const [lastNameFilter, setLastNameFilter] = useState<'all' | 'a-j' | 'k-z'>('all');
  const [selectedGolfer, setSelectedGolfer] = useState<Golfer | null>(null);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [stats, setStats] = useState<GolferStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeQueue, setActiveQueue] = useState<CheckInQueue>('checked-in');
  const [golferActivityLogs, setGolferActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const [isTogglingEmployee, setIsTogglingEmployee] = useState(false);
  // Payment notes editing state
  const [isEditingPaymentNotes, setIsEditingPaymentNotes] = useState(false);
  const [editPaymentNotesValue, setEditPaymentNotesValue] = useState('');
  const [isSavingPaymentNotes, setIsSavingPaymentNotes] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    method: 'cash',
    receiptNumber: '',
    notes: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [golfersResponse, statsResponse] = await Promise.all([
        api.getGolfers({ per_page: 1000 }),
        api.getGolferStats(),
      ]);
      setGolfers(golfersResponse.golfers);
      setStats(statsResponse);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTournament) {
      fetchData();
    }
  }, [currentTournament?.id]);

  // Real-time updates via ActionCable
  const handleGolferUpdated = useCallback((updatedGolfer: Golfer) => {
    setGolfers(prev => prev.map(g => g.id === updatedGolfer.id ? updatedGolfer : g));
    // Also update selectedGolfer if it's the same one
    setSelectedGolfer(prev => prev?.id === updatedGolfer.id ? updatedGolfer : prev);
    // Refresh stats
    api.getGolferStats().then(setStats).catch(console.error);
  }, []);

  const handleGolferCreated = useCallback((newGolfer: Golfer) => {
    setGolfers(prev => [...prev, newGolfer]);
    api.getGolferStats().then(setStats).catch(console.error);
  }, []);

  const handleGolferDeleted = useCallback((golferId: number) => {
    setGolfers(prev => prev.filter(g => g.id !== golferId));
    setSelectedGolfer(prev => prev?.id === golferId ? null : prev);
    api.getGolferStats().then(setStats).catch(console.error);
  }, []);

  useGolferChannel({
    onGolferUpdated: handleGolferUpdated,
    onGolferCreated: handleGolferCreated,
    onGolferDeleted: handleGolferDeleted,
  });

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Calculate counts - only count confirmed golfers (exclude cancelled)
  const counts = useMemo(() => {
    const confirmed = golfers.filter(g => g.registration_status === 'confirmed');
    const pendingConfirmed = confirmed.filter(g => !g.checked_in);
    return {
      total: confirmed.length,
      checkedIn: confirmed.filter(g => g.checked_in).length,
      paidPending: pendingConfirmed.filter(g => g.payment_status === 'paid').length,
      unpaidPending: pendingConfirmed.filter(g => g.payment_status === 'unpaid').length,
    };
  }, [golfers]);

  // Filter golfers based on active queue and search
  const filteredGolfers = useMemo(() => {
    let filtered = golfers;

    switch (activeQueue) {
      case 'paid':
        // Confirmed golfers who are paid but not checked in
        filtered = filtered.filter(g => !g.checked_in && g.payment_status === 'paid' && g.registration_status === 'confirmed');
        break;
      case 'unpaid':
        // Confirmed golfers who are unpaid and not checked in
        filtered = filtered.filter(g => !g.checked_in && g.payment_status === 'unpaid' && g.registration_status === 'confirmed');
        break;
      case 'checked-in':
        filtered = filtered.filter(g => g.checked_in);
        break;
      case 'waitlist':
        // Waitlist golfers only
        filtered = filtered.filter(g => g.registration_status === 'waitlist');
        break;
      case 'all':
        // Exclude waitlist from "all" - they have their own tab
        filtered = filtered.filter(g => g.registration_status === 'confirmed');
        break;
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.name?.toLowerCase().includes(search) ||
        g.email?.toLowerCase().includes(search) ||
        g.phone?.includes(searchTerm) ||
        g.company?.toLowerCase().includes(search)
      );
    }

    // Filter by last name range
    if (lastNameFilter !== 'all') {
      filtered = filtered.filter(g => {
        const lastName = g.last_name?.toLowerCase() || g.name?.split(' ').pop()?.toLowerCase() || '';
        const firstChar = lastName.charAt(0);
        if (lastNameFilter === 'a-j') {
          return firstChar >= 'a' && firstChar <= 'j';
        } else if (lastNameFilter === 'k-z') {
          return firstChar >= 'k' && firstChar <= 'z';
        }
        return true;
      });
    }

    // Sort by last name for easier check-in
    filtered.sort((a, b) => {
      const aLastName = a.last_name?.toLowerCase() || a.name?.split(' ').pop()?.toLowerCase() || '';
      const bLastName = b.last_name?.toLowerCase() || b.name?.split(' ').pop()?.toLowerCase() || '';
      return aLastName.localeCompare(bLastName);
    });

    return filtered;
  }, [golfers, searchTerm, activeQueue, lastNameFilter]);

  // Count waitlist golfers
  const waitlistCount = useMemo(() => 
    golfers.filter(g => g.registration_status === 'waitlist').length,
    [golfers]
  );


  const handleRecordPayment = async () => {
    if (!selectedGolfer) return;

    try {
      setIsProcessing(true);
      setError(null);

      const updatedGolfer = await api.addPaymentDetails(selectedGolfer.id, {
        payment_method: paymentInfo.method,
        receipt_number: paymentInfo.receiptNumber,
        payment_notes: paymentInfo.notes,
      });
      
      setSuccessMessage(`Payment recorded for ${selectedGolfer.name}!`);
      
      await fetchData();
      
      // Update the selected golfer with full response data (includes payment_amount_cents)
      setSelectedGolfer(updatedGolfer);
      
      setPaymentInfo({
        method: 'cash',
        receiptNumber: '',
        notes: '',
      });
    } catch (err) {
      console.error('Error recording payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Send payment link to golfer
  const handleSendPaymentLink = async () => {
    if (!selectedGolfer) return;
    
    setIsSendingPaymentLink(true);
    try {
      const result = await api.sendPaymentLink(selectedGolfer.id);
      toast.success(result.message);
      // Refresh data to get updated golfer with payment_token
      await fetchData();
    } catch (err) {
      console.error('Error sending payment link:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally {
      setIsSendingPaymentLink(false);
    }
  };

  // Toggle employee status
  const handleToggleEmployee = async () => {
    if (!selectedGolfer) return;
    
    setIsTogglingEmployee(true);
    try {
      const updatedGolfer = await api.toggleEmployee(selectedGolfer.id);
      const action = updatedGolfer.is_employee ? 'marked as employee' : 'removed employee status';
      toast.success(`${selectedGolfer.name} has been ${action}.`);
      setSelectedGolfer(updatedGolfer);
      await fetchData();
    } catch (err) {
      console.error('Error toggling employee status:', err);
      toast.error('Failed to update employee status');
    } finally {
      setIsTogglingEmployee(false);
    }
  };

  // Start editing payment notes
  const handleStartEditPaymentNotes = () => {
    if (!selectedGolfer) return;
    setEditPaymentNotesValue(selectedGolfer.payment_notes || '');
    setIsEditingPaymentNotes(true);
  };

  // Cancel editing payment notes
  const handleCancelEditPaymentNotes = () => {
    setIsEditingPaymentNotes(false);
    setEditPaymentNotesValue('');
  };

  // Save payment notes
  const handleSavePaymentNotes = async () => {
    if (!selectedGolfer) return;
    
    setIsSavingPaymentNotes(true);
    try {
      const updatedGolfer = await api.updateGolfer(selectedGolfer.id, {
        payment_notes: editPaymentNotesValue.trim() || undefined,
      });
      toast.success('Payment notes updated');
      setSelectedGolfer(updatedGolfer);
      setIsEditingPaymentNotes(false);
      setEditPaymentNotesValue('');
      await fetchData();
      // Refresh activity logs to show the payment notes update
      const response = await api.getGolferActivityHistory(updatedGolfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error updating payment notes:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update payment notes');
    } finally {
      setIsSavingPaymentNotes(false);
    }
  };

  // Copy payment link to clipboard
  const handleCopyPaymentLink = async () => {
    if (!selectedGolfer?.payment_token) {
      toast.error('No payment link available');
      return;
    }
    
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const paymentLink = `${frontendUrl}/pay/${selectedGolfer.payment_token}`;
    
    try {
      await navigator.clipboard.writeText(paymentLink);
      toast.success('Payment link copied to clipboard');
    } catch (err) {
      console.error('Error copying link:', err);
      toast.error('Failed to copy link');
    }
  };

  const handleCheckIn = async () => {
    if (!selectedGolfer) return;

    try {
      setIsProcessing(true);
      setError(null);

      await api.checkInGolfer(selectedGolfer.id);
      
      setSuccessMessage(`${selectedGolfer.name} checked in successfully!`);
      
      await fetchData();
      
      setSelectedGolfer(null);
    } catch (err) {
      console.error('Error during check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to check in golfer');
    } finally {
      setIsProcessing(false);
    }
  };

  // Promote waitlist golfer to confirmed
  const handlePromote = async () => {
    if (!selectedGolfer) return;

    try {
      setIsPromoting(true);
      setError(null);

      const updatedGolfer = await api.promoteGolfer(selectedGolfer.id);
      
      toast.success(`${selectedGolfer.name} promoted to confirmed! Email sent.`);
      
      // Update selected golfer to show confirmed status
      setSelectedGolfer(updatedGolfer);
      
      await fetchData();
    } catch (err) {
      console.error('Error promoting golfer:', err);
      setError(err instanceof Error ? err.message : 'Failed to promote golfer');
      toast.error('Failed to promote golfer');
    } finally {
      setIsPromoting(false);
    }
  };

  // Promote, pay, and check-in in one flow (for day-of walk-ins)
  const handlePromotePayCheckIn = async () => {
    if (!selectedGolfer) return;

    try {
      setIsProcessing(true);
      setError(null);

      // Step 1: Promote to confirmed
      await api.promoteGolfer(selectedGolfer.id);
      
      // Step 2: Record payment
      await api.addPaymentDetails(selectedGolfer.id, {
        payment_method: paymentInfo.method,
        receipt_number: paymentInfo.receiptNumber,
        payment_notes: paymentInfo.notes,
      });
      
      // Step 3: Check in
      await api.checkInGolfer(selectedGolfer.id);
      
      setSuccessMessage(`${selectedGolfer.name} promoted, paid, and checked in!`);
      toast.success(`${selectedGolfer.name} is all set!`);
      
      await fetchData();
      
      setSelectedGolfer(null);
      setPaymentInfo({
        method: 'cash',
        receiptNumber: '',
        notes: '',
      });
    } catch (err) {
      console.error('Error in promote/pay/check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete the process');
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedGolfer(null);
    setGolferActivityLogs([]);
  };

  const handleSelectGolfer = async (golfer: Golfer) => {
    setSelectedGolfer(golfer);
    setPaymentInfo({
      method: 'cash',
      receiptNumber: '',
      notes: '',
    });
    setGolferActivityLogs([]);
    setLoadingActivityLogs(true);
    try {
      const response = await api.getGolferActivityHistory(golfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoadingActivityLogs(false);
    }
  };

  const getQueueTitle = () => {
    switch (activeQueue) {
      case 'paid': return 'Paid';
      case 'unpaid': return 'Not Paid';
      case 'checked-in': return 'Checked In';
      case 'waitlist': return 'Waitlist';
      case 'all': return 'All Players';
    }
  };

  const getQueueDescription = () => {
    switch (activeQueue) {
      case 'paid': return 'Ready for quick check-in';
      case 'unpaid': return 'Collect payment first';
      case 'checked-in': return 'Already checked in';
      case 'waitlist': return 'Promote to add to tournament';
      case 'all': return 'All registered players';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-gray-600">
            <RefreshCw className="animate-spin" size={24} />
            <span>Loading...</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Player Check-In</h1>
            <p className="text-xs lg:text-sm text-gray-500 mt-1">
              {counts.checkedIn} of {counts.total} checked in
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Capacity Indicator */}
            {stats && (
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  stats.at_capacity 
                    ? 'bg-red-100 text-red-700' 
                    : stats.capacity_remaining <= 5 
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                }`}>
                  {stats.at_capacity 
                    ? <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> At Capacity</span>
                    : `${stats.capacity_remaining} spots left`}
                  {stats.reserved_slots > 0 && ` (${stats.reserved_slots} reserved)`}
                </div>
              </div>
            )}
            <Button variant="outline" onClick={fetchData} className="text-sm lg:text-base">
              <RefreshCw size={18} className="mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Queue Selection - 2x2 grid on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
          {/* Checked In - Blue (First for quick visibility of who's arrived) */}
          <button
            onClick={() => setActiveQueue('checked-in')}
            className={`p-3 lg:p-4 rounded-lg border-2 transition-all touch-manipulation ${
              activeQueue === 'checked-in' 
                ? 'border-brand-500 ring-2 ring-brand-200 bg-brand-50' 
                : 'border-gray-200 hover:border-brand-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 lg:gap-3">
              <div className={`p-2 lg:p-3 rounded-full ${activeQueue === 'checked-in' ? 'bg-brand-500' : 'bg-brand-100'}`}>
                <UserCheck className={activeQueue === 'checked-in' ? 'text-white' : 'text-brand-600'} size={18} />
              </div>
              <div className="text-left">
                <p className="text-[10px] lg:text-xs font-medium text-brand-700 uppercase">Checked In</p>
                <p className="text-xl lg:text-2xl font-bold text-brand-600">{counts.checkedIn}</p>
              </div>
            </div>
          </button>

          {/* Paid Queue - Green (Ready for quick check-in) */}
          <button
            onClick={() => setActiveQueue('paid')}
            className={`p-3 lg:p-4 rounded-lg border-2 transition-all touch-manipulation ${
              activeQueue === 'paid' 
                ? 'border-green-500 ring-2 ring-green-200 bg-green-50' 
                : 'border-gray-200 hover:border-green-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 lg:gap-3">
              <div className={`p-2 lg:p-3 rounded-full ${activeQueue === 'paid' ? 'bg-green-500' : 'bg-green-100'}`}>
                <CheckCircle className={activeQueue === 'paid' ? 'text-white' : 'text-green-600'} size={18} />
              </div>
              <div className="text-left">
                <p className="text-[10px] lg:text-xs font-medium text-green-700 uppercase">Paid</p>
                <p className="text-xl lg:text-2xl font-bold text-green-600">{counts.paidPending}</p>
              </div>
            </div>
          </button>

          {/* Unpaid Queue - Amber (Need to collect payment) */}
          <button
            onClick={() => setActiveQueue('unpaid')}
            className={`p-3 lg:p-4 rounded-lg border-2 transition-all touch-manipulation ${
              activeQueue === 'unpaid' 
                ? 'border-amber-500 ring-2 ring-amber-200 bg-amber-50' 
                : 'border-gray-200 hover:border-amber-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 lg:gap-3">
              <div className={`p-2 lg:p-3 rounded-full ${activeQueue === 'unpaid' ? 'bg-amber-500' : 'bg-amber-100'}`}>
                <CreditCard className={activeQueue === 'unpaid' ? 'text-white' : 'text-amber-600'} size={18} />
              </div>
              <div className="text-left">
                <p className="text-[10px] lg:text-xs font-medium text-amber-700 uppercase">Not Paid</p>
                <p className="text-xl lg:text-2xl font-bold text-amber-600">{counts.unpaidPending}</p>
              </div>
            </div>
          </button>

          {/* All Players - Gray */}
          <button
            onClick={() => setActiveQueue('all')}
            className={`p-3 lg:p-4 rounded-lg border-2 transition-all touch-manipulation ${
              activeQueue === 'all' 
                ? 'border-gray-500 ring-2 ring-gray-200 bg-gray-50' 
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-2 lg:gap-3">
              <div className={`p-2 lg:p-3 rounded-full ${activeQueue === 'all' ? 'bg-gray-500' : 'bg-gray-100'}`}>
                <Users className={activeQueue === 'all' ? 'text-white' : 'text-gray-600'} size={18} />
              </div>
              <div className="text-left">
                <p className="text-[10px] lg:text-xs font-medium text-gray-700 uppercase">All</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-600">{counts.total}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Waitlist Tab - Separate row for visibility */}
        {waitlistCount > 0 && (
          <button
            onClick={() => setActiveQueue('waitlist')}
            className={`w-full p-3 lg:p-4 rounded-lg border-2 transition-all touch-manipulation ${
              activeQueue === 'waitlist' 
                ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50' 
                : 'border-gray-200 hover:border-purple-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 lg:gap-3">
                <div className={`p-2 lg:p-3 rounded-full ${activeQueue === 'waitlist' ? 'bg-purple-500' : 'bg-purple-100'}`}>
                  <Clock className={activeQueue === 'waitlist' ? 'text-white' : 'text-purple-600'} size={18} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] lg:text-xs font-medium text-purple-700 uppercase">Waitlist</p>
                  <p className="text-xl lg:text-2xl font-bold text-purple-600">{waitlistCount}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  {stats?.capacity_remaining && stats.capacity_remaining > 0 
                    ? `${stats.capacity_remaining} spots available` 
                    : 'No spots available'}
                </p>
                {stats?.capacity_remaining && stats.capacity_remaining > 0 && (
                  <p className="text-xs text-purple-600 font-medium">Ready to promote</p>
                )}
              </div>
            </div>
          </button>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-3 lg:px-4 py-2 lg:py-3 rounded-lg flex items-center gap-2 animate-fade-in text-sm">
            <CheckCircle size={18} />
            {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Player List */}
          <Card className="p-3 lg:p-6">
            <div className="space-y-3 lg:space-y-4">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900">
                  {getQueueTitle()}
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({filteredGolfers.length})
                  </span>
                </h2>
                <p className="text-xs lg:text-sm text-gray-500 mt-1">{getQueueDescription()}</p>
              </div>

              {/* Search and Last Name Filter */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 lg:top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search name, email, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 lg:py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-sm lg:text-base"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-2.5 lg:top-3 text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                {/* Last Name Range Filter */}
                <select
                  value={lastNameFilter}
                  onChange={(e) => setLastNameFilter(e.target.value as 'all' | 'a-j' | 'k-z')}
                  className="px-3 py-2 lg:py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-sm lg:text-base bg-white font-medium"
                >
                  <option value="all">All Names</option>
                  <option value="a-j">Last Name A-J</option>
                  <option value="k-z">Last Name K-Z</option>
                </select>
              </div>

              {/* Player List */}
              <div className="space-y-2 max-h-[40vh] lg:max-h-[calc(100vh-480px)] overflow-y-auto">
                {filteredGolfers.length === 0 ? (
                  <div className="text-center py-6 lg:py-8 text-gray-500 text-sm">
                    {searchTerm ? 'No players found.' : 'No players in this queue.'}
                  </div>
                ) : (
                  filteredGolfers.map((golfer) => (
                    <button
                      key={golfer.id}
                      onClick={() => handleSelectGolfer(golfer)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all touch-manipulation ${
                        selectedGolfer?.id === golfer.id
                          ? 'border-brand-500 bg-brand-50'
                          : golfer.checked_in
                          ? 'border-green-200 bg-green-50 hover:border-green-300'
                          : golfer.payment_status === 'paid'
                          ? 'border-green-200 hover:border-green-300 hover:bg-green-50'
                          : 'border-amber-200 hover:border-amber-300 hover:bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 text-sm lg:text-base truncate">
                              {golfer.name}
                            </p>
                            {golfer.is_employee && (
                              <span className="text-[10px] lg:text-xs bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded">
                                👤
                              </span>
                            )}
                            {golfer.checked_in ? (
                              <span className="text-[10px] lg:text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle size={10} /> Done
                              </span>
                            ) : golfer.payment_status === 'paid' ? (
                              <span className="text-[10px] lg:text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                                Paid
                              </span>
                            ) : (
                              <span className="text-[10px] lg:text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                Unpaid
                              </span>
                            )}
                          </div>
                          <p className="text-xs lg:text-sm text-gray-600 truncate">{golfer.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] lg:text-xs text-gray-500">
                              Hole {golfer.hole_position_label || 'Unassigned'}
                            </span>
                            {golfer.company && (
                              <span className="text-[10px] lg:text-xs text-gray-500 truncate">• {golfer.company}</span>
                            )}
                          </div>
                        </div>
                        {golfer.checked_in ? (
                          <CheckCircle className="text-brand-600 flex-shrink-0" size={20} />
                        ) : golfer.payment_status === 'paid' ? (
                          <div className="w-5 h-5 border-2 border-green-400 rounded-full flex-shrink-0 bg-green-50" />
                        ) : (
                          <DollarSign className="text-amber-500 flex-shrink-0" size={20} />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </Card>

          {/* Desktop: Player Detail Panel */}
          <Card className="hidden lg:block p-6">
            {selectedGolfer ? (
              <PlayerDetailPanel
                golfer={selectedGolfer}
                paymentInfo={paymentInfo}
                setPaymentInfo={setPaymentInfo}
                isProcessing={isProcessing}
                onCheckIn={handleCheckIn}
                onRecordPayment={handleRecordPayment}
                onClose={handleClearSelection}
                showCloseButton={true}
                entryFee={selectedGolfer?.is_employee ? (stats?.employee_entry_fee_dollars ?? 50) : (stats?.entry_fee_dollars ?? 125)}
                activityLogs={golferActivityLogs}
                loadingActivityLogs={loadingActivityLogs}
                isPromoting={isPromoting}
                onPromote={handlePromote}
                onPromotePayCheckIn={handlePromotePayCheckIn}
                capacityRemaining={stats?.capacity_remaining ?? 0}
                isSendingPaymentLink={isSendingPaymentLink}
                onSendPaymentLink={handleSendPaymentLink}
                onCopyPaymentLink={handleCopyPaymentLink}
                isTogglingEmployee={isTogglingEmployee}
                onToggleEmployee={handleToggleEmployee}
                isEditingPaymentNotes={isEditingPaymentNotes}
                editPaymentNotesValue={editPaymentNotesValue}
                isSavingPaymentNotes={isSavingPaymentNotes}
                onStartEditPaymentNotes={handleStartEditPaymentNotes}
                onCancelEditPaymentNotes={handleCancelEditPaymentNotes}
                onSavePaymentNotes={handleSavePaymentNotes}
                onPaymentNotesChange={setEditPaymentNotesValue}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <div className={`p-6 rounded-full mb-4 ${
                  activeQueue === 'paid' ? 'bg-green-100' : 
                  activeQueue === 'unpaid' ? 'bg-amber-100' : 
                  activeQueue === 'waitlist' ? 'bg-purple-100' : 'bg-gray-100'
                }`}>
                  {activeQueue === 'paid' ? (
                    <UserCheck className="text-green-500" size={48} />
                  ) : activeQueue === 'unpaid' ? (
                    <CreditCard className="text-amber-500" size={48} />
                  ) : activeQueue === 'waitlist' ? (
                    <Clock className="text-purple-500" size={48} />
                  ) : (
                    <User className="text-gray-400" size={48} />
                  )}
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeQueue === 'paid' ? 'Paid Players' 
                    : activeQueue === 'unpaid' ? 'Unpaid Players' 
                    : activeQueue === 'waitlist' ? 'Waitlist Players'
                    : 'Select a Player'}
                </h3>
                <p className="text-gray-500 max-w-xs">
                  {activeQueue === 'paid' 
                    ? 'Select a player for quick check-in (payment complete)'
                    : activeQueue === 'unpaid'
                    ? 'Select a player to collect payment and check them in'
                    : activeQueue === 'waitlist'
                    ? 'Select a waitlist player to promote and check them in'
                    : 'Click on a player from the list to view details'
                  }
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Mobile: Full-screen Modal for Player Details */}
        {selectedGolfer && (
          <div className="lg:hidden fixed inset-0 z-[60] flex flex-col bg-white animate-slide-up">
            {/* Modal Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Player Details</h3>
              <button 
                onClick={handleClearSelection}
                className="p-2 rounded-full hover:bg-gray-100 touch-manipulation -mr-1"
              >
                <X size={22} />
              </button>
            </div>
            
            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 pb-8">
              <PlayerDetailPanel
                golfer={selectedGolfer}
                paymentInfo={paymentInfo}
                setPaymentInfo={setPaymentInfo}
                isProcessing={isProcessing}
                onCheckIn={handleCheckIn}
                onRecordPayment={handleRecordPayment}
                onClose={handleClearSelection}
                showCloseButton={false}
                entryFee={selectedGolfer?.is_employee ? (stats?.employee_entry_fee_dollars ?? 50) : (stats?.entry_fee_dollars ?? 125)}
                activityLogs={golferActivityLogs}
                loadingActivityLogs={loadingActivityLogs}
                isPromoting={isPromoting}
                onPromote={handlePromote}
                onPromotePayCheckIn={handlePromotePayCheckIn}
                capacityRemaining={stats?.capacity_remaining ?? 0}
                isSendingPaymentLink={isSendingPaymentLink}
                onSendPaymentLink={handleSendPaymentLink}
                onCopyPaymentLink={handleCopyPaymentLink}
                isTogglingEmployee={isTogglingEmployee}
                onToggleEmployee={handleToggleEmployee}
                isEditingPaymentNotes={isEditingPaymentNotes}
                editPaymentNotesValue={editPaymentNotesValue}
                isSavingPaymentNotes={isSavingPaymentNotes}
                onStartEditPaymentNotes={handleStartEditPaymentNotes}
                onCancelEditPaymentNotes={handleCancelEditPaymentNotes}
                onSavePaymentNotes={handleSavePaymentNotes}
                onPaymentNotesChange={setEditPaymentNotesValue}
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
