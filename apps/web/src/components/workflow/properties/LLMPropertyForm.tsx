import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';

export function LLMPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  return (
    <div className="space-y-4">
      <EditorSection title="提示词" description="设置模型角色和本次生成任务。">
        <div className="space-y-1.5">
          <Label>模型配置</Label>
          <Input value="ARK 默认文本模型" disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="llm-system-prompt">系统提示词</Label>
          <VariableTokenEditor
            id="llm-system-prompt"
            value={(config.systemPrompt as string) || ''}
            onChange={(systemPrompt) =>
              onUpdateConfig({ systemPrompt, modelProfile: 'ark-text-default' })
            }
            options={variableOptions}
            placeholder="定义模型的角色和边界"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="llm-prompt">提示词</Label>
          <VariableTokenEditor
            id="llm-prompt"
            value={(config.prompt as string) || ''}
            onChange={(prompt) => onUpdateConfig({ prompt })}
            options={variableOptions}
            placeholder="描述本次生成任务"
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
    </div>
  );
}
