/**
 * GYM tab — Ghosty teaches himself by playing. GAMES: a card per game (level, mastery, a sparkline,
 * TRAINING / PAUSED / MASTERED). Tapping a card opens it in the GAME panel: what he is learning, the
 * status line, TRAIN (or PAUSE), WATCH (he plays, step by step), PLAY HIM (tic-tac-toe, Connect 4, and —
 * through play.ts — checkers, chess and Go on the board; Code Breaker and Word Guess: you pick what he must
 * find), RESET, the mastery graph (one line
 * per level, measured against ground truth) and a picture of what he knows.
 *
 * Training runs in a Web Worker (gym/worker.ts, inside an instance of the bundled textures worker), one
 * game at a time; it pauses while the app is hidden and its state is kept in IndexedDB (store.ts), so it
 * carries on next time. The page imports only the games' descriptions (gym/meta.ts) and the board files
 * (rules, no engines): the engines live in the worker's bundle. State for specs at window.__ghosty.gym.
 *
 * He carries on by himself (part 3): WATCH trains him and plays round after round, on through the levels
 * with no tap (CONTINUE BY HIMSELF, on unless turned off); TRAIN ALL trains every game in turn, the least
 * learned first, 20 minutes each a round; KEEP AWAKE holds a screen wake lock while he trains. A run of
 * level-ups is one toast, and there is never more than one GYM toast on screen.
 */
import { clear, fmt, h, icon, svgEl } from '../../core/dom';
import { onFrame } from '../../engine/scheduler';
import { canPlay, frameOf as c4Frame, play as c4Play, posFromBoard, winnerOf } from '../../gym/c4board';
import type { Frame } from '../../gym/core';
import { type GameMeta, META as GAMES, metaById as gameById } from '../../gym/meta';
import { ALL_BUDGET, allLine, current, type GymRecord, joinLevels, type LevelNote, levelText, newAllRun, nextForAll, statusLine } from '../../gym/session';
import { frameOf as tttFrame, winner as tttWinner } from '../../gym/tttboard';
import type { GymOut } from '../../gym/worker';
import { go, type TabDef } from '../../shell/tabs';
import { button, niceCase, panel, spark, sparkline, toast } from '../../ui/components';
import { popScreen, pushScreen } from '../../ui/listmode';
import { ui } from '../../state/app';
import { proLook } from '../../state/theme';
import { page } from '../../ui/page';
import { BOARDS, type Sel } from './play';
import * as store from './store';

/** What the tab shows, for tests and the console (window.__ghosty.gym). */
export const gymState = {
  open: '',
  training: '' as string,
  cards: 0,
  saves: 0,
  progress: 0,
  watching: false,
  frames: 0,
  play: { game: '', board: [] as number[], over: '', thinking: false } as { game: string; board: number[]; over: string; thinking: boolean; sel?: number[]; replies?: number },
  recs: {} as Record<string, { level: number; mastery: number; units: number; mastered: boolean }>,
  error: '',
  /** The last few things the owner (or the app) did here, newest last — for specs reading what happened. */
  log: [] as string[],
  /** Per game: how many messages to the worker carried his whole record (once per game, then none). */
  handed: {} as Record<string, number>,
  /** The game in WATCH (he trains and plays round after round), and how many rounds it has shown. */
  watchOn: '',
  rounds: 0,
  carry: true,
  /** TRAIN ALL: running, the game it trains, its status line. */
  all: { on: false, current: '', line: '' },
  /** KEEP AWAKE: switched on, the phone can, a wake lock held now, how many were asked for. */
  awake: { on: false, can: false, held: false, requests: 0 },
  /** The GYM toasts shown, newest last. */
  toasts: [] as string[],
};

/** One GYM toast on screen at a time: a new one takes the place of the last. */
function gymToast(msg: string, kind: '' | 'warn' | 'bad' | 'ok' = ''): void {
  for (const t of document.querySelectorAll('#toasts > .toast[data-gym]')) t.remove();
  toast(msg, kind);
  const t = document.querySelector<HTMLElement>('#toasts > .toast:last-child');
  if (t) t.dataset.gym = '1';
  gymState.toasts.push(msg);
  if (gymState.toasts.length > 20) gymState.toasts.shift();
}

/** An on/off switch: its label and a line saying what it does, the knob on the right. */
function toggle(label: string, hint: string, onChange: (on: boolean) => void): { el: HTMLButtonElement; set(on: boolean, can?: boolean, why?: string): void } {
  const say = h('small', hint);
  // (the calm looks show the label in sentence case: "Keep awake")
  const el = h('button.gymswitch', { type: 'button', role: 'switch', 'aria-checked': 'false' }, h('span.gymswtxt', h('b', { dataset: { label: niceCase(label) } }, label), say), h('i.knob', { 'aria-hidden': 'true' }));
  el.addEventListener('click', () => onChange(el.getAttribute('aria-checked') !== 'true'));
  return {
    el,
    set(on, can = true, why) {
      el.setAttribute('aria-checked', String(on && can));
      el.disabled = !can;
      say.textContent = why ?? hint;
    },
  };
}

/** A screen wake lock, as far as the page needs one (not every browser has them). */
interface Lock {
  release(): Promise<void>;
  addEventListener(type: 'release', f: () => void): void;
}
const wakeLock = () => (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Lock> } }).wakeLock;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.gym = gymState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

