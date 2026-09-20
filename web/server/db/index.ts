import { createPgDriverFactory } from '@slonik/pg-driver';
import camelcaseKeys from 'camelcase-keys';
import parseInterval, { type IPostgresInterval } from 'postgres-interval';
import {
  type DatabasePool,
  type Interceptor,
  type QueryResultRow,
  createPool,
  createSqlTag,
  createTypeParserPreset,
  SchemaValidationError,
} from 'slonik';
import * as z from 'zod';

import { isTest } from '@/serverUtils/constants';
import { createSingleton } from '@/serverUtils/utilities';

import { queryLogger } from '../utils/logging';

const intervalTypeParser = {
  name: 'interval',
  parse: (raw: string): IPostgresInterval => parseInterval(raw),
};

const excludedParsers = ['interval', 'int8'];

// Keep slonik's sane defaults (int8 -> number, date/timestamp parsing, etc.) and only override
// the interval parser, since the rest of the codebase expects postgres-interval's IPostgresInterval
// shape specifically. Passing a custom `typeParsers` array to `createPool` replaces the defaults
// entirely, so the preset has to be re-included explicitly.
const typeParsers = [
  ...createTypeParserPreset().filter(parser => excludedParsers.includes(parser.name)),
  intervalTypeParser,
  {
    name: 'int8',
    // This will break if the chapter_id column grows beyond 32 bits.
    parse: (raw: string) => parseInt(raw, 10),
  },
];


export const queryLoggingInterceptor = {
  name: 'query-logging',

  beforeQueryExecution: (_context, query) => {
    // Should never be 'debug' in production env
    if (queryLogger.level === 'debug') {
      queryLogger.debug({ parameters: query.values }, query.sql);
    } else {
      queryLogger.info({}, query.sql);
    }

    return null;
  },
} satisfies Interceptor;


const resultParserInterceptor: Interceptor = {
  name: 'slonik-interceptor-zod-validation',
  // If you are not going to transform results using Zod, then you should use `afterQueryExecution` instead.
  // Future versions of Zod will provide a more efficient parser when parsing without transformations.
  // You can even combine the two – use `afterQueryExecution` to validate results, and (conditionally)
  // transform results as needed in `transformRowAsync`.
  transformRowAsync: async (executionContext, actualQuery, row) => {
    const { resultParser } = executionContext;

    if (!resultParser) {
      return row;
    }

    // It is recommended (but not required) to parse async to avoid blocking the event loop during validation
    const validationResult = await resultParser['~standard'].validate(row);

    if (validationResult.issues) {
      throw new SchemaValidationError(actualQuery, row, validationResult.issues);
    }

    return validationResult.value as QueryResultRow;
  },
};

/**
 * Converts top-level column names from snake_case to camelCase, mirroring what the previous
 * `postgres` driver did automatically via its `transform.column` option. Deliberately shallow —
 * it does not recurse into JSON/JSONB column values, which may carry keys that aren't column names
 * (e.g. session data). Queries that need nested camelCase conversion (e.g. json_agg results) still
 * do it explicitly, the same way they did before this migration.
 */
const fieldNameTransformInterceptor: Interceptor = {
  name: 'field-name-transformation',

  transformRow: (_context, _query, row) => camelcaseKeys(row, { deep: false }),
};

const dbName =
  /* istanbul ignore next */
  isTest
    ? process.env.DB_NAME_TEST ?? process.env.DB_NAME
    : process.env.DB_NAME;

const connectionUri = `postgres://${encodeURIComponent(process.env.DB_USER ?? '')}:${encodeURIComponent(process.env.PGPASSWORD ?? '')}@${process.env.DB_HOST}:${process.env.DB_PORT}/${dbName}`;

const dbSingleton = createSingleton('database', () => {
  /* istanbul ignore next */
  if (process.env.IS_PRERENDER) {
    // We can just force cast this during prerender as it should not be accessed anywhere
    return { current: null as unknown as DatabasePool };
  }

  return createPool(connectionUri, {
    driverFactory: createPgDriverFactory(),
    maxPoolSize: 10,
    idleTimeout:
    /* istanbul ignore next */
      isTest ? 1000 : 300_000,
    connectionTimeout: 60_000,
    typeParsers,
    interceptors: [
      queryLoggingInterceptor,
      fieldNameTransformInterceptor,
      resultParserInterceptor,
    ],
  });
});
await dbSingleton;

export const db: DatabasePool = dbSingleton.current!;

export const sql = createSqlTag({
  typeAliases: {
    void: z.strictObject({}),
  },
});

export const voidSql: ReturnType<typeof sql.typeAlias<'void'>> = sql.typeAlias('void');

