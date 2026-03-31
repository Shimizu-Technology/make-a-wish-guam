/**
 * Format a YYYY-MM-DD date string to a human-readable format.
 * e.g. "2026-05-02" → "May 2, 2026"
 *
 * We parse the ISO date string manually to avoid timezone shift issues
 * (new Date("2026-05-02") is midnight UTC, which may appear as May 1 in
 *  negative-offset timezones).
 */
export function formatEventDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  // Expect YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts.map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 1 || day < 1) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
