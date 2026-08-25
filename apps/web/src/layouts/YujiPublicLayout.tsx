import { ChevronDown, LogIn, Menu, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { OwnerSessionMenu } from '@/components/auth/OwnerSessionMenu';
import { GlobalCommandPalette } from '@/components/search/GlobalCommandPalette';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { resolveThemeMode, useThemeStore } from '@/stores/useThemeStore';
import '@/styles/yuji.css';

const PUBLIC_NAVIGATION: ReadonlyArray<{ to: string; label: string; end?: boolean }> = [
  { to: '/', label: '首页', end: true },
  { to: '/articles', label: '文章' },
  { to: '/gallery', label: '图库' },
  { to: '/about', label: '关于' },
];

export default function YujiPublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerSurface, setHeaderSurface] = useState<YujiHeaderSurface>('stage');
  const location = useLocation();
  const isHomeStage = location.pathname === '/';
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const showSessionMenu = hasHydrated && isAuthenticated;
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const publicTheme = resolveThemeMode(themeMode);
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
                  <button
                    className="yuji-search-link"
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    aria-label="搜索文章与影像"
                    aria-expanded={searchOpen}
                    aria-haspopup="dialog"
                  >
                    <Search aria-hidden="true" />
                    <span>搜索</span>
                  </button>
                  {showSessionMenu ? (
                    <OwnerSessionMenu
                      trigger={({ name, avatar, avatarFallback }) => (
                        <button
                          type="button"
                          className="yuji-account-menu"
                          aria-label={`打开${name}的账户菜单`}
                        >
                          <Avatar className="size-6">
                            <AvatarImage src={avatar} alt="" />
                            <AvatarFallback>{avatarFallback}</AvatarFallback>
                          </Avatar>
                          <span className="yuji-account-name">{name}</span>
                          <ChevronDown className="yuji-account-chevron" aria-hidden="true" />
                        </button>
                      )}
                    />
                  ) : hasHydrated ? (
                    <NavLink className="yuji-studio-link" to="/login">
                      <LogIn aria-hidden="true" />
                      <span>登录</span>
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
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setSearchOpen(true);
                  }}
                >
                  搜索
                </button>
                {showSessionMenu ? (
                  <NavLink to="/studio" onClick={() => setMobileOpen(false)}>
                    创作室
                  </NavLink>
                ) : hasHydrated ? (
                  <NavLink to="/login" onClick={() => setMobileOpen(false)}>
                    登录
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
            <GlobalCommandPalette open={searchOpen} onOpenChange={setSearchOpen} variant="yuji" />
          </div>
        </YujiPublicStageProvider>
      </YujiPublicTransitionProvider>
    </YujiPublicChromeContext.Provider>
  );
}
