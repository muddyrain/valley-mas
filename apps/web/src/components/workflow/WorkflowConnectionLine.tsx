import { type ConnectionLineComponentProps, getBezierPath, Position } from '@xyflow/react';

export function WorkflowConnectionLine({
  connectionLineStyle,
  fromHandle,
  fromPosition,
  fromX,
  fromY,
  toPosition,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const isLoopBodyEntry = fromHandle.id === 'entry';
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: isLoopBodyEntry ? Position.Right : fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: isLoopBodyEntry ? Position.Left : toPosition,
    curvature: 0.2,
  });

  return (
    <path
      className="react-flow__connection-path"
      d={path}
      fill="none"
      style={{ stroke: '#3b82f6', strokeWidth: 2, ...connectionLineStyle }}
    />
  );
}
