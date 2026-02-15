import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

interface StoredCredentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export async function loadCredentials(): Promise<{ clientId: string; clientSecret: string; redirectUri: string }> {
  let content: string;

  // Prefer env var (Vercel), fall back to file (local)
  if (process.env.GMAIL_OAUTH_CREDENTIALS_JSON) {
    content = process.env.GMAIL_OAUTH_CREDENTIALS_JSON;
  } else {
    content = await readFile(config.gmail.credentialsPath, 'utf-8');
  }

  const creds: StoredCredentials = JSON.parse(content);
  const key = creds.installed || creds.web;
  if (!key) throw new Error('Invalid credentials file: missing "installed" or "web" key');
  return {
    clientId: key.client_id,
    clientSecret: key.client_secret,
    redirectUri: key.redirect_uris[0] || 'urn:ietf:wg:oauth:2.0:oob',
  };
}

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const { clientId, clientSecret, redirectUri } = await loadCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  let tokenContent: string;

  // Prefer env var (Vercel), fall back to file (local)
  if (process.env.GMAIL_TOKEN_JSON) {
    tokenContent = process.env.GMAIL_TOKEN_JSON;
  } else if (existsSync(config.gmail.tokenPath)) {
    tokenContent = await readFile(config.gmail.tokenPath, 'utf-8');
  } else {
    throw new Error(
      `Token not found at ${config.gmail.tokenPath}. Run "npm run gmail:setup" first.`,
    );
  }

  const tokens = JSON.parse(tokenContent);
  oauth2Client.setCredentials(tokens);

  // Auto-refresh token if expired
  oauth2Client.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    // Only persist to file in local environment
    if (!process.env.GMAIL_TOKEN_JSON) {
      const dir = path.dirname(config.gmail.tokenPath);
      if (!existsSync(dir)) await mkdir(dir, { recursive: true });
      await writeFile(config.gmail.tokenPath, JSON.stringify(merged, null, 2));
    }
    logger.info('Gmail token refreshed and saved');
  });

  return oauth2Client;
}

export function getAuthUrl(oauth2Client: OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCode(oauth2Client: OAuth2Client, code: string): Promise<void> {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const dir = path.dirname(config.gmail.tokenPath);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(config.gmail.tokenPath, JSON.stringify(tokens, null, 2));
  logger.info('Gmail token saved successfully');
}
