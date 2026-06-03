import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';

const toneClassMap = {
  success: 'border-life-trace/30 bg-card text-life-trace',
  info: 'border-life-ai/30 bg-card text-life-ai',
  warning: 'border-life-alert/30 bg-card text-life-alert',
} as const;

const toneIconMap = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
} as const;

export function AppFeedbackToast() {
  const current = useFeedbackToastStore((state) => state.current);
  const dismissToast = useFeedbackToastStore((state) => state.dismissToast);

  if (!current) {
    return null;
  }

  const Icon = toneIconMap[current.tone];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[70] mx-auto w-full max-w-[430px] px-4">
      <div
        className={cn(
          'pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur',
          toneClassMap[current.tone],
        )}
      >
        <Icon className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 text-sm font-medium">{current.message}</p>
        <button
          type="button"
          className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          aria-label="关闭提示"
          onClick={dismissToast}
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
