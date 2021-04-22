const pino = require('pino');

const { isDev } = require('./constants');

const logger = pino(
  {
    level: process.env.LEVEL || 'debug',
    prettyPrint: (isDev || process.env.FORCE_PRETTY) ?
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
  mangadexLogger: logger.child({ level: 'debug', name: 'mangadex' }),
  expressLogger: logger.child({ level: 'info', name: 'express' }),
  sessionLogger: logger.child({ level: 'debug', name: 'session' }),
  userLogger: logger.child({ level: 'debug', name: 'user' }),
  queryLogger: logger.child({ level: 'info', name: 'dbQuery' }),
  dbLogger: logger.child({ level: 'debug', name: 'db' }),
  authLogger: logger.child({ level: 'debug', name: 'auth' }),
};
