/**
 * HIS VOICE KNOWN, ON THE PHONE (BRIEF-VOICE-KNOWN 3, 4; OWNER-ISSUES 131 (7), 152): on every spoken turn the phone scores the
 * sound of what was said (voice.ts `takeSound`) against the voices it knows (voiceprint.ts, voicestore.ts), shows the answer on
 * the talk bar (features/core/voicetag.ts) and tells the brain the label and nothing else (`ClientContext.voice`: 'owner',
 * 'unknown' or the name of a person he introduced; never a number). It is a COURTESY, never a lock: it never opens anything, an
 * unknown voice changes nothing the confirm tap already guards, and "not sure" is "a voice I don't know" (it fails closed).
 *
 * WARY WHEN IT IS NOT HIM: with a voice I don't know the phone holds the turn and asks "A voice I don't know. Go on?" — GO ON
 * sends it (still labelled unknown: the brain says nothing private and asks who it is), NOT NOW drops it; one tap on "It's fine
 * for an hour" stops the asking for an hour (said, and kept only across that hour, in this tab's session storage: it is a time,
 * not a voice). The panic phrase and a plain "stop" are never held (session.ts runs them before this).
 *
 * WITH THE VOICE MODEL on the phone (assistant/speakermodel.ts, a pack he fetched on his tap) the sound is embedded and judged by
 * speakerjudge.ts; without it, by the phone's own features as before. Either way the answer is the same three labels.
 *
 * Nothing here sends anything: the sound lives in memory until it is scored, the numbers stay in IndexedDB (voicestore.ts).
 */
import { createStore } from '../core/store';
import { sound, takeSound } from './voice';
import { embed } from './speakermodel';
import { features, judgeBest, keepUp, RATE, type Known, type Voiced } from './voiceprint';
import { knownVoices, saveMine } from './voicestore';

/** What the brain is told about who spoke (packages/shared/src/awareness.ts `ClientContext.voice`). */
/** ('unsure': a voice heard and not sure of; held and treated as unknown on the phone, and said to the brain as "not sure".) */
export type Label = 'owner' | 'unknown' | 'unsure' | { name: string };

export interface Heard {
  label: Label;
  /** The tag's words on the bar. */
  words: string;
  /** For the checks and the console only. */
  why?: string;
  /** False when the phone heard a voice it could not be sure of (it is then labelled unknown, and "not sure" to the brain). */
  sure?: boolean;
  /** [voice.u5] Why it was not sure, in a word: two voices it knows both claimed it, too little voice for the noise, or close to one. */
  because?: 'two' | 'noisy' | 'close';
}

/** [voice.u5] The reason it was not sure, in plain words (the talk bar and "do you know it's me?" say it). */
export const BECAUSE: Record<NonNullable<Heard['because']>, string> = {
  two: 'Two voices I know sound alike in that',
  noisy: 'Too much noise around your voice',
  close: 'Close to a voice I know, not close enough',
};

export interface Spoke {
  /** Who it was, or null (nothing shown: no voice enrolled, or no sound to judge). */
  heard: Heard | null;
  /** The turn held for a tap, and what was said. */
  held: { text: string } | null;
  /** When the tag was shown (it fades after a while). */
  at: number;
}

export const speaker = createStore<Spoke>({ heard: null, held: null, at: 0 });
/** The grace's end changes: the bar repaints. */
export const grace = createStore({ until: 0 });

const GRACE_KEY = 'ghosty.voicegrace';
const HOUR = 3_600_000;
/** The tag stays this long after a turn (a held turn's stays until it is answered). */
export const TAG_MS = 45_000;

let known: (Known & { at: number })[] = [];
let loaded: Promise<void> | null = null;

/** Read the voices again (after an enrolment, a deletion or an UNDO) and tell voice.ts whether to keep the sound. */
export async function refresh(): Promise<Known[]> {
  known = await knownVoices();
  sound.wanted = known.length > 0;
  if (!known.length) speaker.set({ heard: null, held: null, at: 0 });
  return known;
}
loaded = refresh().then(() => undefined);
void loaded;

export const haveVoices = (): boolean => known.length > 0;

/** The measured speed of the last score, for the speed check: ms from the recording's end to the answer. */
/** `via`: 'model' when the voice model judged, 'features' when the phone's own sound features did (the model not on the phone). */
export const lastScore = { ms: -1, kind: '', why: '', via: '', d: 0 };

