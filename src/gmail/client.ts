import { google, gmail_v1 } from 'googleapis';
import { getAuthenticatedClient } from './auth.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export interface NewsletterEmail {
  id: string;
  from: string;
  subject: string;
  date: string;
  htmlBody: string;
}

export async function fetchNewsletters(): Promise<NewsletterEmail[]> {
  const auth = await getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  const senderQuery = config.gmail.newsletterSenders
    .map(s => `from:${s}`)
    .join(' OR ');
  const query = `(${senderQuery}) newer_than:1d`;

  logger.info({ query }, 'Fetching newsletters from Gmail');

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 20,
  });

  const messageIds = listRes.data.messages || [];
  if (messageIds.length === 0) {
    logger.info('No new newsletters found');
    return [];
  }

  logger.info({ count: messageIds.length }, 'Found newsletter messages');

  const emails: NewsletterEmail[] = [];

  for (const { id } of messageIds) {
    if (!id) continue;
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      const email = parseMessage(msg.data);
      if (email) emails.push(email);
    } catch (err) {
      logger.error({ err, messageId: id }, 'Failed to fetch message');
    }
  }

  return emails;
}

function parseMessage(msg: gmail_v1.Schema$Message): NewsletterEmail | null {
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

  const htmlBody = extractHtmlBody(msg.payload);
  if (!htmlBody) {
    logger.warn({ id: msg.id }, 'No HTML body found in message');
    return null;
  }

  return {
    id: msg.id || '',
    from: getHeader('From'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    htmlBody,
  };
}

function extractHtmlBody(payload: gmail_v1.Schema$MessagePart | undefined): string | null {
  if (!payload) return null;

  // Direct HTML body
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Search in parts (multipart messages)
  if (payload.parts) {
    for (const part of payload.parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }

  return null;
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}
