import {
  CalendarDays,
  Clock,
  Disc3,
  Image,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditTraceDrawer } from '@/components/EditTraceDrawer';
import { EmptyState } from '@/components/EmptyState';
import { ImagePreview } from '@/components/ImagePreview';
import { LoadErrorState } from '@/components/LoadErrorState';
import {
  SoftHeader,
  SoftIconBadge,
  SoftPage,
  SoftPanel,
  SoftSectionTitle,
  SoftStatGrid,
} from '@/components/SoftDiary';
import { SubPageShell } from '@/components/SubPageShell';
import { SyncState } from '@/components/SyncState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Trace } from '@/types';

type TraceFilter = 'all' | 'plan' | 'checkin' | 'pantry' | 'media' | 'manual' | 'with-image';

const traceFilters: Array<{ id: TraceFilter; label: string; emptyText: string }> = [
  {
    id: 'all',
    label: '全部',
    emptyText: '还没有生活踪迹。先完成一个计划，Life Trace 会把它沉淀为可回看的记录。',
  },
  {
    id: 'plan',
    label: '计划',
    emptyText: '还没有由计划生成的踪迹。完成一个计划后会自动沉淀到这里。',
  },
  {
    id: 'checkin',
    label: '打卡',
    emptyText: '还没有打卡类踪迹。后续完成关键打卡后可以沉淀成生活记录。',
  },
  {
    id: 'pantry',
    label: '库存',
    emptyText: '还没有库存类踪迹。拍照入库、用完或丢弃库存后会沉淀到这里。',
  },
  {
    id: 'media',
    label: '书影音',
    emptyText: '还没有书影音踪迹。保存书影音日记后会沉淀到这里。',
  },
  {
    id: 'manual',
    label: '手动',
    emptyText: '还没有手动记录的踪迹。可以从图片分析或计划完成后开始积累。',
  },
  {
    id: 'with-image',
    label: '有图片',
    emptyText: '还没有带图片的踪迹。上传图片分析后，可以生成更丰富的生活记录。',
  },
];

const sourceTone: Record<Trace['source'], 'plan' | 'health' | 'trace'> = {
  计划: 'plan',
  打卡: 'health',
  库存: 'trace',
  书影音: 'trace',
  穿搭: 'plan',
  手动: 'trace',
};

const TAG_PREVIEW_LIMIT = 3;
const pantryTraceActionTags = [
  '新增库存',
  '合并数量',
  '转移到共享家庭',
  '从个人空间移出',
  '用完',
  '丢弃',
] as const;

type TraceMonthGroup = {
  key: string;
  label: string;
  traces: Trace[];
};

function filterTraces(traces: Trace[], filter: TraceFilter) {
  if (filter === 'plan') {
    return traces.filter((trace) => trace.source === '计划');
  }
  if (filter === 'checkin') {
    return traces.filter((trace) => trace.source === '打卡');
  }
  if (filter === 'pantry') {
    return traces.filter((trace) => trace.source === '库存');
  }
  if (filter === 'media') {
    return traces.filter((trace) => trace.source === '书影音');
  }
  if (filter === 'manual') {
    return traces.filter((trace) => trace.source === '手动');
  }
  if (filter === 'with-image') {
    return traces.filter((trace) => Boolean(trace.imageUrl));
  }
  return traces;
}

function formatTraceDateTime(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTraceDate(trace: Trace) {
  const date = trace.createdAt ? new Date(trace.createdAt) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getTraceMonthLabel(trace: Trace) {
  const date = getTraceDate(trace);
  if (!date) {
    return { key: 'unknown', label: '未归档' };
  }

  return {
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    label: date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
    }),
  };
}

function groupTracesByMonth(traces: Trace[]): TraceMonthGroup[] {
  const groups = new Map<string, TraceMonthGroup>();

  const sortedTraces = [...traces].sort((left, right) => {
    return (getTraceDate(right)?.getTime() ?? 0) - (getTraceDate(left)?.getTime() ?? 0);
  });

  for (const trace of sortedTraces) {
    const month = getTraceMonthLabel(trace);
    const existing = groups.get(month.key);
    if (existing) {
      existing.traces.push(trace);
    } else {
      groups.set(month.key, { key: month.key, label: month.label, traces: [trace] });
    }
  }

  return Array.from(groups.values()).sort((left, right) => {
    if (left.key === 'unknown') {
      return 1;
    }
    if (right.key === 'unknown') {
      return -1;
    }
    return right.key.localeCompare(left.key);
  });
}

