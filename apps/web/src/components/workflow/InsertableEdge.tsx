import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { NodePicker } from './NodePicker';
import { useWorkflowRuntime } from './WorkflowRuntimeContext';

export function InsertableEdge(props: EdgeProps) {
  const { insertOnEdge } = useWorkflowRuntime();
  const [hovered, setHovered] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const [path, labelX, labelY] = getBezierPath({ ...props, curvature: 0.3 });
  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    },
    [],
  );
  const showButton = () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    setHovered(true);
  };
  const scheduleHideButton = () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setHovered(false), 120);
  };
  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={28}
        pointerEvents="stroke"
        className="react-flow__edge-hover-target"
        onMouseEnter={showButton}
        onMouseLeave={scheduleHideButton}
      />
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd}
        style={{
          ...props.style,
          pointerEvents: 'none',
          strokeWidth: props.selected ? 3 : hovered ? 2.5 : props.style?.strokeWidth,
        }}
        interactionWidth={0}
      />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan absolute z-10 transition-opacity ${hovered ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onMouseEnter={showButton}
          onMouseLeave={scheduleHideButton}
          onFocus={showButton}
          onBlur={scheduleHideButton}
        >
          <NodePicker
            trigger={
              <Button
                type="button"
                variant="default"
                size="icon-xs"
                className="rounded-full border border-blue-500 bg-blue-500 text-white shadow-sm hover:bg-blue-600"
                aria-label="在连线中插入节点"
              >
                <Plus className="size-3" />
              </Button>
            }
            onSelect={(item) => insertOnEdge(props.id, item)}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
