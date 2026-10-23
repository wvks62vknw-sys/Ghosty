/**
 * Ghosty's design system. Build interface pieces from these so everything looks and
 * behaves the same:
 *   panel()  glass panel with title, status light and optional footer
 *   pager()  fills a panel with rows and pages instead of scrolling
 *   row()    one line: label · value · number
 *   spark(), bar(), dial(), button(), toast(), modal(), empty()
 */
import { clear, h, icon, svgEl } from '../core/dom';

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
  const st = h('small', opts.status ? { dataset: { label: /[a-z]/.test(opts.status) ? opts.status : niceCase(opts.status) } } : {}, opts.status ?? '');
  const t = h('span.ptitle', title);
  // The calm looks' wording for the title, kept up to date when the title changes ("WEATHER · LONDON").
  const label = () => {
    const s = t.textContent ?? '';
    if (ACRONYM.test(s) || s.includes(' · ')) t.dataset.label = niceTitle(s);
    else delete t.dataset.label;
  };
  label();
  new MutationObserver(label).observe(t, { childList: true, characterData: true, subtree: true });
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
      // the calm looks show the status in sentence case, abbreviations kept ("LIVE" → "Live", "BBC")
      st.dataset.label = /[a-z]/.test(text) ? text : niceCase(text);
      dot.className = `light ${light ?? ''}`;
    },
  };
}

