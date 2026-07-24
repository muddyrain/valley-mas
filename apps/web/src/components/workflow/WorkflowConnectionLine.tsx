import { type ConnectionLineComponentProps, getBezierPath, Position } from '@xyflow/react';

export function WorkflowConnectionLine({
  connectionLineStyle,
  fromHandle,
  fromPosition,
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  const isLoopBodyEntry = fromHandle.id === 'entry';
  // A connection being dragged past a right-side handle does not have a target
  // handle yet. React Flow then reuses that handle's right-facing direction,
  // causing the preview curve to overshoot and bend back at the pointer.
  // Infer the endpoint direction from the actual drag vector instead.
  const targetPosition = toX >= fromX ? Position.Left : Position.Right;
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: isLoopBodyEntry ? Position.Right : fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: isLoopBodyEntry ? Position.Left : targetPosition,
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
