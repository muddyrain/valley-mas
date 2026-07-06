import {
  Bell,
  BookOpen,
  CheckCheck,
  Download,
  Heart,
  Home,
  ImageIcon,
  LogOut,
  Menu,
  MessageCircleHeart,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logout } from '@/api/auth';
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from '@/api/notification';
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
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import {
  emitNotificationStateChanged,
  formatNotificationTime,
  getNotificationVisual,
  NOTIFICATION_STATE_CHANGED_EVENT,
  type NotificationStateChangedDetail,
} from '@/utils/notification';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    logout: logoutStore,
    initAuth,
    refreshUserState,
    profileLoading,
  } = useAuthStore();
  const toggleMode = useThemeStore((state) => state.toggleMode);
  const mode = useThemeStore((state) => state.mode);
  const navItems = [
    { to: '/', label: '首页', icon: Home, active: location.pathname === '/' },
    {
      to: '/creators',
      label: '创作者',
      icon: Users,
      active: location.pathname.startsWith('/creators') || location.pathname.startsWith('/creator'),
    },
    {
      to: '/resources',
      label: '资源',
      icon: ImageIcon,
      active:
        location.pathname.startsWith('/resources') || location.pathname.startsWith('/resource'),
    },
    {
      to: '/blog',
      label: '博客',
      icon: BookOpen,
      active: location.pathname.startsWith('/blog'),
    },
    {
      to: '/guestbook',
      label: '留言墙',
      icon: MessageCircleHeart,
      active: location.pathname.startsWith('/guestbook'),
    },
  ];

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let timer: ReturnType<typeof setInterval> | undefined;
    const loadUnread = async () => {
      try {
        const res = await getUnreadNotificationCount();
        setUnreadCount(Number(res.unread || 0));
      } catch {
        // ignore
      }
    };

    loadUnread();
    timer = setInterval(loadUnread, 60000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNotificationStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<NotificationStateChangedDetail>).detail;
      if (typeof detail?.unreadCount === 'number') {
        setUnreadCount(Math.max(0, detail.unreadCount));
      }
    };

    window.addEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationStateChanged);
    return () => {
      window.removeEventListener(NOTIFICATION_STATE_CHANGED_EVENT, handleNotificationStateChanged);
    };
  }, [isAuthenticated]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 路由切换时需要重置移动端菜单状态。
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const loadNotifications = async () => {
    if (!isAuthenticated) return;
    setNotifyLoading(true);
    try {
      const res = await getMyNotifications(1, 8);
      setNotifications(res.list || []);
    } catch {
      // request.ts 已统一 toast
    } finally {
      setNotifyLoading(false);
    }
  };

  const handleMarkOneRead = async (item: UserNotification) => {
    if (item.isRead) return;
    try {
      await markNotificationRead(item.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => {
        const next = Math.max(0, prev - 1);
        emitNotificationStateChanged({ unreadCount: next });
        return next;
      });
    } catch {
      // request.ts 已统一 toast
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount <= 0) return;
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => (n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
      emitNotificationStateChanged({ unreadCount: 0 });
      toast.success('已全部标记为已读');
    } catch {
      // request.ts 已统一 toast
    }
  };

  const unreadLabel = useMemo(() => {
    if (unreadCount > 99) return '99+';
    return String(unreadCount);
  }, [unreadCount]);

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

  const handleRefreshUser = async () => {
    try {
      await refreshUserState();
      toast.success('已刷新用户信息');
    } catch {
      // store 内部已做容错
    }
  };

  const actionArea = (
    <>
      <button
        type="button"
        onClick={() => setMobileNavOpen((value) => !value)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors md:hidden ${
          mobileNavOpen
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent hover:text-accent-foreground'
        }`}
        aria-label={mobileNavOpen ? '关闭导航菜单' : '打开导航菜单'}
        aria-expanded={mobileNavOpen}
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={toggleMode}
        className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {mode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {isAuthenticated && (
        <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
          <DropdownMenuTrigger className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-primary">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1.5 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">
                {unreadLabel}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-86 border-border bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
            align="end"
          >
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <p className="text-sm font-semibold text-foreground">通知</p>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-primary inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                全部已读
              </button>
            </div>
            <DropdownMenuSeparator className="bg-border" />

            <div className="max-h-88 overflow-auto">
              {notifyLoading ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">加载中...</div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">暂无通知</div>
              ) : (
                notifications.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => handleMarkOneRead(item)}
                    className={`cursor-pointer rounded-xl border px-3 py-3 ${
                      item.isRead
                        ? 'border-border bg-card/65'
                        : 'border-border bg-accent/70 shadow-md'
                    }`}
                  >
                    {(() => {
                      const visual = getNotificationVisual(item.type, item.content);
                      const Icon = visual.icon;
                      return (
                        <div className="flex w-full items-start gap-2.5">
                          <div
                            className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${visual.iconBgClass}`}
                          >
                            <Icon className={`h-4 w-4 ${visual.iconClass}`} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-1 text-sm font-medium text-foreground">
                                {item.title}
                              </p>
                              {item.isRead ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                  已读
                                </span>
                              ) : (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                                  未读
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {item.content}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground/70">
                              {formatNotificationTime(item.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </DropdownMenuItem>
                ))
              )}
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => navigate('/notifications')}
              className="hover:bg-accent cursor-pointer justify-center rounded-xl py-2.5 text-sm font-medium text-primary transition-colors"
            >
              查看全部通知
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isAuthenticated ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="relative h-10 w-10 rounded-full outline-none transition-all hover:ring-2 hover:ring-accent">
            <Avatar className="h-10 w-10 border-2 shadow-sm border-primary/50">
              <AvatarImage src={user?.avatar} alt={user?.nickname || user?.username} />
              <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
                {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-primary" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 border-border bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
            align="end"
          >
            <div className="bg-accent mb-2 rounded-lg px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {user?.nickname || user?.username}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">@{user?.username}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshUser}
                  className="text-primary inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-card/70"
                  title="刷新用户状态"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${profileLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={() => navigate('/profile')}
              className="hover:bg-accent cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
            >
              <User className="text-primary h-4 w-4" />
              <span className="font-medium">个人中心</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/favorites')}
              className="hover:bg-accent cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
            >
              <Heart className="h-4 w-4 text-primary" />
              <span className="font-medium">我的收藏</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/follows')}
              className="hover:bg-accent cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
            >
              <Users className="text-primary h-4 w-4" />
              <span className="font-medium">我的关注</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/downloads')}
              className="hover:bg-accent cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
            >
              <Download className="h-4 w-4 text-primary" />
              <span className="font-medium">下载记录</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate('/my-space')}
              className="hover:bg-accent cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
            >
              <Sparkles className="text-primary h-4 w-4" />
              <span className="font-medium">我的创作空间</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer gap-3 rounded-lg py-2.5 text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">退出登录</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link to="/login">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl px-4 text-sm font-medium transition-all sm:px-6">
            登录 / 注册
          </Button>
        </Link>
      )}
    </>
  );

  return (
    <header
      data-global-header
      className="border-b border-border sticky top-0 z-50 w-full border-b bg-card/82 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 md:px-8 md:py-0">
        <div className="flex items-center justify-between gap-4 md:h-16">
          <Link to="/" className="group shrink-0 md:mr-8">
            <BrandLogo
              className="transition-transform group-hover:scale-105"
              iconClassName="h-9 sm:h-10"
              wordmarkClassName="text-[1.12rem] sm:text-[1.28rem]"
            />
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to} className="shrink-0">
                  <Button
                    variant="ghost"
                    className={`gap-2 transition-colors ${
                      item.active ? 'bg-accent text-primary' : 'hover:bg-accent hover:text-primary'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">{actionArea}</div>
        </div>

        {mobileNavOpen ? (
          <div className="mt-3 rounded-[28px] border border-border bg-card p-3 shadow-lg md:hidden">
            <div className="mb-2 flex items-center justify-between px-2">
              <div className="text-xs tracking-[0.18em] text-primary uppercase">Navigation</div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              >
                收起
              </button>
            </div>
            <nav className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.to} to={item.to}>
                    <button
                      type="button"
                      className={`flex min-h-11 w-full items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm transition-colors ${
                        item.active
                          ? 'border-accent bg-accent text-primary shadow-lg'
                          : 'border-border/80 bg-card/88 text-foreground hover:border-border hover:bg-accent/70'
                      }`}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card/88 shadow-sm">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="leading-5">{item.label}</span>
                    </button>
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  );
}
