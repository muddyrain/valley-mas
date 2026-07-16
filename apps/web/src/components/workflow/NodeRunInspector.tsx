import { CheckCircle2, Clipboard, Clock3, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { NodeRunSnapshot } from './runSession';

function jsonPreview(value: Record<string, unknown> | undefined): string | null {
  return value ? JSON.stringify(value, null, 2) : null;
}

function PreviewSection({
  title,
  value,
}: {
  title: string;
  value: Record<string, unknown> | undefined;
}) {
  const preview = jsonPreview(value);
  if (!preview) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      toast.success('已复制运行结果');
    } catch {
      toast.error('复制失败');
    }
  };
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Button variant="ghost" size="icon" onClick={copy} aria-label={`复制${title}`}>
          <Clipboard className="h-3.5 w-3.5" />
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs leading-5 text-foreground whitespace-pre-wrap break-words">
        {preview}
      </pre>
    </section>
  );
}

export function NodeRunInspector({ snapshot }: { snapshot: NodeRunSnapshot }) {
  const isRunning = snapshot.status === 'running';
  const isError = snapshot.status === 'error';
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : isError ? (
          <XCircle className="h-4 w-4 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        )}
        <Badge variant={isError ? 'destructive' : isRunning ? 'outline' : 'secondary'}>
          {isRunning ? '运行中' : isError ? '运行失败' : '运行成功'}
        </Badge>
        {snapshot.durationMs != null && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {snapshot.durationMs}ms
          </span>
        )}
      </div>
      {isRunning && !snapshot.output && (
        <p className="text-xs text-muted-foreground">节点正在执行，等待可展示的输出。</p>
      )}
      <div className="space-y-4">
        <PreviewSection title="输入" value={snapshot.input} />
        <PreviewSection title="输出" value={snapshot.output} />
        {snapshot.error && (
          <section className="space-y-1.5">
            <p className="text-xs font-medium text-destructive">错误</p>
            <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
              {snapshot.error}
            </p>
            {snapshot.errorCode && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                错误码：{snapshot.errorCode}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
