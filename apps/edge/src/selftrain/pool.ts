/**
 * THE DAILY GPU (BRIEF-TRAINING-RESILIENCE part B): a second, small pool of free GPU time beside Kaggle's.
 *
 * Hugging Face lends a free account about 5 minutes a day of a big GPU (ZeroGPU, in a Gradio Space on the account's
 * own name), and a free account cannot buy more. With the owner's yes (asked once, in SYSTEM → OFFLINE BRAIN
 * TRAINING: `POST /training/pool {allow}`), the brain makes one Space on his account with his `hf_write` token —
 * private when Hugging Face lets a free account have one, else public, holding no data of his and answering only with
 * its key — uploads its code (training/space/*, and the weekly notebook as ghosty_weekly.py: assets.ts SPACE_FILES)
 * and two secrets (the token, to read his PRIVATE repos at call time, and the key), and from the next day calls it once
 * a day (UK days):
 *   sample — STaR candidates from the brain in use on that day's slice of the latest uploaded week's puzzles, for up to
 *            4.5 minutes of GPU; score — the GYM's own checkers on them (no GPU time); the right ones wait here as
 *            `star` records (from 'daily GPU · …') and the next week's gathering takes them (cycle.ts FREE_PARTS,
 *            through the same near-exam filter as everything else);
 *   exam   — a SCHOOL paper, when Kaggle's hours are short for it (cycle.ts examStep): sat here instead of on the phone.
 * It is never counted on: Kaggle stays where the week trains; a day with no minutes, or the Space asleep, is skipped
 * and said. Nothing can be billed: the brain refuses unless Hugging Face says the account is not PRO and has no card,
 * and the only hardware it ever asks for is ZeroGPU.
 */
import { recordProblem, type TrainRecord, type TrainStatus } from '../../../../packages/shared/src/selftrain';
import { NOTEBOOK_PY, SPACE_FILES } from './assets';
import { gradioCall, hfCommit, hfCreateSpace, hfSpaceSecret, hfWhoami, RemoteError, spaceHost, type HfMe } from './remote';

export const SPACE_NAME = 'ghosty-daily-gpu';
/** GPU seconds a day the brain asks for (the notebook's POOL_SECONDS: 4.5 of the free 5 minutes), and a paper's share. */
export const POOL_SECONDS = 270;
export const POOL_EXAM_SECONDS = 90;
/** Puzzles a day, and samples each. */
const POOL_PUZZLES = 24;
const POOL_SAMPLES = 8;
/** Checked records waiting for the next week (the oldest go), and days of history kept. */
const POOL_WAITING = 300;
const POOL_DAYS = 30;
const DAY = 86_400_000;
const TZ = 'Europe/London';
const KEY = 'pool:state';

export type PoolPhase = 'off' | 'setup' | 'ready' | 'failed';

export interface PoolState {
  phase: PoolPhase;
  /** The owner's answer (asked once): yes, or no thanks (never offered again; he can still allow it). */
  answer?: 'yes' | 'no';
  answeredAt?: number;
  /** The Space ("owner/ghosty-daily-gpu"), where it answers, whether it is private, and the key its calls carry. */
  space?: string;
  host?: string;
  private?: boolean;
  key?: string;
  note: string;
  /** The UK day of the last daily call, and the GPU seconds asked for that day. */
  lastDay?: string;
  used?: { day: string; seconds: number };
  /** Set-up attempts that failed in a row. */
  failures?: number;
  /** One line a day: samples checked, right ones kept, or why the day was skipped. */
  days: { day: string; at: number; checked: number; kept: number; skipped?: string }[];
  /** Checked samples waiting for the next week's gathering. */
  waiting: TrainRecord[];
}

export interface PoolDeps {
  storage: DurableObjectStorage;
  vault: { get(name: string): Promise<string | null | undefined> };
  fetch?: typeof fetch;
  now?: () => number;
  notify?: (title: string, text: string) => Promise<void>;
}

const fresh = (): PoolState => ({ phase: 'off', note: 'Not set up.', days: [], waiting: [] });
export async function loadPool(s: DurableObjectStorage): Promise<PoolState> {
  return { ...fresh(), ...((await s.get<PoolState>(KEY)) ?? {}) };
}
const savePool = (s: DurableObjectStorage, p: PoolState) => s.put(KEY, p);
const nowOf = (d: PoolDeps) => (d.now ?? Date.now)();
const fetchOf = (d: PoolDeps): typeof fetch => d.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
/** The UK day a moment falls on ("2026-10-24"). */
export const ukDay = (t: number): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);

/** Why the account could pay for GPU time, so the daily GPU is not used ('' when it cannot: a free account with no card). */
export function billingProblem(me: Pick<HfMe, 'isPro' | 'canPay'>): string {
  if (me.isPro === undefined) return 'Hugging Face did not say whether your account is a free one, so Ghosty will not use its GPU (it must never be able to cost you money).';
  if (me.isPro) return 'Your Hugging Face account is PRO, so GPU time past the free minutes could be paid for: Ghosty will not use it (it must never be able to cost you money).';
  if (me.canPay) return 'Your Hugging Face account has a payment card on it, so GPU time could be paid for: Ghosty will not use it (it must never be able to cost you money). Remove the card on huggingface.co (Settings → Billing) and allow it again.';
  return '';
}

