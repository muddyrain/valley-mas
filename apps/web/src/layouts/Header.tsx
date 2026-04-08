import {
  AudioLines,
  Bell,
  BookOpen,
  CheckCheck,
  Download,
  Heart,
  Home,
  ImageIcon,
  LogOut,
  Palette,
  RefreshCw,
  Sparkles,
  Tag,
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
import AiChatAssistant from '@/components/AiChatAssistant';
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
import { THEME_OPTIONS, useThemeStore } from '@/stores/useThemeStore';
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
  const currentTheme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifyLoading, setNotifyLoading] = useState(false);

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

  const handleThemeChange = (theme: (typeof THEME_OPTIONS)[number]['value']) => {
    if (theme === currentTheme) return;
    setTheme(theme);
    const option = THEME_OPTIONS.find((item) => item.value === theme);
    toast.success(`已切换为${option?.label || '新主题'}`);
  };

  return (
    <header
      data-global-header
      className="theme-header sticky top-0 z-50 w-full border-b bg-white/82 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 md:px-8">
        <Link to="/" className="group mr-8 flex items-center gap-3">
          <div className="theme-logo-icon flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110">
            <span className="text-lg font-bold text-white">V</span>
          </div>
          <span className="theme-logo-text hidden text-2xl font-bold sm:block">Valley</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          <Link to="/">
            <Button
              variant="ghost"
              className={`gap-2 transition-colors ${
                location.pathname === '/'
                  ? 'bg-theme-soft text-theme-primary-hover'
                  : 'hover:bg-theme-soft hover:text-theme-primary-hover'
              }`}
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">首页</span>
            </Button>
          </Link>

          <Link to="/creators">
            <Button
              variant="ghost"
              className={`gap-2 transition-colors ${
                location.pathname.startsWith('/creators') ||
                location.pathname.startsWith('/creator')
                  ? 'bg-theme-soft text-theme-primary-hover'
                  : 'hover:bg-theme-soft hover:text-theme-primary-hover'
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">创作者</span>
            </Button>
          </Link>

          <Link to="/resources">
            <Button
              variant="ghost"
              className={`gap-2 transition-colors ${
                location.pathname.startsWith('/resources') ||
                location.pathname.startsWith('/resource')
                  ? 'bg-theme-soft text-theme-primary-hover'
                  : 'hover:bg-theme-soft hover:text-theme-primary-hover'
              }`}
            >
              <ImageIcon className="h-4 w-4" />
              <span className="hidden sm:inline">资源</span>
            </Button>
          </Link>

          <Link to="/blog">
            <Button
              variant="ghost"
              className={`gap-2 transition-colors ${
                location.pathname.startsWith('/blog')
                  ? 'bg-theme-soft text-theme-primary-hover'
                  : 'hover:bg-theme-soft hover:text-theme-primary-hover'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">博客</span>
            </Button>
          </Link>

          <Link to="/tts">
            <Button
              variant="ghost"
              className={`gap-2 transition-colors ${
                location.pathname.startsWith('/tts')
                  ? 'bg-theme-soft text-theme-primary-hover'
                  : 'hover:bg-theme-soft hover:text-theme-primary-hover'
              }`}
            >
              <AudioLines className="h-4 w-4" />
              <span className="hidden sm:inline">TTS</span>
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated && <AiChatAssistant />}

          <DropdownMenu>
            <DropdownMenuTrigger className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-theme-soft hover:text-theme-primary">
              <Palette className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-72 border-theme-border bg-white/95 p-2 shadow-xl backdrop-blur-xl"
              align="end"
            >
              <div className="px-2 py-1.5">
                <p className="text-sm font-semibold text-slate-900">主题切换</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  选择你更喜欢的页面色调，切换后会保留到下次打开。
                </p>
              </div>
              <DropdownMenuSeparator className="bg-theme-border" />
              <div className="grid gap-1 p-1">
                {THEME_OPTIONS.map((option) => {
                  const active = option.value === currentTheme;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleThemeChange(option.value)}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-theme-soft-strong bg-theme-soft shadow-[0_10px_26px_rgba(var(--theme-primary-rgb),0.12)]'
                          : 'border-transparent hover:border-theme-border hover:bg-theme-soft'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-2 shadow-sm">
                        {option.preview.map((color) => (
                          <span
                            key={color}
                            className="h-3 w-3 rounded-full border border-white/80 shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {option.description}
                        </span>
                      </span>
                      {active ? (
                        <span className="rounded-full bg-theme-primary px-2.5 py-1 text-[11px] text-white">
                          当前
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAuthenticated && (
            <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
              <DropdownMenuTrigger className="relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-theme-soft hover:text-theme-primary">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-semibold leading-4 text-white">
                    {unreadLabel}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-86 border-theme-border bg-white/95 p-2 shadow-xl backdrop-blur-xl"
                align="end"
              >
                <div className="mb-1 flex items-center justify-between px-2 py-1">
                  <p className="text-sm font-semibold text-gray-900">通知</p>
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-theme-primary inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-theme-soft"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    全部已读
                  </button>
                </div>
                <DropdownMenuSeparator className="bg-theme-border" />

                <div className="max-h-88 overflow-auto">
                  {notifyLoading ? (
                    <div className="px-3 py-6 text-center text-sm text-gray-500">加载中...</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-gray-500">暂无通知</div>
                  ) : (
                    notifications.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => handleMarkOneRead(item)}
                        className={`cursor-pointer rounded-xl border px-3 py-3 ${
                          item.isRead
                            ? 'border-slate-200 bg-slate-50/65'
                            : 'border-theme-shell-border bg-theme-soft/70 shadow-[0_6px_16px_rgba(var(--theme-primary-rgb),0.12)]'
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
                                  <p className="line-clamp-1 text-sm font-medium text-slate-900">
                                    {item.title}
                                  </p>
                                  {item.isRead ? (
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                                      已读
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-theme-primary px-2 py-0.5 text-[10px] text-white">
                                      未读
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                                  {item.content}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
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
                <DropdownMenuSeparator className="bg-theme-border" />
                <DropdownMenuItem
                  onClick={() => navigate('/notifications')}
                  className="hover:bg-theme-soft cursor-pointer justify-center rounded-xl py-2.5 text-sm font-medium text-theme-primary transition-colors"
                >
                  查看全部通知
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="relative h-10 w-10 rounded-full outline-none transition-all hover:ring-2 hover:ring-theme-soft-strong">
                <Avatar className="h-10 w-10 border-2 shadow-sm border-theme-primary/50">
                  <AvatarImage src={user?.avatar} alt={user?.nickname || user?.username} />
                  <AvatarFallback className="theme-avatar-fallback font-semibold text-white">
                    {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 border-theme-border bg-white/95 p-2 shadow-xl backdrop-blur-xl"
                align="end"
              >
                <div className="bg-theme-soft mb-2 rounded-lg px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {user?.nickname || user?.username}
                      </p>
                      <p className="mt-1 text-xs text-gray-600">@{user?.username}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshUser}
                      className="text-theme-primary inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/70"
                      title="刷新用户状态"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${profileLoading ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-theme-border" />
                <DropdownMenuItem
                  onClick={() => navigate('/profile')}
                  className="hover:bg-theme-soft cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
                >
                  <User className="text-theme-primary h-4 w-4" />
                  <span className="font-medium">个人中心</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/favorites')}
                  className="hover:bg-theme-soft cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
                >
                  <Heart className="h-4 w-4 text-pink-500" />
                  <span className="font-medium">我的收藏</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/follows')}
                  className="hover:bg-theme-soft cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
                >
                  <Users className="text-theme-primary h-4 w-4" />
                  <span className="font-medium">我的关注</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/downloads')}
                  className="hover:bg-theme-soft cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
                >
                  <Download className="h-4 w-4 text-sky-500" />
                  <span className="font-medium">下载记录</span>
                </DropdownMenuItem>
                {user?.role === 'creator' && (
                  <DropdownMenuItem
                    onClick={() => navigate('/my-space')}
                    className="hover:bg-theme-soft cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
                  >
                    <Sparkles className="text-theme-primary h-4 w-4" />
                    <span className="font-medium">我的创作空间</span>
                  </DropdownMenuItem>
                )}
                {user?.role === 'admin' && (
                  <DropdownMenuItem
                    onClick={() => navigate('/my-space/resource-tags')}
                    className="hover:bg-theme-soft cursor-pointer gap-3 rounded-lg py-2.5 transition-colors"
                  >
                    <Tag className="text-theme-primary h-4 w-4" />
                    <span className="font-medium">资源标签管理</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-theme-border" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer gap-3 rounded-lg py-2.5 text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button className="theme-btn-primary rounded-xl px-6 font-medium transition-all">
                登录 / 注册
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
