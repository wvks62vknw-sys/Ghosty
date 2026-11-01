// THE CREATIVE PACK (BRIEF-PACKS-2): a SONG whose tune and chords are made in code from his lyrics (the same seed, the same
// song; every note in the key; every line filling its bars), its WAV and MIDI files read back; chord progressions; a BEAT
// (presets, the grid as text, a tap landing on the nearest sixteenth, its sound and MIDI); names; rhymes (a real Datamuse
// response, and the short list when it does not answer); the day's drawing prompt; a story's bones and a poem's form checked;
// the POSTER's layout bounds, the card, the four-panel comic strip and the logo as shapes (all inside their pages); a palette
// from pixels; the tool and the phone's buttons. No network: the one request is answered from a real response saved here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundles, ctxOf, deps, fakeFetch, fixture, Mem, NOW } from './packs-kit.mjs';

const B = await bundles(['src/tools/creative.ts', 'src/packs/index.ts', '../../packages/shared/src/creative.ts', '../../packages/shared/src/creativeart.ts', '../../packages/shared/src/cards.ts']);
const T = B['src/tools/creative.ts'];
const P = B['src/packs/index.ts'];
const M = B['../../packages/shared/src/creative.ts'];
const A = B['../../packages/shared/src/creativeart.ts'];
const C = B['../../packages/shared/src/cards.ts'];

const run = (storage, action, a, fetch = fakeFetch({})) => T.CREATIVE[action](a, deps(storage, fetch, NOW));
const LYRICS = 'The kettle sings at half past six\nA grey sky leans against the glass\nI hum along to nothing much\nAnd let the Monday pass\n\n[Chorus]\nRain, rain on my window\nSlow, slow goes the day\nI will keep the lamp on\nAnd let the clouds drift away';
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PC = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

test('a song: a note for every syllable, every note in the key, every line filling its bars, the end of each section on the key’s note; the same seed always gives the same song', () => {
  const s = M.makeSong({ lyrics: LYRICS, key: 'D', mode: 'minor', tempo: 90, seed: 4821 });
  assert.deepEqual([s.key, s.mode, s.tempo, s.seed, s.lines.length], ['D', 'minor', 90, 4821, 8]);
  assert.deepEqual(s.lines.map((l) => l.section), ['verse', 'verse', 'verse', 'verse', 'chorus', 'chorus', 'chorus', 'chorus']);
  assert.equal(s.notes.length, s.lines.reduce((k, l) => k + l.syllables, 0), 'one note a syllable');
  const scale = new Set(MINOR.map((i) => (PC.D + i) % 12));
  for (const n of s.notes) assert.ok(scale.has(n.midi % 12) && n.midi >= 62 && n.midi <= 90, `${n.midi} is in D minor and in range`);
  for (const l of s.lines) {
    const mine = s.notes.filter((n) => n.start >= l.start && n.start < l.start + l.beats);
    assert.equal(mine.length, l.syllables);
    assert.ok(Math.abs(mine.reduce((k, n) => k + n.dur, 0) - l.beats) < 1e-9, `"${l.text}" fills exactly ${l.beats} beats`);
    assert.ok(mine.every((n) => n.dur >= 0.25 && n.dur * 4 === Math.round(n.dur * 4)), 'quarter-beat steps');
  }
  assert.equal(s.notes.at(-1).midi % 12, PC.D, 'the song ends on the key’s note');
  assert.equal(s.bars, s.lines.reduce((k, l) => k + l.beats, 0) / 4);
  assert.equal(s.chords.length, s.bars);
  // the same seed, the same song; another seed, another tune; another key, the same rhythm in new notes
  assert.deepEqual(M.makeSong({ lyrics: LYRICS, key: 'D', mode: 'minor', tempo: 90, seed: 4821 }), s);
  assert.notDeepEqual(M.makeSong({ lyrics: LYRICS, key: 'D', mode: 'minor', tempo: 90, seed: 4822 }).notes.map((n) => n.midi), s.notes.map((n) => n.midi));
  const c = M.makeSong({ lyrics: LYRICS, key: 'C', mode: 'major', tempo: 90, seed: 4821 });
  assert.deepEqual(c.notes.map((n) => n.dur), s.notes.map((n) => n.dur));
  assert.ok(c.notes.every((n) => new Set(MAJOR.map((i) => (PC.C + i) % 12)).has(n.midi % 12)));
  // blocks: blank lines and labels; one block of eight lines is cut into fours; more than sixteen lines are cut
  assert.deepEqual(M.lyricBlocks('a b\nc d\n\n[Bridge]\ne f').map((b) => [b.kind, b.lines.length]), [['verse', 2], ['bridge', 1]]);
  assert.equal(M.lyricBlocks(Array.from({ length: 8 }, (_, i) => `line number ${i}`).join('\n')).length, 2);
  assert.equal(M.lyricBlocks(Array.from({ length: 30 }, (_, i) => `line number ${i}`).join('\n\n')).reduce((k, b) => k + b.lines.length, 0), 16);
  assert.equal(M.makeSong({ lyrics: 'hi' }).notes.length, 1);
});

