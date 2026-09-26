import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runner } from 'node-pg-migrate';
import pg from 'pg';

import { config } from 'dotenv';

config();

const usage = `Usage: node migrate.mjs <up | down | create <name>> [--test] [--test-db]

  --test     Target the test data migrations in migrations/test. With down, rolls back
             all of them and requires NODE_ENV to be "test"
  --test-db  Connect to DB_NAME_TEST instead of DB_NAME`;

const migrationsDir = path.join(import.meta.dirname, '..', 'migrations');
const testMigrationsDir = path.join(migrationsDir, 'test');
// migrations/000-import-db-migrate-history.sql inserts into this table by name
const migrationsTable = 'pgmigrations';
const testMigrationsTable = 'pgmigrations_test';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    test: { type: 'boolean', default: false },
    'test-db': { type: 'boolean', default: false },
  },
});
const [command, migrationName] = positionals;

/** @param {string} dir */
const getNextIndex = async (dir) => {
  const files = await readdir(dir);
  const indexes = files.map((file) => Number(/^(\d+)-/.exec(file)?.[1] ?? -1));
  return String(Math.max(-1, ...indexes) + 1).padStart(3, '0');
};

/** @param {string} name */
const createMigration = async (name) => {
  const dir = values.test ? testMigrationsDir : migrationsDir;
  const index = await getNextIndex(dir);
  const filePath = path.join(dir, `${index}-${name}.sql`);
  await writeFile(filePath, '', { flag: 'wx' });
  console.log(`Created ${path.relative(process.cwd(), filePath)}`);

};

/** @param {import('node-pg-migrate').RunnerOption['direction']} direction */
const migrate = async (direction) => {
  if (direction === 'down' && values.test && process.env.NODE_ENV !== 'test') {
    throw new Error('Test data migrations can only be rolled back when NODE_ENV is "test"');
  }

  if (values.test && !values['test-db']) {
    throw new Error('Test data migrations require the --test-db option');
  }

  const client = new pg.Client({
    user: process.env.DB_USER,
    password: process.env.PGPASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: values['test-db'] ? process.env.DB_NAME_TEST : process.env.DB_NAME,
  });

  /** @satisfies {Partial<import('node-pg-migrate').RunnerOption>} */
  const runnerOptions = {
    dbClient: client,
    migrationsTable,
    migrationLoaderStrategies: [{ extensions: ['.sql'], loader: 'sql' }],
    // Order checking easily leads to issues
    checkOrder: false
  };

  await client.connect();
  try {
    if (values.test) {
      await runner({
        ...runnerOptions,
        dir: testMigrationsDir,
        migrationsTable: testMigrationsTable,
        direction,
        count: Infinity,
      });
    } else if (direction === 'up') {
      await runner({ ...runnerOptions, dir: migrationsDir, direction });
    } else {
      await runner({ ...runnerOptions, dir: migrationsDir, direction, count: 1 });
    }
  } finally {
    await client.end();
  }
};

switch (command) {
  case 'up':
  case 'down':
    await migrate(command);
    break;
  case 'create':
    if (!migrationName) {
      console.error(usage);
      process.exit(1);
    }
    await createMigration(migrationName);
    break;
  default:
    console.error(usage);
    process.exit(1);
}
