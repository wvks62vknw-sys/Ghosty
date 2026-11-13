/**
 * ORBIT'S WAY ROUND (BRIEF-ORBIT-HUD 3; docs/build-plan/mockups/directions/d1/nav-440.png): in this world no screen has a tab bar. The orb
 * (56 pt) sits bottom-left as the OPEN END OF A LINE that runs to the right edge and carries the screen's own words (`fieldWords`: the field).
 * Press the orb: the typed word (the jump bar: his Recent and Starred nearest it, then what was found). Hold it 350 ms (HOLD_MS) and the six
 * rooms fan round it on an arc (the quick switcher's pointer handling, shell/switcher.ts); slide to one and let go: its hub; let go on none:
 * nothing. The left end of the line, next to the orb, unfolds the house's plan (shell/house.ts: the same seven rooms as stations along an
 * orbit). Every screen ends above the line (`--dockh`, measured by the house as ever).
 *
 * The orb is a second VIEW of the one Mind, never a second renderer: where the Mind runs here it is copied from its one WebGL context (a
 * still, a few times a minute, only while this screen is on); where WebGL is off, or Mind has not started, a 2-D stand-in is drawn (the
 * sphere, its graticule, its core and its lit rim in his colour) and moves a little unless motion is calm. Home has no line: the real orb
 * is at the centre of its sky (features/core/orbit/home.ts), and a press there is the same press.
 *
 * Presses are counted on this phone (`ghosty.orbit.presses`): the hint under the orb on Home (`Press me to ask, or to find anything.`) is
 * there until the tenth, then gone. Nothing is sent anywhere.
 */
import { h, icon } from '../core/dom';
import { togglePalette } from '../commands/registry';
import { ui } from '../state/app';
import { recipeEvents } from '../state/theme';
import { currentMind, webglWorks, type MindState } from '../features/core/mind';
import { AREAS, type Area } from './areadefs';
import { navTo, liveIn } from './areas';
import { fieldWords, housePlan, orbitOn } from './house';
import { buildSwitcher, HOLD_MS, type SwitchItem } from './switcher';

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
/** The plan's glyph: a ring with its six stations (the house's rooms) round a point. */
const PLAN = '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="4.5" r="1.3"/><circle cx="18.5" cy="8.2" r="1.3"/><circle cx="18.5" cy="15.8" r="1.3"/><circle cx="12" cy="19.5" r="1.3"/><circle cx="5.5" cy="15.8" r="1.3"/><circle cx="5.5" cy="8.2" r="1.3"/>';

/** How many presses the orb is new for: the hint under it on Home is shown until it has been pressed this many times. */
export const HINT_UNTIL = 10;
const PRESS_KEY = 'ghosty.orbit.presses';

/** What the orb and its line are doing, for the checks and the console (window.__ghosty.orbit). */
export const orbitState = {
  /** The fan is open. */
  fan: false,
  /** The rooms on it, in order, and the one under the finger. */
  rooms: [] as string[],
  on: '',
  /** The room the last fan opened. */
  opened: '',
  /** How the orb on the line is drawn now: the copy of the one Mind, or the stand-in. */
  view: '' as '' | 'mind' | 'standin',
  /** The words on the line. */
  field: '',
  /** Presses so far (the hint's count), on this phone. */
  presses: 0,
};

let memory = 0;
/** Presses counted so far on this phone (storage that is blocked counts for this visit only). */
export function orbPresses(): number {
  try {
    const n = Number(localStorage.getItem(PRESS_KEY));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : memory;
  } catch {
    return memory;
  }
}
/** The hint is shown: the orb has been pressed fewer than ten times. */
export const hintOn = (): boolean => orbPresses() < HINT_UNTIL;

/** The orb was pressed (a tap, not a hold): counted, and the typed word opens. Home's orb and the line's orb are the same press. */
export function pressOrb(): void {
  const n = Math.max(memory, orbPresses()) + 1;
  memory = n;
  try {
    localStorage.setItem(PRESS_KEY, String(n));
  } catch {
    /* storage unavailable: counted for this visit */
  }
  orbitState.presses = n;
  dispatchEvent(new CustomEvent('ghosty:orbitpress', { detail: { n } }));
  togglePalette();
}

/** The six rooms (the house's, without Home): the stations on Home's ring and the fan's items, in the plan's order. */
export const ORBIT_ROOMS: Area[] = AREAS.filter((a) => a.id !== 'ask');
export const roomHub = (a: Area): string => `area-${a.id}`;

/** The orb's stand-in colours: read from his tokens (his colour, its pale tint), so it recolours with the theme. */
function tint(): { c: string; p: string } {
  const cs = getComputedStyle(document.documentElement);
  const rgb = (n: string, d: string) => (cs.getPropertyValue(n).trim() || d).replace(/\s+/g, '');
  return { c: rgb('--g-accent-rgb', '100,210,255'), p: rgb('--g-accent-pale-rgb', '191,240,255') };
}

