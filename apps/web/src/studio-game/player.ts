/**
 * THE PLAYER (BRIEF-EDITOR-GAME-STUDIO): one small player for a game of the studio, used twice. In the editor's PLAY it plays
 * in place; bundled on its own by build.mjs as `studio-player.js`, it is what runs inside a game exported AS AN APP (app.ts
 * inlines it into the one page). It plays with the same rules (play.ts) and the same drawing (draw.ts) the arcade's engine
 * does, with a pad of its own under the thumbs, a dialogue box (a 44 pt NEXT), the shop and his things, a CONTINUE from a save
 * (where it may keep one), and sound from a few oscillators. It asks for nothing from the network.
 */
import { drawPlay } from './draw';
import { type Game, hardProblems, readGame, themeOf } from './model';
import { buy, closeSheet, drain, dropItem, newPlay, nextLine, type Play, questLine, scoreOf, sell, snap, step, STEP, useItem, walk } from './play';
import { addScore, dayOf, drawCard, readScores, type Score, scoreLine, scoresKey, shareCard } from './scores';
import { startTune, tuneOf } from './tune';

const $ = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export interface Saves {
  get(): Promise<string | null>;
  put(raw: string): void;
}
export interface PlayerOpts {
  game: Game;
  canvas: HTMLCanvasElement;
  /** Where the pad, the dialogue and the sheets go (a positioned box over the canvas). */
  ui: HTMLElement;
  /** A title card with PLAY and CONTINUE first (the page), or straight into the game (the editor's PLAY). */
  title: boolean;
  saves?: Saves;
  /** Start in this room at this tile (PLAY FROM HERE). */
  at?: { room: string; x: number; y: number };
  /** What a save said, said once ("Saved"). */
  onSave?(): void;
  onEnd?(won: boolean): void;
  /** [sites] sites.u10: a high-score table kept on this phone (the page's own storage); the editor's PLAY keeps none. */
  scores?: { get(): Score[]; put(list: Score[]): void };
}
export interface PlayerHandle {
  /** From the start (or from `at`), as RESET does. */
  reset(): void;
  /** Continue from the save. */
  continue(): Promise<boolean>;
  stop(): void;
  /** The run the player holds (the spec reads it and drives it). */
  run(): Play;
  /** Walk the real game along a route to a tile with scripted inputs, then draw. */
  walk(tx: number, ty: number, o?: { door?: boolean }): boolean;
  /** Press names for one step, as a thumb does. */
  tap(...names: string[]): void;
  peek(): Record<string, unknown>;
  hasSave(): Promise<boolean>;
}
const RESERVE = (top: boolean) => (top ? 168 : 150);

