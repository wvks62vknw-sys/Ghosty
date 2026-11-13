/** AGENDA tab: your diary, connected calendars, reminders, Ghosty's scheduled tasks and its notifications. */
import type { AgendaEventInfo, FeedInfo, InboxEntry, JobInfo } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { offline } from '../../api/offline';
import { inbox, pollInbox } from '../../assistant/notices';
import { enablePush, pushState } from '../../assistant/push';
import { send } from '../../assistant/session';
import { clear, fmt, h, pad } from '../../core/dom';
import { screenSays } from '../../shell/awareness';
import type { TabDef } from '../../shell/tabs';
import { button, empty, panel, row, toast, undo, undoBar } from '../../ui/components';
import { page } from '../../ui/page';
import { spendingPanel } from './spending';
import { watchersPanel } from './watchers';
import { todoPanel } from './todo';
import { monthPanel } from './month';
import { AHEAD_DAYS } from './todowords';
import { sectionNow, sections } from '../../ui/sections';
import { sayError } from '../../ui/hisWords';

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
    // On the phone one page in sections (ui/sections.ts) instead of two sides to swap between.
    const P = page(root, { tag: 'AGENDA', rightLabel: 'REMINDERS & INBOX', leftLabel: 'DIARY', stack: true });
    const ep = panel('DIARY · NEXT 14 DAYS', { cls: 'scroll' });
    const cp = panel('CALENDARS', { grow: false, cls: 'scroll.feeds' });
    // SPENDING (spending.ts): the statements he adds himself, under his diary — the month's money is part of its plan.
    const sp = spendingPanel();
    // [lifeeasier] WATCHERS (watchers.ts) follows SPENDING and so sits under its pill: the pills stay as they were
    const wp = watchersPanel();
    // [planlane] TO-DO (todo.ts) and MONTH (month.ts) are made below, once what they read is declared
    const jp = panel('REMINDERS & TASKS', { cls: 'scroll' });
    const ip = panel('NOTIFICATIONS', { cls: 'scroll', footer: true });
    P.right.append(jp.el, ip.el);
    // UNDO after an event or a reminder is deleted (route C: one bar at the top of its card)
    const evUndo = undoBar();
    const jobUndo = undoBar();

    let events: AgendaEventInfo[] = [];
    // what the brain gave for the next six weeks (the month reads it); the diary lists the first fourteen days of it
    let allEvents: AgendaEventInfo[] = [];
    let jobs: JobInfo[] = [];
    let feeds: FeedInfo[] = [];
    let errors: string[] = [];
    // the diary read once (until then it says it is on its way), and whether what it shows is the phone's copy (the brain out of reach)
    let loaded = false;
    let stale = false;
    // the event opened whole in the diary ('' for none)
    let openEv = '';
    /** what he has typed in the open event's change boxes (kept when the diary repaints every minute) */
    let evDraft: { id: string; title: string; at: string; where: string } | null = null;
    /** the minutes before an event its reminder rings (an all-day one's is set from 09:00 that day, as the brain sets it) */
    const remindOf = (e: AgendaEventInfo, rem: { next: number } | undefined) => (rem ? Math.max(0, Math.round(((e.allDay ? e.start + 9 * 3600_000 : e.start) - rem.next) / 60_000)) : null);
    // [planlane] TO-DO (todo.ts): his own list on this phone; MONTH (month.ts): the diary as a calendar, under it
    const tp = todoPanel(() => {
      mp.paint();
      paintHero();
    });
    const mp = monthPanel(() => ({ events: allEvents, todos: tp.list() }));
    P.left.append(ep.el, mp.el, tp.el, cp.el, sp.el, wp.el);

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
        toast(sayError(e, 'change your plan'), 'bad');
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
        toast(sayError(e, 'change your plan'), 'bad');
      }
    };
    rText.addEventListener('keydown', (e) => e.key === 'Enter' && void addReminder());
    jp.el.insertBefore(h('div.keyrow.wrapit.addev', rText, rAt, rRep, button('SET', () => void addReminder())), jp.body);
    jp.el.insertBefore(jobUndo.el, jp.body);

    const paintEvents = () => {
      clear(ep.body);
      /* state: agenda.diary loading */
      if (!loaded) return void ep.body.append(h('div.empty.wait', { dataset: { case: 'keep', state: 'loading' } }, h('b', 'Reading your diary'), h('span', 'One moment: your events and calendars are on their way.')));
      // the brain out of reach: what is shown is the last copy on this phone, and it says so
      /* state: agenda.diary error */
      if (stale) ep.body.append(h('div.note.bad.agstale', { dataset: { case: 'keep', state: 'error' } }, 'I can’t reach your brain right now, so this is the last copy kept on this phone. Changes you make wait here and go when it’s back.'));
      if (errors.length) ep.body.append(h('div.note.bad', `Calendar problem: ${errors.join(' · ')}`));
      if (!events.length) {
        /* state: agenda.diary empty */
        ep.body.append(empty('NONE', 'Add an event above, connect a calendar under Calendars, or just tell Ghosty: “add dinner with Sam on Friday at 7”.', 'Nothing in the next two weeks'));
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
            try {
              await brain.deleteEvent(e.id);
            } catch (err) {
              return toast(sayError(err, 'delete that event'), 'bad');
            }
            void load();
            evUndo.show(`Deleted: ${e.title}`, async () => {
              const back = { title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.location, notes: e.notes, remindMin: remindOf(e, rem) };
              await brain.addEvent(back);
              toast(`Back: ${e.title}`, 'ok');
              void load();
            });
          });
        }
        // tap an event to see it whole (and, for one in his own diary, to change it)
        r.classList.add('evtap');
        r.tabIndex = 0;
        r.setAttribute('role', 'button');
        r.setAttribute('aria-expanded', String(openEv === e.id));
        const toggle = () => {
          openEv = openEv === e.id ? '' : e.id;
          evDraft = null;
          paintEvents();
        };
        r.addEventListener('click', (ev) => !(ev.target as HTMLElement).closest('.del') && toggle());
        r.addEventListener('keydown', (ev) => (ev.key === 'Enter' || ev.key === ' ') && !(ev.target as HTMLElement).closest('.del') && (ev.preventDefault(), toggle()));
        ep.body.append(r);
        if (openEv === e.id) ep.body.append(eventCard(e));
      }
    };

    /** One event whole: its day and time, where, where it is from and its reminder; one of his own can be changed here. */
    const eventCard = (e: AgendaEventInfo): HTMLElement => {
      const rem = jobs.find((j) => j.eventId === e.id);
      const remindMin = remindOf(e, rem);
      const day = new Date(e.start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      // one added or changed while the brain was out of reach waits on this phone: his own, not a calendar's
      const waiting = e.id.startsWith('local-') || e.source.startsWith('this device');
      const mine = e.source === 'mine' || waiting;
      const remWords = remindMin == null ? 'no reminder' : remindMin ? `reminder ${remindMin >= 60 && remindMin % 60 === 0 ? `${remindMin / 60} h` : `${remindMin} min`} before` : 'reminder at the start';
      const card = h('div.evcard', { dataset: { case: 'keep' } },
        h('b.evcardt', e.title),
        h('span', e.allDay ? `${day}, all day` : `${day}, ${hm(e.start)}${e.end ? ` to ${hm(e.end)}` : ''}`),
        e.location ? h('span', `Where: ${e.location}`) : null,
        e.notes ? h('span', `Notes: ${e.notes}`) : null,
        h('small', waiting ? 'In your diary, not sent yet: it goes when the brain is back.' : mine ? `In your diary · ${remWords}` : `From your calendar “${e.source}”. Change it there: Ghosty only reads it.`));
      if (!mine) return card;
      const d = evDraft?.id === e.id ? evDraft : null;
      const ti = h('input', { value: d ? d.title : e.title, 'aria-label': 'Change the event', maxlength: '200' });
      const at = h('input', { type: 'datetime-local', value: d ? d.at : localInput(e.start), 'aria-label': 'Change when it starts' });
      const where = h('input', { value: d ? d.where : e.location ?? '', placeholder: 'Where (optional)', 'aria-label': 'Change where' });
      for (const x of [ti, at, where]) x.addEventListener('input', () => void (evDraft = { id: e.id, title: ti.value, at: at.value, where: where.value }));
      // (its notes go with it, both ways: a change never loses them)
      const was = { title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.location, notes: e.notes, remindMin };
      const save = async (b: HTMLButtonElement) => {
        // one save at a time: a second Enter (or a held Go key) while the first is on its way would add the event twice
        if (b.disabled) return;
        const title = ti.value.trim();
        const start = e.allDay ? new Date(new Date(at.value).setHours(0, 0, 0, 0)).getTime() : new Date(at.value).getTime();
        if (!title || !Number.isFinite(start)) return toast('Give the event a name and a time', 'warn');
        const now = { title, start, end: e.end ? start + (e.end - e.start) : undefined, allDay: e.allDay, location: where.value.trim() || undefined, notes: e.notes, remindMin };
        b.disabled = true;
        // his diary keeps no "change": the event is deleted and added again, changed (said under the keys)
        try {
          await brain.deleteEvent(e.id);
        } catch (err) {
          b.disabled = false;
          return toast(sayError(err, 'change that event'), 'bad');
        }
        let made: AgendaEventInfo | null = null;
        try {
          made = (await brain.addEvent(now)).event;
        } catch (err) {
          // the new one did not go in: the old one goes back, so nothing is lost
          await brain.addEvent(was).catch(() => undefined);
          toast(sayError(err, 'change that event'), 'bad');
        }
        openEv = '';
        evDraft = null;
        void load();
        if (!made) return;
        const id = made.id;
        evUndo.show(`Changed: ${title}`, async () => {
          await brain.deleteEvent(id).catch(() => undefined);
          await brain.addEvent(was);
          toast(`Back as it was: ${e.title}`, 'ok');
          void load();
        });
      };
      const saveB = button('SAVE CHANGES', (b) => void save(b), 'on');
      ti.addEventListener('keydown', (ev) => ev.key === 'Enter' && void save(saveB));
      card.append(
        h('div.keyrow.wrapit.addev.evedit', ti, at, where),
        h('div.keyrow.wrapit', saveB, button('CLOSE', () => {
          openEv = '';
          evDraft = null;
          paintEvents();
        })),
        h('small.note', 'Saving takes the event out of your diary and puts it back changed (the diary has no other way to change one). UNDO puts it back as it was.'),
      );
      return card;
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
          try {
            await brain.deleteJob(j.id);
          } catch (err) {
            return toast(sayError(err, 'cancel that reminder'), 'bad');
          }
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
                toast(sayError(e, 'change your plan'), 'bad');
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
    // A calendar disconnected with the UNDO bar still up: off the list, still connected on the brain (its
    // link is kept there, encrypted, and never comes back to this phone — so it waits for the bar to go).
    const feedsGoing = new Set<string>();
    const paintFeeds = () => {
      clear(cp.body);
      for (const f of feeds.filter((x) => !feedsGoing.has(x.id))) {
        const r = row('📅', f.name, '✕');
        const x = r.lastChild as HTMLElement;
        x.classList.add('del');
        x.title = 'Disconnect';
        x.setAttribute('aria-label', `Disconnect ${f.name}`);
        x.addEventListener('click', () => {
          feedsGoing.add(f.id);
          paintFeeds();
          undo(
            `Disconnected: ${f.name}`,
            () => {
              feedsGoing.delete(f.id);
              paintFeeds();
              toast(`Still connected: ${f.name}`, 'ok');
            },
            async () => {
              await brain.deleteFeed(f.id).catch((e) => toast(sayError(e, 'disconnect it'), 'bad'));
              feedsGoing.delete(f.id);
              void load();
            },
          );
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
            toast(sayError(e, 'change your plan'), 'bad');
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
      const todo = tp.list().filter((t) => !t.done).length;
      const todoBit = todo ? `${todo} to do` : '';
      P.sub.textContent = next
        ? [`${dayWord} ${hm(next.start)}`, until(next.start), `${today} ${today === 1 ? 'event' : 'events'} today`, `${jobs.length} ${jobs.length === 1 ? 'reminder' : 'reminders'}`, todoBit].filter(Boolean).join(' · ')
        : [`Nothing coming up`, `${today} ${today === 1 ? 'event' : 'events'} today`, `${jobs.length} ${jobs.length === 1 ? 'reminder' : 'reminders'}`, todoBit].filter(Boolean).join(' · ');
    };

    const load = async () => {
      try {
        // the brain's api gives the copy on this phone when it cannot be reached (api/offline.ts): the copy unchanged means it was that
        const was = offline.get().agenda;
        const a = await brain.agenda(AHEAD_DAYS);
        stale = was !== null && offline.get().agenda === was;
        loaded = true;
        allEvents = a.events;
        const cut = new Date();
        cut.setHours(0, 0, 0, 0);
        events = a.events.filter((e) => e.start < cut.getTime() + 14 * 86400_000);
        jobs = a.jobs;
        feeds = a.feeds;
        errors = a.errors;
        ep.setStatus(stale ? 'COPY' : `${events.length}`, stale ? 'off' : 'ok');
        jp.setStatus(stale ? 'COPY' : `${jobs.length}`, stale ? 'off' : 'ok');
      } catch {
        ep.setStatus('OFFLINE', 'off');
        if (!events.length) {
          loaded = true;
          paintFeeds();
          /* state: agenda.diary offline */
          return void clear(ep.body, h('div.empty.bad', { dataset: { case: 'keep', state: 'offline' } }, h('b', navigator.onLine === false ? 'You’re offline' : 'I can’t reach your diary'),
            h('span', 'Your to-do list still works on this phone. The diary fills in by itself when the brain is back; it tries again every minute.')));
        }
        stale = true;
      }
      paintEvents();
      paintJobs();
      paintFeeds();
      paintHero();
      mp.paint();
    };

    // until the diary is read it says so (not an empty list that looks like nothing is on)
    paintEvents();

    const suggest = h(
      'div.keyrow.wrapit.suggest',
      ...[
        ['MORNING BRIEFING', 'Every weekday at 07:30, brief me: the weather here today, my agenda for today, and the top 3 news headlines.'],
        ['WHAT IS ON TODAY?', 'What is on my agenda today and tomorrow?'],
      ].map(([label, text]) => button(label!, () => void send(text!))),
    );
    P.right.append(suggest);
    // Sections: the diary first (what he opens the agenda for), then reminders with the notifications they send,
    // the month's spending and the calendars he has connected.
    sections(root, 'agenda', [
      { id: 'diary', label: 'Diary', match: /^(DIARY|MONTH)/ },
      { id: 'todo', label: 'To-do', match: /^TO-DO/ },
      { id: 'reminders', label: 'Reminders', match: /^(REMINDERS|NOTIFICATIONS)/ },
      { id: 'spending', label: 'Spending', match: /^SPENDING/ },
      { id: 'calendars', label: 'Calendars', match: /^CALENDARS/ },
    ]);

    let timer = 0;
    return {
      enter() {
        void load();
        tp.paint();
        void sp.refresh();
        void wp.refresh();
        void pollInbox();
        timer = window.setInterval(() => void load(), 60_000);
      },
      leave() {
        clearInterval(timer);
      },
      // (BRIEF-SHELL pass 1) what is open and what is first in it: the diary's next event
      context: () => {
        const now = Date.now();
        const next = events.find((e) => !e.allDay && (e.end ?? e.start) > now);
        const sec = sectionNow('agenda').toLowerCase() || 'diary';
        const when = next ? `${dayLabel(next.start).toLowerCase()} ${hm(next.start)}` : '';
        return screenSays('agenda', 'Agenda', `the agenda, on ${sec}, ${next ? `next: ${next.title}, ${when}` : 'nothing coming up'}`, {
          looking: 'the agenda',
          ...(next ? { selected: { kind: 'item', id: `event:${next.id}`, label: next.title, detail: when } } : {}),
        });
      },
      describe: () => `Agenda: ${events.length} events in the next 14 days, ${jobs.length} reminders/tasks, ${tp.list().filter((t) => !t.done).length} to-dos open, ${feeds.length} calendars connected.`,
    };
  },
};
