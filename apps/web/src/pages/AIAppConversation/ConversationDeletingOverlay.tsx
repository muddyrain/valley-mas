import { LoaderCircle } from 'lucide-react';

export function ConversationDeletingOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-background/85 text-xs font-medium backdrop-blur-sm"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      正在删除
    </div>
  );
}
