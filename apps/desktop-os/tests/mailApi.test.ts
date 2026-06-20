import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindQQMailAccount,
  deleteMailAccount,
  getMailMessage,
  listMailAccounts,
  listMailMessages,
  startGmailBinding,
  syncMailAccount,
} from '../src/api/mail';

describe('desktop mail api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists mail accounts with bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 0, message: 'ok', data: { list: [] } })),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await listMailAccounts('token-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/v1/user/mail/accounts',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-123');
    expect(result.list).toEqual([]);
  });

  it('starts Gmail binding and binds QQ IMAP through planned endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'ok',
            data: { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth' },
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'ok',
            data: {
              id: '301',
              provider: 'qq_imap',
              authType: 'app_password',
              email: 'me@qq.com',
              status: 'connected',
            },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await startGmailBinding('token-123');
    const account = await bindQQMailAccount(
      { email: 'me@qq.com', authorizationCode: 'auth-code' },
      'token-123',
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8080/api/v1/user/mail/accounts/gmail/start',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'http://localhost:8080/api/v1/user/mail/accounts/qq-imap',
    );
    expect(fetchMock.mock.calls[1][1].body).toBe(
      JSON.stringify({ email: 'me@qq.com', authorizationCode: 'auth-code' }),
    );
    expect(account).not.toHaveProperty('credentialCiphertext');
  });

  it('lists, opens, syncs, and deletes mail through scoped endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            code: 0,
            message: 'ok',
            data: {
              list: [],
              pagination: { page: 1, pageSize: 20, total: 0, hasMore: false },
            },
          }),
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await listMailMessages({ accountId: '301', q: 'hello', page: 1, pageSize: 20 }, 'token-123');
    await getMailMessage('401', 'token-123');
    await syncMailAccount('301', 'token-123');
    await deleteMailAccount('301', 'token-123');

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:8080/api/v1/user/mail/messages?accountId=301&q=hello&page=1&pageSize=20',
      'http://localhost:8080/api/v1/user/mail/messages/401',
      'http://localhost:8080/api/v1/user/mail/accounts/301/sync',
      'http://localhost:8080/api/v1/user/mail/accounts/301',
    ]);
  });
});
