import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bindQQMailAccount,
  deleteMailAccount,
  listMailAccounts,
  type MailAccount,
  startGmailBinding,
} from '../api/mail';
import { useAuthStore } from '../store/authStore';
import { useResourceStore } from '../store/resourceStore';
import PlushConfirmDialog from '../ui/PlushConfirmDialog';
import { PlushButton } from '../ui/PlushPrimitives';
import './DockAppWindows.css';

export default function AccountWindow() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const saveProfile = useAuthStore((s) => s.saveProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);
  const refreshResources = useResourceStore((s) => s.refreshResources);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState('');
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);
  const [qqEmail, setQQEmail] = useState('');
  const [qqAuthorizationCode, setQQAuthorizationCode] = useState('');
  const [mailStatus, setMailStatus] = useState('');
  const [mailLoading, setMailLoading] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [pendingUnbindAccountId, setPendingUnbindAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setNickname(user.nickname || '');
    setPhone(user.phone || '');
    setProfileEmail(user.email || '');
    setSaveStatus('idle');
  }, [user]);

  const refreshMailAccounts = useCallback(async () => {
    if (!token) return;
    try {
      const result = await listMailAccounts(token);
      setMailAccounts(result.list);
    } catch (mailError) {
      setMailStatus(mailError instanceof Error ? mailError.message : '邮箱账号加载失败');
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await login(email, password);
      await refreshResources();
      setPassword('');
    } catch {
      // 错误状态由 authStore 展示。
    }
  }

  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await saveProfile({
        nickname: nickname.trim(),
        email: profileEmail.trim(),
        phone: phone.trim(),
      });
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1800);
    } catch {
      // 错误状态由 authStore 展示。
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarStatus('请选择图片文件');
      e.currentTarget.value = '';
      return;
    }

    try {
      setAvatarUploading(true);
      setAvatarStatus(file.name);
      await uploadAvatar(file);
      setAvatarStatus('头像已更新');
      window.setTimeout(() => setAvatarStatus(''), 1800);
    } catch {
      // 错误状态由 authStore 展示。
    } finally {
      setAvatarUploading(false);
      e.currentTarget.value = '';
    }
  }

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setMailAccounts([]);
      return;
    }
    void refreshMailAccounts();
  }, [token, isAuthenticated, refreshMailAccounts]);

  async function handleStartGmailBinding() {
    if (!token) return;
    try {
      setMailLoading(true);
      setMailStatus('');
      const result = await startGmailBinding(token);
      window.open(result.authUrl, '_blank', 'noopener,noreferrer');
      setMailStatus('Gmail 授权页已打开');
    } catch (mailError) {
      setMailStatus(mailError instanceof Error ? mailError.message : 'Gmail 绑定失败');
    } finally {
      setMailLoading(false);
    }
  }

  async function handleBindQQMail() {
    if (!token) return;
    try {
      setMailLoading(true);
      setMailStatus('');
      await bindQQMailAccount(
        {
          email: qqEmail.trim(),
          authorizationCode: qqAuthorizationCode.trim(),
        },
        token,
      );
      setQQAuthorizationCode('');
      setMailStatus('QQ 邮箱已绑定');
      await refreshMailAccounts();
    } catch (mailError) {
      setMailStatus(mailError instanceof Error ? mailError.message : 'QQ 邮箱绑定失败');
    } finally {
      setMailLoading(false);
    }
  }

  async function handleDeleteMailAccount(accountId: string) {
    if (!token) return;
    try {
      setMailLoading(true);
      setMailStatus('');
      await deleteMailAccount(accountId, token);
      await refreshMailAccounts();
    } catch (mailError) {
      setMailStatus(mailError instanceof Error ? mailError.message : '解绑失败');
    } finally {
      setMailLoading(false);
    }
  }

  if (isAuthenticated && user) {
    const displayName = nickname.trim() || user.nickname || user.username;
    const avatarInitial = (displayName[0] || 'V').toUpperCase();
    const roleLabel = getRoleLabel(user.role);

    return (
      <>
        <form
          className="dock-app-window account-window account-window--profile"
          onSubmit={handleProfileSubmit}
        >
          <header className="account-window__hero">
            <div className="account-window__identity">
              <button
                type="button"
                className="account-window__avatar-button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label="更换头像"
              >
                {user.avatar ? (
                  <img
                    className="account-window__avatar"
                    src={user.avatar}
                    alt={`${displayName} 头像`}
                  />
                ) : (
                  <span className="account-window__avatar-fallback">{avatarInitial}</span>
                )}
                <span className="account-window__avatar-action">
                  {avatarUploading ? '上传中' : '更换'}
                </span>
              </button>
              <input
                ref={avatarInputRef}
                className="account-window__file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => void handleAvatarChange(event)}
              />
              <div className="account-window__title-block">
                <div className="dock-app-window__eyebrow">个人账户</div>
                <h2>{displayName}</h2>
                <p>{profileEmail || user.email || user.username}</p>
              </div>
            </div>
            <div className="account-window__role-badge">{roleLabel}</div>
          </header>

          <div className="account-window__content">
            <section className="account-window__panel account-window__summary">
              <div className="account-window__summary-item">
                <span>用户名</span>
                <strong>{user.username}</strong>
              </div>
              <div className="account-window__summary-item">
                <span>下载记录</span>
                <strong>{user.downloadCount ?? 0}</strong>
              </div>
              {user.creatorCode ? (
                <div className="account-window__summary-item account-window__summary-item--wide">
                  <span>创作者口令</span>
                  <strong>{user.creatorCode}</strong>
                </div>
              ) : null}
              {avatarStatus ? (
                <div className="account-window__avatar-status">{avatarStatus}</div>
              ) : null}
            </section>

            <section className="account-window__form" aria-label="个人资料">
              <label className="account-window__field account-window__field--wide">
                <span>昵称</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  autoComplete="nickname"
                  maxLength={50}
                />
              </label>
              <label className="account-window__field">
                <span>邮箱</span>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="account-window__field">
                <span>电话</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
            </section>
          </div>

          <section className="account-window__panel account-window__mail" aria-label="邮箱绑定">
            <div className="account-window__section-head">
              <div>
                <div className="dock-app-window__eyebrow">邮箱绑定</div>
                <strong>{mailAccounts.length} 个邮箱</strong>
              </div>
              <PlushButton
                type="button"
                unstyled
                className="dock-app-window__button"
                loading={mailLoading}
                loadingLabel="处理中"
                onClick={() => void handleStartGmailBinding()}
              >
                绑定 Gmail
              </PlushButton>
            </div>

            <div className="account-window__mail-grid">
              <label className="account-window__field">
                <span>QQ 邮箱</span>
                <input
                  type="email"
                  value={qqEmail}
                  onChange={(e) => setQQEmail(e.target.value)}
                  placeholder="name@qq.com"
                />
              </label>
              <label className="account-window__field">
                <span>授权码</span>
                <input
                  type="password"
                  value={qqAuthorizationCode}
                  onChange={(e) => setQQAuthorizationCode(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <PlushButton
                type="button"
                unstyled
                className="dock-app-window__button"
                loading={mailLoading}
                loadingLabel="绑定中"
                disabled={!qqEmail.trim() || !qqAuthorizationCode.trim()}
                onClick={() => void handleBindQQMail()}
              >
                绑定 QQ 邮箱
              </PlushButton>
            </div>

            <div className="account-window__mail-list">
              {mailAccounts.length === 0 ? (
                <div className="account-window__mail-empty">暂无绑定邮箱</div>
              ) : null}
              {mailAccounts.map((account) => (
                <div className="account-window__mail-account" key={account.id}>
                  <span>
                    <strong>{account.email}</strong>
                    <small>
                      {getMailProviderLabel(account.provider)} ·{' '}
                      {getMailStatusLabel(account.status)}
                    </small>
                  </span>
                  <PlushButton
                    type="button"
                    unstyled
                    loading={mailLoading}
                    loadingLabel="处理中"
                    onClick={() => setPendingUnbindAccountId(account.id)}
                  >
                    解绑
                  </PlushButton>
                </div>
              ))}
            </div>
            {mailStatus ? <div className="account-window__avatar-status">{mailStatus}</div> : null}
          </section>

          {error && <div className="account-window__error">{error}</div>}
          {saveStatus === 'saved' && <div className="account-window__success">已保存</div>}

          <div className="account-window__actions">
            <PlushButton
              type="submit"
              unstyled
              className="dock-app-window__button"
              loading={isLoading}
              loadingLabel="保存中"
            >
              保存资料
            </PlushButton>
            <PlushButton
              type="button"
              unstyled
              className="dock-app-window__button account-window__logout"
              onClick={() => setLogoutConfirmOpen(true)}
            >
              退出登录
            </PlushButton>
          </div>
        </form>
        <PlushConfirmDialog
          open={logoutConfirmOpen}
          onOpenChange={setLogoutConfirmOpen}
          tone="danger"
          title="确认退出登录？"
          description="退出后将清空当前账号会话，需要重新登录才能访问个人资源与邮箱。"
          confirmLabel="退出"
          loadingLabel="退出中"
          onConfirm={async () => {
            logout();
            await refreshResources();
          }}
        />
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
            await handleDeleteMailAccount(pendingUnbindAccountId);
            setPendingUnbindAccountId(null);
          }}
        />
      </>
    );
  }

  return (
    <form className="dock-app-window account-window" onSubmit={handleSubmit}>
      <header className="account-window__header">
        <img className="account-window__avatar" src="/icons/keychain.png" alt="" />
        <div>
          <div className="dock-app-window__eyebrow">账户</div>
          <h2>登录 Valley</h2>
          <p>登录后可同步收藏和下载记录。</p>
        </div>
      </header>

      <label className="account-window__field">
        <span>邮箱</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label className="account-window__field">
        <span>密码</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {error && <div className="account-window__error">{error}</div>}

      <PlushButton
        type="submit"
        unstyled
        className="dock-app-window__button"
        loading={isLoading}
        loadingLabel="登录中"
      >
        登录
      </PlushButton>
    </form>
  );
}

function getRoleLabel(role: string) {
  if (role === 'admin') return '管理员';
  if (role === 'creator') return '创作者';
  return '普通用户';
}

function getMailProviderLabel(provider: string) {
  if (provider === 'gmail') return 'Gmail';
  if (provider === 'qq_imap') return 'QQ 邮箱';
  return '邮箱';
}

function getMailStatusLabel(status: string) {
  if (status === 'connected') return '已绑定';
  if (status === 'error') return '需处理';
  return '待同步';
}
