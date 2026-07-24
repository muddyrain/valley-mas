import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeferredNodePicker } from './NodePicker';
import { useDelayedHoverVisibility } from './useDelayedHoverVisibility';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';

export function InsertableEdge(props: EdgeProps) {
  const { insertOnEdge, isRunning } = useWorkflowRuntime();
  const { visible: hovered, show, scheduleHide } = useDelayedHoverVisibility();
  const [path, labelX, labelY] = getBezierPath({ ...props, curvature: 0.3 });
  const selectedStroke = '#7c3aed';
  const hoverStroke = '#22c7f3';

  return (
    <>
      {!isRunning ? (
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
          pointerEvents: 'none',
          stroke: hovered ? hoverStroke : props.selected ? selectedStroke : props.style?.stroke,
          strokeWidth: props.selected ? 3 : hovered ? 2.5 : props.style?.strokeWidth,
        }}
        interactionWidth={0}
      />
      {!isRunning ? (
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
