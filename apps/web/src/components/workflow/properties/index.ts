import type { WorkflowNodeType } from '../types';
import { CodePropertyForm } from './CodePropertyForm';
import { ConditionPropertyForm } from './ConditionPropertyForm';
import { EndPropertyForm } from './EndPropertyForm';
import { FileUploadPropertyForm } from './FileUploadPropertyForm';
import { HTTPPropertyForm } from './HTTPPropertyForm';
import { InputPropertyForm } from './InputPropertyForm';
import { KnowledgePropertyForm } from './KnowledgePropertyForm';
import { LLMPropertyForm } from './LLMPropertyForm';
import { LoopPropertyForm } from './LoopPropertyForm';
import { StartPropertyForm } from './StartPropertyForm';
import { VariablePropertyForm } from './VariablePropertyForm';

export interface PropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export const PROPERTY_FORM_MAP: Record<WorkflowNodeType, React.ComponentType<PropertyFormProps>> = {
  start: StartPropertyForm,
  input: InputPropertyForm,
  fileUpload: FileUploadPropertyForm,
  llm: LLMPropertyForm,
  knowledge: KnowledgePropertyForm,
  code: CodePropertyForm,
  http: HTTPPropertyForm,
  condition: ConditionPropertyForm,
  loop: LoopPropertyForm,
  variable: VariablePropertyForm,
  end: EndPropertyForm,
};
