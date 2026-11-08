/**
 * [tabs] The instruments of the cards the sheets' screens brought to their hubs (BRIEF-TABS 3; shell/hubcards.ts), drawn in the
 * hubs' own line style (ui/instruments.ts: `ln` a line, `ln2` a faint one, `lit` the accent, `fl` a lit dot): each a small
 * drawing of what the screen is for, with the part that reads its state lit from that state — the month's biggest spends, the
 * days moved this week, the jobs ticked, the days with something due, the accounts linked, the lights on. Nothing is lit
 * from a reading the phone has not got: the drawing is there, unlit.
 */
import { svgEl } from '../core/dom';

const f = (n: number) => +n.toFixed(2);
const path = (cls: string, d: string) => svgEl('path', { class: cls, d });
const dot = (cls: string, cx: number, cy: number, r: number) => svgEl('circle', { class: cls, cx: f(cx), cy: f(cy), r: f(r) });
const box = (cls: string, x: number, y: number, w: number, hh: number, rx = 1.5) => svgEl('rect', { class: cls, x: f(x), y: f(y), width: f(w), height: f(hh), rx, fill: 'none' });
function art(...kids: (SVGElement | null | false)[]): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  for (const k of kids) if (k) s.append(k);
  return s;
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** MONEY: a statement beside the month's four biggest categories, each bar as long as its share (lit once one is kept). */
export function moneyInst(spends: number[] | null): SVGSVGElement {
  const top = (spends ?? []).slice(0, 4);
  const hi = Math.max(1, ...top);
  const rows = [0, 1, 2, 3].map((i) => {
    const y = 22 + i * 15;
    const w = top[i] ? 6 + (top[i]! / hi) * 66 : 0;
    return [path('ln2', `M78 ${y}h72`), w ? path(i === 0 ? 'lit' : 'ln', `M78 ${y}h${f(w)}`) : null];
  });
  return art(box('ln', 14, 10, 48, 70, 3), path('ln2', 'M22 24h32M22 33h26M22 42h30M22 51h22M22 60h28'), path('ln', 'M22 70h32'), ...rows.flat());
}

/** BODY: a pulse across the week, and the seven days under it, the days moved this week lit. */
export function bodyInst(days: number | null): SVGSVGElement {
  const n = clamp(days ?? 0, 0, 7);
  return art(
    path(days ? 'lit' : 'ln', 'M14 40h30l8-16 12 34 10-24 6 6h66'),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => dot(i < n ? 'fl' : 'ln2', 32 + i * 16, 74, 3.4)),
  );
}

/** PEOPLE: the people he told me about, up to five figures, that many lit. */
export function peopleInst(n: number | null): SVGSVGElement {
  const k = clamp(n ?? 0, 0, 5);
  return art(...[0, 1, 2, 3, 4].flatMap((i) => {
    const x = 32 + i * 24;
    const cls = i < k ? 'lit' : 'ln2';
    return [dot(cls, x, 38, 7), path(cls, `M${x - 11} 66c1.5-9 6-14 11-14s9.5 5 11 14`)];
  }));
}

/** WORK: the to-do list as four rows of boxes, as many ticked (lit) as the share of the jobs done. */
export function workInst(done: number | null, total: number | null): SVGSVGElement {
  const lit = total ? Math.round(((done ?? 0) / total) * 4) : 0;
  return art(...[0, 1, 2, 3].flatMap((i) => {
    const y = 14 + i * 17;
    return [box(i < lit ? 'lit' : 'ln', 40, y, 11, 11, 2), i < lit ? path('lit', `M42.5 ${y + 6}l2.6 2.6 4.6-5`) : null, path(i < lit ? 'ln2' : 'ln', `M60 ${y + 5.5}h${[56, 44, 50, 36][i]}`)];
  }));
}

