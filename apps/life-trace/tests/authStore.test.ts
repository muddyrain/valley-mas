import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const user = {
  id: '123',
  username: 'tester',
  nickname: '测试用户',
  role: 'user',
};

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('life trace auth store', () => {
  it('normalizes password login network failures instead of showing Load failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Load failed')));

    const { useAuthStore } = await import('../src/store/useAuthStore');
    await expect(
      useAuthStore.getState().signIn({ email: 'tester@example.com', password: 'password' }),
    ).rejects.toThrow('网络连接失败，请检查网络后重试');

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      status: 'unauthenticated',
      error: '网络连接失败，请检查网络后重试',
    });
  });

  it('keeps the token when session verification is temporarily unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ code: 503, message: '认证服务暂时不可用，请稍后重试' }),
      }),
    );

    const { useAuthStore } = await import('../src/store/useAuthStore');
    useAuthStore.setState({ token: 'valid-token', user, status: 'idle', error: '' });

    await useAuthStore.getState().verifySession();

    expect(useAuthStore.getState()).toMatchObject({
      token: 'valid-token',
      user,
      status: 'authenticated',
      error: '暂时无法验证登录状态，请稍后重试',
    });
  });

  it('clears the token when the server confirms that authentication failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ code: 401, message: 'token已过期或无效' }),
      }),
    );

    const { useAuthStore } = await import('../src/store/useAuthStore');
    useAuthStore.setState({ token: 'expired-token', user, status: 'idle', error: '' });

    await useAuthStore.getState().verifySession();

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      user: null,
      status: 'unauthenticated',
      error: '',
    });
  });
});
