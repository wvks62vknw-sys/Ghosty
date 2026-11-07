/**
 * THE ONE LENS's brain, pure (BRIEF-LENS; the owner's budgets, OWNER-ISSUES 131: "cheap detectors every frame, heavy ones on a
 * steady frame, two seconds per tag, 'I see text — tap to read it'"). No camera and no DOM, so the brain bundle tests it in Node
 * (apps/edge/test/lens.test.mjs) and the Lens (features/lens/one.ts) only does the drawing.
 *
 *   TAG_ACTS        what each kind of tag offers under it, as a table (the keys, their words, who needs the brain)
 *   textTiles()     the "text present" check: stroke-like edge density in tiles of a shrunk grey frame. It never says WHAT the
 *                   text is: only that there is some, and where.
 *   Steady          the frame-difference rule: a frame is steady when it has differed from the last by under STEADY_DIFF for
 *                   STEADY_MS; the heavy detectors (the namer, the object finder, a part) run only then, one at a time.
 *   Tags            the tags on screen: each lives TAG_LIFE_MS after its last sighting, then fades; a sighting under its
 *                   detector's floor makes none.
 *   contextWords()  what the Lens tells the brain about its tags: counts and kinds, never who.
 */
import type { Box } from './boxes';
import { iou } from './boxes';

/** The tags the one view can put on a thing. `face` is a face he knows; `stranger` one nobody introduced (no name, no act). */
export type TagKind = 'text' | 'code' | 'face' | 'stranger' | 'object';
export type ActId = 'read' | 'translate' | 'look' | 'nameit' | 'findpart' | 'ask' | 'measure';

export interface TagAct {
  id: ActId;
  /** The key's word (capitals are drawn by the key). */
  word: string;
  /** What VoiceOver hears. */
  name: string;
  /** Sends words or a picture to the brain on this tap: greyed with no signal. */
  brain?: boolean;
}

const A = (id: ActId, word: string, name: string, brain = false): TagAct => ({ id, word, name, ...(brain ? { brain } : {}) });

/**
 * Each kind of tag and the acts it offers under it (the first is the one the tag itself does when tapped). A face he knows or a
 * stranger offers none: a face never leaves the phone, so there is nothing to ask about it and no one to look up.
 */
export const TAG_ACTS: Record<TagKind, TagAct[]> = {
  text: [A('read', 'READ', 'Read this text into the library'), A('translate', 'TRANSLATE', 'Translate this text', true), A('ask', 'ASK', 'Ask about this with the picture', true)],
  code: [A('look', 'LOOK', 'Look at this code'), A('ask', 'ASK', 'Ask about this with the picture', true)],
  face: [],
  stranger: [],
  object: [A('nameit', 'NAME IT', 'Name this'), A('ask', 'ASK', 'Ask about this with the picture', true), A('measure', 'MEASURE', 'Measure this')],
};

/** A part (a wheel, a filter…) also offers FIND THE PART, in front of ASK. */
export const FIND_PART = A('findpart', 'FIND THE PART', 'Find this part in UK shops', true);

/** The acts a tag offers now: its kind's, with FIND THE PART for a part, and the second key only where its input is present. */
export function actsFor(kind: TagKind, o: { part?: boolean; named?: boolean; foreignText?: boolean; still?: boolean } = {}): TagAct[] {
  const base = TAG_ACTS[kind];
  if (kind === 'object') {
    // NAME IT and MEASURE only mean something once there is a name / a picture to measure from
    const out = base.filter((a) => (a.id !== 'nameit' || o.named) && (a.id !== 'measure' || o.still !== false));
    return o.part ? [out[0]!, FIND_PART, ...out.slice(1)].filter((a): a is TagAct => !!a) : out;
  }
  return base;
}

/** What a tag says it is, in the Machine's tag (capitals are drawn): one or two words. */
export const KIND_WORD: Record<TagKind, string> = { text: 'text', code: 'code', face: 'face', stranger: 'face', object: 'object' };

/** How a kind is said in the context line (counts and kinds, never who). */
export const KIND_SAID: Record<TagKind, string> = { text: 'text', code: 'a code', face: 'someone I know', stranger: 'someone I don’t know', object: 'an object' };

// ---------------------------------------------------------------- the time a tag lives

/** A tag lives this long after its last sighting, then fades (the Machine's turn). */
export const TAG_LIFE_MS = 2000;

