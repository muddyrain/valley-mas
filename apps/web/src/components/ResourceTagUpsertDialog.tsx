import { Hash, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type ResourceTag, suggestResourceTagDescription } from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type TagFormPayload = {
  name: string;
  description: string;
};

interface ResourceTagUpsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'create' | 'edit';
  initialValue?: Partial<Pick<ResourceTag, 'name' | 'description'>>;
  onSubmit: (payload: TagFormPayload) => Promise<ResourceTag>;
  onSuccess?: (tag: ResourceTag) => void;
  successMessage?: string;
}

export default function ResourceTagUpsertDialog({
  open,
  onOpenChange,
  mode = 'create',
  initialValue,
  onSubmit,
  onSuccess,
  successMessage,
}: ResourceTagUpsertDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
  }, [open, initialValue?.name, initialValue?.description]);

  const title = useMemo(() => (mode === 'edit' ? '编辑标签' : '新增标签'), [mode]);
  const doneText = mode === 'edit' ? '保存' : '创建';

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('请输入标签名称');
      return;
    }
    if (trimmedName.length > 30) {
      toast.error('标签名称不能超过 30 个字符');
      return;
    }
    if (description.trim().length > 100) {
      toast.error('标签描述不能超过 100 个字符');
      return;
    }

    try {
      setSubmitting(true);
      const result = await onSubmit({
        name: trimmedName,
        description: description.trim(),
      });
      onSuccess?.(result);
      toast.success(successMessage ?? (mode === 'edit' ? '标签已更新' : '标签已创建'));
      onOpenChange(false);
    } catch {
      // request.ts 已统一提示
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateDescription = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('请先输入标签名称');
      return;
    }
    try {
      setAiLoading(true);
      const result = await suggestResourceTagDescription(trimmedName);
      const nextDescription = result.description?.trim();
      if (!nextDescription) {
        toast.error('AI 未返回可用描述，请重试');
        return;
      }
      setDescription(nextDescription);
      toast.success('AI 已生成标签描述');
    } catch {
      // request.ts 已统一提示
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting && !aiLoading) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative space-y-4 py-1">
          <BoxLoadingOverlay
            show={aiLoading}
            compact
            title="AI 正在生成描述..."
            hint="请稍候"
            className="rounded-xl"
          />

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">标签名称 *</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：二次元、治愈系"
              maxLength={30}
              className="theme-input-border h-9 text-sm"
              disabled={submitting || aiLoading}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSubmit();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">标签描述</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleGenerateDescription()}
                disabled={submitting || aiLoading || !name.trim()}
                className="h-7 rounded-lg border-theme-soft-strong px-2 text-xs text-theme-primary"
              >
                {aiLoading ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                AI 生成
              </Button>
            </div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="可手动填写，也可让 AI 生成"
              maxLength={100}
              rows={3}
              disabled={submitting || aiLoading}
              className="theme-input-border w-full resize-none rounded-md border px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-theme-primary focus:ring-1 focus:ring-theme-primary/30"
            />
            <p className="text-right text-xs text-slate-400">{description.length}/100</p>
          </div>

          {name.trim() && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-xs text-slate-400">预览：</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-theme-soft-strong bg-theme-soft px-2.5 py-0.5 text-xs font-medium text-theme-primary">
                <Hash className="h-2.5 w-2.5" />
                {name.trim()}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting || aiLoading}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || aiLoading}
            >
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {doneText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
