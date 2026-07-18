import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';

export function SubworkflowPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const inputs = (config.inputs as Record<string, unknown>) || {};
  return (
    <EditorSection
      title="已发布工作流"
      description="运行始终锁定选择时的不可变版本，不会跟随对方草稿变化。"
    >
      <div className="space-y-2">
        <Label>工作流</Label>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          {String(config.workflowName || config.workflowId || '未选择')}
        </div>
      </div>
      <div className="space-y-2">
        <Label>版本</Label>
        <Badge variant="outline">{String(config.versionId || '未锁定')}</Badge>
      </div>
      {Object.entries(inputs).map(([name, value]) => (
        <div key={name} className="space-y-1.5">
          <Label>{name}</Label>
          <VariableTokenEditor
            value={String(value ?? '')}
            onChange={(nextValue) => onUpdateConfig({ inputs: { ...inputs, [name]: nextValue } })}
            options={variableOptions}
            placeholder={`映射 ${name}`}
          />
        </div>
      ))}
    </EditorSection>
  );
}
