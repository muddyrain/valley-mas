import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCheckins, toggleCheckin } from '../src/api/checkins';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('checkin api', () => {
  it('lists checkins for a date', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { date: '2026-05-28', list: [{ id: '1', name: '喝水', completed: true }] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await listCheckins(token, '2026-05-28');

    expect(data.list[0].name).toBe('喝水');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/checkins?date=2026-05-28');
  });

  it('toggles a checkin through the life-trace endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { id: '1', date: '2026-05-28', name: '运动', completed: true },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const checkin = await toggleCheckin(token, {
      date: '2026-05-28',
      name: '运动',
      completed: true,
    });

    expect(checkin.completed).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/checkins');
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
  });
});
