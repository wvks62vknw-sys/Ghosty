/**
 * What the five 2-D games of pass 4 share, so each game is only its rules and its drawing: the Engine the player starts
 * (a fresh canvas, the shared Intent, the SaveStore, the events), the kit's overlay for the menus (Play · How to play ·
 * Sound · Quit), the fixed-step loop, the keyboard and the pad folded into one input, pause on a tap or when the page is
 * hidden, the sound, the score and the LEVEL through scores.ts and skill.ts, Ghosty's own level and his practice, and the
 * title screen's attract mode (Ghosty plays the game behind the menu with the weights he has learned). A game gives a
 * `Rules<R>`: how to start a run, step it, draw it, drain its events, who won, and the bot that plays it.
 */
import { DAMAGED_SAVE } from '../board/keep';
import { h } from '../../../core/dom';
import type { SaveStore } from '../../engines/saves';
import type { EngineEvents, EngineFiles, EngineHandle } from '../../engines/types';
import type { Intent } from '../../input';
import { recordScore, recordSitting, scoreOf } from '../../scores';
import { Synth, Tune, type TuneSpec } from '../audio';
import { accentHex, clamp, cssSize, fitCanvas, type GameEngine, type GameStats, haptic, hapticIfNoVibrate, hudButton, Loop, type MenuSpec, num, Overlay, Resolution } from '../kit';
import { bookOf, finishRun, levelOf, levelWords, type PracticeGame, practiceSession, rng } from './skill';

/** A fixed step of the rules (a sixtieth of a second). */
export const STEP = 1 / 60;

/** What the player did this frame: the names held now, and the ones that went down this frame. */
export interface Input {
  held: ReadonlySet<string>;
  pressed: ReadonlySet<string>;
}
export const NOINPUT: Input = { held: new Set(), pressed: new Set() };

/** Something that happened in a step: the shell turns it into a sound, a haptic and a word. */
export interface Evt {
  type: string;
  n?: number;
  x?: number;
  y?: number;
  kind?: string;
}

export interface StartOpts {
  level: number;
  seed: number;
  /** Ghosty's learned weights (a game with an opponent of his, or none: null). */
  theta: readonly number[] | null;
  /** The words the player handed the engine (a spec's switches). */
  args?: readonly string[];
  /** What a saved game decoded to (a game with `persist`: CONTINUE hands it back). */
  resume?: unknown;
}
export interface View {
  w: number;
  h: number;
  /** Seconds since the game opened (for things that move on their own). */
  t: number;
  accent: string;
  mode: Mode;
  level: number;
  target: number;
  ghostyLevel: number;
  /** The best score and Ghosty's, for a marker. */
  best: number;
  ghostyBest: number | null;
  /** The bottom of the screen the game's own controls cover (px). */
  reserve: number;
  /** A demonstration run behind the title menu. */
  demo: boolean;
}
export interface Pointer {
  kind: 'down' | 'move' | 'up';
  x: number;
  y: number;
  id: number;
  w: number;
  h: number;
}
export type Mode = 'title' | 'play' | 'paused' | 'over' | 'gone';

export interface Ends {
  title: string;
  tip: string;
  /** Lines for the end screen in place of the score line (the cave's time and crystals). */
  notes?: string[];
}

/** A card the game puts up over itself: a speaker or an item, and the pages said one at a time. */
export interface Card {
  title: string;
  pages: string[];
}

/** The buttons a game draws under the thumbs: build them with `button`, the shell lays them out in `.g4ctl`. */
export interface ControlApi {
  button(o: { label: string; aria: string; name: string; hold?: boolean; cls?: string }): HTMLButtonElement;
  /** A key's worth of press from a gesture. */
  press(name: string): void;
  hold(name: string, on: boolean): void;
}

