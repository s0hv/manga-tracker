import { defineConfig } from 'cypress';
import { redis } from './dist/server/utils/ratelimits';
import { db } from './dist/server/db/helpers';
import type { CreatedUser } from './cypress/types';

export default defineConfig({
  video: false,
  watchForFileChanges: false,
  e2e: {
    async setupNodeEvents(on, config) {
      await import('@cypress/code-coverage/task').then(({ default: fn }) => fn(on, config));

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
            INSERT INTO users (username, email, pwhash, email_verified, is_credentials_account, theme) 
            VALUES (${username}, ${email}, crypt(${password}, gen_salt('bf')), NULL, TRUE, 'dark')`;

          return {
            username,
            password,
            email,
          };
        },
        getSession(sessionId: string) {
          return db.oneOrNone`SELECT * FROM sessions WHERE session_id = ${sessionId}`;
        },
      });

      return config;
    },
    baseUrl: 'http://localhost:3000',
    chromeWebSecurity: false,
  },
  env: {
    codeCoverage: {
      url: 'http://localhost:3000/__coverage__',
      exclude: '**/node_modules/**',
    },
  },
});
