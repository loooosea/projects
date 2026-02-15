import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
  level: config.log.level,
  transport: {
    target: 'pino/file',
    options: { destination: 1 }, // stdout
  },
});