/** CREATIVE: a palette and a brush; the brush's stroke lit once something was made and saved here. */
export function creativeInst(saved: boolean): SVGSVGElement {
  return art(
    path('ln', 'M70 14a32 30 0 100 60c4 0 6-3 6-6 0-4-4-5-4-9 0-3 3-6 6-6h7a14 14 0 0014-14c0-14-13-25-29-25z'),
    dot('ln2', 52, 44, 4), dot('ln2', 60, 30, 4), dot('ln2', 76, 26, 4), dot('lit', 91, 34, 4),
    path('ln', 'M138 18l-26 34'), path('ln', 'M112 52c-4 2-6 6-8 12 6-2 10-4 12-8z'),
    path(saved ? 'lit' : 'ln2', 'M96 76c10-6 24-6 44-2'),
  );
}

/** OUTSIDE: a street map with a walk drawn across it, and a pin where the car is, lit when I know where. */
export function outsideInst(parked: boolean): SVGSVGElement {
  return art(
    path('ln2', 'M10 30h140M10 62h140M46 8v76M114 8v76'),
    path('ln', 'M22 76C40 64 52 50 80 46s40-16 58-30'),
    path(parked ? 'lit' : 'ln', 'M114 54s-9-8-9-15a9 9 0 0118 0c0 7-9 15-9 15z'), dot(parked ? 'fl' : 'ln2', 114, 39, 2.6),
  );
}

/** HOME: the next fortnight as a calendar, each day with something due at home lit. */
export function homeInst(dueDays: number[] | null): SVGSVGElement {
  const set = new Set(dueDays ?? []);
  const cells = [];
  for (let k = 0; k < 14; k++) {
    const x = 26 + (k % 7) * 16, y = 34 + Math.floor(k / 7) * 22;
    cells.push(box(set.has(k) ? 'lit' : 'ln2', x, y, 12, 16, 2));
  }
  return art(box('ln', 18, 12, 124, 72, 4), path('ln', 'M18 26h124M44 8v8M116 8v8'), ...cells);
}

/** LEARNING: the streak, a week of days in a row, that many lit (and the book open over it). */
export function learningInst(streak: number | null): SVGSVGElement {
  const n = clamp(streak ?? 0, 0, 7);
  return art(
    path('ln', 'M80 20c-10-6-26-8-44-4v44c18-4 34-2 44 4 10-6 26-8 44-4V16c-18-4-34-2-44 4zM80 20v44'),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => box(i < n ? 'lit' : 'ln2', 25 + i * 16, 74, 13, 6, 1.5)),
  );
}

/** COACH: the tuner's needle over its scale, lit when he practised today; the streak's days in a row under it. */
export function coachInst(today: boolean, streak: number): SVGSVGElement {
  let ticks = '';
  for (let k = -4; k <= 4; k++) ticks += `M${f(80 + Math.sin((k * 15 * Math.PI) / 180) * 46)} ${f(64 - Math.cos((k * 15 * Math.PI) / 180) * 46)}L${f(80 + Math.sin((k * 15 * Math.PI) / 180) * (k ? 40 : 36))} ${f(64 - Math.cos((k * 15 * Math.PI) / 180) * (k ? 40 : 36))}`;
  const n = clamp(streak, 0, 7);
  return art(
    path('ln2', 'M34 64a46 46 0 0192 0'), path('ln', ticks), path(today ? 'lit' : 'ln', 'M80 64l10-40'), dot(today ? 'fl' : 'ln', 80, 64, 3),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => dot(i < n ? 'fl' : 'ln2', 44 + i * 12, 82, 2.4)),
  );
}

/** SOCIAL: his four accounts round me, each linked one lit, and a mark on me while a post waits for his APPROVE. */
export function socialInst(linked: boolean[] | null, waiting: number): SVGSVGElement {
  const at = [[34, 24], [126, 24], [34, 70], [126, 70]] as const;
  return art(
    dot('ln', 80, 47, 12), dot(waiting ? 'fl' : 'ln2', 80, 47, 3.6),
    ...at.flatMap(([x, y], i) => {
      const on = !!linked?.[i];
      return [path(on ? 'lit' : 'ln2', `M${x < 80 ? x + 9 : x - 9} ${y + (y < 47 ? 4 : -4)}L${x < 80 ? 69 : 91} ${y < 47 ? 41 : 53}`), dot(on ? 'lit' : 'ln', x, y, 8)];
    }),
  );
}

