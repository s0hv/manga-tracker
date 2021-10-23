const pino = require('pino');

const { isDev } = require('./constants');

const level = process.env.LEVEL;

// If the PRETTY environment variable is defined use it to determine whether to pretty print or not
// Otherwise pretty print in development
const pretty = process.env.PRETTY ?
  /^(y|yes|true|on)$/i.test(process.env.PRETTY) :
  isDev;

const logger = pino(
  {
    level: level || 'debug',
    prettyPrint: pretty ?
      {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'hostname,ns',
      } :
      false,
    name: 'logger',
  }
);

module.exports = {
  logger,
  mangadexLogger: logger.child({ name: 'mangadex' }, { level: level || 'debug' }),
  expressLogger: logger.child({ name: 'express' }, { level: level || 'info' }),
  sessionLogger: logger.child({ name: 'session' }, { level: level || 'debug' }),
  userLogger: logger.child({ name: 'user' }, { level: level || 'debug' }),
  queryLogger: logger.child({ name: 'dbQuery' }, { level: level || 'debug' }),
  dbLogger: logger.child({ name: 'db' }, { level: level || 'debug' }),
  authLogger: logger.child({ name: 'auth' }, { level: level || 'debug' }),
};
