/**
 * THE CHAT'S WORDS FOR THE COACH (BRIEF-REST-B part 2): "teach me guitar", "tune my guitar", "am I in tune?", "coach me", "typing
 * test", "what should I draw?", "Spanish word of the day". Pure; assistant/phrases.ts LOCAL_ASKS reads it and assistant/restb.ts
 * opens the sheet. Words that belong to other things are left to them: "teach me Spanish" is the course builder's, so a language
 * is asked for by its words ("Spanish words", "French word of the day").
 */
import type { Instrument } from './notes';
import type { Teach } from './lessons';

export type CoachAsk =
  | { what: 'tuner'; instrument: Instrument }
  | { what: 'lessons'; instrument?: Teach }
  | { what: 'typing' }
  | { what: 'draw' }
  | { what: 'words'; language?: string }
  | { what: 'juggle' };

const STRINGS = /\b(guitar|bass|ukulele|uke|violin|fiddle)\b/;
const instrumentOf = (t: string): Instrument => {
  const m = STRINGS.exec(t)?.[1];
  return m === 'uke' ? 'ukulele' : m === 'fiddle' ? 'violin' : ((m as Instrument | undefined) ?? 'free');
};
const LANG = /\b(spanish|french|german|italian)\b/;

export function coachAsked(text: string): CoachAsk | null {
  const t = text.toLowerCase().replace(/[’']/g, "'").replace(/[.!?]+$/g, '').trim();
  if (!t || t.length > 120) return null;
  // juggling and tricks by camera: not in, and said so — except "can you juggle?", a question about what I can do, which the
  // catalogue answers ("Not yet": the abilities spec) and the coach leaves alone; "Can you tune my ukulele?" is still the tuner's
  if (/\bjuggl\w*\b|\b(?:learn|teach me|coach me (?:on|with)) (?:a |some )?(?:skateboard|bike|yo-?yo|football|basketball|parkour|dance|ball) tricks?\b/.test(t)) return /^(?:can|could|do|would|will|are) you\b/.test(t) ? null : { what: 'juggle' };
  // the tuner
  if (/^(?:am i|are we|is it|is this) in tune$/.test(t) || /\bin tune\?*$/.test(t) && /^(?:am i|is my \w+) in tune/.test(t)) return { what: 'tuner', instrument: instrumentOf(t) };
  if (/\b(?:tune|tuning|retune)\b.*\b(?:my|the|a)\s+(?:guitar|bass|ukulele|uke|violin|fiddle)\b/.test(t) || /\b(?:guitar|bass|ukulele|uke|violin|fiddle)\b.*\b(?:tuner|tuning)\b/.test(t)) return { what: 'tuner', instrument: instrumentOf(t) };
  if (/^(?:open |start |use |show )?(?:the |a |my )?(?:(?:guitar|bass|ukulele|uke|violin) )?tuner$/.test(t) || /^(?:tune|tuner|tune up)$/.test(t)) return { what: 'tuner', instrument: instrumentOf(t) };
  // typing
  if (/\b(?:typing (?:test|practice|practise|speed|lesson|lessons|game|trainer)|test my typing|how fast (?:do|can) i type|type faster|improve my typing|teach me to type)\b/.test(t)) return { what: 'typing' };
  // drawing
  if (/\b(?:drawing (?:prompt|practice|practise|challenge|lesson|of the day)|what (?:should|can|do) i draw|draw something|give me something to draw|teach me to draw|learn to draw|prompt to draw)\b/.test(t)) return { what: 'draw' };
  // ten words a day, in a language
  if (/\b(?:word of the day|words of the day|daily words|ten words|10 words|new words|vocab(?:ulary)? (?:practice|practise|of the day))\b/.test(t) || (LANG.test(t) && /\b(?:words|vocab|vocabulary|word of the day|flashcards?)\b/.test(t))) return { what: 'words', ...(LANG.exec(t) ? { language: LANG.exec(t)![1]! } : {}) };
  // lessons: an instrument, or the coach itself
  const learn = /\b(?:teach me|learn(?:ing)?|lessons?|practi[sc]e|help me (?:learn|play|sing)|coach me (?:on|with|in)|i want to (?:learn|play|sing))\b/.test(t);
  if (/\b(?:guitar|piano|keyboard|singing|sing|voice)\b/.test(t) && (learn || /\b(?:guitar|piano|keyboard|singing|voice) (?:lessons?|practice|practise|coach)\b/.test(t))) {
    return { what: 'lessons', instrument: /\b(?:piano|keyboard)\b/.test(t) ? 'piano' : /\b(?:singing|sing|voice)\b/.test(t) ? 'voice' : 'guitar' };
  }
  if (/^(?:coach me|be my coach|skills coach|open the coach|practice coach|instrument coach)$/.test(t)) return { what: 'lessons' };
  return null;
}
