/**
 * THE CREATIVE PACK on the phone (BRIEF-PACKS-2): a sheet over whatever is showing (the open_creative command; the chat's
 * "make a beat"). SONG: his lyrics with a tune and chords made in code (packages/shared/src/creative.ts), played by a synth
 * written there through the phone's audio — started by his tap — and saved as a WAV or a MIDI file; POSTER, BIRTHDAY CARD,
 * COMIC STRIP and LOGO: pages laid out in code (creativeart.ts) and drawn on a canvas in the vendored Oswald face, saved as
 * a PNG (the logo as an SVG too); PALETTE: the main colours of a photo, found on the phone (the photo is never uploaded); BEAT:
 * drum pads he taps along with a loop. Everything is saved to his own downloads on his tap; nothing is sent anywhere.
 * The state sits on window.__ghosty.creative for the specs.
 */
import { BEAT_STYLES, beatFromWords, beatGrid, beatToMidi, chordWords, DRUMS, emptyBeat, hashSeed, KEY_NAMES, makeChordLoop, makeSong, quantise, renderBeat, renderSong, toMidi, toWav, type Beat, type Drum, type Mode, type Song } from '../../../../../packages/shared/src/creative';
import { CARD_H, CARD_W, cardPrims, colourName, COMIC_H, COMIC_W, comicPrims, contrast, logoPrims, logoSpec, paletteOf, POSTER_H, POSTER_W, posterPrims, primsToSvg, splitStory, THEMES, themeFor, type Swatch, type ThemeName } from '../../../../../packages/shared/src/creativeart';
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { brain } from '../../api/brain';
import { canvasOf, drawPrims, loadFont, measureBody, measureOn, pngOf, saveFile, saved } from './draw';

export type CreativeWhat = 'song' | 'poster' | 'birthday' | 'comic' | 'logo' | 'palette' | 'beat';
const TITLES: Record<CreativeWhat, string> = { song: 'YOUR SONG', poster: 'POSTER', birthday: 'BIRTHDAY CARD', comic: 'COMIC STRIP', logo: 'LOGO SKETCH', palette: 'PALETTE', beat: 'DRUM PADS' };

export const creativeState = {
  open: '' as '' | CreativeWhat,
  audio: '',
  playing: false,
  font: false,
  song: { title: '', key: '', mode: '', tempo: 0, seed: 0, bars: 0, notes: 0, chords: '', line: -1, played: 0 },
  poster: { title: '', theme: '', lines: 0, w: 0, h: 0, drawn: 0, maxX: 0 },
  card: { side: '', drawn: 0 },
  comic: { captions: [] as string[], drawn: 0, w: 0, h: 0 },
  logo: { name: '', icon: '', drawn: 0 },
  palette: { swatches: [] as { hex: string; name: string; share: number }[], from: '' },
  beat: { bpm: 0, hits: 0, playing: false, grid: '', taps: 0 },
  saved,
  error: '',
};

interface Screen {
  el: HTMLElement;
  stop(): void;
}
let opened: { close(): void } | null = null;
let stopNow: (() => void) | null = null;

export async function openCreative(what: string, args: Record<string, unknown> = {}): Promise<void> {
  const w = (Object.keys(TITLES) as CreativeWhat[]).includes(what as CreativeWhat) ? (what as CreativeWhat) : 'song';
  opened?.close();
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.creative = creativeState;
  creativeState.error = '';
  let s: Screen;
  try {
    s = w === 'song' ? songScreen(args) : w === 'poster' ? posterScreen(args) : w === 'birthday' ? cardScreen(args) : w === 'comic' ? comicScreen(args) : w === 'logo' ? logoScreen(args) : w === 'palette' ? paletteScreen(args) : beatScreen(args);
  } catch (e) {
    creativeState.error = (e as Error).message;
    toast(`That screen didn’t open: ${(e as Error).message}`, 'warn');
    return;
  }
  creativeState.open = w;
  stopNow = s.stop;
  opened = modal(TITLES[w], h('div.pk', { dataset: { pack: 'creative', screen: w } }, s.el), () => {
    stopNow?.();
    stopNow = null;
    opened = null;
    creativeState.open = '';
  });
}

