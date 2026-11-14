/**
 * AS AN APP (BRIEF-EDITOR-GAME-STUDIO): one self-contained HTML page that plays a game. The runtime is bundled by build.mjs as
 * its own small script (player.ts), inlined; the game's JSON is inlined as data (never as code); a manifest says name,
 * standalone, start_url and scope; the Home Screen icon is drawn from the first room; and the page's own policy lets it run
 * ONLY that one script, pinned by its hash, and reach nowhere on the network. Pure: the node test builds a page and reads it back.
 */
import { adler32, concat, crc32, toBase64, utf8 } from '../convert/bytes';
import { firstRoom, type Game, isSolidLetter, type Room, themeOf, tileAt } from './model';

export const TARGET_BYTES = 400_000;

/** SHA-256, in plain code, so a page's script can be pinned in the page's own policy. */
export function sha256(data: Uint8Array): Uint8Array {
  const K = new Uint32Array(64);
  let n = 2;
  for (let i = 0; i < 64; ) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (prime) K[i++] = Math.floor((Math.cbrt(n) % 1) * 2 ** 32);
    n++;
  }
  const H = new Uint32Array(8);
  n = 2;
  for (let i = 0; i < 8; ) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
    if (prime) H[i++] = Math.floor((Math.sqrt(n) % 1) * 2 ** 32);
    n++;
  }
  const len = data.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(data);
  padded[len] = 0x80;
  new DataView(padded.buffer).setUint32(padded.length - 4, (len * 8) >>> 0);
  new DataView(padded.buffer).setUint32(padded.length - 8, Math.floor((len * 8) / 2 ** 32));
  const w = new Uint32Array(64);
  const rotr = (x: number, k: number) => (x >>> k) | (x << (32 - k));
  for (let off = 0; off < padded.length; off += 64) {
    const dv = new DataView(padded.buffer, off, 64);
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const t1 = (h! + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const mj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const t2 = (S0 + mj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i]! + v!) >>> 0));
  }
  const out = new Uint8Array(32);
  H.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v));
  return out;
}
const b64 = (u: Uint8Array) => toBase64(u);

/** The slug a game has on his sites: its name in lower case, letters, numbers and hyphens. */
export const slugOf = (g: Pick<Game, 'name'>): string => g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'game';
export const addressOf = (g: Pick<Game, 'name'>): string => `/s/${slugOf(g)}/`;

