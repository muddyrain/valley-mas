import { EditorSection } from '@/components/ai-workbench/EditorSection';
import type { WorkflowValueType } from '../types';
import type { PropertyFormProps } from './index';
import { VariableBindingEditor } from './VariableBindingEditor';

export function EndPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const outputs = (config.outputs as Record<string, unknown>) || {};
  const outputTypes = (config.outputTypes as Record<string, WorkflowValueType>) || {};
  const update = (
    nextOutputs: Record<string, unknown>,
    nextTypes: Record<string, WorkflowValueType> = outputTypes,
  ) => onUpdateConfig({ outputs: nextOutputs, outputTypes: nextTypes });

  return (
    <EditorSection title="输出变量" description="选择工作流完成后返回的变量。">
      <VariableBindingEditor
        values={outputs}
        types={outputTypes}
        variableOptions={variableOptions}
        onChange={update}
        addLabel="添加输出"
        baseName="output"
        nameAriaLabel="输出名称"
      />
    </EditorSection>
  );
}
