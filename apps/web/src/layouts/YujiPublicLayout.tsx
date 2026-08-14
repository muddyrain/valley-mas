import { Menu, PenLine, Search, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import '@/styles/yuji.css';

const PUBLIC_NAVIGATION: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: '首页', end: true },
  { to: '/articles', label: '文章' },
  { to: '/gallery', label: '图库' },
  { to: '/about', label: '关于' },
];

export default function YujiPublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const showStudioEntry = useAuthStore((state) => state.hasHydrated && state.isAuthenticated);

  return (
    <div className="yuji-site">
      <a className="yuji-skip-link" href="#yuji-main">
        跳到主要内容
      </a>
      <header className="yuji-header">
        <div className="yuji-header-inner">
          <NavLink className="yuji-brand" to="/" end aria-label="雨迹首页">
            <span className="yuji-brand-name">雨迹</span>
            <span className="yuji-brand-caption">文章与影像</span>
          </NavLink>

          <nav className="yuji-desktop-nav" aria-label="主要导航">
            {PUBLIC_NAVIGATION.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="yuji-header-actions">
            <NavLink className="yuji-search-link" to="/search" aria-label="搜索文章与影像">
              <Search aria-hidden="true" />
              <span>搜索</span>
            </NavLink>
            {showStudioEntry ? (
              <NavLink className="yuji-studio-link" to="/studio">
                <PenLine aria-hidden="true" />
                <span>创作室</span>
              </NavLink>
            ) : null}
            <a
              className="yuji-byline"
              href="https://github.com/muddyrain"
              target="_blank"
              rel="noreferrer"
            >
              by @muddyrain ↗
            </a>
            <button
              className="yuji-menu-button"
              type="button"
              onClick={() => setMobileOpen((value) => !value)}
              aria-expanded={mobileOpen}
              aria-controls="yuji-mobile-navigation"
              aria-label={mobileOpen ? '关闭导航' : '打开导航'}
            >
              {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </div>

        <nav
          id="yuji-mobile-navigation"
          className={`yuji-mobile-nav ${mobileOpen ? 'is-open' : ''}`}
          aria-label="移动端导航"
        >
          {PUBLIC_NAVIGATION.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/search" onClick={() => setMobileOpen(false)}>
            搜索
          </NavLink>
          {showStudioEntry ? (
            <NavLink to="/studio" onClick={() => setMobileOpen(false)}>
              创作室
            </NavLink>
          ) : null}
        </nav>
      </header>

      <div id="yuji-main">
        <Outlet />
      </div>

      <footer className="yuji-footer">
        <div>
          <span className="yuji-brand-name">雨迹</span>
          <p>文章与影像，在值得留下时更新。</p>
        </div>
        <div className="yuji-footer-links">
          <NavLink to="/articles">文章</NavLink>
          <NavLink to="/gallery">图库</NavLink>
          <a href="https://github.com/muddyrain" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
