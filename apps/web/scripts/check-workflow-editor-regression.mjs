import { readFileSync } from 'node:fs';

const editor = readFileSync(
  new URL('../src/pages/WorkflowEditor/index.tsx', import.meta.url),
  'utf8',
);
const templateGraphs = readFileSync(
  new URL('../src/pages/workflowTemplateGraphs.ts', import.meta.url),
  'utf8',
);
const workflowGraph = readFileSync(
  new URL('../src/components/workflow/workflowGraph.ts', import.meta.url),
  'utf8',
);
const workflowVariables = readFileSync(
  new URL('../src/components/workflow/workflowVariables.ts', import.meta.url),
  'utf8',
);
const panel = readFileSync(
  new URL('../src/components/workflow/RunPanel.tsx', import.meta.url),
  'utf8',
);
const propertyPanel = readFileSync(
  new URL('../src/components/workflow/PropertyPanel.tsx', import.meta.url),
  'utf8',
);
const api = readFileSync(new URL('../src/api/workflow.ts', import.meta.url), 'utf8');
const parseProperty = readFileSync(
  new URL('../src/components/workflow/properties/BlogParsePropertyForm.tsx', import.meta.url),
  'utf8',
);
const variableEditor = readFileSync(
  new URL('../src/components/workflow/VariableTokenEditor.tsx', import.meta.url),
  'utf8',
);

const requiredEditorReferences = [
  '{{start.output.markdownFile}}',
  '{{parse-markdown.output.title}}',
  '{{parse-markdown.output.content}}',
  '{{llm-summary.output.text}}',
  '{{start.output.tagIds}}',
  '{{start.output.visibility}}',
  '{{create-draft.output.postId}}',
];

for (const reference of requiredEditorReferences) {
  if (!templateGraphs.includes(reference)) {
    throw new Error(`Missing Graph v1 template reference: ${reference}`);
  }
}

for (const staleReference of [
  '{{start.markdownFile}}',
  '{{start.tagIds}}',
  '{{start.visibility}}',
  '{{parse-markdown.title}}',
  '{{llm-summary.text}}',
  '{{create-draft.postId}}',
]) {
  if (templateGraphs.includes(staleReference)) {
    throw new Error(`Found stale Graph v1 template reference: ${staleReference}`);
  }
}

if (editor.includes('key={historyVersion}')) {
  throw new Error('RunPanel must not remount when run history refreshes');
}

if (!editor.includes('workflowRunSessionReducer')) {
  throw new Error('Workflow editor must own the current RunSession reducer');
}

if (!editor.includes('nodeTypes={workflowNodeTypes}')) {
  throw new Error('Workflow editor must use stable node types during run updates');
}

if (panel.includes('historyDetail') || panel.includes('loadHistoryDetail')) {
  throw new Error('Current run panel must not render historical node replay details');
}

if (!panel.includes('selectedGroup?.name')) {
  throw new Error('Selected blog group must render its display name');
}

if (!parseProperty.includes('{{start.output.markdownFile}}')) {
  throw new Error('Markdown property default must use the Graph v1 output namespace');
}

if (!parseProperty.includes('VariableTokenEditor') || !parseProperty.includes('compact')) {
  throw new Error('Markdown file input must use the compact variable editor');
}

if (!propertyPanel.includes("nodeType === 'blog.parseMarkdown'")) {
  throw new Error('Markdown parser must receive upstream variable options');
}

if (!api.includes('await response.json()')) {
  throw new Error('Workflow run API must read non-2xx JSON error responses');
}

if (!api.includes("response.headers.get('content-type')")) {
  throw new Error('Workflow run API must reject a non-SSE success response');
}

if (!editor.includes('normalizeWorkflowEdges')) {
  throw new Error('Loaded workflow edges must be normalized for named source handles');
}

if (!templateGraphs.includes("sourceHandle: 'output'")) {
  throw new Error('Blog import template edges must declare the named output handle');
}

if (!workflowGraph.includes('id: edge.id ||')) {
  throw new Error('Loaded legacy workflow edges must receive stable IDs');
}

if (!workflowGraph.includes('({ id, source, sourceHandle, target, targetHandle })')) {
  throw new Error('Saved workflow edges must preserve their IDs');
}

if (!variableEditor.includes('editor.replaceChildren')) {
  throw new Error('Variable editor must own contentEditable children outside React reconciliation');
}

if (variableEditor.includes('{segments.map')) {
  throw new Error('Variable editor must not render React children inside contentEditable');
}

if (!variableEditor.includes('document.createTreeWalker')) {
  throw new Error('Variable editor must restore the caret within inline variable text');
}

if (variableEditor.includes("token.contentEditable = 'false'")) {
  throw new Error('Variable editor tokens must remain editable inline text');
}

if (!variableEditor.includes('{{}}')) {
  throw new Error('Variable editor must provide a complete placeholder when typing {{');
}

if (!variableEditor.includes('readRawValue(editor) !== value')) {
  throw new Error('Variable editor must not redraw unchanged local input while typing');
}

if (!variableEditor.includes('选择变量') || !variableEditor.includes('shadow-2xl')) {
  throw new Error('Variable editor must show prominent variable suggestions');
}

if (!variableEditor.includes('initialFocus={false}')) {
  throw new Error('Variable suggestions must not take focus away from the editor');
}

if (!variableEditor.includes('InlineVariableOptionList') || !variableEditor.includes('space-y-3')) {
  throw new Error('Variable suggestions must use separated selectable rows');
}

if (!variableEditor.includes('hasMatchingVariableElements')) {
  throw new Error('Variable editor must restore missing inline variable styling');
}

if (
  !variableEditor.includes('undoStackRef') ||
  !variableEditor.includes("event.key.toLowerCase() === 'z'")
) {
  throw new Error('Variable editor must support undo after inserting a variable');
}

if (!variableEditor.includes('text-blue-600')) {
  throw new Error('Variable editor must render valid references in blue');
}

if (!workflowVariables.includes('\\{\\{[^\\n]*?(?:\\}\\}|$)')) {
  throw new Error('Variable parser must preserve incomplete references for invalid styling');
}
