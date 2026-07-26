import { EditorSection } from '@/components/ai-workbench/EditorSection';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { PropertyFormProps } from './index';
import { WorkflowOutputFieldList } from './WorkflowOutputFieldList';

export function TemplatePropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  return (
    <div className="space-y-4">
      <EditorSection
        title="文本模板"
        description="确定性地拼装标题、提示词、Markdown 或其他文本，不调用模型。"
      >
        <VariableTokenEditor
          id="workflow-text-template"
          ariaLabel="文本模板"
          value={String(config.template || '')}
          onChange={(template) => onUpdateConfig({ template })}
          options={variableOptions}
          placeholder="例如：# {{开始 · 标题}}"
        />
      </EditorSection>
      <EditorSection title="输出变量" description="渲染后的结果可供下游节点使用。">
        <WorkflowOutputFieldList outputs={[['text', 'string']]} labels={{ text: '渲染文本' }} />
      </EditorSection>
    </div>
  );
}
