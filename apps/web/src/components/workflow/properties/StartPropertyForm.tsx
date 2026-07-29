import { Plus, Trash2 } from 'lucide-react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  normalizeStartInputs,
  renameStartInput,
  type WorkflowValueType,
  workflowStartInputControlType,
} from '../types';
import type { PropertyFormProps } from './index';
import { RecordKeyInput } from './RecordKeyInput';
import { StartInputControlPicker } from './StartInputControlPicker';
import { WorkflowIOField } from './WorkflowIOField';

const valueTypes: WorkflowValueType[] = [
  'string',
  'string[]',
  'object',
  'number',
  'boolean',
  'file',
];

export function StartPropertyForm({ config, onUpdateConfig, onRenameInput }: PropertyFormProps) {
  const inputs = normalizeStartInputs(config.inputs);
  const update = (next: typeof inputs) => onUpdateConfig({ inputs: next });
  return (
    <EditorSection title="输入" description="声明调用工作流时允许传入的参数。">
      <div className="space-y-2">
        {Object.entries(inputs).map(([name, input]) => (
          <WorkflowIOField
            key={input.id || name}
            name={name}
            required={input.required}
            layout="compact"
            nameControl={
              <RecordKeyInput
                name={name}
                names={Object.keys(inputs)}
                ariaLabel="输入名称"
                onCommit={(nextName) => {
                  if (onRenameInput) {
                    onRenameInput(name, nextName);
                    return;
                  }
                  update(renameStartInput(inputs, name, nextName));
                }}
              />
            }
            typeControl={
              input.control === 'default' ? (
                <Select
                  value={input.type}
                  onValueChange={(type) =>
                    update({ ...inputs, [name]: { ...input, type: type as WorkflowValueType } })
                  }
                >
                  <SelectTrigger aria-label={`${name} 输入类型`} className="w-full">
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
              ) : (
                <Badge variant="secondary" className="w-full justify-center font-mono font-normal">
                  {input.type}
                </Badge>
              )
            }
            actions={
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={input.required}
                    onCheckedChange={(checked) =>
                      update({ ...inputs, [name]: { ...input, required: checked === true } })
                    }
                  />
                  必填
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`删除 ${name}`}
                  onClick={() => {
                    const next = { ...inputs };
                    delete next[name];
                    update(next);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            }
            accessory={
              <StartInputControlPicker
                compact
                value={input.control}
                onValueChange={(nextControl) =>
                  update({
                    ...inputs,
                    [name]: {
                      ...input,
                      control: nextControl,
                      type: workflowStartInputControlType(nextControl, input.type),
                    },
                  })
                }
              />
            }
          />
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          let name = 'input';
          let index = 2;
          while (inputs[name]) {
            name = `input${index}`;
            index += 1;
          }
          update({
            ...inputs,
            [name]: {
              id: crypto.randomUUID(),
              type: 'string',
              required: false,
              control: 'default',
            },
          });
        }}
      >
        <Plus className="mr-2 size-4" />
        添加输入
      </Button>
    </EditorSection>
  );
}
