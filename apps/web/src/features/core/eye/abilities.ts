/**
 * THE EYE'S ABILITIES WALL (BRIEF-EYE-HUD-2 item 3, found-not-fixed NOT REACHED 3): what Ghosty can do in a room (Home's own abilities from Home's
 * ABILITIES feed), as the wall: one feed each with its one line, "I can …", the one he asked about last sharp (the accent box, the line of sight to
 * the instruments' lit key), the rest in grain. A tap asks it in the ask line (the existing ASK path: abilities/registry.ts `intoChat` puts the
 * example in the chat's box for him to finish and send; it is never sent for him). Nothing is learned or invented here: the list is
 * abilities/registry.ts `allAbilities()` (the brain's as it last told this phone, and the app's own from its registries), placed in a room by the
 * screen each opens; an ability that opens no screen of a room is Home's. Drawn only in the eye (the other worlds have no way in to it).
 */
import { h, icon } from '../../../core/dom';
import { ui } from '../../../state/app';
import { CATS, type Ability } from '../../../../../../packages/shared/src/abilities';
import { roomOf, ROOMS } from '../../../shell/rooms';
import { recentIds } from '../../../shell/inventory';
import { dur } from '../../../ui/machine';
import { drawGrain, inkOf } from './grain';
import { iCan, lookingAbilities, WHY } from './words';

type Reg = typeof import('../../../abilities/registry');
let reg: Reg | null = null;
let loading: Promise<Reg> | null = null;
/** The registry, loaded once on first need (a wall asks for it when it opens; a room's feed asks for the count). */
export const registry = (): Promise<Reg> => (loading ??= import('../../../abilities/registry').then((m) => (reg = m)));

const KEY = 'ghosty.eyeasked';
export const lastAsked = (): string => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const setAsked = (id: string) => {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* per-viewer convenience only */
  }
};

/** The room an ability belongs to: the room of the screen it opens; one that opens no screen of a room (the brain's asks and commands) is Home's. */
export function roomKeyOf(a: Ability): string {
  const g = a.go;
  if ('open' in g) {
    const id = g.open.split('?')[0]!;
    const hub = /^area-(\w+)$/.exec(id)?.[1];
    if (hub) return hub === 'ask' ? 'home' : hub;
    return roomOf(id)?.key ?? 'home';
  }
  return 'home';
}

