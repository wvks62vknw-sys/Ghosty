/**
 * Ghosty's own voices, made by the brain on Workers AI (apps/edge/src/speech.ts) and picked in
 * SETTINGS → VOICE (apps/web/src/features/settings/voice.ts). All free within Cloudflare's daily
 * Workers AI allowance (10,000 neurons, shared with the fallback brain): MeloTTS costs almost
 * nothing (~19 neurons a minute of speech); Deepgram's Aura voices sound far more natural but
 * cost per character (Aura 1 ~1.4 neurons a character, Aura 2 twice that), so the brain gives
 * them a daily share (`AURA_UNITS_PER_DAY`) and speaks with MeloTTS once it is used.
 */

export type BrainVoiceId = 'draco' | 'pandora' | 'helios' | 'athena' | 'melo';

export interface BrainVoice {
  id: BrainVoiceId;
  /** What the picker shows (plain words: no model names). */
  label: string;
  /** Workers AI model and speaker. */
  model: string;
  speaker?: string;
  /** Units of the daily Aura share a character costs (0: MeloTTS, outside the share). */
  cost: 0 | 1 | 2;
}

/** Most natural first: 'auto' means the first one, falling back down the list. */
export const BRAIN_VOICES: BrainVoice[] = [
  { id: 'draco', label: 'Draco — British man, most natural', model: '@cf/deepgram/aura-2-en', speaker: 'draco', cost: 2 },
  { id: 'pandora', label: 'Pandora — British woman, most natural', model: '@cf/deepgram/aura-2-en', speaker: 'pandora', cost: 2 },
  { id: 'helios', label: 'Helios — British man, natural, lasts twice as long each day', model: '@cf/deepgram/aura-1', speaker: 'helios', cost: 1 },
  { id: 'athena', label: 'Athena — British woman, natural, lasts twice as long each day', model: '@cf/deepgram/aura-1', speaker: 'athena', cost: 1 },
  { id: 'melo', label: 'Melo — plain voice, never runs out', model: '@cf/myshell-ai/melotts', cost: 0 },
];

export const AUTO_VOICE: BrainVoiceId = 'draco';

/** A voice asked for by name: one of the list, 'auto' (the most natural), anything else the plain voice. */
export function brainVoice(id: unknown): BrainVoice {
  const want = id === 'auto' ? AUTO_VOICE : id;
  return BRAIN_VOICES.find((v) => v.id === want) ?? BRAIN_VOICES.at(-1)!;
}

/**
 * The best of this phone's own voices for a British owner: an installed Enhanced or Premium
 * British voice (iOS: Settings › Accessibility › Spoken Content › Voices — "Daniel (Enhanced)",
 * "Serena (Premium)", "Jamie (Premium)") scores highest; novelty voices never win.
 */
export function phoneVoiceScore(v: { name: string; lang: string }): number {
  if (!/^en/i.test(v.lang)) return -1;
  let s = 20;
  const gb = /GB|en-gb/i.test(v.lang) || /UK|British/i.test(v.name);
  if (gb) s += 18;
  if (/Natural|Neural|Online/i.test(v.name)) s += 40;
  if (/Premium/i.test(v.name)) s += 38;
  if (/Enhanced|Siri/i.test(v.name)) s += 34;
  if (/Google UK English Male/i.test(v.name)) s += 30;
  if (/Daniel|Serena|Jamie|Kate|Arthur|Oliver|George|Ryan|Thomas|Stephanie|Martha/i.test(v.name) && gb) s += 22;
  if (/compact/i.test(v.name)) s -= 15;
  if (/Fred|Albert|Bad News|Bells|Boing|Cellos|Jester|Organ|Trinoids|Whisper|Zarvox|Bubbles|Junior|Ralph|Superstar|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley/i.test(v.name)) s -= 60;
  return s;
}

/** A natural-sounding British phone voice: Enhanced, Premium, Neural or Natural, and British. */
export const naturalBritish = (v: { name: string; lang: string }): boolean => /GB|en-gb/i.test(v.lang) && /Premium|Enhanced|Natural|Neural/i.test(v.name);
