/**
 * Route C's Home (the calm looks, Graphite and Reactor; docs/build-plan/mockups/c/home.png): the date line,
 * the greeting (the navigation bar's large title), the weather line, the reactor with four instruments
 * around it, the live-state pill, the Today card, the Roads near you and Gym tiles. The chips and the ask
 * bar are the reactor screen's own (features/core/index.ts).
 *
 * Every value comes from the app's own state, and each one says when it has none:
 *   FREE AI   the brain's quota engine (`/api/status` capacity): what is left of today's free allowance
 *   SCHOOL    `/api/school` (the stage he is at, subjects passed) — the gauge hides when there is no school
 *   LIBRARY   the library's passages (`/api/library`) and the topics studied (`/api/library/study` summary)
 *   UPLINK    the measured round trip to the brain (`/api/health`)
 *   TODAY     the agenda (`/api/agenda`), what is left of today
 *   ROADS     National Highways' live incidents (`/api/highways/events`) within 30 km of home
 *   GYM       the games' records on this phone (features/gym/store.ts)
 * The classic looks never show any of it (styles.css hides these parts outside html[data-look="pro"]).
 */
import { brain, headers } from '../../api/brain';
import { clear, fmt, h, icon, svgEl } from '../../core/dom';
import { parseIncidents, severity, type Incident } from '../../data/incidents';
import { WMO, temp, weather } from '../../data/weather';
import { META as GAMES } from '../../gym/meta';
import { navTo } from '../../shell/areas';
import { home, ui } from '../../state/app';
import { freeAiToday } from '../../state/status';
import { niceCase, segRing } from '../../ui/components';
import * as gymStore from '../gym/store';

const CAL = '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>';
const CAR = '<path d="M5 16.5V12l1.8-4.6A2 2 0 018.7 6h6.6a2 2 0 011.9 1.4L19 12v4.5"/><path d="M4 12h16v4.5H4z"/><circle cx="7.5" cy="14.3" r=".9"/><circle cx="16.5" cy="14.3" r=".9"/><path d="M6 16.5V19M18 16.5V19"/>';
const GYM = '<path d="M2.5 9.5v5M5.5 7.5v9M18.5 7.5v9M21.5 9.5v5"/><path d="M5.5 12h13"/>';
const CLOUD = '<path d="M7 17.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 9.2 4.2 4.2 0 007 17.5z"/>';
const RAIN = '<path d="M7 14.5h10a4 4 0 00.6-7.95A5.5 5.5 0 006.9 6.2 4.2 4.2 0 007 14.5z"/><path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>';
const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>';

/** "M6 northbound between J6 and J7" → "M6 J6–J7"; "M42 J4 northbound access" → "M42 J4". */
export function roadName(i: Pick<Incident, 'road' | 'title'>): string {
  const js = [...i.title.matchAll(/\bJ(\d+[A-Z]?)\b/g)].map((m) => `J${m[1]}`);
  const road = i.road || i.title.split(' ')[0] || '';
  return js.length >= 2 ? `${road} ${js[0]}–${js[1]}` : js.length === 1 ? `${road} ${js[0]}` : road;
}

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

/** The incidents near home that matter most: the worst first, then the longest delay, then the nearest. */
export function nearIncidents(list: Incident[], at: { lat: number; lon: number }, radiusKm = 30): Incident[] {
  return list
    .map((i) => ({ i, d: km(at, i) }))
    .filter((x) => x.d <= radiusKm)
    .sort((a, b) => severity(b.i) - severity(a.i) || b.i.delayS - a.i.delayS || a.d - b.d)
    .map((x) => x.i);
}

