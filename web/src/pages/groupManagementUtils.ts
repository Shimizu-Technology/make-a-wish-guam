export interface GroupManagementCourseConfig {
  key: string;
  name: string;
  hole_count: number;
}

export interface GroupManagementGroup {
  id: number;
  group_number: number;
  starting_course_key: string | null;
  hole_number: number | null;
  golfers: Array<unknown>;
}

export interface GroupedCourseHole<TGroup extends GroupManagementGroup> {
  holeNumber: number;
  groups: TGroup[];
}

export interface GroupedCourse<TGroup extends GroupManagementGroup> extends GroupManagementCourseConfig {
  holes: Array<GroupedCourseHole<TGroup>>;
}

const positionLetterForIndex = (index: number) => String.fromCharCode(65 + index);
const hasGolfers = <TGroup extends GroupManagementGroup>(group: TGroup) => group.golfers.length > 0;

export const hasValidStartingPosition = (
  group: Pick<GroupManagementGroup, 'starting_course_key' | 'hole_number'>,
  courseMap: Map<string, GroupManagementCourseConfig>
) => {
  if (!group.starting_course_key || !group.hole_number) return false;

  const course = courseMap.get(group.starting_course_key);
  if (!course) return false;

  return group.hole_number <= course.hole_count;
};

export const isAwaitingPlacement = (
  group: Pick<GroupManagementGroup, 'starting_course_key' | 'hole_number'>,
  courseMap: Map<string, GroupManagementCourseConfig>
) => !hasValidStartingPosition(group, courseMap);

export const buildPlacementQueueGroups = <TGroup extends GroupManagementGroup>(
  groups: TGroup[],
  courseMap: Map<string, GroupManagementCourseConfig>
) =>
  groups
    .filter((group) => group.golfers.length > 0 && isAwaitingPlacement(group, courseMap))
    .sort((a, b) => a.group_number - b.group_number);

export const buildStartingHoleDescription = (
  courseKey: string | null,
  holeNumber: number | null,
  courseMap: Map<string, GroupManagementCourseConfig>,
  multiCourseSetup: boolean
) => {
  if (!courseKey || !holeNumber) return null;

  const course = courseMap.get(courseKey);
  if (!course) return null;

  return multiCourseSetup ? `${course.name} Hole ${holeNumber}` : `Hole ${holeNumber}`;
};

export const buildStartingPositionLabel = <TGroup extends GroupManagementGroup>(
  group: TGroup,
  groups: TGroup[],
  courseMap: Map<string, GroupManagementCourseConfig>,
  multiCourseSetup: boolean
) => {
  if (!hasValidStartingPosition(group, courseMap) || !group.starting_course_key || !group.hole_number) return null;

  const groupsAtStart = groups
    .filter(
      (entry) =>
        hasGolfers(entry) &&
        hasValidStartingPosition(entry, courseMap) &&
        entry.starting_course_key === group.starting_course_key &&
        entry.hole_number === group.hole_number
    )
    .sort((a, b) => a.group_number - b.group_number);

  const positionIndex = groupsAtStart.findIndex((entry) => entry.id === group.id);
  const positionLetter = positionLetterForIndex(positionIndex >= 0 ? positionIndex : 0);

  if (!multiCourseSetup) {
    return `${group.hole_number}${positionLetter}`;
  }

  const course = courseMap.get(group.starting_course_key);
  return course ? `${course.name} ${group.hole_number}${positionLetter}` : `${group.hole_number}${positionLetter}`;
};

export const buildGroupedCourses = <TGroup extends GroupManagementGroup>(
  courseConfigs: GroupManagementCourseConfig[],
  groups: TGroup[]
): Array<GroupedCourse<TGroup>> => {
  const courseMap = new Map(courseConfigs.map((course) => [course.key, course]));

  return courseConfigs.map((course) => ({
    ...course,
    holes: Array.from({ length: course.hole_count }, (_, index) => {
      const holeNumber = index + 1;
      const holeGroups = groups
        .filter(
          (group) =>
            hasGolfers(group) &&
            hasValidStartingPosition(group, courseMap) &&
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
};