test('keys, tempos and moods in his words; the chords for a key, with their names and numerals', () => {
  assert.deepEqual(M.parseKey('a song in D minor'), { key: 'D', mode: 'minor' });
  assert.deepEqual(M.parseKey('key of F# major please'), { key: 'F#', mode: 'major' });
  assert.deepEqual(M.parseKey('play it in Bb'), { key: 'Bb', mode: 'major' });
  assert.deepEqual(M.parseKey('some chords in Am'), { key: 'A', mode: 'minor' });
  assert.equal(M.parseKey('a song about summer'), null);
  assert.equal(M.parseTempo('at 90 bpm'), 90);
  assert.equal(M.parseTempo('something slow'), 72);
  assert.equal(M.parseTempo('a fast one'), 126);
  assert.equal(M.parseTempo('a song about rain'), null);
  assert.equal(M.modeOf('a sad song'), 'minor');
  assert.equal(M.modeOf('a happy song'), 'major');
  const cs = M.chordBars('C', 'major', 0, 8);
  assert.deepEqual(cs.map((c) => c.name), ['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F']);
  assert.deepEqual(cs.slice(0, 4).map((c) => c.numeral), ['I', 'V', 'vi', 'IV']);
  assert.deepEqual(cs[0].notes, [48, 52, 55]);
  assert.deepEqual(M.chordBars('A', 'minor', 0, 4).map((c) => c.name), ['Am', 'F', 'C', 'G']);
  assert.equal(M.chordWords(M.makeChordLoop({ key: 'C', mode: 'major', seed: 0 })), 'C – G – Am – F  (I – V – vi – IV)');
});

test('the sound: a WAV with a real header, 16-bit mono, not silent, never clipping, the same bytes twice; a MIDI file that reads back to its notes', () => {
  const s = M.makeSong({ lyrics: LYRICS, key: 'G', mode: 'major', tempo: 100, seed: 7 });
  const pcm = M.renderSong(s, 11025);
  assert.ok(pcm.length >= Math.floor(s.beats * (60 / 100) * 11025), `${pcm.length} samples`);
  let peak = 0;
  let sum = 0;
  for (const x of pcm) (peak = Math.max(peak, Math.abs(x)), (sum += x * x));
  assert.ok(peak > 0.3 && peak <= 0.85 + 1e-6, `peak ${peak}`);
  assert.ok(Math.sqrt(sum / pcm.length) > 0.03, 'it is not silence');
  const wav = M.toWav(pcm, 11025);
  const dv = new DataView(wav.buffer);
  const tag = (o) => String.fromCharCode(...wav.slice(o, o + 4));
  assert.deepEqual([tag(0), tag(8), tag(12), tag(36)], ['RIFF', 'WAVE', 'fmt ', 'data']);
  assert.deepEqual([dv.getUint16(20, true), dv.getUint16(22, true), dv.getUint32(24, true), dv.getUint16(34, true)], [1, 1, 11025, 16]);
  assert.equal(dv.getUint32(40, true), pcm.length * 2);
  assert.equal(wav.length, 44 + pcm.length * 2);
  assert.deepEqual(M.toWav(M.renderSong(s, 11025), 11025), wav, 'the same song, the same bytes');
  assert.ok(M.renderSong(s, 11025, { chords: false }).length === pcm.length && M.renderSong(s, 11025, { melody: false }).some((x) => x !== 0));
  // MIDI: read the file back with a tiny reader
  const mid = M.toMidi(s);
  assert.equal(String.fromCharCode(...mid.slice(0, 4)), 'MThd');
  const d2 = new DataView(mid.buffer);
  assert.deepEqual([d2.getUint32(4), d2.getUint16(8), d2.getUint16(10), d2.getUint16(12)], [6, 1, 3, 480]);
  const tracks = [];
  for (let p = 14; p < mid.length; ) {
    assert.equal(String.fromCharCode(...mid.slice(p, p + 4)), 'MTrk');
    const len = d2.getUint32(p + 4);
    tracks.push(mid.slice(p + 8, p + 8 + len));
    p += 8 + len;
  }
  assert.equal(tracks.length, 3);
  const events = (t) => {
    const out = [];
    let i = 0;
    let tick = 0;
    let status = 0;
    while (i < t.length) {
      let dt = 0;
      while (t[i] & 0x80) dt = (dt << 7) | (t[i++] & 0x7f);
      dt = (dt << 7) | t[i++];
      tick += dt;
      if (t[i] === 0xff) {
        const len = t[i + 2];
        out.push({ tick, meta: t[i + 1], data: t.slice(i + 3, i + 3 + len) });
        i += 3 + len;
      } else {
        status = t[i] & 0x80 ? t[i++] : status;
        out.push({ tick, status, a: t[i], b: t[i + 1] });
        i += (status & 0xf0) === 0xc0 ? 1 : 2;
        if ((status & 0xf0) === 0xc0) out.at(-1).b = 0;
      }
    }
    return out;
  };
  const [e0, e1, e2] = tracks.map(events);
  const us = (e0.find((e) => e.meta === 0x51).data[0] << 16) | (e0.find((e) => e.meta === 0x51).data[1] << 8) | e0.find((e) => e.meta === 0x51).data[2];
  assert.equal(us, 600000, '100 bpm is 600,000 microseconds a beat');
  assert.equal(e0.at(-1).meta, 0x2f, 'each track ends');
  const on = e1.filter((e) => (e.status & 0xf0) === 0x90);
  assert.equal(on.length, s.notes.length);
  assert.deepEqual(on.map((e) => e.a), s.notes.map((n) => n.midi));
  assert.deepEqual(on.map((e) => e.tick), s.notes.map((n) => Math.round(n.start * 480)));
  assert.equal(e1.filter((e) => (e.status & 0xf0) === 0x80).length, s.notes.length);
  assert.equal(e2.filter((e) => (e.status & 0xf0) === 0x90).length, s.bars * 4, 'a triad and a bass note a bar');
});

