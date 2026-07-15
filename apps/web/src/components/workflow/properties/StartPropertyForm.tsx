import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Badge } from '@/components/ui/badge';
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
    <EditorSection title="运行输入" description="定义启动工作流时需要提供的内容。">
      <div className="space-y-2">
        {Object.entries(inputs).map(([name, input]) => (
          <div
            key={name}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5"
          >
            <div>
              <Label>{inputLabels[name] || name}</Label>
              <p className="mt-1 text-xs text-muted-foreground">{input.type}</p>
            </div>
            <Badge variant={input.required ? 'secondary' : 'outline'}>
              {input.required ? '必填' : '可选'}
            </Badge>
          </div>
        ))}
      </div>
    </EditorSection>
  );
}
