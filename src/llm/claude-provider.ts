import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { LLMProvider } from './types.js';

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor() {
    this.client = new Anthropic({ apiKey: config.llm.claude.apiKey });
    this.model = config.llm.claude.model;
  }

  async generateContent(prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
    return block.text;
  }
}
