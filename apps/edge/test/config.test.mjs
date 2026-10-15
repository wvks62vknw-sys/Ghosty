// Cloudflare can build Ghosty from apps/edge (its "Root directory" setting) or from the
// repository root. The two wrangler configs must describe the same Worker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const edge = read('../wrangler.jsonc');
const root = read('../../../wrangler.jsonc');

test('the root wrangler.jsonc is apps/edge/wrangler.jsonc with paths from the root', () => {
  const norm = (c, from) => {
    const x = structuredClone(c);
    delete x.$schema;
    delete x.build;
    x.main = from === 'edge' ? `apps/edge/${c.main}` : c.main;
    x.assets.directory = from === 'edge' ? c.assets.directory.replace(/^\.\.\//, 'apps/') : c.assets.directory;
    return x;
  };
  assert.deepEqual(norm(root, 'root'), norm(edge, 'edge'));
  assert.ok(edge.previews && root.previews, 'both have the previews block that `wrangler preview` needs');
  assert.match(root.build.command, /apps\/web.*npm run build/);
});
