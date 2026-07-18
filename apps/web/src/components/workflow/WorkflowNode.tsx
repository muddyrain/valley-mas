import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  GitBranch,
  GitMerge,
  Hash,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  Workflow,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { NodePicker } from './NodePicker';
import { NodeRunDetails } from './NodeRunDetails';
import { getNodeConfigSummary, NODE_CONFIGS } from './nodeConfig';
import type { WorkflowNodeData } from './types';
import { validateSingleNode } from './validateWorkflowConfig';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';
import { getWorkflowSideEffectLabel } from './workflowSideEffects';
import { getWorkflowNodeOutputFields } from './workflowVariables';

const iconMap = {
  start: Zap,
  end: Send,
  llm: MessageSquare,
  tool: Wrench,
  condition: GitBranch,
  merge: GitMerge,
  variable: Hash,
  subworkflow: Workflow,
};
const colors = {
  start: 'bg-blue-500/10 text-blue-600',
  end: 'bg-emerald-500/10 text-emerald-600',
  llm: 'bg-violet-500/10 text-violet-600',
  tool: 'bg-orange-500/10 text-orange-600',
  condition: 'bg-green-500/10 text-green-600',
  merge: 'bg-teal-500/10 text-teal-600',
  variable: 'bg-cyan-500/10 text-cyan-600',
  subworkflow: 'bg-indigo-500/10 text-indigo-600',
} as const;

