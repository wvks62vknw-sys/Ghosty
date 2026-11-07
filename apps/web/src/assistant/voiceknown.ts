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
 * Nothing here sends anything: the sound lives in memory until it is scored, the numbers stay in IndexedDB (voicestore.ts).
 */
import { createStore } from '../core/store';
import { sound, takeSound } from './voice';
import { features, judge, type Known, type Voiced } from './voiceprint';
import { knownVoices } from './voicestore';

/** What the brain is told about who spoke (packages/shared/src/awareness.ts `ClientContext.voice`). */
export type Label = 'owner' | 'unknown' | { name: string };

export interface Heard {
  label: Label;
  /** The tag's words on the bar. */
  words: string;
  /** For the checks and the console only. */
  why?: string;
}

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
export const lastScore = { ms: -1, kind: '', why: '' };

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
    Object.assign(lastScore, { ms: -1, kind: 'nosound', why: '' });
    return null;
  }
  const v: Voiced = features(pcm);
  // under MIN_VOICED of voice (a one-word command) is too little to judge: no tag, nothing held, the turn goes unlabelled as a typed one would
  if (!v.profile) {
    Object.assign(lastScore, { ms: Math.round(performance.now() - snd!.at), kind: 'short', why: '' });
    return null;
  }
  const r = judge(known, v);
  lastScore.ms = Math.round(performance.now() - snd!.at);
  lastScore.kind = r.who.kind;
  lastScore.why = r.who.kind === 'unknown' ? r.who.why : '';
  const heard: Heard =
    r.who.kind === 'owner' ? { label: 'owner', words: 'YOU' } : r.who.kind === 'person' ? { label: { name: r.who.name }, words: nameWords(r.who.name) } : { label: 'unknown', words: "A VOICE I DON'T KNOW", why: r.who.why };
  speaker.set({ heard, held: null, at: Date.now() });
  return heard;
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

/** The label a turn's context carries (voice.ts's boolean becomes it for a spoken turn that was judged). */
export const labelOf = (h: Heard | null): Label | undefined => h?.label;

// for the checks and the console (window.__ghosty.voiceknown, set in main.ts)
export const probe = { speaker, grace, lastScore, graceOn, known: () => known.map((k) => ({ id: k.id, name: k.name, me: k.me, floor: k.print.floor })) };
