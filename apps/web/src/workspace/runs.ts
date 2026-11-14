/**
 * Words on a line as runs and back (the documents' Run, bold, italic, underline, a link): what a contenteditable line holds is read into
 * runs, and runs are drawn into a line, with the caret kept. The same code the presentations' line editor uses, so a mark means the same
 * in a slide and in a page.
 */
import { h } from '../core/dom';
import { tidyRuns, type Run } from '../docs/model';

interface Marks {
  b: boolean;
  i: boolean;
  u: boolean;
  s: boolean;
  hl: boolean;
  href: string;
}
export const safeLink = (u: string): string => {
  const t = u.trim();
  if (!t) return '';
  if (/^(?:https?:|mailto:|tel:)/i.test(t)) return t;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return '';
  return /@/.test(t) && !/\s|\//.test(t) ? `mailto:${t}` : `https://${t}`;
};
export function runsOf(node: Node, st: Marks = { b: false, i: false, u: false, s: false, hl: false, href: '' }, out: Run[] = []): Run[] {
  const mk = (text: string, m: Marks): Run => ({ text, ...(m.b ? { b: true } : {}), ...(m.i ? { i: true } : {}), ...(m.u && !m.href ? { u: true } : {}), ...(m.s ? { s: true } : {}), ...(m.hl ? { hl: true } : {}), ...(m.href ? { href: m.href } : {}) });
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) out.push(mk(n.textContent ?? '', st));
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as HTMLElement;
      const tag = el.tagName;
      if (tag === 'BR') out.push({ text: '\n' });
      else if (tag === 'DIV' || tag === 'P') {
        if (out.length && !out[out.length - 1]!.text.endsWith('\n')) out.push({ text: '\n' });
        runsOf(el, st, out);
      } else
        runsOf(el, {
          b: st.b || tag === 'B' || tag === 'STRONG' || /bold|[6-9]00/.test(el.style.fontWeight),
          i: st.i || tag === 'I' || tag === 'EM' || el.style.fontStyle === 'italic',
          u: st.u || tag === 'U' || /underline/.test(el.style.textDecorationLine || el.style.textDecoration),
          s: st.s || tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /line-through/.test(el.style.textDecorationLine || el.style.textDecoration),
          hl: st.hl || tag === 'MARK',
          href: tag === 'A' ? safeLink(el.getAttribute('href') ?? '') : st.href,
        }, out);
    }
  });
  return out;
}
export const readRuns = (el: HTMLElement): Run[] => {
  const r = tidyRuns(runsOf(el));
  const last = r[r.length - 1];
  if (last) last.text = last.text.replace(/\n+$/, '');
  return tidyRuns(r);
};
export function fillRuns(el: HTMLElement, runs: Run[]): void {
  el.replaceChildren();
  for (const r of runs) {
    r.text.split('\n').forEach((part, k) => {
      if (k) el.append(document.createElement('br'));
      if (!part) return;
      let node: Node = document.createTextNode(part);
      if (r.b) node = h('b', node);
      if (r.i) node = h('i', node);
      if (r.u) node = h('u', node);
      if (r.s) node = h('s', node);
      if (r.hl) node = h('mark', node);
      if (r.href) node = h('a', { href: r.href }, node);
      el.append(node);
    });
  }
}
export const caretAt = (el: HTMLElement): number => {
  const sel = getSelection();
  if (!sel?.rangeCount) return 0;
  const r = sel.getRangeAt(0).cloneRange();
  r.setStart(el, 0);
  const box = document.createElement('div');
  box.append(r.cloneContents());
  return readRuns(box).reduce((n, x) => n + x.text.length, 0);
};
export function placeCaret(el: HTMLElement, at: number): void {
  let left = at;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  const r = document.createRange();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (left <= len) {
      r.setStart(node, left);
      break;
    }
    left -= len;
    node = walker.nextNode();
  }
  if (node) r.collapse(true);
  else {
    r.selectNodeContents(el);
    r.collapse(false);
  }
  const sel = getSelection();
  sel?.removeAllRanges();
  sel?.addRange(r);
}
export const splitRuns = (runs: Run[], at: number): [Run[], Run[]] => {
  const a: Run[] = [];
  const z: Run[] = [];
  let n = 0;
  for (const r of runs) {
    if (n + r.text.length <= at) a.push(r);
    else if (n >= at) z.push(r);
    else {
      a.push({ ...r, text: r.text.slice(0, at - n) });
      z.push({ ...r, text: r.text.slice(at - n) });
    }
    n += r.text.length;
  }
  return [tidyRuns(a), tidyRuns(z)];
};

