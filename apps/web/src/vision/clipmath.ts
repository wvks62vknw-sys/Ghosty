/**
 * The namer's arithmetic (pure, no DOM): NAME mode turns a picture into 512 numbers with the
 * MobileCLIP-S0 picture encoder and compares them with the same kind of numbers made beforehand
 * for thousands of names ("a photo of a {name}."). The closest names, softened into shares that
 * add up to 100 %, are what the Lens shows. Everything here is plain maths so it can be tested in
 * Node: half-float decoding, the label banks, the square crop, pixels into the model's layout,
 * scores, the top few and the shares.
 */

/** Numbers per picture or name. */
export const CLIP_DIM = 512;
/** The picture encoder's input: a 256 × 256 square. */
export const CLIP_SIZE = 256;
/** CLIP's own sharpening of the scores before they become shares (exp(4.6052) ≈ 100). */
export const CLIP_SCALE = 100;

/** One IEEE half float (16 bits) as a number. */
export function f16(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exp = (bits >> 10) & 0x1f;
  const mant = bits & 0x3ff;
  if (exp === 0) return sign * mant * 2 ** -24;
  if (exp === 31) return mant ? NaN : sign * Infinity;
  return sign * (1 + mant / 1024) * 2 ** (exp - 15);
}

/** A whole array of half floats (the label file, little-endian as written) as 32-bit floats. */
export function decodeF16(bytes: ArrayBuffer | Uint8Array): Float32Array {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const n = u8.byteLength >> 1;
  const out = new Float32Array(n);
  // a table of all 65,536 values is faster than decoding 2.4 million one by one
  const table = f16Table();
  for (let i = 0; i < n; i++) out[i] = table[u8[2 * i]! | (u8[2 * i + 1]! << 8)]!;
  return out;
}

let table16: Float32Array | null = null;
function f16Table(): Float32Array {
  if (table16) return table16;
  const t = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) t[i] = f16(i);
  table16 = t;
  return t;
}

/**
 * A bank of names and their numbers. `vecs` holds one row of CLIP_DIM per name: float rows (the
 * core bank, from half floats), or int8 rows with one float `scale` per row (the extended bank,
 * a quarter of the size).
 */
export interface LabelBank {
  labels: string[];
  dim: number;
  vecs: Float32Array | Int8Array;
  scales?: Float32Array;
}

/** The core bank: a JSON list of names and a half-float matrix of the same length. */
export function bankFromF16(labels: string[], bytes: ArrayBuffer | Uint8Array, dim = CLIP_DIM): LabelBank {
  const vecs = decodeF16(bytes);
  if (vecs.length !== labels.length * dim) throw new Error(`The name list (${labels.length}) and its numbers (${vecs.length / dim} rows) do not match`);
  return { labels, dim, vecs };
}

/**
 * The extended bank's file: `rows` float32 scales (little-endian), then `rows × dim` int8 values;
 * each row's real numbers are its int8 values times its scale.
 */
export function bankFromI8(labels: string[], bytes: ArrayBuffer | Uint8Array, dim = CLIP_DIM): LabelBank {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const rows = labels.length;
  if (u8.byteLength !== rows * 4 + rows * dim) throw new Error(`The extended names (${rows}) and their numbers (${u8.byteLength} bytes) do not match`);
  const copy = u8.slice(0, rows * 4);
  const scales = new Float32Array(copy.buffer, 0, rows);
  const vecs = new Int8Array(u8.buffer, u8.byteOffset + rows * 4, rows * dim);
  return { labels, dim, vecs, scales };
}

/** Float rows → int8 rows with a scale each (how the extended file is made). */
export function quantizeI8(vecs: Float32Array, dim = CLIP_DIM): { scales: Float32Array; q: Int8Array } {
  const rows = Math.floor(vecs.length / dim);
  const scales = new Float32Array(rows);
  const q = new Int8Array(rows * dim);
  for (let r = 0; r < rows; r++) {
    let m = 0;
    for (let k = 0; k < dim; k++) m = Math.max(m, Math.abs(vecs[r * dim + k]!));
    const s = m / 127 || 1;
    scales[r] = s;
    for (let k = 0; k < dim; k++) q[r * dim + k] = Math.max(-127, Math.min(127, Math.round(vecs[r * dim + k]! / s)));
  }
  return { scales, q };
}

/** The vector scaled to length 1 (a zero vector stays zero). */
export function normalize(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  n = Math.sqrt(n);
  const out = new Float32Array(v.length);
  if (!n) return out;
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / n;
  return out;
}

