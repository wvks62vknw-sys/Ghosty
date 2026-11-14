/**
 * MANY WORDINGS, ONE MEANING, on the phone (FINAL ROUND, the voice lane; packages/shared/src/meanings.ts). session.ts asks this
 * only after every table had his words as he said them and none took them, so nothing that already worked changes:
 *   - a meaning another table does ("log a pint" → "I drank a pint of water"): that table answers its canonical words, and the
 *     chat shows what HE said;
 *   - a screen ("show me the map"): opened, and said in a line;
 *   - the radio ("put some tunes on", "play music"): his last station, else his first favourite, else the Radio screen to pick
 *     one; "kill the music" stops it;
 *   - two fair meanings ("play something"): one short question, both as keys, nothing done until he taps one;
 *   - an ask only the brain can answer ("is it gonna chuck it down"): nothing here; session.ts sends his words with the one-line
 *     note of the meaning read (`meaningNote`).
 */
import { isTwo, meaningOf, meantNote, type Meant } from '../../../../packages/shared/src/meanings';
import { perform } from '../shell/launcher';
import { answer, localTurn } from './local';
import { favourites, lastPlayed, player, playStation, stopAudio } from './media';
import { chat } from './session';

/** What a key under a two-way question says for him: words the table reads to exactly that meaning. */
const KEY_WORDS: Record<string, string> = {
  radio: 'play the radio',
  games: 'open the arcade',
  'board games': 'play a board game',
  lens: 'open the lens',
  map: 'open the map',
};
const keyWords = (m: Meant): string => m.say ?? m.brain ?? KEY_WORDS[m.id] ?? m.id;

/** (`who`: whose voice this turn was, as the phone judged it: a person he introduced keeps their own station names, voice.s2) */
type Opts = { voice?: boolean; private?: boolean; who?: import('./voiceknown').Label };

/** His words answered by their meaning, here: true when done (or asked), false to leave them to the brain as before. */
export async function meaningTurn(text: string, opts: Opts = {}): Promise<boolean> {
  const m = meaningOf(text);
  if (!m) return false;
  if (isTwo(m)) return answer(text, m.q, { kind: 'can', go: m.two.map((x) => ({ id: `meaning:${x.id}`, ask: -1, label: x.key, send: keyWords(x) })) }, opts);
  if (m.say) {
    const n = chat.get().entries.length;
    if (!(await localTurn(m.say, opts))) return false;
    // the chat shows what he said, never the canonical words the table was given
    chat.set((s) => ({ entries: s.entries.map((e, i) => (i >= n && e.kind === 'user' && e.text === m.say ? { ...e, text } : e)) }));
    return true;
  }
  // [voice.c1] his own names for his stations
  // [voice.s2] a person he introduced keeps their own names: "my morning station" in Sam's voice is Sam's
  const person = opts.who && typeof opts.who === 'object' ? opts.who.name : '';
  const key = (label: string) => (person ? `${person.toLowerCase()}:${label}` : label);
  const whose = person ? `${person}’s` : 'your';
  if (m.act === 'radio-name' && m.label) {
    const now = player.get().now;
    if (!now || (player.get().state !== 'playing' && player.get().state !== 'loading')) return answer(text, `Nothing’s playing to call your ${m.label} station. Put a station on, then say it again.`, { kind: 'can', go: [{ id: 'screen:radio', ask: -1, label: 'Open the radio', open: 'radio' }] }, opts);
    favourites.name(now, key(m.label));
    return answer(text, `Saved: ${now.name} is ${whose} ${m.label} station. Say “put on my ${m.label} station” any time.`, { kind: 'can' }, opts);
  }
  if (m.act === 'radio-named' && m.label) {
    const s = favourites.byName(key(m.label)) ?? (person ? favourites.byName(m.label) : null);
    // (no station by that name: left to the radio's own words and the brain, as before)
    if (!s) return false;
    const ok = await playStation(s);
    return answer(text, ok ? `Playing ${s.name}, ${s.label === key(m.label) ? whose : person ? 'the' : 'your'} ${m.label} station.` : `${s.name} needs a tap first: open Radio and tap PLAY.`, { kind: 'can', go: [{ id: 'screen:radio', ask: -1, label: 'Open the radio', open: 'radio' }] }, opts);
  }
  if (m.act === 'radio-stop') {
    const on = player.get().state === 'playing' || player.get().state === 'loading';
    if (on) stopAudio();
    return answer(text, on ? 'Radio off.' : 'Nothing’s playing.', { kind: 'can' }, opts);
  }
  if (m.act === 'radio') {
    const s = lastPlayed() ?? favourites.list()[0] ?? null;
    if (!s) {
      perform({ open: 'radio' });
      return answer(text, 'No station yet: pick one and I’ll play it, and remember it for next time.', { kind: 'can', go: [{ id: 'screen:radio', ask: -1, label: 'Open the radio', open: 'radio' }] }, opts);
    }
    const ok = await playStation(s);
    return answer(text, ok ? `Playing ${s.name}.` : `${s.name} needs a tap first: open Radio and tap PLAY.`, { kind: 'can', go: [{ id: 'screen:radio', ask: -1, label: 'Open the radio', open: 'radio' }] }, opts);
  }
  if (m.open) {
    perform({ open: m.open, ...(m.panel ? { panel: m.panel } : {}) });
    return answer(text, m.line ?? 'Opened.', { kind: 'can' }, opts);
  }
  return false;
}

/** The brain's one-line note of the meaning read, for an ask only it can answer ('' otherwise). */
export function meaningNote(text: string): string {
  const m = meaningOf(text);
  return m && !isTwo(m) ? meantNote(m) : '';
}
