/** AGENDA tab: your diary, connected calendars, reminders, Ghosty's scheduled tasks and its notifications. */
import type { AgendaEventInfo, FeedInfo, InboxEntry, JobInfo } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { offline } from '../../api/offline';
import { inbox, pollInbox } from '../../assistant/notices';
import { enablePush, pushState } from '../../assistant/push';
import { send } from '../../assistant/session';
import { clear, fmt, h, pad } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { button, empty, panel, row, toast, undoBar } from '../../ui/components';
import { page } from '../../ui/page';

const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const hm = (ms: number) => fmt.time(new Date(ms));
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const dayLabel = (ms: number) => {
  const d = new Date(ms);
  const today = new Date();
  const tmw = new Date(Date.now() + 86400_000);
  if (dayKey(ms) === dayKey(today.getTime())) return 'TODAY';
  if (dayKey(ms) === dayKey(tmw.getTime())) return 'TOMORROW';
  return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
};
/** How long until `ms`, for a countdown: "in 25 min", "in 2 h 14 min", "in 5 h"; '' once it has started. */
const until = (ms: number) => {
  const m = Math.round((ms - Date.now()) / 60_000);
  if (m <= 0) return '';
  if (m < 60) return `in ${m} min`;
  const hrs = Math.floor(m / 60);
  return hrs < 3 && m % 60 ? `in ${hrs} h ${m % 60} min` : `in ${Math.round(m / 60)} h`;
};
const when = (ms: number) => `${dayLabel(ms) === 'TODAY' ? '' : `${dayLabel(ms)} `}${hm(ms)}`;
/** Value for <input type="datetime-local"> in local time. */
const localInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const REPEATS: [JobInfo['repeat'], string][] = [
  ['none', 'Once'],
  ['daily', 'Every day'],
  ['weekdays', 'Weekdays'],
  ['weekly', 'Every week'],
  ['monthly', 'Every month'],
  ['hourly', 'Every hour'],
];

