import { defineConfig } from 'cypress';
import { redis } from './dist/server/utils/ratelimits';

export default defineConfig({
  video: false,
  watchForFileChanges: false,
  e2e: {
    async setupNodeEvents(on, config) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      await import('@cypress/code-coverage/task').then(({ default: fn }) => fn(on, config));

      on('task', {
        flushRedis() {
          return redis.flushall()
            .catch(err => {
              console.error(err);
              throw err;
            });
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
