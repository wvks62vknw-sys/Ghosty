/**
 * WHAT TO SHOW (BRIEF-SHOW-ME-1; STARS 164, "it pulls it up immediately and I see it"): from his words, the reply's words and the
 * tool results and screen commands the phone already received this turn, which thing (if any) the Machine puts on the Stage. By
 * code, never by asking a model; pure, so a check can ask it anything. The `Show` protocol's `stage` variant (BRIEF-AWARENESS)
 * stays defined and unused: this is the interface-side route.
 *
 * A thing is shown only when the data for it is there: a place the phone can place (a saved place, a city of the world pack), six
 * figures the reply itself wrote, a room's size and what is in it, a problem the workbench can solve. Nothing is made up for a
 * picture, no one is ever predicted, and a person's name is never a place.
 */
import type { Card } from '../../../../packages/shared/src/cards';
import { docFromReply, writeAsked } from '../docs/model';
import { seriesFrom, type Series } from './chart';
import { partAsked, roomAsked, type PartAsk, type RoomAsk } from './parts';
import { simFrom, type Sim } from './sim';

/** What the phone has of this turn. */
export interface ShowFacts {
  ask: string;
  /** The reply's words, whole. */
  reply: string;
  /** Tools the turn ran. */
  tools: { name: string; args: Record<string, unknown> }[];
  /** Screen commands the brain sent (show_map, show_route, show_journey, open_studio …): their own screens already took them. */
  clients: { name: string; args: Record<string, unknown> }[];
  cards: Card[];
  /** His saved places. */
  places: { label: string; lat: number; lon: number }[];
  /** A city of the world pack, by name (the phone's own gazetteer; null when none is meant). */
  city?: (name: string) => { name: string; lat: number; lon: number; country: string } | null;
  /** A saved place his words named in passing ("how far is Nan's?": the trigger table's own reading). */
  mentioned?: { label: string; lat: number; lon: number };
  /** When the reply was written (its chat time): the document's OPEN reads the reply by it. */
  replyAt?: number;
  /** His name, for a letter. */
  me?: { name?: string };
  /** The brain's own pick of the picture (a `show` event, BRIEF-KERNEL-YES 4): preferred over this file's own reading when it holds. */
  brain?: { kind: string; data: Record<string, unknown> };
}

export type ShowKind = 'map' | 'eye' | 'journey' | 'chart' | 'document' | 'simulation' | 'room' | 'part';

interface Base {
  kind: ShowKind;
  /** A steady id for the same thing. */
  id: string;
  /** The tag's words after SHOWING: "CHART", "MAP"… */
  tag: string;
  title: string;
  /** The truth line's segments: what it is made from. */
  truth: string[];
}
export type Show =
  | (Base & { kind: 'map'; lat: number; lon: number; label: string; zoom: number; via?: 'its screen' })
  | (Base & { kind: 'eye'; lat: number; lon: number; label: string })
  | (Base & { kind: 'journey'; via: 'its screen' })
  | (Base & { kind: 'chart'; series: Series })
  | (Base & { kind: 'document'; paragraphs: { t: string; text: string }[]; ask: string; replyAt?: number })
  | (Base & { kind: 'simulation'; sim: Sim })
  | (Base & { kind: 'room' | 'part'; room?: RoomAsk; part?: PartAsk });

const said = (text: string) => String(text ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/^(?:(?:hey|hi|so|ok|okay|oi|and|but|ghosty|mate|please|can you|could you)[,!]?\s+)*/, '').replace(/[\s?!.]+$/, '').replace(/\s+/g, ' ').trim();

/** "where is Lisbon", "show me Tokyo on the map", "take me to Paris", "map of Leeds": the place named, or null. */
export function placeAsked(ask: string): { name: string; map: boolean } | null {
  const t = said(ask);
  const m = /^(?:where(?:'s| is| are)|show me|take me to|find|locate|map of|put|fly me to|go to)\s+(?:the\s+)?(?:my\s+)?(.+?)(?:\s+on (?:the )?(?:map|globe|earth|god'?s eye))?$/.exec(t);
  if (!m) return null;
  const name = m[1]!.replace(/^(?:a|an|some|any|that|this|those|these|it|them|me|my)\b\s*/, '').trim();
  if (!name || name.split(' ').length > 3 || /\b(?:desk|table|bed|sofa|room|chart|graph|letter|plan|shelf|wardrobe|journey|route|numbers?|spending|how|why|what|when|who|best)\b/.test(name)) return null;
  return { name, map: /\bmap\b/.test(t) };
}

const PLAN_ASK = /\b(?:plan|itinerary|timetable|schedule|checklist|agenda|menu|routine|revision plan|meal plan)\b/i;
const PLAN_VERB = /\b(?:make|write|draft|create|build|give|put together|plan|prepare|set up|come up with)\b/i;

