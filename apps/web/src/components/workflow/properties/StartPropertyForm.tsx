import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { normalizePhaseOneStartInputs } from '../types';
import type { PropertyFormProps } from './index';

const inputLabels: Record<string, string> = {
  markdownFile: 'Markdown 文件',
  tagIds: '博客标签',
  groupId: '博客分组',
  visibility: '可见范围',
};

export function StartPropertyForm({ config }: PropertyFormProps) {
  const inputs = normalizePhaseOneStartInputs(config.inputs);

  return (
    <Card className="m-4 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">运行输入</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(inputs).map(([name, input]) => (
          <div
            key={name}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div>
              <Label>{inputLabels[name]}</Label>
              <p className="mt-1 text-xs text-muted-foreground">{input.type}</p>
            </div>
            <Badge variant={input.required ? 'secondary' : 'outline'}>
              {input.required ? '必填' : '可选'}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
