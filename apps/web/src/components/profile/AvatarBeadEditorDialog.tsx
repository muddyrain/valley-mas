import { ImagePlus, Loader2, Sparkles, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type AvatarEffect = 'none' | 'pixel' | 'beads';

type Rgb = { r: number; g: number; b: number };

interface AvatarBeadEditorDialogProps {
  open: boolean;
  file?: File | null;
  currentAvatarUrl?: string;
  avatarHistory?: Array<{ id: string; avatarUrl: string; createdAt: string }>;
  avatarHistoryLoading?: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void>;
  onApplyHistory?: (id: string) => Promise<void>;
}

const CANVAS_SIZE = 512;
const SLIDER_DEBOUNCE_MS = 140;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dist2(a: Rgb, b: Rgb) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function buildPalette(pixels: Uint8ClampedArray, maxColors: number): Rgb[] {
  const bucket = new Map<string, { count: number; r: number; g: number; b: number }>();
  const step = 18;

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3] / 255;
    if (a <= 0.04) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const kr = Math.round(r / step) * step;
    const kg = Math.round(g / step) * step;
    const kb = Math.round(b / step) * step;
    const key = `${kr}-${kg}-${kb}`;

    const prev = bucket.get(key);
    if (prev) {
      prev.count += 1;
      prev.r += r;
      prev.g += g;
      prev.b += b;
    } else {
      bucket.set(key, { count: 1, r, g, b });
    }
  }

  const sorted = [...bucket.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(2, maxColors))
    .map((entry) => ({
      r: Math.round(entry.r / entry.count),
      g: Math.round(entry.g / entry.count),
      b: Math.round(entry.b / entry.count),
    }));

  if (sorted.length === 0) return [{ r: 235, g: 235, b: 235 }];
  return sorted;
}

function mapPixelsToPalette(pixels: Uint8ClampedArray, palette: Rgb[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length);

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3] / 255;
    if (a <= 0.04) {
      out[i] = pixels[i];
      out[i + 1] = pixels[i + 1];
      out[i + 2] = pixels[i + 2];
      out[i + 3] = 0;
      continue;
    }

    const current = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    let nearest = palette[0];
    let nearestDist = Number.POSITIVE_INFINITY;

    for (const color of palette) {
      const d = dist2(current, color);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = color;
      }
    }

    out[i] = nearest.r;
    out[i + 1] = nearest.g;
    out[i + 2] = nearest.b;
    out[i + 3] = pixels[i + 3];
  }

  return out;
}

function calcBounds(image: HTMLImageElement, zoom: number) {
  const size = CANVAS_SIZE;
  const baseScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
  const scale = baseScale * zoom;
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const maxOffsetX = Math.max(0, (drawW - size) / 2);
  const maxOffsetY = Math.max(0, (drawH - size) / 2);

  return { size, drawW, drawH, maxOffsetX, maxOffsetY };
}

