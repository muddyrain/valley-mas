import { Loader2, Sparkles } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useState,
} from 'react';
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

export const BLOG_COVER_AI_PROMPT = `随机创作一张 4K 高清二次元游戏角色壁纸，角色风格偏向原神、鸣潮、崩坏：星穹铁道那种高品质二游角色设计。
角色 1~3 人，人物必须精致好看，五官清晰，发型有设计感，服装复杂且有层次，配饰丰富，角色气质鲜明，具有强烈的游戏角色感。
可为幻想、都市、科幻、东方、学院、冒险等题材，角色身份随机，如剑士、法师、旅者、机能少女、星际角色、学院角色等。
构图可为半身、全身、双人互动、动态动作，不要普通站桩头像。
画面重点放在角色设计，不要只突出特效和氛围。
色彩避免连续使用红紫、蓝紫、暗红等相近色系，优先使用清新明亮、自然协调的配色。
背景要有完整场景，如城市、遗迹、森林、学院、车站、星舰、街区等，并与角色气质统一。
日系二次元插画，精致立绘感，画面干净，高细节，高完成度，4k，no text，no logo，no watermark。`;
export const BLOG_COVER_AI_PROMPT_PLACEHOLDER =
  '可在此补充更具体的角色元素、构图要求或场景细节（可留空）';

type AICoverAssistantMode = 'pick' | 'generate';

export interface AICoverAssistantPayload {
  mode: AICoverAssistantMode;
  modelId: string;
  aspectRatio: string;
  quality: string;
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
  defaultPrompt?: string;
  onConfirm: (payload: AICoverAssistantPayload) => void | Promise<void>;
}

const COVER_TABS = [
  { mode: 'pick' as const, label: 'AI 选图' },
  { mode: 'generate' as const, label: 'AI 生图' },
] as const;

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
  defaultPrompt = BLOG_COVER_AI_PROMPT,
  onConfirm,
}: AICoverAssistantDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AICoverAssistantMode>(defaultMode);
  const [modelId, setModelId] = useState(defaultModelId);
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [quality, setQuality] = useState(defaultQuality);
  const [prompt, setPrompt] = useState(defaultPrompt);

  const isBusy = disabled || busy;

  const initialize = useCallback(() => {
    setMode(defaultMode);
    setModelId(defaultModelId);
    setAspectRatio(defaultAspectRatio);
    setQuality(defaultQuality);
    setPrompt(defaultPrompt.trim() || BLOG_COVER_AI_PROMPT);
  }, [defaultMode, defaultModelId, defaultAspectRatio, defaultQuality, defaultPrompt]);

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
      prompt: (prompt || BLOG_COVER_AI_PROMPT).trim() || BLOG_COVER_AI_PROMPT,
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
              合并 AI 选图和 AI 生图能力，在一个弹窗内完成模型选择与参数配置，确认后直接生成封面。
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

                <Separator />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="blog-cover-assistant-aspect"
                      className="text-xs text-muted-foreground"
                    >
                      宽高比
                    </Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
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
                    <Select value={quality} onValueChange={setQuality}>
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
                    当前已设置默认高品质日系二次元角色壁纸提示词，可按需补充更多细节。
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
