import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface EndPropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export function EndPropertyForm({ config, onUpdateConfig }: EndPropertyFormProps) {
  const mappings = (config.outputMappings as Array<{ source: string; target: string }>) || [];

  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">输出配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">定义工作流最终返回的结果</p>
        {mappings.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={m.source}
              onChange={(e) => {
                const next = [...mappings];
                next[i] = { ...next[i], source: e.target.value };
                onUpdateConfig({ outputMappings: next });
              }}
              placeholder="来源变量"
              className="flex-1"
            />
            <span className="text-muted-foreground">→</span>
            <Input
              value={m.target}
              onChange={(e) => {
                const next = [...mappings];
                next[i] = { ...next[i], target: e.target.value };
                onUpdateConfig({ outputMappings: next });
              }}
              placeholder="输出变量"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onUpdateConfig({ outputMappings: mappings.filter((_, j) => j !== i) })}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onUpdateConfig({ outputMappings: [...mappings, { source: '', target: '' }] })
          }
        >
          <Plus className="h-3 w-3 mr-1" /> 添加映射
        </Button>
      </CardContent>
    </Card>
  );
}
