import 'dotenv/config';
import OpenAI from 'openai';

export class LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(model = 'gpt-5.2') {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.psydo.top',
    });
    this.model = model;
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }],
        },
      ],
    });
    return response.output_text;
  }

  async generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const text = await this.generateText(systemPrompt, userPrompt);

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`模型输出不是合法 JSON: ${text}`);
    }
  }
}
