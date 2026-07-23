import {
  BookOpen,
  Bot,
  Download,
  FlaskConical,
  Heart,
  Home,
  ImageIcon,
  LibraryBig,
  LogIn,
  LogOut,
  MessageCircleHeart,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  User,
  Users,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLayoutStore } from '@/stores/useLayoutStore';

const navGroups = [
  {
    label: '浏览',
    items: [
      { to: '/', label: '首页', icon: Home },
      { to: '/blog', label: '博客', icon: BookOpen },
      { to: '/resources', label: '资源', icon: ImageIcon },
    ],
  },
  {
    label: '创作',
    items: [
      { to: '/workbench', label: '项目', icon: Bot },
      { to: '/workbench/images', label: 'AI 图片', icon: Sparkles },
      { to: '/workbench/resources', label: 'AI 资源', icon: LibraryBig },
    ],
  },
  {
    label: '更多',
    items: [
      { to: '/guestbook', label: '留言墙', icon: MessageCircleHeart },
      { to: '/labs/climber', label: '实验室', icon: FlaskConical },
    ],
  },
];

export function Sidebar() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggle = useLayoutStore((s) => s.toggleSidebar);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: logoutStore } = useAuthStore();

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    if (to === '/workbench') {
      return location.pathname === to || location.pathname.startsWith('/workbench/apps/');
    }
    if (to === '/workbench/images') {
      return location.pathname === to;
    }
    if (to === '/workbench/resources') {
      return (
        location.pathname === to ||
        location.pathname === '/workbench/create' ||
        location.pathname.startsWith('/workbench/edit/') ||
        location.pathname.startsWith('/workbench/templates/')
      );
    }
    return location.pathname.startsWith(to);
  };

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
      className={`relative flex h-screen shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 ${
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

      {/* Nav */}
      <nav className="flex-1 space-y-5 px-2 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 text-xs font-medium text-muted-foreground max-md:hidden">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
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

      {/* User area */}
      <div className="border-t border-border p-2">
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
                onClick={() => navigate('/my-space')}
                className="gap-2 rounded-lg py-2"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span>我的创作空间</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/profile')}
                className="gap-2 rounded-lg py-2"
              >
                <User className="h-4 w-4 text-primary" />
                <span>个人资料编辑</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate('/favorites')}
                className="gap-2 rounded-lg py-2"
              >
                <Heart className="h-4 w-4 text-primary" />
                <span>我的收藏</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/follows')}
                className="gap-2 rounded-lg py-2"
              >
                <Users className="h-4 w-4 text-primary" />
                <span>我的关注</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/downloads')}
                className="gap-2 rounded-lg py-2"
              >
                <Download className="h-4 w-4 text-primary" />
                <span>下载记录</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/notifications')}
                className="gap-2 rounded-lg py-2"
              >
                <Settings className="h-4 w-4 text-primary" />
                <span>通知设置</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 rounded-lg py-2 text-destructive"
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
          <Link to="/login" className="max-md:flex max-md:justify-center">
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
