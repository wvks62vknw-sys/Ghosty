/**
 * THE WALL (BRIEF-MACHINE-WALL; STARS 165): a second screen of the same Ghosty, a television or a laptop that shows what his phone
 * is talking about, with nothing to touch on it. Shared by the phone, the wall and the brain (apps/edge/src/wall.ts), so the three
 * agree on one list of what may go to the wall, one reading of what a picture's data may hold, and the words each side says.
 *
 * What goes is the same data the Stage draws from (a kind and its numbers, never a picture of the screen, never a camera frame).
 * What never goes: a camera, the Lens's frames, a face, a stranger, a live position (a place is a named saved place or a public
 * place), a spending line, the text of another person's message, a notification's body. A kind off the list is refused, on the
 * phone and again by the brain: `wallCheck` is the one gate both use.
 */

/** The code's letters: letters only and no look-alikes (no I, L, O, B or S), so it is read off a screen across a room. */
export const WALL_LETTERS = 'ACDEFGHJKMNPQRTUVWXYZ';
export const CODE_LENGTH = 6;
/** A code is new every two minutes until it is used. */
export const CODE_LIFE = 2 * 60_000;
/** Three wrong codes in a row, and the phone waits a minute. */
export const WRONG_MAX = 3;
export const WRONG_WAIT = 60_000;
/** The pairing is kept until LEAVE on either side, or this long. */
export const PAIR_LIFE = 30 * 24 * 3_600_000;
/** The wall rests when the phone has been silent this long. */
export const SILENCE = 3_600_000;
/** What a picture's data may weigh, as JSON. */
export const MAX_DATA = 24_000;

/** The kinds the wall draws. Everything else stays on the phone. */
/** A length unit the picture can write its sizes in; anything else is the given default. */
const unitOf = (u: unknown, dflt: 'm' | 'cm'): 'mm' | 'cm' | 'm' | 'ft' | 'in' => (u === 'mm' || u === 'cm' || u === 'm' || u === 'ft' || u === 'in' ? u : dflt);

export const WALL_KINDS = ['chart', 'map', 'place', 'document', 'room', 'part', 'car', 'waveform', 'plan', 'thing'] as const;
export type WallKind = (typeof WALL_KINDS)[number];

/** Every word the wall and its phone page say, in one place (his voice, one sentence a screen). */
export const WALL_SAYS = {
  iam: 'I am the wall.',
  how: 'On your phone: Settings, THE WALL, PAIR.',
  paired: 'Paired with your phone.',
  lost: 'I lost my brain. The phone’s picture will come back when it does.',
  stays: 'That stays on the phone.',
  none: 'No wall right now',
  noPair: 'No wall is paired yet: Settings, THE WALL, PAIR.',
  offline: 'I can’t reach my brain, so there’s no pairing now. Try again when it’s back.',
  sent: 'On the wall.',
  cleared: 'The wall is resting.',
  nothing: 'I have nothing to put on the wall yet.',
  left: 'The wall is unpaired.',
  wrong: 'That isn’t the wall’s code.',
  wait: 'Three wrong codes. Wait a minute, then try again.',
  signin: 'I need your key on this screen first: open Ghosty here and sign in, then come back.',
} as const;

/** A code's letters in a row: "KPQ TRM" is typed as "kpqtrm" (case and spaces never matter). */
export const cleanCode = (s: string): string => s.toUpperCase().replace(/[^A-Z]/g, '');
export const codeOk = (s: string): boolean => cleanCode(s).length === CODE_LENGTH && [...cleanCode(s)].every((c) => WALL_LETTERS.includes(c));
/** A code made from random bytes (the brain's own, never Math.random). */
export function codeFrom(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += WALL_LETTERS[bytes[i]! % WALL_LETTERS.length];
  return out;
}
/** "pair the wall, KPQTRM" / "pair the wall KPQ TRM": the code he said or typed, or null. */
export function pairSaid(text: string): string | null {
  const m = /^\s*(?:hey\s+|ok(?:ay)?\s+)?(?:ghosty[, ]+)?pair(?: with)?(?: the| my)?\s+wall[\s,:.-]*([a-z](?:[\s-]?[a-z]){5})\s*[.!]?\s*$/i.exec(text);
  const code = m ? cleanCode(m[1]!) : '';
  return code.length === CODE_LENGTH ? code : null;
}

