import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  GitBranch,
  GitMerge,
  Hash,
  Lightbulb,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Repeat2,
  Send,
  Trash2,
  Workflow,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { listAvailableAIModels } from '@/api/ai';
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
import { DeferredNodePicker } from './NodePicker';
import { NodeRunDetails } from './NodeRunDetails';
import { getNodeConfigSummary, NODE_CONFIGS } from './nodeConfig';
import type { WorkflowNodeData } from './types';
import { validateSingleNode } from './validateWorkflowConfig';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';
import { getWorkflowRunBranchHandle } from './workflowRunBranches';
import { getWorkflowSideEffectLabel } from './workflowSideEffects';
import { getWorkflowNodeOutputFields } from './workflowVariables';

const iconMap = {
  start: Zap,
  end: Send,
  llm: MessageSquare,
  tool: Wrench,
  condition: GitBranch,
  switch: GitBranch,
  merge: GitMerge,
  variable: Hash,
  subworkflow: Workflow,
  intent: Lightbulb,
  loop: Repeat2,
  set_loop_variable: Hash,
  continue_loop: Repeat2,
  terminate_loop: Repeat2,
};
const colors = {
  start: 'bg-blue-500/10 text-blue-600',
  end: 'bg-emerald-500/10 text-emerald-600',
  llm: 'bg-violet-500/10 text-violet-600',
  tool: 'bg-orange-500/10 text-orange-600',
  condition: 'bg-green-500/10 text-green-600',
  switch: 'bg-green-500/10 text-green-600',
  merge: 'bg-teal-500/10 text-teal-600',
  variable: 'bg-cyan-500/10 text-cyan-600',
  subworkflow: 'bg-indigo-500/10 text-indigo-600',
  intent: 'bg-cyan-500/10 text-cyan-600',
  set_loop_variable: 'bg-teal-500/10 text-teal-600',
  continue_loop: 'bg-teal-500/10 text-teal-600',
  terminate_loop: 'bg-teal-500/10 text-teal-600',
  loop: 'bg-teal-500/10 text-teal-600',
} as const;

const textModelNames = new Map<string, string>();
let textModelNamesRequest: Promise<void> | null = null;

function loadTextModelNames() {
  if (!textModelNamesRequest) {
    textModelNamesRequest = listAvailableAIModels('text')
      .then(({ list }) => {
        for (const model of list) textModelNames.set(model.id, model.displayName);
      })
      .catch(() => undefined);
  }
  return textModelNamesRequest;
}

function useTextModelName(modelID: unknown, configuredName: unknown) {
  const configured = typeof configuredName === 'string' ? configuredName.trim() : '';
  const [name, setName] = useState(configured);

  useEffect(() => {
    if (configured) {
      setName(configured);
      return;
    }
    if (typeof modelID !== 'string' || !modelID) {
      setName('');
      return;
    }
    const cached = textModelNames.get(modelID);
    if (cached) {
      setName(cached);
      return;
    }
    let active = true;
    void loadTextModelNames().then(() => {
      if (active) setName(textModelNames.get(modelID) || '');
    });
    return () => {
      active = false;
    };
  }, [configured, modelID]);

  return name;
}

function getIntentBranchOutputs(config: Record<string, unknown> | undefined) {
  const intents = Array.isArray(config?.intents) ? config.intents : [];
  return [
    ...intents.flatMap((intent) => {
      if (!intent || typeof intent !== 'object') return [];
      const { id, name } = intent as { id?: unknown; name?: unknown };
      return typeof id === 'string' && typeof name === 'string' && id
        ? [{ id: `intent:${id}`, name }]
        : [];
    }),
    { id: 'intent:other', name: '其他' },
  ];
}

function getSwitchBranchOutputs(config: Record<string, unknown> | undefined) {
  const cases = Array.isArray(config?.cases) ? config.cases : [];
  return [
    ...cases.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const { id, label } = item as { id?: unknown; label?: unknown };
      return typeof id === 'string' && typeof label === 'string' && id
        ? [{ id: `case:${id}`, name: label }]
        : [];
    }),
    { id: 'default', name: '默认' },
  ];
}

function getVariableReferenceLabel(value: unknown) {
  if (typeof value !== 'string') return '';
  const reference = value.match(/^\{\{\s*([^{}]+?)\s*\}\}$/)?.[1];
  const parts = reference?.split('.') || [];
  return parts[parts.length - 1] || value.trim();
}

function LoopVariableRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex min-h-5 items-center gap-2">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      {values.length ? (
        <div className="flex min-w-0 flex-wrap gap-1">
          {values.map((value) => (
            <span
              key={value}
              className="max-w-full truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground"
            >
              {value}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground/70">未配置</span>
      )}
    </div>
  );
}

