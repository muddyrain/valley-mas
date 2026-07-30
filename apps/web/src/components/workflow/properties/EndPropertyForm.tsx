import { useEffect, useMemo } from 'react';
import { EditorSection } from '@/components/ai-workbench/EditorSection';
import type { WorkflowValueType } from '../types';
import type { PropertyFormProps } from './index';
import { normalizeWorkflowResultActions, ResultActionEditor } from './ResultActionEditor';
import { VariableBindingEditor } from './VariableBindingEditor';

export function EndPropertyForm({
  config,
  onUpdateConfig,
  variableOptions = [],
}: PropertyFormProps) {
  const outputs = (config.outputs as Record<string, unknown>) || {};
  const outputTypes = (config.outputTypes as Record<string, WorkflowValueType>) || {};
  const resultActions = normalizeWorkflowResultActions(config.resultActions);
  const normalizedOutputTypes = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(outputs).map((name) => [name, outputTypes[name] || 'string']),
      ) as Record<string, WorkflowValueType>,
    [outputs, outputTypes],
  );

  useEffect(() => {
    if (Object.keys(outputs).every((name) => outputTypes[name])) return;
    onUpdateConfig({ outputTypes: normalizedOutputTypes });
  }, [normalizedOutputTypes, onUpdateConfig, outputTypes, outputs]);

  const update = (
    nextOutputs: Record<string, unknown>,
    nextTypes: Record<string, WorkflowValueType> = normalizedOutputTypes,
  ) => onUpdateConfig({ outputs: nextOutputs, outputTypes: nextTypes });

  return (
    <div className="space-y-5">
      <EditorSection title="输出变量" description="选择上游变量，或填写固定值作为工作流返回结果。">
        <VariableBindingEditor
          values={outputs}
          types={normalizedOutputTypes}
          variableOptions={variableOptions}
          onChange={update}
          addLabel="添加输出"
          baseName="output"
          nameAriaLabel="输出名称"
          valueMode="explicit"
        />
      </EditorSection>
      <EditorSection
        title="结果动作"
        description="运行完成后显示的跳转入口，目标取自某个字符串输出。"
      >
        <ResultActionEditor
          actions={resultActions}
          outputNames={Object.keys(outputs).filter(
            (name) => normalizedOutputTypes[name] === 'string',
          )}
          onChange={(actions) => onUpdateConfig({ resultActions: actions })}
        />
      </EditorSection>
    </div>
  );
}
