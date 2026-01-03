import signature from 'cookie-signature';
import { defineConfig } from 'cypress';

import { COOKIE_SECRET } from './constants';
import { parseAuthCookie } from './dist/server/db/auth';
import { db } from './dist/server/db/helpers';
import { redis } from './dist/server/utils/ratelimits';
import type { CreatedUser } from './types';

export default defineConfig({
  video: false,
  watchForFileChanges: false,
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
            .catch(err => {
              console.error(err);
              throw err;
            });
        },

        async createUser(): Promise<CreatedUser> {
          const username = Date.now().toString();
          const password = username;
          const email = `${username}@email.com`;

          await db.none`
            INSERT INTO users (username, email, pwhash, theme) 
            VALUES (${username}, ${email}, crypt(${password}, gen_salt('bf')), 'dark')`;

          return {
            username,
            password,
            email,
          };
        },

        getSession(sessionCookie: string) {
          const [lookup, _] = unsignCookie(sessionCookie).split('.');
          return db.oneOrNone`SELECT * FROM sessions WHERE session_id = ${lookup}`;
        },

        getAuthToken(authTokenCookie: string) {
          const token = parseAuthCookie(unsignCookie(authTokenCookie));
          return db.oneOrNone`SELECT * FROM auth_token WHERE lookup=${token.lookup}`;
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
