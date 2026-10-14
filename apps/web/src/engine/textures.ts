/**
 * Builds the globe's procedural Earth textures from the Natural Earth polygons:
 *  - geo   (RGBA bytes): R land mask, G distance inland, B continental shelf, A ice
 *  - bio   (canvas):     R mountains, G arid, B lush
 *  - lights(canvas):     night-time city lights
 * Runs inside a Web Worker (textures.worker.ts) so the page never freezes; falls back
 * to the main thread on browsers without OffscreenCanvas in workers.
 */
import { decodeRing, type WorldPack } from './world';

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
export type MakeCanvas = (w: number, h: number) => OffscreenCanvas | HTMLCanvasElement;

export interface TextureSet {
  W: number;
  H: number;
  geo: Uint8Array;
  bio: OffscreenCanvas | HTMLCanvasElement | ImageBitmap;
  lights: OffscreenCanvas | HTMLCanvasElement | ImageBitmap;
}

export function buildTextures(P: WorldPack, make: MakeCanvas, W = 2048, H = 1024): TextureSet {
  const q = P.q;
  const land = P.land.map((poly) => poly.map((r) => decodeRing(r, q)));
  const lakes = P.lakes.map((poly) => poly.map((r) => decodeRing(r, q)));
  const ice = P.ice.map((poly) => poly.map((r) => decodeRing(r, q)));
  const urban = P.urban.map((r) => decodeRing(r, q));
  const X = (lo: number) => ((lo + 180) / 360) * W;
  const Y = (la: number) => ((90 - la) / 180) * H;
  const path = (ctx: Ctx2D, rings: Float32Array[]) => {
    ctx.beginPath();
    for (const r of rings) {
      for (let i = 0; i < r.length; i += 2) {
        const x = X(r[i]!);
        const y = Y(r[i + 1]!);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
  };
  const c2d = (c: OffscreenCanvas | HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true }) as Ctx2D;

  // land / lake mask
  const m = make(W, H);
  const mc = c2d(m);
  mc.fillStyle = '#000';
  mc.fillRect(0, 0, W, H);
  mc.fillStyle = '#fff';
  for (const poly of land) {
    path(mc, poly);
    mc.fill('evenodd');
  }
  mc.fillStyle = '#000';
  for (const poly of lakes) {
    path(mc, poly);
    mc.fill('evenodd');
  }
  const md = mc.getImageData(0, 0, W, H).data;
  const N = W * H;
  const INF = 1e9;
  const dl = new Float32Array(N);
  const dw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const isLand = md[i * 4]! > 127;
    dl[i] = isLand ? INF : 0;
    dw[i] = isLand ? 0 : INF;
  }
  // two-pass chamfer distance transform
  const chamfer = (d: Float32Array) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let v = d[i]!;
        if (x > 0) v = Math.min(v, d[i - 1]! + 1);
        if (y > 0) {
          v = Math.min(v, d[i - W]! + 1);
          if (x > 0) v = Math.min(v, d[i - W - 1]! + 1.414);
          if (x < W - 1) v = Math.min(v, d[i - W + 1]! + 1.414);
        }
        d[i] = v;
      }
    for (let y = H - 1; y >= 0; y--)
      for (let x = W - 1; x >= 0; x--) {
        const i = y * W + x;
        let v = d[i]!;
        if (x < W - 1) v = Math.min(v, d[i + 1]! + 1);
        if (y < H - 1) {
          v = Math.min(v, d[i + W]! + 1);
          if (x < W - 1) v = Math.min(v, d[i + W + 1]! + 1.414);
          if (x > 0) v = Math.min(v, d[i + W - 1]! + 1.414);
        }
        d[i] = v;
      }
  };
  chamfer(dl);
  chamfer(dw);
  const ic = make(W, H);
  const ix = c2d(ic);
  ix.fillStyle = '#000';
  ix.fillRect(0, 0, W, H);
  ix.fillStyle = '#fff';
  for (const poly of ice) {
    path(ix, poly);
    ix.fill('evenodd');
  }
  const idat = ix.getImageData(0, 0, W, H).data;
  const geo = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    geo[o] = md[o]!;
    geo[o + 1] = Math.min(255, dl[i]! < INF ? dl[i]! * 4.2 : 255);
    geo[o + 2] = Math.max(0, 255 - Math.min(255, dw[i]! * 5.5));
    geo[o + 3] = idat[o]!;
  }

  // biomes: soft blobs for mountains (R), deserts (G), forests (B)
  const BW = 1024;
  const BH = 512;
  const bio = make(BW, BH);
  const bc = bio.getContext('2d') as Ctx2D;
  bc.fillStyle = '#000';
  bc.fillRect(0, 0, BW, BH);
  bc.globalCompositeOperation = 'lighter';
  const blob = (la: number, lo: number, r: number, rgb: string, a: number) => {
    const x = ((lo + 180) / 360) * BW;
    const y = ((90 - la) / 180) * BH;
    const rr = (r / 360) * BW;
    const g = bc.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    bc.fillStyle = g;
    bc.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  };
  const MT = [[31,87,12,1],[34,76,7,.9],[46,-114,9,.7],[40,-108,7,.6],[57,-124,6,.5],[-15,-70,6,.9],[-35,-70,4,.8],[46,10,3.5,.8],[43,43,3,.8],[60,60,3,.4],[42,78,6,.8],[36,67,6,.7],[10,38,4,.7],[0,35,3,.3],[-4,37,2,.5],[36,138,2.5,.6],[35,-80,4,.35],[62,-150,5,.7],[-42,172,3,.7],[28,-105,5,.4],[-5,138,4,.7],[44,90,5,.5],[27,-1,4,.2],[23,6,3,.4],[19,-100,3,.6],[64,15,4,.4],[-26,28,4,.25],[-23,25,3,.15]];
  const AR = [[25,13,16,1],[22,45,11,.9],[40,100,12,.8],[-25,133,15,.85],[-24,18,8,.6],[-24,-69,4,.9],[38,-114,7,.5],[33,-110,6,.45],[31,60,9,.7],[38,70,8,.4],[17,-5,10,.5],[15,40,6,.4],[-30,142,8,.4],[44,60,7,.5],[38,25,3,.1],[40,-5,4,.25],[-35,-65,5,.3],[-45,-68,7,.4]];
  const LU = [[-3,-62,16,1],[1,22,13,1],[2,104,8,.9],[-2,138,7,.9],[15,-90,5,.55],[5,-5,7,.7],[7,80,3,.5],[46,-80,9,.45],[55,30,13,.45],[52,100,13,.4],[45,130,7,.55],[50,-2,5,.5],[35,115,8,.35],[30,-85,7,.5],[-10,-52,8,.6],[-18,-45,6,.4],[-9,30,10,.5],[-12,17,8,.4],[-37,146,3,.45],[-42,172,3,.6],[60,95,17,.55],[62,35,10,.5],[8,-75,6,.6]];
  MT.forEach((a) => blob(a[0]!, a[1]!, a[2]!, '255,0,0', a[3]!));
  AR.forEach((a) => blob(a[0]!, a[1]!, a[2]!, '0,255,0', a[3]!));
  LU.forEach((a) => blob(a[0]!, a[1]!, a[2]!, '0,0,255', a[3]!));

  // night lights from urban areas and large cities
  const lights = make(W, H);
  const lx = lights.getContext('2d') as Ctx2D;
  lx.fillStyle = '#000';
  lx.fillRect(0, 0, W, H);
  lx.globalCompositeOperation = 'lighter';
  lx.fillStyle = 'rgba(255,190,110,.85)';
  lx.strokeStyle = 'rgba(255,170,90,.7)';
  lx.lineWidth = 1.6;
  for (const r of urban) {
    path(lx, [r]);
    lx.fill();
    lx.stroke();
  }
  for (const c of P.cities) {
    const pop = c[3];
    if (pop < 3e5) continue;
    const x = X(c[2]);
    const y = Y(c[1]);
    const rr = Math.min(28, 3 + Math.sqrt(pop / 1e5) * 2.4);
    const g = lx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, 'rgba(255,200,130,.55)');
    g.addColorStop(1, 'rgba(255,160,70,0)');
    lx.fillStyle = g;
    lx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  return { W, H, geo, bio, lights };
}
