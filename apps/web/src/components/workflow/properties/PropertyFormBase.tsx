import { CheckCircle2, Clock, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NODE_CONFIGS } from '../nodeConfig';
import type { NodeResult } from '../RunPanel';

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
  nodeResult?: NodeResult;
}

export function PropertyFormBase({
  selectedNode,
  onClose,
  onUpdateNode,
  children,
  nodeResult,
}: PropertyFormBaseProps) {
  const config = NODE_CONFIGS[selectedNode.data.nodeType];
  const hasResult = nodeResult && nodeResult.status !== 'idle';

  return (
    <div className="h-full flex flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{config?.label}</Badge>
          <span className="text-sm font-semibold text-foreground">属性</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <Card className="m-4 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">基本设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                {config?.label}
              </div>
            </div>
            <div className="space-y-2">
              <Label>节点 ID</Label>
              <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground font-mono">
                {selectedNode.id}
              </div>
            </div>
          </CardContent>
        </Card>

        {children}

        {hasResult && (
          <Card className="m-4 border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                运行结果
                {nodeResult?.status === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-normal">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    成功
                  </span>
                )}
                {nodeResult?.status === 'error' && (
                  <span className="text-xs text-red-500 font-normal">失败</span>
                )}
                {nodeResult?.duration != null && nodeResult.status === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground font-normal ml-auto">
                    <Clock className="h-3 w-3" />
                    {nodeResult.duration}ms
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nodeResult?.input && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">输入</p>
                  <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32 font-mono">
                    {JSON.stringify(nodeResult.input, null, 2)}
                  </pre>
                </div>
              )}
              {nodeResult?.output && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">输出</p>
                  <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-32 font-mono">
                    {JSON.stringify(nodeResult.output, null, 2)}
                  </pre>
                </div>
              )}
              {nodeResult?.error && (
                <div>
                  <p className="text-xs font-medium text-red-500 mb-1">错误</p>
                  <p className="text-xs text-red-500">{nodeResult.error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </ScrollArea>
    </div>
  );
}