export function mountPlayer(o: PlayerOpts): PlayerHandle {
  const { game, canvas, ui } = o;
  const bad = hardProblems(game)[0];
  const top = game.kind === 'topdown';
  const g2 = canvas.getContext('2d')!;
  let run: Play = newPlay(game, o.at ? { room: o.at.room, at: [o.at.x, o.at.y] } : {});
  let mode: 'title' | 'play' | 'end' = o.title ? 'title' : 'play';
  const held = new Set<string>();
  let pressed = new Set<string>();
  let sound = true;
  let ctx: AudioContext | null = null;
  let tune: { stop(): void } | null = null;
  let clock = 0;
  let acc = 0;
  let last = 0;
  let overT = 0;
  let raf = 0;
  let stopped = false;
  const wake = () => {
    if (!ctx) {
      try {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (C) ctx = new C();
      } catch {
        ctx = null;
      }
    }
    void ctx?.resume?.();
  };
  const tone = (f: number, dur: number, to = 0, at = 0, type: OscillatorType = 'square', vol = 0.06) => {
    if (!sound || !ctx || !game.fx) return;
    const t = ctx.currentTime + at;
    const os = ctx.createOscillator();
    const g = ctx.createGain();
    os.type = type;
    os.frequency.setValueAtTime(f, t);
    if (to) os.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g).connect(ctx.destination);
    os.start(t);
    os.stop(t + dur + 0.02);
  };
  const heard = (t: string) => {
    if (t === 'jump') tone(300, 0.1, 560);
    else if (t === 'coin') (tone(988, 0.07), tone(1319, 0.07, 0, 0.05));
    else if (t === 'pick' || t === 'heal' || t === 'buy' || t === 'quest' || t === 'step' || t === 'chest' || t === 'win') [660, 880, 1100].forEach((f, i) => tone(f, 0.09, 0, i * 0.07, 'triangle', 0.08));
    else if (t === 'hurt' || t === 'die') tone(330, 0.3, 110, 0, 'sawtooth', 0.1);
    else if (t === 'stomp' || t === 'kill') tone(220, 0.12, 90);
    else if (t === 'spring') tone(200, 0.22, 900, 0, 'triangle');
    else if (t === 'door' || t === 'unlock' || t === 'save') (tone(392, 0.1, 0, 0, 'triangle'), tone(523, 0.1, 0, 0.07, 'triangle'));
    else if (t === 'refuse' || t === 'locked') tone(150, 0.18, 0, 0, 'sawtooth');
  };
  const music = (on: boolean) => {
    tune?.stop();
    tune = null;
    const t = tuneOf(game);
    if (on && sound && ctx && t) tune = startTune(ctx, ctx.destination, t);
  };

  // ---- the pad
  const btn = (label: string, aria: string, name: string, hold: boolean, cls = ''): HTMLButtonElement => {
    const b = $('button', cls, label);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.dataset.act = name;
    const down = (e: Event) => {
      e.preventDefault();
      wake();
      b.classList.add('on');
      if (hold) held.add(name);
      pressed.add(name);
    };
    const up = () => {
      b.classList.remove('on');
      if (hold) held.delete(name);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    // a keyboard or VoiceOver press arrives as a click with no pointer
    b.addEventListener('click', (e) => {
      if (e.detail === 0) {
        pressed.add(name);
        if (hold) {
          held.add(name);
          setTimeout(() => held.delete(name), 120);
        }
      }
    });
    return b;
  };
  const pad = $('div', 'gpPad');
  const left = $('div', top ? 'dpad' : '');
  const right = $('div');
  if (top) {
    left.append(btn('▲', 'Up', 'up', true, 'u'), btn('◀', 'Left', 'left', true, 'l'), btn('▼', 'Down', 'down', true, 'd'), btn('▶', 'Right', 'right', true, 'r'));
    right.append(btn('ITEMS', 'Your things', 'items', false, 'small'), btn('USE', 'Use: talk, open, go through', 'a', false, 'small'));
  } else {
    left.append(btn('◀', 'Move left', 'left', true), btn('▶', 'Move right', 'right', true));
    right.append(btn('ITEMS', 'Your things', 'items', false, 'small'), btn('USE', 'Use: talk, open, go through', 'b', false, 'small'), btn('JUMP', 'Jump, hold for a higher jump', 'a', true, 'small'));
  }
  pad.append(left, right);
  const layer = $('div');
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  ui.append(layer);
  ui.style.setProperty('--gp-pad', `${RESERVE(top)}px`);
  const clearLayer = () => layer.replaceChildren();

  const KEYS: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', ' ': 'a', z: 'b', x: 'items', Enter: 'a' };
  const kd = (e: KeyboardEvent) => {
    if (mode !== 'play' || (e.target as HTMLElement | null)?.closest?.('input,textarea,select')) return;
    const n = KEYS[e.key];
    if (!n) return;
    e.preventDefault();
    wake();
    if (!held.has(n)) pressed.add(n);
    held.add(n);
  };
  const ku = (e: KeyboardEvent) => {
    const n = KEYS[e.key];
    if (n) held.delete(n);
  };
  addEventListener('keydown', kd);
  addEventListener('keyup', ku);

  // ---- screens
  const screen = (title: string, line: string, buttons: [string, () => void, string?][]) => {
    clearLayer();
    const d = $('div', 'gpEnd');
    d.append($('h2', '', title), $('p', '', line));
    for (const [label, act, aria] of buttons) {
      const b = $('button', '', label);
      b.type = 'button';
      b.setAttribute('aria-label', aria ?? label);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        wake();
        act();
      });
      d.append(b);
    }
    layer.append(d);
  };
  const begin = (resume: string | null) => {
    run = newPlay(game, resume ? { resume } : o.at ? { room: o.at.room, at: [o.at.x, o.at.y] } : {});
    mode = 'play';
    held.clear();
    pressed = new Set();
    shown = '';
    layer.replaceChildren(pad);
    music(true);
  };
  const title = async () => {
    mode = 'title';
    music(false);
    const has = o.saves ? await o.saves.get().catch(() => null) : null;
    const list: [string, () => void, string?][] = [];
    if (bad) list.push(['Back', () => void title(), bad.text]);
    else {
      if (has) list.push(['Continue', () => begin(has), 'Continue from your last save point']);
      list.push([has ? 'New game' : 'Play', () => begin(null), 'Start from the beginning']);
    }
    const kept = o.scores?.get() ?? [];
    if (kept.length && !bad) list.push(['High scores', () => table(kept, null, () => void title()), 'Your high scores on this phone']);
    list.push([`Sound: ${sound ? 'on' : 'off'}`, () => ((sound = !sound), void title()), 'Turn the sound on or off']);
    screen(game.name, bad ? bad.text : game.maker ? `A game by ${game.maker}.` : 'A game made in Ghosty’s game studio.', list);
  };
  const end = () => {
    mode = 'end';
    music(false);
    const won = run.over === 'won';
    o.onEnd?.(won);
    let said = '';
    let after: (() => void) | null = null;
    if (o.scores) {
      // [sites] sites.u10: the run goes in this phone's table, and the line says where it landed
      const s: Score = { score: scoreOf(run), won, at: Date.now() };
      const { list, place } = addScore(o.scores.get(), s);
      o.scores.put(list);
      said = ` ${scoreLine(s, list, place)}`;
      after = () => table(list, place ? s : null, endScreen);
    }
    const endScreen = () =>
      screen(won ? 'You did it' : 'Game over', (run.why || (won ? 'Every quest is done.' : 'Out of lives.')) + said, [
        ['Play again', () => begin(null)],
        ...(after ? ([['High scores', after, 'Your high scores on this phone']] as [string, () => void, string][]) : []),
        ...(o.title ? ([['Menu', () => void title()]] as [string, () => void][]) : []),
      ]);
    endScreen();
  };
  // [sites] sites.u10: the top ten on this phone, the run just played marked, and a picture of the best to share
  const table = (list: Score[], mark: Score | null, back: () => void) => {
    clearLayer();
    const d = $('div', 'gpEnd gpScores');
    const note = $('p', '', 'Kept on this phone only.');
    const ol = $('ol', 'gpTop');
    for (const s of list) {
      const li = $('li', s === mark ? 'me' : '');
      li.append($('b', '', String(s.score)), $('span', '', ` ${dayOf(s.at)}${s.won ? ', finished' : ''}`));
      ol.append(li);
    }
    d.append($('h2', '', 'High scores'), note, ol);
    const best = list[0];
    const keys: [string, () => void, string][] = [['Back', back, 'Back']];
    if (best)
      keys.unshift([
        'Share my best',
        () => {
          const c = document.createElement('canvas');
          drawCard(c, game.name, best, themeOf(game.palette).sky[0] ?? 'black');
          void shareCard(c, game.name).then((t) => (note.textContent = t));
        },
        `Share a picture of your best score, ${best.score}`,
      ]);
    for (const [label, act, aria] of keys) {
      const b = $('button', '', label);
      b.type = 'button';
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        wake();
        act();
      });
      d.append(b);
    }
    layer.append(d);
  };

  // ---- the dialogue box and the sheets
  let shown = '';
  const syncOverlays = () => {
    const sig = run.dialog ? `d${run.dialog.i}${run.dialog.npc}` : run.sheet ? `s${run.sheet.kind}${JSON.stringify(run.inv)}${run.coins}${run.said}${run.hearts}` : '';
    if (sig === shown) return;
    shown = sig;
    layer.replaceChildren(pad);
    if (run.dialog) {
      const d = run.dialog;
      const box = $('div', 'gpBox');
      box.append($('h3', '', d.name), $('p', '', d.pages[d.i] ?? ''));
      const b = $('button', '', d.i < d.pages.length - 1 ? 'Next' : 'Got it');
      b.type = 'button';
      b.dataset.act = 'next';
      b.setAttribute('aria-label', d.i < d.pages.length - 1 ? 'Next' : 'Close');
      b.addEventListener('click', () => nextLine(run));
      box.append(b);
      layer.append(box);
    } else if (run.sheet) {
      const sh = $('div', 'gpSheet');
      sh.dataset.sheet = run.sheet.kind;
      const done = $('button', '', 'Done');
      done.type = 'button';
      done.dataset.act = 'done';
      done.addEventListener('click', () => closeSheet(run));
      const row = (label: string, acts: [string, () => void][]) => {
        const r = $('div', 'gpRow');
        r.append($('span', '', label));
        const a = $('span');
        for (const [t, f] of acts) {
          const b = $('button', '', t);
          b.type = 'button';
          b.dataset.act = t.toLowerCase();
          b.setAttribute('aria-label', `${t}: ${label}`);
          b.addEventListener('click', () => {
            f();
            shown = '';
          });
          a.append(b);
        }
        r.append(a);
        sh.append(r);
      };
      if (run.sheet.kind === 'shop') {
        const npc = game.npcs.find((n) => n.id === (run.sheet as { npc: string }).npc);
        sh.append($('h3', '', npc?.name ?? 'Shop'), $('p', '', `You have ${run.coins} coin${run.coins === 1 ? '' : 's'}.`));
        npc?.shop.forEach((it, i) => row(`${game.things.find((t) => t.id === it.thing)?.name ?? it.thing} · ${it.price} coin${it.price === 1 ? '' : 's'}`, [['Buy', () => buy(run, npc.id, i)]]));
        for (const t of game.things.filter((x) => x.does === 'sell' && (run.inv[x.id] ?? 0) > 0)) row(`${t.name} × ${run.inv[t.id]} · ${t.value}`, [['Sell', () => sell(run, t.id)]]);
      } else {
        sh.append($('h3', '', 'Your things'), $('p', '', `${run.coins} coin${run.coins === 1 ? '' : 's'} · ${run.hearts} of ${game.player.hearts} hearts`));
        const mine = game.things.filter((t) => (run.inv[t.id] ?? 0) > 0);
        if (!mine.length) sh.append($('p', '', 'You are not carrying anything yet.'));
        for (const t of mine) row(`${t.name} × ${run.inv[t.id]}`, [['Use', () => useItem(run, t.id)], ['Drop', () => dropItem(run, t.id)]]);
      }
      if (run.said) sh.append($('p', '', run.said));
      sh.append(done);
      layer.append(sh);
    }
  };

  // ---- the loop
  const resize = () => {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return dpr;
  };
  const events = () => {
    for (const e of drain(run)) {
      heard(e.type);
      if (e.type === 'save') {
        o.saves?.put(snap(run));
        o.onSave?.();
      }
    }
  };
  const frame = (ms: number) => {
    if (stopped) return;
    const dt = Math.min(0.1, (ms - last) / 1000 || 0);
    last = ms;
    clock += dt;
    const dpr = resize();
    if (mode === 'play') {
      acc += dt;
      let n = 0;
      let first = true;
      while (acc >= STEP && n++ < 8) {
        step(run, STEP, { held, pressed: first ? pressed : new Set() });
        first = false;
        acc -= STEP;
      }
      if (n >= 8) acc = 0;
      pressed = new Set();
      events();
      syncOverlays();
      if (run.over) {
        overT += dt;
        if (overT > 0.9) {
          overT = 0;
          end();
        }
      }
    }
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPlay(g2, run, { w: canvas.clientWidth, h: canvas.clientHeight, t: clock, reserve: RESERVE(top) });
    raf = requestAnimationFrame(frame);
  };
  const vis = () => {
    if (document.hidden) {
      held.clear();
      music(false);
    } else if (mode === 'play') music(true);
  };
  document.addEventListener('visibilitychange', vis);
  if (o.title) void title();
  else layer.append(pad);
  raf = requestAnimationFrame(frame);

  return {
    reset: () => begin(null),
    continue: async () => {
      const raw = o.saves ? await o.saves.get().catch(() => null) : null;
      if (!raw) return false;
      begin(raw);
      return true;
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      music(false);
      removeEventListener('keydown', kd);
      removeEventListener('keyup', ku);
      document.removeEventListener('visibilitychange', vis);
      layer.remove();
    },
    run: () => run,
    walk: (tx, ty, w) => {
      const ok = walk(run, tx, ty, w);
      events();
      syncOverlays();
      return ok;
    },
    tap: (...names) => {
      for (const n of names) pressed.add(n);
    },
    peek: () => ({ room: run.rid, hearts: run.hearts, coins: run.coins, lives: run.lives, quest: questLine(run), over: run.over, mode, dialog: run.dialog ? { npc: run.dialog.npc, i: run.dialog.i } : null, sheet: run.sheet?.kind ?? null, said: run.said, inv: run.inv, x: run.b.x, y: run.b.y }),
    hasSave: async () => !!(o.saves && (await o.saves.get().catch(() => null))),
  };
}

