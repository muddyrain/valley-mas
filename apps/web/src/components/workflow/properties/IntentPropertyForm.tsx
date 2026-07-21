import { Plus, Trash2 } from 'lucide-react';
import { ModelPicker } from '@/components/ai/ModelPicker';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkflowIntentDefinition } from '../types';
import { VariableReferencePicker } from '../VariableReferencePicker';
import type { PropertyFormProps } from './index';

function createIntent(index: number): WorkflowIntentDefinition {
  return {
    id: `intent_${Date.now().toString(36)}_${index}`,
    name: `意图 ${index + 1}`,
    description: '',
    examples: [],
  };
}

export function IntentPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const query = typeof config.query === 'string' ? config.query : '';
  const intents = Array.isArray(config.intents)
    ? (config.intents as WorkflowIntentDefinition[])
    : [];
  const queryOptions = variableOptions.filter((option) => option.type === 'string');
  const updateIntent = (index: number, patch: Partial<WorkflowIntentDefinition>) =>
    onUpdateConfig({
      intents: intents.map((intent, intentIndex) =>
        intentIndex === index ? { ...intent, ...patch } : intent,
      ),
    });

  return (
    <>
      <EditorSection title="模型" description="选择用于意图识别的文本模型。">
        <ModelPicker
          value={(config.modelId as string) || undefined}
          onValueChange={(modelId) => onUpdateConfig({ modelId })}
          capability="text"
          label="文本模型"
        />
      </EditorSection>
      <EditorSection title="分类输入" description="选择需要识别意图的文本变量。">
        <VariableReferencePicker
          ariaLabel="分类输入变量"
          value={query}
          onChange={(nextQuery) => onUpdateConfig({ query: nextQuery })}
          options={queryOptions}
          placeholder="选择开始输入或上游文本输出"
        />
      </EditorSection>
      <EditorSection title="意图匹配" description="每个名称对应一个分流出口。">
        <div className="space-y-2">
          {intents.map((intent, index) => (
            <div key={intent.id} className="flex items-center gap-2">
              <Input
                aria-label={`意图 ${index + 1}`}
                value={intent.name}
                placeholder="例如：账单咨询"
                onChange={(event) => updateIntent(index, { name: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`删除意图 ${index + 1}`}
                disabled={intents.length <= 1}
                onClick={() =>
                  onUpdateConfig({
                    intents: intents.filter((_, intentIndex) => intentIndex !== index),
                  })
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
            disabled={intents.length >= 10}
            onClick={() => onUpdateConfig({ intents: [...intents, createIntent(intents.length)] })}
          >
            <Plus className="mr-2 size-4" />
            添加意图
          </Button>
        </div>
      </EditorSection>
      <EditorSection title="其他意图" description="未命中上方意图时，从“其他”出口继续执行。">
        <p className="text-sm text-muted-foreground">其他</p>
      </EditorSection>
    </>
  );
}