/** A sighting: what a detector saw, where (frame pixels), and how sure it is (0–1). */
export interface Sighting {
  kind: TagKind;
  box: Box;
  score: number;
  /** The words under the tag ("I see text — tap to read it", "looks like a mug"). */
  truth: string;
  /** Kind-specific: a code's text and format, a face's label (never sent anywhere), an object's name. */
  data?: { text?: string; format?: string; codeKind?: string; label?: string; part?: boolean; named?: boolean };
  /** The heavy passes see a thing once and it stays while the frame stays as steady as it was then: the steady epoch they saw it in. */
  hold?: number;
}

export interface Tag extends Sighting {
  id: number;
  /** When it was last seen (ms). */
  seen: number;
  /** When it first appeared (ms). */
  born: number;
}

/** The floor under which a detector's sighting makes no tag: it is never a guess. */
export const FLOOR: Record<TagKind, number> = { text: 0.35, code: 0.5, face: 0.6, stranger: 0.6, object: 0.45 };

/** Does this sighting reach its detector's floor? */
export const sure = (s: Sighting): boolean => s.score >= FLOOR[s.kind] && s.box.w > 0 && s.box.h > 0;

export class Tags {
  private list: Tag[] = [];
  private next = 1;
  /** Tags that have come and gone, for the checks. */
  faded = 0;

  /**
   * Take the sightings of one pass at `now`: each one refreshes the tag of its kind it overlaps (so a tag stays one tag while
   * the phone shakes) or makes a new one; none under its floor does anything. Returns the tags that were born in this call.
   */
  see(sightings: Sighting[], now: number): Tag[] {
    const born: Tag[] = [];
    for (const s of sightings) {
      if (!sure(s)) continue;
      const same = this.list.find((t) => t.kind === s.kind && (s.kind === 'code' && s.data?.text ? t.data?.text === s.data.text : iou(t.box, s.box) > 0.25));
      if (same) {
        // the box follows the thing, a little smoothed; the words are the newest
        same.box = same.kind === 'text' || same.kind === 'object' ? smooth(same.box, s.box) : s.box;
        same.score = Math.max(s.score, same.score * 0.9);
        same.truth = s.truth;
        same.data = { ...same.data, ...s.data };
        same.hold = s.hold;
        same.seen = now;
        continue;
      }
      const t: Tag = { ...s, id: this.next++, seen: now, born: now };
      this.list.push(t);
      born.push(t);
    }
    return born;
  }

  /**
   * Keep what the heavy passes saw alive while the frame stays in the stretch of stillness they saw it in (it has not moved, so the
   * thing is still there). A new stretch (the phone moved, then held again, or something covered the lens) keeps nothing: what is
   * still there is seen again, and the rest fades.
   */
  keep(epoch: number, steady: boolean, now: number): void {
    if (!steady) return;
    for (const t of this.list) if (t.hold !== undefined && t.hold === epoch) t.seen = now;
  }

  /** The tags standing at `now`; those unseen for TAG_LIFE_MS go. */
  alive(now: number): Tag[] {
    const n = this.list.length;
    this.list = this.list.filter((t) => now - t.seen < TAG_LIFE_MS);
    this.faded += n - this.list.length;
    return this.list;
  }

  /** How faded a tag is at `now` (0 fresh … 1 gone): the last quarter of its life is a fade. */
  fade(t: Tag, now: number): number {
    const age = now - t.seen;
    const from = TAG_LIFE_MS * 0.75;
    return age <= from ? 0 : Math.min(1, (age - from) / (TAG_LIFE_MS - from));
  }

  /** Take away the tags `pred` picks (a code found where the text check had seen print: it is the code). */
  drop(pred: (t: Tag) => boolean): void {
    this.list = this.list.filter((t) => !pred(t));
  }

  byId(id: number): Tag | undefined {
    return this.list.find((t) => t.id === id);
  }

  clear(): void {
    this.list = [];
  }
}

function smooth(a: Box, b: Box): Box {
  const k = 0.5;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k };
}

/**
 * The line the Lens tells the brain about what it tags (BRIEF-AWARENESS: counts, never who): "3 tags: text, a code, someone I
 * know". Each kind once, in the order text, code, object, then faces; a known face and a stranger are never named.
 */
export function contextWords(tags: { kind: TagKind }[]): string {
  if (!tags.length) return 'no tags yet';
  const order: TagKind[] = ['text', 'code', 'object', 'face', 'stranger'];
  const kinds = order.filter((k) => tags.some((t) => t.kind === k));
  const n = tags.length;
  return `${n} ${n === 1 ? 'tag' : 'tags'}: ${kinds.map((k) => KIND_SAID[k]).join(', ')}`;
}

// ---------------------------------------------------------------- the "text present" check

