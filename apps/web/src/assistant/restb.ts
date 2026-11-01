/**
 * THE CHAT'S WORDS FOR BATCH 8 PART B, on the phone with no model (the tables are assistant/phrases.ts LOCAL_ASKS; local.ts
 * writes the chat from what these return): the chess rating (gym/chessrate.ts) and, further down, the coach (coach/).
 */
import { loadBook, ratingAsked, ratingReply } from '../gym/chessrate';
import { coachAsked } from '../coach/ask';
import { dayNumber, dayOf, loadProgress, practiceWords, startInstrument } from '../coach/progress';
import { drawPrompt, languageOf } from '../coach/skills';
import type { PackReply } from './packs';

export { ratingAsked };

/** "what's my chess rating?": both ratings in words, read from this phone. */
export function chessRatingTurn(text: string): PackReply {
  return { said: text, reply: ratingReply(loadBook(), Date.now()), go: [{ id: 'chess', ask: -1, label: 'Open chess in the GYM', open: 'gym' }] };
}

const JUGGLE =
  'Juggling, and tricks you do with a ball or a board, are not in: a phone camera cannot follow things thrown through the air, or what is under your feet, well enough to mark them honestly, and I would rather say so than guess. What I can mark by camera is a squat, a push-up or a star jump (say "count my squats"), and by the microphone, notes, a strum, a held note, your typing and spoken words (say "coach me").';

/** The coach's words: the sheet opened (the tuner, the lessons, typing, the drawing prompt, the words of the day), or an honest no. */
export async function coachTurn(text: string): Promise<PackReply> {
  const ask = coachAsked(text);
  if (!ask) return { said: text, reply: 'Say "teach me guitar", "tune my guitar", "typing test", "what should I draw?" or "Spanish word of the day".' };
  if (ask.what === 'juggle') return { said: text, reply: JUGGLE };
  const { openCoach } = await import('../coach/sheet');
  const day = dayOf(Date.now());
  if (ask.what === 'tuner') {
    void openCoach('tuner', { instrument: ask.instrument === 'free' ? 'free' : ask.instrument });
    return { said: text, reply: `The tuner is open${ask.instrument === 'free' ? '' : ` for your ${ask.instrument}`}: press START, then pluck a string. It listens with this phone's microphone and shows the note and how many cents off it is. Nothing is recorded or sent, and it works with no signal.` };
  }
  if (ask.what === 'lessons') {
    const p = loadProgress();
    const inst = ask.instrument ?? startInstrument(p);
    void openCoach('lessons', { instrument: inst });
    return { said: text, reply: `${practiceWords(p, day, inst)} The lessons are open: each one has you play notes (or a strum, or a held note) to a click, and I listen with the microphone and tell you what came in right. They are our own, ten for each of guitar, piano and voice.` };
  }
  if (ask.what === 'typing') {
    void openCoach('typing');
    return { said: text, reply: 'The typing test is open: type the passage and I count your words a minute and your accuracy, and name the keys you miss, so the next passage leans on them.' };
  }
  if (ask.what === 'draw') {
    void openCoach('draw');
    return { said: text, reply: `Today's drawing prompt: ${drawPrompt(dayNumber(day)).text} Draw it on paper, take its picture in the sheet, and it goes beside the prompt. I do not mark drawings: that stays yours.` };
  }
  void openCoach('words', { language: ask.language ?? 'es' });
  return { said: text, reply: `Today's ten ${languageOf(ask.language ?? 'es').label} words are open: HEAR each one on this phone's voice, then SAY IT and I check what I heard.` };
}