test('a beat: seven styles on sixteen steps; the grid as text and back; a tap lands on the nearest sixteenth; its sound is not silent and repeats exactly; its MIDI uses the drum channel', () => {
  for (const name of M.BEAT_STYLES) {
    const b = M.beatFromWords(`a ${name} beat`);
    assert.equal(b.name, name);
    assert.ok(M.DRUMS.every((d) => b.rows[d].length === 16), `${name}: sixteen steps a row`);
    assert.ok(M.DRUMS.some((d) => b.rows[d].some(Boolean)));
  }
  assert.deepEqual([M.beatFromWords('a house beat at 124').name, M.beatFromWords('a house beat at 124').bpm, M.beatFromWords('four on the floor').bpm], ['house', 124, 124]);
  assert.equal(M.beatFromWords('boom bap 90 bpm').bpm, 90);
  const house = M.beatFromWords('house');
  assert.equal(M.beatGrid(house).split('\n')[0], 'kick  x...x...x...x...');
  assert.deepEqual(M.beatOfGrid(M.beatGrid(house), 124, 'house').rows, house.rows);
  assert.equal(M.beatOfGrid('kick x...\nsnare ....', 100), null);
  assert.equal(M.quantise(0, 120), 0);
  assert.equal(M.quantise(130, 120), 1, '120 bpm: a sixteenth is 125 ms');
  assert.equal(M.quantise(1990, 120), 0, 'a tap just before the bar line is the next bar’s first step');
  assert.equal(M.quantise(2000 + 260, 120), 2, 'into the second bar, the same');
  const pcm = M.renderBeat(house, 1, 22050);
  assert.equal(pcm.length, Math.ceil(16 * (60 / 124 / 4) * 22050));
  assert.ok(pcm.some((x) => Math.abs(x) > 0.2));
  assert.deepEqual(M.renderBeat(house, 1, 22050), pcm);
  assert.equal(M.renderBeat(M.emptyBeat(100), 1, 22050).every((x) => x === 0), true);
  const mid = M.beatToMidi(house, 2);
  assert.equal(String.fromCharCode(...mid.slice(0, 4)), 'MThd');
  const body = Array.from(mid);
  const hits = body.reduce((k, x, i) => k + (x === 0x99 && body[i + 2] === 100 ? 1 : 0), 0);
  assert.equal(hits, 2 * M.DRUMS.reduce((k, d) => k + house.rows[d].filter(Boolean).length, 0));
});

test('names: ten from word banks (the same words, the same ten), a theme and a letter respected, nothing rude', () => {
  const band = M.nameIdeas('band', 'with a space theme');
  assert.equal(band.length, 10);
  assert.equal(new Set(band).size, 10);
  assert.deepEqual(M.nameIdeas('band', 'with a space theme'), band);
  assert.notDeepEqual(M.nameIdeas('band', 'with a space theme', 1), band, 'more gives other names');
  assert.ok(band.some((n) => /Orbit|Nebula|Comet|Lunar|Rocket|Stardust/.test(n)), band.join(', '));
  assert.ok(M.nameIdeas('pet', 'for a puppy starting with B').every((n) => /^B/.test(n.replace(/^(Sir|Lady|Captain|Doctor|Professor|Duke|Baroness|Major) /, '')) || /^B/.test(n)), 'starting with B');
  assert.ok(M.nameIdeas('team', 'for my five-a-side').every((n) => /[A-Z]/.test(n)));
  for (const k of ['band', 'pet', 'team']) assert.ok(M.nameIdeas(k, 'anything').join(' ') && !/ass|sex|kill|hell/i.test(M.nameIdeas(k, 'anything').join(' ')));
});

test('rhyme: Datamuse’s public list (a real response saved here) grouped by syllables, phrases and the word itself left out; the short list when it does not answer; only the word is asked', async () => {
  const real = JSON.parse(fixture('datamuse-rhy-light.json'));
  const g = M.rhymesFrom(real, 'light');
  assert.deepEqual(g.map((x) => x.sy), [1, 2, 3]);
  assert.ok(g[0].words.includes('bright'));
  assert.ok(g[1].words.includes('delight') && !g.flatMap((x) => x.words).includes('black and white') && !g.flatMap((x) => x.words).includes('light'));
  assert.equal(M.rhymeUrl('Light'), 'https://api.datamuse.com/words?rel_rhy=light&max=60');
  assert.ok(M.offlineRhymes('light').includes('night') && !M.offlineRhymes('light').includes('light'));
  assert.deepEqual(M.offlineRhymes('zzzzz'), []);
  const seen = [];
  const out = await run(new Mem(), 'rhyme', { words: 'what rhymes with light?' }, fakeFetch({ 'https://api.datamuse.com/words?rel_rhy=light': fixture('datamuse-rhy-light.json') }, seen));
  assert.match(out.text, /^Rhymes with "light":\n- 1 syllable: .*bright.*\n- 2 syllables: .*delight/);
  assert.match(out.text, /From Datamuse's public word list; only the word is sent, nothing about you\.$/);
  assert.deepEqual(seen, ['https://api.datamuse.com/words?rel_rhy=light&max=60']);
  const down = await run(new Mem(), 'rhyme', { word: 'light' }, fakeFetch({}));
  assert.match(down.text, /^Rhymes with "light" \(the public rhyme list didn’t answer, so these are from my own short list\): .*night/);
  assert.match((await run(new Mem(), 'rhyme', { word: 'zzzzz' })).text, /^I couldn’t reach the public rhyme list just now/);
});

test('a drawing prompt a day: the same all day, a new one tomorrow, another on ask; and on in the Brief when he asks for one each day', async () => {
  assert.equal(M.drawingPrompt('2026-11-01'), M.drawingPrompt('2026-11-01'));
  assert.notEqual(M.drawingPrompt('2026-11-01'), M.drawingPrompt('2026-11-02'));
  assert.notEqual(M.drawingPrompt('2026-11-01', 1), M.drawingPrompt('2026-11-01'));
  assert.match(M.drawingPrompt('2026-11-01'), /^[A-Z].*\. .*\.$/);
  const storage = new Mem();
  const out = await run(storage, 'prompt', {});
  assert.equal(out.text, `Today's drawing prompt: ${M.drawingPrompt('2026-11-01')}\nSay "another" for a different one; the same prompt stays all day.`);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), [], 'off until he asks');
  assert.match((await run(storage, 'prompt', { words: 'a drawing prompt every day' })).text, /^From now on the Brief shows a drawing prompt each day\./);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), [`Drawing prompt: ${M.drawingPrompt('2026-11-01')}`]);
  assert.match((await run(storage, 'prompt', { words: 'stop the daily prompt' })).text, /off in your Brief/);
  assert.deepEqual(await P.packLines({ storage, now: () => NOW }), []);
});

