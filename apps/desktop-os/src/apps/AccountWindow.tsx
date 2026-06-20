import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useResourceStore } from '../store/resourceStore';
import './DockAppWindows.css';

export default function AccountWindow() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const refreshResources = useResourceStore((s) => s.refreshResources);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  async function handleLogout() {
    logout();
    await refreshResources();
  }

  if (isAuthenticated && user) {
    return (
      <div className="dock-app-window account-window">
        <header className="account-window__header">
          <img
            className="account-window__avatar"
            src={user.avatar || '/icons/keychain.png'}
            alt=""
          />
          <div>
            <div className="dock-app-window__eyebrow">账户</div>
            <h2>{user.nickname || user.username}</h2>
            <p>{user.email || user.role}</p>
          </div>
        </header>

        <section className="account-window__panel">
          <div className="account-window__row">
            <span>用户名</span>
            <strong>{user.username}</strong>
          </div>
          <div className="account-window__row">
            <span>角色</span>
            <strong>{user.role}</strong>
          </div>
        </section>

        <button type="button" className="dock-app-window__button" onClick={handleLogout}>
          退出登录
        </button>
      </div>
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

      <button type="submit" className="dock-app-window__button" disabled={isLoading}>
        {isLoading ? '登录中' : '登录'}
      </button>
    </form>
  );
}
