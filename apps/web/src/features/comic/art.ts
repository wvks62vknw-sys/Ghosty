/**
 * THE COMIC's drawing (FINAL ROUND, lane COMIC): a page of a comic made here, drawn on a canvas by our own code — no picture
 * model, no one's art. The scene behind (sky by the time of day, then the place: a town, a room, a park, space, the sea…),
 * the cast drawn from their kept looks (so a character is the same in every panel), the balloons laid out over the heads with
 * their tails pointing at who speaks (speech round, thought a cloud, a shout spiky, a whisper dashed), the caption boxes and
 * the sound effects lettered big. The cover is the hero large under the title. What is drawn where is given back, so a tap
 * on the page finds its panel and its balloon.
 */
import { PAGE_H, PAGE_W, panelRects, type Actor, type Balloon, type CastMember, type Comic, type Look, type Mood, type Page, type Panel, type Pose, type Scene, type Time } from './model';

const LETTER = "'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', system-ui, sans-serif";
const DISPLAY = "'Oswald', Impact, 'Arial Narrow', sans-serif";
const INK = '#111111';
const PAPER = '#fffdf6';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Drawn {
  panels: Box[];
  balloons: { panel: number; id: string; box: Box }[];
  /** each character's box, for his finger to move them */
  actors?: { panel: number; who: string; box: Box }[];
  /** the sound effect's box */
  sfxs?: { panel: number; box: Box }[];
}

// ---------------------------------------------------------------- his photos behind panels (decoded once, kept while the app is open)
const photos = new Map<string, HTMLImageElement>();
/** A photo, ready to draw now, or null (it is being decoded; `ready` is called when it can be drawn). */
export function photoOf(src: string, ready?: () => void): HTMLImageElement | null {
  let img = photos.get(src);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = src;
    photos.set(src, img);
    if (photos.size > 40) photos.delete(photos.keys().next().value as string);
  }
  if (img.complete && img.naturalWidth) return img;
  if (ready) img.addEventListener('load', () => ready(), { once: true });
  return null;
}
/** Every photo of a comic decoded (before it is saved or read, so no panel is drawn without its photo). */
export async function photosReady(c: Comic): Promise<void> {
  const all = c.pages.flatMap((pg) => pg.panels.map((p) => p.photo).filter((x): x is string => !!x));
  await Promise.all(all.map((src) => new Promise<void>((ok) => {
    const img = photoOf(src, () => ok());
    if (img) ok();
    else setTimeout(ok, 4000);
  })));
}

type C = CanvasRenderingContext2D;

