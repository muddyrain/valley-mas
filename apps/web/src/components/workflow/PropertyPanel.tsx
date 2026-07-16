import type { Edge, Node } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { NodeRunInspector } from './NodeRunInspector';
import { PROPERTY_FORM_MAP } from './properties';
import { PropertyFormBase } from './properties/PropertyFormBase';
import type { NodeRunSnapshot } from './runSession';
import { getUpstreamWorkflowVariables } from './workflowVariables';

export type PropertyPanelTab = 'config' | 'run';

interface PropertyPanelProps {
  selectedNode: {
    id: string;
    type: string;
    data: { label: string; nodeType: string; config?: Record<string, unknown> };
  } | null;
  onClose: () => void;
  onUpdateNode: (
    nodeId: string,
    updates: Partial<{ label: string; config: Record<string, unknown> }>,
  ) => void;
  nodes: Node[];
  edges: Edge[];
  runSnapshot?: NodeRunSnapshot;
  activeTab?: PropertyPanelTab;
  onActiveTabChange?: (tab: PropertyPanelTab) => void;
}

export function PropertyPanel({
  selectedNode,
  onClose,
  onUpdateNode,
  nodes,
  edges,
  runSnapshot,
  activeTab,
  onActiveTabChange,
}: PropertyPanelProps) {
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col border-l border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">节点配置</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Settings className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="mb-2 text-sm text-muted-foreground">选择一个节点开始配置</p>
          <p className="text-xs text-muted-foreground/70">
            画布中的节点会在这里显示输入、参数和输出。
          </p>
        </div>
      </div>
    );
  }

  const { nodeType, config } = selectedNode.data;
  const FormComponent = PROPERTY_FORM_MAP[nodeType as keyof typeof PROPERTY_FORM_MAP];
  const variableOptions = getUpstreamWorkflowVariables(nodes, edges, selectedNode.id);

  const handleUpdateConfig = (updates: Partial<Record<string, unknown>>) => {
    onUpdateNode(selectedNode.id, {
      config: { ...(config || {}), ...updates },
    });
  };
  const showRunTab =
    activeTab !== undefined || onActiveTabChange !== undefined || runSnapshot !== undefined;
  const runContent = runSnapshot ? (
    <NodeRunInspector snapshot={runSnapshot} />
  ) : (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
        <Settings className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mb-2 text-sm text-muted-foreground">本次运行尚无节点详情</p>
      <p className="text-xs text-muted-foreground/70">
        运行工作流后，这里会显示安全的输入和输出摘要。
      </p>
    </div>
  );

  return (
    <PropertyFormBase
      selectedNode={selectedNode}
      onClose={onClose}
      onUpdateNode={onUpdateNode}
      activeTab={activeTab}
      onActiveTabChange={onActiveTabChange}
      runContent={showRunTab ? runContent : undefined}
    >
      {FormComponent && (
        <FormComponent
          config={config || {}}
          onUpdateConfig={handleUpdateConfig}
          variableOptions={
            nodeType === 'blog.parseMarkdown' ||
            nodeType === 'knowledge.retrieve' ||
            nodeType === 'llm.text'
              ? variableOptions
              : undefined
          }
        />
      )}
    </PropertyFormBase>
  );
}
