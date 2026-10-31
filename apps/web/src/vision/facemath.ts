/**
 * The face module's arithmetic and words (Lens PEOPLE; vision/faces.ts runs the models, vision/facestore.ts keeps the
 * faces on this phone). Pure: tested in Node with fixtures (apps/edge/test/faces.test.mjs).
 *
 * A face is 128 numbers (SFace's embedding of the face, lined up on its eyes, nose and mouth); two looks of one person
 * point the same way, two people do not. A known face is matched by the cosine with each of a person's looks: from
 * SURE it is that person, from MAYBE "I think it's …", below it nobody — and when two people are about as close, nobody
 * either: an unknown face is never guessed by name.
 */

export const FACE_DIM = 128;
/** SFace's input: one face lined up in 112 × 112 pixels. */
export const FACE_SIZE = 112;

/**
 * Where SFace expects the eyes, the nose and the mouth in its 112 × 112 face (OpenCV's FaceRecognizerSF template; the
 * mouth is the middle of its two corners, which is the point the detector gives). Left and right as seen in the picture.
 */
export const FACE_TEMPLATE: [number, number][] = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [56.1396, 92.2848],
];

/** SFace's published threshold for "the same person" (cosine, LFW): from here it may be them. */
export const MAYBE = 0.363;
/** From here it is them. */
export const SURE = 0.45;
/** The best match must beat the next person by this much, or it is nobody. */
export const MARGIN = 0.06;

export function normalize(v: ArrayLike<number>): number[] {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => x / n);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    ab += a[i]! * b[i]!;
    aa += a[i]! * a[i]!;
    bb += b[i]! * b[i]!;
  }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** A look as it is kept: length 1, four decimals (about 1 KB a look). */
export const packLook = (v: ArrayLike<number>): number[] => normalize(v).map((x) => Math.round(x * 1e4) / 1e4);

/**
 * The similarity transform (scale, turn, shift) that best takes `src` onto `dst` (least squares, Umeyama's method in 2-D):
 * x' = a·x − b·y + tx, y' = b·x + a·y + ty. What lines a face up on the template.
 */
export function similarity(src: [number, number][], dst: [number, number][]): { a: number; b: number; tx: number; ty: number } {
  const n = Math.min(src.length, dst.length);
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    sx += src[i]![0];
    sy += src[i]![1];
    dx += dst[i]![0];
    dy += dst[i]![1];
  }
  sx /= n; sy /= n; dx /= n; dy /= n;
  let num1 = 0, num2 = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const x = src[i]![0] - sx, y = src[i]![1] - sy;
    const u = dst[i]![0] - dx, v = dst[i]![1] - dy;
    num1 += x * u + y * v;
    num2 += x * v - y * u;
    den += x * x + y * y;
  }
  const a = den ? num1 / den : 1;
  const b = den ? num2 / den : 0;
  return { a, b, tx: dx - (a * sx - b * sy), ty: dy - (b * sx + a * sy) };
}

/** RGBA pixels → the model's input: three planes (R, G, B), values 0–255 as they are. */
export function rgbaToRgbChw(data: ArrayLike<number>, w: number, h: number): Float32Array {
  const plane = w * h;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = data[i * 4]!;
    out[plane + i] = data[i * 4 + 1]!;
    out[2 * plane + i] = data[i * 4 + 2]!;
  }
  return out;
}

/** One person this phone knows: the owner (`me`) or someone he introduced, with their looks. */
export interface KnownFace {
  id: string;
  name: string;
  me: boolean;
  looks: number[][];
  at: number;
}

export interface FaceMatch {
  id: string;
  name: string;
  me: boolean;
  score: number;
  sure: boolean;
}

/** How close a face is to a person: the best cosine with any of their looks. */
export const scoreFor = (emb: ArrayLike<number>, p: Pick<KnownFace, 'looks'>): number => p.looks.reduce((best, l) => Math.max(best, cosine(emb, l)), -1);

/**
 * Who a face is: the closest person known, if close enough — SURE or above, "sure"; from MAYBE, not sure — and nobody
 * when two people are about as close (never a guess between them) or nobody is close at all.
 */
export function bestMatch(emb: ArrayLike<number>, people: KnownFace[]): FaceMatch | null {
  const ranked = people.map((p) => ({ p, s: scoreFor(emb, p) })).sort((a, b) => b.s - a.s);
  const top = ranked[0];
  if (!top || top.s < MAYBE) return null;
  const next = ranked[1];
  if (next && next.s >= MAYBE && top.s - next.s < MARGIN) return null;
  return { id: top.p.id, name: top.p.name, me: top.p.me, score: top.s, sure: top.s >= SURE };
}

