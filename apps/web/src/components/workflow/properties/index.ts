import type { WorkflowNodeType } from '../types';
import type { WorkflowVariableOption } from '../workflowVariables';
import { ApprovalPropertyForm } from './ApprovalPropertyForm';
import { ConditionPropertyForm } from './ConditionPropertyForm';
import { DelayPropertyForm } from './DelayPropertyForm';
import { EndPropertyForm } from './EndPropertyForm';
import { HTTPPropertyForm } from './HTTPPropertyForm';
import { IntentPropertyForm } from './IntentPropertyForm';
import { LLMPropertyForm } from './LLMPropertyForm';
import { LoopPropertyForm } from './LoopPropertyForm';
import { MergePropertyForm } from './MergePropertyForm';
import { SetLoopVariablePropertyForm } from './SetLoopVariablePropertyForm';
import { StartPropertyForm } from './StartPropertyForm';
import { SubworkflowPropertyForm } from './SubworkflowPropertyForm';
import { SwitchPropertyForm } from './SwitchPropertyForm';
import { TemplatePropertyForm } from './TemplatePropertyForm';
import { ToolPropertyForm } from './ToolPropertyForm';
import { VariablePropertyForm } from './VariablePropertyForm';

export interface PropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
  variableOptions?: WorkflowVariableOption[];
  loopOutputOptions?: WorkflowVariableOption[];
  fieldErrors?: Readonly<Record<string, string>>;
}

export const PROPERTY_FORM_MAP: Partial<
  Record<WorkflowNodeType, React.ComponentType<PropertyFormProps>>
> = {
  start: StartPropertyForm,
  end: EndPropertyForm,
  llm: LLMPropertyForm,
  template: TemplatePropertyForm,
  http: HTTPPropertyForm,
  tool: ToolPropertyForm,
  condition: ConditionPropertyForm,
  switch: SwitchPropertyForm,
  merge: MergePropertyForm,
  variable: VariablePropertyForm,
  subworkflow: SubworkflowPropertyForm,
  intent: IntentPropertyForm,
  loop: LoopPropertyForm,
  set_loop_variable: SetLoopVariablePropertyForm,
  approval: ApprovalPropertyForm,
  delay: DelayPropertyForm,
};
