// A tiny ZIM file made from our own words (the fixture of apps/edge/test/resta.test.mjs and tests/resta.spec.mjs): the
// layout libzim writes today (format 6.3: content in namespace C, metadata in M, the title index as
// X/listing/titleOrdered/v1, no old title list in the header), five articles, two redirects, a picture, a main page, and
// three clusters, one of each kind a Kiwix file uses: zstd (made here with node:zlib), xz (made once with
// `xz --format=xz --check=crc32` from XZ_ARTICLES below and kept as base64, since Node has no xz; node
// tests/fixtures/zim/fixture.mjs --xz prints the raw cluster to feed it) and uncompressed (the index and the picture).
// Nothing here comes from Kiwix: every word is ours.
import { createHash } from 'node:crypto';
import zlib from 'node:zlib';

const enc = new TextEncoder();
const page = (title, body) => `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><link rel="stylesheet" href="./_mw_/site.styles.css"><script src="./_res_/script.js"></script></head><body><main><h1>${title}</h1><div id="mw-content-text">${body}</div></main><footer>This test article is Ghosty's own words.</footer></body></html>`;

/** The articles in the zstd cluster (with the metadata). */
export const ARTICLES = {
  'Black_hole': page(
    'Black hole',
    `<section data-mw-section-id="0"><table class="infobox"><tr><td><p>Infobox words that are not the first paragraph at all.</p></td></tr></table>` +
      `<p class="mw-empty-elt"></p>` +
      `<p>A <b>black hole</b> is a place in space where gravity pulls so hard that not even light can get out.<sup class="reference"><a href="#cite_note-1">[1]</a></sup> It forms when a very big <a href="Star" title="Star">star</a> falls in on itself, as <a href="General_relativity">general relativity</a> says.</p>` +
      `<p><img src="./_assets_/x/Dot.png" alt="A dark dot" width="2" height="2"> <a href="https://example.org/far" onclick="alert(1)">a page on the web</a> <a href="javascript:alert(2)">a trick</a> <span onmouseover="alert(3)">hover</span></p>` +
      `<script>alert(4)</script><iframe src="https://example.org/"></iframe></section>` +
      `<section data-mw-section-id="1"><h2>Formation</h2><p>Most black holes form at the end of a big star's life, after it explodes.</p></section>` +
      `<section data-mw-section-id="2"><h2>References</h2><ol><li>A book about space.</li></ol></section>`,
  ),
  'Star': page('Star', `<section data-mw-section-id="0"><p>A <b>star</b> is a huge ball of hot gas that makes its own light, like the <a href="./Sun">Sun</a>. A star that is big enough can become a <a href="Black_hole">black hole</a>.</p></section>`),
  'Volcano': page('Volcano', `<section data-mw-section-id="0"><p>A <b>volcano</b> is an opening in the ground where melted rock, ash and gas come up from deep inside a planet.</p></section>`),
};

/** The articles in the xz cluster (kept as base64 in XZ_CLUSTER below: change them and make it again). */
export const XZ_ARTICLES = {
  'Cat': page('Cat', `<section data-mw-section-id="0"><p>The <b>cat</b> is a small furry animal that people keep as a pet. Cats like to sleep, play and hunt mice.</p></section>`),
  'Sun': page('Sun', `<section data-mw-section-id="0"><p>The <b>Sun</b> is the star at the middle of our solar system. The Earth goes round it once a year.</p></section>`),
};

