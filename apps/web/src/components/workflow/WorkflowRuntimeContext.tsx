import { createContext, type ReactNode, useContext } from 'react';
import type { WorkflowRunSession } from './runSession';

interface WorkflowRuntimeContextValue {
  session: WorkflowRunSession;
  toggleNodeResult: (nodeId: string) => void;
  copyNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
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
