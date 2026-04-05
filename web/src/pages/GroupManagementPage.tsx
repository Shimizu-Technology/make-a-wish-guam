import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOrganization } from '../components/OrganizationProvider';
import {
  DndContext,
  DragOverlay,
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
import {
  Flag,
  Plus,
  Trash2,
  UserMinus,
  Shuffle,
  Loader2,
  Search,
  GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

interface GroupGolfer {
  id: number;
  name: string;
  email: string;
  partner_name: string | null;
  team_name: string | null;
  payment_status: string;
  checked_in_at: string | null;
}

interface Group {
  id: number;
  tournament_id: number;
  group_number: number;
  hole_number: number | null;
  golfer_count: number;
  player_count: number;
  max_golfers: number;
  is_full: boolean;
  hole_position_label: string | null;
  golfers: GroupGolfer[];
}

interface UnassignedGolfer {
  id: number;
  name: string;
  partner_name: string | null;
  team_name: string | null;
  email: string;
}

const DraggableTeam: React.FC<{ golfer: UnassignedGolfer }> = ({ golfer }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `golfer-${golfer.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white rounded-xl border border-neutral-200 px-3 py-2.5 hover:border-brand-300 transition-colors"
    >
      <button {...attributes} {...listeners} className="touch-none p-0.5 text-neutral-400 hover:text-neutral-600 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 truncate">
          {golfer.team_name || golfer.name}
        </p>
        {golfer.partner_name && (
          <p className="text-xs text-neutral-500 truncate">{golfer.name} & {golfer.partner_name}</p>
        )}
        <p className="text-xs text-neutral-400 truncate">{golfer.email}</p>
      </div>
    </div>
  );
};

const DroppableGroupZone: React.FC<{
  groupId: number;
  isOver: boolean;
  canDrop: boolean;
}> = ({ groupId, isOver, canDrop }) => {
  const { setNodeRef } = useDroppable({ id: `group-drop-${groupId}` });

  return (
    <div
      ref={setNodeRef}
      className={`
        border-2 border-dashed rounded-xl py-3 text-center text-sm transition-all
        ${isOver && canDrop
          ? 'border-brand-400 bg-brand-50 text-brand-600'
          : 'border-neutral-200 text-neutral-400 hover:border-brand-300 hover:text-brand-500'
        }
      `}
    >
      {isOver && canDrop ? 'Drop to assign' : 'Drag a team here'}
    </div>
  );
};

const DragOverlayContent: React.FC<{ golfer: UnassignedGolfer | null }> = ({ golfer }) => {
  if (!golfer) return null;
  return (
    <div className="flex items-center gap-2 bg-white rounded-xl border-2 border-brand-400 shadow-lg px-4 py-3 max-w-[240px]">
      <GripVertical className="w-4 h-4 text-brand-500" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900 truncate">{golfer.team_name || golfer.name}</p>
        {golfer.partner_name && <p className="text-xs text-neutral-500 truncate">& {golfer.partner_name}</p>}
      </div>
    </div>
  );
};

export const GroupManagementPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const { getToken } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedGolfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<number | null>(null);

  const orgSlug = organization?.slug || 'make-a-wish-guam';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [getToken]);

  const fetchData = useCallback(async (showLoader = true) => {
    if (!orgSlug || !tournamentSlug) return;
    try {
      if (showLoader) setLoading(true);
      const headers = await authHeaders();

      const tRes = await fetch(
        `${API}/api/v1/admin/organizations/${orgSlug}/tournaments/${tournamentSlug}`,
        { headers }
      );
      if (!tRes.ok) throw new Error('Failed to load tournament');
      const tData = await tRes.json();
      const tId = tData.id || tData.tournament?.id;
      setTournamentId(tId);

      const gRes = await fetch(`${API}/api/v1/groups?tournament_id=${tId}`, { headers });
      if (!gRes.ok) throw new Error('Failed to load groups');
      const gData = await gRes.json();
      setGroups(Array.isArray(gData) ? gData : gData.groups || []);

      const golfers = tData.golfers || [];
      const ungrouped = golfers.filter(
        (g: any) => g.registration_status === 'confirmed' && !g.group_id
      );
      setUnassigned(ungrouped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, tournamentSlug, authHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aEmpty = a.golfers.length === 0 ? 0 : 1;
      const bEmpty = b.golfers.length === 0 ? 0 : 1;
      if (aEmpty !== bEmpty) return aEmpty - bEmpty;
      const ha = a.hole_number ?? 999;
      const hb = b.hole_number ?? 999;
      if (ha !== hb) return ha - hb;
      return a.group_number - b.group_number;
    });
  }, [groups]);

  const filteredUnassigned = useMemo(() => {
    if (!searchTerm) return unassigned;
    const term = searchTerm.toLowerCase();
    return unassigned.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (g.partner_name && g.partner_name.toLowerCase().includes(term)) ||
        (g.team_name && g.team_name.toLowerCase().includes(term)) ||
        g.email.toLowerCase().includes(term)
    );
  }, [unassigned, searchTerm]);

  const activeGolfer = useMemo(() => {
    if (!activeId) return null;
    const id = parseInt(activeId.replace('golfer-', ''), 10);
    return unassigned.find((g) => g.id === id) || null;
  }, [activeId, unassigned]);

  const createGroup = async () => {
    if (!tournamentId) return;
    setActionLoading('create');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!res.ok) throw new Error('Failed to create group');
      toast.success('Group created');
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const autoAssign = async () => {
    if (!tournamentId) return;
    setActionLoading('auto');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups/auto_assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!res.ok) throw new Error('Failed to auto-assign');
      const data = await res.json();
      toast.success(data.message || 'Auto-assigned');
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteGroup = async (groupId: number) => {
    setActionLoading(`del-${groupId}`);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups/${groupId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to delete group');
      toast.success('Group deleted');
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const updateGroupHole = async (groupId: number, holeNumber: number | null) => {
    setActionLoading(`hole-${groupId}`);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups/${groupId}/set_hole`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ hole_number: holeNumber }),
      });
      if (!res.ok) throw new Error('Failed to update hole');
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const addGolferToGroup = async (groupId: number, golferId: number) => {
    setActionLoading(`add-${golferId}`);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups/${groupId}/add_golfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ golfer_id: golferId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add golfer');
      }
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const removeGolferFromGroup = async (groupId: number, golferId: number) => {
    setActionLoading(`rm-${golferId}`);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups/${groupId}/remove_golfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ golfer_id: golferId }),
      });
      if (!res.ok) throw new Error('Failed to remove golfer');
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDragStart = (event: any) => setActiveId(event.active.id);

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (over && typeof over.id === 'string' && over.id.startsWith('group-drop-')) {
      const gId = parseInt(over.id.replace('group-drop-', ''), 10);
      setOverGroupId(gId);
    } else {
      setOverGroupId(null);
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveId(null);
    setOverGroupId(null);
    const { active, over } = event;
    if (!over || !active) return;

    if (typeof over.id === 'string' && over.id.startsWith('group-drop-')) {
      const groupId = parseInt(over.id.replace('group-drop-', ''), 10);
      const golferId = parseInt(active.id.replace('golfer-', ''), 10);
      const group = groups.find((g) => g.id === groupId);
      const golfer = unassigned.find((g) => g.id === golferId);
      if (group && golfer) {
        const incomingPlayers = golfer.partner_name ? 2 : 1;
        const currentPlayers = group.player_count ?? group.golfer_count;
        const maxPlayers = group.max_golfers || 2;
        if (currentPlayers + incomingPlayers > maxPlayers) return;

        setUnassigned((prev) => prev.filter((g) => g.id !== golferId));
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId
              ? {
                  ...g,
                  golfers: [...g.golfers, { ...golfer, payment_status: '', checked_in_at: null }],
                  golfer_count: g.golfer_count + 1,
                  player_count: currentPlayers + incomingPlayers,
                  is_full: (currentPlayers + incomingPlayers) >= maxPlayers,
                }
              : g
          )
        );
        addGolferToGroup(groupId, golferId);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <Flag className="w-6 h-6 text-brand-600" />
              Hole Assignment
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {groups.length} groups &middot; {unassigned.length} unassigned teams
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={autoAssign}
              disabled={actionLoading === 'auto' || unassigned.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'auto' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
              Auto-Assign All
            </button>
            <button
              onClick={createGroup}
              disabled={actionLoading === 'create'}
              className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-xl hover:bg-neutral-50 disabled:opacity-50 transition-colors"
            >
              {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Group
            </button>
          </div>
        </div>

        {/* Two-column layout: 1/3 sidebar + 2/3 groups (GIAA pattern) */}
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Left: Unassigned Teams */}
          <div className="lg:col-span-1 lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                <h2 className="text-sm font-semibold text-amber-900">
                  Unassigned Teams ({unassigned.length})
                </h2>
              </div>

              {unassigned.length > 5 && (
                <div className="p-3 border-b border-neutral-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search teams..."
                      className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {unassigned.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-6">All teams assigned</p>
                ) : (
                  <SortableContext
                    items={filteredUnassigned.map((g) => `golfer-${g.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredUnassigned.map((golfer) => (
                      <DraggableTeam key={golfer.id} golfer={golfer} />
                    ))}
                  </SortableContext>
                )}
              </div>
            </div>
          </div>

          {/* Right: Groups — vertical scrollable list (GIAA pattern) */}
          <div className="lg:col-span-2 space-y-3 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto lg:pr-1">
            {groups.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
                <Flag className="w-12 h-12 text-neutral-300 mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold text-neutral-900 mb-1">No groups yet</h3>
                <p className="text-neutral-500 text-sm mb-4">
                  Create groups and assign teams to holes for the shotgun start.
                </p>
                <button
                  onClick={createGroup}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create First Group
                </button>
              </div>
            ) : (
              sortedGroups.map((group) => (
                <div
                  key={group.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                    group.is_full ? 'border-green-300' : 'border-neutral-200'
                  }`}
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between px-4 py-3 lg:px-5 lg:py-4 bg-neutral-50 border-b border-neutral-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                        group.hole_number
                          ? 'bg-brand-600 text-white'
                          : 'bg-amber-100 text-amber-600 border-2 border-dashed border-amber-300'
                      }`}>
                        {group.hole_number ?? group.group_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-neutral-900">
                            {group.hole_position_label && group.hole_position_label !== 'Unassigned'
                              ? `Hole ${group.hole_position_label}`
                              : `Group ${group.group_number}`}
                          </p>
                          {group.is_full && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Complete</span>
                          )}
                          {!group.hole_number && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium border border-amber-200">Needs hole</span>
                          )}
                        </div>
                        <p className="text-sm text-neutral-500">
                          {group.player_count ?? group.golfer_count} / {group.max_golfers || 2} players
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={group.hole_number ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateGroupHole(group.id, val ? parseInt(val, 10) : null);
                        }}
                        className="text-sm border border-neutral-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">No hole</option>
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => (
                          <option key={h} value={h}>Hole {h}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteGroup(group.id)}
                        disabled={actionLoading === `del-${group.id}`}
                        className="p-2 rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete group"
                      >
                        {actionLoading === `del-${group.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Players in Group */}
                  <div className="p-3 lg:p-4 space-y-2">
                    {group.golfers && group.golfers.length > 0 ? (
                      group.golfers.map((golfer) => (
                        <div
                          key={golfer.id}
                          className="bg-neutral-50 rounded-xl px-3 py-2.5 lg:px-4 lg:py-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-neutral-900">{golfer.name}</p>
                              {golfer.partner_name && (
                                <p className="text-sm text-neutral-600">{golfer.partner_name}</p>
                              )}
                            </div>
                            <button
                              onClick={() => removeGolferFromGroup(group.id, golfer.id)}
                              disabled={actionLoading === `rm-${golfer.id}`}
                              className="p-1.5 rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0 disabled:opacity-50 ml-3"
                              title="Remove team from group"
                            >
                              {actionLoading === `rm-${golfer.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-12 text-neutral-400 text-sm italic">
                        No teams assigned
                      </div>
                    )}

                    {!group.is_full && (
                      <DroppableGroupZone
                        groupId={group.id}
                        isOver={overGroupId === group.id}
                        canDrop={!group.is_full}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        <DragOverlayContent golfer={activeGolfer} />
      </DragOverlay>
    </DndContext>
  );
};
