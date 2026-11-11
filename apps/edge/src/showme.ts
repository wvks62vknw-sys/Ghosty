/**
 * THE BRAIN CHOOSES THE PICTURE (BRIEF-KERNEL-YES 4; OWNER-ISSUES 170): when the reply, his words or a tool's result make the kind of
 * picture plain, the brain names it in one `show` event and the phone's Stage draws that kind (the phone's own reading stays as the
 * fallback when no event comes). By code, never by asking a model again; pure, so a test can ask it anything.
 *
 * Only what the turn itself holds is used: a map a tool opened, a journey a tool drew, figures the reply wrote, a letter or a plan he
 * asked for, a problem the shared solver reads in his words, a part he named with its sizes. No live position is ever read here (the
 * brain has none), and nothing about a person is predicted or drawn.
 */
import { seriesFrom } from '../../../packages/shared/src/chart';
import type { BrainShow } from '../../../packages/shared/src/protocol';
import { parseProblem } from '../../../packages/shared/src/workbench/words';

export interface ShowTurn {
  /** His words this turn. */
  ask: string;
  /** The reply, whole. */
  reply: string;
  /** The screen commands the brain sent this turn (a tool's own map or journey). */
  clients: { name: string; args: Record<string, unknown> }[];
}

const WRITE = /^(?:(?:can|could|would) you |please |ghosty,? )?(?:write|draft|compose|do|make)\s+(?:me\s+|us\s+)?(?:up\s+)?(?:a|an|the|my)\s+(?:short\s+|formal\s+|polite\s+|strong\s+|quick\s+)?(letter|email|e-mail|complaint|cover letter|covering letter|essay|report|cv|speech|statement|document|note|notice|reference|application|story|poem|article|summary|proposal|appeal)\b/i;
const PLAN_ASK = /\b(?:plan|itinerary|timetable|schedule|checklist|agenda|menu|routine|revision plan|meal plan)\b/i;
const PLAN_VERB = /\b(?:make|write|draft|create|build|give|put together|plan|prepare|set up|come up with)\b/i;
const MAKE = /\b(?:show|draw|design|build|make|model|picture|visuali[sz]e|render|sketch|3-?d|lay out|furnish)\b/i;
const NOT = /\b(?:buy|price|cost|cheap(?:est)?|where (?:can|do) i|deliver|order|sell|how much|review|best)\b/i;
const PARTS: [string, RegExp][] = [
  ['desk', /\bdesks?\b/],
  ['table', /\btables?\b/],
  ['shelf', /\bshel(?:f|ves)\b|\bbookcases?\b/],
  ['bed', /\bbeds?\b/],
  ['sofa', /\bsofas?\b|\bcouch(?:es)?\b/],
  ['wardrobe', /\bwardrobes?\b/],
  ['chair', /\bchairs?\b/],
  ['stool', /\bstools?\b/],
  ['bench', /\bbench(?:es)?\b/],
  ['cabinet', /\bcabinets?\b|\bsideboards?\b/],
];
const ROOM = /\b(?:room|bedroom|lounge|living room|kitchen|study|office|nursery|garage)\b/i;
const liney = (reply: string) => reply.split('\n').filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).length;

/** The picture this turn calls for, or null (most turns: a plain sentence shows nothing). */
export function brainShow(t: ShowTurn): BrainShow | null {
  const ask = t.ask.trim();
  const reply = t.reply.trim();
  if (!ask || !reply) return null;
  // a journey a tool drew on its own screen
  const route = t.clients.find((c) => c.name === 'show_journey' || c.name === 'show_route');
  if (route) return { t: 'show', kind: 'route', data: { screen: true } };
  // a map a tool opened: its place and where it is
  const map = t.clients.find((c) => c.name === 'show_map');
  if (map) {
    const lat = Number(map.args.lat);
    const lon = Number(map.args.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { t: 'show', kind: 'place', data: { label: String(map.args.place ?? '').slice(0, 80), lat, lon, screen: true } };
  }
  // a thing his own screens take (the Studio, the editor): nothing more to draw
  if (t.clients.some((c) => c.name === 'open_studio' || c.name === 'open_docs')) return null;
  // a problem the shared solver reads in his words
  const p = parseProblem(ask);
  if (p && (p.kind === 'projectile' || p.kind === 'fall' || p.kind === 'orbit') && (p.filled.length || /\b(?:throw|thrown|kick|kicked|fire|fired|launch|launched|drop|dropped|fall|falling|orbit)\b/i.test(ask))) return { t: 'show', kind: 'formula', data: { problem: p.kind } };
  // a part (or a room with parts in it) he asked to see, by its name
  const low = ask.toLowerCase();
  if (MAKE.test(low) && !NOT.test(low)) {
    const found = PARTS.filter(([, re]) => re.test(low)).map(([kind]) => kind);
    if (ROOM.test(low) && found.length) return { t: 'show', kind: 'part', data: { room: true, things: found } };
    if (found.length) return { t: 'show', kind: 'part', data: { room: false, things: found.slice(0, 1) } };
  }
  // a letter or a plan, laid out as a page
  const write = WRITE.exec(ask)?.[1]?.toLowerCase();
  if (reply.length > 60 && (write || (PLAN_ASK.test(ask) && PLAN_VERB.test(ask) && (liney(reply) >= 3 || reply.length > 400)))) return { t: 'show', kind: 'document', data: { letter: !!write && /letter|email|e-mail|complaint|appeal|application|reference/.test(write) } };
  // figures the reply itself wrote
  const series = seriesFrom(reply);
  if (series) return { t: 'show', kind: 'numbers', data: { points: series.points, line: series.kind === 'line', unit: series.unit, before: series.before } };
  return null;
}
