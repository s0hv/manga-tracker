import camelcaseKeys from 'camelcase-keys';
import { performance } from 'perf_hooks';
import pgPromise, { IDatabase, QueryParam } from 'pg-promise';

import { queryLogger } from '../utils/logging.js';

const isTest = process.env.NODE_ENV === 'test';

export const pgp = pgPromise({
  noLocking: isTest, // Locking must not be set on during test so mocks can be made.
  capSQL: true,
  pgFormatting: true, // When this is false parameters would always be logged since they're embedded in the query

  // Log duration and query
  receive(data, result, e) {
    if (!result) return;

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
    queryLogger.error(err, e.query);
  },
});

// https://stackoverflow.com/a/34427278/6046713
const createSingletonDb = (): IDatabase<any> => {
  const s = Symbol.for('database');
  let scope = global[s];
  if (!global[s]) {
    scope = pgp({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: isTest ?
        process.env.DB_NAME_TEST || process.env.DB_NAME :
        process.env.DB_NAME,
      port: Number(process.env.DB_PORT),
      password: process.env.PGPASSWORD,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    global[s] = scope;
  }
  return scope;
};

export const db = createSingletonDb();


export function query(sql: QueryParam, args?: any) {
  return db.query(sql, args);
}

export async function end() {
  await pgp.end();
}
