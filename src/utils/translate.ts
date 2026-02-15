import translate from 'google-translate-api-x';
import { logger } from './logger.js';

const CHUNK_SIZE = 2000;
const DELAY_BETWEEN_CHUNKS_MS = 500;
const DELAY_BETWEEN_ARTICLES_MS = 1000;
const MAX_RETRIES = 2;

async function translateChunk(text: string): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await translate(text, { from: 'en', to: 'ko', forceBatch: false });
      return result.text;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = 1000 * (attempt + 1);
      logger.debug({ attempt, delay }, 'Translation chunk retry');
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}

export async function translateToKorean(text: string): Promise<string> {
  try {
    const chunks = splitIntoChunks(text, CHUNK_SIZE);
    const translated: string[] = [];

    for (const chunk of chunks) {
      const result = await translateChunk(chunk);
      translated.push(result);
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_CHUNKS_MS));
    }

    return translated.join('\n\n');
  } catch (err) {
    logger.warn({ err, textLength: text.length }, 'Translation failed, returning original text');
    return text;
  }
}

/** Call this between articles to avoid rate limiting */
export async function translationCooldown(): Promise<void> {
  await new Promise(r => setTimeout(r, DELAY_BETWEEN_ARTICLES_MS));
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n\n', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf('. ', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt + 1));
    remaining = remaining.slice(splitAt + 1).trimStart();
  }

  return chunks;
}
