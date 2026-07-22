import { ArrowRightLeft, Camera, PackageCheck, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzePantryPhoto,
  generatePantryDescription,
  generatePantryThumbnail,
} from '@/api/pantry';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AIModelPicker } from '@/components/AIModelPicker';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormItem, PickerFieldButton, SheetHeader } from '@/components/FormItem';
import { ImagePreview } from '@/components/ImagePreview';
import { OptionPickerSheet } from '@/components/OptionPickerSheet';
import { PantryAiSuggestionsSheet } from '@/components/PantryAiSuggestionsSheet';
import { DateInputWithClear, PantryExpiryDateField } from '@/components/PantryExpiryDateField';
import { TonePanel } from '@/components/TonePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getLifeTraceErrorMessage } from '@/lib/error';
import {
  applyPantryAiFieldSuggestions,
  buildPantryAiFieldDiff,
  formatPantryReminderSummary,
  getPantryPersistedStatus,
  type PantryAiFieldKey,
  type PantryAiFieldSuggestion,
  validatePantryShelfLife,
} from '@/lib/pantry';
import { formatPantryTagText, parsePantryTagText } from '@/lib/pantryTags';
import {
  generatePantryTransparentCoverWithFallback,
  getPantryTransparentCoverTechLabel,
} from '@/lib/pantryTransparentCover';
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
  tags: [],
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
  onDeleted?: (message: string) => void;
  showTransferAction?: boolean;
  onRequestTransfer?: (item: PantryItem) => void;
};

type PantryFormErrors = Partial<Record<'name' | 'quantity', string>>;

