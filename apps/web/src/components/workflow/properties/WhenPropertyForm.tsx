import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowRule } from '../types';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { WorkflowVariableOption } from '../workflowVariables';

export function WhenPropertyForm({
  when,
  onChange,
  variableOptions,
  title = '执行条件',
  description = '条件不满足时节点标记为已跳过，输出字段为 null。',
  enabledLabel = '仅在满足条件时执行',
  variablePlaceholder = '选择 Start 输入或上游输出',
}: {
  when?: WorkflowRule;
  onChange: (when?: WorkflowRule) => void;
  variableOptions: WorkflowVariableOption[];
  title?: string;
  description?: string;
  enabledLabel?: string;
  variablePlaceholder?: string;
}) {
  const enabled = Boolean(when);
  const rule = when || { left: '', operator: 'equals' as const, right: true };
  return (
    <EditorSection title={title} description={description}>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={enabled}
          onCheckedChange={(checked) => onChange(checked === true ? rule : undefined)}
        />
        {enabledLabel}
      </label>
      {enabled ? (
        <>
          <div className="space-y-1.5">
            <Label>左值</Label>
            <VariableTokenEditor
              value={String(rule.left ?? '')}
              onChange={(left) => onChange({ ...rule, left })}
              options={variableOptions}
              placeholder={variablePlaceholder}
            />
          </div>
          <div className="space-y-1.5">
            <Label>操作符</Label>
            <Select
              value={rule.operator}
              onValueChange={(operator) =>
                onChange({ ...rule, operator: operator as WorkflowRule['operator'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">等于</SelectItem>
                <SelectItem value="notEquals">不等于</SelectItem>
                <SelectItem value="contains">包含</SelectItem>
                <SelectItem value="isEmpty">为空</SelectItem>
                <SelectItem value="greaterThan">大于</SelectItem>
                <SelectItem value="lessThan">小于</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rule.operator !== 'isEmpty' ? (
            <div className="space-y-1.5">
              <Label>右值</Label>
              <Input
                value={String(rule.right ?? '')}
                onChange={(event) =>
                  onChange({
                    ...rule,
                    right:
                      event.target.value === 'true'
                        ? true
                        : event.target.value === 'false'
                          ? false
                          : event.target.value,
                  })
                }
              />
            </div>
          ) : null}
        </>
      ) : null}
    </EditorSection>
  );
}
