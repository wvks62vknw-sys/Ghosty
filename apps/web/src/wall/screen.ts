/**
 * THE WALL, the screen itself (BRIEF-MACHINE-WALL; STARS 165): Ghosty's address opened on a television or a laptop becomes a second
 * screen of the same Ghosty that shows what his phone is talking about, with nothing to touch on it. On when this device is the wall
 * (`?wall=1` on its address, or SETTINGS → TV MODE → THIS IS THE WALL; `?wall=0` gives the screen back to Ghosty). It covers the app
 * and shows one of five faces:
 *   unpaired  the orb, "I am the wall.", a six-letter code in the Machine's type (new every two minutes), one key: PAIR (a new code now)
 *   paired    "Paired with your phone.", then the resting face
 *   resting   the orb breathing, the hour, the day, the day's next thing, the weather at Home if saved
 *   showing   the phone's picture, full screen, drawn by the Stage's own renderers (show/stage.ts) at television scale, the one
 *             sentence it answers along the foot, in one line
 *   lost      "I lost my brain. The phone's picture will come back when it does." with the last picture kept, dim
 * It receives through ONE long-poll stream from its own route (GET /guardian/wall/stream: the brain answers at once when anything
 * changes), no schedule of its own. Its second key is LEAVE: a long press anywhere, one second, with a count ring, so a brushed remote
 * cannot unpair it. It never shows a camera, a face, a position or a message: only pictures and their one sentence (the brain
 * and the phone both refuse the rest, packages/shared/src/wall.ts). Reduce Motion: no fade, the picture appears where it lands.
 * Every colour, size and duration is a token (styles.css, THE SYSTEM: `#thewall`).
 */
import { AuthError, brain, headers } from '../api/brain';
import { h, svgEl } from '../core/dom';
import { createStore } from '../core/store';
import { docPic, eyePic, isoPic, mapWidePic } from '../show/stage';
import { chartPic } from '../show/chartpic';
import { partBoxes, roomBoxesOf, roomPlanFor, type PartKind } from '../show/parts';
import { eyeGlyph, key, tag, truthLine } from '../ui/machine';
import { WALL_SAYS, wallCheck, type WallFrame, type WallPicture } from '../../../../packages/shared/src/wall';
import { firstThing, homeWeather } from './rest';

/** Is this device the wall? Kept on it; `screen` is its own name to the brain (random, made once). */
export const wallRole = createStore({ on: false, screen: '' }, { persist: 'ghosty.wall.role' });

/** What a test reads: window.__ghosty.thewall. */
export const wallState = { on: false, face: 'off' as 'off' | 'unpaired' | 'paired' | 'rest' | 'show' | 'lost' | 'signin', code: '', pair: '', kind: '', sentence: '', lost: false, polls: 0, frames: 0, shownAt: 0, left: 0, fade: false, first: '', weather: '', mountMs: 0, codeMs: 0, frameAt: 0 };

const still = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'calm';
const HOLD_MS = 1000;
const POLL_HOLD = 20_000;

let root: HTMLElement | null = null;
let alive = 0;
let abort: AbortController | null = null;

function screenId(): string {
  let s = wallRole.get().screen;
  if (s.length < 8) {
    const b = new Uint8Array(10);
    crypto.getRandomValues(b);
    s = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    wallRole.set({ screen: s });
  }
  return s;
}

// ---------------------------------------------------------------- the pictures, at television scale

/** A line of words on a picture: the name of a thing, large. */
const bigName = (name: string, sub: string[] = []) => h('div.wallthing', h('b.wallname', name), ...sub.map((l) => h('span.wallsub', l)));

function waveformPic(title: string, peaks: number[]): SVGSVGElement {
  const n = peaks.length;
  const svg = svgEl('svg', { viewBox: `0 0 ${n * 4} 100`, class: 'stg-svg wave', role: 'img', 'aria-label': `${title}: the waveform` });
  peaks.forEach((p, i) => {
    const hgt = Math.max(2, p * 92);
    svg.append(svgEl('rect', { x: i * 4 + 0.5, y: 50 - hgt / 2, width: 3, height: hgt, class: 'stg-bar' }));
  });
  return svg;
}

