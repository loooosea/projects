import { describe, it, expect, vi } from 'vitest';

// Mock config to avoid env var requirements
vi.mock('../src/config.js', () => ({
  config: { log: { level: 'silent' } },
}));
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { parseNewsletter } from '../src/parser/newsletter-parser.js';

describe('parseNewsletter', () => {
  it('should extract articles with matching keywords', () => {
    const html = `
      <html><body>
        <a href="https://example.com/brain-health-study">New brain health study reveals benefits of exercise</a>
        <p>A study about brain health and exercise shows cognitive improvements.</p>
      </body></html>
    `;
    const articles = parseNewsletter(html);
    expect(articles.length).toBeGreaterThanOrEqual(1);
    expect(articles[0].url).toContain('example.com');
  });

  it('should filter out tracking links', () => {
    const html = `
      <html><body>
        <a href="https://list-manage.com/track/click?brain">Brain study</a>
        <a href="https://example.com/dementia-research">Dementia research breakthrough</a>
        <p>New dementia research shows promising results for memory improvement.</p>
      </body></html>
    `;
    const articles = parseNewsletter(html);
    // Should only get the non-tracking link
    expect(articles.every(a => !a.url.includes('list-manage.com'))).toBe(true);
  });

  it('should skip links without matching keywords', () => {
    const html = `
      <html><body>
        <a href="https://example.com/cooking-recipe">New pasta recipe</a>
        <p>Learn how to cook amazing Italian pasta in 30 minutes.</p>
      </body></html>
    `;
    const articles = parseNewsletter(html);
    expect(articles.length).toBe(0);
  });

  it('should match Korean keywords', () => {
    const html = `
      <html><body>
        <a href="https://example.com/kr-article">치매 예방에 좋은 운동</a>
        <p>치매 예방과 기억력 향상을 위한 방법</p>
      </body></html>
    `;
    const articles = parseNewsletter(html);
    expect(articles.length).toBeGreaterThanOrEqual(1);
  });

  it('should deduplicate URLs', () => {
    const html = `
      <html><body>
        <a href="https://example.com/brain-study?utm_source=news">Brain health study</a>
        <a href="https://example.com/brain-study?utm_source=email">Brain health study</a>
        <p>Brain health and cognitive function research.</p>
      </body></html>
    `;
    const articles = parseNewsletter(html);
    // After UTM stripping, these should be the same URL
    const urls = articles.map(a => a.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('should strip UTM parameters', () => {
    const html = `
      <html><body>
        <a href="https://example.com/article?utm_source=newsletter&utm_medium=email&id=123">
          Memory and brain health improvements
        </a>
        <p>Research on memory and brain health.</p>
      </body></html>
    `;
    const articles = parseNewsletter(html);
    if (articles.length > 0) {
      expect(articles[0].url).not.toContain('utm_source');
      expect(articles[0].url).toContain('id=123');
    }
  });

  it('should return empty for empty HTML', () => {
    expect(parseNewsletter('')).toEqual([]);
    expect(parseNewsletter('<html><body></body></html>')).toEqual([]);
  });
});