/**
 * The 2-D orb: the sphere with its lit rim, a graticule that turns a little, the core, the points of what I know. Pure drawing into a
 * canvas of `px` CSS pixels at `dpr`; `t` seconds is the turn (0 holds it still: calm motion, Reduce Motion).
 */
export function drawOrb(cv: HTMLCanvasElement, px: number, dpr: number, t: number, state: MindState | 'idle'): void {
  const g = cv.getContext('2d');
  if (!g) return;
  const S = Math.round(px * dpr);
  if (cv.width !== S || cv.height !== S) {
    cv.width = S;
    cv.height = S;
  }
  const { c, p } = tint();
  const R = S / 2;
  const r = R * 0.8;
  g.clearRect(0, 0, S, S);
  g.save();
  g.translate(R, R);
  // the halo: the light the orb gives off (a little more while I listen or think)
  const lift = state === 'listening' || state === 'thinking' || state === 'busy' ? 1.25 : 1;
  const halo = g.createRadialGradient(0, 0, r * 0.7, 0, 0, R);
  halo.addColorStop(0, `rgba(${c},${0.3 * lift})`);
  halo.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = halo;
  g.fillRect(-R, -R, S, S);
  // the body: a dark sphere with the light in it
  const body = g.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
  body.addColorStop(0, `rgba(${c},.34)`);
  body.addColorStop(0.7, `rgba(${c},.1)`);
  body.addColorStop(1, 'rgba(4,8,14,.75)');
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();
  // the graticule: meridians that turn, and three parallels
  g.save();
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.clip();
  g.lineWidth = Math.max(1, dpr * 0.8);
  g.strokeStyle = `rgba(${p},.34)`;
  for (let i = 0; i < 4; i++) {
    const a = ((i / 4) * Math.PI + t * 0.5) % Math.PI;
    g.beginPath();
    g.ellipse(0, 0, Math.abs(Math.cos(a)) * r, r, 0, 0, Math.PI * 2);
    g.stroke();
  }
  for (const y of [-0.5, 0, 0.5]) {
    const w = Math.sqrt(1 - y * y) * r;
    g.beginPath();
    g.ellipse(0, y * r, w, w * 0.22, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // the points of what I know, a few, drifting with the turn
  g.fillStyle = `rgba(${p},.9)`;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.399 + t * 0.35;
    const y = ((i * 0.37) % 1) * 1.5 - 0.75;
    const rad = Math.sqrt(1 - y * y);
    const x = Math.sin(a) * rad;
    if (Math.cos(a) < -0.1) continue;
    g.beginPath();
    g.arc(x * r * 0.92, y * r * 0.92, Math.max(0.8, dpr * 0.9), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // the core
  const core = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.32);
  core.addColorStop(0, 'rgba(255,255,255,.95)');
  core.addColorStop(0.35, `rgba(${p},.7)`);
  core.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = core;
  g.fillRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.8);
  // the rim, lit in his colour
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.lineWidth = Math.max(1.5, dpr * 1.6);
  g.strokeStyle = `rgba(${c},.95)`;
  g.stroke();
  g.restore();
}

export interface Orbit {
  paint(): void;
}

export function buildOrbit(dock: HTMLElement): Orbit {
  // ---------------------------------------------------------------- the line: the orb at its open end, the plan, the words, the mic
  const cv = h('canvas.orbview', { 'aria-hidden': 'true' });
  const orb = h('button.orbbtn', { type: 'button', 'aria-label': 'Type a word. Hold me to see the rooms', dataset: { case: 'keep' } }, h('i.orbring', { 'aria-hidden': 'true' }), cv);
  const plan = h('button.orbplan', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'The house: seven rooms. Open the plan', dataset: { case: 'keep' } }, icon(PLAN));
  const words = h('span.orbwords', { dataset: { case: 'keep' } });
  const field = h('button.orbfield', { type: 'button', 'aria-label': 'Type a word, or ask me', dataset: { case: 'keep' } }, words);
  const mic = h('button.orbmic', { type: 'button', 'aria-label': 'Say it', dataset: { case: 'keep' } }, icon(MIC));
  const line = h('div.orbline', { dataset: { case: 'keep' } }, orb, plan, field, mic);
  dock.append(line);
  // the thread: the line rising from the orb (a hub's recent card hangs from it)
  const thread = h('i.orbthread', { 'aria-hidden': 'true' });
  line.append(thread);

  field.addEventListener('click', () => pressOrb());
  mic.addEventListener('click', () => void import('./jump').then((j) => j.openWithMic()));
  plan.addEventListener('click', () => housePlan()?.toggle());

  // ---------------------------------------------------------------- hold the orb: the six rooms fan round it
  const sw = buildSwitcher();
  dock.before(sw.el);
  let hold = 0;
  let held = false;
  let at = { x: 0, y: 0, id: -1, t: 0 };

  const items = (): SwitchItem[] => {
    const live = liveIn();
    return ORBIT_ROOMS.map((a) => ({
      id: a.id,
      name: a.title,
      glyph: a.icon,
      status: live[a.id] ? 'LIVE' : 'READY',
      instrument: null,
      reading: '',
      line: a.sub,
      open: () => {
        orbitState.opened = a.id;
        navTo(roomHub(a), 'switch');
      },
    }));
  };
  const openFan = () => {
    const r = orb.getBoundingClientRect();
    const list = items();
    // the arc is centred on the orb and reaches up and to the right: 44 pt of room between neighbours at the biggest text too
    const R = Math.min(250, Math.round(innerHeight * 0.5), Math.round(innerWidth - r.left - r.width / 2 - 60));
    sw.open(orb, 'Rooms', list, { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2), r: R, from: 85, to: 10, stay: false });
    orbitState.fan = true;
    orbitState.rooms = list.map((x) => x.id);
  };
  const shut = () => {
    orbitState.fan = false;
    orbitState.on = '';
  };
  orb.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    held = false;
    clearTimeout(hold);
    sw.close();
    at = { x: e.clientX, y: e.clientY, id: e.pointerId, t: e.timeStamp };
    hold = window.setTimeout(() => {
      hold = 0;
      held = true;
      openFan();
    }, HOLD_MS);
  });
  orb.addEventListener('click', () => {
    // the lift that ends a hold is not a press
    if (held) return void (held = false);
    pressOrb();
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerId !== at.id) return;
    if (hold && Math.hypot(e.clientX - at.x, e.clientY - at.y) > 14) {
      clearTimeout(hold);
      hold = 0;
    }
    if (held) {
      sw.hover(e.clientX, e.clientY);
      orbitState.on = document.querySelector<HTMLElement>('#switcher .switem.on')?.dataset.id ?? '';
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
      // (the click that follows, when the lift is on the orb itself, clears `held`)
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
  orb.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------------------------------------------------------------- the orb's picture: the one Mind's, or the stand-in
  const calm = () => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.dataset.motion === 'calm';
  const PX = 56;
  let stillAt = 0;
  let timer = 0;
  const draw = (t: number) => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const S = Math.round(PX * dpr);
    if (cv.width !== S || cv.height !== S) {
      cv.width = S;
      cv.height = S;
    }
    const mind = currentMind();
    const state = (ui.get().voice as MindState) || 'idle';
    // the one Mind, copied from its one context a few times a minute (never a second renderer); the stand-in between and wherever WebGL is off
    if (mind && webglWorks() && !mind.booting && !mind.lentOut && performance.now() - stillAt > 4000) {
      try {
        if (mind.still(state === 'listening' || state === 'thinking' ? state : 'idle', cv)) {
          stillAt = performance.now();
          orbitState.view = 'mind';
          return;
        }
      } catch {
        /* the stand-in below */
      }
    }
    if (orbitState.view === 'mind' && performance.now() - stillAt < 4000) return;
    drawOrb(cv, PX, dpr, calm() ? 0 : t, state);
    orbitState.view = 'standin';
  };
  const visible = () => orbitOn() && !document.hidden && document.body.dataset.tab !== 'core' && dock.getClientRects().length > 0;
  const tickOnce = () => {
    if (visible()) draw(performance.now() / 1000);
  };
  const loop = () => {
    clearInterval(timer);
    if (!orbitOn()) return;
    tickOnce();
    // (a still frame when calm; otherwise about ten a second while the line is on screen: it drifts, it never races)
    if (!calm()) timer = window.setInterval(tickOnce, 100);
  };

  // ---------------------------------------------------------------- what the line says, and where it is
  const paint = () => {
    const on = orbitOn();
    line.hidden = !on;
    if (!on) {
      sw.close();
      shut();
      return clearInterval(timer);
    }
    const w = fieldWords();
    if (words.textContent !== w) words.textContent = w;
    orbitState.field = w;
    plan.setAttribute('aria-expanded', String(!!housePlan()?.isOpen()));
    loop();
  };
  ui.subscribe((s, p) => {
    if (s.tab !== p.tab) paint();
    else if (s.voice !== p.voice) tickOnce();
  });
  recipeEvents.on('change', () => {
    stillAt = 0;
    paint();
  });
  addEventListener('resize', paint);
  addEventListener('ghosty:deck', paint);
  document.addEventListener('visibilitychange', paint);
  // the plan's own state is on the plan button (aria-expanded) the moment it opens or folds
  const obs = new MutationObserver(() => plan.setAttribute('aria-expanded', String(document.body.classList.contains('planned'))));
  obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.orbit = orbitState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
  paint();
  return { paint };
}
