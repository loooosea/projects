import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { LLMProvider } from './types.js';

export class GeminiProvider implements LLMProvider {
  private model;

  constructor() {
    const genAI = new GoogleGenerativeAI(config.llm.gemini.apiKey);
    this.model = genAI.getGenerativeModel({ model: config.llm.gemini.model });
  }

  async generateContent(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    const text = result.response.text();
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  }
}
