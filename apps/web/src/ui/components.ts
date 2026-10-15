/**
 * Ghosty's design system. Build interface pieces from these so everything looks and
 * behaves the same:
 *   panel()  glass panel with title, status light and optional footer
 *   pager()  fills a panel with rows and pages instead of scrolling
 *   row()    one line: label · value · number
 *   spark(), bar(), dial(), button(), toast(), modal(), empty()
 */
import { clear, h, svgEl } from '../core/dom';

export type Light = 'ok' | 'mid' | 'off';

export interface Panel {
  el: HTMLElement;
  body: HTMLElement;
  foot: HTMLElement | null;
  title: HTMLElement;
  setStatus(text: string, light?: Light): void;
}

export function panel(title: string, opts: { status?: string; footer?: boolean; grow?: boolean; cls?: string } = {}): Panel {
  const dot = h('i.light');
  const st = h('small', opts.status ?? '');
  const t = h('span.ptitle', title);
  const head = h('h3', dot, t, h('span.sp'), st);
  const body = h('div.bd');
  const el = h(`section.pn${opts.grow === false ? '.fx' : ''}${opts.cls ? `.${opts.cls}` : ''}` as 'section', head, body);
  const foot = opts.footer ? h('div.ft') : null;
  if (foot) el.append(foot);
  head.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('button,a,input')) return;
    el.classList.toggle('min');
  });
  return {
    el,
    body,
    foot,
    title: t,
    setStatus(text, light) {
      st.textContent = text;
      dot.className = `light ${light ?? ''}`;
    },
  };
}

export function row(k: string | null, v: string | Node, n?: string | null, opts: { onClick?: () => void; sev?: number; tone?: 'up' | 'dn' | 'bad'; wrap?: boolean } = {}): HTMLElement {
  const r = h(`div.rw${opts.onClick ? '.link' : ''}${opts.wrap ? '.wrap' : ''}` as 'div');
  if (opts.sev != null) r.append(h('i.sev', { style: { background: SEV_COLORS[opts.sev] ?? SEV_COLORS[0] } }));
  if (k != null) r.append(h('span.k', k));
  r.append(typeof v === 'string' ? h('span.v', v) : h('span.v', v));
  if (n != null) r.append(h(`span.n${opts.tone ? `.${opts.tone}` : ''}` as 'span', n));
  if (opts.onClick) {
    r.tabIndex = 0;
    r.addEventListener('click', opts.onClick);
    r.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') opts.onClick!();
    });
  }
  return r;
}

export const SEV_COLORS = ['#52f2b5', '#ffd24d', '#ff9a3c', '#ff4d6a'];

export function empty(status: string): HTMLElement {
  const s = status.toUpperCase();
  const bad = /NO FEED|ERROR|UNAVAIL|OFFLINE/.test(s);
  const wait = /SYNC|LOAD|IDLE/.test(s) || !s;
  return h(`div.empty${bad ? '.bad' : ''}` as 'div', h('b', bad ? 'NO SIGNAL' : wait ? 'ACQUIRING' : 'STANDING BY'), h('span', bad ? 'feed unreachable right now' : wait ? 'establishing link…' : 'nothing to show yet'));
}

/** Paged list: no scrolling. Re-fits the number of rows to the panel height. */
export function pager<T>(p: Panel, rowHeight: number, render: (item: T) => HTMLElement, emptyText = () => 'IDLE'): { set(items: T[]): void } {
  let items: T[] = [];
  let page = 0;
  const prev = button('‹', () => {
    page--;
    draw();
  });
  const next = button('›', () => {
    page++;
    draw();
  });
  const label = h('span.pg-label');
  if (p.foot) p.foot.append(prev, label, next);
  const draw = () => {
    // In a one-scrolling-page layout (phones, page({ stack: true })) the panel grows with its
    // rows, so measuring its height would feed back on itself: show a fixed page instead.
    const stacked = !!p.el.closest('.two.stack') && matchMedia('(max-width: 899px)').matches;
    const per = stacked ? 8 : Math.max(1, Math.floor((p.body.clientHeight - 12) / rowHeight) || 6);
    const pages = Math.max(1, Math.ceil(items.length / per));
    page = Math.max(0, Math.min(page, pages - 1));
    clear(p.body);
    if (!items.length) p.body.append(empty(emptyText()));
    for (const it of items.slice(page * per, page * per + per)) {
      const r = render(it);
      r.style.minHeight = `${rowHeight - 4}px`;
      p.body.append(r);
    }
    label.textContent = items.length ? `${page * per + 1}–${Math.min(items.length, page * per + per)} / ${items.length}` : '';
    prev.disabled = page <= 0;
    next.disabled = page >= pages - 1;
  };
  let sx: number | null = null;
  p.body.addEventListener('pointerdown', (e) => (sx = e.clientX));
  p.body.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) {
      page += dx < 0 ? 1 : -1;
      draw();
    }
  });
  new ResizeObserver(() => draw()).observe(p.body);
  return {
    set(a) {
      items = a;
      draw();
    },
  };
}

