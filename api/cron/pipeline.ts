import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runPipeline } from '../../src/pipeline.js';
import { logger } from '../../src/utils/logger.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify the request comes from Vercel Cron
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    logger.info('Vercel Cron triggered pipeline');
    await runPipeline();
    res.status(200).json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Pipeline failed');
    res.status(500).json({ error: 'Pipeline failed' });
  }
}
