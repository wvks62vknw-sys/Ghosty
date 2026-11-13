/**
 * ACTIONS VERIFIED (BRIEF-RELIABILITY 2; STARS 86). When the brain says it did a thing that leaves a record (a reminder or event
 * set, a memory kept, a place kept, a site published or taken down, a document saved, a budget set, a post drafted), the phone reads
 * it back through the route that lists it before saying "Done": within about two seconds (one try, one retry), the reply's line held
 * as "Setting it…" until then. Read back: the reply's sentence stands and gains the tick. Not read back after the retry: the sentence
 * becomes "I tried to set that, but I cannot see it yet." with RETRY and SHOW ME (the list it should be on), never a bare "Done".
 *
 * The verify table below is the one place: which tool → which list → which field. A tool that is not in the table is not verified
 * and says nothing extra. The read is never answered from the copy kept on the phone (api/brain.ts readFresh): a thing that is
 * only in the kept copy is exactly the thing that is not there.
 */
import { readFresh, TZ } from '../api/brain';
import { trail } from '../ui/hisWords';

type Args = Record<string, unknown>;

/** One verified tool. */
export interface Rule {
  /** The route that lists it. */
  path: () => string;
  /** The list in the answer. */
  list: (j: any) => any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** The field the thing is found by: its id from the tool's own words, else this text in the list. */
  field: string;
  /** The value to look for (the id the tool's result gave, else the text the tool was given). */
  want: (a: Args, summary: string) => { id?: string; text?: string };
  /** Whether this call leaves a record at all (a lookup call of the same tool does not). */
  applies?: (a: Args, summary: string) => boolean;
  /** true: the thing should be GONE from the list (a site taken down, a budget taken away). */
  gone?: boolean;
  /** Where the tick says it is ("on your Agenda"), and where SHOW ME goes. */
  where: string;
  show: { open: string; panel?: string };
}

const idIn = (s: string) => /\(id ([\w-]+)\)/.exec(s)?.[1];
const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const agendaPath = () => `/agenda?days=365&tz=${encodeURIComponent(TZ)}`;
const slug = (s: unknown) => str(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** WHICH TOOL → WHICH LIST → WHICH FIELD. */
export const VERIFY: Record<string, Rule> = {
  set_reminder: { path: agendaPath, list: (j) => j.jobs ?? [], field: 'id|title', want: (a, s) => ({ id: idIn(s), text: str(a.text).slice(0, 120) }), where: 'on your agenda', show: { open: 'agenda' } },
  schedule_task: { path: agendaPath, list: (j) => j.jobs ?? [], field: 'id|title', want: (a, s) => ({ id: idIn(s), text: str(a.title).slice(0, 120) }), where: 'on your agenda', show: { open: 'agenda' } },
  add_event: { path: agendaPath, list: (j) => j.events ?? [], field: 'id|title', want: (a, s) => ({ id: idIn(s), text: str(a.title) }), where: 'on your agenda', show: { open: 'agenda' } },
  remember: { path: () => '/memory', list: (j) => j.facts ?? [], field: 'id|text', want: (a, s) => ({ id: idIn(s), text: str(a.text) }), where: 'in your memory', show: { open: 'memory' } },
  remember_place: {
    path: () => '/profile/places',
    list: (j) => j.places ?? [],
    field: 'label',
    want: (_a, s) => ({ text: /^Kept ([^:]+):/.exec(s)?.[1] ?? '' }),
    applies: (a, s) => (a.confirm === true || String(a.confirm) === 'true') && /^Kept /.test(s),
    where: 'in your places',
    show: { open: 'memory', panel: 'PLACES' },
  },
  publish_site: { path: () => '/sites', list: (j) => j.sites ?? [], field: 'name', want: (a) => ({ text: slug(a.name) }), where: 'on your sites', show: { open: 'workshop' } },
  unpublish_site: { path: () => '/sites', list: (j) => j.sites ?? [], field: 'name', want: (a) => ({ text: slug(a.name) }), gone: true, applies: (_a, s) => /^Taken down/.test(s), where: 'off your sites', show: { open: 'workshop' } },
  library_import: { path: () => '/library', list: (j) => j.docs ?? [], field: 'title', want: (_a, s) => ({ text: /^Saved "([^"]+)"/.exec(s)?.[1] ?? '' }), applies: (_a, s) => /^Saved "/.test(s), where: 'in your library', show: { open: 'library' } },
  set_budget: {
    path: () => '/profile/spending',
    list: (j) => j.budgets ?? [],
    field: 'category',
    want: (_a, s) => ({ text: /on ([a-z][a-z &-]*?)\./i.exec(s)?.[1]?.toLowerCase() ?? '' }),
    applies: (_a, s) => /^Budget set/.test(s),
    where: 'in your spending',
    show: { open: 'agenda', panel: 'SPENDING' },
  },
  social: { path: () => '/social', list: (j) => j.drafts ?? [], field: 'text', want: (a) => ({ text: str(a.text) }), applies: (a) => a.action === 'draft' && !!str(a.text), where: 'in your drafts', show: { open: 'social' } },
};

/** The rule for a tool call that went ok, or null (not in the table, or it left no record). */
export function ruleFor(tool: string, args: Args, summary: string): Rule | null {
  const r = VERIFY[tool];
  if (!r) return null;
  if (r.applies && !r.applies(args, summary)) return null;
  const w = r.want(args, summary);
  return w.id || w.text ? r : null;
}

/** Whether the list holds the thing (or, for a `gone` rule, no longer does). */
export function holds(rule: Rule, j: unknown, a: Args, summary: string): boolean {
  const w = rule.want(a, summary);
  const [f1, f2] = rule.field.split('|') as [string, string | undefined];
  const same = (x: unknown, y: string) => str(x).toLowerCase() === y.toLowerCase();
  const found = rule.list(j).some((it) => (w.id && f2 && same(it[f1], w.id)) || (w.text && same(it[f2 ?? f1], w.text)) || (w.text && f2 && same(it[f2], w.text)));
  return rule.gone ? !found : found;
}

export const SAY_NO = 'I tried to set that, but I cannot see it yet.';
/** One try's budget and the pause before the retry: two tries inside about two seconds. */
const TRY_MS = 1000;
const PAUSE_MS = 250;

async function once(rule: Rule, a: Args, summary: string, tryMs = TRY_MS): Promise<boolean> {
  let timer = 0;
  try {
    const j = await Promise.race([readFresh<unknown>(rule.path()), new Promise<never>((_, no) => (timer = window.setTimeout(() => no(new Error('took too long')), tryMs)))]);
    return holds(rule, j, a, summary);
  } catch (e) {
    trail(e, 'read it back');
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Read it back: once, then once more after a breath. */
/** `tryMs`: how long each try waits (his own RETRY waits longer than the reply's two seconds: he is looking at it). */
export async function readBack(rule: Rule, a: Args, summary: string, tryMs = TRY_MS): Promise<'ok' | 'no'> {
  if (await once(rule, a, summary, tryMs)) return 'ok';
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  return (await once(rule, a, summary, tryMs)) ? 'ok' : 'no';
}

/** What a settled entry keeps, so RETRY can read it again and SHOW ME can go to the list. */
export interface Verified {
  state: 'ok' | 'no';
  /** Where the tick says it is, for every thing read back ("on your agenda"). */
  where: string[];
  /** When it failed: what to read again, the reply's own sentence to put back, and where the list is. */
  fail?: { tool: string; args: Args; summary: string; original: string; show: Rule['show'] };
}