/** "There are 1 of 3 lanes closed" → "1 of 3 lanes closed". */
const lanesText = (s: string) => s.replace(/^there (are|is)\s+/i, '').trim();
/** When it should clear, as a clock time, if the report says (ISO or a plain "19:40"). */
function clearsAt(normalBy: string): string {
  if (!normalBy) return '';
  const t = Date.parse(normalBy);
  if (Number.isFinite(t)) return fmt.time(new Date(t));
  const m = normalBy.match(/\b(\d{1,2}:\d{2})\b/);
  return m ? m[1]! : '';
}
const clock = (ms: number) => fmt.time(new Date(ms));
/** "in 48 min", "in 1 h 20 min", "now". */
function until(ms: number, now = Date.now()): string {
  const m = Math.round((ms - now) / 60000);
  if (m <= 0) return 'now';
  if (m < 60) return `in ${m} min`;
  const hrs = Math.floor(m / 60);
  return `in ${hrs} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

interface Callout { el: HTMLElement; k: HTMLElement; v: HTMLElement; s: HTMLElement }
function callout(cls: string, label: string): Callout {
  const k = h('span.k', h('i'), h('span', label));
  const v = h('div.v');
  const s = h('div.s');
  return { el: h(`div.rcco.${cls}` as 'div', { dataset: { case: 'keep' } }, k, v, s), k, v, s };
}
const setCo = (c: Callout, value: string, unit: string, sub: string, tone: 'live' | 'warn' | 'idle' = 'live') => {
  clear(c.v, value, unit ? h('small', unit) : null);
  c.s.textContent = sub;
  c.el.dataset.tone = tone;
};

export interface Home {
  /** Put into the navigation bar (the date sits beside search and the avatar). */
  date: HTMLElement;
  /** Under the greeting. */
  wx: HTMLElement;
  /** The reactor's frame: the instruments go around `reactorWrap`, which moves inside it. */
  hero: HTMLElement;
  /** Under the hero: the Today card and the two tiles. */
  below: HTMLElement;
  /** The soft glow behind the reactor: it sits behind the whole screen (never cut by the scrolling column). */
  glow: HTMLElement;
  /** Every few seconds while the reactor screen is on (the date, the weather line, the countdowns). */
  tick(): void;
  /** On entering the reactor screen: fetch what is stale. */
  enter(): void;
}

export function routeCHome(reactorWrap: HTMLElement): Home {
  const date = h('span.rcdate', { 'aria-hidden': 'true' });
  const wxIcon = h('span.rcwxi');
  const wxText = h('span');
  const wx = h('div.rcwx', { dataset: { case: 'keep' } }, wxIcon, wxText);

  // ---------- the hero: the reactor, three arcs and four instruments
  // The arcs are instruments, open at the bottom (135° → 405°): the outer one is the free AI left today,
  // the middle one the share of the library's topics he has studied, the inner one the school stage's
  // subjects passed. Tick marks every 10 % and two hairline guides only frame them.
  const VB = { w: 440, h: 292 };
  const cx = VB.w / 2;
  const cy = VB.h / 2;
  const arcs = svgEl('svg', { viewBox: `0 0 ${VB.w} ${VB.h}`, class: 'rcarcs', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' });
  const P = (r: number, a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)] as const;
  const arcD = (r: number, a0: number, a1: number) => {
    const [x0, y0] = P(r, a0);
    const [x1, y1] = P(r, a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const A0 = 135;
  const SPAN = 270;
  // the scale: a tick every 10 %, longer at 0, 50 and 100 %
  const ticks = svgEl('g', { class: 'rcticks' });
  for (let k = 0; k <= 10; k++) {
    const [x0, y0] = P(126, A0 + 27 * k);
    const [x1, y1] = P(k % 5 ? 130 : 133, A0 + 27 * k);
    ticks.append(svgEl('line', { x1: x0.toFixed(1), y1: y0.toFixed(1), x2: x1.toFixed(1), y2: y1.toFixed(1), class: k % 5 ? '' : 'big' }));
  }
  // hairline guides out to the instruments, fading towards the edges
  const guides = svgEl('g', { class: 'rcguides' });
  for (const side of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const x = side < 0 ? 20 + k * 12 : 420 - k * 12;
      guides.append(svgEl('rect', { x, y: cy - 3.5, width: 1, height: 7, fill: '#fff', opacity: (0.06 + (0.3 * k * 12) / 74).toFixed(2) }));
    }
    guides.append(svgEl('rect', { x: side < 0 ? 20 : 346, y: cy - 0.5, width: 74, height: 1, fill: side < 0 ? 'url(#rcgl)' : 'url(#rcgr)' }));
  }
  const gauge = (r: number, cls: string) => {
    const track = svgEl('path', { d: arcD(r, A0, A0 + SPAN), class: `rctrack ${cls}` });
    const fg = svgEl('path', { d: arcD(r, A0, A0 + SPAN), class: `rcarc ${cls}`, pathLength: 100, 'stroke-dasharray': '0 100' });
    arcs.append(track, fg);
    return { track, fg };
  };
  const outer = gauge(120, 'o');
  const mid = gauge(112, 'm');
  const inn = gauge(104, 'i');
  const outerDot = svgEl('circle', { r: 2.6, class: 'rcdot' });
  const outerHalo = svgEl('circle', { r: 5, class: 'rchalo' });
  // the guides fade in towards the reactor (one gradient each way)
  const defs = svgEl('defs', {});
  for (const [id, x1, x2] of [['rcgl', 0, 1], ['rcgr', 1, 0]] as const) {
    const g = svgEl('linearGradient', { id, x1, x2, y1: 0, y2: 0 });
    g.append(svgEl('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0 }), svgEl('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0.32 }));
    defs.append(g);
  }
  arcs.prepend(defs, guides);
  arcs.append(ticks, outerHalo, outerDot);
  const setArc = (g: { track: SVGPathElement; fg: SVGPathElement }, frac: number | null, dot = false) => {
    const f = frac == null ? 0 : Math.max(0, Math.min(1, frac));
    g.fg.setAttribute('stroke-dasharray', `${(f * 100).toFixed(2)} 100`);
    g.fg.style.opacity = f > 0.003 ? '' : '0';
    g.track.style.opacity = frac == null ? '0.4' : '';
    if (!dot) return;
    const [x, y] = P(120, A0 + SPAN * f);
    for (const c of [outerDot, outerHalo]) {
      c.setAttribute('cx', x.toFixed(1));
      c.setAttribute('cy', y.toFixed(1));
      c.style.opacity = f > 0.003 ? '' : '0';
    }
  };
  setArc(outer, null, true);
  setArc(mid, null);
  setArc(inn, null);
  inn.track.style.display = 'none';
  // the one soft glow behind the reactor; it breathes (a 4 s cycle, ±6 %) unless the phone asks for less motion
  const glow = h('div.rcglow', { 'aria-hidden': 'true' });
  const ai = callout('tl', 'Free AI');
  const school = callout('tr', 'School');
  const lib = callout('bl', 'Library');
  const up = callout('br', 'Uplink');
  school.el.hidden = true;
  const hero = h('div.rchero', arcs, reactorWrap, ai.el, school.el, lib.el, up.el);

  // ---------- Today
  const todayLeft = h('em');
  const evs = h('div.rcevs');
  const today = h('button.rccard.rctoday', { type: 'button', dataset: { case: 'keep' }, 'aria-label': 'Today: open the agenda', onclick: () => navTo('agenda', 'push') },
    h('span.rcthead', icon(CAL), h('b', 'Today'), todayLeft), evs);

  // ---------- Roads near you
  const roadBody = h('span.rcbody');
  let roadTap: (() => void) | null = null;
  const road = h('button.rccard.rcroad', { type: 'button', dataset: { case: 'keep' }, 'aria-label': 'Roads near you', onclick: () => (roadTap ? roadTap() : navTo('eye', 'push')) },
    h('span.rcthead', icon(CAR), h('b', 'Roads near you')), roadBody);

  // ---------- Gym
  const gymBody = h('span.rcbody');
  const gymTile = h('button.rccard.rcgym', { type: 'button', dataset: { case: 'keep' }, 'aria-label': 'Gym: open it', onclick: () => navTo('gym', 'push') },
    h('span.rcthead', icon(GYM), h('b', 'Gym')), gymBody);

  const below = h('div.rcbelow', today, h('div.rcpair', road, gymTile));

  // ---------- painting, each part from its own source
  const paintDate = () => {
    date.textContent = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const paintWx = () => {
    const w = weather.data;
    if (!w) {
      clear(wxIcon);
      wxText.textContent = weather.status === 'NO FEED' ? 'Weather unavailable right now' : 'Fetching the weather…';
      return;
    }
    const code = w.current.weather_code;
    clear(wxIcon, icon(code >= 51 ? RAIN : code <= 1 ? SUN : CLOUD));
    // "11° · Light rain in Birmingham": the unit is in Settings, the number says it here
    wxText.textContent = `${temp(w.current.temperature_2m).replace(/[CF]$/, '')} · ${niceCase(WMO(code))} in ${home().name}`;
  };

  // FREE AI (and the outer arc)
  let statusAt = 0;
  const paintAi = async (force = false) => {
    if (!force && Date.now() - statusAt < 120_000) return;
    statusAt = Date.now();
    const s = await brain.status().catch(() => null);
    if (!s) {
      setCo(ai, '—', '', ui.get().connected === false ? 'brain offline' : 'can’t be read now', 'idle');
      setArc(outer, null, true);
      return;
    }
    const f = freeAiToday(s.capacity);
    setCo(ai, f.value, f.unit, f.sub, f.tone);
    setArc(outer, f.frac, true);
    arcs.dataset.tone = f.tone;
  };
  // LIBRARY (and the inner arc: the topics studied)
  let libAt = 0;
  const paintLib = async (force = false) => {
    if (!force && Date.now() - libAt < 300_000) return;
    libAt = Date.now();
    const [l, st] = await Promise.all([brain.library().catch(() => null), brain.studyStatus().catch(() => null)]);
    if (!l) {
      setCo(lib, '—', '', 'can’t be read now', 'idle');
      setArc(mid, null);
      return;
    }
    const read = st?.summary?.read ?? null;
    const topics = st?.summary?.topics ?? 0;
    setCo(lib, fmt.n(l.stats.passages), '', read == null ? 'passages' : `${fmt.n(read)} studied`, l.stats.passages ? 'live' : 'idle');
    setArc(mid, topics && read != null ? read / topics : null);
  };
  // SCHOOL: hidden until there is a school to report on
  let schoolAt = 0;
  const paintSchool = async (force = false) => {
    if (!force && Date.now() - schoolAt < 600_000) return;
    schoolAt = Date.now();
    const j = await fetch('/api/school', { headers: headers() }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Record<string, unknown> | null;
    const st = j?.state as { stage?: string } | undefined;
    if (!j || !st?.stage) {
      school.el.hidden = true;
      inn.track.style.display = 'none';
      setArc(inn, null);
      return;
    }
    const stages = Array.isArray(j.stages) ? (j.stages as { id?: string; label?: string; name?: string }[]) : [];
    const here = stages.find((x) => x.id === st.stage);
    const name = here?.label ?? here?.name ?? niceCase(String(st.stage).replace(/[-_]/g, ' '));
    const latest = j.latest && typeof j.latest === 'object' ? Object.values(j.latest as Record<string, unknown>) : [];
    const subjects = latest.filter((x) => x && typeof x === 'object') as { top?: boolean; topGrade?: boolean }[];
    const passed = subjects.filter((x) => x.top || x.topGrade).length;
    setCo(school, name, '', subjects.length ? `${passed} of ${subjects.length} passed` : 'no papers sat yet');
    school.el.hidden = false;
    inn.track.style.display = '';
    setArc(inn, subjects.length ? passed / subjects.length : 0);
  };
  // UPLINK: the round trip to the brain, measured now
  const paintUp = async () => {
    const t0 = performance.now();
    const ok = await brain.health();
    const ms = Math.round(performance.now() - t0);
    if (!ok) setCo(up, 'Off', '', navigator.onLine ? 'brain unreachable' : 'no signal', 'warn');
    else setCo(up, String(ms), 'ms', location.protocol === 'https:' || location.hostname === 'localhost' ? 'Secure' : 'Not encrypted', ms > 800 ? 'warn' : 'live');
  };

  // TODAY
  type Ev = { title: string; start: number; end?: number | null; allDay?: boolean };
  let events: Ev[] | null = null;
  let agendaErr = false;
  let agendaAt = 0;
  const paintToday = () => {
    const now = Date.now();
    const end = new Date().setHours(24, 0, 0, 0);
    if (events === null) {
      todayLeft.textContent = '';
      clear(evs, h('span.rcev.muted', h('span.nm', agendaErr ? 'Your diary can’t be reached right now' : 'Checking your diary…')));
      return;
    }
    const left = events.filter((e) => (e.end ?? e.start) > now && e.start < end).sort((a, b) => a.start - b.start);
    todayLeft.textContent = left.length ? `${left.length} left` : '';
    if (!left.length) {
      const next = events.filter((e) => e.start >= end).sort((a, b) => a.start - b.start)[0];
      clear(evs, h('span.rcev.muted', h('span.nm', 'Nothing more today')), next ? h('span.rcev', h('span.tm', 'Tmrw'), h('i.bar.dim'), h('span.nm.r', `${next.title}${next.allDay ? '' : ` · ${clock(next.start)}`}`)) : null);
      return;
    }
    clear(evs, ...left.slice(0, 2).map((e, i) => h('span.rcev', h('span.tm', e.allDay ? 'All day' : clock(e.start)), h(`i.bar${i ? '.dim' : ''}` as 'i'), h(`span.nm${i ? '.r' : ''}` as 'span', e.title), !i && !e.allDay && e.start - now < 3 * 3600_000 ? h('span.in', until(e.start, now)) : null)));
  };
  const loadToday = async (force = false) => {
    if (!force && Date.now() - agendaAt < 120_000) return paintToday();
    agendaAt = Date.now();
    const ag = await brain.agenda(2).catch(() => null);
    agendaErr = !ag;
    events = ag ? ag.events : events;
    paintToday();
  };

  // ROADS
  let roadAt = 0;
  const loadRoads = async (force = false) => {
    if (!force && Date.now() - roadAt < 180_000) return;
    roadAt = Date.now();
    if (!roadBody.childElementCount) clear(roadBody, h('span.rdwhy', 'Checking the roads…'));
    const raw = await fetch('/api/highways/events', { headers: headers() }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).catch(() => null);
    if (!raw) {
      roadTap = null;
      clear(roadBody, h('span.rd', h('i.idle'), h('b', 'No report')), h('span.rdwhy', ui.get().connected === false ? 'Offline: traffic needs the brain' : 'Traffic reports can’t be reached right now'));
      return;
    }
    const H = home();
    const near = nearIncidents(parseIncidents(raw), H);
    const top = near[0];
    if (!top) {
      roadTap = null;
      clear(roadBody, h('span.rd', h('i.ok'), h('b', 'All clear')), h('span.rdwhy', `No incidents within 30 km of ${H.name}`));
      return;
    }
    const sev = severity(top);
    const delay = top.delayS >= 60 ? `+${Math.round(top.delayS / 60)} min` : '';
    const why = `${niceCase(top.reason || 'Incident')} ${top.direction.toLowerCase()}`.trim();
    const clears = clearsAt(top.normalBy);
    roadTap = () => void import('../../commands/builtin').then((m) => m.flyTo({ lat: top.lat, lon: top.lon, range_km: 40 }));
    clear(roadBody,
      h('span.rd', h(`i${sev ? '' : '.idle'}` as 'i'), h('b', roadName(top))),
      h('span.rdwhy', [why, delay || lanesText(top.lanesClosed)].filter(Boolean).join(' · ')),
      clears ? h('span.rdclr', 'Clears by ', h('b', clears)) : h('span.rdclr', near.length > 1 ? `${near.length - 1} more nearby` : `Updated ${top.updated ? fmt.ago(top.updated) : 'just now'}`),
    );
  };

  // GYM
  const loadGym = async () => {
    const recs = await gymStore.loadAll().catch(() => new Map());
    const all = [...recs.values()];
    const mastered = GAMES.filter((g) => recs.get(g.id)?.mastered).length;
    const last = all.filter((r) => r.units).sort((a, b) => b.updated - a.updated)[0];
    const g = last ? GAMES.find((x) => x.id === last.id) : undefined;
    clear(gymBody,
      h('span.rcgrow', segRing(GAMES.length, mastered, 58, String(mastered)), h('span.rcof', h('b', `of ${GAMES.length} games`), h('span', 'mastered'))),
      h('span.rdclr', g && last ? `Last: ${niceCase(g.title)} · Lv ${last.level}` : 'Not started yet'),
    );
  };

  paintDate();
  paintWx();
  paintToday();
  weather.onChange(paintWx);
  setCo(ai, '—', '', 'measuring…', 'idle');
  setCo(lib, '—', '', 'counting…', 'idle');
  setCo(up, '—', '', 'measuring…', 'idle');
  ui.subscribe((s, p) => {
    if (s.connected !== p.connected && s.connected) {
      void paintAi(true);
      void loadToday(true);
    }
  });
  return {
    date,
    wx,
    hero,
    below,
    glow,
    tick() {
      paintDate();
      paintToday();
    },
    enter() {
      paintDate();
      void paintAi();
      void paintLib();
      void paintSchool();
      void paintUp();
      void loadToday();
      void loadRoads();
      void loadGym();
    },
  };
}
