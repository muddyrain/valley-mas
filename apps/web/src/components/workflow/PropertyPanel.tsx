import type { Edge, Node } from '@xyflow/react';
import { Settings } from 'lucide-react';
import { memo, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NodeRunInspector } from './NodeRunInspector';
import { PROPERTY_FORM_MAP } from './properties';
import { PropertyFormBase } from './properties/PropertyFormBase';
import { WhenPropertyForm } from './properties/WhenPropertyForm';
import type { NodeRunSnapshot } from './runSession';
import type { ValidationError } from './validateWorkflowConfig';
import { getLoopOutputVariables, getUpstreamWorkflowVariables } from './workflowVariables';

export type PropertyPanelTab = 'config' | 'run';

interface PropertyPanelProps {
  selectedNode: {
    id: string;
    type: string;
    data: {
      label: string;
      nodeType: string;
      config?: Record<string, unknown>;
      when?: import('./types').WorkflowRule;
    };
  } | null;
  onClose: () => void;
  onUpdateNode: (
    nodeId: string,
    updates: Partial<{
      label: string;
      config: Record<string, unknown>;
      when: import('./types').WorkflowRule | undefined;
    }>,
  ) => void;
  nodes: Node[];
  edges: Edge[];
  runSnapshot?: NodeRunSnapshot;
  validationErrors?: readonly ValidationError[];
  activeTab?: PropertyPanelTab;
  onActiveTabChange?: (tab: PropertyPanelTab) => void;
  isRunning?: boolean;
}

export const PropertyPanel = memo(function PropertyPanel({
  selectedNode,
  onClose,
  onUpdateNode,
  nodes,
  edges,
  runSnapshot,
  validationErrors = [],
  activeTab,
  onActiveTabChange,
  isRunning = false,
}: PropertyPanelProps) {
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col border-l border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">当前节点</h2>
        </div>
        <Tabs
          value={activeTab || 'config'}
          onValueChange={(value) => {
            if (isRunning && value === 'config') return;
            onActiveTabChange?.(value as PropertyPanelTab);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList
            className="w-full rounded-none border-b border-border bg-card px-4"
            variant="line"
          >
            <TabsTrigger value="config" className="flex-none px-3" disabled={isRunning}>
              配置
            </TabsTrigger>
            <TabsTrigger value="run" className="flex-none px-3">
              运行
            </TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="min-h-0">
            <EmptyPanel message="选择一个节点开始配置" />
          </TabsContent>
          <TabsContent value="run" className="min-h-0">
            <ScrollArea className="h-full">
              <EmptyPanel message="运行后查看节点详情" />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const { nodeType, config, when } = selectedNode.data;
  const FormComponent = PROPERTY_FORM_MAP[nodeType as keyof typeof PROPERTY_FORM_MAP];
  const variableOptions = useMemo(
    () => getUpstreamWorkflowVariables(nodes, edges, selectedNode.id),
    [edges, nodes, selectedNode.id],
  );
  const upstreamVariableOptions = useMemo(
    () => variableOptions.filter((option) => option.scope !== 'local'),
    [variableOptions],
  );
  const loopOutputOptions = useMemo(
    () => (nodeType === 'loop' ? getLoopOutputVariables(nodes, selectedNode.id) : []),
    [nodeType, nodes, selectedNode.id],
  );
  const isCoverGenerationNode =
    nodeType === 'tool' && config?.capabilityId === 'image.generateCover';
  const fieldErrors = Object.fromEntries(
    validationErrors
      .filter((error) => error.nodeId === selectedNode.id && error.field)
      .map((error) => [error.field as string, error.message]),
  );

  const handleUpdateConfig = (updates: Partial<Record<string, unknown>>) => {
    if (isRunning) return;
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
      configLocked={isRunning}
    >
      {FormComponent && (
        <FormComponent
          config={config || {}}
          onUpdateConfig={handleUpdateConfig}
          variableOptions={
            nodeType === 'tool' ||
            nodeType === 'end' ||
            nodeType === 'condition' ||
            nodeType === 'llm' ||
            nodeType === 'merge' ||
            nodeType === 'variable' ||
            nodeType === 'subworkflow' ||
            nodeType === 'intent' ||
            nodeType === 'switch' ||
            nodeType === 'loop'
              ? variableOptions
              : undefined
          }
          loopOutputOptions={nodeType === 'loop' ? loopOutputOptions : undefined}
          fieldErrors={fieldErrors}
        />
      )}
      {nodeType === 'tool' ||
      nodeType === 'llm' ||
      nodeType === 'variable' ||
      nodeType === 'subworkflow' ? (
        <WhenPropertyForm
          when={when}
          onChange={(nextWhen) => {
            if (!isRunning) onUpdateNode(selectedNode.id, { when: nextWhen });
          }}
          variableOptions={upstreamVariableOptions}
          title={isCoverGenerationNode ? '生成条件' : undefined}
          description={isCoverGenerationNode ? '未设置时，每次运行都会生成封面。' : undefined}
          enabledLabel={isCoverGenerationNode ? '根据上游变量决定是否生成' : undefined}
          variablePlaceholder={isCoverGenerationNode ? '选择上游布尔变量' : undefined}
        />
      ) : null}
    </PropertyFormBase>
  );
});

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted/50">
        <Settings className="size-6 text-muted-foreground" />
      </div>
      <p className="mb-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
