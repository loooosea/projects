import { fetchNewsletters } from './gmail/client.js';
import { parseNewsletter, resolveRedirects } from './parser/newsletter-parser.js';
import { scrapeArticles } from './parser/web-scraper.js';
import { sendToSlack } from './slack/messages.js';
import { translateToKorean, translationCooldown } from './utils/translate.js';
import { logger } from './utils/logger.js';

export async function runPipeline(): Promise<void> {
  const startTime = Date.now();
  logger.info('Pipeline started');

  // Step 1: Fetch newsletters from Gmail
  const emails = await fetchNewsletters();
  if (emails.length === 0) {
    logger.info('No newsletters to process');
    return;
  }
  logger.info({ count: emails.length }, 'Fetched newsletters');

  // Step 2: Parse newsletters and extract relevant article links
  const allArticles = emails.flatMap(email => {
    logger.info({ subject: email.subject, from: email.from }, 'Parsing newsletter');
    return parseNewsletter(email.htmlBody);
  });

  if (allArticles.length === 0) {
    logger.info('No relevant articles found after keyword filtering');
    return;
  }
  logger.info({ count: allArticles.length }, 'Found relevant articles');

  // Step 3: Resolve tracking/redirect URLs to actual article URLs
  const resolvedArticles = await resolveRedirects(allArticles);
  logger.info({ count: resolvedArticles.length }, 'Resolved redirect URLs');

  // Step 4: Scrape article content
  const scrapedArticles = await scrapeArticles(resolvedArticles);
  if (scrapedArticles.length === 0) {
    logger.info('No articles could be scraped');
    return;
  }
  logger.info({ count: scrapedArticles.length }, 'Successfully scraped articles');

  // Step 5: Filter by content - only keep articles whose body matches core keywords
  const CONTENT_KEYWORDS = [
    'brain health', 'dementia', 'alzheimer',
    'memory', 'attention', 'exercise',
    'cognitive decline', 'cognitive function',
    'neurodegeneration', 'neuroprotect',
    'brain aging', 'brain fitness',
    '뇌 건강', '치매', '기억력', '주의력', '운동', '인지기능',
  ];
  const filtered = scrapedArticles.filter(a => {
    const text = `${a.title} ${a.content}`.toLowerCase();
    return CONTENT_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
  });
  logger.info({ before: scrapedArticles.length, after: filtered.length }, 'Content keyword filtering');

  if (filtered.length === 0) {
    logger.info('No articles matched content keywords');
    return;
  }

  // Step 6: Translate to Korean
  logger.info({ count: filtered.length }, 'Translating articles to Korean');
  const translated = [];
  for (const article of filtered) {
    try {
      // Translate title and content sequentially to avoid rate limiting
      const title = await translateToKorean(article.title);
      await translationCooldown();
      const content = await translateToKorean(article.content);
      translated.push({ ...article, title, content });
      logger.info({ originalTitle: article.title }, 'Translated article');
      await translationCooldown();
    } catch (err) {
      logger.warn({ err, title: article.title }, 'Translation failed, using original');
      translated.push(article);
    }
  }

  // Step 7: Send summaries to Slack
  await sendToSlack(translated);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info({ elapsed: `${elapsed}s`, articlesProcessed: translated.length }, 'Pipeline completed');
}
