import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdminLayout } from '../components/AdminLayout';
import { Card, Button, Select } from '../components/ui';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Users, GripVertical, Trash2, RefreshCw, Plus, CheckCircle, ChevronDown, ChevronUp, X, UserPlus, Check, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { api, Golfer, Group } from '../services/api';
import { useGolferChannel } from '../hooks/useGolferChannel';
import { useTournament } from '../contexts/TournamentContext';

interface DraggableGolferProps {
  golfer: Golfer;
  onRemove?: () => void;
  compact?: boolean;
}

const DraggableGolfer: React.FC<DraggableGolferProps> = ({ golfer, onRemove, compact }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: golfer.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 lg:gap-3 ${compact ? 'p-2' : 'p-3'} bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow touch-manipulation`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
      >
        <GripVertical size={compact ? 18 : 20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-gray-900 truncate ${compact ? 'text-sm' : ''}`}>{golfer.name}</p>
        {!compact && <p className="text-xs text-gray-500 truncate">{golfer.email}</p>}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 p-1.5 touch-manipulation"
        >
          <Trash2 size={compact ? 16 : 18} />
        </button>
      )}
    </div>
  );
};

// Droppable zone component for groups
interface DroppableGroupZoneProps {
  groupId: number;
  children: React.ReactNode;
  isOver: boolean;
  canDrop: boolean;
}

