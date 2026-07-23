import { Handle, type NodeProps, Position } from '@xyflow/react';
import { Plus, Repeat2 } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { NodePicker } from './NodePicker';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';

export const LoopBodyNode = memo(function LoopBodyNode({ data }: NodeProps) {
  const bodyNodeCount = typeof data?.nodeCount === 'number' ? data.nodeCount : 0;
  const loopID = typeof data?.loopParentId === 'string' ? data.loopParentId : '';
  const { addLoopBodyNode } = useWorkflowRuntime();
  return (
    <div className="h-full min-h-[300px] w-full cursor-grab rounded-xl border-2 border-primary/50 bg-card/85 shadow-sm active:cursor-grabbing">
      <Handle
        type="target"
        position={Position.Top}
        id="loop-entry"
        className="!size-3 !-top-1.5 !border-2 !border-primary !bg-background"
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="entry"
        className="!size-3 !-left-1.5 !border-2 !border-primary !bg-background"
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="exit"
        className="!size-3 !-right-1.5 !border-2 !border-primary !bg-background"
        isConnectable={false}
      />
      <div className="flex h-14 items-center gap-2 border-b border-primary/15 px-4 text-sm font-semibold text-foreground">
        <span className="flex size-7 items-center justify-center rounded-md bg-teal-500/10 text-teal-600">
          <Repeat2 className="size-4" />
        </span>
        循环体
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {bodyNodeCount} 个节点
        </span>
        <NodePicker
          side="right"
          align="start"
          trigger={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="nodrag nopan h-7 gap-1 px-2 text-xs"
              disabled={!loopID}
            >
              <Plus className="size-3.5" />
              添加节点
            </Button>
          }
          onSelect={(item) => addLoopBodyNode(loopID, item)}
        />
      </div>
      <div className="pointer-events-none px-4 pt-3 text-xs text-muted-foreground">
        当前项、索引和中间变量仅在此区域内可用
      </div>
    </div>
  );
});
