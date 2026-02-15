import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';

export interface ParsedArticle {
  title: string;
  url: string;
  snippet: string;
}

// Focused keywords matching the original plan: brain health, dementia, exercise, memory, attention
const KEYWORDS_EN = [
  'brain health', 'dementia', 'alzheimer',
  'memory', 'attention', 'exercise',
  'cognitive decline', 'cognitive function',
  'neurodegeneration', 'neuroprotect',
  'brain aging', 'brain fitness',
];

const KEYWORDS_KR = [
  '뇌 건강', '치매', '알츠하이머',
  '기억력', '주의력', '운동',
  '인지 저하', '인지기능',
  '신경퇴행', '신경보호',
  '뇌 노화',
];

const ALL_KEYWORDS = [...KEYWORDS_EN, ...KEYWORDS_KR];

// Domains that are tracking/redirect services, not actual articles
const TRACKING_DOMAINS = [
  'list-manage.com', 'mailchimp.com', 'email.mg', 'sendgrid.net',
  'unsubscribe', 'manage preferences', 'view in browser',
  'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
  'mailto:', '#',
];

export function parseNewsletter(html: string): ParsedArticle[] {
  const $ = cheerio.load(html);
  const links: Map<string, ParsedArticle> = new Map();

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const rawUrl = $el.attr('href')?.trim();
    if (!rawUrl) return;

    // Skip tracking/social links
    if (TRACKING_DOMAINS.some(d => rawUrl.toLowerCase().includes(d))) return;
    // Skip anchors and javascript links
    if (rawUrl.startsWith('#') || rawUrl.startsWith('javascript:')) return;

    // Get surrounding context text
    const linkText = $el.text().trim();
    const parentText = $el.parent().text().trim();
    const contextText = `${linkText} ${parentText}`.toLowerCase();

    // Check keyword match
    const matches = ALL_KEYWORDS.some(kw => contextText.includes(kw.toLowerCase()));
    if (!matches) return;

    // Normalize URL (strip tracking params)
    const url = normalizeUrl(rawUrl);
    if (!url) return;

    // Deduplicate by URL
    if (links.has(url)) return;

    links.set(url, {
      title: linkText || 'Untitled',
      url,
      snippet: parentText.slice(0, 300),
    });
  });

  const articles = Array.from(links.values());
  logger.info({ count: articles.length }, 'Parsed articles from newsletter');
  return articles;
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    // Remove common tracking parameters
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'mc_cid', 'mc_eid']
      .forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch {
    return null;
  }
}
