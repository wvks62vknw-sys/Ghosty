/**
 * EVERY WAIT SAID (SMALL-GAPS J). Any await he can feel (over about 400 ms) says what it is waiting for, in his voice, where it
 * happens: `const done = waiting(el, 'Drawing it…')`, then `done()` when the thing lands or fails (a failure is spoken through
 * `sayError`, ui/hisWords.ts). The line is drawn in the design system's truth style (a tag row with `as: 'tag'`), is in the page from the
 * first moment (a screen reader has it at once) and comes into sight after a quarter second, so a thing that lands at once never
 * flashes it. With Reduce Motion it is there at once. Calling `done` twice is fine; so is never calling `waiting` for a thing that is quick.
 */
import { h } from '../core/dom';
import { tag } from './machine';

/** What the checks read (window.__ghosty.wait): the words now showing, and every line that was ever put up. */
export const waitState = { showing: [] as string[], said: [] as string[] };

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.wait = waitState;
  }, 2800);
}

export function waiting(el: HTMLElement, words: string, o: { as?: 'tag' | 'line' } = {}): () => void {
  const line = o.as === 'tag' ? h('div.g-wait.waiting', { role: 'status', 'aria-live': 'polite', dataset: { wait: words, case: 'keep' } }, tag(words, { tone: 'on' })) : h('p.g-truth.waiting', { role: 'status', 'aria-live': 'polite', dataset: { wait: words, case: 'keep' } }, words);
  el.append(line);
  waitState.showing.push(words);
  waitState.said.push(words);
  let over = false;
  return () => {
    if (over) return;
    over = true;
    line.remove();
    const i = waitState.showing.indexOf(words);
    if (i >= 0) waitState.showing.splice(i, 1);
  };
}
