const GUAM_TZ = 'Pacific/Guam';

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

/**
 * Format an ISO datetime string to "April 7, 2026" (date only).
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: GUAM_TZ,
  });
}

/**
 * Format an ISO datetime string to "April 7, 2026, 4:45 PM" (date + time).
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: GUAM_TZ,
  });
}

/**
 * Format an ISO datetime string to "April 7, 2026" (short, for tables).
 */
export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: GUAM_TZ,
  });
}
