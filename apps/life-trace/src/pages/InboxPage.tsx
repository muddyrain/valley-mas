import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AppImageUploader } from '@/components/AppImageUploader';
import { BottomSheet } from '@/components/BottomSheet';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { EditTraceDrawer } from '@/components/EditTraceDrawer';
import { EmptyState } from '@/components/EmptyState';
import { ImagePreview } from '@/components/ImagePreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { applyInboxAISuggestion, buildInboxPlanDraft, buildInboxTraceDraft } from '@/lib/inbox';
import { buildLedgerDraftFromInbox } from '@/lib/ledger';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { InboxItem, InboxItemStatus, InboxItemType, NewInboxItemInput } from '@/types';

type InboxFilter = InboxItemStatus | 'all';

type InboxFormErrors = Partial<Record<'title' | 'linkUrl' | 'imageUrl', string>>;

const inboxFilters: Array<{ value: InboxFilter; label: string }> = [
  { value: 'inbox', label: '未处理' },
  { value: 'converted', label: '已转化' },
  { value: 'archived', label: '已归档' },
  { value: 'all', label: '全部' },
];

const defaultForm: NewInboxItemInput = {
  title: '',
  content: '',
  itemType: 'text',
  linkUrl: '',
  imageUrl: '',
  tags: [],
};

function parseTags(value: string) {
  return value
    .split(/[、,，\n]/)
    .map((tag) => tag.trim())
    .filter((tag, index, list) => tag.length > 0 && list.indexOf(tag) === index);
}

function stringifyTags(tags: string[]) {
  return tags.join('、');
}

function buildInboxInput(
  title: string,
  content: string,
  itemType: InboxItemType,
  tags: string[],
): NewInboxItemInput {
  const normalizedTitle = title.trim();
  const normalizedContent = content.trim();
  const linkMatch =
    normalizedTitle.match(/https?:\/\/\S+/) ?? normalizedContent.match(/https?:\/\/\S+/);
  const inferredType: InboxItemType = itemType === 'link' || linkMatch ? 'link' : 'text';
  return {
    title: normalizedTitle,
    content: normalizedContent,
    itemType: inferredType,
    linkUrl: inferredType === 'link' ? (linkMatch?.[0] ?? '') : '',
    imageUrl: '',
    tags,
  };
}

function getItemStatusLabel(status: InboxItemStatus) {
  if (status === 'converted') {
    return '已转化';
  }
  if (status === 'archived') {
    return '已归档';
  }
  return '未处理';
}

function getItemStatusTone(status: InboxItemStatus) {
  if (status === 'converted') {
    return 'trace' as const;
  }
  if (status === 'archived') {
    return 'default' as const;
  }
  return 'ai' as const;
}

function formatInboxTime(value?: string) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getInboxTypeLabel(itemType: InboxItemType) {
  if (itemType === 'image') {
    return '图片';
  }
  return itemType === 'link' ? '链接' : '文本';
}

