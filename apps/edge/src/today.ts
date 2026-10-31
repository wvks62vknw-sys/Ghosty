/**
 * What did you do today (OWNER-ISSUES 68c): the day's doings in plain words, from what the brain already keeps — the tools
 * every turn ran (why.ts), the jobs run on schedule, what he was told (the inbox), what was studied, the papers sat, the
 * pages and widgets made, the projects' steps, the lessons learned and the upgrades thought of — newest first, nothing
 * invisible and no model asked. The phone adds its own (the GYM's games: assistant/local.ts); batch 3's day log, once it
 * lands, is one more source here.
 *   GET /today?tz=Europe/London → { items: DayItem[] }
 */
import { doneOf, type DayItem } from '../../../packages/shared/src/abilities';
import type { Env } from './env';
import { loadLessons } from './knowledge';
import { loadStudy } from './library/study';
import { listProjects } from './projects';
import { loadInbox, loadJobs } from './schedule';
import { loadState } from './school/state';
import { safeTz, startOfDay } from './time';
import { siteStore } from './tools/sites';
import { loadWidgets } from './tools/widgets';
import { loadIdeas } from './upgrades';
import { loadTrails } from './why';

export interface TodayDeps {
  storage: DurableObjectStorage;
  env?: Pick<Env, 'SITES'>;
}

const clip = (s: string, n: number) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
/** A source that cannot be read today (the database paused, a store not there yet) is left out, never the whole list. */
const safely = async <T>(p: Promise<T>, none: T): Promise<T> => p.catch(() => none);

/** Everything done since the start of the owner's day (his time zone), newest first. */
export async function dayDoings(d: TodayDeps, tz?: string, now = Date.now()): Promise<DayItem[]> {
  const zone = safeTz(tz);
  const from = startOfDay(now, zone);
  const today = (at: number | undefined) => typeof at === 'number' && at >= from && at <= now + 60_000;
  const out: DayItem[] = [];
  const [trails, jobs, inbox, study, school, sites, widgets, projects, lessons, ideas] = await Promise.all([
    safely(loadTrails(d.storage), []),
    safely(loadJobs(d.storage), []),
    safely(loadInbox(d.storage), []),
    safely(loadStudy(d.storage), null),
    safely(loadState({ storage: d.storage, env: d.env }), null),
    safely(siteStore(d.env, d.storage).list(), []),
    safely(loadWidgets(d.storage), []),
    safely(listProjects({ storage: d.storage, env: d.env }, 20), []),
    safely(loadLessons(d.storage), []),
    safely(loadIdeas(d.storage), []),
  ]);
  // the tools every turn ran (the chat and Telegram alike), with what each was about and how it went
  for (const t of trails) {
    if (!today(t.at)) continue;
    for (const s of t.steps) out.push({ at: t.at, text: `${doneOf(s.tool)}${s.args ? ` (${clip(s.args, 70)})` : ''}${s.ok === false ? ': it didn’t work' : s.ok === null ? ': it didn’t finish' : ''}` });
  }
  for (const j of jobs) if (today(j.lastRun)) out.push({ at: j.lastRun!, text: `Ran on schedule: ${clip(j.title, 60)}${j.lastResult ? ` — ${clip(j.lastResult, 90)}` : ''}` });
  for (const i of inbox) if (today(i.at)) out.push({ at: i.at, text: i.kind === 'error' ? `Hit a problem: ${clip(i.title, 60)}` : `Told you: ${clip(i.title, 60)}${i.text && i.text !== i.title ? ` — ${clip(i.text, 80)}` : ''}` });
  if (study && study.day === new Date(now).toISOString().slice(0, 10)) {
    const { reads, digests, drills } = study.today;
    if (reads + digests + drills) {
      const parts = [reads && `read ${reads} piece${reads === 1 ? '' : 's'}`, digests && `wrote ${digests} note${digests === 1 ? '' : 's'}`, drills && `did ${drills} drill${drills === 1 ? '' : 's'}`].filter(Boolean);
      out.push({ at: study.last?.at && today(study.last.at) ? study.last.at : from, text: `Studied by myself: ${parts.join(', ')}${study.last?.topic ? ` (latest: ${clip(study.last.topic, 60)})` : ''}` });
    }
  }
  for (const r of school?.results ?? []) if (today(r.at)) out.push({ at: r.at, text: `Sat a paper at school: ${clip(r.title, 60)} — ${r.grade} (${r.raw}/${r.max})` });
  for (const s of sites) if (today(s.at)) out.push({ at: s.at, text: `${s.app ? 'Made an app' : 'Published a page'}: ${clip(s.title || s.name, 60)}` });
  for (const w of widgets) if (today(w.at)) out.push({ at: w.at, text: `Made a widget: ${clip(w.title || w.name, 60)}` });
  for (const p of projects) for (const st of p.steps) if (st.status === 'done' && today(st.at)) out.push({ at: st.at!, text: `Worked on the project “${clip(p.title, 50)}”: step ${st.n}, ${clip(st.title, 60)}` });
  for (const l of lessons) if (today(l.at)) out.push({ at: l.at, text: `Learned a lesson: ${clip(l.text, 90)}` });
  for (const i of ideas) if (today(i.at)) out.push({ at: i.at, text: i.from === 'owner' ? `Put on my learning list: “${clip(i.ask ?? i.title, 70)}”` : `Thought of an upgrade for myself: ${clip(i.title, 70)}` });
  return out.sort((a, b) => b.at - a.at);
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function todayRoute(url: URL, method: string, d: TodayDeps): Promise<Response> {
  if (method !== 'GET') return json({ error: 'not found' }, 404);
  return json({ items: await dayDoings(d, url.searchParams.get('tz') ?? undefined) });
}
