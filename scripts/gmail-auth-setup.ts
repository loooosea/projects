import { google } from 'googleapis';
import { createInterface } from 'node:readline';
import { loadCredentials, getAuthUrl, exchangeCode } from '../src/gmail/auth.js';

async function main() {
  console.log('=== Gmail OAuth Setup ===\n');

  const { clientId, clientSecret, redirectUri } = await loadCredentials();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = getAuthUrl(oauth2Client);
  console.log('1. Open this URL in your browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Authorize the app and copy the code.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise<string>((resolve) => {
    rl.question('3. Paste the code here: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  await exchangeCode(oauth2Client, code);
  console.log('\nAuthentication successful! Token saved.');
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
