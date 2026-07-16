import type { WorkflowNodeType } from '../types';
import type { WorkflowVariableOption } from '../workflowVariables';
import { BlogCreateDraftPropertyForm } from './BlogCreateDraftPropertyForm';
import { BlogParsePropertyForm } from './BlogParsePropertyForm';
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
  variableOptions?: WorkflowVariableOption[];
}

export const PROPERTY_FORM_MAP: Partial<
  Record<WorkflowNodeType, React.ComponentType<PropertyFormProps>>
> = {
  start: StartPropertyForm,
  'blog.parseMarkdown': BlogParsePropertyForm,
  'knowledge.retrieve': KnowledgePropertyForm,
  'llm.text': LLMPropertyForm,
  'blog.createDraft': BlogCreateDraftPropertyForm,
  end: EndPropertyForm,
  input: InputPropertyForm,
  fileUpload: FileUploadPropertyForm,
  knowledge: KnowledgePropertyForm,
  code: CodePropertyForm,
  http: HTTPPropertyForm,
  condition: ConditionPropertyForm,
  loop: LoopPropertyForm,
  variable: VariablePropertyForm,
};
