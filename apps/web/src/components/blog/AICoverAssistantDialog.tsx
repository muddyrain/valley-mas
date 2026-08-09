import { Loader2, Sparkles } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useState,
} from 'react';
import type { AIImageVariationMode } from '@/api/aiImages';
import { ModelPicker } from '@/components/ai/ModelPicker';
import { PromptLibraryInsertButton } from '@/components/ai-workbench/PromptLibraryInsertButton';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

export const BLOG_COVER_AI_ASPECT_RATIO = '16:9';
export const BLOG_COVER_AI_QUALITY = '4K';
export const BLOG_COVER_AI_ASPECT_OPTIONS = ['16:9', '4:3', '1:1'];
export const BLOG_COVER_AI_QUALITY_OPTIONS = ['2K', '4K'];

export const BLOG_COVER_AI_PROMPT_PLACEHOLDER = '可选：补充主体、构图、配色或不希望出现的元素';

type AICoverAssistantMode = 'pick' | 'generate';

export interface AICoverAssistantPayload {
  mode: AICoverAssistantMode;
  modelId: string;
  aspectRatio: string;
  quality: string;
  variationMode: AIImageVariationMode;
  prompt: string;
}

interface AICoverAssistantDialogProps {
  trigger?: ReactNode;
  disabled?: boolean;
  isContentEmpty?: boolean;
  busy?: boolean;
  defaultMode?: AICoverAssistantMode;
  defaultModelId?: string;
  defaultAspectRatio?: string;
  defaultQuality?: string;
  defaultVariationMode?: AIImageVariationMode;
  defaultPrompt?: string;
  onConfirm: (payload: AICoverAssistantPayload) => void | Promise<void>;
}

const COVER_TABS = [
  { mode: 'pick' as const, label: 'AI 选图' },
  { mode: 'generate' as const, label: 'AI 生图' },
] as const;

const VARIATION_OPTIONS: Array<{
  value: AIImageVariationMode;
  label: string;
}> = [
  { value: 'precise', label: '精确遵循' },
  { value: 'balanced', label: '均衡变化' },
  { value: 'exploratory', label: '大胆探索' },
];

function defaultButtonLabel(isBusy: boolean) {
  return (
    <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={isBusy}>
      <Sparkles className="mr-1.5 h-4 w-4" />
      AI 封面助手
    </Button>
  );
}

