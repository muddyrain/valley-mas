import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  ImageIcon,
  LoaderCircle,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { AIKnowledgeReference } from '@/api/aiWorkbench';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  activeToolName?: string | null;
  thinking?: boolean;
  hasResponse?: boolean;
  toolTraces?: AIResponseToolTrace[];
  onReferenceOpen?: (reference: AIKnowledgeReference) => void;
  presentation?: 'default' | 'workspace';
  showProcess?: boolean;
  className?: string;
}

function toolLabel(name: string) {
  if (name === 'content.search') return '内容搜索';
  if (name === 'image.generate') return '图片生成';
  return name;
}

function isImageTool(name?: string | null) {
  return name === 'image.generate';
}

function statusIcon(status: 'active' | 'complete' | 'failed' | 'idle') {
  if (status === 'complete') return <CheckCircle2 className="size-3.5" />;
  if (status === 'failed') return <XCircle className="size-3.5" />;
  if (status === 'active') return <LoaderCircle className="size-3.5 animate-spin" />;
  return <span className="size-1.5 rounded-full bg-current" />;
}

function stepClass(status: 'active' | 'complete' | 'failed' | 'idle') {
  if (status === 'active') return 'border-primary/30 bg-primary/10 text-primary';
  if (status === 'complete') return 'border-border/80 bg-background text-foreground';
  if (status === 'failed') return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'border-border/60 bg-muted/40 text-muted-foreground';
}

function workspaceStepClass(status: 'active' | 'complete' | 'failed' | 'idle') {
  if (status === 'active') return 'border-primary bg-primary text-primary-foreground shadow-sm';
  if (status === 'complete') return 'border-primary/20 bg-primary/5 text-foreground';
  if (status === 'failed') return 'border-destructive/30 bg-destructive/5 text-destructive';
  return 'border-border bg-muted/35 text-muted-foreground';
}

