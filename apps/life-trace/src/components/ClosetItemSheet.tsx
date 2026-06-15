import { Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ClothingPhotoAnalysisResponse } from '@/api/closet';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { FormItem, SheetHeader, SheetSelectField } from '@/components/FormItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type {
  ClosetCareMethod,
  ClosetCategory,
  ClosetItem,
  ClosetPreferenceLevel,
  ClosetSeason,
  ClosetWarmthLevel,
  NewClosetItemInput,
} from '@/types';

export const closetCategoryOptions: ClosetCategory[] = [
  '上装',
  '下装',
  '外套',
  '鞋履',
  '配饰',
  '包袋',
  '套装',
  '其他',
];

export const closetWarmthOptions: ClosetWarmthLevel[] = ['轻薄', '常规', '保暖', '厚重'];
export const closetSeasonOptions: ClosetSeason[] = ['春', '夏', '秋', '冬', '四季'];
export const closetCareMethodOptions: ClosetCareMethod[] = ['机洗', '手洗', '干洗', '通风'];
export const closetPreferenceLevelOptions: ClosetPreferenceLevel[] = [
  'neutral',
  'favorite',
  'avoid',
];
const closetCategorySelectOptions = closetCategoryOptions.map((option) => ({
  label: option,
  value: option,
}));
const closetWarmthSelectOptions = closetWarmthOptions.map((option) => ({
  label: option,
  value: option,
}));
const closetCareMethodSelectOptions = closetCareMethodOptions.map((option) => ({
  label: option,
  value: option,
}));
const closetPreferenceSelectOptions = [
  { label: '正常', value: 'neutral' },
  { label: '常穿', value: 'favorite' },
  { label: '少穿', value: 'avoid' },
] as const;
export const defaultClosetItemForm: NewClosetItemInput = {
  name: '',
  category: '上装',
  color: '未标注',
  material: '',
  warmthLevel: '常规',
  seasons: ['四季'],
  sceneTags: ['日常'],
  status: 'active',
  imageUrl: '',
  shared: false,
  note: '',
  careMethod: '机洗',
  careIntervalWears: 3,
  lastCareDate: '',
  preferenceLevel: 'neutral',
};

type ClosetDraftField = keyof NewClosetItemInput;

type ClosetItemSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: ClosetItem | null;
  initialValue?: Partial<NewClosetItemInput>;
  sharedAvailable?: boolean;
  submitting?: boolean;
  analyzing?: boolean;
  onAnalyzeImage?: (imageUrl: string) => Promise<Partial<NewClosetItemInput> | null>;
  onSubmit: (input: NewClosetItemInput) => Promise<void> | void;
};

function isDefaultClosetFieldValue<K extends ClosetDraftField>(
  key: K,
  value: NewClosetItemInput[K],
) {
  const defaultValue = defaultClosetItemForm[key];
  if (Array.isArray(defaultValue) && Array.isArray(value)) {
    return (
      defaultValue.length === value.length &&
      defaultValue.every((item, index) => item === value[index])
    );
  }
  return value === defaultValue;
}

export function mergeClosetAnalysisDraft(
  current: NewClosetItemInput,
  draft: Partial<NewClosetItemInput>,
  touchedFields: ReadonlySet<ClosetDraftField> = new Set(),
): NewClosetItemInput {
  const next = { ...current };
  (Object.keys(draft) as ClosetDraftField[]).forEach((key) => {
    const value = draft[key];
    if (
      value === undefined ||
      touchedFields.has(key) ||
      !isDefaultClosetFieldValue(key, current[key])
    ) {
      return;
    }
    next[key] = value as never;
  });
  return next;
}

export function clothingAnalysisToClosetDraft(
  analysis: ClothingPhotoAnalysisResponse,
  imageUrl: string,
  shared: boolean,
): NewClosetItemInput {
  return {
    ...defaultClosetItemForm,
    name: analysis.name,
    category: analysis.category,
    color: analysis.color,
    material: analysis.material || '',
    warmthLevel: analysis.warmthLevel,
    seasons: analysis.seasons.length ? analysis.seasons : ['四季'],
    sceneTags: analysis.sceneTags.length ? analysis.sceneTags : ['日常'],
    imageUrl,
    shared,
    note: analysis.summary,
  };
}

function toggleListValue<T extends string>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function parseSceneTags(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[，,、\s]+/)
    .map((item) => item.trim())
    .filter((item) => {
      if (!item || seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    })
    .slice(0, 6);
}

