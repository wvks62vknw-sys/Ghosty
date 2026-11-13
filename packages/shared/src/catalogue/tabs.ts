/**
 * [tabs] The words for every feature that became a screen of its own (BRIEF-TABS; OWNER-ISSUES 119, his words: "can't we add
 * tabs for everything we have like all the tabs we already have"): the seventh area, LIFE, its hub and its eight screens (the
 * money, body, kitchen, people, work, creative, outside and home packs), the LEARNING pack and the coach on LEARN, the
 * converter, the documents and the house on MAKE, and his social self on ME — each screen, its card on its hub, and the
 * deck's lines for it (a deck line that does what an entry already says is that entry: `same`). The chat's phrases and the
 * packs' actions keep their own words (catalogue/packs*.ts, restb.ts, restd.ts, reste.ts, social.ts): a screen is the
 * second door to the same things.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const TABS_WORDS: Record<string, CatValue> = {
  // ---- the LIFE area (its hub: the eight everyday screens as cards)
  'screen:area-life': {
    name: 'The LIFE area', line: 'You can tap LIFE for the everyday: money, body, kitchen, people, work, creative, outside and home.',
    more: 'Eight screens, one for each of the everyday packs, each card with its own reading: what is due, the timers running, the people you told me about. The chat still opens each of them by its own words.',
    say: ['(tap Life)'], scene: ['money', 'out'], cat: 'do', since: SINCE,
  },

  // ---- the screens the sheets became (each its card on its hub is the same entry: below)
  'screen:money': {
    name: 'Money: your statements, read', line: 'You can paste a bank statement and I sort it by plain rules and keep the month in your brain.',
    more: 'Its CSV, or the text copied out of its PDF: no AI sees it, not even the shop names, and there is no bank access of any kind. The month comes back as a card with the top five categories and what changed. The rest of money is asked in the chat: what you spent this week, fuel prices, a trip budget, subscriptions.',
    say: ['Paste a statement', 'How much did I spend this month?'], scene: ['money'], cat: 'do', needs: ['statement'], since: SINCE,
  },
  'screen:body': {
    name: 'Body: reps, runs and breathing', line: 'You can have your squats counted by the camera, a run coached by the GPS, a breath paced, a stretch timed and water kept.',
    more: 'The camera’s model runs on the phone and nothing leaves it; a run sends my brain only the distance, the time and the splits, never a position. Your Apple Health export is read here. The camera and the GPS start only when you press START, and stop when you leave the page.',
    say: ['Count my squats', 'Start a run', 'Breathe with me'], scene: ['phone'], cat: 'do', needs: ['camera', 'location'], since: SINCE,
  },
  'screen:kitchen': {
    name: 'Kitchen: timers, lists, meals', line: 'You can run several named timers at once, keep the shopping list and plan the week’s meals.',
    more: 'The timers ring on this phone with a sound and a buzz, and carry on after a reload. The shopping list and the meal plan are kept in my brain, so the chat and Telegram see the same list. Ask me what to cook from what is in the fridge, or to change an oven temperature.',
    say: ['Timer 8 minutes for the pasta', 'Shopping list', 'Fan 180 in conventional?'], scene: ['phone', 'making'], cat: 'do', since: SINCE,
  },
  'screen:people': {
    name: 'People: the ones you told me', line: 'You can see everyone you have told me about, with birthdays, gift ideas and what you said, and plan something for a group.',
    more: 'I only know what you tell me, and I never look anyone up. A birthday comes in the Brief before the day. A group plan keeps who is coming, who is not and who has not answered.',
    say: ['Who’s who?', 'Gift ideas for Mum', 'Sam is my cousin'], scene: ['talking'], cat: 'know', since: SINCE,
  },
  'screen:work': {
    name: 'Work: to-do and interviews', line: 'You can keep your to-do list, practise an interview out loud and copy or share what I write for you.',
    more: 'Each interview question is asked aloud and your answer timed, by voice or typed, with a plain critique back from my brain’s code. A CV, a cover letter or an email comes as text to copy or share: nothing is sent for you. A pomodoro runs on the phone’s timers.',
    say: ['Interview practice for a barista job', 'Add to my to-do: send the invoice', 'Pomodoro'], scene: ['money', 'talking'], cat: 'do', since: SINCE,
  },
  'screen:creative': {
    name: 'Creative: songs, posters, beats', line: 'You can make a song the phone plays, a poster, a birthday card, a comic strip, a logo, a palette and a beat.',
    more: 'Each is laid out and drawn on this phone, and saved to your own downloads when you tap to save it. The song and the drum pads play through the phone’s own sound, started by your tap. Nothing is sent anywhere.',
    say: ['Make me a beat', 'Make a poster for the car boot sale', 'What should I draw?'], scene: ['making'], cat: 'build', since: SINCE,
  },
  'screen:outside': {
    name: 'Outside: walks, toilets, parking', line: 'You can find a safer walk, the nearest toilets, cash or parking, where you parked, the way when you’re lost, and split a fare.',
    more: 'A walk is scored against the police’s street reports, with the routes drawn small. Where you are is asked only when you tap to use it, sent once with that one question and kept nowhere. If you ever feel unsafe, call 999.',
    say: ['Toilets near me', 'I parked on Cannon Street', 'I’m lost'], scene: ['out'], cat: 'watch', needs: ['location'], since: SINCE,
  },
  'screen:homeadmin': {
    name: 'Home: bins, bills and meters', line: 'You can see what is due at home, your bin days, your bills, a meter’s reading and each room’s things.',
    more: 'Tell me a bin day or photograph a bill and I keep it in my brain; the photo is read on this phone first. What is due comes in date order, and the Brief says it before the day. A meter reading shows the usage since the last one.',
    say: ['When are the bins?', 'What’s due this month?', 'Read my meter'], scene: ['money', 'morning'], cat: 'do', since: SINCE,
  },
  'screen:learning': {
    name: 'Learning: words, typing, maths', line: 'You can learn words in eight languages, review cards, draw, type, write by hand, read faster, drill maths and keep a streak.',
    more: 'Each page works on the phone, and the words are said in the phone’s own voice for that language where it has one. Memory, maths and spelling drills count towards your streaks, and first aid is there in plain steps from the NHS’s published guidance. A plan says what to practise next.',
    say: ['Ten words in Spanish', 'Maths drill', 'My streaks'], scene: ['school'], cat: 'learn', since: SINCE,
  },
  'screen:coach': {
    name: 'The coach: music and typing', line: 'You can tune a guitar, take ten lessons each for guitar, piano and voice, test your typing and keep a drawing a day.',
    more: 'The microphone hears whether the right notes came in order and on the click, worked out in code on the phone. What a microphone cannot judge is said on the screen. Nothing leaves the phone and nothing is recorded to keep.',
    say: ['Teach me guitar', 'Tune my guitar', 'Typing test'], scene: ['school', 'playing'], cat: 'learn', needs: ['mic'], since: SINCE,
  },
  'screen:social': {
    name: 'Social: your own accounts', line: 'You can see every post waiting for your APPROVE, what went out today, your linked accounts and who made me.',
    more: 'Bluesky, Mastodon, Discord and your Telegram channel, each linked once with an app password or a token of your own. Every post, follow and unfollow is a draft first, with APPROVE, EDIT and NO, and goes nowhere without your APPROVE. A draft is gone after 24 hours.',
    say: ['Post that to Bluesky', 'What’s waiting for my approve?', 'Who made you?'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  // (the converter and the documents had their words as MAKE's cards: their screens are the same entries)
  'screen:convert': { same: 'hub:convert' },
  'screen:docs': { same: 'hub:docs' },
  'screen:sheets': { same: 'hub:sheets' },
  'screen:slides': { same: 'hub:slides' },
  'screen:workspace': { same: 'hub:workspace' },
  'screen:house': {
    name: 'House: your smart home', line: 'You can see your house as Home Assistant has it, room by room, and switch a light, set the heating or close a blind.',
    more: 'Through your own free Home Assistant box, linked once with its address and a token in SYSTEM, KEYS. Locks, alarms, garage doors and gates, and any switch you mark, ask your confirm on every tap and never act on a schedule. Everything I do there is in WHY.',
    say: ['The house', 'Turn off the lounge light'], scene: ['phone', 'watching'], cat: 'do', since: SINCE,
  },
  // ---- the Me sheet's row for it
  'me:social': { same: 'screen:social' },

  // ---- their cards on their hubs (each opens its screen)
  'hub:money': { same: 'screen:money' }, 'hub:body': { same: 'screen:body' }, 'hub:kitchen': { same: 'screen:kitchen' }, 'hub:people': { same: 'screen:people' },
  'hub:work': { same: 'screen:work' }, 'hub:creative': { same: 'screen:creative' }, 'hub:outside': { same: 'screen:outside' }, 'hub:homeadmin': { same: 'screen:homeadmin' },
  'hub:learning': { same: 'screen:learning' }, 'hub:coach': { same: 'screen:coach' }, 'hub:social': { same: 'screen:social' }, 'hub:house': { same: 'screen:house' },
  // (the Me hub's own: its screens were there with nothing on their cards)
  'hub:memory': { same: 'screen:memory' }, 'hub:settings': { same: 'screen:settings' }, 'hub:system': { same: 'screen:system' },
  'hub:links': { same: 'screen:links' },

  // ---- the deck's lines for them (Every screen's YOU CAN): each is what an entry already says
  'deck:money:paste-a-statement-the-month-in': { same: 'phrase:statement' },
  'deck:money:how-much-did-i-spend-this': { same: 'act:money:week' },
  'deck:money:where-is-the-cheapest-petrol-near': { same: 'act:money:fuel' },
  'deck:body:count-your-squats-with-the-camera': { same: 'act:body:reps' },
  'deck:body:start-a-run': { same: 'act:body:run' },
  'deck:body:breathe-with-me': { same: 'act:body:breathe' },
  'deck:kitchen:the-shopping-list-ticked-off-as': { same: 'act:kitchen:shop' },
  'deck:kitchen:fan-180-in-a-conventional-oven': { same: 'act:kitchen:oven' },
  'deck:kitchen:what-can-i-cook-with-eggs': { same: 'act:kitchen:fridge' },
  'deck:people:whos-who-birthdays-and-what-you': { same: 'act:people:who' },
  'deck:people:gift-ideas-for-mum': { same: 'act:people:gift' },
  'deck:people:any-birthdays-this-month': { same: 'act:people:coming' },
  'deck:work:your-to-do-list-kept-in': { same: 'act:work:todo' },
  'deck:work:interview-practice-for-a-barista-job': { same: 'act:work:interview' },
  'deck:work:write-a-cover-letter-for-a': { same: 'act:work:cover' },
  'deck:creative:drum-pads-tap-along-with-a': { same: 'act:creative:beat' },
  'deck:creative:what-should-i-draw-today': { same: 'act:creative:prompt' },
  'deck:creative:a-poster-for-the-car-boot': { same: 'act:creative:poster' },
  'deck:outside:a-safer-walk-scored-on-street': { same: 'act:outside:safewalk' },
  'deck:outside:toilets-near-me': { same: 'act:outside:toilets' },
  'deck:outside:where-did-i-park': { same: 'act:outside:parked' },
  'deck:homeadmin:what-is-due-at-home-in': { same: 'act:homeadmin:due' },
  'deck:homeadmin:when-are-the-bins': { same: 'act:homeadmin:bins' },
  'deck:homeadmin:whats-due-this-month': { same: 'act:homeadmin:due' },
  'deck:learning:ten-words-a-day-in-eight': { same: 'act:learning:words' },
  'deck:learning:ten-words-in-spanish': { same: 'act:learning:words' },
  'deck:learning:a-quick-maths-drill': { same: 'act:learning:maths' },
  'deck:coach:tune-your-guitar-by-the-microphone': { same: 'phrase:tuner' },
  'deck:coach:teach-me-guitar': { same: 'phrase:coach' },
  'deck:coach:typing-test': { same: 'phrase:skill' },
  'deck:social:posts-waiting-for-your-approve': { same: 'act:social:draft' },
  'deck:social:whats-on-bluesky': { same: 'act:social:read' },
  'deck:social:who-made-you': { same: 'phrase:origin' },
  'deck:convert:pictures-pdfs-word-tables-and-sound': { same: 'hub:convert' },
  'deck:convert:convert-this-to-pdf': { same: 'hub:convert' },
  'deck:convert:3-5-miles-in-km': { same: 'phrase:units' },
  'deck:docs:your-documents-kept-on-this-phone': { same: 'hub:docs' },
  'deck:docs:write-a-letter-to-my-landlord': { same: 'hub:docs' },
  'deck:docs:translate-my-letter-into-urdu': { same: 'hub:docs' },
  'deck:sheets:your-spreadsheets-kept-on-this-phone': { same: 'hub:sheets' },
  'deck:sheets:start-a-household-budget': { same: 'hub:sheets' },
  'deck:sheets:open-an-excel-file': { same: 'hub:sheets' },
  'deck:slides:your-decks-kept-on-this-phone': { same: 'hub:slides' },
  'deck:slides:make-slides-from-a-report': { same: 'hub:slides' },
  'deck:slides:open-a-powerpoint-file': { same: 'hub:slides' },
  'deck:workspace:your-pages-kept-on-this-phone': { same: 'hub:workspace' },
  'deck:workspace:start-a-project-a-board-notes': { same: 'hub:workspace' },
  'deck:workspace:what-is-due-this-week-in': { same: 'hub:workspace' },
  'deck:house:lights-heating-and-blinds-room-by': { same: 'screen:house' },
  'deck:house:is-the-back-door-open': { same: 'phrase:house' },
  'deck:house:whats-the-temperature-in-the-kitchen': { same: 'phrase:house' },
};
