/**
 * THE PHOTO EDITOR'S SLIDER (BRIEF-EDITOR-PHOTO): one row 44 pt tall (or more), its name on the left and its value said on the right
 * ("+0.7 stops", "5,200 K", "amount 40"), the track under them; reset by a double tap on the track or one tap on the value. The value
 * moves the picture live while the finger is down; the step is kept (one history step, named) when it lifts.
 */
import { h } from '../../core/dom';

export interface SliderOpts {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** What the slider rests at (a double tap goes here). */
  rest: number;
  /** The value as he reads it. */
  say: (v: number) => string;
  /** Live, while the finger moves. */
  live: (v: number) => void;
  /** Kept: the finger lifted, or the value was reset. */
  keep: (v: number, label: string) => void;
}

export interface SliderRow {
  el: HTMLElement;
  input: HTMLInputElement;
  set(v: number): void;
}

/** A number the way a person writes it: a sign on a change, a thousands comma. */
export const signed = (v: number, d = 0): string => {
  const s = Math.abs(v) < Math.pow(10, -d) / 2 ? (0).toFixed(d) : v.toFixed(d);
  return v > 0 && Number(s) !== 0 ? `+${s}` : s.replace('-', '−');
};
export const thousands = (v: number): string => Math.round(v).toLocaleString('en-GB');

export function slider(o: SliderOpts): SliderRow {
  const input = h('input', { type: 'range', min: String(o.min), max: String(o.max), step: String(o.step), value: String(o.value), id: `pe-s-${o.id}`, 'aria-label': o.label }) as HTMLInputElement;
  const val = h('button.peval', { type: 'button', 'aria-label': `${o.label}: reset` });
  const name = h('label.pelabel', { htmlFor: `pe-s-${o.id}` }, o.label);
  const paint = () => {
    const v = Number(input.value);
    val.textContent = o.say(v);
    input.setAttribute('aria-valuetext', o.say(v));
    val.classList.toggle('moved', v !== o.rest);
    const f = (v - o.min) / (o.max - o.min);
    input.style.setProperty('--f', `${Math.round(f * 100)}%`);
    input.style.setProperty('--r', `${Math.round(((o.rest - o.min) / (o.max - o.min)) * 100)}%`);
  };
  const reset = () => {
    if (Number(input.value) === o.rest) return;
    input.value = String(o.rest);
    paint();
    o.live(o.rest);
    o.keep(o.rest, `${o.label} reset`);
  };
  input.addEventListener('input', () => {
    paint();
    o.live(Number(input.value));
  });
  input.addEventListener('change', () => o.keep(Number(input.value), `${o.label} ${o.say(Number(input.value))}`));
  // a double tap on the track resets (a tap that lands twice within 350 ms, close together)
  let last = { t: 0, x: 0 };
  input.addEventListener('pointerdown', (e) => {
    const now = e.timeStamp;
    if (now - last.t < 350 && Math.abs(e.clientX - last.x) < 24) {
      last.t = 0;
      e.preventDefault();
      reset();
      return;
    }
    last = { t: now, x: e.clientX };
  });
  val.addEventListener('click', reset);
  paint();
  const el = h('div.peslider', { dataset: { id: o.id } }, h('div.perow', name, val), input);
  return {
    el,
    input,
    set(v) {
      input.value = String(v);
      paint();
    },
  };
}
