import { FileText, type LucideIcon, Sparkles, Zap } from 'lucide-react';

export interface WorkflowTemplateConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  icon: LucideIcon;
  tags: string[];
  color: string;
}

export const WORKFLOW_TEMPLATE_DEFS: WorkflowTemplateConfig[] = [
  {
    id: 'blog-import',
    name: '博客导入工作流',
    description: '上传 Markdown 文件，AI 自动解析、生成摘要、匹配封面、推荐标签，一键创建博客文章',
    enabled: true,
    icon: FileText,
    tags: ['AI', '博客', '自动'],
    color: 'bg-purple-500',
  },
  {
    id: 'content-generate',
    name: '内容生成工作流',
    description: '输入主题，AI 自动生成文章内容、配图和标签',
    enabled: false,
    icon: Sparkles,
    tags: ['AI', '生成', '内容'],
    color: 'bg-blue-500',
  },
  {
    id: 'knowledge-search',
    name: '知识库检索工作流',
    description: '从向量数据库中检索相关知识，辅助内容创作',
    enabled: false,
    icon: Zap,
    tags: ['AI', '知识库', '检索'],
    color: 'bg-green-500',
  },
];

export const ENABLED_TEMPLATE_IDS = new Set(
  WORKFLOW_TEMPLATE_DEFS.filter((template) => template.enabled).map((template) => template.id),
);

export const TOTAL_TEMPLATE_COUNT = WORKFLOW_TEMPLATE_DEFS.length;
export const ENABLED_TEMPLATE_COUNT = WORKFLOW_TEMPLATE_DEFS.filter(
  (template) => template.enabled,
).length;

export function getWorkflowTemplate(id: string): WorkflowTemplateConfig | undefined {
  return WORKFLOW_TEMPLATE_DEFS.find((template) => template.id === id);
}

export function isTemplateSupported(id: string | null): boolean {
  return ENABLED_TEMPLATE_IDS.has(id || '');
}