export function button(label: string | Node, onClick: (b: HTMLButtonElement) => void, cls = ''): HTMLButtonElement {
  const b = h(`button${cls ? `.${cls.split(' ').join('.')}` : ''}` as 'button', { type: 'button' }, label);
  b.addEventListener('click', () => onClick(b));
  return b;
}

export function spark(values: number[], w = 70, hgt = 22): SVGSVGElement {
  const s = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'spark', preserveAspectRatio: 'none' });
  if (values.length < 2) return s;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const r = mx - mn || 1;
  const pts = values.map((y, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(hgt - 2 - ((y - mn) / r) * (hgt - 4)).toFixed(1)}`).join(' ');
  s.append(svgEl('polyline', { points: pts, fill: 'none', stroke: values[values.length - 1]! >= values[0]! ? '#52f2b5' : '#ff4d6a', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }));
  return s;
}

export function bar(label: string, frac: number, text: string, color?: string): HTMLElement {
  const i = h('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`, ...(color ? { background: color } : {}) } });
  return h('div.bar', h('span', label), h('div.gauge', i), h('b', text));
}

export function dial(label: string, frac: number, text: string, color = 'var(--c)'): HTMLElement {
  const R = 20;
  const C = 2 * Math.PI * R;
  const f = Math.max(0, Math.min(1, frac));
  const s = svgEl('svg', { viewBox: '0 0 52 52' });
  s.append(
    svgEl('circle', { cx: 26, cy: 26, r: R, class: 'track', 'stroke-dasharray': `${(C * 0.75).toFixed(1)} ${C}`, transform: 'rotate(135 26 26)' }),
    svgEl('circle', { cx: 26, cy: 26, r: R, class: 'fg', stroke: color, 'stroke-dasharray': `${(C * f * 0.75).toFixed(1)} ${C}`, transform: 'rotate(135 26 26)' }),
  );
  const t = svgEl('text', { x: 26, y: 30, 'text-anchor': 'middle' });
  t.textContent = text;
  s.append(t);
  return h('div.dial', s, h('span', label));
}

let toastBox: HTMLElement | null = null;
export function toast(msg: string, kind: '' | 'warn' | 'bad' | 'ok' = ''): void {
  // The paused database has one quiet tag in the top bar; no pop-ups about it.
  if (/memory paused until|free daily allowance/i.test(msg)) return;
  if (!toastBox) {
    toastBox = h('div#toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  const t = h(`div.toast${kind ? `.${kind}` : ''}` as 'div', msg);
  toastBox.append(t);
  while (toastBox.children.length > 3) toastBox.firstChild!.remove();
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4100);
}

export function modal(title: string, content: Node, onClose?: () => void): { close(): void } {
  const close = () => {
    m.remove();
    removeEventListener('keydown', esc);
    onClose?.();
  };
  const esc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  const m = h('div.modal', h('div.mbox', { role: 'dialog', 'aria-label': title }, h('div.mhead', h('b', title), button('CLOSE', close)), h('div.mbody', content)));
  m.addEventListener('click', (e) => {
    if (e.target === m) close();
  });
  addEventListener('keydown', esc);
  document.body.append(m);
  return { close };
}

/**
 * Run a widget's HTML in a fully sandboxed iframe: scripts only, no same-origin access
 * (so no cookies, storage or access to Ghosty's page), no forms, no popups.
 * The frame loads /widget-host (Cloudflare's address for widget-host.html, which has its own
 * relaxed security policy — see public/_headers), and we
 * hand it the widget HTML by message. The main app keeps its strict policy.
 */
export function sandboxFrame(html: string): HTMLIFrameElement {
  const f = h('iframe.sandbox', { title: 'widget', src: '/widget-host' });
  f.setAttribute('sandbox', 'allow-scripts');
  f.setAttribute('referrerpolicy', 'no-referrer');
  f.addEventListener('load', () => f.contentWindow?.postMessage({ ghostyWidget: html }, '*'), { once: true });
  return f;
}
