import { startScheduler } from './cron.js';
import { runPipeline } from './pipeline.js';
import { logger } from './utils/logger.js';

async function main() {
  const runNow = process.argv.includes('--run-now');

  if (runNow) {
    logger.info('Running pipeline immediately (--run-now)');
    await runPipeline();
    return;
  }

  startScheduler();
  logger.info('Bot is running. Waiting for scheduled execution...');
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error');
  process.exit(1);
});