// ---------------------------------------------------------------- the phone's audio, started by his tap

let actx: AudioContext | null = null;
function audio(): AudioContext {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  actx ??= new AC();
  actx.onstatechange = () => (creativeState.audio = actx!.state);
  void actx.resume().catch(() => undefined);
  creativeState.audio = actx.state;
  return actx;
}
const bufferOf = (ctx: AudioContext, samples: Float32Array, rate: number): AudioBuffer => {
  const b = ctx.createBuffer(1, samples.length, rate);
  b.getChannelData(0).set(samples);
  return b;
};
const RATE = 22050;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'ghosty';
function field(label: string, el: HTMLElement): HTMLElement {
  el.setAttribute('aria-label', label);
  return h('label.pkfield', h('span.pklab', label), el);
}
function selectOf(options: readonly string[], value: string): HTMLSelectElement {
  const s = h('select') as HTMLSelectElement;
  for (const o of options) s.append(h('option', { value: o }, o));
  s.value = value;
  return s;
}

// ---------------------------------------------------------------- SONG

function songScreen(a: Record<string, unknown>): Screen {
  let src: AudioBufferSourceNode | null = null;
  let timer = 0;
  let t0 = 0;
  let seed = (Number(a.seed) || 0) >>> 0;
  const lyrics = h('textarea.pkpaste', { rows: 6, value: String(a.lyrics ?? ''), placeholder: 'The words of your song, a line each; a blank line between verses.' }) as HTMLTextAreaElement;
  const key = selectOf(KEY_NAMES, KEY_NAMES.includes(String(a.key) as (typeof KEY_NAMES)[number]) ? String(a.key) : 'C');
  const mode = selectOf(['major', 'minor'], a.mode === 'minor' ? 'minor' : 'major');
  const tempo = h('input', { type: 'range', min: 50, max: 170, value: String(Math.min(170, Math.max(50, Number(a.tempo) || 100))) }) as HTMLInputElement;
  const tempoLab = h('span.pklab');
  const info = h('p.pkcue', { 'aria-live': 'polite' });
  const list = h('ol.pklist', { 'aria-label': 'The lines of the song' });
  let song: Song;
  const build = (): Song => (lyrics.value.trim() ? makeSong({ lyrics: lyrics.value, key: key.value, mode: mode.value as Mode, tempo: +tempo.value, seed: seed || hashSeed(lyrics.value), ...(a.title ? { title: String(a.title) } : {}) }) : makeChordLoop({ key: key.value, mode: mode.value as Mode, tempo: +tempo.value, seed: seed || 1 }));
  const stop = () => {
    clearInterval(timer);
    timer = 0;
    try {
      src?.stop();
    } catch {
      /* already stopped */
    }
    src = null;
    creativeState.playing = false;
    creativeState.song.line = -1;
    list.querySelectorAll('li.on').forEach((l) => l.classList.remove('on'));
  };
  const refresh = () => {
    stop();
    song = build();
    tempoLab.textContent = `${tempo.value} beats a minute`;
    info.textContent = `${song.title}: ${song.key} ${song.mode}, ${song.bars} bars, about ${Math.round((song.beats * 60) / song.tempo)} seconds. Chords: ${chordWords(song)}`;
    list.replaceChildren(...(song.lines.length ? song.lines.map((l) => h('li', l.text)) : [h('li', 'No words: a chord loop with a simple tune')]));
    Object.assign(creativeState.song, { title: song.title, key: song.key, mode: song.mode, tempo: song.tempo, seed: song.seed, bars: song.bars, notes: song.notes.length, chords: chordWords(song) });
  };
  const play = async () => {
    stop();
    try {
      const ctx = audio();
      const buf = bufferOf(ctx, renderSong(song, RATE), RATE);
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => stop();
      t0 = ctx.currentTime;
      src.start();
      creativeState.playing = true;
      creativeState.song.played++;
      timer = window.setInterval(() => {
        const beat = ((ctx.currentTime - t0) * song.tempo) / 60;
        const i = song.lines.findIndex((l) => beat >= l.start && beat < l.start + l.beats);
        creativeState.song.line = i;
        list.querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', k === i));
      }, 200);
    } catch (e) {
      creativeState.error = (e as Error).message;
      toast('This phone wouldn’t start the sound: tap Play again.', 'warn');
    }
  };
  for (const el of [lyrics, key, mode, tempo]) el.addEventListener(el === lyrics || el === tempo ? 'input' : 'change', refresh);
  const playBtn = button('Play', () => void play(), 'on');
  playBtn.setAttribute('aria-label', 'Play the song');
  const stopBtn = button('Stop', stop);
  stopBtn.setAttribute('aria-label', 'Stop the song');
  const fresh = button('New tune', () => {
    seed = Math.floor(Math.random() * 4_000_000_000);
    refresh();
    void play();
  });
  fresh.setAttribute('aria-label', 'Make another tune from the same words');
  const wav = button('Save WAV', () => saveFile(toWav(renderSong(song, RATE), RATE), `${slug(song.title)}.wav`, 'audio/wav'));
  wav.dataset.label = 'Save WAV';
  wav.setAttribute('aria-label', 'Save the song as a WAV sound file');
  const mid = button('Save MIDI', () => saveFile(toMidi(song), `${slug(song.title)}.mid`, 'audio/midi'));
  mid.dataset.label = 'Save MIDI';
  mid.setAttribute('aria-label', 'Save the song as a MIDI file');
  refresh();
  return {
    el: h('div.pkcol', field('Words', lyrics), h('div.pkrow', field('Key', key), field('Mode', mode)), field('Tempo', h('div.pkcol', tempo, tempoLab)), info, list, h('div.pkrow', playBtn, stopBtn, fresh), h('div.pkrow', wav, mid), h('p.pknote', 'The tune and chords are made by code from your words; the same words and seed give the same song.')),
    stop,
  };
}

