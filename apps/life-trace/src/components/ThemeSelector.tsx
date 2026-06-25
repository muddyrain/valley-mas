import { MoonStar, Palette, Sun } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type AppTheme = 'system' | 'light' | 'dark';

type ThemeSelectorProps = {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  className?: string;
};

const themes: Array<{ value: AppTheme; label: string; icon: typeof Palette }> = [
  { value: 'system', label: '跟随系统', icon: Palette },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: MoonStar },
];

export function ThemeSelector({ theme, onThemeChange, className }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const activeTheme = themes.find((t) => t.value === theme) ?? themes[0];
  const Icon = activeTheme.icon;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        className="grid size-9 place-items-center rounded-2xl bg-background/30 text-muted-foreground backdrop-blur transition hover:bg-background/50"
        aria-label="切换主题"
        onClick={() => setOpen(!open)}
      >
        <Icon className="size-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[10rem] rounded-2xl border border-border/80 bg-popover p-1.5 shadow-lg">
            {themes.map((t) => {
              const TIcon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition',
                    theme === t.value
                      ? 'bg-accent font-semibold text-accent-foreground'
                      : 'text-muted-foreground hover:bg-secondary',
                  )}
                  onClick={() => {
                    onThemeChange(t.value);
                    setOpen(false);
                  }}
                >
                  <TIcon className="size-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
