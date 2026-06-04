import { beforeEach, describe, expect, it, vi } from 'vitest';

function createStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe('pantry store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createStorage());
  });

  it('does not promote the server-resolved default household into user preference', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          householdId: 'household-default',
          householdName: '默认空间',
          list: [],
          pagination: { page: 1, pageSize: 20, total: 0, hasMore: false },
          summary: { total: 0, expiring: 0, expired: 0, active: 0 },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await import('../src/store/useAuthStore');
    const { useLifeTraceStore } = await import('../src/store/useLifeTraceStore');
    useAuthStore.setState({ token: 'token', status: 'authenticated' });

    await useLifeTraceStore.getState().loadPantryList({ pageSize: 20 });

    expect(useLifeTraceStore.getState().pantryListResolvedHouseholdId).toBe('household-default');
    expect(useLifeTraceStore.getState().pantryListResolvedHouseholdName).toBe('默认空间');
    expect(useLifeTraceStore.getState().preferredPantryHouseholdId).toBe('');
    expect(useLifeTraceStore.getState().preferredPantryHouseholdName).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/pantry?page=1&pageSize=20');
  });
});
