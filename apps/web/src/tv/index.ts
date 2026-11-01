/**
 * TV MODE (BRIEF-REST-C part 3; OWNER-ISSUES 94 (e), 97 (b): the PS5's hidden browser opens Ghosty, the controller moves
 * a pointer there, the Eye and the new centre piece failed). For any television, on by itself on a TV-shaped screen
 * (tv/detect.ts) or by SETTINGS → THEME → TV MODE:
 *  - body.tv: big targets (56 pt at least), a focus ring you can see from the sofa, the systems deck as a grid of large
 *    tiles, the chat in a bigger type (styles.css, the [restc] block at its end);
 *  - D-PAD NAVIGATION: the arrow keys and a gamepad's d-pad (the Gamepad API's standard buttons, and its left stick) move
 *    the focus between the controls in reading order (detect.ts nextFocus) within whatever is on top (the keyboard, a
 *    sheet, the deck, else the screen with its bars); A / Enter presses; B / Escape goes back (a sheet or the deck closes
 *    itself on Escape; else the bar's back, else the last screen);
 *  - an on-screen keyboard for the chat (tv/keyboard.ts) beside the box, for a browser that brings none;
 *  - the arcade says, in one line, whether its DOS games start here, from a real start of the engine (tv/probe.ts).
 * Nothing in it needs the phone's sensors: no camera, no tilt, no position.
 * And, TV or not, where this browser cannot draw WebGL (body.no3d): God's Eye is drawn flat (map tiles), with "this
 * screen can't draw the 3-D map"; the 3D STUDIO and the 3-D games are hidden with one line each; Home's Mind is drawn
 * flat (tv/flatmind.ts, from features/core/reactor.ts) instead of the old arc reactor.
 */
import { h } from '../core/dom';
import { gfx } from '../engine/gfx';
import { ui } from '../state/app';
import { go } from '../shell/tabs';
import { SHELF } from '../arcade/shelf';
import { nextFocus, PAD, type Box, type Dir } from './detect';
import { closeKeyboard, keyboardOpen, openKeyboard } from './keyboard';
import { has3d, hasWasm, hasWebGpu, probeDos } from './probe';
import { tvNow, tvSetting } from './setting';

export { tvNow, tvSetting };

/** What a test (and the console) reads: window.__ghosty.tv. */
export const tvState = { on: false, has3d: true, webgpu: false, wasm: null as boolean | null, eye: '', studio: '', games: '', dos: '', focus: '', keys: 0, pad: false };

const FOCUSABLE = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="switch"], [role="tab"]';
/** The engines that draw with WebGL (the rest — DOS, DOOM — draw in 2-D). */
const ENGINES_3D = new Set(['quake', 'voxel', 'runner', 'kart', 'hopper', 'arena']);

/** What the d-pad moves in: the keyboard, else the top sheet or the deck, else the page with its bars. */
function layer(): HTMLElement {
  const kb = keyboardOpen();
  if (kb) return kb;
  const sheets = [...document.querySelectorAll<HTMLElement>('.modal, #deck.on, #mesheet.on, .sheet.on, [role="dialog"]:not([hidden])')].filter((e) => e.getClientRects().length);
  return sheets[sheets.length - 1] ?? document.body;
}
/** A game is being played in the arcade (not paused): its own keys and buttons drive it. */
const gameOn = (): boolean => !!document.querySelector('.arcplayer') && !document.querySelector('.arcmenu:not([hidden])');
const typing = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement => !!el && (/^(INPUT|TEXTAREA)$/.test(el.tagName) || (el as HTMLElement).isContentEditable);

/** The controls the d-pad can reach in the layer: shown, enabled, on the page now. */
function controls(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => {
    if ((e as HTMLButtonElement).disabled || e.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(e);
    return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
  });
}

/** One step of the d-pad: the next control that way gets the focus (and is brought into view). */
export function move(dir: Dir): void {
  const list = controls(layer());
  if (!list.length) return;
  const boxes: Box[] = list.map((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
  });
  const cur = list.indexOf(document.activeElement as HTMLElement);
  const next = list[nextFocus(boxes, cur, dir)];
  if (!next) return;
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  tvState.focus = (next.getAttribute('aria-label') ?? next.textContent ?? '').trim().slice(0, 60);
}

/** A / Enter on something that is not a native button: press it. */
function press(): void {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return move('right');
  if (typing(el)) return openKeyboard(el);
  el.click();
}

/** The screens he came through (B goes back along them; the browser's own history may lead out of Ghosty). */
const trail: string[] = [];
let goingBack = false;

