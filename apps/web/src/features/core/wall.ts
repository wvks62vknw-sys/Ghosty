/**
 * HOME AS HIS WALL (BRIEF-SIDEWAYS item 4; ROADMAP ② "Home becomes his wall — what he has noticed now — not a grid"): above
 * Home's own cards, the live cards in order of what matters now (packages/shared/src/cards.ts `wallOrder`): danger first,
 * then what is due within two hours, then today's pieces, then the people's and cars' news, then progress — six at most,
 * the rest behind MORE; ALL SCREENS stays one tap. Every card comes from what the phone already holds (the conversation's
 * cards, the inbox, the guardian's warnings, his diary, the cars he named, School and the GYM): nothing on the wall needs a
 * model to draw. An empty wall says one line in his voice.
 */
import { card, carName, wallOrder, wallRank, WALL_CAP, type Card } from '../../../../../packages/shared/src/cards';
import { brain, headers } from '../../api/brain';
import { inbox } from '../../assistant/notices';
import { chat } from '../../assistant/session';
import { run } from '../../commands/registry';
import { clear, h } from '../../core/dom';
import { META as GAMES } from '../../gym/meta';
import { guardian } from '../../state/guardian';
import { button } from '../../ui/components';
import * as gymStore from '../gym/store';
import { cardEl, cars, known, loadCars } from './cards';

const DAY = 86_400_000;
export const EMPTY_WALL = 'Nothing needs you right now. When something does, it’s here first.';

/** What the wall reads besides the stores it watches, each at most every few minutes. */
const held = { due: [] as Card[], dueAt: 0, progress: [] as Card[], progressAt: 0, place: null as Card | null, placeAt: 0 };

/** His diary: what is due within two hours, from the one shared mind (GET /api/mind). */
async function dueSoon(now: number): Promise<Card[]> {
  if (now - held.dueAt < 120_000) return held.due;
  held.dueAt = now;
  const m = await brain.mind().catch(() => null);
  if (!m) return held.due;
  held.due = m.today.items
    .filter((x) => !x.allDay && x.at <= now + 2 * 3_600_000 && (x.end ?? x.at + 15 * 60_000) > now)
    .map((x) => card({ id: `due:${x.kind}:${x.title}:${x.at}`, kind: 'brief', at: now, due: x.at, title: x.title, line: x.at <= now ? 'On now' : `At ${x.when}${x.where ? ` · ${x.where}` : ''}`, brief: { icon: x.kind === 'reminder' ? 'reminder' : 'diary' }, acts: [{ label: 'OPEN AGENDA', open: { tab: 'agenda' } }] }));
  return held.due;
}

