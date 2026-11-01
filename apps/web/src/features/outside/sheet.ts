/**
 * THE OUTSIDE PACK on the phone (BRIEF-PACKS-3): a sheet over whatever is showing (the open_outside command; the chat's "toilets
 * near me", "I'm lost", "I parked here"). WALK: a walk scored against police street reports with the routes drawn small, and the
 * last way home; NEARBY: car parks, toilets, cash machines, drinking water and what is open; CAR: where he parked; LOST: the
 * nearest saved place, the nearest station and the way; SPLIT: a fare, who owes whom. Everything runs on his own brain
 * (POST /packs/do, no model). The phone's position is asked ONLY when he taps USE WHERE I AM NOW, sent once with that one
 * question, and kept nowhere here. The state sits on window.__ghosty.outside for the specs.
 */
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { brain } from '../../api/brain';

export type OutsideWhat = 'safewalk' | 'parking' | 'toilets' | 'cash' | 'refill' | 'open' | 'car' | 'lost' | 'split';
type View = 'safewalk' | 'nearby' | 'car' | 'lost' | 'split';
type Near = 'parking' | 'toilets' | 'cash' | 'refill' | 'open';
interface Pos {
  lat: number;
  lon: number;
}
interface Item {
  name: string;
  m: number;
  line: string;
  lat: number;
  lon: number;
}
interface Route {
  label: string;
  km: number;
  min: number;
  reports: number;
  perKm: number;
  kinds: string;
  path: [number, number][];
  worst: { lat: number; lon: number; from: number; reports: number; streets: string[] } | null;
}
interface Walk {
  from: string;
  to: string;
  months: string[];
  routes: Route[];
  best: number;
}
const NEARS: { id: Near; label: string }[] = [
  { id: 'parking', label: 'Car parks' },
  { id: 'toilets', label: 'Toilets' },
  { id: 'cash', label: 'Cash' },
  { id: 'refill', label: 'Water' },
  { id: 'open', label: 'Open now' },
];
const VIEWS: { id: View; label: string }[] = [
  { id: 'safewalk', label: 'Walk' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'car', label: 'My car' },
  { id: 'lost', label: 'Lost' },
  { id: 'split', label: 'Split' },
];

export const outsideState = { open: '' as '' | View, near: 'toilets' as Near, said: '', items: [] as Item[], walk: null as Walk | null, car: '' };
let openSheet: { close(): void } | null = null;

const viewOf = (what: string): { view: View; near?: Near } =>
  what === 'safewalk' || what === 'car' || what === 'lost' || what === 'split' ? { view: what } : (NEARS.some((n) => n.id === what) ? { view: 'nearby', near: what as Near } : { view: 'nearby', near: 'toilets' });

export async function openOutside(what: string, args: Record<string, unknown> = {}): Promise<void> {
  const v = viewOf(what);
  if (v.near) outsideState.near = v.near;
  openSheet?.close();
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.outside = outsideState;
  const body = h('div.pkcol');
  const pk = h('div.pk', { dataset: { pack: 'outside', screen: v.view } }, body);
  const tabs = h('div.pkrow', { role: 'group', 'aria-label': 'Pages of the outside sheet' });
  const show = (view: View) => {
    outsideState.open = view;
    pk.dataset.screen = view;
    for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    body.replaceChildren(view === 'safewalk' ? walkView(args) : view === 'nearby' ? nearView(args) : view === 'car' ? carView() : view === 'lost' ? lostView() : splitView());
  };
  for (const t of VIEWS) {
    const b = button(t.label, () => show(t.id), '');
    b.dataset.view = t.id;
    b.setAttribute('aria-label', `${t.label} page`);
    tabs.append(b);
  }
  openSheet = modal('OUTSIDE', h('div.pkcol', tabs, pk), () => {
    openSheet = null;
    outsideState.open = '';
  });
  show(v.view);
}

async function run(action: string, a: Record<string, unknown>): Promise<{ text: string; data?: unknown }> {
  try {
    const r = await brain.packDo('outside', action, a);
    outsideState.said = r.text;
    return r;
  } catch (e) {
    toast(`My brain didn’t answer: ${(e as Error).message}`, 'warn');
    return { text: '' };
  }
}
/** The phone's position, once, when he taps: used for the one question, never kept. */
function here(status: HTMLElement): Promise<Pos | null> {
  if (!('geolocation' in navigator)) {
    status.textContent = 'This phone won’t share where it is here: type a place instead.';
    return Promise.resolve(null);
  }
  status.textContent = 'Asking the phone where it is, once…';
  return new Promise((ok) =>
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => {
        status.textContent = e.code === 1 ? 'The phone said no. Type a place instead; nothing is kept.' : 'The phone couldn’t tell where it is. Type a place instead.';
        ok(null);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    ),
  );
}
function input(label: string, ph: string, value = ''): HTMLInputElement {
  return h('input', { type: 'text', placeholder: ph, 'aria-label': label, value, enterKeyHint: 'go', autocomplete: 'off' }) as HTMLInputElement;
}
const note = (text: string) => h('p.pknote', { 'aria-live': 'polite' }, text);
const named = (b: HTMLButtonElement, label: string) => (b.setAttribute('aria-label', label), b);
const mapsLink = (name: string, lat: number, lon: number) => {
  const a = h('a', { href: `https://maps.apple.com/?daddr=${lat.toFixed(5)},${lon.toFixed(5)}&dirflg=w`, target: '_blank', rel: 'noopener', 'aria-label': `Directions on foot to ${name}` }, 'Directions');
  return a;
};

