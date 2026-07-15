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

interface InputPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function InputPropertyForm({ config, onUpdateConfig }: InputPropertyFormProps) {
  const variables =
    (config.variables as Array<{ name: string; type: string; required: boolean }>) || [];

  const updateVariables = (vars: typeof variables) => {
    onUpdateConfig({ variables: vars });
  };

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">输入参数</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {variables.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={v.name}
              onChange={(e) => {
                const next = [...variables];
                next[i] = { ...next[i], name: e.target.value };
                updateVariables(next);
              }}
              placeholder="参数名"
              className="flex-1"
            />
            <Select
              value={v.type}
              onValueChange={(val) => {
                const next = [...variables];
                next[i] = { ...next[i], type: val ?? 'string' };
                updateVariables(next);
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[200px]">
                <SelectItem value="string">string</SelectItem>
                <SelectItem value="number">number</SelectItem>
                <SelectItem value="boolean">boolean</SelectItem>
                <SelectItem value="object">object</SelectItem>
              </SelectContent>
            </Select>
            <Checkbox
              checked={v.required}
              onCheckedChange={(checked) => {
                const next = [...variables];
                next[i] = { ...next[i], required: !!checked };
                updateVariables(next);
              }}
              aria-label="Required"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => updateVariables(variables.filter((_, j) => j !== i))}
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
