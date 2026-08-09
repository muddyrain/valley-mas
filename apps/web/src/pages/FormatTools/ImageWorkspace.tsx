import {
  type BrowserImageMimeType,
  createImageTransformPlan,
  type ImageResizeFit,
  type ImageTransformOptions,
  type ImageWatermarkPosition,
  runBrowserImageTool,
} from '@valley/browser-media';
import { formatBytes } from '@valley/format-tools';
import {
  Crop,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  ImageDown,
  Loader2,
  Lock,
  Maximize2,
  RotateCcw,
  RotateCw,
  Scaling,
  Settings2,
  Trash2,
  Type,
  Unlock,
  Upload,
  WandSparkles,
} from 'lucide-react';
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  type CropHandle,
  type CropRect,
  createInsetCrop,
  moveCropRect,
  resizeCropRect,
} from './imageEditorGeometry';

type EditorMode = 'resize' | 'crop' | 'transform' | 'corner' | 'watermark' | 'export';
type CropAspect = 'free' | '1:1' | '4:3' | '16:9';

interface ImageFormState {
  width: string;
  height: string;
  maxDimension: string;
  fit: ImageResizeFit;
  cropX: string;
  cropY: string;
  cropWidth: string;
  cropHeight: string;
  rotateDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  cornerRadius: string;
  mimeType: BrowserImageMimeType;
  quality: number;
  watermarkText: string;
  watermarkPosition: ImageWatermarkPosition;
  watermarkOpacity: number;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface CropDragState {
  mode: CropHandle;
  startClientX: number;
  startClientY: number;
  initialCrop: CropRect;
}

const INITIAL_IMAGE_FORM: ImageFormState = {
  width: '',
  height: '',
  maxDimension: '',
  fit: 'contain',
  cropX: '0',
  cropY: '0',
  cropWidth: '',
  cropHeight: '',
  rotateDegrees: 0,
  flipHorizontal: false,
  flipVertical: false,
  cornerRadius: '',
  mimeType: 'image/webp',
  quality: 82,
  watermarkText: '',
  watermarkPosition: 'bottom-right',
  watermarkOpacity: 72,
};

const EDITOR_MODES = [
  { id: 'resize', label: '尺寸', icon: Scaling },
  { id: 'crop', label: '裁剪', icon: Crop },
  { id: 'transform', label: '旋转', icon: RotateCw },
  { id: 'corner', label: '圆角', icon: Maximize2 },
  { id: 'watermark', label: '水印', icon: Type },
  { id: 'export', label: '导出', icon: Settings2 },
] satisfies Array<{ id: EditorMode; label: string; icon: typeof Scaling }>;

const WATERMARK_POSITIONS: Array<{
  id: ImageWatermarkPosition;
  label: string;
  gridClass: string;
  previewClass: string;
}> = [
  {
    id: 'top-left',
    label: '左上',
    gridClass: 'col-start-1 row-start-1',
    previewClass: 'left-4 top-4',
  },
  {
    id: 'top-center',
    label: '上方居中',
    gridClass: 'col-start-2 row-start-1',
    previewClass: 'left-1/2 top-4 -translate-x-1/2',
  },
  {
    id: 'top-right',
    label: '右上',
    gridClass: 'col-start-3 row-start-1',
    previewClass: 'right-4 top-4',
  },
  {
    id: 'center',
    label: '居中',
    gridClass: 'col-start-2 row-start-2',
    previewClass: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
  },
  {
    id: 'bottom-left',
    label: '左下',
    gridClass: 'col-start-1 row-start-3',
    previewClass: 'bottom-4 left-4',
  },
  {
    id: 'bottom-center',
    label: '下方居中',
    gridClass: 'col-start-2 row-start-3',
    previewClass: 'bottom-4 left-1/2 -translate-x-1/2',
  },
  {
    id: 'bottom-right',
    label: '右下',
    gridClass: 'col-start-3 row-start-3',
    previewClass: 'right-4 bottom-4',
  },
];

const CROP_HANDLES: Array<{
  id: Exclude<CropHandle, 'move'>;
  label: string;
  className: string;
}> = [
  {
    id: 'north-west',
    label: '从左上角调整裁剪范围',
    className: '-left-4 -top-4 cursor-nwse-resize',
  },
  {
    id: 'north',
    label: '从上侧调整裁剪范围',
    className: 'left-1/2 -top-4 -translate-x-1/2 cursor-ns-resize',
  },
  {
    id: 'north-east',
    label: '从右上角调整裁剪范围',
    className: '-right-4 -top-4 cursor-nesw-resize',
  },
  {
    id: 'east',
    label: '从右侧调整裁剪范围',
    className: '-right-4 top-1/2 -translate-y-1/2 cursor-ew-resize',
  },
  {
    id: 'south-east',
    label: '从右下角调整裁剪范围',
    className: '-right-4 -bottom-4 cursor-nwse-resize',
  },
  {
    id: 'south',
    label: '从下侧调整裁剪范围',
    className: 'left-1/2 -bottom-4 -translate-x-1/2 cursor-ns-resize',
  },
  {
    id: 'south-west',
    label: '从左下角调整裁剪范围',
    className: '-left-4 -bottom-4 cursor-nesw-resize',
  },
  {
    id: 'west',
    label: '从左侧调整裁剪范围',
    className: '-left-4 top-1/2 -translate-y-1/2 cursor-ew-resize',
  },
];

function readPositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readNonNegativeNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function ImageWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const [form, setForm] = useState<ImageFormState>(INITIAL_IMAGE_FORM);
  const [activeMode, setActiveMode] = useState<EditorMode>('resize');
  const [cropAspect, setCropAspect] = useState<CropAspect>('free');
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [sourceDimensions, setSourceDimensions] = useState<ImageDimensions | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const cropDragRef = useRef<CropDragState | null>(null);

