/**
 * Agenda, reminders and scheduled tasks. Times from the model are the owner's local
 * wall-clock time ("2026-10-15T09:30"); the owner's time zone comes from the interface.
 */
import { addEvent, addFeed, addJob, agenda, loadFeeds, loadJobs, removeEvent, removeFeed, removeJob, type Job } from '../schedule';
import { fmtLocal, isoLocal, parseWhen, REPEATS, safeTz, startOfDay, type Repeat } from '../time';
import { asData } from '../kernel/permissions';
import { arg, type Tool, type ToolContext } from './types';

export async function ownerTz(ctx: Pick<ToolContext, 'storage'>): Promise<string> {
  const c = await ctx.storage.get<{ tz?: string }>('owner:ctx');
  return safeTz(c?.tz);
}

const repeatArg = (a: Record<string, unknown>): Repeat => {
  const r = String(a.repeat ?? 'none').toLowerCase() as Repeat;
  if (!REPEATS.includes(r)) throw new Error(`repeat must be one of: ${REPEATS.join(', ')}`);
  return r;
};

/** `at` (local time) or `in_minutes` → UTC ms. */
function whenArg(a: Record<string, unknown>, tz: string): number {
  if (a.in_minutes !== undefined && a.in_minutes !== null && a.in_minutes !== '') {
    const m = arg.num(a, 'in_minutes');
    if (m < 0 || m > 60 * 24 * 400) throw new Error('in_minutes is out of range');
    return Date.now() + m * 60_000;
  }
  const at = arg.str(a, 'at');
  const t = parseWhen(at, tz);
  if (t === null) throw new Error(`could not understand the time "${at}". Use the owner's local time like 2026-10-15T09:30, or in_minutes.`);
  return t;
}

const describeJob = (j: Job) =>
  `${j.id} · ${j.kind.toUpperCase()} · ${fmtLocal(j.next, j.tz)}${j.repeat !== 'none' ? ` · repeats ${j.repeat}` : ''} · "${j.title}"${j.kind === 'task' ? ` → ${j.text.slice(0, 160)}` : j.text && j.text !== j.title ? ` → ${j.text.slice(0, 160)}` : ''}`;

const WHEN = {
  at: { type: 'string', description: "Owner's local date and time, e.g. 2026-10-15T09:30 (or just 09:30 for the next one)." },
  in_minutes: { type: 'number', description: 'Alternative to "at": minutes from now.' },
};

