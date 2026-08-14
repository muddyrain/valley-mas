import {
  ArrowUpRight,
  BookOpen,
  FlaskConical,
  GalleryVerticalEnd,
  House,
  ImagePlus,
  Images,
  Menu,
  PenLine,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const primaryItems = [
  { to: '/studio', label: '创作室', icon: House, exact: true },
  { to: '/studio/articles/new', label: '写文章', icon: PenLine },
  { to: '/studio/articles', label: '文章草稿', icon: BookOpen, exact: true },
  { to: '/studio/images/import', label: '图片导入', icon: ImagePlus },
  { to: '/studio/images', label: 'AI 图片', icon: Sparkles, exact: true },
] as const;

function isActive(pathname: string, item: (typeof primaryItems)[number]) {
  if ('exact' in item && item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function StudioNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav aria-label="创作室导航" className="space-y-1">
      {primaryItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(location.pathname, item);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function StudioLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-4">
          <Link to="/studio" className="flex items-center gap-3" aria-label="雨迹创作室首页">
            <span className="flex size-9 items-center justify-center rounded-full border border-border bg-background font-serif text-lg">
              雨
            </span>
            <span>
              <strong className="block text-sm font-semibold">雨迹</strong>
              <small className="block text-[10px] tracking-[0.18em] text-muted-foreground">
                PRIVATE STUDIO
              </small>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <StudioNavigation />
          <div className="my-4 border-t border-border" />
          <Link
            to="/workbench"
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <FlaskConical className="size-4" />
            私有实验室
          </Link>
        </div>

        <div className="space-y-1 border-t border-border p-3">
          <Link
            to="/"
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <GalleryVerticalEnd className="size-4" />
            查看雨迹
            <ArrowUpRight className="ml-auto size-3.5" />
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="打开创作室导航"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <Link to="/studio" className="font-serif text-lg font-semibold">
            雨迹 · 创作室
          </Link>
          <Link to="/" aria-label="查看雨迹" className="text-muted-foreground">
            <Images className="size-5" />
          </Link>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="关闭创作室导航"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(19rem,88vw)] flex-col border-r border-border bg-card p-3 shadow-xl">
            <div className="mb-4 flex h-12 items-center justify-between border-b border-border px-2">
              <strong className="font-serif text-lg">雨迹 · 创作室</strong>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭创作室导航"
                onClick={() => setMobileOpen(false)}
              >
                <X />
              </Button>
            </div>
            <StudioNavigation onNavigate={() => setMobileOpen(false)} />
            <div className="mt-4 border-t border-border pt-4">
              <Link
                to="/workbench"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
              >
                <FlaskConical className="size-4" />
                私有实验室
              </Link>
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
              >
                <GalleryVerticalEnd className="size-4" />
                查看雨迹
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
