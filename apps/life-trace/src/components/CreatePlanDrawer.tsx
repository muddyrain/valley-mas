import { X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { Button } from '@/components/ui/button';
import { buildPlanSchedule, type PlanDateOption } from '@/lib/planSchedule';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { NewPlanInput, PlanType } from '@/types';

const planTypes: PlanType[] = ['电影', '吃饭', '运动', '阅读', '聚会', '普通事项'];
const dateOptions = [
  { value: '今天', label: '今天' },
  { value: '明天', label: '明天' },
  { value: '周六', label: '周六' },
  { value: '周日', label: '周日' },
  { value: 'custom', label: '自定义' },
] as const;

const defaultForm: NewPlanInput = {
  title: '',
  type: '普通事项',
  timeLabel: '',
  reminder: true,
  imageUrl: '',
  location: '',
  note: '',
};

type DateOptionValue = Extract<(typeof dateOptions)[number]['value'], PlanDateOption>;

type FormErrors = Partial<Record<'title' | 'date' | 'time', string>>;

type CreatePlanDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatePlanDrawer({ open, onOpenChange }: CreatePlanDrawerProps) {
  const addPlan = useLifeTraceStore((state) => state.addPlan);
  const plansError = useLifeTraceStore((state) => state.plansError);
  const planCreating = useLifeTraceStore((state) => state.planCreating);
  const [form, setForm] = useState<NewPlanInput>(defaultForm);
  const [dateOption, setDateOption] = useState<DateOptionValue>('今天');
  const [customDate, setCustomDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(defaultForm);
    setDateOption('今天');
    setCustomDate('');
    setTime('');
    setErrors({});
  }, [open]);

  const updateField = <K extends keyof NewPlanInput>(key: K, value: NewPlanInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = '请输入计划标题';
    }
    if (dateOption === 'custom' && !customDate) {
      nextErrors.date = '请选择日期';
    }
    if (!time) {
      nextErrors.time = '请选择时间';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const schedule = buildPlanSchedule({ dateOption, customDate, time });

    const plan = await addPlan({
      ...form,
      source: form.source ?? 'manual',
      title: form.title.trim(),
      ...schedule,
      imageUrl: form.imageUrl?.trim() || undefined,
      location: form.location?.trim() || undefined,
      note: form.note.trim() || '由 Life Trace 创建的新生活计划。',
    });

    if (plan) {
      onOpenChange(false);
    }
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
          'safe-bottom absolute inset-x-0 bottom-0 mx-auto w-full max-w-[430px] rounded-t-[1.75rem] border border-border bg-card p-5 shadow-2xl transition duration-300',
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible translate-y-[calc(100%+2rem)] opacity-0',
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
            <span className="text-sm font-medium">
              计划标题 <span className="text-life-alert">*</span>
            </span>
            <input
              value={form.title}
              onChange={(event) => {
                updateField('title', event.target.value);
                setErrors((current) => ({ ...current, title: undefined }));
              }}
              placeholder="例如：周六晚上看《沙丘》"
              aria-invalid={Boolean(errors.title)}
              className={cn(
                'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                errors.title ? 'border-destructive' : 'border-border',
              )}
            />
            {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium">类型</span>
            <div className="grid grid-cols-3 gap-2">
              {planTypes.map((type) => {
                const active = form.type === type;

                return (
                  <button
                    key={type}
                    type="button"
                    className={cn(
                      'h-10 rounded-2xl border px-2 text-sm font-semibold transition',
                      active
                        ? 'border-life-ai/40 bg-life-ai/10 text-life-ai'
                        : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => updateField('type', type)}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                日期 <span className="text-life-alert">*</span>
              </span>
              <select
                value={dateOption}
                onChange={(event) => {
                  setDateOption(event.target.value as DateOptionValue);
                  setErrors((current) => ({ ...current, date: undefined }));
                }}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
              >
                {dateOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                时间 <span className="text-life-alert">*</span>
              </span>
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value);
                  setErrors((current) => ({ ...current, time: undefined }));
                }}
                aria-invalid={Boolean(errors.time)}
                className={cn(
                  'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                  errors.time ? 'border-destructive' : 'border-border',
                )}
              />
            </label>
          </div>
          {dateOption === 'custom' ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                自定义日期 <span className="text-life-alert">*</span>
              </span>
              <input
                type="date"
                value={customDate}
                onChange={(event) => {
                  setCustomDate(event.target.value);
                  setErrors((current) => ({ ...current, date: undefined }));
                }}
                aria-invalid={Boolean(errors.date)}
                className={cn(
                  'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                  errors.date ? 'border-destructive' : 'border-border',
                )}
              />
              {errors.date ? <p className="text-xs text-destructive">{errors.date}</p> : null}
            </label>
          ) : null}
          {errors.time ? <p className="-mt-2 text-xs text-destructive">{errors.time}</p> : null}

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

          {plansError ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {plansError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={planCreating}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" variant="ai" disabled={planCreating}>
              {planCreating ? <ActionLoadingIcon /> : null}
              {planCreating ? '保存中' : '保存计划'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