// ---------------------------------------------------------------- POSTER

function posterScreen(a: Record<string, unknown>): Screen {
  const title = h('input', { type: 'text', value: String(a.title ?? ''), maxLength: 90 }) as HTMLInputElement;
  const sub = h('input', { type: 'text', value: String(a.subtitle ?? ''), maxLength: 80 }) as HTMLInputElement;
  const lines = h('textarea', { rows: 3, value: (Array.isArray(a.lines) ? (a.lines as unknown[]).map(String) : []).join('\n') }) as HTMLTextAreaElement;
  const theme = selectOf(Object.keys(THEMES), typeof a.theme === 'string' && a.theme in THEMES ? a.theme : themeFor(`${title.value} ${lines.value}`));
  const canvas = canvasOf(POSTER_W, POSTER_H, 'The poster as drawn');
  let t = 0;
  const draw = async () => {
    creativeState.font = await loadFont();
    const ctx = canvas.getContext('2d')!;
    const r = posterPrims({ title: title.value, subtitle: sub.value, lines: lines.value.split('\n'), theme: theme.value as ThemeName, seed: Number(a.seed) || hashSeed(title.value) }, measureOn(ctx));
    drawPrims(ctx, r.prims, r.w, r.h, r.theme.bg);
    const texts = r.prims.filter((p) => p.t === 'text').length;
    Object.assign(creativeState.poster, { title: title.value, theme: theme.value, lines: texts, w: r.w, h: r.h, drawn: creativeState.poster.drawn + 1 });
    canvas.setAttribute('aria-label', `The poster: ${title.value}${sub.value ? `, ${sub.value}` : ''}`);
  };
  const later = () => {
    clearTimeout(t);
    t = window.setTimeout(() => void draw(), 120);
  };
  for (const el of [title, sub, lines, theme]) el.addEventListener(el === theme ? 'change' : 'input', later);
  const save = button('Save PNG', async () => saveFile(await pngOf(canvas), `${slug(title.value)}-poster.png`, 'image/png'), 'on');
  save.setAttribute('aria-label', 'Save the poster as a PNG picture');
  void draw();
  return { el: h('div.pkcol', canvas, field('Title', title), field('Day and time', sub), field('Details, a line each', lines), field('Look', theme), h('div.pkrow', save), h('p.pknote', 'Laid out in code so every line stays on the page; the title is as big as fits.')), stop: () => clearTimeout(t) };
}

// ---------------------------------------------------------------- BIRTHDAY CARD

