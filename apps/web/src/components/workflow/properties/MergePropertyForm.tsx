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
import type { WorkflowMergeField } from '../types';
import type { PropertyFormProps } from './index';

export function MergePropertyForm({ config, onUpdateConfig }: PropertyFormProps) {
  const fields = Array.isArray(config.fields) ? (config.fields as WorkflowMergeField[]) : [];
  return (
    <EditorSection
      title="变量聚合"
      description="按配置顺序汇集实际执行分支的变量；旧工作流会继续使用首个有效值。"
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
          <Select
            value={field.strategy || 'first'}
            onValueChange={(strategy) =>
              onUpdateConfig({
                fields: fields.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, strategy } : item,
                ),
              })
            }
          >
            <SelectTrigger aria-label={`${field.name || '聚合字段'} 的聚合方式`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">首个有效值</SelectItem>
              <SelectItem value="array">收集为数组</SelectItem>
              <SelectItem value="text">拼接为文本</SelectItem>
              <SelectItem value="object">合并对象</SelectItem>
            </SelectContent>
          </Select>
          {field.strategy === 'text' ? (
            <Input
              value={field.delimiter || ''}
              placeholder="文本分隔符（默认直接拼接）"
              onChange={(event) =>
                onUpdateConfig({
                  fields: fields.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, delimiter: event.target.value } : item,
                  ),
                })
              }
            />
          ) : null}
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
            fields: [
              ...fields,
              { name: `value${fields.length + 1}`, type: 'string', strategy: 'first', sources: [] },
            ],
          })
        }
      >
        <Plus className="mr-2 size-4" />
        添加合并字段
      </Button>
    </EditorSection>
  );
}
