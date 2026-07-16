import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  Code,
  Copy,
  Database,
  FileText,
  GitBranch,
  Globe,
  Hash,
  Keyboard,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PenLine,
  Repeat,
  Send,
  Trash2,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
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
import { getNodeConfigSummary, NODE_CONFIGS } from './nodeConfig';
import { validateSingleNode } from './validateWorkflowConfig';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';

const iconMap: Record<string, typeof Zap> = {
  Zap,
  Keyboard,
  MessageSquare,
  Database,
  FileText,
  Code,
  Globe,
  GitBranch,
  Repeat,
  PenLine,
  Hash,
  Send,
  Upload,
};

interface WorkflowNodeData {
  label: string;
  nodeType: string;
  config?: Record<string, unknown>;
}

const NODE_COLORS: Record<string, { iconBg: string; iconText: string }> = {
  start: { iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  'blog.parseMarkdown': { iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  input: { iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  fileUpload: { iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  llm: { iconBg: 'bg-purple-50', iconText: 'text-purple-600' },
  'llm.text': { iconBg: 'bg-purple-50', iconText: 'text-purple-600' },
  knowledge: { iconBg: 'bg-purple-50', iconText: 'text-purple-600' },
  'knowledge.retrieve': { iconBg: 'bg-purple-50', iconText: 'text-purple-600' },
  code: { iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
  http: { iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
  condition: { iconBg: 'bg-green-50', iconText: 'text-green-600' },
  loop: { iconBg: 'bg-green-50', iconText: 'text-green-600' },
  variable: { iconBg: 'bg-cyan-50', iconText: 'text-cyan-600' },
  'blog.createDraft': { iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
  end: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
};

export function WorkflowNode({ id, data, selected }: NodeProps) {
  const { session, copyNode, deleteNode } = useWorkflowRuntime();
  const { label, nodeType, config } = data as unknown as WorkflowNodeData;
  const snapshot = session.nodes[id];
  const runningState = snapshot?.status;
  const nodeConfig = NODE_CONFIGS[nodeType];
  const Icon = iconMap[nodeConfig?.icon] || MessageSquare;
  const colors = NODE_COLORS[nodeType] || NODE_COLORS.start;
  const isRunnable = Boolean(nodeConfig) && nodeConfig.available !== false;
  const summary = isRunnable
    ? getNodeConfigSummary(nodeType, config)
    : nodeConfig
      ? '当前为计划中节点'
      : '未识别的节点类型';
  const hasInput = nodeConfig?.handles?.input;
  const hasOutput = nodeConfig?.handles?.output;
  const multiOutputs = nodeConfig?.handles?.outputs;
  const isConfigIncomplete = isRunnable
    ? Boolean(validateSingleNode({ label, nodeType, config }))
    : false;
  const isPlanNode = !nodeConfig || nodeConfig.available === false;
  const isFixed = nodeConfig?.fixed;
  const ioSummary = [
    hasInput ? '输入: 1 项' : null,
    hasOutput || multiOutputs ? `输出: ${multiOutputs || 1} 项` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="relative w-[220px] cursor-grab overflow-visible active:cursor-grabbing">
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !-left-1.5 !rounded-full !bg-white !border-2 !border-blue-400"
        />
      )}
      <div
        className={cn(
          'group overflow-hidden rounded-lg border border-border bg-card shadow-xs transition-all duration-200',
          selected &&
            'border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-background shadow-sm',
          !isRunnable && 'border-amber-500/40 bg-amber-500/5',
          isConfigIncomplete &&
            !runningState &&
            'border-destructive/50 ring-2 ring-destructive/15 ring-offset-2',
          runningState === 'running' && 'border-primary ring-2 ring-primary/30 ring-offset-2',
          runningState === 'success' &&
            'border-emerald-600/50 ring-2 ring-emerald-500/20 ring-offset-2',
          runningState === 'error' &&
            'border-destructive/50 ring-2 ring-destructive/20 ring-offset-2',
        )}
      >
        <div className="flex h-[92px] items-center gap-3 px-4 py-3">
          <div className={cn('flex items-center justify-center rounded-full p-2', colors.iconBg)}>
            <Icon className={cn('h-4 w-4', colors.iconText)} />
          </div>
          <div className="min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger render={<div className="flex items-center gap-2" />}>
                <span className="truncate text-sm font-medium text-foreground">{label}</span>
                {isPlanNode && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700">
                    计划中
                  </Badge>
                )}
                {isConfigIncomplete && (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px]">
                <div className="space-y-0.5">
                  <div className="font-medium">{label}</div>
                  {nodeConfig?.description && (
                    <div className="text-xs opacity-80">{nodeConfig.description}</div>
                  )}
                  {summary && <div className="text-xs opacity-60">{summary}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {summary || '尚未配置'}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground/70">
              {ioSummary || '无输入/输出'}
            </span>
          </div>
          <div className="nodrag nopan flex items-center gap-0.5">
            {!isFixed && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyNode(id);
                      }}
                      aria-label="复制节点"
                    />
                  }
                >
                  <Copy className="h-3.5 w-3.5 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent side="top">复制节点</TooltipContent>
              </Tooltip>
            )}
            {!isFixed && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(event) => event.stopPropagation()}
                      aria-label="节点菜单"
                    />
                  }
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    onClick={() => copyNode(id)}
                    onSelect={(event) => event.stopPropagation()}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    复制
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => deleteNode(id)}
                    className="text-red-500"
                    onSelect={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {runningState === 'running' && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
            )}
            {runningState === 'success' && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {snapshot.durationMs != null && <span>{snapshot.durationMs}ms</span>}
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              </div>
            )}
            {runningState === 'error' && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
          </div>
        </div>
      </div>
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="!w-3 !h-3 !-right-1.5 !rounded-full !bg-white !border-2 !border-blue-400"
        />
      )}
      {multiOutputs && multiOutputs > 1 && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="output-true"
            style={{ top: '30%' }}
            className="!w-3 !h-3 !-right-1.5 !rounded-full !bg-white !border-2 !border-green-400"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="output-false"
            style={{ top: '70%' }}
            className="!w-3 !h-3 !-right-1.5 !rounded-full !bg-white !border-2 !border-red-400"
          />
        </>
      )}
    </div>
  );
}
