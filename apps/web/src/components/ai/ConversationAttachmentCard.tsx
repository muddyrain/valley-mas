import { FileText, ImageIcon, LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ConversationAttachmentStatus = 'uploading' | 'ready' | 'failed';

function formatAttachmentSize(sizeBytes?: number) {
  if (!sizeBytes) return '';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ConversationAttachmentCard({
  name,
  mimeType,
  sizeBytes,
  previewUrl,
  status = 'ready',
  secondary,
  onOpen,
  onRemove,
  className,
}: {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  previewUrl?: string;
  status?: ConversationAttachmentStatus;
  secondary?: string;
  onOpen?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  const isImage = Boolean(previewUrl || mimeType?.startsWith('image/'));
  const details =
    status === 'uploading'
      ? '上传中'
      : status === 'failed'
        ? '上传失败'
        : secondary || formatAttachmentSize(sizeBytes);

  return (
    <div
      className={cn(
        'group/file relative flex h-16 w-[min(17rem,100%)] min-w-0 overflow-hidden rounded-xl border border-border bg-card',
        status === 'failed' && 'border-destructive/40',
        className,
      )}
    >
      {status === 'uploading' ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-2/3 animate-pulse bg-muted/80"
          aria-hidden="true"
        />
      ) : null}
      <button
        type="button"
        className="relative flex min-w-0 flex-1 items-center gap-3 p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={onOpen ? `打开文件 ${name}` : undefined}
      >
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-primary">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : isImage ? (
            <ImageIcon className="size-5" />
          ) : (
            <FileText className="size-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          <span
            className={cn(
              'mt-0.5 flex items-center gap-1 text-xs text-muted-foreground',
              status === 'failed' && 'text-destructive',
            )}
          >
            {status === 'uploading' ? <LoaderCircle className="size-3 animate-spin" /> : null}
            {details}
          </span>
        </span>
      </button>
      {onRemove ? (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="absolute top-1 right-1 opacity-0 transition-opacity group-hover/file:opacity-100 focus-visible:opacity-100"
          onClick={onRemove}
          aria-label={`移除文件 ${name}`}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}

export { formatAttachmentSize };
