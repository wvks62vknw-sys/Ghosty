/**
 * TV MODE: the on-screen keyboard (BRIEF-REST-C part 3) — for a television whose browser brings no keyboard of its own
 * (the PS5 has its own, which comes up by itself; this is the fallback). Big keys in rows, moved through with the d-pad
 * like everything else; it types into the field it was opened for (the chat box by default); SEND presses Enter there,
 * CLOSE (or B / Escape) puts it away and the focus goes back to the field.
 */
import { h } from '../core/dom';

const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl\'', 'zxcvbnm,.?'];

let open: HTMLElement | null = null;

/** Is the keyboard up (it is the layer the d-pad moves in)? */
export const keyboardOpen = (): HTMLElement | null => (open?.isConnected ? open : null);

/** Put the keyboard up for a text field. */
export function openKeyboard(field: HTMLInputElement | HTMLTextAreaElement): void {
  closeKeyboard();
  let caps = false;
  const put = (s: string) => {
    const a = field.selectionStart ?? field.value.length;
    const b = field.selectionEnd ?? field.value.length;
    field.value = field.value.slice(0, a) + s + field.value.slice(b);
    field.selectionStart = field.selectionEnd = a + s.length;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const key = (label: string, act: () => void, cls = '', aria = label) => {
    const b = h(`button.tvkey${cls}` as 'button', { type: 'button', 'aria-label': aria }, label);
    b.addEventListener('click', act);
    return b;
  };
  const letters: HTMLButtonElement[] = [];
  const rows = ROWS.map((r) => h('div.tvkrow', ...[...r].map((c) => {
    const b = key(c, () => put(caps && /[a-z]/.test(c) ? c.toUpperCase() : c));
    if (/[a-z]/.test(c)) letters.push(b);
    return b;
  })));
  const shift = key('⇧', () => {
    caps = !caps;
    for (const b of letters) b.textContent = caps ? b.textContent!.toUpperCase() : b.textContent!.toLowerCase();
    shift.setAttribute('aria-pressed', String(caps));
  }, '.wide', 'Capitals');
  const back = key('⌫', () => {
    const a = field.selectionStart ?? field.value.length;
    const b = field.selectionEnd ?? field.value.length;
    const from = a === b ? Math.max(0, a - 1) : a;
    field.value = field.value.slice(0, from) + field.value.slice(b);
    field.selectionStart = field.selectionEnd = from;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, '.wide', 'Delete');
  const space = key('SPACE', () => put(' '), '.space', 'Space');
  const send = key('SEND', () => {
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    closeKeyboard();
  }, '.wide.on', 'Send');
  const close = key('CLOSE', () => closeKeyboard(), '.wide', 'Close the keyboard');
  open = h('div#tvkb', { role: 'dialog', 'aria-label': 'Keyboard' }, ...rows, h('div.tvkrow', shift, space, back, send, close));
  (open as HTMLElement & { field?: HTMLElement }).field = field;
  document.body.append(open);
  (open.querySelector('button.tvkey') as HTMLButtonElement | null)?.focus();
}

/** Put it away; the focus goes back to its field. */
export function closeKeyboard(): void {
  const el = open as (HTMLElement & { field?: HTMLElement }) | null;
  open = null;
  if (!el) return;
  el.remove();
  el.field?.focus();
}