export function AIResponseContext({
  references = [],
  toolStatus,
  activeToolName,
  thinking = false,
  hasResponse = false,
  toolTraces = [],
  onReferenceOpen,
  presentation = 'default',
  showProcess: shouldShowProcess = true,
  className,
}: AIResponseContextProps) {
  const [processOpen, setProcessOpen] = useState(false);
  const processTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeStatus = toolStatus?.includes('失败')
    ? 'failed'
    : toolStatus?.includes('完成')
      ? 'succeeded'
      : 'running';
  const activeTrace: AIResponseToolTrace | null = activeToolName
    ? { id: 'active-tool', name: activeToolName, status: activeStatus }
    : null;
  const traces = [...toolTraces.slice(-3), ...(activeTrace ? [activeTrace] : [])];
  const recentTrace = traces[traces.length - 1];
  const imageTrace = traces.find((trace) => isImageTool(trace.name));
  const hasToolActivity = traces.length > 0;
  const hasProcess = thinking || hasToolActivity || hasResponse;
  const isWorkspace = presentation === 'workspace';
  const resultStatus =
    recentTrace?.status === 'failed' ? 'failed' : recentTrace ? 'complete' : 'idle';
  const handleProcessOpenChange = (open: boolean) => {
    setProcessOpen(open);
    if (open && isWorkspace) {
      window.requestAnimationFrame(() => {
        processTriggerRef.current?.scrollIntoView({ block: 'center' });
      });
    }
  };
  const steps = [
    {
      id: 'thinking',
      label: '思考',
      icon: <BrainCircuit className="size-3.5" />,
      status: thinking ? 'active' : hasToolActivity ? 'complete' : 'idle',
    },
    {
      id: 'tool',
      label: activeToolName ? `调用 ${toolLabel(activeToolName)}` : '调用工具',
      icon: <Wrench className="size-3.5" />,
      status:
        activeToolName && !isImageTool(activeToolName)
          ? 'active'
          : hasToolActivity
            ? 'complete'
            : 'idle',
    },
    {
      id: 'generating',
      label: '生成中',
      icon: <ImageIcon className="size-3.5" />,
      status: isImageTool(activeToolName)
        ? 'active'
        : imageTrace?.status === 'failed'
          ? 'failed'
          : imageTrace?.status === 'succeeded'
            ? 'complete'
            : 'idle',
    },
    {
      id: 'result',
      label: '结果',
      icon: <CheckCircle2 className="size-3.5" />,
      status: activeToolName ? 'idle' : resultStatus,
    },
  ] as const;
  const processItems = [
    {
      id: 'understand',
      title: thinking ? '正在理解请求' : '已理解本轮请求',
      detail: thinking ? '正在梳理目标与可用能力' : '已确定处理路径',
      icon: <BrainCircuit className="size-3.5" />,
      status: thinking ? 'active' : hasToolActivity || hasResponse ? 'complete' : 'idle',
    },
    ...traces.map((trace) => ({
      id: trace.id,
      title: `调用 ${toolLabel(trace.name)}`,
      detail:
        trace.status === 'failed'
          ? '执行失败'
          : trace.status === 'running'
            ? '正在执行'
            : `执行完成${trace.durationMs ? ` · ${trace.durationMs}ms` : ''}`,
      icon: isImageTool(trace.name) ? (
        <ImageIcon className="size-3.5" />
      ) : (
        <Wrench className="size-3.5" />
      ),
      status:
        trace.status === 'failed' ? 'failed' : trace.status === 'running' ? 'active' : 'complete',
    })),
    {
      id: 'response',
      title: thinking || activeToolName ? '正在组织结果' : hasResponse ? '已生成结果' : '等待结果',
      detail:
        thinking || activeToolName
          ? '正在整合本轮处理内容'
          : hasResponse
            ? '回复已就绪'
            : '尚未开始处理',
      icon: <CheckCircle2 className="size-3.5" />,
      status: thinking || activeToolName ? 'active' : hasResponse ? 'complete' : 'idle',
    },
  ] as const;

  if ((!shouldShowProcess || !hasProcess) && references.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-2.5', isWorkspace && 'gap-3', className)}>
      {shouldShowProcess && !isWorkspace && (thinking || traces.length > 0) && (
        <div
          className={cn(
            'rounded-lg border border-border/80 bg-muted/35 px-3 py-2.5',
            isWorkspace &&
              'rounded-xl border border-border border-l-2 border-l-primary bg-card px-4 py-3 shadow-xs',
          )}
        >
          <div
            className={cn(
              'mb-2 flex items-center gap-2 text-xs font-medium text-foreground',
              isWorkspace && 'mb-3',
            )}
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary',
                isWorkspace && 'size-7 rounded-lg bg-primary text-primary-foreground',
              )}
            >
              <BrainCircuit className="size-3" />
            </span>
            <span className={cn(isWorkspace && 'flex flex-col gap-0.5')}>
              <span>{isWorkspace ? '执行轨迹' : 'AI 工具活动'}</span>
              {isWorkspace ? (
                <span className="text-[11px] font-normal text-muted-foreground">本轮处理状态</span>
              ) : null}
            </span>
            {recentTrace?.durationMs !== undefined ? (
              <span className="ml-auto font-mono text-[11px] font-normal tabular-nums text-muted-foreground">
                {recentTrace.durationMs}ms
              </span>
            ) : null}
          </div>
          <ol
            className={cn(
              'flex flex-wrap items-center gap-1.5 text-xs',
              isWorkspace && 'grid grid-cols-2 gap-2 sm:grid-cols-4',
            )}
          >
            {steps.map((step, index) => (
              <li
                key={step.id}
                className={cn('flex items-center gap-1.5', isWorkspace && 'min-w-0')}
              >
                {index > 0 && !isWorkspace ? (
                  <span aria-hidden="true" className="h-px w-2 bg-border" />
                ) : null}
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2 py-1',
                    isWorkspace ? workspaceStepClass(step.status) : stepClass(step.status),
                    isWorkspace && 'min-h-12 w-full rounded-lg px-2.5 py-2 leading-tight',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0',
                      isWorkspace &&
                        'flex size-5 items-center justify-center rounded-md bg-background/15',
                    )}
                  >
                    {step.status === 'active' ? statusIcon(step.status) : step.icon}
                  </span>
                  <span className="min-w-0 truncate">{step.label}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {shouldShowProcess && hasProcess ? (
        <Collapsible
          open={processOpen}
          onOpenChange={handleProcessOpenChange}
          className={cn(
            'overflow-hidden rounded-lg border border-border/80 bg-background',
            isWorkspace && 'overflow-visible border-0 bg-transparent',
          )}
        >
          <CollapsibleTrigger
            ref={processTriggerRef}
            className={cn(
              'group flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset',
              isWorkspace && 'rounded-md px-0 py-1.5 hover:bg-transparent focus-visible:ring-inset',
            )}
            aria-label={isWorkspace ? '查看智能体处理过程' : undefined}
          >
            {isWorkspace ? (
              <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                {thinking || activeToolName
                  ? '正在处理'
                  : recentTrace?.durationMs
                    ? `执行完成 ${Math.max(1, Math.round(recentTrace.durationMs / 1000))}s`
                    : '执行完成'}
                <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
              </span>
            ) : (
              <>
                <BrainCircuit className="size-3.5 text-primary" />
                思考过程
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {thinking || activeToolName ? '处理中' : '已完成'}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
              </>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent
            className={cn('border-t border-border/70', isWorkspace && 'mt-2 border-0 pl-8')}
          >
            {isWorkspace ? <p className="pb-2 text-xs text-muted-foreground">处理摘要</p> : null}
            <ol className={cn('space-y-3 px-3 py-3 text-xs', isWorkspace && 'space-y-0 px-0 py-0')}>
              {processItems.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex gap-2.5',
                    isWorkspace &&
                      'relative py-2.5 [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:top-7 [&:not(:last-child)]:before:left-2.5 [&:not(:last-child)]:before:h-[calc(100%-0.5rem)] [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-border',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                      item.status === 'active'
                        ? 'bg-primary/10 text-primary'
                        : item.status === 'failed'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {item.status === 'active' ? statusIcon(item.status) : item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">{item.title}</span>
                    <span className="mt-0.5 block text-muted-foreground">{item.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
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
          <CardContent className="flex flex-col gap-2 px-4">
            {references.map((reference) => {
              const content = (
                <>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <p className="truncate text-sm font-medium text-foreground">
                      {reference.documentName}
                    </p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-left text-sm leading-6 text-muted-foreground">
                    {reference.excerpt}
                  </p>
                </>
              );
              return onReferenceOpen ? (
                <button
                  key={`${reference.documentName}-${reference.chunkId}`}
                  type="button"
                  className="rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => onReferenceOpen(reference)}
                  aria-label={`打开资料 ${reference.documentName}`}
                >
                  {content}
                </button>
              ) : (
                <article
                  key={`${reference.documentName}-${reference.chunkId}`}
                  className="min-w-0 px-2 py-1.5"
                >
                  {content}
                </article>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