/** B / Escape: a sheet or the deck closes itself on Escape; else the bar's back, else the last screen. */
function back(fromKey: boolean): void {
  if (keyboardOpen()) return closeKeyboard();
  const top = layer();
  if (top !== document.body) {
    if (!fromKey) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }
  const nav = document.querySelector<HTMLElement>('#top .navback');
  if (nav && !nav.hidden && nav.getClientRects().length) return nav.click();
  const prev = trail.pop() ?? (ui.get().tab !== 'core' ? 'core' : null);
  if (!prev) return;
  goingBack = true;
  go(prev);
  goingBack = false;
}

const KEYS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
function onKey(e: KeyboardEvent): void {
  if (!tvState.on || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const el = document.activeElement;
  const dir = KEYS[e.key];
  if (dir) {
    // in a text field the left and right arrows move the caret (leaving it only from its very end or start); up and down leave it
    if (typing(el) && (dir === 'left' || dir === 'right')) {
      const f = el as HTMLInputElement;
      const end = (f.selectionStart ?? 0) >= (f.value ?? '').length;
      const start = (f.selectionEnd ?? 0) === 0;
      if (!(dir === 'right' ? end : start)) return;
    }
    // a game being played takes its own keys
    if (gameOn()) return;
    e.preventDefault();
    tvState.keys++;
    move(dir);
  } else if (e.key === 'Escape') {
    back(true);
  } else if (e.key === 'Backspace' && !typing(el)) {
    e.preventDefault();
    back(false);
  } else if (e.key === 'Enter' && el && !typing(el) && !/^(BUTTON|A|SELECT)$/.test(el.tagName)) {
    e.preventDefault();
    press();
  }
}

/** The gamepad: d-pad (or the left stick) moves, A presses, B goes back; a held direction repeats. */
let padLoop = 0;
function pollPad(): void {
  const held: Record<string, number> = {};
  const step = () => {
    padLoop = tvState.on ? requestAnimationFrame(step) : 0;
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected);
    if (!pad) return;
    tvState.pad = true;
    const now = performance.now();
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const want: Record<string, boolean> = {
      up: !!pad.buttons[PAD.up]?.pressed || ay < -0.6,
      down: !!pad.buttons[PAD.down]?.pressed || ay > 0.6,
      left: !!pad.buttons[PAD.left]?.pressed || ax < -0.6,
      right: !!pad.buttons[PAD.right]?.pressed || ax > 0.6,
      a: !!pad.buttons[PAD.a]?.pressed,
      b: !!pad.buttons[PAD.b]?.pressed,
    };
    for (const [k, on] of Object.entries(want)) {
      if (!on) {
        delete held[k];
        continue;
      }
      const since = held[k];
      // first press at once; held: again after 400 ms, then every 150 ms (the d-pad only)
      if (since === undefined || (k.length > 1 && now - since > 400)) {
        held[k] = since === undefined ? now : now - 250;
        if (gameOn()) continue;
        if (k === 'a') press();
        else if (k === 'b') back(false);
        else move(k as Dir);
      }
    }
  };
  if (!padLoop) padLoop = requestAnimationFrame(step);
}

/** One line on a screen, said once (VoiceOver hears it). */
function line(page: HTMLElement, cls: string, text: string, first = true): HTMLElement {
  let el = page.querySelector<HTMLElement>(`.tvline.${cls}`);
  if (!el) {
    el = h(`p.tvline.${cls}` as 'p', { role: 'status', dataset: { case: 'keep' } });
    if (first) page.prepend(el);
    else page.append(el);
  }
  el.textContent = text;
  return el;
}

/** God's Eye with no globe: the same place as flat map tiles. */
let flatEye = false;
async function eyeFallback(page: HTMLElement): Promise<void> {
  if (gfx.ready) return;
  const say = 'This screen can’t draw the 3-D map, so God’s Eye is flat here: map tiles you can move and zoom.';
  tvState.eye = say;
  if (flatEye) return;
  flatEye = true;
  const host = h('div.tvmap', { role: 'region', 'aria-label': 'Flat map' });
  const box = h('section.tvflat', h('p.tvline.tveye', { role: 'status', dataset: { case: 'keep' } }, say), host);
  page.prepend(box);
  // the globe's own controls have nothing to draw on: the flat map takes the screen, with its own
  page.classList.add('eyeflat');
  try {
    const { createFlatMap } = await import('../ui/flatmap');
    const { home } = await import('../state/app');
    const { streetViewUrl, wazeUrl } = await import('../ui/mapurls');
    const at = home();
    const spot = { lat: at.lat, lon: at.lon, name: at.name };
    const map = createFlatMap(host, { streetView: (s) => void open(streetViewUrl(s), '_blank'), traffic: (s) => void open(wazeUrl(s), '_blank'), close: () => undefined });
    await map.open(spot, { zoom: 11 });
    map.invalidate();
  } catch (e) {
    host.textContent = `The flat map did not load: ${String((e as Error)?.message ?? e).slice(0, 120)}`;
  }
}

