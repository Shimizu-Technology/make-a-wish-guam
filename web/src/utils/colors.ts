const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const FALLBACK = '#1e40af';

function safeHex(hex: string): string {
  return HEX_RE.test(hex) ? hex : FALLBACK;
}

/** Generate a tinted rgba from a hex color */
export function hexToRgba(hex: string, alpha: number): string {
  const h = safeHex(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, alpha))})`;
}

/** Lighten / darken a hex color by a percentage (-1 to 1) */
export function adjustColor(hex: string, amount: number): string {
  const h = safeHex(hex);
  const clamped = Math.min(1, Math.max(-1, amount));
  const num = parseInt(h.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * clamped)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(255 * clamped)));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(255 * clamped)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
