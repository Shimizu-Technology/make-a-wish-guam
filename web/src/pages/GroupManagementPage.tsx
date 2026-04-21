import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOrganization } from '../components/OrganizationProvider';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Building2,
  Flag,
  GripVertical,
  Loader2,
  Plus,
  Search,
  Shuffle,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

interface CourseConfig {
  key: string;
  name: string;
  hole_count: number;
}

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
  starting_course_key: string | null;
  starting_course_name: string | null;
  hole_number: number | null;
  golfer_count: number;
  player_count: number;
  max_golfers: number;
  is_full: boolean;
  starting_position_label: string | null;
  hole_position_label: string | null;
  starting_hole_description: string | null;
  golfers: GroupGolfer[];
}

interface UnassignedGolfer {
  id: number;
  name: string;
  partner_name: string | null;
  team_name: string | null;
  email: string;
}

interface AutoAssignResponse {
  message: string;
  assigned_count: number;
  failed_count: number;
  failures: Array<{
    golfer_id: number;
    name: string | null;
    errors: string[];
  }>;
}

const DEFAULT_COURSE_CONFIGS: CourseConfig[] = [
  { key: 'course-1', name: 'Course', hole_count: 18 },
];

const DraggableTeam: React.FC<{ golfer: UnassignedGolfer }> = ({ golfer }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `golfer-${golfer.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 transition-colors hover:border-brand-300"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab p-0.5 text-neutral-400 active:cursor-grabbing hover:text-neutral-600"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-900">{golfer.team_name || golfer.name}</p>
        {golfer.partner_name && (
          <p className="truncate text-xs text-neutral-500">
            {golfer.name} &amp; {golfer.partner_name}
          </p>
        )}
        <p className="truncate text-xs text-neutral-400">{golfer.email}</p>
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
      className={`rounded-xl border-2 border-dashed py-3 text-center text-sm transition-all ${
        isOver && canDrop
          ? 'border-brand-400 bg-brand-50 text-brand-600'
          : 'border-neutral-200 text-neutral-400 hover:border-brand-300 hover:text-brand-500'
      }`}
    >
      {isOver && canDrop ? 'Drop to assign' : 'Drag a team here'}
    </div>
  );
};

const DragOverlayContent: React.FC<{ golfer: UnassignedGolfer | null }> = ({ golfer }) => {
  if (!golfer) return null;

  return (
    <div className="flex max-w-[240px] items-center gap-2 rounded-xl border-2 border-brand-400 bg-white px-4 py-3 shadow-lg">
      <GripVertical className="h-4 w-4 text-brand-500" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-900">{golfer.team_name || golfer.name}</p>
        {golfer.partner_name && <p className="truncate text-xs text-neutral-500">&amp; {golfer.partner_name}</p>}
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
  const [courseConfigs, setCourseConfigs] = useState<CourseConfig[]>(DEFAULT_COURSE_CONFIGS);
  const [loading, setLoading] = useState(true);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<number | null>(null);
  const [draftStarts, setDraftStarts] = useState<Record<number, { startingCourseKey: string; holeNumber: number | null }>>({});

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
      const tournamentPayload = await tRes.json();
      const tournament = tournamentPayload.tournament || tournamentPayload;
      const tId = tournament.id;

      setTournamentId(tId);
      setCourseConfigs(
        tournament.course_configs?.length ? tournament.course_configs : DEFAULT_COURSE_CONFIGS
      );

      const gRes = await fetch(`${API}/api/v1/groups?tournament_id=${tId}`, { headers });
      if (!gRes.ok) throw new Error('Failed to load groups');
      const groupPayload = await gRes.json();
      setGroups(Array.isArray(groupPayload) ? groupPayload : groupPayload.groups || []);

      const golfers = tournamentPayload.golfers || [];
      setUnassigned(
        golfers.filter((golfer: any) => golfer.registration_status === 'confirmed' && !golfer.group_id)
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, orgSlug, tournamentSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const courseMap = useMemo(
    () => new Map(courseConfigs.map((course) => [course.key, course])),
    [courseConfigs]
  );

  const activeGolfer = useMemo(() => {
    if (!activeId) return null;
    const id = parseInt(activeId.replace('golfer-', ''), 10);
    return unassigned.find((golfer) => golfer.id === id) || null;
  }, [activeId, unassigned]);

  const filteredUnassigned = useMemo(() => {
    if (!searchTerm) return unassigned;
    const term = searchTerm.toLowerCase();
    return unassigned.filter(
      (golfer) =>
        golfer.name.toLowerCase().includes(term) ||
        golfer.email.toLowerCase().includes(term) ||
        (golfer.partner_name && golfer.partner_name.toLowerCase().includes(term)) ||
        (golfer.team_name && golfer.team_name.toLowerCase().includes(term))
    );
  }, [searchTerm, unassigned]);

  const sortedUnassignedGroups = useMemo(() => {
    return groups
      .filter((group) => !group.starting_course_key || !group.hole_number || !courseMap.has(group.starting_course_key))
      .sort((a, b) => a.group_number - b.group_number);
  }, [courseMap, groups]);

  const assignableGroups = useMemo(
    () =>
      sortedUnassignedGroups.map((group) => ({
        id: group.id,
        label: `Group ${group.group_number}`,
        detail: `${group.player_count ?? group.golfer_count} / ${group.max_golfers || 2} players`,
      })),
    [sortedUnassignedGroups]
  );

  const groupedCourses = useMemo(() => {
    return courseConfigs.map((course) => ({
      ...course,
      holes: Array.from({ length: course.hole_count }, (_, index) => {
        const holeNumber = index + 1;
        const holeGroups = groups
          .filter(
            (group) =>
              group.starting_course_key === course.key &&
              group.hole_number === holeNumber
          )
          .sort((a, b) => a.group_number - b.group_number);

        return {
          holeNumber,
          groups: holeGroups,
        };
      }),
    }));
  }, [courseConfigs, groups]);

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
      const data: AutoAssignResponse = await res.json();
      if (data.failed_count > 0) {
        toast.error(data.message || 'Some golfers could not be auto-assigned');
      } else {
        toast.success(data.message || 'Auto-assigned');
      }
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const deleteGroup = async (groupId: number) => {
    setActionLoading(`delete-${groupId}`);

    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups/${groupId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('Failed to delete group');
      toast.success('Group deleted');
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const updateGroupStart = async (
    groupId: number,
    startingCourseKey: string | null,
    holeNumber: number | null
  ) => {
    setActionLoading(`start-${groupId}`);

    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/api/v1/groups/${groupId}/set_hole`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          starting_course_key: startingCourseKey,
          hole_number: holeNumber,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update starting position');
      }

      setDraftStarts((prev) => {
        if (!(groupId in prev)) return prev;
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
      fetchData(false);
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
      fetchData(false);
    } finally {
      setActionLoading(null);
    }
  };

  const removeGolferFromGroup = async (groupId: number, golferId: number) => {
    setActionLoading(`remove-${golferId}`);

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

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (over && typeof over.id === 'string' && over.id.startsWith('group-drop-')) {
      setOverGroupId(parseInt(over.id.replace('group-drop-', ''), 10));
    } else {
      setOverGroupId(null);
    }
  };

  const handleDragEnd = (event: any) => {
    setActiveId(null);
    setOverGroupId(null);

    const { active, over } = event;
    if (!over || !active || typeof over.id !== 'string' || !over.id.startsWith('group-drop-')) {
      return;
    }

    const groupId = parseInt(over.id.replace('group-drop-', ''), 10);
    const golferId = parseInt(active.id.replace('golfer-', ''), 10);
    const group = groups.find((entry) => entry.id === groupId);
    const golfer = unassigned.find((entry) => entry.id === golferId);

    if (!group || !golfer) return;

    const incomingPlayers = golfer.partner_name ? 2 : 1;
    const currentPlayers = group.player_count ?? group.golfer_count;
    const maxPlayers = group.max_golfers || 2;
    if (currentPlayers + incomingPlayers > maxPlayers) return;

    setUnassigned((prev) => prev.filter((entry) => entry.id !== golferId));
    setGroups((prev) =>
      prev.map((entry) =>
        entry.id === groupId
          ? {
              ...entry,
              golfers: [...entry.golfers, { ...golfer, payment_status: '', checked_in_at: null }],
              golfer_count: entry.golfer_count + 1,
              player_count: currentPlayers + incomingPlayers,
              is_full: currentPlayers + incomingPlayers >= maxPlayers,
            }
          : entry
      )
    );

    addGolferToGroup(groupId, golferId);
  };

  const handleCourseChange = (group: Group, nextCourseKey: string) => {
    const isAwaitingStart =
      !group.starting_course_key || !group.hole_number || !courseMap.has(group.starting_course_key);

    if (!nextCourseKey) {
      if (isAwaitingStart) {
        setDraftStarts((prev) => {
          const next = { ...prev };
          delete next[group.id];
          return next;
        });
      } else {
        updateGroupStart(group.id, null, null);
      }
      return;
    }

    const course = courseMap.get(nextCourseKey);
    if (!course) return;

    if (isAwaitingStart) {
      setDraftStarts((prev) => ({
        ...prev,
        [group.id]: {
          startingCourseKey: nextCourseKey,
          holeNumber: null,
        },
      }));
      return;
    }

    const nextHole =
      group.starting_course_key === nextCourseKey && group.hole_number && group.hole_number <= course.hole_count
        ? group.hole_number
        : 1;

    updateGroupStart(group.id, nextCourseKey, nextHole);
  };

  const assignGroupToHole = (groupId: number, courseKey: string, holeNumber: number) => {
    updateGroupStart(groupId, courseKey, holeNumber);
  };

  const renderGroupCard = (group: Group) => {
    const isAwaitingStart =
      !group.starting_course_key || !group.hole_number || !courseMap.has(group.starting_course_key);
    const draftStart = draftStarts[group.id];
    const selectedCourseKey = isAwaitingStart
      ? draftStart?.startingCourseKey ?? group.starting_course_key ?? ''
      : group.starting_course_key ?? '';
    const selectedHoleNumber = isAwaitingStart
      ? draftStart?.holeNumber ?? group.hole_number
      : group.hole_number;
    const selectedCourse = selectedCourseKey ? courseMap.get(selectedCourseKey) : null;
    const label =
      group.starting_position_label && group.starting_position_label !== 'Unassigned'
        ? group.starting_position_label
        : `Group ${group.group_number}`;

    return (
      <div
        key={group.id}
        className={`overflow-hidden rounded-2xl border bg-white transition-all ${
          group.is_full ? 'border-green-300' : 'border-neutral-200'
        }`}
      >
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-900 sm:text-base">{label}</p>
                {group.is_full && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 sm:text-xs">
                    Complete
                  </span>
                )}
                {isAwaitingStart && !selectedCourseKey && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 sm:text-xs">
                    Needs start
                  </span>
                )}
                {isAwaitingStart && selectedCourseKey && !selectedHoleNumber && (
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 sm:text-xs">
                    Pick a hole
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {group.player_count ?? group.golfer_count} / {group.max_golfers || 2} players
                {group.starting_hole_description ? ` · ${group.starting_hole_description}` : ''}
                {isAwaitingStart && selectedCourse && !selectedHoleNumber ? ` · ${selectedCourse.name} selected` : ''}
              </p>
            </div>
            <button
              onClick={() => deleteGroup(group.id)}
              disabled={actionLoading === `delete-${group.id}`}
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              title="Delete group"
            >
              {actionLoading === `delete-${group.id}` ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
            <select
              value={selectedCourseKey}
              onChange={(event) => handleCourseChange(group, event.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:ring-2 focus:ring-brand-500"
            >
              <option value="">No course</option>
              {courseConfigs.map((course) => (
                <option key={course.key} value={course.key}>
                  {course.name}
                </option>
              ))}
            </select>
            <select
              value={selectedHoleNumber ?? ''}
              onChange={(event) => {
                const nextHole = event.target.value ? parseInt(event.target.value, 10) : null;

                if (isAwaitingStart) {
                  if (!selectedCourseKey) return;
                  if (!nextHole) {
                    setDraftStarts((prev) => ({
                      ...prev,
                      [group.id]: {
                        startingCourseKey: selectedCourseKey,
                        holeNumber: null,
                      },
                    }));
                    return;
                  }

                  updateGroupStart(group.id, selectedCourseKey, nextHole);
                  return;
                }

                updateGroupStart(group.id, group.starting_course_key, nextHole);
              }}
              disabled={!selectedCourse}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              <option value="">{selectedCourse ? 'Select hole' : 'Select course'}</option>
              {selectedCourse &&
                Array.from({ length: selectedCourse.hole_count }, (_, index) => index + 1).map((hole) => (
                  <option key={hole} value={hole}>
                    Hole {hole}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 p-3 lg:p-4">
          {group.golfers.length > 0 ? (
            group.golfers.map((golfer) => (
              <div key={golfer.id} className="rounded-xl bg-neutral-50 px-3 py-2.5 lg:px-4 lg:py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{golfer.name}</p>
                    {golfer.partner_name && <p className="text-sm text-neutral-600">{golfer.partner_name}</p>}
                  </div>
                  <button
                    onClick={() => removeGolferFromGroup(group.id, golfer.id)}
                    disabled={actionLoading === `remove-${golfer.id}`}
                    className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Remove team from group"
                  >
                    {actionLoading === `remove-${golfer.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex h-12 items-center justify-center text-sm italic text-neutral-400">
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
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-neutral-900">
              <Flag className="h-6 w-6 text-brand-600" />
              Starting Positions
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {groups.length} groups · {unassigned.length} unassigned teams · {courseConfigs.length} configured course{courseConfigs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={autoAssign}
              disabled={actionLoading === 'auto' || unassigned.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {actionLoading === 'auto' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
              Auto-Assign All
            </button>
            <button
              onClick={createGroup}
              disabled={actionLoading === 'create'}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              {actionLoading === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Group
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
                <h2 className="text-sm font-semibold text-amber-900">
                  Unassigned Teams ({unassigned.length})
                </h2>
              </div>

              {unassigned.length > 5 && (
                <div className="border-b border-neutral-100 p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search teams..."
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="max-h-60 space-y-2 overflow-y-auto p-3 lg:max-h-[calc(100vh-280px)]">
                {unassigned.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">All teams assigned</p>
                ) : (
                  <SortableContext
                    items={filteredUnassigned.map((golfer) => `golfer-${golfer.id}`)}
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

          <div className="space-y-5 lg:col-span-2">
            {groups.length === 0 ? (
              <div className="rounded-2xl border border-neutral-200 bg-white py-16 text-center">
                <Flag className="mx-auto mb-4 h-12 w-12 text-neutral-300" strokeWidth={1.5} />
                <h3 className="mb-1 text-lg font-semibold text-neutral-900">No groups yet</h3>
                <p className="mb-4 text-sm text-neutral-500">
                  Create groups and assign teams into course-based starting positions.
                </p>
                <button
                  onClick={createGroup}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Create First Group
                </button>
              </div>
            ) : (
              <>
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-amber-500" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      Groups Needing a Start
                    </h2>
                  </div>
                  <p className="text-sm text-neutral-500">
                    Build the team here first. Choosing a course will stay local until you pick a hole, so the card will not jump away mid-edit.
                  </p>
                  {sortedUnassignedGroups.length > 0 ? (
                    <div className="space-y-3">
                      {sortedUnassignedGroups.map(renderGroupCard)}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-400">
                      All groups have a configured starting position.
                    </div>
                  )}
                </section>

                {groupedCourses.map((course) => (
                  <section key={course.key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-brand-50 p-2 text-brand-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-neutral-900">{course.name}</h2>
                        <p className="text-sm text-neutral-500">{course.hole_count} starting hole{course.hole_count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-2">
                      {course.holes.map((hole) => (
                        <div key={`${course.key}-${hole.holeNumber}`} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-neutral-900">Hole {hole.holeNumber}</p>
                                <p className="text-xs text-neutral-500">
                                  {hole.groups.length} group{hole.groups.length !== 1 ? 's' : ''} assigned
                                </p>
                              </div>
                              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-600">
                                {course.name}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3 p-3">
                            {hole.groups.length > 0 ? (
                              hole.groups.map(renderGroupCard)
                            ) : (
                              <div className="space-y-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4">
                                <div className="text-center text-sm text-neutral-400">
                                  No groups assigned to this starting hole yet.
                                </div>
                                <select
                                  defaultValue=""
                                  onChange={(event) => {
                                    const groupId = event.target.value ? parseInt(event.target.value, 10) : null;
                                    if (!groupId) return;
                                    assignGroupToHole(groupId, course.key, hole.holeNumber);
                                    event.currentTarget.value = '';
                                  }}
                                  disabled={assignableGroups.length === 0}
                                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-100"
                                >
                                  <option value="">
                                    {assignableGroups.length === 0 ? 'No unassigned groups available' : 'Assign existing group...'}
                                  </option>
                                  {assignableGroups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                      {group.label} - {group.detail}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </>
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