export function InboxPage() {
  const navigate = useNavigate();
  const inboxItems = useLifeTraceStore((state) => state.inboxItems);
  const inboxLoaded = useLifeTraceStore((state) => state.inboxLoaded);
  const inboxLoading = useLifeTraceStore((state) => state.inboxLoading);
  const inboxLoadingMore = useLifeTraceStore((state) => state.inboxLoadingMore);
  const inboxError = useLifeTraceStore((state) => state.inboxError);
  const inboxPagination = useLifeTraceStore((state) => state.inboxPagination);
  const inboxCreating = useLifeTraceStore((state) => state.inboxCreating);
  const inboxUpdatingById = useLifeTraceStore((state) => state.inboxUpdatingById);
  const inboxDeletingById = useLifeTraceStore((state) => state.inboxDeletingById);
  const loadInboxItems = useLifeTraceStore((state) => state.loadInboxItems);
  const loadMoreInboxItems = useLifeTraceStore((state) => state.loadMoreInboxItems);
  const addInboxItem = useLifeTraceStore((state) => state.addInboxItem);
  const editInboxItem = useLifeTraceStore((state) => state.editInboxItem);
  const updateInboxStatus = useLifeTraceStore((state) => state.updateInboxStatus);
  const convertInbox = useLifeTraceStore((state) => state.convertInbox);
  const organizeInbox = useLifeTraceStore((state) => state.organizeInbox);
  const removeInboxItem = useLifeTraceStore((state) => state.removeInboxItem);
  const [quickText, setQuickText] = useState('');
  const [quickError, setQuickError] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('inbox');
  const [typeFilter, setTypeFilter] = useState<InboxItemType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [editingItem, setEditingItem] = useState<InboxItem | null | undefined>(undefined);
  const [form, setForm] = useState<NewInboxItemInput>(defaultForm);
  const [tagText, setTagText] = useState('');
  const [formErrors, setFormErrors] = useState<InboxFormErrors>({});
  const [planDraftItem, setPlanDraftItem] = useState<InboxItem | null>(null);
  const [traceDraftItem, setTraceDraftItem] = useState<InboxItem | null>(null);

  useEffect(() => {
    void loadInboxItems({ status: filter, type: typeFilter, q: query });
  }, [filter, loadInboxItems, query, typeFilter]);

  useEffect(() => {
    if (editingItem === undefined) {
      return;
    }
    if (editingItem === null) {
      setForm(defaultForm);
      setTagText('');
      setFormErrors({});
      return;
    }
    setForm({
      title: editingItem.title,
      content: editingItem.content ?? '',
      itemType: editingItem.itemType,
      linkUrl: editingItem.linkUrl ?? '',
      imageUrl: editingItem.imageUrl ?? '',
      tags: editingItem.tags,
    });
    setTagText(stringifyTags(editingItem.tags));
    setFormErrors({});
  }, [editingItem]);

  const visibleStats = useMemo(
    () => ({
      inbox: inboxItems.filter((item) => item.status === 'inbox').length,
      converted: inboxItems.filter((item) => item.status === 'converted').length,
      archived: inboxItems.filter((item) => item.status === 'archived').length,
    }),
    [inboxItems],
  );

  const submitQuickCapture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = buildInboxInput(quickText, '', 'text', []);
    if (!input.title) {
      setQuickError('先写一点内容');
      return;
    }
    if (input.itemType === 'link' && !input.linkUrl) {
      setQuickError('链接需要以 http 或 https 开头');
      return;
    }

    const saved = await addInboxItem(input);
    if (saved) {
      setQuickText('');
      setQuickError('');
      if (filter !== 'inbox') {
        setFilter('inbox');
      }
    }
  };

  const closeEditor = () => {
    setEditingItem(undefined);
    setForm(defaultForm);
    setTagText('');
    setFormErrors({});
  };

  const submitEditor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingItem === undefined) {
      return;
    }
    const nextErrors: InboxFormErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = '请输入标题';
    }
    if (form.itemType === 'link' && !form.linkUrl?.trim()) {
      nextErrors.linkUrl = '请输入链接';
    }
    if (form.itemType === 'link' && form.linkUrl && !/^https?:\/\//.test(form.linkUrl.trim())) {
      nextErrors.linkUrl = '链接需要以 http 或 https 开头';
    }
    if (form.itemType === 'image' && !form.imageUrl?.trim()) {
      nextErrors.imageUrl = '请先上传图片';
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const input = {
      ...form,
      title: form.title.trim(),
      content: form.content?.trim() || '',
      linkUrl: form.itemType === 'link' ? form.linkUrl?.trim() || '' : '',
      imageUrl: form.itemType === 'image' ? form.imageUrl?.trim() || '' : '',
      tags: parseTags(tagText),
    };
    const saved =
      editingItem === null ? await addInboxItem(input) : await editInboxItem(editingItem.id, input);
    if (saved) {
      closeEditor();
    }
  };

  const convertToPlan = async (item: InboxItem) => {
    setPlanDraftItem(item);
  };

  const convertToTrace = async (item: InboxItem) => {
    setTraceDraftItem(item);
  };

  const convertToLedger = (item: InboxItem) => {
    const draft = buildLedgerDraftFromInbox(item);
    const params = new URLSearchParams({
      new: '1',
      inboxItemId: item.id,
      amount: draft.amount ? String(draft.amount) : '',
      category: draft.category ?? '其他',
      merchant: draft.merchant ?? '',
      note: draft.note ?? '',
      imageUrl: draft.imageUrl ?? item.imageUrl ?? '',
    });
    navigate(`/ledger?${params.toString()}`);
  };

  const applySuggestionToEditor = () => {
    if (!editingItem) {
      return;
    }
    const suggested = applyInboxAISuggestion(editingItem);
    setForm((current) => ({
      ...current,
      title: suggested.title,
      content: suggested.content ?? '',
      tags: suggested.tags,
    }));
    setTagText(stringifyTags(suggested.tags));
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-4 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-life-ai">Inbox</p>
            <h1 className="truncate text-2xl font-semibold">捕捉 Inbox</h1>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(null)}>
          <Plus className="size-4" />
          收下
        </Button>
      </header>

      <Card className="p-4">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={submitQuickCapture}>
          <label className="block">
            <span className="sr-only">快速捕捉</span>
            <textarea
              value={quickText}
              onChange={(event) => {
                setQuickText(event.target.value);
                setQuickError('');
              }}
              placeholder="先收下一个想法、链接或待处理事项"
              className="min-h-24 w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring"
            />
          </label>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="ai"
              className="w-full sm:w-auto"
              disabled={inboxCreating}
            >
              {inboxCreating ? <ActionLoadingIcon /> : <Plus className="size-4" />}
              {inboxCreating ? '保存中' : '收下'}
            </Button>
          </div>
        </form>
        {quickError ? <p className="mt-2 text-sm text-life-alert">{quickError}</p> : null}
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground">未处理</p>
          <p className="mt-2 text-2xl font-semibold">{visibleStats.inbox}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground">已转化</p>
          <p className="mt-2 text-2xl font-semibold">{visibleStats.converted}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted-foreground">已归档</p>
          <p className="mt-2 text-2xl font-semibold">{visibleStats.archived}</p>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {inboxFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                className={cn(
                  'h-9 rounded-xl border px-3 text-sm font-semibold transition',
                  filter === item.value
                    ? 'border-life-ai/40 bg-life-ai/10 text-life-ai'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as InboxItemType | 'all')}
              className="h-10 rounded-xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
            >
              <option value="all">全部类型</option>
              <option value="text">文本</option>
              <option value="link">链接</option>
              <option value="image">图片</option>
            </select>
            <label className="relative block">
              <Search className="-translate-y-1/2 absolute left-3 top-1/2 size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索"
                className="h-10 w-full rounded-xl border border-border bg-secondary pl-9 pr-3 text-sm outline-none transition focus:border-ring sm:w-64"
              />
            </label>
          </div>
        </div>

        {inboxError ? (
          <Card className="border-life-alert/30 bg-life-alert/10 p-4 text-sm text-life-alert">
            {inboxError}
          </Card>
        ) : null}

        {inboxLoading && !inboxLoaded ? (
          <Card className="grid min-h-44 place-items-center p-6 text-sm text-muted-foreground">
            <LoaderCircle className="mb-3 size-6 animate-spin text-life-ai motion-reduce:animate-none" />
            正在同步 Inbox
          </Card>
        ) : inboxItems.length === 0 ? (
          <EmptyState
            title="还没有未处理内容"
            description="先收下一条想法，之后再决定去向。"
            eyebrow="Inbox"
            icon={ClipboardList}
            tone="ai"
          />
        ) : (
          <div className="grid gap-3">
            {inboxItems.map((item) => {
              const updating = Boolean(inboxUpdatingById[item.id]);
              const deleting = Boolean(inboxDeletingById[item.id]);
              const disabled = updating || deleting;

              return (
                <Card key={item.id} className="p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone={getItemStatusTone(item.status)}>
                          {getItemStatusLabel(item.status)}
                        </Badge>
                        <Badge tone="default">{getInboxTypeLabel(item.itemType)}</Badge>
                        {item.aiSuggestedType ? (
                          <Badge tone="ai">
                            建议{item.aiSuggestedType === 'plan' ? '计划' : '踪迹'}
                          </Badge>
                        ) : null}
                        {item.convertedType ? (
                          <Badge tone="trace">
                            {item.convertedType === 'plan' ? '计划' : '踪迹'}
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="break-words text-base font-semibold">{item.title}</h2>
                      {item.imageUrl ? (
                        <div className="mt-3 max-w-sm overflow-hidden rounded-[1.25rem] border border-border bg-secondary">
                          <ImagePreview
                            src={item.imageUrl}
                            alt={item.title}
                            title={item.title}
                            subtitle="Inbox 图片"
                            imageClassName="aspect-video w-full object-cover"
                          />
                        </div>
                      ) : null}
                      {item.content ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                          {item.content}
                        </p>
                      ) : null}
                      {item.aiSummary ? (
                        <div className="mt-3 rounded-2xl border border-life-ai/20 bg-life-ai/10 p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Sparkles className="size-4 text-life-ai" />
                            <p className="text-sm font-semibold text-life-ai">AI 整理</p>
                            {item.aiOrganizedAt ? (
                              <span className="text-xs text-muted-foreground">
                                {formatInboxTime(item.aiOrganizedAt)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm font-semibold">{item.aiTitle || item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {item.aiSummary}
                          </p>
                          {item.aiReason ? (
                            <p className="mt-2 text-xs text-muted-foreground">{item.aiReason}</p>
                          ) : null}
                          {item.aiTags?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {item.aiTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-background/60 px-2.5 py-1 text-xs text-life-ai"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {item.linkUrl ? (
                        <a
                          href={item.linkUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-life-ai"
                        >
                          <ExternalLink className="size-4 shrink-0" />
                          <span className="truncate">{item.linkUrl}</span>
                        </a>
                      ) : null}
                      {item.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs text-muted-foreground">
                        {formatInboxTime(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-56 lg:justify-end">
                      {item.status === 'inbox' ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => void organizeInbox(item.id)}
                          >
                            {updating ? <ActionLoadingIcon /> : <Sparkles className="size-4" />}
                            AI 整理
                          </Button>
                          {item.aiSummary ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={disabled}
                              onClick={async () => {
                                const suggested = applyInboxAISuggestion(item);
                                await editInboxItem(item.id, {
                                  title: suggested.title,
                                  content: suggested.content ?? '',
                                  itemType: suggested.itemType,
                                  linkUrl: suggested.linkUrl ?? '',
                                  imageUrl: suggested.imageUrl ?? '',
                                  tags: suggested.tags,
                                });
                              }}
                            >
                              应用建议
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => void convertToPlan(item)}
                          >
                            <ClipboardList className="size-4" />
                            转计划
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => void convertToTrace(item)}
                          >
                            <FileText className="size-4" />
                            转踪迹
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            onClick={() => convertToLedger(item)}
                          >
                            <ReceiptText className="size-4" />
                            转账目
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={disabled}
                            onClick={() => void updateInboxStatus(item.id, 'archived')}
                          >
                            {updating ? <ActionLoadingIcon /> : <Archive className="size-4" />}
                            归档
                          </Button>
                        </>
                      ) : null}
                      {item.status === 'archived' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={disabled}
                          onClick={() => void updateInboxStatus(item.id, 'inbox')}
                        >
                          {updating ? <ActionLoadingIcon /> : <CheckCircle2 className="size-4" />}
                          恢复
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => setEditingItem(item)}
                      >
                        <Pencil className="size-4" />
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => void removeInboxItem(item.id)}
                      >
                        {deleting ? <ActionLoadingIcon /> : <Trash2 className="size-4" />}
                        删除
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {inboxPagination.hasMore ? (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={inboxLoadingMore}
              onClick={() => void loadMoreInboxItems()}
            >
              {inboxLoadingMore ? <ActionLoadingIcon /> : null}
              {inboxLoadingMore
                ? '加载中'
                : `加载更多 · ${inboxItems.length}/${inboxPagination.total}`}
            </Button>
          </div>
        ) : inboxItems.length > 0 ? (
          <p className="text-center text-xs text-muted-foreground">已展示 {inboxItems.length} 条</p>
        ) : null}
      </section>

      <BottomSheet
        open={editingItem !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
        overlayLabel="关闭编辑 Inbox"
        zIndexClassName="z-[60]"
      >
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            {editingItem === null ? '收下 Inbox' : '编辑 Inbox'}
          </h2>
        </div>
        <form className="space-y-4" onSubmit={submitEditor}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">标题</span>
            <input
              value={form.title}
              onChange={(event) => {
                setForm((current) => ({ ...current, title: event.target.value }));
                setFormErrors((current) => ({ ...current, title: undefined }));
              }}
              className={cn(
                'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                formErrors.title ? 'border-destructive' : 'border-border',
              )}
            />
            {formErrors.title ? (
              <p className="text-xs text-destructive">{formErrors.title}</p>
            ) : null}
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">内容</span>
            <textarea
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              className="min-h-24 w-full resize-none rounded-2xl border border-border bg-secondary px-4 py-3 text-sm outline-none transition focus:border-ring"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            <label className="block space-y-2">
              <span className="text-sm font-medium">类型</span>
              <select
                value={form.itemType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    itemType: event.target.value as InboxItemType,
                  }))
                }
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-3 text-sm outline-none transition focus:border-ring"
              >
                <option value="text">文本</option>
                <option value="link">链接</option>
                <option value="image">图片</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">标签</span>
              <input
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                placeholder="灵感、待办"
                className="h-11 w-full rounded-2xl border border-border bg-secondary px-4 text-sm outline-none transition focus:border-ring"
              />
            </label>
          </div>
          {form.itemType === 'link' ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium">链接</span>
              <input
                value={form.linkUrl}
                onChange={(event) => {
                  setForm((current) => ({ ...current, linkUrl: event.target.value }));
                  setFormErrors((current) => ({ ...current, linkUrl: undefined }));
                }}
                placeholder="https://"
                className={cn(
                  'h-11 w-full rounded-2xl border bg-secondary px-4 text-sm outline-none transition focus:border-ring',
                  formErrors.linkUrl ? 'border-destructive' : 'border-border',
                )}
              />
              {formErrors.linkUrl ? (
                <p className="text-xs text-destructive">{formErrors.linkUrl}</p>
              ) : null}
            </label>
          ) : null}
          {form.itemType === 'image' ? (
            <div>
              <AppImageUploader
                value={form.imageUrl}
                onChange={(url) => {
                  setForm((current) => ({ ...current, imageUrl: url }));
                  setFormErrors((current) => ({ ...current, imageUrl: undefined }));
                }}
                label="Inbox 图片"
                description="支持拍照或从相册选择一张图片。"
                cameraAndLibrary
              />
              {formErrors.imageUrl ? (
                <p className="mt-2 text-xs text-destructive">{formErrors.imageUrl}</p>
              ) : null}
            </div>
          ) : null}
          {editingItem?.aiSummary ? (
            <Card className="border-life-ai/20 bg-life-ai/10 p-3">
              <p className="text-sm font-semibold text-life-ai">AI 整理</p>
              <p className="mt-2 text-sm font-semibold">
                {editingItem.aiTitle || editingItem.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {editingItem.aiSummary}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={applySuggestionToEditor}
              >
                应用建议
              </Button>
            </Card>
          ) : null}
          <div className="grid grid-cols-2 gap-3 pt-2 max-[360px]:grid-cols-1">
            <Button type="button" variant="secondary" onClick={closeEditor}>
              取消
            </Button>
            <Button
              type="submit"
              variant="ai"
              disabled={
                editingItem === null
                  ? inboxCreating
                  : editingItem
                    ? Boolean(inboxUpdatingById[editingItem.id])
                    : false
              }
            >
              {(editingItem === null && inboxCreating) ||
              (editingItem && inboxUpdatingById[editingItem.id]) ? (
                <ActionLoadingIcon />
              ) : null}
              {editingItem === null ? '收下' : '保存修改'}
            </Button>
          </div>
        </form>
      </BottomSheet>

      <CreatePlanDrawer
        open={Boolean(planDraftItem)}
        initialInput={planDraftItem ? buildInboxPlanDraft(planDraftItem) : undefined}
        onSaved={(plan) => {
          if (planDraftItem) {
            void convertInbox(planDraftItem.id, 'plan', plan.id);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setPlanDraftItem(null);
          }
        }}
      />
      <EditTraceDrawer
        open={Boolean(traceDraftItem)}
        trace={null}
        initialInput={traceDraftItem ? buildInboxTraceDraft(traceDraftItem) : undefined}
        onSaved={(trace) => {
          if (traceDraftItem) {
            void convertInbox(traceDraftItem.id, 'trace', trace.id);
          }
        }}
        onOpenChange={(open) => {
          if (!open) {
            setTraceDraftItem(null);
          }
        }}
      />
    </div>
  );
}