export interface Rules<R> {
  /** The shelf id (the scores' and the skill's key), the engine id, the words. */
  id: string;
  engine: string;
  /** "Blocks": the title menu's heading and the canvas's label. */
  title: string;
  /** Ghosty's line for the title, a how-to in paragraphs. */
  line: string;
  how: string[];
  /** Ghosty's best score id (scores.ts) and how a score reads: "12 pipes". */
  ghostyId: string;
  words(score: number): string;
  /** Where a game's run lasts: what a level asks as a score. */
  target(level: number): number;
  start(o: StartOpts): R;
  /** One fixed step. `inp.pressed` is only filled on the first step of a frame. */
  step(r: R, dt: number, inp: Input): void;
  drain(r: R): Evt[];
  score(r: R): number;
  over(r: R): boolean;
  /** Whether the run passed its level (the default: the score reached the target). */
  passed?(r: R, target: number): boolean;
  ends(r: R): Ends;
  draw(g: CanvasRenderingContext2D, r: R, v: View): void;
  /** Pointer gestures on the play area (a drag, a tap). */
  pointer?(r: R | null, p: Pointer, api: ControlApi): void;
  controls?(api: ControlApi): HTMLElement[];
  /** Bottom space the controls cover. */
  reserve?: number;
  /** Ghosty's bot acts on a run for one step (the attract mode, `auto`, and his practice). */
  bot(r: R, theta: readonly number[], dt: number): void;
  practice: PracticeGame;
  sound(s: Synth, e: Evt): void;
  /** A haptic for an event: 'hit' for a knock, 'tick' for a light one. */
  haptic?(e: Evt): 'hit' | 'tick' | null;
  music?: { spec: TuneSpec; specFor?(r: R): TuneSpec; pace(r: R): number };
  /** A tune of the game's own, made when a run starts (the studio's note language): started, stopped and paused as the music is. */
  makeTune?(s: Synth, r: R): { start(): void; stop(): void } | null;
  /** A game that keeps a place in the arcade's save store: NEW GAME and CONTINUE, saved when it says an event 'save'. */
  persist?: { name: string; encode(r: R): string; decode(raw: string): unknown | null };
  /** A card to show for an event (null: none); the game waits behind it. */
  card?(e: Evt, r: R): Card | null;
  /** The pause menu's line (the score and the mark by default). */
  pauseLine?(r: R, target: number): string;
  /** The state the spec reads (plain data). */
  peek?(r: R): Record<string, unknown>;
  /** A line shown as the run goes on, from the events. */
  say?(e: Evt, r: R): string | null;
  /**
   * A game of the studio (BRIEF-EDITOR-GAME-STUDIO) is his own, not a level of ours: no level, no pass mark and no
   * Ghosty beside it. Its best score is still kept. Nothing else about the frame changes.
   */
  plain?: boolean;
  /** A sheet the game wants up (a shop, his things): asked for after each frame; `redo` draws it again, `close` puts it away. */
  sheet?(r: R, api: { redo(): void; close(): void }): MenuSpec | null;
  /** A card or a sheet was closed: the game goes on from here. */
  closed?(r: R): void;
}

export interface GameHandle extends EngineHandle {
  peek(): GameStats2;
  resetStats(): void;
}
export interface GameStats2 extends GameStats {
  score: number;
  level: number;
  ghostyLevel: number;
  best: number;
  passed: boolean;
  state: Record<string, unknown>;
  rating: number;
  ghostyRating: number;
  ghostyRuns: number;
  demo: boolean;
}

const KEYS: Record<string, string> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', m: 'map', ' ': 'a', z: 'b', x: 'x', c: 'c', Shift: 'c' };
const arg = (args: readonly string[] | undefined, k: string): string | null => {
  const hit = (args ?? []).find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : null;
};

export function makeEngine<R>(rules: Rules<R>, entry: { ghosty: string }): GameEngine<never> & { id: string } {
  return {
    id: rules.engine,
    start: (canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }) => startGame(rules, entry, canvas, intent, ev, opts),
  } as never;
}