/** HOUSE: the house with its windows, as many lit as the share of its lights and switches that are on. */
export function houseInst(on: number | null, of: number | null): SVGSVGElement {
  const lit = of ? Math.round(((on ?? 0) / of) * 4) : 0;
  return art(
    path('ln', 'M34 46L80 12l46 34M42 40v42h76V40'),
    box(lit > 0 ? 'lit' : 'ln2', 52, 50, 16, 12), box(lit > 1 ? 'lit' : 'ln2', 92, 50, 16, 12),
    box(lit > 2 ? 'lit' : 'ln2', 52, 66, 16, 12), path(lit > 3 ? 'lit' : 'ln2', 'M92 82V68h16v14'),
  );
}

/** MEMORY: the facts I keep as a constellation, a star lit for each (up to nine), joined as I join them. */
export function memoryInst(n: number | null): SVGSVGElement {
  const at = [[30, 30], [52, 62], [70, 22], [84, 52], [104, 30], [118, 66], [134, 40], [46, 78], [96, 76]] as const;
  const k = clamp(n ?? 0, 0, at.length);
  const joins = [[0, 1], [0, 2], [2, 3], [1, 3], [3, 4], [4, 6], [3, 5], [5, 6], [1, 7], [5, 8], [3, 8]] as const;
  return art(
    ...joins.map(([a, b]) => path(a < k && b < k ? 'ln' : 'ln2', `M${at[a][0]} ${at[a][1]}L${at[b][0]} ${at[b][1]}`)),
    ...at.map(([x, y], i) => dot(i < k ? 'fl' : 'ln2', x, y, i < k ? 3.4 : 2.6)),
  );
}

/** SETTINGS: three of his switches as sliders (my voice, home set, the sounds), each knob lit and to the right when on. */
export function settingsInst(on: boolean[]): SVGSVGElement {
  return art(...[0, 1, 2].flatMap((i) => {
    const y = 24 + i * 22;
    const lit = !!on[i];
    return [path('ln2', `M30 ${y}h100`), lit ? path('lit', `M30 ${y}h${70}`) : null, dot(lit ? 'fl' : 'ln', lit ? 100 : 46, y, 5.5)];
  }));
}

/** SYSTEM: the brain's keys as a row of slots, as many lit as are set, over the database's day as a bar (lit as it fills). */
export function systemInst(set: number | null, of: number | null, level: number | null): SVGSVGElement {
  const lit = of ? Math.round(((set ?? 0) / of) * 10) : 0;
  const w = level == null ? 0 : clamp(level, 0, 1) * 112;
  return art(
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => box(i < lit ? 'lit' : 'ln2', 24 + i * 11.6, 22, 7, 16, 1.5)),
    path('ln2', 'M24 64h112'), w ? path('lit', `M24 64h${f(w)}`) : null, path('ln', 'M24 58v12M136 58v12'),
  );
}

/** LINKS: me in the middle and five of the things I am plugged into round me (email, Telegram, GitHub, traffic, the house), each set one lit. */
export function linksInst(on: (boolean | null)[]): SVGSVGElement {
  const at = [[28, 26], [132, 26], [28, 68], [132, 68], [80, 82]] as const;
  return art(
    box('ln', 66, 32, 28, 22, 6),
    ...at.flatMap(([x, y], i) => {
      const lit = !!on[i];
      return [path(lit ? 'lit' : 'ln2', `M${x} ${y}L${x < 80 ? 66 : x > 80 ? 94 : 80} ${y < 47 ? 38 : y > 70 ? 54 : 48}`), dot(lit ? 'fl' : 'ln', x, y, 5)];
    }),
  );
}

