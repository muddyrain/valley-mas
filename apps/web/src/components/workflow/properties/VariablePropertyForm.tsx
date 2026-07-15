import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface VariablePropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function VariablePropertyForm({ config, onUpdateConfig }: VariablePropertyFormProps) {
  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">变量赋值配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>变量名</Label>
          <Input
            value={(config.variableName as string) || ''}
            onChange={(e) => onUpdateConfig({ variableName: e.target.value })}
            placeholder="myVariable"
          />
        </div>
        <div className="space-y-2">
          <Label>值表达式</Label>
          <Textarea
            value={(config.valueExpression as string) || ''}
            onChange={(e) => onUpdateConfig({ valueExpression: e.target.value })}
            placeholder="{{trigger.input}}"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
