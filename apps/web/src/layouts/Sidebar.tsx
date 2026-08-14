import {
  Check,
  ChevronDown,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  Sun,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logout } from '@/api/auth';
import BrandLogo from '@/components/BrandLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import type { ThemeMode } from '@/stores/useThemeStore';
import { isNavigationActive, navigationGroups } from './navigation';

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: typeof Monitor }> = [
  { mode: 'system', label: '跟随系统', icon: Monitor },
  { mode: 'light', label: '浅色模式', icon: Sun },
  { mode: 'dark', label: '深色模式', icon: Moon },
];

export function Sidebar({ onSearchOpen }: { onSearchOpen: () => void }) {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggle = useLayoutStore((s) => s.toggleSidebar);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: logoutStore } = useAuthStore();
  const { mode, setMode } = useTheme();
  const currentTheme = themeOptions.find((option) => option.mode === mode) ?? themeOptions[0];
  const CurrentThemeIcon = currentTheme.icon;

  const handleLogout = async () => {
    try {
      await logout();
      logoutStore();
      toast.success('退出登录成功');
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      logoutStore();
      toast.success('退出登录成功');
      navigate('/login');
    }
  };

  const userName = user?.nickname || user?.username || '用户';
  const userAvatarFallback = (user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase();

  return (
    <aside
      className={`relative hidden h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex ${
        collapsed ? 'w-14' : 'w-56 max-md:w-12'
      }`}
    >
      {/* Brand */}
      <div
        className={`relative flex h-14 items-center border-b border-border ${
          collapsed ? 'justify-start px-2' : 'px-3 max-md:justify-center'
        }`}
      >
        <Link
          to="/"
          className={`flex items-center gap-2 overflow-hidden ${
            collapsed ? 'size-8 justify-center' : 'max-md:justify-center'
          }`}
        >
          <BrandLogo
            className="shrink-0"
            iconClassName={collapsed ? 'h-6 w-6' : 'h-7 w-7 max-md:h-5 max-md:w-5'}
            showWordmark={false}
          />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight text-foreground max-md:hidden">
              Valley
            </span>
          )}
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={toggle}
          aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
          className={
            collapsed
              ? 'absolute top-1/2 -right-3 z-10 -translate-y-1/2 bg-background shadow-xs ring-1 ring-border'
              : 'ml-auto max-md:hidden'
          }
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <div className="px-2 pt-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="搜索 Valley"
                  onClick={onSearchOpen}
                  className="size-8 text-muted-foreground hover:text-foreground"
                >
                  <Search />
                </Button>
              }
            />
            <TooltipContent side="right" sideOffset={8}>
              搜索
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="button"
            variant="outline"
            aria-label="搜索 Valley"
            onClick={onSearchOpen}
            className="h-9 w-full justify-start gap-2 px-2.5 text-muted-foreground"
          >
            <Search />
            <span>搜索</span>
            <Kbd className="ml-auto">Ctrl K</Kbd>
          </Button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 px-2 py-4">
        {navigationGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 text-xs font-medium text-muted-foreground max-md:hidden">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isNavigationActive(location.pathname, item.to);
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={`flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  } ${collapsed ? 'size-8 justify-center p-0' : 'max-md:size-8 max-md:justify-center max-md:p-0'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate max-md:hidden">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.to}>
                    <TooltipTrigger render={link} />
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size={collapsed ? 'icon' : 'default'}
                aria-label={`主题：${currentTheme.label}`}
                title={`主题：${currentTheme.label}`}
                className={
                  collapsed
                    ? 'h-10 w-10'
                    : 'h-10 w-full justify-start gap-3 px-3 text-muted-foreground hover:text-foreground max-md:size-8 max-md:justify-center max-md:px-0'
                }
              >
                <CurrentThemeIcon className="h-4 w-4" />
                {!collapsed && <span className="max-md:sr-only">{currentTheme.label}</span>}
                {!collapsed && <ChevronDown className="ml-auto h-4 w-4 max-md:hidden" />}
              </Button>
            }
          />
          <DropdownMenuContent
            align="start"
            side={collapsed ? 'right' : 'top'}
            className="w-40 border-border bg-popover p-1"
          >
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.mode}
                  onClick={() => setMode(option.mode)}
                  className="gap-2 rounded-lg py-2"
                >
                  <Icon className="h-4 w-4" />
                  <span>{option.label}</span>
                  {mode === option.mode && <Check className="ml-auto h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User area */}
      <div className="flex px-2 pb-2">
        {isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                collapsed ? (
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-muted"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar} alt={userName} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userAvatarFallback}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted max-md:size-8 max-md:justify-center max-md:p-0"
                  >
                    <Avatar className="h-8 w-8 max-md:h-7 max-md:w-7">
                      <AvatarImage src={user?.avatar} alt={userName} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userAvatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-foreground max-md:hidden">{userName}</span>
                  </button>
                )
              }
            ></DropdownMenuTrigger>
            <DropdownMenuContent
              align={collapsed ? 'end' : 'start'}
              side={collapsed ? 'right' : 'top'}
              className="w-56 border-border bg-popover p-1"
            >
              <DropdownMenuItem
                onClick={() => navigate('/studio')}
                className="gap-2 rounded-lg py-2"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>创作室</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 rounded-lg bg-destructive/10 py-2 text-destructive hover:bg-destructive/15 hover:text-destructive focus:bg-destructive/15 focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>退出登录</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Link to="/login">
                  <Button size="icon" variant="outline" className="h-10 w-10 rounded-lg">
                    <LogIn className="h-4 w-4" />
                  </Button>
                </Link>
              }
            ></TooltipTrigger>
            <TooltipContent side="right">登录 / 注册</TooltipContent>
          </Tooltip>
        ) : (
          <Link to="/login" className="w-full max-md:flex max-md:justify-center">
            <Button variant="outline" className="w-full max-md:size-8 max-md:p-0">
              <LogIn className="mr-2 h-4 w-4" />
              <span className="max-md:sr-only">登录 / 注册</span>
            </Button>
          </Link>
        )}
      </div>
    </aside>
  );
}
