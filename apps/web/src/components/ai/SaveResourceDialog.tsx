import { AlertCircle, Check, Eye, LoaderCircle, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

export type SaveResourceVisibility = 'private' | 'public';
export type SaveResourceProgress = 'title' | 'tags' | 'saving';

interface SaveResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (visibility: SaveResourceVisibility) => void | Promise<void>;
  pending?: boolean;
  progress?: SaveResourceProgress;
  modelName?: string;
  error?: string;
}

export function SaveResourceDialog({
  open,
  onOpenChange,
  onConfirm,
  pending = false,
  progress,
  modelName,
  error,
}: SaveResourceDialogProps) {
  const [visibility, setVisibility] = useState<SaveResourceVisibility>('private');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (open) setVisibility('private');
  }, [open]);

  useEffect(() => {
    if (!pending) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const updateElapsed = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [pending]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>保存到资源库</DialogTitle>
          <DialogDescription>选择这张图片保存后的访问范围。</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={visibility}
          onValueChange={(value) => setVisibility(value as SaveResourceVisibility)}
          className="gap-2"
          aria-label="资源访问范围"
        >
          <Label
            htmlFor="save-resource-private"
            className="cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
          >
            <RadioGroupItem id="save-resource-private" value="private" className="mt-0.5" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <LockKeyhole className="size-3.5" />
                私密保存
              </span>
              <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                只有你可以在资源库中查看。
              </span>
            </span>
          </Label>
          <Label
            htmlFor="save-resource-public"
            className="cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
          >
            <RadioGroupItem id="save-resource-public" value="public" className="mt-0.5" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Eye className="size-3.5" />
                公开访问
              </span>
              <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                其他人可以在公开资源中看到这张图片。
              </span>
            </span>
          </Label>
        </RadioGroup>
        {pending ? (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-foreground">AI 正在整理资源信息</p>
                {modelName ? (
                  <p className="mt-0.5 truncate text-muted-foreground">模型：{modelName}</p>
                ) : null}
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                已用 {elapsedSeconds} 秒
              </span>
            </div>
            {(
              [
                ['title', '生成资源标题'],
                ['tags', '配置资源标签'],
                ['saving', '保存图片资源'],
              ] as const
            ).map(([key, label]) => {
              const active = progress === key;
              const complete =
                progress === 'tags' ? key === 'title' : progress === 'saving' && key !== 'saving';
              return (
                <div key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                  {complete ? (
                    <Check className="size-3.5 text-primary" />
                  ) : active ? (
                    <LoaderCircle className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
                  ) : (
                    <span className="size-3.5 rounded-full border border-border" />
                  )}
                  <span className={active || complete ? 'text-foreground' : undefined}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="leading-5">{error}</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            取消
          </Button>
          <Button type="button" onClick={() => void onConfirm(visibility)} disabled={pending}>
            {pending ? '保存中…' : '确认保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
