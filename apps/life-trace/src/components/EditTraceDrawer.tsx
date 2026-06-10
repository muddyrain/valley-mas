import { type FormEvent, useEffect, useState } from 'react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem, SheetActions, SheetHeader, SheetSelectField } from '@/components/FormItem';
import { PlaceSuggestions } from '@/components/PlaceSuggestions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { NewTraceInput, Trace } from '@/types';

const traceSources: Trace['source'][] = ['计划', '打卡', '库存', '手动'];
const traceMoods = ['放松', '满足', '活力', '平静', '开心', '专注'];
const traceSourceOptions = traceSources.map((source) => ({ label: source, value: source }));

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
  const visibleMoodOptions = visibleMoods.map((mood) => ({ label: mood, value: mood }));
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
      placeId: trace.placeId,
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
      placeId: form.placeId,
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
      <SheetHeader
        title={editing ? '编辑踪迹' : '新建踪迹'}
        description={
          editing
            ? '补充照片、地点、心情和标签，让这条记录更完整。'
            : '不用等计划完成，也可以直接记录今天值得留下的片段。'
        }
        closeDisabled={submitting}
        onClose={() => onOpenChange(false)}
      />

      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormItem label="标题" required error={errors.title}>
          <Input
            value={form.title}
            onChange={(event) => {
              updateField('title', event.target.value);
              setErrors((current) => ({ ...current, title: undefined }));
            }}
            aria-invalid={Boolean(errors.title)}
            placeholder="例如：晚饭后散步"
          />
        </FormItem>

        <FormItem label="生活摘要" required error={errors.summary}>
          <Textarea
            value={form.summary}
            onChange={(event) => {
              updateField('summary', event.target.value);
              setErrors((current) => ({ ...current, summary: undefined }));
            }}
            aria-invalid={Boolean(errors.summary)}
            placeholder="记录这件事发生了什么、当时的感受或值得记住的细节。"
          />
        </FormItem>

        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          <FormItem label="时间" required error={errors.timeLabel}>
            <Input
              value={form.timeLabel}
              onChange={(event) => {
                updateField('timeLabel', event.target.value);
                setErrors((current) => ({ ...current, timeLabel: undefined }));
              }}
              aria-invalid={Boolean(errors.timeLabel)}
              placeholder="今天 20:10"
            />
          </FormItem>
          <SheetSelectField
            label="来源"
            value={form.source}
            options={traceSourceOptions}
            onValueChange={(value) => updateField('source', value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          <SheetSelectField
            label="心情"
            value={form.mood}
            options={visibleMoodOptions}
            onValueChange={(value) => updateField('mood', value)}
          />
          <FormItem label="地点">
            <Input
              value={form.location}
              onChange={(event) => {
                updateField('location', event.target.value);
                updateField('placeId', undefined);
              }}
              placeholder="可选"
            />
            <PlaceSuggestions
              value={form.location}
              onSelect={(place) => {
                updateField('location', place.name);
                updateField('placeId', place.id);
              }}
            />
          </FormItem>
        </div>

        <AppImageUploader
          value={form.imageUrl}
          onChange={(url) => updateField('imageUrl', url)}
          label="踪迹图片"
          description="上传生活照片后，会作为这条踪迹的封面展示。"
          disabled={saving}
          onUploadingChange={setImageUploading}
        />

        <FormItem label="标签" description="可用顿号、逗号或换行分隔多个标签。">
          <Input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="例如：计划完成、散步、生活迹"
          />
        </FormItem>

        {tracesError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {tracesError}
          </div>
        ) : null}

        <SheetActions>
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
        </SheetActions>
      </form>
    </BottomSheet>
  );
}
