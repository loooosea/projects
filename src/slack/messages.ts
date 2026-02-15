import type { KnownBlock } from '@slack/web-api';
import { slackClient } from './app.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { ScrapedArticle } from '../parser/web-scraper.js';

const CONTENT_PREVIEW_LENGTH = 500;

export async function sendToSlack(articles: ScrapedArticle[]): Promise<void> {
  if (articles.length === 0) {
    await sendSimpleMessage('오늘은 관련 뉴스레터 기사가 없습니다.');
    return;
  }

  // Send digest header
  const headerResult = await slackClient.chat.postMessage({
    channel: config.slack.channelId,
    text: `🧠 오늘의 뇌과학 뉴스레터 (${articles.length}건)`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🧠 오늘의 뇌과학 뉴스레터 (${articles.length}건)`, emoji: true },
      },
      { type: 'divider' },
    ],
  });

  const threadTs = headerResult.ts;

  // Send each article as a thread reply
  for (const article of articles) {
    try {
      await sendArticleSummary(article, threadTs);
    } catch (err) {
      logger.error({ err, title: article.title }, 'Failed to send article to Slack');
    }
  }
}

async function sendArticleSummary(article: ScrapedArticle, threadTs?: string): Promise<void> {
  const preview = article.content.length > CONTENT_PREVIEW_LENGTH
    ? article.content.slice(0, CONTENT_PREVIEW_LENGTH) + '...'
    : article.content;

  const meta = [
    article.siteName && `*출처:* ${article.siteName}`,
    article.author && `*저자:* ${article.author}`,
  ].filter(Boolean).join(' | ');

  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${article.url}|${article.title}>*`,
      },
    },
  ];

  if (meta) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: meta }],
    });
  }

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: preview,
    },
  });

  blocks.push({ type: 'divider' });

  await slackClient.chat.postMessage({
    channel: config.slack.channelId,
    thread_ts: threadTs,
    text: article.title,
    blocks,
  });
}

async function sendSimpleMessage(text: string): Promise<void> {
  await slackClient.chat.postMessage({
    channel: config.slack.channelId,
    text,
  });
}
