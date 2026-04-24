// src/llm/schemas.ts
export interface ModuleItem {
  name: string;
  responsibility: string;
}

export interface RequirementAnalysis {
  summary: string;
  modules: ModuleItem[];
  risks: string[];
  questions: string[];
}
