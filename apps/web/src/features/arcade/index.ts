/**
 * THE ARCADE: real, free games playing entirely on this phone. The SHELF lists every game an engine here plays today
 * (arcade/shelf.ts, through arcade/engines), one card a game: its title, one plain line, its size, GET (his tap, on
 * Wi-Fi, the size said on the button; on mobile data it says so and waits) or PLAY, the best score, Ghosty's line, and
 * a ⋯ with its licence, its credit, its controls and DELETE. The PLAYER is a full-screen canvas under the TOUCH LAYER
 * (a stick under the left thumb, drag-to-look on the right half, buttons where the right thumb rests, small keys along
 * the top, PAUSE → RESUME · QUIT · SOUND · CONTROLS) and the GAMEPAD LAYER (the standard mapping, read every frame);
 * both fill one Intent that the game's engine reads.
 */
import { clear, h } from '../../core/dom';
import { type Action, BTN, idle, type Intent, merge, PAD_BUTTONS, readPad, touchLook, touchMove } from '../../arcade/input';
import type { DosButton } from '../../arcade/dos';
import { primeAudio } from '../../arcade/engines/audio';
import { dosStats, keyWord } from '../../arcade/engines/dos';
import { engineFor, filesFor, playsToday, readsFor } from '../../arcade/engines/index';
import { saveStore } from '../../arcade/engines/saves';
import type { EngineFiles, EngineHandle } from '../../arcade/engines/types';
import { allScores, recordScore, type Score } from '../../arcade/scores';
import { keptAs, SHELF, type ShelfEntry } from '../../arcade/shelf';
import { getFiles, isHere, offMobileData, onMobileData, type Progress, readKept, removeFiles, sizeWords } from '../../arcade/store';
import type { TabDef } from '../../shell/tabs';
import { button, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';

/** What the spec and Ghosty read: the game on screen, what is kept here, the engine's numbers. */
export const arcadeState = { playing: '' as string, here: [] as string[], stats: dosStats, pad: false, intent: null as Intent | null };

const SOUND_KEY = 'ghosty.arcade.sound';
const soundOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};
const setSoundPref = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* this visit only */
  }
};

/** The games on the shelf: what plays today, plus any a spec adds (window.__ghostyArcadeShelf). */
function shelf(): ShelfEntry[] {
  const extra = (window as unknown as { __ghostyArcadeShelf?: ShelfEntry[] }).__ghostyArcadeShelf ?? [];
  return [...SHELF, ...extra].filter(playsToday);
}