/** The picture the brain sent, drawn by the Stage's own renderers; `stop` ends whatever moves in it. */
function drawPicture(p: WallPicture): { el: HTMLElement; title: string; stop: () => void; fit?: () => void } | null {
  const v = wallCheck(p.kind, p.data);
  if (!v.ok) return null; // the wall checks too: what stays on the phone never reaches the glass
  const d = v.data as Record<string, any>;
  const wrap = (n: Node) => h('div.wallframe', n);
  switch (v.kind) {
    case 'chart':
      return { el: wrap(chartPic(d.series, () => undefined, () => 1600).el), title: String(d.title || 'Chart'), stop: () => undefined };
    case 'map':
    case 'place':
      return { el: wrap(mapWidePic(d.lat, d.lon, d.zoom, d.label)), title: String(d.label), stop: () => undefined };
    case 'document':
    case 'plan': {
      const page = docPic(String(d.title), d.paragraphs);
      const el = wrap(page);
      // never a scrollbar on a wall: the page's type steps down until all of it is in the frame. It is fitted again whenever the frame's
      // size changes (the screen's size changed, or the picture was hidden while the wall had lost the brain and is shown again): a
      // page fitted while it had no size would otherwise stand cut once it has one
      const fit = () => {
        if (!page.clientHeight) return;
        page.style.removeProperty('--wall-page');
        for (let fs = 2.1; fs >= 0.85 && page.scrollHeight > page.clientHeight + 1; fs -= 0.05) page.style.setProperty('--wall-page', fs.toFixed(2));
      let seen = '';
      const ro = new ResizeObserver(([e]) => {
        const box = `${Math.round(e!.contentRect.width)}x${Math.round(e!.contentRect.height)}`;
        if (box !== seen) (seen = box), fit();
      });
      ro.observe(el);
      return { el, title: String(d.title), stop: () => ro.disconnect(), fit };
      };
    }
    case 'room':
    case 'part': {
      let boxes;
      // (the Stage's 3-D picture writes the sizes on its edges in the unit he used and names each part where it stands: the wall draws the same)
      let sizes: Parameters<typeof isoPic>[3];
      if (v.kind === 'room') {
        const plan = roomPlanFor({ w: d.room.w, d: d.room.d, things: d.room.things, sized: d.room.sized, unit: d.room.unit ?? 'm' });
        boxes = roomBoxesOf(plan, plan.items!.map((i) => (i as unknown as { kind: PartKind }).kind)).boxes;
        const W2 = plan.room.w / 100;
        const D2 = plan.room.d / 100;
        sizes = {
          unit: d.room.unit ?? 'm',
          w: plan.room.w,
          d: plan.room.d,
          h: plan.room.h ?? 240,
          names: plan.items!.map((it) => ({ name: it.name, at: [it.x / 100 + it.w / 200 - W2 / 2, (it.h ?? 75) / 100, it.y / 100 + it.d / 200 - D2 / 2] as [number, number, number] })),
        };
      } else {
        boxes = partBoxes(d.part.kind as PartKind, d.part.dims);
        sizes = { unit: d.part.unit ?? 'cm', w: d.part.dims.w, d: d.part.dims.d, h: d.part.dims.h, names: [{ name: d.part.name, at: [0, d.part.dims.h / 100, 0] }] };
      }
      const s = isoPic(boxes, v.kind === 'room', String(d.title || (v.kind === 'room' ? 'The room' : d.part.name)), sizes);
      return { el: wrap(s.el), title: String(d.title || d.part?.name || 'In 3-D'), stop: s.stop };
    }
    case 'waveform':
      return { el: wrap(waveformPic(String(d.title), d.peaks)), title: String(d.title), stop: () => undefined };
    case 'car':
      return { el: bigName(String(d.name), d.lines), title: String(d.name), stop: () => undefined };
    case 'thing':
      return { el: bigName(String(d.name)), title: 'Looks like', stop: () => undefined };
  }
}

