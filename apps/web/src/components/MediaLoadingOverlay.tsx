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
        'pointer-events-none absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_18%_20%,rgba(var(--theme-primary-rgb),0.14),transparent_38%),linear-gradient(180deg,rgba(15,23,42,0.2),rgba(15,23,42,0.36))]',
        className,
      )}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/35 border-t-white border-r-white/80" />
    </div>
  );
}
