import {
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  FileText,
  GitBranch,
  ImagePlus,
  Menu,
  Puzzle,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const labGroups = [
  {
    label: '构建',
    items: [
      {
        to: '/workbench/resources?tab=workflows',
        label: '工作流',
        icon: GitBranch,
        resourceTab: 'workflows',
      },
      {
        to: '/workbench/resources?tab=knowledge',
        label: '知识库',
        icon: BrainCircuit,
        resourceTab: 'knowledge',
      },
      {
        to: '/workbench/resources?tab=prompts',
        label: '提示词',
        icon: FileText,
        resourceTab: 'prompts',
      },
      {
        to: '/workbench/resources?tab=skills',
        label: '技能',
        icon: Puzzle,
        resourceTab: 'skills',
      },
    ],
  },
  {
    label: '生成',
    items: [{ to: '/workbench/images/advanced', label: '图片进阶', icon: ImagePlus }],
  },
] as const;

type LabItem = (typeof labGroups)[number]['items'][number];

function isLabItemActive(pathname: string, search: string, item: LabItem) {
  if ('resourceTab' in item) {
    if (pathname !== '/workbench/resources') return false;
    const activeTab = new URLSearchParams(search).get('tab') || 'workflows';
    return activeTab === item.resourceTab;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function LabNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav aria-label="私有实验室导航" className="space-y-5">
      {labGroups.map((group) => (
        <section key={group.label}>
          <h2 className="px-3 pb-2 text-xs font-medium text-muted-foreground">{group.label}</h2>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isLabItemActive(location.pathname, location.search, item);

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
          </div>
        </section>
      ))}
    </nav>
  );
}

function isFullScreenWorkspace(pathname: string) {
  return pathname.startsWith('/workbench/create') || pathname.startsWith('/workbench/edit');
}

export default function PrivateLabLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  if (isFullScreenWorkspace(location.pathname)) return <Outlet />;

  return (
    <div className="flex h-svh overflow-hidden bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-4">
          <Link
            to="/workbench/resources?tab=workflows"
            className="flex items-center gap-3"
            aria-label="雨迹私有实验室首页"
          >
            <span className="flex size-9 items-center justify-center rounded-full border border-border bg-background font-serif text-lg">
              雨
            </span>
            <span>
              <strong className="block text-sm font-semibold">雨迹 · 私有实验室</strong>
              <small className="block text-[10px] tracking-[0.18em] text-muted-foreground">
                PRIVATE LAB
              </small>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <LabNavigation />
        </div>

        <div className="space-y-1 border-t border-border p-3">
          <Link
            to="/studio"
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            返回创作室
          </Link>
          <Link
            to="/"
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
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
            aria-label="打开私有实验室导航"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <Link
            to="/workbench/resources?tab=workflows"
            className="font-serif text-base font-semibold"
          >
            雨迹 · 私有实验室
          </Link>
          <Link to="/studio" aria-label="返回创作室" className="text-muted-foreground">
            <ArrowLeft className="size-5" />
          </Link>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="关闭私有实验室导航"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(19rem,88vw)] flex-col border-r border-border bg-card p-3 shadow-xl">
            <div className="mb-4 flex h-12 items-center justify-between border-b border-border px-2">
              <strong className="font-serif text-base">雨迹 · 私有实验室</strong>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭私有实验室导航"
                onClick={() => setMobileOpen(false)}
              >
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <LabNavigation onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="space-y-1 border-t border-border pt-3">
              <Link
                to="/studio"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
              >
                <ArrowLeft className="size-4" />
                返回创作室
              </Link>
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground"
              >
                查看雨迹
                <ArrowUpRight className="ml-auto size-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
