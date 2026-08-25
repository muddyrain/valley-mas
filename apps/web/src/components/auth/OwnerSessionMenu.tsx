import { LogOut, Sparkles } from 'lucide-react';
import { type ReactElement, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { logout } from '@/api/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/useAuthStore';

type OwnerIdentity = {
  name: string;
  avatar: string;
  avatarFallback: string;
};

type OwnerSessionMenuProps = {
  trigger: (identity: OwnerIdentity) => ReactElement;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  onNavigate?: () => void;
};

export function OwnerSessionMenu({
  trigger,
  align = 'end',
  side = 'bottom',
  onNavigate,
}: OwnerSessionMenuProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.logout);
  const [open, setOpen] = useState(false);
  const name = user?.nickname || user?.username || '站主';
  const avatarFallback = (user?.nickname?.[0] || user?.username?.[0] || '站').toUpperCase();

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, []);

  const handleStudioNavigate = () => {
    setOpen(false);
    onNavigate?.();
    navigate('/studio');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setOpen(false);
      clearAuth();
      onNavigate?.();
      toast.success('退出登录成功');
      navigate('/login');
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={trigger({ name, avatar: user?.avatar || '', avatarFallback })} />
      <DropdownMenuContent align={align} side={side} className="w-52 border-border bg-popover p-1">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleStudioNavigate} className="gap-2">
            <Sparkles />
            创作室
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void handleLogout()}
          className="gap-2"
        >
          <LogOut />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
