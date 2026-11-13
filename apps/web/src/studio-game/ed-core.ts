/**
 * THE EDITOR'S SHARED PIECES (BRIEF-EDITOR-GAME-STUDIO): what every pill of the editor stands on: the context (the game, its
 * undo history, what is picked), the controls (every one 44 pt, every one named for VoiceOver), and the words a refusal is said in.
 */
import { clear, h } from '../core/dom';
import { sayError } from '../ui/hisWords';
import { type Game, History, Refused, type Room } from './model';

export type Tab = 'rooms' | 'sprites' | 'characters' | 'things' | 'quests' | 'rules' | 'sound' | 'play' | 'share' | 'app';
export const TABS: { id: Tab; label: string }[] = [
  { id: 'rooms', label: 'Rooms' },
  { id: 'sprites', label: 'Sprites' },
  { id: 'characters', label: 'Characters' },
  { id: 'things', label: 'Things' },
  { id: 'quests', label: 'Quests' },
  { id: 'rules', label: 'Rules' },
  { id: 'sound', label: 'Sound' },
  { id: 'play', label: 'Play' },
  { id: 'share', label: 'Share' },
  { id: 'app', label: 'As an app' },
];

export type Tool = 'paint' | 'erase' | 'fill' | 'pick';
export interface EdState {
  tab: Tab;
  roomId: string;
  tool: Tool;
  /** The letter being painted. */
  letter: string;
  zoom: number;
  panX: number;
  panY: number;
  /** The tile a door, a person, a thing, a chest or a sign is being set on. */
  sel: { x: number; y: number } | null;
  spriteId: string;
  /** A sprite, or one of his tiles (`tile` set). */
  tile: string;
  anim: 'idle' | 'walk' | 'jump' | 'hurt' | 'talk';
  frame: number;
  ink: number;
  pen: 'pen' | 'erase' | 'fill';
  onion: boolean;
  /** Where PLAY FROM HERE starts. */
  at: { room: string; x: number; y: number } | null;
  npcId: string;
  thingId: string;
  questId: string;
}

export interface Ctx {
  hist: History;
  game(): Game;
  room(): Room;
  state: EdState;
  /** A change he made: remembered for UNDO, kept, and every pill drawn again. */
  change(fn: (g: Game) => void): boolean;
  /** Remember the state before a change that happens in many small moves (a stroke); call `touch` after each move. */
  push(): void;
  touch(): void;
  /** Draw the open pill again. */
  refresh(): void;
  go(tab: Tab): void;
  say(text: string): void;
  undo(): void;
  redo(): void;
  /** SKETCH A ROOM: a chat turn with the game's own words; the rows land in this room as a draft. */
  sketch(wish: string): void;
  /** What a pill that holds something running (a play, a timer) puts away when the pill goes. */
  onLeave(fn: () => void): void;
}

/** Run a change that may be refused: a refusal is said, never thrown at him. */
export function attempt(ctx: Ctx, fn: (g: Game) => void): boolean {
  try {
    return ctx.change(fn);
  } catch (e) {
    if (e instanceof Refused) {
      ctx.say(sayError(e, 'change that'));
      return false;
    }
    throw e;
  }
}

export const btn = (label: string, onClick: (b: HTMLButtonElement) => void, cls = '', aria = ''): HTMLButtonElement => {
  const b = h(`button.stBtn${cls ? `.${cls.split(' ').join('.')}` : ''}` as 'button', { type: 'button' }, label);
  if (aria) b.setAttribute('aria-label', aria);
  b.addEventListener('click', () => onClick(b));
  return b;
};
export const note = (text: string, cls = ''): HTMLElement => h(`p.stNote${cls ? `.${cls}` : ''}` as 'p', text);
export const field = (label: string, control: HTMLElement, hint = ''): HTMLElement => h('label.stField', h('span.stLab', label), control, hint ? h('span.stHint', hint) : null);

/** A text field that commits when he leaves it or presses return (not on every key, so a full redraw never takes his place). */
export function text(value: string, commit: (v: string) => void, o: { aria: string; placeholder?: string; max?: number; multiline?: boolean } = { aria: 'Text' }): HTMLInputElement | HTMLTextAreaElement {
  const el = (o.multiline ? h('textarea.stIn', { rows: 3 }) : h('input.stIn', { type: 'text', autocomplete: 'off', enterKeyHint: 'done' })) as HTMLInputElement | HTMLTextAreaElement;
  el.value = value;
  el.setAttribute('aria-label', o.aria);
  if (o.placeholder) el.placeholder = o.placeholder;
  if (o.max) el.maxLength = o.max;
  el.addEventListener('change', () => commit(el.value));
  if (!o.multiline) el.addEventListener('keydown', (e) => (e as KeyboardEvent).key === 'Enter' && el.blur());
  return el;
}
export function numberField(value: number, min: number, max: number, commit: (v: number) => void, aria: string, step = 1): HTMLInputElement {
  const el = h('input.stIn.stNum', { type: 'number', inputMode: 'numeric', min: String(min), max: String(max), step: String(step) });
  el.value = String(value);
  el.setAttribute('aria-label', aria);
  el.addEventListener('change', () => {
    const v = Number(el.value);
    commit(Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : value);
  });
  return el;
}
export function select(options: [string, string][], value: string, commit: (v: string) => void, aria: string): HTMLSelectElement {
  const el = h('select.stIn.stSel', { 'aria-label': aria }, ...options.map(([v, l]) => h('option', { value: v, selected: v === value }, l)));
  el.value = value;
  el.addEventListener('change', () => commit(el.value));
  return el;
}
/** A slider with its number said beside it ("Walks at 88"): the move is one change in the history. */
export function slider(label: string, value: number, min: number, max: number, say: (v: number) => string, commit: (v: number) => void, ctx: Ctx, step = 1): HTMLElement {
  const out = h('output.stOut', say(value));
  const el = h('input.stRange', { type: 'range', min: String(min), max: String(max), step: String(step) });
  el.value = String(value);
  el.setAttribute('aria-label', `${label}: ${say(value)}`);
  let pushed = false;
  el.addEventListener('input', () => {
    out.textContent = say(Number(el.value));
    el.setAttribute('aria-label', `${label}: ${say(Number(el.value))}`);
    if (!pushed) {
      ctx.push();
      pushed = true;
    }
    commit(Number(el.value));
    ctx.touch();
  });
  el.addEventListener('change', () => {
    pushed = false;
    ctx.refresh();
  });
  return h('div.stSlide', h('span.stLab', label), el, out);
}
export function toggle(label: string, on: boolean, commit: (v: boolean) => void): HTMLElement {
  const b = h('button.stBtn.stTog', { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': `${label}: ${on ? 'on' : 'off'}` }, `${label}: ${on ? 'On' : 'Off'}`);
  b.addEventListener('click', () => commit(!on));
  return b;
}
export function chips<T extends string>(items: { id: T; label: string }[], current: T | string, pick: (id: T) => void, cls = ''): HTMLElement {
  return h(`div.stChips${cls ? `.${cls}` : ''}` as 'div', { role: 'group' }, ...items.map((i) => h('button.stChip', { type: 'button', 'aria-pressed': String(i.id === current), 'aria-label': i.label, onclick: () => pick(i.id) }, i.label)));
}
export const section = (title: string, ...kids: (Node | null)[]): HTMLElement => h('section.stSec', h('h4.stH', title), ...kids);
export const repaint = (el: HTMLElement, ...kids: (Node | null)[]) => clear(el, ...kids);
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
