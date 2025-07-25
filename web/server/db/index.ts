import postgres, { type PostgresType } from 'postgres';
import parseInterval, { type IPostgresInterval } from 'postgres-interval';

import { createSingleton } from '@/serverUtils/utilities';

import { queryLogger } from '../utils/logging';

const isTest = process.env.NODE_ENV === 'test';

const intervalType: PostgresType<IPostgresInterval> = {
  to: 1186,
  from: [1186],

  serialize: (value: any | IPostgresInterval) => {
    // Can also be a string input
    if (typeof value?.toPostgres === 'function') return value.toPostgres();
    return value;
  },
  parse: raw => parseInterval(raw),
};

type CustomTypes = {
  undefined: PostgresType<undefined>
  interval: typeof intervalType
};

export type Db = ReturnType<typeof postgres<CustomTypes>>;

export const db: Db = createSingleton<Db>('database', () => postgres<CustomTypes>({
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  database: isTest
    ? process.env.DB_NAME_TEST || process.env.DB_NAME
    : process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  password: process.env.PGPASSWORD,
  max: 10,
  idle_timeout: isTest ? 1 : 300,
  connect_timeout: 60,
  transform: {
    undefined: null,
    column: { to: postgres.fromCamel, from: postgres.toCamel },
  },
  types: {
    interval: intervalType,
    // Will be ignored. It's here just to satisfy typescript
    undefined: {} as PostgresType<undefined>,
  },
  debug: (connection, query, parameters) => {
    // Should never be 'debug' in production env
    if (queryLogger.level === 'debug') {
      queryLogger.debug({ parameters }, query);
    } else {
      queryLogger.info({}, query);
    }
  },
}));
export const sql: Db = db;


export async function end() {
  await db.end({ timeout: 15 });
}
