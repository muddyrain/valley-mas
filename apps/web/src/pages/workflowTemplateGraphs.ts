import type { Edge, Node } from '@xyflow/react';

export interface WorkflowTemplateGraph {
  schemaVersion: 2;
  nodes: Node[];
  edges: Edge[];
}

const WORKFLOW_TEMPLATE_GRAPHS: Record<string, WorkflowTemplateGraph> = {
  'blog-import': {
    schemaVersion: 2,
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 50, y: 250 },
        data: {
          label: '开始',
          nodeType: 'start',
          config: {
            inputs: {
              markdownFile: { type: 'file', required: true },
              tagIds: { type: 'string[]', required: false },
              groupId: { type: 'string', required: false },
              visibility: { type: 'string', required: true },
            },
          },
        },
      },
      {
        id: 'parse-markdown',
        type: 'blog.parseMarkdown',
        position: { x: 330, y: 250 },
        data: {
          label: '解析 Markdown',
          nodeType: 'blog.parseMarkdown',
          config: { fileInput: '{{start.output.markdownFile}}' },
        },
      },
      {
        id: 'llm-summary',
        type: 'llm.text',
        position: { x: 610, y: 250 },
        data: {
          label: '生成摘要',
          nodeType: 'llm.text',
          config: {
            modelProfile: 'ark-text-default',
            systemPrompt: '你是内容编辑助手。请基于 Markdown 正文生成一句简洁、准确的博客摘要。',
            prompt:
              '标题：{{parse-markdown.output.title}}\n\n正文：{{parse-markdown.output.content}}',
            temperature: 0.4,
            maxOutputTokens: 512,
          },
        },
      },
      {
        id: 'create-draft',
        type: 'blog.createDraft',
        position: { x: 900, y: 250 },
        data: {
          label: '创建博客草稿',
          nodeType: 'blog.createDraft',
          config: {
            title: '{{parse-markdown.output.title}}',
            content: '{{parse-markdown.output.content}}',
            excerpt: '{{llm-summary.output.text}}',
            cover: '{{parse-markdown.output.cover}}',
            tags: '{{start.output.tagIds}}',
            suggestedTags: '{{parse-markdown.output.tagNames}}',
            tagMode: 'merge',
            visibility: '{{start.output.visibility}}',
          },
        },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 1190, y: 250 },
        data: {
          label: '结束',
          nodeType: 'end',
          config: {
            outputs: {
              postId: '{{create-draft.output.postId}}',
              title: '{{create-draft.output.title}}',
              editPath: '{{create-draft.output.editPath}}',
              tagIds: '{{create-draft.output.tagIds}}',
            },
          },
        },
      },
    ],
    edges: [
      { id: 'start-parse', source: 'start', sourceHandle: 'output', target: 'parse-markdown' },
      {
        id: 'parse-llm',
        source: 'parse-markdown',
        sourceHandle: 'output',
        target: 'llm-summary',
      },
      {
        id: 'llm-draft',
        source: 'llm-summary',
        sourceHandle: 'output',
        target: 'create-draft',
      },
      { id: 'draft-end', source: 'create-draft', sourceHandle: 'output', target: 'end' },
    ],
  },
  'content-generate': {
    schemaVersion: 2,
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 50, y: 250 },
        data: {
          label: '开始',
          nodeType: 'start',
          config: {
            inputs: {
              topic: { type: 'string', required: true },
              audience: { type: 'string', required: false },
              style: { type: 'string', required: false },
              tagIds: { type: 'string[]', required: false },
              visibility: { type: 'string', required: true },
            },
          },
        },
      },
      {
        id: 'knowledge',
        type: 'knowledge.retrieve',
        position: { x: 330, y: 250 },
        data: {
          label: '检索知识库',
          nodeType: 'knowledge.retrieve',
          config: { query: '{{start.output.topic}}' },
        },
      },
      {
        id: 'writer',
        type: 'llm.text',
        position: { x: 610, y: 250 },
        data: {
          label: '生成正文',
          nodeType: 'llm.text',
          config: {
            modelProfile: 'ark-text-default',
            systemPrompt:
              '你是内容编辑。基于参考资料写出准确、易读的博客正文；资料不足时明确说明。',
            prompt:
              '主题：{{start.output.topic}}\n受众：{{start.output.audience}}\n风格：{{start.output.style}}\n\n参考资料：\n{{knowledge.output.context}}',
            temperature: 0.6,
            maxOutputTokens: 1200,
          },
        },
      },
      {
        id: 'create-draft',
        type: 'blog.createDraft',
        position: { x: 900, y: 250 },
        data: {
          label: '创建博客草稿',
          nodeType: 'blog.createDraft',
          config: {
            title: '{{start.output.topic}}',
            content: '{{writer.output.text}}',
            tags: '{{start.output.tagIds}}',
            tagMode: 'manual_only',
            visibility: '{{start.output.visibility}}',
          },
        },
      },
      {
        id: 'end',
        type: 'end',
        position: { x: 1190, y: 250 },
        data: {
          label: '结束',
          nodeType: 'end',
          config: {
            outputs: {
              postId: '{{create-draft.output.postId}}',
              title: '{{create-draft.output.title}}',
              editPath: '{{create-draft.output.editPath}}',
            },
          },
        },
      },
    ],
    edges: [
      { id: 'start-knowledge', source: 'start', sourceHandle: 'output', target: 'knowledge' },
      { id: 'knowledge-writer', source: 'knowledge', sourceHandle: 'output', target: 'writer' },
      { id: 'writer-draft', source: 'writer', sourceHandle: 'output', target: 'create-draft' },
      { id: 'draft-end', source: 'create-draft', sourceHandle: 'output', target: 'end' },
    ],
  },
};

export function getWorkflowTemplateGraph(id: string): WorkflowTemplateGraph | undefined {
  const graph = WORKFLOW_TEMPLATE_GRAPHS[id];
  return graph ? structuredClone(graph) : undefined;
}