function cardScreen(a: Record<string, unknown>): Screen {
  const name = h('input', { type: 'text', value: String(a.name ?? ''), maxLength: 24 }) as HTMLInputElement;
  const age = h('input', { type: 'number', value: a.age ? String(a.age) : '', min: 1, max: 129, inputMode: 'numeric' }) as HTMLInputElement;
  const msg = h('textarea', { rows: 5, value: String(a.message ?? ''), maxLength: 400 }) as HTMLTextAreaElement;
  let side: 'front' | 'inside' = 'front';
  const canvas = canvasOf(CARD_W, CARD_H, 'The card as drawn');
  const paint = async (c: HTMLCanvasElement, s: 'front' | 'inside') => {
    creativeState.font = await loadFont();
    const ctx = c.getContext('2d')!;
    const r = cardPrims({ name: name.value, age: Number(age.value) || null, message: msg.value, side: s, seed: Number(a.seed) || hashSeed(name.value) }, s === 'front' ? measureOn(ctx) : measureBody(ctx));
    drawPrims(ctx, r.prims, r.w, r.h, r.bg);
  };
  const draw = async () => {
    await paint(canvas, side);
    Object.assign(creativeState.card, { side, drawn: creativeState.card.drawn + 1 });
    canvas.setAttribute('aria-label', `The ${side} of the card for ${name.value || 'you'}`);
  };
  let t = 0;
  const later = () => {
    clearTimeout(t);
    t = window.setTimeout(() => void draw(), 120);
  };
  for (const el of [name, age, msg]) el.addEventListener('input', later);
  const toggle = (s: 'front' | 'inside') => {
    side = s;
    void draw();
  };
  const savedSide = async (s: 'front' | 'inside') => {
    const c = canvasOf(CARD_W, CARD_H, '');
    await paint(c, s);
    saveFile(await pngOf(c), `${slug(name.value || 'card')}-card-${s}.png`, 'image/png');
  };
  const f = button('Show front', () => toggle('front'));
  const i = button('Show inside', () => toggle('inside'));
  const sf = button('Save front', () => void savedSide('front'), 'on');
  sf.setAttribute('aria-label', 'Save the front of the card as a PNG');
  const si = button('Save inside', () => void savedSide('inside'), 'on');
  si.setAttribute('aria-label', 'Save the inside of the card as a PNG');
  void draw();
  return { el: h('div.pkcol', canvas, h('div.pkrow', f, i), field('Name', name), field('Age', age), field('The words inside', msg), h('div.pkrow', sf, si)), stop: () => clearTimeout(t) };
}

// ---------------------------------------------------------------- COMIC STRIP

function comicScreen(a: Record<string, unknown>): Screen {
  const caps = (Array.isArray(a.captions) ? (a.captions as unknown[]).map(String) : []).concat(['', '', '', '']).slice(0, 4);
  const filled = caps.every(Boolean) ? caps : splitStory(caps.filter(Boolean).join('. ') || 'A cat sits at the window. Then a bird lands. The cat plans something. It is much too slow.', 4);
  const inputs = filled.map((c, i) => h('input', { type: 'text', value: c, maxLength: 110, 'aria-label': `Caption for panel ${i + 1}` }) as HTMLInputElement);
  const names = h('input', { type: 'text', value: (Array.isArray(a.names) ? (a.names as unknown[]).map(String) : []).join(', '), placeholder: 'Sam, Ali (up to three)' }) as HTMLInputElement;
  const canvas = canvasOf(COMIC_W, COMIC_H, 'The comic strip as drawn');
  const draw = async () => {
    creativeState.font = await loadFont();
    const ctx = canvas.getContext('2d')!;
    const r = comicPrims(inputs.map((i) => i.value), names.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 3), Number(a.seed) || 1, measureBody(ctx));
    drawPrims(ctx, r.prims, r.w, r.h, '#fffdf7');
    Object.assign(creativeState.comic, { captions: inputs.map((i) => i.value), drawn: creativeState.comic.drawn + 1, w: r.w, h: r.h });
    canvas.setAttribute('aria-label', `A four-panel comic: ${inputs.map((i, k) => `${k + 1}, ${i.value}`).join('; ')}`);
  };
  let t = 0;
  const later = () => {
    clearTimeout(t);
    t = window.setTimeout(() => void draw(), 120);
  };
  for (const el of [...inputs, names]) el.addEventListener('input', later);
  const save = button('Save PNG', async () => saveFile(await pngOf(canvas), 'comic-strip.png', 'image/png'), 'on');
  save.setAttribute('aria-label', 'Save the comic strip as a PNG picture');
  void draw();
  return { el: h('div.pkcol', canvas, ...inputs.map((i, k) => field(`Panel ${k + 1}`, i)), field('Characters', names), h('div.pkrow', save), h('p.pknote', 'Drawn by Ghosty in code: stick figures and shapes of our own, not anyone’s art.')), stop: () => clearTimeout(t) };
}

