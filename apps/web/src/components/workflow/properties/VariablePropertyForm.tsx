import { Plus, Trash2 } from 'lucide-react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowValueType, WorkflowVariableAssignment } from '../types';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';

const valueTypes: WorkflowValueType[] = ['string', 'string[]', 'object', 'number', 'boolean'];

export function VariablePropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const assignments = Array.isArray(config.assignments)
    ? (config.assignments as WorkflowVariableAssignment[])
    : [];
  const update = (index: number, patch: Partial<WorkflowVariableAssignment>) =>
    onUpdateConfig({
      assignments: assignments.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  return (
    <EditorSection title="变量赋值" description="一次设置一个或多个类型明确的值。">
      {assignments.map((assignment, index) => (
        <div key={`${assignment.name}-${index}`} className="space-y-2 rounded-lg border p-3">
          <div className="flex gap-2">
            <Input
              value={assignment.name}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder="变量名"
            />
            <Select
              value={assignment.type}
              onValueChange={(type) => update(index, { type: type as WorkflowValueType })}
            >
              <SelectTrigger className="w-32">
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
                  assignments: assignments.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <VariableTokenEditor
            value={String(assignment.value ?? '')}
            onChange={(value) => update(index, { value })}
            options={variableOptions}
            placeholder="固定值或上游变量"
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onUpdateConfig({
            assignments: [
              ...assignments,
              { name: `value${assignments.length + 1}`, type: 'string', value: '' },
            ],
          })
        }
      >
        <Plus className="mr-2 size-4" />
        添加变量
      </Button>
    </EditorSection>
  );
}