/** The reply laid out as the paragraphs of a page: a heading, text, list items (the document editor's own reading, docs/model). */
function paragraphsOf(reply: string, ask: string, name?: string): { title: string; list: { t: string; text: string }[] } {
  const doc = docFromReply(reply, ask, { name });
  return { title: doc.title, list: doc.blocks.slice(0, 14).map((b) => ({ t: b.t, text: b.runs.map((r) => r.text).join('') })).filter((b) => b.text.trim()) };
}

const liney = (reply: string) => reply.split('\n').filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+\S/.test(l)).length;

const simShow = (sim: Sim): Show => ({ kind: 'simulation', id: `sim:${sim.kind}:${sim.title}`, tag: 'SIMULATION', title: sim.title, truth: ['FIRST ESTIMATE', 'NOT CERTIFIED', sim.kind === 'orbit' ? 'TWO-BODY ORBIT' : 'STILL AIR, ONE POINT MASS'], sim });
const roomShow = (room: RoomAsk): Show => ({ kind: 'room', id: `room:${room.w}x${room.d}:${room.things.map((t) => t.kind + t.n).join('')}`, tag: 'ROOM', title: `Room ${room.w / 100} × ${room.d / 100} m`, truth: [room.sized ? 'YOUR SIZE' : 'SIZE ASSUMED 4 × 3 m', 'BUILT FROM PARAMETERS', 'NO FREE TEXT-TO-3D'], room });
const partShow = (part: PartAsk): Show => ({ kind: 'part', id: `part:${part.kind}:${part.dims.w}x${part.dims.d}x${part.dims.h}`, tag: 'PART', title: `${part.name} ${part.dims.w} × ${part.dims.d} × ${part.dims.h} cm`, truth: [part.given.length ? `${part.given.length === 3 ? 'ALL' : part.given.length} OF 3 SIZES YOURS` : 'DEFAULT SIZE', 'BUILT FROM PARAMETERS', 'NO FREE TEXT-TO-3D'], part });
const chartShow = (ask: string, series: Series): Show => ({ kind: 'chart', id: `chart:${series.points.map((p) => p.label).join('|')}`, tag: 'CHART', title: ask.length > 44 ? `${ask.slice(0, 41).replace(/\s+\S*$/, '')}…` : ask.replace(/[?.!]+$/, ''), truth: [`${series.points.length} NUMBERS FROM THE ANSWER`, series.kind === 'line' ? 'IN TIME ORDER' : 'AS BARS'], series });
function docShow(f: ShowFacts, letter: boolean): Show | null {
  const { title, list: paragraphs } = paragraphsOf(f.reply.trim(), f.ask.trim(), f.me?.name);
  return paragraphs.length >= 2 ? { kind: 'document', id: `doc:${f.replyAt ?? f.ask.trim().slice(0, 20)}`, tag: letter ? 'LETTER' : 'DOCUMENT', title: title.slice(0, 60), truth: ['YOUR WORDS, LAID OUT', 'EDIT AND SAVE AS PDF OR WORD'], paragraphs, ask: f.ask.trim(), replyAt: f.replyAt } : null;
}

/**
 * The brain's own pick (a `show` event): the kind it named, drawn from what it sent where that is the data (a place, the figures) and
 * from the reply and his words where the data is the reply's own (a letter, a problem, a part). null when what it sent cannot be
 * drawn here (a bad number, a part not in the table): the phone's own reading then decides, as it always did.
 */
export function brainPick(f: ShowFacts): Show | null {
  const b = f.brain;
  if (!b || !f.ask.trim()) return null;
  const d = b.data ?? {};
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  switch (b.kind) {
    case 'route':
      return { kind: 'journey', id: 'journey:brain', tag: 'JOURNEY', title: 'The journey', truth: ['DRAWN ON ITS OWN SCREEN'], via: 'its screen' };
    case 'place': {
      const lat = num(d.lat);
      const lon = num(d.lon);
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
      const label = String(d.label ?? '').trim().slice(0, 80) || 'The place';
      if (d.screen === true) return { kind: 'map', id: `map:${label}`, tag: 'MAP', title: label, truth: ['ON ITS OWN SCREEN'], lat, lon, label, zoom: 15, via: 'its screen' };
      if (d.globe === true) return { kind: 'eye', id: `eye:${label}`, tag: "GOD'S EYE", title: label, truth: ['CHOSEN BY THE BRAIN', 'LAND AND CITIES'], lat, lon, label };
      return { kind: 'map', id: `map:${label}`, tag: 'MAP', title: label, truth: ['CHOSEN BY THE BRAIN', 'OPENSTREETMAP'], lat, lon, label, zoom: num(d.zoom) ?? 11 };
    }
    case 'numbers': {
      const pts = Array.isArray(d.points) ? (d.points as unknown[]).map((p) => p as { label?: unknown; value?: unknown }).filter((p) => typeof p.label === 'string' && num(p.value) !== null).slice(0, 12) : [];
      if (pts.length < 3) return null;
      const unit = typeof d.unit === 'string' ? d.unit.slice(0, 6) : '';
      return chartShow(f.ask.trim(), { kind: d.line === true ? 'line' : 'bars', points: pts.map((p) => ({ label: String(p.label).slice(0, 24), value: p.value as number })), unit, before: d.before === true });
    }
    case 'document':
      return docShow(f, d.letter === true);
    case 'formula': {
      const sim = simFrom(f.ask.trim());
      return sim ? simShow(sim) : null;
    }
    case 'part': {
      if (d.room === true) {
        const room = roomAsked(f.ask.trim());
        return room ? roomShow(room) : null;
      }
      const part = partAsked(f.ask.trim());
      return part ? partShow(part) : null;
    }
  }
  return null;
}