/** What the wall shows, as it comes down the stream. */
export interface WallPicture {
  kind: WallKind;
  data: Record<string, unknown>;
  /** The one sentence the picture answers, along the foot. */
  sentence: string;
  at: number;
}
/** One answer of the brain's stream to a wall. */
export interface WallFrame {
  /** Moves each time anything about this wall changes: the long poll answers when it differs from the one asked about. */
  seq: number;
  state: 'unpaired' | 'paired';
  /** Unpaired: the code on screen now and when it runs out. */
  code?: string;
  expires?: number;
  /** Paired: since when, and the picture (null: resting). */
  since?: number;
  picture?: WallPicture | null;
  /** The pair's id: both sides carry it. */
  pair?: string;
}
/** What the phone's THE WALL page reads. */
export interface WallInfo {
  paired: boolean;
  /** The pair's id, which the phone carries with each picture it sends. */
  pair?: string;
  since?: number;
  expires?: number;
  /** The kind and sentence on the wall now (never the data), or null when it rests. */
  showing?: { kind: WallKind; sentence: string; at: number } | null;
  /** Set when a wrong code was typed too often: when to try again. */
  retryAt?: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
/** Keys that only a camera, a face or a screenshot would carry: never allowed anywhere inside a picture's data. */
const NEVER_KEY = /^(?:frame|image|img|photo|picture|screenshot|face|faces|descriptor|embedding|stranger|person|people|camera|jpeg|jpg|png|dataurl|base64|blob|gps|position|pos|heading|accuracy|message|messages|body|notification|spending|statement|transaction|transactions|balance|account|iban)$/i;
const NEVER_VALUE = /^data:(?:image|video|audio)\//i;

/** Walks a picture's data for anything that must never reach the wall. Returns what it found, or ''. */
function forbidden(v: unknown, depth = 0): string {
  if (depth > 6) return 'too deep';
  if (typeof v === 'string') return NEVER_VALUE.test(v) ? 'a picture of the screen' : '';
  if (Array.isArray(v)) {
    for (const x of v) {
      const f = forbidden(x, depth + 1);
      if (f) return f;
    }
    return '';
  }
  if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (NEVER_KEY.test(k)) return k;
      const f = forbidden(x, depth + 1);
      if (f) return f;
    }
  }
  return '';
}

export type WallVerdict = { ok: true; kind: WallKind; data: Record<string, unknown> } | { ok: false; why: string };

const refuse = (why: string): WallVerdict => ({ ok: false, why });

/**
 * The one gate: a kind on the list, its data drawn only from what that kind needs (anything else is dropped), nothing a camera,
 * a face, a live position, a spending line or another person's words could ride in on. Used by the phone before it sends and by
 * the brain before it keeps. A refusal is said as WALL_SAYS.stays.
 */