function renderAvatarToCanvas(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  effect: AvatarEffect,
  zoom: number,
  offsetX: number,
  offsetY: number,
  beadGrid: number,
  paletteSize: number,
  showBeadHole: boolean,
) {
  const { size, drawW, drawH, maxOffsetX, maxOffsetY } = calcBounds(image, zoom);
  ctx.clearRect(0, 0, size, size);

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = size;
  baseCanvas.height = size;
  const bctx = baseCanvas.getContext('2d');
  if (!bctx) return;

  const appliedX = clamp(offsetX * maxOffsetX, -maxOffsetX, maxOffsetX);
  const appliedY = clamp(offsetY * maxOffsetY, -maxOffsetY, maxOffsetY);
  const dx = (size - drawW) / 2 + appliedX;
  const dy = (size - drawH) / 2 + appliedY;

  bctx.clearRect(0, 0, size, size);
  bctx.imageSmoothingEnabled = true;
  bctx.drawImage(image, dx, dy, drawW, drawH);

  if (effect === 'none') {
    ctx.drawImage(baseCanvas, 0, 0);
    return;
  }

  const grid = effect === 'pixel' ? clamp(beadGrid + 20, 32, 180) : beadGrid;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = grid;
  sampleCanvas.height = grid;
  const sctx = sampleCanvas.getContext('2d');
  if (!sctx) return;

  sctx.imageSmoothingEnabled = true;
  sctx.clearRect(0, 0, grid, grid);
  sctx.drawImage(baseCanvas, 0, 0, grid, grid);

  const sampled = sctx.getImageData(0, 0, grid, grid);
  const palette = buildPalette(sampled.data, paletteSize);
  const quantized = mapPixelsToPalette(sampled.data, palette);
  const cell = size / grid;

  if (effect === 'pixel') {
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        const i = (y * grid + x) * 4;
        const a = quantized[i + 3] / 255;
        if (a <= 0.04) continue;
        ctx.fillStyle = `rgba(${quantized[i]},${quantized[i + 1]},${quantized[i + 2]},${a})`;
        ctx.fillRect(x * cell, y * cell, cell + 0.4, cell + 0.4);
      }
    }
    return;
  }

  const checker = 14;
  for (let y = 0; y < size; y += checker) {
    for (let x = 0; x < size; x += checker) {
      const odd = (x / checker + y / checker) % 2 === 0;
      ctx.fillStyle = odd ? '#f8fafc' : '#eef2f7';
      ctx.fillRect(x, y, checker, checker);
    }
  }

  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const i = (y * grid + x) * 4;
      const a = quantized[i + 3] / 255;
      if (a <= 0.04) continue;

      const r = quantized[i];
      const g = quantized[i + 1];
      const b = quantized[i + 2];

      const px = x * cell;
      const py = y * cell;
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fillRect(px, py, cell + 0.2, cell + 0.2);

      if (showBeadHole) {
        const hole = Math.max(0.8, cell * 0.16);
        const cx = px + cell / 2;
        const cy = py + cell / 2;
        ctx.fillStyle = `rgba(${Math.max(0, r - 65)},${Math.max(0, g - 65)},${Math.max(0, b - 65)},0.55)`;
        ctx.beginPath();
        ctx.arc(cx, cy, hole, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const lineW = clamp(cell * 0.04, 0.35, 0.75);
  ctx.strokeStyle = 'rgba(242, 245, 250, 0.8)';
  ctx.lineWidth = lineW;
  ctx.beginPath();
  for (let i = 0; i <= grid; i++) {
    const p = i * cell + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
  }
  ctx.stroke();
}

export default function AvatarBeadEditorDialog({
  open,
  file,
  currentAvatarUrl,
  avatarHistory = [],
  avatarHistoryLoading = false,
  onOpenChange,
  onCancel,
  onSave,
  onApplyHistory,
}: AvatarBeadEditorDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [stagedHistoryId, setStagedHistoryId] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [effect, setEffect] = useState<AvatarEffect>('beads');
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [beadGrid, setBeadGrid] = useState(48);
  const [paletteSize, setPaletteSize] = useState(36);
  const [showBeadHole, setShowBeadHole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [crossOriginTainted, setCrossOriginTainted] = useState(false);

  const [renderZoom, setRenderZoom] = useState(1);
  const [renderBeadGrid, setRenderBeadGrid] = useState(48);
  const [renderPaletteSize, setRenderPaletteSize] = useState(36);

  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseOffsetX: number;
    baseOffsetY: number;
  } | null>(null);

  const imageReady = useMemo(() => Boolean(open && image), [open, image]);
  const canApplyPixelEffects = useMemo(() => Boolean(sourceFile), [sourceFile]);
  const defaultEffect: AvatarEffect = canApplyPixelEffects ? 'beads' : 'none';
  const dragHint = useMemo(() => {
    if (!image) return { canDragX: false, canDragY: false };
    const { maxOffsetX, maxOffsetY } = calcBounds(image, zoom);
    return { canDragX: maxOffsetX > 0.5, canDragY: maxOffsetY > 0.5 };
  }, [image, zoom]);

  const isAdjustDefault =
    zoom === 1 &&
    offsetX === 0 &&
    offsetY === 0 &&
    effect === defaultEffect &&
    beadGrid === 48 &&
    paletteSize === 36 &&
    !showBeadHole;

  const hasUnsavedWork = Boolean(sourceFile || sourceUrl || image);

  useEffect(() => {
    if (!open) {
      setSourceFile(null);
      setSourceUrl(null);
      setStagedHistoryId(null);
      setImage(null);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setEffect(defaultEffect);
      setBeadGrid(48);
      setPaletteSize(36);
      setShowBeadHole(false);
      setRenderZoom(1);
      setRenderBeadGrid(48);
      setRenderPaletteSize(36);
      setDragging(false);
      setCrossOriginTainted(false);
      dragStateRef.current = null;
    }
  }, [open, defaultEffect]);

  useEffect(() => {
    if (!open) return;
    if (file) {
      setSourceFile(file);
      setSourceUrl(null);
      setStagedHistoryId(null);
      setEffect('beads');
    } else if (currentAvatarUrl) {
      setSourceFile(null);
      setSourceUrl(currentAvatarUrl);
      setStagedHistoryId(null);
      setEffect('none');
    }
  }, [open, file, currentAvatarUrl]);

  useEffect(() => {
    if (!canApplyPixelEffects && effect !== 'none') {
      setEffect('none');
    }
  }, [canApplyPixelEffects, effect]);

  useEffect(() => {
    const timer = window.setTimeout(() => setRenderZoom(zoom), SLIDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [zoom]);

  useEffect(() => {
    const timer = window.setTimeout(() => setRenderBeadGrid(beadGrid), SLIDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [beadGrid]);

  useEffect(() => {
    const timer = window.setTimeout(() => setRenderPaletteSize(paletteSize), SLIDER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [paletteSize]);

  useEffect(() => {
    if (!sourceFile && !sourceUrl) {
      setImage(null);
      return;
    }

    let objectUrl: string | null = null;
    const img = new Image();
    img.onload = () => setImage(img);

    if (sourceFile) {
      objectUrl = URL.createObjectURL(sourceFile);
      img.src = objectUrl;
    } else if (sourceUrl) {
      img.src = sourceUrl;
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceFile, sourceUrl]);

  useEffect(() => {
    if (!imageReady || !image || !previewCanvasRef.current || !exportCanvasRef.current) return;
    const pctx = previewCanvasRef.current.getContext('2d');
    const ectx = exportCanvasRef.current.getContext('2d');
    if (!pctx || !ectx) return;

    try {
      renderAvatarToCanvas(
        pctx,
        image,
        effect,
        renderZoom,
        offsetX,
        offsetY,
        renderBeadGrid,
        renderPaletteSize,
        showBeadHole,
      );
      renderAvatarToCanvas(
        ectx,
        image,
        effect,
        renderZoom,
        offsetX,
        offsetY,
        renderBeadGrid,
        renderPaletteSize,
        showBeadHole,
      );
      setCrossOriginTainted(false);
    } catch {
      renderAvatarToCanvas(
        pctx,
        image,
        'none',
        renderZoom,
        offsetX,
        offsetY,
        renderBeadGrid,
        renderPaletteSize,
        false,
      );
      renderAvatarToCanvas(
        ectx,
        image,
        'none',
        renderZoom,
        offsetX,
        offsetY,
        renderBeadGrid,
        renderPaletteSize,
        false,
      );
      setCrossOriginTainted(true);
    }
  }, [
    effect,
    image,
    imageReady,
    offsetX,
    offsetY,
    renderZoom,
    renderBeadGrid,
    renderPaletteSize,
    showBeadHole,
  ]);

  const resetAdjust = () => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setEffect(defaultEffect);
    setBeadGrid(48);
    setPaletteSize(36);
    setShowBeadHole(false);
    setRenderZoom(1);
    setRenderBeadGrid(48);
    setRenderPaletteSize(36);
  };

  const handleSelectFile = (fileInput?: File | null) => {
    if (!fileInput) return;
    if (!fileInput.type.startsWith('image/')) return;
    if (fileInput.size > 5 * 1024 * 1024) return;
    setSourceFile(fileInput);
    setSourceUrl(null);
    setStagedHistoryId(null);
    resetAdjust();
  };

  const handlePickHistoryPreview = (id: string, avatarUrl: string) => {
    if (stagedHistoryId === id && sourceUrl === avatarUrl) return;
    setSourceFile(null);
    setSourceUrl(avatarUrl);
    setStagedHistoryId(id);
    resetAdjust();
  };

  useEffect(() => {
    if (!open) return;
    if (sourceFile) return;
    if (!currentAvatarUrl) return;
    if (stagedHistoryId) return;
    if (!avatarHistory || avatarHistory.length === 0) return;

    const current = currentAvatarUrl.trim();
    const hit = avatarHistory.find((item) => item.avatarUrl?.trim() === current);
    if (hit) {
      setStagedHistoryId(hit.id);
      setSourceUrl(hit.avatarUrl);
    }
  }, [open, sourceFile, currentAvatarUrl, stagedHistoryId, avatarHistory]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!imageReady || !image || !previewWrapRef.current) return;
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseOffsetX: offsetX,
      baseOffsetY: offsetY,
    };
    setDragging(true);
    previewWrapRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || !image || !previewWrapRef.current) return;
    const s = dragStateRef.current;
    const rect = previewWrapRef.current.getBoundingClientRect();
    const { maxOffsetX, maxOffsetY } = calcBounds(image, zoom);

    const ratio = CANVAS_SIZE / Math.max(1, rect.width);
    const deltaXCanvas = (e.clientX - s.startX) * ratio;
    const deltaYCanvas = (e.clientY - s.startY) * ratio;

    const nextX = maxOffsetX <= 0 ? 0 : clamp(s.baseOffsetX + deltaXCanvas / maxOffsetX, -1, 1);
    const nextY = maxOffsetY <= 0 ? 0 : clamp(s.baseOffsetY + deltaYCanvas / maxOffsetY, -1, 1);

    setOffsetX(nextX);
    setOffsetY(nextY);
  };

  const endDragging = (pointerId?: number) => {
    if (previewWrapRef.current && pointerId !== undefined) {
      try {
        previewWrapRef.current.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    }
    dragStateRef.current = null;
    setDragging(false);
  };

  const requestClose = () => {
    if (saving) return;
    if (hasUnsavedWork) {
      toast('当前有未保存的头像编辑内容', {
        description: '确认关闭后，本次调整将丢失。',
        duration: 8000,
        cancel: { label: '继续编辑', onClick: () => {} },
        action: {
          label: '确认关闭',
          onClick: () => {
            onCancel();
            onOpenChange(false);
          },
        },
      });
      return;
    }
    onCancel();
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!imageReady || !image) return;
    if (!sourceFile && crossOriginTainted) {
      toast.error('跨域头像无法直接保存', {
        description: '请先点击“更换图片”上传本地图片，再保存头像。',
      });
      return;
    }

    if (stagedHistoryId && isAdjustDefault && onApplyHistory) {
      setSaving(true);
      try {
        await onApplyHistory(stagedHistoryId);
        onOpenChange(false);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!sourceFile && sourceUrl && sourceUrl === currentAvatarUrl && isAdjustDefault) {
      onOpenChange(false);
      return;
    }

    const exportCtx = exportCanvasRef.current?.getContext('2d');
    if (!exportCtx || !exportCanvasRef.current) return;

    try {
      renderAvatarToCanvas(
        exportCtx,
        image,
        effect,
        zoom,
        offsetX,
        offsetY,
        beadGrid,
        paletteSize,
        showBeadHole,
      );
    } catch {
      toast.error('跨域图片导出失败', {
        description: '浏览器安全策略限制了当前图片导出，请先上传本地图片。',
      });
      return;
    }

    setSaving(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvasRef.current?.toBlob(resolve, 'image/png', 0.95),
      );
      if (!blob) return;
      await onSave(blob);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        requestClose();
      }}
    >
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-[1020px] p-0 overflow-hidden">
        <DialogHeader className="border-b border-slate-200 bg-white px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-theme-primary" />
            头像拼豆工坊
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[85vh] overflow-y-auto bg-slate-50 p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div
                ref={previewWrapRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={(e) => endDragging(e.pointerId)}
                onPointerCancel={(e) => endDragging(e.pointerId)}
                className={`relative mx-auto h-[360px] w-[360px] max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner select-none ${
                  imageReady ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
                }`}
              >
                {imageReady ? (
                  <>
                    <canvas
                      ref={previewCanvasRef}
                      width={CANVAS_SIZE}
                      height={CANVAS_SIZE}
                      className="h-full w-full"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-3 rounded-xl border border-white/60 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.35)]" />
                      <div className="absolute left-1/2 top-3 h-[calc(100%-1.5rem)] w-px -translate-x-1/2 bg-white/55" />
                      <div className="absolute top-1/2 left-3 h-px w-[calc(100%-1.5rem)] -translate-y-1/2 bg-white/55" />
                      <div className="absolute right-3 top-3 rounded-md bg-black/35 px-2 py-1 text-[11px] text-white">
                        {dragHint.canDragX && dragHint.canDragY
                          ? '可上下左右拖动'
                          : dragHint.canDragX
                            ? '可左右拖动'
                            : dragHint.canDragY
                              ? '可上下拖动'
                              : '当前无需拖动'}
                      </div>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500 transition hover:bg-slate-100"
                  >
                    <UploadCloud className="h-8 w-8" />
                    <span className="text-sm">点击选择头像图片</span>
                    <span className="text-xs text-slate-400">支持 PNG/JPG，最大 5MB</span>
                  </button>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">拖拽预览区可移动裁剪，输出为 1:1 方形头像</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => inputRef.current?.click()}
                >
                  <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                  更换图片
                </Button>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSelectFile(e.target.files?.[0])}
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="mb-2 text-xs text-slate-500">拼豆风格</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'none', label: '原图' },
                    { key: 'pixel', label: '像素块' },
                    { key: 'beads', label: '拼豆' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => setEffect(item.key as AvatarEffect)}
                      disabled={
                        !canApplyPixelEffects && (item.key === 'pixel' || item.key === 'beads')
                      }
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        effect === item.key
                          ? 'bg-theme-primary text-white'
                          : !canApplyPixelEffects && (item.key === 'pixel' || item.key === 'beads')
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>缩放</span>
                  <span>{zoom.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                  disabled={!imageReady}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>颗粒密度</span>
                  <span>{beadGrid}</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={130}
                  step={1}
                  value={beadGrid}
                  onChange={(e) => setBeadGrid(Number(e.target.value))}
                  className="w-full"
                  disabled={!imageReady || effect === 'none' || !canApplyPixelEffects}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>色板数量</span>
                  <span>{paletteSize}</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={96}
                  step={1}
                  value={paletteSize}
                  onChange={(e) => setPaletteSize(Number(e.target.value))}
                  className="w-full"
                  disabled={!imageReady || effect === 'none' || !canApplyPixelEffects}
                />
              </div>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
                <span>显示中间小圆孔</span>
                <input
                  type="checkbox"
                  checked={showBeadHole}
                  onChange={(e) => setShowBeadHole(e.target.checked)}
                  className="h-4 w-4  accent-theme-primary"
                  disabled={!canApplyPixelEffects || effect === 'none'}
                />
              </label>

              {!canApplyPixelEffects && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  当前是远程头像预览，拼豆/像素块仅支持本次上传的本地图片。
                </div>
              )}

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>历史头像</span>
                  <span>{avatarHistory.length} 张</span>
                </div>
                {avatarHistoryLoading ? (
                  <div className="py-2 text-xs text-slate-400">加载中...</div>
                ) : avatarHistory.length === 0 ? (
                  <div className="py-2 text-xs text-slate-400">暂无历史头像</div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {avatarHistory.map((item) => {
                      const active = stagedHistoryId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handlePickHistoryPreview(item.id, item.avatarUrl)}
                          disabled={saving || active}
                          className={`group relative aspect-square overflow-hidden rounded-md border transition ${
                            active
                              ? 'border-theme-primary ring-2 ring-theme-primary/50'
                              : 'border-slate-200 hover:border-theme-primary'
                          }`}
                          title="点击预览该历史头像"
                        >
                          <img
                            src={item.avatarUrl}
                            alt="历史头像"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-black/40 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                            {active ? '已选' : '预览'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-theme-primary/10 p-3 text-xs leading-5 text-theme-primary">
                点击历史头像会先在左侧预览，只有点“保存头像”才会真正更新。
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={requestClose} disabled={saving}>
                  取消
                </Button>
                <Button onClick={() => void handleSave()} disabled={!imageReady || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存头像'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <canvas ref={exportCanvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
