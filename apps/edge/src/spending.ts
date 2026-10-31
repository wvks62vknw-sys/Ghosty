/**
 * SPENDING, the brain's side: the rows of the statements the owner added, kept in the Durable Object's own
 * storage within the free allowance (one key per month, `spend:m:YYYY-MM`, and an index `spend` with his rules
 * and budgets; at most MAX_ROWS rows — over that, the oldest go), sorted by the rules and, for the few names the
 * rules could not place, ONE cheap model call per import that is given those names and nothing else (no dates,
 * amounts or balances). No bank access of any kind. The pure parts are `packages/shared/src/spending.ts`.
 * Routes under /profile/spending (profile.ts sends them here): the Agenda tab's SPENDING card.
 */
import {
  budgetStatus,
  categorise,
  changes,
  findSubscriptions,
  isCategory,
  modelAsk,
  monthView,
  parseBudget,
  PRIVACY,
  readModelAnswer,
  readStatement,
  toCsv,
  yearView,
  type Category,
  type ImportResult,
  type SpendingSummary,
  type SpendRow,
} from '../../../packages/shared/src/spending';

export type { ImportResult };

const INDEX = 'spend';
const monthKey = (m: string) => `spend:m:${m}`;
/** Rows kept at most (about two years of an everyday account); the oldest go first. */
export const MAX_ROWS = 3000;

export interface SpendIndex {
  months: string[];
  rows: number;
  /** His own rules: a merchant key → its category (a tap in the card re-files a row and remembers it). */
  rules: Record<string, Category>;
  /** Monthly budgets in pounds. */
  budgets: Partial<Record<Category, number>>;
  last?: ImportResult;
}

export interface SpendingDeps {
  storage: DurableObjectStorage;
  /** One cheap model call; throws when none is free. */
  ai: (system: string, user: string) => Promise<string>;
}

async function loadIndex(storage: DurableObjectStorage): Promise<SpendIndex> {
  const i = await storage.get<SpendIndex>(INDEX);
  return { months: i?.months ?? [], rows: i?.rows ?? 0, rules: i?.rules ?? {}, budgets: i?.budgets ?? {}, ...(i?.last ? { last: i.last } : {}) };
}

async function monthRows(storage: DurableObjectStorage, m: string): Promise<SpendRow[]> {
  return (await storage.get<SpendRow[]>(monthKey(m))) ?? [];
}

async function allRows(storage: DurableObjectStorage, idx: SpendIndex): Promise<SpendRow[]> {
  const got = await storage.get<SpendRow[]>(idx.months.map(monthKey));
  return idx.months.flatMap((m) => got.get(monthKey(m)) ?? []);
}

const finger = (r: { d: string; t: string; a: number }) => `${r.d}|${r.t.toUpperCase().replace(/\s+/g, ' ')}|${r.a.toFixed(2)}`;

/**
 * A statement's CSV → rows kept. A row already kept from an earlier statement is not kept twice (the same day,
 * words and amount, counted, so two real coffees on one day both stay).
 */
