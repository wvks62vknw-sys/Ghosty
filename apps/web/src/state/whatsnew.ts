/**
 * WHAT'S NEW (chunk A0): this week's merges in plain words, newest first, shown once per build at the top of
 * the Workshop (features/workshop) until the owner taps GOT IT. Which build was last seen is kept on this
 * device (`ghosty.whatsNew`, the build's commit). Add a line here with every merge worth telling him about.
 */
import { BUILD } from './build';
import { CATALOGUE, isSame } from '../../../../packages/shared/src/catalogue';

export interface NewThing {
  /** The day it was merged (YYYY-MM-DD). */
  day: string;
  title: string;
  /** One line on what changed for him. */
  line: string;
}

/** The lines written by hand for what he would notice (each landing adds its own), newest first. */
export const WHATS_NEW: NewThing[] = [
  { day: '2026-11-14', title: 'Your own one-word routines', line: 'Settings → ROUTINES: make one word, like “morning”, run a few things in turn. Say it or type it. Anything that would send still waits for your APPROVE.' },
  { day: '2026-11-14', title: 'Ask how, and get the taps', line: 'Ask “how do I paste a bank statement?” and I give the exact taps with TRY IT; “what can I say here?” gives that screen’s own words. The search understands whole sentences too.' },
  { day: '2026-11-14', title: 'A tour of the house', line: 'Say “show me around” and I walk you through the seven rooms, with one thing to try in each. The search does sums as you type, too.' },
  { day: '2026-11-14', title: 'One name for every screen', line: 'Courses, Interpret, Game Studio, Home, FACES in the Lens, ABOUT YOU in Memory: each called the same in the bar, the search, the lists and my speech.' },
  // [moneynext] money and papers handled for you (NEXT-MONEY)
  { day: '2026-11-14', title: 'Safe to spend until payday', line: 'Life → MONEY: tell me your payday and the top of your month shows what is safe to spend until then, after the bills still due. Plain sums, not a forecast.' },
  { day: '2026-11-14', title: 'A money calendar, goals and your year', line: 'MONEY → CALENDAR puts every bill and payday on its day; BUDGETS keeps savings goals with what each needs a month; TRENDS adds your year in money, ready to print.' },
  { day: '2026-11-14', title: 'Shared bills and your sorting rules', line: 'MONEY → BILLS splits household bills and says who owes whom; YOUR MONTH lists the rules that sort your payments, to change or take away. Nothing is paid or sent.' },
  { day: '2026-11-14', title: 'Warranties, papers and the car', line: 'HOUSEHOLD → PAPERS keeps each warranty with a photo of its receipt on your phone, and your tenancy, insurance and licences with a reminder before each renews. MONEY → BILLS adds up your car and shows each subscription’s own cancel page.' },
  { day: '2026-11-14', title: 'Price watches, energy and split payments', line: 'MONEY → TRENDS lists your price watches and how each moved; METER shows your use and a first estimate of its cost; a payment can be split across two categories.' },
  { day: '2026-11-14', title: 'Gift lists and job applications', line: 'PEOPLE keeps gift ideas per person with what you gave last year, lets you change one note, and keeps your own photo on the phone. WORK → JOBS tracks each application with a day to follow up.' },
  { day: '2026-11-14', title: 'Paid bills kept, documents kept', line: 'HOUSEHOLD → BILLS keeps the paid ones with what each supplier cost this year and last. WORK → DOCUMENT keeps every CV, letter and email I write, with older versions.' },
  // [lens] THE NEXT ROUND: the camera as the front door
  { day: '2026-11-14', title: 'Two packets side by side', line: 'Scan one packet, then another, and say “which is better”: the two side by side per 100 g, the better figure marked, from the open food databases.' },
  { day: '2026-11-14', title: 'What a heater costs to run', line: 'Point the Lens at an appliance’s rating plate: about what an hour costs at full power, at your own price per unit if you set it. Always a first estimate.' },
  { day: '2026-11-14', title: 'A medicine box to its NHS page', line: 'Point the Lens at a medicine box: it reads it aloud, and OPEN THE NHS PAGE shows the NHS’s own public page about it. I never give medical advice.' },
  { day: '2026-11-14', title: 'Pages snap themselves', line: 'Lens → SCAN → DOCUMENT: hold the phone over a page and keep still. It finds the edges and takes the page by itself, then waits for you to turn to the next one. A stack becomes one PDF. AUTO turns it off.' },
  { day: '2026-11-14', title: 'Stars and planets in AIM', line: 'Hold the Lens up at the night sky in AIM: the Moon (and how full it is), the planets and the brightest stars are named over the picture, worked out on your phone with no internet. The SKY button hides them.' },
  { day: '2026-11-14', title: 'A business card into your contacts', line: 'Point the Lens at a business card: ADD TO CONTACTS hands its name, numbers and email to your phone’s contacts. It is made on the phone, and nobody is looked up.' },
  { day: '2026-11-14', title: 'The next buses from a stop sign', line: 'Point the Lens at a bus stop sign and say “when’s the next bus”: the times come up on the card, asked by the stop’s name, never by where you are.' },
  { day: '2026-11-14', title: 'Receipts and bills from the Lens', line: 'Point the Lens at a receipt: one tap puts it into this month’s spending, one more keeps its warranty. A bill goes into your bills, with a reminder two days before it is due.' },
  { day: '2026-11-14', title: 'A whole menu in English', line: 'Point the Lens at a menu in another language: each line’s English sits over that line, and the card lists every line with its English.' },
  { day: '2026-11-14', title: 'What you avoid, on every packet', line: 'Tell the Lens once what you are allergic to or avoid (“I’m allergic to peanuts”, “I’m vegan”): every packet you scan gets a red, amber or green line for you. The list stays on this phone.' },
  // [boot] the next round's opening (docs/build-plan/NEXT-BOOT.md)
  { day: '2026-11-14', title: 'The opening, your way', line: 'Settings → VOICE & HOME → THE OPENING: the full film, the short one, or the full film once a day; your own opening line; and how smoothly the last one ran. Say “short opening” or “director mode”.' },
  { day: '2026-11-14', title: 'An opening that knows your day', line: 'The opening now ends on what matters today: your next thing, a to-do due, or rain. After days away it says how long it has been, and “Sam’s turn” greets someone you introduced.' },
  // [keep] NEXT ROUND, MEMORY lane: a memory that keeps your word
  { day: '2026-11-14', title: 'I keep your word', line: 'Say “I’ll send Jo the photos tomorrow” and I remind you on the day; “I sent them” ticks it off. Memory → YOUR WORD lists what you said you’d do, where you put things and why you chose them.' },
  { day: '2026-11-14', title: 'Where you put it, even offline', line: 'Tell me “the spare key is in the blue tin”, then ask “where’s the spare key?” any time, with no signal too.' },
  { day: '2026-11-14', title: 'Your week, on Sundays', line: 'Sunday at 6 pm: what you asked about most, what you finished and what is still open. Ask “how was my week?” any day.' },
  { day: '2026-11-14', title: 'One search for all your things', line: 'Find covers your chats, documents, sheets, decks, the library, saved links and to-dos, landing on the paragraph, the cell or the slide. Three words in the “Go to, or ask” bar search them too.' },
  { day: '2026-11-14', title: 'Recall by the day you mean', line: '“What did I ask last March about the car?”, “what did I do yesterday?”, “what did I never get an answer to?”: answered from your own chats, on your phone.' },
  { day: '2026-11-14', title: 'Chase from the Brief', line: 'CHASE on an email that needs an answer holds it for two working days; chases due today show under it. Say “and again Monday” and a chase looks twice.' },
  // [ci] NEXT ci.u3
  { day: '2026-11-14', title: 'How quickly I answer out loud', line: 'System → SPEED now shows your spoken turns too: how soon my first word comes after you stop, and how soon I listen again after I finish. Timed on your phone, kept on your phone.' },
  // [learn, next round] learning that adapts and talks back (NEXT-LEARN.md)
  { day: '2026-11-14', title: 'Courses that pick up your mistakes', line: 'Each course’s map has TODAY: the lesson your answers say to look at again (a miss you were sure of counts most), with a quiz on just your misses.' },
  { day: '2026-11-14', title: 'Free classics for your shelf', line: 'Library → Add → CLASSICS: Project Gutenberg and Standard Ebooks’ newest, free. Each book’s size is said first, and it comes on your tap, on Wi-Fi.' },
  { day: '2026-11-14', title: 'Worked answers to study', line: 'Any paper in SCHOOL → STUDY THE WORKED ANSWERS: my full working a question at a time, kept on this phone. Higher stages now have practice papers.' },
  { day: '2026-11-14', title: 'Bedtime listening', line: 'In the reader: reading speed, a 15 or 30 minute sleep timer, and a voice for each book.' },
  { day: '2026-11-14', title: 'Speak another language, and quiz night', line: 'REHEARSE in Spanish, French and more, with gentle notes after; QUIZ NIGHT under COURSES hosts a quiz for friends at the table.' },
  // [comic] NEXT ROUND (comic.u2, u4, u5, u7)
  { day: '2026-11-14', title: 'Ghosty writes your comic', line: 'COMIC → MAKE: I write the story for your exact idea and the phone draws it with the same characters; drag balloons, people and sound effects with a finger, put your own photo behind a panel, and UNDO or REDO any change. Real CBR comics open too (the free RAR reader comes on your tap, on Wi-Fi), and MY WEEK AS A COMIC turns your agenda’s week into a comic to keep.' },
  // [see] the next round: an appointment to the whole journey, and the journey kept for no signal
  { day: '2026-11-14', title: 'Getting there, in one tap', line: 'An appointment with a place in AGENDA has GETTING THERE: when to leave, the weather when you arrive, the roads and public cameras on the way. Or ask “how do I get to my next appointment?”' },
  { day: '2026-11-14', title: 'God’s eye: one tap, every match', line: 'WHAT TO SHOW has COMMUTE, STORM and SKY at the top (or say “commute view”), and a search like “BAW” lists every matching flight, ship and city to pick from.' },
  { day: '2026-11-14', title: 'The world in your Brief', line: 'The morning Brief has THE WORLD: the threat level, road reports on your commute and a fresh picture from the public camera nearest home.' },
  { day: '2026-11-14', title: 'Rain radar, full screen', line: 'RAIN in God’s eye, or “rain radar”: the last two hours of rain over home played back, and a line saying if rain is coming in the next two hours.' },
  { day: '2026-11-14', title: 'Your own camera wall', line: 'Pin up to nine public cameras from God’s eye (PIN TO WALL on a camera’s card); WALL in the bar, or “my camera wall”, shows them all live.' },
  { day: '2026-11-14', title: 'Your journey with no signal', line: 'The last journey you planned stays on your phone: with no signal it opens on the offline map, its times marked as possibly out of date.' },
  // [ci] NEXT ci.u4
  { day: '2026-11-14', title: 'Screens rest when still', line: 'The quiet room behind the screens is drawn only as often as it moves, and the board games only when a piece or a highlight changes: a longer battery, a cooler phone, and no freeze just after a screen opens.' },
  // [ci] NEXT ci.u5
  { day: '2026-11-14', title: 'A soft tick when I hear you', line: 'When you finish speaking, a soft tick says I heard you, so you never wonder whether to say it again. It goes with the other sounds in Settings → VOICE & HOME.' },
  // [ci] NEXT ci.u1
  { day: '2026-11-14', title: 'I start talking sooner', line: 'On a long answer I start speaking as soon as its first sentence is written, while the rest is still coming, so you hear me about a third of a second sooner. The words are the same as before.' },
  // [security] NEXT ROUND, lane SECURITY: one tap to lock everything (security.u11)
  { day: '2026-11-14', title: 'One tap to lock everything', line: 'Settings → SECURITY → LOCK EVERYTHING, or say "lock everything": Telegram unpaired, nothing that publishes, sends, pays or ships runs, until your owner key unlocks it.' },
  // [security] NEXT ROUND, lane SECURITY: a few seconds to take it back (security.u5)
  { day: '2026-11-14', title: 'A few seconds to take it back', line: 'After you approve a send, a post, a payment or a publish, the card counts down four seconds with TAKE IT BACK before anything leaves.' },
  // [security] NEXT ROUND, lane SECURITY: Settings → Security
  { day: '2026-11-14', title: 'Every lock on one screen', line: 'Settings → SECURITY: sign-in, your backup, your keys’ lock, faces, Telegram, previews, the demo and the public doors, each green, amber or red; every APPROVE and NOT NOW listed; and steps for the fixes in your Cloudflare account.' },
  { day: '2026-11-14', title: 'Export everything', line: 'System → BACKUP: EXPORT EVERYTHING saves your documents as Word files, sheets as Excel, decks as PowerPoint, the workspace as Markdown and your memory as a document, in one zip.' },
  { day: '2026-11-14', title: 'A log of camera, mic and location use', line: 'Settings → PERMISSIONS lists every time the camera, the microphone or your location was actually used, and on which screen, kept on your phone.' },
  { day: '2026-11-14', title: 'Screens that got slower are flagged', line: 'System → STATUS, SPEED: a screen that opens slower on your phone since the last update is named, with how long it took before.' },
  { day: '2026-11-14', title: 'Everything I keep about you, one place', line: 'Settings → PRIVACY counts what I keep by kind (memory, places, faces, voices), each with its own key to forget it, and EXPORT MY MEMORY saves it all as one document.' },
  { day: '2026-11-14', title: 'Watch the offline brain improve', line: 'System → TRAINING draws every finished week’s test scores, on average and area by area, kept on your phone as each report arrives.' },
  { day: '2026-11-14', title: 'See what a restore brings back', line: 'RESTORE now shows each thing in the backup and whether it comes back, is joined with yours or is already the same, and you untick what you would rather keep.' },
  { day: '2026-11-14', title: 'A saver switch', line: 'Settings → SAVER holds big downloads and the background feeds until you turn it off, and lists what it held back. Say “turn on the saver”.' },
  { day: '2026-11-14', title: 'Your comics and games are backed up', line: 'The daily locked backup now carries the comics and the games you made, so they come back on a new phone like your documents do.' },
  { day: '2026-11-14', title: 'Your backup as a file', line: 'System → BACKUP: SAVE AS A FILE keeps the locked copy in Files or iCloud Drive, and OPEN A BACKUP FILE brings it back on any phone of yours.' },
  { day: '2026-11-14', title: 'A heads-up before things run out', line: 'I tell you once when a free allowance is nearly used up or a key stops working, with what to do; System → AI ROOM keeps the line.' },
  { day: '2026-11-14', title: 'How ready I am offline', line: 'System → OFFLINE READY: one number for how much of me works with no signal, and the one download that helps most, with its size. Ask “how ready are you offline?”.' },
  // [sites] NEXT ROUND sites.u8
  { day: '2026-11-14', title: 'One home page for your sites', line: 'Workshop → PUBLISHED PAGES: tick ON MY HOME PAGE on the pages you want, then PUBLISH MY HOME PAGE: one link listing only those, live after your APPROVE.' },
  // [sites] NEXT ROUND sites.u6
  { day: '2026-11-14', title: 'Change an app after it is made', line: 'Ask “add stretching to my habits app” or “change my water goal to 10”: the app changes at the same link after your APPROVE, and what you saved on your phone stays.' },
  // [sites] NEXT ROUND sites.s4 (with s3)
  { day: '2026-11-14', title: 'Documents and decks at their own link', line: 'In DOCS or PRESENTATIONS, EXPORT → PUT IT ON MY SITES: a clean read-only page (a deck swipes like a book), live after your APPROVE in the chat.' },
  // [sites] NEXT ROUND sites.u2
  { day: '2026-11-14', title: 'Undo for your pages', line: 'Every page you publish keeps its last three versions. Workshop → PUBLISHED PAGES → UNDO LAST UPDATE, or “undo my last update to the party page”, puts the one before back at the same link.' },
  // [sites] NEXT ROUND sites.u12
  { day: '2026-11-14', title: 'Your own photos on your sites', line: 'Workshop → PHOTOS FOR YOUR SITES: add your own photos, made smaller on your phone with their location removed. Say “build a website for my café with my photos” and they replace the stock pictures.' },
  // [voice lane] the next round: Talk to it your own way
  { day: '2026-11-14', title: 'Colour-blind safe, and a colour per screen', line: 'THE LOOK has a Colour-blind safe switch (or say “colour-blind mode on”): orange, sky blue and yellow, never red against green. “Make the money screen green” gives one screen its own colour.' },
  { day: '2026-11-14', title: 'Your way, in your languages', line: '“Pon música”, “gaana chalao”, “batti bujhao”, “qué tiempo hace”: everyday asks in Spanish, French and Urdu or Hindi reach the same things as the English. And “a bit softer blue” nudges my colour.' },
  { day: '2026-11-14', title: 'Notes, lights and Telegram, your way', line: '“Note: buy milk” is kept in Memory, marked “by you” when I’m sure it was your voice; “make the lights red” sets your bulbs with the app’s colour words; on Telegram, “give us a shout in ten” becomes a reminder.' },
  { day: '2026-11-14', title: 'Put it back, calm colours, your stations', line: '“Put it back” returns the look before; “calm colours”, “focus colours” or “lively colours” set a colour and look together; “call this my morning station”, then “put on my morning station”. When I’m not sure it’s you, I say why.' },
  { day: '2026-11-14', title: 'Private when others talk', line: 'When someone you introduced (or a voice I don’t know) asks about your money, health, messages or diary, I keep it to you; their other questions leave your private things out of my answer, and their turns stay out of your memory.' },
  { day: '2026-11-14', title: 'Every screen, your way', line: 'Every screen opens from everyday names (“bring up the game maker”, “open the translator”, “show me my portfolio”); amounts are understood exactly (“log half a litre”, “a quarter of an hour”); “how much paint for my lounge” opens Materials.' },
  { day: '2026-11-14', title: 'I learn your own words', line: 'Say something your own way, then tap the screen you meant: I offer to remember it, and next time it opens straight away. “My wordings” lists them, each with FORGET; nothing that sends or pays is ever learned.' },
  // [voice lane] the final round, unsaid until now
  { day: '2026-11-13', title: 'Say it your way, colours by name', line: '“Put some tunes on”, “log a pint” or “give us a shout in ten minutes” just work; “make it red” changes my colour, and every colour now has a plain name. Ask “do you know it’s me?” and I answer from what this phone heard.' },
  // NEXT ROUND, MAKE lane
  { day: '2026-11-14', title: 'Workbench projects and DIY jobs', line: 'Make → Workbench → PROJECTS: save every number as “the shed beam” and open it later just as it was. Say “put up a shelf” for the tools, materials, steps and a load check, each a first estimate.' },
  { day: '2026-11-14', title: 'The curve behind a Workbench answer', line: 'Make → Workbench: under the numbers, the shape of the answer: how a beam sags along its span, the power a car needs as it speeds up, a room’s heat month by month, the sun through the day. Each a first estimate, never certified.' },
  { day: '2026-11-14', title: 'Prices on your paint and flooring', line: 'Make → Space → MATERIALS: a typical UK price beside the paint, the flooring (laminate or carpet) and the skirting, the total, and SET AGAINST MY SPENDING to see it beside your usual month from your own statements. First estimates, never quotes.' },
  { day: '2026-11-14', title: 'Doors and windows from room photos', line: 'Make → Space → FROM PHOTO: after photos of the room, tap its outline where each door and window is. The sizes say ROUGH until you type one wall’s real length.' },
  { day: '2026-11-14', title: '3D made from words, even when the makers are busy', line: 'Make → 3D studio → MAKE: when the free makers are busy, your model waits on the phone and is made by itself while Ghosty is open; meanwhile it offers real models near it, and says when yours is ready.' },
  // [consistency] the list stopped at 31 Oct while every November landing went unsaid (FINAL-CONSISTENCY)
  { day: '2026-11-13', title: 'Seven editors under EDITORS', line: 'Make → EDITORS: documents, spreadsheets, presentations, the workspace, a photo editor, a video editor and GAME STUDIO, each a pill of its own, each kept on your phone.' },
  // [comic] the final round's comic, unsaid until now
  { day: '2026-11-13', title: 'Comics, read and made', line: 'Make → EDITORS → COMIC: read your own CBZ and PDF comics panel by panel, get free public-domain ones from the Internet Archive on Wi-Fi, and make a whole comic from an idea.' },
  { day: '2026-11-13', title: 'Photo and video, done properly', line: 'PHOTO opens RAW photos, cuts out a subject and removes an object; VIDEO steadies a clip, finds the best ones, cuts on the beat, reverses and ramps the speed. Every download waits for your tap on Wi-Fi.' },
  { day: '2026-11-13', title: 'Games of your own', line: 'GAME STUDIO makes a game from its own kit; it plays in the Arcade under MY GAMES. In the GYM you can play me at poker and WORDS too.' },
  { day: '2026-11-13', title: 'I can work on what you have open', line: 'Ask me about the deck, the video, the workspace or the game you have open: I read it, and any change I make is only proposed, marked for you to accept or reject.' },
  { day: '2026-11-13', title: 'Chat and Telegram in my own words', line: 'The chat, its states and the talk bar, and everything I say in Telegram, now in one plain voice.' },
  { day: '2026-11-13', title: 'THE WALL and THE EYE', line: 'THE WALL fits your words to the television; THE EYE draws the room as the wall, with the ask line at the biggest text.' },
  { day: '2026-11-13', title: 'Every screen says what is happening', line: 'Home, the packs, the Workshop, Settings, System, Links, the learning screens and the camera screens now say every wait and every problem in plain words, one line each.' },
  { day: '2026-11-13', title: 'Is it working?', line: 'Every ability has a mark for whether it works, the brain’s health is one tap away, and “that felt off” tells me to look.' },
  { day: '2026-11-13', title: 'The two looks', line: 'The orb now opens the Mind, and Grown up shows today with less on it. Both are whole screens of their own.' },
  { day: '2026-11-12', title: 'Training and the phone’s own parts', line: 'Training runs and reports in plain words; the phone’s camera, microphone, motion and battery are used where they help; the speaker is only ever you or people you introduce.' },
  { day: '2026-11-11', title: 'The map and God’s Eye', line: 'The map is a screen of its own, and the Eye shows every camera and what I can see in one view.' },
  { day: '2026-11-07', title: 'Looks that mean something', line: 'Settings → THEME: seven whole looks and twelve colours. Grounds, switches and presets are on THE LOOK → THEMES, and every one answers to your words (“paper”, “glow off”).' },
  { day: '2026-11-01', title: 'The Arcade and LIFE', line: 'The Arcade plays real classics, free, kept on your phone. LIFE holds eight everyday screens: money, body, kitchen, people, work, creative, outside and home.' },
  { day: '2026-10-31', title: 'Sources, weighed', line: 'Cited answers now say how far each source can be trusted (PRIMARY, CREDIBLE, PRESS, REFERENCE, LEAD) and label every claim: established fact, documented allegation, contested, rumour. Questions about genocide, war crimes, the courts or a cover-up are cited without asking, and the morning digest now reads the UN, the ICC, GOV.UK and the investigative newsrooms too.' },
  { day: '2026-10-31', title: 'The Workbench', line: 'Make → Workbench: first engineering estimates on your phone — a live wind tunnel (draw your own shape), beams, gears, engines, wings and cars, orbits, heat loss, sun and shadow, circuits. Every number says how it was worked out, and that it is a first estimate, never certified.' },
  { day: '2026-10-24', title: 'One look, your colour', line: 'The new look arrived. Settings → Theme changed its colour: Reactor, the cyan you know, or Graphite, a cooler and quieter steel (since 7 Nov: seven looks and twelve colours). Mind and every screen follow at once.' },
  { day: '2026-10-23', title: 'A new look', line: 'Calm glass, one light, and live instruments around the reactor: free AI left today, the library, school and the link to the brain.' },
  { day: '2026-10-23', title: 'His mind on Home', line: 'The centrepiece of Home is a 3-D hologram of what he knows and does, drawn from his real counts; the reactor stands in where a phone cannot draw it.' },
  { day: '2026-10-23', title: 'Ghosty goes to school', line: 'The SCHOOL tab (Learn): stages from nursery up, papers he sits on this phone, marked exactly, top grades unlock the next stage.' },
  { day: '2026-10-23', title: 'Home shows your day', line: 'Today’s diary, the roads near you and the Gym on the first screen; the Me sheet opens on a Status card with three dials.' },
  { day: '2026-10-23', title: 'Tidier lists and messages', line: 'Settings, System and Links never cut a word in half; at most two short messages pop up at once, tap one for all of it.' },
  { day: '2026-10-23', title: 'Gym: he carries on by himself', line: 'WATCH keeps playing round after round, TRAIN ALL trains every game in turn, KEEP AWAKE holds the screen on while he trains.' },
  { day: '2026-10-23', title: 'Study at scale', line: 'Self-study reads one field at a time, hundreds of topics a day, from a curriculum that grows on its own.' },
  { day: '2026-10-23', title: 'Sturdier weekly training', line: 'The offline brain’s weekly training on Kaggle checks the free GPU time first and recovers from a failed run.' },
];

