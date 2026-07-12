import type { Node } from '@xyflow/react';

export interface ValidationError {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  message: string;
}
interface NodeData {
  label: string;
  nodeType: string;
  config?: Record<string, unknown>;
}

function validateNodeData(nodeId: string, data: NodeData): ValidationError | null {
  const config = data.config || {};
  switch (data.nodeType) {
    case 'start':
      if (!Object.keys((config.inputs as object) || {}).length)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请声明运行输入',
        };
      break;
    case 'blog.parseMarkdown':
      if (!config.fileInput)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请选择 Markdown 输入',
        };
      break;
    case 'llm.text':
      if (config.modelProfile !== 'ark-text-default')
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '模型必须为 ARK 默认文本模型',
        };
      if (!config.systemPrompt || !config.prompt)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请填写系统提示词和提示词',
        };
      break;
    case 'blog.createDraft':
      if (!config.title || !config.content || !config.tags || !config.visibility)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请完成草稿字段映射',
        };
      break;
    case 'end':
      if (!Object.keys((config.outputs as object) || {}).length)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请设置最终输出',
        };
      break;
    case 'variable':
      if (!config.variableName || !config.valueExpression)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请填写变量名和值表达式',
        };
      break;
    case 'condition':
      if (!config.expression)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请填写条件表达式',
        };
      break;
    case 'http':
      if (!config.url)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请填写请求 URL',
        };
      break;
    case 'code':
      if (!config.code)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请填写代码',
        };
      break;
    case 'knowledge':
      if (!config.datasetId)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请填写数据集 ID',
        };
      break;
    case 'loop':
      if (!config.loopVariable)
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请填写循环变量',
        };
      break;
    case 'input': {
      const vars = (config.variables as Array<{ name: string }>) || [];
      if (vars.length === 0 || vars.some((v) => !v.name))
        return {
          nodeId,
          nodeLabel: data.label,
          nodeType: data.nodeType,
          message: '请至少添加一个命名的输入参数',
        };
      break;
    }
    case 'fileUpload':
      break;
  }
  return null;
}

export function validateWorkflowConfig(nodes: Node[]): ValidationError[] {
  return nodes
    .map((node) => validateNodeData(node.id, node.data as unknown as NodeData))
    .filter((error): error is ValidationError => error !== null);
}
export function validateSingleNode(data: NodeData): ValidationError | null {
  return validateNodeData('temp', data);
}
export function hasUnconfiguredNodes(nodes: Node[]): boolean {
  return validateWorkflowConfig(nodes).length > 0;
}
export function getUnconfiguredNodeLabels(nodes: Node[]): string[] {
  return validateWorkflowConfig(nodes).map((error) => error.nodeLabel);
}
