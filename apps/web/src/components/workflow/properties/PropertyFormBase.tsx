import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NODE_CONFIGS } from '../nodeConfig';

interface PropertyFormBaseProps {
  selectedNode: {
    id: string;
    type: string;
    data: { label: string; nodeType: string; config?: Record<string, unknown> };
  };
  onClose: () => void;
  onUpdateNode: (
    nodeId: string,
    updates: Partial<{ label: string; config: Record<string, unknown> }>,
  ) => void;
  children: ReactNode;
  runContent?: ReactNode;
  activeTab?: 'config' | 'run';
  onActiveTabChange?: (tab: 'config' | 'run') => void;
}

export function PropertyFormBase({
  selectedNode,
  onClose,
  onUpdateNode,
  children,
  runContent,
  activeTab = 'config',
  onActiveTabChange,
}: PropertyFormBaseProps) {
  const config = NODE_CONFIGS[selectedNode.data.nodeType];

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{config?.label}</Badge>
          <span className="text-sm font-semibold text-foreground">节点配置</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {runContent ? (
        <Tabs
          value={activeTab}
          onValueChange={(value) => onActiveTabChange?.(value as 'config' | 'run')}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList
            className="w-full rounded-none border-b border-border bg-card px-4"
            variant="line"
          >
            <TabsTrigger value="config" className="flex-none px-3">
              配置
            </TabsTrigger>
            <TabsTrigger value="run" className="flex-none px-3">
              本次运行
            </TabsTrigger>
          </TabsList>
          <TabsContent value="config" className="min-h-0">
            <PropertyConfigContent
              selectedNode={selectedNode}
              configLabel={config?.label}
              onUpdateNode={onUpdateNode}
            >
              {children}
            </PropertyConfigContent>
          </TabsContent>
          <TabsContent value="run" className="min-h-0">
            <ScrollArea className="h-full bg-muted/20">{runContent}</ScrollArea>
          </TabsContent>
        </Tabs>
      ) : (
        <PropertyConfigContent
          selectedNode={selectedNode}
          configLabel={config?.label}
          onUpdateNode={onUpdateNode}
        >
          {children}
        </PropertyConfigContent>
      )}
    </div>
  );
}

function PropertyConfigContent({
  selectedNode,
  configLabel,
  onUpdateNode,
  children,
}: {
  selectedNode: PropertyFormBaseProps['selectedNode'];
  configLabel: string | undefined;
  onUpdateNode: PropertyFormBaseProps['onUpdateNode'];
  children: ReactNode;
}) {
  return (
    <ScrollArea className="h-full bg-muted/20">
      <div className="space-y-4 p-4">
        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">基础设置</h2>
            <p className="mt-1 text-xs text-muted-foreground">名称会显示在工作流画布中。</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="node-label">节点名称</Label>
            <Input
              id="node-label"
              value={selectedNode.data.label}
              onChange={(e) => onUpdateNode(selectedNode.id, { label: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>节点类型</Label>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {configLabel}
            </div>
          </div>
          <div className="space-y-2">
            <Label>节点 ID</Label>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {selectedNode.id}
            </div>
          </div>
        </section>
        <div className="space-y-4">{children}</div>
      </div>
    </ScrollArea>
  );
}
