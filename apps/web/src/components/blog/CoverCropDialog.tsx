import { ImagePlus, Loader2, Move, ZoomIn } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  BLOG_COVER_ASPECT_CLASS,
  BLOG_COVER_OUTPUT_HEIGHT,
  BLOG_COVER_OUTPUT_WIDTH,
} from '@/components/blog/BlogCoverMedia';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type CoverCropDialogProps = {
  open: boolean;
  imageUrl: string;
  fileName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (file: File) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function CoverCropDialog({
  open,
  imageUrl,
  fileName,
  onOpenChange,
  onConfirm,
}: CoverCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!open || !imageUrl) return;
    let canceled = false;
    setImageLoaded(false);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setDragging(false);
    dragStartRef.current = null;

    const img = new Image();
    img.onload = () => {
      if (canceled) return;
      loadedImageRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
    return () => {
      canceled = true;
    };
  }, [open, imageUrl]);

  const getRenderRect = (boxW: number, boxH: number, nextZoom = zoom) => {
    const img = loadedImageRef.current;
    if (!img || !boxW || !boxH) {
      return { drawX: 0, drawY: 0, drawW: 0, drawH: 0 };
    }
    const base = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const scale = base * nextZoom;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const drawX = (boxW - drawW) / 2 + offsetX;
    const drawY = (boxH - drawH) / 2 + offsetY;
    return { drawX, drawY, drawW, drawH };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const viewW = rect.width;
    const viewH = rect.height;
    if (!viewW || !viewH) return;
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { drawX, drawY, drawW, drawH } = getRenderRect(viewW, viewH);

    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#f6eef3';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }, [zoom, offsetX, offsetY, imageLoaded]);

  const getDragLimit = (nextZoom = zoom) => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return { maxX: 0, maxY: 0 };
    const rect = canvas.getBoundingClientRect();
    const boxW = rect.width;
    const boxH = rect.height;
    const base = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const renderedW = img.naturalWidth * base * nextZoom;
    const renderedH = img.naturalHeight * base * nextZoom;
    return {
      maxX: Math.max(0, (renderedW - boxW) / 2),
      maxY: Math.max(0, (renderedH - boxH) / 2),
    };
  };

  const applyClampedOffset = (x: number, y: number, nextZoom = zoom) => {
    const limit = getDragLimit(nextZoom);
    setOffsetX(clamp(x, -limit.maxX, limit.maxX));
    setOffsetY(clamp(y, -limit.maxY, limit.maxY));
  };

  const renderToBlob = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    const img = loadedImageRef.current;
    if (!canvas || !img) return null;
    const rect = canvas.getBoundingClientRect();
    const viewW = rect.width;
    const viewH = rect.height;
    if (!viewW || !viewH) return null;

    const outW = BLOG_COVER_OUTPUT_WIDTH;
    const outH = BLOG_COVER_OUTPUT_HEIGHT;
    const scaleX = outW / viewW;
    const scaleY = outH / viewH;
    const { drawX, drawY, drawW, drawH } = getRenderRect(viewW, viewH);

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX * scaleX, drawY * scaleY, drawW * scaleX, drawH * scaleY);
    return await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.95));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      baseX: offsetX,
      baseY: offsetY,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging || !dragStartRef.current) return;
    applyClampedOffset(
      dragStartRef.current.baseX + event.clientX - dragStartRef.current.x,
      dragStartRef.current.baseY + event.clientY - dragStartRef.current.y,
    );
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    setDragging(false);
    dragStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleConfirm = async () => {
    try {
      setProcessing(true);
      const blob = await renderToBlob();
      if (!blob) throw new Error('cover process failed');
      const baseName = fileName.replace(/\.[^.]+$/, '') || 'blog-cover';
      onConfirm(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-240 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 bg-white px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="h-4 w-4 text-violet-600" />
            裁剪封面
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 bg-[linear-gradient(180deg,#f8f7ff_0%,#f2f7ff_100%)] p-5">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
            <canvas
              ref={canvasRef}
              className={`block w-full touch-none rounded-xl bg-slate-950/90 ${BLOG_COVER_ASPECT_CLASS}`}
              style={{ cursor: dragging ? 'grabbing' : 'grab' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <ZoomIn className="h-4 w-4 text-violet-500" />
                缩放预览
              </span>
              <span>{zoom.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(event) => {
                const nextZoom = Number(event.target.value);
                setZoom(nextZoom);
                applyClampedOffset(offsetX, offsetY, nextZoom);
              }}
              className="w-full accent-violet-600"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Move className="h-3.5 w-3.5" />
                拖动图片调整位置
              </span>
              <span>
                输出比例固定为 {BLOG_COVER_OUTPUT_WIDTH} x {BLOG_COVER_OUTPUT_HEIGHT}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
              取消
            </Button>
            <Button onClick={() => void handleConfirm()} disabled={processing || !imageLoaded}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                '确认裁剪'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
