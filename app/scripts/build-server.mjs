// Bundles the server into dist/server.js; npm dependencies stay external.
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx',
  logLevel: 'info',
});
