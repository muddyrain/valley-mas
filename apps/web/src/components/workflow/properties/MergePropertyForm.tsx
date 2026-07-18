import { Plus, Trash2 } from 'lucide-react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkflowMergeField } from '../types';
import type { PropertyFormProps } from './index';

export function MergePropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  const fields = Array.isArray(config.fields) ? (config.fields as WorkflowMergeField[]) : [];
  return (
    <EditorSection
      title="首个有效值"
      description="按顺序读取候选引用，使用实际执行分支中第一个非空且类型匹配的值。"
    >
      {fields.map((field, index) => (
        <div key={`${field.name}-${index}`} className="space-y-2 rounded-lg border p-3">
          <div className="flex gap-2">
            <Input
              value={field.name}
              placeholder="输出字段"
              onChange={(event) =>
                onUpdateConfig({
                  fields: fields.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, name: event.target.value } : item,
                  ),
                })
              }
            />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                onUpdateConfig({ fields: fields.filter((_, itemIndex) => itemIndex !== index) })
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <Input
            value={field.sources.join(', ')}
            placeholder="{{left.output.value}}, {{right.output.value}}"
            onChange={(event) =>
              onUpdateConfig({
                fields: fields.map((item, itemIndex) =>
                  itemIndex === index
                    ? {
                        ...item,
                        sources: event.target.value
                          .split(',')
                          .map((value) => value.trim())
                          .filter(Boolean),
                      }
                    : item,
                ),
              })
            }
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          onUpdateConfig({
            fields: [...fields, { name: `value${fields.length + 1}`, type: 'string', sources: [] }],
          })
        }
      >
        <Plus className="mr-2 size-4" />
        添加合并字段
      </Button>
    </EditorSection>
  );
}
