import signature from 'cookie-signature';
import { defineConfig } from 'cypress';
import type { PrimitiveValueExpression, QueryResult } from 'slonik';

import { COOKIE_SECRET } from './constants.js';
import { parseAuthCookie } from './dist/server/db/auth.js';
import { db, sql, voidSql } from './dist/server/db/index.js';
import { redis } from './dist/server/utils/ratelimits.js';
import type { CreatedUser } from './types.js';

// Rebuilds the arguments a tagged template call would receive, so the raw SQL goes through
// slonik's normal parameter binding instead of being executed as plain text.
const rawQuery = (rawSql: string, params: PrimitiveValueExpression[] = []) => {
  // The capture group keeps each placeholder number in the result, so even indices hold the
  // SQL between placeholders and odd indices hold the placeholder numbers.
  const parts = rawSql.split(/\$(\d+)/);
  const strings = parts.filter((_, i) => i % 2 === 0);
  // Slonik writes its own $1, $2, ... between the strings in argument order, so the values are
  // listed in the order their placeholders appear. A reused placeholder gets its value twice.
  const values = parts.filter((_, i) => i % 2 === 1).map(n => params[Number(n) - 1]);

  // Slonik only accepts a frozen strings array, like the one a real template literal passes.
  const template = Object.freeze(Object.assign(strings, { raw: Object.freeze([...strings]) }));
  return sql.unsafe(template, ...values);
};

export default defineConfig({
  video: false,
  watchForFileChanges: false,
  allowCypressEnv: false,
  e2e: {
    supportFile: 'support/e2e.{js,jsx,ts,tsx}',
    specPattern: 'e2e/**/*.cy.{js,jsx,ts,tsx}',
    downloadsFolder: 'downloads',
    async setupNodeEvents(on, config) {
      await import('@cypress/code-coverage/task').then(({ default: fn }) => fn(on, config));

      function unsignCookie(value: string) {
        const unsigned = signature.unsign(decodeURIComponent(value).slice(2), COOKIE_SECRET);

        return unsigned as string;
      }

      on('task', {
        flushRedis() {
          return redis.flushall()
            .catch((err: unknown) => {
              console.error(err);
              throw err;
            });
        },

        // Slonik refuses to run more than one statement per query, so multiple statements must be
        // passed as a list. They are run in a single transaction, and the rows of the last one are returned.
        async runSql({ sql: rawSql, params }: {
          sql: string | string[];
          params?: PrimitiveValueExpression[];
        }): Promise<unknown> {
          const statements = Array.isArray(rawSql) ? rawSql : [rawSql];

          return await db.transaction(async transaction => {
            let result: QueryResult<unknown> | null = null;
            for (const statement of statements) {
              // Placeholders are numbered across all statements, so every statement gets all params.
              result = await transaction.query(rawQuery(statement, params));
            }
            return result?.rows;
          });
        },

        async createUser(): Promise<CreatedUser> {
          const username = Date.now().toString();
          const password = username;
          const email = `${username}@email.com`;

          await db.query(voidSql`
            INSERT INTO users (username, email, pwhash, theme)
            VALUES (${username}, ${email}, crypt(${password}, gen_salt('bf')), 'dark')`);

          return {
            username,
            password,
            email,
          };
        },

        getSession(sessionCookie: string) {
          const [lookup, _] = unsignCookie(sessionCookie).split('.');
          return db.maybeOne(sql.unsafe`SELECT * FROM sessions WHERE session_id = ${lookup}`);
        },

        getAuthToken(authTokenCookie: string) {
          const token = parseAuthCookie(unsignCookie(authTokenCookie));
          return db.maybeOne(sql.unsafe`SELECT * FROM auth_token WHERE lookup=${token?.lookup ?? null}`);
        },
      });

      return config;
    },
    baseUrl: 'http://localhost:3000',
    chromeWebSecurity: true,
    screenshotsFolder: 'screenshots',
  },
  env: {
    codeCoverage: {
      url: 'http://localhost:3000/__coverage__',
      expectBackendCoverageOnly: false,
      exclude: [
        '**/node_modules/**',
        './**',
      ],
    },
  },
});
