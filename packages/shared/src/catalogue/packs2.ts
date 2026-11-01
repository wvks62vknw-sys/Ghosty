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
  // ---------------------------------------------------------------- WORK
  'tool:work': { same: 'act:work:cv' },
  'act:work:cv': {
    name: 'Build your CV from your facts', line: 'You can tell me about your work, studies and skills, or paste your old CV, and I lay out a plain CV from it.',
    more: 'Every line is one you gave me: nothing is invented, and I say what is missing. It opens to copy or share. Kept in your brain only; "clear my CV" wipes it.',
    say: ['I worked at Tesco as a shelf stacker from 2019 to 2022', 'Show my CV'], scene: ['money', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'Show my CV' },
  },
  'act:work:cover': {
    name: 'A cover letter for a job', line: 'You can paste a job ad and I write a cover letter from the facts in your CV, and say what the ad asks that you have not told me.',
    more: 'Matched one by one to what you gave me, so it never claims what you did not say. The gaps are listed. It opens to copy; nothing is sent.',
    say: ['Write a cover letter for this job (paste the ad)'], scene: ['money', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'Write a cover letter for this job: ', send: false },
  },
  'act:work:ad': {
    name: 'Check a job ad for scams', line: 'You can paste a job ad and I pull out the pay, what it asks for and anything that looks like a scam.',
    more: 'I look for fees to start, WhatsApp-only contact, free email addresses, early requests for your passport or bank details, and pay that is too good. A guide, not a guarantee.',
    say: ['Is this job ad real? (paste it)'], scene: ['money', 'watching'], cat: 'watch', since: SINCE,
    go: { ask: 'Check this job ad: ', send: false },
  },
  'act:work:interview': {
    name: 'Practise an interview out loud', line: 'I can ask you the questions for a job one at a time, time your answer, and tell you plainly how it went.',
    more: 'Questions for the kind of job, from a plain list of common ones. You answer by voice or typing; I time it and look at the length, the specifics and the filler words.',
    say: ['Interview practice for a shop job'], scene: ['money', 'phone'], cat: 'do', needs: ['mic'], since: SINCE,
    go: { run: 'open_work', args: { what: 'interview' } }, tryText: 'Opens interview practice',
  },
  'phrase:interview': { same: 'act:work:interview' },
  'act:work:critique': {
    name: 'A plain critique of your answer', line: 'You can give me an interview answer and how long it took, and I tell you what works and what to fix.',
    more: 'By its words and its time: length, numbers and names, whether it has a situation, an action and a result, and filler like "um" and "you know". A rough guide, not a verdict.',
    say: ['How was my answer? (say it, with the seconds it took)'], scene: ['money'], cat: 'do', since: SINCE,
    go: { ask: 'How was this answer? ', send: false },
  },
  'act:work:meeting': {
    name: 'Sum up your meeting notes', line: 'You can paste meeting notes, or speak them, and I list the decisions, the actions, who has them and what is still open.',
    more: 'Only what the notes say. Your own actions can go straight onto your to-do list. The summary opens to copy or share.',
    say: ['Sum up my meeting notes (paste them)'], scene: ['money', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'Sum up these meeting notes: ', send: false },
  },
  'act:work:todo': {
    name: 'A to-do from a long message', line: 'You can give me a long ramble of jobs and I turn it into a to-do list with the deadlines picked out.',
    more: 'One job a line, urgent ones marked, "by Friday" kept as a date. Tick things off by saying so. The Brief says what is due today.',
    say: ['Add to my to-do: send the invoice by Friday, book the van, ring the landlord'], scene: ['money', 'morning'], cat: 'do', since: SINCE,
    go: { ask: 'Add to my to-do: ', send: false },
  },
  'act:work:email': {
    name: 'An email in your voice', line: 'You can tell me what an email is for and I draft it in your voice: leave, running late, a chaser, a thank-you.',
    more: 'Plain wording for the purpose, your own details added as you gave them, and your greeting and sign-off if you shared how you write. It opens in your mail app on your tap; I never send it.',
    say: ['An email to my manager asking for Friday off'], scene: ['money', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'An email to my manager asking for ', send: false },
  },
  'act:work:hours': {
    name: 'Log your hours for a timesheet', line: 'You can tell me the hours you worked and I keep a timesheet: each day, the week’s total and any overtime.',
    more: 'Say "worked Monday 9 to 5 with a 30 minute break". Tell me your contract hours and your rate and I work out the overtime and the pay before tax. I assume no break unless you say one.',
    say: ['Worked Monday 9 to 5 with a 30 minute break', 'What are my hours this week?'], scene: ['money'], cat: 'do', since: SINCE,
    go: { ask: 'Worked ', send: false },
  },
  'act:work:pay': {
    name: 'Your pay after tax', line: 'You can tell me a pay, like £30,000 a year or £15 an hour, and I work out what you take home after tax and NI.',
    more: 'UK income tax and National Insurance on England, Wales and Northern Ireland bands, with a pension or student loan if you say so. A first estimate that lists what it assumed; your payslip is the truth.',
    say: ['What is £30,000 a year after tax?', '£15.50 an hour for 37.5 hours a week'], scene: ['money'], cat: 'do', since: SINCE,
  },
  'act:work:pomodoro': {
    name: 'A pomodoro with your timers', line: 'You can ask for a pomodoro and I set focus and break timers on your phone, one after another.',
    more: 'Twenty-five minutes of focus, five of rest, four rounds, then a long break; or say your own like "focus 50 with 10 break". They ring while Ghosty is open. I count how many you have started today.',
    say: ['Start a pomodoro', 'Pomodoro 2 rounds, 50 minutes with a 10 minute break'], scene: ['money', 'phone'], cat: 'do', since: SINCE,
    go: { ask: 'Start a pomodoro', send: false },
  },
  'phrase:pomodoro': { same: 'act:work:pomodoro' },
  'act:work:said': {
    name: 'What you said you would do', line: 'I can list what you told me you would do: your to-do jobs, the reminders you set and the promises in your notes.',
    more: 'Only from your own notes and reminders, each with where it came from. Name someone and I show only what is about them.',
    say: ['What did I say I’d do?'], scene: ['money', 'morning'], cat: 'do', since: SINCE,
  },
  'act:work:words': {
    name: 'Word count and reading level', line: 'You can paste a text and I count the words and tell you how hard it is to read and how long it takes.',
    more: 'Words, sentences, a reading ease score and a school grade, the time to read it and to say it, and which sentence to split. Done by formula on a rough syllable count.',
    say: ['How many words is this, and how hard is it to read?'], scene: ['money', 'making'], cat: 'do', since: SINCE,
    go: { ask: 'Word count and reading level for this: ', send: false },
  },
  'act:work:rota': {
    name: 'Keep your shift rota', line: 'You can type your shifts and I keep them, tell you when you are working, and show today’s and tomorrow’s in the Brief.',
    more: 'Say "Mon 9-5, Tue off, Wed 12-8" for this week, or "next week: …". I read 9-5 as 09:00 to 17:00 and say so. "Clear my rota" removes it.',
    say: ['My rota: Mon 9-5, Tue off, Wed 12-8', 'When am I working this week?'], scene: ['money', 'morning'], cat: 'do', since: SINCE,
    go: { ask: 'When am I working this week?' },
  },
};