/** What the phone shows: the state in a line, whether to ask (once), and this week's checked samples. */
export function poolView(p: PoolState, now: number, keysOk: boolean): NonNullable<TrainStatus['pool']> {
  const since = now - 7 * DAY;
  return {
    phase: p.phase,
    note: p.note,
    offer: keysOk && !p.answer,
    week: p.days.filter((x) => x.at >= since).reduce((t, x) => t + x.kept, 0),
    waiting: p.waiting.length,
    ...(p.space ? { space: p.space, private: !!p.private } : {}),
  };
}

/** The owner's answer (POST /training/pool {allow}): yes makes the Space at the next step; no stops (the Space, if made, stays his). */
export async function poolAnswer(s: DurableObjectStorage, allow: boolean, now: number): Promise<PoolState> {
  const p = await loadPool(s);
  p.answer = allow ? 'yes' : 'no';
  p.answeredAt = now;
  if (allow) {
    if (p.phase !== 'ready') {
      p.phase = 'setup';
      p.failures = 0;
      p.note = 'Setting up the daily GPU on your Hugging Face account…';
    }
  } else {
    const had = !!p.space;
    p.phase = 'off';
    p.note = had
      ? `Turned off: Ghosty no longer uses the daily GPU. The Space ${p.space} stays on your Hugging Face account (it costs nothing); delete it there if you like (its Settings → Delete).`
      : 'Not used: you said no thanks. You can allow it here any time.';
  }
  await savePool(s, p);
  return p;
}

/** The daily GPU, when it is ready to be called (for a SCHOOL paper when Kaggle's hours are short). */
export async function poolReady(s: DurableObjectStorage): Promise<PoolState | null> {
  const p = await loadPool(s);
  return p.phase === 'ready' && p.host && p.key ? p : null;
}

const random = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
const said = (e: unknown) => (e instanceof RemoteError ? e.message : String((e as Error)?.message ?? e).slice(0, 200));

/** Make (or bring up to date) the Space: free account only, ZeroGPU only, its code and its two secrets. */
async function setup(d: PoolDeps, p: PoolState, token: string, now: number): Promise<void> {
  const f = fetchOf(d);
  const me = await hfWhoami(f, token);
  const bill = billingProblem(me);
  if (bill) {
    p.phase = 'failed';
    p.note = bill;
    return;
  }
  if (!me.canCreate) {
    p.phase = 'failed';
    p.note = 'The Hugging Face token cannot make a Space on your account: make it a write token (or give a fine-grained one "write" on your own account), then allow the daily GPU again.';
    return;
  }
  const repo = `${me.name}/${SPACE_NAME}`;
  const made = await hfCreateSpace(f, token, repo);
  p.key ??= random();
  await hfSpaceSecret(f, token, repo, 'HF_TOKEN', token);
  await hfSpaceSecret(f, token, repo, 'GHOSTY_KEY', p.key);
  await hfCommit(f, token, repo, 'space', [...Object.entries(SPACE_FILES).map(([path, content]) => ({ path, content })), { path: 'ghosty_weekly.py', content: NOTEBOOK_PY }], "Ghosty's daily GPU");
  p.space = repo;
  p.host = spaceHost(repo);
  p.private = made.private;
  p.phase = 'ready';
  p.failures = 0;
  // the first call tomorrow: Hugging Face builds the Space meanwhile
  p.lastDay = ukDay(now);
  p.note = `Ready: ${repo} on your Hugging Face account (${made.private ? 'private' : 'public, holding none of your data, and it answers only Ghosty'}). Hugging Face is building it; the first practice is tomorrow, about 5 free GPU minutes a day.`;
  await d.notify?.('Offline brain training', `The daily GPU is set up on your Hugging Face account: ${repo}.`).catch(() => undefined);
}

