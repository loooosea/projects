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

// Domains to skip entirely (not article links)
const SKIP_DOMAINS = [
  'list-manage.com', 'mailchimp.com', 'email.mg', 'sendgrid.net',
  'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
  'youtube.com', 'tiktok.com',
  'mailto:',
];

// Short link texts that are likely navigation, not article titles
const MIN_TITLE_LENGTH = 20;

// Texts that indicate non-article links
const SKIP_TEXTS = [
  'read more', 'unsubscribe', 'view in browser', 'manage preferences',
  'advertise', 'submit news', 'change subscriber', 'click here',
];

export function parseNewsletter(html: string): ParsedArticle[] {
  const $ = cheerio.load(html);
  const candidates: { title: string; url: string; snippet: string }[] = [];

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const rawUrl = $el.attr('href')?.trim();
    if (!rawUrl) return;

    // Skip non-http links
    if (rawUrl.startsWith('#') || rawUrl.startsWith('javascript:') || rawUrl.startsWith('mailto:')) return;

    // Skip social/unsubscribe domains
    if (SKIP_DOMAINS.some(d => rawUrl.toLowerCase().includes(d))) return;

    // Get link text
    const linkText = $el.text().trim();
    if (linkText.length < MIN_TITLE_LENGTH) return;

    // Skip known non-article texts
    if (SKIP_TEXTS.some(t => linkText.toLowerCase().includes(t))) return;

    // This looks like an article link — check keyword match on title
    const matches = ALL_KEYWORDS.some(kw => linkText.toLowerCase().includes(kw.toLowerCase()));
    if (!matches) return;

    const parentText = $el.parent().text().trim();

    candidates.push({
      title: linkText,
      url: rawUrl,
      snippet: parentText.slice(0, 300),
    });
  });

  // Deduplicate by URL
  const seen = new Set<string>();
  const articles = candidates.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  logger.info({ count: articles.length }, 'Parsed articles from newsletter');
  return articles;
}

/**
 * Resolve tracking/redirect URLs (e.g. aweber.com) to their final destination.
 * Called after parsing, before scraping.
 */
export async function resolveRedirects(articles: ParsedArticle[]): Promise<ParsedArticle[]> {
  const resolved: ParsedArticle[] = [];

  for (const article of articles) {
    try {
      const finalUrl = await resolveUrl(article.url);
      resolved.push({ ...article, url: normalizeUrl(finalUrl) || finalUrl });
    } catch {
      logger.warn({ url: article.url }, 'Failed to resolve redirect, keeping original');
      resolved.push(article);
    }
  }

  // Deduplicate after resolving (different tracking URLs may point to same article)
  const seen = new Set<string>();
  return resolved.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

async function resolveUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(5000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NeuroNewsBot/1.0)' },
  });
  return res.url;
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'mc_cid', 'mc_eid']
      .forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch {
    return null;
  }
}