// ---------------------------------------------------------------- the place
const SKY: Record<Time, [string, string]> = { day: ['#8fd3ff', '#e9f7ff'], dusk: ['#ff9a6b', '#ffd59e'], night: ['#0e1a3a', '#2b3d6e'] };
function sky(ctx: C, b: Box, t: Time, scene: Scene): void {
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  const [a, z] = scene === 'space' ? ['#05051a', '#1b1446'] : scene === 'night' ? SKY.night : SKY[t];
  g.addColorStop(0, a);
  g.addColorStop(1, z);
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}
function seeded(n: number): () => number {
  let s = n >>> 0 || 7;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function background(ctx: C, b: Box, scene: Scene, time: Time, seedN: number): number {
  const r = seeded(seedN);
  const ground = b.y + b.h * 0.8;
  const dark = time === 'night' || scene === 'night';
  const indoor = scene === 'home' || scene === 'kitchen' || scene === 'lab' || scene === 'school' || scene === 'stage';
  if (indoor) {
    const wall: Record<string, string> = { home: '#f3e3c3', kitchen: '#e6f2e2', lab: '#dfe7ee', school: '#f2ead0', stage: '#5b1a2a' };
    ctx.fillStyle = dark && scene !== 'stage' ? '#4a4a6a' : wall[scene]!;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // a window on the world (or the stage's curtains)
    if (scene === 'stage') {
      ctx.fillStyle = '#b3123a';
      for (const side of [0, 1]) {
        ctx.beginPath();
        const x0 = side ? b.x + b.w : b.x;
        ctx.moveTo(x0, b.y);
        ctx.quadraticCurveTo(x0 + (side ? -1 : 1) * b.w * 0.26, b.y + b.h * 0.4, x0 + (side ? -1 : 1) * b.w * 0.1, ground);
        ctx.lineTo(x0, ground);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,240,180,0.28)';
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, b.y);
      ctx.lineTo(b.x + b.w * 0.75, ground);
      ctx.lineTo(b.x + b.w * 0.25, ground);
      ctx.fill();
    } else {
      const wx = b.x + b.w * (0.1 + r() * 0.5);
      const ww = Math.min(b.w * 0.3, 200);
      const wy = b.y + b.h * 0.14;
      const wh = Math.min(b.h * 0.34, 170);
      sky(ctx, { x: wx, y: wy, w: ww, h: wh }, time, 'plain');
      if (dark) {
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath();
        ctx.arc(wx + ww * 0.7, wy + wh * 0.3, Math.min(ww, wh) * 0.12, 0, 7);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2);
      ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
      // the room's things
      ctx.fillStyle = scene === 'kitchen' ? '#c7d9c0' : scene === 'lab' ? '#9fb3c4' : scene === 'school' ? '#2f5d3a' : '#c49a6c';
      if (scene === 'school') {
        const bx = b.x + b.w * 0.55;
        ctx.fillRect(bx, b.y + b.h * 0.16, b.w * 0.38, b.h * 0.3);
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + 14, b.y + b.h * 0.24);
        ctx.lineTo(bx + b.w * 0.25, b.y + b.h * 0.24);
        ctx.moveTo(bx + 14, b.y + b.h * 0.32);
        ctx.lineTo(bx + b.w * 0.18, b.y + b.h * 0.32);
        ctx.stroke();
      } else {
        const tx = b.x + b.w * (r() < 0.5 ? 0.62 : 0.06);
        ctx.fillRect(tx, ground - b.h * 0.2, b.w * 0.3, b.h * 0.2);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.strokeRect(tx, ground - b.h * 0.2, b.w * 0.3, b.h * 0.2);
        if (scene === 'lab') {
          ctx.fillStyle = '#7fffd4';
          ctx.beginPath();
          ctx.arc(tx + b.w * 0.08, ground - b.h * 0.24, b.h * 0.04, 0, 7);
          ctx.fill();
          ctx.stroke();
        }
        if (scene === 'kitchen') {
          ctx.fillStyle = '#f5f5f5';
          ctx.beginPath();
          ctx.arc(tx + b.w * 0.15, ground - b.h * 0.22, b.h * 0.035, Math.PI, 0);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = scene === 'stage' ? '#6b4423' : dark ? '#3a3448' : '#b98b5e';
    ctx.fillRect(b.x, ground, b.w, b.y + b.h - ground);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, ground);
    ctx.lineTo(b.x + b.w, ground);
    ctx.stroke();
    return ground;
  }
  sky(ctx, b, time, scene);
  // the sun, the moon or the stars
  if (scene === 'space' || dark) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.4 + r() * 0.6;
      ctx.fillRect(b.x + r() * b.w, b.y + r() * b.h * 0.7, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = scene === 'space' ? '#ff8a5c' : '#fff6c9';
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.78, b.y + b.h * 0.22, Math.min(b.w, b.h) * (scene === 'space' ? 0.14 : 0.08), 0, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = time === 'dusk' ? '#ffcf5a' : '#fff3a6';
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.82, b.y + b.h * 0.18, Math.min(b.w, b.h) * 0.07, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 2; i++) {
      const cx = b.x + b.w * (0.15 + r() * 0.5);
      const cy = b.y + b.h * (0.12 + r() * 0.15);
      for (const [dx, rr] of [[0, 22], [24, 28], [52, 20]] as const) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy, rr, 0, 7);
        ctx.fill();
      }
    }
  }
  if (scene === 'space') {
    // the moon's ground
    ctx.fillStyle = '#c9c9d6';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, ground + b.h * 0.35, b.w * 0.8, b.h * 0.42, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#a9a9bb';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(b.x + r() * b.w, ground + 10 + r() * b.h * 0.12, 26, 8, 0, 0, 7);
      ctx.fill();
    }
    return ground;
  }
  if (scene === 'sea') {
    ctx.fillStyle = dark ? '#1c3d6b' : '#2f86c9';
    ctx.fillRect(b.x, b.y + b.h * 0.55, b.w, b.h * 0.45);
    ctx.strokeStyle = '#d9f1ff';
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      const yy = b.y + b.h * (0.6 + k * 0.05);
      for (let x = b.x; x < b.x + b.w; x += 40) ctx.arc(x + 20, yy, 20, Math.PI, 0);
      ctx.stroke();
    }
    ctx.fillStyle = '#f2d28b';
    ctx.fillRect(b.x, ground, b.w, b.y + b.h - ground);
    return ground;
  }
  // the land
  const land: Partial<Record<Scene, string>> = { park: '#7cc35b', forest: '#4f8f3a', town: '#9aa0a6', night: '#2e3b2e', plain: '#9fd17a' };
  if (scene === 'town') {
    for (let i = 0; i < 7; i++) {
      const bw = b.w * (0.1 + r() * 0.08);
      const bh = b.h * (0.25 + r() * 0.35);
      const bx = b.x + (i / 7) * b.w + r() * 10;
      ctx.fillStyle = ['#e07a5f', '#f2cc8f', '#81b29a', '#3d405b', '#c9ada7'][i % 5]!;
      if (dark) ctx.fillStyle = '#2d2d44';
      ctx.fillRect(bx, ground - bh, bw, bh);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, ground - bh, bw, bh);
      ctx.fillStyle = dark ? '#ffe680' : '#fefae0';
      for (let wy = ground - bh + 12; wy < ground - 26; wy += 30) for (let wx = bx + 8; wx < bx + bw - 14; wx += 22) ctx.fillRect(wx, wy, 10, 14);
    }
  }
  if (scene === 'forest' || scene === 'park' || scene === 'night') {
    const n = scene === 'forest' ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const tx = b.x + r() * b.w;
      const th = b.h * (0.3 + r() * 0.25);
      ctx.fillStyle = '#6d4c2f';
      ctx.fillRect(tx - 7, ground - th * 0.45, 14, th * 0.45);
      ctx.fillStyle = scene === 'night' ? '#1f3324' : scene === 'forest' ? '#2f6b2a' : '#3f9b3a';
      ctx.beginPath();
      if (scene === 'park') ctx.arc(tx, ground - th * 0.6, th * 0.28, 0, 7);
      else {
        ctx.moveTo(tx, ground - th);
        ctx.lineTo(tx + th * 0.26, ground - th * 0.35);
        ctx.lineTo(tx - th * 0.26, ground - th * 0.35);
      }
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  ctx.fillStyle = dark && scene !== 'night' ? '#334033' : land[scene] ?? '#9fd17a';
  ctx.fillRect(b.x, ground, b.w, b.y + b.h - ground);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(b.x, ground);
  ctx.lineTo(b.x + b.w, ground);
  ctx.stroke();
  return ground;
}

