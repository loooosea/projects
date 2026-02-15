import { config } from '../config.js';
import { ClaudeProvider } from './claude-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { buildPrompt } from './prompts.js';
import { withRetry } from '../utils/retry.js';
import { logger } from '../utils/logger.js';
import type { LLMProvider, GeneratedContent } from './types.js';
import type { ScrapedArticle } from '../parser/web-scraper.js';

function createProvider(): LLMProvider {
  switch (config.llm.provider) {
    case 'claude':
      return new ClaudeProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    default:
      throw new Error(`Unknown LLM provider: ${config.llm.provider}`);
  }
}

export async function generateContentForArticle(article: ScrapedArticle): Promise<GeneratedContent> {
  const provider = createProvider();
  const prompt = buildPrompt(article);

  logger.info({ title: article.title, provider: config.llm.provider }, 'Generating content with LLM');

  const raw = await withRetry(
    () => provider.generateContent(prompt),
    `LLM:${article.title}`,
    { maxRetries: 2 },
  );

  return parseGeneratedContent(raw);
}

function parseGeneratedContent(raw: string): GeneratedContent {
  const sections = {
    reelsScript: extractSection(raw, '릴스 대본', '카드 뉴스'),
    cardNews: extractSection(raw, '카드 뉴스', '블로그 포스팅'),
    blogPost: extractSection(raw, '블로그 포스팅', null),
  };

  if (!sections.reelsScript && !sections.cardNews && !sections.blogPost) {
    // Fallback: treat entire output as blog post
    return { reelsScript: '', cardNews: '', blogPost: raw };
  }

  return sections;
}

function extractSection(text: string, startMarker: string, endMarker: string | null): string {
  // Look for section headers like "## 릴스 대본" or "【릴스 대본】" or "=== 릴스 대본 ==="
  const patterns = [
    `##\\s*${startMarker}`,
    `={2,}\\s*${startMarker}\\s*={0,}`,
    `【${startMarker}】`,
    `\\[${startMarker}\\]`,
    `---\\s*${startMarker}\\s*---`,
  ];

  let startIdx = -1;
  for (const pattern of patterns) {
    const match = text.match(new RegExp(pattern, 'i'));
    if (match && match.index !== undefined) {
      startIdx = match.index + match[0].length;
      break;
    }
  }
  if (startIdx === -1) return '';

  if (!endMarker) {
    return text.slice(startIdx).trim();
  }

  let endIdx = text.length;
  const endPatterns = [
    `##\\s*${endMarker}`,
    `={2,}\\s*${endMarker}\\s*={0,}`,
    `【${endMarker}】`,
    `\\[${endMarker}\\]`,
    `---\\s*${endMarker}\\s*---`,
  ];

  for (const pattern of endPatterns) {
    const match = text.slice(startIdx).match(new RegExp(pattern, 'i'));
    if (match && match.index !== undefined) {
      endIdx = startIdx + match.index;
      break;
    }
  }

  return text.slice(startIdx, endIdx).trim();
}
