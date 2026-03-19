import {
  AudioLines,
  BookOpen,
  Heart,
  Home,
  ImageIcon,
  LogOut,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
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
      console.error('Logout failed:', error);
      logoutStore();
      toast.success('退出登录成功');
      navigate('/login');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/80 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4 md:px-8">
        <Link to="/" className="group mr-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-purple-600 to-indigo-600 shadow-md transition-transform group-hover:scale-110 group-hover:shadow-lg">
            <span className="text-lg font-bold text-white">V</span>
          </div>
          <span className="hidden bg-linear-to-r from-purple-600 to-indigo-600 bg-clip-text text-2xl font-bold text-transparent sm:block">
            Valley
          </span>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
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

          <Link to="/resources">
            <Button
              variant="ghost"
              className={`gap-2 transition-colors ${
                location.pathname.startsWith('/resources') ||
                location.pathname.startsWith('/resource')
                  ? 'bg-purple-100 text-purple-600'
                  : 'hover:bg-purple-50 hover:text-purple-600'
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
                  ? 'bg-purple-100 text-purple-600'
                  : 'hover:bg-purple-50 hover:text-purple-600'
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
                  ? 'bg-purple-100 text-purple-600'
                  : 'hover:bg-purple-50 hover:text-purple-600'
              }`}
            >
              <AudioLines className="h-4 w-4" />
              <span className="hidden sm:inline">TTS</span>
            </Button>
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="relative h-10 w-10 rounded-full outline-none transition-all hover:ring-2 hover:ring-purple-200">
                <Avatar className="h-10 w-10 border-2 border-purple-100 shadow-sm">
                  <AvatarImage src={user?.avatar} alt={user?.nickname || user?.username} />
                  <AvatarFallback className="bg-linear-to-br from-purple-400 to-indigo-500 font-semibold text-white">
                    {(user?.nickname?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-64 border-gray-200 bg-white/95 p-2 shadow-xl backdrop-blur-xl"
                align="end"
              >
                <div className="mb-2 rounded-lg bg-linear-to-br from-purple-50 to-indigo-50 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {user?.nickname || user?.username}
                  </p>
                  <p className="mt-1 text-xs text-gray-600">@{user?.username}</p>
                </div>
                <DropdownMenuSeparator className="bg-gray-200" />
                <DropdownMenuItem
                  onClick={() => navigate('/profile')}
                  className="cursor-pointer gap-3 rounded-lg py-2.5 transition-colors hover:bg-purple-50"
                >
                  <User className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">个人中心</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate('/favorites')}
                  className="cursor-pointer gap-3 rounded-lg py-2.5 transition-colors hover:bg-purple-50"
                >
                  <Heart className="h-4 w-4 text-pink-500" />
                  <span className="font-medium">我的收藏</span>
                </DropdownMenuItem>
                {user?.role === 'creator' && (
                  <DropdownMenuItem
                    onClick={() => navigate('/my-space')}
                    className="cursor-pointer gap-3 rounded-lg py-2.5 transition-colors hover:bg-purple-50"
                  >
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="font-medium">我的创作空间</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-gray-200" />
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
              <Button className="rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 px-6 font-medium text-white shadow-md transition-all hover:scale-105 hover:from-purple-700 hover:to-indigo-700 hover:shadow-lg">
                登录 / 注册
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
