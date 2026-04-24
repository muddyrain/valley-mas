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
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imageLoading, setImageLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, baseX: 0, baseY: 0, pointerId: -1 });

  const canPreview = useMemo(() => Boolean(src), [src]);
  const displayTitle = useMemo(() => {
    const trimmed = (title || '').trim();
    return trimmed || guessTitle(src);
  }, [title, src]);

  // 转为 inline URL：加 TOS 图片处理参数后浏览器新标签可直接展示（不触发下载）
  const inlineSrc = useMemo(() => toInlineUrl(src), [src]);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setImageLoading(Boolean(src));
  }, [open, src]);

  const reset = () => {
    setScale(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPreview) return;
    if (e.button !== 0) return;
    previewStageRef.current?.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
      pointerId: e.pointerId,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || dragStartRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({ x: dragStartRef.current.baseX + dx, y: dragStartRef.current.baseY + dy });
  };

  const endDragging = (pointerId?: number) => {
    if (pointerId !== undefined) {
      try {
        previewStageRef.current?.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
    setDragging(false);
    dragStartRef.current.pointerId = -1;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!canPreview) return;
    e.preventDefault();
    e.stopPropagation();
    setScale((value) => clamp(value - Math.sign(e.deltaY || 0) * SCALE_STEP, MIN_SCALE, MAX_SCALE));
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
          >
            {canPreview ? (
              <>
                <img
                  src={inlineSrc}
                  alt={displayTitle}
                  draggable={false}
                  className={`pointer-events-none select-none rounded-xl shadow-[0_32px_80px_rgba(0,0,0,0.7)] transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    maxWidth: '84vw',
                    maxHeight: '72vh',
                    width: 'auto',
                    height: 'auto',
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
                    transformOrigin: 'center center',
                    transition: dragging ? 'none' : 'transform 260ms cubic-bezier(0.22,1,0.36,1)',
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
                  setScale((v) => clamp(v - SCALE_STEP, MIN_SCALE, MAX_SCALE));
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
                  setScale((v) => clamp(v + SCALE_STEP, MIN_SCALE, MAX_SCALE));
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
                  setRotate((v) => v - 90);
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
                  setRotate((v) => v + 90);
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
