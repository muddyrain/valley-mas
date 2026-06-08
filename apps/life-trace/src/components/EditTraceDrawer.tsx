import { X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { NewTraceInput, Trace } from '@/types';

const traceSources: Trace['source'][] = ['计划', '打卡', '库存', '手动'];
const traceMoods = ['放松', '满足', '活力', '平静', '开心', '专注'];

type TraceFormErrors = Partial<Record<'title' | 'summary' | 'timeLabel', string>>;

type EditTraceDrawerProps = {
  open: boolean;
  trace: Trace | null;
  onOpenChange: (open: boolean) => void;
  initialInput?: Partial<NewTraceInput>;
  onSaved?: (trace: Trace) => void;
};

const getDefaultTimeLabel = () =>
  new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

function stringifyTags(tags: string[]) {
  return tags.join('、');
}

function parseTags(value: string) {
  return value
    .split(/[、,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function EditTraceDrawer({
  open,
  trace,
  onOpenChange,
  initialInput,
  onSaved,
}: EditTraceDrawerProps) {
  const addTrace = useLifeTraceStore((state) => state.addTrace);
  const editTrace = useLifeTraceStore((state) => state.editTrace);
  const tracesError = useLifeTraceStore((state) => state.tracesError);
  const creating = useLifeTraceStore((state) => state.traceCreating);
  const updating = useLifeTraceStore((state) =>
    trace ? Boolean(state.traceUpdatingById[trace.id]) : false,
  );
  const [form, setForm] = useState<NewTraceInput>({
    title: '',
    summary: '',
    timeLabel: '',
    location: '',
    imageUrl: '',
    mood: '放松',
    tags: ['生活迹'],
    source: '手动',
  });
  const [tagText, setTagText] = useState('');
  const [errors, setErrors] = useState<TraceFormErrors>({});
  const [imageUploading, setImageUploading] = useState(false);
  const visibleMoods = traceMoods.includes(form.mood) ? traceMoods : [form.mood, ...traceMoods];
  const editing = Boolean(trace);
  const saving = editing ? updating : creating;
  const submitting = saving || imageUploading;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!trace) {
      const nextForm = {
        title: '',
        summary: '',
        timeLabel: `今天 ${getDefaultTimeLabel()}`,
        location: '',
        imageUrl: '',
        mood: '放松',
        ...initialInput,
        tags: initialInput?.tags?.length ? initialInput.tags : ['生活迹'],
        source: initialInput?.source ?? '手动',
      };
      setForm(nextForm);
      setTagText(stringifyTags(nextForm.tags));
      setErrors({});
      return;
    }

    setForm({
      planId: trace.planId,
      title: trace.title,
      summary: trace.summary,
      timeLabel: trace.timeLabel,
      location: trace.location ?? '',
      imageUrl: trace.imageUrl ?? '',
      mood: trace.mood || '放松',
      tags: trace.tags.length > 0 ? trace.tags : ['生活迹'],
      source: trace.source,
    });
    setTagText(stringifyTags(trace.tags.length > 0 ? trace.tags : ['生活迹']));
    setErrors({});
  }, [initialInput, open, trace]);

  const updateField = <K extends keyof NewTraceInput>(key: K, value: NewTraceInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: TraceFormErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = '请输入踪迹标题';
    }
    if (!form.summary.trim()) {
      nextErrors.summary = '请输入生活摘要';
    }
    if (!form.timeLabel.trim()) {
      nextErrors.timeLabel = '请输入时间';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      ...form,
      planId: form.planId || undefined,
      title: form.title.trim(),
      summary: form.summary.trim(),
      timeLabel: form.timeLabel.trim(),
      location: form.location?.trim() || undefined,
      imageUrl: form.imageUrl?.trim() || undefined,
      mood: form.mood.trim() || '放松',
      tags: parseTags(tagText),
      source: form.source,
    };
    const saved = trace ? await editTrace(trace.id, payload) : await addTrace(payload);

    if (saved) {
      onSaved?.(saved);
      onOpenChange(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel={editing ? '关闭编辑踪迹' : '关闭新建踪迹'}
      closeDisabled={submitting}
      zIndexClassName="z-[70]"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{editing ? '编辑踪迹' : '新建踪迹'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {editing
              ? '补充照片、地点、心情和标签，让这条记录更完整。'
              : '不用等计划完成，也可以直接记录今天值得留下的片段。'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={submitting}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-5" />
        </Button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium">
            标题 <span className="text-life-alert">*</span>
          </span>
          <input
            value={form.title}
            onChange={(event) => {
              updateField('title', event.target.value);
              setErrors((current) => ({ ...current, title: undefined }));
            }}
            aria-invalid={Boolean(errors.title)}
            placeholder="例如：晚饭后散步"
            className={cn(
              'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
              errors.title ? 'border-destructive' : 'border-border',
            )}
          />
          {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">
            生活摘要 <span className="text-life-alert">*</span>
          </span>
          <textarea
            value={form.summary}
            onChange={(event) => {
              updateField('summary', event.target.value);
              setErrors((current) => ({ ...current, summary: undefined }));
            }}
            aria-invalid={Boolean(errors.summary)}
            placeholder="记录这件事发生了什么、当时的感受或值得记住的细节。"
            className={cn(
              'min-h-24 w-full resize-none rounded-2xl border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring',
              errors.summary ? 'border-destructive' : 'border-border',
            )}
          />
          {errors.summary ? <p className="text-xs text-destructive">{errors.summary}</p> : null}
        </label>

        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              时间 <span className="text-life-alert">*</span>
            </span>
            <input
              value={form.timeLabel}
              onChange={(event) => {
                updateField('timeLabel', event.target.value);
                setErrors((current) => ({ ...current, timeLabel: undefined }));
              }}
              aria-invalid={Boolean(errors.timeLabel)}
              placeholder="今天 20:10"
              className={cn(
                'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                errors.timeLabel ? 'border-destructive' : 'border-border',
              )}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">来源</span>
            <select
              value={form.source}
              onChange={(event) => updateField('source', event.target.value as Trace['source'])}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
            >
              {traceSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </label>
        </div>
        {errors.timeLabel ? (
          <p className="-mt-2 text-xs text-destructive">{errors.timeLabel}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          <label className="block space-y-2">
            <span className="text-sm font-medium">心情</span>
            <select
              value={form.mood}
              onChange={(event) => updateField('mood', event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
            >
              {visibleMoods.map((mood) => (
                <option key={mood} value={mood}>
                  {mood}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">地点</span>
            <input
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              placeholder="可选"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>
        </div>

        <AppImageUploader
          value={form.imageUrl}
          onChange={(url) => updateField('imageUrl', url)}
          label="踪迹图片"
          description="上传生活照片后，会作为这条踪迹的封面展示。"
          disabled={saving}
          onUploadingChange={setImageUploading}
        />

        <label className="block space-y-2">
          <span className="text-sm font-medium">标签</span>
          <input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="例如：计划完成、散步、生活迹"
            className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
          />
          <p className="text-xs text-muted-foreground">可用顿号、逗号或换行分隔多个标签。</p>
        </label>

        {tracesError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {tracesError}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 pt-2 max-[360px]:grid-cols-1">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button type="submit" variant="ai" disabled={submitting}>
            {submitting ? <ActionLoadingIcon /> : null}
            {submitting ? '保存中' : editing ? '保存修改' : '保存踪迹'}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