/** The one thing to put on the Stage for this turn, or null. */
export function decideShow(f: ShowFacts): Show | null {
  const ask = f.ask.trim();
  const reply = f.reply.trim();
  if (!ask) return null;
  // the brain's own pick comes first; the phone's own reading below is the fallback
  const picked = brainPick(f);
  if (picked) return picked;
  // a thing the brain's own tools already put on its own screen: the screen is the picture (show_route and show_journey take
  // it, as they always have); the Stage does not draw it a second time
  const route = f.clients.find((c) => c.name === 'show_journey' || c.name === 'show_route');
  if (route) return { kind: 'journey', id: `journey:${route.name}`, tag: 'JOURNEY', title: 'The journey', truth: ['DRAWN ON ITS OWN SCREEN'], via: 'its screen' };
  const shownMap = f.clients.find((c) => c.name === 'show_map');
  if (shownMap) return { kind: 'map', id: `map:${String(shownMap.args.place ?? '')}`, tag: 'MAP', title: String(shownMap.args.place ?? 'The map'), truth: ['ON ITS OWN SCREEN'], lat: Number(shownMap.args.lat) || 0, lon: Number(shownMap.args.lon) || 0, label: String(shownMap.args.place ?? ''), zoom: 15, via: 'its screen' };
  if (f.clients.some((c) => c.name === 'open_studio' || c.name === 'open_docs')) return null;

  // a formula: the problem is in his words and the solver has an answer
  const sim = simFrom(ask);
  if (sim) return simShow(sim);

  // a room or a part, built from parameters
  const room = roomAsked(ask);
  if (room) return roomShow(room);
  const part = partAsked(ask);
  if (part) return partShow(part);

  // a plan or a letter: the reply laid out as a page
  const write = writeAsked(ask);
  if (reply.length > 60 && (write || (PLAN_ASK.test(ask) && PLAN_VERB.test(ask) && (liney(reply) >= 3 || reply.length > 400)))) {
    const doc = docShow(f, !!write && /letter|email|e-mail|complaint|appeal|application|reference/.test(write));
    if (doc) return doc;
  }

  // a place: a saved place named in passing, by its name, or a city of the world pack
  if (f.mentioned) return { kind: 'map', id: `map:${f.mentioned.label}`, tag: 'MAP', title: f.mentioned.label, truth: ['A PLACE YOU SAVED', 'OPENSTREETMAP'], lat: f.mentioned.lat, lon: f.mentioned.lon, label: f.mentioned.label, zoom: 15 };
  const pa = placeAsked(ask);
  if (pa) {
    const saved = f.places.find((p) => p.label.toLowerCase() === pa.name || pa.name === `${p.label.toLowerCase()}'s`);
    if (saved) return { kind: 'map', id: `map:${saved.label}`, tag: 'MAP', title: saved.label, truth: ['A PLACE YOU SAVED', 'OPENSTREETMAP'], lat: saved.lat, lon: saved.lon, label: saved.label, zoom: 15 };
    const city = f.city?.(pa.name);
    if (city) {
      if (pa.map) return { kind: 'map', id: `map:${city.name}`, tag: 'MAP', title: city.name, truth: ['A CITY OF THE WORLD PACK', 'OPENSTREETMAP'], lat: city.lat, lon: city.lon, label: city.name, zoom: 11 };
      return { kind: 'eye', id: `eye:${city.name}`, tag: "GOD'S EYE", title: city.name, truth: ['THE WORLD PACK ON THIS PHONE', 'LAND AND CITIES'], lat: city.lat, lon: city.lon, label: city.name };
    }
  }

  // numbers: three label-and-number pairs the reply itself wrote
  const series = reply ? seriesFrom(reply) : null;
  if (series) return chartShow(ask, series);
  return null;
}