// ---------------------------------------------------------------- a character, from the look kept for them
function eyes(ctx: C, x: number, y: number, s: number, mood: Mood, face: number): void {
  const dx = s * 0.17;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, s * 0.035);
  for (const k of [-1, 1]) {
    const ex = x + k * dx + face * s * 0.04;
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.arc(ex, y + s * 0.02, s * 0.06, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (mood === 'smug') {
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.06, y);
      ctx.lineTo(ex + s * 0.06, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, y + s * 0.015, s * 0.03, 0, Math.PI);
      ctx.fill();
    } else {
      const big = mood === 'shock' || mood === 'scared' ? 1.6 : 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, y, s * 0.06 * big, s * 0.075 * big, 0, 0, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + face * s * 0.015, y + (mood === 'think' ? -s * 0.03 : mood === 'sad' ? s * 0.02 : 0), s * 0.032, 0, 7);
      ctx.fill();
    }
    // the brows say the mood
    ctx.beginPath();
    const by = y - s * 0.12;
    const tilt = mood === 'angry' ? 1 : mood === 'sad' || mood === 'scared' ? -1 : mood === 'think' ? (k > 0 ? -0.6 : 0.2) : 0;
    ctx.moveTo(ex - s * 0.07, by - k * tilt * s * 0.03 - (mood === 'shock' ? s * 0.05 : 0));
    ctx.lineTo(ex + s * 0.07, by + k * tilt * s * 0.03 - (mood === 'shock' ? s * 0.05 : 0));
    ctx.stroke();
  }
}
function mouth(ctx: C, x: number, y: number, s: number, mood: Mood): void {
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#7a1f1f';
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.beginPath();
  switch (mood) {
    case 'happy':
      ctx.arc(x, y - s * 0.03, s * 0.13, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    case 'sad':
      ctx.arc(x, y + s * 0.07, s * 0.09, 1.2 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
      return;
    case 'angry':
      ctx.rect(x - s * 0.09, y - s * 0.02, s * 0.18, s * 0.05);
      ctx.fill();
      ctx.stroke();
      return;
    case 'shock':
    case 'scared':
      ctx.ellipse(x, y + s * 0.01, s * 0.06, s * 0.09, 0, 0, 7);
      ctx.fill();
      ctx.stroke();
      return;
    case 'smug':
      ctx.moveTo(x - s * 0.08, y);
      ctx.quadraticCurveTo(x + s * 0.02, y + s * 0.05, x + s * 0.1, y - s * 0.04);
      ctx.stroke();
      return;
    case 'think':
      ctx.moveTo(x - s * 0.05, y + s * 0.01);
      ctx.lineTo(x + s * 0.06, y - s * 0.01);
      ctx.stroke();
      return;
    default:
      ctx.arc(x, y - s * 0.02, s * 0.07, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
  }
}
function head(ctx: C, L: Look, x: number, y: number, s: number, mood: Mood, face: number): void {
  ctx.lineWidth = Math.max(2.5, s * 0.045);
  ctx.strokeStyle = INK;
  const sp = L.species;
  // ears behind the head
  ctx.fillStyle = L.skin;
  if (sp === 'cat') for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + k * s * 0.38, y - s * 0.12);
    ctx.lineTo(x + k * s * 0.32, y - s * 0.62);
    ctx.lineTo(x + k * s * 0.05, y - s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (sp === 'rabbit') for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + k * s * 0.17, y - s * 0.72, s * 0.1, s * 0.36, k * 0.15, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
  if (sp === 'bear') for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + k * s * 0.32, y - s * 0.34, s * 0.14, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
  if (sp === 'alien') for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + k * s * 0.12, y - s * 0.4);
    ctx.lineTo(x + k * s * 0.24, y - s * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(x + k * s * 0.24, y - s * 0.74, s * 0.06, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = L.skin;
  }
  // the head
  ctx.beginPath();
  if (sp === 'robot') ctx.roundRect?.(x - s * 0.4, y - s * 0.42, s * 0.8, s * 0.8, s * 0.08) ?? ctx.rect(x - s * 0.4, y - s * 0.42, s * 0.8, s * 0.8);
  else if (sp === 'alien') ctx.ellipse(x, y - s * 0.04, s * 0.42, s * 0.46, 0, 0, 7);
  else ctx.arc(x, y, s * 0.4, 0, 7);
  ctx.fill();
  ctx.stroke();
  if (sp === 'robot') {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.42);
    ctx.lineTo(x, y - s * 0.6);
    ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(x, y - s * 0.63, s * 0.05, 0, 7);
    ctx.fill();
  }
  if (sp === 'dog') for (const k of [-1, 1]) {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.ellipse(x + k * s * 0.4, y - s * 0.05, s * 0.12, s * 0.28, k * 0.3, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
  // hair for a person
  if (sp === 'person' && L.hairStyle) {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    if (L.hairStyle === 2) {
      ctx.moveTo(x - s * 0.4, y - s * 0.05);
      for (let i = 0; i <= 6; i++) ctx.lineTo(x - s * 0.4 + (i * s * 0.8) / 6, y - s * (i % 2 ? 0.62 : 0.36));
      ctx.lineTo(x + s * 0.4, y - s * 0.05);
      ctx.quadraticCurveTo(x, y - s * 0.3, x - s * 0.4, y - s * 0.05);
    } else if (L.hairStyle === 3) {
      ctx.arc(x, y - s * 0.05, s * 0.45, Math.PI, 0);
      ctx.lineTo(x + s * 0.46, y + s * 0.42);
      ctx.lineTo(x + s * 0.3, y + s * 0.42);
      ctx.lineTo(x + s * 0.3, y - s * 0.1);
      ctx.lineTo(x - s * 0.3, y - s * 0.1);
      ctx.lineTo(x - s * 0.3, y + s * 0.42);
      ctx.lineTo(x - s * 0.46, y + s * 0.42);
      ctx.closePath();
    } else if (L.hairStyle === 5) {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i * Math.PI) / 6;
        ctx.moveTo(x + Math.cos(a) * s * 0.38 + s * 0.13, y + Math.sin(a) * s * 0.38);
        ctx.arc(x + Math.cos(a) * s * 0.38, y + Math.sin(a) * s * 0.38, s * 0.13, 0, 7);
      }
    } else {
      ctx.arc(x, y - s * 0.02, s * 0.42, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(x + face * s * 0.1, y - s * 0.18, x - s * 0.41, y - s * 0.08);
      if (L.hairStyle === 4) {
        ctx.moveTo(x + s * 0.18, y - s * 0.5);
        ctx.arc(x, y - s * 0.5, s * 0.18, 0, 7);
      }
    }
    ctx.fill();
    ctx.stroke();
  }
  if (sp === 'ghost') {
    ctx.fillStyle = 'rgba(160,180,220,0.35)';
    ctx.beginPath();
    ctx.arc(x - s * 0.24, y + s * 0.14, s * 0.07, 0, 7);
    ctx.arc(x + s * 0.24, y + s * 0.14, s * 0.07, 0, 7);
    ctx.fill();
  }
  eyes(ctx, x, y - s * 0.02, s, mood, face);
  if (sp === 'cat' || sp === 'dog' || sp === 'bear' || sp === 'rabbit') {
    ctx.fillStyle = sp === 'dog' || sp === 'bear' ? INK : '#ff8fa3';
    ctx.beginPath();
    ctx.ellipse(x + face * s * 0.03, y + s * 0.1, s * 0.06, s * 0.04, 0, 0, 7);
    ctx.fill();
    if (sp === 'cat') {
      ctx.lineWidth = Math.max(1.5, s * 0.02);
      for (const k of [-1, 1]) for (const dy of [0.1, 0.16]) {
        ctx.beginPath();
        ctx.moveTo(x + k * s * 0.14, y + s * dy);
        ctx.lineTo(x + k * s * 0.42, y + s * (dy - 0.03));
        ctx.stroke();
      }
    }
    mouth(ctx, x + face * s * 0.03, y + s * 0.22, s * 0.8, mood);
  } else mouth(ctx, x + face * s * 0.03, y + s * 0.2, s, mood);
  if (L.glasses && sp !== 'robot') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, s * 0.03);
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + k * s * 0.17 + face * s * 0.04, y - s * 0.02, s * 0.1, 0, 7);
      ctx.stroke();
    }
  }
  // a hat
  if (L.hat) {
    ctx.fillStyle = L.hat === 3 ? '#e63946' : L.hat === 2 ? '#222222' : L.shirt;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, s * 0.04);
    ctx.beginPath();
    if (L.hat === 1) {
      ctx.arc(x, y - s * 0.3, s * 0.34, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(x + (face > 0 ? s * 0.05 : -s * 0.55), y - s * 0.34, s * 0.5, s * 0.07);
    } else if (L.hat === 2) {
      ctx.rect(x - s * 0.24, y - s * 0.86, s * 0.48, s * 0.5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(x - s * 0.42, y - s * 0.4, s * 0.84, s * 0.07);
    } else {
      ctx.moveTo(x + s * 0.2, y - s * 0.38);
      ctx.lineTo(x + s * 0.42, y - s * 0.5);
      ctx.lineTo(x + s * 0.42, y - s * 0.26);
      ctx.closePath();
      ctx.moveTo(x + s * 0.2, y - s * 0.38);
      ctx.lineTo(x - s * 0.02, y - s * 0.5);
      ctx.lineTo(x - s * 0.02, y - s * 0.26);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
  }
}
const limb = (ctx: C, x1: number, y1: number, x2: number, y2: number, w: number, colour: string) => {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = w;
  ctx.stroke();
};
/** One of the cast, standing on `ground` at x, `size` tall. Gives back where their head is (for a balloon's tail). */
export function drawCharacter(ctx: C, m: CastMember, a: Pick<Actor, 'mood' | 'pose' | 'face'>, x: number, ground: number, size: number): { hx: number; hy: number; top: number } {
  const L = m.look;
  const s = size * L.height;
  const headR = s * 0.42;
  const pose: Pose = a.pose;
  const sit = pose === 'sit' || pose === 'fall';
  const lift = pose === 'jump' ? s * 0.2 : 0;
  const hipY = ground - (sit ? s * 0.12 : s * 0.42) - lift;
  const neckY = hipY - s * 0.42;
  const hy = neckY - headR * 0.8;
  const face = a.face;
  const tilt = pose === 'fall' ? -0.5 * face : pose === 'run' ? 0.12 * face : 0;
  ctx.save();
  ctx.translate(x, hipY);
  ctx.rotate(tilt);
  ctx.translate(-x, -hipY);
  const limbW = Math.max(6, s * 0.075);
  const sp = L.species;
  const body = sp === 'ghost' ? L.skin : sp === 'robot' ? L.skin : L.shirt;
  // legs
  if (sp === 'ghost') {
    ctx.fillStyle = L.skin;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.24, neckY);
    ctx.lineTo(x - s * 0.3, hipY + s * 0.2);
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(x - s * 0.3 + (i + 0.5) * s * 0.15, hipY + s * (i % 2 ? 0.28 : 0.1), x - s * 0.3 + (i + 1) * s * 0.15, hipY + s * 0.2);
    ctx.lineTo(x + s * 0.24, neckY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const legs = L.species === 'person' || L.species === 'robot' || L.species === 'alien' ? L.legs : L.skin;
    if (sit) {
      limb(ctx, x - s * 0.08, hipY, x + face * s * 0.3, hipY + s * 0.02, limbW, legs);
      limb(ctx, x + s * 0.08, hipY, x + face * s * 0.34, hipY + s * 0.06, limbW, legs);
    } else if (pose === 'run' || pose === 'jump') {
      limb(ctx, x, hipY, x + face * s * 0.26, hipY + s * 0.34, limbW, legs);
      limb(ctx, x, hipY, x - face * s * 0.22, hipY + s * 0.3, limbW, legs);
    } else {
      limb(ctx, x - s * 0.07, hipY, x - s * 0.1, hipY + s * 0.42, limbW, legs);
      limb(ctx, x + s * 0.07, hipY, x + s * 0.1, hipY + s * 0.42, limbW, legs);
    }
    if ((sp === 'cat' || sp === 'dog' || sp === 'rabbit') && !sit) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = limbW * 0.7 + 4;
      ctx.beginPath();
      ctx.moveTo(x - face * s * 0.12, hipY - s * 0.04);
      ctx.quadraticCurveTo(x - face * s * 0.5, hipY - s * 0.06, x - face * s * 0.42, hipY - s * (sp === 'rabbit' ? 0.04 : 0.36));
      ctx.stroke();
      ctx.strokeStyle = L.skin;
      ctx.lineWidth = limbW * 0.7;
      ctx.stroke();
    }
    // the body
    ctx.fillStyle = body;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2.5, s * 0.04);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - s * 0.2, neckY, s * 0.4, hipY - neckY + s * 0.04, s * (sp === 'robot' ? 0.03 : 0.12));
    else ctx.rect(x - s * 0.2, neckY, s * 0.4, hipY - neckY + s * 0.04);
    ctx.fill();
    ctx.stroke();
  }
  // arms, by the pose
  const arm = sp === 'person' || sp === 'alien' ? L.shirt : L.skin;
  const sh = neckY + s * 0.08;
  const hand = (hx: number, hy2: number) => {
    ctx.fillStyle = L.skin;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(hx, hy2, limbW * 0.75, 0, 7);
    ctx.fill();
    ctx.stroke();
  };
  const arms: [number, number][] =
    pose === 'cheer' || pose === 'jump' ? [[x - s * 0.36, sh - s * 0.34], [x + s * 0.36, sh - s * 0.34]]
      : pose === 'point' ? [[x + face * s * 0.56, sh - s * 0.08], [x - face * s * 0.2, sh + s * 0.3]]
        : pose === 'run' ? [[x + face * s * 0.34, sh + s * 0.04], [x - face * s * 0.3, sh + s * 0.2]]
          : pose === 'fall' ? [[x - s * 0.4, sh - s * 0.2], [x + s * 0.42, sh - s * 0.12]]
            : a.mood === 'think' ? [[x + face * s * 0.08, neckY - s * 0.02], [x - face * s * 0.22, sh + s * 0.3]]
              : a.mood === 'angry' ? [[x - s * 0.3, sh + s * 0.22], [x + s * 0.3, sh + s * 0.22]]
                : [[x - s * 0.26, sh + s * 0.32], [x + s * 0.26, sh + s * 0.32]];
  for (const [ax, ay] of arms) {
    limb(ctx, x + Math.sign(ax - x || 1) * s * 0.16, sh, ax, ay, limbW, sp === 'ghost' ? L.skin : arm);
    hand(ax, ay);
  }
  head(ctx, L, x, hy, headR * 2.2, a.mood, face);
  ctx.restore();
  // a mood's marks (sweat, steam, the shock's lines)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  if (a.mood === 'shock' || a.mood === 'scared') {
    for (let i = -2; i <= 2; i++) {
      const an = -Math.PI / 2 + i * 0.35;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(an) * headR * 1.3, hy + Math.sin(an) * headR * 1.3);
      ctx.lineTo(x + Math.cos(an) * headR * 1.7, hy + Math.sin(an) * headR * 1.7);
      ctx.stroke();
    }
  }
  if (a.mood === 'sad') {
    ctx.fillStyle = '#6ec6ff';
    ctx.beginPath();
    ctx.ellipse(x + face * headR * 0.5, hy + headR * 0.35, 5, 8, 0, 0, 7);
    ctx.fill();
  }
  if (a.mood === 'angry') {
    ctx.strokeStyle = '#d62828';
    for (const k of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + k * headR * 0.9, hy - headR * 1.05);
      ctx.lineTo(x + k * headR * 1.2, hy - headR * 1.35);
      ctx.stroke();
    }
  }
  return { hx: x + Math.sin(tilt) * (hipY - hy), hy, top: hy - headR * 1.2 };
}

