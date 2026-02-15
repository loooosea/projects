import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../src/config.js', () => ({
  config: {
    llm: {
      provider: 'claude',
      claude: { apiKey: 'test-key', model: 'claude-sonnet-4-5-20250929' },
      openai: { apiKey: 'test-key', model: 'gpt-4o' },
    },
    log: { level: 'silent' },
  },
}));

// Mock logger
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock Claude provider
vi.mock('../src/llm/claude-provider.js', () => {
  class MockClaudeProvider {
    async generateContent() {
      return `## 릴스 대본\n릴스 내용입니다\n\n## 카드 뉴스\n카드 뉴스 내용입니다\n\n## 블로그 포스팅\n블로그 내용입니다`;
    }
  }
  return { ClaudeProvider: MockClaudeProvider };
});

import { generateContentForArticle } from '../src/llm/llm-service.js';

describe('generateContentForArticle', () => {
  it('should parse LLM response into three content sections', async () => {
    const article = {
      title: 'Test Article',
      url: 'https://example.com',
      snippet: 'test',
      content: 'Article about brain health and exercise.',
    };

    const result = await generateContentForArticle(article);
    expect(result.reelsScript).toContain('릴스 내용');
    expect(result.cardNews).toContain('카드 뉴스 내용');
    expect(result.blogPost).toContain('블로그 내용');
  });
});
