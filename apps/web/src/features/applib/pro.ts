/**
 * THE PRO ROUND, lane SHELL (docs/build-plan/APPLIB-PRO.md): every Library app takes the whole screen like a proper app.
 *   - the frame: an app grows out of the icon he tapped (a FLIP from its box, about 380 ms, ease-out with a soft settle; a 150 ms
 *     fade with reduced motion), covers Ghosty's room bar, ask line and page title, runs edge to edge inside the safe areas, and
 *     shrinks back into its icon on close. An edge swipe from the left follows the finger (past 35% it closes, short of it springs back);
 *   - the header: a back chevron, a large title with the app's 64 pt icon tile that collapses to a small centred title as the app
 *     scrolls, and the ⋯ menu (How it works, Settings, Export, Recently deleted, Make my own, Pin to Home);
 *   - one-time coach marks in place of the kit's tour banner: a dimmed layer lights one control at a time, one line each, at most
 *     three steps, Got it. ⋯ → How it works plays them again;
 *   - the identity: each app's accent from its family's hue (or AppDef.hue), the look's tokens setting lightness and chroma so text
 *     keeps 4.5:1 (styles.css, THE PRO ROUND), and its skin (`data-skin`, AppDef.skin over the family's).
 * Every class is `al-pro-`, every colour a token. The other lanes draw inside: `.al-pro-hero`, `.al-pro-row`, `.al-pro-card`,
 * `.al-pro-chip`, `.al-pro-section` and the `--al-accent`, `--al-accent-soft`, `--al-on-accent` tokens (PRO-SHELL.md lists them).
 */
import { h, icon } from '../../core/dom';
import { key } from '../../ui/machine';
import { kitState, type KitApp } from '../../ui/appkit';
import { FAMILIES, type AppDef, type Family, type Skin } from '../../../../../packages/shared/src/applib/index';
import { glyphOf } from './glyphs';

const BACK = '<path d="M14.5 5.5L8 12l6.5 6.5"/>';
const MORE = '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>';

/** Each family's hue (0 to 359), spread round the wheel so no two neighbours look alike. The look sets lightness and chroma. */
export const FAMILY_HUE: Record<Family, number> = {
  body: 18, life: 50, learn: 82, maker: 128, money: 158, world: 196, tools: 226, office: 256, games: 288, create: 322, data: 352,
};
export const hueOf = (d: Pick<AppDef, 'family' | 'hue'>): number => (typeof d.hue === 'number' ? ((Math.round(d.hue) % 360) + 360) % 360 : FAMILY_HUE[d.family] ?? 256);
export const skinOf = (d: Pick<AppDef, 'family' | 'skin'>): Skin => d.skin ?? (d.family as Skin);

/** Give an element an app's identity: its hue and its skin, so every al-pro token under it is that app's. */
export function identity<T extends HTMLElement>(el: T, d: Pick<AppDef, 'family' | 'hue' | 'skin'>): T {
  el.classList.add('al-pro');
  el.style.setProperty('--al-hue', String(hueOf(d)));
  el.dataset.skin = skinOf(d);
  return el;
}

/** The app's icon tile: a rounded square, a gradient of its accent, the glyph in the look's on-accent ink. l is 64 pt. */
export function tileOf(d: Pick<AppDef, 'family' | 'hue' | 'glyph'>, size: 's' | 'm' | 'l' | 'xl' = 'm'): HTMLElement {
  const t = h('span.al-pro-tile', { dataset: { size }, 'aria-hidden': 'true' }, icon(glyphOf(d.glyph), 'ic'));
  t.style.setProperty('--al-hue', String(hueOf(d)));
  return t;
}

/** For the spec and the console: the frame on screen. */
export const proState = { open: '', closing: false, swipe: 0, coach: 0, coachShown: 0, collapsed: false, opens: 0 };

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const inset = (r: DOMRect | null, radius: number) => {
  if (!r) return 'inset(30% 30% 30% 30% round 24px)';
  const W = innerWidth, H = innerHeight;
  return `inset(${Math.max(0, r.top)}px ${Math.max(0, W - r.right)}px ${Math.max(0, H - r.bottom)}px ${Math.max(0, r.left)}px round ${radius}px)`;
};
const EASE_OPEN = 'cubic-bezier(.2, 1.06, .32, 1)';
const EASE_CLOSE = 'cubic-bezier(.4, 0, .2, 1)';

