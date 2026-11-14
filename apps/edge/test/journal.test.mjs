// JOURNAL (APPS ROUND, MEMORY lane): the journal's store and its words, pure, on their own (features/journal/store.ts, words.ts).
// His streak, On this day, search by his words, the chat's asks, and that nothing in the journal's code reads a position or sends
// his words anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: [at('../../web/src/features/journal/store.ts'), at('../../web/src/features/journal/words.ts'), at('../../web/src/features/people/touch.ts'), at('../../web/src/features/people/gifts.ts'), at('../../web/src/features/people/vcard.ts')],
  bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/journal'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
});
const S = await import('./.build/journal/apps/web/src/features/journal/store.mjs');
const W = await import('./.build/journal/apps/web/src/features/journal/words.mjs');

const DAY = 86_400_000;
const noon = new Date(2026, 10, 14, 12).getTime();
const e = (id, back, o = {}) => ({ id, journal: 'personal', at: noon - back * DAY, text: `entry ${id}`, photos: [], edited: noon, ...o });

test('journal: the streak counts days in a row ending today, or yesterday before tonight’s entry; examples and the bin do not count', () => {
  assert.equal(S.streak([e('a', 0), e('b', 1), e('c', 2), e('d', 4)], noon), 3);
  assert.equal(S.streak([e('b', 1), e('c', 2)], noon), 2, 'not lost before tonight');
  assert.equal(S.streak([e('c', 2)], noon), 0);
  assert.equal(S.streak([e('a', 0, { sample: true }), e('b', 0, { deleted: noon })], noon), 0);
});

test('journal: On this day finds a week ago, a month ago and earlier years, and nothing from the bin', () => {
  const g = S.onThisDay([e('w', 7), e('m', 0, { at: new Date(2026, 9, 14, 9).getTime() }), e('y', 0, { at: new Date(2024, 10, 14, 20).getTime() }), e('x', 0, { at: new Date(2025, 10, 14, 8).getTime(), deleted: noon }), e('n', 3)], noon);
  assert.deepEqual(g.map((x) => [x.label, x.entries.map((y) => y.id)]), [['A week ago', ['w']], ['A month ago', ['m']], ['2 years ago', ['y']]]);
});

test('journal: search by his words matches every word in the text, the place, the prompt or the journal’s name', () => {
  const j = [{ id: 'personal', name: 'Personal', tone: 'accent' }, { id: 't', name: 'Travel', tone: 'green' }];
  const x = e('a', 0, { text: 'A long walk by the canal', place: 'Birmingham', journal: 't' });
  assert.ok(S.matches(x, 'canal walk', j));
  assert.ok(S.matches(x, 'birmingham', j));
  assert.ok(S.matches(x, 'travel canal', j));
  assert.ok(!S.matches(x, 'canal beach', j));
  assert.ok(S.matches(x, '  ', j));
});

test('journal: the chat’s asks open it, start an entry, or start one with his words; Memory’s own diary asks are left alone', () => {
  assert.deepEqual(W.journalAsked('add to my journal: the boiler works again'), { open: true, write: true, words: 'the boiler works again' });
  assert.deepEqual(W.journalAsked('Dear diary, a long day'), { open: true, write: true, words: 'a long day' });
  assert.deepEqual(W.journalAsked('new journal entry'), { open: true, write: true });
  assert.deepEqual(W.journalAsked('open my journal'), { open: true });
  for (const no of ['show me my diary', 'what did I do yesterday?', 'remember I take my coffee black', 'journalism jobs near me']) assert.equal(W.journalAsked(no), null, no);
});

test('journal: three examples, a prompt list of twenty, five moods', () => {
  assert.equal(S.samples(noon).length, 3);
  assert.ok(S.samples(noon).every((x) => x.sample));
  assert.equal(W.PROMPTS.length, 20);
  assert.equal(new Set(W.PROMPTS).size, 20);
  assert.equal(W.J.MOODS.length, 5);
});

