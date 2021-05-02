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
  mangadexLogger: logger.child({ level: level || 'debug', name: 'mangadex' }),
  expressLogger: logger.child({ level: level || 'info', name: 'express' }),
  sessionLogger: logger.child({ level: level || 'debug', name: 'session' }),
  userLogger: logger.child({ level: level || 'debug', name: 'user' }),
  queryLogger: logger.child({ level: level || 'debug', name: 'dbQuery' }),
  dbLogger: logger.child({ level: level || 'debug', name: 'db' }),
  authLogger: logger.child({ level: level || 'debug', name: 'auth' }),
};
