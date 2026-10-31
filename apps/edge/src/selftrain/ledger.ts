/**
 * THE CAPABILITY LEDGER (OWNER-ISSUES 65): "What I learned to do this week" — the GYM levels he reached and the games new
 * to the GYM, the SCHOOL stage passed, the tools his offline brain gained, the weekly training's exam, the independence
 * meter's movement — in his words, as one card on the REPORT CARD (GET /api/training/ledger) and as the Sunday note (with
 * Sunday's morning digest: cycle.ts sundayNote). The LOOPS card has the numbers; this says what they came to.
 * Only ever more demanding: a level reached is kept (the phone's GYM can be reset or drop a level; the ledger keeps the
 * best), and a new brain counts only when it passed its exam.
 */
import { ownShare, weekOf, type MeterDay } from '../../../../packages/shared/src/independence';
import { STAGE_IDS } from '../../../../packages/shared/src/school';
import { examMean, stopWords, type TrainReport } from '../../../../packages/shared/src/selftrain';
import { stageName } from '../school/papers';
import type { SchoolState } from '../school/state';

export const LEDGER_KEY = 'train:ledger';
const WEEK = 7 * 86_400_000;

export interface Ledger {
  /** Each GYM game's levels as they were first reached (at 0: reached before the ledger began), and its name. */
  gym: Record<string, { name?: string; steps: { level: number; at: number }[] }>;
  /** The offline brain's tools, by when each was first seen (0: there at the first look). */
  tools: Record<string, number>;
  /** The owner's day (YYYY-MM-DD) the last Sunday note went. */
  sent?: string;
}

export async function loadLedger(s: DurableObjectStorage): Promise<Ledger> {
  const v = await s.get<Ledger>(LEDGER_KEY);
  return { gym: v?.gym ?? {}, tools: v?.tools ?? {}, ...(v?.sent ? { sent: v.sent } : {}) };
}

/**
 * The phone's GYM levels into the ledger: a higher level is kept with when it was reached; a lower one changes nothing.
 * The first levels ever sent were reached before the ledger began; a game first seen after that is new to the GYM.
 * Returns the levels a game went up to now (for the day log).
 */
export function noteGym(l: Ledger, levels: Record<string, number>, names: Record<string, string>, now: number): { name: string; level: number }[] {
  const first = !Object.keys(l.gym).length;
  const up: { name: string; level: number }[] = [];
  for (const [id, level] of Object.entries(levels)) {
    const g = (l.gym[id] ??= { steps: [] });
    if (names[id]) g.name = names[id];
    if (level <= (g.steps.at(-1)?.level ?? 0)) continue;
    g.steps.push({ level, at: first ? 0 : now });
    if (!first && g.steps.length > 1) up.push({ name: g.name ?? id, level });
  }
  return up;
}

/** The offline brain's tools into the ledger: one not seen before joined now (at the first look, all were there). True when it changed. */
export function noteTools(l: Ledger, names: string[], now: number): boolean {
  const first = !Object.keys(l.tools).length;
  const fresh = names.filter((n) => !(n in l.tools));
  for (const n of fresh) l.tools[n] = first ? 0 : now;
  return fresh.length > 0;
}

export interface LedgerInput {
  now: number;
  ledger: Ledger;
  school: Pick<SchoolState, 'stage' | 'passed'> | null;
  /** The weekly training's latest report. */
  report: TrainReport | null;
  /** The independence meter's days (the brain's copy: counts only). */
  meter: MeterDay[];
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));

/** What I learned to do this week (the seven days to `now`), a line a kind, in his words; [] when nothing new came. Pure. */
export function ledgerLines(x: LedgerInput): string[] {
  const since = x.now - WEEK;
  const out: string[] = [];
  // the GYM: the levels reached this week (from the best before it), and the games new to it
  const up: string[] = [];
  const joined: string[] = [];
  for (const [id, g] of Object.entries(x.ledger.gym)) {
    const last = g.steps.at(-1);
    if (!last || last.at < since) continue;
    const before = g.steps.filter((s) => s.at < since).at(-1);
    if (before) up.push(`${g.name ?? id} level ${last.level} (from ${before.level})`);
    else joined.push(`${g.name ?? id} (level ${last.level})`);
  }
  if (up.length) out.push(`In the GYM I reached ${and(up)}.`);
  if (joined.length) out.push(`New in the GYM: ${and(joined)}.`);
  // SCHOOL: the stages passed this week (a placement test passes the ones below it too)
  const sc = x.school;
  const passed = sc ? STAGE_IDS.filter((id) => (sc.passed[id]?.at ?? -1) >= since) : [];
  if (sc && passed.length) out.push(`At SCHOOL I passed ${and(passed.map(stageName))}${sc.passed[sc.stage] ? '' : `: I'm on ${stageName(sc.stage)} now`}.`);
  // the offline brain's tools that joined this week
  const tools = Object.entries(x.ledger.tools)
    .filter(([, at]) => at > 0 && at >= since)
    .map(([n]) => n.replace(/_/g, ' '));
  if (tools.length) out.push(`My offline brain can use ${tools.length === 1 ? 'a new tool' : `${tools.length} new tools`}: ${and(tools)}.`);
  // the weekly training's exam (a new brain counts only when it passed)
  const r = x.report;
  if (r && r.finishedAt >= since) {
    const stopped = stopWords(r);
    const score = Object.keys(r.before ?? {}).length && Object.keys(r.after ?? {}).length ? `${pc(examMean(r.before))} → ${pc(examMean(r.after))}` : '';
    if (stopped) out.push(`The weekly training (week ${r.week}) stopped: ${stopped}.`);
    else if (r.gate?.pass) out.push(`My offline brain passed week ${r.week}'s exam${score ? ` (${score})` : ''}: the new one is ready in SETTINGS → OFFLINE BRAIN.`);
    else out.push(`Week ${r.week}'s training did not pass its exam${score || r.gate?.why ? ` (${[score, r.gate?.why].filter(Boolean).join(': ')})` : ''}, so I kept the brain I had.`);
  }
  // the independence meter: his own brains' share this week, and the week before
  const day = new Date(x.now).toISOString().slice(0, 10);
  const own = ownShare(weekOf(x.meter, day));
  const was = ownShare(weekOf(x.meter, day, 1));
  if (own !== null) out.push(`Your own brains answered ${own}% of what you asked this week${was !== null ? ` (${was}% the week before)` : ''}.`);
  return out;
}
