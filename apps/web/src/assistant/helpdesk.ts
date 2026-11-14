/**
 * THE HELP DESK (NEXT-ROUND consistency.s1, voice.s3), on the phone with no model:
 *   - "how do I paste a bank statement?", "where do I find my birthdays?": the screen it means (shell/sentence.ts, the same reading
 *     the jump bar uses), the exact taps to it (room → screen → panel), what it does in one line, a way to say it, and TRY IT;
 *   - "what can I say here?" on any screen but Home: that screen's three best wordings from the catalogue, read aloud when he spoke.
 * Words, places and wordings all come from the catalogue (generated from the code), so the desk can only point at what is there.
 */
import { CATALOGUE, isSame, type CatValue } from '../../../../packages/shared/src/catalogue';
import { screenForSentence } from '../shell/sentence';
import { roomOf } from '../shell/rooms';
import { DECK } from '../shell/deckcopy';
import { ui } from '../state/app';
import { askedFrom } from '../shell/awareness';
import { answer } from './local';

type Opts = { voice?: boolean; private?: boolean };

/** "how do I …", "how can I …", "where do I …", "where can I find …", "how to …". */
export const HOW_ASKED = /^(?:hey |ok |okay )?(?:ghosty,? )?(?:how (?:do|can|would|should) i|how to|where (?:do|can|would) i(?: go to| find)?|where'?s the place to)\s+(.{3,90}?)[\s?!.]*$/i;
/** "what can I say here?", "what do I say on this screen?", "what can I do on this screen?". */
export const SAY_HERE = /^(?:hey |ok |okay )?(?:ghosty,? )?(?:what (?:can|do|could|should) i (?:say|ask|do) (?:here|on this (?:screen|page))|what can i say)[\s?!.]*$/i;

const words = (v: CatValue | undefined) => {
  let w = v;
  for (let i = 0; i < 3 && w && isSame(w); i++) w = CATALOGUE[w.same];
  return w && !isSame(w) ? w : undefined;
};
const name = (screen: string) => DECK[screen]?.name ?? screen;
const sentence = (s: string) => s.replace(/^(?:You|I) can /, '').replace(/^./, (c) => c.toUpperCase());

/** The taps from Home to it, as he reads them: "Life → Money", "Me → Settings → ROUTINES". */
export function tapsTo(screen: string, panel?: string): string {
  const room = roomOf(screen);
  const r = room && room.key !== 'home' ? `${room.title.charAt(0)}${room.title.slice(1).toLowerCase()} → ` : '';
  return `${r}${name(screen)}${panel ? ` → ${panel}` : ''}`;
}

export async function helpTurn(text: string, opts: Opts = {}): Promise<boolean> {
  const t = text.trim();
  if (SAY_HERE.test(t)) {
    // (the screen he is on, or the one he asked from: the jump bar's "Or ask me" takes the question to Home)
    const tab = ui.get().tab === 'core' ? askedFrom() : ui.get().tab;
    if (!tab || tab === 'core' || tab.startsWith('area-')) return false; // (Home and the rooms keep the rooms' answer: assistant/local.ts)
    const own = Object.entries(CATALOGUE).filter(([id]) => id === `screen:${tab}` || id.startsWith(`panel:${tab}:`)).map(([, v]) => words(v)).filter((w): w is NonNullable<typeof w> => !!w);
    const say = [...new Set(own.flatMap((w) => w.say ?? []).filter((s) => !/^\(/.test(s)))].slice(0, 3);
    const reply = say.length ? `On ${name(tab)} you can say:\n${say.map((s) => `“${s}”`).join('\n')}` : `${name(tab)} has no words of its own yet: tap what you need, or ask me anything.`;
    return answer(t, reply, { kind: 'can', go: say.slice(0, 3).map((s, i) => ({ id: `say:${i}`, ask: -1, label: s.length > 28 ? `${s.slice(0, 27)}…` : s, send: s })) }, opts);
  }
  const m = HOW_ASKED.exec(t);
  if (!m) return false;
  const found = screenForSentence(`how do I ${m[1]}`, undefined, true);
  if (!found) return false; // (not found here: the brain answers it, as before)
  const w = words(CATALOGUE[found.panel ? `panel:${found.screen}:${found.panel}` : `screen:${found.screen}`]) ?? words(CATALOGUE[`screen:${found.screen}`]);
  const say = w?.say?.find((s) => !/^\(/.test(s));
  const reply = [`${tapsTo(found.screen, found.panel)}.`, w?.line ? sentence(w.line) : '', say ? `Or say “${say}”.` : ''].filter(Boolean).join('\n');
  return answer(t, reply, { kind: 'can', go: [{ id: `help:${found.screen}`, ask: -1, label: 'TRY IT', open: found.screen, ...(found.panel ? { panel: found.panel } : {}) }] }, opts);
}
