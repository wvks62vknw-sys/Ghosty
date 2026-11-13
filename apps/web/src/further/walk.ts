/**
 * WALK ME THROUGH IT's steps (BRIEF-OCT-IDEAS-3 item 5; STARS 166): for a screen, the one key to press next and one sentence of why,
 * made from what the house already says about it and nothing new to keep: a screen's own YOU CAN lines in Every screen's copy
 * (shell/deckcopy.ts: the example prompts, each with where it goes), and for a room its things in the plan's order (shell/rooms.ts).
 * So every screen has a walk the day it exists, and no copy is kept twice.
 */
import { DECK, type DeckAct } from '../shell/deckcopy';
import { ROOMS, roomOf, thingName } from '../shell/rooms';

/** Where the soft pointer goes for a step. */
export type WalkTarget =
  | { kind: 'panel'; screen: string; panel: string }
  | { kind: 'card'; id: string }
  | { kind: 'ask'; words: string }
  | { kind: 'screen'; screen: string };

export interface WalkStep {
  /** The sentence, in his voice. */
  says: string;
  target: WalkTarget;
}
export interface Walk {
  /** The screen walked (a room's hub: `area-learn`), its name, and the steps. */
  screen: string;
  name: string;
  steps: WalkStep[];
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(?:the|screen|tab|page|room|please|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** The screen a phrase names ("the library", "learn", "god's eye", "gym"): its id, or '' when none fits. `ids` are the screens this phone has. */
export function screenFor(what: string, ids: string[]): string {
  const w = norm(what);
  if (!w) return '';
  const names = (id: string) => [id, DECK[id]?.name ?? '', thingName(id)].map(norm).filter(Boolean);
  const exact = ids.find((id) => names(id).includes(w));
  if (exact) return exact;
  // a room: "learn", "the plan", "life"
  const room = ROOMS.find((r) => norm(r.title) === w || r.key === w);
  if (room && ids.includes(room.screen)) return room.screen;
  const part = ids.find((id) => names(id).some((n) => n.length > 2 && (n.startsWith(w) || w.startsWith(n))));
  return part ?? '';
}

/** A YOU CAN line's act as where to point. */
function targetOf(act: DeckAct, screen: string): WalkTarget {
  if ('open' in act && act.panel) return { kind: 'panel', screen: act.open, panel: act.panel };
  if ('ask' in act) return { kind: 'ask', words: act.ask };
  return { kind: 'screen', screen };
}

/** The sentence for a line: his example as written, with the way to it said. */
function sentence(text: string, t: WalkTarget): string {
  const t1 = text.replace(/[.:\s]+$/, '');
  const end = /[.!?”"]$/.test(t1) ? '' : '.';
  if (t.kind === 'panel') return `Press ${t.panel.charAt(0)}${t.panel.slice(1).toLowerCase()} here: ${t1.charAt(0).toLowerCase()}${t1.slice(1)}${end}`;
  if (t.kind === 'ask') return `Say it to me, in the ask line: ${t1.charAt(0).toLowerCase()}${t1.slice(1)}${end}`;
  return `${t1}${end}`;
}

/** The walk for a screen or a room's hub; null when the house says nothing about it (every screen has copy: a test holds that). */
export function walkFor(screen: string): Walk | null {
  if (screen.startsWith('area-')) {
    const room = ROOMS.find((r) => r.screen === screen);
    if (!room) return null;
    const things = room.things.filter((t) => t.screen);
    if (!things.length) return null;
    const title = room.title.charAt(0) + room.title.slice(1).toLowerCase();
    return {
      screen,
      name: title,
      steps: things.map((t) => ({ says: `${String(t.n).padStart(2, '0')} ${t.name}: ${DECK[t.id]?.promise ?? 'one of the things in this room'}.`.replace(/\.\.$/, '.'), target: { kind: 'card', id: t.id } })),
    };
  }
  const d = DECK[screen];
  if (!d) return null;
  const steps: WalkStep[] = d.can.map((l) => {
    const target = targetOf(l.act, screen);
    return { says: sentence(l.text, target), target };
  });
  if (!steps.length) return null;
  return { screen, name: d.name, steps };
}

/** The room a screen is in, for a sentence ("in Learn"). */
export const roomWords = (screen: string): string => {
  const r = roomOf(screen);
  return r ? r.title.charAt(0) + r.title.slice(1).toLowerCase() : '';
};
