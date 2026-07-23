import { Brush, Eraser, ImagePlus, MousePointer2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

type CanvasTool = 'select' | 'brush' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  mode: 'draw' | 'erase';
  color: string;
  width: number;
  points: Point[];
}

interface ImageLayer {
  id: string;
  name: string;
  dataUrl: string;
  sourceAspect: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fitCanvas?: boolean;
}

const CANVAS_SIZES: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
};

const createID = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function getImageLayerSize(
  sourceAspect: number,
  canvasSize: { width: number; height: number },
  scale: number,
) {
  const safeSourceAspect = sourceAspect > 0 ? sourceAspect : 1;
  const canvasAspect = canvasSize.width / canvasSize.height;
  const safeScale = Math.min(0.95, Math.max(0.15, scale));
  if (safeSourceAspect >= canvasAspect) {
    return {
      width: safeScale,
      height: (safeScale * canvasAspect) / safeSourceAspect,
    };
  }
  return {
    width: (safeScale * safeSourceAspect) / canvasAspect,
    height: safeScale,
  };
}

export interface SketchCanvasHandle {
  exportDataURL: () => string | null;
  hasContent: () => boolean;
}

interface SketchCanvasProps {
  aspectRatio: string;
  disabled?: boolean;
  onContentChange?: (hasContent: boolean) => void;
  restoreSnapshot?: {
    id: string;
    dataURL: string;
  };
}

function renderCanvasScene(
  canvas: HTMLCanvasElement,
  layers: ImageLayer[],
  strokes: Stroke[],
  images: Map<string, HTMLImageElement>,
  selectedLayerID?: string,
) {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const layer of layers) {
    const image = images.get(layer.id);
    if (!image?.complete) continue;
    const x = layer.x * canvas.width;
    const y = layer.y * canvas.height;
    const width = layer.width * canvas.width;
    const height = layer.height * canvas.height;
    context.drawImage(image, x, y, width, height);
    if (layer.id === selectedLayerID) {
      context.save();
      context.strokeStyle = '#2563eb';
      context.lineWidth = Math.max(2, canvas.width / 500);
      context.setLineDash([canvas.width / 80, canvas.width / 120]);
      context.strokeRect(x, y, width, height);
      context.restore();
    }
  }

  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.save();
    context.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.width * canvas.width;
    const [first, ...rest] = stroke.points;
    context.beginPath();
    context.moveTo(first.x * canvas.width, first.y * canvas.height);
    if (rest.length === 0) {
      context.arc(
        first.x * canvas.width,
        first.y * canvas.height,
        Math.max(1, (stroke.width * canvas.width) / 2),
        0,
        Math.PI * 2,
      );
      context.fill();
    } else {
      for (const point of rest) {
        context.lineTo(point.x * canvas.width, point.y * canvas.height);
      }
      context.stroke();
    }
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = 'destination-over';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
}

