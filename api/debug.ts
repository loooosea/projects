import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const steps: string[] = [];

  try {
    steps.push('1. Starting imports...');

    steps.push('2. Importing config...');
    const { config } = await import('../src/config.js');
    steps.push(`   config.gmail.newsletterSenders: ${config.gmail.newsletterSenders}`);
    steps.push(`   config.llm.provider: ${config.llm.provider}`);

    steps.push('3. Importing logger...');
    const { logger } = await import('../src/utils/logger.js');
    steps.push('   logger OK');

    steps.push('4. Importing pipeline...');
    const { runPipeline } = await import('../src/pipeline.js');
    steps.push(`   runPipeline: ${typeof runPipeline}`);

    steps.push('All imports OK');
    res.status(200).json({ success: true, steps });
  } catch (err: any) {
    steps.push(`ERROR: ${err.message}`);
    steps.push(`Stack: ${err.stack}`);
    res.status(500).json({ success: false, steps });
  }
}
