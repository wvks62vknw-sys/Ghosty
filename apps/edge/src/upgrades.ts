/**
 * Daily upgrade ideas. Once a day (05:40 UTC) Ghosty looks at itself — what it has (self_audit),
 * what the owner asked about this week (its research notes), what the library could not answer
 * (study gaps), what went wrong (errors in the inbox) and who the owner is (memory) — and asks a
 * cheap model for one to three concrete upgrades it could build for itself, each free, phone-first
 * and shippable with its self-edit tools in one change. They wait in Workshop → UPGRADE IDEAS,
 * where BUILD starts one in the chat; the owner is told once, only when a new idea appeared.
 * With no model reachable nothing is stored and it tries again the next morning.
 */
import type { UpgradeIdea } from '../../../packages/shared/src/protocol';
import { asData } from './kernel/permissions';
import type { Library } from './library/store';
import { loadStudy } from './library/study';
import { loadInbox, loadJobs } from './schedule';
import { loadMemory } from './tools/memory';

export const UPGRADES_KEY = 'upgrades:ideas';
const MAX_IDEAS = 10;
const WEEK = 7 * 86400_000;
/** The standing job (schedule.ts ensureJob): every morning, before the owner is up. */
export const UPGRADE_JOB = {
  kind: 'upgrade' as const,
  title: 'Daily upgrade ideas',
  text: 'Look at what you have and what the owner needed this week; propose one to three upgrades you could build for yourself.',
  hour: 5,
  minute: 40,
  tz: 'UTC',
  repeat: 'daily' as const,
};

export interface UpgradeDeps {
  storage: DurableObjectStorage;
  library: Library;
  /** The self-audit summary (the self_audit tool in tools/evolve.ts). */
  audit: () => Promise<string>;
  /** A cheap model, never waiting on rate limits; throws when none is reachable. */
  ask: (system: string, user: string) => Promise<string>;
  /** Tell the owner (inbox + push). */
  notify: (title: string, text: string) => Promise<void>;
  now?: number;
}

export async function loadIdeas(storage: DurableObjectStorage): Promise<UpgradeIdea[]> {
  return (await storage.get<UpgradeIdea[]>(UPGRADES_KEY)) ?? [];
}

/** Dismiss an idea by its id (or by its position in the list, 0-based). */
export async function removeIdea(storage: DurableObjectStorage, which: string): Promise<boolean> {
  const list = await loadIdeas(storage);
  const byId = list.findIndex((x) => x.id === which);
  const at = byId >= 0 ? byId : /^\d+$/.test(which) ? Number(which) : -1;
  if (at < 0 || at >= list.length) return false;
  list.splice(at, 1);
  await storage.put(UPGRADES_KEY, list);
  return true;
}

const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/** The same idea in other words: most of the shorter title's words are in the other one. */
export function sameIdea(a: string, b: string): boolean {
  const wa = new Set(words(a).filter((w) => w.length > 2));
  const wb = new Set(words(b).filter((w) => w.length > 2));
  if (!wa.size || !wb.size) return words(a).join(' ') === words(b).join(' ');
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  let common = 0;
  for (const w of small) if (big.has(w)) common++;
  return common / small.size >= 0.75;
}

/** The ideas in a model's reply, however it wrapped them (code fences, chatter around the JSON); bad entries are dropped. */
export function parseIdeas(text: string): { title: string; why: string; steps: string[] }[] {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(a, b + 1));
  } catch {
    return [];
  }
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];
  const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const out: { title: string; why: string; steps: string[] }[] = [];
  for (const it of list) {
    const o = (it ?? {}) as { title?: unknown; why?: unknown; steps?: unknown };
    const title = clean(o.title, 80);
    const why = clean(o.why, 240);
    const steps = (Array.isArray(o.steps) ? o.steps : []).map((s) => clean(s, 200)).filter(Boolean).slice(0, 6);
    if (title.length < 6 || !steps.length || out.some((x) => sameIdea(x.title, title))) continue;
    out.push({ title, why, steps });
    if (out.length === 3) break;
  }
  return out;
}

/** New ideas in front of the old ones, the same idea never twice, at most MAX_IDEAS (the oldest go). */
export function mergeIdeas(existing: UpgradeIdea[], fresh: { title: string; why: string; steps: string[] }[], now: number): { list: UpgradeIdea[]; added: UpgradeIdea[] } {
  const added: UpgradeIdea[] = [];
  for (const f of fresh) {
    if (existing.some((e) => sameIdea(e.title, f.title)) || added.some((e) => sameIdea(e.title, f.title))) continue;
    added.push({ id: crypto.randomUUID().slice(0, 6), ...f, at: now });
  }
  return { list: [...added, ...existing].slice(0, MAX_IDEAS), added };
}

