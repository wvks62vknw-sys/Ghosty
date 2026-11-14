/**
 * QR AND POSTER (NEXT ROUND, sites.s2 with sites.u4): any published page as a QR code, and as a printable poster (A4) or flyer (A6) with
 * its title, its QR code and its address, drawn here on the phone as a picture he saves, shares or prints. Nothing is sent anywhere;
 * the QR code is made on the phone (convert/qr.ts). A domain of his own appears only if he already has one: the address is the page's.
 */
import { makeQr, qrSvg, type Qr } from '../convert/qr';
import { saveBlob, shareBlob } from '../convert/run';
import { h } from '../core/dom';
import { button, modal, toast } from '../ui/components';

/** A4 and A6 at 150 dots an inch: big enough to print sharp, small enough to make quickly. */
export const SIZES = { poster: { w: 1240, h: 1754, label: 'Poster (A4)' }, flyer: { w: 620, h: 874, label: 'Flyer (A6)' } } as const;
export type PosterSize = keyof typeof SIZES;

/** Words wrapped to a width, at most `max` lines (the last one ends with … when cut). */
function wrapLines(g: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (g.measureText(next).width <= width || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = `${kept[max - 1]!.replace(/\s*\S*$/, '')}…`;
    return kept;
  }
  return lines;
}

/** The poster or flyer as a PNG: black on white, so it prints well anywhere. */
export async function posterPng(title: string, url: string, size: PosterSize, q: Qr = makeQr(url, 'Q')): Promise<Blob> {
  const { w, h: ht } = SIZES[size];
  const c = document.createElement('canvas');
  c.width = w;
  c.height = ht;
  const g = c.getContext('2d');
  if (!g) throw new Error('no canvas');
  const u = w / 1240;
  g.fillStyle = 'white';
  g.fillRect(0, 0, w, ht);
  g.fillStyle = 'black';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  // the title
  g.font = `700 ${Math.round(96 * u)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  let y = Math.round(130 * u);
  for (const line of wrapLines(g, title, w - 200 * u, 3)) {
    g.fillText(line, w / 2, y);
    y += Math.round(112 * u);
  }
  // the QR code, with its quiet zone
  const side = Math.round(820 * u);
  const cells = q.size + 8;
  const cell = side / cells;
  const qx = Math.round((w - side) / 2);
  const qy = Math.round(Math.max(y + 60 * u, ht * 0.3));
  for (let r = 0; r < q.size; r++) for (let k = 0; k < q.size; k++) if (q.modules[r]![k]) g.fillRect(qx + (k + 4) * cell, qy + (r + 4) * cell, Math.ceil(cell), Math.ceil(cell));
  // the call and the address
  g.font = `600 ${Math.round(56 * u)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  g.fillText('Scan with your phone camera', w / 2, qy + side + Math.round(40 * u));
  g.font = `400 ${Math.round(40 * u)}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  let ay = qy + side + Math.round(120 * u);
  for (const line of wrapLines(g, url.replace(/^https?:\/\//, ''), w - 160 * u, 2)) {
    g.fillText(line, w / 2, ay);
    ay += Math.round(52 * u);
  }
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('could not make the picture');
  return blob;
}

const fileOf = (title: string, size: PosterSize) => `${title.replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'Page'} ${size}.png`;

/** The sheet: the page's QR code, and the poster and the flyer to save or share. */
export function openPoster(title: string, url: string): void {
  let q: Qr;
  try {
    q = makeQr(url, 'Q');
  } catch {
    toast('That address is too long for a QR code.', 'warn');
    return;
  }
  const said = h('p.note.psaid', { 'aria-live': 'polite' });
  const qrBox = h('div.pqr', { role: 'img', 'aria-label': `QR code for ${url.replace(/^https?:\/\//, '')}` });
  qrBox.innerHTML = qrSvg(q, 6); // drawn by our own encoder from the page's address: only rects, no text from outside
  const keys = (Object.keys(SIZES) as PosterSize[]).map((size) =>
    h('div.prow', h('b', SIZES[size].label),
      button('SAVE', async () => {
        said.textContent = `Making the ${size} on this phone…`;
        try {
          saveBlob(await posterPng(title, url, size, q), fileOf(title, size));
          said.textContent = `Saved: ${fileOf(title, size)}. Print it from your Files or Photos.`;
        } catch {
          said.textContent = 'I could not make the picture. Try again in a moment.';
        }
      }),
      button('SHARE', async () => {
        said.textContent = `Making the ${size} on this phone…`;
        try {
          const blob = await posterPng(title, url, size, q);
          if (!(await shareBlob(blob, fileOf(title, size)))) saveBlob(blob, fileOf(title, size));
          said.textContent = `Ready: ${fileOf(title, size)}.`;
        } catch {
          said.textContent = 'I could not make the picture. Try again in a moment.';
        }
      })));
  modal(`QR and poster · ${title}`, h('div.psheet', h('p.note', 'Point a phone camera at it to open the page. The poster and flyer carry the title, this code and the address, black on white so they print well.'), qrBox, h('p.note.paddr', url.replace(/^https?:\/\//, '')), ...keys, said));
}
