import type { LifeAssistantActionEvent } from '@/api/assistant';

type AiActionConfirmProps = {
  event: LifeAssistantActionEvent | null;
  onDismiss: () => void;
};

export function AiActionConfirm({ event, onDismiss }: AiActionConfirmProps) {
  if (!event) {
    return null;
  }

  return (
    <button
      type="button"
      className="w-full rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-left text-sm text-foreground"
      onClick={onDismiss}
    >
      {event.message}
    </button>
  );
}