// ---------------------------------------------------------------- NEARBY

function nearView(args: Record<string, unknown>): HTMLElement {
  const status = note('Name a place, pick one you saved (home, work), or tap USE WHERE I AM NOW once. Nothing is tracked.');
  const place = input('A place to look near', 'home, work or a street', typeof args.near === 'string' ? args.near : '');
  const what = input('What kind of place is open', 'pharmacy, coffee, pub, food, shop');
  const list = h('div.pkcol', { 'aria-live': 'polite' });
  const kinds = h('div.pkrow', { role: 'group', 'aria-label': 'What to look for' });
  const paint = () => {
    list.replaceChildren(
      ...(outsideState.items.length
        ? outsideState.items.slice(0, 8).map((i) => h('div.pkperson', { role: 'group', 'aria-label': i.name }, h('b', i.name), h('span.pklab', i.line), mapsLink(i.name, i.lat, i.lon)))
        : []),
    );
  };
  const look = async (pos?: Pos) => {
    status.textContent = 'Asking the map…';
    const r = await run(outsideState.near, { ...(pos ? { lat: pos.lat, lon: pos.lon } : { near: place.value.trim() }), ...(outsideState.near === 'open' ? { what: what.value.trim() } : {}) });
    outsideState.items = ((r.data as { items?: Item[] } | undefined)?.items ?? []).slice();
    status.textContent = r.text || 'My brain didn’t answer.';
    paint();
  };
  for (const k of NEARS) {
    const b = button(k.label, () => {
      outsideState.near = k.id;
      outsideState.items = [];
      for (const x of kinds.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x.dataset.kind === k.id));
      what.hidden = k.id !== 'open';
      paint();
    });
    b.dataset.kind = k.id;
    b.setAttribute('aria-pressed', String(outsideState.near === k.id));
    b.setAttribute('aria-label', `Look for ${k.label.toLowerCase()}`);
    kinds.append(b);
  }
  what.hidden = outsideState.near !== 'open';
  const go = named(button('Look', () => void look(), 'on'), 'Look near the place I typed');
  const tap = named(button('Use where I am now', async () => {
    const p = await here(status);
    if (p) await look(p);
  }), 'Use where I am now, once');
  place.addEventListener('keydown', (e) => e.key === 'Enter' && void look());
  paint();
  return h('div.pkcol', kinds, place, what, h('div.pkrow', go, tap), status, list);
}

// ---------------------------------------------------------------- WALK

