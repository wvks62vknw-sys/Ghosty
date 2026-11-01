/**
 * The catalogue's words for THE PEOPLE, WORK AND CREATIVE PACKS (BRIEF-PACKS-2): each action of a pack's one tool is an
 * ability of its own (`act:<pack>:<action>`, from the tool's action enum), and the phone's phrases for them (`phrase:<id>`).
 * Rules: packages/shared/src/catalogue.ts `wordProblems`. Joined with packs.ts in catalogue/brain.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const PACK2_WORDS: Record<string, CatValue> = {
  // ---------------------------------------------------------------- PEOPLE
  'tool:people': { same: 'act:people:who' },
  'act:people:birthday': {
    name: 'Remember a birthday', line: 'You can tell me a birthday, like "Dad’s birthday is 14 March", and I remind you a week before and on the day.',
    more: 'Kept in your brain, with one line in your Memory. The reminders are in your Agenda at 9am. Give the year, or say "turns 40", and I say how old they are turning.',
    say: ['Dad’s birthday is 14 March', 'Whose birthdays are coming up?'], scene: ['morning', 'talking'], cat: 'do', since: SINCE,
    go: { ask: 'Dad’s birthday is ', send: false },
  },
  'act:people:date': {
    name: 'Remember a date that matters', line: 'You can tell me a date, like an anniversary, and I remind you a week before and on the day.',
    more: 'Say "our anniversary is 12 June" and it comes round every year. A one-off, like "Mum’s retirement do is 5 December", is reminded once. Kept in your brain only.',
    say: ['Our anniversary is 12 June', 'What dates have I told you?'], scene: ['morning', 'talking'], cat: 'do', since: SINCE,
    go: { ask: 'Our anniversary is ', send: false },
  },
  'act:people:gift': {
    name: 'Gift ideas from what you said', line: 'I can suggest gifts for someone from what you have told me they like, with a rough price for each.',
    more: 'Only your own notes about them: if you have not said what they like, I give safe choices and ask. Prices are rough UK guides, not looked up. Add a budget like "under £30".',
    say: ['Gift ideas for Dad under £30', 'What should I get Sam?'], scene: ['talking', 'making'], cat: 'do', since: SINCE,
  },
  'act:people:note': {
    name: 'Keep what you say about someone', line: 'You can tell me about someone, like "Sam loves fishing", and I keep it for gifts, messages and your Memory.',
    more: 'Only people you tell me about, and only what you say. It is one line per person in your Memory, which you can edit or forget there. I never look anyone up.',
    say: ['Sam loves fishing', 'My cousin Ali is moving to Leeds'], scene: ['talking'], cat: 'do', since: SINCE,
    go: { ask: 'Sam loves ', send: false },
  },
  'act:people:who': {
    name: 'Who is who in your life', line: 'I can tell you who someone is to you and what you last said about them, or list everyone you told me about.',
    more: 'It is only what you have told me: how you know them, their birthday, your notes. A name you never gave me gets "I don’t have anyone called that", never a search.',
    say: ['Who is Sam?', 'Who’s who?'], scene: ['talking', 'phone'], cat: 'do', since: SINCE,
    go: { run: 'open_people', args: { what: 'who' } }, tryText: 'Opens your people',
  },
  'phrase:people': { same: 'act:people:who' },
  'act:people:call': {
    name: 'Remind you to call someone', line: 'You can say "remind me to call Dad on Sunday" and I set a reminder with their name on it.',
    more: 'A day, a time, or both: "tomorrow at 6", "Friday evening". With no time I use 6pm and say so. The reminder is in your Agenda; nothing is ever sent or dialled for you.',
    say: ['Remind me to call Dad on Sunday', 'Text Ali tomorrow at 6'], scene: ['talking', 'morning'], cat: 'do', since: SINCE,
    go: { ask: 'Remind me to call ', send: false },
  },
  'act:people:thanks': {
    name: 'Write a thank-you note', line: 'I can write a thank-you note for a gift, a favour or a lovely evening, and shape it to how you write.',
    more: 'It is shown to you first and never sent. Add one detail of your own, like what you will use it for, and it reads like you. Notes for an interview are short and formal.',
    say: ['A thank-you note to Auntie Jo for the jumper'], scene: ['talking', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'A thank-you note to ', send: false },
  },
  'act:people:message': {
    name: 'A message in your voice', line: 'I can draft a message for a birthday, a sorry, a good luck or a hard day, in the way you write.',
    more: 'It copies the shape of messages you shared, such as how long, how you open and sign off. With none, it is plain and friendly. Shown first, never sent. Ask "another" for a new wording.',
    say: ['A birthday message for Sam', 'Help me say sorry to Dee'], scene: ['talking', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'A birthday message for ', send: false },
  },
  'act:people:card': {
    name: 'The words for a card', line: 'I can write the words inside a card for any occasion: warm, funny, short or formal.',
    more: 'Our own words, never copied from anyone’s verses. Give the name, the age and who it is from, and they are put in. Shown for you to copy; nothing is sent.',
    say: ['Card words for Dad’s 70th, funny'], scene: ['talking', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'Card words for ', send: false },
  },
  'act:people:plan': {
    name: 'Sort out a group plan', line: 'You can tell me a plan and who said yes, and I keep track of who is in, out or maybe.',
    more: 'Say "pub on Friday at 8 at the Crown, asked Ali, Sam and Jo", then "Jo’s in, Sam can’t make it". I add up the answers and say who I am waiting on. I message nobody.',
    say: ['Plan: pub on Friday at 8 at the Crown', 'Jo’s in, Sam can’t make it'], scene: ['talking'], cat: 'do', since: SINCE,
    go: { run: 'open_people', args: { what: 'plan' } }, tryText: 'Opens your group plan',
  },
  'act:people:contact': {
    name: 'Keep a phone number or address', line: 'You can tell me someone’s number, email or address and ask me for it later.',
    more: 'Kept in your brain only, never sent anywhere. Say "Sam’s number is 07700 900123", then ask "what’s Sam’s number?". "Forget Sam’s number" removes it.',
    say: ['Sam’s number is 07700 900123', 'What’s Sam’s address?'], scene: ['talking'], cat: 'do', since: SINCE,
    go: { ask: 'What’s Sam’s number?', send: false },
  },
  'act:people:cars': {
    name: 'Your people’s cars', line: 'I can list the cars of the people you introduced, with their plates and when the MOT and tax are due.',
    more: 'It reads the cars you named for the guardian, such as "my dad’s car is …". Only your people, only what you told me and the public MOT and tax record. Nothing is looked up about whoever keeps the car.',
    say: ['What cars do my people have?'], scene: ['talking', 'watching'], cat: 'do', since: SINCE,
  },
  'act:people:coming': {
    name: 'What is coming up', line: 'I can tell you which birthdays, dates, plans and calls to make are coming in the next few weeks.',
    more: 'From what you told me. The Brief also shows a birthday in the week ahead. Ask for further ahead with "the next 60 days".',
    say: ['What’s coming up?', 'Any birthdays this month?'], scene: ['morning', 'talking'], cat: 'do', since: SINCE,
  },
  'act:people:forget': {
    name: 'Forget a person or a detail', line: 'You can tell me to forget someone, or just their birthday, number or address, and I drop it at once.',
    more: 'Their notes, birthday reminders, details and the line in your Memory all go. The Memory tab’s own forget works too. Nothing about them is kept anywhere else.',
    say: ['Forget Sam’s number', 'Forget Dee completely'], scene: ['talking'], cat: 'do', since: SINCE,
    go: { ask: 'Forget ', send: false },
  },
  'act:people:voice': {
    name: 'Learn how you write', line: 'You can paste a few of your own messages and I match how you write in the drafts I make you.',
    more: 'I only note the shape: how long, how you open and sign off, whether you use emoji or full stops. Up to twelve are kept in your brain, and "forget my writing samples" clears them.',
    say: ['This is how I text: hey mate, hope your week is going well, cheers'], scene: ['talking', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'This is how I text: ', send: false },
  },
};
