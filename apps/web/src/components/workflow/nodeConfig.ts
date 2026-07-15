import type { WorkflowNodeConfig } from './types';

export const NODE_CONFIGS: Record<string, WorkflowNodeConfig> = {
  start: {
    type: 'start',
    label: '开始',
    description: '声明 Markdown、标签和发布参数',
    icon: 'Zap',
    category: 'data',
    handles: { output: true },
    fixed: true,
    available: true,
  },
  'blog.parseMarkdown': {
    type: 'blog.parseMarkdown',
    label: '解析 Markdown',
    description: '解析文章标题、正文与 Front Matter',
    icon: 'FileText',
    category: 'data',
    handles: { input: true, output: true },
    available: true,
  },
  'knowledge.retrieve': {
    type: 'knowledge.retrieve',
    label: '检索知识库',
    description: '从当前应用已绑定的资料中检索引用',
    icon: 'Database',
    category: 'ai',
    handles: { input: true, output: true },
    available: true,
  },
  'llm.text': {
    type: 'llm.text',
    label: '大模型',
    description: '使用已配置的 ARK 文本模型',
    icon: 'MessageSquare',
    category: 'ai',
    handles: { input: true, output: true },
    available: true,
  },
  'blog.createDraft': {
    type: 'blog.createDraft',
    label: '创建博客草稿',
    description: '保存文章并合并手选标签',
    icon: 'PenLine',
    category: 'action',
    handles: { input: true, output: true },
    available: true,
  },
  end: {
    type: 'end',
    label: '结束',
    description: '返回草稿结果',
    icon: 'Send',
    category: 'data',
    handles: { input: true },
    fixed: true,
    available: true,
  },
  input: {
    type: 'input',
    label: '输入参数',
    description: '声明工作流的可复用输入参数',
    icon: 'Keyboard',
    category: 'data',
    handles: { input: true, output: true },
    // Start 节点已经承担运行输入声明；独立输入节点尚无服务端协议。
    available: false,
  },
  fileUpload: {
    type: 'fileUpload',
    label: '上传文件',
    description: '上传文件供下游节点使用',
    icon: 'Upload',
    category: 'data',
    handles: { input: true, output: true },
    // 文件只允许由 start.inputs 声明并随运行请求上传。
    available: false,
  },
  knowledge: {
    type: 'knowledge',
    label: '知识库检索',
    description: '检索知识库返回相关片段',
    icon: 'Database',
    category: 'ai',
    handles: { input: true, output: true },
    // 知识库运行时将在平台化 P2 接入前保持不可用。
    available: false,
  },
  code: {
    type: 'code',
    label: '代码执行',
    description: '执行 JavaScript 代码处理输入（当前未对外开放）',
    icon: 'Code',
    category: 'action',
    handles: { input: true, output: true },
    available: false,
  },
  http: {
    type: 'http',
    label: 'HTTP 请求',
    description: '发送 HTTP 请求获取外部数据',
    icon: 'Globe',
    category: 'action',
    handles: { input: true, output: true },
    // 任意 HTTP 调用不属于首版受控工具能力。
    available: false,
  },
  condition: {
    type: 'condition',
    label: '条件分支',
    description: '根据条件分支到不同路径（当前未对外开放）',
    icon: 'GitBranch',
    category: 'control',
    handles: { input: true, outputs: 2 },
    available: false,
  },
  loop: {
    type: 'loop',
    label: '循环',
    description: '遍历数组对每项执行子流程（当前未对外开放）',
    icon: 'Repeat',
    category: 'control',
    handles: { input: true, output: true },
    available: false,
  },
  variable: {
    type: 'variable',
    label: '变量赋值',
    description: '赋值或转换变量',
    icon: 'Hash',
    category: 'data',
    handles: { input: true, output: true },
    // 变量转换将在具备版本化变量协议后开放。
    available: false,
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

export function getNodeConfigSummary(nodeType: string, config?: Record<string, unknown>): string {
  if (!config) return '';
  switch (nodeType) {
    case 'start':
      return `${Object.keys((config.inputs as object) || {}).length} 个运行输入`;
    case 'blog.parseMarkdown':
      return String(config.fileInput || '未选择 Markdown 输入');
    case 'knowledge.retrieve':
      return String(config.query || '未设置检索问题');
    case 'llm.text':
      return String(config.modelProfile || '未选择模型配置');
    case 'blog.createDraft':
      return String(config.tagMode === 'manual_only' ? '仅手选标签' : '合并标签');
    case 'end':
      return `${Object.keys((config.outputs as object) || {}).length} 个输出`;
    case 'input': {
      const vars = (config.variables as Array<{ name: string }>) || [];
      return vars.length > 0 ? `${vars.length} 个输入参数` : '未配置参数';
    }
    case 'fileUpload': {
      const files = (config.uploadedFiles as Array<unknown>) || [];
      return files.length > 0 ? `${files.length} 个文件` : '未上传文件';
    }
    case 'knowledge':
      return String(config.datasetId || '未选择数据集');
    case 'code':
      return '暂未开放';
    case 'http':
      return String(config.url || '未配置 URL');
    case 'condition':
      return String(config.expression || '未配置条件');
    case 'loop':
      return String(config.loopVariable || '未配置循环变量');
    case 'variable':
      return String(config.variableName || '未配置变量名');
    default:
      return '';
  }
}