const NAMES: Record<string, string> = { 'gym:games': 'Games', 'lens:modes': 'Ways to see', 'school:stages': 'School stages' };
/** An ability's name on its feed. */
export function nameOf(a: Ability): string {
  if (NAMES[a.id]) return NAMES[a.id]!;
  if (a.id.startsWith('s:') && reg) return reg.screenName(a.id.slice(2));
  if (a.id.startsWith('g:')) {
    const t = a.id.slice(2).replace(/[:_-]+/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  return CATS.find((c) => c.id === a.cat)?.label ?? a.id;
}

/** What he can do in a room, in the registry's own order (the app's screens as the room lists them, then the rest). */
export function abilitiesOf(roomKey: string): Ability[] {
  if (!reg) return [];
  const room = ROOMS.find((r) => r.key === roomKey);
  const list = reg.allAbilities().filter((a) => roomKeyOf(a) === roomKey);
  const pos = (a: Ability) => (a.id.startsWith('s:') ? room?.things.findIndex((t) => t.id === a.id.slice(2)) ?? -1 : -1);
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (pos(x.a) < 0 ? 1e3 + x.i : pos(x.a)) - (pos(y.a) < 0 ? 1e3 + y.i : pos(y.a)))
    .map((x) => x.a);
}

/** Which of a room's abilities the eye is on: the one he asked about last, else the one for the thing he used last in the room, else the first. */
export function sharpOf(list: Ability[], roomKey: string): { a: Ability; why: keyof typeof WHY } | null {
  if (!list.length) return null;
  const asked = list.find((a) => a.id === lastAsked());
  if (asked) return { a: asked, why: 'asked' };
  const room = ROOMS.find((r) => r.key === roomKey);
  const mine = new Set(room?.things.map((t) => t.id));
  for (const id of recentIds()) {
    const a = list.find((x) => x.id === `s:${id}`);
    if (a && mine.has(id)) return { a, why: 'recent' };
  }
  return { a: list[0]!, why: 'first' };
}

/** What the wall shows, for the checks and the console (window.__ghosty.eyeabil). */
export const abilState = { open: false, room: '', kick: '', feeds: [] as { id: string; sharp: boolean; line: string; ask: string }[], asked: '' };

let layer: HTMLElement | null = null;
let offKey: (() => void) | null = null;
export const closeAbilities = (): void => {
  if (!layer) return;
  layer.remove();
  layer = null;
  offKey?.();
  offKey = null;
  document.body.classList.remove('eyeabil');
  abilState.open = false;
};

/** Open the wall of what he can do in a room (`home` for Home's own). */
export async function openAbilities(roomKey: string): Promise<void> {
  const m = await registry();
  // (the brain's side, as this phone last kept it; never asked before, it is waited for a moment so the wall is not half a list)
  if (!m.brainSide.get().at) await Promise.race([m.loadBrainSide(), new Promise((r) => setTimeout(r, 1500))]);
  closeAbilities();
  const room = ROOMS.find((r) => r.key === roomKey) ?? ROOMS[0]!;
  const list = abilitiesOf(room.key);
  const sharp = sharpOf(list, room.key);
  const kick = h('p.eyekick.g-truth', { dataset: { case: 'keep' } }, lookingAbilities(room.key === 'home' ? '' : room.title, list.length));
  const back = h('button.eyeback', { type: 'button', 'aria-label': 'Back to the wall', dataset: { case: 'keep' } }, icon('<path d="M15 5l-7 7 7 7"/>', 'ic'), h('span', 'The wall'));
  back.addEventListener('click', closeAbilities);
  const ink = inkOf();
  const feeds: HTMLElement[] = [];
  const order = sharp ? [sharp.a, ...list.filter((a) => a !== sharp.a)] : [];
  let focus: HTMLElement | null = null;
  for (const a of order) {
    const isSharp = a === sharp?.a;
    const line = iCan(a.off ? `${a.line} (It ${a.off}.)` : a.line);
    const ask = a.asks[0] ?? '';
    const tagText = isSharp ? `${nameOf(a)} · ${WHY[sharp!.why]}` : nameOf(a);
    const b = h(`button.eyefeed.ability${isSharp ? '.sharp' : ''}` as 'button', { type: 'button', dataset: { ability: a.id, case: 'keep', kind: isSharp ? 'asked' : 'ability', ...(a.off ? { off: 'true' } : {}) }, 'aria-label': `${nameOf(a)}. ${line} Ask it` },
      ...(isSharp ? [] : [h('canvas.eyepic', { 'aria-hidden': 'true', dataset: { feed: a.id } })]),
      h('span.eyetag.g-truth', { dataset: { case: 'keep' } }, h('span', tagText)),
      h('span.eyeline.g-truth', { dataset: { case: 'keep' } }, line));
    b.addEventListener('click', () => {
      setAsked(a.id);
      abilState.asked = a.id;
      closeAbilities();
      if (ask) reg!.intoChat(ask);
      else reg!.go(a);
    });
    if (isSharp) focus = h('div.eyefocus', b, h('i.eyesight', { 'aria-hidden': 'true' }));
    else feeds.push(b);
  }
  const grid = h('div.eyegrid', ...feeds);
  const none = h('p.eyenone', { dataset: { case: 'keep' } }, 'Nothing listed here yet. Ask me what I can do and I will say.');
  const head = h('div.eyehead', back);
  layer = h('div#eyeabil.eyehub.abil', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'What I can do here', dataset: { room: room.key } }, head, kick, h('div.eyewalls', ...(sharp && focus ? [grid, focus] : [none])));
  const topEl = document.getElementById('top');
  const topShown = topEl && topEl.getClientRects().length ? Math.round(topEl.getBoundingClientRect().bottom) : 0;
  // (it stands on the instruments' words, so the kick row of the house stays in sight under it)
  const cap = document.querySelector<HTMLElement>('#dock .housekick') ?? document.querySelector<HTMLElement>('#dock .tabcap');
  const capRect = cap && cap.getClientRects().length ? cap.getBoundingClientRect() : null;
  layer.style.setProperty('--plan-top', `${topShown}px`);
  layer.style.setProperty('--plan-bottom', `${Math.round(capRect ? innerHeight - capRect.top : 0)}px`);
  document.getElementById('app')!.append(layer);
  document.body.classList.add('eyeabil');
  abilState.open = true;
  abilState.room = room.key;
  abilState.kick = kick.textContent ?? '';
  abilState.feeds = order.map((a, i) => ({ id: a.id, sharp: i === 0, line: iCan(a.off ? `${a.line} (It ${a.off}.)` : a.line), ask: a.asks[0] ?? '' }));
  const ms = dur('bring');
  if (ms) layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: getComputedStyle(document.documentElement).getPropertyValue('--g-ease-bring').trim() || 'ease-out' });
  // the grain and the line of sight are drawn at once, so the wall's first frame is whole (a slow frame, with the globe busy behind it, never shows
  // it empty); again a frame later, when anything it stands on has moved (a feed whose size is unchanged is not redrawn: drawGrain's own signature)
  const paint = () => {
    if (!layer) return;
    for (const cv of layer.querySelectorAll<HTMLCanvasElement>('canvas.eyepic')) drawGrain(cv, cv.dataset.feed ?? '', ink);
    sight(layer);
  };
  paint();
  requestAnimationFrame(paint);
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeAbilities();
  addEventListener('keydown', onKey);
  offKey = () => removeEventListener('keydown', onKey);
}

/** The line of sight: the corridor under the sharp feed has its line at the instruments' lit key (they stand right under it). */
export function sight(root: HTMLElement): void {
  const focus = root.querySelector<HTMLElement>('.eyefocus');
  if (!focus) return;
  const key = document.querySelector<HTMLElement>('#dock .tabcap button.on');
  const f = focus.getBoundingClientRect();
  const k = key && key.getClientRects().length ? key.getBoundingClientRect() : null;
  focus.style.setProperty('--sx', `${Math.round(k ? k.left + k.width / 2 - f.left : f.width / 2)}px`);
}

ui.subscribe((s, p) => s.tab !== p.tab && closeAbilities());
const w = window as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.eyeabil = abilState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
