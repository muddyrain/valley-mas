import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';

const operators = [
  ['equals', '等于'],
  ['notEquals', '不等于'],
  ['contains', '包含'],
  ['isEmpty', '为空'],
  ['greaterThan', '大于'],
  ['lessThan', '小于'],
] as const;

export function ConditionPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const operator = (config.operator as string) || 'equals';
  return (
    <EditorSection title="条件规则" description="只允许引用开始输入或上游输出，不执行表达式代码。">
      <div className="space-y-2">
        <Label>左值</Label>
        <VariableTokenEditor
          value={(config.left as string) || ''}
          onChange={(left) => onUpdateConfig({ left })}
          options={variableOptions}
          placeholder="选择开始输入或上游输出"
        />
      </div>
      <div className="space-y-2">
        <Label>操作符</Label>
        <Select value={operator} onValueChange={(value) => onUpdateConfig({ operator: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {operator !== 'isEmpty' ? (
        <div className="space-y-2">
          <Label>右值</Label>
          <Input
            value={String(config.right ?? '')}
            onChange={(event) => onUpdateConfig({ right: event.target.value })}
            placeholder="比较值"
          />
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">true 与 false 端口各连接一条独立路径。</p>
    </EditorSection>
  );
}
