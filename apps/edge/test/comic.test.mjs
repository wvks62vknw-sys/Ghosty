// THE COMIC (FINAL ROUND, lane COMIC), its pure parts held to their rules with no screen: the writer (an idea becomes a whole
// comic with a beginning, a turn, an end and a callback, its cast kept, the same comic again from the same seed), the panel grids
// (every panel inside the page, none overlapping, for every count and grid), the chat's wordings, the guided view's panel finder on
// a drawn page, the file sniffing (a CBR said, a zip named .cbr read) and the library's query (public domain only, no key).
// esbuild-bundled from the source, as the other screen tests are.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const S = '../../web/src/features/comic/';
await build({
  entryPoints: { model: at(`${S}model.ts`), asks: at(`${S}asks.ts`), files: at(`${S}files.ts`), library: at(`${S}library.ts`) },
  outdir: at('./.build/comic/'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'error',
});
const O = (n) => import(at(`./.build/comic/${n}.js`));
const M = await O('model');
const A = await O('asks');
const F = await O('files');
const L = await O('library');

test('the writer: an idea becomes a whole comic (cover words, four pages of 3, 4, 4 and 3 panels), a cast of three kept in every panel, a beginning, a turn, an end and a callback', () => {
  const c = M.writeComic({ idea: 'make me a comic about a cat who wants to be an astronaut', seed: 7 });
  assert.equal(c.pages.length, 4);
  assert.deepEqual(c.pages.map((p) => p.panels.length), [3, 4, 4, 3]);
  assert.deepEqual(c.cast.map((m) => m.role), ['hero', 'friend', 'rival']);
  assert.equal(c.cast[0].look.species, 'cat');
  const ids = new Set(c.cast.map((m) => m.id));
  for (const p of c.pages.flatMap((g) => g.panels)) {
    for (const a of p.actors) assert.ok(ids.has(a.who), `an actor not in the cast: ${a.who}`);
    for (const b of p.balloons) assert.ok(ids.has(b.who) && b.text.length > 0, `a balloon with no speaker or no words: ${JSON.stringify(b)}`);
    assert.ok(M.SCENES.includes(p.scene) && M.TIMES.includes(p.time) && M.SHOTS.includes(p.shot));
  }
  const words = M.scriptOf(c);
  assert.match(words, /Today I become an astronaut!/, 'the want, said out loud and grammatically');
  assert.match(words, /Attempt number one\./);
  assert.match(words, /worst idea I have ever heard/, 'the turn');
  assert.match(words, /THE END/);
  assert.equal((words.match(/Who put that there\?/g) ?? []).length, 2, 'the line comes back at the end (the callback)');
  assert.match(c.tagline, /^In which .+ tries to be an astronaut\.$/);
  // the same seed, the same comic (its words and its looks)
  const again = M.writeComic({ idea: 'make me a comic about a cat who wants to be an astronaut', seed: 7 });
  assert.equal(M.scriptOf(again), words);
  assert.deepEqual(again.cast.map((m) => m.look), c.cast.map((m) => m.look));
  // names he gives are kept
  const named = M.writeComic({ idea: 'a robot who can’t dance', hero: 'Bolt', friend: 'Ana', rival: 'Dr Sneer' });
  assert.deepEqual(named.cast.map((m) => m.name), ['Bolt', 'Ana', 'Dr Sneer']);
  assert.equal(named.cast[0].look.species, 'robot');
  assert.ok(M.comicFrom(JSON.parse(JSON.stringify(named))), 'a kept comic reads back');
  assert.equal(M.comicFrom({ id: 'x', pages: [{ panels: [{}] }], cast: [] }), null, 'a damaged one is refused');
});

test('reading his idea: the hero, the want, the place', () => {
  const r = (t) => M.readIdea(t);
  assert.deepEqual([r('a cat who wants to fly').species, r('a cat who wants to fly').goal], ['cat', 'fly']);
  assert.equal(r('my dog Rex tries to catch the postman').name, 'Rex');
  assert.equal(r('my dog Rex tries to catch the postman').goal, 'catch the postman');
  assert.equal(r('a robot who can’t dance').goal.replace('’', "'"), 'dance');
  assert.equal(r('a ghost who is scared of the dark').species, 'ghost');
  assert.equal(r('pirates on the moon').scene, 'space');
  assert.match(r('pizza').goal, /^win the Grand Pizza Contest$/);
  assert.equal(r('a knight called Sir Bumble who wants to slay a dragon').name, 'Sir Bumble');
});

test('the panel grids: for every count of panels and every grid, every panel inside the page, none overlapping, gutters between', () => {
  for (const [n, grids] of Object.entries(M.LAYOUTS)) {
    grids.forEach((_, layout) => {
      const rects = M.panelRects({ layout, panels: Array.from({ length: Number(n) }) });
      assert.equal(rects.length, Number(n));
      for (const r of rects) assert.ok(r.x >= M.MARGIN - 1 && r.y >= M.MARGIN - 1 && r.x + r.w <= M.PAGE_W - M.MARGIN + 1 && r.y + r.h <= M.PAGE_H - M.MARGIN + 1 && r.w > 100 && r.h > 100, `${n}/${layout}: a panel outside the page ${JSON.stringify(r)}`);
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const apart = a.x + a.w + 8 <= b.x || b.x + b.w + 8 <= a.x || a.y + a.h + 8 <= b.y || b.y + b.h + 8 <= a.y;
        assert.ok(apart, `${n}/${layout}: panels ${i} and ${j} touch or overlap`);
      }
    });
  }
});

