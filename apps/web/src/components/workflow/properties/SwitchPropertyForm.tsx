import { Plus, Trash2 } from 'lucide-react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowSwitchCase, WorkflowValueType } from '../types';
import { VariableReferencePicker } from '../VariableReferencePicker';
import type { PropertyFormProps } from './index';

type SwitchValueType = Extract<WorkflowValueType, 'string' | 'number' | 'boolean'>;

const valueTypes: Array<[SwitchValueType, string]> = [
  ['string', '文本'],
  ['number', '数字'],
  ['boolean', '布尔值'],
];

function createCase(index: number, valueType: SwitchValueType): WorkflowSwitchCase {
  const suffix = index + 1;
  return {
    id: `case_${Date.now().toString(36)}_${suffix}`,
    label: `选项 ${suffix}`,
    value:
      valueType === 'number'
        ? suffix
        : valueType === 'boolean'
          ? index % 2 === 0
          : `option_${suffix}`,
  };
}

function normalizeCaseValue(value: string, valueType: SwitchValueType): string | number | boolean {
  if (valueType === 'number') return Number(value);
  if (valueType === 'boolean') return value === 'true';
  return value;
}

export function SwitchPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const valueType = (config.valueType as SwitchValueType) || 'string';
  const value = typeof config.value === 'string' ? config.value : '';
  const cases = Array.isArray(config.cases) ? (config.cases as WorkflowSwitchCase[]) : [];
  const compatibleOptions = variableOptions.filter((option) => option.type === valueType);
  const updateCase = (index: number, patch: Partial<WorkflowSwitchCase>) =>
    onUpdateConfig({
      cases: cases.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });

  return (
    <>
      <EditorSection title="分流值" description="选择已有的结构化变量。">
        <div className="space-y-2">
          <Label>值类型</Label>
          <Select
            value={valueType}
            onValueChange={(next) =>
              onUpdateConfig({
                valueType: next,
                value: '',
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {valueTypes.map(([type, label]) => (
                <SelectItem key={type} value={type}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>分流值</Label>
          <VariableReferencePicker
            ariaLabel="分流值变量"
            value={value}
            onChange={(next) => onUpdateConfig({ value: next })}
            options={compatibleOptions}
            placeholder="选择开始输入或上游输出"
          />
        </div>
      </EditorSection>
      <EditorSection title="匹配分支" description="每个固定值对应一条独立路径。">
        <div className="space-y-2">
          {cases.map((item, index) => (
            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <Input
                aria-label={`分支 ${index + 1} 名称`}
                value={item.label}
                placeholder="分支名称"
                onChange={(event) => updateCase(index, { label: event.target.value })}
              />
              {valueType === 'boolean' ? (
                <Select
                  value={String(item.value)}
                  onValueChange={(next) => updateCase(index, { value: next === 'true' })}
                >
                  <SelectTrigger aria-label={`分支 ${index + 1} 值`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">true</SelectItem>
                    <SelectItem value="false">false</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  aria-label={`分支 ${index + 1} 值`}
                  type={valueType === 'number' ? 'number' : 'text'}
                  value={String(item.value ?? '')}
                  placeholder="匹配值"
                  onChange={(event) =>
                    updateCase(index, { value: normalizeCaseValue(event.target.value, valueType) })
                  }
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`删除分支 ${index + 1}`}
                disabled={cases.length <= 2}
                onClick={() =>
                  onUpdateConfig({ cases: cases.filter((_, itemIndex) => itemIndex !== index) })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cases.length >= 8}
            onClick={() =>
              onUpdateConfig({ cases: [...cases, createCase(cases.length, valueType)] })
            }
          >
            <Plus className="mr-2 size-4" />
            添加分支
          </Button>
        </div>
      </EditorSection>
      <EditorSection title="默认分支" description="未匹配时从默认出口继续执行。">
        <p className="text-sm text-muted-foreground">默认</p>
      </EditorSection>
    </>
  );
}
