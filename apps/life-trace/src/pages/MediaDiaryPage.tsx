import {
  BookOpen,
  Clapperboard,
  Disc3,
  Film,
  Headphones,
  Image,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createMediaDiaryEntry,
  deleteMediaDiaryEntry,
  type ListMediaDiaryOptions,
  listMediaDiaryEntries,
  suggestMediaDiaryEntry,
  updateMediaDiaryEntry,
} from '@/api/mediaDiary';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ImagePreview } from '@/components/ImagePreview';
import { LoadErrorState } from '@/components/LoadErrorState';
import { SubPageShell } from '@/components/SubPageShell';
import { SyncState } from '@/components/SyncState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type {
  ListPagination,
  MediaDiaryEntry,
  MediaDiaryStatus,
  MediaDiarySummary,
  MediaDiaryType,
  NewMediaDiaryEntryInput,
} from '@/types';

type MediaDiaryTypeFilter = MediaDiaryType | 'all';
type MediaDiaryStatusFilter = MediaDiaryStatus | 'all';
type MediaDiaryFormErrors = Partial<Record<'title', string>>;

const mediaDiaryTypes: Array<{ value: MediaDiaryType; label: string; icon: typeof BookOpen }> = [
  { value: '书籍', label: '书籍', icon: BookOpen },
  { value: '电影', label: '电影', icon: Film },
  { value: '剧集', label: '剧集', icon: Tv },
  { value: '动漫', label: '动漫', icon: Clapperboard },
  { value: '音乐', label: '音乐', icon: Headphones },
];

const mediaDiaryStatuses: MediaDiaryStatus[] = ['想看', '进行中', '已完成', '搁置'];

const defaultPagination: ListPagination = {
  page: 1,
  pageSize: 20,
  total: 0,
  hasMore: false,
};

const defaultSummary: MediaDiarySummary = {
  total: 0,
  completedMonth: 0,
  bestRating: 0,
};

const defaultForm: NewMediaDiaryEntryInput = {
  mediaType: '书籍',
  status: '想看',
  title: '',
  originalTitle: '',
  creator: '',
  releaseYear: undefined,
  coverUrl: '',
  rating: 0,
  startedAt: '',
  finishedAt: '',
  note: '',
  quote: '',
  tags: ['书影音', '书籍'],
  source: 'manual',
};

function mediaTypeIcon(type: MediaDiaryType) {
  return mediaDiaryTypes.find((item) => item.value === type)?.icon ?? BookOpen;
}

function getTypeTone(type: MediaDiaryType): 'ai' | 'plan' | 'trace' | 'health' | 'default' {
  if (type === '电影' || type === '剧集') {
    return 'plan';
  }
  if (type === '音乐') {
    return 'ai';
  }
  if (type === '动漫') {
    return 'health';
  }
  return 'trace';
}

function formatRating(rating: number) {
  if (!rating) {
    return '未评分';
  }
  return `${(rating / 2).toFixed(1)}`;
}

function formatEntryDate(entry: MediaDiaryEntry) {
  return entry.finishedAt || entry.startedAt || entry.updatedAt?.slice(0, 10) || '';
}

function parseTags(value: string) {
  return value
    .split(/[、,，\n]/)
    .map((tag) => tag.trim())
    .filter((tag, index, list) => tag.length > 0 && list.indexOf(tag) === index);
}

function stringifyTags(tags: string[]) {
  return tags.join('、');
}

function normalizeFormTags(type: MediaDiaryType, tagText: string) {
  const tags = parseTags(tagText);
  const nextTags = [type, ...tags, '书影音'].filter(
    (tag, index, list) => tag && list.indexOf(tag) === index,
  );
  return nextTags.length ? nextTags : [type, '书影音'];
}

function buildFormFromEntry(entry: MediaDiaryEntry): NewMediaDiaryEntryInput {
  return {
    mediaType: entry.mediaType,
    status: entry.status,
    title: entry.title,
    originalTitle: entry.originalTitle ?? '',
    creator: entry.creator ?? '',
    releaseYear: entry.releaseYear || undefined,
    coverUrl: entry.coverUrl ?? '',
    rating: entry.rating,
    startedAt: entry.startedAt ?? '',
    finishedAt: entry.finishedAt ?? '',
    note: entry.note,
    quote: entry.quote,
    tags: entry.tags.length ? entry.tags : [entry.mediaType, '书影音'],
    source: entry.source,
  };
}

