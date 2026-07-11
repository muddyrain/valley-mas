import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PropertyFormProps } from './index';

export function EndPropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  const outputs = (config.outputs as Record<string, string>) || {};
  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">最终输出</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(outputs).map(([name, value]) => (
          <div key={name} className="space-y-1.5">
            <Label htmlFor={`end-${name}`}>{name}</Label>
            <Input
              id={`end-${name}`}
              value={value}
              onChange={(event) =>
                onUpdateConfig({ outputs: { ...outputs, [name]: event.target.value } })
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