export function row(k: string | null, v: string | Node, n?: string | null, opts: { onClick?: () => void; sev?: number; tone?: 'up' | 'dn' | 'bad'; wrap?: boolean } = {}): HTMLElement {
  const r = h(`div.rw${opts.onClick ? '.link' : ''}${opts.wrap ? '.wrap' : ''}` as 'div');
  if (opts.sev != null) r.append(h('i.sev', { style: { background: SEV_COLORS[opts.sev] ?? SEV_COLORS[0] } }));
  if (k != null) r.append(h('span.k', ACRONYM.test(k) ? { dataset: { label: niceCase(k) } } : {}, k));
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

/**
 * An empty list's state. The classic looks keep their words (NO SIGNAL, ACQUIRING, STANDING BY); route C says
 * it plainly with one sentence on what to do next (`next`, the screen's own; a fitting default otherwise).
 */
export function empty(status: string, next?: string, title?: string): HTMLElement {
  const s = status.toUpperCase();
  const bad = /NO FEED|ERROR|UNAVAIL|OFFLINE/.test(s);
  // (a list that has its own sentence is really empty when idle, not still on its way)
  const wait = /SYNC|LOAD/.test(s) || (!next && (/IDLE/.test(s) || !s));
  const off = typeof navigator !== 'undefined' && navigator.onLine === false;
  const head = off ? 'You’re offline' : bad ? 'Can’t reach this feed' : wait ? 'Loading' : title ?? 'Nothing here yet';
  const line = off ? 'It fills in again when the phone is back online.' : bad ? 'It tries again by itself in a minute.' : wait ? 'One moment, it’s on its way.' : next ?? 'It fills in by itself as things happen.';
  return h(`div.empty${bad || off ? '.bad' : wait ? '.wait' : ''}` as 'div', { dataset: { case: 'keep' } },
    h('b', { dataset: { label: head } }, bad ? 'NO SIGNAL' : wait ? 'ACQUIRING' : 'STANDING BY'),
    h('span', { dataset: { label: line } }, bad ? 'feed unreachable right now' : wait ? 'establishing link…' : next ?? 'nothing to show yet'));
}

/**
 * UNDO after something was removed: one bar with what changed and an UNDO button; it goes by itself after
 * `ms`. `fn` puts it back (and says so); the bar hides as soon as it is tapped.
 */
export function undoBar(ms = 12_000): { el: HTMLElement; show(text: string, fn: () => Promise<unknown>): void } {
  const el = h('div.undo.rcundo', { role: 'status', hidden: true });
  let timer = 0;
  return {
    el,
    show(text, fn) {
      clearTimeout(timer);
      clear(el, h('span', text), button('UNDO', async (b) => {
        b.disabled = true;
        el.hidden = true;
        try {
          await fn();
        } catch (e) {
          toast(`Could not undo it: ${(e as Error).message}`, 'bad');
        }
      }, 'on'));
      el.hidden = false;
      timer = window.setTimeout(() => (el.hidden = true), ms);
    },
  };
}

/** Paged list: no scrolling. Re-fits the number of rows to the panel height. */
export function pager<T>(p: Panel, rowHeight: number, render: (item: T) => HTMLElement, emptyText = () => 'IDLE', emptyNext?: string): { set(items: T[]): void } {
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
    // (route C lets some two-sided pages flow the same way: .rcflow, styles.css)
    const stacked = !!p.el.closest(document.documentElement.dataset.look === 'pro' ? '.two.stack, .two.rcflow' : '.two.stack') && matchMedia('(max-width: 899px)').matches;
    const per = stacked ? 8 : Math.max(1, Math.floor((p.body.clientHeight - 12) / rowHeight) || 6);
    const pages = Math.max(1, Math.ceil(items.length / per));
    page = Math.max(0, Math.min(page, pages - 1));
    clear(p.body);
    if (!items.length) p.body.append(empty(emptyText(), emptyNext));
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

/** Labels with an abbreviation in them keep their capitals in the calm looks (which show labels in sentence case). */
const ABBR = ['I', '3D', 'GPS', 'AI', 'PDF', 'QR', 'PNG', 'JSON', 'CSV', 'URL', 'MOT', 'ISS', 'UK', 'BBC', 'CCTV', 'SMS', 'API', 'GLB', 'TV', 'FX', 'ID', 'GO', 'OK', 'AQI', 'UV', 'PM2.5'];
export const ACRONYM = /\b(GHOSTY|UV|AQI|I|3D|GPS|AI|PDF|QR|PNG|JSON|CSV|URL|MOT|ISS|UK|BBC|CCTV|SMS|API|GLB|TV|FX|ID)\b/;
/** "USE GPS" → "Use GPS", "AI BRAIN" → "AI brain": sentence case that keeps abbreviations (the calm looks' wording). */
/** A panel title: "WEATHER · LONDON" → "Weather · London" (after the dot comes a name: each word capitalised). */
export function niceTitle(s: string): string {
  const [head, ...rest] = s.split(' · ');
  const name = (w: string) => w.toLowerCase().replace(/[a-z0-9.]+/g, (x) => (ABBR.includes(x.toUpperCase()) ? x.toUpperCase() : x.charAt(0).toUpperCase() + x.slice(1)));
  return [niceCase(head ?? ''), ...rest.map(name)].join(' · ');
}

export function niceCase(s: string): string {
  const out = s.toLowerCase().replace(/[a-z0-9.]+/g, (w) => (w === 'ghosty' ? 'Ghosty' : ABBR.includes(w.toUpperCase()) && w.toUpperCase() !== 'GO' && w.toUpperCase() !== 'OK' ? w.toUpperCase() : w));
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function button(label: string | Node, onClick: (b: HTMLButtonElement) => void, cls = ''): HTMLButtonElement {
  const b = h(`button${cls ? `.${cls.split(' ').join('.')}` : ''}` as 'button', { type: 'button' }, label);
  // The calm looks show labels in sentence case; one with an abbreviation in it ("USE GPS") shows "Use GPS".
  if (typeof label === 'string' && ACRONYM.test(label)) b.dataset.label = niceCase(label);
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
  // the calm looks show a label in capitals in sentence case ("READ" → "Read"), abbreviations kept
  return h('div.bar', h('span', /[a-z]/.test(label) ? {} : { dataset: { label: niceCase(label) } }, label), h('div.gauge', i), h('b', text));
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
/** When each message last popped up: the same words twice within a minute show once. */
const toastSeen = new Map<string, number>();
/**
 * A pop-up line. At most two are on screen (the oldest goes when a third arrives), each at most three
 * lines (styles.css, fixes A2); a longer one can be tapped to read all of it (`full`: the whole text when
 * `msg` is already shortened, `title` for the sheet). They sit above the tab bar and the chat bar.
 */
export function toast(msg: string, kind: '' | 'warn' | 'bad' | 'ok' = '', opts: { title?: string; full?: string } = {}): void {
  // The paused database has one quiet tag in the top bar; no pop-ups about it.
  if (/memory paused until|free daily allowance/i.test(msg)) return;
  const now = Date.now();
  for (const [m, at] of toastSeen) if (now - at >= 60_000) toastSeen.delete(m);
  if (toastSeen.has(msg)) return;
  toastSeen.set(msg, now);
  if (!toastBox) {
    toastBox = h('div#toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.append(toastBox);
  }
  // The calm looks: a pill with the reactor's glyph, in sentence case (a word in capitals is shown in small letters, abbreviations kept).
  const words = msg.replace(/\b[A-Z][A-Z'’-]+\b/g, (w) => (w === 'GHOSTY' ? 'Ghosty' : ACRONYM.test(w) ? w : w.toLowerCase()));
  const text = h('span', { dataset: words !== msg ? { label: words.charAt(0).toUpperCase() + words.slice(1) } : {} }, msg);
  const t = h(`div.toast${kind ? `.${kind}` : ''}` as 'div', h('i.tglyph'), text);
  toastBox.append(t);
  while (toastBox.children.length > 2) toastBox.firstChild!.remove();
  // Cut at three lines (or already shortened by the caller): a tap opens the whole text, and it stays a little longer to be tapped.
  // (Measured with the cut lifted for a moment: the calm looks draw the words in the span's ::before.)
  const cutH = t.offsetHeight;
  t.classList.add('measure');
  const fullH = t.offsetHeight;
  t.classList.remove('measure');
  const long = fullH > cutH + 1 || (opts.full != null && opts.full !== msg);
  if (long) {
    t.classList.add('more');
    t.tabIndex = 0;
    const open = () => {
      t.remove();
      modal(opts.title ?? 'MESSAGE', h('div.note.toastfull', opts.full ?? msg));
    };
    t.addEventListener('click', open);
    t.addEventListener('keydown', (e) => e.key === 'Enter' && open());
  }
  const life = long ? 7000 : 3600;
  setTimeout(() => t.classList.add('out'), life);
  setTimeout(() => t.remove(), life + 500);
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

// ============================================================================================
// Route C (the calm looks, Graphite and Reactor): the instruments. Calm glass is the base; the
// character comes only from instruments that show something true — a dial with tick marks, a
// progress ring with its pass mark, a sparkline ending in a live dot, a segment per game, a pill
// that says the live state. Each is drawn from the value it is given, never from a made-up one.
// Styles: styles.css, the "route C" layer.
// ============================================================================================

/** The arc of a dial: 270° open at the bottom, as on the C mock-ups' Status card. */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)] as const;
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = (((a1 - a0) % 360) + 360) % 360 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export interface Gauge {
  el: HTMLElement;
  /** `frac` null: nothing measured (an empty track and the words only). */
  set(frac: number | null, value: string, unit?: string, tone?: 'live' | 'warn' | 'idle'): void;
}

/**
 * A dial with tick marks (the Me sheet's Status card): a 270° track, the measured part lit, the value
 * in the middle with a small unit or word under it. Tone: live (the accent), warn (amber), idle (grey).
 */
export function gauge(size = 74, word = ''): Gauge {
  const C = size / 2;
  const R = C - 9;
  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true', class: 'rcg' });
  // tick marks outside the arc, one every 27° (11 ticks over the 270°)
  for (let i = 0; i <= 10; i++) {
    const a = ((135 + i * 27) * Math.PI) / 180;
    svg.append(svgEl('line', { x1: (C + (R + 5) * Math.cos(a)).toFixed(2), y1: (C + (R + 5) * Math.sin(a)).toFixed(2), x2: (C + (R + 7.5) * Math.cos(a)).toFixed(2), y2: (C + (R + 7.5) * Math.sin(a)).toFixed(2), class: 'rcgtick' }));
  }
  svg.append(svgEl('path', { d: arcPath(C, C, R, 135, 405), class: 'rcgtrack' }));
  // the lit part: the whole arc drawn as a 0–100 dash (so it eases to a new value in CSS, styles.css .rcgfg)
  const fg = svgEl('path', { d: arcPath(C, C, R, 135, 405), class: 'rcgfg', pathLength: 100, 'stroke-dasharray': '0 100' });
  svg.append(fg);
  const v = h('b.rcgv');
  const w = h('em.rcgw', word);
  const el = h('div.rcgauge', { style: { width: `${size}px`, height: `${size}px` } }, svg, v, w);
  return {
    el,
    set(frac, value, unit, tone = 'live') {
      const f = frac == null ? 0 : Math.max(0, Math.min(1, frac));
      fg.setAttribute('stroke-dasharray', `${(f * 100).toFixed(2)} 100`);
      fg.style.opacity = frac == null || f <= 0.004 ? '0' : '1';
      el.dataset.tone = tone;
      clear(v, value, unit ? h('small', unit) : null);
      // the small word under the number (LEFT, USED) only under a number
      w.hidden = !word || !/\d/.test(value);
    },
  };
}

/** A progress ring (a game's level, a gym tile): mastery 0–1 with a tick at the pass mark. */
export function progressRing(size: number, cls = 'rcring'): { el: HTMLElement; set(frac: number, goal?: number, label?: string, done?: boolean): void } {
  const r = 50 - 6;
  const C = 2 * Math.PI * r;
  const svg = svgEl('svg', { viewBox: '0 0 100 100', width: size, height: size, 'aria-hidden': 'true' });
  const fg = svgEl('circle', { cx: 50, cy: 50, r, class: 'rcrfg', 'stroke-dasharray': `0 ${C}`, transform: 'rotate(-90 50 50)' });
  const mark = svgEl('circle', { cx: 50, cy: 6, r: 4.2, class: 'rcrmark' });
  svg.append(svgEl('circle', { cx: 50, cy: 50, r, class: 'rcrtrack' }), fg, mark);
  const b = h('b');
  const el = h(`span.${cls}` as 'span', { style: { width: `${size}px`, height: `${size}px` } }, svg, b);
  return {
    el,
    set(frac, goal, label = '', done = false) {
      const f = Math.max(0, Math.min(1, frac));
      fg.setAttribute('stroke-dasharray', `${(f * C).toFixed(1)} ${C.toFixed(1)}`);
      fg.style.opacity = f > 0.005 ? '1' : '0';
      // the pass mark: a small ring on the track at the level's bar
      const g = goal ?? 0;
      mark.setAttribute('transform', `rotate(${(g * 360).toFixed(1)} 50 50)`);
      mark.style.display = g && !done ? '' : 'none';
      el.classList.toggle('done', done);
      b.textContent = label;
    },
  };
}

/** A segmented ring: one segment per game, the first `lit` lit (the Home screen's Gym tile). */
export function segRing(n: number, lit: number, size = 58, label = ''): HTMLElement {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', width: size, height: size, 'aria-hidden': 'true' });
  const gap = n > 1 ? 4 : 0;
  const step = 360 / Math.max(1, n);
  for (let i = 0; i < n; i++) {
    const a0 = -90 + i * step + gap / 2;
    const a1 = -90 + (i + 1) * step - gap / 2;
    svg.append(svgEl('path', { d: arcPath(50, 50, 43, a0, a1), class: i < lit ? 'rcseg on' : 'rcseg' }));
  }
  return h('span.rcsegr', { style: { width: `${size}px`, height: `${size}px` } }, svg, h('b', label));
}

/** A sparkline: the line in the accent when it is live, grey otherwise, ending in a dot. */
export function sparkline(values: number[], w = 140, hgt = 26, live = false): SVGSVGElement {
  const s = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, class: `rcspark${live ? ' live' : ''}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  if (values.length < 2) return s;
  const mn = Math.min(...values, 0);
  const mx = Math.max(...values, mn + 0.01);
  const pts = values.map((y, i) => [(i / (values.length - 1)) * (w - 4) + 1, hgt - 3 - ((y - mn) / (mx - mn)) * (hgt - 6)] as const);
  s.append(svgEl('polyline', { points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), class: 'rcsl', 'vector-effect': 'non-scaling-stroke' }));
  const [lx, ly] = pts.at(-1)!;
  s.append(svgEl('circle', { cx: lx.toFixed(1), cy: ly.toFixed(1), r: 2.6, class: 'rcsd' }));
  return s;
}

/** A small capsule that says a live state ("ONLINE"): a dot and tracked capitals; tone sets its colour. */
export function pill(text: string, tone: 'live' | 'warn' | 'idle' = 'live', cls = ''): HTMLElement {
  return h(`span.rcpill${cls ? `.${cls}` : ''}` as 'span', { dataset: { tone, case: 'keep' } }, h('i'), h('span', text));
}

/** A grouped-list row (the Me sheet, Settings): a glass icon tile, a title, one line under it, a chevron. */
export function listRow(o: { id: string; glyph: string; title: string; sub: string; value?: string; onClick: () => void }): HTMLButtonElement {
  return h('button.rcrow', { type: 'button', dataset: { id: o.id, case: 'keep' }, onclick: o.onClick },
    h('span.rctile', icon(o.glyph)),
    h('span.rctx', h('b', o.title), h('small', o.sub)),
    o.value ? h('span.rcval', o.value) : null,
    icon('<path d="M9.5 6l6 6-6 6"/>', 'ic rcchev'),
  );
}
