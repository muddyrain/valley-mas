import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoopPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function LoopPropertyForm({ config, onUpdateConfig }: LoopPropertyFormProps) {
  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">循环配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>循环变量</Label>
          <Input
            value={(config.loopVariable as string) || ''}
            onChange={(e) => onUpdateConfig({ loopVariable: e.target.value })}
            placeholder="item"
          />
        </div>
        <div className="space-y-2">
          <Label>循环次数</Label>
          <Input
            type="number"
            value={(config.iterationCount as number) ?? 1}
            onChange={(e) => onUpdateConfig({ iterationCount: parseInt(e.target.value, 10) || 1 })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
