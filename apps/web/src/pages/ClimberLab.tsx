import { ArrowUpRight, Gamepad2, Mountain, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const TOY_CLIMB_ARENA_URL =
  (import.meta.env.VITE_TOY_CLIMB_ARENA_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:5175';

export default function ClimberLab() {
  const navigate = useNavigate();
  const launchUrl = useMemo(() => TOY_CLIMB_ARENA_URL, []);

  return (
    <main className="bg-[linear-gradient(180deg,rgba(251,248,243,0.98),rgba(255,252,247,0.96))]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-8">
          <div className="space-y-6">
            <div className="theme-eyebrow inline-flex items-center rounded-full border bg-white/88 px-4 py-1.5 text-[11px] tracking-[0.24em] uppercase shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur sm:tracking-[0.3em]">
              GAME ENTRY
            </div>
            <div className="space-y-3">
              <h1 className="text-[34px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[44px] md:text-[56px]">
                玩具攀爬
              </h1>
              <p className="max-w-2xl text-[15px] leading-8 text-slate-600 md:text-base">
                打开独立的 Toy Climb Arena，直接进入玩具世界攀爬。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="theme-btn-primary h-11 rounded-xl px-5 text-sm font-medium"
                onClick={() => window.open(launchUrl, '_blank', 'noopener,noreferrer')}
              >
                <Gamepad2 className="mr-2 h-4 w-4" />
                打开游戏
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl px-5 text-sm font-medium"
                onClick={() => navigate('/')}
              >
                返回首页
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-white/78 px-3 py-1.5">
                <Mountain className="h-4 w-4 text-theme-primary" />
                独立入口
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-theme-border bg-white/78 px-3 py-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                本地默认 {launchUrl}
              </span>
            </div>
          </div>

          <div className="rounded-[28px] border border-theme-border bg-white/90 p-5 shadow-[0_24px_56px_rgba(var(--theme-primary-rgb),0.12)]">
            <div className="flex h-full min-h-[320px] flex-col justify-between gap-6 rounded-[22px] border border-dashed border-theme-border bg-[linear-gradient(180deg,rgba(255,248,239,0.92),rgba(255,255,255,0.96))] p-5">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-theme-soft px-3 py-1.5 text-xs font-medium text-theme-primary">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  外部应用
                </div>
                <p className="text-sm leading-7 text-slate-600">
                  这里是 Web 内的入口页，真正的游戏运行在独立的 Toy Climb Arena。
                </p>
              </div>

              <div className="grid gap-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-theme-border bg-white/80 px-4 py-3">
                  首页、导航和这里都会指向同一个入口。
                </div>
                <div className="rounded-2xl border border-theme-border bg-white/80 px-4 py-3">
                  若本地联调，默认地址是 {launchUrl}。
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
