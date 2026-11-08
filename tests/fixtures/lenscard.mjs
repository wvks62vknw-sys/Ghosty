// The Lens's test card (BRIEF-LENS): what the fake camera shows when a spec wants the one view to have something to tag.
// Chromium's own fake camera plays a moving test pattern; with --use-file-for-fake-video-capture it plays a file instead, so
// the card is drawn here (a line of text, a QR code, a lemon), turned into a still y4m video and handed to the browser.
// Static on purpose: identical frames are a steady frame, the thing the heavy detectors wait for.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixture = (name) => readFileSync(new URL(`./${name}`, import.meta.url));
export const CARD = { w: 640, h: 480 };

/** Draw the card in a page of `browser` and return its RGBA pixels. `parts`: which of 'text', 'page' (a page of print), 'code', 'object' to draw. */
async function pixels(browser, parts) {
  const page = await browser.newPage();
  const data = await page.evaluate(async ({ w, h, parts, qr, lemon }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    if (parts.includes('text')) {
      g.fillStyle = '#000';
      g.font = 'bold 44px sans-serif';
      g.fillText('GHOSTY READS THIS', 92, 78);
      g.font = '34px sans-serif';
      g.fillText('Second line of the note', 92, 128);
    }
    if (parts.includes('page')) {
      // a page of print (THE LENS HOTFIX): a headline, two columns of paragraphs and a caption, as the text check finds many regions in it
      g.fillStyle = '#000';
      g.font = 'bold 30px sans-serif';
      g.fillText('THE WEEK AT THE HARBOUR', 40, 52);
      g.font = '19px sans-serif';
      const words = ['Boats came in early with the tide', 'and the market was busy by seven', 'Fish was sold from the open stalls', 'while the gulls waited on the wall', 'Nobody minded the cold that morning', 'because the coffee was hot and cheap'];
      for (let col = 0; col < 2; col++) for (let para = 0; para < 2; para++) for (let i = 0; i < words.length; i++) g.fillText(words[(i + col * 2 + para) % words.length], 40 + col * 300, 100 + para * 150 + i * 22);
      g.font = '15px sans-serif';
      g.fillText('Photograph and words from the harbour office', 40, 440);
    }
    if (parts.includes('code')) {
      g.imageSmoothingEnabled = false;
      g.drawImage(await load(`data:image/png;base64,${qr}`), 438, 318, 128, 128);
    }
    if (parts.includes('object')) g.drawImage(await load(`data:image/jpeg;base64,${lemon}`), 210, 170, 240, 199);
    const px = g.getImageData(0, 0, w, h).data;
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < px.length; i += chunk) s += String.fromCharCode(...px.subarray(i, i + chunk));
    return btoa(s);
  }, { ...CARD, parts, qr: fixture('qr-url.png').toString('base64'), lemon: fixture('lemon.jpg').toString('base64') });
  await page.close();
  return Buffer.from(data, 'base64');
}

/** RGBA → planar I420 (BT.601, limited range: what a y4m of 420 carries). */
function i420(rgba, w, h) {
  const y = Buffer.alloc(w * h);
  const u = Buffer.alloc((w / 2) * (h / 2));
  const v = Buffer.alloc((w / 2) * (h / 2));
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const p = (j * w + i) * 4;
      const r = rgba[p], gg = rgba[p + 1], b = rgba[p + 2];
      y[j * w + i] = Math.max(16, Math.min(235, Math.round(16 + 0.257 * r + 0.504 * gg + 0.098 * b)));
      if (j % 2 === 0 && i % 2 === 0) {
        const k = (j / 2) * (w / 2) + i / 2;
        u[k] = Math.max(16, Math.min(240, Math.round(128 - 0.148 * r - 0.291 * gg + 0.439 * b)));
        v[k] = Math.max(16, Math.min(240, Math.round(128 + 0.439 * r - 0.368 * gg - 0.071 * b)));
      }
    }
  }
  return Buffer.concat([y, u, v]);
}

/**
 * Make the card's video file and return its path (pass it to chromium.launch as
 * `--use-file-for-fake-video-capture=<path>`). `browser` draws it; a second browser takes the flag.
 */
export async function makeCardVideo(browser, parts = ['text', 'code', 'object'], name = 'lenscard') {
  const rgba = await pixels(browser, parts);
  const frame = i420(rgba, CARD.w, CARD.h);
  const head = Buffer.from(`YUV4MPEG2 W${CARD.w} H${CARD.h} F10:1 Ip A1:1 C420jpeg\n`);
  const frames = [];
  for (let n = 0; n < 5; n++) frames.push(Buffer.from('FRAME\n'), frame);
  const dir = join(tmpdir(), 'ghosty-lens-card');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.y4m`);
  writeFileSync(path, Buffer.concat([head, ...frames]));
  return path;
}
