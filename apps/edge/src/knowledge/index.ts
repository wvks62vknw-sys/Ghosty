/**
 * Ghosty's knowledge: a handbook of playbooks (bundled with the brain, so it costs no
 * GitHub requests) plus lessons Ghosty learns from its own mistakes (kept in its private
 * storage and shown in every prompt, so it doesn't repeat them).
 *
 * Add playbooks to craft.ts (engineering method), appkit.ts (the single-file app page kit, the
 * quality loop, motion and 3D), coding.ts (languages, web platform, algorithms), fullstack.ts
 * (architecture, auth, APIs, databases, iPhone-first layout), games.ts (games and mini-apps on
 * the widget kit), typescript.ts or ghosty.ts (this codebase), home.ts (furniture and space). Lessons are added at runtime with the learn_lesson tool.
 */
import { APPKIT } from './appkit';
import { CODING } from './coding';
import { CRAFT } from './craft';
import { FULLSTACK } from './fullstack';
import { GADGETS } from './gadgets';
import { GAMES } from './games';
import { GHOSTY } from './ghosty';
import { HOME } from './home';
import { TYPESCRIPT } from './typescript';
import type { Lesson, Playbook } from './types';

export type { Lesson, Playbook } from './types';
export { NEON_DODGE } from './games';
export { APP_KIT_PAGE } from './appkit';
export { FULLSTACK } from './fullstack';

export const PLAYBOOKS: Playbook[] = [...CRAFT, ...APPKIT, ...GAMES, ...CODING, ...FULLSTACK, ...TYPESCRIPT, ...GHOSTY, ...HOME, ...GADGETS];

const words = (s: string) => s.toLowerCase().match(/[a-z0-9_.]+/g) ?? [];

/** Best playbooks for a topic, most relevant first. */
export function findPlaybooks(topic: string, max = 3): Playbook[] {
  const q = topic.toLowerCase().trim();
  const exact = PLAYBOOKS.find((p) => p.id === q);
  if (exact) return [exact];
  const qw = new Set(words(q));
  const padded = ` ${words(q).join(' ')} `;
  const scored = PLAYBOOKS.map((p) => {
    let s = 0;
    for (const t of p.tags) {
      if (padded.includes(` ${words(t).join(' ')} `)) s += t.includes(' ') ? 4 : 3;
      else if (words(t).some((w) => w.length > 3 && qw.has(w))) s += 1;
    }
    for (const w of words(p.title)) if (w.length > 3 && qw.has(w)) s += 1;
    if (q.includes(p.id)) s += 5;
    return { p, s };
  });
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.p);
}

export function playbookIndex(): string {
  return PLAYBOOKS.map((p) => `${p.id} — ${p.title}`).join('\n');
}

// ---------- lessons ----------

export const LESSONS_KEY = 'lessons';
const MAX_LESSONS = 80;
/** Conduct lessons (the owner's rules for how he talks) kept: their own cap, never crowding out the engineering ones. */
const MAX_CONDUCT = 30;

export async function loadLessons(storage: DurableObjectStorage): Promise<Lesson[]> {
  return (await storage.get<Lesson[]>(LESSONS_KEY)) ?? [];
}

const norm = (s: string) => words(s).join(' ');

/** Similar enough to count as the same lesson (most of the shorter one's words appear in the other). */
function similar(a: string, b: string): boolean {
  const wa = new Set(words(a).filter((w) => w.length > 3));
  const wb = new Set(words(b).filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return norm(a) === norm(b);
  const [small, big] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  let common = 0;
  for (const w of small) if (big.has(w)) common++;
  return common / small.size >= 0.8;
}

/**
 * Save a lesson. Re-learning the same lesson bumps it instead of duplicating it. `kind` 'conduct': the owner's own rule for
 * how he talks (his words, however short: "too long"), matched only against the other conduct lessons.
 */
export async function addLesson(storage: DurableObjectStorage, text: string, tags: string[] = [], kind?: 'conduct'): Promise<{ lesson: Lesson; repeat: boolean }> {
  const t = text.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (t.length < (kind ? 3 : 12)) throw new Error('a lesson needs a real sentence: what went wrong and the rule that prevents it');
  const list = await loadLessons(storage);
  const cleanTags = tags.map((x) => String(x).toLowerCase().trim().slice(0, 24)).filter(Boolean).slice(0, 6);
  const same = list.find((l) => l.kind === kind && similar(l.text, t));
  if (same) {
    same.hits++;
    same.at = Date.now();
    // A lesson the owner locked keeps its words.
    if (t.length > same.text.length && !same.locked) same.text = t;
    same.tags = [...new Set([...same.tags, ...cleanTags])].slice(0, 8);
    await storage.put(LESSONS_KEY, list);
    return { lesson: same, repeat: true };
  }
  const lesson: Lesson = { id: crypto.randomUUID().slice(0, 6), text: t, tags: cleanTags, at: Date.now(), hits: 1, ...(kind ? { kind } : {}) };
  list.push(lesson);
  // Over the cap (each kind its own): drop the least useful (fewest repeats, then oldest) — never a locked one.
  while (list.filter((l) => l.kind === kind).length > (kind ? MAX_CONDUCT : MAX_LESSONS)) {
    let worst = -1;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      if (a.locked || a.kind !== kind) continue;
      const w = worst < 0 ? null : list[worst]!;
      if (!w || a.hits < w.hits || (a.hits === w.hits && a.at < w.at)) worst = i;
    }
    if (worst < 0) break;
    list.splice(worst, 1);
  }
  await storage.put(LESSONS_KEY, list);
  return { lesson, repeat: false };
}

