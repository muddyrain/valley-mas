import { Download, Film, ImagePlus, LockKeyhole, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  type AIMotionSticker,
  type AIMotionStickerMode,
  type AIMotionStickerModel,
  createAIMotionSticker,
  deleteAIMotionSticker,
  fetchAIMotionStickerContent,
  listAIMotionStickerOptions,
  listAIMotionStickers,
} from '@/api/aiMotionStickers';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const statusLabels: Record<AIMotionSticker['status'], string> = {
  queued: '排队中',
  running: '生成中',
  succeeded: '已完成',
  failed: '生成失败',
};

const stageLabels: Record<string, string> = {
  queued: '等待开始',
  submitting: '正在提交视频模型',
  generating: '正在生成动作',
  generating_frames: '正在生成连贯帧',
  encoding_gif: '正在制作循环 GIF',
  downloading: '正在保存 MP4',
  transcoding: '正在制作循环 GIF',
  completed: '生成完成',
  failed: '生成失败',
};

function isActive(item: AIMotionSticker) {
  return item.status === 'queued' || item.status === 'running';
}

export function getAIMotionStickerModeLabel(mode?: AIMotionStickerMode) {
  return mode === 'image' ? '生图 GIF' : '视频增强';
}

export default function AIMotionStickers() {
  const [generationMode, setGenerationMode] = useState<AIMotionStickerMode>('image');
  const [imageModels, setImageModels] = useState<AIMotionStickerModel[]>([]);
  const [videoModels, setVideoModels] = useState<AIMotionStickerModel[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<Record<AIMotionStickerMode, string>>({
    image: '',
    video: '',
  });
  const [action, setAction] = useState('');
  const [reference, setReference] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState('');
  const [items, setItems] = useState<AIMotionSticker[]>([]);
  const [gifPreviews, setGifPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const activeItem = useMemo(() => items.find(isActive), [items]);
  const models = generationMode === 'image' ? imageModels : videoModels;
  const selectedModelId = selectedModelIds[generationMode];
  const selectedModel = models.find((model) => model.id === selectedModelId);

  const loadHistory = useCallback(async () => {
    const result = await listAIMotionStickers();
    setItems(result.items);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([listAIMotionStickerOptions(), listAIMotionStickers()])
      .then(([options, history]) => {
        if (!alive) return;
        setGenerationMode(options.defaultMode || 'image');
        setImageModels(options.imageModels);
        setVideoModels(options.videoModels);
        setSelectedModelIds((current) => ({
          image: current.image || options.imageModels[0]?.id || '',
          video: current.video || options.videoModels[0]?.id || '',
        }));
        setItems(history.items);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : '加载动态表情工作台失败'),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    const timer = window.setInterval(() => void loadHistory(), 5000);
    return () => window.clearInterval(timer);
  }, [activeItem, loadHistory]);

  useEffect(() => {
    const completed = items.filter((item) => item.status === 'succeeded' && item.gifUrl);
    const missing = completed.filter((item) => !gifPreviews[item.id]);
    if (missing.length === 0) return;
    let alive = true;
    Promise.all(
      missing.map(
        async (item) =>
          [
            item.id,
            URL.createObjectURL(await fetchAIMotionStickerContent(item.id, 'gif')),
          ] as const,
      ),
    )
      .then((entries) => {
        if (!alive) {
          entries.forEach(([, url]) => {
            URL.revokeObjectURL(url);
          });
          return;
        }
        setGifPreviews((current) => ({ ...current, ...Object.fromEntries(entries) }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [items, gifPreviews]);

  useEffect(
    () => () => {
      if (referencePreview) URL.revokeObjectURL(referencePreview);
    },
    [referencePreview],
  );

  const chooseReference = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      toast.error('请选择不超过 5MB 的 JPG、PNG 或 WebP 图片');
      event.target.value = '';
      return;
    }
    if (referencePreview) URL.revokeObjectURL(referencePreview);
    setReference(file);
    setReferencePreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!reference || !selectedModelId || !action.trim()) {
      toast.error('请上传参考图、选择模型并描述角色动作');
      return;
    }
    setSubmitting(true);
    try {
      const generation = await createAIMotionSticker({
        mode: generationMode,
        modelId: selectedModelId,
        action: action.trim(),
        reference,
      });
      setItems((current) => [generation, ...current]);
      toast.success('任务已提交，可以离开页面，完成后会通知你');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交动态表情任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const download = async (item: AIMotionSticker, format: 'gif' | 'mp4') => {
    try {
      const blob = await fetchAIMotionStickerContent(item.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `motion-sticker-${item.id}.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '下载失败');
    }
  };

  const remove = async (item: AIMotionSticker) => {
    try {
      await deleteAIMotionSticker(item.id);
      const preview = gifPreviews[item.id];
      if (preview) URL.revokeObjectURL(preview);
      setGifPreviews((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      toast.success('动态表情已删除');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  return (
    <div className="min-h-full bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" /> AI 动态表情
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">让角色动起来</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              上传一张单角色参考图并描述动作。默认无缝循环，优先使用生图模型制作
              GIF，也可切换到视频增强。
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5 self-start sm:self-auto">
            <LockKeyhole className="size-3" /> 作品仅自己可见
          </Badge>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>创建动态表情</CardTitle>
              <CardDescription>建议使用线条简洁、主体完整、背景干净的单角色图片。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="motion-reference">上传参考图</Label>
                <label
                  htmlFor="motion-reference"
                  className="relative flex aspect-square max-h-72 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/35 transition-colors hover:bg-muted/60"
                >
                  {referencePreview ? (
                    <img
                      src={referencePreview}
                      alt="角色参考预览"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <ImagePlus className="mx-auto mb-2 size-8" />
                      <div className="text-sm font-medium text-foreground">选择角色图片</div>
                      <div className="mt-1 text-xs">JPG / PNG / WebP，最大 5MB</div>
                    </div>
                  )}
                </label>
                <input
                  id="motion-reference"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={chooseReference}
                />
              </div>

              <div className="space-y-2">
                <Label>生成方式</Label>
                <Select
                  value={generationMode}
                  onValueChange={(value) => setGenerationMode(value as AIMotionStickerMode)}
                  disabled={loading}
                >
                  <SelectTrigger className="w-full" aria-label="动态表情生成方式">
                    <SelectValue>
                      {generationMode === 'image' ? '生图 GIF（默认）' : '视频增强'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">生图 GIF（默认）</SelectItem>
                    <SelectItem value="video">视频增强</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{generationMode === 'image' ? '生图模型' : '视频模型'}</Label>
                <Select
                  value={selectedModelId || null}
                  onValueChange={(value) =>
                    setSelectedModelIds((current) => ({
                      ...current,
                      [generationMode]: value || '',
                    }))
                  }
                  disabled={loading || models.length === 0}
                >
                  <SelectTrigger className="w-full" aria-label="动态表情模型">
                    <SelectValue placeholder="选择模型">{selectedModel?.name}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loading && models.length === 0 ? (
                  <p className="text-xs text-destructive">
                    暂无支持参考图的{generationMode === 'image' ? '生图' : '视频'}模型。
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {generationMode === 'image'
                    ? '生成多张连贯画面并合成为 GIF，适合简洁动画表情。'
                    : '生成完整视频后转换为 GIF，动作更流畅，并保留 MP4。'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motion-action">描述角色动作</Label>
                <Textarea
                  id="motion-action"
                  value={action}
                  onChange={(event) => setAction(event.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="例如：跳一下；坐在沙发上玩手机；去冰箱拿一块西瓜"
                />
                <p className="text-xs text-muted-foreground">
                  未写背景时，会自动使用简洁背景和完成动作所需的少量道具。
                </p>
              </div>

              <Button
                className="w-full gap-2"
                onClick={() => void submit()}
                disabled={submitting || Boolean(activeItem) || models.length === 0}
              >
                {submitting ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Film className="size-4" />
                )}
                {activeItem ? '已有任务生成中' : submitting ? '正在提交' : '生成动态表情'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                通常需要 1–3 分钟。提交后可以离开页面。
              </p>
            </CardContent>
          </Card>

          <section className="relative min-h-96 space-y-4 rounded-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">我的动态表情</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  GIF 可直接预览和下载；视频增强作品会额外保留 MP4。
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void loadHistory()}
              >
                <RefreshCw className="size-4" /> 刷新
              </Button>
            </div>
            <BoxLoadingOverlay show={loading} title="正在加载动态表情" compact />
            {!loading && items.length === 0 ? (
              <Card className="border-dashed py-16 text-center">
                <CardContent className="text-muted-foreground">
                  还没有作品，从左侧上传一个角色开始。
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <Card key={item.id} size="sm">
                    <div className="relative mx-4 aspect-square overflow-hidden rounded-lg bg-muted/40">
                      {gifPreviews[item.id] ? (
                        <img
                          src={gifPreviews[item.id]}
                          alt={item.action}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
                          {isActive(item) ? (
                            <RefreshCw className="size-7 animate-spin text-primary" />
                          ) : (
                            <Film className="size-7" />
                          )}
                          <span className="text-sm">
                            {stageLabels[item.stage] || statusLabels[item.status]}
                          </span>
                        </div>
                      )}
                    </div>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="line-clamp-2 font-medium">{item.action}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline">
                            {getAIMotionStickerModeLabel(item.generationMode)}
                          </Badge>
                          <Badge
                            variant={
                              item.status === 'failed'
                                ? 'destructive'
                                : item.status === 'succeeded'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {statusLabels[item.status]}
                          </Badge>
                        </div>
                        {item.status === 'succeeded' ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="下载 GIF"
                              title="下载 GIF"
                              onClick={() => void download(item, 'gif')}
                            >
                              <Download />
                            </Button>
                            {item.mp4Url ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="下载 MP4"
                                title="下载 MP4"
                                onClick={() => void download(item, 'mp4')}
                              >
                                <Film />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="删除动态表情"
                              title="删除"
                              onClick={() => void remove(item)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        ) : item.status === 'failed' ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="删除失败任务"
                            onClick={() => void remove(item)}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </div>
                      {item.errorMessage ? (
                        <p className="text-xs text-destructive">{item.errorMessage}</p>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
