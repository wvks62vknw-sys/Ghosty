// Builds the interface into dist/ with esbuild (no other build tools needed).
//   node build.mjs          production build
//   node build.mjs --watch  rebuild on change
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
copyFileSync('index.html', 'dist/index.html');
copyFileSync('styles.css', 'dist/styles.css');

// Which version this is (shown in the System tab). Cloudflare's build sets WORKERS_CI_COMMIT_SHA.
const sha = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local';
const define = { __GHOSTY_BUILD__: JSON.stringify({ sha, at: new Date().toISOString() }) };
const common = { bundle: true, format: 'esm', target: 'es2022', minify: !watch, sourcemap: true, logLevel: 'info', define };
const jobs = [
  { ...common, entryPoints: ['src/main.ts'], outfile: 'dist/app.js' },
  { ...common, entryPoints: ['src/workers/textures.worker.ts'], outfile: 'dist/textures.worker.js', format: 'iife' },
];

if (watch) {
  for (const j of jobs) await (await context(j)).watch();
} else {
  await Promise.all(jobs.map((j) => build(j)));
}
