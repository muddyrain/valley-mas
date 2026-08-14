import { ArrowRight, ChevronDown, ImageIcon, Loader2, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type AvailableAIModel, listAvailableAIModels } from '@/api/ai';
import {
  type AIImageCreationOptions,
  type AIImageGeneration,
  createAIImageGeneration,
  getAIImageGeneration,
  listAIImageCreationOptions,
  listAIImageGenerations,
  saveAIImageGenerationResource,
} from '@/api/aiImages';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ImagePurpose = 'cover' | 'gallery' | 'free';

const purposes: Array<{ value: ImagePurpose; label: string; description: string }> = [
  { value: 'cover', label: '文章封面', description: '生成后带到文章画布' },
  { value: 'gallery', label: '加入图库', description: '确认后保存为私有图片' },
  { value: 'free', label: '自由创作', description: '先生成，再决定用途' },
];

const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

export default function StudioImageCreator() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [options, setOptions] = useState<AIImageCreationOptions | null>(null);
  const [models, setModels] = useState<AvailableAIModel[]>([]);
  const [history, setHistory] = useState<AIImageGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [purpose, setPurpose] = useState<ImagePurpose>('cover');
  const [brief, setBrief] = useState('');
  const [modelId, setModelId] = useState('');
  const [styleProfileId, setStyleProfileId] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [quality, setQuality] = useState('1K');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AIImageGeneration | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    void Promise.all([
      listAIImageCreationOptions(),
      listAvailableAIModels('image_generation'),
      listAIImageGenerations(8, 'studio'),
    ])
      .then(([creationOptions, modelResult, historyResult]) => {
        if (!mountedRef.current) return;
        setOptions(creationOptions);
        setModels(modelResult.list || []);
        setModelId(modelResult.list?.[0]?.id || '');
        setHistory(historyResult.list || []);
        setStyleProfileId(creationOptions.styleProfiles?.[0]?.id || '');
        setQuality(creationOptions.qualities?.[0] || '1K');
      })
      .catch(() => toast.error('加载图片创作选项失败'))
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const selectedModel = models.find((model) => model.id === modelId);
  const recipeId = purpose === 'cover' ? 'cover' : 'free';
  const recipe = options?.recipes.find((item) => item.id === recipeId);
  const canGenerate = Boolean(brief.trim() && modelId && !generating);

  const handlePurposeChange = (nextPurpose: ImagePurpose) => {
    setPurpose(nextPurpose);
    const nextRecipeId = nextPurpose === 'cover' ? 'cover' : 'free';
    const nextRecipe = options?.recipes.find((item) => item.id === nextRecipeId);
    setAspectRatio(nextRecipe?.recommendedAspect || (nextPurpose === 'cover' ? '16:9' : '1:1'));
  };

  const monitorGeneration = async (generation: AIImageGeneration) => {
    if (generation.status === 'succeeded' || generation.status === 'failed') return generation;
    let current = generation;
    for (let attempt = 0; attempt < 80 && mountedRef.current; attempt += 1) {
      await wait(attempt === 0 ? 800 : 1500);
      current = (await getAIImageGeneration(generation.id)).generation;
      if (
        current.status === 'succeeded' ||
        current.status === 'failed' ||
        current.status === 'paused'
      ) {
        return current;
      }
    }
    return current;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setResult(null);
    try {
      const created = await createAIImageGeneration({
        modelId,
        recipeId,
        styleProfileId: styleProfileId || undefined,
        variationMode: 'balanced',
        brief: brief.trim(),
        aspectRatio,
        quality,
        references: [],
      });
      const completed = await monitorGeneration(created.generation);
      if (!mountedRef.current) return;
      setHistory((current) => [completed, ...current.filter((item) => item.id !== completed.id)]);
      if (completed.status === 'succeeded' && completed.resultUrl) {
        setResult(completed);
        toast.success('图片生成完成');
      } else if (completed.status === 'failed') {
        toast.error(completed.errorMessage || '图片生成失败');
      } else {
        toast.info('生成仍在进行，可稍后在历史中查看');
      }
    } catch {
      toast.error('图片生成失败，请稍后重试');
    } finally {
      if (mountedRef.current) setGenerating(false);
    }
  };

  const handleUseResult = async () => {
    if (!result?.resultUrl) return;
    if (purpose === 'cover') {
      navigate('/studio/articles/new', {
        state: { generatedCover: result.resultUrl, generatedCoverId: result.id },
      });
      return;
    }
    try {
      setSaving(true);
      const saved = await saveAIImageGenerationResource(result.id, { visibility: 'private' });
      setResult((current) => (current ? { ...current, resourceId: saved.resource.id } : current));
      toast.success('已加入私有图库');
    } catch {
      toast.error('保存图片失败');
    } finally {
      setSaving(false);
    }
  };

  const historyItems = useMemo(
    () => history.filter((item) => item.status === 'succeeded' && item.resultUrl).slice(0, 6),
    [history],
  );

  return (
    <div className="relative mx-auto min-h-full max-w-7xl px-4 py-8 sm:px-6 md:px-8 md:py-10">
      <BoxLoadingOverlay show={loading} title="正在准备图片创作" />
      <header className="max-w-3xl">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">IMAGE BRIEF</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">
          先说用途，再描述画面。
        </h1>
      </header>

      {!loading ? (
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)]">
          <section className="space-y-6">
            <div
              className="grid grid-cols-3 border border-border"
              role="group"
              aria-label="图片用途"
            >
              {purposes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={purpose === item.value}
                  onClick={() => handlePurposeChange(item.value)}
                  className={cn(
                    'min-h-20 border-r border-border px-3 py-3 text-left last:border-r-0',
                    purpose === item.value ? 'bg-foreground text-background' : 'hover:bg-muted',
                  )}
                >
                  <strong className="block text-sm">{item.label}</strong>
                  <small
                    className={cn(
                      'mt-1 block text-[11px] leading-4',
                      purpose === item.value ? 'text-background/70' : 'text-muted-foreground',
                    )}
                  >
                    {item.description}
                  </small>
                </button>
              ))}
            </div>

            <label className="block space-y-2 text-sm font-medium">
              <span>画面描述</span>
              <Textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder={
                  purpose === 'cover'
                    ? '文章主题、希望出现的主体、氛围和留白…'
                    : '描述主体、场景、光线和情绪…'
                }
                className="min-h-44 resize-y text-base leading-7"
                maxLength={4000}
              />
            </label>

            {options?.styleProfiles?.length ? (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">视觉方向</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.styleProfiles.slice(0, 4).map((profile) => (
                    <label
                      key={profile.id}
                      className={cn(
                        'cursor-pointer border border-border p-3 transition-colors',
                        styleProfileId === profile.id && 'border-foreground bg-muted',
                      )}
                    >
                      <input
                        type="radio"
                        name="style-profile"
                        value={profile.id}
                        checked={styleProfileId === profile.id}
                        onChange={() => setStyleProfileId(profile.id)}
                        className="sr-only"
                      />
                      <strong className="block text-sm">{profile.name}</strong>
                      <small className="mt-1 block leading-5 text-muted-foreground">
                        {profile.description}
                      </small>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <details className="border-y border-border py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
                高级设置 <ChevronDown className="size-4" />
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-xs text-muted-foreground">
                  <span>模型</span>
                  <select
                    value={modelId}
                    onChange={(event) => setModelId(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-xs text-muted-foreground">
                  <span>画幅</span>
                  <select
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    {(options?.aspectRatios || [recipe?.recommendedAspect || '1:1']).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="space-y-2 text-xs text-muted-foreground">
                  <span>清晰度</span>
                  <select
                    value={quality}
                    onChange={(event) => setQuality(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
                  >
                    {(options?.qualities || ['1K']).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedModel ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {selectedModel.provider} · {selectedModel.displayName}
                </p>
              ) : null}
              <button
                type="button"
                className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => navigate('/workbench/images/advanced')}
              >
                打开高级图片工作台
              </button>
            </details>

            <Button
              type="button"
              size="lg"
              className="w-full gap-2"
              disabled={!canGenerate}
              onClick={() => void handleGenerate()}
            >
              {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {generating ? '正在生成' : result ? '换一个方向' : '生成图片'}
            </Button>
          </section>

          <section
            className="min-h-[32rem] border border-border bg-muted/20 p-4 sm:p-6"
            aria-live="polite"
            aria-busy={generating}
          >
            {generating ? (
              <div className="flex h-full min-h-[28rem] flex-col items-center justify-center text-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="mt-4 text-sm font-medium">正在建立构图与光线</p>
                <small className="mt-1 text-muted-foreground">结果默认保持私有</small>
              </div>
            ) : result?.resultUrl ? (
              <div className="flex h-full flex-col">
                <img
                  src={result.resultUrl}
                  alt={brief || 'AI 生成图片'}
                  className="min-h-0 flex-1 object-contain"
                />
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {purposes.find((item) => item.value === purpose)?.label}
                    </p>
                    <strong className="mt-1 block text-sm">
                      {result.resourceId ? '已保存到私有图库' : '私有图片草稿'}
                    </strong>
                  </div>
                  <Button
                    type="button"
                    disabled={saving || Boolean(result.resourceId)}
                    onClick={() => void handleUseResult()}
                    className="gap-2"
                  >
                    {purpose === 'cover' ? <ArrowRight /> : <Save />}
                    {purpose === 'cover'
                      ? '设为文章封面'
                      : result.resourceId
                        ? '已加入图库'
                        : '加入图库'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[28rem] flex-col items-center justify-center text-center text-muted-foreground">
                <ImageIcon className="size-10" />
                <p className="mt-4 text-sm">生成结果会出现在这里</p>
                <small className="mt-1">确认后再进入文章或图库。</small>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {!loading && historyItems.length ? (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-sm font-semibold">最近生成</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {historyItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setResult(item)}
                className="group overflow-hidden border border-border bg-card text-left"
              >
                <img
                  src={item.resultUrl}
                  alt={item.prompt || '生成图片'}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02] motion-reduce:transition-none"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
