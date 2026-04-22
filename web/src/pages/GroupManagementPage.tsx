import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOrganization } from '../components/OrganizationProvider';
import {
  DndContext,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  DragEndEvent,
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
  Search,
  Shuffle,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  buildGroupedCourses,
  buildPlacementQueueGroups,
  hasValidStartingPosition,
} from './groupManagementUtils';

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

interface TournamentGolfer extends UnassignedGolfer {
  registration_status: string;
  group_id: number | null;
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

type PlacementQueueItem =
  | {
      id: string;
      kind: 'golfer';
      title: string;
      subtitle: string | null;
      meta: string;
      searchText: string;
      golfer: UnassignedGolfer;
    }
  | {
      id: string;
      kind: 'group';
      title: string;
      subtitle: string | null;
      meta: string;
      searchText: string;
      group: Group;
    };

const DEFAULT_COURSE_CONFIGS: CourseConfig[] = [
  { key: 'course-1', name: 'Course', hole_count: 18 },
];

const groupDropId = (groupId: number) => `group-drop-${groupId}`;
const holeDropId = (courseKey: string, holeNumber: number) => `hole-drop-${courseKey}-${holeNumber}`;

const parseGroupId = (value: string, prefix: 'group-' | 'group-drop-' | 'golfer-') => {
  if (!value.startsWith(prefix)) return null;
  const parsed = parseInt(value.slice(prefix.length), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseHoleDropId = (value: string) => {
  if (!value.startsWith('hole-drop-')) return null;

  const parts = value.split('-');
  const holeNumber = parseInt(parts[parts.length - 1], 10);
  if (Number.isNaN(holeNumber)) return null;

  return {
    courseKey: parts.slice(2, -1).join('-'),
    holeNumber,
  };
};

const teamTitle = (golfer: Pick<UnassignedGolfer, 'team_name' | 'name'>) => golfer.team_name || golfer.name;

const teamSubtitle = (golfer: Pick<UnassignedGolfer, 'name' | 'partner_name'>) =>
  golfer.partner_name ? `${golfer.name} & ${golfer.partner_name}` : null;

const groupQueueTitle = (group: Group) => {
  const primaryGolfer = group.golfers[0];
  if (!primaryGolfer) return `Group ${group.group_number}`;
  if (primaryGolfer.team_name) return primaryGolfer.team_name;
  if (group.golfers.length === 1) return primaryGolfer.name;
  return `Group ${group.group_number}`;
};

const groupQueueSubtitle = (group: Group) => {
  if (group.golfers.length === 0) return null;
  if (group.golfers.length === 1) return teamSubtitle(group.golfers[0]);
  return group.golfers.map((golfer) => golfer.name).join(', ');
};

const DraggablePlacementCard: React.FC<{ item: PlacementQueueItem }> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
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
        aria-label={`Drag ${item.title}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-neutral-900">{item.title}</p>
          {item.kind === 'group' && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-700">
              Ready
            </span>
          )}
        </div>
        {item.subtitle && <p className="truncate text-xs text-neutral-500">{item.subtitle}</p>}
        <p className="truncate text-xs text-neutral-400">{item.meta}</p>
      </div>
    </div>
  );
};

const DroppableGroupZone: React.FC<{
  groupId: number;
  isOver: boolean;
  canDrop: boolean;
}> = ({ groupId, isOver, canDrop }) => {
  const { setNodeRef } = useDroppable({ id: groupDropId(groupId) });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed py-3 text-center text-sm transition-all ${
        isOver && canDrop
          ? 'border-brand-400 bg-brand-50 text-brand-600'
          : 'border-neutral-200 text-neutral-400 hover:border-brand-300 hover:text-brand-500'
      }`}
    >
      {isOver && canDrop ? 'Drop to pair here' : 'Drop a team into this slot'}
    </div>
  );
};

const DroppableHoleZone: React.FC<{
  courseKey: string;
  holeNumber: number;
  isOver: boolean;
  compact?: boolean;
}> = ({ courseKey, holeNumber, isOver, compact = false }) => {
  const { setNodeRef } = useDroppable({ id: holeDropId(courseKey, holeNumber) });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border-2 border-dashed text-center text-sm transition-all ${
        compact ? 'px-4 py-3' : 'px-4 py-6'
      } ${
        isOver
          ? 'border-brand-400 bg-brand-50 text-brand-600'
          : 'border-neutral-200 bg-neutral-50 text-neutral-400 hover:border-brand-300 hover:text-brand-500'
      }`}
    >
      {isOver ? 'Drop to place on this hole' : 'Drag a team here'}
    </div>
  );
};

const DragOverlayContent: React.FC<{ item: PlacementQueueItem | null }> = ({ item }) => {
  if (!item) return null;

  return (
    <div className="flex max-w-[260px] items-center gap-2 rounded-xl border-2 border-brand-400 bg-white px-4 py-3 shadow-lg">
      <GripVertical className="h-4 w-4 text-brand-500" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-neutral-900">{item.title}</p>
        {item.subtitle && <p className="truncate text-xs text-neutral-500">{item.subtitle}</p>}
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
  const [overId, setOverId] = useState<string | null>(null);

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

      const golfers: TournamentGolfer[] = tournamentPayload.golfers || [];
      setUnassigned(
        golfers.filter((golfer) => golfer.registration_status === 'confirmed' && !golfer.group_id)
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

  const stagedGroups = useMemo(
    () => buildPlacementQueueGroups(groups, courseMap),
    [courseMap, groups]
  );

  const activePlacementItem = useMemo(() => {
    if (!activeId) return null;

    const golferId = parseGroupId(activeId, 'golfer-');
    if (golferId) {
      const golfer = unassigned.find((entry) => entry.id === golferId);
      if (!golfer) return null;
      return {
        id: `golfer-${golfer.id}`,
        kind: 'golfer' as const,
        title: teamTitle(golfer),
        subtitle: teamSubtitle(golfer),
        meta: golfer.email,
        searchText: '',
        golfer,
      };
    }

    const groupId = parseGroupId(activeId, 'group-');
    if (groupId) {
      const group = stagedGroups.find((entry) => entry.id === groupId);
      if (!group) return null;
      return {
        id: `group-${group.id}`,
        kind: 'group' as const,
        title: groupQueueTitle(group),
        subtitle: groupQueueSubtitle(group),
        meta: `${group.player_count ?? group.golfer_count} / ${group.max_golfers || 2} players`,
        searchText: '',
        group,
      };
    }

    return null;
  }, [activeId, stagedGroups, unassigned]);

  const placementQueueItems = useMemo(() => {
    const stagedItems: PlacementQueueItem[] = stagedGroups.map((group) => ({
      id: `group-${group.id}`,
      kind: 'group',
      title: groupQueueTitle(group),
      subtitle: groupQueueSubtitle(group),
      meta: `${group.player_count ?? group.golfer_count} / ${group.max_golfers || 2} players waiting for a hole`,
      searchText: [
        groupQueueTitle(group),
        groupQueueSubtitle(group),
        ...group.golfers.map((golfer) => `${golfer.name} ${golfer.email} ${golfer.partner_name || ''} ${golfer.team_name || ''}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      group,
    }));

    const golferItems: PlacementQueueItem[] = unassigned.map((golfer) => ({
      id: `golfer-${golfer.id}`,
      kind: 'golfer',
      title: teamTitle(golfer),
      subtitle: teamSubtitle(golfer),
      meta: golfer.email,
      searchText: [golfer.name, golfer.partner_name, golfer.team_name, golfer.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
      golfer,
    }));

    const allItems = [...stagedItems, ...golferItems];
    if (!searchTerm) return allItems;

    const term = searchTerm.toLowerCase();
    return allItems.filter((item) => item.searchText.includes(term));
  }, [searchTerm, stagedGroups, unassigned]);

  const totalPlacementQueueCount = stagedGroups.length + unassigned.length;

  const groupedCourses = useMemo(
    () => buildGroupedCourses(courseConfigs, groups),
    [courseConfigs, groups]
  );

  const assignedGroupsCount = useMemo(
    () => groups.filter((group) => hasValidStartingPosition(group, courseMap)).length,
    [courseMap, groups]
  );

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
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.errors?.[0] || 'Failed to add golfer');
      }
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
      fetchData(false);
    } finally {
      setActionLoading(null);
    }
  };

  const assignGolferToHole = async (golferId: number, courseKey: string, holeNumber: number) => {
    if (!tournamentId) return;

    setActionLoading(`place-${golferId}`);

    let createdGroupId: number | null = null;

    try {
      const headers = await authHeaders();
      const createRes = await fetch(`${API}/api/v1/groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tournament_id: tournamentId,
          starting_course_key: courseKey,
          hole_number: holeNumber,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        throw new Error(data.errors?.[0] || 'Failed to create starting slot');
      }

      const createdGroup: Group = await createRes.json();
      createdGroupId = createdGroup.id;

      const addRes = await fetch(`${API}/api/v1/groups/${createdGroupId}/add_golfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ golfer_id: golferId }),
      });

      if (!addRes.ok) {
        const data = await addRes.json().catch(() => ({}));
        throw new Error(data.error || data.errors?.[0] || 'Failed to place team');
      }

      fetchData(false);
    } catch (err) {
      if (createdGroupId) {
        try {
          const headers = await authHeaders();
          await fetch(`${API}/api/v1/groups/${createdGroupId}`, {
            method: 'DELETE',
            headers,
          });
        } catch {
          // Best effort cleanup for an empty slot created before add_golfer failed.
        }
      }

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.errors?.[0] || 'Failed to remove golfer');
      }
      fetchData(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (typeof event.active?.id === 'string') {
      setActiveId(event.active.id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(typeof event.over?.id === 'string' ? event.over.id : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);

    const active = typeof event.active?.id === 'string' ? event.active.id : null;
    const over = typeof event.over?.id === 'string' ? event.over.id : null;
    if (!active || !over) return;

    if (over.startsWith('group-drop-') && active.startsWith('golfer-')) {
      const groupId = parseGroupId(over, 'group-drop-');
      const golferId = parseGroupId(active, 'golfer-');
      if (!groupId || !golferId) return;

      const group = groups.find((entry) => entry.id === groupId);
      const golfer = unassigned.find((entry) => entry.id === golferId);
      if (!group || !golfer) return;

      const incomingPlayers = golfer.partner_name ? 2 : 1;
      const currentPlayers = group.player_count ?? group.golfer_count;
      const maxPlayers = group.max_golfers || 2;
      if (currentPlayers + incomingPlayers > maxPlayers) {
        toast.error('That slot is already full');
        return;
      }

      addGolferToGroup(groupId, golferId);
      return;
    }

    if (!over.startsWith('hole-drop-')) return;

    const target = parseHoleDropId(over);
    if (!target) return;

    if (active.startsWith('golfer-')) {
      const golferId = parseGroupId(active, 'golfer-');
      if (golferId) assignGolferToHole(golferId, target.courseKey, target.holeNumber);
      return;
    }

    if (active.startsWith('group-')) {
      const groupId = parseGroupId(active, 'group-');
      if (groupId) updateGroupStart(groupId, target.courseKey, target.holeNumber);
    }
  };

  const handleCourseChange = (group: Group, nextCourseKey: string) => {
    if (!nextCourseKey) {
      updateGroupStart(group.id, null, null);
      return;
    }

    const course = courseMap.get(nextCourseKey);
    if (!course) return;

    const nextHole =
      group.starting_course_key === nextCourseKey && group.hole_number && group.hole_number <= course.hole_count
        ? group.hole_number
        : 1;

    updateGroupStart(group.id, nextCourseKey, nextHole);
  };

  const renderGroupCard = (group: Group) => {
    const selectedCourse = group.starting_course_key ? courseMap.get(group.starting_course_key) : null;
    const label =
      group.starting_position_label && group.starting_position_label !== 'Unassigned'
        ? group.starting_position_label
        : groupQueueTitle(group);

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
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {group.player_count ?? group.golfer_count} / {group.max_golfers || 2} players
                {group.starting_hole_description ? ` · ${group.starting_hole_description}` : ''}
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
              value={group.starting_course_key ?? ''}
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
              value={group.hole_number ?? ''}
              onChange={(event) =>
                updateGroupStart(
                  group.id,
                  group.starting_course_key,
                  event.target.value ? parseInt(event.target.value, 10) : null
                )
              }
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
              isOver={overId === groupDropId(group.id) && activeId?.startsWith('golfer-') === true}
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
              {totalPlacementQueueCount} teams awaiting placement · {assignedGroupsCount} placed starts · {courseConfigs.length} configured course{courseConfigs.length !== 1 ? 's' : ''}
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
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
                <h2 className="text-sm font-semibold text-amber-900">
                  Teams Awaiting Placement ({totalPlacementQueueCount})
                </h2>
                <p className="mt-1 text-xs text-amber-800">
                  Drag teams straight onto a course and hole. Existing grouped teams stay here until they get a valid start.
                </p>
              </div>

              {totalPlacementQueueCount > 5 && (
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
                {totalPlacementQueueCount === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">All teams placed on a starting hole</p>
                ) : placementQueueItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-neutral-400">No teams match this search</p>
                ) : (
                  <SortableContext
                    items={placementQueueItems.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {placementQueueItems.map((item) => (
                      <DraggablePlacementCard key={item.id} item={item} />
                    ))}
                  </SortableContext>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5 lg:col-span-2">
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
                  {course.holes.map((hole) => {
                    const currentHoleDropId = holeDropId(course.key, hole.holeNumber);
                    const isHoleOver = overId === currentHoleDropId;

                    return (
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
                            <>
                              {hole.groups.map(renderGroupCard)}
                              <DroppableHoleZone
                                courseKey={course.key}
                                holeNumber={hole.holeNumber}
                                isOver={isHoleOver}
                                compact
                              />
                            </>
                          ) : (
                            <DroppableHoleZone
                              courseKey={course.key}
                              holeNumber={hole.holeNumber}
                              isOver={isHoleOver}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        <DragOverlayContent item={activePlacementItem} />
      </DragOverlay>
    </DndContext>
  );
};
