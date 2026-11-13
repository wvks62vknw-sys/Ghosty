/**
 * SHARE (BRIEF-EDITOR-GAME-STUDIO): a game as a `.ghostygame` file: a zip (through convert/zip.ts) of the game's JSON, one
 * PNG for each sprite's animation and one for his own tiles (so the pictures open anywhere), and a line saying what it is.
 * The JSON is the whole truth; the PNGs are for looking at. Reading one back keeps whatever is usable and counts the rest.
 * Pure: the node test runs this very file.
 */
import { adler32, concat, crc32, utf8 } from '../convert/bytes';
import { unzipSync, zipStore } from '../convert/zip';
import { ANIMS, type Frame, frameAt, type Game, INKS, readGame, type Sprite } from './model';

export const EXT = '.ghostygame';
export const MIME = 'application/x-ghostygame';

const be32 = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = utf8.encode(type);
  return concat([be32(data.length), t, data, be32(crc32(concat([t, data])))]);
}
const rgbOf = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** A PNG of rows of frames (a row for each animation, a frame for each column), one pixel for each pixel (stored, not compressed: the pictures are tiny). */
export function pngOfRows(rows: Frame[][], k = 1): Uint8Array {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const w = cols * 16 * k;
  const h = Math.max(1, rows.length) * 16 * k;
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w * 4 + 1);
    raw[o] = 0;
    for (let x = 0; x < w; x++) {
      const f = rows[Math.floor(y / (16 * k))]?.[Math.floor(x / (16 * k))];
      const ink = f ? frameAt(f, Math.floor((x % (16 * k)) / k), Math.floor((y % (16 * k)) / k)) : 0;
      const hex = INKS[ink]?.hex ?? '';
      const [r, g, b] = hex ? rgbOf(hex) : [0, 0, 0];
      raw.set([r, g, b, hex ? 255 : 0], o + 1 + x * 4);
    }
  }
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let i = 0; i < raw.length; i += 65535) {
    const part = raw.subarray(i, Math.min(raw.length, i + 65535));
    const last = i + 65535 >= raw.length;
    blocks.push(new Uint8Array([last ? 1 : 0, part.length & 255, part.length >> 8, ~part.length & 255, (~part.length >> 8) & 255]), part);
  }
  blocks.push(be32(adler32(raw)));
  const ihdr = concat([be32(w), be32(h), new Uint8Array([8, 6, 0, 0, 0])]);
  return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', concat(blocks)), chunk('IEND', new Uint8Array(0))]);
}
/** One sprite's sheet: a row for each animation it has. */
export const pngOf = (s: Sprite): Uint8Array => pngOfRows(ANIMS.filter((a) => s.anims[a]?.length).map((a) => s.anims[a]!));

export function writeGame(g: Game, when = new Date()): Uint8Array {
  const files: { name: string; data: Uint8Array | string }[] = [
    { name: 'game.json', data: JSON.stringify(g) },
    { name: 'README.txt', data: `${g.name}\nA game made in Ghosty's game studio${g.maker ? `, by ${g.maker}` : ''}.\nOpen it in Ghosty (the library's Add, or the studio's IMPORT). The pictures are in the sprites folder.\n` },
  ];
  for (const s of g.sprites) files.push({ name: `sprites/${s.id}.png`, data: pngOf(s) });
  if (g.tiles.length) files.push({ name: 'tiles.png', data: pngOfRows([g.tiles.map((t) => t.px)]) });
  return zipStore(files, when);
}
export interface FileRead {
  game: Game;
  lost: number;
  read: number;
  maker: string;
}
/** A game out of a `.ghostygame`, or null when it is not one. */
export function readFile(bytes: Uint8Array): FileRead | null {
  try {
    const parts = unzipSync(bytes);
    const json = parts.get('game.json');
    if (!json) return null;
    const r = readGame(JSON.parse(new TextDecoder().decode(json)));
    return r ? { ...r, maker: r.game.maker } : null;
  } catch {
    return null;
  }
}
export function partsOf(bytes: Uint8Array): string[] {
  try {
    return [...unzipSync(bytes).keys()];
  } catch {
    return [];
  }
}
export const sizeWords = (n: number): string => (n < 1000 ? `${n} B` : n < 1_000_000 ? `${Math.max(1, Math.round(n / 100) / 10)} KB` : `${Math.round(n / 100_000) / 10} MB`);
export const fileName = (g: Game): string => `${g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game'}${EXT}`;
