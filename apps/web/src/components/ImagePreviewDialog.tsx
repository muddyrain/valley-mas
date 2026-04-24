import {
  Download,
  Loader2,
  Maximize2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/useAuthStore';
import { triggerResourceDownload } from '@/utils/resourceDownload';
import { toInlineUrl } from '@/utils/tos';

interface ImagePreviewDialogProps {
  open: boolean;
  src?: string;
  resourceId?: string;
  title?: string;
  onDownloaded?: () => void;
  onOpenChange: (open: boolean) => void;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const SCALE_STEP = 0.2;
const DRAG_RESISTANCE = 0.35;
const MOMENTUM_MIN_VELOCITY = 30;

type Offset = { x: number; y: number };
type Size = { width: number; height: number };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function applyResistance(value: number, limit: number) {
  if (limit <= 0) return value * DRAG_RESISTANCE;
  if (value < -limit) return -limit + (value + limit) * DRAG_RESISTANCE;
  if (value > limit) return limit + (value - limit) * DRAG_RESISTANCE;
  return value;
}

function getFittedImageSize(imageSize: Size, stageSize: Size): Size {
  if (!imageSize.width || !imageSize.height || !stageSize.width || !stageSize.height) {
    return { width: 0, height: 0 };
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth * 0.84 : stageSize.width;
  const viewportHeight =
    typeof window !== 'undefined' ? window.innerHeight * 0.72 : stageSize.height;
  const maxWidth = Math.min(stageSize.width, viewportWidth);
  const maxHeight = Math.min(stageSize.height, viewportHeight);
  const fittedScale = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height, 1);

  return {
    width: imageSize.width * fittedScale,
    height: imageSize.height * fittedScale,
  };
}

function isQuarterTurn(rotate: number) {
  const normalized = ((rotate % 180) + 180) % 180;
  return Math.abs(normalized - 90) < 0.01;
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
  resourceId,
  title,
  onDownloaded,
  onOpenChange,
}: ImagePreviewDialogProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [momentumRunning, setMomentumRunning] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageLoading, setImageLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scaleRef = useRef(1);
  const rotateRef = useRef(0);
  const offsetRef = useRef<Offset>({ x: 0, y: 0 });
  const velocityRef = useRef<Offset>({ x: 0, y: 0 });
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
    pointerId: -1,
    lastMoveTime: 0,
    lastOffsetX: 0,
    lastOffsetY: 0,
  });

  const canPreview = useMemo(() => Boolean(src), [src]);
  const displayTitle = useMemo(() => {
    const trimmed = (title || '').trim();
    return trimmed || guessTitle(src);
  }, [title, src]);

  // 转为 inline URL：加 TOS 图片处理参数后浏览器新标签可直接展示（不触发下载）
  const inlineSrc = useMemo(() => toInlineUrl(src), [src]);

  const syncOffset = (nextOffset: Offset) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const syncScale = (nextScale: number) => {
    scaleRef.current = nextScale;
    setScale(nextScale);
  };

  const syncRotate = (nextRotate: number) => {
    rotateRef.current = nextRotate;
    setRotate(nextRotate);
  };

  const getOffsetBounds = (nextScale = scaleRef.current, nextRotate = rotateRef.current) => {
    const fitted = getFittedImageSize(imageSize, stageSize);
    if (!fitted.width || !fitted.height) return { maxX: 0, maxY: 0 };

    const rotated = isQuarterTurn(nextRotate)
      ? { width: fitted.height * nextScale, height: fitted.width * nextScale }
      : { width: fitted.width * nextScale, height: fitted.height * nextScale };

    return {
      maxX: Math.max((rotated.width - stageSize.width) / 2, 0),
      maxY: Math.max((rotated.height - stageSize.height) / 2, 0),
    };
  };

  const clampOffsetToBounds = (nextOffset: Offset, bounds = getOffsetBounds()): Offset => ({
    x: clamp(nextOffset.x, -bounds.maxX, bounds.maxX),
    y: clamp(nextOffset.y, -bounds.maxY, bounds.maxY),
  });

  const stopMomentum = (resetVelocity = true) => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setMomentumRunning(false);
    if (resetVelocity) {
      velocityRef.current = { x: 0, y: 0 };
    }
  };

  const startMomentum = () => {
    if (!canPreview) return;
    if (Math.hypot(velocityRef.current.x, velocityRef.current.y) < MOMENTUM_MIN_VELOCITY) {
      syncOffset(clampOffsetToBounds(offsetRef.current));
      velocityRef.current = { x: 0, y: 0 };
      return;
    }

    stopMomentum(false);
    setMomentumRunning(true);
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.032);
      lastTime = now;

      const bounds = getOffsetBounds();
      let nextX = offsetRef.current.x + velocityRef.current.x * dt;
      let nextY = offsetRef.current.y + velocityRef.current.y * dt;
      let nextVx = velocityRef.current.x;
      let nextVy = velocityRef.current.y;

      const overshootX =
        nextX < -bounds.maxX ? nextX + bounds.maxX : nextX > bounds.maxX ? nextX - bounds.maxX : 0;
      const overshootY =
        nextY < -bounds.maxY ? nextY + bounds.maxY : nextY > bounds.maxY ? nextY - bounds.maxY : 0;

      if (overshootX !== 0) {
        nextX += -overshootX * Math.min(1, dt * 14);
        nextVx *= 0.74 ** (dt * 60);
      } else {
        nextVx *= 0.93 ** (dt * 60);
      }

      if (overshootY !== 0) {
        nextY += -overshootY * Math.min(1, dt * 14);
        nextVy *= 0.74 ** (dt * 60);
      } else {
        nextVy *= 0.93 ** (dt * 60);
      }

      velocityRef.current = { x: nextVx, y: nextVy };
      syncOffset({ x: nextX, y: nextY });

      const clamped = clampOffsetToBounds({ x: nextX, y: nextY }, bounds);
      const closeToRest =
        Math.abs(nextVx) < 8 &&
        Math.abs(nextVy) < 8 &&
        Math.abs(clamped.x - nextX) < 0.5 &&
        Math.abs(clamped.y - nextY) < 0.5;

      if (closeToRest) {
        syncOffset(clamped);
        stopMomentum();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
  };

  const zoomTo = (nextScaleValue: number, anchor: Offset = { x: 0, y: 0 }) => {
    const safeScale = clamp(nextScaleValue, MIN_SCALE, MAX_SCALE);
    if (safeScale === scaleRef.current) return;

    stopMomentum();
    const ratio = safeScale / scaleRef.current;
    const rawOffset = {
      x: anchor.x - ratio * (anchor.x - offsetRef.current.x),
      y: anchor.y - ratio * (anchor.y - offsetRef.current.y),
    };

    syncScale(safeScale);
    syncOffset(clampOffsetToBounds(rawOffset, getOffsetBounds(safeScale, rotateRef.current)));
  };

  const rotateBy = (delta: number) => {
    stopMomentum();
    const nextRotate = rotateRef.current + delta;
    syncRotate(nextRotate);
    syncOffset(
      clampOffsetToBounds(offsetRef.current, getOffsetBounds(scaleRef.current, nextRotate)),
    );
  };

  const updateStageSize = () => {
    const rect = previewStageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setStageSize({ width: rect.width, height: rect.height });
  };

  useEffect(() => {
    if (!open) return;
    stopMomentum();
    syncScale(1);
    syncRotate(0);
    syncOffset({ x: 0, y: 0 });
    setImageSize({ width: 0, height: 0 });
    setDragging(false);
    setImageLoading(Boolean(src));
  }, [open, src]);

  useEffect(() => {
    if (!open) {
      stopMomentum();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updateStageSize();
    const stage = previewStageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver(() => updateStageSize());
    observer.observe(stage);
    window.addEventListener('resize', updateStageSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateStageSize);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    syncOffset(clampOffsetToBounds(offsetRef.current));
  }, [open, imageSize, stageSize, scale, rotate]);

  const reset = () => {
    stopMomentum();
    syncScale(1);
    syncRotate(0);
    syncOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPreview) return;
    if (e.button !== 0) return;
    stopMomentum();
    previewStageRef.current?.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      baseX: offsetRef.current.x,
      baseY: offsetRef.current.y,
      pointerId: e.pointerId,
      lastMoveTime: performance.now(),
      lastOffsetX: offsetRef.current.x,
      lastOffsetY: offsetRef.current.y,
    };
    velocityRef.current = { x: 0, y: 0 };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || dragStartRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const bounds = getOffsetBounds();
    const nextOffset = {
      x: applyResistance(dragStartRef.current.baseX + dx, bounds.maxX),
      y: applyResistance(dragStartRef.current.baseY + dy, bounds.maxY),
    };
    const now = performance.now();
    const elapsed = Math.max(now - dragStartRef.current.lastMoveTime, 1);

    velocityRef.current = {
      x:
        velocityRef.current.x * 0.35 +
        ((nextOffset.x - dragStartRef.current.lastOffsetX) / elapsed) * 1000 * 0.65,
      y:
        velocityRef.current.y * 0.35 +
        ((nextOffset.y - dragStartRef.current.lastOffsetY) / elapsed) * 1000 * 0.65,
    };

    dragStartRef.current.lastMoveTime = now;
    dragStartRef.current.lastOffsetX = nextOffset.x;
    dragStartRef.current.lastOffsetY = nextOffset.y;
    syncOffset(nextOffset);
  };

  const endDragging = (pointerId?: number) => {
    if (pointerId !== undefined && dragStartRef.current.pointerId !== pointerId) return;
    if (pointerId !== undefined) {
      try {
        previewStageRef.current?.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
    setDragging(false);
    dragStartRef.current.lastMoveTime = 0;
    dragStartRef.current.pointerId = -1;
    startMomentum();
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!canPreview) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = previewStageRef.current?.getBoundingClientRect();
    const anchor = rect
      ? {
          x: e.clientX - (rect.left + rect.width / 2),
          y: e.clientY - (rect.top + rect.height / 2),
        }
      : { x: 0, y: 0 };
    const nextScale = clamp(scaleRef.current * Math.exp(-e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);

    zoomTo(nextScale, anchor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:w-[90vw] sm:max-w-[90vw] h-[92vh] max-h-[92vh] p-0 border-none bg-transparent shadow-none overflow-hidden [&>button]:hidden">
        {/* 毛玻璃背景遮罩 */}
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          onClick={() => onOpenChange(false)}
        />

        {/* 主容器 */}
        <div className="relative flex h-full w-full flex-col">
          {/* 顶部标题栏 */}
          <div className="relative z-10 flex items-center justify-between px-5 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Maximize2 className="h-3.5 w-3.5 text-white/80" />
              </div>
              <span className="truncate text-sm font-medium text-white/90 max-w-[60vw]">
                {displayTitle}
              </span>
            </div>
            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:bg-white/30 hover:scale-110 active:scale-95"
              title="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 图片区域 */}
          <div
            ref={previewStageRef}
            className={`relative flex flex-1 items-center justify-center overflow-hidden px-6 pb-4 select-none ${
              canPreview ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => endDragging(e.pointerId)}
            onPointerCancel={(e) => endDragging(e.pointerId)}
            onWheel={handleWheel}
            style={{ touchAction: 'none' }}
          >
            {canPreview ? (
              <>
                <img
                  src={inlineSrc}
                  alt={displayTitle}
                  draggable={false}
                  className={`pointer-events-none select-none rounded-xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={(e) => {
                    setImageSize({
                      width: e.currentTarget.naturalWidth,
                      height: e.currentTarget.naturalHeight,
                    });
                    setImageLoading(false);
                    updateStageSize();
                  }}
                  onError={() => setImageLoading(false)}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    maxWidth: '84vw',
                    maxHeight: '72vh',
                    width: 'auto',
                    height: 'auto',
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
                    transformOrigin: 'center center',
                    transition:
                      dragging || momentumRunning
                        ? 'none'
                        : 'transform 260ms cubic-bezier(0.22,1,0.36,1)',
                    willChange: 'transform',
                  }}
                />
                {imageLoading && (
                  <BoxLoadingOverlay
                    show={imageLoading}
                    title="图片加载中..."
                    hint="高分辨率图片可能稍慢"
                    tone="dark"
                    className="pointer-events-none rounded-xl"
                  />
                )}
              </>
            ) : (
              <div className="text-sm text-white/60">暂无可预览图片</div>
            )}
          </div>

          {/* 底部工具栏 */}
          <div className="relative z-10 flex justify-center pb-5">
            <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-white/10 p-1.5 backdrop-blur-xl shadow-lg">
              {/* 缩小 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  zoomTo(scaleRef.current - SCALE_STEP);
                }}
                className="group flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-all hover:bg-white/20 hover:text-white"
                title="缩小"
              >
                <ZoomOut className="h-4 w-4" />
              </button>

              {/* 缩放比例 */}
              <div className="min-w-[3.2rem] text-center text-xs font-medium text-white/60 tabular-nums select-none">
                {Math.round(scale * 100)}%
              </div>

              {/* 放大 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  zoomTo(scaleRef.current + SCALE_STEP);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-all hover:bg-white/20 hover:text-white"
                title="放大"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              {/* 分隔线 */}
              <div className="mx-1 h-5 w-px bg-white/15" />

              {/* 向左旋转 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  rotateBy(-90);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-all hover:bg-white/20 hover:text-white"
                title="向左旋转"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* 向右旋转 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  rotateBy(90);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-all hover:bg-white/20 hover:text-white"
                title="向右旋转"
              >
                <RotateCw className="h-4 w-4" />
              </button>

              {/* 分隔线 */}
              <div className="mx-1 h-5 w-px bg-white/15" />

              {/* 复位 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  reset();
                }}
                className="flex h-9 items-center justify-center rounded-xl px-3 text-xs font-medium text-white/70 transition-all hover:bg-white/20 hover:text-white"
                title="复位"
              >
                复位
              </button>

              {/* 分隔线 */}
              <div className="mx-1 h-5 w-px bg-white/15" />

              {/* 下载资源 */}
              <button
                type="button"
                disabled={downloading}
                onClick={async (e) => {
                  e.stopPropagation();
                  const downloaded = await triggerResourceDownload({
                    resourceId,
                    isAuthenticated,
                    onRequireAuth: () => {
                      toast.error('请先登录后下载');
                      navigate('/login');
                    },
                    onStart: () => setDownloading(true),
                    onFinally: () => setDownloading(false),
                  });
                  if (!resourceId && inlineSrc) {
                    window.open(inlineSrc, '_blank', 'noopener,noreferrer');
                  }
                  if (downloaded) {
                    onDownloaded?.();
                  }
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-all hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                title="下载原图"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
