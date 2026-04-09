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
      ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
      : 'border-theme-soft-strong bg-theme-soft text-theme-primary hover:bg-theme-soft/80';

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
    <div className="w-[320px] rounded-2xl border border-theme-soft-strong bg-white/95 p-4 shadow-[0_20px_40px_rgba(var(--theme-primary-rgb),0.20)] backdrop-blur-xl outline-hidden">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {description ? <div className="mt-1 text-xs text-slate-500">{description}</div> : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="rounded-lg border border-theme-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