/** The grey frame the cheap pass works on: 8-bit grey, `w` × `h`. */
export interface Grey {
  data: Uint8Array | Uint8ClampedArray;
  w: number;
  h: number;
}

/** Grey from RGBA pixels (the integer luma; what the phone's canvas gives). */
export function greyOf(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Grey {
  const out = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = (rgba[p]! * 77 + rgba[p + 1]! * 150 + rgba[p + 2]! * 29) >> 8;
  return { data: out, w, h };
}

/** A tile is TILE × TILE pixels of the shrunk frame. */
export const TILE = 8;
/** The step between neighbouring pixels that counts as a stroke edge (of 255). */
const EDGE = 40;
/**
 * A tile is "text-like" when this fraction of its pixels sit on a stroke edge: print is a lot of thin strokes (about 15–40%);
 * a flat wall, a sky or a large shape has almost none, and sensor noise or a fine texture has them nearly everywhere.
 */
const DENSITY_LO = 0.1;
const DENSITY_HI = 0.5;
/** And strokes run both ways: at least this many in each direction in a tile (print has verticals and horizontals; a plain edge, a blob's outline or a stripe pattern does not). */
const PAIRS = 1;
/** A stroke's two edges are at most this many pixels apart. */
const STROKE = 4;
/** At least this many neighbouring text-like tiles make a block of text (one tile is a speck). */
const MIN_TILES = 5;

export interface TextBlock {
  /** In the grey frame's pixels. */
  box: Box;
  /** 0–1: how much of its box is text-like. */
  score: number;
  tiles: number;
}

/**
 * Where there is text in a shrunk grey frame, as blocks (the biggest first). Cheap on purpose: one pass over the pixels (two
 * differences each), then the tiles grouped. It NEVER names the text.
 */
export function textTiles(g: Grey): TextBlock[] {
  const tx = Math.floor(g.w / TILE);
  const ty = Math.floor(g.h / TILE);
  if (tx < 3 || ty < 3) return [];
  const hit = new Uint8Array(tx * ty);
  const d = g.data;
  const n = (TILE - 1) * (TILE - 1);
  for (let j = 0; j < ty; j++) {
    for (let i = 0; i < tx; i++) {
      let edges = 0;
      // a stroke is two edges of opposite sign a pixel or two apart (a dark line on light, or the reverse); a blob's outline is one edge
      let pairsH = 0;
      let pairsV = 0;
      const col = new Int8Array(TILE);
      const colAt = new Int8Array(TILE);
      for (let y = 0; y < TILE - 1; y++) {
        let p = (j * TILE + y) * g.w + i * TILE;
        let rowSign = 0;
        let rowAt = -9;
        for (let x = 0; x < TILE - 1; x++, p++) {
          const v = d[p]!;
          const dx = d[p + 1]! - v;
          const dy = d[p + g.w]! - v;
          const sx = dx > EDGE ? 1 : dx < -EDGE ? -1 : 0;
          const sy = dy > EDGE ? 1 : dy < -EDGE ? -1 : 0;
          if (sx || sy) edges++;
          if (sx) {
            if (rowSign && rowSign !== sx && x - rowAt <= STROKE) pairsH++;
            rowSign = sx;
            rowAt = x;
          }
          if (sy) {
            if (col[x] && col[x] !== sy && y - colAt[x]! <= STROKE) pairsV++;
            col[x] = sy;
            colAt[x] = y;
          }
        }
      }
      const density = edges / n;
      if (density >= DENSITY_LO && density <= DENSITY_HI && pairsH >= PAIRS && pairsV >= PAIRS) hit[j * tx + i] = 1;
    }
  }
  // group: a gap of one tile along a line of print is still the same line (the space between two words), so close it sideways first
  const grown = hit.slice();
  for (let j = 0; j < ty; j++) for (let i = 1; i < tx - 1; i++) if (!hit[j * tx + i] && hit[j * tx + i - 1] && hit[j * tx + i + 1]) grown[j * tx + i] = 1;
  const seen = new Uint8Array(tx * ty);
  const blocks: TextBlock[] = [];
  for (let s = 0; s < grown.length; s++) {
    if (!grown[s] || seen[s]) continue;
    const stack = [s];
    seen[s] = 1;
    let x0 = tx, y0 = ty, x1 = 0, y1 = 0, n = 0, real = 0;
    while (stack.length) {
      const c = stack.pop()!;
      const ci = c % tx;
      const cj = (c / tx) | 0;
      n++;
      if (hit[c]) real++;
      x0 = Math.min(x0, ci); x1 = Math.max(x1, ci); y0 = Math.min(y0, cj); y1 = Math.max(y1, cj);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= tx || nj >= ty) continue;
        const k = nj * tx + ni;
        if (grown[k] && !seen[k]) {
          seen[k] = 1;
          stack.push(k);
        }
      }
    }
    if (real < MIN_TILES) continue;
    const area = (x1 - x0 + 1) * (y1 - y0 + 1);
    // a block that is most of the picture is a texture (a brick wall, foliage), not a page of print
    if (area > tx * ty * 0.7) continue;
    blocks.push({ box: { x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE }, score: Math.min(1, real / area + 0.2), tiles: real });
  }
  return blocks.sort((a, b) => b.tiles - a.tiles).slice(0, 3);
}

