import {
  CheckCircle2,
  ChevronDown,
  CircleSlash2,
  Clipboard,
  Clock3,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { workflowRunErrorGuidance } from './runErrorGuidance';
import type { NodeRunIterationSnapshot, NodeRunSnapshot, NodeRunStatus } from './runSession';

function jsonPreview(value: Record<string, unknown> | undefined): string | null {
  return value ? JSON.stringify(value, null, 2) : null;
}

function RunPreviewSection({
  title,
  value,
  compact,
}: {
  title: string;
  value: Record<string, unknown> | undefined;
  compact: boolean;
}) {
  const preview = jsonPreview(value);
  if (!preview) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      toast.success(`已复制${title}`);
    } catch {
      toast.error('复制失败');
    }
  };
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{title}</p>
        <Button variant="ghost" size="icon-xs" onClick={copy} aria-label={`复制${title}`}>
          <Clipboard className="size-3" />
        </Button>
      </div>
      <Textarea
        readOnly
        value={preview}
        aria-label={`${title}内容`}
        onWheelCapture={(event) => event.stopPropagation()}
        className={cn(
          'nodrag nopan nowheel min-h-0 touch-pan-y resize-none overflow-auto overscroll-contain whitespace-pre-wrap break-words border-border bg-muted/35 p-2 font-mono text-[11px] leading-5 text-foreground shadow-none',
          compact ? 'max-h-36' : 'max-h-48',
        )}
      />
    </section>
  );
}

function statusMeta(status: NodeRunStatus) {
  if (status === 'running') {
    return { label: '运行中', icon: Loader2, iconClassName: 'animate-spin text-primary' };
  }
  if (status === 'error') {
    return { label: '运行失败', icon: XCircle, iconClassName: 'text-destructive' };
  }
  if (status === 'skipped') {
    return { label: '已跳过', icon: CircleSlash2, iconClassName: 'text-muted-foreground' };
  }
  if (status === 'cancelled') {
    return { label: '已取消', icon: CircleSlash2, iconClassName: 'text-muted-foreground' };
  }
  return { label: '运行成功', icon: CheckCircle2, iconClassName: 'text-emerald-600' };
}

function durationText(durationMs: number | undefined) {
  if (durationMs == null) return null;
  return durationMs >= 1000 ? `${(durationMs / 1000).toFixed(2)}s` : `${durationMs}ms`;
}

function RunDetailsBody({
  snapshot,
  compact,
}: {
  snapshot: NodeRunIterationSnapshot;
  compact: boolean;
}) {
  return (
    <div className={cn('space-y-3', compact ? 'p-3' : 'p-4')}>
      {snapshot.status === 'running' && !snapshot.input && !snapshot.output ? (
        <p className="text-xs text-muted-foreground">正在等待节点输入与输出…</p>
      ) : null}
      <RunPreviewSection title="输入" value={snapshot.input} compact={compact} />
      <RunPreviewSection title="输出" value={snapshot.output} compact={compact} />
      {snapshot.error ? (
        <section className="space-y-1.5">
          <p className="text-xs font-medium text-destructive">错误</p>
          <p className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
            {snapshot.error}
          </p>
          {snapshot.errorCode ? (
            <>
              <p className="font-mono text-[11px] text-destructive/90">
                错误码：{snapshot.errorCode}
              </p>
              <p className="text-xs text-muted-foreground">
                建议：{workflowRunErrorGuidance(snapshot.errorCode)}
              </p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function LoopIterationDetails({
  snapshot,
  compact,
}: {
  snapshot: NodeRunSnapshot;
  compact: boolean;
}) {
  const [selectedIteration, setSelectedIteration] = useState(snapshot.loopIteration);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const entries = Object.entries(snapshot.iterations ?? {})
    .map(([iteration, value]) => ({ iteration: Number(iteration), snapshot: value }))
    .sort((left, right) => left.iteration - right.iteration);

  useEffect(() => {
    if (snapshot.loopIteration != null) setSelectedIteration(snapshot.loopIteration);
  }, [snapshot.loopIteration]);

  if (entries.length === 0) return <RunDetailsBody snapshot={snapshot} compact={compact} />;

  const visibleEntries = errorsOnly
    ? entries.filter((entry) => entry.snapshot.status === 'error')
    : entries;
  const activeEntry =
    visibleEntries.find((entry) => entry.iteration === selectedIteration) ||
    visibleEntries[visibleEntries.length - 1] ||
    entries.find((entry) => entry.iteration === selectedIteration) ||
    entries[entries.length - 1];

  return (
    <div className={cn('space-y-3', compact ? 'p-3' : 'p-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">已处理轮次：{entries.length}</p>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={errorsOnly}
            onCheckedChange={(checked) => setErrorsOnly(checked === true)}
            aria-label="仅看失败轮次"
          />
          仅看失败
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleEntries.map((entry) => (
          <Button
            key={entry.iteration}
            type="button"
            size="sm"
            variant={activeEntry?.iteration === entry.iteration ? 'outline' : 'ghost'}
            className={cn(
              'h-7 min-w-7 px-2 text-xs',
              activeEntry?.iteration === entry.iteration && 'border-primary text-primary',
            )}
            onClick={() => setSelectedIteration(entry.iteration)}
          >
            {entry.iteration + 1}
          </Button>
        ))}
      </div>
      {activeEntry ? (
        <RunDetailsBody snapshot={activeEntry.snapshot} compact={compact} />
      ) : (
        <p className="text-xs text-muted-foreground">当前没有失败轮次。</p>
      )}
    </div>
  );
}

function RunStatus({ snapshot }: { snapshot: NodeRunSnapshot }) {
  const meta = statusMeta(snapshot.status);
  const Icon = meta.icon;
  const duration = durationText(snapshot.durationMs);
  const iteration = snapshot.loopIteration == null ? null : `第 ${snapshot.loopIteration + 1} 轮`;
  return (
    <>
      <Icon className={cn('size-4 shrink-0', meta.iconClassName)} />
      <span className="text-xs font-medium text-foreground">{meta.label}</span>
      {iteration ? <span className="text-xs text-muted-foreground">{iteration}</span> : null}
      {duration ? (
        <Badge variant="secondary" className="ml-1 gap-1 px-1.5 font-mono text-[10px]">
          <Clock3 className="size-3" />
          {duration}
        </Badge>
      ) : null}
    </>
  );
}

export function NodeRunDetails({
  snapshot,
  variant = 'canvas',
}: {
  snapshot: NodeRunSnapshot;
  variant?: 'canvas' | 'panel';
}) {
  const [open, setOpen] = useState(snapshot.status === 'error');

  useEffect(() => {
    if (snapshot.status === 'error') setOpen(true);
  }, [snapshot.status]);

  if (variant === 'panel') {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <RunStatus snapshot={snapshot} />
        </div>
        <LoopIterationDetails snapshot={snapshot} compact={false} />
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="nodrag nopan mt-2 overflow-hidden rounded-lg border border-border bg-card shadow-xs"
    >
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-none px-3 hover:bg-muted/60"
            onClick={(event) => event.stopPropagation()}
            aria-label={open ? '收起节点运行详情' : '展开节点运行详情'}
          />
        }
      >
        <RunStatus snapshot={snapshot} />
        <ChevronDown
          className={cn(
            'ml-auto size-4 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border">
        <LoopIterationDetails snapshot={snapshot} compact />
      </CollapsibleContent>
    </Collapsible>
  );
}