export const SketchCanvas = forwardRef<SketchCanvasHandle, SketchCanvasProps>(function SketchCanvas(
  { aspectRatio, disabled = false, onContentChange, restoreSnapshot },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageElementsRef = useRef(new Map<string, HTMLImageElement>());
  const restoredSnapshotIDRef = useRef<string | undefined>(undefined);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [tool, setTool] = useState<CanvasTool>('brush');
  const [brushColor, setBrushColor] = useState('#111827');
  const [brushSize, setBrushSize] = useState(1.25);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [layers, setLayers] = useState<ImageLayer[]>([]);
  const [selectedLayerID, setSelectedLayerID] = useState<string>();
  const [activeStrokeID, setActiveStrokeID] = useState<string>();
  const canvasSize = CANVAS_SIZES[aspectRatio] ?? CANVAS_SIZES['1:1'];

  const selectedLayer = useMemo(
    () => layers.find((layer) => layer.id === selectedLayerID),
    [layers, selectedLayerID],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !CANVAS_SIZES[aspectRatio]) return;
    renderCanvasScene(canvas, layers, strokes, imageElementsRef.current, selectedLayerID);
  }, [aspectRatio, layers, selectedLayerID, strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    setLayers((current) =>
      current.map((layer) => {
        if (layer.fitCanvas) {
          return { ...layer, x: 0, y: 0, width: 1, height: 1 };
        }
        const nextSize = getImageLayerSize(
          layer.sourceAspect,
          canvasSize,
          Math.max(layer.width, layer.height),
        );
        return {
          ...layer,
          ...nextSize,
          x: Math.min(layer.x, 1 - nextSize.width),
          y: Math.min(layer.y, 1 - nextSize.height),
        };
      }),
    );
  }, [canvasSize]);

  useEffect(() => {
    onContentChange?.(layers.length > 0 || strokes.length > 0);
  }, [layers.length, onContentChange, strokes.length]);

  useEffect(() => {
    if (!restoreSnapshot || restoredSnapshotIDRef.current === restoreSnapshot.id) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      const id = `history-${restoreSnapshot.id}`;
      imageElementsRef.current.clear();
      imageElementsRef.current.set(id, image);
      setStrokes([]);
      setLayers([
        {
          id,
          name: '历史画布快照',
          dataUrl: restoreSnapshot.dataURL,
          sourceAspect: image.naturalWidth / image.naturalHeight || 1,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          fitCanvas: true,
        },
      ]);
      setSelectedLayerID(undefined);
      setTool('select');
      restoredSnapshotIDRef.current = restoreSnapshot.id;
    };
    image.onerror = () => {
      if (active) toast.error('画布快照读取失败，请稍后重试');
    };
    image.src = restoreSnapshot.dataURL;
    return () => {
      active = false;
    };
  }, [restoreSnapshot]);

  useImperativeHandle(
    ref,
    () => ({
      hasContent: () => layers.length > 0 || strokes.length > 0,
      exportDataURL: () => {
        if (layers.length === 0 && strokes.length === 0) return null;
        const output = document.createElement('canvas');
        output.width = canvasSize.width;
        output.height = canvasSize.height;
        renderCanvasScene(output, layers, strokes, imageElementsRef.current);
        return output.toDataURL('image/png', 0.95);
      },
    }),
    [canvasSize.height, canvasSize.width, layers, strokes],
  );

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };

  const hitTestLayer = (point: Point) =>
    [...layers]
      .reverse()
      .find(
        (layer) =>
          point.x >= layer.x &&
          point.x <= layer.x + layer.width &&
          point.y >= layer.y &&
          point.y <= layer.y + layer.height,
      );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (tool === 'select') {
      const layer = hitTestLayer(point);
      setSelectedLayerID(layer?.id);
      dragRef.current = layer
        ? { id: layer.id, offsetX: point.x - layer.x, offsetY: point.y - layer.y }
        : null;
      return;
    }
    const id = createID();
    setActiveStrokeID(id);
    setSelectedLayerID(undefined);
    setStrokes((current) => [
      ...current,
      {
        id,
        mode: tool === 'eraser' ? 'erase' : 'draw',
        color: brushColor,
        width: brushSize / 100,
        points: [point],
      },
    ]);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const point = pointFromEvent(event);
    if (tool === 'select' && dragRef.current) {
      setLayers((current) =>
        current.map((layer) => {
          if (layer.id !== dragRef.current?.id) return layer;
          return {
            ...layer,
            x: Math.min(1 - layer.width, Math.max(0, point.x - (dragRef.current?.offsetX ?? 0))),
            y: Math.min(1 - layer.height, Math.max(0, point.y - (dragRef.current?.offsetY ?? 0))),
          };
        }),
      );
      return;
    }
    if (!activeStrokeID) return;
    setStrokes((current) =>
      current.map((stroke) =>
        stroke.id === activeStrokeID ? { ...stroke, points: [...stroke.points, point] } : stroke,
      ),
    );
  };

  const stopPointerAction = () => {
    dragRef.current = null;
    setActiveStrokeID(undefined);
  };

  const addImageLayer = (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('素材仅支持 JPG、PNG 或 WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('单张素材不能超过 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const image = new Image();
      image.onload = () => {
        const id = createID();
        const aspect = image.naturalWidth / image.naturalHeight;
        const size = getImageLayerSize(aspect, canvasSize, 0.55);
        const layer: ImageLayer = {
          id,
          name: file.name,
          dataUrl: reader.result as string,
          sourceAspect: aspect,
          x: (1 - size.width) / 2,
          y: (1 - size.height) / 2,
          ...size,
        };
        imageElementsRef.current.set(id, image);
        setLayers((current) => [...current, layer]);
        setSelectedLayerID(id);
        setTool('select');
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const updateSelectedLayerSize = (value: number) => {
    if (!selectedLayer) return;
    setLayers((current) =>
      current.map((layer) => {
        if (layer.id !== selectedLayer.id) return layer;
        const nextSize = getImageLayerSize(layer.sourceAspect, canvasSize, value / 100);
        return {
          ...layer,
          ...nextSize,
          x: Math.min(layer.x, 1 - nextSize.width),
          y: Math.min(layer.y, 1 - nextSize.height),
        };
      }),
    );
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayerID) return;
    imageElementsRef.current.delete(selectedLayerID);
    setLayers((current) => current.filter((layer) => layer.id !== selectedLayerID));
    setSelectedLayerID(undefined);
  };

  const clearCanvas = () => {
    setStrokes([]);
    setLayers([]);
    setSelectedLayerID(undefined);
    imageElementsRef.current.clear();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-xs">
            <Button
              type="button"
              variant={tool === 'select' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setTool('select')}
              aria-label="选择并移动素材"
              aria-pressed={tool === 'select'}
              disabled={disabled}
            >
              <MousePointer2 />
            </Button>
            <Button
              type="button"
              variant={tool === 'brush' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setTool('brush')}
              aria-label="画笔"
              aria-pressed={tool === 'brush'}
              disabled={disabled}
            >
              <Brush />
            </Button>
            <Button
              type="button"
              variant={tool === 'eraser' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setTool('eraser')}
              aria-label="橡皮"
              aria-pressed={tool === 'eraser'}
              disabled={disabled}
            >
              <Eraser />
            </Button>
          </div>
          <Input
            type="color"
            value={brushColor}
            onChange={(event) => setBrushColor(event.target.value)}
            className="size-9 bg-card p-1"
            aria-label="画笔颜色"
            disabled={disabled || tool !== 'brush'}
          />
          <div className="flex w-44 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-xs">
            <Label className="shrink-0 text-xs text-muted-foreground">粗细</Label>
            <Slider
              value={[brushSize]}
              min={0.5}
              max={4}
              step={0.25}
              onValueChange={(value) =>
                setBrushSize((Array.isArray(value) ? value[0] : value) ?? 1.25)
              }
              disabled={disabled}
              aria-label="画笔粗细"
            />
            <span className="w-6 text-right text-[11px] tabular-nums text-muted-foreground">
              {brushSize.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || layers.length >= 3}
          >
            <ImagePlus />
            添加素材
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) addImageLayer(file);
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setStrokes((current) => current.slice(0, -1))}
            aria-label="撤销上一笔"
            disabled={disabled || strokes.length === 0}
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clearCanvas}
            aria-label="清空画布"
            disabled={disabled || (strokes.length === 0 && layers.length === 0)}
          >
            <RotateCcw />
          </Button>
        </div>
      </div>

      <div
        className="relative flex min-h-[18rem] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 p-3 sm:min-h-[24rem] sm:p-5"
        data-testid="ai-image-canvas-stage"
      >
        {selectedLayer ? (
          <div className="absolute top-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-3 rounded-lg border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:top-5 sm:right-5">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {selectedLayer.name}
            </span>
            <div className="flex w-48 shrink-0 items-center gap-2">
              <Label className="shrink-0 whitespace-nowrap text-xs">大小</Label>
              <Slider
                value={[Math.round(Math.max(selectedLayer.width, selectedLayer.height) * 100)]}
                min={15}
                max={95}
                step={1}
                onValueChange={(value) =>
                  updateSelectedLayerSize((Array.isArray(value) ? value[0] : value) ?? 55)
                }
                disabled={disabled}
                aria-label="素材大小"
              />
              <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(Math.max(selectedLayer.width, selectedLayer.height) * 100)}%
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={deleteSelectedLayer}
              aria-label="删除素材"
              disabled={disabled}
            >
              <Trash2 />
            </Button>
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className={cn(
            'block max-h-[68vh] max-w-full touch-none rounded-lg bg-white shadow-md ring-1 ring-border',
            tool === 'select' ? 'cursor-move' : 'cursor-crosshair',
            disabled && 'cursor-wait opacity-90',
          )}
          style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPointerAction}
          onPointerCancel={stopPointerAction}
          aria-label="图片创作画布"
        />
      </div>
    </div>
  );
});
