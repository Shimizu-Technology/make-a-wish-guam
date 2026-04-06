export const DEFAULT_SPONSOR_TIER_LABELS: Record<string, string> = {
  title: 'Title',
  platinum: 'Platinum',
  gold: 'Gold',
  silver: 'Silver',
  bronze: 'Bronze',
  hole: 'Hole',
};

export function getSponsorTierLabel(
  tier: string,
  labels?: Record<string, string> | null,
): string {
  return labels?.[tier] || DEFAULT_SPONSOR_TIER_LABELS[tier] || titleizeTier(tier);
}

function titleizeTier(tier: string): string {
  return tier
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