/** Take the Space's records: each checked again (a star record from the daily GPU only), new ones only, the waiting list capped. */
export function takeRecords(p: PoolState, records: unknown): number {
  const seen = new Set(p.waiting.map((r) => r.messages?.find((m) => m.role === 'user')?.content ?? ''));
  let kept = 0;
  for (const r of Array.isArray(records) ? records.slice(0, 200) : []) {
    const rec = r as TrainRecord;
    if (recordProblem(rec) || rec.kind !== 'star' || !/^daily GPU · /.test(String(rec.from ?? ''))) continue;
    const ask = rec.messages!.find((m) => m.role === 'user')?.content ?? '';
    const key = `${ask}\n${rec.messages!.at(-1)!.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // only what a record is: nothing else the Space sent comes along
    p.waiting.push({ kind: 'star', messages: rec.messages!.map((m) => ({ role: m.role, content: m.content })), checked: String(rec.checked).slice(0, 300), from: String(rec.from).slice(0, 80) });
    kept++;
  }
  p.waiting = p.waiting.slice(-POOL_WAITING);
  return kept;
}

/** What the daily call needs from the week (cycle.ts gives it): the latest uploaded data and the brain in use. */
export interface PoolWeek {
  dataRepo: string;
  dataFile: string;
  dataRev: string;
  /** baseConfig(base) and `current` (the brain in use), as the notebook reads them. */
  config: Record<string, unknown>;
}

/**
 * One job step of the daily GPU: set up after the owner's yes; then once a UK day, sample and score. Never throws;
 * returns when it wants the job back (ms), or null.
 */
export async function poolStep(d: PoolDeps, week: () => Promise<PoolWeek | null>): Promise<number | null> {
  const s = d.storage;
  const now = nowOf(d);
  const p = await loadPool(s);
  if (p.phase === 'off' || p.phase === 'failed') return null;
  const token = ((await d.vault.get('hf_write').catch(() => null)) ?? '').trim();
  if (!token) return null;
  if (p.phase === 'setup') {
    try {
      await setup(d, p, token, now);
    } catch (e) {
      p.failures = (p.failures ?? 0) + 1;
      p.note = `Setting up the daily GPU failed: ${said(e)}${p.failures >= 3 ? '' : ' Trying again in an hour.'}`;
      if (p.failures >= 3) p.phase = 'failed';
    }
    await savePool(s, p);
    return p.phase === 'setup' ? 3600_000 : null;
  }
  const day = ukDay(now);
  if (p.lastDay === day || !p.host || !p.key) return null;
  const w = await week();
  if (!w) {
    p.note = 'Ready; nothing to practise yet: the daily GPU starts once a week of lessons has been uploaded.';
    await savePool(s, p);
    return 6 * 3600_000;
  }
  p.lastDay = day;
  const used = p.used?.day === day ? p.used.seconds : 0;
  const seconds = POOL_SECONDS - used;
  const line = { day, at: now, checked: 0, kept: 0 } as PoolState['days'][number];
  if (seconds < 60) {
    line.skipped = "today's free GPU minutes went on a school paper";
  } else {
    const f = fetchOf(d);
    const base = { key: p.key, data_repo: w.dataRepo, data_rev: w.dataRev };
    try {
      p.used = { day, seconds: used + seconds };
      const got = await gradioCall(f, token, p.host, 'sample', { ...base, data_file: w.dataFile, ...w.config, n: POOL_PUZZLES, k: POOL_SAMPLES, day: Math.floor(now / DAY), seconds });
      const scored = await gradioCall(f, token, p.host, 'score', { ...base, samples: got.samples, system: got.system });
      line.checked = Number(scored.checked) || 0;
      line.kept = takeRecords(p, scored.records);
    } catch (e) {
      line.skipped = (e as { quota?: boolean }).quota ? 'no free GPU minutes left today on Hugging Face' : said(e);
    }
  }
  p.days = [...p.days, line].slice(-POOL_DAYS);
  p.note = line.skipped
    ? `Today was skipped (${line.skipped}); tried again tomorrow. Kaggle's weekly run does not depend on it.`
    : `Today on the daily GPU: ${line.checked} practice answers checked, ${line.kept} right ones kept for next week's training.`;
  await savePool(s, p);
  return null;
}

/** The checked samples waiting, handed to the week's gathering (and so no longer waiting). */
export async function drainPool(s: DurableObjectStorage): Promise<TrainRecord[]> {
  const p = await loadPool(s);
  if (!p.waiting.length) return [];
  const out = p.waiting;
  p.waiting = [];
  await savePool(s, p);
  return out;
}

/**
 * A SCHOOL paper sat on the daily GPU (cycle.ts examStep, when Kaggle's hours are short): its questions (already in the
 * private dataset as `paper_file` at `data_rev`, never the answers) with the phone's exam prompt, on the weights as they
 * ship. Takes its seconds from the day's minutes. Returns the answers; throws (RemoteError) when it could not.
 */
export async function poolSit(d: PoolDeps, p: PoolState, args: { dataRepo: string; paperFile: string; dataRev: string; items: number; config: Record<string, unknown> }): Promise<{ id: string; given: string }[]> {
  const token = ((await d.vault.get('hf_write').catch(() => null)) ?? '').trim();
  const now = nowOf(d);
  const day = ukDay(now);
  const used = p.used?.day === day ? p.used.seconds : 0;
  if (POOL_SECONDS - used < POOL_EXAM_SECONDS) throw new RemoteError("today's free minutes on the daily GPU are used up");
  p.used = { day, seconds: used + POOL_EXAM_SECONDS };
  await savePool(d.storage, p);
  const out = await gradioCall(fetchOf(d), token, p.host!, 'exam', { key: p.key, data_repo: args.dataRepo, paper_file: args.paperFile, data_rev: args.dataRev, chunk: [0, args.items], seconds: POOL_EXAM_SECONDS, ...args.config });
  const answers = (Array.isArray(out.answers) ? out.answers : []).filter((a): a is { id: string; given: string } => !!a && typeof (a as { id?: unknown }).id === 'string' && typeof (a as { given?: unknown }).given === 'string');
  if (answers.length < args.items) throw new RemoteError(`it answered only ${answers.length} of ${args.items} questions in its minutes`);
  return answers;
}
