import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  clearSponsorPortalSession,
  loadSponsorPortalSession,
  saveSponsorPortalSession,
  SPONSOR_PORTAL_SESSION_MAX_AGE_MS,
} from './sponsorPortalSession';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

describe('sponsorPortalSession', () => {
  const storage = new MemoryStorage();
  const token = 'magic-link-token-1';
  const payload = {
    sessionToken: 'session-token-1',
    sponsor: { id: 1, name: 'Sponsor' },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T00:00:00Z'));
  });

  afterEach(() => {
    clearSponsorPortalSession(token, storage);
    clearSponsorPortalSession('different-token', storage);
    vi.useRealTimers();
  });

  it('round-trips cached session data for the same magic link', () => {
    saveSponsorPortalSession(token, payload, storage);

    expect(loadSponsorPortalSession<typeof payload>(token, storage)).toEqual(payload);
  });

  it('does not reuse a cached session for a different magic link', () => {
    saveSponsorPortalSession(token, payload, storage);

    expect(loadSponsorPortalSession<typeof payload>('different-token', storage)).toBeNull();
  });

  it('invalidates cached data if the stored token does not match the requested magic link', () => {
    saveSponsorPortalSession(token, payload, storage);

    const [storedKey] = storage.keys();
    storage.setItem(storedKey, JSON.stringify({
      token: 'different-token',
      data: payload,
      ts: Date.now(),
    }));

    expect(loadSponsorPortalSession<typeof payload>(token, storage)).toBeNull();
  });

  it('expires cached sessions after the backend ttl window', () => {
    saveSponsorPortalSession(token, payload, storage);
    vi.advanceTimersByTime(SPONSOR_PORTAL_SESSION_MAX_AGE_MS + 1);

    expect(loadSponsorPortalSession<typeof payload>(token, storage)).toBeNull();
  });
});
