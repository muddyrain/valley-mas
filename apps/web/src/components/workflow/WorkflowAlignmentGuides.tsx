import { ViewportPortal } from '@xyflow/react';
import type { WorkflowAlignment } from './workflowAlignment';

export function WorkflowAlignmentGuides({ alignment }: { alignment: WorkflowAlignment | null }) {
  if (!alignment?.vertical && !alignment?.horizontal) return null;

  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-[1] overflow-visible"
        height="1"
        width="1"
      >
        {alignment.vertical ? (
          <line
            x1={alignment.vertical.position}
            x2={alignment.vertical.position}
            y1={alignment.vertical.start}
            y2={alignment.vertical.end}
            stroke="hsl(var(--primary))"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeOpacity="0.8"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {alignment.horizontal ? (
          <line
            x1={alignment.horizontal.start}
            x2={alignment.horizontal.end}
            y1={alignment.horizontal.position}
            y2={alignment.horizontal.position}
            stroke="hsl(var(--primary))"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeOpacity="0.8"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </ViewportPortal>
  );
}