// ---------------------------------------------------------------- the words: balloons, captions, sound effects
function wrap(ctx: C, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width <= maxW || !line) line = t;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}
function balloonShape(ctx: C, kind: Balloon['kind'], b: Box): void {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const rx = b.w * 0.56;
  const ry = b.h * 0.62;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = INK;
  if (kind === 'thought') {
    const n = Math.max(9, Math.round((b.w + b.h) / 30));
    const r = Math.min(26, Math.max(14, b.h * 0.22));
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(an) * rx * 0.92, cy + Math.sin(an) * ry * 0.9, r, 0, 7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.95, ry * 0.92, 0, 0, 7);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  if (kind === 'shout') {
    const k = 18;
    for (let i = 0; i <= k * 2; i++) {
      const an = (i / (k * 2)) * Math.PI * 2;
      const f = i % 2 ? 1.12 : 0.94 + 0.05 * ((i * 7) % 3);
      const px = cx + Math.cos(an) * rx * f;
      const py = cy + Math.sin(an) * ry * f;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else ctx.ellipse(cx, cy, rx, ry, 0, 0, 7);
  ctx.fill();
  ctx.stroke();
}
function tail(ctx: C, kind: Balloon['kind'], b: Box, tx: number, ty: number): void {
  const cx = b.x + b.w / 2;
  const by = b.y + b.h * 0.92;
  if (kind === 'thought') {
    for (const [f, r] of [[0.45, 11], [0.7, 7], [0.88, 4]] as const) {
      ctx.beginPath();
      ctx.arc(cx + (tx - cx) * f, by + (ty - by) * f, r, 0, 7);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }
  const spread = Math.min(26, b.w * 0.12);
  const sx = cx + Math.max(-b.w * 0.25, Math.min(b.w * 0.25, (tx - cx) * 0.3));
  ctx.beginPath();
  ctx.moveTo(sx - spread, by - 6);
  ctx.quadraticCurveTo(sx + (tx - sx) * 0.3, by + (ty - by) * 0.55, tx, ty);
  ctx.quadraticCurveTo(sx + (tx - sx) * 0.5, by + (ty - by) * 0.35, sx + spread, by - 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
function lettering(ctx: C, size: number, kind: Balloon['kind']): void {
  ctx.font = `${kind === 'whisper' ? 600 : 700} ${kind === 'shout' ? Math.round(size * 1.18) : kind === 'whisper' ? Math.round(size * 0.88) : size}px ${LETTER}`;
}
function sfx(ctx: C, b: Box, text: string, seedN: number, below = b.y, at?: [number, number]): Box | null {
  if (!text.trim()) return null;
  const r = seeded(seedN);
  ctx.save();
  const size = Math.max(40, Math.min(b.w / Math.max(4, text.length * 0.62), b.h * 0.28, 120));
  ctx.font = `700 ${size}px ${DISPLAY}`;
  let x = b.x + b.w * (0.5 + (r() - 0.5) * 0.3);
  let y = Math.min(b.y + b.h - size * 0.7, Math.max(below + size * 0.75, b.y + b.h * (0.4 + r() * 0.12)));
  if (at) {
    x = b.x + b.w * Math.max(0.05, Math.min(0.95, at[0]));
    y = b.y + b.h * Math.max(0.05, Math.min(0.95, at[1]));
  }
  const w = ctx.measureText(text.toUpperCase()).width;
  ctx.translate(x, y);
  ctx.rotate((r() - 0.5) * 0.4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.2;
  ctx.strokeText(text.toUpperCase(), 0, 0);
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, '#ffe14d');
  g.addColorStop(1, '#ff6a2b');
  ctx.fillStyle = g;
  ctx.fillText(text.toUpperCase(), 0, 0);
  ctx.restore();
  return { x: x - w / 2, y: y - size / 2, w, h: size };
}
function caption(ctx: C, b: Box, text: string, at: 'top' | 'bottom'): void {
  if (!text.trim()) return;
  const size = Math.max(22, Math.min(30, b.w / 22));
  ctx.font = `700 ${size}px ${LETTER}`;
  const lines = wrap(ctx, text.toUpperCase(), Math.min(b.w * 0.8, 560) - 24);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24;
  const hh = lines.length * size * 1.18 + 16;
  const x = b.x + 8;
  const y = at === 'top' ? b.y + 8 : b.y + b.h - hh - 8;
  ctx.fillStyle = '#ffe680';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(x, y, w, hh);
  ctx.strokeRect(x, y, w, hh);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x + 12, y + 8 + i * size * 1.18));
}

/** One panel, drawn in its box; gives back each balloon's box. The balloons are laid out first, over where each speaker
 * stands, and the cast is then sized to stand under them, so no balloon covers a face. */
export function drawPanel(ctx: C, c: Comic, p: Panel, b: Box, seedN: number, hits?: { actors: { who: string; box: Box }[]; sfx: Box | null }, ready?: () => void): { id: string; box: Box }[] {
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  const photo = p.photo ? photoOf(p.photo, ready) : null;
  let ground: number;
  if (photo) {
    // his photo, filling the panel (cut to fit, never stretched)
    const k = Math.max(b.w / photo.naturalWidth, b.h / photo.naturalHeight);
    const w = photo.naturalWidth * k;
    const hh = photo.naturalHeight * k;
    ctx.drawImage(photo, b.x + (b.w - w) / 2, b.y + (b.h - hh) / 2, w, hh);
    ground = b.y + b.h * 0.8;
  } else ground = background(ctx, b, p.scene, p.time, seedN);
  const n = p.actors.length;
  const xOf = (i: number) => {
    const a = p.actors[i]!;
    const f = Number.isFinite(a.x) ? a.x : (i + 1) / (n + 1);
    return b.x + b.w * Math.max(0.08, Math.min(0.92, f));
  };
  const xs = new Map(p.actors.map((a, i) => [a.who, xOf(i)]));
  // the balloons, in reading order from the top left, each over its speaker when there is room
  const size0 = Math.max(22, Math.min(30, b.w / 20));
  const top0 = b.y + 14 + (p.caption ? size0 * 2.5 : 0);
  let y = top0;
  const placed: { bl: Balloon; box: Box; lines: string[]; lh: number }[] = [];
  for (const bl of p.balloons) {
    lettering(ctx, size0, bl.kind);
    const maxW = Math.min(b.w * 0.6, 460);
    const lines = wrap(ctx, bl.text.toUpperCase(), maxW - 44);
    const lh = parseInt(ctx.font.split(' ')[1]!, 10) * 1.16;
    const w = Math.max(96, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 48);
    const hh = lines.length * lh + 30;
    const pad = w * 0.08 + 8;
    const sx = xs.get(bl.who);
    let bx = sx != null ? sx - w / 2 : b.x + pad;
    bx = Math.max(b.x + pad, Math.min(b.x + b.w - w - pad, bx));
    const hits = (yy: number) => placed.find((q) => yy < q.box.y + q.box.h + 14 && yy + hh > q.box.y - 14 && bx < q.box.x + q.box.w + pad && bx + w > q.box.x - pad);
    let clash = hits(y);
    while (clash) {
      y = clash.box.y + clash.box.h + 16;
      clash = hits(y);
    }
    placed.push({ bl, box: { x: bx, y, w, h: hh }, lines, lh });
    // (where his finger moved it: kept inside the panel)
    const last = placed[placed.length - 1]!;
    if (bl.dx || bl.dy) {
      last.box.x = Math.max(b.x + 4, Math.min(b.x + b.w - w - 4, bx + (bl.dx ?? 0)));
      last.box.y = Math.max(b.y + 4, Math.min(b.y + b.h - hh - 4, y + (bl.dy ?? 0)));
    }
    // the next balloon may sit beside this one (same row) if it fits; else below
    y = Math.max(top0, y);
  }
  const bottom = placed.reduce((m, q) => Math.max(m, q.box.y + q.box.h), b.y + (p.caption ? size0 * 2.5 : 0));
  // the cast, sized for the shot and to stand under the balloons (a close shot is cut off at the chest)
  const tallest = Math.max(1, ...p.actors.map((a) => c.cast.find((m) => m.id === a.who)?.look.height ?? 1));
  let size: number;
  let groundY: number;
  if (p.shot === 'close') {
    // big, cut off at the chest: the heads just under the balloons
    size = Math.min(b.h * 0.75, b.w * (n > 1 ? 0.36 : 0.5));
    groundY = Math.max(bottom + 26, b.y + b.h * 0.1) + 1.72 * size * tallest;
  } else {
    const unit = p.shot === 'wide' ? 0.42 : 0.56;
    groundY = p.shot === 'mid' ? b.y + b.h * 0.95 : ground + b.h * 0.06;
    const room = (groundY - bottom - 22) / (1.78 * tallest);
    size = Math.max(Math.min(b.h, b.w) * 0.2, Math.min(b.h * unit, b.w * 0.42, placed.length ? room : Infinity));
  }
  const heads = new Map<string, { hx: number; hy: number; top: number }>();
  p.actors.forEach((a, i) => {
    const m = c.cast.find((x) => x.id === a.who);
    if (!m) return;
    const hd = drawCharacter(ctx, m, a, xOf(i), groundY, size);
    heads.set(a.who, hd);
    const half = size * 0.45 * m.look.height;
    hits?.actors.push({ who: a.who, box: { x: xOf(i) - half, y: Math.max(b.y, hd.top), w: half * 2, h: Math.min(b.y + b.h, groundY) - Math.max(b.y, hd.top) } });
  });
  const fx = sfx(ctx, b, p.sfx, seedN + 3, bottom, p.sfxAt);
  if (hits) hits.sfx = fx;
  // tails first, then the balloons over them, then the words
  const out: { id: string; box: Box }[] = [];
  for (const { bl, box } of placed) {
    const who = heads.get(bl.who);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.setLineDash(bl.kind === 'whisper' ? [10, 8] : []);
    if (who) tail(ctx, bl.kind, box, who.hx, Math.max(box.y + box.h + 18, who.top - 4));
    ctx.setLineDash(bl.kind === 'whisper' ? [10, 8] : []);
    balloonShape(ctx, bl.kind, box);
    ctx.setLineDash([]);
  }
  for (const { bl, box, lines, lh } of placed) {
    lettering(ctx, size0, bl.kind);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, box.x + box.w / 2, box.y + 15 + i * lh));
    out.push({ id: bl.id, box });
  }
  caption(ctx, b, p.caption, 'top');
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  return out;
}

/** A page of the comic, drawn whole on the canvas (sized to it). */
export function drawPage(cv: HTMLCanvasElement, c: Comic, pg: Page, n: number, ready?: () => void): Drawn {
  cv.width = PAGE_W;
  cv.height = PAGE_H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const rects = panelRects(pg);
  const drawn: Drawn = { panels: rects, balloons: [], actors: [], sfxs: [] };
  pg.panels.slice(0, rects.length).forEach((p, i) => {
    const hits: { actors: { who: string; box: Box }[]; sfx: Box | null } = { actors: [], sfx: null };
    for (const bl of drawPanel(ctx, c, p, rects[i]!, (c.seed ^ (n * 131 + i * 17)) >>> 0, hits, ready)) drawn.balloons.push({ panel: i, ...bl });
    for (const a of hits.actors) drawn.actors!.push({ panel: i, ...a });
    if (hits.sfx) drawn.sfxs!.push({ panel: i, box: hits.sfx });
  });
  ctx.font = `600 22px ${LETTER}`;
  ctx.fillStyle = '#555555';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(String(n + 1), PAGE_W / 2, PAGE_H - 6);
  return drawn;
}

/** The cover: the title lettered big, the hero large, the friend and the rival behind, the tagline. */
export function drawCover(cv: HTMLCanvasElement, c: Comic): void {
  cv.width = PAGE_W;
  cv.height = PAGE_H;
  const ctx = cv.getContext('2d')!;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const scene = c.pages[0]?.panels[0]?.scene ?? 'town';
  const box = { x: 0, y: 0, w: PAGE_W, h: PAGE_H };
  background(ctx, box, scene, 'day', c.seed);
  // the burst behind the hero
  ctx.save();
  ctx.translate(PAGE_W / 2, PAGE_H * 0.6);
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24);
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.35)' : 'rgba(255,214,90,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-60, -PAGE_H);
    ctx.lineTo(60, -PAGE_H);
    ctx.fill();
  }
  ctx.restore();
  const hero = c.cast.find((m) => m.role === 'hero') ?? c.cast[0];
  const friend = c.cast.find((m) => m.role === 'friend');
  const rival = c.cast.find((m) => m.role === 'rival');
  if (rival) drawCharacter(ctx, rival, { mood: 'smug', pose: 'point', face: -1 }, PAGE_W * 0.8, PAGE_H * 0.86, 300);
  if (friend) drawCharacter(ctx, friend, { mood: 'shock', pose: 'stand', face: 1 }, PAGE_W * 0.2, PAGE_H * 0.88, 300);
  if (hero) drawCharacter(ctx, hero, { mood: 'happy', pose: 'cheer', face: 1 }, PAGE_W * 0.5, PAGE_H * 0.96, 480);
  // the masthead
  ctx.fillStyle = '#d62828';
  ctx.fillRect(0, 0, PAGE_W, 300);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, PAGE_W - 8, 292);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 130;
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const words = c.title.toUpperCase();
  while (ctx.measureText(words).width > PAGE_W - 80 && size > 50) {
    size -= 6;
    ctx.font = `700 ${size}px ${DISPLAY}`;
  }
  const lines = ctx.measureText(words).width > PAGE_W - 80 ? wrap(ctx, words, PAGE_W - 80) : [words];
  lines.slice(0, 2).forEach((l, i) => {
    const yy = 150 + (i - (Math.min(2, lines.length) - 1) / 2) * size * 0.95;
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = INK;
    ctx.strokeText(l, PAGE_W / 2, yy);
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(l, PAGE_W / 2, yy);
  });
  ctx.font = `700 30px ${DISPLAY}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`No. ${c.series?.n ?? 1}`, 26, 34);
  ctx.textAlign = 'right';
  ctx.fillText('GHOSTY COMICS', PAGE_W - 26, 34);
  // the tagline, in a caption box
  caption(ctx, { x: 30, y: 320, w: PAGE_W - 60, h: 200 }, c.tagline, 'top');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, PAGE_W, PAGE_H);
}

/** Which panel and balloon a tap at page coordinates is on. */
export function hitOf(d: Drawn, x: number, y: number): { panel: number; balloon: string; actor: string; sfx: boolean } {
  const inside = (q: Box) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h;
  const bl = [...d.balloons].reverse().find((q) => inside(q.box));
  const fx = bl ? undefined : [...(d.sfxs ?? [])].reverse().find((q) => inside(q.box));
  const ac = bl || fx ? undefined : [...(d.actors ?? [])].reverse().find((q) => inside(q.box));
  const panel = bl?.panel ?? fx?.panel ?? ac?.panel ?? d.panels.findIndex(inside);
  return { panel, balloon: bl?.id ?? '', actor: ac?.who ?? '', sfx: !!fx };
}
