import { Loader2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ConfirmToastId = string | number;

export type ConfirmToastVariant = 'default' | 'danger';

export interface ConfirmToastOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  confirmVariant?: ConfirmToastVariant;
  duration?: number;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface ConfirmToastCardProps extends Omit<ConfirmToastOptions, 'duration'> {
  id: ConfirmToastId;
}

function ConfirmToastCard({
  id,
  title,
  description,
  confirmText,
  cancelText,
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}: ConfirmToastCardProps) {
  const [pending, setPending] = useState(false);

  const confirmClassName =
    confirmVariant === 'danger'
      ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20'
      : 'border-accent bg-accent text-primary hover:bg-accent';

  const handleCancel = () => {
    if (pending) return;
    onCancel?.();
    toast.dismiss(id);
  };

  const handleConfirm = async () => {
    if (pending) return;
    try {
      setPending(true);
      await onConfirm();
      toast.dismiss(id);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-[320px] rounded-2xl border border-accent bg-card/95 p-4 shadow-[0_20px_40px_hsl(var(--primary) / 0.20)] backdrop-blur-xl outline-hidden">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cancelText ?? 'Cancel'}
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={pending}
          className={cn(
            'inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
            confirmClassName,
          )}
        >
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {confirmText ?? 'Confirm'}
        </button>
      </div>
    </div>
  );
}

export function openConfirmToast(options: ConfirmToastOptions) {
  return toast.custom((id: ConfirmToastId) => <ConfirmToastCard id={id} {...options} />, {
    duration: options.duration ?? 8000,
    className: '!border-0 !bg-transparent !p-0 !shadow-none',
    style: {
      background: 'transparent',
      border: 'none',
      boxShadow: 'none',
      padding: 0,
    },
  });
}
