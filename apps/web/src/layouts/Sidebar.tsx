import {
  BookOpen,
  Download,
  FlaskConical,
  Heart,
  Home,
  ImageIcon,
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

const navItems = [
  { to: '/', label: '首页', icon: Home },
  { to: '/workbench', label: '工作台', icon: Sparkles },
  { to: '/blog', label: '博客', icon: BookOpen },
  { to: '/resources', label: '资源', icon: ImageIcon },
  { to: '/guestbook', label: '留言墙', icon: MessageCircleHeart },
  { to: '/labs/climber', label: '实验室', icon: FlaskConical },
];

export function Sidebar() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggle = useLayoutStore((s) => s.toggleSidebar);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: logoutStore } = useAuthStore();

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
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
      className={`relative flex h-screen flex-col border-r border-border bg-card transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Brand */}
      <div className="flex h-14 items-center border-b border-border px-3">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <BrandLogo className="h-8 w-8 shrink-0" showWordmark={false} />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight text-foreground">Valley</span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          const link = (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
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
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar} alt={userName} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {userAvatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-foreground">{userName}</span>
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
          <Link to="/login">
            <Button variant="outline" className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              登录 / 注册
            </Button>
          </Link>
        )}
      </div>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>
    </aside>
  );
}
