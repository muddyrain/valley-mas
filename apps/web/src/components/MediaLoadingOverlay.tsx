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
        'pointer-events-none absolute inset-0 flex items-center justify-center backdrop-blur-xl bg-[radial-gradient(circle_at_18%_20%,hsl(var(--primary)/0.08),transparent_50%),linear-gradient(180deg,hsl(var(--foreground)/0.18),hsl(var(--foreground)/0.28))]',
        className,
      )}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/40 border-t-primary border-r-primary/70" />
    </div>
  );
}
