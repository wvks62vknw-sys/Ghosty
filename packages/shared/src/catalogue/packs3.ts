/**
 * The catalogue's words for THE OUTSIDE, HOME AND LEARNING PACKS (BRIEF-PACKS-3): each action of a pack's one tool is an
 * ability of its own (`act:<pack>:<action>`, from the tool's action enum), and the phone's phrases for them (`phrase:<id>`).
 * Rules: packages/shared/src/catalogue.ts `wordProblems`. Joined with packs2.ts in catalogue/brain.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const PACK3_WORDS: Record<string, CatValue> = {
  // ---------------------------------------------------------------- OUTSIDE
  'tool:outside': { same: 'act:outside:safewalk' },
  'phrase:outside': {
    name: 'Ask for the OUTSIDE sheet', line: 'You can say “toilets near me”, “where did I park?” or “I’m lost” and I open what you need, with no waiting.',
    more: 'These are answered on this phone with no model, and the sheet opens on the right page. For anything near you, tap USE WHERE I AM NOW once: the spot is used and not kept, and I never track you.',
    say: ['Toilets near me', 'Where did I park?', 'I’m lost'], scene: ['out'], cat: 'do', since: SINCE,
    go: { run: 'open_outside', args: { what: 'toilets' } }, tryText: 'Opens the OUTSIDE sheet',
  },
  'act:outside:note': {
    name: 'Keep a note about a place', line: 'You can tell me once, like “at New Street the front carriages are nearest my exit”, and I say it every time.',
    more: 'Notes about a station, a car park or a shop, kept in your brain only. I use them for which carriage and for parking, and I never add anything you did not say. Say “forget my notes about New Street” and they go.',
    say: ['At New Street the front carriages are nearest the exit I use', 'Cannon Hill car park: card only, free after 6'], scene: ['out', 'talking'], cat: 'do', since: SINCE,
    go: { ask: 'At New Street the front carriages are nearest the exit I use', send: false },
  },
  'act:outside:carriage': {
    name: 'Which carriage to stand for', line: 'I can tell you which carriage suits your exit at a station, from what you told me once.',
    more: 'Only your own notes: I can’t see today’s train, because National Rail’s formation data needs a registered feed I don’t have. So I never guess a carriage or how long the train is.',
    say: ['Which carriage at New Street?'], scene: ['out'], cat: 'do', since: SINCE,
  },
  'act:outside:parking': {
    name: 'Car parks near a place', line: 'I can find car parks near a place, free and cheap first, with the spaces and fees the map lists.',
    more: 'From OpenStreetMap, so it is volunteers’ notes: prices and rules are the sign’s, not ours. I add your own notes about a car park. Private and permit-only ones are left out.',
    say: ['Car parks near the Bullring', 'Free parking near home'], scene: ['out'], cat: 'do', since: SINCE,
  },
  'act:outside:safewalk': {
    name: 'A walk with fewer police reports', line: 'I can score a walk against police street reports near the path and offer a way round the busiest stretch.',
    more: 'It counts reports within 100 m of the route over the latest three months (police.uk data, two months behind). “Fewer reports” is not “safe”: it only counts what was reported. The free servers are asked once and the answer kept for the day.',
    say: ['A safer walk from the station to home', 'Walk from Digbeth to home, avoiding the dodgy bit'], scene: ['out', 'watching'], cat: 'do', since: SINCE,
    go: { run: 'open_outside', args: { what: 'safewalk' } }, tryText: 'Opens the walk page',
  },
  'act:outside:lasthome': {
    name: 'The last train or bus home', line: 'I can find the last train, tram or bus I can see from where you are to home, from the open timetables.',
    more: 'It asks the free Transitous journey planner for the latest way home tonight, with the operators’ live times where they publish them. Services can be missing or changed, so check the operator before you rely on it.',
    say: ['Last train home from Birmingham New Street'], scene: ['out'], cat: 'do', since: SINCE,
  },
  'act:outside:open': {
    name: 'What is open near you', line: 'I can list what is open right now near a place, with when it closes, from the hours on the map.',
    more: 'I read the opening hours on OpenStreetMap in code. Hours I can’t read are counted, not guessed, and bank-holiday hours can differ.',
    say: ['What’s open near the Bullring?', 'Pharmacy open now near home'], scene: ['out'], cat: 'do', since: SINCE,
  },
  'act:outside:toilets': {
    name: 'Public toilets near you', line: 'I can find public toilets near a place, with fees, step-free access and hours where the map says.',
    more: 'Volunteers’ notes on OpenStreetMap, so hours and fees can be out of date. Ones for customers only come last. For a place near you, tap USE WHERE I AM NOW once in the OUTSIDE sheet.',
    say: ['Toilets near New Street station'], scene: ['out'], cat: 'do', since: SINCE,
    go: { run: 'open_outside', args: { what: 'toilets' } }, tryText: 'Opens the nearby page',
  },
  'act:outside:cash': {
    name: 'Cash machines near you', line: 'I can find cash machines near a place, with who runs them and whether they may charge.',
    more: 'From OpenStreetMap, so whether a machine charges is the bank’s call, and one inside a shop follows the shop’s hours. If there is none, I say so.',
    say: ['Cash machine near the Bullring'], scene: ['out', 'money'], cat: 'do', since: SINCE,
  },
  'act:outside:refill': {
    name: 'Free drinking water near you', line: 'I can find a free drinking-water point near a place, and say if it fills a bottle.',
    more: 'From OpenStreetMap. Some points are switched off in winter and the map can’t say if today is one of those days. Many cafés will fill a bottle too, but I can’t see which.',
    say: ['Free water refill near the canal'], scene: ['out'], cat: 'do', since: SINCE,
  },
  'act:outside:rain': {
    name: 'The rain plan and a coat', line: 'I can tell you when rain is likely today and when to take a coat, for home or a place you name.',
    more: 'From Open-Meteo’s hourly forecast. It is a chance, not a promise, and I say the hour it is likeliest. Add a place, or I use your saved home.',
    say: ['Do I need a coat today?', 'Will it rain at the match?'], scene: ['morning', 'out'], cat: 'watch', since: SINCE,
  },
  'act:outside:split': {
    name: 'Split a fare, who owes whom', line: 'You can tell me a taxi or a bill and who shares it, and I say who owes whom, to the penny.',
    more: 'It works with one payer or several, and says which odd pennies fall on whom. It is only sums: nothing is paid or sent.',
    say: ['Taxi £48, I paid, between me, Sam and Jo', 'I paid £30, Sam paid £12, split 3 ways'], scene: ['out', 'money'], cat: 'do', since: SINCE,
  },
  'act:outside:halfway': {
    name: 'Meet halfway by travel time', line: 'I can find the point halfway between two places by travel time, and cafés or pubs near it.',
    more: 'It uses the route’s own timings by car, on foot or by bike, without traffic. An estimate: a different road or the traffic would move it. The route is drawn on the globe.',
    say: ['Meet halfway between home and Sam’s'], scene: ['out'], cat: 'do', since: SINCE,
  },
  'act:outside:pack': {
    name: 'Pack my bag for the day', line: 'I can list what to put in your bag for the day you describe, with the weather.',
    more: 'A starting list from your plan (the gym, work, the beach, a flight, a night out) and the forecast for home or a place you name. Add your own things.',
    say: ['Pack my bag for the gym and then work'], scene: ['morning', 'out'], cat: 'do', since: SINCE,
  },
  'act:outside:parked': {
    name: 'Remember where I parked', line: 'You can tell me where you parked and until when, and I remind you before the ticket runs out.',
    more: 'Say the street, or tap I PARKED HERE in the OUTSIDE sheet to keep the spot once. Add a rule like “free after 6”. Ask “where did I park?” any time. I keep the spot you gave, never your movements.',
    say: ['I parked on Cannon Street until 3pm', 'Where did I park?'], scene: ['out'], cat: 'do', since: SINCE,
    go: { ask: 'I parked on ', send: false },
  },
  'act:outside:lost': {
    name: 'Help when you are lost', line: 'I can show the nearest place you saved and the nearest station, and the way there, when you tap once.',
    more: 'Tap USE WHERE I AM NOW in the OUTSIDE sheet: the spot is used once and not kept, because I never see where you are on my own. If you feel unsafe, call 999.',
    say: ['I’m lost'], scene: ['out', 'watching'], cat: 'do', since: SINCE,
    go: { run: 'open_outside', args: { what: 'lost' } }, tryText: 'Opens the lost page',
  },
  'act:outside:queue': {
    name: 'Queue or go, from your notes', line: 'You can tell me how long a queue was, and later I say whether it is worth going, from your own notes.',
    more: 'Only your own notes, by place and time of day. I never guess from anywhere else, and I can’t see today’s queue. Say “forget all my queue notes” and they go.',
    say: ['The queue at the post office was 20 minutes', 'Is the queue at the post office worth it?'], scene: ['out'], cat: 'do', since: SINCE,
    go: { ask: 'The queue at the post office was 20 minutes', send: false },
  },
  // ---------------------------------------------------------------- HOME (the group is "homeadmin": "home" is the furniture finder)
  'tool:home': { same: 'act:homeadmin:due' },
  'phrase:homeadmin': {
    name: 'Bins, bills and what is due', line: 'You can say “when are the bins?” or “what’s due at home?” and I open the HOME sheet on that page, with no waiting.',
    more: 'These are answered on this phone with no model. The sheet reads from your brain: bin days, bills, renewals, services and what is due.',
    say: ['When are the bins?', 'What’s due at home?', 'My bills'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { run: 'open_homeadmin', args: { what: 'bins' } }, tryText: 'Opens the HOME sheet',
  },
  'act:homeadmin:bill': {
    name: 'Keep a bill from a photo', line: 'You can photograph a bill and I read the supplier, amount and due day, then remind you before it is due.',
    more: 'The text is read on your phone and my brain keeps the supplier, amount, due day and period. Text read off a photo can be wrong, so I say what I took from where. Nothing is paid and I never see your bank.',
    say: ['Here is my gas bill', 'Photograph a bill'], scene: ['money', 'camera'], cat: 'watch', since: SINCE,
    go: { run: 'open_homeadmin', args: { what: 'bills' } }, tryText: 'Opens the bills page',
  },
  'act:homeadmin:bills': {
    name: 'What bills are due', line: 'I can tell you which bills are next, what is due this month, or how much the gas was this year.',
    more: 'Only from the bills you showed me. I add up a kind of bill (gas, water, broadband) or one supplier for the year. Nothing is checked against a bank.',
    say: ['What bills are due?', 'How much was the gas this year?'], scene: ['money', 'morning'], cat: 'watch', since: SINCE,
  },
  'act:homeadmin:paid': {
    name: 'Mark a bill as paid', line: 'You can tell me you paid a bill and I stop reminding you, or take a wrong one away.',
    more: 'It is only your word: I don’t see your bank. “Paid British Gas” clears its reminder, and the UNDO on a bill’s card forgets the bill.',
    say: ['Paid British Gas'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'Paid ', send: false },
  },
  'act:homeadmin:warranty': {
    name: 'Warranties and when they end', line: 'You can photograph a receipt or tell me what you bought, and I remind you a month before its warranty ends.',
    more: 'If you don’t say how long, I use 12 months and say that it is a default. A receipt photo is read on your phone, so check the item and the date.',
    say: ['The TV, bought 3 March 2025, 2 year warranty', 'List my warranties'], scene: ['money', 'camera'], cat: 'watch', since: SINCE,
    go: { ask: 'The washing machine, bought ', send: false },
  },
  'act:homeadmin:manual': {
    name: 'The maker’s own manual page', line: 'You can give me a model number and I find the maker’s own manual page and save it as a link.',
    more: 'Only the maker’s own site, shown as the source. I never download or copy the manual, and I don’t use sites that copy manuals. The model number is on the rating plate.',
    say: ['Manual for Bosch dishwasher SMS24AW01G'], scene: ['money', 'camera'], cat: 'know', since: SINCE,
  },
  'act:homeadmin:renewals': {
    name: 'The family cars’ renewals', line: 'I can list your family cars’ MOT, tax and insurance dates, and remind you a month and a week before.',
    more: 'The MOT and tax months come from the cars you named and opened once, and nothing is looked up again. You tell me insurance dates, like “Dad’s car insurance renews on 3 March”. With only a month, I count from the 1st.',
    say: ['When are the cars’ renewals due?', 'Dad’s car insurance renews on 3 March'], scene: ['money', 'watching'], cat: 'watch', since: SINCE,
    go: { ask: 'When are the cars’ renewals due?' },
  },
  'act:homeadmin:bins': {
    name: 'Bin days and bin night', line: 'You can tell me your bin days once, and I say the night before which bin to put out.',
    more: 'Weekly, every other week from a day you give, or the dates your council printed (paste its page). Tell me when a collection moves, or that bank holidays slip it a day. I only know what you tell me.',
    say: ['Bins are Tuesday, recycling every other Tuesday', 'When are the bins?'], scene: ['morning', 'money'], cat: 'watch', since: SINCE,
    go: { run: 'open_homeadmin', args: { what: 'bins' } }, tryText: 'Opens the bins page',
  },
  'act:homeadmin:planning': {
    name: 'Planning applications near home', line: 'I can tell you about planning applications near your home, or point you to your council’s own pages.',
    more: 'From the national planning data where your council feeds it. It holds none yet, so I say so plainly and name your council. I also say which conservation area your home is in. It is about places, never about people.',
    say: ['Any planning applications near home?', 'Tell me about new ones within 300 metres'], scene: ['money', 'watching'], cat: 'watch', since: SINCE,
    needs: ['home'],
  },
  'act:homeadmin:meter': {
    name: 'Meter readings and usage', line: 'You can photograph a meter and I keep the reading, the day, and the usage since last time.',
    more: 'The dial is read on your phone, so I say what I took and you check it. A lower reading is not used, because the dial may have gone round. Add your price per unit and I give a rough cost. Say “forget the gas readings” and they go.',
    say: ['Electricity meter reads 12345', 'Take a meter reading'], scene: ['money', 'camera'], cat: 'watch', since: SINCE,
    go: { run: 'open_homeadmin', args: { what: 'meter' } }, tryText: 'Opens the meter page',
  },
  'act:homeadmin:rent': {
    name: 'The rent or mortgage day', line: 'You can tell me the day your rent or mortgage is due, and I remind you each month.',
    more: 'A reminder at 9am on the day, every month, and the Brief says it the day before. Kept in your brain; “forget the rent date” removes it.',
    say: ['Rent is due on the 1st, £750'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'Rent is due on the ', send: false },
  },
  'act:homeadmin:subs': {
    name: 'What you pay on repeat', line: 'I can tell you what repeats on your statements and your list, and the monthly total.',
    more: 'It joins the subscriptions found on the statements you added with the list you gave the money pack. An estimate: a price rise shows up late, and a missing statement shows nothing.',
    say: ['What am I paying for monthly?'], scene: ['money'], cat: 'watch', since: SINCE, needs: ['statement'],
  },
  'act:homeadmin:inventory': {
    name: 'A room by room home inventory', line: 'You can list what is in each room, with values, and I give you a CSV for your insurer.',
    more: 'Say the things, or photograph a room and confirm what the phone sees. Nothing is sent anywhere; the CSV is yours to copy or download in the HOME sheet.',
    say: ['In the living room: a 55 inch TV worth £400, 2 armchairs', 'Export my inventory for my insurer'], scene: ['money', 'camera'], cat: 'watch', since: SINCE,
    go: { run: 'open_homeadmin', args: { what: 'things' } }, tryText: 'Opens the rooms page',
  },
  'act:homeadmin:book': {
    name: 'The house’s address book', line: 'You can tell me the plumber’s, the landlord’s or the council’s number, and I keep them for the house.',
    more: 'Your entries only, kept in your brain. Nothing is looked up and nobody is contacted. Ask “who’s my plumber?” any time.',
    say: ['The plumber is Dave on 07700 900123', 'Who’s my landlord?'], scene: ['money', 'talking'], cat: 'watch', since: SINCE,
    go: { ask: 'The plumber is ', send: false },
  },
  'act:homeadmin:council': {
    name: 'Council tax band and register', line: 'I can keep your council tax band and your own note that you are on the electoral register, and show where to check.',
    more: 'The band is public: GOV.UK’s lookup takes your postcode, and I show you the link because I can’t fill its form. The register isn’t searchable online, so I note only your own registration, never anyone else’s.',
    say: ['My council tax band is C', 'I registered to vote on 3 September 2025'], scene: ['money'], cat: 'watch', since: SINCE,
    go: { ask: 'My council tax band is ', send: false },
  },
  'act:homeadmin:service': {
    name: 'Boiler and smoke alarm dates', line: 'You can tell me when the boiler service or smoke alarm test is due, and I remind you each year.',
    more: 'A month before and on the day, at 9am. Say “boiler serviced on 14 March” and I count a year on. Gas safety, chimney and electrical checks work the same.',
    say: ['Boiler service is due 14 March', 'Smoke alarms tested on 1 October'], scene: ['money', 'watching'], cat: 'watch', since: SINCE,
    go: { ask: 'Boiler service is due ', send: false },
  },
  'act:homeadmin:due': {
    name: 'What is due at home', line: 'I can list everything due at home soon: bills, bins, renewals, services, rent and warranties.',
    more: 'From what you have told me or shown me, in date order. The Brief shows the next few. Ask for further ahead with “the next 60 days”.',
    say: ['What’s due at home?', 'What do I need to do at home this month?'], scene: ['money', 'morning'], cat: 'watch', since: SINCE,
  },
  // ---------------------------------------------------------------- LEARNING (beside the LEARN tab's courses: practice, not a second tutor)
  'tool:learning': { same: 'act:learning:words' },
  'phrase:learning': {
    name: 'Ask for the LEARNING sheet', line: 'You can say “ten Spanish words”, “a typing test” or “maths drill” and I open it on that page, with no waiting.',
    more: 'These are answered on this phone with no model, and the sheet opens on the right page: words, drawing, typing, maths, memory, reading, first aid and your streaks. The drills run on this phone; your results are kept in your brain.',
    say: ['Ten Spanish words', 'A typing test', 'Maths drill', 'Drawing class'], scene: ['school', 'playing'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'words' } }, tryText: 'Opens the LEARNING sheet',
  },
  'act:learning:words': {
    name: 'Ten words a day, said aloud', line: 'You can pick one of eight languages and I give you ten words a day, said by your phone’s own voice.',
    more: 'Spanish, French, German, Italian, Portuguese, Polish, Arabic and Mandarin: sixty words in six days of ten (greetings, numbers, food, getting around, time, people), then round again. Arabic and Mandarin come with how they sound. A language speaks only if your phone has a voice for it, and the sheet says which it has.',
    say: ['Ten Spanish words', 'The French word of the day', 'Teach me ten Arabic words'], scene: ['school', 'morning'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'words', lang: 'es' } }, tryText: 'Opens the words page',
  },
  'act:learning:phrase': {
    name: 'Phrases for any situation', line: 'I can give you three phrases for a situation, like ordering coffee, asking the way or a hotel desk.',
    more: 'Six situations in each of the eight languages: a café, directions, transport, a shop, asking for help and a hotel. Each phrase is written out and said by your phone’s voice. For a situation I do not have, I write one myself and say it is mine, not from my table.',
    say: ['How do I order coffee in French?', 'Phrases for a train station in German'], scene: ['school', 'out'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'words', lang: 'fr', situation: 'cafe' } }, tryText: 'Opens a phrases page',
  },
  'act:learning:converse': {
    name: 'Chat in a language, gently fixed', line: 'You can chat in a language at your level, and I answer in it and fix your mistakes gently.',
    more: 'I open with a greeting, you reply in the language, and I answer in one or two short sentences with a small fix when you slipped. It uses the model, so it is only as good as the model: check a doubt with someone who speaks it. I never score you.',
    say: ['Let’s practise Spanish', 'Chat with me in French, beginner'], scene: ['school', 'talking'], cat: 'learn', since: SINCE,
    go: { ask: 'Let’s practise Spanish', send: false },
  },
  'act:learning:deck': {
    name: 'Keep words in a flashcard deck', line: 'You can keep the day’s words in a deck that brings each one back just before you would forget it.',
    more: 'The schedule is the one most flashcard apps use: a card you know comes back after a day, then six days, then further apart; one you forget comes back in ten minutes. The deck is kept in your brain, so it is the same on every device.',
    say: ['Keep today’s Spanish words in my deck', 'How big is my deck?'], scene: ['school'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'review' } }, tryText: 'Opens the review page',
  },
  'act:learning:review': {
    name: 'Review the cards that are due', line: 'I can show your due flashcards one at a time, and you say how easy each one was.',
    more: 'You see the English, say it in the language, then tap to see the answer and hear it. AGAIN, HARD, GOOD or EASY each say when the card will come back. Words you keep getting wrong come back sooner.',
    say: ['Review my words', 'Go through my flashcards'], scene: ['school', 'morning'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'review' } }, tryText: 'Opens the review page',
  },
  'act:learning:draw': {
    name: 'A drawing class with a guide', line: 'I can draw a shape on a canvas as a guide, you trace it with your finger, and I score how close you got.',
    more: 'Twenty shapes from a circle to a house, a cat’s face and a cube, each with a tip. The guide is drawn by code and the score is simple overlap, said kindly: it measures closeness to the guide, not taste. The coach’s DRAW gives a drawing prompt of the day and the creative pack gives a prompt too; this is a lesson with a guide to trace.',
    say: ['Drawing class', 'Draw with me', 'Trace the star'], scene: ['making', 'playing'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'draw' } }, tryText: 'Opens the drawing page',
  },
  'act:learning:typing': {
    name: 'A typing test and your speed', line: 'You can type a passage from your own library and I tell you your words a minute and your accuracy.',
    more: 'Say “typing test” or “words per minute test” and type the line in the chat box, or use the TYPING page. Speed counts only the right letters, and the clock starts at your first key. With no library text I use a built-in line. Your best and your streak are kept.',
    say: ['A typing test', 'A words per minute test', 'How fast do I type?'], scene: ['playing', 'school'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'typing' } }, tryText: 'Opens the typing page',
  },
  'act:learning:hand': {
    name: 'Check your handwriting', line: 'You can photograph a line you wrote by hand and I say how much of it the phone could read.',
    more: 'The photo is read on your phone and never leaves it. The share is how many of the words the reader got, so a low share can mean the photo as much as the writing: try flat paper, dark ink and good light.',
    say: ['Test my handwriting'], scene: ['camera', 'school'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'hand' } }, tryText: 'Opens the handwriting page',
  },
  'act:learning:readfast': {
    name: 'Practise reading faster', line: 'I can show a passage one word at a time at a speed you set, then ask three questions about it.',
    more: 'The passage comes from your own library when it has one. Raise the speed by 50 words a minute each time you get all three right. The questions are made from the passage by code, so they are always about what you just read.',
    say: ['Help me read faster', 'Speed read'], scene: ['school'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'readfast' } }, tryText: 'Opens the reading page',
  },
  'act:learning:memory': {
    name: 'Memory drills: numbers, lists, names', line: 'I can drill you on a number, a list, or names you give me with a cue each, and move up as you improve.',
    more: 'You look for a few seconds, cover it, and say it back. For names you give me the name and a cue you choose, like “Priya, red scarf”; I never look at faces or look anyone up. The level goes up after a clean drill.',
    say: ['A memory drill', 'Test my memory'], scene: ['school', 'playing'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'memory' } }, tryText: 'Opens the memory page',
  },
  'act:learning:maths': {
    name: 'A five-minute mental maths drill', line: 'You can do a five-minute mental maths drill at your level, and I move you up when you are ready.',
    more: 'Five levels, from adding within 20 to brackets and squares. Each answer is checked by code. Two sets of 90% or better move you up a level, and a set under half takes you back one.',
    say: ['Maths drill', 'Quick maths'], scene: ['school', 'playing'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'maths' } }, tryText: 'Opens the maths page',
  },
  'act:learning:spelling': {
    name: 'Spelling words you get wrong', line: 'I can find the words you often misspell in your messages and drill you on them until they stick.',
    more: 'I look through your own latest messages for slips from a list of about 180 common ones, and keep the slip, not your message. It is not a proofread, because I only know the common ones. The drill says a word aloud and you spell it.',
    say: ['Spelling drill', 'Which words do I get wrong?'], scene: ['school', 'talking'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'spelling' } }, tryText: 'Opens the spelling page',
  },
  'act:learning:music': {
    name: 'Learning an instrument', line: 'You can ask about learning an instrument, and I point you to the instrument coach in MAKE.',
    more: 'The instrument coach hears you play and tells you how it went. I do not listen to instruments myself. If you want a plan for it, ask for a four-week plan and I make one.',
    say: ['Help me learn the guitar', 'Is there something that listens to me play?'], scene: ['making', 'playing'], cat: 'learn', since: SINCE,
    go: { open: 'area-make' }, tryText: 'Opens MAKE',
  },
  'act:learning:firstaid': {
    name: 'First aid steps, as practice', line: 'I can walk you through the NHS’s first-aid steps as practice, and test whether you know the order.',
    more: 'Eight situations, such as CPR, choking, bleeding and a burn, in the order the NHS gives. It is practice, not training: a St John Ambulance or Red Cross course is how to learn it properly. For a real one, call 999.',
    say: ['First aid practice', 'What do I do if someone is choking?'], scene: ['school', 'out'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'firstaid' } }, tryText: 'Opens the first aid page',
  },
  'act:learning:plan': {
    name: 'A four-week plan for any skill', line: 'You can name any skill and I make a four-week plan of ten minutes a day, with the day’s line in your Brief.',
    more: 'It is a plan, not a teacher: four themed weeks of seven short exercises, written for the kind of skill it is (an instrument, a language, a sport, coding, drawing, cooking). Up to four plans at once, and you can stop one any time.',
    say: ['A four week plan for learning the guitar', 'Make me a plan to get better at chess'], scene: ['school', 'morning'], cat: 'learn', since: SINCE,
    go: { ask: 'A four week plan for learning the guitar', send: false },
  },
  'act:learning:today': {
    name: 'What to practise today', line: 'I can tell you what is worth practising today: your plan, cards that are due, and a streak at risk.',
    more: 'Only what you have set up: a plan’s line for the day, flashcards due, words to spell and a streak of three days or more that you have not kept up today. The Brief shows the first few each morning. Nothing is set until you start something.',
    say: ['What should I practise today?'], scene: ['morning', 'school'], cat: 'learn', since: SINCE,
    go: { ask: 'What should I practise today?' },
  },
  'act:learning:progress': {
    name: 'Your streaks and bests', line: 'I can show every skill’s streak and best on one sheet, so you can see what you have kept up.',
    more: 'A streak counts days in a row, and a day behind is not lost until it is over. Each skill keeps its best score. It shows only what you did here: nothing is guessed from elsewhere.',
    say: ['How am I doing?', 'My streaks'], scene: ['school', 'morning'], cat: 'learn', since: SINCE,
    go: { run: 'open_learning', args: { what: 'progress' } }, tryText: 'Opens your streaks',
  },
  'act:learning:done': {
    name: 'Log what you practised', line: 'You can tell me you practised something, and I add it to your streak and note a new best.',
    more: 'Any skill, including your own: “log my guitar practice”. Results from the drills in the sheet are logged for you. A maths or memory result also moves your level for next time.',
    say: ['Log my guitar practice', 'Done: typing 52'], scene: ['school'], cat: 'learn', since: SINCE,
    go: { ask: 'Log my guitar practice', send: false },
  },
};
