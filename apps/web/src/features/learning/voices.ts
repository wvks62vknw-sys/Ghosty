/**
 * The phone's own voices for the eight languages (BRIEF-PACKS-3): which it has, and saying a word or a phrase in one. The
 * voices belong to the phone and nothing is sent anywhere; a language without a voice is said so, never faked.
 */
import { LANGS } from '../../../../../packages/shared/src/learning';

/** The voice-tag prefixes a platform may use for a language (Mandarin is "zh" or "cmn"). */
const PREFIXES: Record<string, string[]> = { zh: ['zh', 'cmn'], ar: ['ar'] };
const prefixesOf = (id: string) => PREFIXES[id] ?? [id];
const tagOf = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();

export function voicesNow(): SpeechSynthesisVoice[] {
  try {
    return speechSynthesis.getVoices() ?? [];
  } catch {
    return [];
  }
}
export function voiceFor(tag: string): SpeechSynthesisVoice | null {
  const all = voicesNow();
  const id = tag.slice(0, 2).toLowerCase();
  return all.find((v) => tagOf(v) === tag.toLowerCase()) ?? all.find((v) => prefixesOf(id).some((p) => tagOf(v).startsWith(p))) ?? null;
}

/** Says `text` in the language of `tag` (a BCP 47 tag like "es-ES"), after what is already being said when `queue`; false when the phone has no voice for it. */
export function sayIn(text: string, tag: string, rate = 0.9, queue = false): boolean {
  if (typeof speechSynthesis === 'undefined') return false;
  try {
    if (!queue) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(tag);
    if (v) u.voice = v;
    u.lang = v?.lang ?? tag;
    u.rate = rate;
    speechSynthesis.speak(u);
    return !!v;
  } catch {
    return false;
  }
}

/** Which of the eight the phone can say, and which it cannot (the list can be empty for a moment after the page opens). */
export function voiceReport(): { have: string[]; missing: string[]; none: boolean } {
  const all = voicesNow();
  if (!all.length) return { have: [], missing: LANGS.map((l) => l.name), none: true };
  const has = (l: (typeof LANGS)[number]) => all.some((v) => prefixesOf(l.id).some((p) => tagOf(v).startsWith(p)));
  return { have: LANGS.filter(has).map((l) => l.name), missing: LANGS.filter((l) => !has(l)).map((l) => l.name), none: false };
}

/** Calls `fn` when the phone's list of voices changes; returns the way to stop. */
export function onVoices(fn: () => void): () => void {
  try {
    speechSynthesis.addEventListener('voiceschanged', fn);
    return () => speechSynthesis.removeEventListener('voiceschanged', fn);
  } catch {
    return () => undefined;
  }
}

/** Stops whatever is being said. */
export function hush(): void {
  try {
    speechSynthesis.cancel();
  } catch {
    /* nothing was speaking */
  }
}
