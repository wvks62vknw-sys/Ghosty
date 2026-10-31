/**
 * The first run (OWNER-ISSUES 68c): on a fresh phone, three things I can do, said once in the chat (and so on Home's line
 * under the reactor), then never again — this phone remembers it said them (`ghosty.firstrun`). Chosen from the registry,
 * never written here: the first of the app's own abilities in SEE, KNOW and PLAY (abilities/registry.ts), each with GO,
 * and a way to everything else (ABILITIES).
 *
 * Under a test runner nothing is said unless the spec asks for it (`window.__ghostyFirstRun`), as the boot cinematic does:
 * every spec starts on a fresh phone, and the line would sit in every one of their conversations.
 */
import type { AbilityCat } from '../../../../packages/shared/src/abilities';
import { DIRECT } from '../assistant/local';
import { chat } from '../assistant/session';
import { DECK } from '../shell/deckcopy';
import { appAbilities } from './registry';

const KEY = 'ghosty.firstrun';
const CATS: AbilityCat[] = ['see', 'know', 'play'];

/** Say the three, once; true when it did. */
export function firstRun(): boolean {
  try {
    if (localStorage.getItem(KEY)) return false;
  } catch {
    return false; // nothing can be remembered on this phone: better never than every open
  }
  if (navigator.webdriver && !(globalThis as { __ghostyFirstRun?: boolean }).__ghostyFirstRun) return false;
  const all = appAbilities();
  const three = CATS.map((c) => all.find((a) => a.cat === c && 'open' in a.go && a.id.startsWith('s:'))).filter((a) => !!a);
  if (three.length < CATS.length) return false;
  try {
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  const text = [
    'Three things I can do for you, to start:',
    ...three.map((a) => `• ${a.line}`),
    'There’s a lot more. Ask me “can you …?” any time, or see everything in Abilities.',
  ].join('\n');
  const go = [
    ...three.map((a) => ({ id: a.id, ask: -1, label: DECK[a.id.slice(2)]?.name ?? 'Go there' })),
    { id: '', ask: -1, label: 'Everything I can do', open: 'abilities' },
  ];
  chat.set((s) => ({ entries: [...s.entries, { kind: 'assistant' as const, text, at: Date.now(), model: DIRECT, local: { kind: 'first' as const, go } }].slice(-120) }));
  // said where he lands: Home's line under the reactor, as a reply is
  chat.set({ live: text });
  return true;
}
