// Packs a plain word list (one lowercase word a line, a-z only) into the app's own word-list file: a minimal DAWG, three bytes
// an edge (17 bits child, 1 bit last-edge-of-its-node, 1 bit word-ends-here, 5 bits letter), after a 16-byte header
// ('GWL1', the edge count with its dummy edge 0, the word count, the edge where the first letters start). Used once to make apps/web/public/data/words-en.dawg from the
// public-domain ENABLE list; nothing in a build or at run time fetches or packs anything.
//   node tools/pack-words.mjs enable1.txt apps/web/public/data/words-en.dawg
import { readFileSync, writeFileSync } from 'node:fs';

const [src, dst] = process.argv.slice(2);
const words = [...new Set(readFileSync(src, 'utf8').split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z]{2,15}$/.test(w)))].sort();
const root = { c: new Map(), e: false };
for (const w of words) {
  let n = root;
  for (const ch of w) {
    if (!n.c.has(ch)) n.c.set(ch, { c: new Map(), e: false });
    n = n.c.get(ch);
  }
  n.e = true;
}
const reg = new Map();
const order = [];
function min(n) {
  if (n.min) return n.min;
  const edges = [...n.c.keys()].sort().map((k) => ({ k, to: min(n.c.get(k)), e: n.c.get(k).e }));
  const sig = edges.map((x) => `${x.k}${x.to.id}${x.e ? 1 : 0}`).join(',');
  let r = reg.get(sig);
  if (!r) {
    r = { id: reg.size, edges, at: 0 };
    reg.set(sig, r);
    order.push(r);
  }
  n.min = r;
  return r;
}
const top = min(root);
let at = 1;
for (const r of order) {
  r.at = r.edges.length ? at : 0;
  at += r.edges.length;
}
const total = at;
if (total > 1 << 17) throw new Error('too many edges for 17 bits');
const out = Buffer.alloc(16 + total * 3);
out.write('GWL1', 0, 'latin1');
out.writeUInt32LE(total, 4);
out.writeUInt32LE(words.length, 8);
out.writeUInt32LE(top.at, 12);
for (const r of order) {
  r.edges.forEach((x, i) => {
    const v = (x.to.edges.length ? x.to.at : 0) | (i === r.edges.length - 1 ? 1 << 17 : 0) | (x.e ? 1 << 18 : 0) | ((x.k.charCodeAt(0) - 97) << 19);
    const o = 16 + (r.at + i) * 3;
    out[o] = v & 255;
    out[o + 1] = (v >> 8) & 255;
    out[o + 2] = (v >> 16) & 255;
  });
}
writeFileSync(dst, out);
console.log(`${words.length} words, ${total} edges, ${out.length} bytes`);
