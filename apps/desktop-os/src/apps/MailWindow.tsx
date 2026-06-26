import { Inbox, RefreshCw, Search, Trash2 } from 'lucide-react';
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
import EmptyState from '../ui/EmptyState';
import PlushConfirmDialog from '../ui/PlushConfirmDialog';
import PlushLoading from '../ui/PlushLoading';
import './DockAppWindows.css';
import MailBodyText from './MailBodyText';
import MailHTMLFrame from './MailHTMLFrame';

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
  const [pendingUnbindAccountId, setPendingUnbindAccountId] = useState<string | null>(null);

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
    <>
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
            <div className="mail-window__accounts-scroll">
              <button
                type="button"
                className={
                  selectedAccountId === ALL_INBOX
                    ? 'mail-window__account-card is-active'
                    : 'mail-window__account-card'
                }
                onClick={() => setSelectedAccountId(ALL_INBOX)}
              >
                <span className="mail-window__account-icon">
                  <Inbox size={15} />
                </span>
                <span className="mail-window__account-copy">
                  <span>统一收件箱</span>
                  <small>{messages.length} 封邮件</small>
                </span>
              </button>
              {accounts.map((account) => (
                <div className="mail-window__account-row" key={account.id}>
                  <button
                    type="button"
                    className={
                      selectedAccountId === account.id
                        ? 'mail-window__account-card is-active'
                        : 'mail-window__account-card'
                    }
                    onClick={() => setSelectedAccountId(account.id)}
                  >
                    <span className={`mail-window__account-icon ${providerTone(account.provider)}`}>
                      {providerInitial(account.provider)}
                    </span>
                    <span className="mail-window__account-copy">
                      <span>{account.email}</span>
                      <small className={account.status === 'error' ? 'is-error' : ''}>
                        {providerLabel(account.provider)} · {statusLabel(account.status)}
                      </small>
                    </span>
                  </button>
                  <span className="mail-window__account-actions">
                    <button
                      type="button"
                      className="mail-window__tiny"
                      onClick={() => void handleSync(account.id)}
                      disabled={Boolean(isSyncing)}
                      aria-label="同步邮箱"
                      title="同步邮箱"
                    >
                      <RefreshCw
                        size={13}
                        className={isSyncing === account.id ? 'is-spinning' : ''}
                      />
                    </button>
                    <button
                      type="button"
                      className="mail-window__tiny"
                      onClick={() => setPendingUnbindAccountId(account.id)}
                      aria-label="解绑邮箱"
                      title="解绑邮箱"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
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
              {isLoading ? <PlushLoading variant="inline" title="加载中" /> : null}
              {!isLoading && messages.length === 0 ? (
                <EmptyState title={selectedAccount ? '当前邮箱暂无邮件' : '暂无邮件'} />
              ) : null}
              {messages.map((message) => (
                <button
                  type="button"
                  key={message.id}
                  className={
                    message.id === selectedMessageId
                      ? 'mail-message is-active'
                      : message.isRead
                        ? 'mail-message'
                        : 'mail-message is-unread'
                  }
                  onClick={() => setSelectedMessageId(message.id)}
                >
                  <span className="mail-message__meta">
                    <span className="mail-message__from">
                      <span className="mail-message__dot" />
                      {senderName(message.fromAddress) || providerLabel(message.provider)}
                    </span>
                    <time>{formatMailDate(message.sentAt)}</time>
                  </span>
                  <span className="mail-message__subject-row">
                    <strong>{message.subject || '无主题'}</strong>
                    <span className={`mail-message__provider ${providerTone(message.provider)}`}>
                      {providerLabel(message.provider)}
                    </span>
                  </span>
                  <small>{message.snippet || '暂无摘要'}</small>
                </button>
              ))}
            </div>
          </main>

          <article className="mail-window__detail mail-window__reader">
            {selectedMessage ? (
              <>
                <div className="mail-window__detail-head">
                  <span
                    className={`mail-message__provider ${providerTone(selectedMessage.provider)}`}
                  >
                    {providerLabel(selectedMessage.provider)}
                  </span>
                  <time>{formatMailDateTime(selectedMessage.sentAt)}</time>
                </div>
                <h3>{selectedMessage.subject || '无主题'}</h3>
                <div className="mail-window__from">
                  <span className="mail-window__sender-avatar">
                    {senderInitial(selectedMessage.fromAddress || selectedMessage.subject)}
                  </span>
                  <span>
                    <strong>{senderName(selectedMessage.fromAddress) || '未知发件人'}</strong>
                    <small>{selectedMessage.fromAddress || '发件人未显示'}</small>
                  </span>
                </div>
                <div className="mail-window__reader-body">
                  {selectedMessage.htmlBody ? (
                    <MailHTMLFrame
                      html={selectedMessage.htmlBody}
                      title={selectedMessage.subject || '邮件正文'}
                    />
                  ) : (
                    <MailBodyText text={selectedMessage.textBody || selectedMessage.snippet} />
                  )}
                </div>
              </>
            ) : (
              <EmptyState title="选择一封邮件" />
            )}
          </article>
        </div>
      </section>
      <PlushConfirmDialog
        open={pendingUnbindAccountId !== null}
        onOpenChange={(next) => {
          if (!next) setPendingUnbindAccountId(null);
        }}
        tone="danger"
        title="解绑该邮箱？"
        description="解绑后该邮箱将不再同步邮件，可随时重新绑定。"
        confirmLabel="解绑"
        loadingLabel="解绑中"
        onConfirm={async () => {
          if (!pendingUnbindAccountId) return;
          await handleDeleteAccount(pendingUnbindAccountId);
          setPendingUnbindAccountId(null);
        }}
      />
    </>
  );
}

function providerLabel(provider: string) {
  if (provider === 'gmail') return 'Gmail';
  if (provider === 'qq_imap') return 'QQ 邮箱';
  return '邮箱';
}

function providerInitial(provider: string) {
  if (provider === 'gmail') return 'G';
  if (provider === 'qq_imap') return 'Q';
  return 'M';
}

function providerTone(provider: string) {
  if (provider === 'gmail') return 'is-gmail';
  if (provider === 'qq_imap') return 'is-qq';
  return 'is-mail';
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

function formatMailDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function senderName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^"?([^"<]+)"?\s*</);
  return (match?.[1] ?? trimmed.split('<')[0]).trim();
}

function senderInitial(value: string) {
  const name = senderName(value) || value.trim() || 'M';
  return name.slice(0, 1).toUpperCase();
}
