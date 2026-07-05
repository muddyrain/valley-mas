import {
  BookOpen,
  FlaskConical,
  Home,
  ImageIcon,
  MessageCircleHeart,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLayoutStore } from '@/stores/useLayoutStore';

const navItems = [
  { to: '/', label: '首页', icon: Home },
  { to: '/workbench', label: '工作台', icon: Sparkles },
  { to: '/blog', label: '博客', icon: BookOpen },
  { to: '/resources', label: '资源', icon: ImageIcon },
  { to: '/guestbook', label: '留言墙', icon: MessageCircleHeart },
  { to: '/labs', label: '实验室', icon: FlaskConical },
];

export function Sidebar() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggle = useLayoutStore((s) => s.toggleSidebar);
  const location = useLocation();

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

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
                  ? 'bg-primary/10 text-primary'
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
                <TooltipTrigger>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

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