function NodeLabel({ label }: { label: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const update = () => {
      if (element.textContent !== label) return;
      setTruncated(element.scrollWidth > element.clientWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [label]);

  const text = (
    <span ref={textRef} className="block min-w-0 flex-1 truncate text-sm font-medium">
      {label}
    </span>
  );
  if (!truncated) return text;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="block min-w-0 flex-1" />}>{text}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export const WorkflowNode = memo(function WorkflowNode({ id, data, selected }: NodeProps) {
  const { session, connectedSourceNodeIDs, validationErrors, copyNode, deleteNode, insertAfter } =
    useWorkflowRuntime();
  const nodeData = data as unknown as WorkflowNodeData;
  const { label, nodeType, config } = nodeData;
  const snapshot = session.nodes[id];
  const runningState = snapshot?.status;
  const definition = NODE_CONFIGS[nodeType];
  const Icon = iconMap[nodeType] || MessageSquare;
  const hasInput = definition?.handles.input;
  const hasOutput = definition?.handles.output;
  const multiOutputs = definition?.handles.outputs;
  const draftValidationMessage = validationErrors.get(id);
  const validationError = draftValidationMessage ? null : validateSingleNode(nodeData);
  const validationMessage = draftValidationMessage || validationError?.message;
  const hasDraftValidationError = Boolean(draftValidationMessage);
  const incomplete = Boolean(validationError);
  const summary = getNodeConfigSummary(nodeType, config);
  const fixed = definition?.fixed;
  const sideEffect = nodeType === 'tool' ? String(config?.sideEffect || '') : '';
  const sideEffectLabel = getWorkflowSideEffectLabel(sideEffect);
  const nodeKind =
    nodeType === 'tool'
      ? ['工具', sideEffectLabel].filter(Boolean).join(' · ')
      : definition?.label !== label
        ? definition?.label
        : '';
  const configDetail = summary && summary !== label && summary !== nodeKind ? summary : '';
  const outputFields = getWorkflowNodeOutputFields(nodeType, config);

  return (
    <div className="group/node relative w-[264px] cursor-grab overflow-visible active:cursor-grabbing">
      <div className="relative">
        {hasInput ? (
          <Handle
            type="target"
            position={Position.Left}
            id="input"
            className="!size-3 !-left-1.5 !rounded-full !border-2 !border-blue-400 !bg-background"
          />
        ) : null}
        <div
          className={cn(
            'overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-primary/35 hover:bg-card hover:shadow-sm',
            incomplete && !runningState && 'border-amber-500/45 hover:border-amber-500/60',
            hasDraftValidationError &&
              !runningState &&
              'border-destructive/70 ring-1 ring-destructive/20 hover:border-destructive',
            runningState === 'running' && 'border-primary/55 ring-1 ring-primary/10',
            runningState === 'success' &&
              'border-emerald-500/45 ring-1 ring-emerald-500/10 hover:border-emerald-500/65 hover:bg-card',
            runningState === 'error' &&
              'border-destructive/55 ring-1 ring-destructive/10 hover:border-destructive/70',
            runningState === 'skipped' && 'opacity-60',
            selected &&
              !hasDraftValidationError &&
              'border-primary/65 ring-1 ring-primary/25 shadow-sm',
          )}
        >
          <div className="flex min-h-[88px] items-start gap-3 px-4 py-3.5">
            <span
              className={cn(
                'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                colors[nodeType] || colors.start,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <NodeLabel label={label} />
                {validationMessage ? (
                  hasDraftValidationError ? (
                    <AlertCircle
                      aria-label="运行前需完善"
                      className="size-3.5 shrink-0 text-destructive"
                    />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger render={<span className="flex shrink-0" />}>
                        <AlertCircle className="size-3.5 text-orange-500" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-72">
                        {validationMessage}
                      </TooltipContent>
                    </Tooltip>
                  )
                ) : null}
              </div>
              {nodeKind ? (
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {nodeKind}
                </span>
              ) : null}
              {configDetail ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground/70">
                  {configDetail}
                </span>
              ) : null}
              {!nodeKind && !configDetail ? (
                <span className="mt-1 block text-xs text-muted-foreground/70">尚未配置</span>
              ) : null}
            </div>
            <div className="nodrag nopan -mt-1 flex shrink-0 items-center gap-0.5">
              {!fixed ? (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="复制节点"
                  onClick={(event) => {
                    event.stopPropagation();
                    copyNode(id);
                  }}
                >
                  <Copy className="size-3.5" />
                </Button>
              ) : null}
              {!fixed ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="节点菜单"
                        onClick={(event) => event.stopPropagation()}
                      />
                    }
                  >
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => copyNode(id)}>
                      <Copy className="mr-2 size-3.5" />
                      复制
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteNode(id)}>
                      <Trash2 className="mr-2 size-3.5" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {runningState === 'running' ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : null}
              {runningState === 'success' ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : null}
              {runningState === 'error' ? <XCircle className="size-4 text-destructive" /> : null}
              {runningState === 'skipped' ? (
                <Badge variant="outline" className="text-[10px]">
                  已跳过
                </Badge>
              ) : null}
            </div>
          </div>
          {outputFields.length > 0 ? (
            <div className="flex min-h-10 items-center gap-2 border-t border-border bg-muted/20 px-4 py-2 text-xs">
              <span className="shrink-0 text-muted-foreground">输出</span>
              <span className="min-w-0 truncate font-mono font-medium text-foreground">
                {outputFields[0][0]}
              </span>
              <Badge variant="secondary" className="ml-auto shrink-0 px-1.5 font-mono text-[10px]">
                {outputFields[0][1]}
              </Badge>
              {outputFields.length > 1 ? (
                <span className="shrink-0 text-muted-foreground">+{outputFields.length - 1}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {hasOutput ? (
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            className="!size-3 !-right-1.5 !rounded-full !border-2 !border-blue-400 !bg-background"
          />
        ) : null}
        {multiOutputs ? (
          <>
            <Handle
              type="source"
              position={Position.Right}
              id="true"
              style={{ top: '30%' }}
              className="!size-3 !-right-1.5 !rounded-full !border-2 !border-green-500 !bg-background"
            />
            <Handle
              type="source"
              position={Position.Right}
              id="false"
              style={{ top: '70%' }}
              className="!size-3 !-right-1.5 !rounded-full !border-2 !border-red-500 !bg-background"
            />
          </>
        ) : null}
        {nodeType !== 'end' && nodeType !== 'condition' && !connectedSourceNodeIDs.has(id) ? (
          <div className="nodrag nopan absolute left-full top-1/2 z-10 ml-5 -translate-y-1/2 opacity-0 transition-opacity group-hover/node:opacity-100">
            <NodePicker
              side="right"
              align="center"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full bg-background shadow-sm"
                  aria-label={`在 ${label} 后添加节点`}
                >
                  <Plus className="size-4" />
                </Button>
              }
              onSelect={(item) => insertAfter(id, item)}
            />
          </div>
        ) : null}
      </div>
      {snapshot ? <NodeRunDetails snapshot={snapshot} /> : null}
    </div>
  );
});