test('a story’s bones and a poem’s rules: the same words give the same seed; a haiku’s syllables, a limerick’s rhymes, couplets and an acrostic checked in plain words', () => {
  assert.deepEqual(M.storySeed('a night bus', 0), M.storySeed('a night bus', 0));
  assert.notDeepEqual(M.storySeed('a night bus', 1), M.storySeed('a night bus', 0));
  assert.deepEqual([M.storySeed('a flash story').words, M.storySeed('a story').words, M.storySeed('a long story').words], [150, 400, 900]);
  assert.equal(M.poemForm('write a haiku about autumn'), 'haiku');
  assert.equal(M.poemForm('something funny'), 'limerick');
  assert.equal(M.poemForm('a poem about the sea'), 'free');
  assert.deepEqual(M.checkPoem('haiku', 'An old silent pond\nA frog jumps into the pond\nSplash silence again'), []);
  assert.match(M.checkPoem('haiku', 'Autumn\nleaves fall down')[0], /a haiku has 3 lines/);
  assert.match(M.checkPoem('haiku', 'one two three four five six\nonly four words here\nfive five five')[0], /line 1 has about 6 syllables, not 5/);
  assert.deepEqual(M.checkPoem('limerick', 'There was an old man from the east\nWho feasted at every feast\nHe ate all the cake\nFor goodness’ sake\nAnd laughed as he grew very least'), []);
  assert.deepEqual(M.checkPoem('limerick', 'a\nb\nc\nd\ne'), ['lines 1, 2 and 5 should rhyme', 'lines 3 and 4 should rhyme with each other']);
  assert.deepEqual(M.checkPoem('couplets', 'The sun is bright\nIt shines all night\nThe grass is green\nA sight to be seen\nOne more line'), ['couplets come in pairs: you have an odd line out']);
  assert.deepEqual(M.checkPoem('couplets', 'The sun is bright\nThe grass is green'), ['lines 1 and 2 don’t rhyme']);
  assert.deepEqual(M.checkPoem('acrostic', 'Calm waters\nAll around\nTides turn', 'CAT'), []);
  assert.deepEqual(M.checkPoem('acrostic', 'Calm waters\nBig skies', 'CAT'), ['CAT needs 3 lines (you have 2)', 'line 2 should start with A']);
  assert.equal(M.acrostic('cat'), 'C …\nA …\nT …');
});

/** The box a text prim occupies, and the margins a poster keeps. */
const inside = (boxes, w, h, m) => boxes.every((b) => b.x0 >= m - 0.5 && b.x1 <= w - m + 0.5 && b.y0 >= m - 0.5 && b.y1 <= h - m + 0.5);
const apart = (boxes) => {
  const s = [...boxes].sort((a, b) => a.y0 - b.y0);
  return s.every((b, i) => i === 0 || b.y0 >= s[i - 1].y1 - 1);
};
test('a poster: every line of text inside the margins and above the next, however long the title; the title as large as fits; six looks that can all be read', () => {
  const titles = ['Birthday', 'SAM’S 40TH BIRTHDAY PARTY', 'Annual summer fete and charity bake sale at the village hall', 'Supercalifragilisticexpialidocious Weekend Festival', 'x'];
  for (const [i, title] of titles.entries()) {
    const r = A.posterPrims({ title, subtitle: 'Sat 14 Nov · 7pm', lines: ['The Crown, 12 High Street', 'Bring a dish to share', 'Free parking round the back'], theme: Object.keys(A.THEMES)[i % 6] });
    const boxes = A.textBoxes(r.prims);
    assert.ok(boxes.length >= 3, title);
    assert.ok(inside(boxes, r.w, r.h, 84), `${title}: inside the margins\n${boxes.filter((b) => b.x0 < 83 || b.x1 > r.w - 83 || b.y1 > r.h - 83).map((b) => JSON.stringify(b)).join('\n')}`);
    assert.ok(apart(boxes), `${title}: no line on another`);
  }
  const big = A.posterPrims({ title: 'Jam' }).prims.find((p) => p.t === 'text');
  const small = A.posterPrims({ title: 'The annual general meeting of the allotment society' }).prims.find((p) => p.t === 'text');
  assert.ok(big.size === 200 && small.size < 130, `${big.size} then ${small.size}`);
  for (const [name, th] of Object.entries(A.THEMES)) {
    assert.ok(A.contrast(th.fg, th.bg) >= 4.5, `${name}: text on the page ${A.contrast(th.fg, th.bg)}`);
    assert.ok(A.contrast(th.accent, th.bg) >= 3, `${name}: the day and time ${A.contrast(th.accent, th.bg)}`);
  }
  assert.equal(A.contrast('#000000', '#ffffff'), 21);
  const f = A.posterFields('birthday party for Sam, at the village hall, bring a dish', 'Sat 14 Nov · 7pm');
  assert.deepEqual(f, { title: 'birthday party for Sam', subtitle: 'Sat 14 Nov · 7pm', lines: ['The village hall', 'bring a dish'], theme: 'party' });
  const svg = A.primsToSvg(A.posterPrims({ title: 'Fish & Chips <night>' }).prims, 1080, 1528, '#fff');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 1080 1528"/);
  assert.ok(svg.includes('FISH &amp;') && svg.includes('&lt;NIGHT&gt;') && !svg.includes('<NIGHT>'), 'escaped');
});

