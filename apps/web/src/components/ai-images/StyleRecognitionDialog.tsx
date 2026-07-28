import { ImagePlus, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type AIImageStyleAnalysis,
  type AIImageStyleAnalysisResult,
  analyzeAIImageStyle,
} from '@/api/aiImages';
import { type AIPrompt, createAIPrompt, getAPIErrorMessage } from '@/api/aiWorkbench';
import { ModelPicker } from '@/components/ai/ModelPicker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const MAX_IMAGES = 9;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const OBSERVATION_LABELS: Record<string, string> = {
  palette: '色彩',
  lighting: '光线',
  composition: '构图',
  material: '材质',
  rendering: '渲染',
};

type SelectedImage = {
  id: string;
  file: File;
  previewURL: string;
};

type EditableStyleResult = AIImageStyleAnalysisResult;

const formatFileSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const normalizeTags = (tags: string[]) =>
  Array.from(new Set(['生图', '风格识别', ...tags.map((tag) => tag.trim()).filter(Boolean)])).slice(
    0,
    8,
  );

export function StyleRecognitionDialog({
  open,
  onOpenChange,
  onApply,
  onPromptSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (stylePrompt: string) => void;
  onPromptSaved: (prompt: AIPrompt) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<SelectedImage[]>([]);
  const analysisRequestRef = useRef(0);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [modelID, setModelID] = useState('');
  const [hint, setHint] = useState('');
  const [analysis, setAnalysis] = useState<AIImageStyleAnalysis>();
  const [draft, setDraft] = useState<EditableStyleResult>();
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    analysisRequestRef.current += 1;
    setImages((current) => {
      current.forEach((item) => {
        URL.revokeObjectURL(item.previewURL);
      });
      return [];
    });
    setModelID('');
    setHint('');
    setAnalysis(undefined);
    setDraft(undefined);
    setAnalyzing(false);
    setSaving(false);
    if (inputRef.current) inputRef.current.value = '';
  }, [open]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      imagesRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewURL);
      });
    },
    [],
  );

  const addImages = (files: File[]) => {
    const available = MAX_IMAGES - images.length;
    if (available <= 0) {
      toast.error(`最多识别 ${MAX_IMAGES} 张图片`);
      return;
    }
    const accepted: SelectedImage[] = [];
    for (const file of files) {
      if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
        toast.error(`${file.name} 不是 JPG、PNG 或 WebP 图片，已跳过`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} 超过 20MB 限制，已跳过`);
        continue;
      }
      if (accepted.length === available) continue;
      accepted.push({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        previewURL: URL.createObjectURL(file),
      });
    }
    if (files.length > available)
      toast.info(`最多识别 ${MAX_IMAGES} 张图片，已保留前 ${available} 张`);
    setImages((current) => [...current, ...accepted]);
    setAnalysis(undefined);
    setDraft(undefined);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewURL);
      return current.filter((item) => item.id !== id);
    });
    setAnalysis(undefined);
    setDraft(undefined);
  };

  const handleAnalyze = async () => {
    if (!modelID) {
      toast.error('请选择图片理解模型');
      return;
    }
    if (images.length === 0) {
      toast.error('请先上传图片');
      return;
    }
    const data = new FormData();
    data.set('modelId', modelID);
    if (hint.trim()) data.set('hint', hint.trim());
    images.forEach((image) => {
      data.append('images', image.file);
    });
    const requestID = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestID;
    setAnalyzing(true);
    try {
      const result = await analyzeAIImageStyle(data);
      if (analysisRequestRef.current !== requestID) return;
      setAnalysis(result);
      setDraft(result.result);
      toast.success('风格识别完成');
    } catch (error) {
      if (analysisRequestRef.current !== requestID) return;
      toast.error(getAPIErrorMessage(error, '图片风格识别失败'));
    } finally {
      if (analysisRequestRef.current === requestID) setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!draft?.name.trim() || !draft.description.trim() || !draft.stylePrompt.trim()) {
      toast.error('请补全名称、说明和风格提示词');
      return;
    }
    setSaving(true);
    try {
      const prompt = await createAIPrompt({
        name: draft.name.trim(),
        description: draft.description.trim(),
        content: draft.stylePrompt.trim(),
        tags: normalizeTags(draft.tags),
      });
      onPromptSaved(prompt);
      toast.success('已保存到提示词库');
    } catch (error) {
      toast.error(getAPIErrorMessage(error, '保存提示词失败'));
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = <K extends keyof EditableStyleResult>(
    key: K,
    value: EditableStyleResult[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-5 py-4 pr-12">
          <DialogTitle>识别图片风格</DialogTitle>
          <DialogDescription>上传 1–9 张图片，提炼可复用的视觉提示词。</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>参考图片</Label>
              <span className="text-xs text-muted-foreground">
                {images.length}/{MAX_IMAGES} · 单张最大 20MB
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => addImages(Array.from(event.target.files ?? []))}
            />
            {images.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                  >
                    <img
                      src={image.previewURL}
                      alt={image.file.name}
                      className="size-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="absolute right-1 top-1 size-7 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`移除 ${image.file.name}`}
                      onClick={() => removeImage(image.id)}
                      disabled={analyzing}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-foreground/65 px-1.5 py-1 text-[10px] text-background">
                      {formatFileSize(image.file.size)}
                    </span>
                  </div>
                ))}
                {images.length < MAX_IMAGES ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="aspect-square h-auto border-dashed text-muted-foreground"
                    onClick={() => inputRef.current?.click()}
                    disabled={analyzing}
                  >
                    <ImagePlus className="size-5" />
                    <span className="sr-only">添加图片</span>
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-28 w-full border-dashed text-muted-foreground"
                onClick={() => inputRef.current?.click()}
                disabled={analyzing}
              >
                <ImagePlus className="size-5" />
                添加图片
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModelPicker
              value={modelID}
              onValueChange={setModelID}
              capability="vision"
              label="图片理解模型"
              autoSelectFirst
            />
            <div className="space-y-1.5">
              <Label htmlFor="style-analysis-hint">补充说明（可选）</Label>
              <Input
                id="style-analysis-hint"
                value={hint}
                onChange={(event) => setHint(event.target.value)}
                placeholder="例如：用于文章封面"
                maxLength={500}
                disabled={analyzing}
              />
            </div>
          </div>
          {draft ? (
            <div className="space-y-4 rounded-lg border border-border bg-muted/25 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">识别结果</p>
                  <p className="mt-1 text-xs text-muted-foreground">识别模型：{analysis?.model}</p>
                </div>
                {analysis?.sourceCount && analysis.sourceCount > 1 ? (
                  <Badge variant="secondary">共同风格</Badge>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor="style-analysis-name">名称</Label>
                  <Input
                    id="style-analysis-name"
                    value={draft.name}
                    maxLength={20}
                    onChange={(event) => updateDraft('name', event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="style-analysis-description">说明</Label>
                  <Input
                    id="style-analysis-description"
                    value={draft.description}
                    maxLength={50}
                    onChange={(event) => updateDraft('description', event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="style-analysis-prompt">风格提示词</Label>
                <Textarea
                  id="style-analysis-prompt"
                  value={draft.stylePrompt}
                  onChange={(event) => updateDraft('stylePrompt', event.target.value)}
                  className="min-h-28"
                  maxLength={2400}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                {Object.entries(draft.observations).map(([name, value]) =>
                  value ? (
                    <div
                      key={name}
                      className="rounded-md border border-border bg-background px-3 py-2"
                    >
                      <span className="text-foreground">{OBSERVATION_LABELS[name]}</span>
                      <span> · {value}</span>
                    </div>
                  ) : null,
                )}
              </div>
              {draft.commonalityNote ? (
                <p className="text-xs leading-5 text-muted-foreground">{draft.commonalityNote}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t border-border px-5 py-4">
          {draft ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleSave()}
              disabled={saving || analyzing}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}保存到提示词库
            </Button>
          ) : null}
          {draft ? (
            <Button
              type="button"
              onClick={() => onApply(draft.stylePrompt)}
              disabled={!draft.stylePrompt.trim() || analyzing}
            >
              应用到画面描述
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={analyzing || images.length === 0 || !modelID}
            >
              {analyzing ? (
                <>
                  <Loader2 className="animate-spin" />
                  正在识别
                </>
              ) : (
                <>
                  <Sparkles />
                  识别风格
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
