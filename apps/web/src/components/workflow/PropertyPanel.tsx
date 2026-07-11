import { Settings } from 'lucide-react';
import { PROPERTY_FORM_MAP } from './properties';
import { PropertyFormBase } from './properties/PropertyFormBase';

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
}

export function PropertyPanel({ selectedNode, onClose, onUpdateNode }: PropertyPanelProps) {
  if (!selectedNode) {
    return (
      <div className="h-full flex flex-col border-l border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">属性面板</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Settings className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-2">选择一个节点查看和编辑属性</p>
          <p className="text-xs text-muted-foreground/70">点击画布上的节点，在右侧配置其参数</p>
        </div>
      </div>
    );
  }

  const { nodeType, config } = selectedNode.data;
  const FormComponent = PROPERTY_FORM_MAP[nodeType as keyof typeof PROPERTY_FORM_MAP];

  const handleUpdateConfig = (updates: Partial<Record<string, unknown>>) => {
    onUpdateNode(selectedNode.id, {
      config: { ...(config || {}), ...updates },
    });
  };

  return (
    <PropertyFormBase selectedNode={selectedNode} onClose={onClose} onUpdateNode={onUpdateNode}>
      {FormComponent && <FormComponent config={config || {}} onUpdateConfig={handleUpdateConfig} />}
    </PropertyFormBase>
  );
}