const bounds = (prims, measure = A.approxMeasure) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => ((x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
  for (const p of prims) {
    if (p.t === 'rect') (add(p.x, p.y), add(p.x + p.w, p.y + p.h));
    else if (p.t === 'circle') (add(p.x - p.r, p.y - p.r), add(p.x + p.r, p.y + p.r));
    else if (p.t === 'line') (add(p.x1, p.y1), add(p.x2, p.y2));
    else if (p.t === 'poly') p.pts.forEach(([x, y]) => add(x, y));
    else if (p.t === 'arc') (add(p.x - p.r, p.y - p.r), add(p.x + p.r, p.y + p.r));
    else for (const b of A.textBoxes([p], measure)) (add(b.x0, b.y0), add(b.x1, b.y1));
  }
  return { x0, y0, x1, y1 };
};
test('a birthday card: the front (balloons, confetti, the name, an age star only when there is one) and the inside (his words, centred) stay on the page', () => {
  const front = A.cardPrims({ name: 'Samantha-Jane', age: 40, side: 'front' });
  assert.ok(front.prims.filter((p) => p.t === 'circle').length >= 10, 'balloons and confetti');
  const ft = A.textBoxes(front.prims);
  assert.deepEqual(ft.map((b) => b.text), ['HAPPY BIRTHDAY', 'SAMANTHA-JANE', '40']);
  assert.ok(inside(ft, front.w, front.h, 60) && apart(ft));
  assert.ok(!A.textBoxes(A.cardPrims({ name: 'Dad', side: 'front' }).prims).some((b) => /^\d+$/.test(b.text)), 'no age, no star');
  const msg = 'Happy birthday, Dad! Hope today is a really good one, and a very happy 70. Thinking of you. Love from all of us, and the dog.';
  const inn = A.cardPrims({ name: 'Dad', message: msg, side: 'inside' });
  const it = A.textBoxes(inn.prims);
  assert.ok(it.length >= 3 && inside(it, inn.w, inn.h, 100) && apart(it));
  assert.equal(it.map((b) => b.text).join(' '), msg);
  assert.deepEqual(A.cardPrims({ name: 'Dad', side: 'front', seed: 5 }), A.cardPrims({ name: 'Dad', side: 'front', seed: 5 }));
});

test('a comic strip: a story cut into four captions; the face each caption calls for; four panels of stick figures, every shape and every caption on the page; ours, said to be', () => {
  assert.deepEqual(A.splitStory('A cat sits at the window. Then a bird lands. The cat plans something. It is much too slow.'), ['A cat sits at the window.', 'Then a bird lands.', 'The cat plans something.', 'It is much too slow.']);
  assert.equal(A.splitStory('I woke up late and then missed the bus but a stranger gave me a lift so I arrived on time').length, 4);
  assert.equal(A.splitStory('One thing. Two things. Three things. Four things. Five things. Six things.').length, 4);
  assert.deepEqual(A.splitStory('Just one thing happened.'), ['Just one thing happened.', '…', '…', 'The end.']);
  const faces = { 'I am so angry!': 'angry', 'Oh no, I lost it, I am sad': 'sad', 'Wow, a huge dragon!!': 'surprised', 'Hmm, why is it here?': 'thinking', 'We laughed so much, haha': 'laugh', 'Lovely day at the park': 'happy' };
  for (const [text, face] of Object.entries(faces)) assert.equal(A.expressionOf(text), face, text);
  assert.deepEqual(['Midnight stroll', 'It rained all day', 'In the kitchen at home', 'A walk in the park'].map(A.sceneOf), ['night', 'rain', 'indoor', 'day']);
  const caps = ['Sam drives to the party', 'Oh no, the cake is lost, so sad', 'A huge surprise, wow!!', 'Everyone laughs, haha'];
  const r = A.comicPrims(caps, ['Sam', 'Ali'], 3);
  const b = bounds(r.prims);
  assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= r.w && b.y1 <= r.h, JSON.stringify([b, r.w, r.h]));
  const texts = r.prims.filter((p) => p.t === 'text').map((p) => p.text);
  assert.ok(caps.every((c) => texts.join(' ').includes(c.split(' ').slice(0, 3).join(' '))), 'every caption is on the page');
  assert.ok(texts.includes('Sam') && texts.includes('Ali'), 'the names under their feet');
  assert.ok(texts.some((t) => /Drawn by Ghosty in code: stick figures and shapes, not anyone’s art\./.test(t)), 'said to be ours');
  // each panel has a head with two eyes and a mouth for its expression: the sad panel has a frown arc (its angles above π)
  const arcs = r.prims.filter((p) => p.t === 'arc');
  assert.ok(arcs.some((p) => p.a0 > Math.PI), 'a frown');
  assert.ok(arcs.some((p) => p.a0 < Math.PI / 2), 'a smile');
  assert.ok(r.prims.filter((p) => p.t === 'circle' && p.r > 25 && p.fill === '#ffffff').length >= 8, 'heads: two figures in each of four panels');
  assert.deepEqual(A.comicPrims(caps, ['Sam', 'Ali'], 3), r, 'the same strip again');
  const svg = A.primsToSvg(r.prims, r.w, r.h);
  assert.ok(svg.length > 2000 && svg.includes('Drawn by Ghosty in code'));
});

