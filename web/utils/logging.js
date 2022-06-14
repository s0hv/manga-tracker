import pino from 'pino';

import { isDev } from './constants.js';

const level = process.env.LEVEL;

// If the PRETTY environment variable is defined use it to determine whether to pretty print or not
// Otherwise pretty print in development
const pretty = process.env.PRETTY ?
  /^(y|yes|true|on)$/i.test(process.env.PRETTY) :
  isDev;

export const logger = pino(
  {
    level: level || 'debug',
    transport: pretty ? {
      target: 'pino-pretty',
      options:
      {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'hostname,ns',
      },
    } : undefined,
    name: 'logger',
  }
);

export const mangadexLogger = logger.child({ name: 'mangadex' }, { level: level || 'debug' });
export const expressLogger = logger.child({ name: 'express' }, { level: level || 'info' });
export const sessionLogger = logger.child({ name: 'session' }, { level: level || 'debug' });
export const userLogger = logger.child({ name: 'user' }, { level: level || 'debug' });
export const queryLogger = logger.child({ name: 'dbQuery' }, { level: level || 'debug' });
export const dbLogger = logger.child({ name: 'db' }, { level: level || 'debug' });
export const authLogger = logger.child({ name: 'auth' }, { level: level || 'debug' });