/** The exported page: the game's JSON inline, the one canvas, the pad over it; saves in the page's own storage where it has any. */
function boot(): void {
  const raw = document.getElementById('game')?.textContent ?? '';
  const ui = document.getElementById('gp');
  const canvas = document.getElementById('c') as HTMLCanvasElement | null;
  const read = raw ? readGame(JSON.parse(raw)) : null;
  if (!ui || !canvas) return;
  if (!read) {
    ui.textContent = 'This game could not be read.';
    return;
  }
  // On his sites (/s/<name>/, gamesite.ts) the page names its own key and its offline worker; the exported file has neither.
  const el = document.getElementById('game');
  const key = el?.dataset.save || `ghostygame:${read.game.id}`;
  const sw = el?.dataset.sw ?? '';
  // [sites] a published game's front page (gamesite.ts): PLAY takes it away and the game's own title card is there
  // shown once on a phone: after the first PLAY the game opens straight on its title card (remembered under its own key)
  const front = document.getElementById('front');
  const seenKey = `${key}:front`;
  let seen = false;
  try {
    seen = localStorage.getItem(seenKey) === '1';
  } catch {
    /* the page may keep nothing: the front page shows each time */
  }
  if (front && seen) front.remove();
  front?.querySelector('button.play')?.addEventListener('click', () => {
    front.remove();
    try {
      localStorage.setItem(seenKey, '1');
    } catch {
      /* kept for this visit only */
    }
  });
  if (sw && el?.dataset.scope && 'serviceWorker' in navigator) navigator.serviceWorker.register(sw, { scope: el.dataset.scope }).catch(() => undefined);
  const store = (): Storage | null => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  };
  const sk = scoresKey(key);
  mountPlayer({
    game: read.game,
    canvas,
    ui,
    title: true,
    scores: {
      get: () => {
        try {
          return readScores(store()?.getItem(sk) ?? null);
        } catch {
          return [];
        }
      },
      put: (list) => {
        try {
          store()?.setItem(sk, JSON.stringify(list));
        } catch {
          /* the page may keep nothing: the table lasts this visit */
        }
      },
    },
    saves: {
      get: async () => {
        try {
          return store()?.getItem(key) ?? null;
        } catch {
          return null;
        }
      },
      put: (s) => {
        try {
          store()?.setItem(key, s);
        } catch {
          /* the page may keep nothing: the game goes on */
        }
      },
    },
  });
}
// (the editor imports mountPlayer; only the bundled page has a #game to boot from)
if (typeof document !== 'undefined' && document.getElementById('game')?.getAttribute('type') === 'application/json' && document.getElementById('gp')) boot();
