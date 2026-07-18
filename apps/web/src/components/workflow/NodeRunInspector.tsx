import { NodeRunDetails } from './NodeRunDetails';
import type { NodeRunSnapshot } from './runSession';

export function NodeRunInspector({ snapshot }: { snapshot: NodeRunSnapshot }) {
  return <NodeRunDetails snapshot={snapshot} variant="panel" />;
}
