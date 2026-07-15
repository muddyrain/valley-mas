import { FileText, type LucideIcon, Sparkles } from 'lucide-react';

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
    name: '主题生成博客草稿',
    description: '结合已绑定资料生成博客草稿',
    enabled: true,
    icon: Sparkles,
    tags: ['AI', '生成', '内容'],
    color: 'bg-blue-500',
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
