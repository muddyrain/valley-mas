import { X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { NewPlanInput, PlanType } from '@/types';

const planTypes: PlanType[] = ['电影', '吃饭', '运动', '阅读', '聚会', '普通事项'];

const defaultForm: NewPlanInput = {
  title: '',
  type: '普通事项',
  timeLabel: '',
  reminder: true,
  imageUrl: '',
  location: '',
  note: '',
};

type CreatePlanDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatePlanDrawer({ open, onOpenChange }: CreatePlanDrawerProps) {
  const addPlan = useLifeTraceStore((state) => state.addPlan);
  const [form, setForm] = useState<NewPlanInput>(defaultForm);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(defaultForm);
  }, [open]);

  const updateField = <K extends keyof NewPlanInput>(key: K, value: NewPlanInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim() || !form.timeLabel.trim()) {
      return;
    }

    addPlan({
      ...form,
      title: form.title.trim(),
      timeLabel: form.timeLabel.trim(),
      imageUrl: form.imageUrl?.trim() || undefined,
      location: form.location?.trim() || undefined,
      note: form.note.trim() || '由 Life Trace 创建的新生活计划。',
    });
    onOpenChange(false);
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 transition',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      <button
        type="button"
        aria-label="关闭创建计划"
        className={cn(
          'absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'safe-bottom absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-[1.75rem] border border-border bg-card p-5 shadow-2xl transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">创建计划</h2>
            <p className="mt-1 text-sm text-muted-foreground">先计划生活，完成后留下踪迹。</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </Button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">计划标题</span>
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="例如：周六晚上看《沙丘》"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">类型</span>
              <select
                value={form.type}
                onChange={(event) => updateField('type', event.target.value as PlanType)}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
              >
                {planTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">时间</span>
              <input
                value={form.timeLabel}
                onChange={(event) => updateField('timeLabel', event.target.value)}
                placeholder="周六 19:30"
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">图片链接</span>
            <input
              value={form.imageUrl}
              onChange={(event) => updateField('imageUrl', event.target.value)}
              placeholder="可选，先用图片 URL 代替上传"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">地点</span>
              <input
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
                placeholder="可选"
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
              />
            </label>
            <button
              type="button"
              className={cn(
                'h-11 rounded-2xl border px-4 text-sm font-semibold transition',
                form.reminder
                  ? 'border-life-health/40 bg-life-health/10 text-life-health'
                  : 'border-border bg-secondary text-muted-foreground',
              )}
              onClick={() => updateField('reminder', !form.reminder)}
            >
              {form.reminder ? '提醒开' : '提醒关'}
            </button>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">备注</span>
            <textarea
              value={form.note}
              onChange={(event) => updateField('note', event.target.value)}
              placeholder="写一点期待，AI 后续可以帮你丰富。"
              className="min-h-20 w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring"
            />
          </label>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" variant="ai">
              保存计划
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