// ---------------------------------------------------------------- the steady frame

/**
 * The mean step between this frame and the last, in grey levels (of 255), under which the picture counts as held still. Chosen
 * from measurements (apps/edge/test/lens-one.test.mjs prints them): sensor noise of a held phone 1.6, a 3-pixel move of a page of
 * print (at 160 pixels wide) 11, a 1-pixel drift of print as high in contrast as that 8.8 and of a scene of ordinary contrast
 * about half of it. 6 is between the two with room each way: a hand that rests passes, a hand that is still looking does not.
 */
export const STEADY_DIFF = 6;
/** For this long (ms) before the heavy detectors may run. */
export const STEADY_MS = 400;

/** The mean absolute difference between two same-size grey frames, on a sparse grid (every second pixel of every second row). */
export function frameDiff(a: Grey, b: Grey): number {
  if (a.w !== b.w || a.h !== b.h) return 255;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < a.h; y += 2) {
    let p = y * a.w;
    for (let x = 0; x < a.w; x += 2, p += 2) {
      sum += Math.abs(a.data[p]! - b.data[p]!);
      n++;
    }
  }
  return n ? sum / n : 255;
}

/**
 * The steady-frame rule on a run of frames: feed each frame with its time; `steady` turns true once the frame has stayed
 * within STEADY_DIFF of the one before for STEADY_MS, and false at the first jump. `epoch` counts the stretches of stillness, so
 * a heavy pass runs once for each (a new look at a new picture), not on every frame of a long hold.
 */
export class Steady {
  private prev: Grey | null = null;
  private since = -1;
  /** The last difference measured. */
  diff = 255;
  epoch = 0;
  steady = false;

  push(g: Grey, now: number): boolean {
    const d = this.prev ? frameDiff(this.prev, g) : 255;
    this.prev = g;
    this.diff = d;
    if (d > STEADY_DIFF) {
      this.since = -1;
      this.steady = false;
      return false;
    }
    if (this.since < 0) this.since = now;
    if (!this.steady && now - this.since >= STEADY_MS) {
      this.steady = true;
      this.epoch++;
    }
    return this.steady;
  }

  reset(): void {
    this.prev = null;
    this.since = -1;
    this.steady = false;
    this.epoch = 0;
    this.diff = 255;
  }
}

/** At most one heavy pass at a time, and each for a steady stretch once: asked `allow` it says whether one may start now. */
export class HeavyGate {
  busy = false;
  private doneEpoch = 0;

  allow(steady: Pick<Steady, 'steady' | 'epoch'>): boolean {
    return !this.busy && steady.steady && steady.epoch !== this.doneEpoch;
  }

  start(steady: Pick<Steady, 'steady' | 'epoch'>): void {
    this.busy = true;
    this.doneEpoch = steady.epoch;
  }

  finish(): void {
    this.busy = false;
  }

  /** The picture moved on: the next steady stretch may run the heavy passes again. */
  reset(): void {
    this.doneEpoch = 0;
  }
}

// ---------------------------------------------------------------- the mark on the bar

export type LensMark = 'working' | 'degraded' | 'offline';

/**
 * WORKING (the cheap pass runs and the heavy detectors are on the phone), DEGRADED (the heavy detectors are not on the phone yet,
 * or the cheap pass could not start: the Lens says which, with the download key and its size), OFFLINE (no signal: ASK and
 * TRANSLATE are greyed, the rest works). OFFLINE is the one that changes what he can tap, so it says the most.
 */
export function markOf(o: { cheap: boolean; heavy: boolean; online: boolean }): LensMark {
  if (!o.online) return 'offline';
  return o.cheap && o.heavy ? 'working' : 'degraded';
}

export const MARK_WORDS: Record<LensMark, string> = { working: 'WORKING', degraded: 'DEGRADED', offline: 'OFFLINE' };

// ---------------------------------------------------------------- what the words under a tag say