// ---------------------------------------------------------------- the screen

const TAGS: Record<string, string> = { chart: 'CHART', map: 'MAP', place: 'PLACE', document: 'DOCUMENT', plan: 'PLAN', room: 'ROOM', part: 'PART', car: 'CAR', waveform: 'WAVEFORM', thing: 'THE LENS' };

interface Parts {
  say: HTMLElement;
  code: HTMLElement;
  bar: HTMLElement;
  how: HTMLElement;
  pairKey: HTMLButtonElement;
  hour: HTMLElement;
  day: HTMLElement;
  firstEl: HTMLElement;
  weatherEl: HTMLElement;
  pic: HTMLElement;
  head: HTMLElement;
  foot: HTMLElement;
  note: HTMLElement;
  ring: SVGSVGElement;
}
let parts: Parts | null = null;
let stopPic: () => void = () => undefined;
let frame: WallFrame | null = null;
let seq = -1;
let lost = false;
let announceUntil = 0;
let wasUnpaired = false;
let drawnAt = 0;
let freshNext = false;

/** The hour, the day: where the wall is, in the Machine's marks. */
function clockLines(): { hour: string; day: string } {
  const d = new Date();
  return { hour: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), day: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase() };
}

function build(): HTMLElement {
  const say = h('p.wallsay', { dataset: { case: 'keep' } });
  const code = h('div.wallcode', { role: 'img', dataset: { case: 'keep' } });
  const bar = h('div.wallbar', { 'aria-hidden': 'true' }, h('i'));
  const how = h('p.wallhow', { dataset: { case: 'keep' } }, WALL_SAYS.how);
  const pairKey = key('PAIR', () => {
    freshNext = true;
    abort?.abort();
  }, { label: 'Pair: show me a new code' });
  const hour = h('div.wallhour', { dataset: { case: 'keep' } });
  const day = tag('', { tone: 'on' });
  day.classList.add('wallday');
  const firstEl = truthLine('');
  firstEl.classList.add('wallfirst');
  const weatherEl = truthLine('');
  weatherEl.classList.add('wallweather');
  const pic = h('div.wallpic');
  const head = h('div.wallhead');
  const foot = h('p.wallfoot', { dataset: { case: 'keep' } });
  const note = h('p.wallnote', { role: 'status', dataset: { case: 'keep' } });
  const ring = svgEl('svg', { class: 'wallring', viewBox: '-30 -30 60 60', 'aria-hidden': 'true' });
  ring.append(svgEl('circle', { cx: 0, cy: 0, r: 24, class: 'wallring-bg' }), svgEl('circle', { cx: 0, cy: 0, r: 24, class: 'wallring-fg', pathLength: 100 }));
  const orb = h('div.wallorb', eyeGlyph(240));
  parts = { say, code, bar, how, pairKey, hour, day, firstEl, weatherEl, pic, head, foot, note, ring };
  const el = h('div#thewall.wall', { role: 'main', 'aria-label': 'The wall', dataset: { face: 'unpaired' } },
    orb, say, code, bar, how, h('div.wallkeys', pairKey), hour, day, firstEl, weatherEl, head, pic, foot, note, ring);
  return el;
}

const letters = (code: string) => code.split('').map((c) => h('span.wallletter', { dataset: { case: 'keep' } }, c));

function face(f: typeof wallState.face): void {
  wallState.face = f;
  if (root) {
    root.dataset.face = f;
    root.dataset.pic = frame?.state === 'paired' && frame.picture ? '1' : '0';
  }
}

