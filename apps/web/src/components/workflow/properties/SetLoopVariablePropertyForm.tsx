import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TypedVariableValueEditor } from '../TypedVariableValueEditor';
import type { PropertyFormProps } from './index';

export function SetLoopVariablePropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const middleVariables = variableOptions.filter(
    (option) => option.scope === 'loop' && option.field !== 'item' && option.field !== 'index',
  );
  const selected = middleVariables.find((option) => option.field === config.name);

  return (
    <EditorSection
      title="设置循环变量"
      description="更新循环节点已声明的中间变量，新值从下一轮开始生效。"
    >
      <div className="space-y-1.5">
        <Label>中间变量</Label>
        <Select
          value={String(config.name || '')}
          onValueChange={(name) => onUpdateConfig({ name })}
        >
          <SelectTrigger aria-label="选择循环中间变量">
            <SelectValue placeholder="选择中间变量" />
          </SelectTrigger>
          <SelectContent>
            {middleVariables.map((option) => (
              <SelectItem key={option.field} value={option.field}>
                {option.field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!middleVariables.length ? (
          <p className="text-xs text-muted-foreground">
            请先在循环节点配置中声明至少一个中间变量。
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label>新值</Label>
        <TypedVariableValueEditor
          ariaLabel="循环变量新值"
          type={selected?.type === 'unknown' || !selected ? 'string' : selected.type}
          value={config.value}
          onChange={(value) => onUpdateConfig({ value })}
          options={variableOptions}
          fixedPlaceholder="输入固定值"
        />
      </div>
    </EditorSection>
  );
}