/** Where an app's icon is on screen now (the Library's tile, row, hero or page icon), for the frame to grow from and shrink into. */
export function iconRect(id: string): DOMRect | null {
  const lib = document.querySelector('#pg-apps.on .al-lib');
  if (!lib) return null;
  for (const el of lib.querySelectorAll<HTMLElement>(`[data-app="${CSS.escape(id)}"]`)) {
    const t = el.querySelector<HTMLElement>('.al-pro-tile') ?? el;
    const r = t.getBoundingClientRect();
    if (r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < innerHeight) return r;
  }
  return null;
}

export interface Frame {
  el: HTMLElement;
  host: HTMLElement;
  /** Decorate the kit app inside: the back chevron, the large title, the ⋯ menu, the coach marks. */
  dress(k: KitApp, o: FrameOpts): void;
  /** Close it: shrink into the icon (or slide away after a swipe), then take it off the page. */
  close(how?: 'icon' | 'swipe' | 'now'): Promise<void>;
}
export interface FrameOpts {
  back: () => void;
  pin?: { on: () => boolean; toggle: () => boolean };
  make?: () => void;
}

/** Open the full-screen frame for an app, grown from `from` (the icon's box). */
export function openFrame(d: AppDef, from: DOMRect | null, parent: HTMLElement = document.body): Frame {
  // (a frame still closing finishes now, so its app is stopped; anything else left is taken away)
  document.querySelectorAll<HTMLElement>('.al-pro-frame').forEach((x) => { const an = x.getAnimations(); if (an.length) an.forEach((a) => a.finish()); else x.remove(); });
  const host = h('div.al-pro-host');
  const el = identity(h('div.al-pro-frame', { role: 'dialog', 'aria-modal': 'true', 'aria-label': d.name, dataset: { app: d.id } }, host), d);
  parent.append(el);
  document.documentElement.classList.add('al-open');
  Object.assign(proState, { open: d.id, closing: false, swipe: 0, collapsed: false });
  let closing = false;
  proState.opens++;
  if (reduced()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'linear' });
  else {
    el.animate([{ clipPath: inset(from, 16) }, { clipPath: inset(new DOMRect(0, 0, innerWidth, innerHeight), 0) }], { duration: 380, easing: EASE_OPEN });
    host.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
  }

  // (once it has grown, the Library under it is covered: hidden, so nothing behind the app is read or tapped)
  setTimeout(() => { if (el.isConnected && !closing) document.documentElement.classList.add('al-covered'); }, reduced() ? 160 : 400);
  let coachOff: (() => void) | null = null;
  const frame: Frame = {
    el,
    host,
    dress(kit, o) {
      const ak = kit.el;
      ak.classList.add('al-pro-app');
      identity(ak, d);
      const head = ak.querySelector<HTMLElement>('.ak-head');
      const name = ak.querySelector<HTMLElement>('.ak-name');
      const setKey = ak.querySelector<HTMLElement>('.ak-head .ak-hkey[aria-label="Settings"]');
      const back = h('button.ak-hkey.al-back.al-pro-back', { type: 'button', 'aria-label': 'Back to Apps' }, icon(BACK));
      back.addEventListener('click', () => o.back());
      const more = h('button.ak-hkey.al-pro-more', { type: 'button', 'aria-label': 'More', 'aria-haspopup': 'menu' }, icon(MORE));
      more.addEventListener('click', () => menu());
      head?.prepend(back);
      if (setKey) setKey.replaceWith(more);
      else head?.append(more);
      name?.classList.add('al-pro-smalltitle');
      head?.classList.add('al-pro-bar');
      // the large title: the 64 pt tile, the name, its family; it collapses into the small title as the app scrolls
      const large = h('div.al-pro-large', h('span.al-pro-largetile', tileOf(d, 'l')), h('div.al-pro-largewords', h('h1.al-pro-largename', d.name), h('small.al-pro-largeline', FAMILIES[d.family] ?? '')));
      head?.after(large);
      let H = 0;
      const onScroll = () => {
        H = H || large.scrollHeight;
        const st = kit.body.scrollTop;
        const p = Math.max(0, Math.min(1, st / Math.max(1, H)));
        large.style.marginTop = `${-Math.round(p * H)}px`;
        large.style.opacity = String(1 - p);
        el.style.setProperty('--al-pro-p', p.toFixed(3));
        const c = p > 0.85;
        if (c !== proState.collapsed) { proState.collapsed = c; head?.toggleAttribute('data-collapsed', c); }
      };
      kit.body.addEventListener('scroll', onScroll, { passive: true });
      // the menu
      const menu = () => {
        ak.querySelector('.al-pro-menu')?.remove();
        const sheet = h('div.al-pro-menu.ak-sheet', { role: 'menu', 'aria-label': `${d.name} menu` });
        const done = () => sheet.remove();
        const item = (word: string, run: () => void, label = word) => {
          const b = h('button.al-pro-menuitem', { type: 'button', role: 'menuitem', 'aria-label': label }, h('span', word));
          b.addEventListener('click', () => { done(); run(); });
          return b;
        };
        const pinWord = () => (o.pin?.on() ? 'Unpin from Home' : 'Pin to Home');
        sheet.append(...([
          h('div.al-pro-menuhead', tileOf(d, 's'), h('b', d.name)),
          item('How it works', () => coach(true)),
          item('Settings', () => kit.openSettings()),
          item('Export CSV', () => void kit.share('csv')),
          item('Export JSON', () => void kit.share('json')),
          item('Recently deleted', () => bin()),
          o.make ? item('Make my own', () => o.make!()) : null,
          o.pin ? item(pinWord(), () => { const on = o.pin!.toggle(); kit.notice(on ? `${d.name} is pinned to Home.` : `${d.name} is off Home.`, { tone: 'ok' }); }) : null,
          key('Close', done, { kind: 'fill' }),
        ] as (HTMLElement | null)[]).filter((x): x is HTMLElement => !!x));
        sheet.addEventListener('click', (e) => { if (e.target === sheet) done(); });
        ak.append(sheet);
      };
      const bin = () => {
        const sheet = h('div.ak-sheet.al-pro-binsheet', { role: 'dialog', 'aria-label': 'Recently deleted' });
        const close = () => sheet.remove();
        const gone = kit.bin();
        const rows = gone.map((x) => {
          const b = h('button.al-pro-row', { type: 'button', 'aria-label': `Put back ${x.title}` }, h('span.al-pro-rowmain', h('b', x.title), x.sub ? h('small', x.sub) : null), h('span.al-pro-rowval', 'Put back'));
          b.addEventListener('click', () => { kit.restore(x.id); close(); kit.notice(`Put back “${x.title}”.`, { tone: 'ok' }); });
          return b;
        });
        sheet.append(h('h3.ak-sheethead', 'Recently deleted'), rows.length ? h('div.al-pro-list', ...rows) : h('p.ak-binnone', 'Nothing deleted.'), key('Done', close, { kind: 'fill' }));
        ak.append(sheet);
      };
      // coach marks: once (while the kit's first-run tour is on), and again from ⋯ → How it works
      const coach = (replay = false) => {
        coachOff?.();
        const tourEl = ak.querySelector<HTMLElement>('.ak-tour');
        if (!replay && !(kitState[d.id]?.tour)) return;
        const targets = [
          () => kit.body.firstElementChild as HTMLElement | null ?? kit.body,
          () => ak.querySelector<HTMLElement>('.ak-tools button') ?? kit.body,
          () => more,
        ];
        const lines = d.tour;
        let i = 0;
        const layer = h('div.al-pro-coach', { role: 'dialog', 'aria-label': 'How it works' });
        const hole = h('div.al-pro-coachhole');
        const step = h('span.al-pro-coachn');
        const words = h('p.al-pro-coachwords');
        const next = key('Next', () => go(i + 1), { kind: 'fill' });
        const bubble = h('div.al-pro-coachcard', step, words, next);
        layer.append(hole, bubble);
        el.append(layer);
        const finish = () => {
          coachOff?.();
          // (the kit's own tour, ended, so the first run is over and kept so on the phone)
          for (let n = 0; n < 4 && kitState[d.id]?.tour; n++) ak.querySelector<HTMLButtonElement>('.ak-tour button')?.click();
        };
        const go = (n: number) => {
          if (n >= Math.min(3, lines.length)) return finish();
          i = n;
          proState.coach = n + 1;
          const t = targets[n]!();
          const r = (t ?? kit.body).getBoundingClientRect();
          const pad = 6;
          const top = Math.max(8, r.top - pad), left = Math.max(8, r.left - pad);
          const hh = Math.min(r.height + pad * 2, innerHeight * 0.45), ww = Math.min(r.width + pad * 2, innerWidth - 16);
          Object.assign(hole.style, { top: `${top}px`, left: `${left}px`, width: `${ww}px`, height: `${hh}px` });
          const below = top + hh + 180 < innerHeight;
          Object.assign(bubble.style, below ? { top: `${top + hh + 12}px`, bottom: '' } : { bottom: `${Math.max(12, innerHeight - top + 12)}px`, top: '' });
          step.textContent = `${n + 1} of ${Math.min(3, lines.length)}`;
          words.textContent = lines[n]!;
          next.querySelector('span')!.textContent = n + 1 >= Math.min(3, lines.length) ? 'Got it' : 'Next';
          next.setAttribute('aria-label', n + 1 >= Math.min(3, lines.length) ? 'Got it' : 'Next');
        };
        // (the kit's tour ended any other way, a spec or an old key: the coach marks go with it)
        const mo = tourEl && !replay ? new MutationObserver(() => { if (!kitState[d.id]?.tour) coachOff?.(); }) : null;
        mo?.observe(tourEl!, { attributes: true, attributeFilter: ['hidden'] });
        coachOff = () => { mo?.disconnect(); layer.remove(); proState.coach = 0; coachOff = null; };
        proState.coachShown++;
        requestAnimationFrame(() => go(0));
      };
      // (after the open settles, so the controls it lights are where they will stay)
      setTimeout(() => { if (el.isConnected && !closing) coach(false); }, reduced() ? 160 : 420);
      edgeSwipe(o.back);
    },
    async close(how = 'icon') {
      if (closing || !el.isConnected) return;
      closing = true;
      proState.closing = true;
      document.documentElement.classList.remove('al-covered');
      coachOff?.();
      const finish = () => {
        el.remove();
        // (another app may have opened over this one while it closed: its state is its own)
        if (!document.querySelector('.al-pro-frame')) {
          document.documentElement.classList.remove('al-open', 'al-covered');
          Object.assign(proState, { open: '', closing: false, swipe: 0, collapsed: false, coach: 0 });
        }
      };
      if (how === 'now') return finish();
      try {
        if (reduced()) await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }).finished;
        else if (how === 'swipe') await el.animate([{ transform: el.style.transform || 'none' }, { transform: `translateX(${innerWidth}px)` }], { duration: 220, easing: EASE_CLOSE, fill: 'forwards' }).finished;
        else {
          const to = iconRect(d.id);
          host.animate([{ opacity: 1 }, { opacity: 0.2 }], { duration: 300, easing: EASE_CLOSE, fill: 'forwards' });
          await el.animate([{ clipPath: inset(new DOMRect(0, 0, innerWidth, innerHeight), 0) }, { clipPath: inset(to, 16) }], { duration: 300, easing: EASE_CLOSE, fill: 'forwards' }).finished;
        }
      } catch {
        // (an animation cancelled: it closes all the same)
      }
      finish();
    },
  };

  // edge swipe from the left: the app follows the finger; past 35% it closes, otherwise it springs back
  const edgeSwipe = (back: () => void) => {
    let x0 = -1, y0 = 0, dx = 0, id = -1, live = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.clientX > 24 || closing || el.querySelector('.ak-sheet, .al-pro-coach')) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; live = false;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || x0 < 0) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!live) {
        if (Math.abs(my) > 14 && Math.abs(my) > Math.abs(mx)) { x0 = -1; return; }
        if (mx < 8) return;
        live = true;
        try { el.setPointerCapture(id); } catch { /* (a synthetic pointer) */ }
        el.classList.add('al-pro-dragging');
      }
      dx = Math.max(0, mx);
      el.style.transform = `translateX(${dx}px)`;
      proState.swipe = dx / innerWidth;
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id || x0 < 0) return;
      x0 = -1;
      el.classList.remove('al-pro-dragging');
      if (!live) return;
      if (dx > innerWidth * 0.35) { proState.swipe = 1; swiped = true; back(); }
      else {
        el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'translateX(0)' }], { duration: 260, easing: EASE_OPEN });
        el.style.transform = '';
        proState.swipe = 0;
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  let swiped = false;
  const close = frame.close;
  frame.close = (how) => close(how ?? (swiped ? 'swipe' : 'icon'));
  return frame;
}
