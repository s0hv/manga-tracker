import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import istanbul from 'vite-plugin-istanbul';
import tsconfigPaths from 'vite-tsconfig-paths';

// Base url must be defined in production
const baseUrl = process.env.NODE_ENV === 'production'
  ? process.env.HOST
  : (process.env.HOST ?? 'https://localhost:3000');

const isCypress = /true|y|yes/i.test(process.env.CYPRESS || '');
const isCI = !!process.env.IS_CI;

export default defineConfig({
  server: {
    port: 3000,
  },
  ssr: {
    noExternal: ['@mui/*'],
    target: 'node',
  },
  build: {
    sourcemap: isCypress,
  },
  plugins: [
    isCypress
      ? istanbul({
        forceBuildInstrument: true,
      })
      : undefined,

    // Enables Vite to resolve imports using path aliases.
    tsconfigPaths(),
    tanstackStart({
      sitemap: {
        enabled: !isCI,
        host: new URL(baseUrl).origin,
      },
      prerender: {
        enabled: !isCI,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
      },
      pages: ['/terms', '/privacy_policy', '/third_party_notices'].map(path => ({
        path,
        prerender: {
          // Pre-rendering just does not work during CI
          enabled: !isCI,
        },
      })),
    }),

    viteReact(),
  ],
});