/** Paint the wall from what the stream last said and what has happened since. */
function paint(): void {
  if (!root || !parts) return;
  const p = parts;
  const now = Date.now();
  root.classList.toggle('lost', lost);
  p.note.textContent = lost ? WALL_SAYS.lost : '';
  wallState.lost = lost;
  const f = frame;
  if (!f) {
    face('unpaired');
    p.say.textContent = lost ? WALL_SAYS.iam : 'Asking my brain for a code…';
    p.code.replaceChildren();
    p.code.removeAttribute('aria-label');
    p.how.textContent = lost ? '' : '';
    return;
  }
  wallState.pair = f.pair ?? '';
  if (f.state === 'unpaired') {
    wasUnpaired = true;
    stopPic();
    drawnAt = 0;
    p.pic.replaceChildren();
    p.head.replaceChildren();
    p.foot.textContent = '';
    wallState.kind = '';
    wallState.sentence = '';
    face('unpaired');
    p.say.textContent = WALL_SAYS.iam;
    wallState.code = f.code ?? '';
    if (f.code && !wallState.codeMs) wallState.codeMs = Math.round(performance.now());
    p.code.replaceChildren(...(f.code ? [...letters(f.code.slice(0, 3)), h('span.wallgap', { 'aria-hidden': 'true' }), ...letters(f.code.slice(3))] : []));
    if (f.code) p.code.setAttribute('aria-label', `Code ${f.code.split('').join(' ')}`);
    else p.code.removeAttribute('aria-label');
    p.how.textContent = lost ? '' : WALL_SAYS.how;
    updateBar();
    return;
  }
  // paired
  wallState.code = '';
  if (wasUnpaired) {
    wasUnpaired = false;
    announceUntil = now + 2600;
    setTimeout(paint, 2650);
  }
  if (now < announceUntil) {
    face('paired');
    p.say.textContent = WALL_SAYS.paired;
    return;
  }
  const pic = f.picture;
  if (!pic) {
    stopPic();
    drawnAt = 0;
    p.pic.replaceChildren();
    p.head.replaceChildren();
    p.foot.textContent = '';
    wallState.kind = '';
    wallState.sentence = '';
    face(lost ? 'lost' : 'rest');
    tickClock();
    void restLines();
    return;
  }
  face(lost ? 'lost' : 'show');
  if (drawnAt !== pic.at) {
    const d = drawPicture(pic);
    if (!d) {
      // what cannot be drawn is not shown (and a kind off the list never gets here): the wall rests
      face(lost ? 'lost' : 'rest');
      return;
    }
    drawnAt = pic.at;
    stopPic();
    stopPic = d.stop;
    d.el.classList.toggle('wallin', !still());
    wallState.fade = !still();
    p.pic.replaceChildren(d.el);
    p.head.replaceChildren(tag(`SHOWING · ${TAGS[pic.kind] ?? pic.kind.toUpperCase()}`, { tone: 'on' }), h('b.walltitle', d.title));
    p.foot.textContent = pic.sentence;
    p.foot.style.removeProperty('font-size');
    wallState.kind = pic.kind;
    wallState.sentence = pic.sentence;
    wallState.shownAt = Date.now();
    requestAnimationFrame(() => {
      d.fit?.();
      fitFoot();
    });
  }
}

/** The one sentence along the foot stays in one line: its type steps down until all of it fits, and goes no smaller than 24 px. */
function fitFoot(): void {
  const el = parts?.foot;
  if (!el) return;
  let fs = parseFloat(getComputedStyle(el).fontSize) || 40;
  for (; fs > 24 && el.scrollWidth > el.clientWidth + 1; fs -= 2) el.style.fontSize = `${fs}px`;
}

function tickClock(): void {
  if (!parts) return;
  const c = clockLines();
  parts.hour.textContent = c.hour;
  parts.day.replaceChildren(h('span', c.day));
}
let restAt = 0;
async function restLines(): Promise<void> {
  if (!parts || Date.now() - restAt < 5 * 60_000) return;
  restAt = Date.now();
  const [a, w] = await Promise.all([firstThing(), homeWeather()]);
  wallState.first = a;
  wallState.weather = w;
  if (!parts) return;
  parts.firstEl.replaceChildren(h('span.g-seg', a));
  parts.firstEl.hidden = !a;
  parts.weatherEl.replaceChildren(h('span.g-seg', w));
  parts.weatherEl.hidden = !w;
}

