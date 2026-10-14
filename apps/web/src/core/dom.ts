/**
 * Tiny DOM helpers. `h('div.panel#id', {onclick}, 'text', child)` builds elements.
 * Text is always set with textContent, so data can never inject HTML.
 */
type Child = Node | string | number | null | undefined | false;
type Props = Partial<Record<string, unknown>> & { style?: Partial<CSSStyleDeclaration> | string; dataset?: Record<string, string> };

export function h<K extends keyof HTMLElementTagNameMap>(spec: K | `${K}.${string}` | `${K}#${string}`, props?: Props | Child, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const m = /^([a-z0-9]+)((?:[.#][\w-]+)*)$/i.exec(spec);
  const tag = (m?.[1] ?? 'div') as K;
  const el = document.createElement(tag);
  for (const part of (m?.[2] ?? '').match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (props && typeof props === 'object' && !(props instanceof Node)) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'style') {
        if (typeof v === 'string') el.style.cssText = v;
        else Object.assign(el.style, v);
      } else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'class') el.className = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  } else if (props != null) kids.unshift(props as Child);
  append(el, ...kids);
  return el;
}

export function append(el: Element, ...kids: Child[]): void {
  for (const k of kids) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
}

export function clear(el: Element, ...kids: Child[]): void {
  el.replaceChildren();
  append(el, ...kids);
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

export const pad = (n: number) => String(n).padStart(2, '0');

export const fmt = {
  n: (x: number | null | undefined, d = 0) => (x == null || Number.isNaN(x) ? '--' : Number(x).toLocaleString(undefined, { maximumFractionDigits: d })),
  km: (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)}k km` : `${Math.round(x)} km`),
  ago(ms: number) {
    const m = Math.max(0, Math.round((Date.now() - ms) / 6e4));
    return m < 1 ? 'now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
  },
  time: (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`,
};

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Inline SVG icon from path markup we control (never from data). */
export function icon(paths: string, cls = 'ic'): SVGSVGElement {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', cls);
  s.innerHTML = paths;
  return s;
}

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}
