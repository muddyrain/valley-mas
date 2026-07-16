import {
  BookOpen,
  CheckCircle2,
  LoaderCircle,
  Search,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { AIKnowledgeReference } from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface AIResponseToolTrace {
  id: string;
  name: string;
  status: 'running' | 'succeeded' | 'failed';
  durationMs?: number;
}

interface AIResponseContextProps {
  references?: AIKnowledgeReference[];
  toolStatus?: string | null;
  toolTraces?: AIResponseToolTrace[];
  className?: string;
}

function statusLabel(status: AIResponseToolTrace['status']) {
  if (status === 'succeeded') return '完成';
  if (status === 'failed') return '失败';
  return '进行中';
}

function statusIcon(status: AIResponseToolTrace['status']) {
  if (status === 'succeeded') return <CheckCircle2 className="text-primary" />;
  if (status === 'failed') return <XCircle className="text-destructive" />;
  return <LoaderCircle className="animate-spin text-primary" />;
}

export function AIResponseContext({
  references = [],
  toolStatus,
  toolTraces = [],
  className,
}: AIResponseContextProps) {
  const activeTrace: AIResponseToolTrace | null = toolStatus
    ? {
        id: 'active-tool',
        name: 'content.search',
        status: toolStatus.includes('失败')
          ? 'failed'
          : toolStatus.includes('完成')
            ? 'succeeded'
            : 'running',
      }
    : null;
  const traces = [...toolTraces.slice(-3), ...(activeTrace ? [activeTrace] : [])];

  if (traces.length === 0 && references.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {traces.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-3" />
            </span>
            AI 工具活动
          </span>
          <span aria-hidden="true" className="hidden h-3.5 w-px bg-border sm:block" />
          {traces.map((trace) => (
            <Badge
              key={trace.id}
              variant="outline"
              className="gap-1.5 border-border/70 bg-background/80 font-normal shadow-none"
            >
              <Wrench className="text-muted-foreground" />
              <span>{trace.name === 'content.search' ? '内容搜索' : trace.name}</span>
              {statusIcon(trace.status)}
              <span className="text-muted-foreground">{statusLabel(trace.status)}</span>
              {trace.durationMs !== undefined ? (
                <span className="text-muted-foreground">{trace.durationMs}ms</span>
              ) : null}
            </Badge>
          ))}
        </div>
      ) : null}
      {references.length > 0 ? (
        <Card size="sm" className="gap-3 border-border/80 py-4 shadow-none">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen />
              参考来源
              <Badge variant="outline">{references.length}</Badge>
            </CardTitle>
            <CardDescription>回答引用的已授权资料</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-4">
            {references.map((reference) => (
              <article key={`${reference.documentName}-${reference.chunkId}`} className="min-w-0">
                <div className="flex items-center gap-2">
                  <Search className="text-muted-foreground" />
                  <p className="truncate text-sm font-medium text-foreground">
                    {reference.documentName}
                  </p>
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {reference.excerpt}
                </p>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