test('journal: nothing in its code reads a position or sends his words to the brain (only the nudge’s time and the saved places list)', () => {
  for (const f of ['index.ts', 'store.ts', 'words.ts', 'lock.ts']) {
    const src = readFileSync(at(`../../web/src/features/journal/${f}`), 'utf8');
    assert.ok(!/geolocation|getCurrentPosition|watchPosition/.test(src), `${f} reads a position`);
    assert.ok(!/brain\.(?:chat|send|remember|ask)\b|fetch\(/.test(src), `${f} sends something`);
  }
  const ui = readFileSync(at('../../web/src/features/journal/index.ts'), 'utf8');
  assert.equal((ui.match(/\bsend\(/g) ?? []).length, 1, 'one way out: his tap on ASK GHOSTY ABOUT IT');
  assert.match(ui, /const askKey = button\(J\.ASK_ME, async \(\) => \{[\s\S]{0,300}void send\(`About my journal entry/, 'the entry goes to the chat only from that key');
  assert.match(ui, /brain\.addJob\(\{ kind: 'reminder', title: 'Journal', text: 'A line in your journal\?'/, 'the nudge carries no words of his');
});

/** A JPEG's first bytes with an EXIF block holding only GPS (big-endian TIFF): lat/lon in degrees, minutes, seconds. */
function jpegWithGps(lat, lon) {
  const b = [];
  const u16 = (n) => b.push((n >> 8) & 255, n & 255);
  const u32 = (n) => b.push((n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  const dms = (d) => { const a = Math.abs(d); const D = Math.floor(a); const M = Math.floor((a - D) * 60); const S = Math.round(((a - D) * 60 - M) * 60 * 100); return [[D, 1], [M, 1], [S, 100]]; };
  // TIFF: header(8) IFD0 at 8: 1 entry (12) + next(4) = 18 → GPS IFD at 26: 4 entries (48) + next(4) = 54 → rationals at 80
  u16(0x4d4d); u16(42); u32(8);
  u16(1); u16(0x8825); u16(4); u32(1); u32(26); u32(0);
  u16(4);
  u16(1); u16(2); u32(2); b.push(lat < 0 ? 83 : 78, 0, 0, 0);
  u16(2); u16(5); u32(3); u32(80);
  u16(3); u16(2); u32(2); b.push(lon < 0 ? 87 : 69, 0, 0, 0);
  u16(4); u16(5); u32(3); u32(104);
  u32(0);
  for (const [n, d] of [...dms(lat), ...dms(lon)]) { u32(n); u32(d); }
  const tiff = b;
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xd9])]);
}

test('journal: a photo’s own place is read on the phone and only names the nearest saved place within 300 m', async () => {
  const g = await S.photoGps(jpegWithGps(52.4797, -1.9027));
  assert.ok(g && Math.abs(g.lat - 52.4797) < 1e-3 && Math.abs(g.lon + 1.9027) < 1e-3, JSON.stringify(g));
  const saved = [{ label: 'Home', lat: 52.4800, lon: -1.9030 }, { label: 'Work', lat: 52.5, lon: -1.85 }];
  assert.equal(S.nearestSaved(g, saved), 'Home');
  assert.equal(S.nearestSaved({ lat: 51.5, lon: -0.12 }, saved), null, 'far from every saved place: no place at all');
  assert.equal(await S.photoGps(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])])), null, 'not a JPEG');
  assert.equal(await S.photoGps(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])])), null, 'no EXIF');
  const ui = readFileSync(at('../../web/src/features/journal/index.ts'), 'utf8');
  // (the map pins SAVED places by their own coordinates; an entry never holds a position)
  assert.ok(!/\b(?:e|entry|was)\.(?:lat|lon)\b|\be\.(?:lat|lon)\s*=/.test(ui), 'the screen never writes a position into an entry');
  const store = readFileSync(at('../../web/src/features/journal/store.ts'), 'utf8');
  const entry = store.slice(store.indexOf('export interface Entry'), store.indexOf('export interface JournalPrefs'));
  assert.ok(!/^\s*(?:lat|lon|lng|gps|coords?|position)\??:/im.test(entry), 'an entry has no field for a position');
});

test('keep in touch: due words, the order (most over first) and the due count, from the dates he marked alone', async () => {
  const P = await import('./.build/journal/apps/web/src/features/people/touch.mjs').catch((e) => ({ err: e }));
  if (P.err) throw P.err;
  const now = noon;
  const jo = { id: 'a', name: 'Jo', every: 14, last: now - 20 * DAY };
  const sam = { id: 'b', name: 'Sam', every: 30, last: now - 26 * DAY };
  const kim = { id: 'c', name: 'Kim', every: 7, last: 0 };
  const al = { id: 'd', name: 'Al', every: 7, last: now - 7 * DAY };
  assert.equal(P.dueWords(jo, now), '6 days over');
  assert.equal(P.dueWords(sam, now), 'In 4 days');
  assert.equal(P.dueWords(kim, now), 'Due');
  assert.equal(P.dueWords(al, now), 'Due today');
  assert.equal(P.lastWords(jo, now), 'last caught up 20 days ago');
  assert.equal(P.lastWords(kim, now), 'not marked yet');
  assert.deepEqual(P.ordered([sam, kim, jo, al], now).map((p) => p.name), ['Jo', 'Kim', 'Al', 'Sam']);
  assert.equal(P.dueCount([sam, kim, jo, al], now), 3);
});

test('gifts: one step on each tap, spent per occasion (ideas cost nothing yet), thank-yous owed first, pounds from his words', async () => {
  const Gm = await import('./.build/journal/apps/web/src/features/people/gifts.mjs');
  const idea = { id: 'a', who: 'Jo', what: 'Gloves', occasion: 'Christmas', cost: 25, stage: 'idea', at: 1 };
  assert.equal(Gm.advance(idea).stage, 'bought');
  assert.equal(Gm.advance({ ...idea, stage: 'given' }).stage, 'given');
  const got = { id: 'b', who: 'Sam', what: 'Maps', occasion: '', cost: 0, stage: 'given', received: true, thanked: false, at: 2 };
  assert.equal(Gm.advance(got).thanked, true);
  const d = { gifts: [idea, { ...idea, id: 'c', stage: 'bought', cost: 30 }, { ...idea, id: 'e', stage: 'given', cost: 12.5, occasion: 'Birthday' }, got], budgets: { Christmas: 40, Wedding: 100 } };
  assert.deepEqual([...Gm.spent(d)].sort(), [['Birthday', 12.5], ['Christmas', 30], ['Wedding', 0]]);
  assert.deepEqual(Gm.giftOrder(d.gifts).map((g) => g.id), ['b', 'c', 'a', 'e']);
  assert.equal(Gm.pounds('£24.99'), 24.99);
  assert.equal(Gm.pounds('24,5'), 24.5);
  assert.equal(Gm.pounds('free'), 0);
});

test('vCards: his contacts file read (folded lines, N or FN, phones, emails, address, a birthday with or without a year), and written back', async () => {
  const V = await import('./.build/journal/apps/web/src/features/people/vcard.mjs');
  const vcf = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Patel;Priya;;;\r\nTEL;TYPE=CELL:07700 900123\r\nEMAIL;TYPE=HOME:priya@example.com\r\nADR;TYPE=HOME:;;12 Acacia\r\n  Avenue;Birmingham;;B13 9AA;UK\r\nBDAY:1984-06-12\r\nEND:VCARD\r\n'
    + 'BEGIN:VCARD\nVERSION:4.0\nFN:Sam O\\, Brien\nitem1.TEL:+44 7700 900456\nBDAY:--03-09\nNOTE:my cousin\nEND:VCARD\nBEGIN:VCARD\nVERSION:3.0\nTEL:123\nEND:VCARD\n';
  const cards = V.parseVcf(vcf);
  assert.equal(cards.length, 2, 'the card with no name is left out');
  assert.deepEqual(cards[0], { name: 'Priya Patel', phones: ['07700 900123'], emails: ['priya@example.com'], address: '12 Acacia Avenue, Birmingham, B13 9AA, UK', born: '1984-06-12', note: '' });
  assert.equal(cards[1].name, 'Sam O, Brien');
  assert.equal(cards[1].born, '--03-09');
  assert.equal(V.bornWords('1984-06-12'), '12 June 1984');
  assert.equal(V.bornWords('--03-09'), '9 March');
  assert.deepEqual(V.cardSays(cards[0]).map((x) => x.action), ['note', 'contact', 'contact', 'contact', 'birthday']);
  assert.equal(V.cardSays(cards[1])[0].args.words, 'Sam O, Brien my cousin');
  const out = V.writeVcf([{ name: 'Priya Patel', phone: '07700 900123', email: 'priya@example.com', address: '12 Acacia Avenue, Birmingham', born: '06-12', rel: 'friend' }]);
  assert.match(out, /^BEGIN:VCARD\r\nVERSION:3\.0\r\nFN:Priya Patel\r\nN:Patel;Priya;;;\r\nTEL;TYPE=CELL:07700 900123\r\nEMAIL:priya@example\.com\r\nADR;TYPE=HOME:;;12 Acacia Avenue\\, Birmingham;;;;\r\nBDAY:--06-12\r\nNOTE:friend\r\nEND:VCARD$/);
  const back = V.parseVcf(out)[0];
  assert.equal(back.name, 'Priya Patel');
  assert.equal(back.address, '12 Acacia Avenue, Birmingham');
});