export function wallCheck(kind: unknown, data: unknown): WallVerdict {
  if (typeof kind !== 'string' || !(WALL_KINDS as readonly string[]).includes(kind)) return refuse('a kind that stays on the phone');
  if (!isObj(data)) return refuse('no data');
  const bad = forbidden(data);
  if (bad) return refuse(`never on the wall: ${bad}`);
  if (JSON.stringify(data).length > MAX_DATA) return refuse('too big');
  const k = kind as WallKind;
  switch (k) {
    case 'chart': {
      const s = isObj(data.series) ? data.series : null;
      const pts = Array.isArray(s?.points) ? (s!.points as unknown[]) : [];
      const points = pts.filter(isObj).map((p) => ({ label: str(p.label, 24), value: num(p.value) })).filter((p): p is { label: string; value: number } => p.value !== null && !!p.label).slice(0, 24);
      if (points.length < 2) return refuse('no numbers');
      return { ok: true, kind: k, data: { series: { kind: s!.kind === 'line' ? 'line' : 'bars', points, unit: str(s!.unit, 6), before: s!.before === true }, title: str(data.title, 80) } };
    }
    case 'map':
    case 'place': {
      const lat = num(data.lat);
      const lon = num(data.lon);
      const label = str(data.label, 60);
      // a place is a named one: saved, or public. A bare point is never sent (it could be where he stands).
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !label) return refuse('no named place');
      return { ok: true, kind: k, data: { lat, lon, label, zoom: Math.max(3, Math.min(17, Math.round(num(data.zoom) ?? 11))) } };
    }
    case 'document':
    case 'plan': {
      const ps = Array.isArray(data.paragraphs) ? data.paragraphs.filter(isObj).map((p) => ({ t: ['h1', 'h2', 'h3', 'ul', 'ol'].includes(String(p.t)) ? String(p.t) : 'p', text: str(p.text, 400) })).filter((p) => p.text).slice(0, 30) : [];
      if (ps.length < 1) return refuse('no words');
      return { ok: true, kind: k, data: { title: str(data.title, 80) || 'Document', paragraphs: ps } };
    }
    case 'room': {
      // (the unit he used, one of five, for the sizes written on the picture's edges; anything else is not sent)
      const r = isObj(data.room) ? data.room : null;
      const w = num(r?.w);
      const d = num(r?.d);
      if (!r || w === null || d === null || w < 100 || d < 100 || w > 2000 || d > 2000) return refuse('no room');
      const things = Array.isArray(r.things) ? r.things.filter(isObj).map((t) => ({ kind: str(t.kind, 12), n: Math.max(1, Math.min(9, Math.round(num(t.n) ?? 1))) })).filter((t) => t.kind).slice(0, 10) : [];
      return { ok: true, kind: k, data: { room: { w, d, things, sized: r.sized === true, unit: unitOf(r.unit, 'm') }, title: str(data.title, 80) } };
    }
    case 'part': {
      const p = isObj(data.part) ? data.part : null;
      const dm = isObj(p?.dims) ? p!.dims : null;
      const [w, d, h] = [num(dm?.w), num(dm?.d), num(dm?.h)];
      if (!p || !str(p.kind, 12) || w === null || d === null || h === null || [w, d, h].some((x) => x! < 1 || x! > 1000)) return refuse('no part');
      return { ok: true, kind: k, data: { part: { kind: str(p.kind, 12), name: str(p.name, 40), dims: { w, d, h }, unit: unitOf(p.unit, 'cm') }, title: str(data.title, 80) } };
    }
    case 'car': {
      const name = str(data.name, 40);
      if (!name) return refuse('no car');
      return { ok: true, kind: k, data: { name, lines: (Array.isArray(data.lines) ? data.lines : []).map((l) => str(l, 60)).filter(Boolean).slice(0, 6) } };
    }
    case 'waveform': {
      const peaks = (Array.isArray(data.peaks) ? data.peaks : []).map(num).filter((x): x is number => x !== null).slice(0, 240).map((x) => Math.max(0, Math.min(1, x)));
      if (peaks.length < 8) return refuse('no tune');
      return { ok: true, kind: k, data: { title: str(data.title, 80) || 'The tune', peaks } };
    }
    case 'thing': {
      const name = str(data.name, 60);
      if (!name) return refuse('no name');
      return { ok: true, kind: k, data: { name } };
    }
  }
}

/** The one sentence along the foot: the first sentence of the reply, in one line (never more than 140 letters). */
export function footSentence(reply: string, fallback = ''): string {
  const t = reply.replace(/\s+/g, ' ').replace(/[*_`#>]/g, '').trim();
  const m = /^.{12,}?[.!?](?=\s|$)/.exec(t);
  const s = (m ? m[0] : t) || fallback;
  return s.length > 140 ? `${s.slice(0, 137).replace(/\s+\S*$/, '')}…` : s;
}

/** "on the wall" said alone ("show that on the wall", "put it on the wall", "on the wall", "wall"). */
export const onWallAlone = (text: string): boolean => /^\s*(?:(?:ok(?:ay)?|hey|please|ghosty)[,!]?\s+)*(?:(?:show|put|send|throw|cast|bring|move|display)\s+(?:that|this|it|the picture|the map|the chart)\s+)?(?:up\s+)?on(?: to)?(?: the)? wall\s*[.!]?\s*$/i.test(text);
/** "where is Lisbon, on the wall": the ask with that tail taken off, or null. */
export function onWallSuffix(text: string): string | null {
  const m = /^(.*\S)[\s,]+(?:and\s+)?(?:(?:show|put|send)\s+(?:it|that|this)\s+)?on(?: to)?(?: the)? wall\s*[.!?]*$/i.exec(text);
  return m && !onWallAlone(text) ? m[1]!.replace(/[\s,]+$/, '') : null;
}
/** "clear the wall", "wall off", "wall away": rest it. */
export const wallOffSaid = (text: string): boolean => /^\s*(?:(?:ok(?:ay)?|hey|please|ghosty)[,!]?\s+)*(?:(?:clear|rest|blank|empty|turn off|switch off|shut off)\s+(?:the )?wall|wall\s+(?:off|away|clear|rest)|take (?:it|that|everything) off the wall)\s*[.!]?\s*$/i.test(text);
