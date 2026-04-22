import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useOrganization } from '../components/OrganizationProvider';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
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
  ChevronDown,
  ChevronUp,
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
  buildStartingHoleDescription,
  buildStartingPositionLabel,
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

const parseItemId = (value: string, prefix: 'group-' | 'group-drop-' | 'golfer-') => {
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

const queueOptionLabel = (item: PlacementQueueItem) =>
  item.kind === 'group' ? `${item.title} (${item.meta})` : item.title;

const golferToGroupGolfer = (golfer: UnassignedGolfer): GroupGolfer => ({
  ...golfer,
  payment_status: '',
  checked_in_at: null,
});

const groupGolferToUnassigned = (golfer: GroupGolfer): UnassignedGolfer => ({
  id: golfer.id,
  name: golfer.name,
  partner_name: golfer.partner_name,
  team_name: golfer.team_name,
  email: golfer.email,
});

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

const HolePlacementPicker: React.FC<{
  items: PlacementQueueItem[];
  disabled?: boolean;
  onSelect: (itemId: string) => void;
}> = ({ items, disabled = false, onSelect }) => (
  <select
    defaultValue=""
    onChange={(event) => {
      const nextItemId = event.target.value;
      if (!nextItemId) return;
      onSelect(nextItemId);
      event.currentTarget.value = '';
    }}
    disabled={disabled || items.length === 0}
    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-100"
  >
    <option value="">
      {items.length === 0 ? 'No teams awaiting placement' : 'Assign awaiting team...'}
    </option>
    {items.map((item) => (
      <option key={item.id} value={item.id}>
        {queueOptionLabel(item)}
      </option>
    ))}
  </select>
);

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
  const [collapsedCourseKeys, setCollapsedCourseKeys] = useState<string[]>([]);

  const orgSlug = organization?.slug || 'make-a-wish-guam';
  const multiCourseSetup = courseConfigs.length > 1;

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

      const tournamentResponse = await fetch(
        `${API}/api/v1/admin/organizations/${orgSlug}/tournaments/${tournamentSlug}`,
        { headers }
      );
      if (!tournamentResponse.ok) throw new Error('Failed to load tournament');

      const tournamentPayload = await tournamentResponse.json();
      const tournament = tournamentPayload.tournament || tournamentPayload;
      const nextTournamentId = tournament.id;

      setTournamentId(nextTournamentId);
      setCourseConfigs(
        tournament.course_configs?.length ? tournament.course_configs : DEFAULT_COURSE_CONFIGS
      );

      const groupsResponse = await fetch(`${API}/api/v1/groups?tournament_id=${nextTournamentId}`, { headers });
      if (!groupsResponse.ok) throw new Error('Failed to load groups');

      const groupPayload = await groupsResponse.json();
      setGroups(Array.isArray(groupPayload) ? groupPayload : groupPayload.groups || []);

      const golfers: TournamentGolfer[] = tournamentPayload.golfers || [];
      setUnassigned(
        golfers.filter((golfer) => golfer.registration_status === 'confirmed' && !golfer.group_id)
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, orgSlug, tournamentSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCollapsedCourseKeys((previousKeys) => {
      const validKeys = courseConfigs.map((course) => course.key);
      const retainedKeys = previousKeys.filter((key) => validKeys.includes(key));

      if (previousKeys.length === 0 && validKeys.length > 1) {
        return validKeys.slice(1);
      }

      return retainedKeys;
    });
  }, [courseConfigs]);

  const courseMap = useMemo(
    () => new Map(courseConfigs.map((course) => [course.key, course])),
    [courseConfigs]
  );

  const stagedGroups = useMemo(
    () => buildPlacementQueueGroups(groups, courseMap),
    [courseMap, groups]
  );

  const allPlacementQueueItems = useMemo(() => {
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

    return [...stagedItems, ...golferItems];
  }, [stagedGroups, unassigned]);

  const placementQueueItems = useMemo(() => {
    if (!searchTerm) return allPlacementQueueItems;

    const term = searchTerm.toLowerCase();
    return allPlacementQueueItems.filter((item) => item.searchText.includes(term));
  }, [allPlacementQueueItems, searchTerm]);

  const activePlacementItem = useMemo(
    () => allPlacementQueueItems.find((item) => item.id === activeId) || null,
    [activeId, allPlacementQueueItems]
  );

  const groupedCourses = useMemo(
    () => buildGroupedCourses(courseConfigs, groups),
    [courseConfigs, groups]
  );

  const totalPlacementQueueCount = allPlacementQueueItems.length;

  const assignedGroupsCount = useMemo(
    () => groups.filter((group) => group.golfers.length > 0 && hasValidStartingPosition(group, courseMap)).length,
    [courseMap, groups]
  );

  const replaceGroupLocally = useCallback((nextGroup: Group, options?: { tempGroupId?: number }) => {
    setGroups((previousGroups) => {
      const tempGroupId = options?.tempGroupId;
      const nextGroups = previousGroups.map((group) => {
        if (tempGroupId != null && group.id === tempGroupId) return nextGroup;
        if (group.id === nextGroup.id) return nextGroup;
        return group;
      });

      if (!nextGroups.some((group) => group.id === nextGroup.id)) {
        nextGroups.push(nextGroup);
      }

      return nextGroups.sort((a, b) => a.group_number - b.group_number);
    });
  }, []);

  const applyGroupStartLocally = useCallback((groupId: number, courseKey: string | null, holeNumber: number | null) => {
    setGroups((previousGroups) =>
      previousGroups.map((group) => {
        if (group.id !== groupId) return group;
        const courseName = courseKey ? courseMap.get(courseKey)?.name ?? null : null;
        return {
          ...group,
          starting_course_key: courseKey,
          starting_course_name: courseName,
          hole_number: holeNumber,
        };
      })
    );
  }, [courseMap]);

  const updateGroupStart = useCallback(async (
    groupId: number,
    startingCourseKey: string | null,
    holeNumber: number | null
  ) => {
    setActionLoading(`start-${groupId}`);

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API}/api/v1/groups/${groupId}/set_hole`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          starting_course_key: startingCourseKey,
          hole_number: holeNumber,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update starting position');
      }

      const payload = await response.json();
      if (payload?.removed_group_id) {
        setGroups((previousGroups) => previousGroups.filter((group) => group.id !== payload.removed_group_id));
        return;
      }

      replaceGroupLocally(payload as Group);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed');
      fetchData(false);
    } finally {
      setActionLoading(null);
    }
  }, [authHeaders, fetchData, replaceGroupLocally]);

  const autoAssign = async () => {
    if (!tournamentId) return;
    setActionLoading('auto');

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API}/api/v1/groups/auto_assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tournament_id: tournamentId }),
      });
      if (!response.ok) throw new Error('Failed to auto-assign');

      const data: AutoAssignResponse = await response.json();
      if (data.failed_count > 0) {
        toast.error(data.message || 'Some golfers could not be auto-assigned');
      } else {
        toast.success(data.message || 'Auto-assigned');
      }
      fetchData(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const addGolferToGroup = useCallback(async (groupId: number, golfer: UnassignedGolfer) => {
    setActionLoading(`add-${golfer.id}`);

    const incomingPlayers = golfer.partner_name ? 2 : 1;
    setUnassigned((previousGolfers) => previousGolfers.filter((entry) => entry.id !== golfer.id));
    setGroups((previousGroups) =>
      previousGroups.map((group) => {
        if (group.id !== groupId) return group;

        const currentPlayers = group.player_count ?? group.golfer_count;
        const maxGolfers = group.max_golfers || 2;
        return {
          ...group,
          golfers: [...group.golfers, golferToGroupGolfer(golfer)],
          golfer_count: group.golfer_count + 1,
          player_count: currentPlayers + incomingPlayers,
          is_full: currentPlayers + incomingPlayers >= maxGolfers,
        };
      })
    );

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API}/api/v1/groups/${groupId}/add_golfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ golfer_id: golfer.id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.errors?.[0] || 'Failed to add golfer');
      }

      const updatedGroup: Group = await response.json();
      replaceGroupLocally(updatedGroup);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed');
      fetchData(false);
    } finally {
      setActionLoading(null);
    }
  }, [authHeaders, fetchData, replaceGroupLocally]);

  const findReusableHoleSlot = useCallback(
    (courseKey: string, holeNumber: number) =>
      groups
        .filter(
          (group) =>
            group.starting_course_key === courseKey &&
            group.hole_number === holeNumber &&
            group.golfers.length === 0
        )
        .sort((a, b) => a.group_number - b.group_number)[0] || null,
    [groups]
  );

  const placeGolferOnHole = useCallback(async (
    golfer: UnassignedGolfer,
    courseKey: string,
    holeNumber: number
  ) => {
    if (!tournamentId) return;

    const reusableSlot = findReusableHoleSlot(courseKey, holeNumber);
    if (reusableSlot) {
      void addGolferToGroup(reusableSlot.id, golfer);
      return;
    }

    const tempGroupId = -Date.now();
    const nextGroupNumber = groups.reduce((maxGroupNumber, group) => Math.max(maxGroupNumber, group.group_number), 0) + 1;
    const playerCount = golfer.partner_name ? 2 : 1;
    const maxGolfers = groups[0]?.max_golfers || 2;
    const courseName = courseMap.get(courseKey)?.name ?? 'Course';
    const optimisticGroup: Group = {
      id: tempGroupId,
      tournament_id: tournamentId,
      group_number: nextGroupNumber,
      starting_course_key: courseKey,
      starting_course_name: courseName,
      hole_number: holeNumber,
      golfer_count: 1,
      player_count: playerCount,
      max_golfers: maxGolfers,
      is_full: playerCount >= maxGolfers,
      starting_position_label: null,
      hole_position_label: null,
      starting_hole_description: buildStartingHoleDescription(courseKey, holeNumber, courseMap, multiCourseSetup),
      golfers: [golferToGroupGolfer(golfer)],
    };

    setActionLoading(`place-${golfer.id}`);
    setUnassigned((previousGolfers) => previousGolfers.filter((entry) => entry.id !== golfer.id));
    setGroups((previousGroups) => [...previousGroups, optimisticGroup].sort((a, b) => a.group_number - b.group_number));

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API}/api/v1/groups/place_golfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tournament_id: tournamentId,
          golfer_id: golfer.id,
          starting_course_key: courseKey,
          hole_number: holeNumber,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.errors?.[0] || 'Failed to place team');
      }

      const placedGroup: Group = await response.json();
      replaceGroupLocally(placedGroup, { tempGroupId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed');
      fetchData(false);
    } finally {
      setActionLoading(null);
    }
  }, [addGolferToGroup, authHeaders, courseMap, fetchData, findReusableHoleSlot, groups, multiCourseSetup, replaceGroupLocally, tournamentId]);

  const removeGolferFromGroup = async (groupId: number, golferId: number) => {
    setActionLoading(`remove-${golferId}`);

    const currentGroup = groups.find((group) => group.id === groupId);
    const removedGolfer = currentGroup?.golfers.find((golfer) => golfer.id === golferId);
    if (!currentGroup || !removedGolfer) {
      setActionLoading(null);
      return;
    }

    const removedPlayers = removedGolfer.partner_name ? 2 : 1;
    setGroups((previousGroups) =>
      previousGroups.flatMap((group) => {
        if (group.id !== groupId) return [group];

        const remainingGolfers = group.golfers.filter((golfer) => golfer.id !== golferId);
        if (remainingGolfers.length === 0) return [];

        const nextPlayerCount = Math.max(0, (group.player_count ?? group.golfer_count) - removedPlayers);
        return [
          {
            ...group,
            golfers: remainingGolfers,
            golfer_count: Math.max(0, group.golfer_count - 1),
            player_count: nextPlayerCount,
            is_full: nextPlayerCount >= (group.max_golfers || 2),
          },
        ];
      })
    );
    setUnassigned((previousGolfers) => [
      groupGolferToUnassigned(removedGolfer),
      ...previousGolfers.filter((golfer) => golfer.id !== removedGolfer.id),
    ]);

    try {
      const headers = await authHeaders();
      const response = await fetch(`${API}/api/v1/groups/${groupId}/remove_golfer`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ golfer_id: golferId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.errors?.[0] || 'Failed to remove golfer');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed');
      fetchData(false);
    } finally {
      setActionLoading(null);
    }
  };

  const placeQueueItemOnHole = useCallback((item: PlacementQueueItem, courseKey: string, holeNumber: number) => {
    if (item.kind === 'golfer') {
      void placeGolferOnHole(item.golfer, courseKey, holeNumber);
      return;
    }

    applyGroupStartLocally(item.group.id, courseKey, holeNumber);
    void updateGroupStart(item.group.id, courseKey, holeNumber);
  }, [applyGroupStartLocally, placeGolferOnHole, updateGroupStart]);

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
      const groupId = parseItemId(over, 'group-drop-');
      const golferId = parseItemId(active, 'golfer-');
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

      void addGolferToGroup(groupId, golfer);
      return;
    }

    if (!over.startsWith('hole-drop-')) return;

    const target = parseHoleDropId(over);
    if (!target) return;

    const item = allPlacementQueueItems.find((entry) => entry.id === active);
    if (item) {
      placeQueueItemOnHole(item, target.courseKey, target.holeNumber);
    }
  };

  const handleCourseChange = (group: Group, nextCourseKey: string) => {
    const currentCourseKey = group.starting_course_key ?? '';
    if (nextCourseKey === currentCourseKey) return;

    if (!nextCourseKey) {
      if (!group.starting_course_key && !group.hole_number) return;
      applyGroupStartLocally(group.id, null, null);
      void updateGroupStart(group.id, null, null);
      return;
    }

    const course = courseMap.get(nextCourseKey);
    if (!course) return;

    const nextHole =
      group.starting_course_key === nextCourseKey && group.hole_number && group.hole_number <= course.hole_count
        ? group.hole_number
        : 1;

    applyGroupStartLocally(group.id, nextCourseKey, nextHole);
    void updateGroupStart(group.id, nextCourseKey, nextHole);
  };

  const handleHolePickerSelect = (itemId: string, courseKey: string, holeNumber: number) => {
    const selectedItem = allPlacementQueueItems.find((item) => item.id === itemId);
    if (!selectedItem) return;
    placeQueueItemOnHole(selectedItem, courseKey, holeNumber);
  };

  const toggleCourseSection = (courseKey: string) => {
    setCollapsedCourseKeys((previousKeys) =>
      previousKeys.includes(courseKey)
        ? previousKeys.filter((key) => key !== courseKey)
        : [...previousKeys, courseKey]
    );
  };

  const setAllCourseSectionsCollapsed = (collapsed: boolean) => {
    setCollapsedCourseKeys(collapsed ? courseConfigs.map((course) => course.key) : []);
  };

  const allCoursesCollapsed =
    multiCourseSetup && courseConfigs.length > 0 && collapsedCourseKeys.length === courseConfigs.length;

  const renderGroupCard = (group: Group) => {
    const isTemporaryGroup = group.id < 0;
    const selectedCourse = group.starting_course_key ? courseMap.get(group.starting_course_key) : null;
    const localStartingPositionLabel = buildStartingPositionLabel(group, groups, courseMap, multiCourseSetup);
    const localStartingHoleDescription =
      buildStartingHoleDescription(group.starting_course_key, group.hole_number, courseMap, multiCourseSetup) ||
      group.starting_hole_description;
    const label = localStartingPositionLabel || groupQueueTitle(group);

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
                {isTemporaryGroup && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 sm:text-xs">
                    Saving
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {group.player_count ?? group.golfer_count} / {group.max_golfers || 2} players
                {localStartingHoleDescription ? ` · ${localStartingHoleDescription}` : ''}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
            <select
              value={group.starting_course_key ?? ''}
              onChange={(event) => handleCourseChange(group, event.target.value)}
              disabled={isTemporaryGroup}
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
              onChange={(event) => {
                const nextHole = event.target.value ? parseInt(event.target.value, 10) : null;
                if (group.hole_number === nextHole) return;
                if (nextHole == null) {
                  applyGroupStartLocally(group.id, null, null);
                  void updateGroupStart(group.id, null, null);
                  return;
                }
                applyGroupStartLocally(group.id, group.starting_course_key, nextHole);
                void updateGroupStart(group.id, group.starting_course_key, nextHole);
              }}
              disabled={isTemporaryGroup || !selectedCourse}
              className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-neutral-100"
            >
              <option value="">{selectedCourse ? 'Clear start' : 'Select course'}</option>
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
                    disabled={isTemporaryGroup || actionLoading === `remove-${golfer.id}`}
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

          {!isTemporaryGroup && !group.is_full && (
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
            {multiCourseSetup && (
              <button
                onClick={() => setAllCourseSectionsCollapsed(!allCoursesCollapsed)}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-200 hover:text-brand-700"
              >
                {allCoursesCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                {allCoursesCollapsed ? 'Expand Courses' : 'Collapse Courses'}
              </button>
            )}
            <button
              onClick={autoAssign}
              disabled={actionLoading === 'auto' || unassigned.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {actionLoading === 'auto' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
              Auto-Prepare Slots
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
                  Drag teams straight onto a course and hole, or use a hole picker below. Existing grouped teams stay here until they get a valid start.
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
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-brand-50 p-2 text-brand-600">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-neutral-900">{course.name}</h2>
                      <p className="text-sm text-neutral-500">
                        {course.hole_count} starting hole{course.hole_count !== 1 ? 's' : ''} ·{' '}
                        {course.holes.reduce((count, hole) => count + hole.groups.length, 0)} placed start
                        {course.holes.reduce((count, hole) => count + hole.groups.length, 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleCourseSection(course.key)}
                    className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-200 hover:text-brand-700"
                  >
                    {collapsedCourseKeys.includes(course.key) ? (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Expand
                      </>
                    ) : (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Collapse
                      </>
                    )}
                  </button>
                </div>

                {!collapsedCourseKeys.includes(course.key) && (
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
                              hole.groups.map(renderGroupCard)
                            ) : null}

                            <DroppableHoleZone
                              courseKey={course.key}
                              holeNumber={hole.holeNumber}
                              isOver={isHoleOver}
                              compact={hole.groups.length > 0}
                            />

                            <HolePlacementPicker
                              items={allPlacementQueueItems}
                              onSelect={(itemId) => handleHolePickerSelect(itemId, course.key, hole.holeNumber)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