export function PantryItemDrawer({
  open,
  onOpenChange,
  item,
  householdId,
  householdName,
  onSaved,
  onDeleted,
  showTransferAction = false,
  onRequestTransfer,
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
  const [transparentCoverTechLabel, setTransparentCoverTechLabel] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveQueuedAfterThumbnail, setSaveQueuedAfterThumbnail] = useState(false);
  const [tagText, setTagText] = useState('');
  const [activePicker, setActivePicker] = useState<'category' | 'location' | null>(null);
  const [expiryFieldResetKey, setExpiryFieldResetKey] = useState(0);
  const [aiAugmentLoading, setAiAugmentLoading] = useState(false);
  const [aiAugmentError, setAiAugmentError] = useState('');
  const [aiAugmentModelTag, setAiAugmentModelTag] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<PantryAiFieldSuggestion[]>([]);
  const [aiSuggestionsOpen, setAiSuggestionsOpen] = useState(false);
  const [aiPolishLoading, setAiPolishLoading] = useState(false);
  const [aiPolishError, setAiPolishError] = useState('');
  const [aiPolishTips, setAiPolishTips] = useState<string[]>([]);
  const [aiPolishModelTag, setAiPolishModelTag] = useState('');
  const [aiPolishModelId, setAiPolishModelId] = useState('');
  const queuedPayloadRef = useRef<NewPantryItemInput | null>(null);
  const editing = Boolean(item);

  const resetNewItemDraft = useCallback(() => {
    setForm(defaultPantryForm(pantryPreferences));
    setTagText('');
    setErrors({});
    setSubmitting(false);
    setDeleteConfirmOpen(false);
    setDeleting(false);
    setThumbnailGenerating(false);
    setThumbnailError('');
    setTransparentCoverTechLabel('');
    setSaveQueuedAfterThumbnail(false);
    queuedPayloadRef.current = null;
    setActivePicker(null);
    setExpiryFieldResetKey((current) => current + 1);
    setAiAugmentLoading(false);
    setAiAugmentError('');
    setAiAugmentModelTag('');
    setAiSuggestions([]);
    setAiSuggestionsOpen(false);
    setAiPolishLoading(false);
    setAiPolishError('');
    setAiPolishTips([]);
    setAiPolishModelTag('');
    setAiPolishModelId('');
  }, [pantryPreferences]);

  useEffect(() => {
    if (!open) {
      if (!item) {
        resetNewItemDraft();
      }
      return;
    }

    if (item) {
      setForm({
        ...item,
        tags: item.tags ?? [],
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
      setTagText(formatPantryTagText(item.tags));
      setExpiryFieldResetKey((current) => current + 1);
    } else {
      resetNewItemDraft();
    }
    setErrors({});
    setSubmitting(false);
    setDeleteConfirmOpen(false);
    setDeleting(false);
    setThumbnailGenerating(false);
    setThumbnailError('');
    setTransparentCoverTechLabel('');
    setSaveQueuedAfterThumbnail(false);
    queuedPayloadRef.current = null;
    setActivePicker(null);
    setAiAugmentLoading(false);
    setAiAugmentError('');
    setAiAugmentModelTag('');
    setAiSuggestions([]);
    setAiSuggestionsOpen(false);
    setAiPolishLoading(false);
    setAiPolishError('');
    setAiPolishTips([]);
    setAiPolishModelTag('');
  }, [item, open, pantryPreferences, resetNewItemDraft]);

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

  const shelfLifeWarning = useMemo(
    () =>
      validatePantryShelfLife({
        name: form.name,
        category: form.category,
        expiresAt: form.expiresAt ?? '',
      }),
    [form.name, form.category, form.expiresAt],
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

    const expiresAt = form.expiresAt || '';
    const reminder = expiresAt
      ? form.reminder.useDefault
        ? {
            enabled: pantryPreferences.defaultReminderEnabled,
            useDefault: true,
            rules: pantryPreferences.defaultReminderRules,
            reminderTime: pantryPreferences.defaultReminderTime,
          }
        : form.reminder
      : {
          ...form.reminder,
          enabled: false,
        };

    return {
      ...form,
      name: form.name.trim(),
      unit: form.unit.trim() || '件',
      tags: parsePantryTagText(tagText),
      expiresAt: expiresAt || undefined,
      openedAt: form.openedAt || undefined,
      imageUrl: form.imageUrl?.trim() || undefined,
      thumbnailUrl: form.thumbnailUrl?.trim() || undefined,
      note: form.note.trim(),
      reminder,
      status: getPantryPersistedStatus(form.status),
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
          if (!item) {
            resetNewItemDraft();
          }
          onOpenChange(false);
          onSaved?.(`${editing ? '已更新' : '已保存'}「${saved.name}」库存`);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [
      addPantryItem,
      editPantryItem,
      editing,
      householdId,
      item,
      onOpenChange,
      onSaved,
      resetNewItemDraft,
    ],
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
    setTransparentCoverTechLabel('');
    try {
      const result = await generatePantryThumbnail(token, {
        name: form.name.trim() || undefined,
        category: form.category,
        location: form.location,
        note: form.note.trim() || undefined,
      });
      updateField('thumbnailUrl', result.thumbnailUrl);
    } catch (error) {
      setThumbnailError(getLifeTraceErrorMessage(error, 'AI 缩略图生成失败，请稍后再试。'));
    } finally {
      setThumbnailGenerating(false);
    }
  };

  const handleGenerateTransparentCover = async () => {
    if (!token) {
      setThumbnailError('请先登录后再生成透明封面。');
      return;
    }
    if (!form.imageUrl) {
      setThumbnailError('请先添加真实图片。');
      return;
    }
    if (thumbnailGenerating) {
      return;
    }

    setThumbnailGenerating(true);
    setThumbnailError('');
    setTransparentCoverTechLabel('');
    try {
      const result = await generatePantryTransparentCoverWithFallback(token, {
        imageUrl: form.imageUrl,
      });
      updateField('thumbnailUrl', result.thumbnailUrl);
      setTransparentCoverTechLabel(getPantryTransparentCoverTechLabel(result));
    } catch (error) {
      setThumbnailError(getLifeTraceErrorMessage(error, '透明封面生成失败，请稍后再试。'));
    } finally {
      setThumbnailGenerating(false);
    }
  };

  const handleAugmentFromAI = async () => {
    if (!token) {
      setAiAugmentError('请先登录后再使用 AI 字段补全。');
      setAiSuggestionsOpen(true);
      return;
    }
    if (aiAugmentLoading) {
      return;
    }
    const imageInput = form.imageUrl?.trim() || form.thumbnailUrl?.trim();
    if (!imageInput) {
      setAiAugmentError('请先添加封面图，AI 才能识别商品信息。');
      setAiSuggestionsOpen(true);
      return;
    }

    setAiAugmentLoading(true);
    setAiAugmentError('');
    setAiSuggestions([]);
    setAiSuggestionsOpen(true);
    try {
      const result = await analyzePantryPhoto(token, {
        imageUrl: imageInput,
        householdId,
        hint: form.name.trim() || undefined,
      });
      const formForDiff: NewPantryItemInput = {
        ...form,
        tags: parsePantryTagText(tagText),
      };
      const suggestions = buildPantryAiFieldDiff(formForDiff, result);
      setAiSuggestions(suggestions);
      setAiAugmentModelTag(result.modelTag || '');
    } catch (error) {
      setAiAugmentError(getLifeTraceErrorMessage(error, 'AI 字段补全失败，请稍后再试。'));
    } finally {
      setAiAugmentLoading(false);
    }
  };

  const handleApplyAiSuggestions = (selectedKeys: ReadonlySet<PantryAiFieldKey>) => {
    if (selectedKeys.size === 0) {
      setAiSuggestionsOpen(false);
      return;
    }
    const formForApply: NewPantryItemInput = {
      ...form,
      tags: parsePantryTagText(tagText),
    };
    const next = applyPantryAiFieldSuggestions(formForApply, aiSuggestions, selectedKeys);
    setForm(next);
    setTagText(formatPantryTagText(next.tags ?? []));
    if (selectedKeys.has('expiresAt') || selectedKeys.has('openedAt')) {
      setExpiryFieldResetKey((current) => current + 1);
    }
    setErrors({});
    setAiSuggestionsOpen(false);
  };

  const handlePolishDescription = async () => {
    if (!token) {
      setAiPolishError('请先登录后再润色备注。');
      return;
    }
    if (!form.name.trim()) {
      setAiPolishError('请先填写名称，AI 才能给出建议。');
      return;
    }
    if (!aiPolishModelId) {
      setAiPolishError('请先选择用于润色的文本模型。');
      return;
    }
    if (aiPolishLoading) {
      return;
    }

    setAiPolishLoading(true);
    setAiPolishError('');
    setAiPolishTips([]);
    try {
      const result = await generatePantryDescription(token, {
        modelId: aiPolishModelId,
        name: form.name.trim(),
        category: form.category,
        location: form.location,
        expiresAt: form.expiresAt || undefined,
        openedAt: form.openedAt || undefined,
        tags: parsePantryTagText(tagText),
        note: form.note.trim() || undefined,
      });
      updateField('note', result.note);
      setAiPolishTips(result.tips ?? []);
      setAiPolishModelTag(result.modelTag || '');
    } catch (error) {
      setAiPolishError(getLifeTraceErrorMessage(error, 'AI 润色失败，请稍后再试。'));
    } finally {
      setAiPolishLoading(false);
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
    const message = `已删除「${item.name}」库存`;
    if (onDeleted) {
      onDeleted(message);
    } else {
      onSaved?.(message);
    }
  };

  const clearNewItemDraft = resetNewItemDraft;

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

  const aiThumbnailPreview = form.thumbnailUrl?.trim();

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        overlayLabel="关闭库存编辑"
        zIndexClassName="z-50"
      >
        <SheetHeader
          title={editing ? '编辑库存' : '添加库存'}
          description="给家里的商品留一张图，再决定何时提醒你处理。"
          meta={householdName ? `保存到：${householdName}` : undefined}
          onClose={() => onOpenChange(false)}
        />

        <form className="min-w-0 space-y-4" onSubmit={handleSubmit}>
          <FormItem label="名称" required error={errors.name}>
            <Input
              value={form.name}
              onChange={(event) => {
                updateField('name', event.target.value);
                setErrors((current) => ({ ...current, name: undefined }));
              }}
              placeholder="例如：低温鲜奶"
              aria-invalid={Boolean(errors.name)}
            />
          </FormItem>

          <div className="grid min-w-0 grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <FormItem label="分类">
              <PickerFieldButton disabled={submitting} onClick={() => setActivePicker('category')}>
                {form.category}
              </PickerFieldButton>
            </FormItem>
            <FormItem label="位置">
              <PickerFieldButton disabled={submitting} onClick={() => setActivePicker('location')}>
                {form.location}
              </PickerFieldButton>
            </FormItem>
          </div>

          <FormItem label="标签">
            <Input
              value={tagText}
              onChange={(event) => setTagText(event.target.value)}
              placeholder="例如：冷冻、零食"
            />
          </FormItem>

          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_7.5rem] gap-3 max-[360px]:grid-cols-1">
            <FormItem label="数量" required error={errors.quantity}>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(event) => {
                  updateField('quantity', Number(event.target.value || 0));
                  setErrors((current) => ({ ...current, quantity: undefined }));
                }}
                aria-invalid={Boolean(errors.quantity)}
              />
            </FormItem>
            <FormItem label="单位">
              <Input
                value={form.unit}
                onChange={(event) => updateField('unit', event.target.value)}
                placeholder="件"
              />
            </FormItem>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3">
            <FormItem label="开封日期">
              <DateInputWithClear
                id="pantry-item-opened-at"
                value={form.openedAt || ''}
                disabled={submitting}
                clearLabel="清空开封日期"
                onChange={(value) => updateField('openedAt', value)}
              />
            </FormItem>
            <PantryExpiryDateField
              key={expiryFieldResetKey}
              idPrefix="pantry-item"
              expiresAt={form.expiresAt || ''}
              disabled={submitting}
              warning={shelfLifeWarning}
              onExpiresAtChange={(value) => updateField('expiresAt', value)}
            />
          </div>

          <AppImageUploader
            value={form.imageUrl}
            onChange={(url) => updateField('imageUrl', url)}
            onUploadingChange={setImageUploading}
            cameraAndLibrary
            label="真实图片"
            description="给这件库存留一张更好辨认的照片。"
            previewFit="contain"
          />

          <TonePanel
            tone="ai"
            icon={Wand2}
            title="AI 字段补全"
            description="读取封面图与名称，补齐分类、规格、保质期等空白字段。"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                aiAugmentLoading ||
                imageUploading ||
                thumbnailGenerating ||
                submitting ||
                (!form.imageUrl?.trim() && !form.thumbnailUrl?.trim())
              }
              onClick={() => void handleAugmentFromAI()}
            >
              {aiAugmentLoading ? (
                <ActionLoadingIcon className="size-4" tone="ai" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {aiAugmentLoading ? '识别中...' : '一键 AI 补全'}
            </Button>
            {!form.imageUrl?.trim() && !form.thumbnailUrl?.trim() ? (
              <p className="text-xs text-muted-foreground">添加一张实拍图后即可启用。</p>
            ) : null}
          </TonePanel>

          <TonePanel
            tone="ai"
            icon={Sparkles}
            title="封面图"
            description="补一张更整洁的商品封面。"
            action={
              form.thumbnailUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    updateField('thumbnailUrl', '');
                    setTransparentCoverTechLabel('');
                  }}
                >
                  <Trash2 className="size-4" />
                  清除
                </Button>
              ) : null
            }
          >
            <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!form.imageUrl || thumbnailGenerating || imageUploading || submitting}
                onClick={() => void handleGenerateTransparentCover()}
              >
                {thumbnailGenerating ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {thumbnailGenerating ? '生成中...' : '生成透明封面'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={thumbnailGenerating || imageUploading || submitting}
                onClick={() => void handleGenerateThumbnail()}
              >
                {thumbnailGenerating ? (
                  <ActionLoadingIcon className="size-4" tone="ai" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {thumbnailGenerating ? '生成中...' : '生成缩略图'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!form.imageUrl || thumbnailGenerating || submitting}
                onClick={() => {
                  updateField('thumbnailUrl', form.imageUrl || '');
                  setTransparentCoverTechLabel('');
                }}
              >
                <Camera className="size-4" />
                用实拍图做封面
              </Button>
            </div>
            {aiThumbnailPreview ? (
              <div className="overflow-hidden rounded-[1.1rem] border border-border bg-card bg-[linear-gradient(45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.08)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,0.08)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,0.08)_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0px]">
                <ImagePreview
                  src={aiThumbnailPreview}
                  alt={form.name || '库存图片预览'}
                  title={form.name || '库存图片预览'}
                  subtitle="封面图"
                  imageClassName="aspect-video w-full object-contain"
                />
              </div>
            ) : null}
            {form.thumbnailUrl ? (
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>封面已准备好，保存后就会生效。</span>
                {transparentCoverTechLabel ? (
                  <span className="rounded-full border border-life-health/30 bg-life-health/10 px-2 py-0.5 text-[10px] font-semibold text-life-health">
                    {transparentCoverTechLabel}
                  </span>
                ) : null}
              </p>
            ) : null}
            {saveQueuedAfterThumbnail ? (
              <p className="text-xs text-life-trace">封面生成中，完成后会自动继续保存。</p>
            ) : null}
            {thumbnailError ? <p className="text-xs text-destructive">{thumbnailError}</p> : null}
          </TonePanel>

          <TonePanel
            tone="plan"
            icon={PackageCheck}
            title="仍在使用"
            description="开启后这件商品退出风险列表，不再推送过期提醒。"
            action={
              <Switch
                size="sm"
                checked={form.status === 'kept'}
                onCheckedChange={(checked) => updateField('status', checked ? 'kept' : 'normal')}
              />
            }
          />

          <TonePanel
            tone="health"
            icon={ArrowRightLeft}
            title="提醒设置"
            description="默认全部提醒，你也可以只给这件商品单独改。"
            action={
              <div
                className={cn(
                  'flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold',
                  form.reminder.useDefault
                    ? 'border-border bg-secondary text-secondary-foreground'
                    : 'border-border text-muted-foreground',
                )}
              >
                <span>{form.reminder.useDefault ? '使用默认' : '单独设置'}</span>
                <Switch
                  size="sm"
                  checked={form.reminder.useDefault}
                  onCheckedChange={(checked) =>
                    updateField('reminder', {
                      ...form.reminder,
                      useDefault: checked,
                      enabled: checked
                        ? pantryPreferences.defaultReminderEnabled
                        : form.reminder.enabled,
                    })
                  }
                />
              </div>
            }
          >
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
                <FormItem label="提醒时间">
                  <Input
                    type="time"
                    value={form.reminder.reminderTime}
                    onChange={(event) =>
                      updateField('reminder', {
                        ...form.reminder,
                        reminderTime: event.target.value,
                      })
                    }
                    className="bg-card"
                  />
                </FormItem>
              </>
            ) : null}
          </TonePanel>

          <FormItem label="备注">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  写下储存或食用提示，AI 也能帮你润色一版。
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={aiPolishLoading || submitting || !form.name.trim()}
                  onClick={() => void handlePolishDescription()}
                >
                  {aiPolishLoading ? (
                    <ActionLoadingIcon className="size-4" tone="ai" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {aiPolishLoading ? '润色中...' : 'AI 润色'}
                </Button>
              </div>
              <Textarea
                value={form.note}
                onChange={(event) => updateField('note', event.target.value)}
                rows={3}
                placeholder="例如：周末早餐要先喝掉。"
              />
              <AIModelPicker
                token={token || undefined}
                capability="text"
                value={aiPolishModelId}
                onValueChange={setAiPolishModelId}
                disabled={aiPolishLoading || submitting}
                compact
              />
              {aiPolishTips.length > 0 ? (
                <div className="rounded-2xl border border-life-ai/30 bg-life-ai/5 px-3 py-2 text-xs text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-life-ai">
                    <Sparkles className="size-3.5" />
                    储存与食用建议
                    {aiPolishModelTag ? (
                      <span className="rounded-full bg-life-ai/10 px-2 py-0.5 text-[10px] font-medium text-life-ai">
                        {aiPolishModelTag}
                      </span>
                    ) : null}
                  </div>
                  <ul className="space-y-1 pl-4 text-[12px] leading-5 marker:text-life-ai/60 list-disc">
                    {aiPolishTips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aiPolishError ? <p className="text-xs text-destructive">{aiPolishError}</p> : null}
            </div>
          </FormItem>

          {editing && showTransferAction && item && onRequestTransfer ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={imageUploading || submitting || deleting}
              onClick={() => {
                onOpenChange(false);
                onRequestTransfer(item);
              }}
            >
              <ArrowRightLeft className="size-4" />
              转移到共享家庭
            </Button>
          ) : null}

          <div
            className={cn(
              'flex gap-2',
              editing
                ? 'items-stretch justify-between max-[360px]:flex-col'
                : 'items-stretch justify-between max-[360px]:flex-col',
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
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="text-life-alert hover:bg-life-alert/10 hover:text-life-alert"
                disabled={imageUploading || submitting || thumbnailGenerating}
                onClick={clearNewItemDraft}
              >
                <Trash2 className="size-4" />
                清空内容
              </Button>
            )}
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
              {submitting || saveQueuedAfterThumbnail ? (
                <ActionLoadingIcon className="size-4" tone="ai" />
              ) : null}
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
      <PantryAiSuggestionsSheet
        open={aiSuggestionsOpen}
        loading={aiAugmentLoading}
        errorMessage={aiAugmentError}
        modelTag={aiAugmentModelTag}
        suggestions={aiSuggestions}
        onOpenChange={setAiSuggestionsOpen}
        onApply={handleApplyAiSuggestions}
        onRetry={() => void handleAugmentFromAI()}
      />
    </>
  );
}
