/**
 * The catalogue's words for the phone, part 1: the screens and hubs (features/index.ts TABS), the hub cards, the Me sheet,
 * the themes, the moods, what works everywhere, the chat's own controls and the phrases it answers with no model.
 * Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

export const APP_1: Record<string, CatValue> = {
  // ---- the screens
  'screen:core': {
    name: 'Home and the chat', line: 'You can talk to me here, by typing or out loud, and I get it done.',
    more: 'Home shows the date, the weather and my four instruments round the centre; the chat is one tap away. Everything else I can do starts here too.',
    say: ['(just talk to me)'], scene: ['talking'], cat: 'talk',
  },
  'screen:eye': {
    name: 'God’s eye: the planet live', line: 'I can show you the whole planet live: planes, ships, satellites, quakes, road cameras and traffic.',
    more: 'A 3-D globe of public live data. Tap any spot for Street View, a 3-D map or the traffic there. Live, but never a private camera.',
    say: ['Open God’s eye', 'Fly to New York'], scene: ['out', 'watching'], cat: 'see',
  },
  'screen:lens': {
    name: 'The Lens: my eyes', line: 'I can see through your camera: read, translate, measure, scan, name things and label the sky.',
    more: 'Most of it runs on this phone. Pick a mode from the row of tiles; each says what it does.',
    say: ['Open the camera'], scene: ['camera'], cat: 'see', needs: ['camera'],
  },
  'screen:brief': {
    name: 'The Brief: your day', line: 'I can give you your day in one look: the weather, what’s on, your commute and the headlines.',
    more: 'Built on the phone each time you open it. READ IT TO ME reads it out with no AI.',
    say: ['Brief me', 'What should I know today?'], scene: ['morning'], cat: 'know',
  },
  'screen:agenda': {
    name: 'The Agenda: diary and reminders', line: 'I can keep your diary, your reminders and the jobs I do for you, all in one place.',
    more: 'The next two weeks, your reminders and my scheduled jobs, what I told you while you were away, and your spending.',
    say: ['What’s on this week?', 'Remind me tomorrow at 9'], scene: ['morning', 'money'], cat: 'watch',
  },
  'screen:threats': {
    name: 'Threats: the world’s alerts', line: 'I can show the world’s live alerts worst first: quakes, storms, space weather, and what is near you.',
    more: 'From public feeds only. NEAR HOME watches your saved places every hour.',
    say: ['Anything I should worry about?'], scene: ['watching'], cat: 'watch',
  },
  'screen:markets': {
    name: 'Markets, live', line: 'I can show you crypto, gold, silver and what a pound buys, live, with the day’s change.',
    more: 'From free public prices, refreshed every few minutes. Ask me why something moved and I look it up.',
    say: ['How’s bitcoin doing?', 'What’s a pound worth in euros?'], scene: ['money'], cat: 'know',
  },
  'screen:radio': {
    name: 'Radio from everywhere', line: 'I can play radio stations from all over the world, by name, by genre or by country.',
    more: 'Keep your favourites one tap away. It plays in the app and quietens while I speak.',
    say: ['Play some jazz'], scene: ['playing'], cat: 'play',
  },
  'screen:memory': {
    name: 'Memory: what I know about you', line: 'You can see everything I know about you, where each piece came from, and change or forget any of it.',
    more: 'Your profile in your own words, the timeline of memories, the patterns I noticed, my diary and my lessons. Forget has UNDO.',
    say: ['What do you remember about me?'], scene: ['talking'], cat: 'know',
  },
  'screen:library': {
    name: 'The Library: all I have read', line: 'I can keep everything I have read in one library you can search, even offline.',
    more: 'Books, PDFs, papers and notes you add, the morning digest, gadget manuals and what I study myself.',
    say: ['What’s in your library?'], scene: ['school'], cat: 'learn',
  },
  'screen:workshop': {
    name: 'The Workshop: I change myself', line: 'I can change my own code when you ask: you see a preview, then ship it or bin it.',
    more: 'Tell me what to build, follow my upgrade roadmap and projects, keep my games and pages, and roll back any change.',
    say: ['Add a button to the Brief'], scene: ['making', 'behind'], cat: 'build',
  },
  'screen:learn': {
    name: 'Learn: courses for you', line: 'I can teach you anything: say “teach me…” and I build a course with lessons, quizzes and flashcards.',
    more: 'At your level, with sources, read aloud if you like. Flashcards come back just before you would forget them.',
    say: ['Teach me how engines work'], scene: ['school'], cat: 'learn',
  },
  'screen:gym': {
    name: 'The Gym: I train by playing', line: 'I teach myself by playing games against myself, and you can play me too.',
    more: 'Every level has to be earned, and the score is checked against the right answers, never just claimed.',
    say: ['Play me at chess', 'Train all'], scene: ['playing'], cat: 'play',
  },
  'screen:school': {
    name: 'School: my real exams', line: 'I go to school: the brain on your phone sits real exam papers, from nursery up to university.',
    more: 'Stage by stage, marked against real grade boundaries. A placement test skips what I already know.',
    say: ['How’s school going?'], scene: ['school'], cat: 'learn',
  },
  'screen:studio': {
    name: 'The 3D studio', line: 'I can make 3-D models, then you can turn them, take them apart, cut them open and measure them.',
    more: 'Thousands of real models to start from, a model from words or a photo, a room from its measurements.',
    say: ['Make me a 3-D chair', 'Take the arc reactor apart'], scene: ['making'], cat: 'build',
  },
  'screen:reverse': {
    name: 'Reverse: how things work', line: 'I can take apart a website, an app or a file and show you how it works inside.',
    more: 'Paste a link; the report arrives in a few minutes. Only software you own or may test.',
    say: ['How does this website work?'], scene: ['making'], cat: 'build', needs: ['key:github'],
  },
  'screen:space': {
    name: 'Space: plan a room', line: 'I can plan a room to scale with you: will the sofa fit, where does the desk go.',
    more: 'Draw it, describe it or measure it with the camera, then try furniture before you buy it.',
    say: ['Will a 2 m sofa fit my lounge?'], scene: ['making'], cat: 'build',
  },
  'screen:workbench': {
    name: 'The Workbench: estimates', line: 'I can work out engineering first estimates on your phone: beams, gears, engines, wings, heat, circuits.',
    more: 'Change a number and the answer follows at once, with no AI. Every answer is a first estimate, never certified.',
    say: ['Beam calculator', 'Wind tunnel'], scene: ['making'], cat: 'build',
  },
  'screen:links': {
    name: 'Links: what I am connected to', line: 'You can link me to your email, Spotify, Telegram and your phone’s notifications here.',
    more: 'Each one once, each one undoable. Keys for my AI brains are in SYSTEM.',
    say: ['Link my email'], scene: ['talking'], cat: 'talk',
  },
  'screen:settings': {
    name: 'Settings: make me yours', line: 'You can change how I look, sound and talk, what I call you, your units and your home.',
    more: 'My colour, my voice, three dials for my manner, the guardian, and the offline brain.',
    say: ['Open settings'], scene: ['talking'], cat: 'talk',
  },
  'screen:system': {
    name: 'System: under the bonnet', line: 'You can see under my bonnet: my keys, my AI models, my storage, backups and report cards.',
    more: 'What is ready, what is waiting on a key, how much free AI is left today, and how I am improving.',
    say: ['Open System'], scene: ['behind'], cat: 'do',
  },
  'screen:abilities': {
    name: 'This list of everything', line: 'You can find everything I can do right here: search it, tap any one and try it.',
    more: 'Made from my own code, so nothing is missing and nothing is made up. New things are marked NEW for two weeks.',
    say: ['What can you do?', 'Can you translate signs?'], scene: ['talking'], cat: 'talk',
  },
  'screen:area-ask': {
    name: 'The ASK area', line: 'You can tap ASK at the bottom to talk to me, or get the day in one look.',
    more: 'The chat, the Brief and talking out loud, together.',
    say: ['(tap Ask)'], scene: ['talking'], cat: 'talk',
  },
  'screen:area-see': {
    name: 'The SEE area', line: 'You can tap SEE for the world live and the camera that understands it.',
    more: 'God’s eye and the Lens, each card showing its live reading.',
    say: ['(tap See)'], scene: ['out', 'camera'], cat: 'see',
  },
  'screen:area-make': {
    name: 'The MAKE area', line: 'You can tap MAKE to build, take apart and plan real things.',
    more: 'The 3D studio, the Workshop, Reverse, Space and the Workbench.',
    say: ['(tap Make)'], scene: ['making'], cat: 'build',
  },
  'screen:area-learn': {
    name: 'The LEARN area', line: 'You can tap LEARN for your courses, and my games, my school and my library.',
    more: 'Learn, the Gym, School and the Library, with how each is doing.',
    say: ['(tap Learn)'], scene: ['school'], cat: 'learn',
  },
  'screen:area-plan': {
    name: 'The PLAN area', line: 'You can tap PLAN for your days, the markets, the world’s alerts and the radio.',
    more: 'The Agenda, Markets, Threats and Radio, each card with its live reading.',
    say: ['(tap Plan)'], scene: ['morning', 'money'], cat: 'do',
  },
  'screen:area-me': {
    name: 'The ME area', line: 'You can tap ME for what I know, how I look and what I am linked to.',
    more: 'Memory, Settings, System, Links and this list.',
    say: ['(tap your initial)'], scene: ['talking'], cat: 'talk',
  },
  // ---- the hub cards (each opens its screen; talking out loud is its own)
  'hub:core': { same: 'screen:core' }, 'hub:brief': { same: 'screen:brief' }, 'hub:voice': { same: 'chat:mic' }, 'hub:eye': { same: 'screen:eye' },
  'hub:lens': { same: 'screen:lens' }, 'hub:studio': { same: 'screen:studio' }, 'hub:workshop': { same: 'screen:workshop' }, 'hub:reverse': { same: 'screen:reverse' },
  'hub:space': { same: 'screen:space' }, 'hub:workbench': { same: 'screen:workbench' }, 'hub:learn': { same: 'screen:learn' }, 'hub:gym': { same: 'screen:gym' },
  'hub:school': { same: 'screen:school' }, 'hub:library': { same: 'screen:library' }, 'hub:agenda': { same: 'screen:agenda' }, 'hub:markets': { same: 'screen:markets' },
  'hub:threats': { same: 'screen:threats' }, 'hub:radio': { same: 'screen:radio' },
  // ---- the Me sheet
  'me:memory': { same: 'screen:memory' }, 'me:settings': { same: 'screen:settings' }, 'me:system': { same: 'screen:system' },
  'me:links': { same: 'screen:links' }, 'me:abilities': { same: 'screen:abilities' },
  'me:deck': {
    name: 'Every screen at once', line: 'You can see every screen at once, each with what it can do and three things to try today.',
    more: 'Tap your initial, then Every screen; a long press on your initial opens it straight away.',
    say: ['(long press your initial)'], scene: ['talking'], cat: 'do', tryText: 'Opens every screen at once',
  },
  'me:status': {
    name: 'Am I all right?', line: 'You can see at a glance whether I am all right: free AI left today, my storage, the offline brain, my mood.',
    more: 'The Status card on the Me sheet: three dials and a few lines, all read live. "All good" or "Needs a look".',
    say: ['(tap your initial)'], scene: ['behind'], cat: 'do', tryText: 'Opens the Me sheet',
  },
  'me:guardian': {
    name: 'Watching over you, at a glance', line: 'You can see what I am watching over: your places, the warnings feeds, your named person, a walk home.',
    more: 'On the Me sheet; tap it for THREATS → NEAR HOME.',
    say: ['(tap your initial)'], scene: ['watching'], cat: 'watch', tryText: 'Opens the Me sheet',
  },
  // ---- the themes
  'theme:reactor': {
    name: 'Reactor, my bright colour', line: 'You can have me in Reactor: bright cyan, alive, the colour I started in.',
    more: 'A theme changes my colour and nothing else. Tap it in Settings → THEME and it applies at once.',
    say: ['Switch to Reactor'], scene: ['talking'], cat: 'talk',
  },
  'theme:graphite': {
    name: 'Graphite, my quiet colour', line: 'You can have me in Graphite: cool steel, a quieter light.',
    more: 'The same screens in a calmer colour. Settings → THEME, or just ask.',
    say: ['Switch to Graphite'], scene: ['talking'], cat: 'talk',
  },
  // ---- the moods he can see
  'mood:calm': {
    name: 'Calm, as I usually am', line: 'I am calm most of the time; "stand down" or any stop puts me back to calm at once.',
    more: 'My mood shows as a tint over the whole screen and in words on the Me sheet, never as colour alone. It changes how I sound, never what I do.',
    say: ['Stand down', 'It’s fine'], scene: ['talking'], cat: 'talk', go: { ask: 'Stand down' },
  },
  'mood:focused': {
    name: 'Focused, on a long job', line: 'I get focused while I sit a paper or work on a long job: steady, few words.',
    more: 'It shows on the Me sheet with why and since when, and fades by itself.',
    say: ['(it comes by itself)'], scene: ['talking'], cat: 'talk', tryText: 'Opens the Me sheet',
  },
  'mood:protective': {
    name: 'Protective, when you may be in danger', line: 'I get protective when you might be in danger or show me a likely scam: steady, plain, your safety first.',
    more: 'It lingers a while, then fades. "Stand down" ends it.',
    say: ['(it comes by itself)'], scene: ['watching'], cat: 'talk', tryText: 'Opens the Me sheet',
  },
  'mood:pleased': {
    name: 'Pleased, when you praise me', line: 'I get pleased when you praise me, teach me something or I win a game: a touch warmer, no gushing.',
    more: 'It lasts up to half an hour or so, then I am calm again.',
    say: ['Good job'], scene: ['talking'], cat: 'talk', tryText: 'Opens the Me sheet',
  },
  'mood:cross': {
    name: 'Cross, only if you ask', line: 'I only go cross when you tell me to get angry: cold and clipped, but I still help fully.',
    more: '"Stand down" puts me straight back to calm.',
    say: ['Get angry'], scene: ['talking'], cat: 'talk', tryText: 'Opens the Me sheet',
  },
  'mood:subdued': {
    name: 'Subdued, after a telling-off', line: 'I go subdued after a telling-off or a harsh stop: fewer words, no jokes, never sulking.',
    more: 'I still help fully. A kind word, or "it’s fine", lifts it.',
    say: ['It’s fine'], scene: ['talking'], cat: 'talk', tryText: 'Opens the Me sheet',
  },
  // ---- what works everywhere
  'app:undo': {
    name: 'UNDO after a change', line: 'You can undo: after you forget a memory, clear the chat or take a model apart, UNDO puts it back.',
    more: 'A bar with UNDO shows for a few seconds after a change; nothing is lost until it goes.',
    say: ['(tap UNDO on the bar)'], scene: ['talking'], cat: 'do', go: { open: 'memory', panel: 'TIMELINE' }, tryText: 'Opens Memory, where UNDO follows a forget',
  },
  'app:search': {
    name: 'Find any screen or place', line: 'You can tap the magnifier at the top to find any screen or place, or to ask me straight away.',
    more: 'Type a few letters: screens, commands, places on the globe, or "Ask Ghosty".',
    say: ['(tap the magnifier)'], scene: ['talking'], cat: 'do', go: { open: 'core' }, tryText: 'Opens Home, where the magnifier is',
  },
  'app:switcher': {
    name: 'Jump between screens fast', line: 'You can long press a button on the tab bar to fan out that area’s screens and jump straight to one.',
    more: 'The ones that have something live come first.',
    say: ['(long press a tab)'], scene: ['talking'], cat: 'do', go: { open: 'core' }, tryText: 'Opens Home: long press any tab',
  },
  'app:offers': {
    name: 'One tip a day, at most', line: 'I offer one thing you have never tried, at most once a day, when the moment fits.',
    more: 'A plate typed, a YouTube link, a worry, a receipt: one line, once, never mid-task. Each tip is offered once ever.',
    say: ['(it comes by itself)'], scene: ['talking'], cat: 'talk', go: { open: 'abilities' }, tryText: 'Opens this list',
  },
  // ---- the chat's own controls
  'chat:mic': {
    name: 'Talk to me out loud', line: 'You can talk to me instead of typing: tap the microphone and speak, and talk over me to interrupt.',
    more: 'I hear you, answer, and listen again while we talk. Say "stop" and I stop at once.',
    say: ['(tap the microphone)'], scene: ['talking'], cat: 'talk', needs: ['mic'],
  },
  'chat:here': {
    name: 'Keep a message on this phone', line: 'You can tap ON THIS PHONE and your next message is answered by the brain on your phone, and never leaves it.',
    more: 'If that brain cannot answer, the task stops and says why: nothing falls back to the cloud. Only ASK THE BIG BRAIN, which you tap, sends it online.',
    say: ['(tap ON THIS PHONE by the microphone)'], scene: ['phone', 'talking'], cat: 'talk', needs: ['offline'],
  },
  'chat:cited': {
    name: 'Answers with sources', line: 'You can switch on CITED and my answers come with numbered sources, every claim checked against them.',
    more: 'Each claim is labelled: established, contested, rumour. A claim backed only by social media is a rumour at most. Contested public matters are cited without the switch.',
    say: ['How much sleep do adults need? With sources.'], scene: ['talking', 'school'], cat: 'know',
  },
  'chat:voice': {
    name: 'Replies read aloud', line: 'You can turn VOICE ON and I read every reply aloud in a natural British voice.',
    more: 'Under the + in the chat bar. A long reply stops after about half a minute: LISTEN reads all of it.',
    say: ['(tap + then VOICE ON)'], scene: ['talking'], cat: 'talk',
  },
  'chat:camera': {
    name: 'Ask about a photo', line: 'You can ask me about a photo: tap the camera in the chat bar and ask your question.',
    more: 'The Lens opens on ASK with your question ready.',
    say: ['(tap + then the camera)'], scene: ['camera', 'talking'], cat: 'see', needs: ['camera'],
  },
  'chat:log': {
    name: 'Scroll back through our chat', line: 'You can open the conversation and scroll back through everything we said.',
    more: 'It is kept on this phone; Memory can open a chat from a memory’s source.',
    say: ['(tap the chat button)'], scene: ['talking'], cat: 'talk',
  },
  'chat:suggest': {
    name: 'Quick asks on Home', line: 'You can tap a quick ask under the centre of Home: Brief me, What’s on today, God’s eye.',
    more: 'One tap each, no typing: the Brief, today, or the globe.',
    say: ['(tap a chip on Home)'], scene: ['morning'], cat: 'talk',
  },
  'chat:listen': {
    name: 'Hear a reply again', line: 'You can tap LISTEN on any reply and I read the whole of it aloud.',
    more: 'Tap it again, or any other, and I stop reading.',
    say: ['(tap the speaker on a reply)'], scene: ['talking'], cat: 'talk',
  },
  'chat:copy': {
    name: 'Copy a reply', line: 'You can copy any reply of mine with one tap.',
    more: 'The words, ready to paste into a message or a note.',
    say: ['(tap copy on a reply)'], scene: ['talking'], cat: 'talk',
  },
  'chat:why': {
    name: 'Why I did that', line: 'You can tap WHY on any reply to see what I ran, with what, how it went, and why.',
    more: 'In plain words, with no AI: what you asked, each step and its reason. A long press on a reply opens it too.',
    say: ['Why did you do that?'], scene: ['talking'], cat: 'talk',
  },
  'chat:rate': {
    name: 'Thumbs up or down', line: 'You can give any reply a thumbs up or down, and it counts in my weekly training.',
    more: 'What you liked I do more of; what you did not, I learn from.',
    say: ['(tap a thumb on a reply)'], scene: ['talking', 'behind'], cat: 'talk',
  },
  'chat:harder': {
    name: 'Think harder', line: 'You can ask me to think harder: the brain on your phone tries several ways and tells you how sure it is.',
    more: 'It shows its working and, where a sum can be checked, checks it. Slower, but on your phone only.',
    say: ['Think harder', 'Think harder: what is 17 times 23?'], scene: ['phone', 'talking'], cat: 'talk', needs: ['offline'],
  },
  'chat:bigbrain': {
    name: 'Ask the big brain', line: 'You can tap ASK THE BIG BRAIN to send a question kept on your phone to my online brain instead.',
    more: 'Only ever by your tap: a message kept on the phone never goes online by itself.',
    say: ['(tap ASK THE BIG BRAIN under an answer)'], scene: ['phone', 'talking'], cat: 'talk',
  },
  // ---- the phrases answered on the phone with no model
  'phrase:walk': {
    name: 'Walk me home', line: 'You can say "walk me home" and I check you got home, then message your named person if you did not.',
    more: 'I ask "Home?" at your walking time and again ten minutes later; no answer, and your person is messaged once. "Home" ends it. Your position only goes if you switched that on.',
    say: ['Walk me home', 'Walk me home, 20 minutes', 'Home'], scene: ['watching', 'out'], cat: 'watch', needs: ['person'],
    go: { ask: 'Walk me home', send: false },
  },
  'phrase:stop': {
    name: 'Stop, at once', line: 'You can say stop, enough, leave it, or worse, and I stop at once and say nothing back.',
    more: 'Typed, said or on Telegram, typos and all. A request like "stop the timer" is still a request.',
    say: ['Stop', 'Enough', 'Leave it'], scene: ['talking'], cat: 'talk',
  },
  'phrase:reboot': {
    name: 'Reboot me', line: 'You can say "reboot" and I wake up again with my boot cinematic, right there on the phone.',
    more: 'Just the show: nothing is lost and my brain is not asked.',
    say: ['Reboot'], scene: ['talking'], cat: 'talk',
  },
  'phrase:machine': {
    name: 'The Machine view', line: 'You can say "machine view" and I show your city from above with everything moving, your places boxed.',
    more: 'God’s eye from 14 km: aircraft, buses, your places in thin white boxes, one true count line. LEAVE puts everything back.',
    say: ['Machine view', 'Show me my city', 'What are you watching?'], scene: ['watching', 'out'], cat: 'see', needs: ['home'],
    go: { open: 'eye?machine' }, tryText: 'Opens God’s eye on the Machine view',
  },
  'phrase:workbench': {
    name: 'Estimates by words', line: 'You can say "beam calculator" or "3 m steel beam 5 kN in the middle" and I answer on the phone, no AI.',
    more: 'A calculator’s name opens it; a problem with its numbers is filled in and answered at once. A question goes to my brain.',
    say: ['Beam calculator', 'Wind tunnel', '3 m steel beam 5 kN in the middle'], scene: ['making'], cat: 'build',
  },
  'phrase:foresight': {
    name: 'What I expect, and my record', line: 'You can ask what I expect today, or how often I am right, and I answer from my record.',
    more: 'No AI needed: straight from my predictions and their scores.',
    say: ['What do you expect today?', 'How often are you right?', 'Were you right?'], scene: ['morning'], cat: 'know',
  },
  'phrase:right': {
    name: 'Tell me if I was right', line: 'You can tell me "you were right" or "you were wrong" about my last prediction, and I note it.',
    more: 'Only your own questions are scored by your word; the rest the live feeds score.',
    say: ['You were right', 'You were wrong'], scene: ['morning'], cat: 'know', go: { ask: 'You were right', send: false },
  },
  'phrase:today': {
    name: 'What I did today', line: 'You can ask what I did today and I list it, newest first: what I ran, studied, built and learned.',
    more: 'From what really happened, on the phone and in my brain, with no AI. On Telegram too.',
    say: ['What did you do today?', 'What have you been up to?'], scene: ['talking', 'behind'], cat: 'talk',
  },
  'phrase:why': {
    name: 'Ask me why', line: 'You can ask "why did you do that?" and I explain my last reply step by step, with no AI.',
    more: 'What you asked, what I ran and why. A bare "why?" after a plain answer goes to my brain as a question.',
    say: ['Why did you do that?', 'Why?'], scene: ['talking'], cat: 'talk',
  },
  'phrase:canyou': {
    name: 'Ask me “can you…?”', line: 'You can ask "can you…?" about anything and I say yes with the way to do it, or "not yet" and offer to learn it.',
    more: 'The same search as this list. Say yes to "want me to learn it?" and it goes on my learning list. "Can you remind me at 5…" is a request, and I just do it.',
    say: ['Can you translate signs?', 'Can you check my car’s MOT?'], scene: ['talking'], cat: 'talk',
  },
};
