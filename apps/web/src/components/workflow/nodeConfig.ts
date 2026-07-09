import type { WorkflowNodeConfig } from './types';

export const NODE_CONFIGS: Record<string, WorkflowNodeConfig> = {
  start: {
    type: 'start',
    label: '开始',
    description: '工作流入口，定义输入参数',
    icon: 'Zap',
    category: 'data',
    handles: { output: true },
    fixed: true,
  },
  input: {
    type: 'input',
    label: '输入参数',
    description: '定义工作流的输入变量',
    icon: 'Keyboard',
    category: 'data',
    handles: { input: true, output: true },
  },
  fileUpload: {
    type: 'fileUpload',
    label: '上传文件',
    description: '上传文件到工作流',
    icon: 'Upload',
    category: 'data',
    handles: { input: true, output: true },
  },
  llm: {
    type: 'llm',
    label: 'LLM 调用',
    description: '调用大语言模型生成内容',
    icon: 'MessageSquare',
    category: 'ai',
    handles: { input: true, output: true },
  },
  knowledge: {
    type: 'knowledge',
    label: '知识库检索',
    description: '从向量数据库中检索相关知识',
    icon: 'Database',
    category: 'ai',
    handles: { input: true, output: true },
  },
  code: {
    type: 'code',
    label: '代码执行',
    description: '运行 Python/JavaScript 代码片段',
    icon: 'Code',
    category: 'action',
    handles: { input: true, output: true },
  },
  http: {
    type: 'http',
    label: 'HTTP 请求',
    description: '调用外部 API 接口',
    icon: 'Globe',
    category: 'action',
    handles: { input: true, output: true },
  },
  condition: {
    type: 'condition',
    label: '条件分支',
    description: '根据条件执行不同的分支',
    icon: 'GitBranch',
    category: 'control',
    handles: { input: true, outputs: 2 },
  },
  loop: {
    type: 'loop',
    label: '循环',
    description: '遍历列表执行重复操作',
    icon: 'Repeat',
    category: 'control',
    handles: { input: true, output: true },
  },
  variable: {
    type: 'variable',
    label: '变量赋值',
    description: '设置或修改工作流变量',
    icon: 'Hash',
    category: 'data',
    handles: { input: true, output: true },
  },
  end: {
    type: 'end',
    label: '结束',
    description: '工作流出口，定义输出结果',
    icon: 'Send',
    category: 'data',
    handles: { input: true },
    fixed: true,
  },
};

export const NODE_CATEGORIES = [
  { id: 'data', label: '数据', icon: 'Database' },
  { id: 'ai', label: 'AI', icon: 'Sparkles' },
  { id: 'action', label: '操作', icon: 'Wrench' },
  { id: 'control', label: '控制', icon: 'GitBranch' },
];

export const CATEGORY_COLORS: Record<string, string> = {
  data: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ai: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  action: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  control: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export const NODE_COLORS: Record<string, string> = {
  start: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  input: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
  llm: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
  knowledge: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20',
  code: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
  http: 'border-orange-500 bg-orange-50 dark:bg-orange-900/20',
  condition: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  loop: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  variable: 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20',
  end: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
};

export const CATEGORY_STRIPE_COLORS: Record<string, string> = {
  data: 'bg-blue-500',
  ai: 'bg-purple-500',
  action: 'bg-orange-500',
  control: 'bg-green-500',
};

export function getNodeConfigSummary(nodeType: string, config?: Record<string, unknown>): string {
  if (!config) return '';
  switch (nodeType) {
    case 'start':
      return Array.isArray(config.variables) && config.variables.length > 0
        ? `${config.variables.length} 个输入参数`
        : '未设置输入参数';
    case 'llm':
      return (config.model as string) || '未选择模型';
    case 'http':
      return `${(config.method as string) || 'GET'} ${(config.url as string) || ''}`;
    case 'code':
      return (config.language as string) || 'JavaScript';
    case 'knowledge':
      return config.datasetId ? `数据集: ${config.datasetId}` : '未选择数据集';
    case 'condition':
      return (config.expression as string) || '未设置条件';
    case 'loop':
      return config.iterationCount ? `循环 ${config.iterationCount} 次` : '未设置';
    case 'variable':
      return (config.variableName as string) || '未设置变量';
    case 'end':
      return '';
    case 'input':
      return Array.isArray(config.variables) && config.variables.length > 0
        ? `${config.variables.length} 个参数`
        : '';
    default:
      return '';
  }
}