test('the chat: many wordings, one comic app', () => {
  const k = (t) => A.comicAsked(t);
  for (const t of ['make me a comic about a cat who wants to fly', 'Draw a comic where a robot can’t dance', 'write a comic book about pirates', 'create a funny comic about my dog', 'a comic about my cat', 'can you make me a comic strip about Mondays?', 'make a manga about a ninja'])
    assert.equal(k(t)?.what, 'make', `"${t}" makes a comic`);
  assert.equal(k('make me a comic about a cat who wants to fly').idea, 'a cat who wants to fly');
  for (const t of ['read a comic', 'show my comics', 'my comics', 'I want to read a comic book', 'open my comics']) assert.equal(k(t)?.what, 'shelf', `"${t}" opens the shelf`);
  for (const t of ['import this comic', 'import a CBZ', 'add my comic files', 'load a comic']) assert.equal(k(t)?.what, 'import', `"${t}" imports`);
  for (const t of ['public domain comics', 'free comics', 'find me some old western comics', 'golden age comics', 'comic library']) assert.equal(k(t)?.what, 'library', `"${t}" opens the library`);
  assert.equal(k('find me some old western comics').words, 'western');
  assert.ok(['open', 'shelf'].includes(k('open comic')?.what), 'open comic opens it');
  assert.equal(k('the comic app')?.what, 'open');
  for (const t of ['what is the weather', 'make me a poster', 'read me a book', 'that was comical']) assert.equal(k(t), null, `"${t}" is not the comic's`);
});

test('the files: a CBR (RAR) is said, not read; a zip named .cbr is read; a PDF and a picture are known by their bytes', () => {
  assert.equal(F.sniff(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])), 'rar');
  assert.equal(F.sniff(new Uint8Array([0x50, 0x4b, 3, 4])), 'zip');
  assert.equal(F.sniff(new TextEncoder().encode('%PDF-1.4')), 'pdf');
  assert.equal(F.sniff(new Uint8Array([0xff, 0xd8, 0xff])), 'pic');
  assert.match(F.CBR_WORDS, /no phone browser can open/);
  assert.match(F.CBR_WORDS, /Save it as a CBZ/);
});

test('the guided view: the panels of a drawn page are found in reading order (a wide one over two, then two over a wide one)', () => {
  const W = 120;
  const H = 180;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  const box = (x, y, w, h) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = (yy * W + xx) * 4;
      data[i] = 40;
      data[i + 1] = 90;
      data[i + 2] = 160;
    }
  };
  box(6, 6, 108, 50);
  box(6, 64, 50, 54);
  box(64, 64, 50, 54);
  box(6, 126, 108, 48);
  const got = F.findPanels({ width: W, height: H, data });
  assert.equal(got.length, 4, JSON.stringify(got));
  const centres = got.map(([x, y, w, h]) => [x + w / 2, y + h / 2]);
  assert.ok(centres[0][1] < centres[1][1] && centres[1][0] < centres[2][0] && centres[2][1] < centres[3][1], 'top to bottom, left to right');
  // a page with no gutters is one panel
  assert.deepEqual(F.findPanels({ width: 10, height: 10, data: new Uint8ClampedArray(400).fill(255) }), [[0, 0, 1, 1]]);
});

test('the library: the Internet Archive’s open search, public-domain items only, no key, nothing paid', () => {
  const u = L.searchUrl('western');
  assert.match(u, /^https:\/\/archive\.org\/advancedsearch\.php\?/);
  assert.match(decodeURIComponent(u), /licenseurl:\(\*publicdomain\*\)/);
  assert.match(decodeURIComponent(u), /title:\(western\)/);
  assert.doesNotMatch(u, /key|token|auth/i);
  assert.match(L.creditOf({ id: 'X1', title: 'X', year: '1950', creator: '' }), /^Public domain, from the Internet Archive \(archive\.org\/details\/X1\), first published 1950\.$/);
});
