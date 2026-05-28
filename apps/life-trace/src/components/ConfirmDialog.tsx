import { AlertTriangle, X } from 'lucide-react';
import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel = '删除中',
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open || loading) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-background/70 px-5 backdrop-blur-sm"
      onMouseDown={() => {
        if (!loading) {
          onCancel();
        }
      }}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-[360px] overflow-hidden border-life-alert/30 bg-card p-0 shadow-[0_24px_90px_rgba(249,115,22,0.16)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative p-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-alert/80 to-transparent"
          />
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-life-alert/25 bg-life-alert/10 text-life-alert">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 id={titleId} className="text-lg font-semibold">
                  {title}
                </h2>
                <button
                  type="button"
                  aria-label="关闭"
                  disabled={loading}
                  className="grid size-7 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  onClick={onCancel}
                >
                  <X className="size-4" />
                </button>
              </div>
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" disabled={loading} onClick={onCancel}>
              取消
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground shadow-[0_10px_35px_rgba(239,68,68,0.22)] hover:bg-destructive/90"
              disabled={loading}
              onClick={onConfirm}
            >
              {loading ? <ActionLoadingIcon tone="alert" /> : null}
              {loading ? loadingLabel : confirmLabel}
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body,
  );
}
