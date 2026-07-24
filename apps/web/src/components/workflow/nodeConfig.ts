import type { WorkflowNodeConfig } from './types';

export const NODE_CONFIGS: Record<string, WorkflowNodeConfig> = {
  start: {
    type: 'start',
    label: '开始',
    description: '声明工作流运行输入',
    icon: 'Zap',
    category: 'flow',
    handles: { output: true },
    fixed: true,
  },
  end: {
    type: 'end',
    label: '结束',
    description: '返回工作流最终输出',
    icon: 'Send',
    category: 'flow',
    handles: { input: true },
    fixed: true,
  },
  llm: {
    type: 'llm',
    label: '大模型',
    description: '使用受控 ARK 模型生成文本',
    icon: 'MessageSquare',
    category: 'model',
    handles: { input: true, output: true },
    whenAllowed: true,
  },
  tool: {
    type: 'tool',
    label: '工具',
    description: '调用服务端白名单业务能力',
    icon: 'Wrench',
    category: 'tool',
    handles: { input: true, output: true },
    whenAllowed: true,
  },
  condition: {
    type: 'condition',
    label: '条件',
    description: '按受控规则选择 true 或 false 路径',
    icon: 'GitBranch',
    category: 'flow',
    handles: { input: true, outputs: 2 },
  },
  switch: {
    type: 'switch',
    label: '选择器',
    description: '根据结构化字段选择一条路径',
    icon: 'GitBranch',
    category: 'flow',
    handles: { input: true, outputs: 3 },
  },
  merge: {
    type: 'merge',
    label: '合并',
    description: '使用首个实际执行分支中的值',
    icon: 'GitMerge',
    category: 'flow',
    handles: { input: true, output: true },
  },
  variable: {
    type: 'variable',
    label: '变量',
    description: '设置类型明确的工作流变量',
    icon: 'Hash',
    category: 'flow',
    handles: { input: true, output: true },
    whenAllowed: true,
  },
  subworkflow: {
    type: 'subworkflow',
    label: '子工作流',
    description: '调用已发布的不可变工作流版本',
    icon: 'Workflow',
    category: 'subworkflow',
    handles: { input: true, output: true },
    whenAllowed: true,
  },
  intent: {
    type: 'intent',
    label: '意图识别',
    description: '按已配置意图将文本分流',
    icon: 'Lightbulb',
    category: 'logic',
    handles: { input: true, outputs: 2 },
  },
  loop: {
    type: 'loop',
    label: '循环',
    description: '重复执行循环体中的子流程',
    icon: 'Repeat2',
    category: 'flow',
    handles: { input: true, output: true },
  },
  set_loop_variable: {
    type: 'set_loop_variable',
    label: '设置循环变量',
    description: '更新下一轮使用的中间变量',
    icon: 'Hash',
    category: 'flow',
    handles: { input: true, output: true },
  },
  continue_loop: {
    type: 'continue_loop',
    label: '继续循环',
    description: '结束当前轮循环',
    icon: 'Repeat2',
    category: 'flow',
    handles: { input: true, output: true },
  },
  terminate_loop: {
    type: 'terminate_loop',
    label: '终止循环',
    description: '结束整个循环',
    icon: 'Repeat2',
    category: 'flow',
    handles: { input: true, output: true },
  },
};

export const NODE_CATEGORIES = [
  { id: 'model', label: '大模型', icon: 'Sparkles' },
  { id: 'flow', label: '流程控制', icon: 'GitBranch' },
  { id: 'logic', label: '业务逻辑', icon: 'Lightbulb' },
  { id: 'tool', label: '工具', icon: 'Wrench' },
  { id: 'subworkflow', label: '子工作流', icon: 'Workflow' },
] as const;

export function getNodeConfigSummary(
  nodeType: string,
  config?: Record<string, unknown>,
  loopBodyNodeCount?: number,
): string {
  if (!config) return '';
  switch (nodeType) {
    case 'start':
      return `${Object.keys((config.inputs as object) || {}).length} 个运行输入`;
    case 'end':
      return `${Object.keys((config.outputs as object) || {}).length} 个输出`;
    case 'llm': {
      const modelName = typeof config.modelName === 'string' ? config.modelName.trim() : '';
      return modelName || (config.modelId ? '已选择模型' : '未选择模型');
    }
    case 'tool':
      return String(config.capabilityName || config.capabilityId || '未选择工具');
    case 'condition':
      return config.left && config.operator
        ? `${String(config.left)} ${String(config.operator)}`
        : '未配置条件';
    case 'switch':
      return `${Array.isArray(config.cases) ? config.cases.length : 0} 个 case + 默认`;
    case 'merge':
      return `${Array.isArray(config.fields) ? config.fields.length : 0} 个合并字段`;
    case 'variable':
      return `${Array.isArray(config.assignments) ? config.assignments.length : 0} 个变量`;
    case 'subworkflow':
      return String(config.workflowName || config.workflowId || '未选择已发布工作流');
    case 'intent':
      return `${Array.isArray(config.intents) ? config.intents.length : 0} 个意图 + 其他`;
    case 'loop': {
      const mode =
        config.mode === 'count' ? '指定次数' : config.mode === 'infinite' ? '无限循环' : '数组循环';
      const body =
        config.body && typeof config.body === 'object'
          ? (config.body as { nodes?: unknown[] })
          : undefined;
      const nodeCount =
        typeof loopBodyNodeCount === 'number'
          ? loopBodyNodeCount
          : Array.isArray(body?.nodes)
            ? body.nodes.length
            : 0;
      return `${mode} · ${nodeCount} 个循环体节点`;
    }
    default:
      return '';
  }
}
