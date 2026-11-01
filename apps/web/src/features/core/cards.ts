/**
 * THE CARD KIT (BRIEF-SIDEWAYS item 1; OWNER-ISSUES 91b "i want it to be there"; SHOW ME, DON'T TELL ME): any reply or
 * feature puts a live card in the conversation — MAP, THREE-D, PERSON, CAR, ESTIMATE, LENS, BRIEF, PROGRESS, PLACE. Each:
 * a title of four words at most, one plain line, a picture, at most two buttons (OPEN → the screen and its panel; ASK →
 * a question in the box), never taller than 180 pt; VoiceOver reads the title, then the line. The cards are built by code
 * (packages/shared/src/cards.ts): from a tool's result on the brain, or from what the phone already holds. Nothing here
 * asks a model to draw anything.
 */
import type { Card, CardAct } from '../../../../../packages/shared/src/cards';
import { run } from '../../commands/registry';
import { h, icon, svgEl } from '../../core/dom';
import { openChat, perform } from '../../shell/launcher';
import { button } from '../../ui/components';

export type { Card } from '../../../../../packages/shared/src/cards';

// ---------------------------------------------------------------- the pictures

const ICONS: Record<string, string> = {
  morning: '<circle cx="12" cy="13" r="4"/><path d="M12 4.5v2M4.5 13h2M17.5 13h2M6.7 7.7l1.4 1.4M17.3 7.7l-1.4 1.4M3.5 19.5h17"/>',
  rain: '<path d="M7 14.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 6.2 4.2 4.2 0 007 14.5z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
  diary: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  reminder: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
  car: '<path d="M5 16.5V12l1.8-4.6A2 2 0 018.7 6h6.6a2 2 0 011.9 1.4L19 12v4.5"/><path d="M4 12h16v4.5H4z"/><circle cx="7.5" cy="14.3" r=".9"/><circle cx="16.5" cy="14.3" r=".9"/>',
  warning: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  foresight: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  read: '<path d="M4 5.5h16M4 9.5h16M4 13.5h11M4 17.5h8"/>',
};

const COLOUR: Record<string, string> = {
  black: '#2b2f33', white: '#e9edf0', silver: '#b8c0c7', grey: '#8a939b', gray: '#8a939b', red: '#e0453a', blue: '#3b82f6', green: '#34c759',
  yellow: '#ffd60a', orange: '#ff9f0a', gold: '#d4a64a', beige: '#d8c7a5', brown: '#8b5e3c', maroon: '#7a1f2b', purple: '#a35bd8',
  pink: '#ff6fa8', turquoise: '#30c8c0', bronze: '#a8733a', cream: '#efe6cf',
};

const TILE = 128; // OpenStreetMap's 256 px tiles drawn at half size: crisp on his phone's screen
const VIS = { w: 104, h: 84 };