function LoopVariableSummary({ config }: { config?: Record<string, unknown> }) {
  const mode = config?.mode;
  const input =
    mode === 'array'
      ? getVariableReferenceLabel(config?.input)
      : mode === 'count'
        ? `次数 ${String(config?.count || '')}`.trim()
        : mode === 'infinite'
          ? `最大 ${String(config?.maxIterations || 10)} 轮`
          : '';
  const middleVariables = Array.isArray(config?.middleVariables)
    ? config.middleVariables.flatMap((variable) => {
        if (!variable || typeof variable !== 'object') return [];
        const name = (variable as { name?: unknown }).name;
        return typeof name === 'string' && name.trim() ? [name.trim()] : [];
      })
    : [];
  const outputs = Array.isArray(config?.outputs)
    ? config.outputs.flatMap((output) => {
        if (!output || typeof output !== 'object') return [];
        const name = (output as { name?: unknown }).name;
        return typeof name === 'string' && name.trim() ? [name.trim()] : [];
      })
    : [];

  return (
    <div className="space-y-1.5 border-t border-border bg-muted/10 px-4 py-2 text-xs">
      <LoopVariableRow label="输入" values={input ? [input] : []} />
      <LoopVariableRow label="中间变量" values={['item', 'index', ...middleVariables]} />
      <LoopVariableRow label="输出" values={outputs} />
    </div>
  );
}

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
  const {
    session,
    isRunning,
    validationErrors,
    copyNode,
    deleteNode,
    insertAfter,
    outputPickerNodeId,
    connectingOutputNodeId,
    openOutputPicker,
    closeOutputPicker,
  } = useWorkflowRuntime();
  const nodeData = data as unknown as WorkflowNodeData;
  const { label, nodeType, config } = nodeData;
  const snapshot = session.nodes[id];
  const runningState = snapshot?.status;
  const definition = NODE_CONFIGS[nodeType];
  const Icon = iconMap[nodeType] || MessageSquare;
  const hasInput = definition?.handles.input;
  const branchOutputs =
    nodeType === 'condition'
      ? [
          { id: 'true', name: 'true' },
          { id: 'false', name: 'false' },
        ]
      : nodeType === 'intent'
        ? getIntentBranchOutputs(config)
        : nodeType === 'switch'
          ? getSwitchBranchOutputs(config)
          : [];
  const activeBranchID =
    runningState === 'success' ? getWorkflowRunBranchHandle(nodeType, snapshot?.output) : null;
  const hasOutput = definition?.handles.output && branchOutputs.length === 0;
  const draftValidationMessage = validationErrors.get(id);
  const validationError = draftValidationMessage ? null : validateSingleNode(nodeData);
  const validationMessage = draftValidationMessage || validationError?.message;
  const hasDraftValidationError = Boolean(draftValidationMessage);
  const incomplete = Boolean(validationError);
  const textModelName = useTextModelName(
    nodeType === 'llm' ? config?.modelId : undefined,
    nodeType === 'llm' ? config?.modelName : undefined,
  );
  const summary =
    nodeType === 'llm' && textModelName
      ? textModelName
      : getNodeConfigSummary(nodeType, config, nodeData.loopBodyNodeCount);
  const fixed = definition?.fixed;
  const sideEffect = nodeType === 'tool' ? String(config?.sideEffect || '') : '';
  const sideEffectLabel = getWorkflowSideEffectLabel(sideEffect);
  const nodeKind =
    nodeType === 'tool'
      ? ['工具', sideEffectLabel].filter(Boolean).join(' · ')
      : definition?.label !== label
        ? definition?.label
        : '';
  const configDetail =
    summary && summary !== label && summary !== nodeKind
      ? nodeType === 'llm'
        ? `模型 · ${summary}`
        : summary
      : '';
  const outputFields = getWorkflowNodeOutputFields(nodeType, config);
  const outputPickerOpen = outputPickerNodeId === id;
  const outputConnecting = connectingOutputNodeId === id;

  return (
    <div className="group/node relative w-[264px] cursor-grab overflow-visible active:cursor-grabbing">
      <div className="relative">
        {hasInput ? (
          <Handle
            type="target"
            position={Position.Left}
            id="input"
            isConnectable={!isRunning}
            className="!z-30 !size-3 !-left-1.5 !rounded-full !border-2 !border-blue-500 !bg-blue-500"
          />
        ) : null}
        <div
          className={cn(
            'workflow-node-card overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-colors duration-100 hover:border-primary/35 hover:bg-card',
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
                    <Tooltip>
                      <TooltipTrigger render={<span className="flex shrink-0" />}>
                        <AlertCircle
                          aria-label="运行前需完善"
                          className="size-3.5 text-destructive"
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-72">
                        {validationMessage}
                      </TooltipContent>
                    </Tooltip>
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
                  disabled={isRunning}
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
                        disabled={isRunning}
                        onClick={(event) => event.stopPropagation()}
                      />
                    }
                  >
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={isRunning} onClick={() => copyNode(id)}>
                      <Copy className="mr-2 size-3.5" />
                      复制
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      disabled={isRunning}
                      onClick={() => deleteNode(id)}
                    >
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
          {nodeType === 'loop' ? <LoopVariableSummary config={config} /> : null}
          {nodeType !== 'loop' && outputFields.length > 0 ? (
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
          {(nodeType === 'intent' || nodeType === 'switch') && branchOutputs.length ? (
            <div className="space-y-1 border-t border-border bg-muted/10 px-4 py-1.5 text-xs">
              {branchOutputs.map((branch, index) => {
                const isActiveBranch = activeBranchID === branch.id;
                return (
                  <div
                    key={branch.id}
                    className={cn(
                      'flex min-h-6 items-center gap-2 rounded-md px-1',
                      isActiveBranch && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                    )}
                  >
                    <span
                      className={cn(
                        'w-7 shrink-0 text-muted-foreground',
                        isActiveBranch && 'text-emerald-600 dark:text-emerald-400',
                      )}
                    >
                      {index === 0 ? '输出' : ''}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 truncate text-muted-foreground',
                        isActiveBranch && 'font-medium text-emerald-700 dark:text-emerald-400',
                      )}
                    >
                      {branch.name}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
        {hasOutput ? (
          <Handle
            type="source"
            position={Position.Right}
            id="output"
            aria-label={`在 ${label} 后添加节点`}
            onClick={(event) => {
              event.stopPropagation();
              if (!isRunning && !outputConnecting) openOutputPicker(id);
            }}
            isConnectable={!isRunning}
            className={cn(
              '!z-30 !flex !size-3 !-right-1.5 !items-center !justify-center !rounded-full !border-2 !border-blue-500 !bg-blue-500 !transition-[width,height,right,background-color,border-color] !duration-150',
              'group-hover/node:!size-8 group-hover/node:!-right-1.5 group-hover/node:!border-0 group-hover/node:!bg-primary',
              outputConnecting && '!size-3 !-right-1.5 !border-2 !border-blue-500 !bg-blue-500',
            )}
          >
            <Plus
              className={cn(
                'pointer-events-none size-4 scale-75 text-primary-foreground opacity-0 transition-[opacity,transform] duration-150',
                'group-hover/node:scale-100 group-hover/node:opacity-100',
                outputConnecting && 'opacity-0',
              )}
            />
          </Handle>
        ) : null}
        {nodeType === 'loop' ? (
          <Handle
            type="source"
            position={Position.Bottom}
            id="body"
            isConnectable={false}
            className="!z-30 !size-3 !-bottom-1.5 !border-2 !border-blue-500 !bg-blue-500"
          />
        ) : null}
        {branchOutputs.length
          ? branchOutputs.map((branch, index) => (
              <Handle
                key={branch.id}
                type="source"
                position={Position.Right}
                id={branch.id}
                title={branch.name}
                isConnectable={!isRunning}
                style={{
                  top:
                    nodeType === 'intent' || nodeType === 'switch'
                      ? `${((142 + index * 28) / (128 + branchOutputs.length * 28)) * 100}%`
                      : `${((index + 1) / (branchOutputs.length + 1)) * 100}%`,
                }}
                className={cn(
                  '!size-3 !-right-1.5 !rounded-full !border-2 !bg-background',
                  branch.id === 'true'
                    ? '!border-green-500'
                    : branch.id === 'false'
                      ? '!border-red-500'
                      : branch.id === 'intent:other'
                        ? '!border-slate-400'
                        : branch.id === 'default'
                          ? '!border-slate-400'
                          : '!border-cyan-500',
                  activeBranchID === branch.id && '!border-emerald-500 !bg-emerald-50',
                )}
              />
            ))
          : null}
        {nodeType !== 'end' &&
        nodeType !== 'condition' &&
        nodeType !== 'switch' &&
        nodeType !== 'intent' &&
        hasOutput ? (
          <DeferredNodePicker
            open={outputPickerOpen}
            onOpenChange={(open) => {
              if (!open) closeOutputPicker(id);
            }}
            side="right"
            align="center"
            trigger={
              <span
                aria-hidden="true"
                className="nodrag nopan pointer-events-none absolute right-0 top-1/2 z-20 size-8 -translate-y-1/2 translate-x-1/2"
              />
            }
            onSelect={(item) => insertAfter(id, item)}
          />
        ) : null}
      </div>
      {snapshot ? (
        <div className="absolute left-0 top-full z-40 w-full">
          <NodeRunDetails snapshot={snapshot} />
        </div>
      ) : null}
    </div>
  );
});
