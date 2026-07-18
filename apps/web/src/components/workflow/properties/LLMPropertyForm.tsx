import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { PromptAssistantDialog } from '@/components/ai-workbench/PromptAssistantDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VariableTokenEditor } from '../VariableTokenEditor';
import { getWorkflowNodeOutputFields } from '../workflowVariables';
import type { PropertyFormProps } from './index';
import { VariableBindingEditor } from './VariableBindingEditor';
import { WorkflowOutputFieldList } from './WorkflowOutputFieldList';

export function LLMPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const [showAssistant, setShowAssistant] = useState(false);
  const systemPrompt = (config.systemPrompt as string) || '';
  const taskPrompt = (config.prompt as string) || '';
  const inputs = (config.inputs as Record<string, unknown>) || {};
  const inputTypes =
    (config.inputTypes as Record<string, import('../types').WorkflowValueType>) || {};
  const upstreamVariableOptions = variableOptions.filter((option) => option.scope !== 'local');
  const outputs = getWorkflowNodeOutputFields('llm', config);
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
        />
      </EditorSection>
      <EditorSection title="提示词" description="设置模型角色和本次生成任务。">
        <div className="space-y-1.5">
          <Label>模型配置</Label>
          <Input value="ARK 默认文本模型" disabled />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="llm-system-prompt">系统提示词</Label>
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
          <p className="text-xs text-muted-foreground">
            定义模型持续遵循的角色、规则和边界，可留空。
          </p>
          <VariableTokenEditor
            id="llm-system-prompt"
            ariaLabel="系统提示词"
            value={(config.systemPrompt as string) || ''}
            onChange={(systemPrompt) =>
              onUpdateConfig({ systemPrompt, modelProfile: 'ark-text-default' })
            }
            options={variableOptions}
            placeholder="例如：你是专业的内容编辑，回答应准确、简洁"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="llm-prompt">用户提示词</Label>
          <p className="text-xs text-muted-foreground">描述本次执行的具体任务，可引用上游变量。</p>
          <VariableTokenEditor
            id="llm-prompt"
            ariaLabel="用户提示词"
            value={(config.prompt as string) || ''}
            onChange={(prompt) => onUpdateConfig({ prompt })}
            options={variableOptions}
            placeholder="例如：根据输入主题生成一篇文章"
          />
        </div>
      </EditorSection>
      <EditorSection title="生成参数" description="控制输出的随机性和长度。">
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
      <EditorSection title="输出" description="下游节点可直接引用这些字段。">
        <WorkflowOutputFieldList
          outputs={outputs}
          descriptions={{
            text: '模型生成内容',
            model: '实际使用的模型',
            tokenUsage: '本次调用的 Token 用量',
          }}
        />
      </EditorSection>
      <PromptAssistantDialog
        open={showAssistant}
        onOpenChange={setShowAssistant}
        target="workflow_llm"
        currentPrompt={systemPrompt || taskPrompt}
        allowedVariables={variableOptions.map((item) => item.token)}
        onReplace={(suggestion) =>
          onUpdateConfig({
            systemPrompt: suggestion.optimizedPrompt,
            modelProfile: 'ark-text-default',
          })
        }
      />
    </div>
  );
}
