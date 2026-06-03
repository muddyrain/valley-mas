import { Camera, ChevronDown, Sparkles, Trash2, X } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePantryThumbnail } from '@/api/pantry';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OptionPickerSheet } from '@/components/OptionPickerSheet';
import { Button } from '@/components/ui/button';
import { formatPantryReminderSummary, getPantryCoverUrl } from '@/lib/pantry';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type {
  NewPantryItemInput,
  PantryCategory,
  PantryItem,
  PantryLocation,
  PantryPreferences,
  PantryReminderRule,
} from '@/types';

const categoryOptions: PantryCategory[] = ['食品', '日用品', '药品', '宠物', '其他'];
const locationOptions: PantryLocation[] = [
  '冷藏',
  '冷冻',
  '厨房',
  '储物柜',
  '卫生间',
  '玄关',
  '其他',
];
const reminderRuleOptions: PantryReminderRule[] = ['7d', '3d', 'same-day', 'expired'];
const categoryPickerOptions = categoryOptions.map((option) => ({ label: option, value: option }));
const locationPickerOptions = locationOptions.map((option) => ({ label: option, value: option }));

const defaultPantryForm = (preferences: PantryPreferences): NewPantryItemInput => ({
  name: '',
  category: '食品',
  quantity: 1,
  unit: '件',
  location: '冷藏',
  expiresAt: '',
  openedAt: '',
  note: '',
  imageUrl: '',
  thumbnailUrl: '',
  status: 'normal',
  reminder: {
    enabled: preferences.defaultReminderEnabled,
    useDefault: true,
    rules: preferences.defaultReminderRules,
    reminderTime: preferences.defaultReminderTime,
  },
});

type PantryItemDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: PantryItem | null;
  householdId?: string;
  householdName?: string;
  onSaved?: (message: string) => void;
};

type PantryFormErrors = Partial<Record<'name' | 'quantity', string>>;