export const agendaTab: TabDef = {
  id: 'agenda',
  title: 'AGENDA',
  icon: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h3M13.5 13h3M7.5 16.5h3"/>',
  scene: 'backdrop',
  blurb: 'calendar · reminders · scheduled tasks',
  // the next timed event this phone was last given (api/offline.ts keeps it): "Dentist · in 54 min"
  now() {
    const t = Date.now();
    const next = offline.get().agenda?.events.filter((e) => !e.allDay && e.start > t).sort((a, b) => a.start - b.start)[0];
    if (!next) return '';
    const day = dayLabel(next.start);
    return `${next.title} · ${next.start - t < 12 * 3600_000 ? until(next.start) : `${day === 'TOMORROW' ? 'tomorrow' : new Date(next.start).toLocaleDateString('en-GB', { weekday: 'short' })} ${hm(next.start)}`}`;
  },
  primary: true,
  mount(root) {
    const P = page(root, { tag: 'AGENDA', rightLabel: 'REMINDERS & INBOX', leftLabel: 'DIARY' });
    const ep = panel('DIARY · NEXT 14 DAYS', { cls: 'scroll' });
    const cp = panel('CALENDARS', { grow: false, cls: 'scroll.feeds' });
    P.left.append(ep.el, cp.el);
    const jp = panel('REMINDERS & TASKS', { cls: 'scroll' });
    const ip = panel('NOTIFICATIONS', { cls: 'scroll', footer: true });
    P.right.append(jp.el, ip.el);
    // UNDO after an event or a reminder is deleted (route C: one bar at the top of its card)
    const evUndo = undoBar();
    const jobUndo = undoBar();

    let events: AgendaEventInfo[] = [];
    let jobs: JobInfo[] = [];
    let feeds: FeedInfo[] = [];
    let errors: string[] = [];

    // ── add event ────────────────────────────────────────────────────────
    const evTitle = h('input', { placeholder: 'New event (e.g. Dentist)', 'aria-label': 'Event title' });
    const evAt = h('input', { type: 'datetime-local', 'aria-label': 'Event start', value: localInput(Math.ceil(Date.now() / 3600_000) * 3600_000 + 3600_000) });
    const evRemind = h('select', { 'aria-label': 'Reminder' }, ...[['', 'No reminder'], ['0', 'Remind at start'], ['15', '15 min before'], ['60', '1 hour before'], ['1440', '1 day before']].map(([v, t]) => h('option', { value: v }, t)));
    evRemind.value = '15';
    const addEvent = async () => {
      const title = evTitle.value.trim();
      const start = new Date(evAt.value).getTime();
      if (!title || !Number.isFinite(start)) return toast('Give the event a name and a time', 'warn');
      try {
        await brain.addEvent({ title, start, remindMin: evRemind.value === '' ? null : Number(evRemind.value) });
        evTitle.value = '';
        toast(`Added: ${title}`, 'ok');
        void load();
      } catch (e) {
        toast(String((e as Error).message), 'bad');
      }
    };
    evTitle.addEventListener('keydown', (e) => e.key === 'Enter' && void addEvent());
    ep.el.insertBefore(h('div.keyrow.wrapit.addev', evTitle, evAt, evRemind, button('ADD', () => void addEvent())), ep.body);
    ep.el.insertBefore(evUndo.el, ep.body);

    // ── add reminder ─────────────────────────────────────────────────────
    const rText = h('input', { placeholder: 'Remind me to…', 'aria-label': 'Reminder text' });
    const rAt = h('input', { type: 'datetime-local', 'aria-label': 'Reminder time', value: localInput(Date.now() + 3600_000) });
    const rRep = h('select', { 'aria-label': 'Repeat' }, ...REPEATS.map(([v, t]) => h('option', { value: v }, t)));
    const addReminder = async () => {
      const text = rText.value.trim();
      const at = new Date(rAt.value).getTime();
      if (!text || !Number.isFinite(at)) return toast('Type what to remind you about and when', 'warn');
      try {
        await brain.addJob({ kind: 'reminder', text, at, repeat: rRep.value as JobInfo['repeat'] });
        rText.value = '';
        toast('Reminder set', 'ok');
        void load();
      } catch (e) {
        toast(String((e as Error).message), 'bad');
      }
    };
    rText.addEventListener('keydown', (e) => e.key === 'Enter' && void addReminder());
    jp.el.insertBefore(h('div.keyrow.wrapit.addev', rText, rAt, rRep, button('SET', () => void addReminder())), jp.body);
    jp.el.insertBefore(jobUndo.el, jp.body);

    const paintEvents = () => {
      clear(ep.body);
      if (errors.length) ep.body.append(h('div.note.bad', `Calendar problem: ${errors.join(' · ')}`));
      if (!events.length) {
        ep.body.append(empty('NONE', 'Add an event above, connect a calendar below, or just tell Ghosty: “add dinner with Sam on Friday at 7”.', 'Nothing in the next two weeks'));
        return;
      }
      let lastDay = '';
      for (const e of events) {
        const k = dayKey(e.start);
        if (k !== lastDay) {
          lastDay = k;
          ep.body.append(h('div.lab.daylab', dayLabel(e.start)));
        }
        const t = e.allDay ? 'ALL DAY' : `${hm(e.start)}${e.end ? `–${hm(e.end)}` : ''}`;
        // the title, where (route C puts it on its own line), and a countdown for what is still to come today
        const soon = dayKey(e.start) === dayKey(Date.now()) && !e.allDay ? until(e.start) : '';
        const r = row(t, h('span', h('b.evt', e.title), e.location ? h('small.evloc', h('i.evsep', ' · '), e.location) : null, soon ? h('em.evin', soon) : null), e.source === 'mine' ? '✕' : e.source, { wrap: true });
        r.classList.add('ev');
        if (soon) r.classList.add('soon');
        if (e.source === 'mine') {
          const x = r.lastChild as HTMLElement;
          x.classList.add('del');
          x.title = 'Delete this event';
          x.setAttribute('aria-label', `Delete ${e.title}`);
          x.addEventListener('click', async () => {
            // its reminder, so UNDO brings both back
            const rem = jobs.find((j) => j.eventId === e.id);
            await brain.deleteEvent(e.id);
            void load();
            evUndo.show(`Deleted: ${e.title}`, async () => {
              await brain.addEvent({ title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.location, remindMin: rem ? Math.max(0, Math.round((e.start - rem.next) / 60_000)) : null });
              toast(`Back: ${e.title}`, 'ok');
              void load();
            });
          });
        }
        ep.body.append(r);
      }
    };

    const paintJobs = () => {
      clear(jp.body);
      if (!jobs.length) {
        jp.body.append(
          empty('NONE', 'Set one above, or ask Ghosty: “remind me at 6 to call mum”, or “every weekday at 7:30 brief me on the weather, my day and the news”.', 'No reminders or tasks'),
        );
        return;
      }
      for (const j of jobs) {
        const rep = j.repeat === 'none' ? '' : ` · ${REPEATS.find(([v]) => v === j.repeat)?.[1].toLowerCase()}`;
        const r = row(when(j.next), `${j.kind === 'task' ? '✦ ' : j.kind === 'verify' ? '🛡 ' : '⏰ '}${j.title}${rep}`, '✕', { wrap: true });
        r.title = j.kind === 'verify' ? 'Ghosty is checking that a change you shipped deployed correctly' : j.kind === 'task' ? `Ghosty will: ${j.text}${j.lastResult ? `\n\nLast time: ${j.lastResult}` : ''}` : j.text;
        const x = r.lastChild as HTMLElement;
        x.classList.add('del');
        x.title = 'Cancel';
        x.setAttribute('aria-label', `Cancel ${j.title}`);
        x.addEventListener('click', async () => {
          await brain.deleteJob(j.id);
          void load();
          if (j.kind === 'reminder' || j.kind === 'task') {
            jobUndo.show(`Cancelled: ${j.title}`, async () => {
              await brain.addJob({ kind: j.kind as 'reminder' | 'task', title: j.title, text: j.text, at: j.next, repeat: j.repeat });
              toast(`Back: ${j.title}`, 'ok');
              void load();
            });
          }
        });
        jp.body.append(r);
        if (j.kind === 'task') {
          jp.body.append(
            h('div.keyrow.sub', h('small.note', j.text.slice(0, 140)), h('span.sp'), button('RUN NOW', async (b) => {
              b.disabled = true;
              b.textContent = 'RUNNING…';
              try {
                await brain.runJob(j.id);
                await pollInbox();
              } catch (e) {
                toast(String((e as Error).message), 'bad');
              }
              b.disabled = false;
              b.textContent = 'RUN NOW';
            })),
          );
        }
      }
    };

    const paintInbox = () => {
      const { items } = inbox.get();
      clear(ip.body);
      ip.setStatus(inbox.get().unread ? `${inbox.get().unread} NEW` : '', inbox.get().unread ? 'ok' : 'off');
      if (!items.length) {
        ip.body.append(empty('NONE', 'Reminders and the results of Ghosty’s scheduled tasks appear here and pop up on screen.', 'No notifications'));
        return;
      }
      for (const it of items.slice(0, 40)) {
        const r = row(fmt.ago(it.at), h('span', h('b', `${it.kind === 'reminder' ? '⏰' : it.kind === 'task' ? '✦' : '⚠'} ${it.title}`), h('br'), it.text), null, { wrap: true });
        if (!it.read) r.classList.add('unread');
        ip.body.append(r);
      }
    };
    ip.foot!.append(
      button('MARK ALL READ', async () => {
        await brain.markRead();
        await pollInbox();
      }),
      (() => {
        const b = button('NOTIFY THIS DEVICE', async () => toast(await enablePush(), pushState.get().status === 'on' ? 'ok' : 'warn'));
        pushState.subscribe((s) => {
          b.textContent = s.status === 'on' ? '✓ NOTIFYING THIS DEVICE' : 'NOTIFY THIS DEVICE';
          b.classList.toggle('on', s.status === 'on');
        });
        return b;
      })(),
    );
    inbox.subscribe(paintInbox);

    // ── calendars ────────────────────────────────────────────────────────
    const fName = h('input', { placeholder: 'Name (e.g. Work)', 'aria-label': 'Calendar name' });
    const fUrl = h('input', { placeholder: 'Paste the secret iCal link (.ics)', 'aria-label': 'Calendar link', autocomplete: 'off' });
    const help = h(
      'ol.steps',
      h('li', 'Google Calendar (on a computer): Settings ⚙ → click your calendar on the left → "Integrate calendar" → copy "Secret address in iCal format".'),
      h('li', 'Outlook.com: Settings → Calendar → Shared calendars → "Publish a calendar" → choose "Can view all details" → copy the ICS link.'),
      h('li', 'iPhone/iCloud: Calendar app → tap ⓘ next to a calendar → turn on "Public Calendar" → Share Link.'),
      h('li', 'Paste it above with a name and press CONNECT. Ghosty can only read it, and the link is stored encrypted.'),
    );
    help.hidden = true;
    const paintFeeds = () => {
      clear(cp.body);
      for (const f of feeds) {
        const r = row('📅', f.name, '✕');
        const x = r.lastChild as HTMLElement;
        x.classList.add('del');
        x.title = 'Disconnect';
        x.addEventListener('click', async () => {
          await brain.deleteFeed(f.id);
          void load();
        });
        cp.body.append(r);
      }
      cp.body.append(
        h('div.keyrow.wrapit', fName, fUrl, button('CONNECT', async (b) => {
          if (!fUrl.value.trim()) return toast('Paste the calendar link first', 'warn');
          b.disabled = true;
          try {
            await brain.addFeed(fName.value.trim() || 'Calendar', fUrl.value.trim());
            fName.value = '';
            fUrl.value = '';
            toast('Calendar connected', 'ok');
            void load();
          } catch (e) {
            toast(String((e as Error).message), 'bad');
          }
          b.disabled = false;
        })),
        h('div.keyrow', button('HOW DO I GET THE LINK?', (b) => {
          help.hidden = !help.hidden;
          b.textContent = help.hidden ? 'HOW DO I GET THE LINK?' : 'HIDE';
        })),
        help,
      );
    };

    const paintHero = () => {
      const now = Date.now();
      const next = events.find((e) => !e.allDay && (e.end ?? e.start) > now);
      const today = events.filter((e) => dayKey(e.start) === dayKey(now)).length;
      // route C: what is next as the title, when and how long until under it
      const day = next ? dayLabel(next.start) : '';
      const dayWord = day === 'TODAY' ? 'Today' : day === 'TOMORROW' ? 'Tomorrow' : day.charAt(0) + day.slice(1).toLowerCase().replace(/ (\w)(\w+)$/, (_x, a: string, b: string) => ` ${a.toUpperCase()}${b}`);
      P.big.dataset.case = 'keep';
      P.big.textContent = next ? next.title : 'All clear';
      P.sub.textContent = next
        ? [`${dayWord} ${hm(next.start)}`, until(next.start), `${today} ${today === 1 ? 'event' : 'events'} today`, `${jobs.length} ${jobs.length === 1 ? 'reminder' : 'reminders'}`].filter(Boolean).join(' · ')
        : `Nothing coming up · ${today} ${today === 1 ? 'event' : 'events'} today · ${jobs.length} ${jobs.length === 1 ? 'reminder' : 'reminders'}`;
    };

    const load = async () => {
      try {
        const a = await brain.agenda(14);
        events = a.events;
        jobs = a.jobs;
        feeds = a.feeds;
        errors = a.errors;
        ep.setStatus(`${events.length}`, 'ok');
        jp.setStatus(`${jobs.length}`, 'ok');
      } catch {
        ep.setStatus('OFFLINE', 'off');
        if (!events.length) {
          paintFeeds();
          return void clear(ep.body, empty('OFFLINE'));
        }
      }
      paintEvents();
      paintJobs();
      paintFeeds();
      paintHero();
    };

    const suggest = h(
      'div.keyrow.wrapit.suggest',
      ...[
        ['MORNING BRIEFING', 'Every weekday at 07:30, brief me: the weather here today, my agenda for today, and the top 3 news headlines.'],
        ['WHAT IS ON TODAY?', 'What is on my agenda today and tomorrow?'],
      ].map(([label, text]) => button(label!, () => void send(text!))),
    );
    P.right.append(suggest);

    let timer = 0;
    return {
      enter() {
        void load();
        void pollInbox();
        timer = window.setInterval(() => void load(), 60_000);
      },
      leave() {
        clearInterval(timer);
      },
      describe: () => `Agenda: ${events.length} events in the next 14 days, ${jobs.length} reminders/tasks, ${feeds.length} calendars connected.`,
    };
  },
};
