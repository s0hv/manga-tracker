import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// Base url must be defined in production
const baseUrl = process.env.NODE_ENV === 'production'
  ? process.env.HOST
  : (process.env.HOST ?? 'https://localhost:3000');

export default defineConfig({
  server: {
    port: 3000,
  },
  ssr: {
    noExternal: ['@mui/*'],
    target: 'node',
  },
  plugins: [
    // Enables Vite to resolve imports using path aliases.
    tsconfigPaths(),
    tanstackStart({
      sitemap: {
        enabled: true,
        host: new URL(baseUrl).origin,
      },
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
      },
      pages: ['/terms', '/privacy_policy', '/third_party_notices'].map(path => ({
        path,
        prerender: { enabled: true },
      })),
    }),
    viteReact(),
  ],
});
