// Builds the interface into dist/ with esbuild (no other build tools needed).
//   node build.mjs          production build
//   node build.mjs --watch  rebuild on change
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
copyFileSync('index.html', 'dist/index.html');

/**
 * styles.css starts by importing the design system's tokens (src/design/tokens.css, BRIEF-DESIGN-SYSTEM). The page gets ONE
 * stylesheet: the import is replaced by the file itself, so nothing waits on a second request, the offline copy (public/sw.js)
 * holds everything and the rest of styles.css ships byte for byte. A styles.css without the import is refused.
 */
const TOKENS_IMPORT = /^@import url\('src\/design\/tokens\.css'\);[^\n]*\n/;
function writeStyles() {
  const css = readFileSync('styles.css', 'utf8');
  if (!TOKENS_IMPORT.test(css)) throw new Error('styles.css must start with the import of src/design/tokens.css');
  writeFileSync('dist/styles.css', css.replace(TOKENS_IMPORT, () => `${readFileSync('src/design/tokens.css', 'utf8').trimEnd()}\n`));
}
writeStyles();

// Which version this is (shown in the System tab). Cloudflare's build sets WORKERS_CI_COMMIT_SHA.
const sha = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local';
const define = { __GHOSTY_BUILD__: JSON.stringify({ sha, at: new Date().toISOString() }) };
// /vendor/* is code served as-is next to the app (Leaflet, MapLibre): imported at runtime, never bundled.
// A .css file imported by the code comes in as its text: Settings → THE LOOK reads every token's job from tokens.css itself.
const common = { bundle: true, format: 'esm', target: 'es2022', minify: !watch, sourcemap: true, logLevel: 'info', define, external: ['/vendor/*'], loader: { '.css': 'text' } };
const jobs = [
  { ...common, entryPoints: ['src/main.ts'], outfile: 'dist/app.js' },
  { ...common, entryPoints: ['src/workers/textures.worker.ts'], outfile: 'dist/textures.worker.js', format: 'iife' },
  // the one Lens's cheap pass (frame read, steadiness, the text check), off the main thread
  { ...common, entryPoints: ['src/workers/lens.worker.ts'], outfile: 'dist/lens.worker.js', format: 'iife' },
  // the board games' search (Ghosty's thinking), off the main thread
  { ...common, entryPoints: ['src/workers/board.worker.ts'], outfile: 'dist/board.worker.js', format: 'iife' },
];

if (watch) {
  for (const j of jobs) await (await context(j)).watch();
} else {
  await Promise.all(jobs.map((j) => build(j)));
}
