import assert from 'node:assert/strict';
import type { Edge, Node } from '@xyflow/react';
import type { WorkflowToolCapability } from '../src/api/workflow.ts';
import { normalizeStartInputs, renameStartInput } from '../src/components/workflow/types.ts';
import { validateToolCapabilityInputs } from '../src/components/workflow/workflowToolInputValidation.ts';
import {
  migrateLLMPromptBindings,
  renameWorkflowNodeOutputReferences,
} from '../src/components/workflow/workflowVariables.ts';

const legacyInputs = normalizeStartInputs({
  markdownFile: { type: 'file', required: true },
  visibility: { type: 'string', required: true },
  tagIds: { type: 'string[]', required: false },
});
assert.equal(legacyInputs.markdownFile.control, 'markdown_file');
assert.equal(legacyInputs.visibility.control, 'visibility');
assert.equal(legacyInputs.tagIds.control, 'blog_tags');

const renamedInputs = renameStartInput(legacyInputs, 'visibility', 'access');
assert.deepEqual(Object.keys(renamedInputs), ['markdownFile', 'access', 'tagIds']);
assert.equal(renamedInputs.access.control, 'visibility');
assert.equal(renamedInputs.visibility, undefined);

const graphNodes: Node[] = [
  {
    id: 'start',
    type: 'workflowNode',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'start',
      label: '开始',
      config: { inputs: legacyInputs },
    },
  },
  {
    id: 'consumer',
    type: 'workflowNode',
    position: { x: 200, y: 0 },
    data: {
      nodeType: 'tool',
      label: '消费节点',
      config: {
        direct: '{{start.output.visibility}}',
        nested: ['保持', { value: '{{ start.output.visibility }}' }],
        unrelated: '{{start.output.tagIds}}',
      },
      when: {
        left: '{{start.output.visibility}}',
        right: 'private',
      },
    },
  },
];

const renamedGraph = renameWorkflowNodeOutputReferences(
  graphNodes,
  'start',
  'visibility',
  'access',
);
const renamedConsumer = renamedGraph[1].data as {
  config: {
    direct: string;
    nested: [string, { value: string }];
    unrelated: string;
  };
  when: { left: string };
};
assert.equal(renamedConsumer.config.direct, '{{start.output.access}}');
assert.equal(renamedConsumer.config.nested[1].value, '{{start.output.access}}');
assert.equal(renamedConsumer.config.unrelated, '{{start.output.tagIds}}');
assert.equal(renamedConsumer.when.left, '{{start.output.access}}');

const llmNodes: Node[] = [
  {
    id: 'start',
    type: 'workflowNode',
    position: { x: 0, y: 0 },
    data: {
      nodeType: 'start',
      label: '开始',
      config: {
        inputs: {
          topic: { type: 'string', required: true, control: 'default' },
        },
      },
    },
  },
  {
    id: 'writer',
    type: 'workflowNode',
    position: { x: 200, y: 0 },
    data: {
      nodeType: 'llm',
      label: '写作',
      config: {
        inputs: {},
        inputTypes: {},
        systemPrompt: '围绕 {{start.output.topic}} 写作',
        prompt: '主题：{{start.output.topic}}',
      },
    },
  },
];
const llmEdges: Edge[] = [{ id: 'start-writer', source: 'start', target: 'writer' }];
const migratedNodes = migrateLLMPromptBindings(llmNodes, llmEdges);
const migratedConfig = (migratedNodes[1].data as { config: Record<string, unknown> }).config;
assert.deepEqual(migratedConfig.inputs, { topic: '{{start.output.topic}}' });
assert.deepEqual(migratedConfig.inputTypes, { topic: 'string' });
assert.equal(migratedConfig.systemPrompt, '围绕 {{topic}} 写作');
assert.equal(migratedConfig.prompt, '主题：{{topic}}');

const testToolCapability: WorkflowToolCapability = {
  id: 'test.fetch',
  name: '测试工具',
  description: '验证工具必填输入',
  category: 'tool',
  sideEffect: 'read',
  modelCost: 0,
  writeCost: 0,
  available: true,
  inputSchema: {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', title: '链接' },
      limit: { type: 'number', title: '数量' },
    },
  },
  outputSchema: { content: 'string' },
  aiUsage: '',
};
const missingToolInputErrors = validateToolCapabilityInputs(testToolCapability, {
  url: '',
  limit: 0,
});
assert.deepEqual(missingToolInputErrors, [{ field: 'url', message: '必填输入“链接”不能为空' }]);
assert.equal(
  validateToolCapabilityInputs(testToolCapability, {
    url: 'https://example.com',
    limit: 0,
  }).length,
  0,
);

console.log('workflow variable model tests passed');
