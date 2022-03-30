const camelcaseKeys = require('camelcase-keys');
const { performance } = require('perf_hooks');

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

    // This should result in minimal performance impact except on the first query,
    // as the object keys are not yet cached at that point
    const t0 = performance.now();
    result.rows = camelcaseKeys(data, { deep: true });
    const camelCaseDuration = performance.now() - t0;

    if (queryLogger.level === 'debug') {
      queryLogger.debug({
        params: e.params,
        duration: `${duration}ms`,
        camelCaseDuration,
      }, e.query);
    } else {
      queryLogger.info({
        duration: `${duration}ms`,
        camelCaseDuration,
      }, e.query);
    }
  },

  // Error logging
  error(err, e) {
    queryLogger.info(e, 'Timeout debug');
    queryLogger.error(err, e.query);
  },
});

// https://stackoverflow.com/a/34427278/6046713
const createSingletonDb = () => {
  const s = Symbol.for('database');
  let scope = global[s];
  if (!global[s]) {
    scope = pgp({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: isTest ?
        process.env.DB_NAME_TEST || process.env.DB_NAME :
        process.env.DB_NAME,
      port: process.env.DB_PORT,
      password: process.env.PGPASSWORD,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    global[s] = scope;
  }
  return scope;
};

/**
 * Database object
 * @type {pgPromise.IDatabase}
 */
const db = createSingletonDb();


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
