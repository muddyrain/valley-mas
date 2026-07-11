import { readFileSync } from 'node:fs';

const editor = readFileSync(
  new URL('../src/pages/WorkflowEditor/index.tsx', import.meta.url),
  'utf8',
);
const panel = readFileSync(
  new URL('../src/components/workflow/RunPanel.tsx', import.meta.url),
  'utf8',
);
const api = readFileSync(new URL('../src/api/workflow.ts', import.meta.url), 'utf8');
const parseProperty = readFileSync(
  new URL('../src/components/workflow/properties/BlogParsePropertyForm.tsx', import.meta.url),
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
  if (!editor.includes(reference)) {
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
  if (editor.includes(staleReference)) {
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

if (!api.includes('await response.json()')) {
  throw new Error('Workflow run API must read non-2xx JSON error responses');
}

if (!api.includes("response.headers.get('content-type')")) {
  throw new Error('Workflow run API must reject a non-SSE success response');
}

if (!editor.includes('normalizeWorkflowEdges')) {
  throw new Error('Loaded workflow edges must be normalized for named source handles');
}

if (!editor.includes("sourceHandle: 'output'")) {
  throw new Error('Blog import template edges must declare the named output handle');
}

if (!editor.includes('id: edge.id ||')) {
  throw new Error('Loaded legacy workflow edges must receive stable IDs');
}

if (!editor.includes('({ id, source, sourceHandle, target, targetHandle })')) {
  throw new Error('Saved workflow edges must preserve their IDs');
}
