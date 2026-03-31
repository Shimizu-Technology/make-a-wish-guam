import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { useTournament } from '../contexts';
import { api, Tournament, EmployeeNumber } from '../services/api';
import { Button, Card, Input, Modal } from '../components/ui';
import { 
  Plus, Calendar, Users, DollarSign, MapPin, Clock, 
  Archive, Copy, Play, Pause, Trash2, Edit, 
  CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  UserCheck, Upload, X, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

type TabType = 'active' | 'archived';

export const TournamentManagementPage = () => {
  const { tournaments, currentTournament, setCurrentTournament, refreshTournaments } = useTournament();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmployeeNumbersModalOpen, setIsEmployeeNumbersModalOpen] = useState(false);
  const [employeeNumbersTournament, setEmployeeNumbersTournament] = useState<Tournament | null>(null);

  const activeTournaments = tournaments.filter(t => t.status !== 'archived');
  const archivedTournaments = tournaments.filter(t => t.status === 'archived');

  const handleArchive = async (tournament: Tournament) => {
    if (!confirm(`Archive "${tournament.display_name}"? This will close registration and hide it from the active list.`)) return;
    
    setIsLoading(true);
    try {
      await api.archiveTournament(tournament.id);
      toast.success('Tournament archived successfully');
      refreshTournaments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (tournament: Tournament) => {
    if (!confirm(`Create a new tournament based on "${tournament.display_name}"?`)) return;
    
    setIsLoading(true);
    try {
      const newTournament = await api.copyTournament(tournament.id);
      toast.success(`Created new tournament: ${newTournament.display_name}`);
      refreshTournaments();
      setSelectedTournament(newTournament);
      setIsEditModalOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = async (tournament: Tournament) => {
    if (!confirm(`Open "${tournament.display_name}" for registration? This will close any other open tournaments.`)) return;
    
    setIsLoading(true);
    try {
      const updated = await api.openTournament(tournament.id);
      toast.success('Tournament opened for registration');
      setCurrentTournament(updated);
      refreshTournaments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to open tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = async (tournament: Tournament) => {
    if (!confirm(`Close "${tournament.display_name}"? Registration will be disabled.`)) return;
    
    setIsLoading(true);
    try {
      await api.closeTournament(tournament.id);
      toast.success('Tournament closed');
      refreshTournaments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to close tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (tournament: Tournament) => {
    if (!confirm(`Delete "${tournament.display_name}"? This cannot be undone. Tournaments with golfers cannot be deleted.`)) return;
    
    setIsLoading(true);
    try {
      await api.deleteTournament(tournament.id);
      toast.success('Tournament deleted');
      refreshTournaments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: Tournament['status']) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full"><CheckCircle size={12} /> Open</span>;
      case 'draft':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full"><AlertCircle size={12} /> Draft</span>;
      case 'closed':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs font-medium rounded-full"><Pause size={12} /> Closed</span>;
      case 'archived':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full"><Archive size={12} /> Archived</span>;
    }
  };

  const TournamentCard = ({ tournament }: { tournament: Tournament }) => {
    const isExpanded = expandedId === tournament.id;
    const isCurrent = currentTournament?.id === tournament.id;

    return (
      <Card className={`mb-4 overflow-hidden ${isCurrent ? 'ring-2 ring-brand-500' : ''}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-900 truncate">{tournament.display_name}</h3>
                {getStatusBadge(tournament.status)}
                {isCurrent && (
                  <span className="px-2 py-0.5 bg-brand-100 text-brand-800 text-xs font-medium rounded-full">
                    Current
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {tournament.event_date || 'Date TBD'}
                </span>
                <span className="flex items-center gap-1" title={tournament.reserved_slots ? `${tournament.reserved_slots} reserved slots` : ''}>
                  <Users size={14} />
                  {tournament.confirmed_count}/{tournament.max_capacity}
                  {tournament.reserved_slots > 0 && (
                    <span className="text-xs text-amber-600">({tournament.reserved_slots} reserved)</span>
                  )}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign size={14} />
                  ${tournament.entry_fee_dollars}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => setExpandedId(isExpanded ? null : tournament.id)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Location</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin size={14} />
                    {tournament.location_name || 'TBD'}
                  </p>
                  {tournament.location_address && (
                    <p className="text-gray-500 text-xs">{tournament.location_address}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">Time</p>
                  <p className="font-medium flex items-center gap-1">
                    <Clock size={14} />
                    {tournament.registration_time} registration, {tournament.start_time} start
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Format</p>
                  <p className="font-medium">{tournament.format_name || 'TBD'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Capacity</p>
                  <p className="font-medium">
                    {tournament.confirmed_count}/{tournament.max_capacity} registered
                    {tournament.reserved_slots > 0 && (
                      <span className="text-gray-500 text-xs block">
                        ({tournament.public_capacity} public + {tournament.reserved_slots} reserved)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Stats</p>
                  <p className="font-medium">
                    {tournament.waitlist_count} waitlist, {tournament.paid_count} paid
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                {tournament.status !== 'archived' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTournament(tournament);
                        setIsEditModalOpen(true);
                      }}
                    >
                      <Edit size={14} className="mr-1" /> Edit
                    </Button>
                    
                    {tournament.status === 'draft' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpen(tournament)}
                        disabled={isLoading}
                      >
                        <Play size={14} className="mr-1" /> Open Registration
                      </Button>
                    )}
                    
                    {tournament.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClose(tournament)}
                        disabled={isLoading}
                      >
                        <Pause size={14} className="mr-1" /> Close Registration
                      </Button>
                    )}
                    
                    {tournament.status === 'closed' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpen(tournament)}
                        disabled={isLoading}
                      >
                        <Play size={14} className="mr-1" /> Reopen Registration
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(tournament)}
                      disabled={isLoading}
                    >
                      <Copy size={14} className="mr-1" /> Copy for Next Year
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(tournament)}
                      disabled={isLoading}
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      <Archive size={14} className="mr-1" /> Archive
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmployeeNumbersTournament(tournament);
                        setIsEmployeeNumbersModalOpen(true);
                      }}
                    >
                      <UserCheck size={14} className="mr-1" /> 
                      Employee Numbers
                      {(tournament.employee_numbers_count ?? 0) > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-brand-100 text-brand-700 rounded-full">
                          {tournament.employee_numbers_count ?? 0}
                        </span>
                      )}
                    </Button>
                  </>
                )}
                
                {tournament.status === 'archived' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(tournament)}
                    disabled={isLoading}
                  >
                    <Copy size={14} className="mr-1" /> Copy for New Tournament
                  </Button>
                )}
                
                {tournament.confirmed_count === 0 && tournament.waitlist_count === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(tournament)}
                    disabled={isLoading}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <Trash2 size={14} className="mr-1" /> Delete
                  </Button>
                )}
                
                {!isCurrent && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentTournament(tournament)}
                  >
                    Switch to This Tournament
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tournament Management</h1>
            <p className="text-gray-600 mt-1">Create, edit, and manage tournaments</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            New Tournament
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'active'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Active ({activeTournaments.length})
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'archived'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Archived ({archivedTournaments.length})
          </button>
        </div>

        {/* Tournament List */}
        <div>
          {activeTab === 'active' ? (
            activeTournaments.length > 0 ? (
              activeTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))
            ) : (
              <Card className="p-8 text-center">
                <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Tournaments</h3>
                <p className="text-gray-500 mb-4">Create your first tournament to get started.</p>
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus size={18} className="mr-2" />
                  Create Tournament
                </Button>
              </Card>
            )
          ) : (
            archivedTournaments.length > 0 ? (
              archivedTournaments.map(tournament => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))
            ) : (
              <Card className="p-8 text-center">
                <Archive size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Archived Tournaments</h3>
                <p className="text-gray-500">Completed tournaments will appear here after archiving.</p>
              </Card>
            )
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <TournamentFormModal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedTournament(null);
        }}
        tournament={selectedTournament}
        onSuccess={() => {
          refreshTournaments();
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedTournament(null);
        }}
      />

      {/* Employee Numbers Modal */}
      <EmployeeNumbersModal
        isOpen={isEmployeeNumbersModalOpen}
        onClose={() => {
          setIsEmployeeNumbersModalOpen(false);
          setEmployeeNumbersTournament(null);
          refreshTournaments(); // Refresh to update counts
        }}
        tournament={employeeNumbersTournament}
      />
    </AdminLayout>
  );
};

// Tournament Form Modal Component
interface TournamentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onSuccess: () => void;
}

const TournamentFormModal = ({ isOpen, onClose, tournament, onSuccess }: TournamentFormModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Tournament>>({});

  // Update form when tournament changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (tournament) {
        // Editing existing tournament - populate with current values
        setFormData({
          name: tournament.name,
          year: tournament.year,
          edition: tournament.edition || '',
          event_date: tournament.event_date || '',
          registration_time: tournament.registration_time || '11:00 am',
          start_time: tournament.start_time || '12:30 pm',
          location_name: tournament.location_name || '',
          location_address: tournament.location_address || '',
          max_capacity: tournament.max_capacity,
          reserved_slots: tournament.reserved_slots || 0,
          entry_fee: tournament.entry_fee,
          employee_entry_fee: tournament.employee_entry_fee || 5000,
          format_name: tournament.format_name || '',
          fee_includes: tournament.fee_includes || '',
          checks_payable_to: tournament.checks_payable_to || '',
          contact_name: tournament.contact_name || '',
          contact_phone: tournament.contact_phone || '',
        });
      } else {
        // Creating new tournament - use defaults
        setFormData({
          name: '',
          year: new Date().getFullYear() + 1,
          edition: '',
          event_date: '',
          registration_time: '11:00 am',
          start_time: '12:30 pm',
          location_name: '',
          location_address: '',
          max_capacity: 160,
          reserved_slots: 0,
          entry_fee: 12500,
          employee_entry_fee: 5000,
          format_name: 'Individual Callaway',
          fee_includes: 'Green Fee, Ditty Bag, Drinks & Food',
          checks_payable_to: 'GIAAEO',
          contact_name: '',
          contact_phone: '',
        });
      }
    }
  }, [isOpen, tournament]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (tournament) {
        await api.updateTournament(tournament.id, formData);
        toast.success('Tournament updated successfully');
      } else {
        await api.createTournament(formData);
        toast.success('Tournament created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save tournament');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof Tournament, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tournament ? 'Edit Tournament' : 'Create New Tournament'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Tournament Name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Edward A.P. Muna II Memorial Golf Tournament"
              required
            />
          </div>
          
          <Input
            label="Year"
            type="number"
            value={formData.year || ''}
            onChange={(e) => handleChange('year', parseInt(e.target.value))}
            required
          />
          
          <Input
            label="Edition"
            value={formData.edition || ''}
            onChange={(e) => handleChange('edition', e.target.value)}
            placeholder="e.g., 5th"
          />
          
          <Input
            label="Event Date"
            value={formData.event_date || ''}
            onChange={(e) => handleChange('event_date', e.target.value)}
            placeholder="e.g., January 9, 2026"
          />
          
          <Input
            label="Max Capacity"
            type="number"
            value={formData.max_capacity || ''}
            onChange={(e) => handleChange('max_capacity', parseInt(e.target.value))}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reserved Slots
            </label>
            <input
              type="number"
              min="0"
              max={formData.max_capacity || 0}
              value={formData.reserved_slots || 0}
              onChange={(e) => handleChange('reserved_slots', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Slots reserved for VIPs/sponsors. Public sees {(formData.max_capacity || 0) - (formData.reserved_slots || 0)} spots.
            </p>
          </div>
          
          <Input
            label="Registration Time"
            value={formData.registration_time || ''}
            onChange={(e) => handleChange('registration_time', e.target.value)}
            placeholder="e.g., 11:00 am"
          />
          
          <Input
            label="Start Time"
            value={formData.start_time || ''}
            onChange={(e) => handleChange('start_time', e.target.value)}
            placeholder="e.g., 12:30 pm"
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entry Fee ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={((formData.entry_fee || 0) / 100).toFixed(2)}
                onChange={(e) => {
                  const dollars = parseFloat(e.target.value) || 0;
                  const cents = Math.round(dollars * 100);
                  handleChange('entry_fee', cents);
                }}
                className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-transparent"
                placeholder="125.00"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee Fee ($)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={((formData.employee_entry_fee || 5000) / 100).toFixed(2)}
                onChange={(e) => {
                  const dollars = parseFloat(e.target.value) || 0;
                  const cents = Math.round(dollars * 100);
                  handleChange('employee_entry_fee', cents);
                }}
                className="w-full pl-7 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 focus:border-transparent"
                placeholder="50.00"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Discounted rate for GIAA employees</p>
          </div>
          
          <Input
            label="Location Name"
            value={formData.location_name || ''}
            onChange={(e) => handleChange('location_name', e.target.value)}
            placeholder="e.g., Country Club of the Pacific"
          />
          
          <div className="sm:col-span-2">
            <Input
              label="Location Address"
              value={formData.location_address || ''}
              onChange={(e) => handleChange('location_address', e.target.value)}
              placeholder="e.g., Windward Hills, Guam"
            />
          </div>
          
          <Input
            label="Format"
            value={formData.format_name || ''}
            onChange={(e) => handleChange('format_name', e.target.value)}
            placeholder="e.g., Individual Callaway"
          />
          
          <Input
            label="Checks Payable To"
            value={formData.checks_payable_to || ''}
            onChange={(e) => handleChange('checks_payable_to', e.target.value)}
          />
          
          <div className="sm:col-span-2">
            <Input
              label="Fee Includes"
              value={formData.fee_includes || ''}
              onChange={(e) => handleChange('fee_includes', e.target.value)}
              placeholder="e.g., Green Fee, Ditty Bag, Drinks & Food"
            />
          </div>
          
          <Input
            label="Contact Name"
            value={formData.contact_name || ''}
            onChange={(e) => handleChange('contact_name', e.target.value)}
          />
          
          <Input
            label="Contact Phone"
            value={formData.contact_phone || ''}
            onChange={(e) => handleChange('contact_phone', e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : tournament ? 'Update Tournament' : 'Create Tournament'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Employee Numbers Modal Component
interface EmployeeNumbersModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | null;
}

const EmployeeNumbersModal = ({ isOpen, onClose, tournament }: EmployeeNumbersModalProps) => {
  const [employeeNumbers, setEmployeeNumbers] = useState<EmployeeNumber[]>([]);
  const [stats, setStats] = useState({ total: 0, available: 0, used: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  // Fetch employee numbers when modal opens
  useEffect(() => {
    if (isOpen && tournament) {
      fetchEmployeeNumbers();
    }
  }, [isOpen, tournament]);

  const fetchEmployeeNumbers = async () => {
    if (!tournament) return;
    setIsLoading(true);
    try {
      const data = await api.getEmployeeNumbers(tournament.id);
      setEmployeeNumbers(data.employee_numbers);
      setStats(data.stats);
    } catch (error) {
      toast.error('Failed to load employee numbers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSingle = async () => {
    if (!newNumber.trim()) {
      toast.error('Employee number is required');
      return;
    }

    try {
      await api.createEmployeeNumber({ employee_number: newNumber.trim(), employee_name: newName.trim() || undefined });
      toast.success('Employee number added');
      setNewNumber('');
      setNewName('');
      fetchEmployeeNumbers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add employee number');
    }
  };

  const handleBulkAdd = async () => {
    const lines = bulkInput.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      toast.error('Enter at least one employee number');
      return;
    }

    const numbers = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        employee_number: parts[0],
        employee_name: parts[1] || undefined
      };
    });

    try {
      const result = await api.bulkCreateEmployeeNumbers(numbers);
      if (result.created > 0) {
        toast.success(`Added ${result.created} employee number(s)`);
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} failed: ${result.errors[0].errors.join(', ')}`);
      }
      setBulkInput('');
      setShowBulkAdd(false);
      fetchEmployeeNumbers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add employee numbers');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this employee number?')) return;

    try {
      await api.deleteEmployeeNumber(id);
      toast.success('Employee number deleted');
      fetchEmployeeNumbers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete');
    }
  };

  const handleRelease = async (id: number) => {
    if (!confirm('Release this employee number? It will become available for use again.')) return;

    try {
      await api.releaseEmployeeNumber(id);
      toast.success('Employee number released');
      fetchEmployeeNumbers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to release');
    }
  };

  if (!isOpen || !tournament) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Employee Numbers - ${tournament.short_name}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Stats */}
        <div className="flex gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-green-600">{stats.available}</p>
            <p className="text-xs text-gray-500">Available</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-amber-600">{stats.used}</p>
            <p className="text-xs text-gray-500">Used</p>
          </div>
        </div>

        {/* Employee Fee Info */}
        <div className="p-3 bg-brand-50 rounded-lg text-sm">
          <p className="text-brand-800">
            <strong>Employee Rate:</strong> ${(tournament.employee_entry_fee_dollars ?? 0).toFixed(2)} 
            <span className="text-brand-600 ml-2">(vs ${tournament.entry_fee_dollars.toFixed(2)} regular)</span>
          </p>
        </div>

        {/* Add Single */}
        {!showBulkAdd && (
          <div className="flex gap-2">
            <Input
              placeholder="Employee Number"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddSingle} size="sm">
              <Plus size={16} className="mr-1" /> Add
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowBulkAdd(true)}>
              <Upload size={16} className="mr-1" /> Bulk
            </Button>
          </div>
        )}

        {/* Bulk Add */}
        {showBulkAdd && (
          <div className="space-y-2 p-3 border rounded-lg">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">Bulk Add Employee Numbers</p>
              <button onClick={() => setShowBulkAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500">One per line. Format: number,name (name is optional)</p>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full h-32 p-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="12345,John Smith&#10;67890,Jane Doe&#10;11111"
            />
            <div className="flex gap-2">
              <Button onClick={handleBulkAdd} size="sm">
                Add All
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setBulkInput(''); setShowBulkAdd(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="max-h-64 overflow-y-auto border rounded-lg">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : employeeNumbers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No employee numbers added yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Number</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeNumbers.map((emp) => (
                  <tr key={emp.id} className={emp.used ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-2 font-mono">{emp.employee_number}</td>
                    <td className="px-3 py-2 text-gray-600">{emp.employee_name || '-'}</td>
                    <td className="px-3 py-2">
                      {emp.used ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <CheckCircle size={14} />
                          Used by {emp.used_by_golfer_name}
                        </span>
                      ) : (
                        <span className="text-green-600">Available</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {emp.used ? (
                        <button
                          onClick={() => handleRelease(emp.id)}
                          className="text-brand-600 hover:text-brand-800 text-xs"
                        >
                          <RefreshCw size={14} className="inline mr-1" />
                          Release
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(emp.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          <Trash2 size={14} className="inline mr-1" />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
