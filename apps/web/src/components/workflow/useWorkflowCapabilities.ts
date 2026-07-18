import { useEffect, useState } from 'react';
import {
  listWorkflowCapabilities,
  type WorkflowNodeDefinition,
  type WorkflowToolCapability,
} from '@/api/workflow';

export interface WorkflowCapabilityState {
  nodeTypes: WorkflowNodeDefinition[];
  toolCapabilities: WorkflowToolCapability[];
  loading: boolean;
  error: string | null;
}

type WorkflowCapabilityCache = Omit<WorkflowCapabilityState, 'loading' | 'error'>;

let cached: WorkflowCapabilityCache | null = null;
let inflight: Promise<WorkflowCapabilityCache> | null = null;

function loadCapabilities(): Promise<WorkflowCapabilityCache> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = listWorkflowCapabilities()
      .then((result) => {
        cached = { nodeTypes: result.nodeTypes, toolCapabilities: result.toolCapabilities };
        return cached;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useWorkflowCapabilities(enabled = true): WorkflowCapabilityState {
  const [state, setState] = useState<WorkflowCapabilityState>(() => ({
    nodeTypes: cached?.nodeTypes || [],
    toolCapabilities: cached?.toolCapabilities || [],
    loading: enabled && !cached,
    error: null,
  }));

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadCapabilities()
      .then((result) => {
        if (active && result) setState({ ...result, loading: false, error: null });
      })
      .catch(() => {
        if (active)
          setState((current) => ({ ...current, loading: false, error: '加载节点能力失败' }));
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return state;
}
