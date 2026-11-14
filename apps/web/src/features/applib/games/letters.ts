/** An on-screen letter keyboard for the word kinds (hangman), keys at phone-keyboard size, with a real keyboard too. */
import { h } from '../../../core/dom';

export function letterPad(onKey: (ch: string) => void, extra: { word: string; v: string }[] = []): { el: HTMLElement; mark(ch: string, m: string): void; stop(): void } {
  const keys: Record<string, HTMLElement> = {};
  const el = h('div.al-gkb');
  for (const [ri, row] of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].entries()) {
    const r = h('div.al-gkbrow');
    for (const ch of row) {
      const k = h('div.al-gkbkey', { role: 'button', tabIndex: 0, 'aria-label': ch.toUpperCase() }, ch.toUpperCase());
      k.addEventListener('click', () => onKey(ch));
      keys[ch] = k;
      r.append(k);
    }
    if (ri === 2)
      for (const x of extra) {
        const k = h('div.al-gkbkey.al-gkbwide', { role: 'button', tabIndex: 0, 'aria-label': x.word }, x.word);
        k.addEventListener('click', () => onKey(x.v));
        r.append(k);
      }
    el.append(r);
  }
  const keyd = (e: KeyboardEvent) => {
    if (!el.isConnected || e.metaKey || e.ctrlKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key.toLowerCase());
    else if (e.key === 'Backspace') onKey('back');
    else if (e.key === 'Enter') onKey('enter');
  };
  window.addEventListener('keydown', keyd);
  return { el, mark: (ch, m) => keys[ch] && (keys[ch]!.dataset.m = m), stop: () => window.removeEventListener('keydown', keyd) };
}
