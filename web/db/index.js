const { queryLogger } = require('../utils/logging');

const isTest = process.env.NODE_ENV === 'test';

// eslint-disable-next-line import/order
const pgp = require('pg-promise')({
  noLocking: isTest, // Locking must not be set on during test so mocks can be made.
  capSQL: true,
  pgFormatting: true, // When this is false parameters would be always logged since they're embedded in the query

  // Log duration and query
  receive(data, result, e) {
    const { duration } = result;

    if (queryLogger.level === 'debug') {
      queryLogger.debug({
        params: e.params,
        duration: `${duration}ms`,
      }, e.query);
    } else {
      queryLogger.info({
        duration: `${duration}ms`,
      }, e.query);
    }
  },

  // Error logging
  error(err, e) {
    queryLogger.error(err, e.query);
  },
});

// Will cause warnings when in development mode
const db = pgp({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: isTest ?
    process.env.DB_NAME_TEST || process.env.DB_NAME :
    process.env.DB_NAME,
  port: process.env.DB_PORT,
  password: process.env.PGPASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

function query(sql, args) {
  return db.query(sql, args);
}

async function end() {
  await pgp.end();
}

module.exports = {
  query,
  db,
  pgp,
  end,
};
