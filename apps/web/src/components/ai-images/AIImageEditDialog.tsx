import { Brush, Eraser, Expand, RotateCcw, WandSparkles } from 'lucide-react';
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { AIImageGeneration, CreateAIImageEditInput } from '@/api/aiImages';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type EditMode = CreateAIImageEditInput['mode'];
type EditTool = 'brush' | 'clear';

type CanvasGeometry = {
  width: number;
  height: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
};

const MODE_COPY: Record<EditMode, { title: string; hint: string; placeholder: string }> = {
  inpaint: {
    title: '局部重绘',
    hint: '涂抹需要重绘的区域',
    placeholder: '例如：将选区中的杯子改成蓝色陶瓷花瓶。',
  },
  erase_replace: {
    title: '擦除替换',
    hint: '涂抹需要移除或替换的元素',
    placeholder: '例如：移除选区中的路人，补全为连贯的草地和树影。',
  },
  outpaint: {
    title: '扩图',
    hint: '透明边缘将由模型补全',
    placeholder: '例如：向四周延展为有云层和远山的开阔风景。',
  },
};

const parseAspectRatio = (value: string) => {
  const [left, right] = value.split(':').map(Number);
  return Number.isFinite(left) && Number.isFinite(right) && left > 0 && right > 0
    ? left / right
    : 1;
};

function geometryFor(imageWidth: number, imageHeight: number, mode: EditMode, aspectRatio: string) {
  if (mode !== 'outpaint') {
    return {
      width: imageWidth,
      height: imageHeight,
      sourceX: 0,
      sourceY: 0,
      sourceWidth: imageWidth,
      sourceHeight: imageHeight,
    } satisfies CanvasGeometry;
  }
  const targetRatio = parseAspectRatio(aspectRatio);
  const sourceRatio = imageWidth / imageHeight;
  let width = imageWidth;
  let height = imageHeight;
  if (sourceRatio < targetRatio) {
    width = Math.ceil(imageHeight * targetRatio);
  } else if (sourceRatio > targetRatio) {
    height = Math.ceil(imageWidth / targetRatio);
  } else {
    width = Math.ceil(imageWidth * 1.25);
    height = Math.ceil(width / targetRatio);
  }
  return {
    width,
    height,
    sourceX: Math.round((width - imageWidth) / 2),
    sourceY: Math.round((height - imageHeight) / 2),
    sourceWidth: imageWidth,
    sourceHeight: imageHeight,
  } satisfies CanvasGeometry;
}

function selectionMaskDataURL(
  base: HTMLCanvasElement,
  selection: HTMLCanvasElement,
  geometry: CanvasGeometry,
) {
  const mask = document.createElement('canvas');
  mask.width = base.width;
  mask.height = base.height;
  const context = mask.getContext('2d');
  if (!context) throw new Error('无法创建编辑选区');
  context.fillStyle = '#000';
  context.fillRect(0, 0, mask.width, mask.height);
  if (geometry.sourceWidth !== geometry.width || geometry.sourceHeight !== geometry.height) {
    context.clearRect(0, 0, mask.width, mask.height);
    context.fillStyle = '#000';
    context.fillRect(
      geometry.sourceX,
      geometry.sourceY,
      geometry.sourceWidth,
      geometry.sourceHeight,
    );
  }
  context.globalCompositeOperation = 'destination-out';
  context.drawImage(selection, 0, 0);
  return mask.toDataURL('image/png');
}

export interface AIImageEditDialogProps {
  generation: AIImageGeneration | null;
  sourceImage: string;
  modelId: string;
  recipeId: string;
  styleProfileId?: string;
  aspectRatio: string;
  quality: string;
  open: boolean;
  creating?: boolean;
  supportsOutpainting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (generationId: string, input: CreateAIImageEditInput) => Promise<void>;
}

