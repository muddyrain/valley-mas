import { Orbit } from 'lucide-react';
import { useState } from 'react';
import HeroImmersiveShowcase from './HeroImmersiveShowcase';
import HomeAICoreDialog from './HomeAICoreDialog';

export default function HomeEnergyCore() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promptSeed, setPromptSeed] = useState('');
  const [promptSeedVersion, setPromptSeedVersion] = useState(0);

  const openCoreDialog = (prompt?: string) => {
    setDialogOpen(true);
    if (!prompt) return;

    setPromptSeed(prompt);
    setPromptSeedVersion((prev) => prev + 1);
  };

  return (
    <div className="relative max-w-4xl">
      <div className="pointer-events-none absolute -inset-x-6 -inset-y-5 rounded-[34px] bg-[radial-gradient(circle_at_24%_18%,rgba(var(--theme-tertiary-rgb),0.2),transparent_46%),radial-gradient(circle_at_76%_20%,rgba(var(--theme-secondary-rgb),0.16),transparent_44%)] blur-xl" />
      <div className="relative rounded-[26px] border border-white/82 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,244,235,0.78))] p-4 shadow-[0_22px_56px_rgba(var(--theme-primary-rgb),0.16)] backdrop-blur sm:rounded-[30px] sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr] xl:items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-theme-shell-border bg-white/86 px-3 py-1 text-[11px] tracking-[0.14em] text-theme-primary sm:tracking-[0.18em]">
              <Orbit className="h-3.5 w-3.5" />
              HOME ENERGY CORE
            </div>
            <div className="rounded-[20px] border border-theme-shell-border bg-white/78 p-4 shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.1)]">
              <div className="text-[11px] tracking-[0.16em] text-theme-primary uppercase">
                首页中枢
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                首页已整理好常用浏览路径，方便你按内容、资源或创作者继续探索。
              </p>
            </div>
            <p className="text-xs leading-6 text-slate-500">
              从这里开始浏览，内容更新与精选入口都已为你准备好。
            </p>
          </div>
          <HeroImmersiveShowcase onActivate={() => openCoreDialog()} isActive={dialogOpen} />
        </div>
      </div>
      <HomeAICoreDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        promptSeed={promptSeed}
        promptSeedVersion={promptSeedVersion}
      />
    </div>
  );
}
