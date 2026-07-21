import { BookOpen, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { PromptAssistantDialog } from '@/components/ai-workbench/PromptAssistantDialog';
import { PromptLibraryDialog } from '@/components/ai-workbench/PromptLibraryDialog';
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
import { ModelPicker } from '../ModelPicker';
import { VariableTokenEditor } from '../VariableTokenEditor';
import { getWorkflowNodeOutputFields } from '../workflowVariables';
import type { PropertyFormProps } from './index';
import { RecordKeyInput } from './RecordKeyInput';
import { VariableBindingEditor } from './VariableBindingEditor';
import { WorkflowOutputFieldList } from './WorkflowOutputFieldList';

export function LLMPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const [showAssistant, setShowAssistant] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const systemPrompt = (config.systemPrompt as string) || '';
  const taskPrompt = (config.prompt as string) || '';
  const inputs = (config.inputs as Record<string, unknown>) || {};
  const inputTypes =
    (config.inputTypes as Record<string, import('../types').WorkflowValueType>) || {};
  const upstreamVariableOptions = variableOptions.filter((option) => option.scope !== 'local');
  const outputs = getWorkflowNodeOutputFields('llm', config);
  const outputMode = config.outputMode === 'json' ? 'json' : 'text';
  const outputSchema =
    (config.outputSchema as Record<string, import('../types').WorkflowValueType>) || {};
  const schemaTypes: import('../types').WorkflowValueType[] = [
    'string',
    'string[]',
    'object',
    'number',
    'boolean',
  ];
  const updateOutputSchema = (nextSchema: Record<string, import('../types').WorkflowValueType>) =>
    onUpdateConfig({ outputMode: 'json', outputSchema: nextSchema });

  return (
    <div className="space-y-4">
      <EditorSection title="输入变量" description="绑定模型本次调用使用的上游变量。">
        <VariableBindingEditor
          values={inputs}
          types={inputTypes}
          variableOptions={upstreamVariableOptions}
          onChange={(nextInputs, nextTypes) =>
            onUpdateConfig({ inputs: nextInputs, inputTypes: nextTypes })
          }
          addLabel="添加输入"
          baseName="input"
          nameAriaLabel="输入名称"
          valueMode="reference"
        />
      </EditorSection>
      <EditorSection title="模型设置" description="选择模型并调整生成参数。">
        <ModelPicker
          value={(config.modelId as string) || undefined}
          onValueChange={(modelId) => onUpdateConfig({ modelId })}
          capability="text"
          label="文本模型"
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="llm-temperature">Temperature</Label>
            <Input
              id="llm-temperature"
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={(config.temperature as number) ?? 0.4}
              onChange={(event) => onUpdateConfig({ temperature: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="llm-max-tokens">最大 Token</Label>
            <Input
              id="llm-max-tokens"
              type="number"
              min="1"
              max="4096"
              value={(config.maxOutputTokens as number) ?? 512}
              onChange={(event) => onUpdateConfig({ maxOutputTokens: Number(event.target.value) })}
            />
          </div>
        </div>
      </EditorSection>
      <EditorSection title="模型指令" description="设置模型角色规则与本次任务。">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="llm-system-prompt">系统指令</Label>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPromptLibrary(true)}>
                <BookOpen className="mr-2 size-3.5" />
                提示词库
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!systemPrompt.trim() && !taskPrompt.trim()}
                onClick={() => setShowAssistant(true)}
              >
                <Sparkles className="mr-2 size-3.5" />
                AI 优化
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            定义模型持续遵循的角色、规则和边界，可留空。
          </p>
          <VariableTokenEditor
            id="llm-system-prompt"
            ariaLabel="系统指令"
            value={systemPrompt}
            onChange={(nextSystemPrompt) => onUpdateConfig({ systemPrompt: nextSystemPrompt })}
            options={variableOptions}
            placeholder="例如：你是专业的内容编辑，回答应准确、简洁"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="llm-prompt">用户任务</Label>
          <p className="text-xs text-muted-foreground">描述本次执行的具体任务，可引用上游变量。</p>
          <VariableTokenEditor
            id="llm-prompt"
            ariaLabel="用户提示词"
            value={taskPrompt}
            onChange={(prompt) => onUpdateConfig({ prompt })}
            options={variableOptions}
            placeholder="例如：根据输入主题生成一篇文章"
          />
        </div>
      </EditorSection>
      <EditorSection title="输出" description="下游节点可直接引用这些字段。">
        <div className="space-y-3">
          <Select
            value={outputMode}
            onValueChange={(value) => onUpdateConfig({ outputMode: value })}
          >
            <SelectTrigger aria-label="输出格式">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">文本</SelectItem>
              <SelectItem value="json">结构化 JSON</SelectItem>
            </SelectContent>
          </Select>
          {outputMode === 'json' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                运行时会自动要求模型仅返回符合字段类型的 JSON。
              </p>
              {Object.entries(outputSchema).map(([name, type]) => (
                <div key={name} className="grid grid-cols-[minmax(0,1fr)_110px_auto] gap-2">
                  <RecordKeyInput
                    name={name}
                    names={Object.keys(outputSchema)}
                    ariaLabel="输出字段名称"
                    onCommit={(nextName) => {
                      const next = { ...outputSchema };
                      delete next[name];
                      next[nextName] = type;
                      updateOutputSchema(next);
                    }}
                  />
                  <Select
                    value={type}
                    onValueChange={(nextType) =>
                      updateOutputSchema({
                        ...outputSchema,
                        [name]: nextType as import('../types').WorkflowValueType,
                      })
                    }
                  >
                    <SelectTrigger aria-label={`${name} 输出类型`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {schemaTypes.map((schemaType) => (
                        <SelectItem key={schemaType} value={schemaType}>
                          {schemaType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`删除输出字段 ${name}`}
                    onClick={() => {
                      const next = { ...outputSchema };
                      delete next[name];
                      updateOutputSchema(next);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  let index = 1;
                  while (outputSchema[`field${index}`]) index += 1;
                  updateOutputSchema({ ...outputSchema, [`field${index}`]: 'string' });
                }}
              >
                <Plus className="mr-2 size-4" />
                添加字段
              </Button>
            </div>
          ) : (
            <WorkflowOutputFieldList
              outputs={outputs}
              descriptions={{
                text: '模型生成内容',
                model: '实际使用的模型',
                tokenUsage: '本次调用的 Token 用量',
              }}
            />
          )}
        </div>
      </EditorSection>
      <PromptLibraryDialog
        open={showPromptLibrary}
        onOpenChange={setShowPromptLibrary}
        onInsert={(content) =>
          onUpdateConfig({
            systemPrompt: [systemPrompt.trim(), content.trim()].filter(Boolean).join('\n\n'),
          })
        }
      />
      <PromptAssistantDialog
        open={showAssistant}
        onOpenChange={setShowAssistant}
        target="workflow_llm"
        currentPrompt={systemPrompt || taskPrompt}
        allowedVariables={variableOptions.map((item) => item.token)}
        onReplace={(suggestion) =>
          onUpdateConfig({
            systemPrompt: suggestion.optimizedPrompt,
          })
        }
      />
    </div>
  );
}