test('a logo: a shape, an icon and the name in colours that fit the feel; every shape and the name on the page, an SVG that names it; another look on ask', () => {
  assert.deepEqual(A.logoSpec('Harbour Bakery', 'calm'), { name: 'Harbour Bakery', shape: 'circle', icon: 'wave', colours: ['#0f4c81', '#e0f2fe', '#38bdf8'] });
  assert.equal(A.logoSpec('Gym Co', 'bold and strong').icon, 'bolt');
  assert.equal(A.logoSpec('Leaf', 'nature').icon, 'leaf');
  assert.deepEqual(A.logoSpec('Harbour Bakery', 'calm'), A.logoSpec('Harbour Bakery', 'calm'));
  assert.notEqual(A.logoSpec('Harbour Bakery', 'calm', 3).shape + '-', A.logoSpec('Harbour Bakery', 'calm', 0).shape + '-' + 'x');
  for (const vibe of ['calm', 'bold', 'nature', 'playful', 'premium', 'tech', 'love', 'outdoor', 'sun', '']) {
    const spec = A.logoSpec('A Very Long Business Name', vibe);
    const r = A.logoPrims(spec);
    const bb = bounds(r.prims);
    assert.ok(bb.x0 >= 0 && bb.y0 >= 0 && bb.x1 <= r.w && bb.y1 <= r.h, `${vibe}: ${JSON.stringify(bb)}`);
    assert.ok(A.textBoxes(r.prims).some((t) => t.text === 'A VERY LONG BUSINESS NAME' && t.x1 - t.x0 <= r.w * 0.85), vibe);
    assert.ok(A.contrast(spec.colours[0], spec.colours[1]) >= 4.5, `${vibe}: the shape on the page`);
  }
  const svg = A.primsToSvg(A.logoPrims(A.logoSpec('Fish & Co', 'calm')).prims, 1000, 1000, '#e0f2fe');
  assert.match(svg, /FISH &amp; CO/);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
});