/** A name the namer gave that is a plant or a part: it changes the act (NAME IT still; FIND THE PART for a part). */
const PARTS = /\b(wheel|tyre|tire|brake|disc|spark plug|filter|battery|alternator|radiator|exhaust|bumper|wiper|headlight|mirror|gasket|bearing|belt|hose|valve|piston|clutch|bolt|screw|nut|washer|hinge|bracket|fuse|bulb|hub|caliper|shock absorber|sprocket|chain)\b/i;
const PLANTS = /\b(plant|flower|tree|leaf|rose|fern|moss|grass|cactus|orchid|tulip|daisy|lily|ivy|shrub|bush|herb|weed|mushroom|fungus)\b/i;

export function isPartName(name: string): boolean {
  return PARTS.test(name);
}
export function isPlantName(name: string): boolean {
  return PLANTS.test(name);
}

/** "a mug", "an apple": the name with its article, as it is said after "looks like". */
export function withArticle(name: string): string {
  const n = name.trim();
  if (!n) return '';
  if (/^(a|an|the|some)\s/i.test(n)) return n;
  return `${/^[aeiou]/i.test(n) ? 'an' : 'a'} ${n}`;
}

/** The namer is sure enough to say a name (its closest share): under this, it says what it can instead. */
export const NAME_FLOOR = 0.2;

/**
 * The words under an object tag: before the namer has looked, only that something is there; after, "looks like a mug", never
 * stronger than "looks like"; under the floor, "something I can’t name yet".
 */
export function objectTruth(name?: { label: string; p: number } | null, looked = false): string {
  if (!looked) return 'something here · hold still';
  if (!name || name.p < NAME_FLOOR) return 'something I can’t name yet';
  return `looks like ${withArticle(name.label)}`;
}

/** The words under a text tag: never the text. */
export const TEXT_TRUTH = 'I see text — tap to read it';

/** The words under a code tag, from SCAN's own kind of code. */
export function codeTruth(kind: string, readable = true): string {
  if (!readable) return 'a code I can’t read yet';
  const said: Record<string, string> = { url: 'a web address', product: 'a product barcode', isbn: 'a book’s barcode', wifi: 'a Wi-Fi code', contact: 'a contact', geo: 'a place', email: 'an email address', phone: 'a phone number', sms: 'a text message', text: 'a code with text in it' };
  return said[kind] ?? 'a code';
}

/** Common English words: a text with few of them is "not in his language" and offers TRANSLATE a real reason. */
const ENGLISH = new Set('the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is are was were has had been am did does'.split(' '));

/**
 * Does this text read as English? (His language: the owner's is English.) Latin script with a fair share of the common words,
 * or too short to say: yes (nothing is translated on a guess). Another script, or Latin words that are not these ones: no.
 */
export function looksEnglish(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return true;
  const letters = t.match(/\p{L}/gu) ?? [];
  if (!letters.length) return true;
  const latin = letters.filter((c) => /[A-Za-zÀ-ɏ]/.test(c)).length;
  if (latin / letters.length < 0.7) return false;
  const words = t.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length < 3) return true;
  const known = words.filter((w) => ENGLISH.has(w)).length;
  return known / words.length >= 0.15;
}

/** The words that ask the Lens to act on its tag ("read that", "what is that", "translate it", "measure it", "name it"). */
export type LensWord = 'read' | 'what' | 'translate' | 'measure' | 'name' | 'ask' | 'look';

export function lensWord(text: string): LensWord | null {
  if (String(text ?? '').length > 60) return null;
  const t = String(text ?? '').trim().toLowerCase().replace(/[.!?\s]+$/g, '').replace(/\s+/g, ' ').replace(/^(?:ok(?:ay)?|right|so|now|please|can you|could you)[, ]+/, '').replace(/^please /, '');
  const it = '(?:that|this|it|that one|this one)';
  if (new RegExp(`^read ${it}(?: text)?$`).test(t) || /^read (?:the|that|this) (?:text|sign|label|page)$/.test(t)) return 'read';
  if (/^what(?:'s| is) (?:that|this|it)(?: thing)?$/.test(t) || /^what am i (?:looking|pointing) at$/.test(t)) return 'what';
  if (new RegExp(`^translate ${it}$`).test(t)) return 'translate';
  if (new RegExp(`^measure ${it}$`).test(t)) return 'measure';
  if (new RegExp(`^(?:name|identify) ${it}$`).test(t)) return 'name';
  if (new RegExp(`^ask (?:about|ghosty about) ${it}$`).test(t)) return 'ask';
  if (new RegExp(`^(?:look at|check|scan) ${it}$`).test(t)) return 'look';
  return null;
}