// ---------------------------------------------------------------- LOGO

function logoScreen(a: Record<string, unknown>): Screen {
  const name = h('input', { type: 'text', value: String(a.name ?? ''), maxLength: 28 }) as HTMLInputElement;
  const vibe = h('input', { type: 'text', value: String(a.vibe ?? ''), placeholder: 'calm, bold, nature, playful, premium, tech…' }) as HTMLInputElement;
  let seed = Number(a.seed) || 0;
  const canvas = canvasOf(1000, 1000, 'The logo as drawn');
  let last: ReturnType<typeof logoPrims> | null = null;
  const draw = async () => {
    creativeState.font = await loadFont();
    const ctx = canvas.getContext('2d')!;
    const spec = logoSpec(name.value, vibe.value, seed);
    last = logoPrims(spec, measureOn(ctx));
    drawPrims(ctx, last.prims, last.w, last.h, last.bg);
    Object.assign(creativeState.logo, { name: spec.name, icon: spec.icon, drawn: creativeState.logo.drawn + 1 });
    canvas.setAttribute('aria-label', `A logo sketch for ${spec.name}: a ${spec.shape} with ${spec.icon === 'none' ? 'a letter' : `a ${spec.icon}`}`);
  };
  let t = 0;
  const later = () => {
    clearTimeout(t);
    t = window.setTimeout(() => void draw(), 120);
  };
  for (const el of [name, vibe]) el.addEventListener('input', later);
  const other = button('Another look', () => {
    seed++;
    void draw();
  });
  const png = button('Save PNG', async () => saveFile(await pngOf(canvas), `${slug(name.value)}-logo.png`, 'image/png'), 'on');
  png.setAttribute('aria-label', 'Save the logo as a PNG picture');
  const svg = button('Save SVG', () => last && saveFile(new TextEncoder().encode(primsToSvg(last.prims, last.w, last.h, last.bg)), `${slug(name.value)}-logo.svg`, 'image/svg+xml'));
  svg.dataset.label = 'Save SVG';
  svg.setAttribute('aria-label', 'Save the logo as an SVG file');
  void draw();
  return { el: h('div.pkcol', canvas, field('Name', name), field('The feel', vibe), h('div.pkrow', other, png, svg), h('p.pknote', 'A sketch in simple shapes, made by code: a start for a designer, not a finished brand.')), stop: () => clearTimeout(t) };
}

// ---------------------------------------------------------------- PALETTE