/** Web Mercator: where a point sits on the world at zoom `z`, in this card's tile pixels. */
function world(lat: number, lon: number, z: number): [number, number] {
  const n = 2 ** z * TILE;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

/** The MAP picture: the static OpenStreetMap tiles God's Eye already uses, the place pinned, a route drawn. */
function mapVisual(m: NonNullable<Card['map']>): HTMLElement {
  const box = h('div.ccmap');
  const pts = m.path?.length ? m.path : null;
  let z = 15;
  let centre: [number, number] = [m.lat, m.lon];
  if (pts) {
    const lats = pts.map((p) => p[0]);
    const lons = pts.map((p) => p[1]);
    centre = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2];
    for (z = 16; z > 3; z--) {
      const [x0, y0] = world(Math.max(...lats), Math.min(...lons), z);
      const [x1, y1] = world(Math.min(...lats), Math.max(...lons), z);
      if (x1 - x0 <= VIS.w * 0.82 && y1 - y0 <= VIS.h * 0.78) break;
    }
  }
  const [cx, cy] = world(centre[0], centre[1], z);
  const left = cx - VIS.w / 2;
  const top = cy - VIS.h / 2;
  const n = 2 ** z;
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + VIS.w) / TILE); tx++) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + VIS.h) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const img = h('img', { alt: '', loading: 'lazy', decoding: 'async', draggable: false, src: `https://tile.openstreetmap.org/${z}/${((tx % n) + n) % n}/${ty}.png` });
      img.style.left = `${Math.round(tx * TILE - left)}px`;
      img.style.top = `${Math.round(ty * TILE - top)}px`;
      img.addEventListener('error', () => img.remove());
      box.append(img);
    }
  }
  const svg = svgEl('svg', { viewBox: `0 0 ${VIS.w} ${VIS.h}`, class: 'ccmapdraw' });
  if (pts) {
    const xy = pts.map(([la, lo]) => world(la, lo, z)).map(([x, y]) => `${(x - left).toFixed(1)},${(y - top).toFixed(1)}`);
    svg.append(svgEl('polyline', { points: xy.join(' '), fill: 'none', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'ccroute' }));
    const [ex, ey] = world(pts.at(-1)![0], pts.at(-1)![1], z);
    svg.append(svgEl('circle', { cx: (ex - left).toFixed(1), cy: (ey - top).toFixed(1), r: 4, class: 'ccpin' }));
  } else {
    svg.append(svgEl('circle', { cx: VIS.w / 2, cy: VIS.h / 2, r: 9, class: 'ccpinhalo' }), svgEl('circle', { cx: VIS.w / 2, cy: VIS.h / 2, r: 4.5, class: 'ccpin' }));
  }
  box.append(svg, h('small.ccosm', '© OSM'));
  return box;
}

/** THREE-D: a small wireframe that turns (still when he asks the phone for less motion); a tap opens the real scene. */
function threeVisual(): HTMLElement {
  const svg = svgEl('svg', { viewBox: '-30 -30 60 60', class: 'cc3d' });
  const g = svgEl('g', { class: 'cc3dspin' });
  // an isometric cube's edges
  const P = (x: number, y: number, z: number) => [(x - z) * 0.87 * 14, (y + (x + z) * 0.5) * 14] as const;
  const E: [number[], number[]][] = [
    [[-1, -1, -1], [1, -1, -1]], [[1, -1, -1], [1, -1, 1]], [[1, -1, 1], [-1, -1, 1]], [[-1, -1, 1], [-1, -1, -1]],
    [[-1, 1, -1], [1, 1, -1]], [[1, 1, -1], [1, 1, 1]], [[1, 1, 1], [-1, 1, 1]], [[-1, 1, 1], [-1, 1, -1]],
    [[-1, -1, -1], [-1, 1, -1]], [[1, -1, -1], [1, 1, -1]], [[1, -1, 1], [1, 1, 1]], [[-1, -1, 1], [-1, 1, 1]],
  ];
  for (const [a, b] of E) {
    const [x1, y1] = P(a[0]!, a[1]!, a[2]!);
    const [x2, y2] = P(b[0]!, b[1]!, b[2]!);
    g.append(svgEl('line', { x1: x1.toFixed(1), y1: (y1 / 1.6).toFixed(1), x2: x2.toFixed(1), y2: (y2 / 1.6).toFixed(1) }));
  }
  svg.append(g);
  return h('div.ccvisin', svg, h('small', '3-D'));
}

function carVisual(c: NonNullable<Card['car']>): HTMLElement {
  const svg = svgEl('svg', { viewBox: '0 0 64 30', class: 'cccar' });
  const body = svgEl('path', { d: 'M4 21v-5l5-1 6-7h22l9 7 10 1.5 4 3V21z', class: 'cccarbody' });
  if (c.colour && COLOUR[c.colour]) body.style.fill = COLOUR[c.colour]!;
  svg.append(body, svgEl('circle', { cx: 15, cy: 22, r: 4.5, class: 'cccarwheel' }), svgEl('circle', { cx: 49, cy: 22, r: 4.5, class: 'cccarwheel' }), svgEl('path', { d: 'M17 14l4.5-5h7v5zM31 14V9h5l6 5z', class: 'cccarglass' }));
  return h('div.ccvisin', svg, h('span.ccplate', c.plate));
}