/** The code's life, as a thin line that runs down (stepped each second: nothing sweeps). */
function updateBar(): void {
  if (!parts || !frame || frame.state !== 'unpaired' || !frame.expires) return;
  const left = Math.max(0, Math.min(1, (frame.expires - Date.now()) / 120_000));
  (parts.bar.firstElementChild as HTMLElement).style.width = `${(left * 100).toFixed(1)}%`;
  wallState.left = Math.round(left * 120);
}

// ---------------------------------------------------------------- LEAVE: a long press anywhere

function holdToLeave(el: HTMLElement): () => void {
  let timer = 0;
  let t0 = 0;
  let down = false;
  const ringEl = parts!.ring;
  const fg = ringEl.querySelector<SVGCircleElement>('.wallring-fg')!;
  const stop = () => {
    clearInterval(timer);
    down = false;
    ringEl.classList.remove('on');
  };
  const onDown = (e: PointerEvent) => {
    if (e.button > 0 || down) return;
    down = true;
    t0 = performance.now();
    ringEl.style.left = `${e.clientX}px`;
    ringEl.style.top = `${e.clientY}px`;
    fg.style.strokeDashoffset = '100';
    timer = window.setInterval(() => {
      const f = (performance.now() - t0) / HOLD_MS;
      // the ring only shows once it is a hold, not a tap; with Reduce Motion it counts in quarters
      if (f > 0.12) ringEl.classList.add('on');
      const shown = still() ? Math.floor(f * 4) / 4 : f;
      fg.style.strokeDashoffset = String(100 - Math.min(1, shown) * 100);
      if (f >= 1) {
        stop();
        ignoreClick = true;
        void leave();
      }
    }, 60);
  };
  el.addEventListener('pointerdown', onDown);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(ev, stop);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return () => {
    stop();
    el.removeEventListener('pointerdown', onDown);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.removeEventListener(ev, stop);
  };
}
let ignoreClick = false;

/** LEAVE: the pair goes on both sides; the wall asks for a new code at once. */
async function leave(): Promise<void> {
  try {
    await brain.wallLeave(screenId());
  } catch {
    /* the brain is out of reach: the wall says so; it stays paired until it can be told */
    lost = true;
    paint();
    return;
  }
  seq = -1;
  frame = null;
  abort?.abort();
  paint();
}

// ---------------------------------------------------------------- the stream

const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

async function poll(): Promise<WallFrame> {
  const ctl = new AbortController();
  abort = ctl;
  const guard = setTimeout(() => ctl.abort(), POLL_HOLD + 8000);
  const hold = (window as unknown as { __ghostyWallHold?: number }).__ghostyWallHold ?? POLL_HOLD;
  const q = `screen=${screenId()}&seq=${seq}&hold=${hold}${frame?.pair ? `&pair=${frame.pair}` : ''}${freshNext ? '&fresh=1' : ''}`;
  freshNext = false;
  try {
    const r = await fetch(`/api/guardian/wall/stream?${q}`, { headers: headers(), credentials: 'same-origin', signal: ctl.signal, cache: 'no-store' });
    if (r.status === 401 || r.status === 503) throw new AuthError('not authorised');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as WallFrame;
  } finally {
    clearTimeout(guard);
  }
}

