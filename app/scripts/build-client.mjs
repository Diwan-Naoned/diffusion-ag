// Bundles the small browser modules in src/client/ into static/js/.
import * as esbuild from 'esbuild';
import { readdirSync } from 'node:fs';

const entryPoints = readdirSync('src/client')
  .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
  .map((f) => `src/client/${f}`);

const options = {
  entryPoints,
  outdir: 'static/js',
  bundle: true,
  format: 'esm',
  target: ['es2020', 'safari15', 'chrome90', 'firefox90'],
  minify: !process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--watch') ? 'inline' : false,
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