  useEffect(
    () => () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
    [sourceUrl],
  );

  useEffect(
    () => () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    },
    [outputUrl],
  );

  const clearOutput = () => {
    setOutputFile(null);
    setOutputUrl('');
    setShowOutput(false);
  };

  const updateForm = <Key extends keyof ImageFormState>(key: Key, value: ImageFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    clearOutput();
  };

  const updateFormValues = (values: Partial<ImageFormState>) => {
    setForm((current) => ({ ...current, ...values }));
    clearOutput();
  };

  const chooseFile = (nextFile: File | null) => {
    setError('');
    clearOutput();
    if (!nextFile) {
      setFile(null);
      setSourceUrl('');
      setSourceDimensions(null);
      return;
    }
    if (!nextFile.type.startsWith('image/')) {
      setError('请选择有效的图片文件。');
      return;
    }
    if (nextFile.type === 'image/gif') {
      setError('GIF 动图暂不支持，当前工具会处理静态图片。');
      return;
    }
    setFile(nextFile);
    setSourceDimensions(null);
    setForm(INITIAL_IMAGE_FORM);
    setCropAspect('free');
    setActiveMode('resize');
    setSourceUrl(URL.createObjectURL(nextFile));
  };

  const handleSourceLoaded = (image: HTMLImageElement) => {
    if (sourceDimensions || !image.naturalWidth || !image.naturalHeight) return;
    const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
    setSourceDimensions(dimensions);
    setForm((current) => ({
      ...current,
      cropX: '0',
      cropY: '0',
      cropWidth: String(dimensions.width),
      cropHeight: String(dimensions.height),
    }));
  };

  const readCropRect = (dimensions: ImageDimensions): CropRect => ({
    x: readNonNegativeNumber(form.cropX) ?? 0,
    y: readNonNegativeNumber(form.cropY) ?? 0,
    width: readPositiveNumber(form.cropWidth) ?? dimensions.width,
    height: readPositiveNumber(form.cropHeight) ?? dimensions.height,
  });

  const writeCropRect = (crop: CropRect) => {
    updateFormValues({
      cropX: String(crop.x),
      cropY: String(crop.y),
      cropWidth: String(crop.width),
      cropHeight: String(crop.height),
    });
  };

  const activateEditorMode = (mode: EditorMode) => {
    setActiveMode(mode);
    setShowOutput(false);
    if (mode !== 'crop' || !sourceDimensions) return;

    const crop = readCropRect(sourceDimensions);
    const coversSource =
      crop.x === 0 &&
      crop.y === 0 &&
      crop.width >= sourceDimensions.width &&
      crop.height >= sourceDimensions.height;
    if (coversSource) writeCropRect(createInsetCrop(sourceDimensions));
  };

  const updateOutputDimension = (key: 'width' | 'height', value: string) => {
    if (!lockAspectRatio || !sourceDimensions || !readPositiveNumber(value)) {
      updateForm(key, value);
      return;
    }
    const crop = readCropRect(sourceDimensions);
    const ratio = crop.width / crop.height;
    if (key === 'width') {
      updateFormValues({ width: value, height: String(Math.round(Number(value) / ratio)) });
    } else {
      updateFormValues({ height: value, width: String(Math.round(Number(value) * ratio)) });
    }
  };

  const applyResizePreset = (preset: 'original' | 'half' | '1080' | '1920') => {
    if (preset === 'original') {
      updateFormValues({ width: '', height: '', maxDimension: '' });
      return;
    }
    if (preset === 'half' && sourceDimensions) {
      updateFormValues({
        width: String(Math.max(1, Math.round(sourceDimensions.width / 2))),
        height: String(Math.max(1, Math.round(sourceDimensions.height / 2))),
        maxDimension: '',
      });
      return;
    }
    updateFormValues({ width: '', height: '', maxDimension: preset });
  };

  const applyResizeScale = (percentage: number) => {
    if (!sourceDimensions) return;
    const crop = readCropRect(sourceDimensions);
    updateFormValues({
      width: String(Math.max(1, Math.round(crop.width * (percentage / 100)))),
      height: String(Math.max(1, Math.round(crop.height * (percentage / 100)))),
      maxDimension: '',
    });
  };

  const applyCropAspect = (aspect: CropAspect) => {
    setCropAspect(aspect);
    if (!sourceDimensions || aspect === 'free') return;
    const ratio = aspect === '1:1' ? 1 : aspect === '4:3' ? 4 / 3 : 16 / 9;
    writeCropRect(createInsetCrop(sourceDimensions, ratio));
  };

  const startCropDrag = (event: ReactPointerEvent<HTMLElement>, mode: CropHandle) => {
    if (!sourceDimensions) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initialCrop: readCropRect(sourceDimensions),
    };
  };

  const moveCrop = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = cropDragRef.current;
    const frame = previewFrameRef.current;
    if (!drag || !frame || !sourceDimensions) return;
    const bounds = frame.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const deltaX = ((event.clientX - drag.startClientX) / bounds.width) * sourceDimensions.width;
    const deltaY = ((event.clientY - drag.startClientY) / bounds.height) * sourceDimensions.height;

    const nextCrop =
      drag.mode === 'move'
        ? moveCropRect(drag.initialCrop, deltaX, deltaY, sourceDimensions)
        : resizeCropRect(drag.initialCrop, drag.mode, deltaX, deltaY, sourceDimensions);
    if (drag.mode !== 'move') setCropAspect('free');
    writeCropRect(nextCrop);
  };

  const finishCropDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cropDragRef.current = null;
  };

  const buildOptions = (): ImageTransformOptions => {
    const cropWidth = readPositiveNumber(form.cropWidth);
    const cropHeight = readPositiveNumber(form.cropHeight);
    const watermarkText = form.watermarkText.trim();
    return {
      width: readPositiveNumber(form.width),
      height: readPositiveNumber(form.height),
      maxDimension: readPositiveNumber(form.maxDimension),
      fit: form.fit,
      allowUpscale: true,
      crop:
        cropWidth && cropHeight
          ? {
              x: readNonNegativeNumber(form.cropX) ?? 0,
              y: readNonNegativeNumber(form.cropY) ?? 0,
              width: cropWidth,
              height: cropHeight,
            }
          : undefined,
      rotateDegrees: form.rotateDegrees,
      flipHorizontal: form.flipHorizontal,
      flipVertical: form.flipVertical,
      cornerRadius: readNonNegativeNumber(form.cornerRadius),
      mimeType: form.mimeType,
      quality: form.quality / 100,
      watermark: watermarkText
        ? {
            text: watermarkText,
            position: form.watermarkPosition,
            opacity: form.watermarkOpacity / 100,
          }
        : undefined,
    };
  };

  const processImage = async () => {
    if (!file) {
      setError('请先选择一张图片。');
      return;
    }
    setError('');
    setIsProcessing(true);
    try {
      const result = await runBrowserImageTool({ file, options: buildOptions() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOutputFile(result.file);
      setOutputUrl(URL.createObjectURL(result.file));
      setShowOutput(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImage = () => {
    setFile(null);
    setSourceUrl('');
    clearOutput();
    setForm(INITIAL_IMAGE_FORM);
    setSourceDimensions(null);
    setActiveMode('resize');
    setCropAspect('free');
    setError('');
  };

  const centerCrop = () => {
    if (!sourceDimensions) return;
    const ratio =
      cropAspect === '1:1'
        ? 1
        : cropAspect === '4:3'
          ? 4 / 3
          : cropAspect === '16:9'
            ? 16 / 9
            : undefined;
    writeCropRect(createInsetCrop(sourceDimensions, ratio));
  };

  const restoreFullCrop = () => {
    if (!sourceDimensions) return;
    setCropAspect('free');
    writeCropRect({ x: 0, y: 0, ...sourceDimensions });
  };

  const cropStyle = sourceDimensions
    ? {
        left: `${((readNonNegativeNumber(form.cropX) ?? 0) / sourceDimensions.width) * 100}%`,
        top: `${((readNonNegativeNumber(form.cropY) ?? 0) / sourceDimensions.height) * 100}%`,
        width: `${((readPositiveNumber(form.cropWidth) ?? sourceDimensions.width) / sourceDimensions.width) * 100}%`,
        height: `${((readPositiveNumber(form.cropHeight) ?? sourceDimensions.height) / sourceDimensions.height) * 100}%`,
      }
    : undefined;
  const previewPlan = sourceDimensions
    ? createImageTransformPlan(sourceDimensions, buildOptions())
    : null;
  const previewDimensions =
    activeMode === 'crop' && sourceDimensions
      ? sourceDimensions
      : previewPlan
        ? { width: previewPlan.outputWidth, height: previewPlan.outputHeight }
        : null;
  const previewAspectRatio = previewDimensions
    ? previewDimensions.width / previewDimensions.height
    : 1;
  const previewWidth =
    previewAspectRatio >= 1 ? 'min(100%, 42rem)' : `min(100%, calc(34rem * ${previewAspectRatio}))`;
  const cornerRadius = readNonNegativeNumber(form.cornerRadius) ?? 0;
  const cornerRadiusPercent =
    activeMode === 'crop' || !previewDimensions
      ? 0
      : clamp(
          (cornerRadius / Math.min(previewDimensions.width, previewDimensions.height)) * 100,
          0,
          50,
        );
  const previewCrop = previewPlan?.source;
  const previewScale =
    sourceDimensions && previewPlan
      ? Math.round((previewPlan.drawWidth / readCropRect(sourceDimensions).width) * 100)
      : 100;
  const watermarkPosition = WATERMARK_POSITIONS.find(
    (position) => position.id === form.watermarkPosition,
  );
  const previewingOutput = showOutput && Boolean(outputUrl);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-border border-b px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-xl tracking-tight text-balance">图片处理</h2>
            <Badge variant="outline">图片</Badge>
          </div>
          <p className="max-w-2xl text-muted-foreground text-sm leading-6 text-pretty">
            在画面上调整裁剪、水印和外观，再导出需要的尺寸与格式。
          </p>
        </div>
        {file ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs tabular-nums">
            {sourceDimensions ? (
              <span>
                {sourceDimensions.width} × {sourceDimensions.height}
              </span>
            ) : null}
            <span>{formatBytes(file.size)}</span>
          </div>
        ) : null}
      </div>

      {!sourceUrl ? (
        <div className="p-4 sm:p-6">
          <label
            htmlFor="image-upload"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              chooseFile(event.dataTransfer.files[0] ?? null);
            }}
            className="flex min-h-[28rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-border border-dashed bg-muted/20 px-6 text-center transition-[background-color,border-color] duration-150 hover:border-primary/50 hover:bg-muted/40"
          >
            <span className="grid size-14 place-items-center rounded-2xl border border-border bg-background shadow-sm">
              <Upload className="size-6 text-primary" aria-hidden="true" />
            </span>
            <span className="mt-5 font-medium text-base">拖入图片，或点击选择</span>
            <span className="mt-1 text-muted-foreground text-sm">JPEG、PNG、WebP 等静态图片</span>
            <span className="mt-5 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm">
              选择图片
            </span>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      ) : (
        <>
          <div className="grid min-h-[38rem] xl:grid-cols-[5rem_minmax(0,1fr)_20rem]">
            <nav
              className="flex gap-1 overflow-x-auto border-border border-b bg-muted/20 p-2 xl:flex-col xl:border-r xl:border-b-0"
              aria-label="图片编辑工具"
            >
              {EDITOR_MODES.map((mode) => {
                const Icon = mode.icon;
                const selected = activeMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => activateEditorMode(mode.id)}
                    className={cn(
                      'flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 font-medium text-xs transition-[background-color,color,scale] duration-150 active:scale-[0.96]',
                      selected
                        ? 'bg-background text-primary shadow-sm'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" strokeWidth={selected ? 2 : 1.5} aria-hidden="true" />
                    {mode.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex min-w-0 flex-col bg-muted/10">
              <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-border border-b bg-background/80 px-3 py-2 sm:px-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{file?.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {previewingOutput ? '输出结果' : '编辑预览'}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
                  <Button
                    type="button"
                    size="xs"
                    variant={!previewingOutput ? 'secondary' : 'ghost'}
                    onClick={() => setShowOutput(false)}
                  >
                    编辑预览
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant={previewingOutput ? 'secondary' : 'ghost'}
                    disabled={!outputUrl}
                    onClick={() => setShowOutput(true)}
                  >
                    输出结果
                  </Button>
                </div>
              </div>

              <div className="relative flex min-h-[30rem] flex-1 items-center justify-center overflow-hidden p-5 sm:p-8">
                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(-45deg,hsl(var(--muted))_25%,transparent_25%),linear-gradient(45deg,transparent_75%,hsl(var(--muted))_75%),linear-gradient(-45deg,transparent_75%,hsl(var(--muted))_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px]" />
                <div
                  ref={previewFrameRef}
                  data-testid="image-preview-surface"
                  data-preview-size={
                    previewDimensions
                      ? `${previewDimensions.width} × ${previewDimensions.height}`
                      : undefined
                  }
                  className="relative shrink-0 bg-background shadow-xl ring-1 ring-foreground/10"
                  style={{
                    width: previewWidth,
                    aspectRatio: previewDimensions
                      ? `${previewDimensions.width} / ${previewDimensions.height}`
                      : '1 / 1',
                    borderRadius: `${cornerRadiusPercent}%`,
                    overflow: 'hidden',
                  }}
                >
                  {previewingOutput ? (
                    <img
                      src={outputUrl}
                      alt="图片输出预览"
                      className="absolute inset-0 size-full select-none object-contain"
                      draggable={false}
                    />
                  ) : !sourceDimensions || activeMode === 'crop' ? (
                    <img
                      src={sourceUrl}
                      alt="图片编辑预览"
                      onLoad={(event) => handleSourceLoaded(event.currentTarget)}
                      className="absolute inset-0 size-full select-none object-contain"
                      draggable={false}
                    />
                  ) : previewPlan && previewCrop ? (
                    <div
                      className="absolute top-1/2 left-1/2 overflow-hidden"
                      style={{
                        width: `${(previewPlan.drawWidth / previewPlan.outputWidth) * 100}%`,
                        height: `${(previewPlan.drawHeight / previewPlan.outputHeight) * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${previewPlan.rotateDegrees}deg) scaleX(${previewPlan.flipHorizontal ? -1 : 1}) scaleY(${previewPlan.flipVertical ? -1 : 1})`,
                      }}
                    >
                      <img
                        src={sourceUrl}
                        alt="图片编辑预览"
                        onLoad={(event) => handleSourceLoaded(event.currentTarget)}
                        className="absolute max-h-none max-w-none select-none"
                        draggable={false}
                        style={{
                          width: `${(sourceDimensions.width / previewCrop.width) * 100}%`,
                          height: `${(sourceDimensions.height / previewCrop.height) * 100}%`,
                          left: `${(-previewCrop.x / previewCrop.width) * 100}%`,
                          top: `${(-previewCrop.y / previewCrop.height) * 100}%`,
                        }}
                      />
                    </div>
                  ) : null}

                  {!previewingOutput && activeMode === 'crop' && cropStyle ? (
                    <div
                      role="presentation"
                      data-testid="crop-selection"
                      style={cropStyle}
                      onPointerDown={(event) => startCropDrag(event, 'move')}
                      onPointerMove={moveCrop}
                      onPointerUp={finishCropDrag}
                      onPointerCancel={finishCropDrag}
                      className="absolute cursor-move touch-none border-2 border-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]"
                    >
                      <span className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                        {Array.from({ length: 9 }, (_, index) => (
                          <span
                            key={index}
                            className={cn(
                              index % 3 !== 2 && 'border-border/50 border-r',
                              index < 6 && 'border-border/50 border-b',
                            )}
                          />
                        ))}
                      </span>
                      {CROP_HANDLES.map((handle) => (
                        <button
                          key={handle.id}
                          type="button"
                          aria-label={handle.label}
                          onPointerDown={(event) => startCropDrag(event, handle.id)}
                          onPointerMove={moveCrop}
                          onPointerUp={finishCropDrag}
                          onPointerCancel={finishCropDrag}
                          className={cn(
                            'absolute grid size-8 touch-none place-items-center rounded-md',
                            handle.className,
                          )}
                        >
                          <span className="pointer-events-none size-3 rounded-sm border-2 border-primary bg-background shadow-sm" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {!previewingOutput && form.watermarkText.trim() ? (
                    <span
                      data-testid="watermark-preview"
                      className={cn(
                        'pointer-events-none absolute max-w-[80%] truncate rounded bg-black/55 px-2 py-1 font-semibold text-white text-xs shadow-sm sm:text-sm',
                        watermarkPosition?.previewClass,
                      )}
                      style={{ opacity: form.watermarkOpacity / 100 }}
                    >
                      {form.watermarkText.trim()}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-11 items-center justify-between gap-3 border-border border-t bg-background/80 px-4 text-muted-foreground text-xs tabular-nums">
                <span>
                  {activeMode === 'crop'
                    ? '拖动选区移动，拖动任一边或角调整范围'
                    : '所有预览均在本地生成'}
                </span>
                {previewDimensions ? (
                  <span className="shrink-0">
                    {previewDimensions.width} × {previewDimensions.height}
                  </span>
                ) : null}
              </div>
            </div>

            <aside className="border-border border-t bg-background p-4 xl:border-t-0 xl:border-l sm:p-5">
              <EditorPanel title={EDITOR_MODES.find((mode) => mode.id === activeMode)?.label ?? ''}>
                {activeMode === 'resize' ? (
                  <ResizeControls
                    form={form}
                    previewDimensions={previewDimensions}
                    previewScale={previewScale}
                    lockAspectRatio={lockAspectRatio}
                    onToggleLock={() => setLockAspectRatio((current) => !current)}
                    onDimensionChange={updateOutputDimension}
                    onFormChange={updateForm}
                    onPreset={applyResizePreset}
                    onScale={applyResizeScale}
                  />
                ) : null}
                {activeMode === 'crop' ? (
                  <CropControls
                    form={form}
                    cropAspect={cropAspect}
                    onAspectChange={applyCropAspect}
                    onCenter={centerCrop}
                    onRestoreFull={restoreFullCrop}
                    onFormChange={(key, value) => {
                      setCropAspect('free');
                      updateForm(key, value);
                    }}
                  />
                ) : null}
                {activeMode === 'transform' ? (
                  <TransformControls form={form} onFormChange={updateForm} />
                ) : null}
                {activeMode === 'corner' ? (
                  <CornerControls form={form} onFormChange={updateForm} />
                ) : null}
                {activeMode === 'watermark' ? (
                  <WatermarkControls form={form} onFormChange={updateForm} />
                ) : null}
                {activeMode === 'export' ? (
                  <ExportControls form={form} outputFile={outputFile} onFormChange={updateForm} />
                ) : null}
              </EditorPanel>
            </aside>
          </div>

          {error ? (
            <div
              role="alert"
              className="mx-4 mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm sm:mx-6"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-border border-t bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={resetImage}>
                <Trash2 aria-hidden="true" />
                清空图片
              </Button>
              <label
                htmlFor="image-replace"
                className={buttonVariants({ variant: 'ghost', className: 'cursor-pointer' })}
              >
                <Upload aria-hidden="true" />
                更换图片
                <Input
                  id="image-replace"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              {outputUrl && outputFile ? (
                <a
                  href={outputUrl}
                  download={outputFile.name}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  <Download aria-hidden="true" />
                  下载结果
                </a>
              ) : null}
              <Button type="button" onClick={processImage} disabled={isProcessing}>
                {isProcessing ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <WandSparkles aria-hidden="true" />
                )}
                处理图片
              </Button>
            </div>
          </div>
        </>
      )}

      {!sourceUrl && error ? (
        <div
          role="alert"
          className="mx-4 mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm sm:mx-6 sm:mb-6"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}

function EditorPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-base">{title}</p>
        <p className="mt-1 text-muted-foreground text-xs">调整会立即显示在预览中</p>
      </div>
      {children}
    </div>
  );
}

function ResizeControls({
  form,
  previewDimensions,
  previewScale,
  lockAspectRatio,
  onToggleLock,
  onDimensionChange,
  onFormChange,
  onPreset,
  onScale,
}: {
  form: ImageFormState;
  previewDimensions: ImageDimensions | null;
  previewScale: number;
  lockAspectRatio: boolean;
  onToggleLock: () => void;
  onDimensionChange: (key: 'width' | 'height', value: string) => void;
  onFormChange: <Key extends keyof ImageFormState>(key: Key, value: ImageFormState[Key]) => void;
  onPreset: (preset: 'original' | 'half' | '1080' | '1920') => void;
  onScale: (percentage: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
        <p className="text-muted-foreground text-xs">当前输出尺寸</p>
        <p className="mt-1 font-semibold text-lg tabular-nums tracking-tight">
          {previewDimensions
            ? `${previewDimensions.width} × ${previewDimensions.height}`
            : '读取图片中'}
        </p>
      </div>
      <RangeField
        label="缩放比例"
        value={clamp(previewScale, 10, 300)}
        min={10}
        max={300}
        suffix="%"
        onChange={onScale}
      />
      <div className="grid grid-cols-2 gap-2">
        {[
          ['original', '原始尺寸'],
          ['half', '缩小 50%'],
          ['1080', '最长边 1080'],
          ['1920', '最长边 1920'],
        ].map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onPreset(value as 'original' | 'half' | '1080' | '1920')}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <NumberField
          label="宽度"
          ariaLabel="输出宽度"
          value={form.width}
          onChange={(value) => onDimensionChange('width', value)}
          placeholder="自动"
        />
        <Button
          type="button"
          size="icon"
          variant={lockAspectRatio ? 'secondary' : 'outline'}
          aria-label={lockAspectRatio ? '取消锁定宽高比' : '锁定宽高比'}
          onClick={onToggleLock}
        >
          {lockAspectRatio ? <Lock aria-hidden="true" /> : <Unlock aria-hidden="true" />}
        </Button>
        <NumberField
          label="高度"
          ariaLabel="输出高度"
          value={form.height}
          onChange={(value) => onDimensionChange('height', value)}
          placeholder="自动"
        />
      </div>
      <NumberField
        label="最长边限制"
        ariaLabel="最长边尺寸"
        value={form.maxDimension}
        onChange={(value) => onFormChange('maxDimension', value)}
        placeholder="不限"
      />
      <SelectField
        label="缩放方式"
        value={form.fit}
        onChange={(value) => onFormChange('fit', value as ImageResizeFit)}
        options={[
          ['contain', '完整适应'],
          ['cover', '填满裁切'],
          ['fill', '拉伸填满'],
        ]}
      />
    </div>
  );
}

function CropControls({
  form,
  cropAspect,
  onAspectChange,
  onCenter,
  onRestoreFull,
  onFormChange,
}: {
  form: ImageFormState;
  cropAspect: CropAspect;
  onAspectChange: (aspect: CropAspect) => void;
  onCenter: () => void;
  onRestoreFull: () => void;
  onFormChange: (key: 'cropX' | 'cropY' | 'cropWidth' | 'cropHeight', value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>画面比例</Label>
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-muted/30 p-1">
          {(['free', '1:1', '4:3', '16:9'] as const).map((aspect) => (
            <Button
              key={aspect}
              type="button"
              size="sm"
              variant={cropAspect === aspect ? 'secondary' : 'ghost'}
              onClick={() => onAspectChange(aspect)}
            >
              {aspect === 'free' ? '自由' : aspect}
            </Button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-3 text-muted-foreground text-xs leading-5">
        直接拖动选区改变位置；边缘与四角都可以调整裁剪范围。
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onCenter}>
          居中选区
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRestoreFull}>
          恢复全图
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="X"
          ariaLabel="裁剪起点 X"
          value={form.cropX}
          onChange={(value) => onFormChange('cropX', value)}
          min="0"
        />
        <NumberField
          label="Y"
          ariaLabel="裁剪起点 Y"
          value={form.cropY}
          onChange={(value) => onFormChange('cropY', value)}
          min="0"
        />
        <NumberField
          label="宽度"
          ariaLabel="裁剪宽度"
          value={form.cropWidth}
          onChange={(value) => onFormChange('cropWidth', value)}
          placeholder="原宽"
        />
        <NumberField
          label="高度"
          ariaLabel="裁剪高度"
          value={form.cropHeight}
          onChange={(value) => onFormChange('cropHeight', value)}
          placeholder="原高"
        />
      </div>
    </div>
  );
}

function TransformControls({
  form,
  onFormChange,
}: {
  form: ImageFormState;
  onFormChange: <Key extends keyof ImageFormState>(key: Key, value: ImageFormState[Key]) => void;
}) {
  const normalizedRotation = ((form.rotateDegrees % 360) + 360) % 360;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-20 flex-col"
          onClick={() => onFormChange('rotateDegrees', form.rotateDegrees - 90)}
        >
          <RotateCcw className="size-5" aria-hidden="true" />
          左转 90°
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-20 flex-col"
          onClick={() => onFormChange('rotateDegrees', form.rotateDegrees + 90)}
        >
          <RotateCw className="size-5" aria-hidden="true" />
          右转 90°
        </Button>
        <Button
          type="button"
          variant={form.flipHorizontal ? 'secondary' : 'outline'}
          className="h-20 flex-col"
          onClick={() => onFormChange('flipHorizontal', !form.flipHorizontal)}
        >
          <FlipHorizontal2 className="size-5" aria-hidden="true" />
          水平翻转
        </Button>
        <Button
          type="button"
          variant={form.flipVertical ? 'secondary' : 'outline'}
          className="h-20 flex-col"
          onClick={() => onFormChange('flipVertical', !form.flipVertical)}
        >
          <FlipVertical2 className="size-5" aria-hidden="true" />
          垂直翻转
        </Button>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
        <span className="text-muted-foreground">当前角度</span>
        <span className="font-medium tabular-nums">{normalizedRotation}°</span>
      </div>
    </div>
  );
}

function CornerControls({
  form,
  onFormChange,
}: {
  form: ImageFormState;
  onFormChange: <Key extends keyof ImageFormState>(key: Key, value: ImageFormState[Key]) => void;
}) {
  const radius = readNonNegativeNumber(form.cornerRadius) ?? 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-2">
        {[0, 8, 16, 32, 64].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`圆角 ${value} 像素`}
            aria-pressed={radius === value}
            onClick={() => onFormChange('cornerRadius', String(value))}
            className={cn(
              'flex aspect-square items-center justify-center border border-border bg-muted/40 transition-[background-color,border-color,scale] duration-150 active:scale-[0.96]',
              radius === value && 'border-primary bg-primary/10',
            )}
            style={{ borderRadius: `${Math.min(value, 20)}px` }}
          >
            <span className="text-xs tabular-nums">{value}</span>
          </button>
        ))}
      </div>
      <RangeField
        label="圆角半径"
        value={Math.min(radius, 200)}
        min={0}
        max={200}
        suffix="px"
        onChange={(value) => onFormChange('cornerRadius', String(value))}
      />
      <p className="text-muted-foreground text-xs leading-5">PNG 与 WebP 可保留透明圆角。</p>
    </div>
  );
}

function WatermarkControls({
  form,
  onFormChange,
}: {
  form: ImageFormState;
  onFormChange: <Key extends keyof ImageFormState>(key: Key, value: ImageFormState[Key]) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="watermark-text">水印文字</Label>
        <Input
          id="watermark-text"
          aria-label="水印文字"
          value={form.watermarkText}
          onChange={(event) => onFormChange('watermarkText', event.target.value)}
          placeholder="输入水印"
        />
      </div>
      <div className="space-y-2">
        <Label>点击选择位置</Label>
        <div className="grid aspect-video grid-cols-3 grid-rows-3 gap-2 rounded-lg border border-border bg-muted/30 p-3">
          {WATERMARK_POSITIONS.map((position) => (
            <button
              key={position.id}
              type="button"
              aria-label={`水印位置 ${position.label}`}
              aria-pressed={form.watermarkPosition === position.id}
              onClick={() => onFormChange('watermarkPosition', position.id)}
              className={cn(
                'size-6 place-self-center rounded-full border border-border bg-background transition-[background-color,border-color,scale] duration-150 active:scale-[0.96]',
                position.gridClass,
                form.watermarkPosition === position.id &&
                  'border-primary bg-primary shadow-[inset_0_0_0_5px_hsl(var(--background))]',
              )}
            />
          ))}
        </div>
      </div>
      <RangeField
        label="透明度"
        value={form.watermarkOpacity}
        min={1}
        max={100}
        suffix="%"
        onChange={(value) => onFormChange('watermarkOpacity', value)}
      />
    </div>
  );
}

function ExportControls({
  form,
  outputFile,
  onFormChange,
}: {
  form: ImageFormState;
  outputFile: File | null;
  onFormChange: <Key extends keyof ImageFormState>(key: Key, value: ImageFormState[Key]) => void;
}) {
  const formats: Array<{ value: BrowserImageMimeType; label: string; note: string }> = [
    { value: 'image/webp', label: 'WebP', note: '体积小' },
    { value: 'image/jpeg', label: 'JPEG', note: '兼容广' },
    { value: 'image/png', label: 'PNG', note: '无损透明' },
  ];
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>文件格式</Label>
        <div className="space-y-2">
          {formats.map((format) => (
            <button
              key={format.value}
              type="button"
              aria-pressed={form.mimeType === format.value}
              onClick={() => onFormChange('mimeType', format.value)}
              className={cn(
                'flex min-h-12 w-full items-center justify-between rounded-lg border border-border px-3 text-left transition-[background-color,border-color,scale] duration-150 active:scale-[0.96]',
                form.mimeType === format.value
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/40',
              )}
            >
              <span className="font-medium text-sm">{format.label}</span>
              <span className="text-muted-foreground text-xs">{format.note}</span>
            </button>
          ))}
        </div>
      </div>
      {form.mimeType !== 'image/png' ? (
        <RangeField
          label="输出质量"
          value={form.quality}
          min={1}
          max={100}
          suffix="%"
          onChange={(value) => onFormChange('quality', value)}
        />
      ) : (
        <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-muted-foreground text-xs leading-5">
          PNG 使用无损导出，不需要调整质量。
        </p>
      )}
      {outputFile ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <span className="grid size-10 place-items-center rounded-lg bg-background shadow-sm">
            <ImageDown className="size-4 text-primary" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-medium text-sm">输出已生成</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatBytes(outputFile.size)}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
  min = '1',
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      >
        {options.map(([optionValue, optionLabel]) => (
          <NativeSelectOption key={optionValue} value={optionValue}>
            {optionLabel}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-muted-foreground text-xs tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(nextValue) =>
          onChange(typeof nextValue === 'number' ? nextValue : (nextValue[0] ?? value))
        }
      />
    </div>
  );
}