export async function removeLesson(storage: DurableObjectStorage, idOrText: string): Promise<number> {
  const q = idOrText.toLowerCase().trim();
  if (!q) return 0;
  const list = await loadLessons(storage);
  // A locked lesson is only forgotten from the Memory tab (memories.ts).
  const keep = list.filter((l) => l.locked || (l.id !== q && !l.text.toLowerCase().includes(q)));
  await storage.put(LESSONS_KEY, keep);
  return list.length - keep.length;
}

/** The lessons worth putting in the prompt: most repeated and most recent first, within a size budget. Engineering only. */
export function topLessons(list: Lesson[], max = 12, budget = 1800): Lesson[] {
  const ranked = list.filter((l) => !l.kind).sort((a, b) => b.hits - a.hits || b.at - a.at);
  const out: Lesson[] = [];
  let size = 0;
  for (const l of ranked) {
    if (out.length >= max || size + l.text.length > budget) break;
    out.push(l);
    size += l.text.length;
  }
  return out;
}

/**
 * The owner's rules for how he talks (conduct lessons) for every turn, capped by the prompt budget: the newest and the
 * most-confirmed win (each time he says it again counts as a week newer), at most `max` lines and `budget` characters.
 */
export function topConduct(list: Lesson[], max = 6, budget = 480): Lesson[] {
  const WEEK = 7 * 86400_000;
  const ranked = list.filter((l) => l.kind === 'conduct').sort((a, b) => b.at + (b.hits - 1) * WEEK - (a.at + (a.hits - 1) * WEEK));
  const out: Lesson[] = [];
  let size = 0;
  for (const l of ranked) {
    if (out.length >= max || size + l.text.length > budget) break;
    out.push(l);
    size += l.text.length;
  }
  return out;
}

/**
 * The always-on core of the handbook, in the system prompt. Kept short on purpose: free
 * models have small rate limits, so the detail lives in playbooks fetched with `study`.
 */
export const engineeringEssentials = (name: string): string => `ENGINEERING STANDARD (you code like a principal engineer — correct first time):
- Understand before typing: restate the goal and the definition of done. study the matching playbook (e.g. study "tab", "panel", "brain tool", "typescript") before a self-edit, and read every file you will touch (repo_read_many reads several at once).
- Never invent an API, file, export or prop: if unsure, repo_search or repo_read it. Copy the patterns of neighbouring code.
- Smallest complete change; split big work into shippable slices; handle empty/error/loading states.
- Before propose_change run the self-review: exact find snippets, imports exist and are exported, strict TypeScript (arr[i]! or ?? fallback, typed params, catch (e) as Error), nothing duplicated, no placeholders, nothing left out.
- When checks fail: read the FIRST error, find the root cause in the code on the branch, make the smallest fix. After any failure is fixed, call learn_lesson with the cause and a rule ("Rule: always …").
- Full-stack work: UI, API/business logic and data access always in separate layers; validate every input on the server; parameterised SQL; every private route checks who is calling (public ones stay open, rate-limited). study "clean architecture", "auth", "crud api", "database schema", "ui to backend". Every page you build is iPhone-first (390px): study "mobile 390".
- Code written FOR ${name} in chat: complete and runnable, edge cases handled, mentally tested, with how to run it.`;
