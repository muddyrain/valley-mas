import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface CodePropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function CodePropertyForm({ config, onUpdateConfig }: CodePropertyFormProps) {
  const inputVars = (config.inputVars as string[]) || [];
  const outputVars = (config.outputVars as string[]) || [];

  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">代码配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>编程语言</Label>
          <Select
            value={(config.language as string) || 'javascript'}
            onValueChange={(v) => onUpdateConfig({ language: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>代码</Label>
          <Textarea
            value={(config.code as string) || ''}
            onChange={(e) => onUpdateConfig({ code: e.target.value })}
            placeholder="// 在此输入代码"
            rows={10}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>输入变量</Label>
          {inputVars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={v}
                onChange={(e) => {
                  const next = [...inputVars];
                  next[i] = e.target.value;
                  onUpdateConfig({ inputVars: next });
                }}
                placeholder="变量名"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdateConfig({ inputVars: inputVars.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateConfig({ inputVars: [...inputVars, ''] })}
          >
            <Plus className="h-3 w-3 mr-1" /> 添加
          </Button>
        </div>
        <div className="space-y-2">
          <Label>输出变量</Label>
          {outputVars.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={v}
                onChange={(e) => {
                  const next = [...outputVars];
                  next[i] = e.target.value;
                  onUpdateConfig({ outputVars: next });
                }}
                placeholder="变量名"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onUpdateConfig({ outputVars: outputVars.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateConfig({ outputVars: [...outputVars, ''] })}
          >
            <Plus className="h-3 w-3 mr-1" /> 添加
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
