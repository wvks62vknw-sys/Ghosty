/**
 * While the brain's database is paused (free daily allowance used up), Ghosty can still
 * remember things and set reminders and events: these versions of remember / set_reminder /
 * add_event hand the change to the owner's device (client command offline_save), which shows
 * it at once, fires reminders itself, and sends everything to the brain when it's back.
 */
import { fmtLocal, parseWhen, safeTz } from '../time';
import { agendaTools, repeatArg, whenArg } from './agenda';
import { memoryTools } from './memory';
import { arg, type Tool } from './types';

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