function getEntryMeta(entry: MediaDiaryEntry) {
  return [entry.creator, entry.releaseYear ? String(entry.releaseYear) : '', entry.status]
    .filter(Boolean)
    .join(' · ');
}

function MediaDiaryCard({
  entry,
  onOpen,
  onEdit,
  onDelete,
}: {
  entry: MediaDiaryEntry;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = mediaTypeIcon(entry.mediaType);
  const typeTone = getTypeTone(entry.mediaType);
  const dateLabel = formatEntryDate(entry);

  return (
    <Card
      className="group overflow-hidden border-border/80 bg-card/88 transition hover:border-life-trace/35 hover:shadow-[0_20px_70px_rgba(16,185,129,0.10)]"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex gap-3 p-3">
        {entry.coverUrl ? (
          <ImagePreview
            src={entry.coverUrl}
            alt={entry.title}
            title={entry.title}
            subtitle={entry.mediaType}
            className="block h-28 w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-secondary text-left"
            imageClassName="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-28 w-20 shrink-0 place-items-center rounded-2xl border border-dashed border-border bg-secondary text-muted-foreground">
            <Image className="size-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={typeTone}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    {entry.mediaType}
                  </span>
                </Badge>
                <Badge tone={entry.status === '已完成' ? 'trace' : 'default'}>{entry.status}</Badge>
              </div>
              <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-snug">
                {entry.title}
              </h3>
              {getEntryMeta(entry) ? (
                <p className="mt-1 truncate text-xs text-muted-foreground">{getEntryMeta(entry)}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                <Star className="size-3.5 fill-life-plan text-life-plan" />
                {formatRating(entry.rating)}
              </p>
            </div>
          </div>
          {entry.note ? (
            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{entry.note}</p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {entry.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="max-w-[5.5rem] truncate rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {dateLabel ? (
                <span className="text-xs text-muted-foreground">{dateLabel}</span>
              ) : null}
              <button
                type="button"
                className="grid size-8 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label={`编辑 ${entry.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                aria-label={`删除 ${entry.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MediaDiaryDetail({
  entry,
  onEdit,
  onDelete,
}: {
  entry: MediaDiaryEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = mediaTypeIcon(entry.mediaType);
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-life-trace/20 bg-card">
        {entry.coverUrl ? (
          <ImagePreview
            src={entry.coverUrl}
            alt={entry.title}
            title={entry.title}
            subtitle={entry.mediaType}
            className="block w-full cursor-zoom-in overflow-hidden text-left"
            imageClassName="max-h-[24rem] w-full object-cover"
          />
        ) : null}
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={getTypeTone(entry.mediaType)}>
              <span className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5" />
                {entry.mediaType}
              </span>
            </Badge>
            <Badge tone={entry.status === '已完成' ? 'trace' : 'default'}>{entry.status}</Badge>
            <Badge tone="plan">
              <Star className="mr-1 size-3.5 fill-life-plan text-life-plan" />
              {formatRating(entry.rating)}
            </Badge>
          </div>
          <div>
            <h2 className="text-2xl font-semibold leading-tight">{entry.title}</h2>
            {entry.originalTitle ? (
              <p className="mt-2 text-sm text-muted-foreground">{entry.originalTitle}</p>
            ) : null}
          </div>
          {getEntryMeta(entry) ? (
            <p className="text-sm leading-6 text-muted-foreground">{getEntryMeta(entry)}</p>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground">开始</p>
          <p className="mt-2 text-sm font-semibold">{entry.startedAt || '未记录'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground">完成</p>
          <p className="mt-2 text-sm font-semibold">{entry.finishedAt || '未记录'}</p>
        </Card>
      </div>

      {entry.note ? (
        <Card className="p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">短评</p>
          <p className="text-sm leading-6">{entry.note}</p>
        </Card>
      ) : null}

      {entry.quote ? (
        <Card className="border-life-ai/20 bg-life-ai/5 p-4">
          <p className="mb-2 text-xs font-semibold text-life-ai">摘录</p>
          <p className="text-sm leading-6 text-foreground">{entry.quote}</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {entry.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil className="size-4" />
          编辑
        </Button>
        <Button
          type="button"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          删除
        </Button>
      </div>
    </div>
  );
}

function MediaDiaryEditor({
  open,
  entry,
  saving,
  suggesting,
  onOpenChange,
  onSubmit,
  onSuggest,
}: {
  open: boolean;
  entry: MediaDiaryEntry | null;
  saving: boolean;
  suggesting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: NewMediaDiaryEntryInput) => Promise<void>;
  onSuggest: (
    mediaType: MediaDiaryType,
    title: string,
  ) => Promise<Partial<NewMediaDiaryEntryInput> | null>;
}) {
  const [form, setForm] = useState<NewMediaDiaryEntryInput>(defaultForm);
  const [tagText, setTagText] = useState(stringifyTags(defaultForm.tags));
  const [errors, setErrors] = useState<MediaDiaryFormErrors>({});
  const [imageUploading, setImageUploading] = useState(false);
  const submitting = saving || suggesting || imageUploading;

  useEffect(() => {
    if (!open) {
      return;
    }
    const nextForm = entry ? buildFormFromEntry(entry) : defaultForm;
    setForm(nextForm);
    setTagText(stringifyTags(nextForm.tags));
    setErrors({});
  }, [entry, open]);

  const updateField = <K extends keyof NewMediaDiaryEntryInput>(
    key: K,
    value: NewMediaDiaryEntryInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSuggest = async () => {
    if (!form.title.trim()) {
      setErrors({ title: '先输入作品标题' });
      return;
    }

    const suggestion = await onSuggest(form.mediaType, form.title);
    if (!suggestion) {
      return;
    }

    setForm((current) => ({
      ...current,
      originalTitle: suggestion.originalTitle ?? current.originalTitle,
      creator: suggestion.creator ?? current.creator,
      releaseYear: suggestion.releaseYear ?? current.releaseYear,
      note: suggestion.note || current.note,
      source: 'ai_suggest',
    }));
    if (suggestion.tags?.length) {
      setTagText(stringifyTags(normalizeFormTags(form.mediaType, stringifyTags(suggestion.tags))));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: MediaDiaryFormErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = '请输入作品标题';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      ...form,
      title: form.title.trim(),
      originalTitle: form.originalTitle?.trim() || '',
      creator: form.creator?.trim() || '',
      releaseYear: form.releaseYear ? Number(form.releaseYear) : undefined,
      coverUrl: form.coverUrl?.trim() || '',
      startedAt: form.startedAt || '',
      finishedAt: form.finishedAt || '',
      note: form.note.trim(),
      quote: form.quote.trim(),
      tags: normalizeFormTags(form.mediaType, tagText),
    });
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel={entry ? '关闭编辑日记' : '关闭新建日记'}
      closeDisabled={submitting}
      zIndexClassName="z-[70]"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{entry ? '编辑书影音' : '新建书影音'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">记录作品、评分、摘录和当下感受。</p>
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
        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          <label className="block space-y-2">
            <span className="text-sm font-medium">类型</span>
            <select
              value={form.mediaType}
              onChange={(event) => {
                const mediaType = event.target.value as MediaDiaryType;
                updateField('mediaType', mediaType);
                setTagText(stringifyTags(normalizeFormTags(mediaType, tagText)));
              }}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
            >
              {mediaDiaryTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">状态</span>
            <select
              value={form.status}
              onChange={(event) => updateField('status', event.target.value as MediaDiaryStatus)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
            >
              {mediaDiaryStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">
            作品标题 <span className="text-life-alert">*</span>
          </span>
          <div className="flex gap-2 max-[360px]:flex-col">
            <input
              value={form.title}
              onChange={(event) => {
                updateField('title', event.target.value);
                setErrors((current) => ({ ...current, title: undefined }));
              }}
              aria-invalid={Boolean(errors.title)}
              placeholder="例如：夜航西飞"
              className={cn(
                'h-11 flex-1 rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                errors.title ? 'border-destructive' : 'border-border',
              )}
            />
            <Button
              type="button"
              variant="ai"
              disabled={submitting}
              onClick={() => void handleSuggest()}
            >
              {suggesting ? <ActionLoadingIcon tone="ai" /> : <Sparkles className="size-4" />}
              {suggesting ? '补全中' : 'AI 补全'}
            </Button>
          </div>
          {errors.title ? <p className="text-xs text-destructive">{errors.title}</p> : null}
        </label>

        <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
          <label className="block space-y-2">
            <span className="text-sm font-medium">原名</span>
            <input
              value={form.originalTitle}
              onChange={(event) => updateField('originalTitle', event.target.value)}
              placeholder="可选"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">作者 / 导演 / 艺人</span>
            <input
              value={form.creator}
              onChange={(event) => updateField('creator', event.target.value)}
              placeholder="可选"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-3 max-[420px]:grid-cols-1">
          <label className="block space-y-2">
            <span className="text-sm font-medium">年份</span>
            <input
              type="number"
              value={form.releaseYear ?? ''}
              min={0}
              max={new Date().getFullYear() + 1}
              onChange={(event) =>
                updateField(
                  'releaseYear',
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
              placeholder="可选"
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">评分</span>
            <select
              value={form.rating}
              onChange={(event) => updateField('rating', Number(event.target.value))}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
            >
              {Array.from({ length: 11 }, (_, index) => (
                <option key={index} value={index}>
                  {index === 0 ? '未评分' : `${(index / 2).toFixed(1)} 星`}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">完成日期</span>
            <input
              type="date"
              value={form.finishedAt}
              onChange={(event) => updateField('finishedAt', event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">开始日期</span>
          <input
            type="date"
            value={form.startedAt}
            onChange={(event) => updateField('startedAt', event.target.value)}
            className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
          />
        </label>

        <AppImageUploader
          value={form.coverUrl}
          onChange={(url) => updateField('coverUrl', url)}
          label="封面"
          description="支持 JPG、PNG、WebP，最大 10MB。"
          disabled={saving}
          onUploadingChange={setImageUploading}
        />

        <label className="block space-y-2">
          <span className="text-sm font-medium">短评</span>
          <textarea
            value={form.note}
            onChange={(event) => updateField('note', event.target.value)}
            placeholder="留下这次阅读、观看或收听后的感受。"
            className="min-h-24 w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">摘录</span>
          <textarea
            value={form.quote}
            onChange={(event) => updateField('quote', event.target.value)}
            placeholder="可选"
            className="min-h-20 w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium">标签</span>
          <input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="例如：非虚构、周末、书影音"
            className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
          />
          <p className="text-xs text-muted-foreground">可用顿号、逗号或换行分隔。</p>
        </label>

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
            {saving ? <ActionLoadingIcon tone="ai" /> : null}
            {saving ? '保存中' : '保存'}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

export function MediaDiaryPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const { entryId } = useParams<{ entryId?: string }>();
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const loadTraces = useLifeTraceStore((state) => state.loadTraces);
  const [entries, setEntries] = useState<MediaDiaryEntry[]>([]);
  const [summary, setSummary] = useState<MediaDiarySummary>(defaultSummary);
  const [pagination, setPagination] = useState<ListPagination>(defaultPagination);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<MediaDiaryTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<MediaDiaryStatusFilter>('all');
  const [query, setQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MediaDiaryEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaDiaryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedEntry = entryId ? (entries.find((entry) => entry.id === entryId) ?? null) : null;

  const loadEntries = useCallback(
    async (options: Partial<ListMediaDiaryOptions> = {}) => {
      if (!token) {
        return;
      }
      const nextOptions: ListMediaDiaryOptions = {
        page: options.page ?? 1,
        pageSize: options.pageSize ?? pagination.pageSize,
        type: options.type ?? typeFilter,
        status: options.status ?? statusFilter,
        q: options.q ?? query,
      };
      const firstPage = (nextOptions.page ?? 1) === 1;
      if (firstPage) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError('');
      try {
        const data = await listMediaDiaryEntries(token, nextOptions);
        setSummary(data.summary ?? defaultSummary);
        setPagination(data.pagination ?? defaultPagination);
        setEntries((current) => {
          if (firstPage) {
            return data.list;
          }
          const existingIds = new Set(current.map((entry) => entry.id));
          return [...current, ...data.list.filter((entry) => !existingIds.has(entry.id))];
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '获取书影音日记失败');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pagination.pageSize, query, statusFilter, token, typeFilter],
  );

  useEffect(() => {
    void loadEntries({ page: 1 });
  }, [loadEntries]);

  useEffect(() => {
    if (entryId && !loading && entries.length > 0 && !selectedEntry) {
      navigate('/media-diary', { replace: true });
    }
  }, [entries.length, entryId, loading, navigate, selectedEntry]);

  const openEditor = (entry: MediaDiaryEntry | null = null) => {
    setEditingEntry(entry);
    setEditorOpen(true);
  };

  const handleSubmit = async (input: NewMediaDiaryEntryInput) => {
    if (!token) {
      return;
    }
    setSaving(true);
    try {
      const saved = editingEntry
        ? await updateMediaDiaryEntry(token, editingEntry.id, input)
        : await createMediaDiaryEntry(token, input);
      setEntries((current) => {
        const exists = current.some((entry) => entry.id === saved.id);
        if (exists) {
          return current.map((entry) => (entry.id === saved.id ? saved : entry));
        }
        return [saved, ...current];
      });
      setEditorOpen(false);
      setEditingEntry(null);
      showToast(editingEntry ? '书影音日记已更新' : '书影音日记已保存', 'success');
      void loadTraces();
      void loadEntries({ page: 1 });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存书影音日记失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSuggest = async (mediaType: MediaDiaryType, title: string) => {
    if (!token) {
      return null;
    }
    setSuggesting(true);
    try {
      const suggestion = await suggestMediaDiaryEntry(token, { mediaType, title });
      showToast('AI 补全已填入草稿', 'success');
      return suggestion;
    } catch {
      return null;
    } finally {
      setSuggesting(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await deleteMediaDiaryEntry(token, deleteTarget.id);
      setEntries((current) => current.filter((entry) => entry.id !== deleteTarget.id));
      if (entryId === deleteTarget.id) {
        navigate('/media-diary');
      }
      setDeleteTarget(null);
      showToast('书影音日记已删除', 'success');
      void loadTraces();
      void loadEntries({ page: 1 });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除书影音日记失败');
    } finally {
      setDeleting(false);
    }
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuery(searchDraft.trim());
  };

  const action = (
    <Button
      type="button"
      variant="ai"
      size="icon"
      aria-label="新建书影音"
      onClick={() => openEditor()}
    >
      <Plus className="size-5" />
    </Button>
  );

  if (entryId) {
    return (
      <SubPageShell title="书影音详情" eyebrow="书影音" backTo="/media-diary" action={action}>
        {selectedEntry ? (
          <MediaDiaryDetail
            entry={selectedEntry}
            onEdit={() => openEditor(selectedEntry)}
            onDelete={() => setDeleteTarget(selectedEntry)}
          />
        ) : loading ? (
          <SyncState title="正在同步书影音详情" tone="trace" variant="skeleton-list" />
        ) : (
          <LoadErrorState
            title="没有找到这条日记"
            description="它可能已经被删除，或当前列表还没有同步到。"
            error={error}
            retrying={loading}
            onRetry={() => void loadEntries({ page: 1 })}
          />
        )}
        <MediaDiaryEditor
          open={editorOpen}
          entry={editingEntry}
          saving={saving}
          suggesting={suggesting}
          onOpenChange={(open) => {
            setEditorOpen(open);
            if (!open) {
              setEditingEntry(null);
            }
          }}
          onSubmit={handleSubmit}
          onSuggest={handleSuggest}
        />
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="删除这条书影音日记？"
          description={
            deleteTarget ? `「${deleteTarget.title}」删除后不会再出现在书影音列表。` : ''
          }
          confirmLabel="确认删除"
          loading={deleting}
          onCancel={() => {
            if (!deleting) {
              setDeleteTarget(null);
            }
          }}
          onConfirm={() => void confirmDelete()}
        />
      </SubPageShell>
    );
  }

  return (
    <SubPageShell title="书影音日记" eyebrow="踪迹" backTo="/traces" action={action}>
      <div className="space-y-5">
        <section className="grid grid-cols-3 gap-2 max-[360px]:grid-cols-1">
          <Card className="border-life-trace/20 bg-life-trace/5 p-3">
            <p className="text-lg font-semibold">{summary.total}</p>
            <p className="mt-1 text-xs text-muted-foreground">全部日记</p>
          </Card>
          <Card className="border-life-ai/20 bg-life-ai/5 p-3">
            <p className="text-lg font-semibold">{summary.completedMonth}</p>
            <p className="mt-1 text-xs text-muted-foreground">本月完成</p>
          </Card>
          <Card className="border-life-plan/20 bg-life-plan/5 p-3">
            <p className="text-lg font-semibold">{formatRating(summary.bestRating)}</p>
            <p className="mt-1 text-xs text-muted-foreground">最高评分</p>
          </Card>
        </section>

        {summary.recent ? (
          <Card className="flex items-center gap-3 border-life-trace/18 bg-card p-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-life-trace/10 text-life-trace">
              <Disc3 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">最近记录</p>
              <p className="mt-1 truncate text-sm font-semibold">{summary.recent.title}</p>
            </div>
          </Card>
        ) : null}

        <form className="flex gap-2 max-[360px]:flex-col" onSubmit={submitSearch}>
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="搜索标题、作者或短评"
              className="h-11 w-full rounded-2xl border border-border bg-secondary pl-10 pr-4 text-sm outline-none transition focus:border-ring"
            />
          </label>
          <Button type="submit" variant="outline">
            搜索
          </Button>
        </form>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            className={cn(
              'min-h-10 shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition',
              typeFilter === 'all'
                ? 'bg-life-trace text-background'
                : 'bg-card text-muted-foreground',
            )}
            onClick={() => setTypeFilter('all')}
          >
            全部
          </button>
          {mediaDiaryTypes.map((type) => {
            const Icon = type.icon;
            const active = typeFilter === type.value;
            return (
              <button
                type="button"
                key={type.value}
                className={cn(
                  'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition',
                  active ? 'bg-life-trace text-background' : 'bg-card text-muted-foreground',
                )}
                onClick={() => setTypeFilter(type.value)}
              >
                <Icon className="size-4" />
                {type.label}
              </button>
            );
          })}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['all', ...mediaDiaryStatuses] as MediaDiaryStatusFilter[]).map((status) => {
            const active = statusFilter === status;
            return (
              <button
                type="button"
                key={status}
                className={cn(
                  'min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition',
                  active
                    ? 'border-life-ai/35 bg-life-ai/10 text-life-ai'
                    : 'border-border bg-card text-muted-foreground',
                )}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? '全部状态' : status}
              </button>
            );
          })}
        </div>

        {error ? (
          <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </Card>
        ) : null}

        {loading ? (
          <SyncState title="正在同步书影音日记" tone="trace" variant="skeleton-list" />
        ) : entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <MediaDiaryCard
                key={entry.id}
                entry={entry}
                onOpen={() => navigate(`/media-diary/${entry.id}`)}
                onEdit={() => openEditor(entry)}
                onDelete={() => setDeleteTarget(entry)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="还没有书影音日记"
            description="先记录一本书、一部片或一张专辑。"
            eyebrow="书影音"
            icon={BookOpen}
            tone="trace"
            action={
              <Button type="button" variant="ai" onClick={() => openEditor()}>
                <Plus className="size-4" />
                新建日记
              </Button>
            }
          />
        )}

        {pagination.hasMore ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loadingMore}
            onClick={() => void loadEntries({ page: pagination.page + 1 })}
          >
            {loadingMore ? (
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
            ) : null}
            {loadingMore ? '加载中' : '加载更多'}
          </Button>
        ) : null}
      </div>

      <MediaDiaryEditor
        open={editorOpen}
        entry={editingEntry}
        saving={saving}
        suggesting={suggesting}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingEntry(null);
          }
        }}
        onSubmit={handleSubmit}
        onSuggest={handleSuggest}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这条书影音日记？"
        description={deleteTarget ? `「${deleteTarget.title}」删除后不会再出现在书影音列表。` : ''}
        confirmLabel="确认删除"
        loading={deleting}
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </SubPageShell>
  );
}
