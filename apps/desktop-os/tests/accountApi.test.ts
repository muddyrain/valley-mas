import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUserInfo, updateUserProfile, uploadAvatar } from '../src/api/auth';

describe('desktop account api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the extended user info with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            id: '1001',
            username: 'valley',
            nickname: 'Valley User',
            avatar: 'https://cdn.example.com/avatar.png',
            role: 'creator',
            email: 'me@example.com',
            phone: '13800000000',
            downloadCount: 12,
            creatorCode: 'creator-home',
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = await getUserInfo('token-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/user/info',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(user).toMatchObject({
      nickname: 'Valley User',
      downloadCount: 12,
      creatorCode: 'creator-home',
    });
  });

  it('updates profile fields through the existing profile endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            id: '1001',
            username: 'valley',
            nickname: 'New Name',
            avatar: 'https://cdn.example.com/new.png',
            role: 'user',
            email: 'new@example.com',
            phone: '13900000000',
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = await updateUserProfile(
      {
        nickname: 'New Name',
        avatar: 'https://cdn.example.com/new.png',
        email: 'new@example.com',
        phone: '13900000000',
      },
      'token-123',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/user/profile',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({
          nickname: 'New Name',
          avatar: 'https://cdn.example.com/new.png',
          email: 'new@example.com',
          phone: '13900000000',
        }),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(user.nickname).toBe('New Name');
  });

  it('uploads avatar files through multipart form data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: { avatarUrl: 'https://cdn.example.com/avatar-uploaded.png' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const result = await uploadAvatar(file, 'token-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/user/avatar',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(headers.get('Content-Type')).toBeNull();
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('file')).toBe(file);
    expect(result.avatarUrl).toBe('https://cdn.example.com/avatar-uploaded.png');
  });
});
