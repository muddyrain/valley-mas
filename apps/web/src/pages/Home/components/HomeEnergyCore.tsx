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
      <div className="pointer-events-none absolute -inset-x-6 -inset-y-5 rounded-[34px] bg-[radial-gradient(circle_at_24%_18%,hsl(var(--accent) / 0.2),transparent_46%),radial-gradient(circle_at_76%_20%,hsl(var(--secondary) / 0.16),transparent_44%)] blur-xl" />
      <div className="relative rounded-[26px] border border-border/50 bg-card p-4 shadow-lg backdrop-blur sm:rounded-[30px] sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr] xl:items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-3 py-1 text-[11px] tracking-[0.14em] text-primary sm:tracking-[0.18em]">
              <Orbit className="h-3.5 w-3.5" />
              HOME ENERGY CORE
            </div>
            <div className="rounded-[20px] border border-border bg-card/78 p-4 shadow-sm">
              <div className="text-[11px] tracking-[0.16em] text-primary uppercase">首页中枢</div>
              <p className="mt-2 text-sm leading-7 text-foreground">
                首页已整理好常用浏览路径，方便你按内容、资源或创作者继续探索。
              </p>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
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
