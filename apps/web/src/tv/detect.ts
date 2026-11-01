/**
 * TV MODE (BRIEF-REST-C part 3): the pure parts — is this a television, and where the focus goes next. No DOM (unit-tested
 * in apps/edge/test/restc.test.mjs).
 *
 * A TV-SHAPED SCREEN: landscape, at least 1,100 px wide, and either a television's or a console's own browser (the PS5's
 * hidden browser says "PlayStation" in its name; smart TVs say Tizen, webOS, BRAVIA, HbbTV…), or a screen with no touch
 * and no fine pointer (a remote or a controller moving a pointer is coarse or none). A computer with a mouse is not a
 * television even when it is wide; a tablet held sideways is not either (it has touch). SETTINGS → THEME → TV MODE
 * turns it on (or off) whatever the screen is.
 *
 * READING ORDER: the controls in rows, top to bottom (two controls are in one row when their middles are within half the
 * shorter one's height), left to right within a row. The d-pad's LEFT and RIGHT step back and forth through that order;
 * UP and DOWN go to the nearest row above or below, to the control there nearest the same column.
 */
export const TV_AGENT = /PlayStation|Xbox|Nintendo|SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|HbbTV|\bAFT[A-Z]|CrKey|GoogleTV|Android ?TV|Roku|VIERA|AppleTV|TV Safari/i;

export interface ScreenFacts {
  /** The window's size, CSS px. */
  w: number;
  h: number;
  /** The main pointer: fine (a mouse), coarse (a finger, a remote), or none. */
  pointer: 'fine' | 'coarse' | 'none';
  /** How many touch points the screen takes (0: no touch). */
  touch: number;
  agent: string;
}

/** Does this look like a television (or a console on one)? */
export function tvShaped(s: ScreenFacts): boolean {
  if (!(s.w >= 1100 && s.w > s.h)) return false;
  if (TV_AGENT.test(s.agent)) return true;
  return s.touch === 0 && s.pointer !== 'fine';
}

export type TvSetting = 'auto' | 'on' | 'off';
/** TV mode now: his setting, else the screen's shape. */
export const tvWanted = (setting: TvSetting, s: ScreenFacts): boolean => setting === 'on' || (setting === 'auto' && tvShaped(s));

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Dir = 'up' | 'down' | 'left' | 'right';

const midY = (b: Box) => b.y + b.h / 2;
const midX = (b: Box) => b.x + b.w / 2;

/** The rows of the boxes (indices), top to bottom, each left to right. */
export function rows(boxes: Box[]): number[][] {
  const idx = boxes.map((_, i) => i).sort((a, b) => midY(boxes[a]!) - midY(boxes[b]!) || boxes[a]!.x - boxes[b]!.x);
  const out: number[][] = [];
  for (const i of idx) {
    const row = out[out.length - 1];
    const b = boxes[i]!;
    // one row: this middle is within half the shorter height of the row's first box
    if (row && Math.abs(midY(b) - midY(boxes[row[0]!]!)) <= Math.min(b.h, boxes[row[0]!]!.h) / 2) row.push(i);
    else out.push([i]);
  }
  return out.map((r) => r.sort((a, b) => boxes[a]!.x - boxes[b]!.x));
}

/** All the boxes in reading order (indices). */
export const readingOrder = (boxes: Box[]): number[] => rows(boxes).flat();

/** Where the focus goes from box `cur` (−1: nowhere yet) for a d-pad direction; the same index when there is nowhere to go. */
export function nextFocus(boxes: Box[], cur: number, dir: Dir): number {
  if (!boxes.length) return -1;
  const order = readingOrder(boxes);
  if (cur < 0 || cur >= boxes.length) return order[0]!;
  const at = order.indexOf(cur);
  if (dir === 'left') return order[Math.max(0, at - 1)]!;
  if (dir === 'right') return order[Math.min(order.length - 1, at + 1)]!;
  const rs = rows(boxes);
  const r = rs.findIndex((row) => row.includes(cur));
  const target = rs[dir === 'up' ? r - 1 : r + 1];
  if (!target) return cur;
  const x = midX(boxes[cur]!);
  return target.reduce((best, i) => (Math.abs(midX(boxes[i]!) - x) < Math.abs(midX(boxes[best]!) - x) ? i : best), target[0]!);
}

/** "TV mode on", "turn on TV mode", "TV mode off", "switch off the TV layout" → on / off; null when it is not about TV mode. */
export function tvAsked(text: string): 'on' | 'off' | null {
  const t = text.toLowerCase().trim().replace(/[.!]+$/, '');
  if (!/\btv (?:mode|layout)\b|\btelevision mode\b/.test(t) || t.split(/\s+/).length > 8) return null;
  if (/\b(?:off|stop|leave|exit|no more|disable)\b/.test(t)) return 'off';
  if (/\b(?:on|start|use|switch to|go to|enable|turn on)\b/.test(t)) return 'on';
  return null;
}

/** The standard gamepad's buttons the TV layout reads: the d-pad, A (✕ on a PlayStation pad) and B (○). */
export const PAD = { up: 12, down: 13, left: 14, right: 15, a: 0, b: 1 } as const;