/** Is the hour's grace on? */
export function graceOn(now = Date.now()): boolean {
  return graceUntil(now) > now;
}
function graceUntil(now: number): number {
  try {
    const t = Number(sessionStorage.getItem(GRACE_KEY));
    return Number.isFinite(t) && t > now ? t : 0;
  } catch {
    return grace.get().until > now ? grace.get().until : 0;
  }
}
/** "It's fine for an hour": no asking until then (a turn held at this moment goes on: he said it is fine). */
export function giveGrace(now = Date.now()): void {
  const until = now + HOUR;
  try {
    sessionStorage.setItem(GRACE_KEY, String(until));
  } catch {
    /* kept in memory below */
  }
  grace.set({ until });
  if (speaker.get().held) goOnNow();
}
/** ASK AGAIN: the grace ends now. */
export function endGrace(): void {
  try {
    sessionStorage.removeItem(GRACE_KEY);
  } catch {
    /* nothing kept */
  }
  grace.set({ until: 0 });
}
export const graceEnds = (now = Date.now()): number => graceUntil(now);

/** The words on the bar for a person he introduced: their name in capitals, a kept length. */
const nameWords = (name: string) => name.toUpperCase();

/** Score what was just said. Null when no voice is enrolled or there was no sound to judge (then nothing is shown or held). */
export async function hear(snd: ReturnType<typeof takeSound>): Promise<Heard | null> {
  await loaded;
  if (!known.length) return null;
  const pcm = snd ? await snd.pcm : null;
  // a spoken turn with voices known and no sound to judge (the room alone, an ear that gives none): nothing is shown or held, and
  // the MY VOICE mark says so (DEGRADED) rather than calling every such turn a stranger
  if (!pcm) {
    Object.assign(lastScore, { ms: -1, kind: 'nosound', why: '', via: '' });
    return null;
  }
  const v: Voiced = features(pcm);
  // under MIN_VOICED of voice (a one-word command) is too little to judge: no tag, nothing held, the turn goes unlabelled as a typed one would
  if (!v.profile) {
    Object.assign(lastScore, { ms: Math.round(performance.now() - snd!.at), kind: 'short', why: '', via: '' });
    return null;
  }
  // the voice model's numbers for what was said, when the model is on the phone (else null, and the phone's own features judge)
  v.emb = await embed(pcm);
  const r = judgeBest(known, v);
  lastScore.via = r.via;
  lastScore.d = Math.round(r.d * 1000) / 1000;
  lastScore.ms = Math.round(performance.now() - snd!.at);
  lastScore.kind = r.who.kind;
  lastScore.why = r.who.kind === 'unknown' ? r.who.why : '';
  // [voice.u5] why it was not sure: two voices claimed it; or little voice in a long recording (the room louder than the voice); or just close
  const because: Heard['because'] = r.who.kind === 'unknown' && r.who.why === 'unsure' ? (r.who.two ? 'two' : v.secs < 0.35 * (pcm.length / RATE) ? 'noisy' : 'close') : undefined;
  const heard: Heard =
    r.who.kind === 'owner' ? { label: 'owner', words: 'YOU', sure: true } : r.who.kind === 'person' ? { label: { name: r.who.name }, words: nameWords(r.who.name), sure: true } : r.who.why === 'unsure' ? { label: 'unknown', words: 'NOT SURE WHO', why: r.who.why, sure: false, because } : { label: 'unknown', words: "A VOICE I DON'T KNOW", why: r.who.why, sure: true };
  speaker.set({ heard, held: null, at: Date.now() });
  if (heard.label !== 'unknown') last = { label: heard.label as 'owner' | { name: string }, at: Date.now() };
  // [voice.u4] a turn that was clearly him (judged by the phone's own features) refreshes his print a little, kept on this phone
  if (heard.label === 'owner' && r.via === 'features' && v.profile) void keepUpMine(v.profile);
  return heard;
}

/** [voice.u4] Refresh his own print from a turn that was clearly him (voiceprint.ts keepUp says whether, and how far). */
async function keepUpMine(profile: number[]): Promise<void> {
  const me = known.find((k) => k.me);
  if (!me) return;
  const next = keepUp(me.print, profile, new Date().toISOString().slice(0, 10));
  if (!next) return;
  await saveMine(next, me.at).catch(() => undefined);
  me.print = next;
}

