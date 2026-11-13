/**
 * SUBTITLES (BRIEF-EDITOR-VIDEO): cues written as .srt and .vtt and read back, and the pieces of at most 25 seconds the clip's
 * sound is cut into for his brain's hearing route. Pure.
 */
import type { Cue } from './model';

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, '0');
function stamp(ms: number, comma: boolean): string {
  const t = Math.max(0, Math.round(ms));
  return `${pad(t / 3_600_000)}:${pad((t / 60_000) % 60)}:${pad((t / 1000) % 60)}${comma ? ',' : '.'}${pad(t % 1000, 3)}`;
}
export const toSrt = (cues: Cue[]): string => cues.map((c, i) => `${i + 1}\n${stamp(c.start, true)} --> ${stamp(c.end, true)}\n${c.text}\n`).join('\n');
export const toVtt = (cues: Cue[]): string => `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, false)} --> ${stamp(c.end, false)}${c.pos === 'top' ? ' line:10%' : ''}\n${c.text}\n`).join('\n')}`;

const unstamp = (s: string): number => {
  const m = /^(?:(\d+):)?(\d+):(\d+)[,.](\d{1,3})$/.exec(s.trim());
  return m ? Number(m[1] ?? 0) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1000 + Number(m[4]!.padEnd(3, '0')) : NaN;
};
/** Cues out of .srt or .vtt text (blank-line separated blocks; a block without a time line is skipped). */
export function parseCues(text: string): Cue[] {
  const out: Cue[] = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const m = /^(\S+)\s*-->\s*(\S+)(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const start = unstamp(m[1]!);
    const end = unstamp(m[2]!);
    const body = lines.slice(i + 1).join('\n');
    if (Number.isFinite(start) && Number.isFinite(end) && body) out.push({ start, end, text: body, pos: /line:\s*(?:[0-4]?\d)%/.test(m[3]!) ? 'top' : 'bottom' });
  }
  return out;
}

/** The pieces a sound is cut into for the hearing route: [from, to] in ms, none longer than `max` ms. */
export function pieces(totalMs: number, max = 25_000): [number, number][] {
  const out: [number, number][] = [];
  for (let a = 0; a < totalMs; a += max) out.push([a, Math.min(totalMs, a + max)]);
  return out;
}

/** A piece's words laid as cues across its stretch, a line of about `per` words each, the time shared by their length. */
export function cuesFromWords(text: string, from: number, to: number, per = 7): Cue[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(' '));
  const chars = lines.reduce((n, l) => n + l.length, 0);
  let at = from;
  return lines.map((text, i) => {
    const end = i === lines.length - 1 ? to : Math.round(at + ((to - from) * text.length) / chars);
    const c: Cue = { start: Math.round(at), end, text, pos: 'bottom' };
    at = end;
    return c;
  });
}

/** The cue showing at time t (or none). */
export const cueAt = (cues: Cue[], t: number): Cue | undefined => cues.find((c) => t >= c.start && t < c.end);
