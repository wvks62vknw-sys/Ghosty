/**
 * The catalogue's words for MEMORY AND RECALL (BRIEF-DEPTH-MEMORY): "what did I ask you about trains?", FIND over his own things
 * on the phone, the brain's recall of his turns, and a chase held for days. Joined into APP_WORDS (app.ts) and BRAIN_WORDS (brain.ts).
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-13';

export const RECALL_APP_WORDS: Record<string, CatValue> = {
  'phrase:recall': {
    name: 'What did I ask you', line: 'You can ask "what did I ask you about trains?" and I list the times you did, from this phone, even offline.',
    more: 'Every chat is indexed on this phone, never sent anywhere. Each time shows its day and where you asked, and a tap opens that chat. "Find garden in my things" looks through your documents, pages, decks and sheets too.',
    say: ['What did I ask you about trains?', 'When did I mention the boiler?', 'Find garden in my things'], scene: ['talking', 'phone'], cat: 'know',
    go: { ask: 'What did I ask you about ', send: false }, since: SINCE,
  },
  'phrase:chase': {
    name: 'Chase a reply for me', line: 'You can say "remind me to chase this if Sam doesn\'t reply by Thursday" and I check that morning.',
    more: 'On that day at 9 am I look in the mail account you linked for a reply. If one came I say so; if not I remind you, with a key that drafts a chase for your OK. With no mail linked it is a plain reminder.',
    say: ['Remind me to chase this if Sam doesn\'t reply by Thursday', 'What are you chasing?'], scene: ['talking', 'watching'], cat: 'watch',
    go: { ask: 'Remind me to chase this if ', send: false }, needs: ['brain'], since: SINCE,
  },
};

// [keep] the NEXT ROUND: a memory that keeps your word
export const KEEP_APP_WORDS: Record<string, CatValue> = {
  'phrase:keep': {
    name: 'Keeps your word for you', line: 'You can say "where\'s the spare key?", "what did I say I\'d do?" or "how was my week?" and I answer from your own words.',
    more: 'When you say you\'ll do something I remind you on the day, and "I did it" closes it. Tell me where you put things or why you chose them and ask later, even offline. On Sunday evening your week comes to your phone.',
    say: ['Where\'s the spare key?', 'What did I say I\'d do?', 'Why did I pick the canal flat?', 'How was my week?'], scene: ['talking', 'morning'], cat: 'know',
    go: { ask: 'What did I say I\'d do?', send: false }, since: '2026-11-14',
  },
  'panel:memory:YOUR WORD': {
    name: 'What you said you’d do', line: 'You can see what you said you’d do, where you put things and why you chose them, and tick each off.',
    more: 'Each promise has DONE, LATER and LET GO; places and reasons can be forgotten, with UNDO. Your week is at the bottom: what you asked about most, what you finished and what is still open.',
    say: ['What did I say I\'d do?', 'Show my promises'], scene: ['talking', 'morning'], cat: 'know', since: '2026-11-14',
  },
  'section:memory:word': { same: 'panel:memory:YOUR WORD' },
};

export const RECALL_BRAIN_WORDS: Record<string, CatValue> = {
  'tool:recall': {
    name: 'Find what you asked me', line: 'I can find what you asked me in the last 30 days, in the app or on Telegram, and say when.',
    more: 'I keep the gist of every chat for 30 days: your words and the first line of my answer. Asked about something, I list the matching times with their day and where. Forget one in its card and it is gone, with UNDO.',
    say: ['What did I ask you about trains?', 'When did I mention the boiler?'], scene: ['talking'], cat: 'know', since: SINCE,
  },
};