export function PantryItemDrawer({
  open,
  onOpenChange,
  item,
  householdId,
  householdName,
  onSaved,
}: PantryItemDrawerProps) {
  const token = useAuthStore((state) => state.token);
  const pantryPreferences = useLifeTraceStore((state) => state.pantryPreferences);
  const addPantryItem = useLifeTraceStore((state) => state.addPantryItem);
  const editPantryItem = useLifeTraceStore((state) => state.editPantryItem);
  const removePantryItem = useLifeTraceStore((state) => state.removePantryItem);
  const [form, setForm] = useState<NewPantryItemInput>(() => defaultPantryForm(pantryPreferences));
  const [errors, setErrors] = useState<PantryFormErrors>({});
  const [thumbnailGenerating, setThumbnailGenerating] = useState(false);
  const [thumbnailError, setThumbnailError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveQueuedAfterThumbnail, setSaveQueuedAfterThumbnail] = useState(false);
  const [activePicker, setActivePicker] = useState<'category' | 'location' | null>(null);
  const queuedPayloadRef = useRef<NewPantryItemInput | null>(null);
  const editing = Boolean(item);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (item) {
      setForm({
        ...item,
        quantity: item.quantity || 1,
        unit: item.unit || '件',
        note: item.note || '',
        imageUrl: item.imageUrl || '',
        thumbnailUrl: item.thumbnailUrl || '',
        reminder: {
          enabled: item.reminder?.enabled ?? pantryPreferences.defaultReminderEnabled,
          useDefault: item.reminder?.useDefault ?? true,
          rules: item.reminder?.rules?.length
            ? item.reminder.rules
            : pantryPreferences.defaultReminderRules,
          reminderTime: item.reminder?.reminderTime || pantryPreferences.defaultReminderTime,
        },
      });
    } else {
      setForm(defaultPantryForm(pantryPreferences));
    }
    setErrors({});
    setSubmitting(false);
    setDeleteConfirmOpen(false);
    setDeleting(false);
    setThumbnailGenerating(false);
    setThumbnailError('');
    setSaveQueuedAfterThumbnail(false);
    queuedPayloadRef.current = null;
    setActivePicker(null);
  }, [item, open, pantryPreferences]);

  const updateField = <K extends keyof NewPantryItemInput>(
    key: K,
    value: NewPantryItemInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reminderSummary = useMemo(
    () =>
      formatPantryReminderSummary(
        form.reminder.useDefault
          ? {
              enabled: pantryPreferences.defaultReminderEnabled,
              useDefault: true,
              rules: pantryPreferences.defaultReminderRules,
              reminderTime: pantryPreferences.defaultReminderTime,
            }
          : form.reminder,
      ),
    [form.reminder, pantryPreferences],
  );

  const buildSubmitPayload = (): NewPantryItemInput | null => {
    const nextErrors: PantryFormErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = '请输入商品名称';
    }
    if (!Number.isFinite(form.quantity) || form.quantity <= 0) {
      nextErrors.quantity = '数量至少要大于 0';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return null;
    }

    return {
      ...form,
      name: form.name.trim(),
      unit: form.unit.trim() || '件',
      expiresAt: form.expiresAt || undefined,
      openedAt: form.openedAt || undefined,
      imageUrl: form.imageUrl?.trim() || undefined,
      thumbnailUrl: form.thumbnailUrl?.trim() || undefined,
      note: form.note.trim(),
      reminder: form.reminder.useDefault
        ? {
            enabled: pantryPreferences.defaultReminderEnabled,
            useDefault: true,
            rules: pantryPreferences.defaultReminderRules,
            reminderTime: pantryPreferences.defaultReminderTime,
          }
        : form.reminder,
      status: 'normal',
    };
  };

  const submitPayload = useCallback(
    async (payload: NewPantryItemInput) => {
      setSubmitting(true);
      try {
        const saved = item
          ? await editPantryItem(item.id, payload, householdId)
          : await addPantryItem(payload, householdId);
        if (saved) {
          queuedPayloadRef.current = null;
          setSaveQueuedAfterThumbnail(false);
          onOpenChange(false);
          onSaved?.(`${editing ? '已更新' : '已保存'}「${saved.name}」库存`);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [addPantryItem, editPantryItem, editing, householdId, item, onOpenChange, onSaved],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const payload = buildSubmitPayload();
    if (!payload) {
      return;
    }

    if (thumbnailGenerating) {
      queuedPayloadRef.current = payload;
      setSaveQueuedAfterThumbnail(true);
      return;
    }

    await submitPayload(payload);
  };

  const handleGenerateThumbnail = async () => {
    if (!token) {
      setThumbnailError('请先登录后再生成 AI 缩略图。');
      return;
    }
    if (thumbnailGenerating) {
      return;
    }

    setThumbnailGenerating(true);
    setThumbnailError('');
    try {
      const result = await generatePantryThumbnail(token, {
        name: form.name.trim() || undefined,
        category: form.category,
        location: form.location,
        note: form.note.trim() || undefined,
      });
      updateField('thumbnailUrl', result.thumbnailUrl);
    } catch (error) {
      setThumbnailError(error instanceof Error ? error.message : 'AI 缩略图生成失败，请稍后再试。');
    } finally {
      setThumbnailGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!item || deleting) {
      return;
    }

    setDeleting(true);
    const removed = await removePantryItem(item.id, householdId);
    setDeleting(false);
    if (!removed) {
      return;
    }

    setDeleteConfirmOpen(false);
    onOpenChange(false);
    onSaved?.(`已删除「${item.name}」库存`);
  };

  useEffect(() => {
    if (
      thumbnailGenerating ||
      submitting ||
      !saveQueuedAfterThumbnail ||
      !queuedPayloadRef.current
    ) {
      return;
    }

    const payload = {
      ...queuedPayloadRef.current,
      thumbnailUrl: form.thumbnailUrl?.trim() || queuedPayloadRef.current.thumbnailUrl,
    };
    queuedPayloadRef.current = null;
    setSaveQueuedAfterThumbnail(false);
    void submitPayload(payload);
  }, [form.thumbnailUrl, saveQueuedAfterThumbnail, submitting, submitPayload, thumbnailGenerating]);

  const effectiveCover = getPantryCoverUrl(form as PantryItem);

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        overlayLabel="关闭库存编辑"
        zIndexClassName="z-50"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{editing ? '编辑库存' : '添加库存'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              给家里的商品留一张图，再决定何时提醒你处理。
            </p>
            {householdName ? (
              <p className="mt-2 text-xs font-medium text-life-ai">保存到：{householdName}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </Button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">
              名称 <span className="text-life-alert">*</span>
            </span>
            <input
              value={form.name}
              onChange={(event) => {
                updateField('name', event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="例如：低温鲜奶"
              aria-invalid={Boolean(errors.name)}
              className={cn(
                'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                errors.name ? 'border-destructive' : 'border-border',
              )}
            />
            {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
          </label>

          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <div className="block space-y-2">
              <span className="text-sm font-medium">分类</span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setActivePicker('category')}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{form.category}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </span>
              </button>
            </div>
            <div className="block space-y-2">
              <span className="text-sm font-medium">位置</span>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setActivePicker('location')}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{form.location}</span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_6.5rem_5.5rem] gap-3 max-[360px]:grid-cols-1">
            <label className="block space-y-2">
              <span className="text-sm font-medium">
                数量 <span className="text-life-alert">*</span>
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(event) => {
                  updateField('quantity', Number(event.target.value || 0));
                  setErrors((current) => ({ ...current, quantity: undefined }));
                }}
                aria-invalid={Boolean(errors.quantity)}
                className={cn(
                  'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                  errors.quantity ? 'border-destructive' : 'border-border',
                )}
              />
              {errors.quantity ? (
                <p className="text-xs text-destructive">{errors.quantity}</p>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">单位</span>
              <input
                value={form.unit}
                onChange={(event) => updateField('unit', event.target.value)}
                placeholder="件"
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">开封</span>
              <input
                type="date"
                value={form.openedAt || ''}
                onChange={(event) => updateField('openedAt', event.target.value)}
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">过期日期</span>
            <input
              type="date"
              value={form.expiresAt || ''}
              onChange={(event) => updateField('expiresAt', event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>

          <AppImageUploader
            value={form.imageUrl}
            onChange={(url) => updateField('imageUrl', url)}
            onUploadingChange={setImageUploading}
            cameraAndLibrary
            label="真实图片"
            description="给这件库存留一张更好辨认的照片。"
          />

          <div className="space-y-3 rounded-[1.25rem] border border-border bg-secondary/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">AI 缩略图</p>
                <p className="mt-1 text-xs text-muted-foreground">补一张更整洁的封面图。</p>
              </div>
              {form.thumbnailUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => updateField('thumbnailUrl', '')}
                >
                  <Trash2 className="size-4" />
                  清除
                </Button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={thumbnailGenerating || imageUploading || submitting}
                onClick={() => void handleGenerateThumbnail()}
              >
                <Sparkles className="size-4" />
                {thumbnailGenerating ? '生成中...' : '生成缩略图'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!form.imageUrl || thumbnailGenerating || submitting}
                onClick={() => updateField('thumbnailUrl', form.imageUrl || '')}
              >
                <Camera className="size-4" />
                用实拍图做封面
              </Button>
            </div>
            {effectiveCover ? (
              <div className="overflow-hidden rounded-[1.1rem] border border-border bg-card">
                <img
                  src={effectiveCover}
                  alt={form.name || '库存图片预览'}
                  className="aspect-video w-full object-cover"
                />
              </div>
            ) : null}
            {form.thumbnailUrl ? (
              <p className="text-xs text-muted-foreground">封面已准备好，保存后就会生效。</p>
            ) : null}
            {saveQueuedAfterThumbnail ? (
              <p className="text-xs text-life-trace">AI 缩略图生成中，完成后会自动继续保存。</p>
            ) : null}
            {thumbnailError ? <p className="text-xs text-destructive">{thumbnailError}</p> : null}
          </div>

          <div className="space-y-3 rounded-[1.25rem] border border-border bg-secondary/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">提醒设置</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  默认全部提醒，你也可以只给这件商品单独改。
                </p>
              </div>
              <Button
                type="button"
                variant={form.reminder.useDefault ? 'secondary' : 'outline'}
                size="sm"
                onClick={() =>
                  updateField('reminder', {
                    ...form.reminder,
                    useDefault: !form.reminder.useDefault,
                    enabled: !form.reminder.useDefault
                      ? pantryPreferences.defaultReminderEnabled
                      : form.reminder.enabled,
                  })
                }
              >
                {form.reminder.useDefault ? '使用默认' : '单独设置'}
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              当前：{reminderSummary}
              <span className="ml-2 text-xs">
                {form.reminder.useDefault
                  ? `${pantryPreferences.defaultReminderTime} 默认时间`
                  : `${form.reminder.reminderTime} 自定义`}
              </span>
            </div>
            {!form.reminder.useDefault ? (
              <>
                <div className="grid grid-cols-4 gap-2 max-[360px]:grid-cols-2">
                  {reminderRuleOptions.map((rule) => {
                    const active = form.reminder.rules.includes(rule);
                    return (
                      <button
                        key={rule}
                        type="button"
                        className={cn(
                          'h-10 rounded-2xl border px-2 text-sm font-semibold transition',
                          active
                            ? 'border-life-health/45 bg-life-health/10 text-life-health'
                            : 'border-border bg-card text-muted-foreground',
                        )}
                        onClick={() =>
                          updateField('reminder', {
                            ...form.reminder,
                            enabled: true,
                            rules: active
                              ? form.reminder.rules.filter((item) => item !== rule)
                              : [...form.reminder.rules, rule],
                          })
                        }
                      >
                        {rule === '7d'
                          ? '7 天前'
                          : rule === '3d'
                            ? '3 天前'
                            : rule === 'same-day'
                              ? '当天'
                              : '过期后'}
                      </button>
                    );
                  })}
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">提醒时间</span>
                  <input
                    type="time"
                    value={form.reminder.reminderTime}
                    onChange={(event) =>
                      updateField('reminder', {
                        ...form.reminder,
                        reminderTime: event.target.value,
                      })
                    }
                    className="h-11 w-full rounded-2xl border border-border bg-card px-4 text-sm outline-none transition focus:border-ring"
                  />
                </label>
              </>
            ) : null}
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium">备注</span>
            <textarea
              value={form.note}
              onChange={(event) => updateField('note', event.target.value)}
              rows={3}
              placeholder="例如：周末早餐要先喝掉。"
              className="w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring"
            />
          </label>

          <div
            className={cn(
              'flex gap-2',
              editing
                ? 'items-stretch justify-between max-[360px]:flex-col'
                : 'items-center justify-end',
            )}
          >
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={submitting || deleting}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                删除库存
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={submitting || deleting}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="ai"
              disabled={imageUploading || submitting || deleting || saveQueuedAfterThumbnail}
            >
              {submitting
                ? '保存中...'
                : saveQueuedAfterThumbnail
                  ? '生成后自动保存...'
                  : editing
                    ? '保存库存'
                    : '添加库存'}
            </Button>
          </div>
        </form>
      </BottomSheet>
      <OptionPickerSheet<PantryCategory>
        open={activePicker === 'category'}
        title="选择分类"
        description="给这件商品归个类，后面会更方便筛选。"
        value={form.category}
        options={categoryPickerOptions}
        onOpenChange={(nextOpen) => setActivePicker(nextOpen ? 'category' : null)}
        onSelect={(value) => updateField('category', value)}
      />
      <OptionPickerSheet<PantryLocation>
        open={activePicker === 'location'}
        title="选择位置"
        description="告诉 Life Trace 这件东西平时放在哪。"
        value={form.location}
        options={locationPickerOptions}
        onOpenChange={(nextOpen) => setActivePicker(nextOpen ? 'location' : null)}
        onSelect={(value) => updateField('location', value)}
      />
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="删除这条库存？"
        description={
          item
            ? `删除后「${item.name}」会立刻从当前空间消失，这次不会保留回退。`
            : '删除后这条库存会立刻从当前空间消失。'
        }
        confirmLabel="确认删除"
        loadingLabel="删除中"
        loading={deleting}
        onCancel={() => {
          if (!deleting) {
            setDeleteConfirmOpen(false);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
