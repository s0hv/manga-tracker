import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    root: '.',
    alias: {
      '@/components': path.resolve(__dirname, './src/components'),
      '@/views': path.resolve(__dirname, './src/views'),
      '@/webUtils': path.resolve(__dirname, './src/utils'),
      '@/serverUtils': path.resolve(__dirname, './utils'),
      '@/db': path.resolve(__dirname, './db'),
      '@/types': path.resolve(__dirname, './types'),
      '@/common': path.resolve(__dirname, './common'),
    },
    globals: true,
    setupFiles: ['./setupTests.ts'],
    include: ['__tests__/**/*.test.{ts,tsx,js,jsx}'],
    clearMocks: true,
    environmentMatchGlobs: [
      ['__tests__/**/*.test.{jsx,tsx}', 'jsdom'],
      ['__tests__/**/*.test.{js,ts}', 'node'],
    ],
    reporters: ['default'],
    silent: false,
    coverage: {
      reportsDirectory: 'coverage',
      provider: 'istanbul',
      exclude: [
        'coverage/**',
        'dist/**',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/node_modules/**',
        '**/.next/**',
        '**/{vitest,jest}.config.*',
        '**/{setupTests,next.config,loader,.eslintrc}rc.{js,cjs,ts}',
        '**/utils/logging.js', // No need to collect coverage for loggers
      ],
    },
  },
});
