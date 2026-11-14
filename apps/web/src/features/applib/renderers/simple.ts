/**
 * THE APP LIBRARY's shared parts for the smaller kinds (the kinds themselves are drawn in kinds.ts, THE PRO ROUND): the one-line
 * sheet, fresh-start periods, an output's words, where a timer run is, the chime and the voice; and the screen kind, which opens
 * one of Ghosty's own screens.
 */
import { h } from '../../../core/dom';
import { key } from '../../../ui/machine';
import type { KitApp } from '../../../ui/appkit';
import type { CalcOutput } from '../../../../../../packages/shared/src/applib/types';
import { registerRenderer, redraw } from '../registry';
import { appIcon, mins, money, num, today } from '../engine';

/** The key of the current day or week (Monday first), for fresh starts. */
export function periodKey(repeat: 'never' | 'daily' | 'weekly', now = new Date()): string {
  if (repeat === 'never') return 'all';
  if (repeat === 'daily') return today(now);
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return `w${today(mon)}`;
}

/** A small sheet asking for one line of words (a new item or tally), with SAVE and CANCEL. */
export function ask(k: KitApp, label: string, done: (words: string) => void): void {
  k.el.querySelector('.al-edit')?.remove();
  const inp = h('input.al-in', { type: 'text', maxLength: 80, 'aria-label': label, placeholder: label }) as HTMLInputElement;
  const sheet = h('form.ak-sheet.al-edit', { role: 'dialog', 'aria-label': label });
  const close = () => sheet.remove();
  sheet.addEventListener('submit', (e) => {
    e.preventDefault();
    const w = inp.value.trim();
    if (!w) return k.notice('Type a few words first.', { tone: 'warn' });
    close();
    done(w);
  });
  const save = key('Save', () => sheet.requestSubmit(), { kind: 'fill' });
  sheet.append(h('h3.ak-sheethead', label), inp, h('div.al-sheetkeys', save, key('Cancel', close)));
  k.el.append(sheet);
  inp.focus({ preventScroll: true });
}

// ── calc and timer helpers ──────────────────────────────────────────────────────────────

/** An output's number as he reads it. */
export function outWords(o: CalcOutput, v: number): string {
  if (!Number.isFinite(v)) return '–';
  const dp = o.dp ?? 2;
  if (o.format === 'money') return money(v);
  if (o.format === 'percent') return `${num(v, dp)}%`;
  if (o.format === 'duration') return mins(v);
  return `${num(v, dp)}${o.unit ? ` ${o.unit}` : ''}`;
}

/** Where a run is: the step, the round, the seconds left in the step, and whether it is over. */
export function whereAt(steps: { name: string; secs: number }[], rounds: number, gone: number): { step: number; round: number; left: number; done: boolean } {
  const per = steps.reduce((a, s) => a + s.secs, 0);
  if (gone >= per * rounds) return { step: steps.length - 1, round: rounds, left: 0, done: true };
  const round = Math.floor(gone / per);
  let t = gone - round * per;
  let step = 0;
  while (t >= steps[step]!.secs) { t -= steps[step]!.secs; step++; }
  return { step, round: round + 1, left: steps[step]!.secs - t, done: false };
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let actx: AudioContext | null = null;
export function chime(): void {
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.6);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + 0.65);
  } catch {
    // (no sound on this phone: the step still changes on screen)
  }
}
export function say(words: string): void {
  try {
    const u = new SpeechSynthesisUtterance(words);
    u.lang = 'en-GB';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // (no voice on this phone: the chime and the screen say it)
  }
}

// ── screen ──────────────────────────────────────────────────────────────────────────────

registerRenderer('screen', (root, def, k) => {
  const go = () => { location.hash = `#${def.screen!.hash}`; };
  const draw = () => root.replaceChildren(h('div.al-screen', h('span.al-bigicon', appIcon(def)), h('p', def.pitch), key(`Open ${def.name}`, go, { kind: 'fill' })));
  return redraw(k, draw);
});
