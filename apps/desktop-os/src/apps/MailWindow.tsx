import { RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteMailAccount,
  getMailMessage,
  listMailAccounts,
  listMailMessages,
  type MailAccount,
  type MailMessageDetail,
  type MailMessageSummary,
  syncMailAccount,
} from '../api/mail';
import { useAuthStore } from '../store/authStore';
import './DockAppWindows.css';

const ALL_INBOX = 'all';

export default function MailWindow() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [messages, setMessages] = useState<MailMessageSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(ALL_INBOX);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<MailMessageDetail | null>(null);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const loadAccounts = useCallback(async () => {
    if (!token) return;
    const result = await listMailAccounts(token);
    setAccounts(result.list);
  }, [token]);

  const loadMessages = useCallback(
    async (options: { preferredId?: string | null; search?: string } = {}) => {
      if (!token) return;
      setIsLoading(true);
      setError('');
      try {
        const result = await listMailMessages(
          {
            accountId: selectedAccountId === ALL_INBOX ? undefined : selectedAccountId,
            q: options.search?.trim() || undefined,
            page: 1,
            pageSize: 30,
          },
          token,
        );
        setMessages(result.list);
        const preferredId = options.preferredId ?? null;
        const nextSelected =
          result.list.find((message) => message.id === preferredId)?.id ??
          result.list[0]?.id ??
          null;
        setSelectedMessageId(nextSelected);
        if (!nextSelected) setSelectedMessage(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '邮件加载失败');
      } finally {
        setIsLoading(false);
      }
    },
    [token, selectedAccountId],
  );

  useEffect(() => {
    if (!token) return;
    void loadAccounts().catch((loadError) =>
      setError(loadError instanceof Error ? loadError.message : '邮箱账号加载失败'),
    );
  }, [token, loadAccounts]);

  useEffect(() => {
    if (!token) return;
    void loadMessages();
  }, [token, loadMessages]);

  useEffect(() => {
    if (!token || !selectedMessageId) return;
    void getMailMessage(selectedMessageId, token)
      .then(setSelectedMessage)
      .catch((detailError) =>
        setError(detailError instanceof Error ? detailError.message : '邮件详情加载失败'),
      );
  }, [token, selectedMessageId]);

  async function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await loadMessages({ preferredId: null, search: query });
  }

  async function handleSync(accountId?: string) {
    if (!token) return;
    const targets = accountId ? [accountId] : accounts.map((account) => account.id);
    if (targets.length === 0) return;
    setIsSyncing(accountId ?? ALL_INBOX);
    setError('');
    try {
      for (const id of targets) {
        await syncMailAccount(id, token);
      }
      await loadAccounts();
      await loadMessages({ preferredId: selectedMessageId, search: query });
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : '同步失败');
    } finally {
      setIsSyncing(null);
    }
  }

  async function handleDeleteAccount(accountId: string) {
    if (!token) return;
    setError('');
    try {
      await deleteMailAccount(accountId, token);
      if (selectedAccountId === accountId) setSelectedAccountId(ALL_INBOX);
      await loadAccounts();
      await loadMessages({ preferredId: null, search: query });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '解绑失败');
    }
  }

  if (!isAuthenticated || !token) {
    return (
      <section className="dock-app-window mail-window mail-window--empty">
        <img src="/icons/mail.png" alt="" />
        <h2>登录后查看邮件</h2>
        <p>绑定邮箱后，收件箱会显示在这里。</p>
      </section>
    );
  }

  return (
    <section className="dock-app-window mail-window">
      <header className="mail-window__header">
        <div>
          <div className="dock-app-window__eyebrow">邮件</div>
          <h2>统一收件箱</h2>
          <p>{accounts.length > 0 ? `${accounts.length} 个邮箱账号` : '尚未绑定邮箱'}</p>
        </div>
        <button
          type="button"
          className="mail-window__icon-button"
          onClick={() => void handleSync()}
          disabled={accounts.length === 0 || Boolean(isSyncing)}
          aria-label="刷新邮件"
          title="刷新邮件"
        >
          <RefreshCw className={isSyncing ? 'is-spinning' : ''} size={16} />
        </button>
      </header>

      {error ? <div className="account-window__error">{error}</div> : null}

      <div className="mail-window__layout">
        <aside className="mail-window__accounts">
          <button
            type="button"
            className={selectedAccountId === ALL_INBOX ? 'is-active' : ''}
            onClick={() => setSelectedAccountId(ALL_INBOX)}
          >
            <span>统一收件箱</span>
            <strong>{messages.length}</strong>
          </button>
          {accounts.map((account) => (
            <div className="mail-window__account-row" key={account.id}>
              <button
                type="button"
                className={selectedAccountId === account.id ? 'is-active' : ''}
                onClick={() => setSelectedAccountId(account.id)}
              >
                <span>{account.email}</span>
                <small>
                  {providerLabel(account.provider)} · {statusLabel(account.status)}
                </small>
              </button>
              <button
                type="button"
                className="mail-window__tiny"
                onClick={() => void handleSync(account.id)}
                disabled={Boolean(isSyncing)}
                aria-label="同步邮箱"
                title="同步邮箱"
              >
                <RefreshCw size={13} className={isSyncing === account.id ? 'is-spinning' : ''} />
              </button>
              <button
                type="button"
                className="mail-window__tiny"
                onClick={() => void handleDeleteAccount(account.id)}
                aria-label="解绑邮箱"
                title="解绑邮箱"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </aside>

        <main className="mail-window__messages">
          <form className="mail-window__search" onSubmit={(event) => void handleSearch(event)}>
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索邮件"
            />
          </form>

          <div className="mail-window__message-list">
            {isLoading ? <div className="mail-window__empty">加载中</div> : null}
            {!isLoading && messages.length === 0 ? (
              <div className="mail-window__empty">
                {selectedAccount ? '当前邮箱暂无邮件' : '暂无邮件'}
              </div>
            ) : null}
            {messages.map((message) => (
              <button
                type="button"
                key={message.id}
                className={
                  message.id === selectedMessageId ? 'mail-message is-active' : 'mail-message'
                }
                onClick={() => setSelectedMessageId(message.id)}
              >
                <span className="mail-message__from">
                  {message.fromAddress || providerLabel(message.provider)}
                </span>
                <strong>{message.subject || '无主题'}</strong>
                <small>{message.snippet}</small>
                <em>{formatMailDate(message.sentAt)}</em>
              </button>
            ))}
          </div>
        </main>

        <article className="mail-window__detail">
          {selectedMessage ? (
            <>
              <div className="mail-window__detail-head">
                <span>{providerLabel(selectedMessage.provider)}</span>
                <time>{formatMailDate(selectedMessage.sentAt)}</time>
              </div>
              <h3>{selectedMessage.subject || '无主题'}</h3>
              <p className="mail-window__from">{selectedMessage.fromAddress}</p>
              <pre>{selectedMessage.textBody || selectedMessage.snippet || '暂无正文预览'}</pre>
            </>
          ) : (
            <div className="mail-window__empty">选择一封邮件</div>
          )}
        </article>
      </div>
    </section>
  );
}

function providerLabel(provider: string) {
  if (provider === 'gmail') return 'Gmail';
  if (provider === 'qq_imap') return 'QQ 邮箱';
  return '邮箱';
}

function statusLabel(status: string) {
  if (status === 'connected') return '已绑定';
  if (status === 'error') return '需处理';
  return '待同步';
}

function formatMailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}
