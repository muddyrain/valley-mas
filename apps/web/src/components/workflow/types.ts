export type WorkflowNodeType =
  | 'start'
  | 'input'
  | 'fileUpload'
  | 'llm'
  | 'knowledge'
  | 'code'
  | 'http'
  | 'condition'
  | 'loop'
  | 'variable'
  | 'end';

export interface WorkflowNodeConfig {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: string;
  category: 'ai' | 'action' | 'control' | 'data';
  handles: {
    input?: boolean;
    output?: boolean;
    outputs?: number;
  };
  fixed?: boolean;
}

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  config?: Record<string, unknown>;
  runningState?: 'idle' | 'running' | 'success' | 'error';
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

// --- 节点专属配置类型 ---

export interface StartConfig {
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    required: boolean;
  }>;
}

export interface InputConfig {
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    required: boolean;
  }>;
}

export interface LLMConfig {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export interface KnowledgeConfig {
  datasetId: string;
  topK: number;
  scoreThreshold: number;
}

export interface CodeConfig {
  language: 'python' | 'javascript';
  code: string;
  inputVars: string[];
  outputVars: string[];
}

export interface HTTPConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers: Array<{ key: string; value: string }>;
  body?: string;
}

export interface ConditionConfig {
  expression: string;
  trueLabel: string;
  falseLabel: string;
}

export interface LoopConfig {
  loopVariable: string;
  iterationCount: number;
}

export interface VariableConfig {
  variableName: string;
  valueExpression: string;
}

export interface EndConfig {
  outputMappings: Array<{ source: string; target: string }>;
}
