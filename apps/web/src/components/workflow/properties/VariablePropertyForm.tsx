import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';

export function VariablePropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  return (
    <EditorSection title="变量赋值" description="输出一个字符串字段，可插入合法上游变量。">
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
        <VariableTokenEditor
          value={(config.valueExpression as string) || ''}
          onChange={(valueExpression) => onUpdateConfig({ valueExpression })}
          options={variableOptions}
          placeholder="例如：主题：{{start.output.topic}}"
        />
      </div>
    </EditorSection>
  );
}