function paletteScreen(a: Record<string, unknown>): Screen {
  const out = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Pick or take a photo: its colours are found here on the phone. The photo is never uploaded.');
  const show = (sw: Swatch[], from: string) => {
    creativeState.palette = { swatches: sw.map((s) => ({ hex: s.hex, name: s.name, share: s.share })), from };
    out.replaceChildren(
      ...sw.map((s) => {
        const copy = button('Copy', async () => {
          try {
            await navigator.clipboard.writeText(s.hex);
            status.textContent = `Copied ${s.hex}.`;
          } catch {
            status.textContent = s.hex;
          }
        });
        copy.setAttribute('aria-label', `Copy ${s.hex}, ${s.name}`);
        copy.style.color = s.on;
        return h('div.pkswatch', { style: `background:${s.hex};color:${s.on}`, role: 'group', 'aria-label': `${s.name} ${s.hex}${s.share ? `, ${s.share} percent` : ''}` }, h('b', s.hex.toUpperCase()), h('span', `${s.name}${s.share ? ` · ${s.share}%` : ''}`), copy);
      }),
    );
  };
  const given = (Array.isArray(a.colours) ? (a.colours as unknown[]).map(String) : []).filter((x) => /^#[0-9a-f]{6}$/i.test(x));
  if (given.length) show(given.map((hex) => ({ hex, name: colourName(hex), share: 0, on: contrast(hex, '#ffffff') >= contrast(hex, '#000000') ? '#ffffff' : '#000000' })), 'a colour');
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'A photo to take the colours from' }) as HTMLInputElement;
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      status.textContent = 'Reading the colours…';
      const bmp = await createImageBitmap(f);
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, 64, 64);
      show(paletteOf(ctx.getImageData(0, 0, 64, 64).data, 5), 'a photo');
      status.textContent = 'These are the main colours of your photo, biggest first.';
    } catch (e) {
      status.textContent = `I couldn’t read that picture (${(e as Error).message}).`;
    }
  });
  const pick = button('Pick a photo', () => file.click(), 'on');
  pick.setAttribute('aria-label', 'Pick or take a photo to take the colours from');
  const all = button('Copy all', async () => {
    try {
      await navigator.clipboard.writeText(creativeState.palette.swatches.map((s) => `${s.hex} ${s.name}`).join('\n'));
      status.textContent = 'Copied the whole palette.';
    } catch {
      status.textContent = creativeState.palette.swatches.map((s) => s.hex).join(' ');
    }
  });
  all.setAttribute('aria-label', 'Copy every colour of the palette');
  return { el: h('div.pkcol', h('div.pkrow', pick, all), file, out, status), stop: () => undefined };
}

// ---------------------------------------------------------------- BEAT

