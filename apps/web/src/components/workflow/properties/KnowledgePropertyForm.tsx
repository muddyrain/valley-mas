import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface KnowledgePropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function KnowledgePropertyForm({ config, onUpdateConfig }: KnowledgePropertyFormProps) {
  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">知识库配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>数据集 ID</Label>
          <Input
            value={(config.datasetId as string) || ''}
            onChange={(e) => onUpdateConfig({ datasetId: e.target.value })}
            placeholder="输入数据集 ID"
          />
        </div>
        <div className="space-y-2">
          <Label>Top K</Label>
          <Input
            type="number"
            value={(config.topK as number) ?? 5}
            onChange={(e) => onUpdateConfig({ topK: parseInt(e.target.value, 10) || 5 })}
          />
        </div>
        <div className="space-y-2">
          <Label>相似度阈值: {String(config.scoreThreshold ?? 0.7)}</Label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={(config.scoreThreshold as number) ?? 0.7}
            onChange={(e) => onUpdateConfig({ scoreThreshold: parseFloat(e.target.value) })}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted"
          />
        </div>
      </CardContent>
    </Card>
  );
}
