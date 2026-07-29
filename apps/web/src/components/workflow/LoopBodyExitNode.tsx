import { Handle, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';

export const LoopBodyExitNode = memo(function LoopBodyExitNode(_: NodeProps) {
  const { isRunning } = useWorkflowRuntime();

  return (
    <div className="size-px">
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        isConnectable={!isRunning}
        className="!z-30 !size-3 !-left-1.5 !rounded-full !border-2 !border-primary !bg-primary"
      />
    </div>
  );
});
