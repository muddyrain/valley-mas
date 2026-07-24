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
import { TypedVariableValueEditor } from '../TypedVariableValueEditor';
import type { WorkflowValueType } from '../types';
import { VariableReferencePicker } from '../VariableReferencePicker';
import type { PropertyFormProps } from './index';

type LoopVariable = { name: string; type: WorkflowValueType; initialValue: unknown };
type LoopOutput = { name: string; source: string };

const valueTypes: WorkflowValueType[] = ['string', 'array', 'object', 'number', 'boolean'];

export function LoopPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
  loopOutputOptions = [],
}: PropertyFormProps) {
  const mode = config.mode === 'count' || config.mode === 'infinite' ? config.mode : 'array';
  const variables = Array.isArray(config.middleVariables)
    ? (config.middleVariables as LoopVariable[])
    : [];
  const outputs = Array.isArray(config.outputs) ? (config.outputs as LoopOutput[]) : [];
  const updateVariable = (index: number, patch: Partial<LoopVariable>) =>
    onUpdateConfig({
      middleVariables: variables.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  const updateOutput = (index: number, patch: Partial<LoopOutput>) =>
    onUpdateConfig({
      outputs: outputs.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch, type: 'array' } : item,
      ),
    });
  return (
    <div className="space-y-5">
      <EditorSection
        title="循环方式"
        description="循环体在每一轮中执行一次，外层工作流仍保持无环。"
      >
        <Select value={mode} onValueChange={(value) => onUpdateConfig({ mode: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="array">使用数组循环</SelectItem>
            <SelectItem value="count">指定循环次数</SelectItem>
            <SelectItem value="infinite">无限循环</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'array' ? (
          <div className="mt-3 space-y-2">
            <Label>循环数组</Label>
            <VariableReferencePicker
              value={String(config.input || '')}
              onChange={(input) => onUpdateConfig({ input })}
              options={variableOptions.filter(
                (item) => item.type === 'array' || item.type === 'string[]',
              )}
              placeholder="选择上游数组"
            />
          </div>
        ) : null}
        {mode === 'count' ? (
          <div className="mt-3 space-y-2">
            <Label>循环次数</Label>
            <TypedVariableValueEditor
              ariaLabel="循环次数"
              type="number"
              value={config.count ?? 1}
              onChange={(count) => onUpdateConfig({ count })}
              options={variableOptions}
              fixedPlaceholder="输入 1 到 1000"
            />
          </div>
        ) : null}
        {mode === 'infinite' ? (
          <div className="mt-3 space-y-2">
            <Label>最大轮次保护</Label>
            <Input
              type="number"
              min={1}
              max={1000}
              value={String(config.maxIterations || 10)}
              onChange={(event) => onUpdateConfig({ maxIterations: Number(event.target.value) })}
            />
          </div>
        ) : null}
      </EditorSection>
      <EditorSection
        title="中间变量"
        description="每一轮结束后可在循环体内更新，下一轮会读取更新后的值。"
      >
        {variables.map((variable, index) => (
          <div
            key={`${variable.name}-${index}`}
            className="space-y-2 rounded-lg border border-border p-3"
          >
            <div className="flex gap-2">
              <Input
                value={variable.name}
                onChange={(event) => updateVariable(index, { name: event.target.value })}
                placeholder="变量名"
              />
              <Select
                value={variable.type}
                onValueChange={(type) => updateVariable(index, { type: type as WorkflowValueType })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {valueTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  onUpdateConfig({
                    middleVariables: variables.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <TypedVariableValueEditor
              ariaLabel={`${variable.name || `中间变量 ${index + 1}`}初始值`}
              type={variable.type}
              value={variable.initialValue}
              onChange={(initialValue) => updateVariable(index, { initialValue })}
              options={variableOptions}
              fixedPlaceholder="初始值"
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onUpdateConfig({
              middleVariables: [
                ...variables,
                { name: `state${variables.length + 1}`, type: 'string', initialValue: '' },
              ],
            })
          }
        >
          <Plus className="mr-2 size-4" />
          添加中间变量
        </Button>
      </EditorSection>
      <EditorSection
        title="循环输出"
        description="每轮从循环体读取一次，最终按轮次聚合为数组输出。"
      >
        {outputs.map((output, index) => (
          <div
            key={`${output.name}-${index}`}
            className="space-y-2 rounded-lg border border-border p-3"
          >
            <div className="flex gap-2">
              <Input
                value={output.name}
                onChange={(event) => updateOutput(index, { name: event.target.value })}
                placeholder="输出名"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  onUpdateConfig({ outputs: outputs.filter((_, itemIndex) => itemIndex !== index) })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <VariableReferencePicker
              value={output.source}
              onChange={(source) => updateOutput(index, { source })}
              options={loopOutputOptions}
              placeholder="选择循环变量或循环体输出"
              emptyText="请先在循环体中添加节点，或声明中间变量。"
            />
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onUpdateConfig({
              outputs: [
                ...outputs,
                { name: `results${outputs.length + 1}`, type: 'array', source: '' },
              ],
            })
          }
        >
          <Plus className="mr-2 size-4" />
          添加输出
        </Button>
      </EditorSection>
      <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
        在主画布下方的循环体中编排实际步骤。循环体内可读取 item、index
        和这里声明的中间变量；输出会按轮次聚合。
      </p>
    </div>
  );
}
