import { build } from 'rolldown';
import { replacePlugin } from 'rolldown/plugins';

await build({
  input: 'server.ts',
  output: {
    dir: 'dist',
    comments: true,
    sourcemap: true,
    format: 'esm',
    paths: {
      // Stub the dev mode integration with a package that's already used.
      // In the build this will result in `import 'node:stream'`
      '#server/tanstackIntegration': 'node:stream',
      // Replace the tanstack server implementation with the actual implementation
      // Path should be relative to the dist folder, as that's where bundled server file resides.
      '#server/distServerStub': './server/server.js',
    },
  },
  tsconfig: 'tsconfig.server.json',
  platform: 'node',
  // No need to bundle the tanstack server as it has already been built once
  external: [
    // The server modules should be considered external as they are built by vite
    '#server/distServerStub',
    './server/server.js',
    // This module will be replaced with a stub
    '#server/tanstackIntegration',
    // Regex to match external libraries.
    // They start with @ or a letter and do not end in .ts.
    /^@?([\w-_:]+\/?)+(?<!\.ts)$/,
  ],
  logLevel: 'debug',
  transform: {
    target: 'node24',
  },
  // No side effects, so unused imports can be removed
  treeshake: {
    moduleSideEffects: false,
  },
  plugins: [
    replacePlugin(
      {
        ...(process.env.NODE_ENV
          ? {
            // Replace node env with the given one. This will allow the optimizer
            // to further remove unused code
            'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
          }
          : undefined),
      },
      {
        preventAssignment: false,
      }
    ),
  ],
});
