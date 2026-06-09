import { Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ClothingPhotoAnalysisResponse } from '@/api/closet';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  ClosetCategory,
  ClosetItem,
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
      <div>
        <p className="text-2xl font-semibold tracking-normal">{item ? '编辑衣物' : '添加衣物'}</p>
        <p className="mt-2 text-sm text-muted-foreground">衣物信息</p>
      </div>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className="text-sm font-medium">名称</span>
          <input
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-life-ai/50"
            placeholder="蓝色衬衫"
          />
        </label>

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
          <label className="block space-y-2">
            <span className="text-sm font-medium">品类</span>
            <select
              value={form.category}
              onChange={(event) => update('category', event.target.value as ClosetCategory)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none focus:border-life-ai/50"
            >
              {closetCategoryOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">厚薄</span>
            <select
              value={form.warmthLevel}
              onChange={(event) => update('warmthLevel', event.target.value as ClosetWarmthLevel)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none focus:border-life-ai/50"
            >
              {closetWarmthOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium">颜色</span>
            <input
              value={form.color}
              onChange={(event) => update('color', event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-life-ai/50"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">材质</span>
            <input
              value={form.material}
              onChange={(event) => update('material', event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-life-ai/50"
              placeholder="棉 / 羊毛"
            />
          </label>
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

        <label className="block space-y-2">
          <span className="text-sm font-medium">场景标签</span>
          <input
            value={sceneText}
            onChange={(event) => {
              setSceneText(event.target.value);
              touchedFieldsRef.current = new Set(touchedFieldsRef.current).add('sceneTags');
            }}
            className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none focus:border-life-ai/50"
            placeholder="通勤、雨天、聚会"
          />
        </label>

        {sharedAvailable ? (
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/50 px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">共享衣物池</span>
              <span className="mt-1 block text-xs text-muted-foreground">家庭成员可见</span>
            </span>
            <input
              type="checkbox"
              checked={form.shared}
              onChange={(event) => update('shared', event.target.checked)}
              className="size-5 accent-life-ai"
            />
          </label>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm font-medium">备注</span>
          <textarea
            value={form.note}
            onChange={(event) => update('note', event.target.value)}
            className="min-h-24 w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-sm outline-none focus:border-life-ai/50"
            placeholder="适合什么天气、搭配或护理提醒"
          />
        </label>

        {error ? <p className="text-sm text-life-alert">{error}</p> : null}

        <Button type="submit" variant="ai" className="w-full" disabled={submitting}>
          {submitting ? '保存中' : item ? '保存修改' : '保存衣物'}
        </Button>
      </form>
    </BottomSheet>
  );
}
