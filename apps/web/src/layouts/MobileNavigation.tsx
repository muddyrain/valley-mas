import {
  Check,
  ChevronRight,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logout } from '@/api/auth';
import BrandLogo from '@/components/BrandLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ThemeMode } from '@/stores/useThemeStore';
import { isNavigationActive, navigationGroups } from './navigation';

const themeOptions: Array<{ mode: ThemeMode; label: string; icon: typeof Monitor }> = [
  { mode: 'system', label: '跟随系统', icon: Monitor },
  { mode: 'light', label: '浅色模式', icon: Sun },
  { mode: 'dark', label: '深色模式', icon: Moon },
];

const accountLinks = [{ to: '/studio', label: '创作室', icon: Sparkles }];

const bottomItems = [
  navigationGroups[0].items[0],
  navigationGroups[0].items[1],
  navigationGroups[0].items[2],
  navigationGroups[1].items[1],
];

export function MobileNavigation({ onSearchOpen }: { onSearchOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: clearAuth } = useAuthStore();
  const { mode, setMode } = useTheme();
  const userName = user?.nickname || user?.username || '用户';
  const avatarFallback = (user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase();
  const accountActive = accountLinks.some((item) => isNavigationActive(location.pathname, item.to));

  const closeDrawer = () => setOpen(false);
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearAuth();
      closeDrawer();
      toast.success('退出登录成功');
      navigate('/login');
    }
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 grid h-14 grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="打开导航"
          onClick={() => setOpen(true)}
          className="justify-self-start"
        >
          <Menu />
        </Button>
        <Link to="/" className="flex items-center justify-self-center" aria-label="Valley 首页">
          <BrandLogo iconClassName="size-6" showWordmark={false} />
        </Link>
        <div className="flex items-center justify-self-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="搜索 Valley"
            onClick={onSearchOpen}
          >
            <Search />
          </Button>
          <Link
            to={isAuthenticated ? '/studio' : '/login'}
            aria-label={isAuthenticated ? '创作室' : '登录'}
            className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {isAuthenticated ? (
              <Avatar className="size-8">
                <AvatarImage src={user?.avatar} alt={userName} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
            ) : (
              <LogIn className="size-5" />
            )}
          </Link>
        </div>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(20rem,88vw)] gap-0 p-0" showCloseButton>
          <SheetHeader className="border-b border-border pr-14">
            <SheetTitle>导航</SheetTitle>
            <SheetDescription>浏览与创作</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {navigationGroups.map((group) => (
              <section key={group.label} className="mb-5 last:mb-0">
                <h2 className="px-3 pb-2 text-xs font-medium text-muted-foreground">
                  {group.label}
                </h2>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavigationActive(location.pathname, item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={closeDrawer}
                        className={`flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                        <ChevronRight className="ml-auto size-4 text-muted-foreground" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="border-t border-border pt-5">
              <h2 className="px-3 pb-2 text-xs font-medium text-muted-foreground">外观</h2>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = option.mode === mode;
                  return (
                    <Button
                      key={option.mode}
                      type="button"
                      variant={selected ? 'secondary' : 'outline'}
                      className="h-11 gap-1 px-2 text-xs"
                      onClick={() => setMode(option.mode)}
                    >
                      <Icon className="size-4" />
                      {selected ? <Check className="size-3" /> : null}
                      <span className="sr-only">{option.label}</span>
                    </Button>
                  );
                })}
              </div>
            </section>

            <section className="mt-5 border-t border-border pt-5">
              <h2 className="px-3 pb-2 text-xs font-medium text-muted-foreground">账户</h2>
              {isAuthenticated ? (
                <div className="space-y-1">
                  {accountLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={closeDrawer}
                        className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-start gap-3 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void handleLogout()}
                  >
                    <LogOut className="size-4" />
                    退出登录
                  </Button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={closeDrawer}
                  className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogIn className="size-4" />
                  登录 / 注册
                </Link>
              )}
            </section>
          </div>
        </SheetContent>
      </Sheet>

      <nav
        aria-label="主导航"
        className="fixed inset-x-0 bottom-0 z-40 grid min-h-16 grid-cols-5 border-t border-border bg-background/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isNavigationActive(location.pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <Icon className="size-5" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <Link
          to={isAuthenticated ? '/studio' : '/login'}
          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition-colors ${
            accountActive ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          <User className="size-5" />
          <span>我的</span>
        </Link>
      </nav>
    </>
  );
}
