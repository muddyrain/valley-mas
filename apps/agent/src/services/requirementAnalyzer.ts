import { LLMClient } from '../llm/client';

import { buildRequirementAnalysisPrompt, REQUIREMENT_ANALYSIS_SYSTEM_PROMPT } from '../llm/prompts';

import type { RequirementAnalysis } from '../llm/schemas';
import { withRetry } from '../llm/utils';
import { isRequirementAnalysis } from '../llm/validators';

export class RequirementAnalyzer {
  private llm: LLMClient;

  constructor(model = 'gpt-5.2') {
    this.llm = new LLMClient(model);
  }

  async analyze(requirement: string): Promise<RequirementAnalysis> {
    const userPrompt = buildRequirementAnalysisPrompt(requirement);

    return this.llm.generateJSON<RequirementAnalysis>(
      REQUIREMENT_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
    );
  }

  async analyzeWithValidators(requirement: string): Promise<RequirementAnalysis> {
    const userPrompt = buildRequirementAnalysisPrompt(requirement);
    const data = await this.llm.generateJSON<RequirementAnalysis>(
      REQUIREMENT_ANALYSIS_SYSTEM_PROMPT,
      userPrompt,
    );

    if (!isRequirementAnalysis(data)) {
      throw new Error('模型输出结构不符合 RequirementAnalysis 预期');
    }

    return data as RequirementAnalysis;
  }

  async analyzeWithRetry(requirement: string): Promise<RequirementAnalysis> {
    const userPrompt = buildRequirementAnalysisPrompt(requirement);
    const data = await withRetry(async () => {
      const result = await this.llm.generateJSON<unknown>(
        REQUIREMENT_ANALYSIS_SYSTEM_PROMPT,
        userPrompt,
      );
      if (!isRequirementAnalysis(result)) {
        throw new Error('模型输出结构不符合 RequirementAnalysis 预期');
      }

      return result;
    });

    return data;
  }
}
