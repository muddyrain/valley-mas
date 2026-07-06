import { cn } from '@/lib/utils';

interface MediaLoadingOverlayProps {
  show: boolean;
  className?: string;
}

export default function MediaLoadingOverlay({ show, className }: MediaLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_18%_20%,hsl(var(--primary) / 0.14),transparent_38%),linear-gradient(180deg,hsl(var(--foreground)/0.2),hsl(var(--foreground)/0.36))]',
        className,
      )}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/35 border-t-white border-r-white/80" />
    </div>
  );
}