export function ClosetItemSheet({
  open,
  onOpenChange,
  item,
  initialValue,
  sharedAvailable = false,
  submitting = false,
  analyzing = false,
  onAnalyzeImage,
  onSubmit,
}: ClosetItemSheetProps) {
  const [form, setForm] = useState<NewClosetItemInput>(defaultClosetItemForm);
  const [sceneText, setSceneText] = useState('日常');
  const [error, setError] = useState('');
  const touchedFieldsRef = useRef<Set<ClosetDraftField>>(new Set());

  useEffect(() => {
    if (!open) {
      return;
    }
    const next: NewClosetItemInput = item
      ? {
          name: item.name,
          category: item.category,
          color: item.color || '未标注',
          material: item.material || '',
          warmthLevel: item.warmthLevel,
          seasons: item.seasons?.length ? item.seasons : (['四季'] satisfies ClosetSeason[]),
          sceneTags: item.sceneTags?.length ? item.sceneTags : ['日常'],
          status: item.status,
          imageUrl: item.imageUrl || '',
          shared: item.shared,
          note: item.note || '',
          careMethod: item.careMethod || '机洗',
          careIntervalWears: item.careIntervalWears || 3,
          lastCareDate: item.lastCareDate || '',
          preferenceLevel: item.preferenceLevel || 'neutral',
        }
      : { ...defaultClosetItemForm, ...initialValue };
    setForm(next);
    setSceneText((next.sceneTags || ['日常']).join('、'));
    touchedFieldsRef.current = new Set();
    setError('');
  }, [initialValue, item, open]);

  const update = <K extends keyof NewClosetItemInput>(key: K, value: NewClosetItemInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    touchedFieldsRef.current = new Set(touchedFieldsRef.current).add(key);
  };

  const handleAnalyzeImage = async () => {
    if (!onAnalyzeImage || !form.imageUrl || analyzing) {
      return;
    }
    setError('');
    const draft = await onAnalyzeImage(form.imageUrl);
    if (!draft) {
      return;
    }
    setForm((current) => {
      const next = mergeClosetAnalysisDraft(current, draft, touchedFieldsRef.current);
      setSceneText((next.sceneTags || ['日常']).join('、'));
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError('请输入衣物名称');
      return;
    }
    const sceneTags = parseSceneTags(sceneText);
    await onSubmit({
      ...form,
      name,
      color: form.color.trim() || '未标注',
      material: form.material?.trim() || '',
      imageUrl: form.imageUrl?.trim() || '',
      note: form.note.trim(),
      seasons: form.seasons.length ? form.seasons : ['四季'],
      sceneTags: sceneTags.length ? sceneTags : ['日常'],
      shared: sharedAvailable ? form.shared : false,
      careIntervalWears: Math.max(0, Math.min(30, Number(form.careIntervalWears) || 0)),
      lastCareDate: form.lastCareDate?.trim() || '',
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭衣物编辑"
      contentClassName="space-y-5 pb-6"
      portal
    >
      <SheetHeader
        title={item ? '编辑衣物' : '添加衣物'}
        description="衣物信息"
        closeDisabled={submitting}
        onClose={() => onOpenChange(false)}
        className="mb-0"
      />
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormItem label="名称" error={error}>
          <Input
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="蓝色衬衫"
          />
        </FormItem>

        <AppImageUploader
          value={form.imageUrl}
          onChange={(url) => update('imageUrl', url)}
          label="衣物照片"
          description="支持拍照或从相册选择。"
          cameraAndLibrary
          disabled={submitting || analyzing}
          previewFit="contain"
        />
        {!item && onAnalyzeImage && form.imageUrl ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={analyzing || submitting}
            onClick={() => void handleAnalyzeImage()}
          >
            {analyzing ? <ActionLoadingIcon tone="ai" /> : <Sparkles className="size-4" />}
            {analyzing ? '识别中' : 'AI 识别填表'}
          </Button>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <SheetSelectField
            label="品类"
            value={form.category}
            options={closetCategorySelectOptions}
            onValueChange={(value) => update('category', value)}
          />
          <SheetSelectField
            label="厚薄"
            value={form.warmthLevel}
            options={closetWarmthSelectOptions}
            onValueChange={(value) => update('warmthLevel', value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormItem label="颜色">
            <Input value={form.color} onChange={(event) => update('color', event.target.value)} />
          </FormItem>
          <FormItem label="材质">
            <Input
              value={form.material}
              onChange={(event) => update('material', event.target.value)}
              placeholder="棉 / 羊毛"
            />
          </FormItem>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">季节</span>
          <div className="grid grid-cols-5 gap-2">
            {closetSeasonOptions.map((option) => {
              const active = form.seasons.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    'h-10 rounded-xl border text-sm font-semibold transition',
                    active
                      ? 'border-life-ai/40 bg-life-ai/10 text-life-ai'
                      : 'border-border bg-secondary text-muted-foreground',
                  )}
                  onClick={() => update('seasons', toggleListValue(form.seasons, option))}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <FormItem label="场景标签">
          <Input
            value={sceneText}
            onChange={(event) => {
              setSceneText(event.target.value);
              touchedFieldsRef.current = new Set(touchedFieldsRef.current).add('sceneTags');
            }}
            placeholder="通勤、雨天、聚会"
          />
        </FormItem>

        <div className="grid grid-cols-2 gap-3">
          <SheetSelectField
            label="洗护方式"
            value={form.careMethod || '机洗'}
            options={closetCareMethodSelectOptions}
            onValueChange={(value) => update('careMethod', value as ClosetCareMethod)}
          />
          <FormItem label="建议几次一洗">
            <Input
              type="number"
              min={0}
              max={30}
              value={String(form.careIntervalWears ?? 0)}
              onChange={(event) => update('careIntervalWears', Number(event.target.value) || 0)}
              placeholder="3"
            />
          </FormItem>
        </div>

        <SheetSelectField
          label="穿搭偏好"
          value={form.preferenceLevel || 'neutral'}
          options={closetPreferenceSelectOptions}
          onValueChange={(value) => update('preferenceLevel', value as ClosetPreferenceLevel)}
        />

        <FormItem label="上次洗护">
          <Input
            type="date"
            value={form.lastCareDate || ''}
            onChange={(event) => update('lastCareDate', event.target.value)}
          />
        </FormItem>

        {sharedAvailable ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/50 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">共享衣物池</span>
              <span className="mt-1 block text-xs text-muted-foreground">家庭成员可见</span>
            </span>
            <Switch
              size="sm"
              checked={form.shared}
              onCheckedChange={(checked) => update('shared', checked)}
            />
          </div>
        ) : null}

        <FormItem label="备注">
          <Textarea
            value={form.note}
            onChange={(event) => update('note', event.target.value)}
            placeholder="适合什么天气、搭配或护理提醒"
          />
        </FormItem>

        <Button type="submit" variant="ai" className="w-full" disabled={submitting}>
          {submitting ? '保存中' : item ? '保存修改' : '保存衣物'}
        </Button>
      </form>
    </BottomSheet>
  );
}
