/**
 * THE CARD KIT (BRIEF-SIDEWAYS item 1; OWNER-ISSUES 91b "i want it to be there"; SHOW ME, DON'T TELL ME): any reply or
 * feature puts a live card in the conversation — MAP, THREE-D, PERSON, CAR, ESTIMATE, LENS, BRIEF, PROGRESS, PLACE. Each:
 * a title of four words at most, one plain line, a picture, at most two buttons (OPEN → the screen and its panel; ASK →
 * a question in the box), never taller than 180 pt; VoiceOver reads the title, then the line. The cards are built by code
 * (packages/shared/src/cards.ts): from a tool's result on the brain, or from what the phone already holds. Nothing here
 * asks a model to draw anything.
 */
import { card, carCard, dueMonths, personCard, plateOffer, type Card, type CardAct, type NamedCar } from '../../../../../packages/shared/src/cards';
import { findPlates, normalisePlate, redactPlates, type VehicleAnswer } from '../../../../../packages/shared/src/plates';
import type { SavedPlace } from '../../../../../packages/shared/src/places';
import { brain, headers } from '../../api/brain';
import { chat, notePlate } from '../../assistant/session';
import { triggersIn, type Known } from '../../assistant/triggers';
import { run } from '../../commands/registry';
import { h, icon, svgEl } from '../../core/dom';
import { createStore } from '../../core/store';
import { guardian } from '../../state/guardian';
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
  // [social] a line of his own (BRIEF-SOCIAL item 7) and FATHER AND THE ORIGIN (item 1)
  musing: '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17H4.5A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/><path d="M8 10h8M8 13h5"/>',
  origin: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.2 4.2 0 0112 7.8a4.2 4.2 0 017.5 2.5c0 5.6-7.5 10.2-7.5 10.2z"/><path d="M12 3.5v4.3"/>',
};

const COLOUR: Record<string, string> = {
  black: '#2b2f33', white: '#e9edf0', silver: '#b8c0c7', grey: '#8a939b', gray: '#8a939b', red: '#e0453a', blue: '#3b82f6', green: '#34c759',
  yellow: '#ffd60a', orange: '#ff9f0a', gold: '#d4a64a', beige: '#d8c7a5', brown: '#8b5e3c', maroon: '#7a1f2b', purple: '#a35bd8',
  pink: '#ff6fa8', turquoise: '#30c8c0', bronze: '#a8733a', cream: '#efe6cf',
};

const TILE = 128; // OpenStreetMap's 256 px tiles drawn at half size: crisp on his phone's screen
/** The picture's box: in the chat, and smaller on Home's wall. */
const VIS = { w: 104, h: 84 };
const WALL_VIS = { w: 64, h: 52 };
type Box = typeof VIS;

