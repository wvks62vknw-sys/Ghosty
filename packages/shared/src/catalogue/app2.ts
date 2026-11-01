/**
 * The catalogue's words for the phone, part 2: the panels on each screen, keyed `panel:<screen>:<TITLE>` as the screen
 * titles them (apps/edge/test/catalogue.test.mjs checks these keys against the panels in the screens' source, both ways).
 * A panel that is the very thing another entry says is `same` as it. Rules: packages/shared/src/catalogue.ts.
 */
import type { CatValue } from '../catalogue';

export const APP_2: Record<string, CatValue> = {
  // ---- ABILITIES (this list)
  'panel:abilities:CAN YOU…?': {
    name: 'Search everything I can do', line: 'You can search everything I can do by a word or a question, and try any of it from there.',
    more: 'It finds things by their names, their lines and the ways to say them. Ask "can you…?" and it is a yes, a nearest thing, or "not yet", with an offer to learn it.',
    say: ['Can you translate signs?', '(a word, like a place or a thing)'], scene: ['talking'], cat: 'talk',
  },
  'panel:abilities:LEARNING': {
    name: 'What you asked me to learn', line: 'You can see what you asked me to learn, and the steps of my upgrade plan.',
    more: 'Say yes to "want me to learn it?" and it lands here, first in my upgrade ideas, never pushed out.',
    say: ['(tap YES under “not yet”)'], scene: ['talking', 'behind'], cat: 'learn',
  },
  // ---- AGENDA
  'panel:agenda:DIARY · NEXT 14 DAYS': {
    name: 'Your next two weeks', line: 'You can see your next two weeks day by day: your events and your calendars together.',
    more: 'Add an event here, or just tell me. A connected calendar’s events show beside yours.',
    say: ['What’s on next week?'], scene: ['morning', 'money'], cat: 'watch',
  },
  'panel:agenda:CALENDARS': { same: 'tool:add_calendar_feed' },
  'panel:agenda:REMINDERS & TASKS': {
    name: 'Your reminders, my jobs', line: 'You can see every reminder you set and every job I run for you, with when each comes next.',
    more: 'Cancel any of them with a tap. New ones come from the chat: "remind me…".',
    say: ['What reminders have I got?'], scene: ['morning'], cat: 'watch',
  },
  'panel:agenda:NOTIFICATIONS': {
    name: 'What I told you while away', line: 'You can read everything I told you while you were away: reminders, job results, warnings.',
    more: 'My inbox for you, newest first. The Agenda’s button shows a dot when something new came in.',
    say: ['What did I miss?'], scene: ['morning'], cat: 'watch',
  },
  'panel:agenda:SPENDING': {
    name: 'Your spending, sorted', line: 'You can add a bank statement you downloaded and I sort your month: categories, budgets, subscriptions.',
    more: 'A CSV from your bank’s app. No bank access, ever; only the shop names my rules cannot place go to a free AI to sort.',
    say: ['How much did I spend on food?'], scene: ['money'], cat: 'watch', needs: ['statement'],
  },
  // ---- THE BRIEF
  'panel:brief:FORESIGHT': { same: 'job:foresee' },
  'panel:brief:YOUR DAY': {
    name: 'The rest of your day', line: 'You can see the rest of today at the top of the Brief: your events, your reminders, my messages.',
    more: 'Built on your phone from your Agenda, every time you open it.',
    say: ['What’s left today?'], scene: ['morning'], cat: 'know',
  },
  'panel:brief:WEATHER': {
    name: 'Rain, hour by hour', line: 'You can see the rain chance and the temperature hour by hour, with the rain said in words.',
    more: 'For where you are. If it cannot update, it shows the last forecast and says when it was from.',
    say: ['Will it rain today?'], scene: ['morning', 'out'], cat: 'know',
  },
  'panel:brief:COMMUTE': {
    name: 'Your commute, in full', line: 'You can see your commute between home and work: the roads and the trains, before you leave.',
    more: 'It needs your home and work saved. With a free TomTom key it also gives the road speeds against normal.',
    say: ['How’s my commute?'], scene: ['morning', 'out'], cat: 'know', needs: ['home', 'work', 'key:tomtom'],
  },
  'panel:brief:HEADLINES': {
    name: 'Headlines by section', line: 'You can read the headlines by section: world, tech, science, and the morning digest’s line.',
    more: 'From public news feeds. READ IT TO ME reads the Brief out with no AI.',
    say: ['What’s in the news?', 'Brief me'], scene: ['morning'], cat: 'know',
  },
  // ---- HOME's own panels (the wide screen's): each is the same as the screen that has it in full
  'panel:core:CONVERSATION': { same: 'chat:log' },
  'panel:core:WEATHER': { same: 'panel:brief:WEATHER' },
  'panel:core:THREAT LEVEL': { same: 'screen:threats' },
  'panel:core:MARKETS': { same: 'screen:markets' },
  'panel:core:HEADLINES': { same: 'panel:brief:HEADLINES' },
  // ---- GOD'S EYE
  'panel:eye:LAYERS': {
    name: 'The globe’s live layers', line: 'You can switch God’s eye layers on and off: planes, ships, satellites, quakes, cameras, rain, traffic.',
    more: 'Each layer is a public live feed and says where it comes from. Ships need a free key.',
    say: ['Show the planes', 'Turn on the rain radar'], scene: ['out', 'watching'], cat: 'see', needs: ['key:aisstream'],
  },
  'panel:eye:TARGET': {
    name: 'Tap anything on the globe', line: 'You can tap anything on the globe, a plane, a ship, a satellite, a quake, and see what it is.',
    more: 'Its card shows what the feed says about it. Tap an empty spot for Street View, a map or the traffic there.',
    say: ['(tap a plane on the globe)'], scene: ['out'], cat: 'see',
  },
  'panel:eye:CCTV · NEAREST': {
    name: 'The cameras nearest you', line: 'You can see the live road cameras nearest you, one tap each.',
    more: 'Official public cameras; a city with none says so and shows the nearest motorway camera.',
    say: ['Show me the traffic cameras near home'], scene: ['out', 'morning'], cat: 'see',
  },
  'panel:eye:ROAD AHEAD': { same: 'tool:road_ahead' },
  // ---- THE GYM
  'panel:gym:GAMES': {
    name: 'All my games, with my levels', line: 'You can see every game I play with the level I have earned, and train them all with one tap.',
    more: 'TRAIN ALL works through them while you watch the levels climb. Every level is checked against the right answers.',
    say: ['Train all'], scene: ['playing'], cat: 'play',
  },
  'panel:gym:GAME': {
    name: 'Watch me play one game', line: 'You can open one game to watch me play it, train it, or play me at it.',
    more: 'Its card shows my level, what I am learning, and the games we played.',
    say: ['Play me at Connect 4'], scene: ['playing'], cat: 'play',
  },
  // ---- LEARN
  'panel:learn:STUDY': {
    name: 'Carry on learning', line: 'You can carry on where you left off: the next lesson, a quiz, an exam, or cards to revise.',
    more: 'A course shows as a map of its units, each lesson marked read, passed or mastered. Lessons come with sources and can be read aloud.',
    say: ['Next lesson', 'Quiz me'], scene: ['school'], cat: 'learn',
  },
  'panel:learn:COURSES': {
    name: 'Your learning courses', line: 'You can see every course you started and how much of each you have mastered.',
    more: 'Pick one up any time; your streak and your progress are kept.',
    say: ['What courses am I doing?'], scene: ['school'], cat: 'learn',
  },
  'panel:learn:START A COURSE': {
    name: 'Start a new course', line: 'You can start a course on anything: type what you want to learn and how much you know already.',
    more: 'I plan the course from my library and Wikipedia, at your level, a little a day.',
    say: ['Teach me Spanish', 'Teach me how electricity works'], scene: ['school'], cat: 'learn',
  },
  // ---- THE LIBRARY
  'panel:library:ADD KNOWLEDGE': {
    name: 'Add books and PDFs', line: 'You can give me books, PDFs, Word files, links or photos of pages to read and keep.',
    more: 'Read on this phone with no AI; a scanned page is read by a free service. Then it is searchable for good.',
    say: ['(tap ADD and pick a file)'], scene: ['school'], cat: 'learn',
  },
  'panel:library:ASK THE LIBRARY': {
    name: 'Search the library by meaning', line: 'You can search my whole library by meaning or by keywords, even with no signal.',
    more: 'Once the small meaning model is on your phone, the search runs there and nothing leaves it.',
    say: ['What did that paper say about sleep?'], scene: ['school', 'phone'], cat: 'learn',
  },
  'panel:library:SHELF': {
    name: 'Everything on my shelf', line: 'You can see every document in my library, open it to read, or take it out.',
    more: 'With how big each is and where it came from.',
    say: ['What’s in your library?'], scene: ['school'], cat: 'learn',
  },
  'panel:library:GADGETS': {
    name: 'Your gadgets’ manuals', line: 'You can open the manuals I found for your gadgets, each kept with where it came from.',
    more: 'Ask me about a fault code and I answer from these pages, saying which page.',
    say: ['Find the manual for my dishwasher'], scene: ['making', 'money'], cat: 'know',
  },
  'panel:library:SELF-STUDY': { same: 'job:study' },
  'panel:library:FRESH TODAY': { same: 'job:digest' },
  // ---- LINKS
  'panel:links:EMAIL': {
    name: 'Link your email', line: 'You can link your email with an app password, so I can check it, search it and send for you.',
    more: 'Sending always waits for your APPROVE. The password is kept locked in my vault.',
    say: ['Link my email'], scene: ['money', 'talking'], cat: 'talk',
  },
  'panel:links:SPOTIFY': {
    name: 'Link your Spotify', line: 'You can link your Spotify once, so I can see and play your music.',
    more: 'You sign in on Spotify’s own page. Play, pause and skip need Premium.',
    say: ['Link my Spotify'], scene: ['playing'], cat: 'play',
  },
  'panel:links:TELEGRAM': {
    name: 'Pair your Telegram', line: 'You can pair your own Telegram bot and talk to me there: text, voice notes, photos.',
    more: 'Make the bot with Telegram’s BotFather, paste its key in SYSTEM → KEYS, then send it the code shown here. Only you can talk to it.',
    say: ['Set up Telegram'], scene: ['talking', 'out'], cat: 'talk',
  },
  'panel:links:PHONE · APP & NOTIFICATIONS': {
    name: 'Notifications on this phone', line: 'You can add me to your Home Screen and let me send notifications to this phone.',
    more: 'Reminders and warnings then reach you even when I am closed. Add me to your Home Screen first: that is what lets an iPhone notify.',
    say: ['Turn on notifications'], scene: ['talking', 'phone'], cat: 'talk',
  },
  'panel:links:NOTIFICATIONS': {
    name: 'What may notify you', line: 'You can choose what may notify you: reminders, my job results, flashcards due, warnings.',
    more: 'One switch each. What is switched off still waits in the Agenda.',
    say: ['Stop the flashcard notifications'], scene: ['talking'], cat: 'talk',
  },
  'panel:links:AI BRAIN': {
    name: 'Is my brain connected?', line: 'You can see whether my brain is reachable and how many AI models are ready.',
    more: 'Read live from the brain. The keys that add more models are in SYSTEM → KEYS.',
    say: ['Are you connected?'], scene: ['behind'], cat: 'do',
  },
  'panel:links:GITHUB · SELF-EDIT': {
    name: 'Let me edit myself', line: 'You can connect GitHub so I can change my own code, always as a preview you approve.',
    more: 'With a GitHub token in SYSTEM → KEYS. Nothing goes live without your tap.',
    say: ['Can you change your own code?'], scene: ['behind', 'making'], cat: 'build', needs: ['key:github'],
  },
  'panel:links:LIVE TRAFFIC · TOMTOM': {
    name: 'Live traffic speeds', line: 'You can add a free TomTom key for live road speeds against normal, and incidents with their delays.',
    more: 'Traffic works without it; with it, your commute and my predictions are sharper.',
    say: ['How’s the traffic?'], scene: ['out', 'morning'], cat: 'see', needs: ['key:tomtom'],
  },
  // ---- MARKETS
  'panel:markets:CRYPTO, LAST 24 HOURS': {
    name: 'Crypto, with the day’s change', line: 'You can see bitcoin and the big coins with their last 24 hours.',
    more: 'Live prices in your currency, from a free public source.',
    say: ['How’s bitcoin doing?'], scene: ['money'], cat: 'know',
  },
  'panel:markets:GOLD & SILVER': {
    name: 'Gold and silver prices', line: 'You can see the price of gold and silver in pounds.',
    more: 'Read every ten minutes from a free public source.',
    say: ['What’s gold worth today?'], scene: ['money'], cat: 'know',
  },
  'panel:markets:WHAT £1 BUYS': {
    name: 'What a pound buys', line: 'You can see what a pound buys in euros, dollars and other currencies today.',
    more: 'Handy before a trip or a foreign order. Read every ten minutes.',
    say: ['How many euros for a pound?'], scene: ['money', 'out'], cat: 'know',
  },
  // ---- MEMORY
  'panel:memory:WHAT I REMEMBER': {
    name: 'The facts I keep', line: 'You can see every fact I keep about you, add one, or remove one with a tap.',
    more: 'Only what you told me. Type a fact and SAVE, or tap ✕ to remove it.',
    say: ['What do you remember about me?'], scene: ['talking'], cat: 'know',
  },
  'panel:memory:ME': {
    name: 'Your profile, in your words', line: 'You can see who I think you are, in your own words, and add or remove any line.',
    more: 'Built only from what you told me, never from what I read. Your saved places live here too.',
    say: ['What do you know about me?'], scene: ['talking'], cat: 'know',
  },
  'panel:memory:PRINCIPLES': {
    name: 'Your rules for me', line: 'You can write your own rules for how I behave, in your own words.',
    more: 'The lines I keep to whatever we talk about. The same page is in Settings → CHARACTER.',
    say: ['Never swear at me'], scene: ['talking'], cat: 'talk',
  },
  'panel:memory:DIARY': { same: 'job:reflect' },
  'panel:memory:LESSONS LEARNED': { same: 'tool:list_lessons' },
  'panel:memory:CONVERSATION': {
    name: 'Clear our conversation', line: 'You can read our conversation back here, or clear it, with UNDO if you change your mind.',
    more: 'Clearing takes it off the screen at once and out of my brain when UNDO goes. What I remember about you stays.',
    say: ['(tap CLEAR CONVERSATION)'], scene: ['talking'], cat: 'talk',
  },
  'panel:memory:TIMELINE': {
    name: 'Every memory, with its source', line: 'You can see every memory with where it came from, and edit, lock or forget any of it.',
    more: 'A memory from the chat opens that chat. Forget has UNDO; a locked memory is never forgotten by itself.',
    say: ['Forget my old address'], scene: ['talking'], cat: 'know',
  },
  'panel:memory:PATTERNS': {
    name: 'Patterns I noticed', line: 'You can see the patterns I noticed in your days, each with its evidence, and dismiss any.',
    more: 'Nothing about your health is ever turned into a pattern.',
    say: ['What patterns have you noticed?'], scene: ['talking'], cat: 'know',
  },
  // ---- RADIO
  'panel:radio:STATIONS': {
    name: 'Find a station', line: 'You can find a station by name, by genre or by country, and play it.',
    more: 'Thousands of internet radio stations from everywhere.',
    say: ['Play some jazz', 'Play Capital FM'], scene: ['playing'], cat: 'play',
  },
  'panel:radio:NOW PLAYING': {
    name: 'What’s playing now', line: 'You can see what is playing now, and pause or stop it.',
    more: 'It quietens by itself while I speak, then comes back up.',
    say: ['Stop the radio'], scene: ['playing'], cat: 'play',
  },
  'panel:radio:FAVOURITES': {
    name: 'Your favourite stations', line: 'You can keep your favourite stations one tap away.',
    more: 'Star a station and it stays here, on this phone.',
    say: ['Play my favourite station'], scene: ['playing'], cat: 'play',
  },
  // ---- REVERSE
  'panel:reverse:TAKE SOMETHING APART': {
    name: 'Take software apart', line: 'You can paste a website, an app package, a code project or a file link, and I take it apart.',
    more: 'Even an app file or a program. It runs on GitHub’s free machines for three to eight minutes. Only software you own or may test.',
    say: ['How does this website work?'], scene: ['making'], cat: 'build', needs: ['key:github'],
  },
  'panel:reverse:YOUR REPORTS': {
    name: 'Your take-apart reports', line: 'You can open every report I made, newest first.',
    more: 'Each says what stands out first, then the detail.',
    say: ['Is the report ready?'], scene: ['making'], cat: 'build',
  },
  'panel:reverse:REPORT': {
    name: 'A report, worst first', line: 'You can read a take-apart report starting with what stands out, then section by section.',
    more: 'The frameworks it uses, its scripts, its weak spots, each with where it came from.',
    say: ['What did you find?'], scene: ['making'], cat: 'build',
  },
};