/** Cosine of the (already normalised) picture vector with every name in the bank. */
export function scoresAgainst(emb: ArrayLike<number>, bank: LabelBank): Float32Array {
  const { dim, vecs, scales } = bank;
  const rows = bank.labels.length;
  const out = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    let s = 0;
    const o = r * dim;
    for (let k = 0; k < dim; k++) s += emb[k]! * vecs[o + k]!;
    out[r] = scales ? s * scales[r]! : s;
  }
  return out;
}

/** Indices of the k largest values, largest first. */
export function topK(values: ArrayLike<number>, k: number): number[] {
  const best: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (!(v === v)) continue; // NaN
    if (best.length < k) {
      best.push(i);
      best.sort((a, b) => values[b]! - values[a]!);
    } else if (v > values[best[k - 1]!]!) {
      best[k - 1] = i;
      best.sort((a, b) => values[b]! - values[a]!);
    }
  }
  return best;
}

/** Shares that add up to 1, sharpened by `scale` (CLIP's 100), safe for large values. */
export function softmax(values: ArrayLike<number>, scale = 1): Float32Array {
  const out = new Float32Array(values.length);
  if (!values.length) return out;
  let m = -Infinity;
  for (let i = 0; i < values.length; i++) m = Math.max(m, values[i]! * scale);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const e = Math.exp(values[i]! * scale - m);
    out[i] = e;
    sum += e;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / sum;
  return out;
}

/** One name and its share (0–1). */
export interface NameGuess {
  label: string;
  p: number;
}

/**
 * The top `k` names for a picture vector: cosine with every name in every bank given (the core
 * bank, and the extended one when loaded), then CLIP's shares over all of them together, so a
 * picture that matches nothing well spreads thin and shows low numbers. A name in two banks gets
 * both its shares added.
 */
export function nameTop(emb: ArrayLike<number>, banks: LabelBank | LabelBank[], k = 5): NameGuess[] {
  const list = Array.isArray(banks) ? banks : [banks];
  const scores = list.map((b) => scoresAgainst(emb, b));
  const all = new Float32Array(scores.reduce((n, s) => n + s.length, 0));
  let at = 0;
  for (const s of scores) {
    all.set(s, at);
    at += s.length;
  }
  const p = softmax(all, CLIP_SCALE);
  const labelAt = (i: number): string => {
    let off = 0;
    for (const b of list) {
      if (i < off + b.labels.length) return b.labels[i - off] ?? '';
      off += b.labels.length;
    }
    return '';
  };
  // a few extra candidates so names found twice still leave k different ones
  const by = new Map<string, number>();
  for (const i of topK(p, k * 2)) {
    const label = labelAt(i);
    by.set(label, (by.get(label) ?? 0) + p[i]!);
  }
  return [...by].map(([label, share]) => ({ label, p: share })).sort((x, y) => y.p - x.p).slice(0, k);
}

/** The middle square of a picture (the model's "shortest side to 256, then the centre 256"). */
export function centreSquare(w: number, h: number): { x: number; y: number; w: number; h: number } {
  const s = Math.min(w, h);
  return { x: Math.floor((w - s) / 2), y: Math.floor((h - s) / 2), w: s, h: s };
}

/** A square around a tapped point, 40 % of the short side, kept inside the picture. */
export function tapSquare(x: number, y: number, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const s = Math.max(16, Math.round(Math.min(w, h) * 0.4));
  const cx = Math.min(Math.max(x, s / 2), w - s / 2);
  const cy = Math.min(Math.max(y, s / 2), h - s / 2);
  return { x: Math.round(cx - s / 2), y: Math.round(cy - s / 2), w: s, h: s };
}

/**
 * RGBA pixels (as a canvas gives them) → the model's input: three planes R, G, B of 0–1 values
 * (MobileCLIP-S0 takes no mean/spread adjustment: its preprocessor_config has do_normalize false).
 */
export function rgbaToChw(rgba: ArrayLike<number>, w: number, h: number): Float32Array {
  const n = w * h;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[4 * i]! / 255;
    out[n + i] = rgba[4 * i + 1]! / 255;
    out[2 * n + i] = rgba[4 * i + 2]! / 255;
  }
  return out;
}

/** "cat 82%, tabby 9%" — the guesses for a note or the scene line. */
export function namesLine(names: NameGuess[], max = 3): string {
  return names
    .slice(0, max)
    .map((n) => `${n.label} ${Math.round(n.p * 100)}%`)
    .join(', ');
}

/** The phone's guesses in the words `seen` carries to the brain (marked as guesses). */
export function namesSeen(names: NameGuess[], max = 5): string {
  const line = namesLine(names, max);
  return line ? `phone guesses (name match, may be wrong) ${line}` : '';
}
