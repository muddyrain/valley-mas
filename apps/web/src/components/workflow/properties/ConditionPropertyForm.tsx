import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ConditionPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function ConditionPropertyForm({ config, onUpdateConfig }: ConditionPropertyFormProps) {
  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">条件分支配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>条件表达式</Label>
          <Textarea
            value={(config.expression as string) || ''}
            onChange={(e) => onUpdateConfig({ expression: e.target.value })}
            placeholder="{{input.score}} > 80"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>True 分支标签</Label>
          <Input
            value={(config.trueLabel as string) || ''}
            onChange={(e) => onUpdateConfig({ trueLabel: e.target.value })}
            placeholder="是"
          />
        </div>
        <div className="space-y-2">
          <Label>False 分支标签</Label>
          <Input
            value={(config.falseLabel as string) || ''}
            onChange={(e) => onUpdateConfig({ falseLabel: e.target.value })}
            placeholder="否"
          />
        </div>
      </CardContent>
    </Card>
  );
}