export function AIImageEditDialog({
  generation,
  sourceImage,
  modelId,
  recipeId,
  styleProfileId,
  aspectRatio,
  quality,
  open,
  creating = false,
  supportsOutpainting = false,
  onOpenChange,
  onSubmit,
}: AIImageEditDialogProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number }>();
  const [mode, setMode] = useState<EditMode>('inpaint');
  const [tool, setTool] = useState<EditTool>('brush');
  const [brushSize, setBrushSize] = useState(36);
  const [instruction, setInstruction] = useState('');
  const [hasSelection, setHasSelection] = useState(false);
  const geometry = useMemo(
    () =>
      sourceSize ? geometryFor(sourceSize.width, sourceSize.height, mode, aspectRatio) : undefined,
    [aspectRatio, mode, sourceSize],
  );

  useEffect(() => {
    if (!open || !sourceImage) return;
    const image = new Image();
    image.onload = () => setSourceSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = sourceImage;
  }, [open, sourceImage]);

  useEffect(() => {
    const base = baseCanvasRef.current;
    const selection = selectionCanvasRef.current;
    if (!base || !selection || !geometry || !sourceImage) return;
    const image = new Image();
    image.onload = () => {
      base.width = geometry.width;
      base.height = geometry.height;
      selection.width = geometry.width;
      selection.height = geometry.height;
      const context = base.getContext('2d');
      if (!context) return;
      context.clearRect(0, 0, base.width, base.height);
      context.drawImage(
        image,
        geometry.sourceX,
        geometry.sourceY,
        geometry.sourceWidth,
        geometry.sourceHeight,
      );
    };
    image.src = sourceImage;
  }, [geometry, sourceImage]);

  const clearSelection = () => {
    const canvas = selectionCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSelection(false);
  };

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = selectionCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
    const width = Math.max(8, (brushSize / Math.max(bounds.width, 1)) * canvas.width);
    context.globalCompositeOperation = tool === 'brush' ? 'source-over' : 'destination-out';
    context.fillStyle = 'rgba(239, 68, 68, 0.62)';
    context.beginPath();
    context.arc(x, y, width / 2, 0, Math.PI * 2);
    context.fill();
    setHasSelection(true);
  };

  const submit = async () => {
    const base = baseCanvasRef.current;
    const selection = selectionCanvasRef.current;
    if (!generation || !base || !selection || !geometry || !instruction.trim()) return;
    const input: CreateAIImageEditInput = {
      modelId,
      recipeId,
      styleProfileId,
      brief: instruction.trim(),
      aspectRatio,
      quality,
      mode,
      editImage: base.toDataURL('image/png'),
      mask: selectionMaskDataURL(base, selection, geometry),
    };
    await onSubmit(generation.id, input);
  };

  const canSubmit = Boolean(
    generation &&
      geometry &&
      instruction.trim() &&
      modelId &&
      !creating &&
      (mode === 'outpaint' || hasSelection) &&
      (mode !== 'outpaint' || supportsOutpainting),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>编辑图片</DialogTitle>
          <DialogDescription>{MODE_COPY[mode].hint}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MODE_COPY) as EditMode[]).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={mode === value ? 'secondary' : 'outline'}
                  onClick={() => {
                    setMode(value);
                    clearSelection();
                  }}
                  disabled={creating || (value === 'outpaint' && !supportsOutpainting)}
                  title={
                    value === 'outpaint' && !supportsOutpainting
                      ? '当前模型未验证扩图能力'
                      : undefined
                  }
                >
                  {value === 'inpaint' ? (
                    <Brush />
                  ) : value === 'erase_replace' ? (
                    <Eraser />
                  ) : (
                    <Expand />
                  )}
                  {MODE_COPY[value].title}
                </Button>
              ))}
            </div>
            <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
              <canvas
                ref={baseCanvasRef}
                className="block h-auto w-full bg-[radial-gradient(hsl(var(--muted-foreground)/0.18)_1px,transparent_1px)] [background-size:12px_12px]"
              />
              <canvas
                ref={selectionCanvasRef}
                className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
                onPointerDown={(event) => {
                  drawingRef.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  draw(event);
                }}
                onPointerMove={(event) => {
                  if (drawingRef.current) draw(event);
                }}
                onPointerUp={() => {
                  drawingRef.current = false;
                }}
                onPointerCancel={() => {
                  drawingRef.current = false;
                }}
                aria-label="图片编辑选区"
              />
            </div>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>选区工具</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={tool === 'brush' ? 'secondary' : 'outline'}
                  onClick={() => setTool('brush')}
                  disabled={creating}
                >
                  <Brush /> 涂抹
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={tool === 'clear' ? 'secondary' : 'outline'}
                  onClick={() => setTool('clear')}
                  disabled={creating}
                >
                  <Eraser /> 擦除
                </Button>
              </div>
              <input
                type="range"
                min="12"
                max="160"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
                className="w-full accent-primary"
                disabled={creating}
                aria-label="笔刷大小"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={clearSelection}
                disabled={creating}
              >
                <RotateCcw /> 清除选区
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-image-edit-instruction">{MODE_COPY[mode].title}要求</Label>
              <Textarea
                id="ai-image-edit-instruction"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder={MODE_COPY[mode].placeholder}
                className="min-h-32 resize-y"
                maxLength={1200}
                disabled={creating}
              />
            </div>
            <div
              className={cn(
                'rounded-lg border border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground',
              )}
            >
              {mode === 'outpaint'
                ? `按 ${aspectRatio} 扩展画布，原图保持居中作为参考。`
                : hasSelection
                  ? '未涂抹区域将作为保持参考，实际效果由所选模型决定。'
                  : '请先涂抹需要修改的区域。'}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={creating}
          >
            取消
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            <WandSparkles />
            {creating ? '正在创建任务' : '开始编辑'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