/** Everything the model is shown, gathered without any AI: what Ghosty has, and what the week showed. */
export async function gather(deps: UpgradeDeps): Promise<string> {
  const now = deps.now ?? Date.now();
  const parts: string[] = [];
  const audit = await deps.audit().catch((e) => `(self-audit unavailable: ${String((e as Error)?.message ?? e).slice(0, 120)})`);
  parts.push(`WHAT YOU HAVE (self-audit):\n${audit.slice(0, 3500)}`);
  // the week's research: the headings of the notes Ghosty filed, i.e. what the owner asked about
  const research: string[] = [];
  try {
    if (deps.library.available && deps.library.doc('notes_research')) {
      for (const p of deps.library.passagesOf('notes_research', 0, 300).passages) {
        const m = p.text.match(/^Question \((\d{4}-\d{2}-\d{2})\)/);
        if (m && now - Date.parse(m[1]!) <= WEEK && p.heading && !research.includes(p.heading)) research.push(p.heading);
      }
    }
  } catch {
    /* the library is a bonus here */
  }
  const st = await loadStudy(deps.storage);
  const errors = (await loadInbox(deps.storage)).filter((i) => i.kind === 'error' && now - i.at <= WEEK).slice(-10);
  const facts = (await loadMemory(deps.storage)).slice(-40);
  const existing = await loadIdeas(deps.storage);
  parts.push(`WHAT THE OWNER ASKED ABOUT THIS WEEK (${research.length} research notes):\n${research.length ? asData("your research notes' headings", research.slice(-20).map((h) => `- ${h}`).join('\n')) : '(nothing researched this week)'}`);
  parts.push(`QUESTIONS YOUR LIBRARY COULD NOT ANSWER:\n${st.gaps.length ? asData('your study gaps', st.gaps.slice(-10).map((g) => `- ${g}`).join('\n')) : '(none)'}`);
  parts.push(`WHAT WENT WRONG THIS WEEK (${errors.length} errors in your inbox):\n${errors.length ? asData('your inbox', errors.map((e) => `- ${e.title}: ${e.text.slice(0, 160)}`).join('\n')) : '(nothing)'}`);
  parts.push(`ABOUT THE OWNER (${facts.length} facts):\n${facts.length ? asData('your memory of the owner', facts.map((f) => `- ${f.text}`).join('\n')) : '(nothing remembered yet)'}`);
  if (existing.length) parts.push(`ALREADY PROPOSED (never repeat these):\n${existing.map((e) => `- ${e.title}`).join('\n')}`);
  return parts.join('\n\n');
}

/** What the model is asked (the mock model answers anything that starts with UPGRADE IDEAS). */
export const UPGRADE_PROMPT = `UPGRADE IDEAS: you are Ghosty, a personal AI that can edit its own code (a Cloudflare Worker brain in TypeScript plus an iPhone web app with no frameworks; everything free; a protected kernel you may not touch). Once a day you propose upgrades to yourself for your owner, who is not technical.
Reply with JSON only, no words around it: {"ideas":[{"title":"…","why":"…","steps":["…","…"]}]} — one to three ideas.
Each idea must be: shippable with your self-edit tools in ONE change (a new brain tool in apps/edge/src/tools/extra.ts, a panel in apps/web/src/features/<tab>/index.ts, a feed in apps/web/src/data/, a fix); free (no paid APIs, no accounts, no new npm packages); phone-first (390 px); and worth something to THIS owner, judging by what they asked about, what you could not answer, what went wrong, and what you remember about them.
title: at most 60 characters, a plain promise ("A rain radar panel on the Brief tab"). why: at most 200 characters, what the owner gets. steps: 2 to 5 short concrete steps naming the files or tools to use. Never repeat an idea already proposed, never propose what you already have, nothing that weakens safety or needs the kernel.`;

export interface UpgradeRun {
  ideas: UpgradeIdea[];
  added: number;
  /** One line for the job's record and the Workshop: what happened. */
  note: string;
}

/**
 * The daily job: gather, ask, keep what is new, tell the owner once. A model that is missing or
 * unhelpful is a note, not a failure (tomorrow is another try); a storage failure does propagate.
 */
export async function thinkUpgrades(deps: UpgradeDeps): Promise<UpgradeRun> {
  const now = deps.now ?? Date.now();
  const existing = await loadIdeas(deps.storage);
  const context = await gather(deps);
  let reply: string;
  try {
    reply = await deps.ask(UPGRADE_PROMPT, context);
  } catch (e) {
    return { ideas: existing, added: 0, note: `no model reachable (${String((e as Error)?.message ?? e).slice(0, 80)}) — trying again tomorrow` };
  }
  const fresh = parseIdeas(reply);
  if (!fresh.length) return { ideas: existing, added: 0, note: "the model's reply held no usable ideas — trying again tomorrow" };
  const { list, added } = mergeIdeas(existing, fresh, now);
  if (!added.length) return { ideas: existing, added: 0, note: `${fresh.length} idea${fresh.length === 1 ? '' : 's'}, all proposed before` };
  await deps.storage.put(UPGRADES_KEY, list);
  const titles = added.map((a) => a.title);
  await deps.notify('Upgrade idea', added.length === 1 ? `I have an upgrade idea: ${titles[0]} — see Workshop` : `I have ${added.length} upgrade ideas: ${titles.join('; ')} — see Workshop`).catch(() => undefined);
  return { ideas: list, added: added.length, note: `${added.length} new idea${added.length === 1 ? '' : 's'}: ${titles.join('; ')}` };
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** The Workshop's UPGRADE IDEAS panel: GET /upgrades, DELETE /upgrades/<id>, POST /upgrades/now. */
export async function upgradesRoute(path: string, method: string, deps: UpgradeDeps): Promise<Response> {
  if (path === '/upgrades' && method === 'GET') {
    const job = (await loadJobs(deps.storage)).find((j) => j.kind === 'upgrade');
    return json({ ideas: await loadIdeas(deps.storage), next: job?.next ?? null, last: job?.lastResult ?? null });
  }
  if (path === '/upgrades/now' && method === 'POST') return json(await thinkUpgrades(deps));
  const m = path.match(/^\/upgrades\/([\w-]+)$/);
  if (m && method === 'DELETE') return json({ removed: await removeIdea(deps.storage, m[1]!) });
  return json({ error: 'not found' }, 404);
}
