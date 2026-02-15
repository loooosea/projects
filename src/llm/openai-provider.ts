import OpenAI from 'openai';
import { config } from '../config.js';
import type { LLMProvider } from './types.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: config.llm.openai.apiKey });
    this.model = config.llm.openai.model;
  }

  async generateContent(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenAI');
    return content;
  }
}
