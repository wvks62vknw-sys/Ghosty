/**
 * THE ORB REACTING (BRIEF-OCT-IDEAS-1 3), drawn over the orb's box on THE SCAN's Home in 2-D, so it is the same whether Mind draws
 * the orb or the flat stand-in does:
 *  - a pulse while I think: the orb's glow breathes at 0.8 Hz (`--g-orb-breath`, 0..1) from the turn's start until its first word;
 *  - the owner's voice as a ring of 32 bars round the orb while the mic is open: amplitude only, from the frequency bins the voice
 *    code already reads for its level meter, drawn and forgotten each frame (nothing stored, nothing sent);
 *  - a thread of light from the orb to the room in use while the plan is open (300 ms to draw, gone when the plan folds).
 * Reduced motion draws none of the three. All of it is decorative: aria-hidden.
 */
import { micLevel } from '../../assistant/voice';
import { chat } from '../../assistant/session';
import { h, svgEl } from '../../core/dom';
import { ui } from '../../state/app';
import { ORB_FILL } from './scan/world';

const BARS = 32;
const BREATH_HZ = 0.8;

/** What the checks read and drive (window.__ghosty.orbfx): `feed` stands in for the microphone's bins (a function returning them). */
export const orbFxState = {
  thinking: false,
  breath: 0,
  ring: false,
  bars: BARS,
  /** The newest bar heights, 0..1 (this frame's, replaced each frame). */
  level: [] as number[],
  feed: null as null | (() => Uint8Array | null),
  thread: null as null | { from: number[]; to: number[] },
};

export interface OrbFx {
  el: HTMLElement;
  /** Each frame while Home is drawn: `t` the frame's time (ms), `still` Reduce Motion, `size` the orb box's side in px. */
  frame(t: number, still: boolean, size: number): void;
  /** The plan opened or folded: draw or take away the thread (from the orb's box to the lit room's row). */
  plan(open: boolean, orb: HTMLElement, still: boolean): void;
}

export function orbFx(): OrbFx {
  const glow = h('i.orbglow');
  const bars = Array.from({ length: BARS }, (_, i) => h('i.bar', { style: `--i:${i};--v:.12` }));
  const ring = h('div.orbring', { dataset: { on: 'false' } }, ...bars);
  const el = h('div.orbfx', { 'aria-hidden': 'true' }, glow, ring);
  let since = -1;
  let seenLive = '';
  let was = false;
  let ringR = 0;
  let thread: SVGSVGElement | null = null;

  const thinkingNow = (t: number): boolean => {
    const u = ui.get();
    const busy = u.busy && u.voice !== 'speaking';
    if (!busy) {
      was = false;
      return false;
    }
    // from the turn's start until its first word: the reply line changing is the first word
    if (!was) {
      was = true;
      seenLive = chat.get().live;
      since = t;
    }
    return chat.get().live === seenLive;
  };

  const spectrum = (): Uint8Array | null => {
    if (orbFxState.feed) return orbFxState.feed();
    return ui.get().voice === 'listening' ? micLevel.spectrum : null;
  };

  return {
    el,
    frame(t, still, size) {
      // the pulse
      const think = !still && thinkingNow(t);
      orbFxState.thinking = think;
      const breath = think ? 0.5 - 0.5 * Math.cos(2 * Math.PI * BREATH_HZ * ((t - since) / 1000)) : 0;
      if (Math.abs(breath - orbFxState.breath) > 0.002 || (!think && orbFxState.breath)) {
        orbFxState.breath = Math.round(breath * 1000) / 1000;
        el.style.setProperty('--g-orb-breath', String(orbFxState.breath));
      }
      // the ring
      const bins = still ? null : spectrum();
      const on = !!bins && bins.length > 0;
      if (on !== (ring.dataset.on === 'true')) ring.dataset.on = String(on);
      orbFxState.ring = on;
      if (size > 0) {
        const r = Math.round((size * ORB_FILL) / 2);
        if (r !== ringR) {
          ringR = r;
          el.style.setProperty('--ring-r', `${r}px`);
        }
      }
      if (on && bins) {
        const per = Math.max(1, Math.floor((bins.length * 0.75) / BARS));
        const lv: number[] = [];
        for (let i = 0; i < BARS; i++) {
          let sum = 0;
          for (let k = 0; k < per; k++) sum += bins[Math.min(bins.length - 1, i * per + k)] ?? 0;
          // the amplitude of its slice of the voice, 0..1, with a thin floor so the ring reads as a ring while the mic is open
          lv.push(Math.max(0.12, Math.min(1, sum / per / 255)));
        }
        orbFxState.level = lv;
        bars.forEach((b, i) => b.style.setProperty('--v', lv[i]!.toFixed(2)));
      } else if (orbFxState.level.length) orbFxState.level = [];
    },
    plan(open, orb, still) {
      thread?.remove();
      thread = null;
      orbFxState.thread = null;
      if (!open || still) return;
      const o = orb.getBoundingClientRect();
      const row = document.querySelector<HTMLElement>('#plan .planroom.lit .planroomhead');
      if (!row || o.width < 2) return;
      const r = row.getBoundingClientRect();
      const cx = o.left + o.width / 2;
      const cy = o.top + o.height / 2;
      const tx = Math.max(r.left, Math.min(r.right, cx));
      const ty = Math.max(r.top, Math.min(r.bottom, cy));
      const ang = Math.atan2(ty - cy, tx - cx);
      const rr = (o.width * ORB_FILL) / 2;
      const sx = cx + rr * Math.cos(ang);
      const sy = cy + rr * Math.sin(ang);
      const len = Math.hypot(tx - sx, ty - sy);
      const path = svgEl('path', { class: 'orbthreadline', d: `M${sx.toFixed(1)} ${sy.toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}` });
      const dot = svgEl('circle', { class: 'orbthreaddot', cx: tx.toFixed(1), cy: ty.toFixed(1), r: 2.5 });
      thread = svgEl('svg', { class: 'orbthread', 'aria-hidden': 'true', width: String(innerWidth), height: String(innerHeight), viewBox: `0 0 ${innerWidth} ${innerHeight}` });
      thread.append(path, dot);
      document.body.append(thread);
      orbFxState.thread = { from: [Math.round(sx), Math.round(sy)], to: [Math.round(tx), Math.round(ty)] };
      path.setAttribute('stroke-dasharray', String(len));
      path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 300, easing: 'ease-out', fill: 'both' });
      dot.animate([{ opacity: 0 }, { opacity: 0, offset: 0.8 }, { opacity: 1 }], { duration: 300, fill: 'both' });
    },
  };
}

const w = window as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.orbfx = orbFxState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
