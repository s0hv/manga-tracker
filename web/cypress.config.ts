import { defineConfig } from 'cypress';
import { redis } from './dist/utils/ratelimits';

export default defineConfig({
  video: false,
  watchForFileChanges: false,
  e2e: {
    setupNodeEvents(on) {
      on('task', {
        flushRedis() {
          return redis.flushall()
            .catch(err => {
              console.error(err);
              throw err;
            });
        },
      });
    },
    baseUrl: 'http://localhost:3000',
    chromeWebSecurity: false,
  },
});
