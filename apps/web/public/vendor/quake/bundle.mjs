// Writes quake.js from a patched copy of WebQuake's Client folder and ghosty.js (build.sh runs it; plain Node, no
// packages): WebQuake's scripts in index.htm's order (Sys.js left out: ghosty.js takes its place), its GLSL shaders
// taken out of index.htm, all inside one function, so every start is a fresh Quake and no name is left on the page.
//   node bundle.mjs <patched Client folder> <ghosty.js> <quake.js>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [client, platform, outFile] = process.argv.slice(2);
if (!client || !platform || !outFile) throw new Error('usage: node bundle.mjs <Client folder> <ghosty.js> <quake.js>');
const page = readFileSync(join(client, 'index.htm'), 'utf8');
const scripts = [...page.matchAll(/<script type="text\/javascript" src="(WebQuake\/[A-Za-z_]+\.js)"><\/script>/g)].map((m) => m[1]).filter((s) => s !== 'WebQuake/Sys.js');
const shaders = Object.fromEntries([...page.matchAll(/<script type="x-shader\/x-(?:vertex|fragment)" id="([A-Za-z]+)">([\s\S]*?)<\/script>/g)].map((m) => [m[1], m[2].replace(/\r\n/g, '\n')]));
if (scripts.length < 30 || Object.keys(shaders).length < 20) throw new Error(`index.htm gave ${scripts.length} scripts and ${Object.keys(shaders).length} shaders`);

const sources = scripts.map((s) => [s, readFileSync(join(client, s), 'utf8').replace(/\r\n/g, '\n')]);
// every name WebQuake's scripts assign at their top level (COM = {}; …), plus the WebGL context GL.js keeps in `gl`
const names = new Set(['gl', 'Sys']);
for (const [, text] of sources) for (const m of text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*) = /gm)) names.add(m[1]);
const browser = ['window', 'document', 'localStorage', 'XMLHttpRequest', 'Audio', 'alert', 'confirm', 'open'];

const out = [
  '/* quake.js: WebQuake (https://github.com/Triang3l/webquake at 917617ffdfe42fa9dca41bf1762f16a2e71f2d7b, GPL-2: LICENCE)',
  "   for Ghosty's arcade: its client's scripts with the patches in patches/ and Ghosty's platform file ghosty.js in",
  '   place of Sys.js, written by build.sh (bundle.mjs). Do not edit; rebuild. See SOURCE.md. */',
  'self.GhostyQuake = function (host) {',
  `var ${browser.join(', ')};`,
  `var ${[...names].sort().join(', ')};`,
  `var SHADERS = ${JSON.stringify(shaders)};`,
  ...sources.map(([s, text]) => `// ---- ${s} ----\n${text.trimEnd()}\n`),
  `// ---- ghosty.js ----\n${readFileSync(platform, 'utf8').trimEnd()}`,
  '};',
  '',
];
writeFileSync(outFile, out.join('\n'));
console.log(`${outFile}: ${scripts.length} scripts, ${Object.keys(shaders).length} shaders, ${names.size} names`);