export function AICoverAssistantDialog({
  trigger,
  disabled = false,
  isContentEmpty = false,
  busy = false,
  defaultMode = 'generate',
  defaultModelId = '',
  defaultAspectRatio = BLOG_COVER_AI_ASPECT_RATIO,
  defaultQuality = BLOG_COVER_AI_QUALITY,
  defaultVariationMode = 'balanced',
  defaultPrompt = '',
  onConfirm,
}: AICoverAssistantDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AICoverAssistantMode>(defaultMode);
  const [modelId, setModelId] = useState(defaultModelId);
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [quality, setQuality] = useState(defaultQuality);
  const [variationMode, setVariationMode] = useState<AIImageVariationMode>(defaultVariationMode);
  const [prompt, setPrompt] = useState(defaultPrompt);

  const isBusy = disabled || busy;

  const initialize = useCallback(() => {
    setMode(defaultMode);
    setModelId(defaultModelId);
    setAspectRatio(defaultAspectRatio);
    setQuality(defaultQuality);
    setVariationMode(defaultVariationMode);
    setPrompt(defaultPrompt.trim());
  }, [
    defaultMode,
    defaultModelId,
    defaultAspectRatio,
    defaultQuality,
    defaultVariationMode,
    defaultPrompt,
  ]);

  const handleOpen = () => {
    if (isBusy) return;
    setOpen(true);
    initialize();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      initialize();
    }
  };

  const handleConfirm = async () => {
    if (isBusy || isContentEmpty) return;
    if (mode === 'generate' && !modelId) return;

    setOpen(false);
    await onConfirm({
      mode,
      modelId,
      aspectRatio,
      quality,
      variationMode,
      prompt: prompt.trim(),
    });
  };

  const handlePromptInsert = (content: string) => {
    const add = content.trim();
    if (!add) return;
    setPrompt((current) => [current.trim(), add].filter(Boolean).join('\n\n'));
  };

  const finalTrigger = (() => {
    if (trigger) {
      if (isValidElement(trigger)) {
        const typedTrigger = trigger as ReactElement<{
          onClick?: (event: React.MouseEvent<HTMLElement>) => void;
          disabled?: boolean;
          type?: string;
        }>;
        return cloneElement(typedTrigger, {
          disabled: typedTrigger.props.disabled || isBusy,
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            typedTrigger.props.onClick?.(event);
            if (!event.defaultPrevented && !isBusy && !typedTrigger.props.disabled) {
              handleOpen();
            }
          },
        });
      }

      return (
        <Button type="button" variant="outline" size="sm" onClick={handleOpen} disabled={isBusy}>
          {String(trigger)}
        </Button>
      );
    }

    return defaultButtonLabel(isBusy);
  })();

  return (
    <>
      <span className="inline-flex">{finalTrigger}</span>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>AI 封面助手</DialogTitle>
            <DialogDescription className="leading-6 text-sm text-muted-foreground">
              根据文章内容选择图片，或生成一张新封面。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">封面模式</p>
              <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="AI 封面模式">
                {COVER_TABS.map(({ mode: itemMode, label }) => {
                  const active = mode === itemMode;
                  return (
                    <Button
                      key={itemMode}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      className="h-9"
                      onClick={() => setMode(itemMode)}
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {mode === 'generate' && (
              <>
                <div className="space-y-2">
                  <ModelPicker
                    value={modelId || undefined}
                    onValueChange={setModelId}
                    capability="image_generation"
                    label="生图模型"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="blog-cover-assistant-variation"
                    className="text-xs text-muted-foreground"
                  >
                    画面变化
                  </Label>
                  <Select
                    value={variationMode}
                    onValueChange={(nextValue) =>
                      setVariationMode((nextValue || 'balanced') as AIImageVariationMode)
                    }
                  >
                    <SelectTrigger
                      id="blog-cover-assistant-variation"
                      className="w-full rounded-xl"
                    >
                      <SelectValue placeholder="选择变化幅度">
                        {VARIATION_OPTIONS.find((option) => option.value === variationMode)?.label}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {VARIATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="blog-cover-assistant-aspect"
                      className="text-xs text-muted-foreground"
                    >
                      宽高比
                    </Label>
                    <Select
                      value={aspectRatio}
                      onValueChange={(nextValue) =>
                        setAspectRatio(nextValue || BLOG_COVER_AI_ASPECT_RATIO)
                      }
                    >
                      <SelectTrigger id="blog-cover-assistant-aspect" className="w-full rounded-xl">
                        <SelectValue placeholder="选择宽高比" />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOG_COVER_AI_ASPECT_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="blog-cover-assistant-quality"
                      className="text-xs text-muted-foreground"
                    >
                      清晰度
                    </Label>
                    <Select
                      value={quality}
                      onValueChange={(nextValue) => setQuality(nextValue || BLOG_COVER_AI_QUALITY)}
                    >
                      <SelectTrigger
                        id="blog-cover-assistant-quality"
                        className="w-full rounded-xl"
                      >
                        <SelectValue placeholder="选择清晰度" />
                      </SelectTrigger>
                      <SelectContent>
                        {BLOG_COVER_AI_QUALITY_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="blog-cover-assistant-prompt"
                      className="text-xs text-muted-foreground"
                    >
                      生图提示词
                    </Label>
                    <PromptLibraryInsertButton
                      onInsert={handlePromptInsert}
                      targetLabel="生图提示词"
                      showText={false}
                      size="icon-sm"
                      variant="outline"
                      className="h-6 w-6"
                    />
                  </div>
                  <Textarea
                    id="blog-cover-assistant-prompt"
                    rows={6}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={BLOG_COVER_AI_PROMPT_PLACEHOLDER}
                    className="rounded-xl"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    默认根据文章内容构思封面；留空也可直接生成。
                  </p>
                </div>
              </>
            )}

            {mode === 'pick' && (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                AI 选图将从资源池按内容语义快速匹配封面，不额外需要模型与分辨率参数。
              </div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isBusy}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={isBusy || isContentEmpty || (mode === 'generate' && !modelId)}
            >
              {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'generate' ? '确认并生图' : '确认并选图'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
