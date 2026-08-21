import { Menu, PenLine, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import YujiPixelTrail from '@/components/yuji/YujiPixelTrail';
import {
  type YujiHeaderSurface,
  YujiPublicChromeContext,
} from '@/features/yuji-public/YujiPublicChromeContext';
import { YujiPublicStageProvider } from '@/features/yuji-stage/YujiPublicStageProvider';
import {
  YujiPublicTransitionProvider,
  YujiTransitionNavLink,
} from '@/features/yuji-transition/YujiPublicTransition';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import '@/styles/yuji.css';

const PUBLIC_NAVIGATION: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/articles', label: '文章' },
  { to: '/gallery', label: '图库' },
  { to: '/about', label: '关于' },
];

export default function YujiPublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [headerSurface, setHeaderSurface] = useState<YujiHeaderSurface>('stage');
  const location = useLocation();
  const isHomeStage = location.pathname === '/';
  const showStudioEntry = useAuthStore((state) => state.hasHydrated && state.isAuthenticated);
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const isArticleDetail = /^\/articles\/[^/]+/.test(location.pathname);
  const publicTheme = themeMode === 'system' ? (isArticleDetail ? 'dark' : 'light') : themeMode;
  const toggleTheme = () => setThemeMode(publicTheme === 'dark' ? 'light' : 'dark');
  const chromeValue = useMemo(() => ({ setHeaderSurface }), []);

  useEffect(() => {
    setMobileOpen(false);
    setHeaderSurface(isHomeStage ? 'stage' : 'content');
  }, [isHomeStage]);

  return (
    <YujiPublicChromeContext.Provider value={chromeValue}>
      <YujiPublicTransitionProvider>
        <YujiPublicStageProvider theme={publicTheme}>
          <div
            className={`yuji-site ${isHomeStage ? 'has-home-stage' : ''}`}
            data-public-theme={publicTheme}
          >
            {isHomeStage ? <YujiPixelTrail /> : null}
            <a className="yuji-skip-link" href="#yuji-main">
              跳到主要内容
            </a>
            <header
              className={`yuji-header ${isHomeStage ? 'is-home-stage' : ''}`}
              data-surface={isHomeStage ? headerSurface : 'content'}
            >
              <div className="yuji-header-inner">
                <YujiTransitionNavLink className="yuji-brand" to="/" end aria-label="雨迹首页">
                  <span className="yuji-brand-name">雨迹</span>
                  <span className="yuji-brand-caption">YUJI® / 2026</span>
                </YujiTransitionNavLink>

                <nav className="yuji-desktop-nav" aria-label="主要导航">
                  {PUBLIC_NAVIGATION.map((item) => (
                    <YujiTransitionNavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => (isActive ? 'is-active' : undefined)}
                    >
                      {item.label}
                    </YujiTransitionNavLink>
                  ))}
                </nav>

                <div className="yuji-header-actions">
                  <span className="yuji-live-signal" aria-hidden="true">
                    <i /> LIVE
                  </span>
                  <YujiTransitionNavLink
                    className="yuji-search-link"
                    to="/search"
                    aria-label="搜索文章与影像"
                  >
                    <Search aria-hidden="true" />
                    <span>搜索</span>
                  </YujiTransitionNavLink>
                  {showStudioEntry ? (
                    <NavLink className="yuji-studio-link" to="/studio">
                      <PenLine aria-hidden="true" />
                      <span>创作室</span>
                    </NavLink>
                  ) : null}
                  <button
                    className="yuji-theme-button"
                    type="button"
                    onClick={toggleTheme}
                    aria-label="切换明暗主题"
                    data-theme={publicTheme}
                  >
                    <span aria-hidden="true">THEME[{publicTheme === 'dark' ? 'L' : 'D'}]</span>
                  </button>
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
                  <YujiTransitionNavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </YujiTransitionNavLink>
                ))}
                <YujiTransitionNavLink to="/search" onClick={() => setMobileOpen(false)}>
                  搜索
                </YujiTransitionNavLink>
                {showStudioEntry ? (
                  <NavLink to="/studio" onClick={() => setMobileOpen(false)}>
                    创作室
                  </NavLink>
                ) : null}
                <button type="button" onClick={toggleTheme}>
                  切换主题
                </button>
              </nav>
            </header>

            <div id="yuji-main">
              <Outlet />
            </div>

            <footer className="yuji-footer">
              <div>
                <span className="yuji-brand-name">雨迹</span>
                <p>技术、影像与不断重写的理解。</p>
              </div>
              <p className="yuji-footer-signal" aria-hidden="true">
                YUJI © 2026
                <br />
                PUBLIC ARCHIVE / ONLINE
              </p>
              <div className="yuji-footer-links">
                <YujiTransitionNavLink to="/articles">文章</YujiTransitionNavLink>
                <YujiTransitionNavLink to="/gallery">图库</YujiTransitionNavLink>
                <a href="https://github.com/muddyrain" target="_blank" rel="noreferrer">
                  GitHub ↗
                </a>
              </div>
            </footer>
          </div>
        </YujiPublicStageProvider>
      </YujiPublicTransitionProvider>
    </YujiPublicChromeContext.Provider>
  );
}
