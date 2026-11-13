/**
 * THE TALK BAR'S WORDS (BRIEF-QUALITY-CHAT 4): what the bar says about the microphone and the voice in every state, in words that
 * read without the animation. Pure (no screen, no sound): core/index.ts draws them and the spec reads this same file. One sentence
 * each, in Ghosty's voice.
 */

export type TalkState = 'idle' | 'listening' | 'quiet' | 'hearing' | 'thinking' | 'speaking' | 'cut' | 'refused' | 'ended';

/** How long a listen can hear nothing before it says it is still there. */
export const STILL_LISTENING_MS = 3000;

export const TALK_WORDS: Record<TalkState, string> = {
  idle: '',
  listening: 'I’m listening.',
  quiet: 'Go on, I’m still listening.',
  hearing: 'I can hear you.',
  thinking: 'Let me think about that.',
  speaking: 'Tap to stop me.',
  cut: 'You cut in; go on.',
  refused: '',
  ended: 'I’ve stopped listening. Tap the mic when you want me.',
};

/** The microphone refused: by the page's browser, and by the phone's own Settings (an iPhone's words for where to switch it on). */
export const MIC_BLOCKED = 'The microphone is off for me. In Settings, Safari, Microphone, choose Allow, then tap the mic.';
export const MIC_BROWSER = 'This browser won’t let me use the microphone. Type it instead.';
export const MIC_NONE = 'I can’t find a microphone on this phone. Type it instead.';
/** (voice.spec reads these words as they are) */
export const NO_SIGNAL = "No connection, so I can't hear you right now. Type it instead.";

/** The state the bar is in, from what the page knows. */
export function talkState(s: { voice: 'idle' | 'listening' | 'thinking' | 'speaking'; heard: boolean; quietFor: number; cut: boolean; refused: string; ended: boolean }): TalkState {
  if (s.refused) return 'refused';
  if (s.voice === 'speaking') return 'speaking';
  if (s.voice === 'listening') return s.heard ? 'hearing' : s.cut ? 'cut' : s.quietFor >= STILL_LISTENING_MS ? 'quiet' : 'listening';
  if (s.voice === 'thinking') return 'thinking';
  return s.ended ? 'ended' : 'idle';
}

/** "What can you do?", "what can you do here?", "what are you good at?": a question about Ghosty himself, answered with the rooms. */
export const whatCanAsked = (text: string): boolean =>
  /^(?:hey |ok |okay )?(?:ghosty,? )?(?:so )?(?:what (?:all )?(?:can|do) you do(?: (?:here|for me|for us))?|what are you (?:able to do|good at|for)|what (?:can|could) i (?:ask|say|do) (?:you|here)|what do you (?:know how to )?do)[\s?!.]*$/i.test(text.trim());

/** The answer when no room matches what he asked (a "can you …?" the table does not know), and the near miss: one sentence each, then the way on. */
export const CAN_NONE = 'I can’t do that yet. Shall I learn it?';
export const CAN_NEAR = (line: string): string => `Not quite. The nearest I’ve got: ${line} Shall I learn it properly?`;
