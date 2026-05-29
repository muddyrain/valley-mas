import { ArrowLeft, CalendarDays, Clock, Image, MapPin, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Trace } from '@/types';

type TraceFilter = 'all' | 'plan' | 'checkin' | 'manual' | 'with-image';

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
  手动: 'trace',
};

function filterTraces(traces: Trace[], filter: TraceFilter) {
  if (filter === 'plan') {
    return traces.filter((trace) => trace.source === '计划');
  }
  if (filter === 'checkin') {
    return traces.filter((trace) => trace.source === '打卡');
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

function TraceDetailDrawer({
  trace,
  deleting,
  onClose,
  onRequestDelete,
}: {
  trace: Trace | null;
  deleting: boolean;
  onClose: () => void;
  onRequestDelete: (trace: Trace) => void;
}) {
  if (!trace) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
      onMouseDown={() => {
        if (!deleting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="safe-bottom absolute inset-x-0 bottom-0 mx-auto max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[1.75rem] border border-border bg-card p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={sourceTone[trace.source]}>{trace.source}</Badge>
              <Badge tone="trace">{trace.mood}</Badge>
            </div>
            <h2 className="mt-3 text-2xl font-semibold leading-tight">{trace.title}</h2>
            {trace.createdAt ? (
              <p className="mt-2 text-sm text-muted-foreground">
                记录于 {formatTraceDateTime(trace.createdAt)}
              </p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={deleting} onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        {trace.imageUrl ? (
          <div className="mb-5 overflow-hidden rounded-2xl border border-border bg-secondary">
            <img
              src={trace.imageUrl}
              alt={trace.title}
              className="w-full object-cover opacity-90"
            />
          </div>
        ) : (
          <div className="mb-5 flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 text-muted-foreground">
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

        <div className="mt-3 grid grid-cols-2 gap-3">
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
          <Card className="mt-3 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <MapPin className="size-4" />
              地点
            </div>
            <p className="mt-2 text-sm font-semibold">{trace.location}</p>
          </Card>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {trace.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" disabled={deleting} onClick={onClose}>
            <ArrowLeft className="size-4" />
            返回
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
    </div>,
    document.body,
  );
}

export function TracesPage() {
  const traces = useLifeTraceStore((state) => state.traces);
  const tracesLoading = useLifeTraceStore((state) => state.tracesLoading);
  const tracesError = useLifeTraceStore((state) => state.tracesError);
  const removeTrace = useLifeTraceStore((state) => state.removeTrace);
  const navigate = useNavigate();
  const { traceId } = useParams<{ traceId?: string }>();
  const [activeFilter, setActiveFilter] = useState<TraceFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Trace | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredTraces = useMemo(() => filterTraces(traces, activeFilter), [activeFilter, traces]);
  const selectedTrace = traceId ? (traces.find((trace) => trace.id === traceId) ?? null) : null;
  const activeFilterConfig =
    traceFilters.find((filter) => filter.id === activeFilter) ?? traceFilters[0];

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

    setDeletingId(deleteTarget.id);
    await removeTrace(deleteTarget.id);
    setDeletingId(null);
    setDeleteTarget(null);
    if (traceId === deleteTarget.id) {
      navigate('/traces');
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="踪迹" meta={`${traces.length} 条记录`} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {traceFilters.map((filter) => {
          const active = activeFilter === filter.id;

          return (
            <button
              type="button"
              key={filter.id}
              className={cn(
                'shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition',
                active ? 'bg-life-trace text-background' : 'bg-card text-muted-foreground',
              )}
              onClick={() => setActiveFilter(filter.id)}
              aria-pressed={active}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {tracesError ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {tracesError}
        </Card>
      ) : null}

      {tracesLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="p-4">
              <div className="h-4 w-32 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
              <div className="mt-4 h-16 animate-pulse rounded-2xl bg-secondary motion-reduce:animate-none" />
            </Card>
          ))}
        </div>
      ) : null}

      <div className="relative space-y-6 pl-7">
        {filteredTraces.length > 0 ? (
          <div className="absolute bottom-0 left-2 top-0 w-px bg-border" />
        ) : null}
        {filteredTraces.map((trace) => (
          <article key={trace.id} className="relative">
            <span className="absolute -left-[1.7rem] top-5 size-3 rounded-full border-2 border-life-trace bg-background" />
            <Card
              className="cursor-pointer overflow-hidden transition hover:border-life-trace/40"
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
                <img
                  src={trace.imageUrl}
                  alt={trace.title}
                  className="aspect-video w-full object-cover opacity-85"
                />
              ) : null}
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone={sourceTone[trace.source]}>{trace.source}</Badge>
                      <Badge tone="trace">{trace.mood}</Badge>
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
                    {deletingId === trace.id ? (
                      <ActionLoadingIcon tone="alert" className="size-4" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
                <div className="rounded-2xl bg-secondary p-3 text-sm leading-6 text-muted-foreground">
                  {trace.summary}
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
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
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </Card>
          </article>
        ))}
      </div>

      {!tracesLoading && filteredTraces.length === 0 ? (
        <EmptyState
          title={activeFilter === 'all' ? '还没有踪迹' : '暂无匹配踪迹'}
          description={activeFilterConfig.emptyText}
          eyebrow={activeFilterConfig.label}
          icon={Image}
          tone="trace"
          action={
            activeFilter !== 'all' && traces.length > 0 ? (
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

      <TraceDetailDrawer
        trace={selectedTrace}
        deleting={selectedTrace ? deletingId === selectedTrace.id : false}
        onClose={() => navigate('/traces')}
        onRequestDelete={requestDeleteTrace}
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
        loading={deleteTarget ? deletingId === deleteTarget.id : false}
        onCancel={() => {
          if (!deletingId) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void confirmDeleteTrace()}
      />
    </div>
  );
}