/** A typed turn, or the end of the tag's time: nothing shown. */
export function clearTag(): void {
  if (speaker.get().heard && !speaker.get().held) speaker.set({ heard: null, held: null, at: 0 });
}

/** Hold a turn for a tap: the bar asks. `go` sends it, as the unknown voice it was. */
let goOn: (() => void) | null = null;
export function hold(text: string, go: () => void): void {
  goOn = go;
  speaker.set({ held: { text }, at: Date.now() });
}
/** GO ON: the held turn is sent. */
export function goOnNow(): void {
  const g = goOn;
  goOn = null;
  speaker.set({ held: null });
  g?.();
}
/** NOT NOW: the held turn is dropped, and nothing was sent. */
export function notNow(): void {
  goOn = null;
  speaker.set({ held: null });
}

/** The label a turn's context carries (voice.ts's boolean becomes it for a spoken turn that was judged); not sure is said so. */
export const labelOf = (h: Heard | null): Label | undefined => (h && h.label === 'unknown' && h.sure === false ? 'unsure' : h?.label);

/** The last voice the phone knew (his, or a person he introduced), and when: a typed turn tells the brain (heardNote). */
let last: { label: 'owner' | { name: string }; at: number } | null = null;
const HALF_HOUR = 30 * 60_000;

/**
 * WHAT THE PHONE KNOWS OF VOICES, for the brain on every app turn (FINAL ROUND, the voice lane; his "the actual chat says he has
 * no way of recognising me"): his own voice taught to this phone or not, and on a typed turn whose voice it last knew, within
 * half an hour, in whole minutes. Never a score; never a lock.
 */
export function heardNote(now = Date.now()): { taught: boolean; last?: 'owner' | { name: string }; mins?: number } {
  const taught = known.some((k) => k.me);
  if (!last || now - last.at > HALF_HOUR) return { taught };
  return { taught, last: last.label, mins: Math.max(0, Math.round((now - last.at) / 60_000)) };
}

/**
 * "Do you know it's me?", "who's talking?": answered from the tag, truly, with no model (assistant/local.ts `speaker`). `spoken`:
 * this turn was said aloud (its tag is the one on the bar now).
 */
export function whoWords(spoken: boolean, now = Date.now()): string {
  const taught = known.some((k) => k.me);
  if (!taught) return 'I don’t know your voice yet. Teach me in Settings, under My voice: you read three sentences, and it stays on this phone. Even then it’s a courtesy, never a lock.';
  const h = spoken ? speaker.get().heard : null;
  const via = lastScore.via === 'model' ? ' (the voice pack judged it)' : '';
  if (spoken && h) {
    if (h.label === 'owner') return `Yes: that’s your voice. I recognised it on this phone, and I’m sure${via}. It never opens anything on its own: it’s a courtesy, never a lock.`;
    if (typeof h.label === 'object') return `That sounds like ${h.label.name}, whom you introduced${via}.`;
    return h.sure === false ? `I’m not sure. ${BECAUSE[h.because ?? 'close']}. ${h.because === 'noisy' ? 'Somewhere quieter, say a whole sentence and I’ll try again.' : 'Say a whole sentence and I’ll try again.'}` : 'No: that’s a voice I don’t know. I won’t say anything private until I know who it is.';
  }
  if (spoken) return 'I know your voice on this phone, but that was too short to judge. Say a whole sentence and I’ll tell you.';
  const n = heardNote(now);
  const ago = n.mins == null ? '' : n.mins < 1 ? 'just now' : `${n.mins} minute${n.mins === 1 ? '' : 's'} ago`;
  if (n.last === 'owner') return `You typed that, so I heard no voice. I know yours on this phone: the last voice I heard, ${ago}, was you.`;
  if (n.last) return `You typed that, so I heard no voice. The last one I heard, ${ago}, was ${n.last.name}.`;
  return 'You typed that, so I heard no voice. I know yours on this phone: speak to me and I’ll say whether it’s you.';
}

// for the checks and the console (window.__ghosty.voiceknown, set in main.ts)
export const probe = { speaker, grace, lastScore, graceOn, heardNote, whoWords, known: () => known.map((k) => ({ id: k.id, name: k.name, me: k.me, floor: k.print.floor })) };