test('a palette: the main colours of a picture’s pixels, biggest first, with names; the same pixels, the same palette; a colour he names finds its opposite and neighbours', () => {
  const px = [];
  const put = (n, r, g, b) => { for (let i = 0; i < n; i++) px.push(r + (i % 5), g + (i % 3), b, 255); };
  put(600, 200, 30, 40);
  put(300, 20, 60, 190);
  put(100, 245, 245, 240);
  const rgba = Uint8ClampedArray.from(px);
  const sw = A.paletteOf(rgba, 5);
  assert.equal(sw.length, 3, 'three distinct colours, near-duplicates merged');
  assert.deepEqual(sw.map((s) => s.share), [60, 30, 10]);
  assert.match(sw[0].hex, /^#c[0-9a-f]/);
  assert.deepEqual(sw.map((s) => s.name), ['Red', 'Navy', 'White']);
  assert.deepEqual(sw.map((s) => s.on), ['#ffffff', '#ffffff', '#000000']);
  assert.deepEqual(A.paletteOf(rgba, 5), sw);
  assert.deepEqual(A.paletteOf(new Uint8ClampedArray(0)), []);
  assert.deepEqual(A.paletteOf(Uint8ClampedArray.from([10, 20, 30, 0, 10, 20, 30, 0])), [], 'transparent pixels do not count');
  assert.equal(A.colourIn('colours that go with #3A7BD5'), '#3a7bd5');
  assert.equal(A.colourIn('#f80'), '#ff8800');
  assert.equal(A.colourIn('rgb(0, 128, 255)'), '#0080ff');
  assert.equal(A.colourIn('something teal'), '#0d9488');
  assert.equal(A.colourIn('no colour here'), null);
  assert.equal(A.harmony('#ff0000').complement[0], '#00ffff');
  assert.deepEqual(A.harmony('#ff0000').triad, ['#00ff00', '#0000ff']);
  assert.equal(A.hexOf(255, 0, 128.4), '#ff0080');
  assert.equal(A.colourName('#ff0000'), 'Red');
});

test('the tool: one action enum; the song asks the model for lyrics, then plays; a poster, a comic, a card, a logo, a palette and a beat open on the phone; reads work from a scheduled task, writes wait for him', async () => {
  const tool = T.creativeTools[0];
  assert.equal(tool.name, 'creative');
  assert.deepEqual(tool.parameters.properties.action.enum, ['song', 'story', 'poem', 'poster', 'comic', 'birthday', 'names', 'rhyme', 'palette', 'logo', 'prompt', 'beat', 'chords']);
  assert.ok(tool.description.length <= 1800, `${tool.description.length}`);
  assert.ok(T.CREATIVE_ABOUT.length <= 220 && /^You can/.test(T.CREATIVE_ABOUT), `${T.CREATIVE_ABOUT.length}`);
  for (const a of tool.parameters.properties.action.enum) assert.match(T.CREATIVE_ABOUT, new RegExp(`\\b${a}\\b`));
  const storage = new Mem();
  // a song with no lyrics: the brief for the model (nothing kept, nothing opened)
  const brief = await run(storage, 'song', { words: 'write me a song about a rainy Monday' });
  assert.match(brief.text, /^To make the song, write ORIGINAL lyrics now \(never a real song's words\): 8 to 16 short lines of 6 to 10 syllables.*about a rainy Monday\. Then call creative song again with lyrics= those lines\./);
  assert.equal(brief.open, undefined);
  // with lyrics: the song opens on the phone with its parameters; the same ones rebuild the same song there
  const out = await run(storage, 'song', { words: 'a sad song about a rainy Monday, slow', lyrics: LYRICS, seed: 99 });
  assert.equal(out.open.name, 'open_creative');
  assert.equal(out.open.args.what, 'song');
  assert.deepEqual([out.open.args.mode, out.open.args.tempo, out.open.args.seed], ['minor', 72, 99]);
  assert.match(out.text, /^“The kettle sings”: [A-G][b#]? minor, 72 bpm, 8 lines over \d+ bars \(about \d+ seconds\)\. Chords: .* The tune and chords are made by code/);
  const rebuilt = M.makeSong({ lyrics: out.open.args.lyrics, key: out.open.args.key, mode: out.open.args.mode, tempo: out.open.args.tempo, seed: out.open.args.seed, title: out.open.args.title });
  assert.equal(rebuilt.title, 'The kettle sings');
  assert.equal(out.data.lines, 8);
  assert.match((await run(storage, 'song', { words: 'play my last song' })).text, /^Your last song, “The kettle sings”, is open on your phone: /);
  assert.match((await run(storage, 'song', { lyrics: 'one', words: 'x' })).text, /^To make the song/);
  assert.match((await run(storage, 'song', { lyrics: 'oh\nno', words: 'x' })).text, /^Those lines are too short to sing/);
  // chords
  const ch = await run(storage, 'chords', { words: 'chords in D minor, slower' });
  assert.match(ch.text, /^Chords in D minor: [A-G][b#]?m? – .*, four beats each.* Try the strum [DU–]/);
  assert.equal(ch.open.args.lyrics, '');
  // story and poem: the model's briefs, in his voice
  await storage.put('people:voice', ['hey mate, hope your week is going well, cheers']);
  const st = await run(storage, 'story', { words: 'a short story about a night-bus driver' });
  assert.match(st.text, /^Write the story now, about 400 words.*\n- hero: .*\n- place: .*\n- wants: .*\n- in the way: .*\n- the turn: .*\n- ending: .*\nIn his voice: .*opens “hey”.*Original characters and plot only: nothing from an existing book, film or song\. Show it to him; nothing is sent/);
  assert.match((await run(storage, 'poem', { words: 'write a haiku about autumn' })).text, /^Write the haiku now about autumn\. The form: Three lines of 5, 7 and 5 syllables/);
  assert.match((await run(storage, 'poem', { words: 'a limerick', text: 'a\nb\nc\nd\ne' })).text, /^As a limerick, it needs a little work: lines 1, 2 and 5 should rhyme/);
  const lim = await run(storage, 'poem', { words: 'a limerick about light', form: 'limerick' }, fakeFetch({ 'https://api.datamuse.com/words?rel_rhy=light': fixture('datamuse-rhy-light.json') }));
  assert.match(lim.text, /Rhymes for "light" if they help: .*bright/);
  // a poster from his words, with the day and the time
  const po = await run(storage, 'poster', { words: 'birthday party for Sam, Saturday 14 November at 7pm at the village hall, bring a dish' });
  assert.equal(po.open.args.what, 'poster');
  assert.deepEqual([po.open.args.title, po.open.args.subtitle, po.open.args.theme], ['birthday party for Sam', 'Sat 14 Nov · 7pm', 'party']);
  assert.deepEqual(po.open.args.lines, ['The village hall', 'bring a dish']);
  assert.ok(A.textBoxes(A.posterPrims(po.open.args).prims).length >= 4);
  // a comic: four captions from his sentence, or the four he gave
  const co = await run(storage, 'comic', { words: 'a comic about a cat. The cat sits at the window. Then a bird lands. The cat plans something. It is much too slow.', names: ['Tom'] });
  assert.equal(co.open.args.captions.length, 4);
  assert.deepEqual(co.open.args.names, ['Tom']);
  assert.match(co.text, /Stick figures and shapes drawn by Ghosty in code, with the face each caption calls for: it is our own art, not anyone's\./);
  assert.deepEqual((await run(storage, 'comic', { captions: ['one', 'two', 'three', 'four'] })).open.args.captions, ['one', 'two', 'three', 'four']);
  // a birthday card
  const bd = await run(storage, 'birthday', { words: 'a funny birthday card for Dad, he is 70' });
  assert.equal(bd.open.args.name, 'Dad');
  assert.equal(bd.open.args.age, 70);
  assert.match(bd.open.args.message, /70 candles is a fire hazard/);
  // names, logo, palette
  assert.match((await run(storage, 'names', { words: 'band names with a space theme' })).text, /^Ten band names:\n1\. /);
  assert.equal((await run(storage, 'names', { words: 'a name for my puppy' })).data.kind, 'pet');
  const lg = await run(storage, 'logo', { words: 'a calm logo for Harbour Bakery' });
  assert.deepEqual([lg.open.args.name, lg.data.spec.icon], ['Harbour Bakery', 'wave']);
  assert.match((await run(storage, 'logo', { words: 'a logo' })).text, /^What is the name/);
  const pal = await run(storage, 'palette', { words: 'colours that go with #3a7bd5' });
  assert.equal(pal.open.args.colours[0], '#3a7bd5');
  assert.ok(pal.open.args.colours.length >= 8);
  assert.match(pal.text, /^Colours that go with #3a7bd5 \(Blue\), by the rules of the colour wheel:/);
  assert.deepEqual((await run(storage, 'palette', {})).open.args.colours, []);
  // a beat: from his words, kept from its grid, listed, opened by name
  const bt = await run(storage, 'beat', { words: 'a house beat at 124' });
  assert.equal(bt.open.args.beat.bpm, 124);
  assert.match(bt.text, /^A house beat at 124 bpm, open as pads on your phone/);
  const kept = await run(storage, 'beat', { grid: M.beatGrid(M.beatFromWords('trap')), bpm: 140, name: 'my trap' });
  assert.match(kept.text, /^Kept “my trap” at 140 bpm\./);
  assert.match((await run(storage, 'beat', { words: 'my beats' })).text, /^Your beats: my trap \(140 bpm\)/);
  assert.equal((await run(storage, 'beat', { words: 'open my trap beat' })).open.args.beat.name, 'my trap');
  assert.match((await run(storage, 'beat', { grid: 'kick x', bpm: 100 })).text, /isn’t four rows of sixteen steps/);
  // the tool: cards, scheduled tasks, unknown actions
  const { ctx, events } = ctxOf(new Mem());
  const result = await tool.run({ action: 'poster', words: 'jam night, Friday at 8pm' }, ctx);
  assert.match(result, /^Your poster, laid out on your phone/);
  assert.equal(events.find((e) => e.t === 'client').name, 'open_creative');
  await assert.rejects(tool.run({ action: 'forge' }, ctx), /creative has no action "forge"/);
  const away = { ...ctx, unattended: true };
  assert.match(await tool.run({ action: 'names', words: 'a band name' }, away), /^Ten band names/);
  await assert.rejects(tool.run({ action: 'song', lyrics: LYRICS }, away), /creative song changes what he keeps, so it waits for him/);
  await assert.rejects(tool.run({ action: 'beat', words: 'a beat' }, away), /waits for him/);
  assert.equal(tool.pure({ action: 'rhyme' }), true);
  assert.equal(tool.pure({ action: 'prompt' }), false);
  for (const t of ['hello', 'thanks', 'how are you', 'what time is it', 'remind me at 5pm', 'play some music', 'what is the weather']) assert.ok(!T.CREATIVE_WHEN.test(t), `"${t}" leaves the creative pack off`);
  for (const t of ['write me a song about rain', 'a haiku about autumn', 'make a poster for the fete', 'a comic about my cat', 'a birthday card for dad', 'what rhymes with light', 'band names for us', 'a drawing prompt', 'make a beat', 'a palette from my photo', 'chords in d minor', 'design a logo for my shop']) assert.ok(T.CREATIVE_WHEN.test(t), `"${t}" turns it on`);
});

test('the phone’s buttons: POST /packs/do runs a creative action with no model (a beat kept from the pads, a name list); the phone’s own asks are recognised; anything else is refused', async () => {
  const storage = new Mem();
  const call = (body) => P.packsRoute(new Request('https://g/api/packs/do', { method: 'POST', body: JSON.stringify(body) }), '/packs/do', 'POST', { storage, notify: async () => undefined, now: () => NOW, fetch: fakeFetch({}) }).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  const r = await call({ pack: 'creative', action: 'beat', args: { grid: M.beatGrid(M.beatFromWords('funk')), bpm: 100, name: 'my funk' } });
  assert.equal(r.status, 200);
  assert.match(r.text, /^Kept “my funk” at 100 bpm\./);
  assert.match((await call({ pack: 'creative', action: 'names', args: { words: 'a team name' } })).text, /^Ten team names/);
  assert.equal((await call({ pack: 'creative', action: 'steal' })).status, 400);
  for (const t of ['make a beat', 'Open the drum pads', 'give me a house beat at 124', 'start a hip hop beat']) assert.ok(M.BEAT_ASK.test(t), t);
  for (const t of ['play the song beat it', 'play a track by beat happening', 'what is the beat of my heart song', 'beat the traffic']) assert.ok(!M.BEAT_ASK.test(t), t);
  for (const t of ['a drawing prompt', 'give me a drawing prompt', 'what should I draw', 'something to draw']) assert.ok(M.DRAW_ASK.test(t), t);
  assert.ok(!M.DRAW_ASK.test('draw me a dragon'));
  assert.match(C.cardsFromTool({ name: 'creative', args: {}, result: 'x', shown: [{ name: 'pack_card', args: { card: { id: 'c', kind: 'brief', title: 't', line: 'l' } } }] })[0].id, /^c$/);
});
