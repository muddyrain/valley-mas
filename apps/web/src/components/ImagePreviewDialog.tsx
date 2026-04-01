import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ImagePreviewDialogProps {
  open: boolean;
  src?: string;
  title?: string;
  onOpenChange: (open: boolean) => void;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const SCALE_STEP = 0.2;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function guessTitle(src?: string) {
  if (!src) return '图片预览';
  try {
    const url = new URL(src);
    const name = url.pathname.split('/').pop();
    return name || '图片预览';
  } catch {
    const name = src.split('/').pop();
    return name || '图片预览';
  }
}

export default function ImagePreviewDialog({
  open,
  src,
  title,
  onOpenChange,
}: ImagePreviewDialogProps) {
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, baseX: 0, baseY: 0, pointerId: -1 });

  const canPreview = useMemo(() => Boolean(src), [src]);
  const displayTitle = useMemo(() => {
    const trimmed = (title || '').trim();
    return trimmed || guessTitle(src);
  }, [title, src]);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
  }, [open, src]);

  const reset = () => {
    setScale(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!canPreview) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
      pointerId: e.pointerId,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!dragging || dragStartRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({ x: dragStartRef.current.baseX + dx, y: dragStartRef.current.baseY + dy });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (dragStartRef.current.pointerId !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setDragging(false);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:w-[92vw] sm:max-w-[92vw] h-[92vh] max-h-[92vh] p-0 border-none bg-black/45 backdrop-blur-sm shadow-none">
        <div
          className="relative h-full w-full overflow-hidden rounded-xl bg-black/40"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[70vw] rounded-lg bg-black/40 px-3 py-1.5 text-sm text-white/95 backdrop-blur">
            <span className="block truncate">{displayTitle}</span>
          </div>

          <div className="flex h-full w-full items-center justify-center p-8">
            {canPreview ? (
              <img
                src={src}
                alt={displayTitle}
                className="select-none rounded-sm shadow-[0_16px_64px_rgba(0,0,0,0.45)] cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  maxWidth: '82vw',
                  maxHeight: '76vh',
                  width: 'auto',
                  height: 'auto',
                  transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
                  transformOrigin: 'center center',
                  transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.22,1,0.36,1)',
                  willChange: 'transform',
                }}
              />
            ) : (
              <div className="text-sm text-white/80">暂无可预览图片</div>
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
            <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-2 py-1.5 backdrop-blur-md">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale((v) => clamp(v - SCALE_STEP, MIN_SCALE, MAX_SCALE));
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                title="缩小"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setScale((v) => clamp(v + SCALE_STEP, MIN_SCALE, MAX_SCALE));
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                title="放大"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRotate((v) => v - 90);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                title="向左旋转"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRotate((v) => v + 90);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/15"
                title="向右旋转"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/15"
                title="复位"
              >
                复位
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