/** A two-by-two picture (PNG), made here. */
function png() {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    data.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8;
  ihdr[9] = 0; // greyscale
  const raw = Buffer.from([0, 0, 255, 0, 255, 0]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A cluster's uncompressed bytes: its blob offsets (u32, one more than blobs), then the blobs. */
export function clusterData(blobs) {
  const head = 4 * (blobs.length + 1);
  const total = head + blobs.reduce((s, b) => s + b.length, 0);
  const out = Buffer.alloc(total);
  let at = head;
  blobs.forEach((b, i) => {
    out.writeUInt32LE(at, i * 4);
    Buffer.from(b).copy(out, at);
    at += b.length;
  });
  out.writeUInt32LE(at, blobs.length * 4);
  return out;
}

/** clusterData of XZ_ARTICLES (Cat, then Sun), compressed by `xz --format=xz --check=crc32 -6`. */
const XZ_CLUSTER =
  '/Td6WFoAAAFpIt42AgAhARYAAAB0L+Wj4AOoAZ9dAAYANRbHHE7l/KdcR7Unt3LfNWpVXCaTf1TlpO29TGHpnZF++nTSY60x8L2nAywCVTqXC3tBNfLf7tanVtuE23bz6Xj12h+lTKvblq6zFiw2+Z92pFv6QVtI3Qh5ITWgpzGAphdOOeTwza+uezq8LHAzTOuUJ0gm69cijUa5HrBdnRYdfJDoGhYPkaEO1w41tRQuDliq2xyoAhgxat9LH1UHzfN/Vs0YERRaPE4lwp+i89IueDG+nMGul17eEcR/ydvYF4ENPuvLqDt3qbUphaX524I/Jo9m/mVKeIyoGWHUo9YwKz9uKjyVs70Dm+N8eba3vcLnIy0oXx0SGiDdiuhVg4C/Bb+qP0YYt7jZO3fY7MJadOElTHWGazHUuA24OSf5cND/0F0Pe77QiBkqQy9ZMM78UaV+52k04aw+EYU3FtqQt7eC7tYNm8JTQ/Tz20a7uPnVSAa4rYptff/HEPGxKo2CiLQy3FgBvBacWsxuIk6+XA0Xs7lA3mHxvEAJ9fwbSOE4BPFdZ8ev7MyZw6QSHYIZpCIoWV95elEoCzwAAFUlLi8AAbcDqQcAAMrNFrY+MA2LAgAAAAABWVo=';

const META = { Title: 'Ghosty test Wikipedia', Date: '2026-10-15', Language: 'eng', Description: 'Five articles in our own words, for the tests.', Name: 'ghosty_test_wikipedia', Creator: 'Ghosty', Publisher: 'Ghosty' };

/** The whole file. */
export function buildZim() {
  const MIMES = ['application/octet-stream+zimlisting', 'image/png', 'text/html', 'text/plain'];
  const mimeOf = (m) => MIMES.indexOf(m);
  // every entry: [ns, url, title, {cluster, blob, mime} | {to: 'ns/url'}]
  const zstdBlobs = [];
  const entries = [];
  for (const [k, v] of Object.entries(META)) {
    entries.push({ ns: 'M', url: k, title: '', cluster: 0, blob: zstdBlobs.length, mime: 'text/plain' });
    zstdBlobs.push(enc.encode(v));
  }
  for (const [url, html] of Object.entries(ARTICLES)) {
    entries.push({ ns: 'C', url, title: url.replace(/_/g, ' '), cluster: 0, blob: zstdBlobs.length, mime: 'text/html' });
    zstdBlobs.push(enc.encode(html));
  }
  Object.keys(XZ_ARTICLES).forEach((url, i) => entries.push({ ns: 'C', url, title: url, cluster: 1, blob: i, mime: 'text/html' }));
  entries.push({ ns: 'C', url: '_assets_/x/Dot.png', title: '', cluster: 2, blob: 1, mime: 'image/png' });
  entries.push({ ns: 'C', url: 'Black_holes', title: 'Black holes', to: 'C/Black_hole' });
  entries.push({ ns: 'C', url: 'Cats', title: 'Cats', to: 'C/Cat' });
  entries.push({ ns: 'W', url: 'mainPage', title: '', to: 'C/Black_hole' });
  entries.push({ ns: 'X', url: 'listing/titleOrdered/v1', title: '', cluster: 2, blob: 0, mime: 'application/octet-stream+zimlisting' });
  // the directory is in path order
  entries.sort((a, b) => (`${a.ns}/${a.url}` < `${b.ns}/${b.url}` ? -1 : 1));
  const index = new Map(entries.map((e, i) => [`${e.ns}/${e.url}`, i]));
  // the title index: the articles (and redirects to them) by title
  const listed = entries.map((e, i) => [e, i]).filter(([e]) => e.ns === 'C' && (e.to || e.mime === 'text/html')).sort(([a], [b]) => ((a.title || a.url) < (b.title || b.url) ? -1 : 1));
  const listing = Buffer.alloc(listed.length * 4);
  listed.forEach(([, i], k) => listing.writeUInt32LE(i, k * 4));

  const xz = Buffer.from(XZ_CLUSTER, 'base64');
  const clusters = [
    Buffer.concat([Buffer.from([5]), zlib.zstdCompressSync(clusterData(zstdBlobs))]),
    Buffer.concat([Buffer.from([4]), xz]),
    Buffer.concat([Buffer.from([1]), clusterData([listing, png()])]),
  ];
  // the layout: header, MIME list, clusters, directory entries, URL pointers, cluster pointers, checksum
  const mimeList = Buffer.concat([...MIMES.map((m) => Buffer.from(`${m}\0`)), Buffer.from([0])]);
  let at = 80 + mimeList.length;
  const clusterAt = clusters.map((c) => {
    const p = at;
    at += c.length;
    return p;
  });
  const dirents = entries.map((e) => {
    const name = Buffer.from(`${e.url}\0${e.title}\0`);
    const d = Buffer.alloc((e.to ? 12 : 16) + name.length);
    d.writeUInt16LE(e.to ? 0xffff : mimeOf(e.mime), 0);
    d[2] = 0;
    d.write(e.ns, 3, 'ascii');
    d.writeUInt32LE(0, 4);
    if (e.to) d.writeUInt32LE(index.get(e.to), 8);
    else {
      d.writeUInt32LE(e.cluster, 8);
      d.writeUInt32LE(e.blob, 12);
    }
    name.copy(d, e.to ? 12 : 16);
    return d;
  });
  const direntAt = dirents.map((d) => {
    const p = at;
    at += d.length;
    return p;
  });
  const urlPtrPos = at;
  const urlPtrs = Buffer.alloc(entries.length * 8);
  direntAt.forEach((p, i) => urlPtrs.writeBigUInt64LE(BigInt(p), i * 8));
  at += urlPtrs.length;
  const clusterPtrPos = at;
  const clusterPtrs = Buffer.alloc(clusters.length * 8);
  clusterAt.forEach((p, i) => clusterPtrs.writeBigUInt64LE(BigInt(p), i * 8));
  at += clusterPtrs.length;
  const checksumPos = at;
  const header = Buffer.alloc(80);
  header.writeUInt32LE(0x044d495a, 0);
  header.writeUInt16LE(6, 4);
  header.writeUInt16LE(3, 6);
  Buffer.from('ghostytestwiki01').copy(header, 8);
  header.writeUInt32LE(entries.length, 24);
  header.writeUInt32LE(clusters.length, 28);
  header.writeBigUInt64LE(BigInt(urlPtrPos), 32);
  header.writeBigUInt64LE(0xffffffffffffffffn, 40);
  header.writeBigUInt64LE(BigInt(clusterPtrPos), 48);
  header.writeBigUInt64LE(80n, 56);
  header.writeUInt32LE(index.get('W/mainPage'), 64);
  header.writeUInt32LE(0xffffffff, 68);
  header.writeBigUInt64LE(BigInt(checksumPos), 72);
  const body = Buffer.concat([header, mimeList, ...clusters, ...dirents, urlPtrs, clusterPtrs]);
  return new Uint8Array(Buffer.concat([body, createHash('md5').update(body).digest()]));
}

// node tests/fixtures/zim/fixture.mjs --xz > raw.bin: the xz cluster's raw bytes, for `xz --format=xz --check=crc32 -c raw.bin | base64 -w0`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()) && process.argv.includes('--xz')) {
  process.stdout.write(clusterData(Object.values(XZ_ARTICLES).map((h) => enc.encode(h))));
}
