import cron from 'node-cron';
import { config } from './config.js';
import { runPipeline } from './pipeline.js';
import { logger } from './utils/logger.js';

export function startScheduler(): void {
  const { schedule, timezone } = config.cron;

  logger.info({ schedule, timezone }, 'Starting cron scheduler');

  cron.schedule(schedule, async () => {
    logger.info('Cron triggered pipeline run');
    try {
      await runPipeline();
    } catch (err) {
      logger.error({ err }, 'Pipeline failed during scheduled run');
    }
  }, { timezone });
}
