/**
 * SPEAK SCREEN (APPS ROUND, consistency section 2: reading and accessibility). "Read the screen" reads the screen he is on aloud:
 * its name, then its words in the order they stand on the page (headings, lines, rows), as VoiceOver's own order would read them.
 * It skips the keys' names, the bar and anything hidden. The reply shows the same words, so what is spoken is captioned too.
 *
 * Read in the phone's own voice: free, on the phone, works with no signal. "Stop" stops it as it stops any speech. Nothing on the
 * screen leaves the phone.
 */
import { speakIn, stopSpeaking } from '../assistant/voice';

/** At most this much is read in one go: a screen's first page, never a whole long list. */
const MAX_CHARS = 1200;
/** What reads as a key or a control, not as words on the screen. */
const SKIP = 'button, [role="button"], [role="tab"], [role="radio"], [role="switch"], input, select, textarea, nav, svg, canvas, script, style, [aria-hidden="true"], .secpills, #dock';

/** For the spec and the console: what the last reading read. */
export const speakState = { tab: '', pieces: 0, chars: 0, voiced: false, text: '' };

const seen = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
};

/**
 * The screen's words in page order: each block that holds words of its own (a heading, a line, a row's text) once, trimmed,
 * nothing twice, up to MAX_CHARS. Pure over the DOM.
 */
export function screenReading(root: Element | null): string[] {
  if (!root) return [];
  // (asked from the jump bar, the page is put away under Home by the time it is read: then what is hidden is read from the styles,
  // up to the page, as it stood on screen)
  const away = !seen(root);
  const shown = (el: Element): boolean => {
    if (!away) return seen(el);
    for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || (e as HTMLElement).hidden) return false;
    }
    return true;
  };
  const out: string[] = [];
  const had = new Set<string>();
  let chars = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let lastBlock: Element | null = null;
  let buf = '';
  const flush = () => {
    const t = buf.replace(/\s+/g, ' ').trim();
    buf = '';
    if (!t || t.length < 2 || had.has(t) || chars >= MAX_CHARS) return;
    had.add(t);
    out.push(t);
    chars += t.length;
  };
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const p = n.parentElement;
    if (!p || p.closest(SKIP) || !shown(p)) continue;
    const text = n.textContent ?? '';
    if (!text.trim()) continue;
    // (one block's words read together: a line split across a <b> and a <span> is one sentence)
    const block = p.closest('h1, h2, h3, h4, p, li, .ptitle, .rw, .row, .msg, .ak-row, td, th, figcaption, label, small, div') ?? p;
    if (block !== lastBlock) flush();
    lastBlock = block;
    buf += ` ${text}`;
  }
  flush();
  return out;
}

/** The words of the screen `tab` (its page, `#pg-<tab>`), with its name first. */
export function readingOf(tab: string, title: string): string {
  const pieces = screenReading(document.getElementById(`pg-${tab}`));
  const text = [title, ...pieces].join('. ').replace(/\.\s*\./g, '.').slice(0, MAX_CHARS + 80);
  Object.assign(speakState, { tab, pieces: pieces.length, chars: text.length, text });
  return text;
}

/** Say it in the phone's own voice; false when the phone has none (the words are still shown). */
export function speakScreenText(text: string): boolean {
  stopSpeaking();
  const lang = (document.documentElement.lang || navigator.language || 'en').split('-')[0] || 'en';
  const voiced = speakIn(text, lang);
  speakState.voiced = voiced;
  return voiced;
}

const g = globalThis as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0): unknown => (g.__ghosty ? (g.__ghosty.speakscreen = speakState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