function beatScreen(a: Record<string, unknown>): Screen {
  const given = a.beat as Beat | undefined;
  let beat: Beat = given && given.rows && given.rows.kick?.length === 16 ? { name: String(given.name || 'my beat'), bpm: Number(given.bpm) || 100, steps: 16, rows: { kick: given.rows.kick.slice(), snare: given.rows.snare.slice(), hat: given.rows.hat.slice(), clap: given.rows.clap.slice() } } : beatFromWords('');
  let src: AudioBufferSourceNode | null = null;
  let t0 = 0;
  const grid = h('div.pkgrid', { role: 'group', 'aria-label': 'The beat: four rows of sixteen steps' });
  const tempo = h('input', { type: 'range', min: 60, max: 180, value: String(beat.bpm) }) as HTMLInputElement;
  const tempoLab = h('span.pklab');
  const style = selectOf(BEAT_STYLES, BEAT_STYLES.includes(beat.name) ? beat.name : 'hip hop');
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const stats = () => Object.assign(creativeState.beat, { bpm: beat.bpm, hits: DRUMS.reduce((k, d) => k + beat.rows[d].filter(Boolean).length, 0), grid: beatGrid(beat), playing: !!src });
  const cells: Record<Drum, HTMLButtonElement[]> = { kick: [], snare: [], hat: [], clap: [] };
  const paint = () => {
    for (const d of DRUMS) beat.rows[d].forEach((on, i) => {
      const c = cells[d][i]!;
      c.setAttribute('aria-pressed', String(on));
      c.classList.toggle('on', on);
    });
    tempoLab.textContent = `${beat.bpm} beats a minute`;
    stats();
  };
  const reload = (bar: number) => {
    // a new loop from the pattern, started on the next bar line so it never clicks
    if (!src) return;
    const ctx = audio();
    const next = ctx.createBufferSource();
    next.buffer = bufferOf(ctx, renderBeat(beat, 1, RATE), RATE);
    next.loop = true;
    next.connect(ctx.destination);
    const barSecs = (4 * 60) / beat.bpm;
    const at = t0 + Math.ceil(Math.max(0, ctx.currentTime - t0) / barSecs + bar) * barSecs;
    next.start(at);
    try {
      src.stop(at);
    } catch {
      /* gone */
    }
    src = next;
    t0 = at;
  };
  for (const d of DRUMS) {
    // sixteen steps as two lines of eight, so each square is big enough for a thumb
    for (const half of [0, 1]) {
      const rowEl = h('div.pkgridrow', h('span.pklab', half ? '' : d));
      for (let i = half * 8; i < half * 8 + 8; i++) {
        const c = button(String(i + 1), () => {
          beat.rows[d][i] = !beat.rows[d][i];
          paint();
          reload(0);
        }, 'pkstep');
        c.setAttribute('aria-label', `${d}, step ${i + 1}`);
        c.setAttribute('aria-pressed', 'false');
        cells[d].push(c);
        rowEl.append(c);
      }
      grid.append(rowEl);
    }
  }
  const stop = () => {
    try {
      src?.stop();
    } catch {
      /* already stopped */
    }
    src = null;
    creativeState.beat.playing = false;
  };
  const play = () => {
    stop();
    const ctx = audio();
    src = ctx.createBufferSource();
    src.buffer = bufferOf(ctx, renderBeat(beat, 1, RATE), RATE);
    src.loop = true;
    src.connect(ctx.destination);
    t0 = ctx.currentTime;
    src.start();
    stats();
  };
  const tap = (d: Drum) => {
    const ctx = audio();
    // the hit you hear now, and the step it lands on in the loop
    const one: Beat = { ...emptyBeat(beat.bpm), rows: { ...emptyBeat(beat.bpm).rows, [d]: Array.from({ length: 16 }, (_, i) => i === 0) } };
    const s = ctx.createBufferSource();
    s.buffer = bufferOf(ctx, renderBeat(one, 1, RATE).subarray(0, Math.floor(RATE * 0.4)), RATE);
    s.connect(ctx.destination);
    s.start();
    creativeState.beat.taps++;
    if (src) {
      const step = quantise((ctx.currentTime - t0) * 1000, beat.bpm);
      beat.rows[d][step] = true;
      paint();
      reload(0);
      status.textContent = `${d} on step ${step + 1}`;
    }
  };
  tempo.addEventListener('input', () => {
    beat.bpm = +tempo.value;
    paint();
    if (src) play();
  });
  style.addEventListener('change', () => {
    beat = beatFromWords(style.value);
    tempo.value = String(beat.bpm);
    paint();
    if (src) play();
  });
  const pads = h('div.pkrow', ...DRUMS.map((d) => {
    const b = button(d, () => tap(d), 'pkpad');
    b.setAttribute('aria-label', `${d} pad: tap along with the loop`);
    return b;
  }));
  const playB = button('Play', play, 'on');
  playB.setAttribute('aria-label', 'Play the beat as a loop');
  const stopB = button('Stop', () => (stop(), stats()));
  const clear = button('Clear', () => {
    beat = { ...emptyBeat(beat.bpm), name: 'my beat' };
    paint();
    reload(0);
  });
  const keep = button('Save beat', async () => {
    try {
      const r = await brain.packDo('creative', 'beat', { grid: beatGrid(beat), bpm: beat.bpm, name: beat.name || 'my beat' });
      status.textContent = r.text.split('\n')[0] ?? 'Kept.';
    } catch (e) {
      status.textContent = `My brain didn’t answer: ${(e as Error).message}`;
    }
  });
  keep.setAttribute('aria-label', 'Keep this beat in my brain');
  const wav = button('Save WAV', () => saveFile(toWav(renderBeat(beat, 4, RATE), RATE), `${slug(beat.name)}.wav`, 'audio/wav'));
  wav.dataset.label = 'Save WAV';
  wav.setAttribute('aria-label', 'Save four bars of the beat as a WAV sound file');
  const mid = button('Save MIDI', () => saveFile(beatToMidi(beat, 4), `${slug(beat.name)}.mid`, 'audio/midi'));
  mid.dataset.label = 'Save MIDI';
  mid.setAttribute('aria-label', 'Save the beat as a MIDI file');
  paint();
  return { el: h('div.pkcol', h('div.pkrow', playB, stopB, clear), grid, pads, field('Style', style), field('Tempo', h('div.pkcol', tempo, tempoLab)), h('div.pkrow', keep, wav, mid), status, h('p.pknote', 'Tap the squares, or tap a pad along with the loop: the hit lands on the nearest sixteenth.')), stop };
}
