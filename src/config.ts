import 'dotenv/config';

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  gmail: {
    credentialsPath: optional('GMAIL_CREDENTIALS_PATH', 'credentials/oauth-credentials.json'),
    tokenPath: optional('GMAIL_TOKEN_PATH', 'credentials/token.json'),
    newsletterSenders: required('GMAIL_NEWSLETTER_SENDERS').split(',').map(s => s.trim()),
  },
  llm: {
    provider: optional('LLM_PROVIDER', 'claude') as 'claude' | 'openai' | 'gemini',
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: optional('CLAUDE_MODEL', 'claude-sonnet-4-5-20250929'),
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: optional('OPENAI_MODEL', 'gpt-4o'),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: optional('GEMINI_MODEL', 'gemini-2.0-flash'),
    },
  },
  slack: {
    botToken: required('SLACK_BOT_TOKEN'),
    signingSecret: required('SLACK_SIGNING_SECRET'),
    channelId: required('SLACK_CHANNEL_ID'),
  },
  cron: {
    schedule: optional('CRON_SCHEDULE', '0 0 * * *'),
    timezone: optional('CRON_TIMEZONE', 'Asia/Seoul'),
  },
  scraper: {
    concurrency: parseInt(optional('SCRAPER_CONCURRENCY', '3'), 10),
    timeoutMs: parseInt(optional('SCRAPER_TIMEOUT_MS', '10000'), 10),
    maxContentLength: parseInt(optional('SCRAPER_MAX_CONTENT_LENGTH', '8000'), 10),
  },
  log: {
    level: optional('LOG_LEVEL', 'info'),
  },
} as const;