/** Web Mercator: where a point sits on the world at zoom `z`, in this card's tile pixels. */
function world(lat: number, lon: number, z: number): [number, number] {
  const n = 2 ** z * TILE;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

/** The MAP picture: the static OpenStreetMap tiles God's Eye already uses, the place pinned, a route drawn. */
function mapVisual(m: NonNullable<Card['map']>, VIS: Box): HTMLElement {
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

function visual(c: Card, box: Box = VIS): HTMLElement {
  switch (c.kind) {
    case 'map':
      return c.map ? mapVisual(c.map, box) : h('div.ccvisin', icon(ICONS.pin!));
    case 'place':
      return c.map ? mapVisual(c.map, box) : h('div.ccvisin', icon(ICONS.pin!));
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
  const vis = h('div.ccvis', { 'aria-hidden': 'true' }, visual(c, opts.wall ? WALL_VIS : VIS));
  const first = c.acts?.find((a) => a.open || a.run);
  if (first && !opts.wall) {
    vis.classList.add('tap');
    vis.addEventListener('click', () => act(first));
  }
  // on Home's wall the whole card is the button: its first act (the screen, the question, the car)
  const tap = opts.wall ? c.acts?.[0] : undefined;
  const acts = (opts.wall ? [] : (c.acts ?? []).slice(0, 2)).map((a, i) => {
    const b = button(a.label, () => act(a), i === 0 ? 'on' : '');
    b.dataset.case = 'keep';
    b.classList.add('ccbtn');
    return b;
  });
  const el = h(
    `article.ccard${opts.wall ? '.wall' : ''}` as 'article',
    // (no label of its own: VoiceOver reads the title, then the line, then the buttons; the picture is hidden from it)
    { dataset: { kind: c.kind, id: c.id, case: 'keep', ...(c.danger ? { danger: '1' } : {}) } },
    vis,
    h(
      'div.ccbody',
      h('b.cctitle', c.title),
      h('span.ccline', c.line),
      c.kind === 'estimate' ? h('small.cctag', 'First estimate, not certified') : null,
      // a line he did not ask for says why it came (the speak-first cadence recorded it)
      c.why ? h('small.ccwhy', `Why: ${c.why}`) : null,
      acts.length ? h('div.ccacts', ...acts) : null,
    ),
  );
  if (tap) {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('click', () => act(tap));
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), act(tap)));
  }
  return el;
}

// ---------------------------------------------------------------- he brings things up himself (item 2): the table's acting half

/** The cars he named, as the brain keeps them in his memory (GET /api/cars). */
export const cars = createStore({ list: [] as NamedCar[], at: 0 });
export async function loadCars(): Promise<NamedCar[]> {
  try {
    const r = await brain.cars();
    cars.set({ list: r.cars, at: Date.now() });
  } catch {
    /* offline: what this phone last heard */
  }
  return cars.get().list;
}
let places: SavedPlace[] = [];
let placesAt = 0;
/** His saved places, read again when older than `maxAge` (a turn reads them fresh: he may have just saved one). */
async function savedPlaces(maxAge = 5 * 60_000): Promise<SavedPlace[]> {
  if (Date.now() - placesAt < maxAge) return places;
  placesAt = Date.now();
  places = (await brain.places().catch(() => null))?.places ?? places;
  return places;
}

/** What the table matches against: his places, the people he introduced (the guardian's named person and whose cars he named), the cars. */
export async function known(maxAge?: number): Promise<Known> {
  const list = cars.get().at ? cars.get().list : await loadCars();
  const person = guardian.get().info?.person?.name;
  return { places: await savedPlaces(maxAge), people: [...(person ? [person] : []), ...list.filter((c) => c.whose !== 'me').map((c) => c.whose)], cars: list };
}

/** Under a test runner the cards he did not ask for wait for the spec to ask (as the offers do): every spec starts on a fresh phone. */
export const mayBringUp = () => !navigator.webdriver || (globalThis as { __ghostyCards?: boolean }).__ghostyCards === true;

/** Put a card in the conversation — once: the same card again within half an hour stays where it is. */
export function postCard(card: Card, opts: { once?: boolean } = {}): boolean {
  const recent = chat.get().entries.slice(-30);
  if (recent.some((e) => e.kind === 'card' && e.card.id === card.id && Date.now() - e.at < 30 * 60_000)) return false;
  chat.set((s) => ({ entries: [...s.entries, { kind: 'card' as const, card, at: Math.max(Date.now(), (s.entries.at(-1) as { at?: number } | undefined)?.at ?? 0) + 1, ...(opts.once || card.once ? { once: true } : {}) }].slice(-120) }));
  return true;
}

/** The PERSON card for someone he introduced, from what the phone holds of the guardian and the cars; null for anyone else. */
export function personNow(name: string): Card | null {
  const info = guardian.get().info;
  const low = name.toLowerCase();
  const theirs = cars.get().list.filter((c) => c.whose.toLowerCase() === low);
  const named = info?.person && info.person.name.toLowerCase() === low ? info.person : null;
  if (!named && !theirs.length) return null;
  return personCard({ name: named?.name ?? theirs[0]!.whose, ...(named ? { named: { via: named.via } } : {}), cars: theirs, walk: !!info?.walk && info.walk.stage !== 'done' });
}

