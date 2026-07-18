import { createContext, type ReactNode, useContext } from 'react';
import type { NodePickerItem } from './NodePicker';
import type { WorkflowRunSession } from './runSession';

interface WorkflowRuntimeContextValue {
  session: WorkflowRunSession;
  connectedSourceNodeIDs: ReadonlySet<string>;
  validationErrors: ReadonlyMap<string, string>;
  copyNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  insertAfter: (nodeId: string, item: NodePickerItem) => void;
  insertOnEdge: (edgeId: string, item: NodePickerItem) => void;
}

const WorkflowRuntimeContext = createContext<WorkflowRuntimeContextValue | null>(null);

export function WorkflowRuntimeProvider({
  value,
  children,
}: {
  value: WorkflowRuntimeContextValue;
  children: ReactNode;
}) {
  return (
    <WorkflowRuntimeContext.Provider value={value}>{children}</WorkflowRuntimeContext.Provider>
  );
}

export function useWorkflowRuntime(): WorkflowRuntimeContextValue {
  const context = useContext(WorkflowRuntimeContext);
  if (!context) {
    throw new Error('WorkflowRuntimeProvider is required for workflow nodes');
  }
  return context;
}