async function startGame<R>(rules: Rules<R>, entry: { ghosty: string }, canvas: HTMLCanvasElement, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }): Promise<GameHandle> {
  const t0 = performance.now();
  fitCanvas(canvas);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This browser cannot draw the game.');
  const res = new Resolution();
  const accent = accentHex(0x64d2ff);
  const accentCss = `#${accent.toString(16).padStart(6, '0')}`;
  const synth = new Synth(opts.sound);
  let music: { start(): void; stop(): void; pace?: number; pump?(): void } | null = rules.music ? new Tune(synth, rules.music.spec) : null;
  const argLevel = arg(opts.args, 'level');
  const argSeed = arg(opts.args, 'seed');
  const auto = (opts.args ?? []).includes('auto');
  const noPractice = (opts.args ?? []).includes('nopractice');
  /** The spec's time machine: the rules run `speed` times faster than the clock (never in play). */
  const speed = Math.max(1, Math.min(30, Number(arg(opts.args, 'speed')) || 1));
  const best = () => scoreOf(rules.id)?.best ?? 0;
  const ghostyBest = () => scoreOf(rules.ghostyId)?.best ?? null;
  const myLevel = () => (argLevel ? Math.max(1, Math.floor(Number(argLevel)) || 1) : levelOf(bookOf(rules.id).you.r));
  const hisLevel = () => levelOf(bookOf(rules.id).ghosty.r);
  const theta = () => bookOf(rules.id).ghosty.theta ?? null;
  const botTheta = () => theta() ?? rules.practice.theta0;
  const seed0 = () => (argSeed ? Number(argSeed) || 1 : (Math.random() * 2 ** 31) | 0);

  let resume: unknown = null;
  // a save that will not read is said, and cleared, not quietly replaced by a new game
  let damaged = false;
  if (rules.persist) {
    try {
      const b = await opts.saves.get(rules.persist.name);
      if (b) {
        resume = rules.persist.decode(new TextDecoder().decode(b));
        if (resume === null || resume === undefined) damaged = true;
      }
    } catch {
      resume = null;
      damaged = true;
    }
    if (damaged) void opts.saves.remove(rules.persist.name).catch(() => undefined);
  }

  let mode: Mode = 'title';
  let level = myLevel();
  let target = rules.target(level);
  let run: R = rules.start({ level: 1, seed: 7, theta: botTheta() });
  let demo = true;
  let ended = false;
  let passedNoted = false;
  let acc = 0;
  let overT = 0;
  let clock = 0;
  let firstFrameMs: number | null = null;
  let sittingStart = 0;
  let lastOutcome = '';
  const held = new Set<string>();
  const padHeld = new Set<string>();
  const touchHeld = new Set<string>();
  const pressedNext = new Set<string>();
  let prevAll = new Set<string>();

  // ---------------------------------------------------------------- the overlay
  const ui = new Overlay(canvas, `g4.g4${rules.engine}`, rules.title);
  const press = (name: string) => {
    synth.wake();
    pressedNext.add(name);
  };
  const api: ControlApi = {
    press,
    hold: (name, on) => {
      synth.wake();
      if (on) (touchHeld.add(name), pressedNext.add(name));
      else touchHeld.delete(name);
    },
    button: (o) => {
      const b = h(`button.g4btn${o.cls ? `.${o.cls.split(' ').join('.')}` : ''}` as 'button', { type: 'button', 'aria-label': o.aria, dataset: { act: o.name } }, o.label);
      const on = (e: PointerEvent | Event) => {
        e.preventDefault?.();
        e.stopPropagation?.();
        const pid = (e as PointerEvent).pointerId;
        if (pid !== undefined) {
          try {
            b.setPointerCapture(pid);
          } catch {
            /* fine */
          }
        }
        b.classList.add('on');
        if (o.hold) api.hold(o.name, true);
        else press(o.name);
        haptic(6);
      };
      const off = () => {
        b.classList.remove('on');
        if (o.hold) api.hold(o.name, false);
      };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('lostpointercapture', off);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      // VoiceOver and a keyboard press with a click, not a pointer
      b.addEventListener('click', (e) => {
        if (e.detail === 0) {
          press(o.name);
          if (o.hold) setTimeout(() => api.hold(o.name, false), 90), api.hold(o.name, true);
        }
      });
      return b;
    },
  };
  const hudScore = h('b.g4score', '0');
  const hudLevel = h('span.g4lvl', '');
  const hud = h('div.g4hud', { 'aria-hidden': 'true' }, hudScore, hudLevel);
  const passBar = h('i.g4passfill');
  const pass = h('div.g4pass', { 'aria-hidden': 'true' }, passBar);
  const pad = h('div.g4pad', { role: 'application', 'aria-label': `${rules.title}: the play area` });
  const pauseBtn = hudButton('g2pause.g4pause', '', 'Pause', () => openPause());
  const ctl = rules.controls ? h('div.g4ctl', ...rules.controls(api)) : null;
  ui.layer.append(pad, hud, pass, pauseBtn, ...(ctl ? [ctl] : []));
  ui.root.dataset.mode = mode;
  const setMode = (m: Mode) => {
    mode = m;
    ui.root.dataset.mode = m;
  };
  const rectOf = () => pad.getBoundingClientRect();
  const sendPointer = (kind: Pointer['kind'], e: PointerEvent) => {
    const r = rectOf();
    rules.pointer?.(mode === 'play' ? run : null, { kind, x: e.clientX - r.left, y: e.clientY - r.top, id: e.pointerId, w: r.width, h: r.height }, api);
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    synth.wake();
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    sendPointer('down', e);
  });
  pad.addEventListener('pointermove', (e) => sendPointer('move', e));
  const upP = (e: PointerEvent) => sendPointer('up', e);
  pad.addEventListener('pointerup', upP);
  pad.addEventListener('pointercancel', upP);
  const onKey = (e: KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.type === 'keydown') {
      if (k === 'Escape' || k === 'p') {
        if (mode === 'play') openPause();
        else if (mode === 'paused') resumeRun();
        return;
      }
      const n = KEYS[k];
      if (!n || mode === 'gone') return;
      e.preventDefault();
      if (!held.has(n)) pressedNext.add(n);
      held.add(n);
    } else {
      const n = KEYS[k];
      if (n) held.delete(n);
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // ---------------------------------------------------------------- what happens, heard and felt
  const happen = (quiet: boolean) => {
    for (const e of rules.drain(run)) {
      if (quiet) continue;
      rules.sound(synth, e);
      const hp = rules.haptic?.(e);
      if (hp === 'hit') (ev.onHit?.(), hapticIfNoVibrate());
      else if (hp === 'tick') haptic(5);
      const w = rules.say?.(e, run);
      if (w) ui.say(w, 2200);
      if (e.type === 'save' && rules.persist && !demo) {
        const raw = rules.persist.encode(run);
        resume = rules.persist.decode(raw);
        void opts.saves.put(rules.persist.name, new TextEncoder().encode(raw)).catch(() => undefined);
      }
      const cd = rules.card?.(e, run);
      if (cd && mode === 'play') showCard(cd);
    }
  };
  const showCard = (cd: Card) => {
    setMode('paused');
    touchHeld.clear();
    held.clear();
    const page = (i: number) => {
      const last = i >= cd.pages.length - 1;
      reopen = () => page(i);
      ui.menu({
        title: cd.title,
        line: cd.pages[i] ?? '',
        buttons: [{ label: last ? 'Got it' : 'Next', aria: last ? 'Close this card' : 'Next page', primary: true, act: () => (last ? (ui.closeMenu(), setMode('play'), rules.closed?.(run)) : page(i + 1)) }],
        kind: 'card',
      });
    };
    page(0);
  };

  // ---------------------------------------------------------------- a sheet the game asks for (a shop, his things)
  let sheetOn = false;
  const sheetApi = {
    redo: () => {
      const s = rules.sheet?.(run, sheetApi);
      if (s && sheetOn) ui.menu({ ...s, kind: 'card' });
      else closeSheetUi();
    },
    close: () => closeSheetUi(),
  };
  const closeSheetUi = () => {
    if (!sheetOn) return;
    sheetOn = false;
    ui.closeMenu();
    setMode('play');
    rules.closed?.(run);
    if (!hostPaused) loop.start();
  };
  const checkSheet = () => {
    if (sheetOn || mode !== 'play' || !rules.sheet) return;
    const s = rules.sheet(run, sheetApi);
    if (!s) return;
    sheetOn = true;
    setMode('paused');
    touchHeld.clear();
    held.clear();
    ui.menu({ ...s, kind: 'card' });
  };

  // ---------------------------------------------------------------- Ghosty practises, a session at a time, when the page is idle
  let practicing = true;
  let practiceLeft = noPractice || rules.plain ? 0 : 3;
  let practiceN = 0;
  const practiceNext = () => {
    if (!practicing || practiceLeft <= 0 || mode === 'gone') return;
    window.setTimeout(() => {
      if (!practicing || mode === 'gone') return;
      if (mode === 'play') return void practiceNext(); // never while a run is on
      const t = performance.now();
      const r = practiceSession(rules.practice, (Math.random() * 2 ** 31) | 0);
      if (r.score > (ghostyBest() ?? 0)) recordScore(rules.ghostyId, r.score);
      practiceLeft--;
      practiceN++;
      if (mode === 'title') paintTitleNote();
      void t;
      practiceNext();
    }, 120);
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `Sound: ${synth.on ? 'on' : 'off'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const ghostNote = () => {
    const b = bookOf(rules.id);
    const gb = ghostyBest();
    return `Ghosty: ${levelWords(levelOf(b.ghosty.r))}${gb ? ` · his best ${rules.words(gb)}` : ''}`;
  };
  const youNote = () => (rules.plain ? (best() ? `Your best: ${rules.words(best())}` : 'Not played yet') : `You: ${levelWords(myLevel())}${best() ? ` · your best ${rules.words(best())}` : ''}`);
  const paintTitleNote = () => {
    const n = ui.root.querySelector('.g4ghostnote');
    if (n) n.textContent = ghostNote();
    const m = ui.root.querySelector('.g4younote');
    if (m) m.textContent = youNote();
    if (rules.plain) return;
  };
  const openTitle = () => {
    reopen = openTitle;
    if (mode !== 'title') beginDemo();
    setMode('title');
    music?.stop();
    ui.menu({
      title: rules.title,
      line: entry.ghosty || rules.line,
      notes: [...(rules.plain ? [youNote()] : [youNote(), ghostNote()]), ...(damaged && !resume ? [DAMAGED_SAVE] : [])],
      buttons: [
        ...(rules.persist
          ? [...(resume ? [{ label: 'Continue', aria: `Continue ${rules.title} from the last lantern`, primary: true, act: () => startRun(true) }] : []), { label: 'New game', aria: `Start ${rules.title} from the beginning`, primary: !resume, act: () => startRun() }]
          : [{ label: 'Play', aria: `Play ${rules.title}`, primary: true, act: () => startRun() }]),
        { label: 'How to play', act: () => openHow(openTitle) },
        soundBtn(openTitle),
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
    });
    const notes = ui.root.querySelectorAll('.g2note');
    notes[0]?.classList.add('g4younote');
    if (!rules.plain) notes[1]?.classList.add('g4ghostnote');
    loop.start();
  };
  const openHow = (back: () => void) => {
    reopen = () => openHow(back);
    const how = h('div.g2how', ...rules.how.map((p) => h('p', p)), rules.plain ? null : h('p', 'Every run is set at your level. Pass the pass mark and the next one is harder; miss it and it eases back a step. There is no top level.'), h('p', 'A controller: the d-pad or stick moves, A, B and X are the buttons, START pauses. A keyboard: the arrow keys, space, Z, X.'));
    ui.menu({ title: 'How to play', extra: how, buttons: [{ label: 'Back', act: back }], kind: 'how' });
  };
  const beginDemo = () => {
    demo = true;
    ended = false;
    run = rules.start({ level: Math.min(hisLevel(), 6), seed: seed0(), theta: botTheta() });
    acc = 0;
  };
  const startRun = (fromSave = false) => {
    synth.wake();
    level = myLevel();
    target = rules.target(level);
    demo = false;
    run = rules.start({ level, seed: seed0(), theta: theta(), args: opts.args, resume: fromSave ? resume : undefined });
    acc = 0;
    overT = 0;
    ended = false;
    passedNoted = false;
    sittingStart = performance.now();
    pressedNext.clear();
    held.clear();
    ui.closeMenu();
    setMode('play');
    hudScore.textContent = '0';
    hudLevel.textContent = rules.plain ? '' : `Level ${level}`;
    pass.hidden = !!rules.plain;
    if (rules.music?.specFor) {
      music?.stop();
      music = new Tune(synth, rules.music.specFor(run));
    } else if (rules.makeTune) {
      music?.stop();
      music = rules.makeTune(synth, run);
    }
    music?.start();
    loop.start();
  };
  const openPause = () => {
    if (mode !== 'play') return;
    reopen = openPause;
    setMode('paused');
    music?.stop();
    touchHeld.clear();
    ui.menu({
      title: 'Paused',
      line: rules.pauseLine ? rules.pauseLine(run, target) : `${rules.words(rules.score(run))} so far. Pass mark ${rules.words(target)}.`,
      buttons: [
        { label: 'Resume', primary: true, act: () => resumeRun() },
        { label: 'How to play', act: () => openHow(openPause) },
        soundBtn(openPause),
        { label: 'End run', aria: 'End this run and go back to the start', act: () => (endRun(false), openTitle()) },
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
      kind: 'pause',
    });
    loop.stop();
    draw();
  };
  const resumeRun = () => {
    ui.closeMenu();
    setMode('play');
    music?.start();
    if (!hostPaused) loop.start();
  };
  const didPass = () => (rules.passed ? rules.passed(run, target) : rules.score(run) >= target);
  /** The run's score and level kept (once a run). A run cut short before its pass mark leaves the level alone. */
  const endRun = (show: boolean) => {
    if (demo) return;
    if (!ended) {
      ended = true;
      const sc = rules.score(run);
      const r = recordScore(rules.id, sc);
      if (sittingStart) recordSitting(rules.id, (performance.now() - sittingStart) / 1000);
      const passed = didPass();
      const cut = !rules.over(run) && !passed;
      const out = cut || rules.plain ? null : finishRun(rules.id, 'you', passed, sc, target);
      lastOutcome = rules.plain
        ? ''
        : out
        ? out.levelAfter > out.levelBefore
          ? `${passed ? 'Passed' : ''} Level ${out.levelBefore} done. On to Level ${out.levelAfter}, and it is harder.`.trim()
          : out.levelAfter < out.levelBefore
            ? `Level ${out.levelBefore} was too much this time. Back to Level ${out.levelAfter}.`
            : `The pass mark was ${rules.words(target)}. Level ${out.levelAfter} again.`
        : 'Your level stays where it was.';
      if (!rules.plain) {
        practiceLeft += 1;
        practiceNext();
      }
      if (show) showOver(r.isBest);
    } else if (show) showOver(false);
  };
  const showOver = (isBest: boolean) => {
    setMode('over');
    music?.stop();
    const e = rules.ends(run);
    const sc = rules.score(run);
    const gb = ghostyBest();
    const line = isBest && sc > 0 ? `New best: ${rules.words(sc)}. ${e.tip}` : gb && sc > gb ? `Past my best by ${rules.words(sc - gb)}. ${e.tip}` : e.tip;
    reopen = overMenu;
    function overMenu() {
      ui.menu({
        title: e.title,
        line,
        notes: rules.plain ? [...(e.notes ?? [rules.words(sc)]), youNote()] : [...(e.notes ?? [`${rules.words(sc)} · pass mark ${rules.words(target)}`]), lastOutcome, youNote(), ghostNote()],
        buttons: [
          { label: 'Play again', primary: true, act: () => startRun() },
          { label: 'Menu', act: () => openTitle() },
          soundBtn(overMenu),
          { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    overMenu();
    ui.announce(`${e.title}. ${rules.words(sc)}. ${lastOutcome}`.trim());
  };

  // ---------------------------------------------------------------- the frame
  let size = { w: 0, h: 0, s: 0 };
  const fit = () => {
    const { w, h: hh } = cssSize(canvas);
    if (w === size.w && hh === size.h && res.scale === size.s) return;
    size = { w, h: hh, s: res.scale };
    canvas.width = Math.round(w * res.scale);
    canvas.height = Math.round(hh * res.scale);
  };
  const view = (): View => ({ w: size.w, h: size.h, t: clock, accent: accentCss, mode, level: demo ? Math.min(hisLevel(), 6) : level, target, ghostyLevel: hisLevel(), best: best(), ghostyBest: ghostyBest(), reserve: rules.reserve ?? 0, demo });
  const draw = () => {
    fit();
    g.setTransform(res.scale, 0, 0, res.scale, 0, 0);
    rules.draw(g, run, view());
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };
  /** The pad's Intent folded into names: held states and the edges it makes. */
  const padFold = () => {
    padHeld.clear();
    if (intent.moveX < -0.5) padHeld.add('left');
    if (intent.moveX > 0.5) padHeld.add('right');
    if (intent.moveY > 0.5) padHeld.add('up');
    if (intent.moveY < -0.5) padHeld.add('down');
    if (intent.held.has('jump')) padHeld.add('a');
    if (intent.held.has('use')) padHeld.add('b');
    if (intent.held.has('fire')) padHeld.add('x');
    if (intent.held.has('run')) padHeld.add('c');
    if (intent.held.has('map')) padHeld.add('map');
  };
  let prevPause = false;
  const frame = (dt: number) => {
    clock += dt;
    dt *= speed;
    if (ui.menuOpen) ui.menuPad(intent);
    padFold();
    const all = new Set<string>([...held, ...padHeld, ...touchHeld]);
    const pressed = new Set<string>(pressedNext);
    pressedNext.clear();
    for (const n of all) if (!prevAll.has(n)) pressed.add(n);
    prevAll = all;
    const startPressed = intent.held.has('pause') && !prevPause;
    prevPause = intent.held.has('pause');
    intent.lookX = 0;
    intent.lookY = 0;
    if (startPressed && mode === 'play') openPause();
    if (mode === 'play' || mode === 'title') {
      const playing = mode === 'play';
      acc += dt;
      let n = 0;
      let first = true;
      while (acc >= STEP && n++ < 8 * speed) {
        const botOn = demo || auto;
        if (botOn) rules.bot(run, botTheta(), STEP);
        rules.step(run, STEP, botOn ? NOINPUT : { held: all, pressed: first ? pressed : NOINPUT.pressed });
        first = false;
        acc -= STEP;
      }
      if (n >= 8 * speed) acc = 0;
      happen(!playing);
      if (playing) {
        checkSheet();
        const sc = rules.score(run);
        hudScore.textContent = num(sc);
        passBar.style.transform = `scaleX(${clamp(sc / Math.max(1, target), 0, 1)})`;
        pass.classList.toggle('done', sc >= target);
        if (!passedNoted && !rules.plain && didPass()) {
          passedNoted = true;
          ui.say(`Pass mark reached: Level ${level + 1} is next.`, 2400);
          [659, 784, 988, 1319].forEach((f, i) => synth.tone({ f, dur: 0.1, type: 'triangle', vol: 0.09, at: i * 0.07 }));
        }
        if (music && rules.music) {
          music.pace = clamp(rules.music.pace(run), 0, 1);
          music.pump?.();
        }
        if (rules.over(run) || (auto && sc >= target * 2)) {
          overT += dt;
          if (overT > 0.9) endRun(true);
        }
      } else if (rules.over(run)) {
        overT += dt;
        if (overT > 1.5) (beginDemo(), (overT = 0));
      }
    }
    draw();
    res.check(loop.stats);
  };
  const loop = new Loop(frame);

  // ---------------------------------------------------------------- pausing, the tab, quitting
  let hostPaused = false;
  const onHidden = () => {
    if (document.hidden && mode === 'play') openPause();
  };
  document.addEventListener('visibilitychange', onHidden);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (size.w = 0)) : null;
  ro?.observe(canvas);
  let finished: Promise<void> | null = null;
  const finish = (): Promise<void> =>
    (finished ??= (async () => {
      loop.stop();
      music?.stop();
      practicing = false;
      // a run cut short still counts: its score is kept, and its level moves only if it had passed
      if ((mode === 'play' || mode === 'paused') && !demo && rules.score(run) > 0) endRun(false);
      setMode('gone');
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      ro?.disconnect();
      canvas.width = 0;
      canvas.height = 0;
      synth.close();
      ui.destroy();
    })());
  const leave = async () => {
    await finish();
    ev.onQuit?.();
  };

  openTitle();
  draw();
  practiceNext();

  return {
    pause() {
      hostPaused = true;
      loop.stop();
      music?.stop();
    },
    resume() {
      hostPaused = false;
      if (mode === 'gone') return;
      if (mode === 'play') music?.start();
      if (mode !== 'paused') loop.start();
    },
    quit: finish,
    setSound(on: boolean) {
      synth.setOn(on);
      if (ui.menuOpen) reopen();
    },
    resetStats: () => loop.stats.reset(),
    peek: (): GameStats2 => ({
      frames: loop.stats.frames,
      firstFrameMs,
      p50: loop.stats.interval(0.5),
      p95: loop.stats.interval(0.95),
      workP95: loop.stats.workMs(0.95),
      scale: res.scale,
      width: canvas.width,
      height: canvas.height,
      calls: 0,
      triangles: 0,
      paused: !loop.running,
      mode,
      score: rules.score(run),
      level: demo ? myLevel() : level,
      ghostyLevel: hisLevel(),
      best: best(),
      passed: !demo && didPass(),
      state: rules.peek?.(run) ?? {},
      rating: bookOf(rules.id).you.r,
      ghostyRating: bookOf(rules.id).ghosty.r,
      ghostyRuns: bookOf(rules.id).ghosty.n,
      demo,
    }),
  };
}

/** Run a game's rules headless: the bot plays a whole run at a level. Used by Ghosty's practice and the node test. */
export function playHeadless<R>(rules: Pick<Rules<R>, 'start' | 'step' | 'bot' | 'score' | 'over' | 'drain' | 'passed'>, theta: readonly number[], level: number, seed: number, target: number, maxSteps = 60 * 60 * 20, stopAt = target * 2): { score: number; passed: boolean; steps: number } {
  const r = rules.start({ level, seed, theta });
  let steps = 0;
  while (!rules.over(r) && steps < maxSteps && rules.score(r) < stopAt) {
    rules.bot(r, theta, STEP);
    rules.step(r, STEP, NOINPUT);
    rules.drain(r);
    steps++;
  }
  const score = rules.score(r);
  return { score, passed: rules.passed ? rules.passed(r, target) : score >= target, steps };
}
export { rng };