/** A saved place on the map. */
export function placeMap(p: Known['places'][number]): Card {
  return card({ id: `map:${p.label}`, kind: 'map', title: p.label, line: p.address, map: { lat: p.lat, lon: p.lon, label: p.label }, acts: [{ label: 'OPEN MAP', run: { name: 'show_map', args: { place: p.label, lat: p.lat, lon: p.lon, zoom: 16 } } }, { label: 'ASK', ask: `How long to get to ${p.label}?` }] });
}

const hm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
/** The diary piece for a day: what is in it, from the agenda the phone can read. */
export async function dayPiece(label: string, offset: number, now = Date.now()): Promise<Card | null> {
  const r = await brain.agenda(8).catch(() => null);
  if (!r) return null;
  const d = new Date(now);
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset).getTime();
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset + 1).getTime();
  const items = [
    ...r.events.filter((e) => (e.end ?? e.start + 1) > Math.max(from, offset ? from : now) && e.start < to).map((e) => ({ at: Math.max(e.start, from), what: `${e.title}${e.allDay ? ' (all day)' : ` ${hm(e.start)}`}` })),
    ...r.jobs.filter((j) => j.kind === 'reminder' && j.next >= Math.max(from, now) && j.next < to).map((j) => ({ at: j.next, what: `${j.title || j.text} ${hm(j.next)}` })),
  ].sort((a, b) => a.at - b.at);
  const iso = new Date(from).toISOString().slice(0, 10);
  return card({
    id: `day:${iso}`, kind: 'brief', title: label, brief: { icon: 'diary' },
    line: items.length ? `${items.length === 1 ? 'One thing' : `${items.length} things`}: ${items.slice(0, 3).map((x) => x.what).join(' · ')}` : `Nothing in your diary ${label === 'Today' ? 'for the rest of today' : label === 'Tomorrow' ? 'tomorrow' : `on ${label}`}`,
    ...(items[0] ? { due: items[0].at } : {}),
    acts: [{ label: 'OPEN AGENDA', open: { tab: 'agenda' } }],
  });
}

/** The CAR offer's tap (and a car he named, at once): the public record from the brain, shown once and never kept. */
async function showCar(plate: string): Promise<void> {
  const p = normalisePlate(plate);
  const named = cars.get().list.find((c) => normalisePlate(c.plate) === p);
  notePlate(p);
  let answer: VehicleAnswer;
  try {
    const r = await fetch('/api/vehicle', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ plate: p }), credentials: 'same-origin', cache: 'no-store' });
    answer = (await r.json()) as VehicleAnswer;
  } catch {
    answer = { ok: false, reason: 'failed', message: 'I couldn’t reach my brain for the record. Try again in a moment.', links: [] };
  }
  const c = carCard(answer, p, named);
  // the offer becomes the car, where it was
  const es = chat.get().entries;
  const i = es.findLastIndex((e) => e.kind === 'card' && e.card.id === c.id);
  if (i >= 0) chat.set({ entries: es.map((e, k) => (k === i ? { kind: 'card' as const, card: c, at: (e as { at: number }).at, once: true } : e)) });
  else postCard(c, { once: true });
  // a car he named keeps the months its MOT and tax fall due, for the day's pieces
  const months = dueMonths(answer);
  if (named && (months.mot || months.tax)) void brain.carMonths(p, months).then(() => loadCars()).catch(() => undefined);
}
onCarTap(showCar);

/** Cards that came with a reply: a plate he named is shown at once; a car he just named is now known. */
export function arrived(list: Card[]): void {
  for (const c of list) {
    if (c.kind === 'car' && c.car?.whose && c.acts?.some((a) => a.car)) void showCar(c.car.plate);
    if (c.kind === 'person') void loadCars();
  }
}