/** The arcade: 3-D games hidden where there is no WebGL; on a TV, whether the DOS games start here, tried. */
function arcadeFallback(page: HTMLElement): void {
  const shelf = page.querySelector<HTMLElement>('.arcshelf') ?? page;
  if (!tvState.has3d) {
    const ids = new Set(SHELF.filter((e) => ENGINES_3D.has(e.engine)).map((e) => e.id));
    for (const c of page.querySelectorAll<HTMLElement>('.arccard[data-id]')) if (ids.has(c.dataset.id!)) c.hidden = true;
    tvState.games = 'The 3-D games are hidden: this screen can’t draw 3-D. The DOS games and DOOM draw in 2-D.';
    line(shelf, 'tvgames', tvState.games);
  }
  if (!tvState.on) return;
  if (!tvState.dos) line(shelf, 'tvdos', 'Trying the DOS engine on this screen…');
  void probeDos().then((r) => {
    tvState.dos = r.line;
    line(page.querySelector<HTMLElement>('.arcshelf') ?? page, 'tvdos', r.line);
    if (!r.ok) for (const c of page.querySelectorAll<HTMLElement>('.arccard[data-id]')) if (SHELF.find((e) => e.id === c.dataset.id)?.engine === 'dos') c.hidden = true;
  });
}

/** The screen just shown: its fallbacks, once its page is there. */
function fallbacks(tab: string, tries = 0): void {
  const page = document.getElementById(`pg-${tab}`);
  if (!page) {
    if (tries < 20) setTimeout(() => fallbacks(tab, tries + 1), 150);
    return;
  }
  if (tab === 'eye') void eyeFallback(page);
  if (tab === 'studio' && !tvState.has3d) {
    tvState.studio = 'This screen can’t draw 3-D, so the 3D Studio is hidden here.';
    line(page, 'tvstudio', tvState.studio);
  }
  if (tab === 'arcade') {
    arcadeFallback(page);
    // the shelf is drawn again as games come and go: hide again then
    if (!page.dataset.tvwatch) {
      page.dataset.tvwatch = '1';
      let t = 0;
      new MutationObserver(() => {
        clearTimeout(t);
        t = window.setTimeout(() => ui.get().tab === 'arcade' && !tvState.has3d && arcadeFallback(page), 120);
      }).observe(page, { childList: true, subtree: true });
    }
  }
}

/** The chat's keyboard button (TV mode only), beside the box. */
function chatKeyboard(): void {
  const bar = document.getElementById('cbar');
  const box = document.getElementById('cin') as HTMLInputElement | null;
  if (!bar || !box) return void setTimeout(chatKeyboard, 400);
  if (bar.querySelector('.tvkbbtn')) return;
  const b = h('button.tvkbbtn', { type: 'button', 'aria-label': 'Keyboard on the screen' }, '⌨');
  b.addEventListener('click', () => openKeyboard(box));
  bar.append(b);
}

/** TV mode on or off now (the setting or the screen changed). */
function apply(): void {
  const on = tvNow();
  tvState.on = on;
  document.body.classList.toggle('tv', on);
  if (on) {
    chatKeyboard();
    pollPad();
  } else closeKeyboard();
}

/** From the layout, once (shell/layout.ts): TV mode, the d-pad, and the no-3-D fallbacks. */
export function startTv(): void {
  tvState.has3d = has3d();
  tvState.webgpu = hasWebGpu();
  void hasWasm().then((ok) => (tvState.wasm = ok));
  document.body.classList.toggle('no3d', !tvState.has3d);
  apply();
  addEventListener('resize', apply);
  tvSetting.subscribe(apply);
  addEventListener('keydown', onKey);
  addEventListener('gamepadconnected', () => tvState.on && pollPad());
  ui.subscribe((s, p) => {
    if (s.tab === p.tab) return;
    if (!goingBack && p.tab && trail[trail.length - 1] !== p.tab) {
      trail.push(p.tab);
      if (trail.length > 20) trail.shift();
    }
    requestAnimationFrame(() => fallbacks(s.tab));
  });
  requestAnimationFrame(() => fallbacks(ui.get().tab));
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.tv = tvState), true);
  if (!attach()) {
    let n = 0;
    const timer = window.setInterval(() => (attach() || ++n > 60) && clearInterval(timer), 500);
  }
}
