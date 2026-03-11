import { Home, LogOut, User, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logout } from '@/api/auth';
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

export default function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: logoutStore, initAuth } = useAuthStore();

  // 初始化认证状态（从 Cookie 恢复）
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const handleLogout = async () => {
    try {
      await logout();
      logoutStore();
      toast.success('退出登录成功');
      navigate('/login');
    } catch (error) {
      console.error('登出失败:', error);
      // 即使 API 调用失败也清除本地状态
      logoutStore();
      toast.success('退出登录成功');
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="flex h-16 items-center px-4 md:px-8 max-w-7xl mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mr-8">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="font-bold text-xl text-gray-900 hidden sm:block">Valley</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 flex-1">
          <Link to="/">
            <Button variant="ghost" className="gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">首页</span>
            </Button>
          </Link>
          <Link to="/creators">
            <Button variant="ghost" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">创作者</span>
            </Button>
          </Link>
        </nav>

        {/* User Actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.avatar} alt={user?.nickname || user?.username} />
                    <AvatarFallback className="bg-purple-100 text-purple-600">
                      {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.nickname || user?.username}</p>
                  <p className="text-xs text-gray-500">@{user?.username}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  个人中心
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button className="bg-purple-600 hover:bg-purple-700">登录</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