/** Draw a game picture: a grid of cells, bars and lines, and its caption. `onCell` makes the grid tappable. */
export function renderFrame(f: Frame | null, onCell?: (i: number) => void): HTMLElement {
  const box = h('div.gymframe');
  if (!f) return box;
  if (f.grid) {
    // Small boards get big cells (finger-sized), big mazes fit the phone's width.
    const cell = f.grid.w <= 3 ? 80 : f.grid.w <= 7 ? 52 : 40;
    const g = h('div.gymgrid', { style: { gridTemplateColumns: `repeat(${f.grid.w}, minmax(0, 1fr))`, maxWidth: `${Math.min(360, f.grid.w * cell)}px` }, role: onCell ? 'grid' : 'img', 'aria-label': f.caption });
    if (f.grid.w > 9) g.classList.add('small');
    f.grid.cells.forEach((c, i) => {
      const el = h(onCell ? 'button' : 'div', { type: onCell ? 'button' : undefined, class: 'gymcell' }, c.t ?? '');
      if (c.c) {
        if (/^(hsl|#|rgb)/.test(c.c)) el.style.background = c.c;
        else for (const k of c.c.split(' ')) el.classList.add(k);
      }
      if (onCell) el.addEventListener('click', () => onCell(i));
      g.append(el);
    });
    box.append(g);
  }
  if (f.draw) {
    const d = f.draw;
    const s = svgEl('svg', { viewBox: `0 0 ${d.w} ${d.h}`, class: 'gymdraw', role: 'img', 'aria-label': f.caption });
    for (const sh of d.shapes) {
      if (sh.k === 'rect') s.append(svgEl('rect', { x: sh.x, y: sh.y, width: Math.max(0, sh.w), height: Math.max(0, sh.h), fill: sh.c }));
      else if (sh.k === 'line') s.append(svgEl('line', { x1: sh.x1, y1: sh.y1, x2: sh.x2, y2: sh.y2, stroke: sh.c, 'stroke-width': sh.sw ?? 2, 'stroke-linecap': 'round' }));
      else if (sh.k === 'circle') s.append(svgEl('circle', { cx: sh.cx, cy: sh.cy, r: sh.r, fill: sh.c }));
      else s.append(svgEl('polygon', { points: sh.pts.map((v) => v.toFixed(1)).join(' '), fill: sh.c }));
    }
    box.append(s);
  }
  if (f.bars?.length) box.append(h('div.gymbars', ...f.bars.map(([k, frac, t]) => h('div.bar', h('span', k), h('div.gauge', h('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` } })), h('b', t)))));
  if (f.lines?.length) box.append(h('div.gymlines', ...f.lines.map((l) => h('div', l))));
  box.append(h('div.gymcap', f.caption));
  return box;
}

/** The chart's top: the pass mark or the best reading, with a little headroom, to the next 10% (the calm looks scale it). */
export function chartTop(rec: GymRecord | null, game: GameMeta): number {
  if (!proLook()) return 1;
  const hi = Math.max(game.bar(rec?.level ?? 1), ...(rec?.history ?? []).map((p) => p.m));
  return Math.min(1, Math.ceil((hi + 0.06) * 10) / 10);
}

/** The mastery graph: one point per measurement, a dashed line where a level was passed, the bar to reach. */
function graph(rec: GymRecord | null, game: GameMeta): SVGSVGElement {
  const W = 300;
  const H = 96;
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gymgraph', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'Mastery over time' });
  const top = chartTop(rec, game);
  const y = (m: number) => H - 4 - (m / top) * (H - 10);
  s.append(svgEl('line', { x1: 0, x2: W, y1: y(top), y2: y(top), class: 'gymgrid100', 'vector-effect': 'non-scaling-stroke' }));
  s.append(svgEl('line', { x1: 0, x2: W, y1: y(top / 2), y2: y(top / 2), class: 'gymgrid100', 'vector-effect': 'non-scaling-stroke' }));
  const pts = rec?.history ?? [];
  if (rec) s.append(svgEl('line', { x1: 0, x2: W, y1: y(game.bar(rec.level)), y2: y(game.bar(rec.level)), class: 'gymgoal', 'vector-effect': 'non-scaling-stroke' }));
  if (pts.length >= 1) {
    const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W);
    pts.forEach((p, i) => {
      if (i && p.l !== pts[i - 1]!.l) s.append(svgEl('line', { x1: x(i), x2: x(i), y1: 0, y2: H, class: 'gymlevel' }));
    });
    s.append(svgEl('polyline', { points: pts.map((p, i) => `${x(i).toFixed(1)},${y(p.m).toFixed(1)}`).join(' '), class: 'gymline', 'vector-effect': 'non-scaling-stroke' }));
  }
  return s;
}

/**
 * An Activity-style ring (the calm looks): his mastery, 0–100%, with a tick at the pass mark of his
 * level — the number in or beside it is the same mastery, so the ring and the words always agree.
 */
function ring(size: number, cls: string): { el: SVGSVGElement; set(frac: number, goal?: number): void } {
  const r = 50 - 7;
  const C = 2 * Math.PI * r;
  const fg = svgEl('circle', { cx: 50, cy: 50, r, class: 'rfg', 'stroke-dasharray': `0 ${C}`, transform: 'rotate(-90 50 50)' });
  const tick = svgEl('line', { x1: 50, x2: 50, y1: -1, y2: 15, class: 'rgoal' });
  const el = svgEl('svg', { viewBox: '0 0 100 100', class: cls, width: size, height: size, 'aria-hidden': 'true' });
  el.append(svgEl('circle', { cx: 50, cy: 50, r, class: 'rtrack' }), fg, tick);
  return { el, set: (f, goal) => {
    fg.setAttribute('stroke-dasharray', `${(Math.max(0, Math.min(1, f)) * C).toFixed(1)} ${C.toFixed(1)}`);
    fg.style.opacity = f > 0.005 ? '1' : '0'; // no dot for nothing yet (the round cap would draw one)
    tick.setAttribute('transform', `rotate(${((goal ?? 0) * 360).toFixed(1)} 50 50)`);
    tick.style.display = goal ? '' : 'none';
  } };
}

/** Each game's glyph and colour (the calm looks' cards): what kind of game it is, at a glance. */
const GLYPH: Record<string, [string, string]> = {
  maze: ['#30d158', '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8.5 4v8h4M15.5 8.5V20M8.5 16h3.5"/>'],
  codebreaker: ['#ff9f0a', '<circle cx="5.5" cy="12" r="2"/><circle cx="10.2" cy="12" r="2"/><circle cx="14.8" cy="12" r="2"/><circle cx="19.5" cy="12" r="2"/><path d="M5.5 17.5h14"/>'],
  colony: ['#a2845e', '<path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z"/><circle cx="12" cy="12" r="2.4"/>'],
  trust: ['#5e5ce6', '<path d="M4 9h12.5l-3-3M20 15H7.5l3 3"/>'],
  tictactoe: ['#0a84ff', '<path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/>'],
  connect4: ['#ff453a', '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="8" cy="10" r="1.6"/><circle cx="12" cy="10" r="1.6"/><circle cx="16" cy="10" r="1.6"/><circle cx="8" cy="14.5" r="1.6"/><circle cx="12" cy="14.5" r="1.6"/><circle cx="16" cy="14.5" r="1.6"/>'],
  tiles: ['#ffd60a', '<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/>'],
  sudoku: ['#64d2ff', '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16"/><path d="M6 6.6h1.4" />'],
  countdown: ['#ff375f', '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M10 3h4M12 3v3.5"/>'],
  words: ['#30d158', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 16l3.5-8 3.5 8M9.8 13.2h4.4"/>'],
  logic: ['#bf5af2', '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7.2 7.6l3.8 8.6M16.8 7.6L13 16.2"/>'],
  brain: ['#ff6482', '<circle cx="5" cy="7" r="1.8"/><circle cx="5" cy="17" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="7" r="1.8"/><circle cx="19" cy="17" r="1.8"/><path d="M6.6 8l3.8 3M6.6 16l3.8-3M13.6 11l3.8-3M13.6 13l3.8 3"/>'],
  bughunt: ['#00c7be', '<ellipse cx="12" cy="13.5" rx="4.5" ry="6"/><path d="M12 8v11.5M7.5 11H4M7.5 15.5H4M16.5 11H20M16.5 15.5H20M9.6 6.2L8 4M14.4 6.2L16 4"/>'],
  escape: ['#ac8e68', '<path d="M6 20.5V4h10v16.5"/><path d="M16 5.5l3 1v13l-3 1"/><circle cx="13" cy="12.5" r=".9"/>'],
  factcheck: ['#40c8e0', '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M7.8 10.6l1.9 1.9 3.5-3.6"/>'],
  debate: ['#ff9f0a', '<path d="M3.5 5h10v7.5H8l-3 2.5v-2.5H3.5z"/><path d="M16.5 9h4v7.5H19V19l-3-2.5h-4.5v-1"/>'],
};
const glyphOf = (id: string) => GLYPH[id] ?? ['#8e8e93', '<circle cx="12" cy="12" r="7"/>'];

let opener: ((id?: string) => void) | null = null;
let waiting: string | null | undefined;

/** Open the GYM, optionally on one game (the `open_gym` command). */
export function openGym(id?: string): void {
  go('gym');
  if (opener) opener(id);
  else waiting = id ?? null;
}

export const gymTab: TabDef = {
  id: 'gym',
  title: 'GYM',
  icon: '<path d="M2 9v6M5 7v10M19 7v10M22 9v6"/><path d="M5 12h14"/>',
  scene: 'backdrop',
  blurb: `he teaches himself · ${GAMES.length} games`,
  mount(root) {
    const P = page(root, { tag: 'GYM', sub: 'Ghosty teaches himself by playing · on this phone', leftLabel: 'GAMES', rightLabel: 'GAME', stack: true });
    expose();
    const recs = new Map<string, GymRecord>();
    const views = new Map<string, Frame>();
    let open: GameMeta = GAMES[0]!;
    /** Bumped by RESET: worker messages about a game from before its reset are dropped. */
    const epochs: Record<string, number> = {};
    /** The game whose board shows a finished WATCH (kept until the owner does something else). */
    let held = '';
    let training: string | null = null;
    let resumeOnShow = '';
    let worker: Worker | null = null;
    let req = 0;
    /** Settles once the saved records are read: nothing goes to the worker before, or a fresh Level 1 would be saved over them. */
    let ready: Promise<unknown> = Promise.resolve();
    const replies = new Map<number, (m: Extract<GymOut, { gym: 'reply' }>) => void>();
    /** CONTINUE BY HIMSELF, KEEP AWAKE and how far TRAIN ALL got (kept in the store; read with the games). */
    let prefs: store.GymPrefs = { carry: true, awake: false, all: null };
    const savePrefs = () => void store.putPrefs({ ...prefs, all: prefs.all && { ...prefs.all, spent: { ...prefs.all.spent } } });
    /** TRAIN ALL is running (prefs.all says how far it has got). */
    let allOn = false;
    /** The run of level-ups the GYM toast on screen tells of. */
    let levelNote: LevelNote | null = null;
    /** Past a level he goes straight on (TRAIN ALL always does). */
    const carryNow = () => allOn || prefs.carry;

    // ======================= the worker
    const send = (m: unknown) => {
      if (!worker) {
        try {
          worker = new Worker('/textures.worker.js');
          worker.onmessage = (e: MessageEvent) => onWorker(e.data as GymOut);
          worker.onerror = (e) => {
            gymState.error = e.message || 'worker error';
            gymState.log.push(`worker error ${gymState.error}`);
            gymToast('The gym stopped: training could not run on this phone', 'bad');
            stopAll(false);
            training = null;
            gymState.training = '';
            paint();
          };
        } catch (e) {
          gymState.error = String(e);
          gymToast('Training cannot run on this phone', 'bad');
          return;
        }
      }
      const sent = m as { id?: unknown; rec?: unknown };
      if (sent.rec) gymState.handed[String(sent.id)] = (gymState.handed[String(sent.id)] ?? 0) + 1;
      worker.postMessage(m);
    };
    /**
     * The record (with what he has learned) goes to the worker once per game: the worker keeps its own
     * copy from then on, so moves, WATCH and pictures don't carry a big learner each time.
     */
    const handed = new Set<string>();
    const recFor = (id: string): GymRecord | null => {
      if (handed.has(id)) return null;
      // (Without a record the worker starts the game afresh and keeps that: nothing to hand over later either.)
      handed.add(id);
      return recs.get(id) ?? null;
    };
    const ask = (m: Record<string, unknown>) =>
      new Promise<Extract<GymOut, { gym: 'reply' }>>((resolve) => {
        void ready.then(() => {
          const id = ++req;
          replies.set(id, resolve);
          send({ ...m, req: id, rec: recFor(String(m.id)), epoch: epochs[String(m.id)] ?? 0 });
        });
      });
    /** Train game `id` in the worker (once the saved games are in, and if it is still the one to train). */
    const sendTrain = (id: string) => void ready.then(() => training === id && send({ gym: 'train', id, rec: recFor(id), epoch: epochs[id] ?? 0, carry: carryNow() }));
    const onWorker = (m: GymOut) => {
      if (m.gym === 'reply') {
        replies.get(m.req)?.(m);
        replies.delete(m.req);
        return;
      }
      // Anything about a game from before its RESET is stale.
      if (!current(epochs, m.gym === 'error' ? m.id : m.rec.id, m.epoch)) return;
      if (m.gym === 'error') {
        // Training itself failed in the worker (and stopped there).
        gymState.error = m.message || 'training failed';
        gymState.log.push(`training error ${m.id}: ${gymState.error}`);
        gymToast(`Training stopped: ${m.message}`, 'bad');
        if (training === m.id) {
          stopAll(false);
          training = null;
        }
        paint();
        return;
      }
      const rec = m.rec;
      const prev = recs.get(rec.id);
      // Progress carries no learner state: keep the last saved one.
      recs.set(rec.id, m.gym === 'save' ? rec : { ...rec, saved: prev?.saved ?? null });
      if (m.gym === 'save') {
        gymState.saves++;
        void store.put(rec);
      } else {
        gymState.progress++;
        views.set(rec.id, m.view);
        if (m.event) {
          // A run of level-ups close together is one toast ("Levels 4–6 passed"), the one GYM toast on screen.
          levelNote = joinLevels(levelNote, rec.id, m.event === 'mastered' ? rec.level : rec.level - 1, Date.now(), m.event === 'mastered');
          gymToast(`${gameById(rec.id)?.title}: ${levelText(levelNote, carryNow())}`, 'ok');
        }
        if (!m.training && training === rec.id) {
          // The worker stopped (all levels mastered, or a level passed with CONTINUE BY HIMSELF off): the page follows.
          gymState.log.push(`stopped ${rec.id}${rec.mastered ? ' (mastered)' : ''}`);
          training = null;
          // TRAIN ALL goes on to the next game.
          if (allOn && prefs.all?.current === rec.id) allNext();
        }
      }
      paint();
    };

    // ======================= GAMES: the cards (made once, updated in place so a tap is never lost to a repaint)
    const cardsP = panel('GAMES', { cls: 'gymgames' });
    const cards = h('div.gymcards');
    cardsP.body.append(cards);
    const cardParts = new Map<string, { b: HTMLButtonElement; small: HTMLElement; spark: HTMLElement; st: HTMLElement; sparkKey: string; ring: ReturnType<typeof ring>; lvl: HTMLElement }>();
    for (const g of GAMES) {
      const small = h('small');
      const sp = h('span.gymspark');
      const st = h('i.gymst');
      const rg = ring(46, 'gymring');
      const lvl = h('b.gymlvl');
      const [tint, glyph] = glyphOf(g.id);
      const b = h('button.gymcard', { type: 'button', dataset: { game: g.id } }, h('span.gymhead', h('span.sq.gymglyph', { style: `--tint:${tint}` }, icon(glyph)), h('span.gymtop', rg.el, lvl)), h('span.gymname', g.title), small, sp, st);
      b.addEventListener('click', () => {
        select(g.id);
        // the calm looks on a phone: the game is its own screen, "‹ Gym" back; the classic looks scroll to it
        if (pushes()) pushGame();
        else if (matchMedia('(max-width: 899px)').matches) gameP.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      cards.append(b);
      cardParts.set(g.id, { b, small, spark: sp, st, sparkKey: '', ring: rg, lvl });
    }
    // What he is doing now, at the top of the list (the calm looks): the game in training, or the one trained last.
    const nowRing = ring(44, 'gymring');
    const nowTitle = h('b');
    const nowSub = h('small');
    const nowKick = h('span.gymkick');
    const nowCard = h('button.gymnow', { type: 'button' }, h('span.gymtop', nowRing.el), h('span.gymnowtxt', nowKick, nowTitle, nowSub), h('i.chev', { 'aria-hidden': 'true' }));
    let nowId = '';
    nowCard.addEventListener('click', () => {
      if (!nowId) return;
      select(nowId);
      if (pushes()) pushGame();
    });
    cardsP.body.prepend(nowCard);
    // TRAIN ALL (every game in turn, the least learned first) and KEEP AWAKE beside it.
    const allBtn = button('TRAIN ALL', () => (allOn ? stopAll(true) : startAll()), 'on gymallbtn');
    const allStatus = h('div.gymallst', { role: 'status', 'aria-live': 'polite' });
    const awakeSw = toggle('KEEP AWAKE', 'Keeps the screen on while he trains (plug the phone in)', (on) => {
      note(`keep awake ${on ? 'on' : 'off'}`);
      prefs.awake = on;
      savePrefs();
      paint();
    });
    // Route C: the card opens with LEVELS BY GAME — a bar per game, highest level first, the mastered ones lit —
    // and TRAIN ALL with KEEP AWAKE in one row under it; then the games under their own heading.
    const lvlHead = h('div.gymlvhd', { dataset: { case: 'keep' } }, h('span.k'), h('span.lv', 'Lv 1–10'));
    const lvlBars = h('div.gymlvls', { 'aria-hidden': 'true' });
    awakeSw.el.prepend(h('span.bic', icon('<path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z"/>')));
    nowCard.after(h('div.gymall', lvlHead, lvlBars, allBtn, awakeSw.el, allStatus));
    const gamesHead = h('div.gymsec', { dataset: { case: 'keep' } }, h('b', 'Games'), h('span'));
    cards.before(gamesHead);
    // ======================= the game as a pushed screen (calm looks, phones)
    const pushes = () => proLook() && matchMedia('(max-width: 899px)').matches;
    let pushedGame = false;
    let shownLabel = '';
    const pushGame = () => {
      pushedGame = true;
      shownLabel = open.id;
      root.classList.add('gympush');
      const sc = root.querySelector<HTMLElement>('.hud');
      if (sc) sc.scrollTop = 0;
      pushScreen({ back: 'Gym', label: niceCase(open.title), pop: popGame });
    };
    const popGame = () => {
      if (!pushedGame) return;
      pushedGame = false;
      menu.classList.remove('open');
      root.classList.remove('gympush');
      popScreen();
      cardParts.get(open.id)?.b.scrollIntoView({ block: 'center' });
    };
    ui.subscribe((s, p) => s.tab !== p.tab && p.tab === 'gym' && popGame());

    // ======================= GAME: the open one
    const gameP = panel('GAME', { cls: 'gymgame' });
    const learns = h('div.gymlearns');
    const status = h('div.gymstatus', { role: 'status', 'aria-live': 'polite' });
    const trainBtn = button('TRAIN', () => toggleTrain(), 'on gymtrain');
    // WATCH: he trains and plays round after round while you watch; STOP ends it (the last picture stays).
    const watchBtn = button('WATCH', () => (watchOn === open.id ? stopWatching() : void watch()), 'gymwatch');
    const carrySw = toggle('CONTINUE BY HIMSELF', 'When he passes a level he goes straight on to the next. Off: he stops there and waits for you.', (on) => {
      note(`continue by himself ${on ? 'on' : 'off'}`);
      prefs.carry = on;
      savePrefs();
      if (training) send({ gym: 'carry', on: carryNow() });
      paint();
    });
    const playBtn = button('PLAY HIM', () => startPlay());
    playBtn.dataset.label = 'Play Ghosty'; // the calm looks' wording
    let resetArmed = 0;
    const resetBtn = button('RESET', () => reset(), 'warn');
    // The calm looks: RESET lives in a "…" menu that is its own confirmation (iOS's destructive action in a menu).
    const menuNote = h('p.gymmenunote');
    const menu = h('div.gymmenu', { role: 'menu' }, menuNote, resetBtn);
    const more = h('button.gymmore', { type: 'button', 'aria-label': 'More: reset this game', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('<circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/>'));
    more.addEventListener('click', () => {
      const on = !menu.classList.contains('open');
      menu.classList.toggle('open', on);
      more.setAttribute('aria-expanded', String(on));
    });
    document.addEventListener('pointerdown', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target as Node) && !more.contains(e.target as Node)) {
        menu.classList.remove('open');
        more.setAttribute('aria-expanded', 'false');
      }
    });
    const graphBox = h('div.gymgraphbox');
    // The open game at a glance (the calm looks): a big ring to the level's bar, the level, one word.
    const bigRing = ring(132, 'gymbigring');
    const heroLvl = h('b');
    const heroPct = h('span.gympct');
    const heroWord = h('span.gymword');
    const hero = h('div.gymhero', h('div.gymringbox', bigRing.el, h('div.gymringtxt', heroLvl)), h('div.gymherotxt', heroWord, heroPct));
    // The mastery chart as its own titled section: what the line is, and where he levels up.
    const legend = h('span.gymlegend');
    const axisTop = h('span', '100%');
    const axisMid = h('span', '50%');
    const xFrom = h('span');
    const xTo = h('span');
    const chart = h('section.gymchart', h('div.gymcharthead', h('b', 'Progress'), legend), h('div.gymplot', h('div.gymaxis', axisTop, axisMid, h('span', '0%')), graphBox, h('i'), h('div.gymxaxis', xFrom, xTo)));
    const detail = h('div.note.gymdetail');
    const board = h('div.gymboard');
    const secretIn = h('input', { placeholder: '', 'aria-label': 'Your secret', maxlength: '8', autocomplete: 'off', autocapitalize: 'off', spellcheck: false });
    const secretGo = button('GO', () => void watch(secretIn.value.trim()), 'on');
    const secretRow = h('div.keyrow.gymsecret', secretIn, secretGo);
    secretRow.hidden = true;
    gameP.body.append(hero, learns, status, h('div.gymactions', trainBtn, watchBtn, playBtn, more, menu), carrySw.el, chart, detail, secretRow, board);
    P.left.append(cardsP.el);
    P.right.append(gameP.el);

    // ======================= painting
    const paintHero = () => {
      const all = GAMES.map((g) => recs.get(g.id));
      const mastered = all.filter((r) => r?.mastered).length;
      const avg = all.reduce((t, r) => t + (r?.mastery ?? 0), 0) / GAMES.length;
      const levels = all.reduce((t, r) => t + (r ? r.level - 1 + (r.mastered ? 1 : 0) : 0), 0);
      P.big.textContent = `${mastered} OF ${GAMES.length} MASTERED`;
      // A fixed line: text that changes length here would shift every button below it mid-tap.
      P.sub.textContent = proLook() ? 'Ghosty teaches himself by playing, on this phone.' : 'Ghosty teaches himself by playing · on this phone';
      P.dials([
        ['MASTERY', avg, `${Math.round(avg * 100)}%`],
        ['LEVELS', levels / (GAMES.length * 10), `${levels}`],
        ['MASTERED', mastered / GAMES.length, `${mastered}`],
      ]);
    };
    const stateOf = (g: GameMeta, r: GymRecord | undefined) => (r?.mastered ? 'MASTERED' : training === g.id ? 'TRAINING' : r?.units ? 'PAUSED' : 'NEW');
    const paintCards = () => {
      for (const g of GAMES) {
        const c = cardParts.get(g.id)!;
        const r = recs.get(g.id);
        const st = stateOf(g, r);
        c.b.classList.toggle('on', g.id === open.id);
        c.b.setAttribute('aria-pressed', String(g.id === open.id));
        c.small.textContent = r?.mastered ? 'ALL 10 LEVELS' : r ? `LEVEL ${r.level} · ${Math.round(r.mastery * 100)}%` : 'LEVEL 1 · --';
        // the ring is his mastery, the tick the pass mark of his level; the words say the same numbers
        const pct = r ? Math.floor(r.mastery * 100) : 0;
        c.ring.set(r?.mastered ? 1 : r?.mastery ?? 0, r && !r.mastered ? g.bar(r.level) : 0);
        c.lvl.textContent = String(r?.level ?? 1);
        // nothing has happened yet: an empty ring and "Not started"
        c.b.classList.toggle('fresh', !r?.units);
        c.b.classList.toggle('mastered', !!r?.mastered);
        // route C: the pill says the state in one word (the level line above says the numbers)
        c.st.dataset.label = proLook() ? (st === 'NEW' ? 'Not started' : st === 'MASTERED' ? 'Mastered' : st === 'TRAINING' ? 'Training' : 'Paused') : st === 'NEW' ? 'Not started' : st === 'MASTERED' ? 'Mastered · all 10 levels' : `${st === 'TRAINING' ? 'Learning' : 'Paused'} · Level ${r?.level ?? 1} · ${pct}%`;
        c.st.textContent = st;
        c.st.className = `gymst ${st.toLowerCase()}`;
        const pts = r?.history.map((p) => p.m) ?? [];
        const key = `${proLook()}${st}${pts.join(',')}`;
        if (key !== c.sparkKey) {
          c.sparkKey = key;
          clear(c.spark, proLook() ? sparkline(pts, 140, 26, st === 'MASTERED' || st === 'TRAINING') : spark(pts, 70, 18));
        }
      }
      gymState.cards = GAMES.length;
      // "Training now" (or the game trained last), the same numbers as its card
      const last = [...recs.values()].filter((r) => r.units).sort((a, b) => b.updated - a.updated)[0];
      const g = training ? gameById(training) : last ? gameById(last.id) : undefined;
      const r = g ? recs.get(g.id) : undefined;
      nowId = g?.id ?? '';
      nowCard.classList.toggle('idle', !g);
      nowCard.classList.toggle('live', !!training);
      nowKick.textContent = training ? 'Training now' : g ? 'Trained last' : 'Nothing in training';
      nowTitle.textContent = g ? niceCase(g.title) : 'Pick a game, then Train';
      nowSub.textContent = g && r ? (r.mastered ? 'Mastered · all 10 levels' : `Level ${r.level} · ${Math.floor(r.mastery * 100)}% · ${Math.floor(r.mastery * 100) >= Math.round(g.bar(r.level) * 100) ? `past the ${Math.round(g.bar(r.level) * 100)}% mark` : `passes at ${Math.round(g.bar(r.level) * 100)}%`}`) : 'He learns by playing, on this phone, even while you use other screens.';
      nowRing.set(r?.mastered ? 1 : r?.mastery ?? 0, g && r && !r.mastered ? g.bar(r.level) : 0);
    };
    const paintGame = () => {
      const r = recs.get(open.id) ?? null;
      gameP.title.textContent = open.title;
      gameP.setStatus(r ? `LEVEL ${r.level}${r.mastered ? ' · MASTERED' : ''}` : 'LEVEL 1', training === open.id ? 'ok' : r?.mastered ? 'ok' : 'mid');
      learns.textContent = open.learns;
      const word = stateOf(open, r ?? undefined);
      // One ring (his mastery, a tick at the pass mark), the same number in it, one line saying it in words.
      const bar = Math.round(open.bar(r?.level ?? 1) * 100);
      const pct = r?.mastered ? 100 : r ? Math.floor(r.mastery * 100) : 0;
      bigRing.set(pct / 100, r?.mastered ? 0 : open.bar(r?.level ?? 1));
      hero.classList.toggle('fresh', !r?.units);
      heroLvl.textContent = `${pct}%`;
      heroWord.textContent = r?.mastered ? 'Mastered' : `Level ${r?.level ?? 1}`;
      heroWord.className = `gymword ${word.toLowerCase()}`;
      const doing = word === 'TRAINING' ? 'Learning' : word === 'PAUSED' ? 'Paused' : 'Not started';
      // (past the mark between two measurements: the next measurement makes the next level)
      heroPct.textContent = r?.mastered ? 'Every level passed' : pct >= bar && r?.units ? `${doing} · ${pct}% mastered · past the ${bar}% mark, Level ${r.level + 1} next` : `${doing} · ${pct}% mastered · passes at ${bar}%`;
      clear(legend, h('i.sw'), 'Mastery', h('i.sw.dash'), `Pass mark ${bar}%`);
      const top = chartTop(r, open);
      axisTop.textContent = `${Math.round(top * 100)}%`;
      axisMid.textContent = `${Math.round(top * 50)}%`;
      const pts = r?.history ?? [];
      xFrom.textContent = pts.length ? `${fmt.n(pts[0]!.u)}` : '';
      xTo.textContent = pts.length ? `${fmt.n(pts.at(-1)!.u)} ${open.unit}` : `${open.unit} played`;
      menuNote.textContent = `Reset ${niceCase(open.title)}? He forgets everything he learned in it.`;
      resetBtn.dataset.label = `Reset ${niceCase(open.title)}`;
      if (pushedGame && shownLabel !== open.id) {
        shownLabel = open.id;
        pushScreen({ back: 'Gym', label: niceCase(open.title), pop: popGame });
      }
      status.textContent = statusLine(r, open, training === open.id);
      trainBtn.textContent = training === open.id ? 'PAUSE' : r?.mastered ? 'MASTERED' : 'TRAIN';
      trainBtn.disabled = !!r?.mastered;
      watchBtn.textContent = watchOn === open.id ? 'STOP' : 'WATCH';
      carrySw.set(prefs.carry);
      playBtn.hidden = !open.play;
      clear(graphBox, graph(r, open));
      detail.textContent = r?.detail ? `${r.detail} Level ${r.level} needs ${Math.round(open.bar(r.level) * 100)}%.` : `Mastery is checked against ground truth, never his own say-so. Level 1 needs ${Math.round(open.bar(1) * 100)}%.`;
      secretRow.hidden = open.play !== 'secret' || gymState.play.game !== open.id;
      // The board shows what he knows — unless a WATCH is playing or just finished, or the owner is playing him.
      if (!gymState.watching && held !== open.id && gymState.play.game !== open.id) clear(board, renderFrame(views.get(open.id) ?? null));
    };
    const paintAll = () => {
      const run = prefs.all;
      const g = run?.current ? gameById(run.current) : undefined;
      const mastered = GAMES.filter((x) => recs.get(x.id)?.mastered).length;
      allStatus.textContent = allLine(run, allOn, g ? niceCase(g.title) : '', recs.get(run?.current ?? '')?.level ?? 1, mastered, GAMES.length);
      allBtn.textContent = allOn ? 'STOP' : 'TRAIN ALL';
      // route C: the words as a label (its glyph sits beside them, so the button's own text is not sentence-cased)
      allBtn.dataset.label = allOn ? 'Stop' : 'Train all';
      allBtn.disabled = !allOn && mastered >= GAMES.length;
      const can = !!wakeLock();
      awakeSw.set(prefs.awake, can, can ? undefined : 'This phone’s browser cannot keep the screen on');
      gymState.all = { on: allOn, current: run?.current ?? '', line: allStatus.textContent };
      // LEVELS BY GAME: each game's level (a level passed counts whole; Level 10 passed is mastered), highest first
      const levels = GAMES.map((x) => {
        const r = recs.get(x.id);
        return { id: x.id, lv: !r?.units ? 0 : r.mastered ? 10 : Math.max(1, r.level - 1 + r.mastery), done: !!r?.mastered };
      }).sort((a, b) => b.lv - a.lv);
      clear(lvlHead.firstChild as HTMLElement, 'Levels by game · ', h('b', `${mastered} of ${GAMES.length}`), ' mastered');
      clear(lvlBars, h('i.g', { style: { bottom: '50%' } }), ...levels.map((x) => h(`i.b${x.done ? '.m' : x.lv ? '' : '.z'}` as 'i', { style: { height: `${Math.max(8, (x.lv / 10) * 100)}%` }, dataset: { game: x.id } })));
      const fresh = GAMES.filter((x) => !recs.get(x.id)?.units).length;
      (gamesHead.lastChild as HTMLElement).textContent = `${GAMES.length} games${fresh ? ` · ${fresh} not started` : ''}`;
      gymState.awake.on = prefs.awake;
      gymState.awake.can = can;
    };
    const paint = () => {
      gymState.training = training ?? '';
      gymState.watchOn = watchOn;
      gymState.carry = prefs.carry;
      for (const [id, r] of recs) gymState.recs[id] = { level: r.level, mastery: r.mastery, units: r.units, mastered: r.mastered };
      paintHero();
      paintCards();
      paintGame();
      paintAll();
      syncLock();
    };

    // ======================= KEEP AWAKE: a screen wake lock while he trains (the phone lets go of it when hidden)
    let lock: Lock | null = null;
    let locking = false;
    const wantAwake = () => prefs.awake && !document.hidden && (allOn || !!training);
    const syncLock = () => {
      const api = wakeLock();
      if (!api) return;
      if (wantAwake() && !lock && !locking) {
        locking = true;
        gymState.awake.requests++;
        api.request('screen').then(
          (l) => {
            locking = false;
            lock = l;
            gymState.awake.held = true;
            l.addEventListener('release', () => {
              if (lock === l) lock = null;
              gymState.awake.held = !!lock;
            });
            // (training may have stopped while it was being asked for)
            if (!wantAwake()) syncLock();
          },
          (e: unknown) => {
            locking = false;
            note(`keep awake refused: ${String((e as Error)?.message ?? e)}`);
          },
        );
      } else if (!wantAwake() && lock) {
        const l = lock;
        lock = null;
        gymState.awake.held = false;
        void l.release().catch(() => undefined);
      }
    };

    // ======================= TRAIN ALL: every game in turn, the least learned first, 20 minutes each a round
    let allTimer = 0;
    let allTick = 0;
    let allSaved = 0;
    /** On to TRAIN ALL's next game (or done: every game mastered). */
    const allNext = () => {
      const run = (prefs.all ??= newAllRun());
      const pick = nextForAll(GAMES.map((g) => g.id), recs, run.spent);
      if (!pick) {
        note('all mastered');
        stopAll(true);
        gymToast('Every game mastered', 'ok');
        return;
      }
      if (pick.newRound) {
        run.spent = {};
        run.round++;
      }
      run.current = pick.id;
      note(`all ${pick.id}`);
      training = pick.id;
      allTick = Date.now();
      sendTrain(pick.id);
      savePrefs();
      paint();
    };
    /** Once a second: count his training time, move on when this game's time is up, keep the line live. */
    const allClock = () => {
      const run = prefs.all;
      if (!allOn || !run || document.hidden) return;
      const t = Date.now();
      // (only time he really trains counts: not while the app was away, nor a timer that slept)
      if (training === run.current) {
        const dt = Math.max(0, Math.min(5000, t - allTick));
        run.spent[run.current] = (run.spent[run.current] ?? 0) + dt;
        run.total += dt;
      }
      allTick = t;
      if ((run.spent[run.current] ?? 0) >= ALL_BUDGET) return allNext();
      if (t - allSaved > 15000) {
        allSaved = t;
        savePrefs();
      }
      paintAll();
    };
    const startAll = () => {
      note('train all');
      stopWatch();
      held = '';
      allOn = true;
      allSaved = Date.now();
      clearInterval(allTimer);
      allTimer = window.setInterval(allClock, 1000);
      allNext();
    };
    /** TRAIN ALL stops (STOP, PAUSE, or the owner chose one game); `pause` stops the training too. */
    const stopAll = (pause: boolean) => {
      if (!allOn) return;
      note(pause ? 'stop all' : 'all ended');
      allOn = false;
      clearInterval(allTimer);
      if (pause && training) {
        send({ gym: 'pause' });
        training = null;
        stopWatch();
      }
      if (pause) resumeOnShow = '';
      savePrefs();
      paint();
    };

    // ======================= actions
    const note = (x: string) => {
      gymState.log.push(x);
      if (gymState.log.length > 30) gymState.log.shift();
    };
    const select = (id: string) => {
      note(`select ${id}`);
      const g = gameById(id);
      if (!g) return;
      stopWatch();
      held = '';
      disarmReset();
      menu.classList.remove('open');
      more.setAttribute('aria-expanded', 'false');
      if (gymState.play.game && gymState.play.game !== id) gymState.play = { game: '', board: [], over: '', thinking: false };
      open = g;
      gymState.open = id;
      paint();
      if (!views.has(id) && recs.has(id)) void ask({ gym: 'view', id }).then((m) => m.view && (views.set(id, m.view), paint()));
    };
    const toggleTrain = () => {
      note(training === open.id ? `pause ${open.id}` : `train ${open.id}`);
      if (training === open.id) {
        // PAUSE stops everything here: the training, WATCH (its last picture stays) and TRAIN ALL.
        stopAll(true);
        if (training) send({ gym: 'pause' });
        training = null;
        stopWatch();
      } else {
        // The owner picked one game: TRAIN ALL (if it was running) hands over to it.
        stopAll(false);
        stopWatch();
        held = '';
        const id = open.id;
        training = id;
        sendTrain(id);
      }
      paint();
    };
    let disarmTimer = 0;
    const disarmReset = () => {
      resetArmed = 0;
      clearTimeout(disarmTimer);
      resetBtn.textContent = 'RESET';
    };
    const reset = () => {
      // the calm looks' menu was the confirmation; the classic looks ask with a second tap
      menu.classList.remove('open');
      if (!proLook() && Date.now() - resetArmed > 3000) {
        resetArmed = Date.now();
        resetBtn.textContent = 'SURE? TAP AGAIN';
        clearTimeout(disarmTimer);
        disarmTimer = window.setTimeout(disarmReset, 3000);
        return;
      }
      disarmReset();
      gymState.log.push(`reset ${open.id}`);
      if (training === open.id) {
        stopAll(false);
        training = null;
      }
      // A new epoch: whatever the worker still sends about the old game is dropped.
      epochs[open.id] = (epochs[open.id] ?? 0) + 1;
      held = '';
      gymState.play = { game: '', board: [], over: '', thinking: false };
      stopWatch();
      send({ gym: 'reset', id: open.id, epoch: epochs[open.id] });
      handed.delete(open.id);
      recs.delete(open.id);
      views.delete(open.id);
      delete gymState.recs[open.id];
      void store.remove(open.id);
      gymToast(`${open.title}: back to the start`, 'warn');
      paint();
    };

    /** On a phone the board is below the buttons: bring it into view. */
    const showBoard = () => {
      if (matchMedia('(max-width: 899px)').matches) board.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
    };

    // WATCH: his frames, one every 0.45 s on the app's one animation loop. He trains meanwhile, and plays
    // round after round — on through the levels by himself — until STOP, PAUSE, Level 10 mastered (or a level
    // passed with CONTINUE BY HIMSELF off), or another game.
    let stopAnim: (() => void) | null = null;
    /** The game in WATCH. */
    let watchOn = '';
    /** WATCH started his training (so STOP stops it too). */
    let watchTrains = false;
    let watchGap = 0;
    let resumeWatch = '';
    const endFrames = () => {
      stopAnim?.();
      stopAnim = null;
      gymState.watching = false;
    };
    const stopWatch = () => {
      endFrames();
      clearTimeout(watchGap);
      watchOn = '';
      gymState.watchOn = '';
    };
    /** STOP: the watching ends (its last picture stays), and the training if WATCH started it. */
    const stopWatching = () => {
      note(`stop ${open.id}`);
      const id = watchOn;
      stopWatch();
      if (watchTrains && training === id) {
        stopAll(true);
        if (training) send({ gym: 'pause' });
        training = null;
      }
      paint();
    };
    /**
     * One round of his play, shown frame by frame; with `loop`, then the next, while WATCH is on and he still
     * trains this game. (A secret the owner picked, or a game already mastered, is one round.)
     */
    const round = async (id: string, loop: boolean, secret?: string) => {
      const m = await ask({ gym: 'watch', id, seed: Math.floor(Math.random() * 1e6), secret });
      if (m.error) {
        clear(board, h('div.note.bad', `He could not play that: ${m.error}`));
        if (watchOn === id) stopWatch();
        paint();
        return;
      }
      if (open.id !== id || held !== id || !m.frames?.length) return;
      if (loop && watchOn !== id) return;
      const frames = m.frames;
      let i = 0;
      endFrames();
      gymState.watching = true;
      gymState.frames = 0;
      gymState.rounds++;
      const show = () => {
        clear(board, renderFrame(frames[i]!));
        gymState.frames = i + 1;
      };
      show();
      if (gymState.rounds === 1) showBoard();
      stopAnim = onFrame(() => {
        if (++i >= frames.length) {
          endFrames();
          if (!loop || watchOn !== id) return;
          // The end of the round stays a moment; then the next one, at whatever level he has reached.
          if (training === id && open.id === id) watchGap = window.setTimeout(() => watchOn === id && training === id && void round(id, true), 1200);
          else {
            // He stopped training (Level 10 mastered, a level passed with CONTINUE BY HIMSELF off, PAUSE): so does WATCH.
            stopWatch();
            paint();
          }
          return;
        }
        show();
      }, frames[0]!.every ?? 0.45);
    };
    const watch = async (secret?: string) => {
      note(`watch ${open.id}`);
      stopWatch();
      gymState.play = open.play === 'secret' && secret != null ? gymState.play : { game: '', board: [], over: '', thinking: false };
      const id = open.id;
      held = id;
      gymState.rounds = 0;
      // A secret the owner picked is one game; otherwise WATCH trains him too (unless every level is mastered).
      const loop = secret == null && !recs.get(id)?.mastered;
      if (loop) {
        watchOn = id;
        gymState.watchOn = id;
        watchTrains = training !== id;
        if (training !== id) {
          stopAll(false);
          training = id;
          sendTrain(id);
        }
        paint();
      }
      clear(board, h('div.note', 'He is getting ready…'));
      await round(id, loop, secret);
    };

    // PLAY HIM: on the board (tic-tac-toe, Connect 4) you move first; or you pick his secret.
    const startPlay = () => {
      stopWatch();
      held = '';
      if (open.play === 'secret') {
        gymState.play = { game: open.id, board: [], over: '', thinking: false };
        secretIn.value = '';
        secretIn.placeholder = open.id === 'words' ? 'a five-letter word, e.g. HOUSE' : 'a code, e.g. 1234';
        clear(board, h('div.note', open.id === 'words' ? 'Type a word from his list and tap GO — he will try to guess it.' : 'Type a code (digits from 1 up to the number of symbols at his level) and tap GO — he will try to crack it.'));
        paint();
        secretIn.focus();
        return;
      }
      const big = BOARDS[open.id];
      gymState.play = { game: open.id, board: big ? big.start() : open.id === 'tictactoe' ? new Array(9).fill(0) : new Array(42).fill(0), over: '', thinking: false };
      sel = { path: [] };
      last = [];
      choices = null;
      paintPlay(big ? big.hello : 'Your move: you are X.');
      paint();
      showBoard();
    };
    // The bigger boards (checkers, chess, Go): what the owner has picked, his last move, a promotion choice.
    let sel: Sel = { path: [] };
    let last: number[] = [];
    let choices: [string, number][] | null = null;
    const paintBig = (caption: string) => {
      const big = BOARDS[open.id]!;
      const pl = gymState.play;
      const mine = !pl.over && !pl.thinking;
      const f = big.frame(pl.board, sel, caption, last);
      const row = h('div.row.wrap.gymagain');
      if (choices && mine) for (const [label, mv] of choices) row.append(button(label, () => void ownerMove(mv), 'on'));
      if (big.extra && mine && !choices) row.append(button(big.extra.label, () => void ownerMove(big.extra!.move)));
      row.append(button('NEW GAME', () => startPlay()));
      clear(board, renderFrame(f, mine ? (i) => bigTap(i) : undefined), row);
      gymState.play.sel = sel.path.slice();
    };
    const bigTap = (cell: number) => {
      const big = BOARDS[open.id]!;
      const pl = gymState.play;
      if (pl.over || pl.thinking) return;
      const t = big.tap(pl.board, sel, cell);
      sel = t.sel;
      choices = t.choices ?? null;
      if (t.state) {
        pl.board = t.state;
        last = [];
        void afterOwner(t.caption ?? '');
      } else paintBig(t.caption ?? 'Your move.');
    };
    /** The owner chose a move by a button (a promotion, PASS). */
    const ownerMove = async (mv: number) => {
      const big = BOARDS[open.id]!;
      const pl = gymState.play;
      if (pl.over || pl.thinking) return;
      const r = big.apply(pl.board, mv);
      if (!r.said) return paintBig('That move is not possible now.');
      pl.board = r.state;
      sel = { path: [] };
      choices = null;
      last = [];
      await afterOwner(`You played ${r.said}.`);
    };
    /** After the owner's move: is it over? If not, he answers. */
    const afterOwner = async (said: string) => {
      const big = BOARDS[open.id]!;
      const pl = gymState.play;
      pl.over = big.over(pl.board);
      if (pl.over) return paintBig(pl.over);
      pl.thinking = true;
      paintBig(`${said} He is thinking…`);
      const m = await ask({ gym: 'move', id: open.id, board: pl.board.slice() });
      pl.thinking = false;
      if (gymState.play !== pl) return;
      if (m.error || m.move == null || m.move < -1) return paintBig(m.error ? `He could not move: ${m.error}` : 'Your move.');
      const r = big.apply(pl.board, m.move);
      pl.board = r.state;
      last = r.cells;
      pl.over = big.over(pl.board);
      gymState.play.replies = (gymState.play.replies ?? 0) + 1;
      paintBig(pl.over ? `He played ${r.said}. ${pl.over}` : `He played ${r.said}. Your move.`);
    };
    const paintPlay = (caption: string) => {
      if (BOARDS[open.id]) return paintBig(caption);
      const b = gymState.play.board;
      const f = open.id === 'tictactoe' ? tttFrame(b, caption) : c4Frame(posFromBoard(b), caption);
      clear(board, renderFrame(f, gymState.play.over || gymState.play.thinking ? undefined : (i) => void humanMove(i)), h('div.row.wrap.gymagain', button('NEW GAME', () => startPlay())));
    };
    const outcome = (): string => {
      const b = gymState.play.board;
      const w = open.id === 'tictactoe' ? tttWinner(b) : winnerOf(posFromBoard(b));
      return w === 1 ? 'You win!' : w === 2 ? 'He wins.' : w === 3 ? 'A draw.' : '';
    };
    const humanMove = async (cell: number) => {
      const pl = gymState.play;
      if (pl.over || pl.thinking) return;
      if (open.id === 'tictactoe') {
        if (pl.board[cell]) return;
        pl.board[cell] = 1;
      } else {
        const p = posFromBoard(pl.board);
        const col = cell % 7;
        if (!canPlay(p, col)) return;
        c4Play(p, col);
        pl.board = Array.from(p.b);
      }
      pl.over = outcome();
      if (pl.over) return paintPlay(pl.over);
      pl.thinking = true;
      paintPlay('He is thinking…');
      const m = await ask({ gym: 'move', id: open.id, board: pl.board.slice() });
      pl.thinking = false;
      if (gymState.play !== pl) return;
      if (m.error || m.move == null || m.move < 0) return paintPlay(m.error ? `He could not move: ${m.error}` : 'Your move.');
      if (open.id === 'tictactoe') pl.board[m.move] = 2;
      else {
        const p = posFromBoard(pl.board);
        c4Play(p, m.move);
        pl.board = Array.from(p.b);
      }
      pl.over = outcome();
      paintPlay(pl.over || (open.id === 'tictactoe' ? `He took square ${m.move + 1}. Your move.` : `He dropped in column ${m.move + 1}. Your move.`));
    };
    secretIn.addEventListener('keydown', (e) => e.key === 'Enter' && void watch(secretIn.value.trim()));

    // ======================= hidden app → pause (and save); back → carry on
    const onVisible = () => {
      note(`visibility ${document.visibilityState}`);
      if (document.hidden && training) {
        resumeOnShow = training;
        resumeWatch = watchOn;
        send({ gym: 'pause' });
        training = null;
        stopWatch();
        paint();
      } else if (!document.hidden && resumeOnShow) {
        const id = resumeOnShow;
        resumeOnShow = '';
        training = id;
        sendTrain(id);
        // (TRAIN ALL counts from now: the time away was not training)
        allTick = Date.now();
        if (resumeWatch === id && open.id === id) {
          watchOn = id;
          held = id;
          void round(id, true);
        }
        resumeWatch = '';
        paint();
      } else if (!document.hidden) syncLock(); // the phone let go of the wake lock while hidden: ask again
    };
    document.addEventListener('visibilitychange', onVisible);
    addEventListener('pagehide', () => training && send({ gym: 'pause' }));

    opener = (id) => id && select(id);
    gymState.open = open.id;
    paint();
    // (Switches touched before the settings are read keep the owner's choice.)
    const fresh = { ...prefs };
    ready = Promise.all([store.loadAll(), store.loadPrefs()]).then(([all, kept]) => {
      prefs = { carry: prefs.carry !== fresh.carry ? prefs.carry : kept.carry, awake: prefs.awake !== fresh.awake ? prefs.awake : kept.awake, all: prefs.all ?? kept.all };
      // (A game RESET while this was loading stays reset.)
      for (const [id, r] of all) if (!recs.has(id) && !epochs[id]) recs.set(id, r);
      paint();
      if (waiting !== undefined) {
        const w = waiting;
        waiting = undefined;
        if (w) select(w);
      }
    });

    return {
      describe() {
        const r = recs.get(open.id);
        return `GYM tab: ${open.title} open (${statusLine(r ?? null, open, training === open.id)}). ${allOn ? `${allStatus.textContent}.` : `${GAMES.filter((g) => recs.get(g.id)?.mastered).length} of ${GAMES.length} games mastered.`}`;
      },
    };
  },
};
