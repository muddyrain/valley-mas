import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Database,
  GitBranch,
  Globe,
  Hash,
  Keyboard,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Repeat,
  Send,
  Trash2,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getNodeConfigSummary, NODE_CONFIGS } from './nodeConfig';
import type { NodeResult } from './RunPanel';
import { validateSingleNode } from './validateWorkflowConfig';

const iconMap: Record<string, typeof Zap> = {
  Zap,
  Keyboard,
  MessageSquare,
  Database,
  Code,
  Globe,
  GitBranch,
  Repeat,
  Hash,
  Send,
  Upload,
};

interface WorkflowNodeData {
  label: string;
  nodeType: string;
  config?: Record<string, unknown>;
  runningState?: 'idle' | 'running' | 'success' | 'error';
}

interface WorkflowNodeProps extends NodeProps {
  onCopy?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  nodeResult?: NodeResult;
}

const NODE_COLORS: Record<string, { iconBg: string; iconText: string }> = {
  start: { iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  input: { iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  fileUpload: { iconBg: 'bg-blue-50', iconText: 'text-blue-600' },
  llm: { iconBg: 'bg-purple-50', iconText: 'text-purple-600' },
  knowledge: { iconBg: 'bg-purple-50', iconText: 'text-purple-600' },
  code: { iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
  http: { iconBg: 'bg-orange-50', iconText: 'text-orange-600' },
  condition: { iconBg: 'bg-green-50', iconText: 'text-green-600' },
  loop: { iconBg: 'bg-green-50', iconText: 'text-green-600' },
  variable: { iconBg: 'bg-cyan-50', iconText: 'text-cyan-600' },
  end: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
};

export function WorkflowNode({ data, selected, onCopy, onDelete, nodeResult }: WorkflowNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const { label, nodeType, config, runningState } = data as unknown as WorkflowNodeData;
  const nodeConfig = NODE_CONFIGS[nodeType];
  const Icon = iconMap[nodeConfig?.icon] || MessageSquare;
  const colors = NODE_COLORS[nodeType] || NODE_COLORS.start;
  const summary = getNodeConfigSummary(nodeType, config);
  const hasInput = nodeConfig?.handles?.input;
  const hasOutput = nodeConfig?.handles?.output;
  const multiOutputs = nodeConfig?.handles?.outputs;

  const isConfigIncomplete = !!validateSingleNode({ label, nodeType, config });
  const isFixed = nodeConfig?.fixed;
  const hasResult = nodeResult && (nodeResult.input || nodeResult.output || nodeResult.error);

  return (
    <div
      className={cn(
        'w-[220px] rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing overflow-hidden group',
        selected && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white shadow-md',
        isConfigIncomplete &&
          !runningState &&
          'border-orange-300 ring-2 ring-orange-200 ring-offset-2',
        runningState === 'running' &&
          'ring-2 ring-blue-400 ring-offset-2 shadow-blue-100 animate-pulse',
        runningState === 'success' && 'ring-2 ring-green-400 ring-offset-2 shadow-green-100',
        runningState === 'error' && 'ring-2 ring-red-400 ring-offset-2 shadow-red-100',
      )}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !-left-1.5 !rounded-full !bg-white !border-2 !border-blue-400"
        />
      )}

      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn('flex items-center justify-center rounded-full p-2', colors.iconBg)}>
          <Icon className={cn('h-4 w-4', colors.iconText)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 truncate">{label}</span>
            {isConfigIncomplete && <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
          </div>
          {summary && (
            <span className="text-xs text-gray-500 truncate block mt-0.5">{summary}</span>
          )}
          {(hasInput || hasOutput) && (
            <span className="text-xs text-gray-400 truncate block mt-0.5">
              {hasInput && '输入: 1 项'}
              {hasInput && hasOutput && ' · '}
              {hasOutput && '输出: 1 项'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {!isFixed && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCopy?.(data.id as string);
              }}
              className="p-1.5 rounded hover:bg-gray-100 transition-all duration-200"
              title="复制"
            >
              <Copy className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
          {!isFixed && (
            <DropdownMenu>
              <DropdownMenuTrigger className="p-1.5 rounded hover:bg-gray-100 transition-all duration-200">
                <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem onClick={() => onCopy?.(data.id as string)}>
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  复制
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete?.(data.id as string)}
                  className="text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {runningState === 'running' && (
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
          )}
          {runningState === 'success' && (
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          )}
          {runningState === 'error' && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
        </div>
      </div>

      {(runningState || hasResult) && (
        <div
          className={cn(
            'border-t border-gray-100 px-4 py-2 cursor-pointer transition-colors',
            runningState === 'running' && 'bg-blue-50/60',
            runningState === 'success' && 'bg-green-50/60',
            runningState === 'error' && 'bg-red-50/60',
            runningState === 'idle' && hasResult && 'bg-gray-50/50 hover:bg-gray-100',
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (hasResult) setExpanded(!expanded);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {runningState === 'running' && (
                <>
                  <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                  <span className="text-xs text-blue-600 font-medium">试运行中...</span>
                </>
              )}
              {runningState === 'success' && (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-600 font-medium">运行成功</span>
                  {nodeResult?.duration != null && (
                    <span className="text-xs text-green-500">{nodeResult.duration}ms</span>
                  )}
                </>
              )}
              {runningState === 'error' && (
                <>
                  <XCircle className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-600 font-medium">运行失败</span>
                </>
              )}
            </div>
            {hasResult && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="p-0.5 rounded hover:bg-gray-200/50 transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3 text-gray-500" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-gray-500" />
                )}
              </button>
            )}
          </div>

          {hasResult && expanded && (
            <div className="mt-3 space-y-3">
              {nodeResult?.input && (
                <div className="bg-white rounded-lg border border-gray-200 p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    <span className="text-xs font-medium text-gray-500">输入</span>
                  </div>
                  <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-all">
                    {typeof nodeResult.input === 'string'
                      ? nodeResult.input
                      : JSON.stringify(nodeResult.input, null, 2)}
                  </pre>
                </div>
              )}
              {nodeResult?.output && (
                <div className="bg-white rounded-lg border border-gray-200 p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-xs font-medium text-gray-500">输出</span>
                  </div>
                  <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-all">
                    {typeof nodeResult.output === 'string'
                      ? nodeResult.output
                      : JSON.stringify(nodeResult.output, null, 2)}
                  </pre>
                </div>
              )}
              {nodeResult?.error && (
                <div className="bg-red-50 rounded-lg border border-red-200 p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-xs font-medium text-red-600">错误</span>
                  </div>
                  <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap break-all">
                    {nodeResult.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
