const SESSION_PREFIX = 'sponsor_portal_session';

// Keep the browser cache aligned with the backend's 12-hour sponsor portal session TTL.
export const SPONSOR_PORTAL_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type StoredSession<T> = {
  token: string;
  data: T;
  ts: number;
};

function buildSessionKey(linkToken: string): string {
  return `${SESSION_PREFIX}:${encodeURIComponent(linkToken)}`;
}

export function saveSponsorPortalSession<T>(
  linkToken: string,
  data: T,
  storage: Pick<Storage, 'setItem'> = window.localStorage
): void {
  try {
    const payload: StoredSession<T> = { token: linkToken, data, ts: Date.now() };
    storage.setItem(buildSessionKey(linkToken), JSON.stringify(payload));
  } catch {
    // Swallow storage failures so portal access still works without persistence.
  }
}

export function loadSponsorPortalSession<T>(
  linkToken: string,
  storage: Pick<Storage, 'getItem' | 'removeItem'> = window.localStorage
): T | null {
  try {
    const raw = storage.getItem(buildSessionKey(linkToken));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredSession<T> | null;
    if (!parsed?.ts || !('data' in parsed) || parsed.token !== linkToken) {
      storage.removeItem(buildSessionKey(linkToken));
      return null;
    }

    if (Date.now() - parsed.ts > SPONSOR_PORTAL_SESSION_MAX_AGE_MS) {
      storage.removeItem(buildSessionKey(linkToken));
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

export function clearSponsorPortalSession(
  linkToken: string,
  storage: Pick<Storage, 'removeItem'> = window.localStorage
): void {
  try {
    storage.removeItem(buildSessionKey(linkToken));
  } catch {
    // Ignore storage failures.
  }
}
