/**
 * [planlane4:calendar] COLOUR CALENDARS TO SHOW OR HIDE. Each calendar the diary reads (his own diary, and each linked calendar feed, as the
 * agenda read names it in each event's `source`) has a colour from the design tokens (his pick from a small palette) and a show/hide switch.
 * Both are kept on this phone (`ghosty.agenda.calendars`): a hidden calendar leaves the timeline, the month, the year and the diary, and the
 * colour marks its events wherever they are drawn. A change is said to every view by the `ghosty:calendars` signal.
 * The CALENDARS sheet (calendarSheet) lists them with every state in his words.
 */
import type { AgendaEventInfo } from '../../../../../packages/shared/src/protocol';
import { clear, h } from '../../core/dom';
import { button, modal } from '../../ui/components';
import { stateCard } from '../../ui/appkit';

/** The palette: design tokens only (each look sets its own shade of them, light grounds too), named for VoiceOver. */
export const PALETTE: { key: string; name: string; css: string }[] = [
  { key: 'accent', name: 'Theme colour', css: 'var(--g-accent)' },
  { key: 'green', name: 'Green', css: 'var(--g-ok)' },
  { key: 'amber', name: 'Amber', css: 'var(--g-amber)' },
  { key: 'red', name: 'Red', css: 'var(--g-red)' },
  { key: 'mint', name: 'Mint', css: 'color-mix(in srgb, var(--g-ok) 50%, var(--g-accent))' },
  { key: 'grey', name: 'Grey', css: 'var(--g-ink-3)' },
];
const KEY = 'ghosty.agenda.calendars';
/** His own diary, whatever this phone calls an event of his not sent yet. */
export const MINE = 'mine';
export const calOf = (source: string): string => (source === MINE || source.startsWith('this device') ? MINE : source);
export const calName = (cal: string): string => (cal === MINE ? 'Your diary' : cal);

type Prefs = Record<string, { colour?: string; hidden?: boolean }>;
let cache: Prefs | null = null;
function prefs(): Prefs {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    cache = v && typeof v === 'object' && !Array.isArray(v) ? (v as Prefs) : {};
  } catch {
    cache = {};
  }
  return cache;
}
/** Whether the last change was kept on this phone (a full or private store keeps it for this visit only, and the sheet says so). */
let keptOk = true;
function save(p: Prefs): void {
  cache = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    keptOk = true;
  } catch {
    keptOk = false;
  }
  dispatchEvent(new CustomEvent('ghosty:calendars'));
}

/** A calendar's colour key: his pick, or the next of the palette in the order the calendars come (his diary the theme colour). */
export function colourKey(cal: string, order: readonly string[] = []): string {
  const k = prefs()[cal]?.colour;
  if (k && PALETTE.some((c) => c.key === k)) return k;
  if (cal === MINE) return 'accent';
  const i = order.filter((c) => c !== MINE).indexOf(cal);
  // (a feed not yet in the order list: by its name, so the same feed keeps the same colour on every view)
  const n = i >= 0 ? i : [...cal].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return PALETTE[1 + (n % (PALETTE.length - 1))]!.key;
}
/** The calendar's colour as a CSS value (a design token), for `--c` on whatever draws its events. */
export function colourOf(source: string, order: readonly string[] = known()): string {
  const k = colourKey(calOf(source), order);
  return PALETTE.find((c) => c.key === k)!.css;
}
export const shown = (source: string): boolean => !prefs()[calOf(source)]?.hidden;
/** The events whose calendars are shown. */
export const visible = <T extends Pick<AgendaEventInfo, 'source'>>(events: readonly T[]): T[] => events.filter((e) => shown(e.source));
export function setHidden(cal: string, hidden: boolean): void {
  const p = { ...prefs() };
  p[cal] = { ...p[cal], hidden };
  save(p);
}
export function setColour(cal: string, colour: string): void {
  const p = { ...prefs() };
  p[cal] = { ...p[cal], colour };
  save(p);
}
export const hiddenCount = (cals: readonly string[]): number => cals.filter((c) => prefs()[c]?.hidden).length;

/** The calendars this phone knows: his diary first, then each feed by the order the brain lists them (set by the Agenda on every read). */
let feedNames: string[] = [];
export function setFeeds(names: readonly string[]): void {
  feedNames = [...new Set(names)];
}
export const known = (): string[] => [MINE, ...feedNames.filter((n) => n !== MINE)];

/** The calendars of `events` and of the linked feeds, his diary first. */
export function calendarsOf(events: readonly Pick<AgendaEventInfo, 'source'>[]): string[] {
  const out = known();
  for (const e of events) if (!out.includes(calOf(e.source))) out.push(calOf(e.source));
  return out;
}

/** "2 calendars hidden: Work and Football. CALENDARS shows them again." (or '' with none hidden) */
export function hiddenWords(cals: readonly string[]): string {
  const off = cals.filter((c) => prefs()[c]?.hidden).map(calName);
  if (!off.length) return '';
  const names = off.length === 1 ? off[0] : `${off.slice(0, -1).join(', ')} and ${off.at(-1)}`;
  return `${off.length === 1 ? 'Hidden' : `${off.length} calendars hidden`}: ${names}. CALENDARS shows ${off.length === 1 ? 'it' : 'them'} again.`;
}

