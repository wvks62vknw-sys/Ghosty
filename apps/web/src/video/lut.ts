/**
 * A .cube LUT read by the app's own parser (BRIEF-EDITOR-VIDEO): a 3-D table of colours, 2 to 65 points a side (17 and 33 are
 * what the colourists' tools write), applied as a 3-D texture on the screen and trilinearly here. Anything malformed is refused
 * in his words, never half read.
 */
export interface Lut {
  title: string;
  size: number;
  /** size³ RGB triples, red varying fastest, as the .cube file lists them. */
  data: Float32Array;
}

/** A LUT file refused in his words (said whole by the one error voice). */
export class LutError extends Error {
  readonly said = true;
}

export function parseCube(text: string): Lut {
  let size = 0;
  let title = '';
  let lo = [0, 0, 0];
  let hi = [1, 1, 1];
  const rows: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const word = line.split(/\s+/);
    const key = word[0]!.toUpperCase();
    if (key === 'TITLE') title = line.replace(/^TITLE\s*/i, '').replace(/^"|"$/g, '');
    else if (key === 'LUT_3D_SIZE') size = Number(word[1]);
    else if (key === 'LUT_1D_SIZE') throw new LutError('That is a one-dimensional LUT; I can read the 3-D kind (LUT_3D_SIZE).');
    else if (key === 'DOMAIN_MIN') lo = word.slice(1, 4).map(Number);
    else if (key === 'DOMAIN_MAX') hi = word.slice(1, 4).map(Number);
    else if (/^(TITLE|DOMAIN|LUT)/i.test(key)) continue;
    else {
      if (word.length < 3) throw new LutError('A line of that LUT is not three numbers, so I have not used it.');
      const v = word.slice(0, 3).map(Number);
      if (v.some((n) => !Number.isFinite(n))) throw new LutError('A line of that LUT is not three numbers, so I have not used it.');
      rows.push(...v);
    }
  }
  if (!Number.isInteger(size) || size < 2 || size > 65) throw new LutError('That LUT does not say its size (LUT_3D_SIZE, 2 to 65), so I have not used it.');
  if (rows.length !== size * size * size * 3) throw new LutError(`That LUT should hold ${size * size * size} colours and holds ${Math.floor(rows.length / 3)}, so I have not used it.`);
  const data = new Float32Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const a = lo[i % 3]!;
    const b = hi[i % 3]!;
    data[i] = Math.min(1, Math.max(0, (rows[i]! - a) / (b - a || 1)));
  }
  return { title, size, data };
}

/** A colour through the LUT, trilinear. */
export function applyLut(l: Lut, c: [number, number, number]): [number, number, number] {
  const n = l.size;
  const f = c.map((v) => Math.min(1, Math.max(0, v)) * (n - 1));
  const i0 = f.map((v) => Math.min(n - 2, Math.floor(v)));
  const t = f.map((v, k) => v - i0[k]!);
  const at = (r: number, g: number, b: number, ch: number) => l.data[((b * n + g) * n + r) * 3 + ch]!;
  const out: [number, number, number] = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    let acc = 0;
    for (let dr = 0; dr < 2; dr++)
      for (let dg = 0; dg < 2; dg++)
        for (let db = 0; db < 2; db++) {
          const w = (dr ? t[0]! : 1 - t[0]!) * (dg ? t[1]! : 1 - t[1]!) * (db ? t[2]! : 1 - t[2]!);
          acc += w * at(i0[0]! + dr, i0[1]! + dg, i0[2]! + db, ch);
        }
    out[ch] = acc;
  }
  return out;
}

/** The LUT as RGBA bytes for a 3-D texture (size³ × 4). */
export function lutBytes(l: Lut): Uint8Array {
  const n = l.size ** 3;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = Math.round(l.data[i * 3]! * 255);
    out[i * 4 + 1] = Math.round(l.data[i * 3 + 1]! * 255);
    out[i * 4 + 2] = Math.round(l.data[i * 3 + 2]! * 255);
    out[i * 4 + 3] = 255;
  }
  return out;
}
