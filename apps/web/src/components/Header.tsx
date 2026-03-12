import { Home, LogOut, Sparkles, User, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
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
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="flex h-16 items-center px-4 md:px-8 max-w-7xl mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 mr-8 group">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-md transition-transform group-hover:scale-110 group-hover:shadow-lg">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="font-bold text-2xl bg-linear-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent hidden sm:block">
            Valley
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 flex-1">
          <Link to="/">
            <Button
              variant="ghost"
              className={`gap-2 transition-colors ${
                location.pathname === '/'
                  ? 'bg-purple-100 text-purple-600'
                  : 'hover:bg-purple-50 hover:text-purple-600'
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
                  ? 'bg-purple-100 text-purple-600'
                  : 'hover:bg-purple-50 hover:text-purple-600'
              }`}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">创作者</span>
            </Button>
          </Link>
        </nav>

        {/* User Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="relative h-10 w-10 rounded-full hover:ring-2 hover:ring-purple-200 transition-all outline-none">
                <Avatar className="h-10 w-10 border-2 border-purple-100 shadow-sm">
                  <AvatarImage src={user?.avatar} alt={user?.nickname || user?.username} />
                  <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-500 text-white font-semibold">
                    {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 p-2 bg-white/95 backdrop-blur-xl border-gray-200 shadow-xl"
                align="end"
              >
                <div className="px-3 py-3 mb-2 rounded-lg bg-linear-to-br from-purple-50 to-indigo-50">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.nickname || user?.username}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">@{user?.username}</p>
                </div>
                <DropdownMenuSeparator className="bg-gray-200" />
                <DropdownMenuItem
                  onClick={() => navigate('/profile')}
                  className="gap-3 py-2.5 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors"
                >
                  <User className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">个人中心</span>
                </DropdownMenuItem>
                {user?.role === 'creator' && (
                  <DropdownMenuItem
                    onClick={() => navigate('/my-space')}
                    className="gap-3 py-2.5 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors"
                  >
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">我的创作空间</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-gray-200" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="gap-3 py-2.5 rounded-lg hover:bg-red-50 cursor-pointer transition-colors text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all hover:scale-105 px-6 rounded-xl font-medium">
                登录 / 注册
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