/** "12 min", "45 s": a DOS game's score is the time he played it in one sitting. */
const timeWords = (s: number): string => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.max(0, Math.round(s))} s`);
const scoreWords = (e: ShelfEntry, sc: Score | undefined): string => {
  if (!sc) return 'Not played yet';
  return e.engine === 'dos' ? `Longest sitting ${timeWords(sc.best)} · last ${timeWords(sc.last)}` : `Best ${sc.best.toLocaleString('en-GB')} · last ${sc.last.toLocaleString('en-GB')}`;
};

/** The buttons a game shows: its DOS CONTROLS block's, or the engine's own actions under plain labels. */
function buttonsOf(e: ShelfEntry): DosButton[] {
  if (e.dos) return e.dos.controls.buttons;
  const words: Partial<Record<Action, string>> = { fire: 'FIRE', jump: 'JUMP', use: 'USE', weapon: 'WEAPON', map: 'MAP' };
  return e.controls.flatMap((c) => (words[c as Action] ? [{ act: c as Action, key: '', label: words[c as Action]! }] : []));
}

const PAD_WORDS: Partial<Record<number, string>> = { [BTN.A]: 'A', [BTN.B]: 'B', [BTN.X]: 'X', [BTN.Y]: 'Y', [BTN.LB]: 'LB', [BTN.RB]: 'RB', [BTN.LT]: 'LT', [BTN.RT]: 'RT', [BTN.SELECT]: 'VIEW', [BTN.START]: 'MENU', [BTN.LS]: 'L-STICK', [BTN.RS]: 'R-STICK' };

/** The CONTROLS sheet's lines: the stick, the drag, each button and its key, and the controller. */
function controlLines(e: ShelfEntry): string[] {
  const c = e.dos?.controls;
  const out: string[] = [];
  out.push(c ? `Left thumb: the stick presses the ${c.stick === 'wasd' ? 'W A S D keys' : 'arrow keys'}${c.run ? ', and runs when pushed all the way' : ''}.` : 'Left thumb: the stick moves.');
  if (!c || c.drag !== 'none') out.push('Right half: drag to turn and look.');
  for (const b of buttonsOf(e)) out.push(`${b.label}${b.key ? ` — ${b.cycle?.length ? b.cycle.map(keyWord).join(', ') : keyWord(b.key)}` : ''}`);
  const pad = PAD_BUTTONS[e.engine];
  const labels = new Map(buttonsOf(e).map((b) => [b.act, b.label] as const));
  const padLine = Object.entries(pad)
    .filter(([, a]) => a && (a === 'pause' || labels.has(a)))
    .map(([i, a]) => `${PAD_WORDS[Number(i)] ?? i} ${a === 'pause' ? 'PAUSE' : labels.get(a!)}`);
  out.push(`A controller: the left stick and the d-pad move${!c || c.drag !== 'none' ? ', the right stick looks' : ''}; ${padLine.join(' · ')}.`);
  return out;
}

/** Keep a finger's moves on this element even when it slides off (a synthetic touch has nothing to capture). */
const capture = (el: Element, id: number) => {
  try {
    el.setPointerCapture?.(id);
  } catch {
    /* nothing to capture */
  }
};

const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration here */
  }
};

export const arcadeTab: TabDef = {
  id: 'arcade',
  title: 'ARCADE',
  icon: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
  scene: 'backdrop',
  blurb: `free classics, played on this phone · ${shelf().length} games`,
  now() {
    return arcadeState.here.length ? `${arcadeState.here.length} on this phone` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'ARCADE', sub: 'Free classics, playing on this phone. No accounts, no adverts.', leftLabel: 'SHELF', rightLabel: 'ABOUT', stack: true });
    expose();
    const games = shelf();
    const cards = new Map<string, { el: HTMLElement; paint(): void }>();
    const here = new Set<string>();
    const busy = new Map<string, AbortController>();
    const status = new Map<string, string>();
    const shelfPanel = panel('THE SHELF', { status: `${games.length} GAME${games.length === 1 ? '' : 'S'}`, cls: 'arcshelf' });
    const grid = h('div.arcgrid', { role: 'list' });
    shelfPanel.body.append(grid);
    const about = panel('HOW IT PLAYS', { cls: 'arcabout' });
    about.body.append(
      h('p.arcnote', 'Each game is fetched once, on Wi-Fi, from the Internet Archive, checked against its known checksum and kept on this phone; it plays with no connection after that.'),
      h('p.arcnote', 'Only games whose own licence lets anyone pass them on are here: the free shareware episodes and the freeware releases, each named with its credit. Your saved games stay on this phone.'),
    );
    P.left.append(shelfPanel.el);
    P.right.append(about.el);

    /** The cards one GET fills (a game, and any card sharing its package: Freedoom's two phases). */
    const sharers = (e: ShelfEntry) => games.filter((g) => keptAs(g) === keptAs(e));
    const keeping = (e: ShelfEntry) => ({ id: keptAs(e), data: e.data });

    const hero = () => {
      P.big.textContent = here.size ? `${here.size} of ${games.length} ready` : `${games.length} game${games.length === 1 ? '' : 's'}`;
      arcadeState.here = [...here];
    };

    const card = (e: ShelfEntry) => {
      const title = h('h4.arctitle', e.title);
      const line = h('p.arcline', e.line);
      const said = h('p.arcghost', h('b', 'Ghosty'), ` ${e.ghosty}`);
      const score = h('p.arcscore');
      const stat = h('p.arcstatus', { 'aria-live': 'polite' });
      const bar = h('div.arcbar', { role: 'progressbar', 'aria-label': `${e.title}: download`, 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i'));
      const act = h('button.arcact', { type: 'button' });
      const more = h('button.arcmore', { type: 'button', 'aria-label': `More about ${e.title}: licence, controls, delete`, 'aria-expanded': 'false' }, '⋯');
      const details = h('div.arcdetails', { hidden: true });
      const el = h('article.arccard', { role: 'listitem', dataset: { id: e.id }, 'aria-label': e.title }, title, line, said, score, h('div.arcrow', act, more), stat, bar, details);
      const paint = () => {
        const kept = here.has(e.id);
        const getting = busy.has(keptAs(e));
        el.classList.toggle('kept', kept);
        el.classList.toggle('getting', getting);
        score.textContent = scoreWords(e, allScores()[e.id]);
        stat.textContent = status.get(e.id) ?? '';
        bar.hidden = !getting;
        const set = (text: string, label: string, aria: string, cls: string) => {
          act.textContent = text;
          act.dataset.label = label; // shown in sentence case, the size's unit kept ("Get · 2.5 MB")
          act.setAttribute('aria-label', aria);
          act.className = `arcact ${cls}`;
        };
        if (getting) set('STOP', 'Stop', `Stop getting ${e.title}`, 'stop');
        else if (kept) set('PLAY', 'Play', `Play ${e.title}`, 'play');
        else set(`GET · ${sizeWords(e.data.bytes)}`, `Get · ${sizeWords(e.data.bytes)}`, `Get ${e.title}, ${sizeWords(e.data.bytes)}, on Wi-Fi`, 'get');
        clear(details,
          h('p.arcnote', h('b', 'Licence '), e.data.licence),
          h('p.arcnote', h('b', 'Credit '), e.data.credit),
          h('ul.arcctl', ...controlLines(e).map((t) => h('li', t))),
          kept ? button('DELETE FROM THIS PHONE', () => void del(e), 'arcdel') : null,
        );
        const del2 = details.querySelector<HTMLButtonElement>('.arcdel');
        del2?.setAttribute('aria-label', `Delete ${e.title} from this phone (your saved games stay)`);
      };
      act.addEventListener('click', () => {
        if (busy.has(keptAs(e))) busy.get(keptAs(e))!.abort();
        else if (here.has(e.id)) void play(e);
        else void get(e);
      });
      more.addEventListener('click', () => {
        details.hidden = !details.hidden;
        more.setAttribute('aria-expanded', String(!details.hidden));
      });
      cards.set(e.id, { el, paint });
      paint();
      return el;
    };
    clear(grid, ...games.map(card));
    hero();
    const paint = (id: string) => cards.get(id)?.paint();

    // ---- GET: his tap, the size already said; on mobile data it waits for Wi-Fi
    const get = async (e: ShelfEntry) => {
      const ctl = new AbortController();
      busy.set(keptAs(e), ctl);
      const bars = () => sharers(e).flatMap((g) => [...(cards.get(g.id)?.el.querySelectorAll<HTMLElement>('.arcbar') ?? [])]);
      const say = (t: string) => {
        for (const g of sharers(e)) {
          status.set(g.id, t);
          paint(g.id);
        }
      };
      try {
        if (onMobileData()) {
          say(`On mobile data: it waits for Wi-Fi before fetching ${sizeWords(e.data.bytes)}.`);
          await Promise.race([offMobileData(ctl.signal), new Promise((_, reject) => ctl.signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }))]);
        }
        say(`Fetching ${sizeWords(e.data.bytes)} from the Internet Archive…`);
        const onProgress = (p: Progress) => {
          const pct = p.phase === 'download' ? Math.round((p.got / p.total) * 90) : p.phase === 'check' ? 92 : p.phase === 'unpack' ? 95 : 99;
          for (const b of bars()) {
            b.style.setProperty('--p', `${pct}%`);
            b.setAttribute('aria-valuenow', String(pct));
          }
          const t = p.phase === 'download' ? `Fetching ${sizeWords(p.got)} of ${sizeWords(p.total)}…` : p.phase === 'check' ? 'Checking it is the right file…' : p.phase === 'unpack' ? 'Unpacking on this phone…' : 'Keeping it on this phone…';
          if (status.get(e.id) !== t) say(t);
        };
        await getFiles(keeping(e), onProgress, { signal: ctl.signal });
        for (const g of sharers(e)) here.add(g.id);
        say(`On this phone. ${e.saves ? 'Saved games stay here too.' : ''}`.trim());
        vibrate(15);
      } catch (err) {
        const stopped = (err as Error)?.name === 'AbortError';
        say(stopped ? 'Stopped. Nothing was kept.' : `Could not get it: ${(err as Error)?.message ?? err}`);
      } finally {
        busy.delete(keptAs(e));
        for (const g of sharers(e)) paint(g.id);
        hero();
      }
    };

    const del = async (e: ShelfEntry) => {
      await removeFiles(keeping(e));
      for (const g of sharers(e)) {
        here.delete(g.id);
        status.set(g.id, `Deleted from this phone (${sizeWords(e.data.bytes)} back). GET brings it back; your saved games stay.`);
        paint(g.id);
      }
      hero();
    };

    // ---- PLAY: the player over everything
    const play = async (e: ShelfEntry) => {
      const engine = engineFor(e);
      if (!engine || arcadeState.playing) return;
      primeAudio(); // inside the tap: the phone allows sound from here on
      arcadeState.playing = e.id;
      const p = player(e);
      arcadeState.intent = p.intent;
      document.body.append(p.el);
      document.documentElement.classList.add('arcplaying');
      let handle: EngineHandle | null = null;
      const close = () => {
        p.stop();
        p.el.remove();
        document.documentElement.classList.remove('arcplaying');
        arcadeState.playing = '';
        paint(e.id);
      };
      try {
        const kept: EngineFiles = {};
        for (const [at, name] of readsFor(e)) {
          const b = await readKept(at, name);
          if (!b) throw new Error(`${name} is no longer on this phone: GET it again`);
          kept[name] = b;
        }
        handle = await engine.start(p.canvas, filesFor(e, kept), p.intent, {
          onError: (err) => p.fail(err.message),
          onHit: () => vibrate(25),
          onLevelDone: (sc, words) => {
            const r = recordScore(e.id, sc);
            toast(`${words || e.done}${r.isBest ? ' New best.' : ''}`, 'ok');
          },
        }, { saves: saveStore(e.id), sound: soundOn() });
        p.ready(handle);
        const seconds = await p.done;
        await handle.quit();
        if (e.engine === 'dos') {
          const r = recordScore(e.id, seconds);
          status.set(e.id, `${e.done} ${timeWords(seconds)} this time${r.isBest ? ', your longest yet' : ''}.`);
        }
      } catch (err) {
        status.set(e.id, `It would not start: ${(err as Error)?.message ?? err}`);
        await handle?.quit().catch(() => undefined);
      } finally {
        close();
      }
    };

    // what is already on this phone
    void Promise.all(games.map(async (e) => ((await isHere(keeping(e))) ? here.add(e.id) : undefined))).then(() => {
      for (const e of games) paint(e.id);
      hero();
    });

    return {
      enter() {
        for (const e of games) paint(e.id);
      },
      describe() {
        const g = games.find((x) => x.id === arcadeState.playing);
        return g ? `ARCADE: playing ${g.title}` : `ARCADE: ${games.length} free games on the shelf, ${here.size} on this phone`;
      },
    };
  },
};

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.arcade = arcadeState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

/** The player: the canvas, the touch layer, the gamepad layer and PAUSE. `done` settles with the seconds played. */
function player(e: ShelfEntry) {
  const intent: Intent = idle();
  const touch: Intent = idle();
  let padIntent: Intent | null = null;
  const canvas = h('canvas.arccanvas', { width: 320, height: 200, role: 'img', 'aria-label': `${e.title}, playing` });
  const screen = h(`div.arcscreen${e.engine === 'dos' ? '.dos' : ''}` as 'div', canvas);
  const loading = h('div.arcloading', { role: 'status' }, `Starting ${e.title}…`);
  const knob = h('i.arcknob');
  const base = h('div.arcbase', { 'aria-hidden': 'true' }, knob);
  const stickZone = h('div.arcstick', { role: 'application', 'aria-label': 'Move: put your left thumb down anywhere here and slide it' }, base);
  const dragOn = !e.dos || e.dos.controls.drag !== 'none';
  const lookZone = h('div.arclook', { role: 'application', 'aria-label': dragOn ? 'Look: drag with your right thumb' : 'Right thumb area' });
  const big = buttonsOf(e).filter((b) => !b.small).slice(0, 4);
  const small = buttonsOf(e).filter((b) => b.small);
  const holdBtn = (b: DosButton, cls: string) => {
    const el = h(`button.${cls}` as 'button', { type: 'button', 'aria-label': `${b.label}${b.key ? ` (${b.cycle?.length ? 'next weapon' : keyWord(b.key)})` : ''}`, dataset: { act: b.act, case: 'keep' } }, b.label);
    const on = (ev: PointerEvent) => {
      ev.preventDefault();
      capture(el, ev.pointerId);
      touch.held.add(b.act);
      el.classList.add('on');
      if (cls === 'arcbtn') vibrate(8);
    };
    const off = () => {
      touch.held.delete(b.act);
      el.classList.remove('on');
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    return el;
  };
  const kbd = h('input.arckbd', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': 'Type to the game' });
  const kbdBtn = h('button.arckey', { type: 'button', 'aria-label': 'Keyboard: type to the game (a saved game\'s name, a cheat)' }, '⌨');
  kbdBtn.addEventListener('click', () => (document.activeElement === kbd ? kbd.blur() : kbd.focus()));
  const pauseBtn = h('button.arcpause', { type: 'button', 'aria-label': 'Pause' }, h('i'), h('i'));
  const keys = h('div.arckeys', ...small.map((b) => holdBtn(b, 'arckey')), ...(e.engine === 'dos' ? [kbdBtn] : []));
  const btns = h('div.arcbtns', ...big.map((b, i) => {
    const el = holdBtn(b, 'arcbtn');
    el.dataset.slot = String(i);
    return el;
  }));
  const padNote = h('div.arcpadnote', { role: 'status', hidden: true }, 'Controller connected');
  const layer = h('div.arctouch', stickZone, lookZone, btns, keys, pauseBtn, padNote);

  // the PAUSE sheet
  const sndBtn = h('button.arcm', { type: 'button', role: 'switch', 'aria-checked': String(soundOn()) });
  const paintSnd = () => {
    const on = soundOn();
    sndBtn.textContent = on ? 'SOUND: ON' : 'SOUND: OFF';
    sndBtn.setAttribute('aria-checked', String(on));
    sndBtn.setAttribute('aria-label', on ? 'Sound is on: turn it off' : 'Sound is off: turn it on');
  };
  paintSnd();
  const resumeBtn = h('button.arcm.resume', { type: 'button', 'aria-label': `Resume ${e.title}` }, 'RESUME');
  const quitBtn = h('button.arcm.quit', { type: 'button', 'aria-label': `Quit ${e.title} (it saves first)` }, 'QUIT');
  const ctlBtn = h('button.arcm', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Controls: what each button and key does' }, 'CONTROLS');
  const ctlList = h('ul.arcctl', { hidden: true }, ...controlLines(e).map((t) => h('li', t)));
  const menu = h('div.arcmenu', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${e.title} paused`, hidden: true },
    h('div.arcsheet', h('h4', e.title), h('p.arcnote', 'Paused. It saves when you quit.'), resumeBtn, quitBtn, sndBtn, ctlBtn, ctlList));
  const errBox = h('p.arcerr', { role: 'alert', hidden: true });
  const el = h('div.arcplayer', { role: 'region', 'aria-label': `${e.title}: the game` }, screen, layer, loading, menu, errBox, kbd);

  let handle: EngineHandle | null = null;
  let finish: (seconds: number) => void = () => undefined;
  const done = new Promise<number>((r) => (finish = r));
  let played = 0;
  let since = 0;
  let paused = false;
  const clock = () => (since ? played + (performance.now() - since) / 1000 : played);

  const pause = () => {
    if (paused || !handle) return;
    paused = true;
    played = clock();
    since = 0;
    handle.pause();
    touch.held.clear();
    menu.hidden = false;
    resumeBtn.focus();
  };
  const resume = () => {
    if (!paused || !handle) return;
    paused = false;
    since = performance.now();
    menu.hidden = true;
    handle.resume();
  };
  pauseBtn.addEventListener('click', pause);
  resumeBtn.addEventListener('click', resume);
  quitBtn.addEventListener('click', () => {
    quitBtn.disabled = true;
    quitBtn.textContent = 'SAVING…';
    finish(clock());
  });
  sndBtn.addEventListener('click', () => {
    const on = !soundOn();
    setSoundPref(on);
    handle?.setSound(on);
    paintSnd();
  });
  ctlBtn.addEventListener('click', () => {
    ctlList.hidden = !ctlList.hidden;
    ctlBtn.setAttribute('aria-expanded', String(!ctlList.hidden));
  });
  const hidden = () => {
    if (document.visibilityState === 'hidden') pause();
  };
  document.addEventListener('visibilitychange', hidden);

  // ---- the stick: it lands under the thumb, the knob follows within its reach
  const R = 52;
  let stickId = -1;
  let ox = 0;
  let oy = 0;
  stickZone.addEventListener('pointerdown', (ev) => {
    if (stickId !== -1) return;
    ev.preventDefault();
    stickId = ev.pointerId;
    capture(stickZone, ev.pointerId);
    const r = stickZone.getBoundingClientRect();
    ox = ev.clientX;
    oy = ev.clientY;
    base.style.left = `${ox - r.left}px`;
    base.style.top = `${oy - r.top}px`;
    base.classList.add('on');
  });
  stickZone.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== stickId) return;
    const dx = ev.clientX - ox;
    const dy = ev.clientY - oy;
    const m = touchMove(dx, dy, R);
    touch.moveX = m.moveX;
    touch.moveY = m.moveY;
    const len = Math.hypot(dx, dy);
    const k = len > R ? R / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  });
  const stickOff = (ev: PointerEvent) => {
    if (ev.pointerId !== stickId) return;
    stickId = -1;
    touch.moveX = touch.moveY = 0;
    knob.style.transform = '';
    base.classList.remove('on');
    base.style.left = base.style.top = '';
  };
  stickZone.addEventListener('pointerup', stickOff);
  stickZone.addEventListener('pointercancel', stickOff);

  // ---- drag to look, on the right half
  let lookId = -1;
  let lx = 0;
  let ly = 0;
  lookZone.addEventListener('pointerdown', (ev) => {
    if (lookId !== -1 || !dragOn) return;
    ev.preventDefault();
    lookId = ev.pointerId;
    capture(lookZone, ev.pointerId);
    lx = ev.clientX;
    ly = ev.clientY;
  });
  lookZone.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== lookId) return;
    const l = touchLook(ev.clientX - lx, ev.clientY - ly);
    lx = ev.clientX;
    ly = ev.clientY;
    intent.lookX += l.lookX;
    intent.lookY += l.lookY;
  });
  const lookOff = (ev: PointerEvent) => {
    if (ev.pointerId === lookId) lookId = -1;
  };
  lookZone.addEventListener('pointerup', lookOff);
  lookZone.addEventListener('pointercancel', lookOff);

  // ---- every frame: the pad, then both layers into the one Intent the engine reads
  let raf = 0;
  let last = performance.now();
  let padPause = false;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    padIntent = null;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const r = readPad(pad, e.engine, dt);
      if (!r) continue;
      padIntent = r;
      if (!arcadeState.pad) {
        arcadeState.pad = true;
        padNote.hidden = false;
        setTimeout(() => (padNote.hidden = true), 2500);
      }
      break;
    }
    const wantsPause = !!padIntent?.held.has('pause');
    if (wantsPause && !padPause) (paused ? resume : pause)();
    padPause = wantsPause;
    if (paused) {
      intent.moveX = intent.moveY = 0;
      intent.held.clear();
      return;
    }
    const m = merge(touch, padIntent);
    intent.moveX = m.moveX;
    intent.moveY = m.moveY;
    intent.held.clear();
    for (const a of m.held) if (a !== 'pause') intent.held.add(a);
    if (padIntent) {
      intent.lookX += padIntent.lookX;
      intent.lookY += padIntent.lookY;
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    el,
    canvas,
    intent,
    done,
    ready(hd: EngineHandle) {
      handle = hd;
      loading.hidden = true;
      since = performance.now();
    },
    fail(message: string) {
      errBox.hidden = false;
      errBox.textContent = `${e.title} stopped: ${message}. Quit to go back.`;
      pause();
    },
    stop() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', hidden);
      kbd.blur();
    },
  };
}
