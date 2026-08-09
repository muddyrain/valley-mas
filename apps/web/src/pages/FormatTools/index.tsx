import {
  type BrowserImageMimeType,
  type ImageResizeFit,
  type ImageTransformOptions,
  type ImageWatermarkPosition,
  runBrowserImageTool,
} from '@valley/browser-media';
import {
  type ConverterCategory,
  type ConverterDirection,
  FORMAT_CONVERTER_LIST,
  formatBytes,
  runFormatTool,
  STRUCTURED_FORMAT_TOOL_LIST,
  type TextCase,
} from '@valley/format-tools';
import {
  ArrowLeftRight,
  Braces,
  Check,
  Clipboard,
  Crop,
  Download,
  FileImage,
  FlipHorizontal2,
  FlipVertical2,
  Hash,
  ImageIcon,
  Loader2,
  type LucideIcon,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
  Upload,
  WandSparkles,
  WrapText,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ToolCategory = 'image' | ConverterCategory;
type CategoryFilter = 'all' | ToolCategory;

interface ToolCatalogItem {
  id: string;
  label: string;
  description: string;
  category: ToolCategory;
  keywords: string[];
  kind: 'format' | 'image';
  supportsReverse: boolean;
  forwardLabel: string;
  reverseLabel?: string;
  inputPlaceholder?: string;
}

const STRUCTURED_TOOL_COPY: Record<string, Pick<ToolCatalogItem, 'label' | 'description'>> = {
  'json-sort-keys': {
    label: 'JSON 键排序',
    description: '按字母顺序整理对象键，同时保留数组顺序。',
  },
  'json-pointer': {
    label: 'JSON 路径读取',
    description: '使用 JSON Pointer 精确读取嵌套值。',
  },
  'text-case': {
    label: '文本命名转换',
    description: '转换大小写与 camel、snake、kebab 等命名风格。',
  },
  'text-normalize': {
    label: '空白整理',
    description: '统一换行、缩减空白并清理空行。',
  },
};

const IMAGE_TOOL: ToolCatalogItem = {
  id: 'image-transform',
  label: '图片处理',
  description: '转换格式、压缩、裁剪、缩放、旋转、翻转、加水印与圆角。',
  category: 'image',
  keywords: ['图片', '格式', '压缩', '裁剪', '尺寸', '旋转', '翻转', '圆角', '水印'],
  kind: 'image',
  supportsReverse: false,
  forwardLabel: '处理图片',
};

const TOOL_CATALOG: ToolCatalogItem[] = [
  IMAGE_TOOL,
  ...FORMAT_CONVERTER_LIST.map((tool) => ({
    id: tool.id,
    label: tool.name,
    description: tool.description,
    category: tool.category,
    keywords: tool.keywords,
    kind: 'format' as const,
    supportsReverse: tool.supportsReverse,
    forwardLabel: tool.forwardActionLabel,
    reverseLabel: tool.reverseActionLabel,
    inputPlaceholder: tool.inputPlaceholder,
  })),
  ...STRUCTURED_FORMAT_TOOL_LIST.map((tool) => ({
    id: tool.id,
    label: STRUCTURED_TOOL_COPY[tool.id]?.label ?? tool.name,
    description: STRUCTURED_TOOL_COPY[tool.id]?.description ?? tool.description,
    category: tool.category,
    keywords: tool.keywords,
    kind: 'format' as const,
    supportsReverse: false,
    forwardLabel: '执行处理',
  })),
];

const CATEGORY_OPTIONS: Array<{
  id: CategoryFilter;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'all', label: '全部', icon: WandSparkles },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'data', label: '数据', icon: Braces },
  { id: 'encoding', label: '编码', icon: ArrowLeftRight },
  { id: 'text', label: '文本', icon: WrapText },
  { id: 'crypto', label: '摘要', icon: Hash },
];

const CATEGORY_IDS = new Set<CategoryFilter>(CATEGORY_OPTIONS.map((item) => item.id));

function readPositiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readNonNegativeNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function FormatTools() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') as CategoryFilter | null;
  const category = categoryParam && CATEGORY_IDS.has(categoryParam) ? categoryParam : 'all';
  const keyword = searchParams.get('q') ?? '';
  const selectedTool =
    TOOL_CATALOG.find((item) => item.id === searchParams.get('tool')) ?? TOOL_CATALOG[0];

  const filteredTools = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return TOOL_CATALOG.filter((tool) => {
      if (category !== 'all' && tool.category !== category) return false;
      if (!normalizedKeyword) return true;
      return [tool.label, tool.description, ...tool.keywords]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedKeyword);
    });
  }, [category, keyword]);

  const updateQuery = (
    update: (next: URLSearchParams) => void,
    options: { replace?: boolean } = {},
  ) => {
    const next = new URLSearchParams(searchParams);
    update(next);
    setSearchParams(next, options);
  };

  const selectCategory = (nextCategory: CategoryFilter) => {
    updateQuery((next) => {
      if (nextCategory === 'all') next.delete('category');
      else next.set('category', nextCategory);

      if (nextCategory !== 'all' && selectedTool.category !== nextCategory) {
        const firstTool = TOOL_CATALOG.find((tool) => tool.category === nextCategory);
        if (firstTool) next.set('tool', firstTool.id);
      }
    });
  };

  const selectTool = (tool: ToolCatalogItem) => {
    updateQuery((next) => {
      next.set('tool', tool.id);
      next.set('category', tool.category);
    });
  };

  return (
    <main className="min-h-[calc(100dvh-3.5rem)] bg-background">
      <header className="border-border border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-10">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <WandSparkles className="size-4" aria-hidden="true" />
              <span className="font-medium text-xs">浏览器工具箱</span>
            </div>
            <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">实用工具</h1>
            <p className="text-muted-foreground text-sm leading-6 sm:text-base">
              转换图片、整理文本、检查数据。文件默认在浏览器内处理。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{TOOL_CATALOG.length} 项工具</Badge>
            <Badge variant="secondary">本地处理</Badge>
          </div>
        </div>
      </header>

      <section className="border-border border-b bg-background">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={keyword}
                onChange={(event) =>
                  updateQuery(
                    (next) => {
                      const value = event.target.value;
                      if (value) next.set('q', value);
                      else next.delete('q');
                    },
                    { replace: true },
                  )
                }
                placeholder="搜索转换、裁剪、JSON…"
                aria-label="搜索工具"
                className="pl-9"
              />
            </div>
            <div
              className="flex gap-1 overflow-x-auto pb-1 lg:pb-0"
              role="group"
              aria-label="工具分类"
            >
              {CATEGORY_OPTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={category === item.id ? 'secondary' : 'ghost'}
                    aria-pressed={category === item.id}
                    onClick={() => selectCategory(item.id)}
                  >
                    <Icon aria-hidden="true" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {filteredTools.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="可用工具">
              {filteredTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => selectTool(tool)}
                  aria-pressed={selectedTool.id === tool.id}
                  className={cn(
                    'min-w-44 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    selectedTool.id === tool.id
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm">{tool.label}</span>
                    {selectedTool.id === tool.id ? (
                      <Check className="size-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-xs">
                    {CATEGORY_OPTIONS.find((item) => item.id === tool.category)?.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-6 text-center text-muted-foreground text-sm">
              没有匹配的工具，请调整关键词或分类。
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {selectedTool.kind === 'image' ? (
          <ImageWorkspace tool={selectedTool} />
        ) : (
          <FormatWorkspace key={selectedTool.id} tool={selectedTool} />
        )}
      </div>
    </main>
  );
}

function WorkspaceHeader({ tool }: { tool: ToolCatalogItem }) {
  return (
    <div className="flex flex-col gap-3 border-border border-b px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-xl tracking-tight">{tool.label}</h2>
          <Badge variant="outline">
            {CATEGORY_OPTIONS.find((item) => item.id === tool.category)?.label}
          </Badge>
        </div>
        <p className="max-w-2xl text-muted-foreground text-sm leading-6">{tool.description}</p>
      </div>
    </div>
  );
}

function FormatWorkspace({ tool }: { tool: ToolCatalogItem }) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [direction, setDirection] = useState<ConverterDirection>('forward');
  const [pointer, setPointer] = useState('');
  const [textCase, setTextCase] = useState<TextCase>('camel');
  const [normalizeOptions, setNormalizeOptions] = useState({
    trimLines: true,
    trimDocument: true,
    collapseBlankLines: true,
    collapseInlineWhitespace: false,
    removeEmptyLines: false,
  });

  const runTool = async () => {
    if (!input) {
      setError('请先输入要处理的内容。');
      return;
    }

    setIsRunning(true);
    setError('');
    const options =
      tool.id === 'json-pointer'
        ? { pointer }
        : tool.id === 'text-case'
          ? { case: textCase }
          : tool.id === 'text-normalize'
            ? normalizeOptions
            : undefined;
    const result = await runFormatTool({
      toolId: tool.id,
      input,
      direction,
      options,
    });
    setIsRunning(false);

    if (!result.ok) {
      setOutput('');
      setError(result.error ?? '处理失败，请检查输入内容。');
      return;
    }
    setOutput(result.output);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError('');
  };

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <WorkspaceHeader tool={tool} />
      <div className="space-y-5 p-4 sm:p-6">
        <FormatOptions
          tool={tool}
          direction={direction}
          setDirection={setDirection}
          pointer={pointer}
          setPointer={setPointer}
          textCase={textCase}
          setTextCase={setTextCase}
          normalizeOptions={normalizeOptions}
          setNormalizeOptions={setNormalizeOptions}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="format-tool-input">输入</Label>
              <span className="text-muted-foreground text-xs">{input.length} 字符</span>
            </div>
            <Textarea
              id="format-tool-input"
              aria-label="输入内容"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={tool.inputPlaceholder ?? '输入要处理的内容'}
              className="min-h-80 resize-y font-mono text-sm leading-6"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="format-tool-output">结果</Label>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={copyOutput}
                disabled={!output}
              >
                <Clipboard aria-hidden="true" />
                复制
              </Button>
            </div>
            <Textarea
              id="format-tool-output"
              aria-label="处理结果"
              value={output}
              readOnly
              placeholder="处理结果会显示在这里"
              className="min-h-80 resize-y bg-muted/30 font-mono text-sm leading-6"
              spellCheck={false}
            />
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm"
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-border border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={clearAll}>
            <Trash2 aria-hidden="true" />
            清空
          </Button>
          <Button type="button" onClick={runTool} disabled={isRunning}>
            {isRunning ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            执行处理 · {direction === 'reverse' ? tool.reverseLabel : tool.forwardLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}

interface FormatOptionsProps {
  tool: ToolCatalogItem;
  direction: ConverterDirection;
  setDirection: (direction: ConverterDirection) => void;
  pointer: string;
  setPointer: (pointer: string) => void;
  textCase: TextCase;
  setTextCase: (textCase: TextCase) => void;
  normalizeOptions: NormalizeOptionsState;
  setNormalizeOptions: (options: NormalizeOptionsState) => void;
}

interface NormalizeOptionsState {
  trimLines: boolean;
  trimDocument: boolean;
  collapseBlankLines: boolean;
  collapseInlineWhitespace: boolean;
  removeEmptyLines: boolean;
}

function FormatOptions({
  tool,
  direction,
  setDirection,
  pointer,
  setPointer,
  textCase,
  setTextCase,
  normalizeOptions,
  setNormalizeOptions,
}: FormatOptionsProps) {
  if (tool.supportsReverse) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
        <span className="px-2 font-medium text-muted-foreground text-xs">转换方向</span>
        <Button
          type="button"
          size="sm"
          variant={direction === 'forward' ? 'secondary' : 'ghost'}
          onClick={() => setDirection('forward')}
        >
          {tool.forwardLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={direction === 'reverse' ? 'secondary' : 'ghost'}
          onClick={() => setDirection('reverse')}
        >
          {tool.reverseLabel}
        </Button>
      </div>
    );
  }

  if (tool.id === 'json-pointer') {
    return (
      <div className="max-w-lg space-y-2">
        <Label htmlFor="json-pointer">JSON Pointer</Label>
        <Input
          id="json-pointer"
          value={pointer}
          onChange={(event) => setPointer(event.target.value)}
          placeholder="例如 /user/name"
        />
      </div>
    );
  }

  if (tool.id === 'text-case') {
    return (
      <div className="max-w-xs space-y-2">
        <Label htmlFor="text-case">目标格式</Label>
        <NativeSelect
          id="text-case"
          value={textCase}
          onChange={(event) => setTextCase(event.target.value as TextCase)}
          className="w-full"
        >
          <NativeSelectOption value="upper">UPPER CASE</NativeSelectOption>
          <NativeSelectOption value="lower">lower case</NativeSelectOption>
          <NativeSelectOption value="title">Title Case</NativeSelectOption>
          <NativeSelectOption value="sentence">Sentence case</NativeSelectOption>
          <NativeSelectOption value="camel">camelCase</NativeSelectOption>
          <NativeSelectOption value="pascal">PascalCase</NativeSelectOption>
          <NativeSelectOption value="snake">snake_case</NativeSelectOption>
          <NativeSelectOption value="kebab">kebab-case</NativeSelectOption>
          <NativeSelectOption value="constant">CONSTANT_CASE</NativeSelectOption>
        </NativeSelect>
      </div>
    );
  }

  if (tool.id === 'text-normalize') {
    const options = [
      ['trimLines', '清理每行首尾空格'],
      ['trimDocument', '清理全文首尾空白'],
      ['collapseBlankLines', '合并连续空行'],
      ['collapseInlineWhitespace', '合并行内空白'],
      ['removeEmptyLines', '移除所有空行'],
    ] as const;
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-3 rounded-lg border border-border bg-muted/30 p-4">
        {options.map(([key, label]) => (
          <Label key={key} className="flex cursor-pointer items-center gap-2 font-normal">
            <Checkbox
              checked={normalizeOptions[key]}
              onCheckedChange={(checked) =>
                setNormalizeOptions({ ...normalizeOptions, [key]: checked === true })
              }
            />
            {label}
          </Label>
        ))}
      </div>
    );
  }

  return null;
}

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

function ImageWorkspace({ tool }: { tool: ToolCatalogItem }) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState('');
  const [form, setForm] = useState<ImageFormState>(INITIAL_IMAGE_FORM);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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

  const updateForm = <Key extends keyof ImageFormState>(key: Key, value: ImageFormState[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const chooseFile = (nextFile: File | null) => {
    setError('');
    setOutputFile(null);
    setOutputUrl('');
    if (!nextFile) {
      setFile(null);
      setSourceUrl('');
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
    setSourceUrl(URL.createObjectURL(nextFile));
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
    const result = await runBrowserImageTool({ file, options: buildOptions() });
    setIsProcessing(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOutputFile(result.file);
    setOutputUrl(URL.createObjectURL(result.file));
  };

  const resetImage = () => {
    setFile(null);
    setSourceUrl('');
    setOutputFile(null);
    setOutputUrl('');
    setForm(INITIAL_IMAGE_FORM);
    setError('');
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <WorkspaceHeader tool={tool} />
      <div className="grid lg:grid-cols-[minmax(0,0.86fr)_minmax(22rem,1.14fr)]">
        <div className="space-y-5 border-border p-4 sm:p-6 lg:border-r">
          <div className="space-y-2">
            <Label htmlFor="image-upload">原始图片</Label>
            <label
              htmlFor="image-upload"
              className={cn(
                'flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/20 text-center transition-colors hover:bg-muted/40',
                sourceUrl && 'border-solid bg-muted/10',
              )}
            >
              {sourceUrl ? (
                <img
                  src={sourceUrl}
                  alt="待处理图片预览"
                  className="max-h-80 w-full object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-3 px-6 py-10">
                  <span className="grid size-11 place-items-center rounded-full border border-border bg-background">
                    <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-medium text-sm">选择一张图片</span>
                    <span className="mt-1 block text-muted-foreground text-xs">
                      支持 JPEG、PNG、WebP 等静态图片
                    </span>
                  </span>
                </span>
              )}
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {file ? (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>处理结果</Label>
              {outputFile ? (
                <span className="text-muted-foreground text-xs">
                  {formatBytes(outputFile.size)} · {outputFile.type}
                </span>
              ) : null}
            </div>
            <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/20">
              {outputUrl ? (
                <img
                  src={outputUrl}
                  alt="处理结果预览"
                  className="max-h-80 w-full object-contain"
                />
              ) : (
                <span className="flex flex-col items-center gap-2 text-muted-foreground text-sm">
                  <FileImage className="size-7" aria-hidden="true" />
                  处理后可在这里预览
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <ImageControlSection icon={ImageIcon} title="尺寸与格式">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField
                label="宽度"
                ariaLabel="输出宽度"
                value={form.width}
                onChange={(value) => updateForm('width', value)}
                placeholder="自动"
              />
              <NumberField
                label="高度"
                ariaLabel="输出高度"
                value={form.height}
                onChange={(value) => updateForm('height', value)}
                placeholder="自动"
              />
              <NumberField
                label="最长边"
                ariaLabel="最长边尺寸"
                value={form.maxDimension}
                onChange={(value) => updateForm('maxDimension', value)}
                placeholder="不限"
              />
              <SelectField
                label="缩放方式"
                value={form.fit}
                onChange={(value) => updateForm('fit', value as ImageResizeFit)}
                options={[
                  ['contain', '完整适应'],
                  ['cover', '填满裁切'],
                  ['fill', '拉伸填满'],
                ]}
              />
              <SelectField
                label="输出格式"
                value={form.mimeType}
                onChange={(value) => updateForm('mimeType', value as BrowserImageMimeType)}
                options={[
                  ['image/webp', 'WebP'],
                  ['image/jpeg', 'JPEG'],
                  ['image/png', 'PNG'],
                ]}
              />
              <NumberField
                label="圆角"
                ariaLabel="圆角半径"
                value={form.cornerRadius}
                onChange={(value) => updateForm('cornerRadius', value)}
                placeholder="0 px"
                min="0"
              />
            </div>
            <RangeField
              label="输出质量"
              value={form.quality}
              onChange={(value) => updateForm('quality', value)}
            />
          </ImageControlSection>

          <Separator />

          <ImageControlSection icon={Crop} title="裁剪">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberField
                label="起点 X"
                ariaLabel="裁剪起点 X"
                value={form.cropX}
                onChange={(value) => updateForm('cropX', value)}
                min="0"
              />
              <NumberField
                label="起点 Y"
                ariaLabel="裁剪起点 Y"
                value={form.cropY}
                onChange={(value) => updateForm('cropY', value)}
                min="0"
              />
              <NumberField
                label="裁剪宽度"
                ariaLabel="裁剪宽度"
                value={form.cropWidth}
                onChange={(value) => updateForm('cropWidth', value)}
                placeholder="原宽"
              />
              <NumberField
                label="裁剪高度"
                ariaLabel="裁剪高度"
                value={form.cropHeight}
                onChange={(value) => updateForm('cropHeight', value)}
                placeholder="原高"
              />
            </div>
          </ImageControlSection>

          <Separator />

          <ImageControlSection icon={RotateCw} title="旋转与翻转">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => updateForm('rotateDegrees', form.rotateDegrees - 90)}
              >
                <RotateCcw aria-hidden="true" />
                左转 90°
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => updateForm('rotateDegrees', form.rotateDegrees + 90)}
              >
                <RotateCw aria-hidden="true" />
                右转 90°
              </Button>
              <Button
                type="button"
                variant={form.flipHorizontal ? 'secondary' : 'outline'}
                onClick={() => updateForm('flipHorizontal', !form.flipHorizontal)}
              >
                <FlipHorizontal2 aria-hidden="true" />
                水平翻转
              </Button>
              <Button
                type="button"
                variant={form.flipVertical ? 'secondary' : 'outline'}
                onClick={() => updateForm('flipVertical', !form.flipVertical)}
              >
                <FlipVertical2 aria-hidden="true" />
                垂直翻转
              </Button>
              <Badge variant="outline">旋转 {form.rotateDegrees}°</Badge>
            </div>
          </ImageControlSection>

          <Separator />

          <ImageControlSection icon={Braces} title="水印">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <div className="space-y-2">
                <Label htmlFor="watermark-text">水印文字</Label>
                <Input
                  id="watermark-text"
                  aria-label="水印文字"
                  value={form.watermarkText}
                  onChange={(event) => updateForm('watermarkText', event.target.value)}
                  placeholder="可选"
                />
              </div>
              <SelectField
                label="位置"
                value={form.watermarkPosition}
                onChange={(value) =>
                  updateForm('watermarkPosition', value as ImageWatermarkPosition)
                }
                options={[
                  ['top-left', '左上'],
                  ['top-center', '上方居中'],
                  ['top-right', '右上'],
                  ['center', '正中'],
                  ['bottom-left', '左下'],
                  ['bottom-center', '下方居中'],
                  ['bottom-right', '右下'],
                ]}
              />
            </div>
            <RangeField
              label="水印透明度"
              value={form.watermarkOpacity}
              onChange={(value) => updateForm('watermarkOpacity', value)}
            />
          </ImageControlSection>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive text-sm"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-border border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={resetImage}>
              <Trash2 aria-hidden="true" />
              重置
            </Button>
            <div className="flex gap-2">
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
        </div>
      </div>
    </section>
  );
}

function ImageControlSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      {children}
    </section>
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
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-muted-foreground text-xs">{value}%</span>
      </div>
      <Slider
        value={[value]}
        min={1}
        max={100}
        step={1}
        onValueChange={(nextValue) =>
          onChange(typeof nextValue === 'number' ? nextValue : (nextValue[0] ?? value))
        }
      />
    </div>
  );
}

export default FormatTools;