export function manifestOf(g: Game, scope = addressOf(g), icon = ''): Record<string, unknown> {
  return {
    name: g.name,
    short_name: g.name.slice(0, 12),
    start_url: scope,
    scope,
    display: 'standalone',
    orientation: 'portrait',
    background_color: themeOf(g.palette).sky[0],
    theme_color: themeOf(g.palette).sky[0],
    icons: [{ src: icon || 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
  };
}

/** The page's policy: its one script by hash, its one style by hash, pictures and a manifest only as data, no network at all. */
export function policyOf(scriptHash: string, styleHash: string): string {
  return `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'sha256-${styleHash}'; img-src data: blob:; manifest-src data:; connect-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`;
}

const be32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const t = utf8.encode(type);
  return concat([be32(data.length), t, data, be32(crc32(concat([t, data])))]);
}
/** The 512 px icon: the first room drawn flat in the kit's own colours at four shades (a two-bit PNG, stored, 64 KB). */
export function iconPng(g: Game, o: { room?: Room; size?: number } = {}): Uint8Array {
  // [sites] any room at any size (a published game's front page shows its rooms: apps/edge/src/gamesite.ts)
  const S = o.size && o.size >= 64 && o.size <= 1024 && o.size % 4 === 0 ? o.size : 512;
  const th = themeOf(g.palette);
  const room = o.room ?? firstRoom(g);
  const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const pal = [hex(th.sky[1]), hex(th.ground), hex(th.top), hex(th.ledge)];
  const rows: Uint8Array[] = [];
  // show a window of the room about as wide as tall, around its start
  const cell = 16;
  const winW = Math.max(8, Math.min(room?.w ?? 8, 16));
  const winH = Math.max(8, Math.min(room?.h ?? 8, 16));
  let sx = 0;
  let sy = 0;
  if (room) {
    for (let y = 0; y < room.h; y++) {
      const x = room.rows[y]!.indexOf('P');
      if (x >= 0) {
        sx = Math.max(0, Math.min(room.w - winW, x - 3));
        sy = Math.max(0, Math.min(room.h - winH, y - winH + 3));
      }
    }
  }
  for (let y = 0; y < S; y++) {
    const row = new Uint8Array(1 + S / 4);
    const ty = sy + Math.floor((y / S) * winH);
    for (let x = 0; x < S; x++) {
      const tx = sx + Math.floor((x / S) * winW);
      const c = room ? tileAt(room, tx, ty) : ' ';
      const fy = ((y / S) * winH) % 1;
      let shade = 0;
      if (c === '#' || c === 'W' || c === 'B') shade = fy < 0.25 && tileAt(room!, tx, ty - 1) === '.' ? 2 : 1;
      else if (c === 'p') shade = fy < 0.4 ? 3 : 0;
      else if (c === 'o' || c === 'F' || c === 'V' || c === 'c') shade = 3;
      else if (room && isSolidLetter(g, c)) shade = 1;
      row[1 + (x >> 2)]! |= shade << (6 - 2 * (x & 3));
    }
    rows.push(row);
  }
  void cell;
  const raw = concat(rows);
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  for (let i = 0; i < raw.length; i += 65535) {
    const part = raw.subarray(i, Math.min(raw.length, i + 65535));
    blocks.push(new Uint8Array([i + 65535 >= raw.length ? 1 : 0, part.length & 255, part.length >> 8, ~part.length & 255, (~part.length >> 8) & 255]), part);
  }
  blocks.push(be32(adler32(raw)));
  const plte = new Uint8Array(12);
  pal.forEach((c, i) => plte.set(c, i * 3));
  return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', concat([be32(S), be32(S), new Uint8Array([2, 3, 0, 0, 0])])), pngChunk('PLTE', plte), pngChunk('IDAT', concat(blocks)), pngChunk('IEND', new Uint8Array(0))]);
}

/** What the play overlay (the pad, the dialogue box, the sheets, the end card) wears, in the page and in the editor's PLAY. */
export const PLAY_CSS = `.gpUi{position:absolute;inset:0;pointer-events:none;font:600 15px/20px -apple-system,system-ui,sans-serif;color:#fff;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none}.gpUi *{box-sizing:border-box}.gpUi button{pointer-events:auto;font:inherit;color:#fff;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.7);border-radius:6px;min-width:44px!important;min-height:44px!important;padding:0 12px;touch-action:none}.gpUi button.on{background:rgba(255,255,255,.35)}.gpPad{position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:space-between;align-items:flex-end}.gpPad>div{display:flex;gap:10px;align-items:flex-end}.gpPad button{min-width:60px!important;min-height:60px!important;font-size:20px}.gpPad .small{font-size:13px;letter-spacing:.06em}.gpPad .dpad{display:grid;grid-template-columns:repeat(3,60px);grid-template-rows:repeat(2,60px);gap:6px}.gpPad .dpad .u{grid-column:2;grid-row:1}.gpPad .dpad .l{grid-column:1;grid-row:2}.gpPad .dpad .d{grid-column:2;grid-row:2}.gpPad .dpad .r{grid-column:3;grid-row:2}.gpBox{position:absolute;left:12px;right:12px;bottom:calc(var(--gp-pad,150px) - 36px);background:rgba(0,0,0,.84);border:2px solid #fff;border-radius:6px;padding:12px;pointer-events:auto}.gpBox h3{margin:0 0 4px;font-size:15px}.gpBox p{margin:0 0 8px;font-weight:500}.gpSheet{position:absolute;left:12px;right:12px;top:8%;bottom:calc(var(--gp-pad,150px) - 20px);overflow:auto;background:rgba(0,0,0,.92);border:2px solid #fff;border-radius:6px;padding:12px;pointer-events:auto}.gpSheet h3{margin:0 0 4px}.gpSheet p{margin:0 0 8px;font-weight:500}.gpRow{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:6px 0}.gpRow span:last-child{display:flex;gap:8px;align-items:center}.gpEnd{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(0,0,0,.72);pointer-events:auto;text-align:center;padding:24px}.gpEnd h2{margin:0;font-size:26px}.gpEnd p{margin:0;font-weight:500}.gpTop{margin:0;padding:0 0 0 30px;text-align:left;min-width:220px;max-height:44vh;overflow-y:auto;font-weight:500}.gpTop li{padding:3px 0}.gpTop li.me{color:#ffd54a}.gpTop b{display:inline-block;min-width:64px;font-weight:800}`;
export const STYLE = `html,body{margin:0;height:100%;background:#000;overflow:hidden;overscroll-behavior:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}#c{position:fixed;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated}#u{position:fixed;inset:0;--gp-pad:calc(150px + env(safe-area-inset-bottom))}#u .gpPad{bottom:calc(env(safe-area-inset-bottom) + 12px)}${PLAY_CSS}`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** The page (the icon is in it once, as the Home Screen icon: the manifest, a data address, has nothing to resolve a second copy against): `player` is the bundled runtime (build.mjs), `icon` an optional 512 px PNG's bytes (the first room, drawn here, by default). */
export function appPage(g: Game, o: { player: string; icon?: Uint8Array }): string {
  const iconUri = `data:image/png;base64,${b64(o.icon ?? iconPng(g))}`;
  const man = `data:application/manifest+json;base64,${b64(utf8.encode(JSON.stringify(manifestOf(g, addressOf(g)))))}`;
  const code = o.player.replace(/<\/script/gi, '<\\/script');
  const hash = b64(sha256(utf8.encode(code)));
  const styleHash = b64(sha256(utf8.encode(STYLE)));
  const data = JSON.stringify(g).replace(/</g, '\\u003c');
  const th = themeOf(g.palette);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><meta http-equiv="Content-Security-Policy" content="${policyOf(hash, styleHash)}"><title>${esc(g.name)}</title><meta name="theme-color" content="${th.sky[0]}"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="${esc(g.name.slice(0, 12))}"><link rel="manifest" href="${man}"><link rel="apple-touch-icon" href="${iconUri}"><style>${STYLE}</style></head><body><canvas id="c"></canvas><div id="u"><div class="gpUi" id="gp"></div></div><script type="application/json" id="game">${data}</script><script>${code}</script></body></html>`;
}
