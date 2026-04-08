import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoxLoadingOverlayProps {
  show: boolean;
  title?: string;
  hint?: string;
  className?: string;
}

export default function BoxLoadingOverlay({
  show,
  title = 'Loading content...',
  hint = 'Please wait a moment.',
  className,
}: BoxLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        'absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-[radial-gradient(circle_at_14%_18%,rgba(var(--theme-primary-rgb),0.16),transparent_36%),radial-gradient(circle_at_84%_22%,rgba(59,130,246,0.14),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,252,255,0.84))] backdrop-blur-[2px]',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/85 bg-white/86 px-7 py-5 text-center shadow-[0_20px_48px_rgba(15,23,42,0.10)]">
        <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-theme-soft blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-theme-soft/80 blur-2xl" />

        <div className="relative mx-auto mb-3 h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-theme-soft-strong/85" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-theme-primary border-r-theme-primary/70" />
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-theme-soft/75">
            <Sparkles className="h-4 w-4 animate-pulse text-theme-primary" />
          </div>
        </div>

        <div className="relative text-sm font-semibold text-slate-800">{title}</div>
        <div className="relative mt-1 text-xs text-slate-500">{hint}</div>
      </div>
    </div>
  );
}