/**
 * [consistency] u2, WHAT'S NEW WRITES ITSELF: every ability arrives in the catalogue with the day it came (its `since`), so the list
 * says the new ones by itself, a line a day for the last fortnight, even when no one wrote a line by hand.
 */
export const AUTO_DAYS = 14;
export function fromCatalogue(now = Date.now()): NewThing[] {
  const from = new Date(now - AUTO_DAYS * 86_400_000).toISOString().slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  const byDay = new Map<string, string[]>();
  for (const v of Object.values(CATALOGUE)) {
    if (!v || isSame(v) || !v.since || v.since < from || v.since > today) continue;
    byDay.set(v.since, [...(byDay.get(v.since) ?? []), v.name]);
  }
  // (an ability that already has its own line by hand that day is said once, there)
  const said = new Set(WHATS_NEW.map((x) => `${x.day}|${x.title.toLowerCase()}`));
  return [...byDay].map(([day, names]) => [day, [...new Set(names)].filter((x) => !said.has(`${day}|${x.toLowerCase()}`))] as const).filter(([, n]) => n.length).map(([day, n]) => {
    return { day, title: n.length === 1 ? 'Something new I can do' : `${n.length} new things I can do`, line: `${n.slice(0, 5).join(', ')}${n.length > 5 ? `, and ${n.length - 5} more` : ''}. Ask me “can you …?” about any of them.` };
  });
}

/** What the Workshop shows: the lines written by hand, then each day's new abilities said by the catalogue, newest first (in place,
 *  so every lane keeps adding its lines to the one list above as before). */
WHATS_NEW.push(...fromCatalogue());
WHATS_NEW.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));

const KEY = 'ghosty.whatsNew';

/** Whether this build's list is still to be shown here. */
export function whatsNewDue(): boolean {
  try {
    return localStorage.getItem(KEY) !== BUILD.sha;
  } catch {
    return true;
  }
}

/** Seen: not shown again until the next build. */
export function whatsNewSeen(): void {
  try {
    localStorage.setItem(KEY, BUILD.sha);
  } catch {
    /* storage unavailable: shown again next visit */
  }
}
