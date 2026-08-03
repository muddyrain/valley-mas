import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleX,
  FileText,
  LoaderCircle,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import type { AIAppConversationToolTrace, AIAppRun, AIKnowledgeReference } from '@/api/aiWorkbench';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  type AssistantStreamTool,
  formatAssistantExecution,
  formatAssistantToolAction,
  formatAssistantToolSummary,
  hasAssistantExecutionDetails,
  shouldShowAssistantExecutionReferences,
} from './execution';

type ExecutionTool = AssistantStreamTool | AIAppConversationToolTrace;

function useElapsedSeconds(startedAt: number) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
  );

  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return seconds;
}

function ToolStatusIcon({ status }: { status: ExecutionTool['status'] }) {
  if (status === 'running') return <LoaderCircle className="size-3.5 animate-spin" />;
  if (status === 'failed') return <CircleX className="size-3.5 text-destructive" />;
  return <Check className="size-3.5" />;
}

function ExecutionToolList({ tools, live = false }: { tools: ExecutionTool[]; live?: boolean }) {
  const [open, setOpen] = useState(true);
  if (tools.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex min-w-0 items-center gap-1.5 rounded-sm py-1 text-left text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <Wrench className="size-3.5" />
        <span className="truncate">
          {formatAssistantToolSummary(tools.map((tool) => tool.toolName))}
        </span>
        <ChevronDown
          className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-1 space-y-2.5 text-xs text-muted-foreground">
          {tools.map((tool) => (
            <li key={tool.id} className="space-y-1.5 py-0.5">
              {tool.narration?.trim() ? (
                <p className="text-sm leading-6 whitespace-pre-wrap text-foreground">
                  {tool.narration.trim()}
                </p>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="flex size-4 shrink-0 items-center justify-center">
                  <ToolStatusIcon status={tool.status} />
                </span>
                <span className={cn(tool.status === 'failed' && 'text-destructive')}>
                  执行命令 {formatAssistantToolAction(tool.toolName)}
                </span>
                {!live && tool.durationMs > 0 ? (
                  <span className="text-muted-foreground/70">
                    {Math.max(1, Math.round(tool.durationMs / 1000))} 秒
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ExecutionReferences({
  references,
  onReferenceOpen,
}: {
  references: AIKnowledgeReference[];
  onReferenceOpen: (reference: AIKnowledgeReference) => void;
}) {
  const [open, setOpen] = useState(true);
  if (references.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 rounded-sm py-1 text-left text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <BookOpen className="size-3.5" />
        <span>参考 {references.length} 个知识片段</span>
        <ChevronDown
          className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-1 space-y-1">
          {references.map((reference) => (
            <li key={`${reference.documentName}-${reference.chunkId}`}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-xs text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => onReferenceOpen(reference)}
                aria-label={`打开资料 ${reference.documentName}`}
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{reference.documentName}</span>
              </button>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AssistantExecutionHeader({
  run,
  traces,
  references,
  defaultOpen = false,
  onReferenceOpen,
}: {
  run: AIAppRun | null;
  traces: AIAppConversationToolTrace[];
  references: AIKnowledgeReference[];
  defaultOpen?: boolean;
  onReferenceOpen: (reference: AIKnowledgeReference) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const visibleReferences = shouldShowAssistantExecutionReferences(run, references)
    ? references
    : [];

  if (!hasAssistantExecutionDetails(traces, visibleReferences)) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 border-b-2 border-border pb-2.5 text-left text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset">
        <span>{formatAssistantExecution(run)}</span>
        <ChevronRight
          className={cn('size-3.5 transition-transform duration-200', open && 'rotate-90')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 border-b-2 border-border py-3">
        <ExecutionToolList tools={traces} />
        <ExecutionReferences references={visibleReferences} onReferenceOpen={onReferenceOpen} />
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AssistantActiveExecution({
  startedAt,
  reply,
  tools,
  children,
}: {
  startedAt: number;
  reply: string;
  tools: AssistantStreamTool[];
  children?: ReactNode;
}) {
  const elapsedSeconds = useElapsedSeconds(startedAt);
  const executing = tools.length > 0;
  const hasReply = Boolean(reply.trim());
  const [open, setOpen] = useState(false);

  if (!executing && !hasReply) {
    return (
      <div
        className="flex min-w-0 w-full max-w-[52rem] items-center gap-2 pt-1 text-sm font-medium text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <span className="relative flex size-4 items-center justify-center" aria-hidden="true">
          <span className="absolute size-3 animate-ping rounded-full bg-primary/20" />
          <span className="size-1.5 rounded-full bg-primary" />
        </span>
        <span>正在思考</span>
      </div>
    );
  }

  const statusLabel = `${executing ? '正在执行' : '正在思考'} ${elapsedSeconds} 秒`;

  if (!executing) {
    return (
      <div className="min-w-0 w-full max-w-[52rem] pt-1">
        <div
          className="flex w-full items-center gap-2 border-b-2 border-border pb-2.5 text-sm font-medium text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle className="size-4 animate-spin text-primary" />
          <span>{statusLabel}</span>
        </div>
        <p
          className="pt-3 text-sm leading-6 whitespace-pre-wrap text-foreground"
          aria-live="polite"
        >
          {reply.trim()}
        </p>
        {children ? <div className="pt-4">{children}</div> : null}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 w-full max-w-[52rem] pt-1">
      <div role="status" aria-live="polite">
        <CollapsibleTrigger
          className="group flex w-full items-center gap-2 border-b-2 border-border pb-2.5 text-left text-sm font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
          aria-label={open ? '收起执行过程' : '展开执行过程'}
        >
          <LoaderCircle className="size-4 animate-spin text-primary" />
          <span>{statusLabel}</span>
          <ChevronDown
            className={cn('size-3.5 transition-transform duration-200', open && 'rotate-180')}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="py-3">
        <ExecutionToolList tools={tools} live />
      </CollapsibleContent>
      {hasReply ? (
        <p
          className={cn(
            'text-sm leading-6 whitespace-pre-wrap text-foreground',
            open ? 'pt-1' : 'pt-3',
          )}
          aria-live="polite"
        >
          {reply.trim()}
        </p>
      ) : null}
      {children ? <div className={cn(hasReply || open ? 'pt-4' : 'pt-3')}>{children}</div> : null}
    </Collapsible>
  );
}