export async function importStatement(deps: SpendingDeps, csv: string, now = Date.now()): Promise<ImportResult> {
  const { storage } = deps;
  const st = readStatement(csv);
  const idx = await loadIndex(storage);
  const { rows } = categorise(st.rows, idx.rules);
  // First what is new: a row already kept from an earlier statement is not kept (or asked about) twice.
  const byMonth = new Map<string, SpendRow[]>();
  for (const r of rows) byMonth.set(r.d.slice(0, 7), [...(byMonth.get(r.d.slice(0, 7)) ?? []), r]);
  let duplicates = 0;
  const fresh: SpendRow[] = [];
  const kept = new Map<string, SpendRow[]>();
  for (const [m, list] of byMonth) {
    const have = new Map<string, number>();
    const old = await monthRows(storage, m);
    kept.set(m, old);
    for (const r of old) have.set(finger(r), (have.get(finger(r)) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const r of list) {
      const f = finger(r);
      const n = (seen.get(f) ?? 0) + 1;
      seen.set(f, n);
      if (n <= (have.get(f) ?? 0)) duplicates++;
      else fresh.push(r);
    }
  }
  let asked = 0;
  let placed = 0;
  const unplaced = [...new Set(fresh.filter((r) => r.by === 'none').map((r) => r.k))];
  if (unplaced.length) {
    // The one model call: the names the rules could not place, and nothing else from the statement.
    const ask = modelAsk(unplaced);
    try {
      const answer = readModelAnswer(await deps.ai(ask.system, ask.user), ask.names);
      asked = ask.names.length;
      for (const r of fresh) {
        const c = r.by === 'none' ? answer[r.k] : undefined;
        if (c) {
          r.c = c;
          r.by = 'model';
          placed++;
        }
      }
    } catch {
      /* no model free: they stay "other" until he files them */
    }
  }
  const writes: Record<string, SpendRow[]> = {};
  for (const r of fresh) kept.get(r.d.slice(0, 7))!.push(r);
  for (const [m, list] of kept) writes[monthKey(m)] = list.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const added = fresh.length;
  const months = [...new Set([...idx.months, ...byMonth.keys()])].sort();
  // The cap: the oldest rows go first (whole months, then the oldest of the month left).
  const counts = new Map(months.map((m) => [m, writes[monthKey(m)]?.length ?? -1]));
  const unknown = months.filter((m) => counts.get(m) === -1);
  if (unknown.length) {
    const got = await storage.get<SpendRow[]>(unknown.map(monthKey));
    for (const m of unknown) counts.set(m, got.get(monthKey(m))?.length ?? 0);
  }
  let total = [...counts.values()].reduce((k, n) => k + n, 0);
  let dropped = 0;
  const gone: string[] = [];
  while (total > MAX_ROWS && months.length) {
    const m = months[0]!;
    const n = counts.get(m)!;
    if (total - n >= MAX_ROWS) {
      months.shift();
      gone.push(monthKey(m));
      delete writes[monthKey(m)];
      total -= n;
      dropped += n;
    } else {
      const cut = total - MAX_ROWS;
      const list = writes[monthKey(m)] ?? (await monthRows(storage, m));
      writes[monthKey(m)] = list.slice(cut);
      total -= cut;
      dropped += cut;
    }
  }
  if (gone.length) await storage.delete(gone);
  if (Object.keys(writes).length) await storage.put(writes);
  const result: ImportResult = {
    at: now,
    added,
    duplicates,
    skipped: st.skipped,
    shape: st.shape,
    bank: st.bank,
    asked,
    placed,
    unplaced: fresh.filter((r) => r.by === 'none').length,
    kept: total,
    dropped,
    months: [...byMonth.keys()].sort(),
  };
  await storage.put(INDEX, { ...idx, months, rows: total, last: result } satisfies SpendIndex);
  return result;
}

/** A tap re-files a row: every row with that name goes to the category, and the rule is remembered for the next statement. */
export async function fileMerchant(storage: DurableObjectStorage, k: string, c: Category): Promise<number> {
  const idx = await loadIndex(storage);
  idx.rules[k] = c;
  const writes: Record<string, SpendRow[]> = {};
  let n = 0;
  const got = await storage.get<SpendRow[]>(idx.months.map(monthKey));
  for (const m of idx.months) {
    const list = got.get(monthKey(m)) ?? [];
    let changed = false;
    for (const r of list)
      if (r.k === k) {
        r.c = c;
        r.by = 'you';
        changed = true;
        n++;
      }
    if (changed) writes[monthKey(m)] = list;
  }
  await storage.put({ ...writes, [INDEX]: idx });
  return n;
}

/** A budget from his words ("£200 a month on eating out"); 0 takes it away. */
export async function setBudget(storage: DurableObjectStorage, b: { words?: string; category?: string; monthly?: number }): Promise<{ category: Category; monthly: number }> {
  const parsed = b.words ? parseBudget(b.words) : isCategory(b.category) && Number.isFinite(b.monthly) ? { category: b.category, monthly: Number(b.monthly) } : null;
  if (!parsed) throw new Error('say an amount and what it is for, like "£200 a month on eating out"');
  if (parsed.category === 'income') throw new Error('a budget is for spending, not income');
  const idx = await loadIndex(storage);
  if (parsed.monthly > 0) idx.budgets[parsed.category] = Math.round(parsed.monthly * 100) / 100;
  else delete idx.budgets[parsed.category];
  await storage.put(INDEX, idx);
  return parsed;
}

/** Everything the card shows for a month (default: the latest month on a statement). */
export async function spendingSummary(storage: DurableObjectStorage, month?: string | null): Promise<SpendingSummary> {
  const idx = await loadIndex(storage);
  const rows = await allRows(storage, idx);
  const latest = idx.months[idx.months.length - 1] ?? '';
  const m = month && /^\d{4}-\d{2}$/.test(month) && idx.months.includes(month) ? month : latest;
  return {
    privacy: PRIVACY,
    month: m,
    months: idx.months,
    kept: rows.length,
    cap: MAX_ROWS,
    rules: Object.keys(idx.rules).length,
    last: idx.last ?? null,
    view: m ? monthView(rows, m) : null,
    year: m ? yearView(rows, m.slice(0, 4)) : null,
    changes: m ? changes(rows, m).lines : [],
    subscriptions: findSubscriptions(rows),
    budgets: Object.entries(idx.budgets).map(([c, v]) => budgetStatus(c as Category, v!, rows, m)),
    rows: rows.filter((r) => r.d.startsWith(m)).reverse(),
  };
}

/** The one shared mind's spending flag (mind.ts): the budget furthest gone this month once it is 90 % spent, in a few words ('' for none). */
export async function spendFlag(storage: DurableObjectStorage, month: string): Promise<string> {
  const idx = await loadIndex(storage);
  const budgets = Object.entries(idx.budgets);
  if (!budgets.length || !idx.months.includes(month)) return '';
  const rows = await allRows(storage, idx);
  const worst = budgets.map(([c, v]) => budgetStatus(c as Category, v!, rows, month)).sort((a, b) => b.frac - a.frac)[0];
  return worst && worst.frac >= 0.9 ? `${worst.category} budget: ${worst.line}` : '';
}

export async function spendingCsv(storage: DurableObjectStorage): Promise<string> {
  const idx = await loadIndex(storage);
  return toCsv(await allRows(storage, idx));
}

export async function forgetSpending(storage: DurableObjectStorage): Promise<void> {
  const idx = await loadIndex(storage);
  await storage.delete([INDEX, ...idx.months.map(monthKey)]);
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/**
 * GET /profile/spending?month=YYYY-MM → the summary; POST /profile/spending/import { csv } → the import's result and
 * the summary; POST /profile/spending/file { k, c }; POST /profile/spending/budget { words } (or { category, monthly });
 * GET /profile/spending/export → CSV; DELETE /profile/spending → every row, rule and budget gone.
 */
export async function spendingRoute(req: Request, path: string, method: string, url: URL, deps: SpendingDeps): Promise<Response> {
  const { storage } = deps;
  try {
    if (path === '/profile/spending' && method === 'GET') return json(await spendingSummary(storage, url.searchParams.get('month')));
    if (path === '/profile/spending/import' && method === 'POST') {
      const b = (await req.json().catch(() => ({}))) as { csv?: unknown };
      const csv = typeof b.csv === 'string' ? b.csv : '';
      if (!csv.trim()) return json({ error: 'that file is empty' }, 400);
      if (csv.length > 3_000_000) return json({ error: 'that statement is too big: download a year or less at a time' }, 400);
      const result = await importStatement(deps, csv);
      return json({ result, ...(await spendingSummary(storage, result.months[result.months.length - 1])) });
    }
    if (path === '/profile/spending/file' && method === 'POST') {
      const b = (await req.json().catch(() => ({}))) as { k?: unknown; c?: unknown; month?: unknown };
      if (typeof b.k !== 'string' || !b.k || !isCategory(b.c)) return json({ error: 'pick a category' }, 400);
      const n = await fileMerchant(storage, b.k, b.c);
      return json({ filed: n, ...(await spendingSummary(storage, typeof b.month === 'string' ? b.month : null)) });
    }
    if (path === '/profile/spending/budget' && method === 'POST') {
      const b = (await req.json().catch(() => ({}))) as { words?: string; category?: string; monthly?: number; month?: string };
      const set = await setBudget(storage, b);
      return json({ set, ...(await spendingSummary(storage, b.month ?? null)) });
    }
    if (path === '/profile/spending/export' && method === 'GET') return new Response(await spendingCsv(storage), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="ghosty-spending.csv"' } });
    if (path === '/profile/spending' && method === 'DELETE') {
      await forgetSpending(storage);
      return json(await spendingSummary(storage));
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  return json({ error: 'not found' }, 404);
}
