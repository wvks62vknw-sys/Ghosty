/**
 * The video editor's small controls (BRIEF-EDITOR-VIDEO): a slider 44 pt tall with its value said and a double tap to reset, a row
 * of choices, a stepper. Every one is a button or a field with its own name for VoiceOver.
 */
import { h } from '../core/dom';
import { button } from '../ui/components';

export interface SliderOpts {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** The value as he reads it ("+0.7 stops"). */
  say(v: number): string;
  /** While dragging (live), and when let go (the step that goes in the history). */
  input?(v: number): void;
  change(v: number): void;
  /** What a double tap sets it back to. */
  reset?: number;
}
export function slider(o: SliderOpts): HTMLElement {
  const val = h('output.vdval', o.say(o.value));
  const inp = h('input.vdrange', { type: 'range', min: String(o.min), max: String(o.max), step: String(o.step), value: String(o.value), 'aria-label': o.label }) as HTMLInputElement;
  inp.addEventListener('input', () => {
    val.textContent = o.say(Number(inp.value));
    o.input?.(Number(inp.value));
  });
  inp.addEventListener('change', () => o.change(Number(inp.value)));
  const back = () => {
    if (o.reset == null) return;
    inp.value = String(o.reset);
    val.textContent = o.say(o.reset);
    o.input?.(o.reset);
    o.change(o.reset);
  };
  inp.addEventListener('dblclick', back);
  // a double tap on a phone
  let last = 0;
  inp.addEventListener('pointerup', () => {
    const now = Date.now();
    if (now - last < 320) back();
    last = now;
  });
  return h('label.vdslider', h('span.vdlabel', o.label), val, inp);
}

/** A row of choices, one lit. */
export function choices<T extends string | number>(label: string, list: { id: T; label: string }[], current: T, pick: (id: T) => void): HTMLElement {
  const row = h('div.vdchoices', { role: 'group', 'aria-label': label });
  for (const c of list) {
    const b = button(c.label, () => pick(c.id), `vdchoice${c.id === current ? ' on' : ''}`);
    b.setAttribute('aria-pressed', String(c.id === current));
    row.append(b);
  }
  return row;
}

/** A value with a key either side: "‹ 2.5 s ›". */
export function stepper(label: string, say: () => string, less: () => void, more: () => void): HTMLElement {
  const v = h('output.vdstepv', say());
  return h('div.vdstep', h('span.vdlabel', label), name(button('‹', () => { less(); v.textContent = say(); }, 'vdstepb'), `${label}: less`), v, name(button('›', () => { more(); v.textContent = say(); }, 'vdstepb'), `${label}: more`));
}
export const name = <T extends HTMLElement>(b: T, label: string): T => {
  b.setAttribute('aria-label', label);
  return b;
};
