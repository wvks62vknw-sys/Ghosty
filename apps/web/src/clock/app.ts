/**
 * THE CLOCK (APPS ROUND, polish3.n1), an app of its own built on the App Kit (ui/appkit.ts): the time here, big, with the
 * date; WORLD CLOCKS for the cities he keeps (each with how it stands to here, summer time included); a STOPWATCH with
 * laps; and TIMERS that ring (the same timers as the kitchen's, so a lock screen reminder reaches him too). Everything works
 * with no signal: the cities and their zones are in the app, and the phone keeps the time. Opened from the chat ("open the
 * clock", "world clock", "stopwatch") and from System.
 */
import { h } from '../core/dom';
import { modal } from '../ui/components';
import { app, type KitApp, listRow } from '../ui/appkit';
import { key } from '../ui/machine';
import { against, findCity, lapWords, leftWords, timeIn } from './zones';

export const CLOCK_GLYPH = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';

/** What the spec and Ghosty read. */
export const clockState = { open: false, cities: 0, watch: 'idle' as 'idle' | 'running' | 'stopped', laps: 0, timers: 0 };

/** A kit key's word changed (its label with it). */
const word = (b: HTMLButtonElement, w: string) => {
  const span = b.querySelector('span');
  if (span) span.textContent = w;
  else b.textContent = w;
  b.setAttribute('aria-label', w);
};
const here = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London';
const now = (): number => Date.now() + (navigator.webdriver ? Number((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset) || 0 : 0);

/** The words for a city's row: how it stands to here. */
const rowSub = (zone: string, at: number) => against(zone, here(), at);

export async function openClock(start: 'world' | 'stopwatch' | 'timer' = 'world'): Promise<KitApp> {
  const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (g) g.clockApp = clockState;
  clockState.open = true;
  const host = h('div.clkhost', { dataset: { case: 'keep' } });
  let tick = 0;
  const m = modal('CLOCK', host, () => {
    clockState.open = false;
    clearInterval(tick);
    offTimers?.();
  });
  void m;

  // ---- the stage: the time here, then the part he chose (world clocks, the stopwatch, timers)
  const big = h('p.clkbig', { 'aria-live': 'off' });
  const date = h('p.clkdate');
  const tabs = h('div.clkseg', { role: 'tablist', 'aria-label': 'Clock' });
  const part = h('div.clkpart');
  const stage = h('div.clkstage', big, date, tabs, part);

  const k = app(host, {
    id: 'clock',
    name: 'Clock',
    glyph: CLOCK_GLYPH,
    noun: ['city', 'cities'],
    sample: [
      { id: 'c-ny', title: 'New York', zone: 'America/New_York' },
      { id: 'c-dubai', title: 'Dubai', zone: 'Asia/Dubai' },
      { id: 'c-tokyo', title: 'Tokyo', zone: 'Asia/Tokyo' },
    ],
    tour: ['These are sample cities, to show the time there.', 'Tap ✕ to delete one: Undo puts it back.', 'ADD A CITY finds any of seventy cities, with no signal.'],
    actions: [{ word: 'Add a city', run: () => (pick('world'), cityIn.focus()) }],
  });
  k.el.insertBefore(stage, k.body);
  // the kit draws each city as a row; the time on the right and the line under the name are filled in each second
  const paintRows = () => {
    const at = now();
    for (const row of k.body.querySelectorAll<HTMLElement>('.ak-row')) {
      const it = k.items().find((x) => x.id === row.dataset.id);
      const zone = typeof it?.zone === 'string' ? it.zone : '';
      if (!zone) continue;
      const meta: HTMLElement = row.querySelector<HTMLElement>('.ak-rowmeta') ?? h('span.ak-rowmeta');
      if (!meta.isConnected) row.querySelector('.ak-rowmain')?.after(meta);
      meta.textContent = timeIn(zone, at);
      const sub: HTMLElement = row.querySelector<HTMLElement>('.ak-rowsub') ?? h('small.ak-rowsub');
      if (!sub.isConnected) row.querySelector('.ak-rowmain')?.append(sub);
      sub.textContent = rowSub(zone, at);
    }
    clockState.cities = k.items().length;
  };
  const kitRender = k.render.bind(k);
  k.render = () => {
    kitRender();
    // the kit's rows have no delete of their own: each city gets its ✕ here (the kit's remove keeps it in Recently deleted)
    for (const row of k.body.querySelectorAll<HTMLElement>('.ak-row')) {
      if (row.querySelector('.ak-rowdel')) continue;
      const it = k.items().find((x) => x.id === row.dataset.id);
      if (!it) continue;
      const del = listRow(it, { onDelete: () => k.remove(it.id) }).querySelector('.ak-rowdel');
      if (del) row.append(del);
    }
    paintRows();
  };
  k.render();

  // ---- WORLD: add a city (found as he types, from the cities kept in the app)
  const cityIn = h('input.clkcity', { type: 'search', placeholder: 'Add a city', 'aria-label': 'Add a city', autocomplete: 'off', enterKeyHint: 'search' }) as HTMLInputElement;
  const found = h('div.clkfound', { role: 'list', 'aria-label': 'Cities found' });
  const findNow = () => {
    const list = findCity(cityIn.value);
    found.replaceChildren(...list.map(([name, zone]) => {
      const b = key(name, () => {
        if (k.items().some((x) => x.title === name)) return k.notice(`${name} is already here.`);
        k.add({ id: `c-${name.toLowerCase().replace(/\W+/g, '-')}`, title: name, zone });
        k.notice(`Added ${name}: ${timeIn(zone, now())} there.`);
        cityIn.value = '';
        found.replaceChildren();
      }, { kind: 'ghost' });
      b.setAttribute('aria-label', `Add ${name}`);
      return b;
    }));
    if (cityIn.value.trim() && !list.length) found.replaceChildren(h('p.note', `No city called “${cityIn.value.trim()}” yet. Try the nearest big city.`));
  };
  cityIn.addEventListener('input', findNow);

  // ---- STOPWATCH: start, lap, stop, reset; it keeps going while the clock is shut (kept on the phone)
  const SW = 'ghosty.clock.watch';
  type Watch = { start: number; acc: number; running: boolean; laps: number[] };
  const readW = (): Watch => {
    try {
      const v = JSON.parse(localStorage.getItem(SW) ?? 'null');
      return v && Array.isArray(v.laps) ? v : { start: 0, acc: 0, running: false, laps: [] };
    } catch {
      return { start: 0, acc: 0, running: false, laps: [] };
    }
  };
  let w = readW();
  const keepW = () => {
    try {
      localStorage.setItem(SW, JSON.stringify(w));
    } catch {
      /* this visit only */
    }
  };
  const elapsed = () => w.acc + (w.running ? now() - w.start : 0);
  const swRead = h('p.clkwatch', { role: 'timer', 'aria-label': 'Stopwatch' });
  const swGo = key('Start', () => {
    if (w.running) w = { ...w, acc: elapsed(), running: false };
    else w = { ...w, start: now(), running: true };
    keepW();
    paintWatch();
  }, { kind: 'fill' });
  const swLap = key('Lap', () => {
    if (w.running) w.laps = [elapsed(), ...w.laps].slice(0, 99);
    else w = { start: 0, acc: 0, running: false, laps: [] };
    keepW();
    paintWatch();
  });
  const lapList = h('ol.clklaps', { 'aria-label': 'Laps' });
  const paintWatch = () => {
    swRead.textContent = lapWords(elapsed());
    word(swGo, w.running ? 'Stop' : elapsed() ? 'Go on' : 'Start');
    word(swLap, w.running ? 'Lap' : 'Reset');
    swLap.toggleAttribute('disabled', !w.running && !elapsed());
    const laps = w.laps;
    lapList.replaceChildren(...laps.map((t, i) => h('li', h('span', `Lap ${laps.length - i}`), h('span', lapWords(t - (laps[i + 1] ?? 0))))));
    clockState.watch = w.running ? 'running' : elapsed() ? 'stopped' : 'idle';
    clockState.laps = laps.length;
  };

  // ---- TIMERS: the kitchen's timers (they ring here, and on a locked phone where reminders are on)
  const timers = await import('../features/kitchen/timers');
  const timerList = h('div.clktimers', { role: 'list', 'aria-label': 'Timers running' });
  const paintTimers = () => {
    const list = timers.timersNow(now());
    timerList.replaceChildren(...(list.length
      ? list.map((t) => h('div.clktimer', { role: 'listitem', dataset: { timer: t.id, ringing: String(t.ringing) } },
          h('span', h('b', t.name), h('span', ` ${t.ringing ? 'ringing' : leftWords(t.left * 1000)}`)),
          key(t.ringing ? 'Stop' : 'Cancel', () => (timers.stopTimer(t.id), paintTimers()), { kind: t.ringing ? 'fill' : 'ghost' })))
      : [h('p.note', 'No timer running. Pick one above; it rings even with the clock shut.')]));
    clockState.timers = list.length;
  };
  const offTimers = timers.onTimers(paintTimers);
  const presets = h('div.clkpresets', ...[1, 5, 10, 25, 60].map((min) => {
    const b = key(min === 60 ? '1 hour' : `${min} min`, () => {
      timers.startTimers([{ secs: min * 60, name: min === 60 ? '1 hour' : `${min} minutes` }], now());
      k.notice(`A ${min === 60 ? 'one hour' : `${min} minute`} timer is running.`);
      paintTimers();
    });
    b.setAttribute('aria-label', `Start a ${min === 60 ? 'one hour' : `${min} minute`} timer`);
    return b;
  }));

  // ---- the three parts
  const PARTS: [typeof start, string][] = [['world', 'World'], ['stopwatch', 'Stopwatch'], ['timer', 'Timers']];
  let shown: typeof start = start;
  const pick = (p: typeof start) => {
    shown = p;
    for (const b of tabs.querySelectorAll<HTMLElement>('button')) b.setAttribute('aria-selected', String(b.dataset.part === p));
    if (p === 'world') part.replaceChildren(cityIn, found);
    else if (p === 'stopwatch') part.replaceChildren(swRead, h('div.clkkeys', swGo, swLap), lapList);
    else part.replaceChildren(presets, timerList);
    k.body.hidden = p !== 'world';
    paintWatch();
    paintTimers();
  };
  for (const [id, word] of PARTS) {
    const b = key(word, () => pick(id), { kind: 'ghost' });
    b.setAttribute('role', 'tab');
    b.dataset.part = id;
    tabs.append(b);
  }

  const paint = () => {
    const at = now();
    big.textContent = timeIn(here(), at);
    date.textContent = new Date(at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    if (shown === 'world') paintRows();
    if (shown === 'stopwatch' && w.running) swRead.textContent = lapWords(elapsed());
    if (shown === 'timer') paintTimers();
  };
  pick(start);
  paint();
  tick = window.setInterval(paint, 250);
  return k;
}
