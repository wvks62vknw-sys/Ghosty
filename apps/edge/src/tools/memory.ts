/** Long-term memory about the owner. Facts are added to every conversation. */
import type { MemoryFact, MemorySource } from '../../../../packages/shared/src/protocol';
import { clearPatterns, stashFacts, stashForgottenFacts } from '../memories';
import { loadPlaces } from '../places';
import { arg, type Tool } from './types';
import { recallSearch } from '../recall';
import { viaWord } from '../../../../packages/shared/src/recall';

export const MEMORY_KEY = 'memory';

export async function loadMemory(storage: DurableObjectStorage): Promise<MemoryFact[]> {
  return (await storage.get<MemoryFact[]>(MEMORY_KEY)) ?? [];
}

const MAX_FACTS = 500;

/**
 * Save a fact with where it came from (memories.ts shows it): no `src` means the owner typed it
 * in the Memory tab (the /memory route). Over 500, the oldest unlocked fact goes — never a locked one.
 */
export async function addFact(storage: DurableObjectStorage, text: string, src?: MemorySource): Promise<MemoryFact | null> {
  const t = text.trim().slice(0, 400);
  if (!t) return null;
  const facts = await loadMemory(storage);
  if (facts.some((f) => f.text.toLowerCase() === t.toLowerCase())) return null;
  // (dated when its source says: the nightly reflection's facts by the reflection's own time)
  const at = src?.at ?? Date.now();
  const fact: MemoryFact = { id: crypto.randomUUID().slice(0, 8), text: t, at, src: src ?? { kind: 'owner', at } };
  facts.push(fact);
  while (facts.length > MAX_FACTS) {
    const i = facts.findIndex((f) => !f.locked);
    facts.splice(i < 0 ? 0 : i, 1);
  }
  await storage.put(MEMORY_KEY, facts);
  return fact;
}

export const memoryTools: Tool[] = [
  {
    name: 'remember',
    // ([recall] condensed by 145 characters, with forget's, forget_everything's and list_memory's, to pay for `recall`'s spec inside the
    //  plain turn's tool-description ceiling, 6,500: prompt.test and document.test)
    description: 'Save a lasting fact, in one short sentence, that the OWNER told you; never one read on the web.',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    risk: 'auto',
    async run(a, ctx) {
      // Saved during a chat: the Memory tab shows the owner's message from this moment as its source.
      const f = await addFact(ctx.storage, arg.str(a, 'text'), { kind: 'chat', at: Date.now() });
      return f ? `Saved (id ${f.id}).` : 'Already known.';
    },
  },
  {
    name: 'forget',
    description: 'Drop a fact by its id or words.',
    parameters: { type: 'object', properties: { id_or_text: { type: 'string' } }, required: ['id_or_text'] },
    risk: 'auto',
    async run(a, ctx) {
      const q = arg.str(a, 'id_or_text').trim().toLowerCase();
      const facts = await loadMemory(ctx.storage);
      const byId = facts.some((f) => f.id === q);
      // A word or two letters would match most of what he told me: ask for more of the words instead.
      if (!byId && q.length < 3) return 'Nothing removed: say more of the words of the memory to forget (or its id), so only that one goes.';
      const match = (f: MemoryFact) => (byId ? f.id === q : f.text.toLowerCase().includes(q));
      // A locked memory is only forgotten by the owner's own FORGET in the Memory tab.
      const locked = facts.filter((f) => match(f) && f.locked).length;
      const gone = facts.filter((f) => match(f) && !f.locked);
      // Kept a day for UNDO, like every other way of forgetting (Memory → RECENTLY FORGOTTEN).
      await stashForgottenFacts(ctx.storage, gone, q);
      await ctx.storage.put(MEMORY_KEY, facts.filter((f) => !gone.includes(f)));
      return `Removed ${gone.length} fact(s).${locked ? ` ${locked} locked one(s) kept: the owner can forget a locked memory in the Memory tab.` : ''}${gone.length ? ' For a day, Memory → RECENTLY FORGOTTEN can bring it back.' : ''}`;
    },
  },
  {
    name: 'forget_everything',
    description: 'Erase every fact; only when he asks.',
    parameters: { type: 'object', properties: {} },
    risk: 'confirm',
    async run(_a, ctx) {
      const facts = await loadMemory(ctx.storage);
      // Locked facts stay (the owner locked them in the Memory tab); the rest are kept a day for UNDO.
      const kept = facts.filter((f) => f.locked);
      const gone = facts.filter((f) => !f.locked);
      await stashFacts(ctx.storage, gone);
      await ctx.storage.put(MEMORY_KEY, kept);
      // What was noticed from the conversation goes too.
      await clearPatterns(ctx.storage);
      return `Erased ${gone.length} fact(s).${kept.length ? ` Kept ${kept.length} locked one(s): the owner can forget those in the Memory tab.` : ''} For a day, the Memory tab's RECENTLY FORGOTTEN can bring them back.`;
    },
  },
  {
    name: 'list_memory',
    description: 'List his facts, with ids.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    pure: true,
    async run(_a, ctx) {
      const facts = await loadMemory(ctx.storage);
      // His saved places (places.ts) are memories too: listed with the facts.
      const places = await loadPlaces(ctx.storage).catch(() => []);
      const lines = [...facts.map((f) => `${f.id}: ${f.text}`), ...places.map((p) => `place ${p.label}: ${p.address}`)];
      return lines.length ? lines.join('\n') : 'Nothing remembered yet.';
    },
  },
  {
    // [recall] BRIEF-DEPTH-MEMORY 2c: "what did I ask you about X?" over the 30 days of his turns, the app's and Telegram's alike
    name: 'recall',
    description: 'Find what he asked before ("what did I ask you about X"): day and channel.',
    parameters: { type: 'object', properties: { about: { type: 'string' } }, required: ['about'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const about = arg.str(a, 'about').trim();
      if (!about) return 'Say what to look for.';
      const tz = (await ctx.storage.get<{ tz?: string }>('owner:ctx').catch(() => null))?.tz || 'UTC';
      const hits = await recallSearch(ctx.storage, about, Date.now(), tz);
      if (!hits.length) return `Nothing like that in the last 30 days of our chats.`;
      return hits.slice(0, 3).map((h) => `${h.stamp} (${h.day}, ${viaWord(h.via)}): he asked “${h.q}”${h.a ? `; you said “${h.a}”` : ''}`).join('\n');
    },
  },
];
