import { BookOpen, CheckCircle2, Clock3, Search, Wrench, XCircle } from 'lucide-react';
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
  return <Clock3 className="text-muted-foreground" />;
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
        <Card size="sm" className="gap-3 border-border/80 py-4 shadow-none">
          <CardHeader className="px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wrench />
              使用工具
            </CardTitle>
            <CardDescription>本次回复的受控调用摘要</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 px-4">
            {traces.map((trace) => (
              <Badge key={trace.id} variant="secondary" className="gap-1.5 py-1">
                {statusIcon(trace.status)}
                <span>{trace.name === 'content.search' ? '内容搜索' : trace.name}</span>
                <span className="text-muted-foreground">{statusLabel(trace.status)}</span>
                {trace.durationMs !== undefined ? (
                  <span className="text-muted-foreground">{trace.durationMs}ms</span>
                ) : null}
              </Badge>
            ))}
          </CardContent>
        </Card>
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