/**
 * The CALENDARS sheet: each calendar with its colour (a key per palette colour) and SHOWN / HIDDEN. `get` gives the events read so far and
 * whether the diary is read yet and from the phone's copy; it repaints on every change.
 */
export function calendarSheet(get: () => { events: AgendaEventInfo[]; loaded: boolean; offline: boolean }): void {
  const body = h('div.calsheet', { dataset: { case: 'keep' } });
  // (the App Kit's state card, marked with its state for the checks and kept in his own case)
  const said = (el: HTMLElement, state: string) => {
    el.classList.add('calsay');
    el.dataset.state = state;
    el.dataset.case = 'keep';
    return el;
  };
  const paint = () => {
    const { events, loaded, offline } = get();
    const cals = calendarsOf(events);
    const rows = cals.map((cal) => {
      const n = events.filter((e) => calOf(e.source) === cal).length;
      const off = !!prefs()[cal]?.hidden;
      const cur = colourKey(cal, cals);
      const swatches = h('div.calswatches', { role: 'radiogroup', 'aria-label': `Colour for ${calName(cal)}` },
        ...PALETTE.map((c) => {
          const b = button('', () => setColour(cal, c.key), `calswatch${c.key === cur ? ' on' : ''}`);
          b.style.setProperty('--c', c.css);
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(c.key === cur));
          b.setAttribute('aria-label', `${c.name}${c.key === cur ? ', in use' : ''}`);
          b.append(h('i.calchip', { 'aria-hidden': 'true' }), c.key === cur ? h('span.calcheck', { 'aria-hidden': 'true' }, '✓') : '');
          return b;
        }));
      const tog = button(off ? 'HIDDEN' : 'SHOWN', () => setHidden(cal, !off), `caltoggle${off ? '' : ' on'}`);
      tog.setAttribute('role', 'switch');
      tog.setAttribute('aria-checked', String(!off));
      tog.setAttribute('aria-label', `${calName(cal)}: ${off ? 'hidden. Tap to show it' : 'shown. Tap to hide it'}`);
      const sub = !loaded ? 'Reading its events…' : cal === MINE ? `${n ? `${n} coming up` : 'Nothing coming up'} · you can move and change these` : `${n ? `${n} coming up` : 'Nothing coming up in the next six weeks'} · read only`;
      const r = h('div.calrow', { role: 'group', 'aria-label': calName(cal), dataset: { cal, case: 'keep' } },
        h('div.calhead', h('i.caldot', { 'aria-hidden': 'true', style: `--c:${colourOf(cal, cals)}` }), h('b.calname', calName(cal)), tog),
        h('small.calsub', off ? `Hidden from the timeline, the month, the year and the diary.` : sub),
        swatches);
      r.classList.toggle('off', off);
      return r;
    });
    /* state: agenda.calendars loading */
    const wait = !loaded ? [h('p.note.wait.calsay', { dataset: { case: 'keep', state: 'loading' } }, 'Reading your calendars from your brain. Your own diary is always here.')] : [];
    /* state: agenda.calendars offline */
    const off = offline ? [h('p.note.bad.calsay', { dataset: { case: 'keep', state: 'offline' } }, 'I can’t reach your brain, so this lists the calendars in the copy on this phone. Colours and switches still work: they live on this phone.')] : [];
    /* state: agenda.calendars empty */
    const none = loaded && cals.length === 1 ? [said(stateCard('empty', 'Only your own diary so far. Link a calendar under Calendars (its secret iCal link) and it shows here with a colour of its own.'), 'empty')] : [];
    /* state: agenda.calendars error */
    const lost = keptOk ? [] : [said(stateCard('error', 'This phone could not keep that (its storage is full or private), so it lasts until Ghosty is closed.'), 'error')];
    clear(body, ...wait, ...off, ...lost, h('div.callist', { role: 'list' }, ...rows), ...none, h('small.note.calfoot', 'Colours and what is shown are kept on this phone. Hidden calendars still ring their reminders.'));
  };
  const on = () => paint();
  addEventListener('ghosty:calendars', on);
  paint();
  modal('Calendars', body, () => removeEventListener('ghosty:calendars', on));
}

/** The CALENDARS key that opens the sheet, with how many are hidden said on it. */
export function calendarsKey(get: Parameters<typeof calendarSheet>[0], cls = ''): HTMLButtonElement {
  const cals = calendarsOf(get().events);
  const off = hiddenCount(cals);
  const b = button(off ? `CALENDARS · ${off} HIDDEN` : 'CALENDARS', () => calendarSheet(get), `calkey${cls ? ` ${cls}` : ''}${off ? ' some' : ''}`);
  b.setAttribute('aria-label', off ? `Calendars: ${off} hidden. Choose colours and which to show` : 'Calendars: choose colours and which to show');
  return b;
}