/** Tools a turn ran (they already drew their own cards: nothing is offered twice). */
function ranThisTurn(): string[] {
  const es = chat.get().entries;
  let i = es.length - 1;
  while (i >= 0 && es[i]!.kind !== 'user') i--;
  return es.slice(i + 1).flatMap((e) => (e.kind === 'activity' && e.tool ? [e.tool] : []));
}

/**
 * After a turn (assistant/session.ts, once its reply is in): what his words brought up, as cards — the trigger table
 * (assistant/triggers.ts) row by row; when none of its rows has anything to show, the batch 4 offers have their say.
 */
export async function bringUp(text: string, now = Date.now()): Promise<number> {
  const offers = () => void import('../../abilities/offer').then((o) => o.offerAfterTurn(text)).catch(() => undefined);
  if (!mayBringUp()) return offers(), 0;
  const ran = ranThisTurn();
  let n = 0;
  for (const hit of triggersIn(text, await known(0), now)) {
    let c: Card | null = null;
    if (hit.row === 'car') void loadCars();
    else if (hit.row === 'plate' && !hit.bare && !ran.includes('vehicle_check')) c = plateOffer(hit.plate, hit.named, now);
    else if (hit.row === 'postcode' && !ran.includes('uk_postcode')) c = card({ id: `pc:${hit.postcode}`, kind: 'map', title: hit.postcode, line: 'A postcode: want it on the map?', at: now, acts: [{ label: 'ASK', ask: `Where is ${hit.postcode}?` }] });
    else if (hit.row === 'place' && !ran.some((t) => /^(show_map|get_directions|remember_place)$/.test(t))) c = placeMap(hit.place);
    else if (hit.row === 'person') c = personNow(hit.name);
    else if (hit.row === 'day' && !ran.includes('list_agenda')) c = await dayPiece(hit.label, hit.offset, now);
    else if (hit.row === 'offers' && !n) offers();
    if (c && postCard(c)) {
      n++;
      if (hit.row === 'plate' && hit.named) void showCar(hit.plate);
    }
  }
  return n;
}

// ---------------------------------------------------------------- from the camera (item 2b) and the day (item 2c)

const BILL = /\b(?:amount due|total due|balance due|pay(?:ment)? by|due date|direct debit|invoice|statement date|please pay|renewal|expires?|expiry|use by|best before)\b/i;

/** What the Lens's READ just read, into the chat: its LENS card; a plate seen → its CAR offer; a bill or a label → the reminder offer. */
export function lensRead(text: string, now = Date.now()): void {
  // (a plate it read is never kept in the card's words: its CAR offer below carries it, shown once)
  const plates = findPlates(text).slice(0, 2);
  const t = redactPlates(text, plates).replace(/\s+/g, ' ').trim();
  if (!t || !mayBringUp()) return;
  const bill = BILL.test(t);
  postCard(card({
    id: `lens:${t.slice(0, 40)}`, kind: 'lens', at: now, title: bill ? 'A bill or a label' : 'The camera read',
    line: t, lens: { text: t.slice(0, 200) },
    acts: [{ label: 'OPEN LENS', open: { tab: 'lens' } }, bill ? { label: 'REMIND ME', ask: 'Remind me to deal with this bill on ' } : { label: 'ASK', ask: `What does this say? “${t.slice(0, 120)}”` }],
  }));
  for (const p of plates) postCard(plateOffer(p, cars.get().list.find((c) => normalisePlate(c.plate) === p), now));
}

/** A piece of the day the brain posted (inbox.ts announce): its card in the chat at its minute, when it has one. */
export function dayCard(c: Card): void {
  if (mayBringUp()) postCard(c);
}

// for the specs and the console: what the table matches against now, and what it makes of some words (window.__ghosty.triggers)
if (typeof window !== 'undefined') {
  setTimeout(() => {
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.triggers = { known, of: async (words: string) => triggersIn(words, await known()) };
  }, 2500);
}
