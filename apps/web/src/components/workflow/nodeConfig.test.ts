import { describe, expect, it } from 'vitest';
import { getNodeConfigSummary, NODE_CONFIGS } from './nodeConfig';

describe('workflow node configuration catalog', () => {
  it('defines every supported editor node with a matching type', () => {
    expect(Object.entries(NODE_CONFIGS).every(([key, config]) => key === config.type)).toBe(true);
    expect(NODE_CONFIGS.start.fixed).toBe(true);
    expect(NODE_CONFIGS.end.fixed).toBe(true);
  });

  it.each([
    ['start', { inputs: { topic: {}, file: {} } }, undefined, '2 个运行输入'],
    ['end', { outputs: { title: {} } }, undefined, '1 个输出'],
    ['llm', { modelName: '  Doubao Pro  ' }, undefined, 'Doubao Pro'],
    ['llm', { modelId: 'model-1' }, undefined, '已选择模型'],
    ['template', { template: 'Hello' }, undefined, '已配置文本模板'],
    ['http', { method: 'post', url: 'https://example.com' }, undefined, 'POST 已配置 URL'],
    ['tool', { capabilityName: '创建草稿' }, undefined, '创建草稿'],
    [
      'condition',
      { left: '{{a.output.x}}', operator: 'equals' },
      undefined,
      '{{a.output.x}} equals',
    ],
    ['switch', { cases: [{}, {}] }, undefined, '2 个 case + 默认'],
    ['merge', { fields: [{}] }, undefined, '1 个合并字段'],
    ['variable', { assignments: [{}, {}] }, undefined, '2 个变量'],
    ['subworkflow', { workflowName: '子流程' }, undefined, '子流程'],
    ['intent', { intents: [{}] }, undefined, '1 个意图 + 其他'],
    ['loop', { mode: 'count', body: { nodes: [{}, {}] } }, 3, '指定次数 · 3 个循环体节点'],
    ['approval', { title: '确认发布' }, undefined, '确认发布'],
    ['delay', { delayMs: 1500 }, undefined, '1500 毫秒'],
  ])('summarizes %s configuration', (nodeType, config, loopCount, expected) => {
    expect(getNodeConfigSummary(nodeType, config, loopCount)).toBe(expected);
  });

  it('returns stable empty and unconfigured summaries', () => {
    expect(getNodeConfigSummary('llm', {})).toBe('未选择模型');
    expect(getNodeConfigSummary('http', { method: 'get' })).toBe('GET 未配置 URL');
    expect(getNodeConfigSummary('unknown', {})).toBe('');
    expect(getNodeConfigSummary('llm')).toBe('');
  });
});