/** School and the GYM, as progress. */
async function progress(now: number): Promise<Card[]> {
  if (now - held.progressAt < 600_000) return held.progress;
  held.progressAt = now;
  const out: Card[] = [];
  const j = (await fetch('/api/school', { headers: headers() }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as { state?: { stage?: string }; current?: { label?: string; subjects?: { top?: boolean }[] } } | null;
  if (j?.state?.stage) {
    const subjects = j.current?.subjects ?? [];
    const passed = subjects.filter((x) => x.top).length;
    out.push(card({ id: 'progress:school', kind: 'progress', at: now, title: 'School', line: `${j.current?.label ?? j.state.stage}: ${subjects.length ? `${passed} of ${subjects.length} passed` : 'no subjects yet'}`, progress: { frac: subjects.length ? passed / subjects.length : 0 }, acts: [{ label: 'OPEN SCHOOL', open: { tab: 'school' } }] }));
  }
  const recs = [...(await gymStore.loadAll().catch(() => new Map())).values()];
  if (recs.length) {
    const levels = recs.reduce((s, r) => s + (r.mastered ? 10 : r.level - 1), 0);
    out.push(card({ id: 'progress:gym', kind: 'progress', at: now, title: 'The GYM', line: `${levels} level${levels === 1 ? '' : 's'} across ${recs.length} of ${GAMES.length} games`, progress: { frac: Math.min(1, levels / (GAMES.length * 10)) }, acts: [{ label: 'OPEN GYM', open: { tab: 'gym' } }] }));
  }
  held.progress = out;
  return out;
}

/** No Home saved: the offer to save it (journeys, the rain at home and the morning piece use it). */
async function placeOffer(now: number): Promise<Card | null> {
  if (now - held.placeAt < 300_000) return held.place;
  held.placeAt = now;
  const k = await known().catch(() => null);
  held.place = k && !k.places.some((p) => p.id === 'home')
    ? card({ id: 'place:home', kind: 'place', at: now, title: 'Save Home?', line: 'Tell me your address once: journeys, the rain at home and the morning piece use it.', place: { label: 'Home', saved: false }, acts: [{ label: 'ASK', ask: 'My home is ' }] })
    : null;
  return held.place;
}

/** Every card the wall could show now, from what the phone holds. */
export async function wallCards(now = Date.now()): Promise<Card[]> {
  const out: Card[] = [];
  // what came up in the conversation in the last day (a vehicle's record is shown once: never here)
  for (const e of chat.get().entries) if (e.kind === 'card' && !e.once && !e.card.once && now - e.at < DAY) out.push({ ...e.card, at: e.at });
  // the pieces of his day the brain sent (a reminder, the morning, a warning), whether or not the phone was open
  for (const it of inbox.get().items) if (it.card && !it.quiet && now - it.at < DAY) out.push({ ...it.card, at: it.at });
  // a warning about one of his places, live: first, always
  for (const p of guardian.get().info?.places ?? [])
    for (const w of p.active) out.push(card({ id: `warn:${w.id}`, kind: 'brief', at: w.since, danger: true, title: `${w.feed === 'flood' ? 'Flood' : 'Weather'} warning, ${p.label}`, line: w.title, brief: { icon: 'warning' }, acts: [{ label: 'NEAR HOME', open: { tab: 'threats', panel: 'NEAR HOME' } }] }));
  // the cars he named: the month their MOT or tax falls due
  const month = new Date(now).toISOString().slice(0, 7);
  for (const c of cars.get().list) {
    const what = [c.mot === month ? 'MOT' : '', c.tax === month ? 'tax' : ''].filter(Boolean).join(' and ');
    if (what) out.push(card({ id: `carnews:${c.plate}`, kind: 'car', at: now, title: carName(c), line: `${c.plate}: ${what} due this month`, car: { plate: c.plate, whose: c.whose }, acts: [{ label: 'SHOW THE CAR', car: c.plate }] }));
  }
  const [due, prog, place] = await Promise.all([dueSoon(now), progress(now), placeOffer(now)]);
  out.push(...due, ...prog, ...(place ? [place] : []));
  return wallOrder(out, now);
}

export interface Wall {
  el: HTMLElement;
  /** Paint again from what is held now (cheap); the stores it watches call it themselves. */
  refresh(): void;
}

export function wallView(): Wall {
  const list = h('div.walllist');
  const more = button('MORE', () => {
    open = !open;
    void refresh();
  }, 'wallmore');
  // every screen at once, one tap (the deck's own command: shell/launcher.ts open_systems)
  const all = button('ALL SCREENS', () => void run('open_systems'), 'wallall');
  all.dataset.label = 'All screens';
  const empty = h('p.wallempty', { dataset: { case: 'keep' } }, EMPTY_WALL);
  const el = h('section.wall', { 'aria-label': 'Now', dataset: { case: 'keep' } }, h('div.wallhead', h('b', 'Now'), all), list, empty, more);
  let open = false;
  let painting = 0;
  const refresh = async () => {
    const mine = ++painting;
    const cards = await wallCards().catch(() => [] as Card[]);
    if (mine !== painting) return;
    const shown = open ? cards : cards.slice(0, WALL_CAP);
    clear(list, ...shown.map((c) => cardEl(c, { wall: true })));
    el.dataset.count = String(cards.length);
    empty.hidden = cards.length > 0;
    more.hidden = cards.length <= WALL_CAP;
    more.textContent = open ? 'LESS' : `MORE (${cards.length - WALL_CAP})`;
    more.dataset.label = open ? 'Less' : `More (${cards.length - WALL_CAP})`;
    // for the specs and the console: the wall as it stands (window.__ghosty.wall)
    wallState.ids = cards.map((c) => c.id);
    wallState.ranks = cards.map((c) => wallRank(c, Date.now()));
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.wall = wallState;
  };
  // the stores it reads, each one repainting it
  chat.subscribe((s, p) => s.entries !== p.entries && void refresh());
  inbox.subscribe(() => void refresh());
  guardian.subscribe(() => void refresh());
  cars.subscribe(() => void refresh());
  setTimeout(() => void loadCars(), 4000);
  void refresh();
  return { el, refresh: () => void refresh() };
}

/** What the wall shows, in order (window.__ghosty.wall). */
export const wallState = { ids: [] as string[], ranks: [] as number[] };
