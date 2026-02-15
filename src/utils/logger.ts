import pino from 'pino';
import { config } from '../config.js';

const isVercel = !!process.env.VERCEL;

export const logger = pino({
  level: config.log.level,
  // Vercel doesn't support pino worker-thread transports
  ...(isVercel ? {} : {
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  }),
});
