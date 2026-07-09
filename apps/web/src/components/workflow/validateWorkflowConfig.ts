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
  const label = data.label;
  const nodeType = data.nodeType;

  switch (nodeType) {
    case 'llm':
      if (!config.model) {
        return { nodeId, nodeLabel: label, nodeType, message: '请选择模型' };
      }
      break;
    case 'http':
      if (!config.url) {
        return { nodeId, nodeLabel: label, nodeType, message: '请填写请求地址' };
      }
      break;
    case 'code':
      if (!config.code) {
        return { nodeId, nodeLabel: label, nodeType, message: '请填写代码' };
      }
      break;
    case 'knowledge':
      if (!config.datasetId) {
        return { nodeId, nodeLabel: label, nodeType, message: '请选择数据集' };
      }
      break;
    case 'condition':
      if (!config.expression) {
        return { nodeId, nodeLabel: label, nodeType, message: '请设置条件表达式' };
      }
      break;
    case 'loop':
      if (!config.iterationCount || Number(config.iterationCount) <= 0) {
        return { nodeId, nodeLabel: label, nodeType, message: '请设置循环次数' };
      }
      break;
    case 'variable':
      if (!config.variableName) {
        return { nodeId, nodeLabel: label, nodeType, message: '请设置变量名' };
      }
      break;
    // start, end, input 不需要校验
  }

  return null;
}

export function validateWorkflowConfig(nodes: Node[]): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of nodes) {
    const data = node.data as unknown as NodeData;
    const error = validateNodeData(node.id, data);
    if (error) errors.push(error);
  }

  return errors;
}

export function validateSingleNode(data: NodeData): ValidationError | null {
  return validateNodeData('temp', data);
}

export function hasUnconfiguredNodes(nodes: Node[]): boolean {
  return validateWorkflowConfig(nodes).length > 0;
}

export function getUnconfiguredNodeLabels(nodes: Node[]): string[] {
  return validateWorkflowConfig(nodes).map((e) => e.nodeLabel);
}