function mapSvg(w: Walk): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const all = w.routes.flatMap((r) => r.path);
  const la0 = Math.min(...all.map((p) => p[0]));
  const la1 = Math.max(...all.map((p) => p[0]));
  const lo0 = Math.min(...all.map((p) => p[1]));
  const lo1 = Math.max(...all.map((p) => p[1]));
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const spanX = Math.max(1e-5, (lo1 - lo0) * k);
  const spanY = Math.max(1e-5, la1 - la0);
  const W = 320;
  const H = Math.max(120, Math.min(260, Math.round((W * spanY) / spanX)));
  const s = Math.min((W - 24) / spanX, (H - 24) / spanY);
  const px = (lo: number) => 12 + (lo - lo0) * k * s;
  const py = (la: number) => H - 12 - (la - la0) * s;
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'pkmap');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `The ${w.routes.length} walking route${w.routes.length === 1 ? '' : 's'} from ${w.from} to ${w.to}, drawn small`);
  w.routes.forEach((r, i) => {
    const line = document.createElementNS(ns, 'polyline');
    line.setAttribute('points', r.path.map(([la, lo]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(' '));
    line.setAttribute('class', i === w.best ? 'pkroute best' : 'pkroute');
    svg.append(line);
  });
  const r0 = w.routes[w.best]!;
  if (r0.worst && r0.worst.reports >= 4) {
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', px(r0.worst.lon).toFixed(1));
    dot.setAttribute('cy', py(r0.worst.lat).toFixed(1));
    dot.setAttribute('r', '7');
    dot.setAttribute('class', 'pkbusy');
    svg.append(dot);
  }
  return svg as unknown as SVGElement;
}

function walkView(args: Record<string, unknown>): HTMLElement {
  const status = note('Where from, and where to (home if you leave it). I count police reports within 100 m of each way, and say “fewer reports”, never “safe”.');
  const from = input('Walk from', 'a street, a station or a saved place', typeof args.from === 'string' ? args.from : '');
  const to = input('Walk to', 'home', typeof args.to === 'string' ? args.to : '');
  const out = h('div.pkcol', { 'aria-live': 'polite' });
  let pos: Pos | null = null;
  const where = () => (pos ? { lat: pos.lat, lon: pos.lon } : { from: from.value.trim() });
  const walk = async () => {
    status.textContent = 'Asking the map and the police data: this can take a few seconds…';
    const r = await run('safewalk', { ...where(), to: to.value.trim() || 'home' });
    status.textContent = r.text || 'My brain didn’t answer.';
    const w = r.data as Walk | undefined;
    outsideState.walk = w && Array.isArray(w.routes) ? w : null;
    out.replaceChildren(...(outsideState.walk ? [mapSvg(outsideState.walk)] : []));
  };
  const last = async () => {
    status.textContent = 'Asking the timetables…';
    const r = await run('lasthome', { ...where(), to: to.value.trim() || 'home' });
    status.textContent = r.text || 'My brain didn’t answer.';
    out.replaceChildren();
  };
  const tap = named(button('Use where I am now', async () => {
    pos = await here(status);
    if (pos) {
      from.value = '';
      from.placeholder = 'where you are now (used once)';
    }
  }), 'Use where I am now, once');
  const go = named(button('Count reports', () => void walk(), 'on'), 'Count police reports along the walk');
  const home = named(button('Last way home', () => void last()), 'Find the last train or bus home');
  to.addEventListener('keydown', (e) => e.key === 'Enter' && void walk());
  return h('div.pkcol', from, to, h('div.pkrow', go, home), tap, status, out);
}

// ---------------------------------------------------------------- CAR

function carView(): HTMLElement {
  const status = note('Say where you parked, or tap USE WHERE I AM NOW to keep the spot once. I keep that spot and the time, nothing more.');
  const where = input('Where you parked', 'Cannon Street, or the car park’s name');
  const rule = input('A rule or note about this parking', 'free after 6, card only…');
  const until = h('input', { type: 'time', 'aria-label': 'Paid until what time' }) as HTMLInputElement;
  let pos: Pos | null = null;
  const tap = named(button('Use where I am now', async () => {
    pos = await here(status);
    if (pos) status.textContent = 'Got the spot: it is kept only if you tap I PARKED HERE.';
  }), 'Use where I am now, once');
  const keep = named(button('I parked here', async () => {
    if (!where.value.trim() && !pos) {
      status.textContent = 'Say where, or tap USE WHERE I AM NOW first.';
      return;
    }
    const r = await run('parked', { ...(where.value.trim() ? { place: where.value.trim() } : {}), ...(pos ? { lat: pos.lat, lon: pos.lon } : {}), ...(rule.value.trim() ? { note: rule.value.trim() } : {}), ...(until.value ? { until: until.value } : {}) });
    status.textContent = r.text || 'My brain didn’t answer.';
    outsideState.car = r.text;
    pos = null;
  }, 'on'), 'Keep where I parked');
  const ask = named(button('Where is the car?', async () => {
    const p = await here(status).catch(() => null);
    const r = await run('parked', p ? { lat: p.lat, lon: p.lon, ask: true } : {});
    status.textContent = r.text || 'My brain didn’t answer.';
    outsideState.car = r.text;
  }), 'Where did I park?');
  const gone = named(button('Forget it', async () => {
    const r = await run('parked', { words: 'forget' });
    status.textContent = r.text;
  }), 'Forget where the car is');
  return h('div.pkcol', where, rule, h('label.pkfield', h('span.pklab', 'Paid until'), until), h('div.pkrow', keep, tap), h('div.pkrow', ask, gone), status);
}

// ---------------------------------------------------------------- LOST

function lostView(): HTMLElement {
  const status = note('Tap once. I use the spot for this one question, show the nearest place you saved and the nearest station, and the way. If you feel unsafe, call 999.');
  const typed = input('Or name the street or place you are at', 'the street you can see');
  const show = async (a: Record<string, unknown>) => {
    status.textContent = 'Asking the map…';
    const r = await run('lost', a);
    status.textContent = r.text || 'My brain didn’t answer.';
  };
  const tap = named(button('Use where I am now', async () => {
    const p = await here(status);
    if (p) await show({ lat: p.lat, lon: p.lon });
  }, 'on'), 'Use where I am now, once');
  const go = named(button('Find from this name', () => void show({ near: typed.value.trim() })), 'Find my way from the place I typed');
  return h('div.pkcol', tap, typed, go, status);
}

// ---------------------------------------------------------------- SPLIT

function splitView(): HTMLElement {
  const status = note('Say it like “taxi £48, I paid, between me, Sam and Jo”, or “I paid £30, Sam paid £12, split 3 ways”. Only sums: nothing is paid or sent.');
  const words = h('textarea', { rows: 3, 'aria-label': 'The fare and who shares it', placeholder: 'taxi £48, I paid, between me, Sam and Jo' }) as HTMLTextAreaElement;
  const go = named(button('Work it out', async () => {
    const r = await run('split', { words: words.value });
    status.textContent = r.text || 'My brain didn’t answer.';
  }, 'on'), 'Work out who owes whom');
  return h('div.pkcol', words, go, status);
}
