import type { WorkflowNodeType } from '../types';
import { BlogCreateDraftPropertyForm } from './BlogCreateDraftPropertyForm';
import { BlogParsePropertyForm } from './BlogParsePropertyForm';
import { EndPropertyForm } from './EndPropertyForm';
import { LLMPropertyForm } from './LLMPropertyForm';
import { StartPropertyForm } from './StartPropertyForm';

export interface PropertyFormProps {
  config: Record<string, unknown>;
  onUpdateConfig: (updates: Partial<Record<string, unknown>>) => void;
}

export const PROPERTY_FORM_MAP: Partial<
  Record<WorkflowNodeType, React.ComponentType<PropertyFormProps>>
> = {
  start: StartPropertyForm,
  'blog.parseMarkdown': BlogParsePropertyForm,
  'llm.text': LLMPropertyForm,
  'blog.createDraft': BlogCreateDraftPropertyForm,
  end: EndPropertyForm,
};
