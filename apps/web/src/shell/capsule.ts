/**
 * GROWN UP'S CAPSULE (BRIEF-GROWN-UP-HUD 3; docs/build-plan/mockups/directions/d3/home-440.png, nav-440.png): in this world one glass capsule
 * stands at the foot of EVERY screen in place of the ask bar over the tab bar, and Home is no exception:
 *   the ROOMS key at the left (opens THE ROOMS layer, shell/house.ts: recent and starred on top, then every room with its screens as chips);
 *   ONE FIELD in the middle (`Ask or jump anywhere`: a tap raises the jump bar, shell/jump.ts: Recent and Starred first, a typed word that
 *   matches a screen or an ability is found, anything else is his turn to me, the mic in the field);
 *   a SMALL MIND at the right (a 48 pt view of the one Mind, 44 pt of control: a press talks, as the mic did; held 350 ms (HOLD_MS) the quick
 *   switcher fans the tools of the room he is in, as a tab's long press did).
 * Every screen ends above the capsule (`--dockh`, measured by the house as ever); toasts stand above it.
 *
 * The small Mind is a second VIEW of the one Mind, never a second renderer: where Mind runs here it is copied from its one WebGL context (a
 * still, a few times a minute, only while the view is on screen); where WebGL is off, or Mind has not started, ORBIT's 2-D stand-in (the
 * sphere, its graticule, its core, its lit rim in his colour) is drawn and moves a little unless motion is calm. The Stage's jewel (show/stage.ts)
 * is the same view, drawn the same way (`orbView`).
 */
import { h, icon } from '../core/dom';
import { togglePalette } from '../commands/registry';
import { ui } from '../state/app';
import { recipeEvents } from '../state/theme';
import { currentMind, webglWorks, type MindState } from '../features/core/mind';
import { AREAS } from './areadefs';
import { areaOf, switchItems } from './areas';
import { fieldWords, grownOn, housePlan } from './house';
import { drawOrb } from './orbit';
import { buildSwitcher, HOLD_MS } from './switcher';

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
/** The rooms key's glyph: four small squares, the mock's (d3/home-440.png). */
const ROOMS = '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>';

/** What the capsule is doing, for the checks and the console (window.__ghosty.capsule). */
export const capsuleState = {
  /** The quick switcher is open from the small Mind, the tools on it and the one under the finger. */
  fan: false,
  tools: [] as string[],
  on: '',
  /** The room the fan was opened for. */
  room: '',
  opened: '',
  /** How the small Mind is drawn now: the copy of the one Mind, or the stand-in. */
  view: '' as '' | 'mind' | 'standin',
  /** The words in the field. */
  field: '',
  /** The small Mind is listening (the mic is on). */
  listening: false,
};

const calm = (): boolean => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'calm';

/**
 * A view of the one Mind in a canvas of `px` CSS pixels: the one Mind's own still, copied a few times a minute, between which (and wherever WebGL
 * is off) the 2-D stand-in. `visible` says whether it is worth drawing now. Returns the canvas, a redraw and a stop. Pure drawing otherwise.
 */
export function orbView(px: number, visible: () => boolean, onView?: (v: 'mind' | 'standin') => void): { cv: HTMLCanvasElement; tick(): void; start(): void; stop(): void } {
  const cv = h('canvas', { 'aria-hidden': 'true' });
  let stillAt = 0;
  let timer = 0;
  let from: 'mind' | 'standin' | '' = '';
  const draw = (t: number) => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const S = Math.round(px * dpr);
    if (cv.width !== S || cv.height !== S) {
      cv.width = S;
      cv.height = S;
    }
    const mind = currentMind();
    const state = (ui.get().voice as MindState) || 'idle';
    if (mind && webglWorks() && !mind.booting && !mind.lentOut && performance.now() - stillAt > 4000) {
      try {
        if (mind.still(state === 'listening' || state === 'thinking' ? state : 'idle', cv)) {
          stillAt = performance.now();
          from = 'mind';
          return onView?.('mind');
        }
      } catch {
        /* the stand-in below */
      }
    }
    if (from === 'mind' && performance.now() - stillAt < 4000) return;
    drawOrb(cv, px, dpr, calm() ? 0 : t, state);
    from = 'standin';
    onView?.('standin');
  };
  const tick = () => {
    if (visible()) draw(performance.now() / 1000);
  };
  const stop = () => clearInterval(timer);
  const start = () => {
    stop();
    stillAt = 0;
    tick();
    // (a still frame when calm; otherwise about ten a second while it is on screen: it drifts, it never races)
    if (!calm()) timer = window.setInterval(tick, 100);
  };
  return { cv, tick, start, stop };
}

export interface Capsule {
  paint(): void;
}

