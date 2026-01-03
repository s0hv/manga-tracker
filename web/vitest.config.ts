import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const noParallelTestsFiles = [
  '__tests__/api/auth.test.ts',
];

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'react',
          include: ['__tests__/**/*.test.{tsx,jsx}'],
          environment: 'jsdom',
        },
      },

      {
        extends: true,
        test: {
          name: 'node',
          include: ['__tests__/**/*.test.{ts,js}'],
          exclude: noParallelTestsFiles,
          environment: 'node',
        },
      },

      {
        extends: true,
        test: {
          name: 'node-no-parallel',
          include: noParallelTestsFiles,
          environment: 'node',
          fileParallelism: false,
          maxConcurrency: 1,
        },
      },
    ],
    root: '.',
    alias: {
      '@/components': path.resolve(__dirname, './src/components'),
      '@/views': path.resolve(__dirname, './src/views'),
      '@/webUtils': path.resolve(__dirname, './src/utils'),
      '@/serverUtils': path.resolve(__dirname, './server/utils'),
      '@/db': path.resolve(__dirname, './server/db'),
      '@/types': path.resolve(__dirname, './types'),
      '@/common': path.resolve(__dirname, './common'),
      '@/tests': path.resolve(__dirname, './__tests__'),
    },
    include: [
      '__tests__',
    ],
    setupFiles: ['./setupTests.ts'],
    globalSetup: './__tests__/globalSetup.ts',
    clearMocks: true,
    reporters: ['default', 'github-actions'],
    silent: false,
    coverage: {
      reportsDirectory: 'coverage',
      provider: 'istanbul',
      reportOnFailure: true,
      exclude: [
        'coverage',
        'dist',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/node_modules/**',
        '**/.next/**',
        '**/{vitest,jest}.config.*',
        '**/{setupTests,next.config,loader,.eslintrc}rc.{js,cjs,ts}',
        '**/utils/logging.ts', // No need to collect coverage for loggers
      ],
    },
  },
});
