/**
 * THE PLAN (BRIEF-REST-D 1a): a design's 2-D views drawn by code on a canvas — walls or boards, the openings, the door's
 * swing, dimension lines with their sizes, a title over each view and a scale bar — one under the other at one scale, so a
 * metre is the same length in each. White lines on the blueprint blue, and the same canvas saved as a PNG. VoiceOver reads
 * the views' own words (kits.ts), set as the canvas's label.
 */
import type { Design, Item2D, View2D } from './kits';
import { ESTIMATE } from './prices';

const INK = '#e9f3ff';
const FAINT = 'rgba(233,243,255,0.45)';
const PAPER = '#0d2b4a';

/** Draw the design's views into the canvas, `cssW` wide; returns the scale (px a metre, in CSS pixels). */
export function drawPlan(c: HTMLCanvasElement, d: Design, cssW: number, dpr = Math.min(2, globalThis.devicePixelRatio || 1)): number {
  const views = d.views;
  const gap = 34;
  const head = 26;
  const maxW = Math.max(...views.map((v) => v.w), 1);
  const scale = Math.max(20, Math.min(220, (cssW - 24) / maxW));
  const heights = views.map((v) => v.h * scale + head);
  const cssH = Math.round(heights.reduce((s, x) => s + x, 0) + gap * Math.max(0, views.length - 1) + 54);
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  const g = c.getContext('2d');
  if (!g) return scale;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, cssW, cssH);
  // a faint grid every half metre
  g.strokeStyle = 'rgba(233,243,255,0.06)';
  g.lineWidth = 1;
  for (let x = 0; x < cssW; x += scale / 2) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, cssH);
    g.stroke();
  }
  for (let y = 0; y < cssH; y += scale / 2) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(cssW, y);
    g.stroke();
  }
  let top = 0;
  views.forEach((v, i) => {
    const ox = Math.round((cssW - v.w * scale) / 2);
    g.fillStyle = INK;
    g.font = '600 12px -apple-system, system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(v.title, Math.max(8, ox), top + 16);
    drawView(g, v, ox, top + head, scale);
    top += heights[i]! + gap;
  });
  // the scale bar: one metre, and the estimate line
  const y = cssH - 30;
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(12, y);
  g.lineTo(12 + scale, y);
  g.moveTo(12, y - 5);
  g.lineTo(12, y + 5);
  g.moveTo(12 + scale, y - 5);
  g.lineTo(12 + scale, y + 5);
  g.stroke();
  g.font = '11px -apple-system, system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('1 m', 16 + scale, y + 4);
  g.fillStyle = FAINT;
  g.textAlign = 'right';
  g.fillText(ESTIMATE, cssW - 10, y + 4);
  g.textAlign = 'left';
  g.fillText(d.title, 12, cssH - 10);
  return scale;
}

function drawView(g: CanvasRenderingContext2D, v: View2D, ox: number, oy: number, s: number): void {
  // y is up in the drawing: flip it inside the view's box
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + (v.h - y) * s;
  for (const it of v.items) drawItem(g, it, X, Y, s);
}

function drawItem(g: CanvasRenderingContext2D, it: Item2D, X: (x: number) => number, Y: (y: number) => number, s: number): void {
  g.setLineDash([]);
  switch (it.t) {
    case 'rect': {
      const x = X(it.x);
      const y = Y(it.y + it.h);
      const w = it.w * s;
      const h = it.h * s;
      if (it.k === 'fill') {
        g.fillStyle = 'rgba(233,243,255,0.05)';
        g.fillRect(x, y, w, h);
        break;
      }
      g.fillStyle = it.k === 'wall' ? 'rgba(233,243,255,0.85)' : it.k === 'board' ? 'rgba(233,243,255,0.55)' : it.k === 'glass' ? 'rgba(150,210,255,0.5)' : it.k === 'ground' ? 'rgba(233,243,255,0.3)' : it.k === 'open' ? 'rgba(13,43,74,0.9)' : 'rgba(233,243,255,0.14)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = INK;
      g.lineWidth = it.k === 'part' || it.k === 'open' ? 1 : 1.2;
      if (it.k === 'part') g.setLineDash([4, 3]);
      g.strokeRect(x, y, w, h);
      if (it.label) {
        g.fillStyle = INK;
        g.font = '10px -apple-system, system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(it.label, x + w / 2, y + h / 2 + 3);
      }
      break;
    }
    case 'line': {
      g.strokeStyle = it.k === 'thin' ? FAINT : INK;
      g.lineWidth = it.k === 'roof' ? 2.4 : it.k === 'thin' ? 1 : 1.6;
      if (it.k === 'dash') g.setLineDash([5, 4]);
      g.beginPath();
      it.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      if (it.close) g.closePath();
      g.stroke();
      break;
    }
    case 'arc': {
      g.strokeStyle = FAINT;
      g.lineWidth = 1;
      g.setLineDash([3, 3]);
      g.beginPath();
      // the drawing's angles are measured with y up; the canvas's with y down
      g.arc(X(it.x), Y(it.y), it.r * s, -it.a1, -it.a0);
      g.stroke();
      break;
    }
    case 'dim': {
      const [ax, ay] = it.a;
      const [bx, by] = it.b;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      // the offset is to the left of a → b
      const nx = (-(by - ay) / len) * it.off;
      const ny = ((bx - ax) / len) * it.off;
      const p1 = [X(ax + nx), Y(ay + ny)] as const;
      const p2 = [X(bx + nx), Y(by + ny)] as const;
      g.strokeStyle = INK;
      g.fillStyle = INK;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(X(ax), Y(ay));
      g.lineTo(p1[0], p1[1]);
      g.moveTo(X(bx), Y(by));
      g.lineTo(p2[0], p2[1]);
      g.moveTo(p1[0], p1[1]);
      g.lineTo(p2[0], p2[1]);
      g.stroke();
      for (const [p, q] of [[p1, p2], [p2, p1]] as const) {
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.lineTo(p[0] + 7 * Math.cos(ang + 0.35), p[1] + 7 * Math.sin(ang + 0.35));
        g.lineTo(p[0] + 7 * Math.cos(ang - 0.35), p[1] + 7 * Math.sin(ang - 0.35));
        g.closePath();
        g.fill();
      }
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      g.save();
      g.translate(mx, my);
      let ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      g.rotate(ang);
      g.font = '600 11px -apple-system, system-ui, sans-serif';
      g.textAlign = 'center';
      const w = g.measureText(it.text).width + 8;
      g.fillStyle = PAPER;
      g.fillRect(-w / 2, -8, w, 15);
      g.fillStyle = INK;
      g.fillText(it.text, 0, 4);
      g.restore();
      void s;
      break;
    }
    default: {
      g.fillStyle = INK;
      g.font = '11px -apple-system, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(it.text, X(it.x), Y(it.y));
    }
  }
}

/** The plan as a PNG (drawn afresh at a print-friendly width). */
export function planPng(d: Design): Promise<Blob | null> {
  const c = document.createElement('canvas');
  drawPlan(c, d, 900, 2);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}