export const agendaTools: Tool[] = [
  {
    name: 'set_reminder',
    description:
      'Remind the owner of something at a time (a notification on their devices). Can repeat. Use for "remind me…", alarms and timers. For things Ghosty should DO later, use schedule_task.',
    parameters: { type: 'object', properties: { text: { type: 'string' }, ...WHEN, repeat: { type: 'string', enum: REPEATS } }, required: ['text'] },
    risk: 'auto',
    async run(a, ctx) {
      const tz = await ownerTz(ctx);
      const text = arg.str(a, 'text');
      const j = await addJob(ctx.storage, { kind: 'reminder', title: text.slice(0, 120), text, next: whenArg(a, tz), repeat: repeatArg(a), tz });
      return `Reminder set for ${fmtLocal(j.next, tz)}${j.repeat !== 'none' ? `, repeating ${j.repeat}` : ''} (id ${j.id}).`;
    },
  },
  {
    name: 'schedule_task',
    description:
      'Have Ghosty do something on its own later or on a schedule, e.g. "every weekday at 07:30 brief me on weather, my agenda and top news" or "at 18:00 check if BTC is above 100k". The prompt runs with your web, data and memory tools while the owner is away; the result is sent to them as a notification. Needs the owner\'s approval.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short name, e.g. "Morning briefing".' },
        prompt: { type: 'string', description: 'Exactly what to do each time, written as an instruction to yourself.' },
        ...WHEN,
        repeat: { type: 'string', enum: REPEATS },
      },
      required: ['title', 'prompt'],
    },
    risk: 'confirm',
    async approval(a, ctx) {
      const tz = await ownerTz(ctx);
      const next = whenArg(a, tz);
      const repeat = repeatArg(a);
      const pinned = { title: arg.str(a, 'title').slice(0, 120), prompt: arg.str(a, 'prompt').slice(0, 4000), at: isoLocal(next, tz), repeat };
      return {
        args: pinned,
        reason: `Let me run this on my own${repeat !== 'none' ? ` ${repeat}` : ''} from ${fmtLocal(next, tz)}?\n"${pinned.title}": ${pinned.prompt}`,
      };
    },
    async run(a, ctx) {
      const tz = await ownerTz(ctx);
      const j = await addJob(ctx.storage, { kind: 'task', title: arg.str(a, 'title'), text: arg.str(a, 'prompt'), next: whenArg(a, tz), repeat: repeatArg(a), tz });
      return `Scheduled "${j.title}" for ${fmtLocal(j.next, tz)}${j.repeat !== 'none' ? `, repeating ${j.repeat}` : ''} (id ${j.id}).`;
    },
  },
  {
    name: 'list_scheduled',
    description: 'List upcoming reminders and scheduled tasks with their ids.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const jobs = await loadJobs(ctx.storage);
      return jobs.length ? jobs.map(describeJob).join('\n') : 'Nothing scheduled.';
    },
  },
  {
    name: 'cancel_scheduled',
    description: 'Cancel a reminder or scheduled task by id (see list_scheduled).',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    risk: 'auto',
    async run(a, ctx) {
      return (await removeJob(ctx.storage, arg.str(a, 'id'))) ? 'Cancelled.' : 'No reminder or task with that id.';
    },
  },
  {
    name: 'add_event',
    description: "Put an event in the owner's agenda, optionally with a reminder before it.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'Local start, e.g. 2026-10-20T14:00, or a date 2026-10-20 for all-day.' },
        end: { type: 'string', description: 'Local end time (optional).' },
        location: { type: 'string' },
        notes: { type: 'string' },
        remind_minutes_before: { type: 'number', description: 'Optional: also set a reminder this many minutes before.' },
      },
      required: ['title', 'start'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const tz = await ownerTz(ctx);
      const startRaw = arg.str(a, 'start');
      const start = parseWhen(startRaw, tz);
      if (start === null) throw new Error(`could not understand "${startRaw}"`);
      const end = a.end ? parseWhen(String(a.end), tz) ?? undefined : undefined;
      const allDay = /^\d{4}-\d{2}-\d{2}$/.test(startRaw.trim());
      const ev = await addEvent(ctx.storage, { title: arg.str(a, 'title'), start, end, allDay, location: a.location ? String(a.location) : undefined, notes: a.notes ? String(a.notes) : undefined });
      let extra = '';
      const before = a.remind_minutes_before !== undefined ? arg.num(a, 'remind_minutes_before', 0) : null;
      if (before !== null && before >= 0) {
        const at = (allDay ? start + 9 * 3600_000 : start) - before * 60_000;
        if (at > Date.now()) {
          await addJob(ctx.storage, { kind: 'reminder', title: ev.title, text: `${ev.title} — ${allDay ? 'today' : `at ${fmtLocal(start, tz)}`}${ev.location ? ` · ${ev.location}` : ''}`, next: at, tz, eventId: ev.id });
          extra = ` with a reminder at ${fmtLocal(at, tz)}`;
        }
      }
      return `Added "${ev.title}" on ${fmtLocal(start, tz, !allDay)}${extra} (id ${ev.id}).`;
    },
  },
  {
    name: 'remove_event',
    description: "Delete one of the owner's own agenda events by id.",
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    risk: 'auto',
    async run(a, ctx) {
      const ev = await removeEvent(ctx.storage, arg.str(a, 'id'));
      return ev ? `Removed "${ev.title}".` : 'No event with that id (calendar-feed events can only be changed in their own calendar).';
    },
  },
  {
    name: 'list_agenda',
    description: "The owner's agenda: their own events plus connected calendars, for a number of days from today (or from a date).",
    parameters: { type: 'object', properties: { days: { type: 'number', description: 'Default 7, max 60.' }, from: { type: 'string', description: 'Local date to start from, e.g. 2026-10-20 (default today).' } } },
    risk: 'auto',
    async run(a, ctx) {
      const tz = await ownerTz(ctx);
      const days = Math.max(1, Math.min(60, arg.num(a, 'days', 7)));
      const from = a.from ? parseWhen(String(a.from), tz) ?? startOfDay(Date.now(), tz) : startOfDay(Date.now(), tz);
      const { events, errors } = await agenda(ctx.storage, ctx.vault, from, from + days * 86400_000, tz);
      const lines = events.map((e) => `${e.allDay ? `${fmtLocal(e.start, tz, false)} (all day)` : fmtLocal(e.start, tz)}${e.end && !e.allDay ? `–${fmtLocal(e.end, tz).slice(-5)}` : ''} · ${e.title}${e.location ? ` @ ${e.location}` : ''}${e.source === 'mine' ? ` [id ${e.id}]` : ` [${e.source}]`}`);
      const jobs = (await loadJobs(ctx.storage)).filter((j) => j.next < from + days * 86400_000);
      const own = lines.filter((_, i) => events[i]!.source === 'mine');
      const fed = lines.filter((_, i) => events[i]!.source !== 'mine');
      return [
        `Agenda for ${days} day(s) from ${fmtLocal(from, tz, false)} (${tz}):`,
        own.length ? own.join('\n') : fed.length ? '' : 'No events.',
        fed.length ? asData('connected calendars', fed.join('\n')) : '',
        jobs.length ? `\nReminders/tasks due in that time:\n${jobs.map(describeJob).join('\n')}` : '',
        errors.length ? `\nCalendar problems: ${errors.join('; ')}` : '',
      ].join('\n');
    },
  },
  {
    name: 'add_calendar_feed',
    description:
      "Connect a calendar the owner gives you as an .ics link (read-only), e.g. Google Calendar's \"Secret address in iCal format\", Outlook's ICS link or an Apple public calendar link.",
    parameters: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } }, required: ['name', 'url'] },
    risk: 'auto',
    async run(a, ctx) {
      const f = await addFeed(ctx.storage, ctx.vault, arg.str(a, 'name'), arg.str(a, 'url'));
      const tz = await ownerTz(ctx);
      const from = startOfDay(Date.now(), tz);
      const { events, errors } = await agenda(ctx.storage, ctx.vault, from, from + 14 * 86400_000, tz);
      const err = errors.find((e) => e.startsWith(`${f.name}:`));
      if (err) return `Saved "${f.name}", but reading it failed: ${err}. Check the link is the secret/private iCal address.`;
      return `Connected "${f.name}". ${events.filter((e) => e.source === f.name).length} events in the next two weeks.`;
    },
  },
  {
    name: 'list_calendar_feeds',
    description: 'List connected calendars (names and ids only; links stay secret).',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const feeds = await loadFeeds(ctx.storage);
      return feeds.length ? feeds.map((f) => `${f.id} · ${f.name}`).join('\n') : 'No calendars connected.';
    },
  },
  {
    name: 'remove_calendar_feed',
    description: 'Disconnect a calendar by id.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    risk: 'auto',
    async run(a, ctx) {
      return (await removeFeed(ctx.storage, ctx.vault, arg.str(a, 'id'))) ? 'Disconnected.' : 'No calendar with that id.';
    },
  },
];
