/**
 * While the brain's database is paused (free daily allowance used up), Ghosty can still
 * remember things and set reminders and events: these versions of remember / set_reminder /
 * add_event hand the change to the owner's device (client command offline_save), which shows
 * it at once, fires reminders itself, and sends everything to the brain when it's back.
 */
import type { LibraryHit } from '../../../../packages/shared/src/protocol';
import { asData } from '../kernel/permissions';
import { formatHits, queryTerms, searchStarterInMemory } from '../library/store';
import { fmtLocal, parseWhen, safeTz } from '../time';
import { agendaTools, repeatArg, whenArg } from './agenda';
import { libraryTools } from './library';
import { memoryTools } from './memory';
import { arg, clip, type Tool } from './types';

const schema = (list: Tool[], name: string) => list.find((t) => t.name === name)!;

export function deviceTools(tzRaw: string | undefined): Tool[] {
  const tz = safeTz(tzRaw);
  const remember = schema(memoryTools, 'remember');
  const reminder = schema(agendaTools, 'set_reminder');
  const event = schema(agendaTools, 'add_event');
  return [
    {
      ...remember,
      async run(a, ctx) {
        ctx.emit({ t: 'client', name: 'offline_save', args: { op: 'addMemory', text: arg.str(a, 'text').slice(0, 500) } });
        return "Remembered (kept on the owner's device; it goes into my memory automatically when the database is back).";
      },
    },
    {
      ...reminder,
      async run(a, ctx) {
        const text = arg.str(a, 'text');
        const at = whenArg(a, tz);
        const repeat = repeatArg(a);
        ctx.emit({ t: 'client', name: 'offline_save', args: { op: 'addJob', job: { kind: 'reminder', title: text.slice(0, 120), text, at, repeat } } });
        return `Reminder set for ${fmtLocal(at, tz)}${repeat !== 'none' ? `, repeating ${repeat}` : ''}. It is kept on the owner's device for now (it goes off there while Ghosty is open) and moves into my agenda when the database is back.`;
      },
    },
    {
      ...event,
      async run(a, ctx) {
        const startRaw = arg.str(a, 'start');
        const start = parseWhen(startRaw, tz);
        if (start === null) throw new Error(`could not understand "${startRaw}"`);
        const end = a.end ? parseWhen(String(a.end), tz) ?? undefined : undefined;
        const allDay = /^\d{4}-\d{2}-\d{2}$/.test(startRaw.trim());
        const remindMin = a.remind_minutes_before !== undefined && a.remind_minutes_before !== null ? arg.num(a, 'remind_minutes_before', 0) : null;
        ctx.emit({ t: 'client', name: 'offline_save', args: { op: 'addEvent', event: { title: arg.str(a, 'title'), start, end, allDay, location: a.location ? String(a.location) : undefined, remindMin } } });
        return `Added "${arg.str(a, 'title')}" on ${fmtLocal(start, tz, !allDay)} (kept on the owner's device; it moves into my agenda when the database is back).`;
      },
    },
  ];
}

/** A passage of the owner's own library, sent by their device while the database is paused. */
export interface DevicePassage {
  title: string;
  heading?: string;
  page?: number | null;
  text: string;
}

/** Keyword match without the database (the same rule as the built-in library's fallback). */
export function searchPassages(query: string, list: DevicePassage[], k: number): LibraryHit[] {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const stems = terms.map((t) => t.slice(0, Math.max(3, Math.min(t.length, 5))));
  return list
    .map((p) => {
      const low = `${p.title} ${p.heading ?? ''} ${p.text}`.toLowerCase();
      return { p, score: stems.filter((s) => low.includes(s)).length / stems.length };
    })
    .filter((x) => x.score >= (terms.length >= 3 ? 0.5 : 0.99))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ p, score }) => ({ doc: 'device', title: p.title, heading: p.heading ?? '', page: p.page ?? null, text: p.text, score, relevant: true }));
}

/** library_search while paused: the owner's documents their device sent, plus the built-in library. */
export function deviceLibrarySearch(passages: DevicePassage[]): Tool {
  const real = libraryTools.find((t) => t.name === 'library_search')!;
  return {
    ...real,
    async run(a) {
      const q = arg.str(a, 'query');
      const k = Math.max(1, Math.min(10, arg.num(a, 'k', 5)));
      const hits = [...searchPassages(q, passages, k), ...searchStarterInMemory(q, k)].sort((x, y) => y.score - x.score).slice(0, k);
      if (!hits.length) return "Nothing matches that in the passages available while the database is paused (the owner's documents most related to their message, and the built-in library).";
      return clip(asData('your library', formatHits(hits, 7000)), 8000);
    },
  };
}
