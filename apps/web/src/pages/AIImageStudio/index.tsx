import {
  Check,
  Download,
  ImageIcon,
  LibraryBig,
  RefreshCw,
  Save,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { AvailableAIModel } from '@/api/ai';
import {
  type AIImageGeneration,
  type AIImagePreset,
  createAIImageGeneration,
  getAIImageGeneration,
  listAIImageGenerations,
  listAIImagePresets,
  saveAIImageGenerationResource,
} from '@/api/aiImages';
import { getAPIErrorMessage } from '@/api/aiWorkbench';
import { ModelPicker } from '@/components/ai/ModelPicker';
import { GenerationOverlay } from '@/components/ai-images/GenerationOverlay';
import { SketchCanvas, type SketchCanvasHandle } from '@/components/ai-images/SketchCanvas';
import { PromptAssistantDialog } from '@/components/ai-workbench/PromptAssistantDialog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const DEFAULT_ASPECTS = ['1:1', '4:3', '3:4', '16:9', '9:16'];
const DEFAULT_QUALITIES = ['1K', '2K'];

const STATUS_LABELS: Record<AIImageGeneration['status'], string> = {
  queued: '等待生成',
  running: '生成中',
  succeeded: '已完成',
  failed: '生成失败',
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

export default function AIImageStudio() {
  const sketchCanvasRef = useRef<SketchCanvasHandle | null>(null);
  const creatingRef = useRef(false);
  const [presets, setPresets] = useState<AIImagePreset[]>([]);
  const [aspectRatios, setAspectRatios] = useState(DEFAULT_ASPECTS);
  const [qualities, setQualities] = useState(DEFAULT_QUALITIES);
  const [presetID, setPresetID] = useState('free');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [quality, setQuality] = useState('1K');
  const [modelID, setModelID] = useState('');
  const [selectedModel, setSelectedModel] = useState<AvailableAIModel>();
  const [hasCanvasContent, setHasCanvasContent] = useState(false);
  const [useCanvasReference, setUseCanvasReference] = useState(true);
  const [history, setHistory] = useState<AIImageGeneration[]>([]);
  const [activeGeneration, setActiveGeneration] = useState<AIImageGeneration | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingID, setSavingID] = useState<string>();
  const [promptAssistantOpen, setPromptAssistantOpen] = useState(false);

  const applyHistory = useCallback((generations: AIImageGeneration[]) => {
    setHistory(generations);
    setActiveGeneration(
      (current) =>
        current ??
        generations.find((item) => item.status === 'queued' || item.status === 'running') ??
        null,
    );
  }, []);

  const loadHistory = useCallback(async () => {
    const result = await listAIImageGenerations();
    applyHistory(result.list);
  }, [applyHistory]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([listAIImagePresets(), listAIImageGenerations()])
      .then(([catalog, generations]) => {
        if (!active) return;
        setPresets(catalog.presets);
        setAspectRatios(catalog.aspectRatios);
        setQualities(catalog.qualities);
        applyHistory(generations.list);
      })
      .catch((error) => {
        if (active) toast.error(getAPIErrorMessage(error, '加载图片创作数据失败'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyHistory]);

  useEffect(() => {
    if (
      !activeGeneration ||
      (activeGeneration.status !== 'queued' && activeGeneration.status !== 'running')
    ) {
      return;
    }
    let cancelled = false;
    let timeoutID: number | undefined;
    const poll = async () => {
      try {
        const result = await getAIImageGeneration(activeGeneration.id);
        if (cancelled) return;
        setActiveGeneration(result.generation);
        setHistory((current) => [
          result.generation,
          ...current.filter((item) => item.id !== result.generation.id),
        ]);
        if (result.generation.status === 'succeeded') {
          toast.success('图片生成完成');
          setActiveGeneration(null);
          return;
        }
        if (result.generation.status === 'failed') {
          toast.error(result.generation.errorMessage || '图片生成失败');
          setActiveGeneration(null);
          return;
        }
        timeoutID = window.setTimeout(poll, 1500);
      } catch (error) {
        if (!cancelled) {
          toast.error(getAPIErrorMessage(error, '读取生成进度失败'));
          timeoutID = window.setTimeout(poll, 3000);
        }
      }
    };
    timeoutID = window.setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      if (timeoutID) window.clearTimeout(timeoutID);
    };
  }, [activeGeneration]);

  const selectPreset = (preset: AIImagePreset) => {
    setPresetID(preset.id);
    if (aspectRatios.includes(preset.recommendedAspect)) {
      setAspectRatio(preset.recommendedAspect);
    }
  };

  const handleGenerate = async () => {
    if (creatingRef.current) return;
    if (!prompt.trim()) {
      toast.error('请输入画面描述');
      return;
    }
    if (!modelID) {
      toast.error('请选择图片模型');
      return;
    }
    const supportsReference = selectedModel?.capabilities.includes('reference_image') ?? false;
    let reference: string | null = null;
    if (hasCanvasContent && useCanvasReference && supportsReference) {
      reference = sketchCanvasRef.current?.exportDataURL() ?? null;
      if (!reference) {
        toast.error('画布还没有准备好，请稍后重试');
        return;
      }
    }
    creatingRef.current = true;
    setCreating(true);
    try {
      const result = await createAIImageGeneration({
        modelId: modelID,
        presetId: presetID,
        prompt: prompt.trim(),
        aspectRatio,
        quality,
        references: reference ? [reference] : [],
      });
      setActiveGeneration(result.generation);
      setHistory((current) => [
        result.generation,
        ...current.filter((item) => item.id !== result.generation.id),
      ]);
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '创建图片生成任务失败'));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const saveToResources = async (generation: AIImageGeneration) => {
    setSavingID(generation.id);
    try {
      const type = generation.aspectRatio === '1:1' ? 'avatar' : 'wallpaper';
      const result = await saveAIImageGenerationResource(generation.id, { type });
      setHistory((current) =>
        current.map((item) =>
          item.id === generation.id ? { ...item, resourceId: result.resource.id } : item,
        ),
      );
      toast.success('已保存到私有资源库');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存到资源库失败'));
    } finally {
      setSavingID(undefined);
    }
  };

  const reuseGeneration = (generation: AIImageGeneration) => {
    setPresetID(generation.presetId);
    setPrompt(generation.prompt);
    setAspectRatio(generation.aspectRatio);
    setQuality(generation.quality);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isGenerating =
    activeGeneration?.status === 'queued' || activeGeneration?.status === 'running';
  const isBusy = creating || isGenerating;
  const supportsReference = selectedModel?.capabilities.includes('reference_image') ?? false;
  const usesCanvasReference = hasCanvasContent && useCanvasReference && supportsReference;
  const selectedPreset = presets.find((preset) => preset.id === presetID);
  const missingRequiredReference = Boolean(
    selectedPreset?.requiresReference && !usesCanvasReference,
  );

  return (
    <main className="min-h-full bg-muted/20">
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 md:px-8">
        <header className="mb-5 rounded-xl border border-border bg-card px-5 py-4 shadow-xs">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ImageIcon className="size-5" />
                </span>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI 图片</h1>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                用草图、素材和提示词生成可继续调整的图片。
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void loadHistory().catch((error) =>
                  toast.error(getAPIErrorMessage(error, '刷新创作历史失败')),
                )
              }
              disabled={loading}
            >
              <RefreshCw />
              刷新历史
            </Button>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="min-w-0 self-start shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle>创作画布</CardTitle>
              <CardDescription>绘制轮廓或摆放最多三张参考素材。</CardDescription>
              <CardAction>
                <Badge variant={hasCanvasContent ? 'secondary' : 'outline'}>
                  {hasCanvasContent ? '画布已就绪' : '空白画布'}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="relative pt-5">
              <SketchCanvas
                ref={sketchCanvasRef}
                aspectRatio={aspectRatio}
                disabled={isBusy}
                onContentChange={setHasCanvasContent}
              />
              {isGenerating && activeGeneration ? (
                <GenerationOverlay stage={activeGeneration.stage} />
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-fit shadow-sm xl:sticky xl:top-5">
            <CardHeader className="border-b border-border">
              <CardTitle>生成设置</CardTitle>
              <CardDescription>选择模板、尺寸和图片模型。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <section className="space-y-2">
                <Label>提示词模板</Label>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      aria-pressed={presetID === preset.id}
                      className={cn(
                        'h-auto min-h-16 flex-col items-start gap-1 whitespace-normal px-3 py-2 text-left transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm',
                        presetID === preset.id &&
                          'border-primary/40 bg-secondary shadow-sm hover:bg-secondary/80',
                      )}
                      onClick={() => selectPreset(preset)}
                      disabled={isBusy}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span>{preset.name}</span>
                        {presetID === preset.id ? (
                          <Check className="size-3.5 text-primary" />
                        ) : null}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {preset.description}
                      </span>
                    </Button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="ai-image-prompt">画面描述</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy || !prompt.trim()}
                    onClick={() => setPromptAssistantOpen(true)}
                  >
                    <Sparkles />
                    AI 生成
                  </Button>
                </div>
                <Textarea
                  id="ai-image-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="例如：雨后的山谷里，一间亮着暖光的木屋，远处有薄雾和松林"
                  className="min-h-28 resize-y"
                  maxLength={2000}
                  disabled={isBusy}
                />
                <div className="text-right text-xs text-muted-foreground">{prompt.length}/2000</div>
              </section>

              <section className="space-y-2">
                <Label>画面比例</Label>
                <div className="grid grid-cols-3 gap-2">
                  {aspectRatios.map((ratio) => (
                    <Button
                      key={ratio}
                      type="button"
                      size="sm"
                      variant={aspectRatio === ratio ? 'secondary' : 'outline'}
                      onClick={() => setAspectRatio(ratio)}
                      disabled={isBusy}
                    >
                      {ratio}
                    </Button>
                  ))}
                </div>
              </section>

              <section className="space-y-2">
                <Label>清晰度</Label>
                <div className="grid grid-cols-2 gap-2">
                  {qualities.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      size="sm"
                      variant={quality === item ? 'secondary' : 'outline'}
                      onClick={() => setQuality(item)}
                      disabled={isBusy}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </section>

              <ModelPicker
                value={modelID}
                onValueChange={setModelID}
                onModelChange={setSelectedModel}
                capability="image_generation"
                label="图片模型"
                autoSelectFirst
              />

              {hasCanvasContent && supportsReference ? (
                <div
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5',
                    useCanvasReference && 'border-primary/30 bg-primary/5',
                  )}
                >
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={useCanvasReference}
                      onCheckedChange={(checked) => setUseCanvasReference(checked === true)}
                      disabled={isBusy}
                    />
                    使用当前画布作为构图参考
                  </label>
                  {useCanvasReference ? <Badge variant="secondary">参考图已启用</Badge> : null}
                </div>
              ) : hasCanvasContent ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm leading-5 text-destructive">
                  当前模型不支持参考图，将仅按文字生成。
                </p>
              ) : (
                <Badge variant="secondary">当前为文字生成图片</Badge>
              )}

              {missingRequiredReference ? (
                <p className="text-sm leading-5 text-destructive">
                  草图成图需要选择支持参考图的模型，并启用当前画布。
                </p>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full shadow-sm"
                onClick={() => void handleGenerate()}
                disabled={isBusy || !prompt.trim() || !modelID || missingRequiredReference}
              >
                {isBusy ? (
                  <Sparkles className="animate-pulse motion-reduce:animate-none" />
                ) : (
                  <WandSparkles />
                )}
                {creating ? '正在创建任务' : isGenerating ? '正在生成' : '生成图片'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <section className="relative mt-8 min-h-48">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">创作历史</h2>
              <p className="mt-1 text-sm text-muted-foreground">最近生成的图片与任务状态。</p>
            </div>
            <Badge variant="outline">{history.length} 条</Badge>
          </div>

          <BoxLoadingOverlay show={loading} title="正在加载创作历史" compact minimal />

          {!loading && history.length === 0 ? (
            <Card>
              <CardContent className="flex min-h-40 flex-col items-center justify-center text-center">
                <LibraryBig className="size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">还没有生成记录</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  完成第一张图片后，结果会出现在这里。
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {history.map((generation) => (
                <Card
                  key={generation.id}
                  size="sm"
                  className="transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-border bg-muted/30">
                    {generation.resultUrl ? (
                      <img
                        src={generation.resultUrl}
                        alt={generation.prompt}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : generation.status === 'failed' ? (
                      <div className="px-5 text-center">
                        <p className="text-sm font-medium text-destructive">生成失败</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {generation.errorMessage || '请调整设置后重新生成'}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Sparkles className="mx-auto size-6 animate-pulse text-primary motion-reduce:animate-none" />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {STATUS_LABELS[generation.status]}
                        </p>
                      </div>
                    )}
                    <Badge
                      variant={generation.status === 'failed' ? 'destructive' : 'secondary'}
                      className="absolute top-2 left-2"
                    >
                      {STATUS_LABELS[generation.status]}
                    </Badge>
                  </div>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 min-h-10 text-sm leading-5">{generation.prompt}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{generation.aspectRatio}</Badge>
                      <Badge variant="outline">{generation.quality}</Badge>
                      <Badge variant="outline">{generation.provider}</Badge>
                      {generation.referenceCount > 0 ? (
                        <Badge variant="secondary">参考画布</Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(generation.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {generation.status === 'succeeded' && generation.resultUrl ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(generation.resultUrl, '_blank', 'noopener,noreferrer')
                            }
                          >
                            <Download />
                            下载
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void saveToResources(generation)}
                            disabled={Boolean(generation.resourceId) || savingID === generation.id}
                          >
                            <Save />
                            {generation.resourceId ? '已保存' : '保存'}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => reuseGeneration(generation)}
                        disabled={isBusy}
                        className={cn(generation.status !== 'succeeded' && 'ml-0')}
                      >
                        <RefreshCw />
                        再次创作
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
      <PromptAssistantDialog
        open={promptAssistantOpen}
        onOpenChange={setPromptAssistantOpen}
        target="image_studio"
        field="image_prompt"
        currentPrompt={prompt}
        onReplace={(suggestion) => setPrompt(suggestion.optimizedPrompt)}
      />
    </main>
  );
}
