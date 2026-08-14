import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/utils/request', () => ({
  default: { get },
}));

import { getMyResources } from './resource';

describe('resource api', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('maps the owner image filters to the resource list query', () => {
    getMyResources({
      page: 2,
      pageSize: 24,
      type: 'avatar',
      visibility: 'private',
      keyword: '夏日 少女',
    });

    expect(get).toHaveBeenCalledWith(
      '/content/resources?page=2&pageSize=24&type=avatar&visibility=private&keyword=%E5%A4%8F%E6%97%A5+%E5%B0%91%E5%A5%B3',
      undefined,
    );
  });
});
