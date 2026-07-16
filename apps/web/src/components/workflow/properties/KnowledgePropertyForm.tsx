import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { WorkflowVariableOption } from '../workflowVariables';

interface KnowledgePropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
  variableOptions?: WorkflowVariableOption[];
}

export function KnowledgePropertyForm({
  config,
  onUpdateConfig,
  variableOptions,
}: KnowledgePropertyFormProps) {
  return (
    <EditorSection title="检索设置" description="用上游变量或固定文本描述要查找的信息。">
      <div className="space-y-2">
        <div className="space-y-2">
          <Label>检索问题</Label>
          {variableOptions ? (
            <VariableTokenEditor
              id="knowledge-query"
              value={(config.query as string) || ''}
              onChange={(query) => onUpdateConfig({ query })}
              options={variableOptions}
              placeholder="描述要检索的信息"
            />
          ) : (
            <Input
              value={(config.query as string) || ''}
              onChange={(e) => onUpdateConfig({ query: e.target.value })}
              placeholder="{{start.output.topic}}"
            />
          )}
        </div>
      </div>
    </EditorSection>
  );
}
