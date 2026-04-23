import { describe, expect, it } from 'vitest';
import {
  buildGroupedCourses,
  buildPlacementQueueGroups,
  buildStartingPositionLabel,
  hasValidStartingPosition,
  isEligibleForHoleAssignment,
} from './groupManagementUtils';

describe('groupManagementUtils', () => {
  const courseConfigs = [
    { key: 'hibiscus', name: 'Hibiscus', hole_count: 9 },
    { key: 'bouganvillea', name: 'Bouganvillea', hole_count: 9 },
  ];

  const courseMap = new Map(courseConfigs.map((course) => [course.key, course]));

  it('treats groups beyond the configured hole count as awaiting placement', () => {
    const groups = [
      {
        id: 1,
        group_number: 1,
        starting_course_key: 'hibiscus',
        hole_number: 10,
        golfers: [{ id: 1 }],
      },
      {
        id: 2,
        group_number: 2,
        starting_course_key: 'hibiscus',
        hole_number: 3,
        golfers: [{ id: 2 }],
      },
    ];

    expect(hasValidStartingPosition(groups[0], courseMap)).toBe(false);
    expect(hasValidStartingPosition(groups[1], courseMap)).toBe(true);
    expect(buildPlacementQueueGroups(groups, courseMap).map((group) => group.id)).toEqual([1]);
  });

  it('only renders groups into holes when the start is still valid', () => {
    const groups = [
      {
        id: 1,
        group_number: 1,
        starting_course_key: 'hibiscus',
        hole_number: 10,
        golfers: [{ id: 1 }],
      },
      {
        id: 2,
        group_number: 2,
        starting_course_key: 'hibiscus',
        hole_number: 3,
        golfers: [{ id: 2 }],
      },
    ];

    const hibiscus = buildGroupedCourses(courseConfigs, groups).find((course) => course.key === 'hibiscus');

    expect(hibiscus?.holes[2].groups.map((group) => group.id)).toEqual([2]);
    expect(hibiscus?.holes.every((hole) => hole.groups.every((group) => group.id !== 1))).toBe(true);
  });

  it('derives stable local position labels from the current hole assignments', () => {
    const groups = [
      {
        id: 2,
        group_number: 2,
        starting_course_key: 'hibiscus',
        hole_number: 3,
        golfers: [{ id: 2 }],
      },
      {
        id: 5,
        group_number: 5,
        starting_course_key: 'hibiscus',
        hole_number: 3,
        golfers: [{ id: 5 }],
      },
    ];

    expect(buildStartingPositionLabel(groups[0], groups, courseMap, true)).toBe('Hibiscus 3A');
    expect(buildStartingPositionLabel(groups[1], groups, courseMap, true)).toBe('Hibiscus 3B');
  });

  it('ignores empty groups when rendering holes and deriving labels', () => {
    const groups = [
      {
        id: 1,
        group_number: 1,
        starting_course_key: 'hibiscus',
        hole_number: 1,
        golfers: [{ id: 1 }],
      },
      {
        id: 2,
        group_number: 2,
        starting_course_key: 'hibiscus',
        hole_number: 1,
        golfers: [],
      },
      {
        id: 3,
        group_number: 3,
        starting_course_key: 'hibiscus',
        hole_number: 1,
        golfers: [{ id: 3 }],
      },
    ];

    const hibiscus = buildGroupedCourses(courseConfigs, groups).find((course) => course.key === 'hibiscus');

    expect(hibiscus?.holes[0].groups.map((group) => group.id)).toEqual([1, 3]);
    expect(buildStartingPositionLabel(groups[0], groups, courseMap, true)).toBe('Hibiscus 1A');
    expect(buildStartingPositionLabel(groups[2], groups, courseMap, true)).toBe('Hibiscus 1B');
  });

  it('treats pending ungrouped golfers as eligible for hole assignment', () => {
    expect(isEligibleForHoleAssignment({ registration_status: 'confirmed', group_id: null })).toBe(true);
    expect(isEligibleForHoleAssignment({ registration_status: 'pending', group_id: null })).toBe(true);
    expect(isEligibleForHoleAssignment({ registration_status: 'waitlist', group_id: null })).toBe(false);
    expect(isEligibleForHoleAssignment({ registration_status: 'cancelled', group_id: null })).toBe(false);
    expect(isEligibleForHoleAssignment({ registration_status: 'pending', group_id: 42 })).toBe(false);
  });
});
