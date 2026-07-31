import { ImagePlus, Send, Sparkles, Square, X } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_SIZE = 5 * 1024 * 1024;
const SUPPORTED_REFERENCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type ConversationComposerReferenceImage = {
  id: string;
  name: string;
  dataUrl: string;
};

export type ConversationComposerSkill = {
  id: string;
  name: string;
  description?: string;
};

const readReferenceImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });

export function ConversationComposer({
  value,
  onValueChange,
  onSubmit,
  disabled = false,
  canSubmit = true,
  placeholder,
  maxLength,
  skills = [],
  activeSkillId,
  onActiveSkillChange,
  referenceImages,
  onReferenceImagesChange,
  footer,
  onStop,
  className,
  revealAttribute,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  canSubmit?: boolean;
  placeholder: string;
  maxLength?: number;
  skills?: ConversationComposerSkill[];
  activeSkillId?: string;
  onActiveSkillChange?: (skillId?: string) => void;
  referenceImages?: ConversationComposerReferenceImage[];
  onReferenceImagesChange?: (images: ConversationComposerReferenceImage[]) => void;
  footer?: ReactNode;
  onStop?: () => void;
  className?: string;
  revealAttribute?: string;
}) {
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const activeSkill = skills.find((skill) => skill.id === activeSkillId);
  const skillMatch = value.match(/(?:^|\s)\/([^\s]*)$/);
  const skillQuery = skillMatch?.[1] ?? '';
  const visibleSkills = skills
    .filter((skill) =>
      `${skill.name} ${skill.description || ''}`
        .toLocaleLowerCase('zh-CN')
        .includes(skillQuery.toLocaleLowerCase('zh-CN')),
    )
    .slice(0, 6);

  const addReferenceImages = async (files: FileList | null) => {
    if (!files || !referenceImages || !onReferenceImagesChange) return;
    const candidates = Array.from(files).slice(
      0,
      Math.max(0, MAX_REFERENCE_IMAGES - referenceImages.length),
    );
    if (Array.from(files).length > candidates.length) toast.error('一次最多附加 3 张参考图');
    try {
      const valid = candidates.filter((file) => {
        if (!SUPPORTED_REFERENCE_IMAGE_TYPES.includes(file.type)) {
          toast.error(`${file.name} 不是 JPG、PNG 或 WebP 图片`);
          return false;
        }
        if (file.size > MAX_REFERENCE_IMAGE_SIZE) {
          toast.error(`${file.name} 超过 5MB`);
          return false;
        }
        return true;
      });
      const dataUrls = await Promise.all(valid.map(readReferenceImage));
      onReferenceImagesChange([
        ...referenceImages,
        ...valid.map((file, index) => ({
          id: `${file.name}-${Date.now()}-${index}`,
          name: file.name,
          dataUrl: dataUrls[index],
        })),
      ]);
    } catch {
      toast.error('读取参考图失败');
    } finally {
      if (referenceInputRef.current) referenceInputRef.current.value = '';
    }
  };

  return (
    <div className={cn('relative w-full', className)} data-agent-reveal={revealAttribute}>
      <div className="relative rounded-xl border border-border bg-card shadow-sm transition-shadow duration-200 focus-within:shadow-md">
        {skillMatch && visibleSkills.length > 0 ? (
          <div className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-[min(24rem,calc(100vh-8rem))] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-lg">
            <p className="px-2 py-1 text-xs font-medium text-muted-foreground">选择本轮技能</p>
            {visibleSkills.map((skill) => (
              <Button
                key={skill.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-2 text-left"
                onClick={() => {
                  onActiveSkillChange?.(skill.id);
                  onValueChange(value.replace(/(^|\s)\/[^\s]*$/, '$1'));
                }}
              >
                <Sparkles className="size-4 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{skill.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {skill.description || '本轮使用此技能'}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        ) : null}
        {activeSkill || (referenceImages?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2 px-4 pt-3">
            {activeSkill ? (
              <Badge variant="secondary" className="gap-1.5 py-1">
                <Sparkles className="size-3 text-primary" />
                {activeSkill.name}
                <button
                  type="button"
                  className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onActiveSkillChange?.()}
                  aria-label={`移除技能 ${activeSkill.name}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ) : null}
            {referenceImages?.map((image) => (
              <div
                key={image.id}
                className="relative size-11 overflow-hidden rounded-md border border-border bg-muted"
              >
                <img src={image.dataUrl} alt={image.name} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() =>
                    onReferenceImagesChange?.(
                      referenceImages.filter((item) => item.id !== image.id),
                    )
                  }
                  aria-label={`移除参考图 ${image.name}`}
                  className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 text-foreground shadow-sm"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="px-4 pt-3">
          <Textarea
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-24 resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!disabled && value.trim() && canSubmit) onSubmit();
              }
            }}
            maxLength={maxLength}
          />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-3 py-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {referenceImages && onReferenceImagesChange ? (
              <>
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => void addReferenceImages(event.target.files)}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={disabled || referenceImages.length >= MAX_REFERENCE_IMAGES}
                  onClick={() => referenceInputRef.current?.click()}
                  aria-label="附加参考图"
                  title="附加参考图"
                >
                  <ImagePlus />
                </Button>
              </>
            ) : null}
            {footer}
          </div>
          {disabled && onStop ? (
            <Button
              size="icon"
              variant="outline"
              onClick={onStop}
              aria-label="停止生成"
              title="停止生成"
            >
              <Square />
            </Button>
          ) : (
            <Button
              size="icon"
              className="rounded-full"
              onClick={onSubmit}
              disabled={disabled || !value.trim() || !canSubmit}
              aria-label="发送消息"
              title="发送消息"
            >
              <Send />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
