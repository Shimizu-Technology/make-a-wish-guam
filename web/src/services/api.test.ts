import { describe, expect, it } from 'vitest';
import { ApiClient } from './api';

describe('ApiClient.getWebSocketToken', () => {
  it('returns null when no token getter is configured', async () => {
    const client = new ApiClient();
    await expect(client.getWebSocketToken()).resolves.toBeNull();
  });

  it('returns token from configured getter', async () => {
    const client = new ApiClient();
    client.setAuthTokenGetter(async () => 'token-123');

    await expect(client.getWebSocketToken()).resolves.toBe('token-123');
  });

  it('returns null when getter throws', async () => {
    const client = new ApiClient();
    client.setAuthTokenGetter(async () => {
      throw new Error('failed');
    });

    await expect(client.getWebSocketToken()).resolves.toBeNull();
  });
});
