import { Plus, Trash2 } from 'lucide-react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { normalizeStartInputs, type WorkflowValueType } from '../types';
import type { PropertyFormProps } from './index';
import { RecordKeyInput } from './RecordKeyInput';

const valueTypes: WorkflowValueType[] = [
  'string',
  'string[]',
  'object',
  'number',
  'boolean',
  'file',
];

export function StartPropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  const inputs = normalizeStartInputs(config.inputs);
  const update = (next: typeof inputs) => onUpdateConfig({ inputs: next });
  return (
    <EditorSection title="运行输入" description="声明调用工作流时允许传入的参数。">
      <div className="space-y-2">
        {Object.entries(inputs).map(([name, input]) => (
          <div
            key={name}
            className="grid grid-cols-[1fr_110px_auto_auto] items-center gap-2 rounded-lg border p-2"
          >
            <RecordKeyInput
              name={name}
              names={Object.keys(inputs)}
              ariaLabel="输入名称"
              onCommit={(nextName) => {
                const next = { ...inputs };
                delete next[name];
                next[nextName] = input;
                update(next);
              }}
            />
            <Select
              value={input.type}
              onValueChange={(type) =>
                update({ ...inputs, [name]: { ...input, type: type as WorkflowValueType } })
              }
            >
              <SelectTrigger>
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
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          let index = 1;
          while (inputs[`input${index}`]) index += 1;
          update({ ...inputs, [`input${index}`]: { type: 'string', required: false } });
        }}
      >
        <Plus className="mr-2 size-4" />
        添加输入
      </Button>
    </EditorSection>
  );
}
