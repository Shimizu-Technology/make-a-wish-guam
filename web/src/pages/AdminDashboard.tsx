import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Select } from '../components/ui';
import { Search, Download, RefreshCw, ChevronDown, ChevronUp, X, User, Mail, Phone, Building2, Users, MapPin, CheckCircle, CreditCard, FileText, UserPlus, Calendar, FileSpreadsheet, ArrowUpCircle, Ban, RotateCcw, Pencil, Save, Send, Copy, Loader2, ArrowUpDown, UserCheck, SendHorizontal, AlertTriangle, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, Golfer, GolferStats, ActivityLog } from '../services/api';
import { AddGolferModal } from '../components/AddGolferModal';
import { BulkActionBar, BulkActionButton } from '../components/BulkActionBar';
import { useGolferChannel } from '../hooks/useGolferChannel';
import * as XLSX from 'xlsx';

// Format date for display (uses browser's locale which respects timezone)
const formatRegistrationDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'Pacific/Guam'
    }),
    time: date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'Pacific/Guam'
    }),
  };
};

export const AdminDashboard: React.FC = () => {
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [stats, setStats] = useState<GolferStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [checkinFilter, setCheckinFilter] = useState('all');
  const [holeFilter, setHoleFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedGolfer, setSelectedGolfer] = useState<Golfer | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [golferActivityLogs, setGolferActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingActivityLogs, setLoadingActivityLogs] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isDemoting, setIsDemoting] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [isTogglingCheckIn, setIsTogglingCheckIn] = useState(false);
  const [isTogglingEmployee, setIsTogglingEmployee] = useState(false);
  const [isSendingPaymentLink, setIsSendingPaymentLink] = useState(false);
  const [showStatusChangeConfirm, setShowStatusChangeConfirm] = useState<'demote' | 'unpay' | 'uncheck' | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    method: 'cash' as 'cash' | 'check' | 'credit',
    receiptNumber: '',
    notes: '',
  });
  
  // Edit golfer state
  const [isEditingGolfer, setIsEditingGolfer] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editGolferData, setEditGolferData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
  });

  // Edit payment notes state
  const [isEditingPaymentNotes, setIsEditingPaymentNotes] = useState(false);
  const [editPaymentNotesValue, setEditPaymentNotesValue] = useState('');
  const [isSavingPaymentNotes, setIsSavingPaymentNotes] = useState(false);

  // Bulk selection state
  const [selectedGolferIds, setSelectedGolferIds] = useState<Set<number>>(new Set());
  const [showBulkEmployeeConfirm, setShowBulkEmployeeConfirm] = useState<'add' | 'remove' | null>(null);
  const [showBulkPaymentLinksConfirm, setShowBulkPaymentLinksConfirm] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Table sorting state
  type SortColumn = 'name' | 'email' | 'company' | 'payment' | 'status' | 'hole' | 'checked_in' | 'registered';
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    fetchData();
  }, []);

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

  const filteredGolfers = useMemo(() => {
    const filtered = golfers.filter((golfer) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const name = golfer.name?.toLowerCase() || '';
        const email = golfer.email?.toLowerCase() || '';
        const company = golfer.company?.toLowerCase() || '';
        if (!name.includes(search) && !email.includes(search) && !company.includes(search)) {
          return false;
        }
      }

      if (paymentFilter !== 'all' && golfer.payment_status !== paymentFilter) return false;
      if (paymentMethodFilter !== 'all') {
        const filterValue = paymentMethodFilter === 'pay-now' ? 'stripe' : 'pay_on_day';
        if (golfer.payment_type !== filterValue) return false;
      }
      // Status filter - when "all", exclude cancelled (show only active)
      if (statusFilter === 'all' && golfer.registration_status === 'cancelled') return false;
      if (statusFilter !== 'all' && golfer.registration_status !== statusFilter) return false;
      if (checkinFilter !== 'all') {
        const isCheckedIn = checkinFilter === 'checked-in';
        if (golfer.checked_in !== isCheckedIn) return false;
      }
      if (holeFilter !== 'all') {
        if (holeFilter === 'unassigned') {
          if (golfer.hole_position_label && golfer.hole_position_label !== 'Unassigned') return false;
        } else {
          const holeNum = parseInt(holeFilter);
          if (golfer.hole_number !== holeNum) return false;
        }
      }

      return true;
    });

    // Sort the filtered results
    return [...filtered].sort((a, b) => {
      let aVal: string | number | boolean = '';
      let bVal: string | number | boolean = '';

      switch (sortColumn) {
        case 'name':
          // Sort by last name (extracted from full name)
          aVal = a.last_name?.toLowerCase() || '';
          bVal = b.last_name?.toLowerCase() || '';
          break;
        case 'email':
          aVal = a.email?.toLowerCase() || '';
          bVal = b.email?.toLowerCase() || '';
          break;
        case 'company':
          aVal = a.company?.toLowerCase() || '';
          bVal = b.company?.toLowerCase() || '';
          break;
        case 'payment':
          // Sort order: paid > unpaid > refunded
          const paymentOrder = { paid: 0, unpaid: 1, refunded: 2 };
          aVal = paymentOrder[a.payment_status as keyof typeof paymentOrder] ?? 3;
          bVal = paymentOrder[b.payment_status as keyof typeof paymentOrder] ?? 3;
          break;
        case 'status':
          // Sort order: confirmed > waitlist > cancelled
          const statusOrder = { confirmed: 0, waitlist: 1, cancelled: 2 };
          aVal = statusOrder[a.registration_status as keyof typeof statusOrder] ?? 3;
          bVal = statusOrder[b.registration_status as keyof typeof statusOrder] ?? 3;
          break;
        case 'hole':
          // Sort by hole_position_label (e.g., "7A", "7B", "14")
          aVal = a.hole_position_label || 'zzz'; // Unassigned at end
          bVal = b.hole_position_label || 'zzz';
          break;
        case 'checked_in':
          aVal = a.checked_in ? 0 : 1; // Checked in first
          bVal = b.checked_in ? 0 : 1;
          break;
        case 'registered':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [golfers, searchTerm, paymentFilter, paymentMethodFilter, statusFilter, checkinFilter, holeFilter, sortColumn, sortDirection]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (paymentFilter !== 'all') count++;
    if (paymentMethodFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (checkinFilter !== 'all') count++;
    if (holeFilter !== 'all') count++;
    return count;
  }, [paymentFilter, paymentMethodFilter, statusFilter, checkinFilter, holeFilter]);

  const clearAllFilters = () => {
    setPaymentFilter('all');
    setPaymentMethodFilter('all');
    setStatusFilter('all');
    setCheckinFilter('all');
    setHoleFilter('all');
    setSearchTerm('');
  };

  // Bulk selection helpers
  const toggleGolferSelection = (golferId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't open the detail modal
    setSelectedGolferIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(golferId)) {
        newSet.delete(golferId);
      } else {
        newSet.add(golferId);
      }
      return newSet;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredGolfers.map(g => g.id);
    const allSelected = visibleIds.every(id => selectedGolferIds.has(id));
    
    if (allSelected) {
      // Deselect all visible
      setSelectedGolferIds(prev => {
        const newSet = new Set(prev);
        visibleIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    } else {
      // Select all visible
      setSelectedGolferIds(prev => {
        const newSet = new Set(prev);
        visibleIds.forEach(id => newSet.add(id));
        return newSet;
      });
    }
  };

  const clearSelection = () => {
    setSelectedGolferIds(new Set());
  };

  const allVisibleSelected = useMemo(() => {
    if (filteredGolfers.length === 0) return false;
    return filteredGolfers.every(g => selectedGolferIds.has(g.id));
  }, [filteredGolfers, selectedGolferIds]);

  const someVisibleSelected = useMemo(() => {
    return filteredGolfers.some(g => selectedGolferIds.has(g.id));
  }, [filteredGolfers, selectedGolferIds]);

  // Get selected golfers from current filtered view
  const selectedGolfers = useMemo(() => {
    return filteredGolfers.filter(g => selectedGolferIds.has(g.id));
  }, [filteredGolfers, selectedGolferIds]);

  // Bulk action handlers
  const handleBulkSetEmployee = async (isEmployee: boolean) => {
    if (selectedGolferIds.size === 0) return;
    
    setIsBulkProcessing(true);
    try {
      const result = await api.bulkSetEmployee(Array.from(selectedGolferIds), isEmployee);
      toast.success(result.message);
      if (result.skipped_count > 0 && result.skipped_reasons) {
        const reasons = result.skipped_reasons.slice(0, 3).map((r: { name: string; reason: string }) => `${r.name}: ${r.reason}`).join(', ');
        toast(`${result.skipped_count} skipped: ${reasons}${result.skipped_count > 3 ? '...' : ''}`, { icon: 'ℹ️', duration: 5000 });
      }
      await fetchData();
      clearSelection();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update employees');
    } finally {
      setIsBulkProcessing(false);
      setShowBulkEmployeeConfirm(null);
    }
  };

  const handleBulkSendPaymentLinks = async () => {
    if (selectedGolferIds.size === 0) return;
    
    setIsBulkProcessing(true);
    try {
      const result = await api.bulkSendPaymentLinks(Array.from(selectedGolferIds));
      toast.success(result.message);
      if (result.skipped_count > 0) {
        const reasons = result.skipped_reasons.slice(0, 3).map(r => `${r.name}: ${r.reason}`).join(', ');
        toast(`${result.skipped_count} skipped: ${reasons}${result.skipped_count > 3 ? '...' : ''}`, { icon: 'ℹ️', duration: 5000 });
      }
      await fetchData();
      clearSelection();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send payment links');
    } finally {
      setIsBulkProcessing(false);
      setShowBulkPaymentLinksConfirm(false);
    }
  };

  // Excel Export Functions
  const downloadExcel = (workbook: XLSX.WorkBook, filename: string) => {
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success('Export downloaded!');
  };

  const exportFullList = () => {
    const data = filteredGolfers.map(g => {
      const regDate = g.created_at ? formatRegistrationDate(g.created_at) : { date: '', time: '' };
      return {
        'Name': g.name,
        'Email': g.email,
        'Company': g.company || '',
        'Phone': g.phone || '',
        'Payment Type': g.payment_type === 'stripe' ? 'Pay Now' : 'Pay on Day',
        'Payment Status': g.payment_status,
        'Payment Method': g.payment_method || '',
        'Receipt #': g.receipt_number || '',
        'Registration Status': g.registration_status,
        'Hole': g.hole_position_label || 'Unassigned',
        'Checked In': g.checked_in ? 'Yes' : 'No',
        'Registered Date': regDate.date,
        'Registered Time': regDate.time,
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Registrants');
    downloadExcel(wb, 'golfers-full-export');
  };

  const exportCheckInSheet = () => {
    // Sort by hole number, then by hole position label
    const sorted = [...golfers]
      .filter(g => g.registration_status === 'confirmed')
      .sort((a, b) => {
        const holeA = a.hole_number || 999;
        const holeB = b.hole_number || 999;
        if (holeA !== holeB) return holeA - holeB;
        return (a.hole_position_label || 'ZZZ').localeCompare(b.hole_position_label || 'ZZZ');
      });
    
    const data = sorted.map(g => ({
      'Name': g.name,
      'Company': g.company || '',
      'Hole': g.hole_position_label || 'Unassigned',
      'Paid': g.payment_status === 'paid' ? '✓' : '',
      'Checked In': g.checked_in ? '✓' : '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    // Set column widths
    ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Check-In Sheet');
    downloadExcel(wb, 'check-in-sheet');
  };

  const exportGroupsByHole = () => {
    // Get all unique hole position labels and organize by them
    const holeLabels = [...new Set(golfers.filter(g => g.hole_position_label && g.hole_position_label !== 'Unassigned').map(g => g.hole_position_label))];
    
    // Sort by hole number (extract number from label like "7A" -> 7)
    holeLabels.sort((a, b) => {
      const numA = parseInt(a?.replace(/[A-Z]/g, '') || '999');
      const numB = parseInt(b?.replace(/[A-Z]/g, '') || '999');
      if (numA !== numB) return numA - numB;
      // Same hole number, sort by letter
      return (a || '').localeCompare(b || '');
    });
    
    const data: { 'Hole': string; 'Player 1': string; 'Player 2': string; 'Player 3': string; 'Player 4': string }[] = [];
    
    holeLabels.forEach(label => {
      const playersInGroup = golfers.filter(g => g.hole_position_label === label);
      const row: { 'Hole': string; 'Player 1': string; 'Player 2': string; 'Player 3': string; 'Player 4': string } = {
        'Hole': label || '',
        'Player 1': playersInGroup[0]?.name || '',
        'Player 2': playersInGroup[1]?.name || '',
        'Player 3': playersInGroup[2]?.name || '',
        'Player 4': playersInGroup[3]?.name || '',
      };
      data.push(row);
    });
    
    // Add unassigned players
    const unassigned = golfers.filter(g => (!g.hole_position_label || g.hole_position_label === 'Unassigned') && g.registration_status === 'confirmed');
    if (unassigned.length > 0) {
      data.push({ 'Hole': '', 'Player 1': '', 'Player 2': '', 'Player 3': '', 'Player 4': '' });
      data.push({ 'Hole': 'UNASSIGNED', 'Player 1': '', 'Player 2': '', 'Player 3': '', 'Player 4': '' });
      unassigned.forEach(g => {
        data.push({ 'Hole': '', 'Player 1': g.name, 'Player 2': '', 'Player 3': '', 'Player 4': '' });
      });
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Foursomes by Hole');
    downloadExcel(wb, 'foursomes-by-hole');
  };

  const exportPaymentSummary = () => {
    const confirmed = golfers.filter(g => g.registration_status === 'confirmed');
    const paid = confirmed.filter(g => g.payment_status === 'paid');
    const unpaid = confirmed.filter(g => g.payment_status === 'unpaid');
    const entryFee = stats?.entry_fee_dollars || 125;
    
    // Summary data
    const summaryData = [
      { 'Category': 'Total Confirmed Registrants', 'Count': confirmed.length, 'Amount': '' },
      { 'Category': 'Paid', 'Count': paid.length, 'Amount': `$${(paid.length * entryFee).toFixed(2)}` },
      { 'Category': 'Unpaid (Pending)', 'Count': unpaid.length, 'Amount': `$${(unpaid.length * entryFee).toFixed(2)}` },
      { 'Category': '', 'Count': '', 'Amount': '' },
      { 'Category': 'Entry Fee', 'Count': '', 'Amount': `$${entryFee.toFixed(2)}` },
      { 'Category': 'Total Collected', 'Count': '', 'Amount': `$${(paid.length * entryFee).toFixed(2)}` },
      { 'Category': 'Total Expected (if all pay)', 'Count': '', 'Amount': `$${(confirmed.length * entryFee).toFixed(2)}` },
    ];
    
    // Payment method breakdown
    const byMethod: Record<string, number> = {};
    paid.forEach(g => {
      const method = g.payment_method || (g.payment_type === 'stripe' ? 'Online (Stripe)' : 'On Day');
      byMethod[method] = (byMethod[method] || 0) + 1;
    });
    
    summaryData.push({ 'Category': '', 'Count': '', 'Amount': '' });
    summaryData.push({ 'Category': 'PAYMENT METHOD BREAKDOWN', 'Count': '', 'Amount': '' });
    Object.entries(byMethod).forEach(([method, count]) => {
      summaryData.push({ 
        'Category': method.charAt(0).toUpperCase() + method.slice(1), 
        'Count': count, 
        'Amount': `$${(count * entryFee).toFixed(2)}` 
      });
    });
    
    const ws = XLSX.utils.json_to_sheet(summaryData);
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Summary');
    downloadExcel(wb, 'payment-summary');
  };

  const exportContactList = () => {
    const data = golfers
      .filter(g => g.registration_status === 'confirmed')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(g => ({
        'Name': g.name,
        'Phone': g.phone || '',
        'Email': g.email,
        'Company': g.company || '',
      }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contact List');
    downloadExcel(wb, 'contact-list');
  };

  const exportAllReports = () => {
    const wb = XLSX.utils.book_new();
    const entryFee = stats?.entry_fee_dollars || 125;
    
    // Sheet 1: Full List
    const fullData = filteredGolfers.map(g => {
      const regDate = g.created_at ? formatRegistrationDate(g.created_at) : { date: '', time: '' };
      return {
        'Name': g.name,
        'Email': g.email,
        'Company': g.company || '',
        'Phone': g.phone || '',
        'Payment Type': g.payment_type === 'stripe' ? 'Pay Now' : 'Pay on Day',
        'Payment Status': g.payment_status,
        'Payment Method': g.payment_method || '',
        'Receipt #': g.receipt_number || '',
        'Registration Status': g.registration_status,
        'Hole': g.hole_position_label || 'Unassigned',
        'Checked In': g.checked_in ? 'Yes' : 'No',
        'Registered Date': regDate.date,
        'Registered Time': regDate.time,
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(fullData);
    XLSX.utils.book_append_sheet(wb, ws1, 'All Registrants');
    
    // Sheet 2: Check-In Sheet
    const checkInData = [...golfers]
      .filter(g => g.registration_status === 'confirmed')
      .sort((a, b) => {
        const holeA = a.hole_number || 999;
        const holeB = b.hole_number || 999;
        if (holeA !== holeB) return holeA - holeB;
        return (a.hole_position_label || 'ZZZ').localeCompare(b.hole_position_label || 'ZZZ');
      })
      .map(g => ({
        'Name': g.name,
        'Company': g.company || '',
        'Hole': g.hole_position_label || 'Unassigned',
        'Paid': g.payment_status === 'paid' ? '✓' : '',
        'Checked In': g.checked_in ? '✓' : '',
      }));
    const ws2 = XLSX.utils.json_to_sheet(checkInData);
    ws2['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 10 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Check-In Sheet');
    
    // Sheet 3: Payment Summary
    const confirmed = golfers.filter(g => g.registration_status === 'confirmed');
    const paid = confirmed.filter(g => g.payment_status === 'paid');
    const unpaid = confirmed.filter(g => g.payment_status === 'unpaid');
    const summaryData = [
      { 'Category': 'Total Confirmed Registrants', 'Count': confirmed.length, 'Amount': '' },
      { 'Category': 'Paid', 'Count': paid.length, 'Amount': `$${(paid.length * entryFee).toFixed(2)}` },
      { 'Category': 'Unpaid (Pending)', 'Count': unpaid.length, 'Amount': `$${(unpaid.length * entryFee).toFixed(2)}` },
      { 'Category': '', 'Count': '', 'Amount': '' },
      { 'Category': 'Entry Fee', 'Count': '', 'Amount': `$${entryFee.toFixed(2)}` },
      { 'Category': 'Total Collected', 'Count': '', 'Amount': `$${(paid.length * entryFee).toFixed(2)}` },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    ws3['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'Payment Summary');
    
    // Sheet 4: Contact List
    const contactData = golfers
      .filter(g => g.registration_status === 'confirmed')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(g => ({
        'Name': g.name,
        'Phone': g.phone || '',
        'Email': g.email,
        'Company': g.company || '',
      }));
    const ws4 = XLSX.utils.json_to_sheet(contactData);
    ws4['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 30 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws4, 'Contact List');
    
    downloadExcel(wb, 'tournament-all-reports');
  };

  const handleCancelGolfer = async () => {
    if (!selectedGolfer) return;
    
    setIsCancelling(true);
    try {
      const updatedGolfer = await api.cancelGolfer(selectedGolfer.id, cancelReason || undefined);
      toast.success(`${selectedGolfer.name}'s registration has been cancelled`);
      setSelectedGolfer(updatedGolfer);
      setShowCancelConfirm(false);
      setCancelReason('');
      fetchData();
      const response = await api.getGolferActivityHistory(updatedGolfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error cancelling golfer:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to cancel registration');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefundGolfer = async () => {
    if (!selectedGolfer) return;
    
    setIsRefunding(true);
    try {
      const result = await api.refundGolfer(selectedGolfer.id, cancelReason || undefined);
      toast.success(`Refunded $${(result.refund.amount / 100).toFixed(2)} to ${selectedGolfer.name}`);
      setSelectedGolfer(result.golfer);
      setShowRefundConfirm(false);
      setCancelReason('');
      fetchData();
      const response = await api.getGolferActivityHistory(result.golfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error refunding golfer:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to process refund');
    } finally {
      setIsRefunding(false);
    }
  };

  // Send payment link to golfer
  const handleSendPaymentLink = async (golfer: Golfer) => {
    setIsSendingPaymentLink(true);
    try {
      const result = await api.sendPaymentLink(golfer.id);
      toast.success(result.message);
      // Refresh golfer data to get updated payment_token
      fetchData();
      if (selectedGolfer?.id === golfer.id) {
        const paymentToken = result.payment_link.split('/').pop() || null;
        const updatedGolfers = golfers.map(g => 
          g.id === golfer.id ? { ...g, payment_token: paymentToken } : g
        );
        const updated = updatedGolfers.find(g => g.id === golfer.id);
        if (updated) setSelectedGolfer(updated);
      }
    } catch (err) {
      console.error('Error sending payment link:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send payment link');
    } finally {
      setIsSendingPaymentLink(false);
    }
  };

  // Copy payment link to clipboard
  const handleCopyPaymentLink = async (golfer: Golfer) => {
    if (!golfer.payment_token) {
      toast.error('No payment link available');
      return;
    }
    
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    const paymentLink = `${frontendUrl}/pay/${golfer.payment_token}`;
    
    try {
      await navigator.clipboard.writeText(paymentLink);
      toast.success('Payment link copied to clipboard');
    } catch (err) {
      console.error('Error copying link:', err);
      toast.error('Failed to copy link');
    }
  };

  // Start editing golfer details
  const handleStartEdit = () => {
    if (!selectedGolfer) return;
    setEditGolferData({
      name: selectedGolfer.name || '',
      email: selectedGolfer.email || '',
      phone: selectedGolfer.phone || '',
      company: selectedGolfer.company || '',
      address: selectedGolfer.address || '',
    });
    setIsEditingGolfer(true);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditingGolfer(false);
    setEditGolferData({ name: '', email: '', phone: '', company: '', address: '' });
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
      fetchData();
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

  // Save edited golfer details
  const handleSaveEdit = async () => {
    if (!selectedGolfer) return;
    
    // Validate required fields
    if (!editGolferData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!editGolferData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    
    setIsSavingEdit(true);
    try {
      const updatedGolfer = await api.updateGolfer(selectedGolfer.id, {
        name: editGolferData.name.trim(),
        email: editGolferData.email.trim(),
        phone: editGolferData.phone.trim() || undefined,
        company: editGolferData.company.trim() || undefined,
        address: editGolferData.address.trim() || undefined,
      });
      toast.success('Golfer details updated');
      setSelectedGolfer(updatedGolfer);
      setIsEditingGolfer(false);
      fetchData();
    } catch (err) {
      console.error('Error updating golfer:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update golfer');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handlePromoteGolfer = async () => {
    if (!selectedGolfer) return;
    
    setIsPromoting(true);
    try {
      const updatedGolfer = await api.promoteGolfer(selectedGolfer.id);
      toast.success(`${selectedGolfer.name} has been promoted to confirmed! Email notification sent.`);
      setSelectedGolfer(updatedGolfer);
      fetchData(); // Refresh the list
      // Refresh activity logs
      const response = await api.getGolferActivityHistory(updatedGolfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error promoting golfer:', err);
      toast.error('Failed to promote golfer');
    } finally {
      setIsPromoting(false);
    }
  };

  const handleDemoteGolfer = async () => {
    if (!selectedGolfer) return;
    
    setIsDemoting(true);
    try {
      const updatedGolfer = await api.demoteGolfer(selectedGolfer.id);
      toast.success(`${selectedGolfer.name} has been moved to waitlist.`);
      setSelectedGolfer(updatedGolfer);
      setShowStatusChangeConfirm(null);
      fetchData();
      const response = await api.getGolferActivityHistory(updatedGolfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error demoting golfer:', err);
      toast.error('Failed to move golfer to waitlist');
    } finally {
      setIsDemoting(false);
    }
  };

  const handleUpdatePaymentStatus = async (newStatus: 'paid' | 'unpaid') => {
    if (!selectedGolfer) return;
    
    setIsUpdatingPayment(true);
    try {
      let updatedGolfer;
      if (newStatus === 'paid') {
        // Use the payment details endpoint to record payment with full details
        updatedGolfer = await api.addPaymentDetails(selectedGolfer.id, {
          payment_method: paymentFormData.method,
          receipt_number: paymentFormData.receiptNumber,
          payment_notes: paymentFormData.notes,
        });
        setShowPaymentForm(false);
        setPaymentFormData({ method: 'cash', receiptNumber: '', notes: '' });
      } else {
        updatedGolfer = await api.updatePaymentStatus(selectedGolfer.id, newStatus);
      }
      toast.success(`${selectedGolfer.name} payment status changed to ${newStatus}.`);
      setSelectedGolfer(updatedGolfer);
      setShowStatusChangeConfirm(null);
      fetchData();
      const response = await api.getGolferActivityHistory(updatedGolfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error updating payment status:', err);
      toast.error('Failed to update payment status');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const handleToggleCheckIn = async () => {
    if (!selectedGolfer) return;
    
    setIsTogglingCheckIn(true);
    try {
      const updatedGolfer = await api.checkInGolfer(selectedGolfer.id);
      const action = selectedGolfer.checked_in ? 'unchecked' : 'checked in';
      toast.success(`${selectedGolfer.name} has been ${action}.`);
      setSelectedGolfer(updatedGolfer);
      setShowStatusChangeConfirm(null);
      fetchData();
      const response = await api.getGolferActivityHistory(updatedGolfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error toggling check-in:', err);
      toast.error('Failed to update check-in status');
    } finally {
      setIsTogglingCheckIn(false);
    }
  };

  const handleToggleEmployee = async () => {
    if (!selectedGolfer) return;
    
    setIsTogglingEmployee(true);
    try {
      const updatedGolfer = await api.toggleEmployee(selectedGolfer.id);
      const action = updatedGolfer.is_employee ? 'marked as employee' : 'removed employee status';
      toast.success(`${selectedGolfer.name} has been ${action}.`);
      setSelectedGolfer(updatedGolfer);
      fetchData();
      const response = await api.getGolferActivityHistory(updatedGolfer.id);
      setGolferActivityLogs(response.activity_logs);
    } catch (err) {
      console.error('Error toggling employee status:', err);
      toast.error('Failed to update employee status');
    } finally {
      setIsTogglingEmployee(false);
    }
  };

  const handleSelectGolfer = async (golfer: Golfer) => {
    setSelectedGolfer(golfer);
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

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-brand-800 text-white rounded-lg hover:bg-brand-700"
          >
            <RefreshCw size={18} />
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-3 lg:space-y-6">
        {/* Mobile Header - Ultra minimal */}
        <div className="flex items-center justify-between lg:hidden">
          <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowAddModal(true)}
              className="p-2 text-brand-600 hover:text-brand-800 transition-colors"
              title="Add Golfer"
            >
              <UserPlus size={18} />
            </button>
            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Export"
              >
                <Download size={18} />
              </button>
              
              {/* Export Dropdown Menu */}
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 animate-fade-in">
                  <button
                    onClick={exportAllReports}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-brand-50 flex items-center gap-2 text-brand-800 font-medium border-b border-gray-100"
                  >
                    <FileSpreadsheet size={16} />
                    All Reports (Excel)
                  </button>
                  <button
                    onClick={exportFullList}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download size={16} className="text-gray-400" />
                    Full Registrant List
                  </button>
                  <button
                    onClick={exportCheckInSheet}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <CheckCircle size={16} className="text-gray-400" />
                    Check-In Sheet
                  </button>
                  <button
                    onClick={exportGroupsByHole}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Users size={16} className="text-gray-400" />
                    Groups by Hole
                  </button>
                  <button
                    onClick={exportPaymentSummary}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <CreditCard size={16} className="text-gray-400" />
                    Payment Summary
                  </button>
                  <button
                    onClick={exportContactList}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Phone size={16} className="text-gray-400" />
                    Contact List
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Stats - Clean summary with capacity */}
        <div className="lg:hidden space-y-2">
          {/* Capacity Bar */}
          {stats && (
            <div className="bg-white rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-gray-600">
                  <span className="font-semibold text-gray-900">{stats.confirmed}/{stats.max_capacity}</span>
                  {stats.reserved_slots > 0 && (
                    <span className="text-gray-400 ml-1">({stats.reserved_slots} reserved)</span>
                  )}
                </span>
                <span className={`font-medium ${stats.at_capacity ? 'text-amber-600' : 'text-green-600'}`}>
                  {stats.at_capacity ? 'Waitlist Only' : `${stats.capacity_remaining} open`}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.at_capacity ? 'bg-amber-500' : 
                    stats.confirmed / stats.max_capacity > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(100, (stats.confirmed / stats.max_capacity) * 100)}%` }}
                />
              </div>
            </div>
          )}
          
          {/* Mobile Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-lg p-2 border border-gray-200 text-center">
              <p className="text-lg font-bold text-gray-900">{stats?.total || 0}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Total</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-200 text-center">
              <p className="text-lg font-bold text-purple-600">{stats?.paid || 0}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Paid</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-200 text-center">
              <p className="text-lg font-bold text-teal-600">{stats?.checked_in || 0}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Checked In</p>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-200 text-center">
              <p className="text-lg font-bold text-amber-600">{stats?.waitlist || 0}</p>
              <p className="text-[10px] text-gray-500 leading-tight">Waitlist</p>
            </div>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <UserPlus size={18} />
              <span>Add Golfer</span>
            </button>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={18} />
              <span>Refresh</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-800 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                <Download size={18} />
                <span>Export</span>
                <ChevronDown size={16} />
              </button>
              
              {/* Export Dropdown Menu - Desktop */}
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 animate-fade-in">
                  <button
                    onClick={exportAllReports}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-brand-50 flex items-center gap-3 text-brand-800 font-medium border-b border-gray-100"
                  >
                    <FileSpreadsheet size={18} />
                    <div>
                      <div>All Reports</div>
                      <div className="text-xs text-gray-500 font-normal">Multi-sheet Excel file</div>
                    </div>
                  </button>
                  <button
                    onClick={exportFullList}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                  >
                    <Download size={16} className="text-gray-400" />
                    Full Registrant List
                  </button>
                  <button
                    onClick={exportCheckInSheet}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                  >
                    <CheckCircle size={16} className="text-gray-400" />
                    Check-In Sheet
                  </button>
                  <button
                    onClick={exportGroupsByHole}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                  >
                    <Users size={16} className="text-gray-400" />
                    Groups by Hole
                  </button>
                  <button
                    onClick={exportPaymentSummary}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                  >
                    <CreditCard size={16} className="text-gray-400" />
                    Payment Summary
                  </button>
                  <button
                    onClick={exportContactList}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                  >
                    <Phone size={16} className="text-gray-400" />
                    Contact List
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Capacity Indicator */}
        {stats && (
          <div className="hidden lg:block">
            <Card className={`p-4 ${stats.at_capacity ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className={`${stats.at_capacity ? 'text-amber-600' : 'text-emerald-600'}`} size={24} />
                    <div>
                      <p className="text-sm text-gray-600">Tournament Capacity</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stats.confirmed} <span className="text-lg font-normal text-gray-500">/ {stats.max_capacity}</span>
                        {stats.reserved_slots > 0 && (
                          <span className="text-sm font-normal text-amber-600 ml-2">
                            ({stats.reserved_slots} reserved)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="h-12 w-px bg-gray-300 mx-4" />
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <p className={`text-lg font-semibold flex items-center gap-1 ${stats.at_capacity ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {stats.at_capacity ? <><AlertTriangle className="w-5 h-5" /> Waitlist Only</> : `${stats.capacity_remaining} spots available`}
                    </p>
                  </div>
                </div>
                <div className="w-64">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>0</span>
                    <span>{Math.round((stats.confirmed / stats.max_capacity) * 100)}% full</span>
                    <span>{stats.max_capacity}</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.at_capacity ? 'bg-amber-500' : 
                        stats.confirmed / stats.max_capacity > 0.8 ? 'bg-yellow-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, (stats.confirmed / stats.max_capacity) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Desktop Stats Grid - Full cards */}
        <div className="hidden lg:grid lg:grid-cols-5 gap-4">
          <Card className="bg-brand-50 border-l-4 border-brand-800">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Total</h3>
            <p className="text-3xl font-bold text-brand-800">{stats?.total || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">excl. cancelled</p>
          </Card>
          <Card className="bg-green-50 border-l-4 border-green-600">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Confirmed</h3>
            <p className="text-3xl font-bold text-green-600">{stats?.confirmed || 0}</p>
          </Card>
          <Card className="bg-amber-50 border-l-4 border-amber-600">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Waitlist</h3>
            <p className="text-3xl font-bold text-amber-600">{stats?.waitlist || 0}</p>
          </Card>
          <Card className="bg-purple-50 border-l-4 border-purple-600">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Paid</h3>
            <p className="text-3xl font-bold text-purple-600">{stats?.paid || 0}</p>
          </Card>
          <Card className="bg-teal-50 border-l-4 border-teal-600">
            <h3 className="text-sm font-medium text-gray-600 mb-1">Checked In</h3>
            <p className="text-3xl font-bold text-teal-600">{stats?.checked_in || 0}</p>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-3 lg:p-6">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-base"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Filter Toggle for Mobile */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-200 mb-3"
          >
            <span className="text-sm font-medium text-gray-700">
              Filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
            </span>
            {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-brand-600 hover:text-brand-800 mb-3"
            >
              Clear all filters
            </button>
          )}

          {/* Filters Grid - Collapsible on mobile */}
          <div className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              <Select
                label="Payment"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'unpaid', label: 'Unpaid' },
                ]}
              />

              <Select
                label="Method"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'pay-now', label: 'Online' },
                  { value: 'pay-on-day', label: 'On Day' },
                ]}
              />

              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Active' },
                  { value: 'confirmed', label: 'Confirmed' },
                  { value: 'waitlist', label: 'Waitlist' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
              />

              <Select
                label="Check-In"
                value={checkinFilter}
                onChange={(e) => setCheckinFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'checked-in', label: 'Yes' },
                  { value: 'not-checked-in', label: 'No' },
                ]}
              />

              <Select
                label="Hole"
                value={holeFilter}
                onChange={(e) => setHoleFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'unassigned', label: 'Unassigned' },
                  ...Array.from({ length: 18 }, (_, i) => ({
                    value: String(i + 1),
                    label: `Hole ${i + 1}`,
                  })),
                ]}
              />
            </div>
          </div>
        </Card>

        {/* Registrants */}
        <Card className="p-3 lg:p-6">
          {/* Bulk Action Bar */}
          <BulkActionBar 
            selectedCount={selectedGolferIds.size} 
            onClearSelection={clearSelection}
          >
            <BulkActionButton
              onClick={() => setShowBulkEmployeeConfirm('add')}
              disabled={isBulkProcessing}
            >
              <UserCheck size={16} />
              Mark as Employee
            </BulkActionButton>
            <BulkActionButton
              onClick={() => setShowBulkEmployeeConfirm('remove')}
              disabled={isBulkProcessing}
            >
              <User size={16} />
              Remove Employee
            </BulkActionButton>
            <BulkActionButton
              onClick={() => setShowBulkPaymentLinksConfirm(true)}
              disabled={isBulkProcessing}
            >
              <SendHorizontal size={16} />
              Send Payment Links
            </BulkActionButton>
          </BulkActionBar>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900">
              Registrants ({filteredGolfers.length})
              {selectedGolferIds.size > 0 && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({selectedGolferIds.size} selected)
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 hidden sm:block">Click on a player to view details</p>
          </div>

          {filteredGolfers.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No registrants found matching your filters.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3 max-h-[60vh] overflow-y-auto overflow-x-hidden">
                {filteredGolfers.map((golfer) => (
                  <div
                    key={golfer.id}
                    className={`w-full text-left bg-gray-50 rounded-lg p-4 border transition-colors ${
                      selectedGolferIds.has(golfer.id) 
                        ? 'border-brand-500 bg-brand-50' 
                        : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div 
                        className="flex-shrink-0 pt-1"
                        onClick={(e) => toggleGolferSelection(golfer.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGolferIds.has(golfer.id)}
                          onChange={() => {}}
                          className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>
                      
                      {/* Card content - clickable to open detail */}
                      <button
                        onClick={() => handleSelectGolfer(golfer)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 truncate">{golfer.name}</p>
                              {golfer.is_employee && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700">
                                  👤
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{golfer.email}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                golfer.payment_status === 'refunded'
                                  ? 'bg-purple-100 text-purple-800'
                                  : golfer.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {golfer.payment_status === 'refunded' ? 'Refunded' : golfer.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                            {golfer.registration_status === 'cancelled' && (
                              <span className="text-xs text-red-600 font-medium">Cancelled</span>
                            )}
                            {golfer.checked_in && golfer.registration_status !== 'cancelled' && (
                              <span className="text-xs text-green-600 font-medium flex items-center gap-1"><Check className="w-3 h-3" /> Checked In</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {golfer.company && <span>{golfer.company}</span>}
                          <span className={!golfer.hole_position_label || golfer.hole_position_label === 'Unassigned' ? 'text-amber-600 font-medium' : ''}>
                            Hole: {golfer.hole_position_label || 'Unassigned'}
                          </span>
                          <span
                            className={`${
                              golfer.registration_status === 'confirmed'
                                ? 'text-brand-600'
                                : 'text-gray-500'
                            }`}
                          >
                            {golfer.registration_status === 'confirmed' ? 'Confirmed' : 'Waitlist'}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* Checkbox column */}
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected && filteredGolfers.length > 0}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = someVisibleSelected && !allVisibleSelected;
                            }
                          }}
                          onChange={toggleSelectAllVisible}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          title={allVisibleSelected ? "Deselect all visible" : "Select all visible"}
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortColumn === 'name' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('email')}
                      >
                        <div className="flex items-center gap-1">
                          Email
                          {sortColumn === 'email' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('company')}
                      >
                        <div className="flex items-center gap-1">
                          Company
                          {sortColumn === 'company' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('payment')}
                      >
                        <div className="flex items-center gap-1">
                          Payment
                          {sortColumn === 'payment' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          {sortColumn === 'status' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('hole')}
                      >
                        <div className="flex items-center gap-1">
                          Hole
                          {sortColumn === 'hole' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('checked_in')}
                      >
                        <div className="flex items-center gap-1">
                          Checked In
                          {sortColumn === 'checked_in' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('registered')}
                      >
                        <div className="flex items-center gap-1">
                          Registered
                          {sortColumn === 'registered' ? (
                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          ) : (
                            <ArrowUpDown size={14} className="text-gray-400" />
                          )}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGolfers.map((golfer) => (
                      <TableRow 
                        key={golfer.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedGolferIds.has(golfer.id) 
                            ? 'bg-brand-50 hover:bg-brand-100' 
                            : 'hover:bg-brand-50'
                        }`}
                        onClick={() => handleSelectGolfer(golfer)}
                      >
                        {/* Checkbox cell */}
                        <TableCell className="w-10">
                          <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedGolferIds.has(golfer.id)}
                              onChange={() => {
                                setSelectedGolferIds(prev => {
                                  const newSet = new Set(prev);
                                  if (newSet.has(golfer.id)) {
                                    newSet.delete(golfer.id);
                                  } else {
                                    newSet.add(golfer.id);
                                  }
                                  return newSet;
                                });
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {golfer.name}
                            {golfer.is_employee && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700" title="Employee">
                                👤
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{golfer.email}</TableCell>
                        <TableCell>{golfer.company || '-'}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              golfer.payment_status === 'refunded'
                                ? 'bg-purple-100 text-purple-800'
                                : golfer.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {golfer.payment_status === 'refunded' ? 'Refunded' : golfer.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              golfer.registration_status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : golfer.registration_status === 'confirmed'
                                ? 'bg-brand-100 text-brand-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {golfer.registration_status === 'cancelled' ? 'Cancelled' : golfer.registration_status === 'confirmed' ? 'Confirmed' : 'Waitlist'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {golfer.hole_position_label && golfer.hole_position_label !== 'Unassigned' ? (
                            golfer.hole_position_label
                          ) : (
                            <span className="text-amber-600 font-medium">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {golfer.checked_in ? (
                            <span className="text-green-600 font-medium">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                          {formatRegistrationDate(golfer.created_at).date}, {formatRegistrationDate(golfer.created_at).time}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Add Golfer Modal */}
      <AddGolferModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        tournamentName={stats?.tournament_name}
        onSuccess={fetchData}
      />

      {/* Golfer Detail Modal */}
      {selectedGolfer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => { setSelectedGolfer(null); setShowCancelConfirm(false); setShowRefundConfirm(false); setCancelReason(''); setIsEditingGolfer(false); }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Player Details</h3>
              <button 
                onClick={() => { setSelectedGolfer(null); setShowCancelConfirm(false); setShowRefundConfirm(false); setCancelReason(''); setIsEditingGolfer(false); }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-4 lg:p-6 space-y-6">
              {/* Player Header */}
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-full ${
                  selectedGolfer.checked_in 
                    ? 'bg-green-100' 
                    : selectedGolfer.payment_status === 'paid'
                    ? 'bg-brand-100'
                    : 'bg-amber-100'
                }`}>
                  <User className={
                    selectedGolfer.checked_in 
                      ? 'text-green-600' 
                      : selectedGolfer.payment_status === 'paid'
                      ? 'text-brand-600'
                      : 'text-amber-600'
                  } size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{selectedGolfer.name}</h2>
                    {selectedGolfer.is_employee && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700">
                        👤 Employee
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedGolfer.registration_status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : selectedGolfer.registration_status === 'confirmed'
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {selectedGolfer.registration_status === 'cancelled' ? 'Cancelled' : selectedGolfer.registration_status === 'confirmed' ? 'Confirmed' : 'Waitlist'}
                    </span>
                    {selectedGolfer.checked_in && selectedGolfer.registration_status !== 'cancelled' && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                        <CheckCircle size={12} /> Checked In
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contact Information</h4>
                  {!isEditingGolfer && selectedGolfer.registration_status !== 'cancelled' && (
                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                  )}
                </div>
                
                {isEditingGolfer ? (
                  <div className="space-y-3">
                    {/* Edit Form */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                      <input
                        type="text"
                        value={editGolferData.name}
                        onChange={(e) => setEditGolferData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Email *</label>
                      <input
                        type="email"
                        value={editGolferData.email}
                        onChange={(e) => setEditGolferData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editGolferData.phone}
                        onChange={(e) => setEditGolferData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="(671) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                      <input
                        type="text"
                        value={editGolferData.company}
                        onChange={(e) => setEditGolferData(prev => ({ ...prev, company: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                      <input
                        type="text"
                        value={editGolferData.address}
                        onChange={(e) => setEditGolferData(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Mailing address"
                      />
                    </div>
                    
                    {/* Save/Cancel buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSavingEdit}
                        className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSavingEdit}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingEdit ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Save size={14} />
                        )}
                        {isSavingEdit ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="text-gray-400 flex-shrink-0" size={18} />
                      <span className="text-gray-900">{selectedGolfer.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="text-gray-400 flex-shrink-0" size={18} />
                      <span className="text-gray-900">{selectedGolfer.phone || '-'}</span>
                    </div>
                    {selectedGolfer.company && (
                      <div className="flex items-center gap-3 text-sm">
                        <Building2 className="text-gray-400 flex-shrink-0" size={18} />
                        <span className="text-gray-900">{selectedGolfer.company}</span>
                      </div>
                    )}
                    {selectedGolfer.address && (
                      <div className="flex items-start gap-3 text-sm">
                        <MapPin className="text-gray-400 flex-shrink-0 mt-0.5" size={18} />
                        <span className="text-gray-900">{selectedGolfer.address}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tournament Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Tournament Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg ${selectedGolfer.hole_position_label && selectedGolfer.hole_position_label !== 'Unassigned' ? 'bg-gray-50' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <Users size={14} />
                      <span className="text-xs">Hole</span>
                    </div>
                    <p className={`font-semibold ${selectedGolfer.hole_position_label && selectedGolfer.hole_position_label !== 'Unassigned' ? 'text-gray-900' : 'text-amber-600'}`}>
                      {selectedGolfer.hole_position_label || 'Unassigned'}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <MapPin size={14} />
                      <span className="text-xs">Starting Hole</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {selectedGolfer.hole_number ? `Hole ${selectedGolfer.hole_number}` : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Payment</h4>
                <div className={`p-4 rounded-lg border-2 ${
                  selectedGolfer.payment_status === 'refunded'
                    ? 'bg-purple-50 border-purple-200'
                    : selectedGolfer.payment_status === 'paid'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {selectedGolfer.payment_status === 'refunded' ? (
                      <RotateCcw className="text-purple-600" size={20} />
                    ) : selectedGolfer.payment_status === 'paid' ? (
                      <CheckCircle className="text-green-600" size={20} />
                    ) : (
                      <CreditCard className="text-amber-600" size={20} />
                    )}
                    <span className={`font-semibold ${
                      selectedGolfer.payment_status === 'refunded' ? 'text-purple-800' : 
                      selectedGolfer.payment_status === 'paid' ? 'text-green-800' : 'text-amber-800'
                    }`}>
                      {selectedGolfer.payment_status === 'refunded' ? 'Refunded' : 
                       selectedGolfer.payment_status === 'paid' ? 'Payment Complete' : 'Payment Pending'}
                    </span>
                  </div>
                  <p className={`text-sm ${
                    selectedGolfer.payment_status === 'refunded' ? 'text-purple-700' :
                    selectedGolfer.payment_status === 'paid' ? 'text-green-700' : 'text-amber-700'
                  }`}>
                    {selectedGolfer.payment_status === 'refunded'
                      ? `Refunded $${((selectedGolfer.refund_amount_cents || 0) / 100).toFixed(2)}`
                      : selectedGolfer.payment_status === 'paid'
                      ? selectedGolfer.payment_type === 'stripe'
                        ? 'Paid online via Stripe'
                        : 'Paid on day of tournament'
                      : selectedGolfer.payment_type === 'stripe'
                        ? `Stripe payment pending ($${(selectedGolfer.is_employee ? stats?.employee_entry_fee_dollars : stats?.entry_fee_dollars)?.toFixed(2) ?? '125.00'})`
                        : `Will pay on day of tournament ($${(selectedGolfer.is_employee ? stats?.employee_entry_fee_dollars : stats?.entry_fee_dollars)?.toFixed(2) ?? '125.00'})`
                    }
                  </p>
                  
                  {/* Payment Details - shown when paid */}
                  {selectedGolfer.payment_status === 'paid' && (
                    <div className="mt-3 pt-3 border-t border-green-200 space-y-2 text-sm">
                      {selectedGolfer.payment_method && (
                        <div className="flex justify-between">
                          <span className="text-green-600">Method:</span>
                          <span className="text-green-800 font-medium capitalize">
                            {selectedGolfer.payment_method}
                            {selectedGolfer.stripe_card_brand && selectedGolfer.stripe_card_last4 && (
                              <span> ({selectedGolfer.stripe_card_brand} •••• {selectedGolfer.stripe_card_last4})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {selectedGolfer.payment_amount_cents && (
                        <div className="flex justify-between">
                          <span className="text-green-600">Amount:</span>
                          <span className="text-green-800 font-medium">${(selectedGolfer.payment_amount_cents / 100).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedGolfer.receipt_number && (
                        <div className="flex justify-between">
                          <span className="text-green-600">Receipt #:</span>
                          <span className="text-green-800 font-medium">{selectedGolfer.receipt_number}</span>
                        </div>
                      )}
                      {/* Payment Notes - Editable */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-green-600">Notes:</span>
                          {!isEditingPaymentNotes && (
                            <button
                              onClick={handleStartEditPaymentNotes}
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
                              onChange={(e) => setEditPaymentNotesValue(e.target.value)}
                              className="w-full px-2 py-1.5 border border-green-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                              rows={3}
                              placeholder="Enter payment notes..."
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleSavePaymentNotes}
                                disabled={isSavingPaymentNotes}
                                className="flex-1 py-1 px-2 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                              >
                                {isSavingPaymentNotes ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEditPaymentNotes}
                                disabled={isSavingPaymentNotes}
                                className="flex-1 py-1 px-2 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-green-800 bg-green-100/50 p-2 rounded text-xs whitespace-pre-wrap">
                            {selectedGolfer.payment_notes || <span className="italic text-green-500">No notes</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Refund Details - shown when refunded */}
                  {selectedGolfer.payment_status === 'refunded' && (
                    <div className="mt-3 pt-3 border-t border-purple-200 space-y-2 text-sm">
                      {selectedGolfer.stripe_refund_id && (
                        <div className="flex justify-between">
                          <span className="text-purple-600">Refund ID:</span>
                          <span className="text-purple-800 font-medium text-xs">{selectedGolfer.stripe_refund_id}</span>
                        </div>
                      )}
                      {selectedGolfer.refunded_at && (
                        <div className="flex justify-between">
                          <span className="text-purple-600">Refunded:</span>
                          <span className="text-purple-800 font-medium">
                            {new Date(selectedGolfer.refunded_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: 'numeric', minute: '2-digit', hour12: true,
                              timeZone: 'Pacific/Guam'
                            })}
                          </span>
                        </div>
                      )}
                      {selectedGolfer.refunded_by_name && (
                        <div className="flex justify-between">
                          <span className="text-purple-600">By:</span>
                          <span className="text-purple-800 font-medium">{selectedGolfer.refunded_by_name}</span>
                        </div>
                      )}
                      {selectedGolfer.refund_reason && (
                        <div className="mt-2">
                          <span className="text-purple-600 block mb-1">Reason:</span>
                          <p className="text-purple-800 bg-purple-100/50 p-2 rounded text-xs">{selectedGolfer.refund_reason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Send Payment Link - shown for unpaid non-cancelled golfers */}
                  {selectedGolfer.payment_status !== 'paid' && 
                   selectedGolfer.payment_status !== 'refunded' &&
                   selectedGolfer.registration_status !== 'cancelled' && (
                    <div className="mt-3 pt-3 border-t border-amber-200">
                      <button
                        onClick={() => handleSendPaymentLink(selectedGolfer)}
                        disabled={isSendingPaymentLink}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {isSendingPaymentLink ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {isSendingPaymentLink ? 'Sending...' : 'Send Payment Link'}
                      </button>
                      {selectedGolfer.payment_token && (
                        <button
                          onClick={() => handleCopyPaymentLink(selectedGolfer)}
                          className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-sm transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          Copy Payment Link
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Waiver Status */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Waiver</h4>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="text-gray-400" size={18} />
                  {selectedGolfer.waiver_signed ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle size={14} /> Waiver Signed
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium">Waiver Not Signed</span>
                  )}
                </div>
              </div>

              {/* Registration Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Registration</h4>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="text-gray-400 flex-shrink-0" size={18} />
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedGolfer.created_at 
                          ? formatRegistrationDate(selectedGolfer.created_at).date 
                          : 'Unknown'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {selectedGolfer.created_at 
                          ? `at ${formatRegistrationDate(selectedGolfer.created_at).time} (Guam Time)` 
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manage Status Section */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Manage Status</h4>
                <div className="space-y-2">
                  {/* Registration Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">Registration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedGolfer.registration_status === 'confirmed'
                          ? 'bg-brand-100 text-brand-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {selectedGolfer.registration_status === 'confirmed' ? 'Confirmed' : 'Waitlist'}
                      </span>
                      {selectedGolfer.registration_status === 'confirmed' && (
                        showStatusChangeConfirm === 'demote' ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handleDemoteGolfer}
                              disabled={isDemoting}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {isDemoting ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setShowStatusChangeConfirm(null)}
                              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowStatusChangeConfirm('demote')}
                            className="text-xs text-gray-500 hover:text-red-600 underline"
                          >
                            Move to Waitlist
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">Payment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedGolfer.payment_status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedGolfer.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                      {selectedGolfer.payment_status === 'paid' ? (
                        showStatusChangeConfirm === 'unpay' ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUpdatePaymentStatus('unpaid')}
                              disabled={isUpdatingPayment}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {isUpdatingPayment ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setShowStatusChangeConfirm(null)}
                              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowStatusChangeConfirm('unpay')}
                            className="text-xs text-gray-500 hover:text-red-600 underline"
                          >
                            Mark Unpaid
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => setShowPaymentForm(true)}
                          className="text-xs text-green-600 hover:text-green-700 underline"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Payment Form (when marking as paid) */}
                  {showPaymentForm && selectedGolfer.payment_status !== 'paid' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium text-green-900 text-sm">Record Payment</h4>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Payment Method</label>
                        <select
                          value={paymentFormData.method}
                          onChange={(e) => setPaymentFormData(prev => ({ ...prev, method: e.target.value as 'cash' | 'check' | 'credit' }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="cash">Cash</option>
                          <option value="check">Check</option>
                          <option value="credit">Credit Card</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Receipt # (optional)</label>
                        <input
                          type="text"
                          value={paymentFormData.receiptNumber}
                          onChange={(e) => setPaymentFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                          placeholder="Enter receipt number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Notes (optional)</label>
                        <input
                          type="text"
                          value={paymentFormData.notes}
                          onChange={(e) => setPaymentFormData(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Any notes..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleUpdatePaymentStatus('paid')}
                          disabled={isUpdatingPayment}
                          className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {isUpdatingPayment ? 'Processing...' : `Mark Paid ($${stats?.entry_fee_dollars ?? 125})`}
                        </button>
                        <button
                          onClick={() => {
                            setShowPaymentForm(false);
                            setPaymentFormData({ method: 'cash', receiptNumber: '', notes: '' });
                          }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Check-In Status */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-700">Check-In</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedGolfer.checked_in
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {selectedGolfer.checked_in ? 'Checked In' : 'Not Checked In'}
                      </span>
                      {selectedGolfer.checked_in ? (
                        showStatusChangeConfirm === 'uncheck' ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handleToggleCheckIn}
                              disabled={isTogglingCheckIn}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {isTogglingCheckIn ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setShowStatusChangeConfirm(null)}
                              className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowStatusChangeConfirm('uncheck')}
                            className="text-xs text-gray-500 hover:text-red-600 underline"
                          >
                            Undo Check-In
                          </button>
                        )
                      ) : (
                        <button
                          onClick={handleToggleCheckIn}
                          disabled={isTogglingCheckIn}
                          className="text-xs text-green-600 hover:text-green-700 underline"
                        >
                          {isTogglingCheckIn ? 'Updating...' : 'Check In'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Employee Status - Only show toggle for unpaid golfers */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      <span className="text-sm text-gray-700">Employee</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedGolfer.is_employee
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {selectedGolfer.is_employee ? 'Employee' : 'Regular'}
                      </span>
                      {selectedGolfer.payment_status !== 'paid' ? (
                        <button
                          onClick={handleToggleEmployee}
                          disabled={isTogglingEmployee}
                          className={`text-xs underline ${
                            selectedGolfer.is_employee 
                              ? 'text-gray-500 hover:text-red-600' 
                              : 'text-purple-600 hover:text-purple-700'
                          }`}
                        >
                          {isTogglingEmployee ? 'Updating...' : selectedGolfer.is_employee ? 'Remove Employee' : 'Mark Employee'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">(locked - already paid)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Promote from Waitlist */}
              {selectedGolfer.registration_status === 'waitlist' && (
                <div className="pt-4 border-t border-gray-200">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <ArrowUpCircle className="text-amber-600" size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-amber-900">Waitlist Player</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          This player is on the waitlist. Promote them to confirmed status and they'll receive an email notification.
                        </p>
                        <button
                          onClick={handlePromoteGolfer}
                          disabled={isPromoting || stats?.at_capacity}
                          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isPromoting ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" />
                              Promoting...
                            </>
                          ) : (
                            <>
                              <ArrowUpCircle size={16} />
                              Promote to Confirmed
                            </>
                          )}
                        </button>
                        {stats?.at_capacity && (
                          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Tournament is at capacity. Cannot promote until a spot opens.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity History */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Activity History</h4>
                {loadingActivityLogs ? (
                  <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
                ) : golferActivityLogs.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">No activity recorded</div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {golferActivityLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-2 text-sm bg-gray-50 rounded-lg p-2">
                        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-700">{log.details}</p>
                          {/* Show what changed for golfer_updated actions */}
                          {log.action === 'golfer_updated' && (() => {
                            const changesData = log.metadata?.changes;
                            if (typeof changesData !== 'object' || changesData === null) return null;
                            const changes = changesData as Record<string, { from: string; to: string }>;
                            return (
                              <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                                {Object.entries(changes).map(([field, change]) => (
                                  <div key={field} className="flex items-center gap-1">
                                    <span className="capitalize font-medium">{field}:</span>
                                    <span className="text-gray-400 line-through">{String(change?.from || '') || '(empty)'}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-gray-700">{String(change?.to || '') || '(empty)'}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          <p className="text-xs text-gray-400 mt-1">
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

              {/* Cancel/Refund Section - only show for active golfers */}
              {selectedGolfer.registration_status !== 'cancelled' && (
                <div className="pt-4 border-t border-gray-200">
                  {!showCancelConfirm && !showRefundConfirm ? (
                    <div className="space-y-2">
                      {/* Show refund button for Stripe paid golfers */}
                      {selectedGolfer.can_refund && (
                        <button
                          onClick={() => setShowRefundConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-sm font-medium border border-purple-200"
                        >
                          <RotateCcw size={16} />
                          Refund & Cancel
                        </button>
                      )}
                      {/* Show cancel button for non-Stripe or unpaid golfers */}
                      {selectedGolfer.can_cancel && !selectedGolfer.can_refund && (
                        <button
                          onClick={() => setShowCancelConfirm(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium border border-red-200"
                        >
                          <Ban size={16} />
                          Cancel Registration
                        </button>
                      )}
                      {/* For Stripe paid, show message if they need to refund first */}
                      {selectedGolfer.payment_status === 'paid' && selectedGolfer.payment_type === 'stripe' && !selectedGolfer.can_refund && (
                        <p className="text-xs text-gray-500 text-center">
                          Use "Refund & Cancel" to process a Stripe refund and cancel this registration.
                        </p>
                      )}
                    </div>
                  ) : showRefundConfirm ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm text-purple-800 font-medium mb-3">
                        Refund ${stats?.entry_fee_dollars?.toFixed(2) ?? '125.00'} to {selectedGolfer.name} and cancel their registration?
                      </p>
                      <div className="mb-3">
                        <label className="block text-xs text-purple-700 mb-1">Reason (optional)</label>
                        <input
                          type="text"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="e.g., Customer requested refund"
                          className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowRefundConfirm(false); setCancelReason(''); }}
                          disabled={isRefunding}
                          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleRefundGolfer}
                          disabled={isRefunding}
                          className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                          {isRefunding ? 'Processing...' : 'Process Refund'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800 font-medium mb-3">
                        Cancel {selectedGolfer.name}'s registration? They will be notified via email.
                      </p>
                      <div className="mb-3">
                        <label className="block text-xs text-red-700 mb-1">Reason (optional)</label>
                        <input
                          type="text"
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="e.g., Customer requested cancellation"
                          className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }}
                          disabled={isCancelling}
                          className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={handleCancelGolfer}
                          disabled={isCancelling}
                          className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Employee Confirmation Modal */}
      {showBulkEmployeeConfirm && (() => {
        // Calculate which golfers can be updated vs will be skipped
        const eligibleGolfers = selectedGolfers.filter(g => 
          g.payment_status !== 'paid' && 
          g.payment_status !== 'refunded' && 
          g.registration_status !== 'cancelled' &&
          g.is_employee !== (showBulkEmployeeConfirm === 'add')
        );
        const skippedGolfers = selectedGolfers.filter(g => 
          g.payment_status === 'paid' || 
          g.payment_status === 'refunded' || 
          g.registration_status === 'cancelled' ||
          g.is_employee === (showBulkEmployeeConfirm === 'add')
        );
        
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => !isBulkProcessing && setShowBulkEmployeeConfirm(null)}
            />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {showBulkEmployeeConfirm === 'add' ? 'Mark as Employees' : 'Remove Employee Status'}
              </h3>
              <p className="text-gray-600 mb-4">
                {showBulkEmployeeConfirm === 'add' 
                  ? 'Employee rate ($50) will apply when recording payments.'
                  : 'Regular rate ($125) will apply when recording payments.'
                }
              </p>
              
              {/* Eligible golfers */}
              {eligibleGolfers.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Will be updated ({eligibleGolfers.length}):
                  </p>
                  <ul className="text-sm text-green-600 space-y-1">
                    {eligibleGolfers.slice(0, 5).map(g => (
                      <li key={g.id}>{g.name}</li>
                    ))}
                    {eligibleGolfers.length > 5 && (
                      <li className="text-green-500">...and {eligibleGolfers.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Skipped golfers */}
              {skippedGolfers.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-amber-700 mb-2">
                    ⚠ Will be skipped ({skippedGolfers.length}):
                  </p>
                  <ul className="text-sm text-amber-600 space-y-1">
                    {skippedGolfers.slice(0, 5).map(g => (
                      <li key={g.id} className="flex items-center gap-2">
                        <span>{g.name}</span>
                        <span className="text-xs">
                          {g.payment_status === 'paid' ? '(already paid)' : 
                           g.payment_status === 'refunded' ? '(refunded)' :
                           g.registration_status === 'cancelled' ? '(cancelled)' :
                           g.is_employee === (showBulkEmployeeConfirm === 'add') ? `(already ${showBulkEmployeeConfirm === 'add' ? 'employee' : 'non-employee'})` : ''}
                        </span>
                      </li>
                    ))}
                    {skippedGolfers.length > 5 && (
                      <li className="text-amber-500">...and {skippedGolfers.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              
              {eligibleGolfers.length === 0 && (
                <div className="bg-red-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">
                    No golfers can be updated. All selected golfers have already paid or are cancelled.
                  </p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkEmployeeConfirm(null)}
                  disabled={isBulkProcessing}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBulkSetEmployee(showBulkEmployeeConfirm === 'add')}
                  disabled={isBulkProcessing || eligibleGolfers.length === 0}
                  className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${
                    showBulkEmployeeConfirm === 'add' 
                      ? 'bg-brand-600 hover:bg-brand-700' 
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isBulkProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Processing...
                    </span>
                  ) : eligibleGolfers.length === 0 ? (
                    'No Golfers to Update'
                  ) : (
                    `Update ${eligibleGolfers.length} Golfer${eligibleGolfers.length === 1 ? '' : 's'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bulk Payment Links Confirmation Modal */}
      {showBulkPaymentLinksConfirm && (() => {
        // Calculate which golfers can receive links vs will be skipped
        const eligibleGolfers = selectedGolfers.filter(g => 
          g.payment_status !== 'paid' && 
          g.payment_status !== 'refunded' && 
          g.registration_status !== 'cancelled'
        );
        const skippedGolfers = selectedGolfers.filter(g => 
          g.payment_status === 'paid' || 
          g.payment_status === 'refunded' || 
          g.registration_status === 'cancelled'
        );
        
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => !isBulkProcessing && setShowBulkPaymentLinksConfirm(false)}
            />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Send Payment Links
              </h3>
              <p className="text-gray-600 mb-4">
                Payment link emails will be sent to unpaid golfers so they can pay online.
              </p>
              
              {/* Eligible golfers */}
              {eligibleGolfers.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                    <Check className="w-4 h-4" /> Will receive email ({eligibleGolfers.length}):
                  </p>
                  <ul className="text-sm text-green-600 space-y-1">
                    {eligibleGolfers.slice(0, 5).map(g => (
                      <li key={g.id}>{g.name} - {g.email}</li>
                    ))}
                    {eligibleGolfers.length > 5 && (
                      <li className="text-green-500">...and {eligibleGolfers.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              
              {/* Skipped golfers */}
              {skippedGolfers.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium text-amber-700 mb-2">
                    ⚠ Will be skipped ({skippedGolfers.length}):
                  </p>
                  <ul className="text-sm text-amber-600 space-y-1">
                    {skippedGolfers.slice(0, 5).map(g => (
                      <li key={g.id} className="flex items-center gap-2">
                        <span>{g.name}</span>
                        <span className="text-xs">
                          {g.payment_status === 'paid' ? '(already paid)' : 
                           g.payment_status === 'refunded' ? '(refunded)' :
                           g.registration_status === 'cancelled' ? '(cancelled)' : ''}
                        </span>
                      </li>
                    ))}
                    {skippedGolfers.length > 5 && (
                      <li className="text-amber-500">...and {skippedGolfers.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
              
              {eligibleGolfers.length === 0 && (
                <div className="bg-red-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-700">
                    No golfers can receive payment links. All selected golfers have already paid or are cancelled.
                  </p>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkPaymentLinksConfirm(false)}
                  disabled={isBulkProcessing}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSendPaymentLinks}
                  disabled={isBulkProcessing || eligibleGolfers.length === 0}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {isBulkProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      Sending...
                    </span>
                  ) : eligibleGolfers.length === 0 ? (
                    'No Golfers to Send To'
                  ) : (
                    `Send to ${eligibleGolfers.length} Golfer${eligibleGolfers.length === 1 ? '' : 's'}`
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AdminLayout>
  );
};
