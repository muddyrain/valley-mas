import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StartPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function StartPropertyForm({ config, onUpdateConfig }: StartPropertyFormProps) {
  const variables =
    (config.variables as Array<{ name: string; type: string; required: boolean }>) || [];

  const updateVariables = (vars: typeof variables) => {
    onUpdateConfig({ variables: vars });
  };

  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">输入参数</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">定义工作流运行时需要填写的输入参数</p>
        {variables.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Input
                value={v.name}
                onChange={(e) => {
                  const next = [...variables];
                  next[i] = { ...next[i], name: e.target.value };
                  updateVariables(next);
                }}
                placeholder="参数名"
                className="w-full"
              />
            </div>
            <Select
              value={v.type}
              onValueChange={(val) => {
                const next = [...variables];
                next[i] = { ...next[i], type: val ?? 'string' };
                updateVariables(next);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="string">String</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="object">Object</SelectItem>
                <SelectItem value="file">File</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Checkbox
                checked={v.required}
                onCheckedChange={(checked) => {
                  const next = [...variables];
                  next[i] = { ...next[i], required: !!checked };
                  updateVariables(next);
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateVariables(variables.filter((_, j) => j !== i))}
              className="h-8 w-8"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateVariables([...variables, { name: '', type: 'string', required: false }])
          }
        >
          <Plus className="h-3 w-3 mr-1" /> 添加参数
        </Button>
      </CardContent>
    </Card>
  );
}
