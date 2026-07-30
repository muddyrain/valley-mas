import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

export interface WorkflowResultAction {
  id: string;
  label: string;
  output: string;
}

export function normalizeWorkflowResultActions(value: unknown): WorkflowResultAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const action = item as Record<string, unknown>;
    const label = typeof action.label === 'string' ? action.label : '';
    const output = typeof action.output === 'string' ? action.output : '';
    if (!label && !output) return [];
    return [
      { id: typeof action.id === 'string' ? action.id : `action-${index + 1}`, label, output },
    ];
  });
}

interface ResultActionEditorProps {
  actions: WorkflowResultAction[];
  outputNames: string[];
  onChange: (actions: WorkflowResultAction[]) => void;
}

export function ResultActionEditor({ actions, outputNames, onChange }: ResultActionEditorProps) {
  return (
    <div className="space-y-3">
      {actions.map((action) => (
        <div key={action.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
          <Input
            aria-label="结果动作名称"
            value={action.label}
            placeholder="例如：编辑草稿"
            onChange={(event) =>
              onChange(
                actions.map((item) =>
                  item.id === action.id ? { ...item, label: event.target.value } : item,
                ),
              )
            }
          />
          <Select
            value={action.output}
            onValueChange={(output) =>
              onChange(
                actions.map((item) =>
                  item.id === action.id ? { ...item, output: output || '' } : item,
                ),
              )
            }
          >
            <SelectTrigger aria-label={`${action.label || '结果动作'}目标输出`} className="w-full">
              {action.output || '选择跳转地址输出'}
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {outputNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`删除结果动作 ${action.label || action.id}`}
            onClick={() => onChange(actions.filter((item) => item.id !== action.id))}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={outputNames.length === 0}
        onClick={() =>
          onChange([
            ...actions,
            { id: `action-${Date.now()}`, label: '打开结果', output: outputNames[0] },
          ])
        }
      >
        <Plus className="mr-2 size-4" />
        添加结果动作
      </Button>
    </div>
  );
}
