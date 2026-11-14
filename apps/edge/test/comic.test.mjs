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
  entryPoints: { model: at(`${S}model.ts`), asks: at(`${S}asks.ts`), files: at(`${S}files.ts`), library: at(`${S}library.ts`), script: at(`${S}script.ts`), rar: at(`${S}rar.ts`), week: at(`${S}week.ts`) },
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
const SC = await O('script');

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

test('the files: a CBR (RAR) asks for the free RAR reader; a zip named .cbr is read; a PDF and a picture are known by their bytes', async () => {
  assert.equal(F.sniff(new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])), 'rar');
  assert.equal(F.sniff(new Uint8Array([0x50, 0x4b, 3, 4])), 'zip');
  assert.equal(F.sniff(new TextEncoder().encode('%PDF-1.4')), 'pdf');
  assert.equal(F.sniff(new Uint8Array([0xff, 0xd8, 0xff])), 'pic');
  // a CBR asks for the free RAR reader, its size said, on his tap (rar.ts)
  const R = await import(at('./.build/comic/rar.js'));
  assert.equal(R.RAR_BYTES, 1073335);
  const need = R.rarNeeded('rar');
  assert.ok(R.isRarNeeded(need) && /free archive reader \(1\.1 MB, once/.test(need.message) && /GET THE RAR READER, on Wi-Fi/.test(need.message));
  assert.ok(!R.isRarNeeded(new Error('x')));
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

test('Ghosty writes, the app draws: the brain is asked in a plain format with the cast as drawn; its script is read into pages for that cast, the unknown mapped to what can be drawn, a thin one refused', () => {
  const base = M.writeComic({ idea: 'a cat who wants to fly', hero: 'Biscuit', friend: 'Ana', rival: 'Dr Sneer', seed: 3 });
  const ask = SC.scriptAsk('a cat who wants to fly', base.cast, 'A mystery');
  assert.match(ask, /^COMIC SCRIPT: /);
  assert.match(ask, /HERO = Biscuit \(a cat\); FRIEND = Ana \(a person\); RIVAL = Dr Sneer/);
  assert.match(ask, /The kind of story: A mystery\./);
  assert.doesNotMatch(ask, /\ba comic\b/i, 'never the words that turn the creative tool on');
  const text = [
    'TITLE: **Biscuit Takes Off**', 'TAGLINE: Up, up and slightly sideways.', 'PAGE 1',
    'PANEL: garden, morning, establishing | the want', 'CAST: Biscuit excited waving; Ana bored walking', 'CAPTION: Monday.', 'Biscuit (shout): Today I fly!', 'Ana: You are a cat.',
    'PANEL: moon, midnight, close-up | dream', 'Biscuit (thought): One day.', 'SFX: "ZOOM"',
    'PAGE 2', 'PANEL: town, day, mid | rival', 'CAST: Dr Sneer proud gesturing', 'Dr Sneer: Cats cannot fly.', 'Nobody: ignored line',
    'PANEL: lab, dusk, wide | idea', 'ANA: Kites!', 'BISCUIT (whisper): Kites.',
    'PANEL: sky, day, mid | end', 'HERO: Wheee!', 'CAPTION: THE END.',
  ].join('\n');
  const r = SC.readScript(text, base.cast);
  assert.ok(r);
  assert.equal(r.title, 'Biscuit Takes Off');
  assert.equal(r.pages.length, 2);
  assert.deepEqual(r.pages.map((p) => p.panels.length), [2, 3]);
  const p1 = r.pages[0].panels[0];
  assert.deepEqual([p1.scene, p1.time, p1.shot], ['park', 'day', 'wide'], 'garden, morning, establishing → the nearest the drawing has');
  assert.deepEqual(p1.actors.map((a) => [a.who, a.mood, a.pose]), [['hero', 'happy', 'cheer'], ['friend', 'calm', 'run']]);
  assert.deepEqual(p1.balloons.map((b) => [b.who, b.kind]), [['hero', 'shout'], ['friend', 'speech']]);
  assert.deepEqual([r.pages[0].panels[1].scene, r.pages[0].panels[1].time, r.pages[0].panels[1].shot, r.pages[0].panels[1].sfx], ['space', 'night', 'close', 'ZOOM']);
  assert.equal(r.pages[1].panels[0].balloons.length, 1, 'a speaker not in the cast is left out');
  assert.deepEqual(r.pages[1].panels[1].actors.map((a) => a.who).sort(), ['friend', 'hero'], 'every speaker is in the panel');
  const c = SC.withScript(base, r);
  assert.deepEqual(c.cast, base.cast, 'the same cast, the same looks');
  assert.ok(M.comicFrom(JSON.parse(JSON.stringify(c))));
  assert.equal(SC.readScript('TITLE: x\nPAGE\nPANEL: town, day, wide\nHERO: hi', base.cast), null, 'too thin to be a comic');
  assert.equal(SC.readScript('Sorry, I cannot help with that.', base.cast), null);
});

test('your week as a comic: this week’s events and ticked to-dos, titles and days only, a panel a day and a last word', async () => {
  const WK = await import(at('./.build/comic/week.js'));
  const now = new Date(2026, 10, 13, 15, 0).getTime(); // a Friday afternoon
  const mon = WK.weekStart(now);
  assert.equal(new Date(mon).getDay(), 1);
  const at9 = (d) => mon + d * 86_400_000 + 9 * 3_600_000;
  const items = WK.weekItems([{ title: 'Dentist', start: at9(0) }, { title: 'Gym', start: at9(2) }, { title: 'Team meeting', start: at9(2) }, { title: 'Last week thing', start: at9(-3) }, { title: 'Pizza night', start: at9(5) }], [{ text: 'Call the bank', done: true, doneAt: at9(3) }, { text: 'Not done', done: false }], now);
  assert.deepEqual(items.map((x) => [x.day, x.title]), [[0, 'Dentist'], [2, 'Gym'], [2, 'Team meeting'], [3, 'ticked off: Call the bank'], [5, 'Pizza night']]);
  const idea = WK.weekIdea(items, 'Sam');
  assert.match(idea, /^Sam's week, day by day: Monday: Dentist; Wednesday: Gym, Team meeting; Thursday: ticked off: Call the bank; Saturday: Pizza night\./);
  const c = WK.weekComic(items, 'Sam', 7);
  assert.equal(c.title, 'Sam’s Week');
  assert.deepEqual(c.cast.map((m) => m.name), ['Sam', 'Future Me', 'Monday']);
  const panels = c.pages.flatMap((p) => p.panels);
  assert.equal(panels.length, 5, 'a panel for each of the four days, and the last word');
  assert.match(panels[0].caption, /^Monday: Dentist$/);
  assert.match(panels[0].balloons[0].text, /Brave face/);
  assert.match(panels[1].balloons[0].text, /legs/);
  assert.match(panels[4].caption, /THE END/);
  assert.ok(M.comicFrom(JSON.parse(JSON.stringify(c))));
  assert.equal(A.comicAsked('make my week into a comic')?.what, 'week');
  assert.equal(A.comicAsked('a comic of my week')?.what, 'week');
});
