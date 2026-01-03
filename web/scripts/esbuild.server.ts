import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  sourcemap: true,
  platform: 'node',
  target: 'node24',
  packages: 'external',
  outdir: 'dist',
  tsconfig: 'tsconfig.server.json',
  format: 'esm',
  logLevel: 'debug',
  // No need to bundle the tanstack server as it has already been built once
  external: ['./server/server.js'],
  alias: {
    // We must stub the dev mode integration with an empty file.
    // Otherwise, we cannot run the resulting script due to the top level awaits.
    '#server/tanstackIntegration': '#server/tanstackIntegration.prod',
    // Replace the tanstack server implementation with the actual implementation
    // Path should be relative to the dist folder, as that's where bundled server file resides.
    '#server/distServerStub': './server/server.js',
  },
  define: process.env.NODE_ENV
    ? {
      // This will effectively force the build to use a specific environment
      'process.env.NODE_ENV': `"${process.env.NODE_ENV}"`,
    }
    : undefined,
});