export function buildCapsule(dock: HTMLElement): Capsule {
  // ---------------------------------------------------------------- the three parts: the rooms key, the one field, the small Mind
  const rooms = h('button.gcaprooms', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Rooms: every screen, by room', dataset: { case: 'keep' } }, icon(ROOMS));
  const words = h('span.gcapwords', { dataset: { case: 'keep' } });
  const field = h('button.gcapfield', { type: 'button', 'aria-label': 'Ask or jump anywhere', dataset: { case: 'keep' } }, words);
  const view = orbView(48, () => grownOn() && !document.hidden && dock.getClientRects().length > 0, (v) => (capsuleState.view = v));
  const mind = h('button.gcapmind', { type: 'button', 'aria-label': 'Talk to me. Hold me for this room’s screens', dataset: { case: 'keep' } },
    h('i.gcapring', { 'aria-hidden': 'true' }), view.cv, icon(MIC, 'ic gcapmic'));
  const cap = h('div.gcap', { dataset: { case: 'keep' } }, rooms, field, mind);
  dock.append(cap);

  rooms.addEventListener('click', () => housePlan()?.toggle());
  field.addEventListener('click', () => {
    housePlan()?.close();
    togglePalette();
  });

  // ---------------------------------------------------------------- a press talks, as the mic did (Core's mic is the one microphone)
  const coreMic = () => document.querySelector<HTMLButtonElement>('#cbar #mic');
  const talk = () => {
    housePlan()?.close();
    const m = coreMic();
    if (m) m.click();
    else togglePalette();
  };
  // the mic's own state (a voice conversation on) is the small Mind's: lit while it listens
  const watchMic = () => {
    const m = coreMic();
    if (!m || m.dataset.watched) return;
    m.dataset.watched = 'true';
    const mirror = () => {
      const on = m.classList.contains('on');
      capsuleState.listening = on;
      mind.classList.toggle('listening', on);
      mind.setAttribute('aria-pressed', String(on));
    };
    new MutationObserver(mirror).observe(m, { attributes: true, attributeFilter: ['class'] });
    mirror();
  };

  // ---------------------------------------------------------------- hold it: the quick switcher fans the room's tools
  const sw = buildSwitcher();
  dock.before(sw.el);
  let hold = 0;
  let held = false;
  let at = { x: 0, y: 0, id: -1, t: 0 };
  const open = () => {
    const a = areaOf(ui.get().tab) ?? AREAS[0]!;
    const list = switchItems(a);
    capsuleState.room = a.id;
    capsuleState.tools = list.map((x) => x.id);
    capsuleState.fan = true;
    sw.open(mind, a.title, list.map((x) => ({ ...x, open: () => { capsuleState.opened = x.id; x.open(); } })));
  };
  const shut = () => {
    capsuleState.fan = false;
    capsuleState.on = '';
  };
  mind.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    held = false;
    clearTimeout(hold);
    sw.close();
    at = { x: e.clientX, y: e.clientY, id: e.pointerId, t: e.timeStamp };
    hold = window.setTimeout(() => {
      hold = 0;
      held = true;
      open();
    }, HOLD_MS);
  });
  mind.addEventListener('click', () => {
    // the lift that ends a hold is not a press
    if (held) return void (held = false);
    talk();
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== at.id) return;
    if (hold && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 14) {
      clearTimeout(hold);
      hold = 0;
    }
    if (held) {
      sw.hover(e.clientX, e.clientY);
      capsuleState.on = document.querySelector<HTMLElement>('#switcher .switem.on')?.dataset.id ?? '';
    }
  });
  addEventListener('pointerup', (e) => {
    if (e.pointerId !== at.id) return;
    clearTimeout(hold);
    hold = 0;
    at.id = -1;
    // lifted sooner than the hold by the finger's own clock (a busy phone can run the timer late): a press after all
    if (held && e.timeStamp - at.t < HOLD_MS) {
      held = false;
      sw.close();
      shut();
      return;
    }
    if (held) {
      sw.release(e.clientX, e.clientY);
      shut();
      // (the click that follows, when the lift is on the small Mind itself, clears `held`)
      setTimeout(() => (held = false), 0);
    }
  });
  addEventListener('pointercancel', (e) => {
    if (e.pointerId !== at.id) return;
    clearTimeout(hold);
    hold = 0;
    at.id = -1;
    held = false;
    sw.close();
    shut();
  });
  // (a long press is never the phone's own menu, a selection or a callout)
  mind.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------------------------------------------------------------- what the field says, and whether the capsule is there
  const paint = () => {
    const on = grownOn();
    cap.hidden = !on;
    if (!on) {
      sw.close();
      shut();
      return view.stop();
    }
    const w = fieldWords();
    if (words.textContent !== w) words.textContent = w;
    capsuleState.field = w;
    rooms.setAttribute('aria-expanded', String(!!housePlan()?.isOpen()));
    watchMic();
    view.start();
  };
  ui.subscribe((s, p) => {
    if (s.tab !== p.tab || s.connected !== p.connected) paint();
    else if (s.voice !== p.voice) view.tick();
  });
  recipeEvents.on('change', paint);
  addEventListener('resize', paint);
  addEventListener('ghosty:deck', paint);
  document.addEventListener('visibilitychange', paint);
  // the Stage comes and goes: the field's words say what it is for
  new MutationObserver(() => {
    rooms.setAttribute('aria-expanded', String(document.body.classList.contains('planned')));
    if (grownOn()) {
      const w = fieldWords();
      if (words.textContent !== w) words.textContent = w;
      capsuleState.field = w;
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.capsule = capsuleState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  paint();
  return { paint };
}