async function loop(token: number): Promise<void> {
  let failed = 0;
  let firstFail = 0;
  while (alive === token) {
    const t0 = performance.now();
    try {
      wallState.polls++;
      const f = await poll();
      if (alive !== token) return;
      failed = 0;
      firstFail = 0;
      // (it repaints on what the frame says, not only on its number: a brain whose count started over still shows the new code)
      const was = frame;
      const changed = f.seq !== seq || lost || !was || f.state !== was.state || f.code !== was.code || f.pair !== was.pair || f.picture?.at !== was.picture?.at;
      lost = false;
      seq = f.seq;
      frame = f;
      wallState.frames++;
      wallState.frameAt = Date.now();
      if (changed) paint();
      if (!changed && performance.now() - t0 < 250) await sleep(900); // (a brain that answers at once with nothing new is not asked in a tight loop)
    } catch (e) {
      if (alive !== token) return;
      if (e instanceof AuthError) {
        face('signin');
        if (parts) parts.note.textContent = WALL_SAYS.signin;
        unmount(false);
        return;
      }
      if ((e as Error).name === 'AbortError' && !lost) {
        // PAIR (a new code) or LEAVE cut the wait short: ask again at once
        continue;
      }
      failed++;
      firstFail ||= Date.now();
      // said after a second try, or four seconds, so one dropped request never flashes it
      if (failed >= 2 || Date.now() - firstFail > 4000) {
        lost = true;
        paint();
      }
      await sleep(Math.min(10_000, 1500 * failed));
    }
  }
}

// ---------------------------------------------------------------- on and off

function mount(): void {
  if (root) return;
  root = build();
  document.body.append(root);
  document.body.classList.add('wallon');
  wallState.on = true;
  wallState.mountMs = Math.round(performance.now()); // (ms since the address was opened: the wall's own first screen)
  // the app underneath is still there but nothing in it can be reached from here
  for (const c of [...document.body.children]) if (c !== root && !(c as HTMLElement).inert) (c as HTMLElement).dataset.wallInert = '1', ((c as HTMLElement).inert = true);
  inertWatch = new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLElement && n !== root) (n.dataset.wallInert = '1'), (n.inert = true);
  });
  inertWatch.observe(document.body, { childList: true });
  const off = holdToLeave(root);
  // the click that ends a long press is not a press of PAIR
  root.addEventListener('click', (e) => {
    if (ignoreClick) {
      ignoreClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
  unholds.push(off);
  paint();
  const token = ++alive;
  clockTimer = window.setInterval(() => {
    updateBar();
    if (wallState.face === 'rest' || wallState.face === 'lost') tickClock();
    if (wallState.face === 'rest') void restLines();
  }, 1000);
  requestAnimationFrame(() => void loop(token));
}
const unholds: (() => void)[] = [];
let inertWatch: MutationObserver | null = null;
let clockTimer = 0;

function unmount(clearRole = true): void {
  alive++;
  abort?.abort();
  clearInterval(clockTimer);
  inertWatch?.disconnect();
  for (const f of unholds.splice(0)) f();
  stopPic();
  for (const c of document.querySelectorAll<HTMLElement>('[data-wall-inert]')) {
    c.inert = false;
    delete c.dataset.wallInert;
  }
  root?.remove();
  root = null;
  parts = null;
  frame = null;
  seq = -1;
  drawnAt = 0;
  wasUnpaired = false;
  document.body.classList.remove('wallon');
  wallState.on = false;
  if (clearRole) face('off');
}

function apply(): void {
  if (wallRole.get().on) mount();
  else if (root) unmount();
}

/** From the layout, once (shell/layout.ts), after TV MODE starts: `?wall=1` or `?wall=0` on the address decides, else what this device kept. */
let started = false;
export function startWall(): void {
  if (started) return;
  started = true;
  try {
    const q = new URLSearchParams(location.search).get('wall');
    if (q === '1') wallRole.set({ on: true });
    else if (q === '0') wallRole.set({ on: false });
  } catch {
    /* no address to read */
  }
  wallRole.subscribe(apply);
  apply();
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.thewall = wallState), true);
  if (!attach()) {
    let n = 0;
    const timer = window.setInterval(() => (attach() || ++n > 60) && clearInterval(timer), 500);
  }
}
