import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { ParsedArticle } from './newsletter-parser.js';

export interface ScrapedArticle extends ParsedArticle {
  content: string;
  author?: string;
  siteName?: string;
}

export async function scrapeArticles(articles: ParsedArticle[]): Promise<ScrapedArticle[]> {
  const { concurrency, timeoutMs, maxContentLength } = config.scraper;
  const results: ScrapedArticle[] = [];

  // Process in batches of `concurrency`
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(article => scrapeOne(article, timeoutMs, maxContentLength)),
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  logger.info({ scraped: results.length, total: articles.length }, 'Scraping complete');
  return results;
}

async function scrapeOne(
  article: ParsedArticle,
  timeoutMs: number,
  maxContentLength: number,
): Promise<ScrapedArticle | null> {
  try {
    logger.debug({ url: article.url }, 'Scraping article');

    const response = await fetch(article.url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NeuroNewsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      logger.warn({ url: article.url, status: response.status }, 'Failed to fetch article');
      return null;
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url: article.url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();

    if (!parsed || !parsed.textContent?.trim()) {
      logger.warn({ url: article.url }, 'Readability could not extract content');
      return null;
    }

    let content = parsed.textContent.trim();
    if (content.length > maxContentLength) {
      content = content.slice(0, maxContentLength) + '...';
    }

    return {
      ...article,
      title: parsed.title || article.title,
      content,
      author: parsed.byline || undefined,
      siteName: parsed.siteName || undefined,
    };
  } catch (err) {
    logger.error({ err, url: article.url }, 'Error scraping article');
    return null;
  }
}
