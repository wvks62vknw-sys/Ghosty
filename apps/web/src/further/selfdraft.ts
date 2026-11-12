/**
 * GHOSTY BUILDS HIS OWN MISSING TOOLS (BRIEF-OCT-IDEAS-3 item 3): when he says what he cannot do ("Not yet. Want me to learn it?"),
 * YES also drafts a self-edit job for the Workshop: a one-paragraph plan of the change in his words, the files he would touch and the
 * test he would add. Only the drafting is new: the job runs through the self-edit that exists, and SHIP IT is the owner's tap (it
 * puts the plan in the chat as the request, where the usual review, checks and his second tap in PROPOSED CHANGES come first).
 *
 * The draft is made on this phone from his own words and kept on it (`ghosty.selfdrafts`); no model, nothing sent, nothing shipped.
 * The files are a first guess from what he asked for ("first guess", said on the card): the self-edit reads the real tree when it starts.
 */
export const DRAFTS_KEY = 'ghosty.selfdrafts';
export const MAX_DRAFTS = 12;

export interface SelfDraft {
  id: string;
  /** His words, as he said them. */
  ask: string;
  /** The one-paragraph plan, in his words. */
  plan: string;
  /** The files he would touch (a first guess), and the test he would add. */
  files: string[];
  test: string;
  at: number;
  /** 'draft' until he taps SHIP IT; 'sent' after (the plan went to the chat); 'dropped' is simply removed. */
  state: 'draft' | 'sent';
}

/** His words as the thing to do: "can you teleport me to Mars?" → "teleport me to Mars". */
export function taskOf(ask: string): string {
  const t = ask
    .trim()
    .replace(/[?!.\s]+$/g, '')
    .replace(/^(?:ok(?:ay)?|hey|please|so)[, ]+/i, '')
    .replace(/^(?:can|could|would|will) you (?:please )?(?:also )?/i, '')
    .replace(/^(?:are you able to|do you know how to|is it possible for you to|i(?:'d| would) like you to|i want you to|i need you to)\s+/i, '')
    .replace(/^(?:learn(?: how)? to|be able to)\s+/i, '');
  return t.charAt(0).toLowerCase() + t.slice(1) || ask.trim();
}

/** A name for the new ability's files: two or three words of the task, lower case, hyphens. */
export function slugOf(task: string): string {
  const w = task.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((x) => x.length > 2 && !/^(?:the|and|for|with|from|into|that|this|how|what|when|where|about|please|me|my|you|your)$/.test(x));
  return (w.slice(0, 3).join('-') || 'new-ability').slice(0, 32);
}

/** Where a request of that kind lives today: the screen's files he would change instead of adding a new one. */
const HOMES: { re: RegExp; files: string[] }[] = [
  { re: /\b(?:photo|picture|camera|plant|bird|see|read a|scan|label|measure)\b/i, files: ['apps/web/src/features/lens/index.ts'] },
  { re: /\b(?:money|spend|spending|bank|budget|pay|bill|statement)\b/i, files: ['apps/web/src/features/money/sheet.ts', 'apps/edge/src/spending.ts'] },
  { re: /\b(?:remind|calendar|diary|event|appointment|meeting|schedule)\b/i, files: ['apps/web/src/features/agenda/index.ts', 'apps/edge/src/schedule.ts'] },
  { re: /\b(?:music|song|radio|playlist|podcast|play)\b/i, files: ['apps/web/src/features/radio/index.ts'] },
  { re: /\b(?:translate|language|speak|interpret)\b/i, files: ['apps/web/src/features/interpreter/index.ts'] },
  { re: /\b(?:weather|rain|forecast|temperature)\b/i, files: ['apps/web/src/features/brief/index.ts', 'apps/web/src/data/weather.ts'] },
  { re: /\b(?:email|mail|inbox)\b/i, files: ['apps/web/src/features/links/index.ts'] },
  { re: /\b(?:recipe|cook|oven|timer|shopping|meal)\b/i, files: ['apps/web/src/features/kitchen/index.ts'] },
  { re: /\b(?:run|walk|steps|exercise|workout|gym|sleep)\b/i, files: ['apps/web/src/features/body/index.ts'] },
  { re: /\b(?:3d|model|draw|design|build|make)\b/i, files: ['apps/web/src/features/studio/index.ts'] },
];

/** The draft for his words: pure, so a test can read it. */
export function draftFor(ask: string, now = Date.now()): SelfDraft {
  const task = taskOf(ask);
  const slug = slugOf(task);
  const home = HOMES.find((h) => h.re.test(task));
  const files = [...(home?.files ?? [`apps/web/src/features/${slug}/index.ts`]), `packages/shared/src/catalogue/${slug}.ts`, `tests/${slug}.spec.mjs`].filter((f, i, a) => a.indexOf(f) === i).slice(0, 4);
  const plan =
    `You asked me to ${task}, and I can’t yet. I would add it as ${home ? 'a new way in on the screen that already does the nearest thing' : 'a new ability of its own'}: ` +
    `first how I recognise the request in your words, then how it works using only your own data and public sources (nothing that costs money, no new key), ` +
    `then the one sentence I answer with, and I would show you the result before anything goes live.`;
  const test = `tests/${slug}.spec.mjs: opens it, says “${task.length > 60 ? `${task.slice(0, 60)}…` : task}” and checks the answer; it fails on today’s code, so I know the change is what made it pass.`;
  return { id: `d${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`, ask: ask.trim(), plan, files, test, at: now, state: 'draft' };
}

export function loadDrafts(): SelfDraft[] {
  try {
    const v = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '[]') as SelfDraft[];
    return Array.isArray(v) ? v.filter((d) => d && typeof d.id === 'string' && typeof d.plan === 'string') : [];
  } catch {
    return [];
  }
}
export function saveDrafts(list: SelfDraft[]): void {
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(list.slice(-MAX_DRAFTS)));
  } catch {
    /* kept for this visit only */
  }
  for (const f of listeners) f();
}
const listeners = new Set<() => void>();
/** Called when the list changes (the Workshop repaints its card). */
export const onDrafts = (f: () => void): (() => void) => (listeners.add(f), () => listeners.delete(f));

/** Draft his words as a job and keep it (the same words twice are one job). Returns the draft. */
export function draftJob(ask: string): SelfDraft {
  const list = loadDrafts();
  const same = list.find((d) => d.ask.toLowerCase() === ask.trim().toLowerCase() && d.state === 'draft');
  if (same) return same;
  const d = draftFor(ask);
  saveDrafts([...list, d]);
  return d;
}

/** What SHIP IT puts in the chat: the plan, the files and the test, as the request for the self-edit. */
export function requestOf(d: SelfDraft): string {
  return `Make this change to yourself: ${taskOf(d.ask)}. ${d.plan} Files I would touch (a first guess): ${d.files.join(', ')}. The test to add: ${d.test}`;
}
