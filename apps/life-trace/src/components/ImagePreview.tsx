import { X } from 'lucide-react';
import { type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ImagePreviewRenderProps = {
  openPreview: () => void;
  previewButtonProps: {
    type: 'button';
    'aria-label': string;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  };
};

type ImagePreviewProps = {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  className?: string;
  imageClassName?: string;
  previewImageClassName?: string;
  disabled?: boolean;
  children?: (props: ImagePreviewRenderProps) => ReactNode;
};

export function ImagePreview({
  src,
  alt,
  title = alt,
  subtitle,
  className,
  imageClassName,
  previewImageClassName,
  disabled = false,
  children,
}: ImagePreviewProps) {
  const [open, setOpen] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState('');
  const [errorSrc, setErrorSrc] = useState('');
  const imageLoaded = loadedSrc === src;
  const imageError = errorSrc === src;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const openPreview = () => {
    if (!disabled) {
      setOpen(true);
    }
  };

  const label = `预览${title}图片`;
  const trigger = children ? (
    children({
      openPreview,
      previewButtonProps: {
        type: 'button',
        'aria-label': label,
        onClick: (event) => {
          event.stopPropagation();
          openPreview();
        },
      },
    })
  ) : (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        'block w-full cursor-zoom-in overflow-hidden text-left disabled:cursor-default',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        openPreview();
      }}
    >
      <span className="relative block w-full">
        {!imageLoaded ? (
          <span className="absolute inset-0 z-10 grid place-items-center bg-secondary/80 text-xs font-medium text-muted-foreground backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/88 px-3 py-1.5 shadow-sm">
              <span className="size-3 animate-spin rounded-full border-2 border-life-trace/25 border-t-life-trace motion-reduce:animate-none" />
              {imageError ? '图片加载失败' : '图片加载中'}
            </span>
          </span>
        ) : null}
        <img
          src={src}
          alt={alt}
          className={cn(
            'transition-opacity duration-200',
            imageLoaded ? 'opacity-100' : 'opacity-0',
            imageClassName,
          )}
          onLoad={() => {
            setLoadedSrc(src);
            setErrorSrc('');
          }}
          onError={() => {
            setLoadedSrc('');
            setErrorSrc(src);
          }}
        />
      </span>
    </button>
  );

  return (
    <>
      {trigger}
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[95] bg-background/58 backdrop-blur-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={`${title} 图片预览`}
              onMouseDown={() => setOpen(false)}
            >
              <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-5 pt-5">
                <div className="min-w-0 rounded-2xl border border-white/10 bg-card/75 px-3 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl">
                  <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                  {subtitle ? (
                    <p className="mt-1 truncate text-xs font-medium text-foreground/75">
                      {subtitle}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="关闭图片预览"
                  className="pointer-events-auto border border-white/10 bg-card/58 text-foreground shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl hover:bg-card/78"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>
              <div className="safe-bottom flex h-full w-full items-center justify-center px-0 py-0">
                <div
                  className="flex h-full w-full items-center justify-center overflow-hidden bg-card/18 backdrop-blur-sm"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <img
                    src={src}
                    alt={alt}
                    className={cn('max-h-dvh w-full object-contain', previewImageClassName)}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
