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

  it('creates a pantry item without issuing a second client trace request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          id: 'pantry-1',
          householdId: '',
          name: '牛奶',
          category: '食品',
          quantity: 2,
          unit: '盒',
          location: '冷藏',
          expiresAt: '2026-06-10',
          openedAt: '2026-06-02',
          note: '',
          imageUrl: 'https://example.com/milk.jpg',
          thumbnailUrl: '',
          status: 'normal',
          reminderEnabled: true,
          reminderUseDefault: true,
          reminderRules: ['7d', '3d'],
          reminderTime: '09:00',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await import('../src/store/useAuthStore');
    const { useLifeTraceStore } = await import('../src/store/useLifeTraceStore');
    useAuthStore.setState({ token: 'token', status: 'authenticated' });

    const item = await useLifeTraceStore.getState().addPantryItem({
      householdId: '',
      name: '牛奶',
      category: '食品',
      quantity: 2,
      unit: '盒',
      location: '冷藏',
      expiresAt: '2026-06-10',
      openedAt: '2026-06-02',
      note: '',
      imageUrl: 'https://example.com/milk.jpg',
      status: 'normal',
      reminder: {
        enabled: true,
        useDefault: true,
        rules: ['7d', '3d'],
        reminderTime: '09:00',
      },
    });

    expect(item?.name).toBe('牛奶');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/pantry');
  });

  it('deduplicates concurrent pantry status updates before creating traces', async () => {
    let resolveStatus: ((value: unknown) => void) | undefined;
    const statusResponse = new Promise((resolve) => {
      resolveStatus = resolve;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/status')) {
        return statusResponse;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            id: 'trace-discarded-1',
            title: '牛奶 已丢弃',
            summary: 'Life Trace 记录了「牛奶」已经被丢弃。',
            timeLabel: '06/04 22:30',
            location: '冷藏',
            imageUrl: '',
            mood: '提醒',
            tags: ['食品', '家庭库存', '丢弃'],
            source: '库存',
          },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await import('../src/store/useAuthStore');
    const { useLifeTraceStore } = await import('../src/store/useLifeTraceStore');
    useAuthStore.setState({ token: 'token', status: 'authenticated' });

    const first = useLifeTraceStore.getState().updatePantryItemStatus('pantry-1', 'discarded');
    const second = await useLifeTraceStore
      .getState()
      .updatePantryItemStatus('pantry-1', 'discarded');

    expect(second).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/v1/life-trace/pantry/pantry-1/status');

    resolveStatus?.({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          id: 'pantry-1',
          householdId: '',
          name: '牛奶',
          category: '食品',
          quantity: 1,
          unit: '盒',
          location: '冷藏',
          expiresAt: '',
          openedAt: '',
          note: '',
          imageUrl: '',
          thumbnailUrl: '',
          status: 'discarded',
          reminderEnabled: false,
          reminderUseDefault: true,
          reminderRules: [],
          reminderTime: '09:00',
        },
      }),
    });

    const updated = await first;
    expect(updated?.status).toBe('discarded');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('consumes pantry quantity and updates the local pantry item', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          id: 'pantry-1',
          householdId: '',
          name: '抽纸',
          category: '日用品',
          quantity: 1,
          unit: '包',
          location: '卫生间',
          expiresAt: '',
          openedAt: '',
          note: '',
          imageUrl: '',
          thumbnailUrl: '',
          status: 'normal',
          reminderEnabled: false,
          reminderUseDefault: true,
          reminderRules: [],
          reminderTime: '09:00',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useAuthStore } = await import('../src/store/useAuthStore');
    const { useLifeTraceStore } = await import('../src/store/useLifeTraceStore');
    useAuthStore.setState({ token: 'token', status: 'authenticated' });
    useLifeTraceStore.setState({
      pantryItems: [
        {
          id: 'pantry-1',
          householdId: '',
          name: '抽纸',
          category: '日用品',
          quantity: 2,
          unit: '包',
          location: '卫生间',
          note: '',
          status: 'normal',
          reminder: {
            enabled: false,
            useDefault: true,
            rules: [],
            reminderTime: '09:00',
          },
          createdAt: '2026-06-07T00:00:00.000Z',
          updatedAt: '2026-06-07T00:00:00.000Z',
        },
      ],
    });

    const updated = await useLifeTraceStore
      .getState()
      .consumePantryItem('pantry-1', { action: 'used', quantity: 1 });

    expect(updated?.quantity).toBe(1);
    expect(useLifeTraceStore.getState().pantryItems[0].quantity).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/pantry/pantry-1/consume');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      action: 'used',
      quantity: 1,
    });
  });

  it('keeps the created shared household as the pantry list scope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            id: 'pantry-shared-1',
            householdId: 'household-shared',
            name: '酸奶',
            category: '食品',
            quantity: 1,
            unit: '盒',
            location: '冷藏',
            expiresAt: '2026-06-08',
            openedAt: '2026-06-02',
            note: '',
            imageUrl: '',
            thumbnailUrl: '',
            status: 'normal',
            reminderEnabled: true,
            reminderUseDefault: true,
            reminderRules: ['7d', '3d', 'same-day'],
            reminderTime: '08:30',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            activePantryHouseholdId: 'household-shared',
            city: '上海',
            workStart: '09:30',
            workEnd: '18:30',
            commuteMethod: '开车',
            dailyBriefTime: '08:10',
            workdayMode: 'legal',
            workdays: ['1', '2', '3', '4', '5'],
            holidaySync: true,
            weekendReminders: false,
            planReminderLeadMinutes: 10,
            quietStart: '22:30',
            quietEnd: '07:30',
            weatherAlerts: true,
            planReminders: true,
            aiPersonalization: true,
            habits: ['喝水'],
            pantryReminderEnabled: true,
            pantryReminderRules: ['7d', '3d', 'same-day'],
            pantryReminderTime: '08:30',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            householdId: 'household-shared',
            householdName: '家里',
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

    const item = await useLifeTraceStore.getState().addPantryItem(
      {
        householdId: 'household-shared',
        name: '酸奶',
        category: '食品',
        quantity: 1,
        unit: '盒',
        location: '冷藏',
        expiresAt: '2026-06-08',
        openedAt: '2026-06-02',
        note: '',
        status: 'normal',
        reminder: {
          enabled: true,
          useDefault: true,
          rules: ['7d', '3d', 'same-day'],
          reminderTime: '08:30',
        },
      },
      'household-shared',
    );
    expect(item?.householdId).toBe('household-shared');

    await useLifeTraceStore.getState().setActivePantryHousehold('household-shared', '家里');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await useLifeTraceStore.getState().loadPantryList({
      pageSize: 20,
      householdId: useLifeTraceStore.getState().preferredPantryHouseholdId,
    });

    expect(useLifeTraceStore.getState().preferredPantryHouseholdId).toBe('household-shared');
    expect(useLifeTraceStore.getState().preferredPantryHouseholdName).toBe('家里');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/life-trace/settings');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toMatchObject({
      activePantryHouseholdId: 'household-shared',
    });
    expect(fetchMock.mock.calls[2][0]).toBe(
      '/api/v1/life-trace/pantry?page=1&pageSize=20&householdId=household-shared',
    );
  });
});
