/**
 * HOLOGRAPHIC DEPTH (BRIEF-OCT-IDEAS-1 2): on the phone, with his permission, THE SCAN's layers follow the phone's tilt, the world a
 * little, the plates less, the orb least, never more than 6 px, eased, on the display's own frame (requestAnimationFrame, no timers),
 * and a light follows the touch across a plate. Off until he permits it (THE LOOK, "The HUD tilts with the phone": a PERMIT key; iOS
 * asks on that tap, and the answer is remembered as the setting); Reduce Motion and ONE INK never move. Nothing is sent, nothing kept
 * but the on/off.
 */
import { para } from '../../ui/oneline';
import { h } from '../../core/dom';
import { settings } from '../../state/app';
import { key } from '../../ui/machine';

/** The most any layer moves (px): the world's; the plates move half of it, the orb a quarter. */
export const TILT_MAX = 6;
const LAYERS = { world: 1, plates: 0.5, orb: 0.25 } as const;

/** What the checks read (window.__ghosty.tilt). */
export const tiltState = { on: false, gx: 0, gy: 0, world: [0, 0], plates: [0, 0], orb: [0, 0], events: 0, answer: '' as '' | 'granted' | 'denied' | 'unsupported' };

type Perm = { requestPermission?: () => Promise<'granted' | 'denied'> };
const motionApi = (): Perm | null => (typeof DeviceOrientationEvent === 'undefined' ? null : (DeviceOrientationEvent as unknown as Perm));

/** Ask the phone (iOS asks; elsewhere the events just come) and remember the answer: the setting is on only if it was allowed. */
export async function permitTilt(): Promise<'granted' | 'denied' | 'unsupported'> {
  const api = motionApi();
  if (!api) return (tiltState.answer = 'unsupported');
  let ans: 'granted' | 'denied' = 'granted';
  if (typeof api.requestPermission === 'function') {
    try {
      ans = await api.requestPermission();
    } catch {
      ans = 'denied';
    }
  }
  tiltState.answer = ans;
  settings.set({ hudTilt: ans === 'granted' });
  return ans;
}

/** The PERMIT row in THE LOOK: what it does in one line, the key (PERMIT, then OFF), and what the phone said, in my words. */
export function tiltRow(): HTMLElement {
  const said = h('p.note.tiltsaid', { dataset: { case: 'keep' } });
  const btn = key('', async () => {
    if (settings.get().hudTilt) settings.set({ hudTilt: false });
    else await permitTilt();
    paint();
  }, { label: 'The HUD tilts with the phone' });
  const word = h('span');
  btn.append(word);
  const row = h('div.glook-tilt', { dataset: { case: 'keep' } },
    h('b', 'The HUD tilts with the phone'),
    ...para('p.note', 'The world, the plates and my orb shift a few pixels as you tilt the phone, and a light follows your finger across a plate. Off, nothing moves. Reduce Motion keeps it still either way.'),
    btn, said);
  const paint = () => {
    const on = settings.get().hudTilt;
    word.textContent = on ? 'OFF' : 'PERMIT';
    btn.setAttribute('aria-label', on ? 'Switch the HUD tilt off' : 'Permit the HUD to tilt with the phone');
    btn.setAttribute('aria-pressed', String(on));
    said.textContent = on
      ? 'On. Tilt the phone on Home.'
      : tiltState.answer === 'denied'
        ? 'The phone said no. Safari › Settings › Motion & Orientation Access turns it on; then tap PERMIT again.'
        : tiltState.answer === 'unsupported'
          ? 'This browser has no motion sensor, so the HUD cannot tilt here.'
          : 'Off. PERMIT asks the phone once.';
  };
  settings.subscribe((s, p) => s.hudTilt !== p.hudTilt && paint());
  paint();
  return row;
}

export interface Tilt {
  /** One display frame: eases the layers toward the phone's tilt and writes them; `dt` seconds since the last, `still` Reduce Motion. */
  frame(dt: number, still: boolean): void;
  /** Whether any layer is off its rest now (the frame must go on until they are home). */
  moving(): boolean;
}

/**
 * The layers THE SCAN gives it: the world (the stage, the marks and their leads), the plates (the column) and the orb. Listens to the
 * phone's orientation only while the setting is on and the page is drawn; takes its listener away when it is off.
 */
export function tilt(layers: { world: (HTMLElement | SVGElement)[]; plates: (HTMLElement | SVGElement)[]; orb: (HTMLElement | SVGElement)[] }, onMove: (world: number[], orb: number[]) => void): Tilt {
  let rest: number | null = null;
  let cur = { x: 0, y: 0 };
  let listening = false;
  const clamp = (k: number) => (k < -1 ? -1 : k > 1 ? 1 : k);
  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null && e.gamma == null) return;
    tiltState.events++;
    // the phone's left-right lean (gamma) as it is; its front-back lean (beta) from where it was first held, drifting back slowly to
    // wherever he holds it, so a phone held tipped is still at rest
    const beta = e.beta ?? 0;
    rest = rest === null ? beta : rest + (beta - rest) * 0.004;
    // (a dead band of 1.5 degrees: the sensor's own noise never shows as a shiver)
    const dead = (v: number) => (Math.abs(v) < 1.5 ? 0 : v - Math.sign(v) * 1.5);
    tiltState.gx = clamp(dead(e.gamma ?? 0) / 28.5);
    tiltState.gy = clamp(dead(beta - rest) / 28.5);
  };
  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) addEventListener('deviceorientation', onOrient, { passive: true });
    else {
      removeEventListener('deviceorientation', onOrient);
      rest = null;
      tiltState.gx = tiltState.gy = 0;
    }
  };
  const set = (els: (HTMLElement | SVGElement)[], x: number, y: number, to: number[]) => {
    const home = Math.abs(x) < 0.02 && Math.abs(y) < 0.02;
    to[0] = home ? 0 : Math.round(x * 100) / 100;
    to[1] = home ? 0 : Math.round(y * 100) / 100;
    const v = home ? '' : `translate3d(${to[0]}px, ${to[1]}px, 0)`;
    for (const e of els) if (e.style.transform !== v) e.style.transform = v;
  };
  return {
    frame(dt, still) {
      const want = settings.get().hudTilt && !still;
      tiltState.on = want;
      listen(want);
      const tx = want ? -tiltState.gx * TILT_MAX : 0;
      const ty = want ? -tiltState.gy * TILT_MAX : 0;
      // eased on the frame's own time: about a tenth of a second to settle
      const k = 1 - Math.exp(-dt * 12);
      cur = { x: cur.x + (tx - cur.x) * k, y: cur.y + (ty - cur.y) * k };
      set(layers.world, cur.x * LAYERS.world, cur.y * LAYERS.world, tiltState.world);
      set(layers.plates, cur.x * LAYERS.plates, cur.y * LAYERS.plates, tiltState.plates);
      set(layers.orb, cur.x * LAYERS.orb, cur.y * LAYERS.orb, tiltState.orb);
      onMove(tiltState.world, tiltState.orb);
    },
    moving: () => !!tiltState.world[0] || !!tiltState.world[1] || settings.get().hudTilt,
  };
}

const w = window as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.tilt = tiltState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
