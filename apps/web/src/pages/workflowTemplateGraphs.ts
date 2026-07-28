import type { Edge, Node } from '@xyflow/react';

export interface WorkflowTemplateGraph {
  schemaVersion: 4;
  nodes: Node[];
  edges: Edge[];
}

const node = (
  id: string,
  type: string,
  label: string,
  x: number,
  config: Record<string, unknown>,
): Node => ({ id, type, position: { x, y: 250 }, data: { label, nodeType: type, config } });
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  sourceHandle: 'output',
  target,
  targetHandle: 'input',
  type: 'insertable',
});

const WORKFLOW_TEMPLATE_GRAPHS: Record<string, WorkflowTemplateGraph> = {
  'blog-import': {
    schemaVersion: 4,
    nodes: [
      node('start', 'start', '开始', 50, {
        inputs: {
          markdownFile: { type: 'file', required: true, control: 'markdown_file' },
          tagIds: { type: 'string[]', required: false, control: 'blog_tags' },
          groupId: { type: 'string', required: false, control: 'blog_group' },
          visibility: { type: 'string', required: true, control: 'visibility' },
        },
      }),
      node('parse-markdown', 'tool', '解析 Markdown', 330, {
        capabilityId: 'content.parseMarkdown',
        capabilityName: '解析 Markdown',
        inputs: { fileInput: '{{start.output.markdownFile}}' },
      }),
      node('llm-summary', 'llm', '生成摘要', 610, {
        systemPrompt: '你是内容编辑助手。请生成一句简洁、准确的博客摘要。',
        prompt: '标题：{{title}}\n\n正文：{{content}}',
        inputs: {
          title: '{{parse-markdown.output.title}}',
          content: '{{parse-markdown.output.content}}',
        },
        inputTypes: { title: 'string', content: 'string' },
        temperature: 0.4,
        maxOutputTokens: 512,
      }),
      node('create-draft', 'tool', '创建博客草稿', 900, {
        capabilityId: 'blog.createDraft',
        capabilityName: '创建博客草稿',
        sideEffect: 'write',
        inputs: {
          title: '{{parse-markdown.output.title}}',
          content: '{{parse-markdown.output.content}}',
          excerpt: '{{llm-summary.output.text}}',
          cover: '{{parse-markdown.output.cover}}',
          tags: '{{start.output.tagIds}}',
          suggestedTags: '{{parse-markdown.output.tagNames}}',
          visibility: '{{start.output.visibility}}',
        },
      }),
      node('end', 'end', '结束', 1190, {
        outputs: {
          postId: '{{create-draft.output.postId}}',
          title: '{{create-draft.output.title}}',
          editPath: '{{create-draft.output.editPath}}',
          tagIds: '{{create-draft.output.tagIds}}',
        },
      }),
    ],
    edges: [
      edge('start', 'parse-markdown'),
      edge('parse-markdown', 'llm-summary'),
      edge('llm-summary', 'create-draft'),
      edge('create-draft', 'end'),
    ],
  },
  'content-generate': {
    schemaVersion: 4,
    nodes: [
      node('start', 'start', '开始', 50, {
        inputs: {
          topic: { type: 'string', required: true },
          audience: { type: 'string', required: false },
          style: { type: 'string', required: false },
          tagIds: { type: 'string[]', required: false, control: 'blog_tags' },
          visibility: { type: 'string', required: true, control: 'visibility' },
        },
      }),
      node('knowledge', 'tool', '检索知识库', 330, {
        capabilityId: 'knowledge.retrieve',
        capabilityName: '知识库检索',
        sideEffect: 'read',
        inputs: { query: '{{start.output.topic}}' },
      }),
      node('writer', 'llm', '生成正文', 610, {
        systemPrompt: '你是内容编辑。基于参考资料写出准确、易读的博客正文。',
        prompt: '主题：{{topic}}\n受众：{{audience}}\n风格：{{style}}\n\n参考资料：\n{{context}}',
        inputs: {
          topic: '{{start.output.topic}}',
          audience: '{{start.output.audience}}',
          style: '{{start.output.style}}',
          context: '{{knowledge.output.context}}',
        },
        inputTypes: {
          topic: 'string',
          audience: 'string',
          style: 'string',
          context: 'string',
        },
        temperature: 0.6,
        maxOutputTokens: 1200,
      }),
      node('create-draft', 'tool', '创建博客草稿', 900, {
        capabilityId: 'blog.createDraft',
        capabilityName: '创建博客草稿',
        sideEffect: 'write',
        inputs: {
          title: '{{start.output.topic}}',
          content: '{{writer.output.text}}',
          tags: '{{start.output.tagIds}}',
          visibility: '{{start.output.visibility}}',
        },
      }),
      node('end', 'end', '结束', 1190, {
        outputs: {
          postId: '{{create-draft.output.postId}}',
          title: '{{create-draft.output.title}}',
          editPath: '{{create-draft.output.editPath}}',
        },
      }),
    ],
    edges: [
      edge('start', 'knowledge'),
      edge('knowledge', 'writer'),
      edge('writer', 'create-draft'),
      edge('create-draft', 'end'),
    ],
  },
};

export function getWorkflowTemplateGraph(id: string): WorkflowTemplateGraph | undefined {
  const graph = WORKFLOW_TEMPLATE_GRAPHS[id];
  return graph ? structuredClone(graph) : undefined;
}