/**
 * The looks that agree with one another (a look far from the rest — someone else stepped into the picture — is dropped).
 * Each look is kept when its average cosine with the others is at least MAYBE.
 */
export function steadyLooks(looks: number[][]): number[][] {
  if (looks.length < 3) return looks;
  return looks.filter((l, i) => {
    const others = looks.filter((_, j) => j !== i);
    return others.reduce((s, o) => s + cosine(l, o), 0) / others.length >= MAYBE;
  });
}

/** Two boxes' overlap, 0–1 (to follow one face from look to look). */
export function iou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const u = a.w * a.h + b.w * b.h - inter;
  return u > 0 ? inter / u : 0;
}

// ---------------------------------------------------------------- his words

/** "Ghosty, hey, ok" in front of a phrase change nothing. */
const LEAD = /^(?:(?:hey|hi|ok|okay|oi|right|so|ghosty|ghost|mate)[\s,.!]+)+/i;
/** Words that follow "this is" and are not a name ("this is fine", "this is my house"). */
const NOT_NAMES = new Set(
  'it me you him her them us a an the this that what who good bad fine great nice cool amazing awesome weird funny wrong right mad crazy insane boring hard easy new old big small mine yours his hers ours theirs not so very really just going getting how why where when here there home house car room food dinner lunch work school brilliant perfect lovely gorgeous beautiful horrible terrible rubbish class mint sick fire lit everything nothing something anything all done over true false real fake ok okay yes no maybe sorry hello hi bye ghosty'.split(' '),
);
/** Relations he may say before a name ("my cousin Sam", "my best mate Jo"). */
const RELATION = /^(?:my\s+)?(?:(?:best|old|little|big|baby|older|younger|step|good)\s+)?(?:cousin|friend|mate|pal|brother|sister|bro|sis|mum|mom|dad|mother|father|nan|nana|gran|grandma|grandad|grandpa|uncle|auntie|aunt|son|daughter|wife|husband|girlfriend|boyfriend|partner|colleague|boss|neighbour|neighbor|flatmate|housemate|mate)\s+/i;

const titleCase = (s: string) => s.replace(/(^|[\s'-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());

/**
 * "Ghosty, this is Sam" (typed or spoken): the name of the person he is introducing, or null when it is not an
 * introduction. A relation before the name is left out ("my cousin Sam" → Sam); a relation alone is the name ("my mum" → Mum).
 */
export function introAsked(text: string): string | null {
  const t = String(text ?? '').replace(/[’‘]/g, "'").replace(LEAD, '').trim().replace(/[.!]+$/, '');
  const m = /^(?:this is|this here is|here(?:'s| is)|meet|say hello to|say hi to|introducing|i'd like you to meet|i want you to meet)\s+(.+)$/i.exec(t);
  if (!m) return null;
  let rest = m[1]!.trim();
  const rel = RELATION.exec(rest);
  rest = rel && rest.slice(rel[0].length).trim() ? rest.slice(rel[0].length).trim() : rest.replace(/^my\s+/i, '');
  const words = rest.split(/\s+/);
  if (!words.length || words.length > 3 || rest.length > 32) return null;
  if (!words.every((w) => /^\p{L}[\p{L}'-]*$/u.test(w))) return null;
  if (words.some((w) => NOT_NAMES.has(w.toLowerCase()))) return null;
  return titleCase(rest.toLowerCase());
}

/** Plain words for the questions. */
const bare = (text: string) => String(text ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(LEAD, '').replace(/[?.!]+$/, '').replace(/\s+/g, ' ').trim();

/**
 * The questions the PEOPLE mode answers in a word: "who am I?" (`me`), "is this me?" / "is this you?" (`isme`), and
 * "who's this?" (`who`, about someone else in the picture). null: none of them.
 */
export function faceAsked(text: string): 'me' | 'isme' | 'who' | null {
  const t = bare(text);
  if (/^(?:who am i|do you know who i am|do you (?:know|recogni[sz]e) me|recogni[sz]e me|you know who i am|who(?:'s| is) holding (?:the|this) phone)$/.test(t)) return 'me';
  if (/^(?:is (?:this|that|it) (?:me|you)|is it really (?:me|you)|am i me|it's me|is this my face|you (?:see|know) me)$/.test(t)) return 'isme';
  if (/^(?:who(?:'s| is) (?:this|that|he|she|it|they|this person|that person|this guy|that guy|this girl)|who are (?:they|these people)|do you (?:know|recogni[sz]e) (?:this|that|him|her|them)(?: person)?|do you know who (?:this|that|he|she|they) (?:is|are))$/.test(t)) return 'who';
  return null;
}
