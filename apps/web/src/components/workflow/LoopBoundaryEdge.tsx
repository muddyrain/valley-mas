import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  Position,
} from '@xyflow/react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeferredNodePicker } from './NodePicker';
import { useDelayedHoverVisibility } from './useDelayedHoverVisibility';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';

/**
 * Connects the loop body boundary to its internal graph.
 *
 * The physical handles live on the body edge (left / right), but the flow
 * direction inside a body is always left-to-right. Overriding the bezier
 * directions avoids a detour outside the body and keeps the arrow forward.
 */
export function LoopBoundaryEdge(props: EdgeProps) {
  const { insertOnEdge, isRunning } = useWorkflowRuntime();
  const { visible: hovered, show, scheduleHide } = useDelayedHoverVisibility();
  const isBodyEntry = props.sourceHandleId === 'entry';
  const isBodyExit = props.targetHandleId === 'exit';
  const isLoopBodyLink = props.sourceHandleId === 'body' && props.targetHandleId === 'loop-entry';
  const interactive = !isLoopBodyLink && !isRunning;
  const stroke = props.style?.stroke ?? '#3b82f6';
  const selectedStroke = '#7c3aed';
  const hoverStroke = '#22c7f3';
  const sourceHandleRadius = 14;
  const targetHandleClearance = 8;
  const edgePositions = isLoopBodyLink
    ? {
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
    : {
        sourcePosition: isBodyEntry ? Position.Right : props.sourcePosition,
        targetPosition: isBodyExit ? Position.Left : props.targetPosition,
      };
  const [path, labelX, labelY] = getBezierPath({
    ...props,
    ...(isLoopBodyLink
      ? {}
      : {
          sourceX: isBodyEntry
            ? props.sourceX + sourceHandleRadius
            : isBodyExit
              ? props.sourceX - 12
              : props.sourceX,
        }),
    ...edgePositions,
    curvature: 0.2,
  });
  const [hoverPath] = getBezierPath({
    ...props,
    ...(isLoopBodyLink
      ? {}
      : {
          sourceX: isBodyEntry
            ? props.sourceX + sourceHandleRadius
            : isBodyExit
              ? props.sourceX - sourceHandleRadius
              : props.sourceX,
          targetX: props.targetX - targetHandleClearance,
        }),
    ...edgePositions,
    curvature: 0.2,
  });

  return (
    <>
      {interactive ? (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={28}
          pointerEvents="stroke"
          className="react-flow__edge-hover-target"
          onPointerEnter={show}
          onPointerLeave={scheduleHide}
        />
      ) : null}
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={{
          ...props.style,
          pointerEvents: interactive ? 'none' : undefined,
          stroke: props.selected ? selectedStroke : stroke,
          strokeWidth: props.selected ? 3 : (props.style?.strokeWidth ?? 2),
        }}
        interactionWidth={interactive ? 0 : 16}
      />
      {interactive && hovered ? (
        <BaseEdge
          path={hoverPath}
          style={{
            ...props.style,
            pointerEvents: 'none',
            stroke: hoverStroke,
            strokeWidth: 2.5,
          }}
          interactionWidth={0}
        />
      ) : null}
      {interactive ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute z-[1001]"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <div
              className={`transition-[opacity,transform] duration-200 ease-out ${
                hovered
                  ? 'pointer-events-auto scale-100 opacity-100'
                  : 'pointer-events-none scale-75 opacity-0'
              }`}
              onPointerEnter={show}
              onPointerLeave={scheduleHide}
              onFocus={show}
              onBlur={scheduleHide}
            >
              <DeferredNodePicker
                trigger={
                  <Button
                    type="button"
                    variant="default"
                    size="icon-sm"
                    className="rounded-full border border-background bg-cyan-500 text-white shadow-md hover:bg-cyan-600"
                    aria-label="在连线中插入节点"
                  >
                    <Plus className="size-4" />
                  </Button>
                }
                onSelect={(item) => insertOnEdge(props.id, item)}
              />
            </div>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
