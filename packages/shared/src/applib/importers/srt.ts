/** A subtitles file (SRT or WebVTT): every line with its time, to search and read. */
import type { Rec } from './input';

const secsOf = (h: string, m: string, s: string, f: string) => +h * 3600 + +m * 60 + +s + +(f || 0) / 10 ** (f?.length || 1);
const clock = (t: number) => {
  const s = Math.floor(t);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function subtitleRecords(text: string): Rec[] {
  const out: Rec[] = [];
  const blocks = text.replace(/\r/g, '').replace(/^﻿/, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const m = /(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})\s*-->\s*(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/.exec(lines[i]!);
    if (!m) continue;
    const start = secsOf(m[1]! ?? '0', m[2]!, m[3]!, m[4]!);
    const end = secsOf(m[5]! ?? '0', m[6]!, m[7]!, m[8]!);
    const line = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '').trim();
    if (!line) continue;
    const n = out.length + 1;
    out.push({ _key: `${start}|${line.slice(0, 40)}`, n, start: clock(start), secs: Math.round((end - start) * 10) / 10, line, words: line.split(/\s+/).filter(Boolean).length });
  }
  return out;
}
