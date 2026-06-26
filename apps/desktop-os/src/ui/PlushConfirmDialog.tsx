import { type ReactNode, useState } from 'react';

import {
  PlushButton,
  PlushDialog,
  PlushDialogContent,
  PlushDialogDescription,
  PlushDialogFooter,
  PlushDialogHeader,
  PlushDialogTitle,
} from './PlushPrimitives';

export interface PlushConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: 'default' | 'danger';
  loading?: boolean;
  loadingLabel?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

export function PlushConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  tone = 'default',
  loading = false,
  loadingLabel,
  onConfirm,
}: PlushConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const busy = loading || internalLoading;

  async function handleConfirm() {
    if (busy) return;
    try {
      setInternalLoading(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setInternalLoading(false);
    }
  }

  return (
    <PlushDialog open={open} onOpenChange={(next) => (busy ? null : onOpenChange(next))}>
      <PlushDialogContent
        className={
          tone === 'danger'
            ? 'plush-confirm-dialog plush-confirm-dialog--danger'
            : 'plush-confirm-dialog'
        }
      >
        <PlushDialogHeader>
          <PlushDialogTitle>{title}</PlushDialogTitle>
          {description ? <PlushDialogDescription>{description}</PlushDialogDescription> : null}
        </PlushDialogHeader>
        <PlushDialogFooter>
          <PlushButton
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </PlushButton>
          <PlushButton
            type="button"
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={() => void handleConfirm()}
            loading={busy}
            loadingLabel={loadingLabel}
          >
            {confirmLabel}
          </PlushButton>
        </PlushDialogFooter>
      </PlushDialogContent>
    </PlushDialog>
  );
}

export default PlushConfirmDialog;