function getTraceTags(traces: Trace[]) {
  const tagCounts = new Map<string, number>();
  for (const trace of traces) {
    for (const tag of trace.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagCounts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0], 'zh-CN');
  });
}

function getPantryTraceActionTag(trace: Trace) {
  return pantryTraceActionTags.find((tag) => trace.tags.includes(tag)) ?? null;
}

function TraceDetailContent({
  trace,
  deleting,
  onRequestEdit,
  onRequestDelete,
}: {
  trace: Trace | null;
  deleting: boolean;
  onRequestEdit: (trace: Trace) => void;
  onRequestDelete: (trace: Trace) => void;
}) {
  if (!trace) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={sourceTone[trace.source]}>
              {trace.source === '库存' ? (
                <span className="inline-flex items-center gap-1.5">
                  <PackageCheck className="size-3.5" />
                  {trace.source}
                </span>
              ) : (
                trace.source
              )}
            </Badge>
            {trace.source === '库存' && getPantryTraceActionTag(trace) ? (
              <Badge tone="ai">{getPantryTraceActionTag(trace)}</Badge>
            ) : null}
            <Badge tone="trace">{trace.mood}</Badge>
          </div>
          <h2 className="mt-3 text-2xl font-semibold leading-tight">{trace.title}</h2>
          {trace.createdAt ? (
            <p className="mt-2 text-sm text-muted-foreground">
              记录于 {formatTraceDateTime(trace.createdAt)}
            </p>
          ) : null}
        </div>
      </div>

      {trace.imageUrl ? (
        <ImagePreview
          src={trace.imageUrl}
          alt={trace.title}
          title={trace.title}
          subtitle={trace.timeLabel}
          className="block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-secondary text-left"
          imageClassName="w-full object-cover opacity-90"
        />
      ) : (
        <div className="flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 text-muted-foreground">
          <Image className="size-5 text-life-trace" />
          <p className="text-sm">这条踪迹还没有图片。之后可以从图片分析生成更丰富的记录。</p>
        </div>
      )}

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Sparkles className="size-4 text-life-ai" />
          生活摘要
        </div>
        <p className="text-sm leading-6 text-foreground">{trace.summary}</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Clock className="size-4" />
            时间
          </div>
          <p className="mt-2 text-sm font-semibold">{trace.timeLabel}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="size-4" />
            来源
          </div>
          <p className="mt-2 text-sm font-semibold">{trace.source}</p>
        </Card>
      </div>

      {trace.location ? (
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <MapPin className="size-4" />
            地点
          </div>
          <p className="mt-2 text-sm font-semibold">{trace.location}</p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {trace.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <Button
          type="button"
          variant="outline"
          disabled={deleting}
          onClick={() => onRequestEdit(trace)}
        >
          <Pencil className="size-4" />
          编辑
        </Button>
        <Button
          type="button"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          disabled={deleting}
          onClick={() => onRequestDelete(trace)}
        >
          {deleting ? <ActionLoadingIcon tone="alert" /> : <Trash2 className="size-4" />}
          {deleting ? '删除中' : '删除'}
        </Button>
      </div>
    </div>
  );
}

export function TracesPage() {
  const traces = useLifeTraceStore((state) => state.traces);
  const tracesLoading = useLifeTraceStore((state) => state.tracesLoading);
  const tracesLoadingMore = useLifeTraceStore((state) => state.tracesLoadingMore);
  const tracesPagination = useLifeTraceStore((state) => state.tracesPagination);
  const tracesError = useLifeTraceStore((state) => state.tracesError);
  const loadTraces = useLifeTraceStore((state) => state.loadTraces);
  const loadMoreTraces = useLifeTraceStore((state) => state.loadMoreTraces);
  const removeTrace = useLifeTraceStore((state) => state.removeTrace);
  const traceDeletingById = useLifeTraceStore((state) => state.traceDeletingById);
  const navigate = useNavigate();
  const { traceId } = useParams<{ traceId?: string }>();
  const [activeFilter, setActiveFilter] = useState<TraceFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Trace | null>(null);
  const [editTarget, setEditTarget] = useState<Trace | null>(null);
  const [activeTag, setActiveTag] = useState('全部');
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const traceTags = useMemo(() => getTraceTags(traces), [traces]);
  const visibleTraceTags = useMemo(() => {
    if (tagsExpanded || traceTags.length <= TAG_PREVIEW_LIMIT) {
      return traceTags;
    }

    const previewTags = traceTags.slice(0, TAG_PREVIEW_LIMIT);
    if (activeTag === '全部' || previewTags.some(([tag]) => tag === activeTag)) {
      return previewTags;
    }

    const selectedTag = traceTags.find(([tag]) => tag === activeTag);
    return selectedTag ? [selectedTag, ...previewTags] : previewTags;
  }, [activeTag, tagsExpanded, traceTags]);
  const hiddenTagCount = Math.max(traceTags.length - TAG_PREVIEW_LIMIT, 0);
  const filteredTraces = useMemo(() => {
    const sourceFiltered = filterTraces(traces, activeFilter);
    if (activeTag === '全部') {
      return sourceFiltered;
    }
    return sourceFiltered.filter((trace) => trace.tags.includes(activeTag));
  }, [activeFilter, activeTag, traces]);
  const showTracesErrorFallback =
    Boolean(tracesError) && !tracesLoading && filteredTraces.length === 0;
  const monthGroups = useMemo(() => groupTracesByMonth(filteredTraces), [filteredTraces]);
  const selectedTrace = traceId ? (traces.find((trace) => trace.id === traceId) ?? null) : null;
  const activeFilterConfig =
    traceFilters.find((filter) => filter.id === activeFilter) ?? traceFilters[0];
  const imageTraceCount = filteredTraces.filter((trace) => trace.imageUrl).length;
  const locationTraceCount = filteredTraces.filter((trace) => trace.location).length;
  const currentMonthLabel = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
  }).format(new Date());

  useEffect(() => {
    if (traceId && !tracesLoading && traces.length > 0 && !selectedTrace) {
      navigate('/traces', { replace: true });
    }
  }, [navigate, selectedTrace, traceId, traces.length, tracesLoading]);

  const requestDeleteTrace = (trace: Trace) => {
    setDeleteTarget(trace);
  };

  const confirmDeleteTrace = async () => {
    if (!deleteTarget) {
      return;
    }

    await removeTrace(deleteTarget.id);
    setDeleteTarget(null);
    if (traceId === deleteTarget.id) {
      navigate('/traces');
    }
  };

  if (traceId) {
    return (
      <SubPageShell title="踪迹详情" eyebrow="踪迹" backTo="/traces">
        {selectedTrace ? (
          <TraceDetailContent
            trace={selectedTrace}
            deleting={Boolean(traceDeletingById[selectedTrace.id])}
            onRequestEdit={setEditTarget}
            onRequestDelete={requestDeleteTrace}
          />
        ) : tracesLoading ? (
          <SyncState title="正在同步踪迹详情" tone="trace" variant="skeleton-list" />
        ) : (
          <LoadErrorState
            title="没有找到这条踪迹"
            description="它可能已经被删除，或当前列表还没有同步到。"
            error={tracesError}
            retrying={tracesLoading}
            onRetry={() => void loadTraces()}
          />
        )}
        <EditTraceDrawer
          open={Boolean(editTarget)}
          trace={editTarget}
          onOpenChange={(open) => {
            if (!open) {
              setEditTarget(null);
            }
          }}
          onSaved={(trace) => setEditTarget(trace)}
        />
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="删除这条踪迹？"
          description={
            deleteTarget
              ? `「${deleteTarget.title}」删除后不会再出现在踪迹流中，关联计划不会被删除。`
              : ''
          }
          confirmLabel="确认删除"
          loading={deleteTarget ? Boolean(traceDeletingById[deleteTarget.id]) : false}
          onCancel={() => {
            if (!deleteTarget || !traceDeletingById[deleteTarget.id]) {
              setDeleteTarget(null);
            }
          }}
          onConfirm={() => void confirmDeleteTrace()}
        />
      </SubPageShell>
    );
  }

  return (
    <SoftPage>
      <SoftHeader
        title="踪迹"
        subtitle="把今天变成可回看的生活"
        action={
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-14 rounded-[1.15rem]"
            aria-label="新建踪迹"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-6" />
          </Button>
        }
      />

      <SoftStatGrid
        items={[
          { label: '条记录', value: filteredTraces.length || traces.length, icon: CalendarDays },
          { label: '个地点', value: locationTraceCount, icon: MapPin },
          { label: '张照片', value: imageTraceCount, icon: Image, tone: 'weather' },
        ]}
      />

      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-life-trace/20 bg-card/85 p-4 text-left shadow-[0_18px_54px_rgba(71,58,42,0.075)] transition hover:border-life-trace/40 hover:bg-card"
        onClick={() => navigate('/media-diary')}
      >
        <span className="flex min-w-0 items-center gap-3">
          <SoftIconBadge icon={Disc3} tone="trace" />
          <span className="min-w-0">
            <span className="block font-semibold">书影音日记</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              书籍、电影、剧集、动漫和音乐
            </span>
          </span>
        </span>
        <Badge tone="trace">进入</Badge>
      </button>

      <div className="rounded-[1.35rem] border border-border/70 bg-card/80 p-1">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {traceFilters.map((filter) => {
            const active = activeFilter === filter.id;

            return (
              <button
                type="button"
                key={filter.id}
                className={cn(
                  'min-h-12 shrink-0 cursor-pointer rounded-[1.05rem] px-5 py-2 text-sm font-semibold transition',
                  active
                    ? 'bg-life-trace text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary',
                )}
                onClick={() => setActiveFilter(filter.id)}
                aria-pressed={active}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <SoftPanel className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">标签筛选</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTag === '全部' ? `共 ${traceTags.length} 个标签` : `正在查看「${activeTag}」`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {activeTag !== '全部' ? (
              <button
                type="button"
                className="cursor-pointer rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-life-trace transition hover:bg-life-trace/10"
                onClick={() => setActiveTag('全部')}
              >
                清除
              </button>
            ) : null}
            {hiddenTagCount > 0 ? (
              <button
                type="button"
                className="cursor-pointer rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                onClick={() => setTagsExpanded((expanded) => !expanded)}
              >
                {tagsExpanded ? '收起' : `更多 ${hiddenTagCount}`}
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              'min-h-10 shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold transition',
              activeTag === '全部'
                ? 'border-life-trace/40 bg-life-trace/10 text-life-trace'
                : 'border-border bg-card text-muted-foreground',
            )}
            onClick={() => setActiveTag('全部')}
          >
            全部标签
          </button>
          {visibleTraceTags.map(([tag, count]) => (
            <button
              type="button"
              key={tag}
              className={cn(
                'min-h-10 max-w-full shrink-0 cursor-pointer rounded-full border px-4 text-sm font-semibold transition',
                activeTag === tag
                  ? 'border-life-trace/40 bg-life-trace/10 text-life-trace'
                  : 'border-border bg-card text-muted-foreground',
              )}
              onClick={() => setActiveTag(tag)}
            >
              <span className="inline-flex max-w-[9.5rem] items-center gap-1.5">
                <span className="truncate">{tag}</span>
                <span className="shrink-0 text-muted-foreground">· {count}</span>
              </span>
            </button>
          ))}
        </div>
      </SoftPanel>

      {tracesError && !showTracesErrorFallback ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {tracesError}
        </Card>
      ) : null}

      {tracesLoading ? (
        <SyncState title="正在同步生活踪迹" tone="trace" variant="skeleton-list" />
      ) : null}

      <div className="space-y-7">
        {filteredTraces.length > 0 ? (
          <SoftSectionTitle title={currentMonthLabel} meta={`${filteredTraces.length} 条记录`} />
        ) : null}

        {monthGroups.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-3 bg-background/85 px-1 py-2 backdrop-blur">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{group.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{group.traces.length} 条记录</p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                {group.traces.filter((trace) => trace.imageUrl).length} 张图片
              </span>
            </div>

            <div className="relative space-y-5">
              <div className="absolute bottom-0 left-4 top-1 w-px bg-gradient-to-b from-life-trace/60 via-border to-transparent" />
              {group.traces.map((trace, index) => (
                <article
                  key={trace.id}
                  className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3"
                >
                  <span className="relative z-10 mt-5 grid size-5 self-start justify-self-center rounded-full border border-life-trace/40 bg-background shadow-[0_0_0_5px_rgba(16,185,129,0.06)]">
                    <span className="m-auto size-2 rounded-full bg-life-trace" />
                  </span>
                  <Card
                    className={cn(
                      'cursor-pointer overflow-hidden rounded-[1.35rem] border-border/80 bg-card/85 shadow-[0_18px_54px_rgba(71,58,42,0.065)] transition hover:border-life-trace/40 hover:shadow-[0_18px_56px_rgba(16,185,129,0.08)]',
                      trace.source === '库存' &&
                        'border-life-ai/15 bg-[linear-gradient(180deg,rgba(6,182,212,0.04),rgba(16,185,129,0.03))]',
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/traces/${trace.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/traces/${trace.id}`);
                      }
                    }}
                  >
                    {trace.imageUrl ? (
                      <ImagePreview
                        src={trace.imageUrl}
                        alt={trace.title}
                        title={trace.title}
                        subtitle={trace.timeLabel}
                        className="block w-full cursor-zoom-in overflow-hidden text-left"
                        imageClassName="aspect-video w-full object-cover opacity-90 transition duration-500 hover:scale-[1.02]"
                      />
                    ) : null}
                    <div className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge tone={sourceTone[trace.source]}>
                              {trace.source === '库存' ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <PackageCheck className="size-3.5" />
                                  {trace.source}
                                </span>
                              ) : (
                                trace.source
                              )}
                            </Badge>
                            {trace.source === '库存' && getPantryTraceActionTag(trace) ? (
                              <Badge tone="ai">{getPantryTraceActionTag(trace)}</Badge>
                            ) : null}
                            <Badge tone="trace">{trace.mood}</Badge>
                            {index === 0 ? <Badge tone="ai">本月最近</Badge> : null}
                          </div>
                          <h2 className="line-clamp-2 text-lg font-semibold leading-snug">
                            {trace.title}
                          </h2>
                        </div>
                        <button
                          type="button"
                          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-muted-foreground transition hover:bg-life-alert/10 hover:text-life-alert"
                          aria-label={`删除${trace.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDeleteTrace(trace);
                          }}
                        >
                          {traceDeletingById[trace.id] ? (
                            <ActionLoadingIcon tone="alert" className="size-4" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </div>
                      <div className="rounded-2xl bg-secondary/70 p-3 text-sm leading-6 text-muted-foreground">
                        {trace.summary}
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="size-4" />
                          {trace.timeLabel}
                        </div>
                        {trace.location ? (
                          <div className="flex items-center gap-2">
                            <MapPin className="size-4" />
                            {trace.location}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {trace.tags.map((tag) => (
                          <button
                            type="button"
                            key={tag}
                            className="cursor-pointer"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveTag(tag);
                            }}
                          >
                            <Badge>{tag}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {showTracesErrorFallback ? (
        <LoadErrorState
          title="踪迹列表加载失败"
          description="这次生活踪迹没有顺利从云端同步下来，重新加载后会再拉一次最新记录。"
          error={tracesError}
          retrying={tracesLoading}
          onRetry={() => void loadTraces()}
        />
      ) : !tracesLoading && filteredTraces.length === 0 ? (
        <EmptyState
          title={activeFilter === 'all' ? '还没有踪迹' : '暂无匹配踪迹'}
          description={activeFilterConfig.emptyText}
          eyebrow={activeTag === '全部' ? activeFilterConfig.label : activeTag}
          icon={Image}
          tone="trace"
          action={
            activeTag !== '全部' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTag('全部')}
              >
                清除标签筛选
              </Button>
            ) : activeFilter !== 'all' && traces.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveFilter('all')}
              >
                查看全部踪迹
              </Button>
            ) : null
          }
        />
      ) : null}

      {tracesPagination.hasMore ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={tracesLoadingMore}
            onClick={() => void loadMoreTraces()}
          >
            {tracesLoadingMore ? <ActionLoadingIcon /> : null}
            {tracesLoadingMore
              ? '加载中'
              : `加载更早踪迹 · ${traces.length}/${tracesPagination.total}`}
          </Button>
        </div>
      ) : traces.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">已展示 {traces.length} 条踪迹</p>
      ) : null}

      <EditTraceDrawer open={createOpen} trace={null} onOpenChange={setCreateOpen} />
      <EditTraceDrawer
        open={Boolean(editTarget)}
        trace={editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
        onSaved={(trace) => setEditTarget(trace)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这条踪迹？"
        description={
          deleteTarget
            ? `「${deleteTarget.title}」删除后不会再出现在踪迹流中，关联计划不会被删除。`
            : ''
        }
        confirmLabel="确认删除"
        loading={deleteTarget ? Boolean(traceDeletingById[deleteTarget.id]) : false}
        onCancel={() => {
          if (!deleteTarget || !traceDeletingById[deleteTarget.id]) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void confirmDeleteTrace()}
      />
    </SoftPage>
  );
}