const DroppableGroupZone: React.FC<DroppableGroupZoneProps> = ({ groupId, children, isOver, canDrop }) => {
  const { setNodeRef } = useDroppable({
    id: `group-drop-${groupId}`,
    data: { groupId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-3 lg:p-4 text-center transition-colors min-h-[80px] ${
        isOver && canDrop
          ? 'border-brand-500 bg-brand-50'
          : isOver && !canDrop
          ? 'border-red-300 bg-red-50'
          : 'border-gray-300'
      }`}
    >
      {children}
    </div>
  );
};

export const GroupManagementPage: React.FC = () => {
  const { currentTournament } = useTournament();
  
  // Team size from tournament config (default to 4 for standard foursomes)
  const maxTeamSize = currentTournament?.team_size || 4;
  
  const [unassigned, setUnassigned] = useState<Golfer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<number | null>(null);
  const [newGroupId, setNewGroupId] = useState<number | null>(null);
  const [showUnassigned, setShowUnassigned] = useState(false);
  const [bulkAddGroupId, setBulkAddGroupId] = useState<number | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  
  const groupsContainerRef = useRef<HTMLDivElement>(null);
  const newGroupRef = useRef<HTMLDivElement>(null);

  // Add touch sensor for mobile drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      const [golfersResponse, groupsData] = await Promise.all([
        api.getGolfers({ assigned: 'false', per_page: 1000 }),
        api.getGroups(),
      ]);
      
      // Filter out cancelled and waitlist golfers - they shouldn't be assignable to groups
      setUnassigned(golfersResponse.golfers.filter(g => 
        g.registration_status !== 'cancelled' && g.registration_status !== 'waitlist'
      ));
      // Store groups (sorting is handled by sortedGroups computed value)
      setGroups(groupsData);
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
  const handleGolferUpdated = useCallback(() => {
    // Refresh both unassigned and groups data
    fetchData(false);
  }, []);

  const handleGolferCreated = useCallback(() => {
    fetchData(false);
  }, []);

  const handleGolferDeleted = useCallback(() => {
    fetchData(false);
  }, []);

  useGolferChannel({
    onGolferUpdated: handleGolferUpdated,
    onGolferCreated: handleGolferCreated,
    onGolferDeleted: handleGolferDeleted,
  });

  // Scroll to new group when it's created
  useEffect(() => {
    if (newGroupId && newGroupRef.current) {
      newGroupRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const timer = setTimeout(() => setNewGroupId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [newGroupId, groups]);

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      const overId = over.id as string;
      if (overId.startsWith('group-drop-')) {
        const groupId = parseInt(overId.replace('group-drop-', ''));
        setOverGroupId(groupId);
      } else {
        setOverGroupId(null);
      }
    } else {
      setOverGroupId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverGroupId(null);

    if (!over) return;

    const activeGolferId = parseInt(active.id as string);
    const overId = over.id as string;

    if (overId.startsWith('group-drop-')) {
      const groupId = parseInt(overId.replace('group-drop-', ''));
      
      const golfer = unassigned.find(g => g.id === activeGolferId);
      if (!golfer) return;

      const group = groups.find(g => g.id === groupId);
      if (!group || (group.golfers?.length || 0) >= maxTeamSize) return;

      try {
        setUnassigned(prev => prev.filter(g => g.id !== activeGolferId));
        setGroups(prev => prev.map(g => 
          g.id === groupId 
            ? { ...g, golfers: [...(g.golfers || []), golfer] }
            : g
        ));
        
        await api.addGolferToGroup(groupId, activeGolferId);
        await fetchData(false);
        setSuccessMessage(`${golfer.name} added to Hole ${group.hole_position_label || group.group_number}`);
      } catch (err) {
        console.error('Error adding golfer to group:', err);
        setError(err instanceof Error ? err.message : 'Failed to add golfer to group');
        await fetchData(false);
      }
    }
  };

  const createNewGroup = async () => {
    try {
      setIsCreating(true);
      setError(null);
      const newGroup = await api.createGroup();
      
      setGroups(prev => [newGroup, ...prev]);
      setNewGroupId(newGroup.id);
      setSuccessMessage(`Hole ${newGroup.hole_position_label || newGroup.group_number} created!`);
      
      if (groupsContainerRef.current) {
        groupsContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error creating group:', err);
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const addToGroup = async (groupId: number, golferId: number) => {
    const golfer = unassigned.find(g => g.id === golferId);
    const group = groups.find(g => g.id === groupId);
    
    try {
      if (golfer) {
        setUnassigned(prev => prev.filter(g => g.id !== golferId));
        setGroups(prev => prev.map(g => 
          g.id === groupId 
            ? { ...g, golfers: [...(g.golfers || []), golfer] }
            : g
        ));
      }
      
      await api.addGolferToGroup(groupId, golferId);
      await fetchData(false);
      if (golfer && group) {
        setSuccessMessage(`${golfer.name} added to Hole ${group.hole_position_label || group.group_number}`);
      }
    } catch (err) {
      console.error('Error adding golfer to group:', err);
      setError(err instanceof Error ? err.message : 'Failed to add golfer to group');
      await fetchData(false);
    }
  };

  const removeFromGroup = async (groupId: number, golferId: number) => {
    const group = groups.find(g => g.id === groupId);
    const golfer = group?.golfers?.find(g => g.id === golferId);
    
    try {
      setGroups(prev => prev.map(g => 
        g.id === groupId 
          ? { ...g, golfers: g.golfers?.filter(p => p.id !== golferId) || [] }
          : g
      ));
      if (golfer) {
        setUnassigned(prev => [...prev, golfer]);
      }
      
      await api.removeGolferFromGroup(groupId, golferId);
      await fetchData(false);
    } catch (err) {
      console.error('Error removing golfer from group:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove golfer from group');
      await fetchData(false);
    }
  };

  const updateGroupHole = async (groupId: number, hole: number) => {
    try {
      setGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, hole_number: hole } : g
      ));
      
      await api.setGroupHole(groupId, hole);
    } catch (err) {
      console.error('Error updating group hole:', err);
      setError(err instanceof Error ? err.message : 'Failed to update group hole');
      await fetchData(false);
    }
  };

  const deleteGroup = async (groupId: number) => {
    const group = groups.find(g => g.id === groupId);
    
    try {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (group?.golfers) {
        setUnassigned(prev => [...prev, ...group.golfers!]);
      }
      
      await api.deleteGroup(groupId);
      await fetchData(false);
      setSuccessMessage(`Hole ${group?.hole_position_label || group?.group_number} deleted`);
    } catch (err) {
      console.error('Error deleting group:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      await fetchData(false);
    }
  };

  // Bulk add players to a group
  const openBulkAddModal = (groupId: number) => {
    setBulkAddGroupId(groupId);
    setSelectedPlayerIds([]);
  };

  const closeBulkAddModal = () => {
    setBulkAddGroupId(null);
    setSelectedPlayerIds([]);
  };

  const togglePlayerSelection = (playerId: number) => {
    setSelectedPlayerIds(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleBulkAdd = async () => {
    if (!bulkAddGroupId || selectedPlayerIds.length === 0) return;
    
    const group = groups.find(g => g.id === bulkAddGroupId);
    if (!group) return;
    
    const spotsAvailable = maxTeamSize - (group.golfers?.length || 0);
    const playersToAdd = selectedPlayerIds.slice(0, spotsAvailable);
    
    setIsAddingBulk(true);
    try {
      // Add players one by one
      for (const playerId of playersToAdd) {
        await api.addGolferToGroup(bulkAddGroupId, playerId);
      }
      
      await fetchData(false);
      setSuccessMessage(`Added ${playersToAdd.length} player${playersToAdd.length !== 1 ? 's' : ''} to Hole ${group.hole_position_label || group.group_number}`);
      closeBulkAddModal();
    } catch (err) {
      console.error('Error bulk adding players:', err);
      setError(err instanceof Error ? err.message : 'Failed to add players');
      await fetchData(false);
    } finally {
      setIsAddingBulk(false);
    }
  };

  // Get the group for bulk add modal
  const bulkAddGroup = bulkAddGroupId ? groups.find(g => g.id === bulkAddGroupId) : null;
  const spotsAvailable = bulkAddGroup ? maxTeamSize - (bulkAddGroup.golfers?.length || 0) : 0;

  const activeGolfer = activeId 
    ? [...unassigned, ...groups.flatMap(g => g.golfers || [])].find(g => g.id.toString() === activeId) 
    : null;

  // Compute groups organized by hole (with search filtering)
  const groupsByHole = React.useMemo(() => {
    // Filter groups based on search query
    const searchLower = searchQuery.toLowerCase().trim();
    
    const filteredGroups = searchLower
      ? groups.filter(group => {
          // Match hole number (e.g., "1", "1a", "hole 1")
          const holeLabel = group.hole_position_label?.toLowerCase() || '';
          const holeNum = group.hole_number?.toString() || '';
          if (holeLabel.includes(searchLower) || holeNum.includes(searchLower)) {
            return true;
          }
          if (searchLower.replace('hole ', '').trim() === holeNum) {
            return true;
          }
          
          // Match golfer names
          const golferMatch = group.golfers?.some(golfer => 
            golfer.name.toLowerCase().includes(searchLower)
          );
          if (golferMatch) {
            return true;
          }
          
          return false;
        })
      : groups;
    
    // Create a map of hole numbers to groups
    const holeMap = new Map<number | null, Group[]>();
    
    filteredGroups.forEach(group => {
      const hole = group.hole_number || null;
      if (!holeMap.has(hole)) {
        holeMap.set(hole, []);
      }
      holeMap.get(hole)!.push(group);
    });
    
    // Sort groups within each hole by group_number
    holeMap.forEach((holeGroups, hole) => {
      holeGroups.sort((a, b) => {
        const comparison = a.group_number - b.group_number;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
      holeMap.set(hole, holeGroups);
    });
    
    // Sort entries: holes 1-18, then unassigned (null)
    const sortedEntries: { hole: number | null; groups: Group[] }[] = [];
    
    // Add holes in order based on sort direction
    if (sortDirection === 'asc') {
      for (let i = 1; i <= 18; i++) {
        if (holeMap.has(i)) {
          sortedEntries.push({ hole: i, groups: holeMap.get(i)! });
        }
      }
    } else {
      for (let i = 18; i >= 1; i--) {
        if (holeMap.has(i)) {
          sortedEntries.push({ hole: i, groups: holeMap.get(i)! });
        }
      }
    }
    
    // Add unassigned at the end
    if (holeMap.has(null)) {
      sortedEntries.push({ hole: null, groups: holeMap.get(null)! });
    }
    
    return sortedEntries;
  }, [groups, sortDirection, searchQuery]);

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4 lg:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Group Management</h1>
              <p className="text-xs lg:text-sm text-gray-500 mt-1">
                {groups.length} group{groups.length !== 1 ? 's' : ''} • {unassigned.length} unassigned • {maxTeamSize}-person teams
                {searchQuery && (
                  <span className="ml-2 text-brand-600">
                    • Showing {groupsByHole.reduce((acc, h) => acc + h.groups.length, 0)} matching
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap">
              {/* Sort Direction Toggle */}
              <button
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title={sortDirection === 'asc' ? 'Sorted low to high' : 'Sorted high to low'}
              >
                {sortDirection === 'asc' ? (
                  <ArrowUp size={16} />
                ) : (
                  <ArrowDown size={16} />
                )}
              </button>
              <Button 
                variant="outline" 
                onClick={() => fetchData()}
                className="flex-1 sm:flex-none text-sm lg:text-base px-3 lg:px-4"
              >
                <RefreshCw size={18} className="lg:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button 
                onClick={createNewGroup} 
                disabled={isCreating}
                className="flex-1 sm:flex-none text-sm lg:text-base px-3 lg:px-4"
              >
                {isCreating ? (
                  <RefreshCw size={18} className="animate-spin lg:mr-2" />
                ) : (
                  <Plus size={18} className="lg:mr-2" />
                )}
                <span className="hidden sm:inline">{isCreating ? 'Creating...' : 'New Group'}</span>
              </Button>
            </div>
          </div>

          {/* Search/Filter Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by hole number or golfer name... (view only - does not edit data)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 lg:px-4 py-2 lg:py-3 rounded-lg flex items-center gap-2 animate-fade-in text-sm lg:text-base">
              <CheckCircle size={18} />
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-sm lg:text-base">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
            </div>
          )}

          {/* Mobile: Unassigned Players Toggle */}
          {unassigned.length > 0 && (
            <div className="lg:hidden">
              <button
                onClick={() => setShowUnassigned(!showUnassigned)}
                className="w-full flex items-center justify-between p-4 bg-white rounded-lg shadow-md border border-gray-200"
              >
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-brand-800" />
                  <span className="font-semibold text-gray-900">Unassigned Players</span>
                  <span className="bg-brand-100 text-brand-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {unassigned.length}
                  </span>
                </div>
                {showUnassigned ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
              
              {showUnassigned && (
                <Card className="mt-2 p-3 animate-fade-in">
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                    <SortableContext
                      items={unassigned.map(g => g.id.toString())}
                      strategy={verticalListSortingStrategy}
                    >
                      {unassigned.map((golfer) => (
                        <DraggableGolfer key={golfer.id} golfer={golfer} compact />
                      ))}
                    </SortableContext>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Drag players to groups below, or use the dropdown in each group
                  </p>
                </Card>
              )}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Desktop: Unassigned Players Sidebar */}
            <Card className="hidden lg:block lg:col-span-1">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={24} />
                Unassigned Players ({unassigned.length})
              </h2>
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                <SortableContext
                  items={unassigned.map(g => g.id.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  {unassigned.map((golfer) => (
                    <DraggableGolfer key={golfer.id} golfer={golfer} />
                  ))}
                </SortableContext>
                {unassigned.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    All players have been assigned to groups
                  </p>
                )}
              </div>
            </Card>

            {/* Groups */}
            <div 
              ref={groupsContainerRef}
              className="lg:col-span-2 space-y-4 max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-200px)] overflow-y-auto"
            >
              {groups.length === 0 ? (
                <Card className="p-4 lg:p-6">
                  <div className="text-center py-8 lg:py-12">
                    <Users className="mx-auto text-gray-400 mb-4" size={40} />
                    <h3 className="text-base lg:text-lg font-medium text-gray-900 mb-2">
                      No Groups Created
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Create your first group to start organizing players
                    </p>
                    <Button onClick={createNewGroup} disabled={isCreating}>
                      {isCreating ? 'Creating...' : 'Create New Group'}
                    </Button>
                  </div>
                </Card>
              ) : (
                // View by Hole
                groupsByHole?.map(({ hole, groups: holeGroups }) => (
                  <div key={hole ?? 'unassigned'} className="space-y-3">
                    {/* Hole Header */}
                    <div className="sticky top-0 z-10 bg-gray-100 rounded-lg px-4 py-2 border border-gray-200 shadow-sm">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        {hole !== null ? (
                          <>
                            <span className="w-8 h-8 bg-brand-800 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {hole}
                            </span>
                            Hole {hole}
                          </>
                        ) : (
                          <>
                            <span className="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm">
                              ?
                            </span>
                            No Hole Assigned
                          </>
                        )}
                        <span className="text-sm font-normal text-gray-500 ml-2">
                          ({holeGroups.length} group{holeGroups.length !== 1 ? 's' : ''})
                        </span>
                      </h3>
                    </div>
                    
                    {/* Groups for this hole */}
                    {holeGroups.map((group) => {
                      const isOverThisGroup = overGroupId === group.id;
                      const golferCount = group.golfers?.length || 0;
                      const canDropHere = golferCount < maxTeamSize;
                      const isNewGroup = newGroupId === group.id;

                      return (
                        <div
                          key={group.id}
                          ref={isNewGroup ? newGroupRef : undefined}
                          className="ml-4"
                        >
                          <Card 
                            className={`p-3 lg:p-6 transition-all duration-500 ${
                              golferCount === maxTeamSize 
                                ? 'border-2 border-green-500' 
                                : isNewGroup 
                                ? 'border-2 border-brand-500 ring-4 ring-brand-100 animate-pulse' 
                                : ''
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3 lg:mb-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-1 lg:mb-2 flex items-center gap-2 flex-wrap">
                                  Hole {group.hole_position_label || 'Unassigned'}
                                  <span className="text-xs font-normal text-gray-400">
                                    (Group #{group.group_number})
                                  </span>
                                  {golferCount === maxTeamSize && (
                                    <span className="text-xs lg:text-sm font-normal text-green-600">
                                      (Complete)
                                    </span>
                                  )}
                                  {isNewGroup && (
                                    <span className="text-xs font-medium text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                                      New!
                                    </span>
                                  )}
                                </h3>
                                <div className="flex items-center gap-2 lg:gap-4">
                                  <Select
                                    label="Hole"
                                    value={group.hole_number?.toString() || ''}
                                    onChange={(e) => updateGroupHole(group.id, parseInt(e.target.value))}
                                    options={[
                                      { value: '', label: 'No hole' },
                                      ...Array.from({ length: 18 }, (_, i) => ({
                                        value: String(i + 1),
                                        label: `Hole ${i + 1}`,
                                      })),
                                    ]}
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => deleteGroup(group.id)}
                                className="text-red-500 hover:text-red-700 p-2 touch-manipulation"
                                title="Delete group"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>

                            <div className="space-y-2">
                              {group.golfers?.map((player) => {
                                return (
                                  <div
                                    key={player.id}
                                    className="flex items-center gap-2 lg:gap-3 p-2 lg:p-3 bg-brand-50 border border-brand-200 rounded-lg"
                                  >
                                    <div className="w-7 h-7 lg:w-8 lg:h-8 bg-brand-800 text-white rounded-full flex items-center justify-center font-bold text-xs lg:text-sm flex-shrink-0">
                                      {group.hole_position_label || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 text-sm lg:text-base truncate">{player.name}</p>
                                      <p className="text-xs text-gray-500 truncate hidden sm:block">{player.email}</p>
                                    </div>
                                    <button
                                      onClick={() => removeFromGroup(group.id, player.id)}
                                      className="text-red-500 hover:text-red-700 p-1.5 touch-manipulation flex-shrink-0"
                                      title="Remove from group"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                );
                              })}

                              {golferCount < maxTeamSize && (
                                <DroppableGroupZone 
                                  groupId={group.id} 
                                  isOver={isOverThisGroup}
                                  canDrop={canDropHere}
                                >
                                  <p className="text-gray-500 text-xs lg:text-sm mb-1 lg:mb-2">
                                    {maxTeamSize - golferCount} spot{maxTeamSize - golferCount !== 1 ? 's' : ''} remaining
                                  </p>
                                  <p className="text-xs text-gray-400 mb-2 lg:mb-3 hidden lg:block">
                                    {isOverThisGroup && canDropHere 
                                      ? <span className="flex items-center gap-1 text-green-500"><Check className="w-3 h-3" /> Drop here to add player!</span>
                                      : 'Drag players from the left to add them'}
                                  </p>
                                  {unassigned.length > 0 && !activeId && (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            addToGroup(group.id, parseInt(e.target.value));
                                            e.target.value = '';
                                          }
                                        }}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        defaultValue=""
                                      >
                                        <option value="">Add one player...</option>
                                        {unassigned.map(golfer => (
                                          <option key={golfer.id} value={golfer.id}>
                                            {golfer.name}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => openBulkAddModal(group.id)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-800 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
                                      >
                                        <UserPlus size={16} />
                                        <span>Add Multiple</span>
                                      </button>
                                    </div>
                                  )}
                                </DroppableGroupZone>
                              )}
                            </div>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeGolfer ? (
            <div className="bg-white border-2 border-brand-500 rounded-lg p-3 shadow-xl cursor-grabbing">
              <p className="font-medium text-gray-900">{activeGolfer.name}</p>
              <p className="text-xs text-gray-500">{activeGolfer.email}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Bulk Add Modal */}
      {bulkAddGroupId && bulkAddGroup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={closeBulkAddModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white w-full sm:w-[28rem] sm:max-w-[90vw] max-h-[65vh] sm:max-h-[80vh] mb-[4.5rem] sm:mb-0 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up sm:animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Add Players to Group {bulkAddGroup.group_number}
                </h3>
                <p className="text-sm text-gray-500">
                  {spotsAvailable} spot{spotsAvailable !== 1 ? 's' : ''} available
                  {selectedPlayerIds.length > 0 && (
                    <span className="text-brand-600 font-medium">
                      {' '}· {Math.min(selectedPlayerIds.length, spotsAvailable)} selected
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={closeBulkAddModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Player List */}
            <div className="flex-1 overflow-y-auto p-4">
              {unassigned.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No unassigned players available
                </div>
              ) : (
                <div className="space-y-2">
                  {unassigned.map((player) => {
                    const isSelected = selectedPlayerIds.includes(player.id);
                    const isDisabled = !isSelected && selectedPlayerIds.length >= spotsAvailable;
                    
                    return (
                      <button
                        key={player.id}
                        onClick={() => !isDisabled && togglePlayerSelection(player.id)}
                        disabled={isDisabled}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50'
                            : isDisabled
                            ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-brand-500' : 'border-2 border-gray-300'
                        }`}>
                          {isSelected && <Check size={16} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{player.name}</p>
                          <p className="text-xs text-gray-500 truncate">{player.email}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={closeBulkAddModal}
                  className="flex-1"
                  disabled={isAddingBulk}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkAdd}
                  className="flex-1"
                  disabled={selectedPlayerIds.length === 0 || isAddingBulk}
                >
                  {isAddingBulk ? (
                    <>
                      <RefreshCw size={16} className="animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      Add {Math.min(selectedPlayerIds.length, spotsAvailable)} Player{Math.min(selectedPlayerIds.length, spotsAvailable) !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