function visual(c: Card): HTMLElement {
  switch (c.kind) {
    case 'map':
      return c.map ? mapVisual(c.map) : h('div.ccvisin', icon(ICONS.pin!));
    case 'place':
      return c.map ? mapVisual(c.map) : h('div.ccvisin', icon(ICONS.pin!));
    case 'three':
      return threeVisual();
    case 'person':
      return h('div.ccvisin', h('b.ccinitial', (c.person?.name ?? c.title).trim().charAt(0).toUpperCase() || '?'));
    case 'car':
      return c.car ? carVisual(c.car) : h('div.ccvisin', icon(ICONS.car!));
    case 'estimate':
      return h('div.ccvisin.ccnum', h('b', c.estimate?.value ?? '—'), h('small', c.estimate?.label ?? ''));
    case 'lens':
      return h('div.ccvisin.cclens', icon(ICONS.read!), h('small', (c.lens?.text ?? '').split(/\s+/).slice(0, 3).join(' ')));
    case 'progress': {
      const f = Math.max(0, Math.min(1, c.progress?.frac ?? 0));
      const svg = svgEl('svg', { viewBox: '0 0 40 40', class: 'ccring' });
      svg.append(svgEl('circle', { cx: 20, cy: 20, r: 16, class: 'cctrack' }), svgEl('circle', { cx: 20, cy: 20, r: 16, class: 'ccfill', pathLength: 100, 'stroke-dasharray': `${(f * 100).toFixed(1)} 100`, transform: 'rotate(-90 20 20)' }));
      return h('div.ccvisin', svg, h('small', `${Math.round(f * 100)}%`));
    }
    case 'brief':
    default:
      return h('div.ccvisin', icon(ICONS[c.brief?.icon ?? 'diary'] ?? ICONS.diary!));
  }
}

// ---------------------------------------------------------------- the buttons

/** ASK: the words go in the box, ready to send or change — never sent for him. */
export function askInBox(words: string): void {
  openChat();
  let tries = 0;
  const put = () => {
    const box = document.querySelector<HTMLInputElement>('#cin');
    if (!box) return void (++tries < 12 && setTimeout(put, 150));
    box.value = words;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.focus();
  };
  setTimeout(put, 160);
}

/** What a card's button does: OPEN a screen (and its panel) or run its screen command; ASK; the CAR offer's one tap. */
export function act(a: CardAct): void {
  if (a.run) void run(a.run.name, a.run.args);
  else if (a.open) perform({ open: a.open.tab, ...(a.open.panel ? { panel: a.open.panel } : {}) });
  else if (a.ask) askInBox(a.ask);
  else if (a.car) void carTap(a.car);
}

/** The CAR offer's tap: filled in by the trigger table's half of this file (below), which knows the cars he named. */
let carTap: (plate: string) => Promise<void> = async () => undefined;
export function onCarTap(f: (plate: string) => Promise<void>): void {
  carTap = f;
}

/** One card, as the chat and Home's wall draw it. */
export function cardEl(c: Card, opts: { wall?: boolean } = {}): HTMLElement {
  const vis = h('div.ccvis', { 'aria-hidden': 'true' }, visual(c));
  const first = c.acts?.find((a) => a.open || a.run);
  if (first) {
    vis.classList.add('tap');
    vis.addEventListener('click', () => act(first));
  }
  const acts = (c.acts ?? []).slice(0, 2).map((a, i) => {
    const b = button(a.label, () => act(a), i === 0 ? 'on' : '');
    b.dataset.case = 'keep';
    b.classList.add('ccbtn');
    return b;
  });
  return h(
    `article.ccard${opts.wall ? '.wall' : ''}` as 'article',
    // (no label of its own: VoiceOver reads the title, then the line, then the buttons; the picture is hidden from it)
    { dataset: { kind: c.kind, id: c.id, case: 'keep', ...(c.danger ? { danger: '1' } : {}) } },
    vis,
    h('div.ccbody', h('b.cctitle', c.title), h('span.ccline', c.line), c.kind === 'estimate' ? h('small.cctag', 'First estimate, not certified') : null, acts.length ? h('div.ccacts', ...acts) : null),
  );
}
