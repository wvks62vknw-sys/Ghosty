/**
 * The catalogue's words for the brain's registries: every tool (tools1–3.ts), Telegram's commands and what it does there
 * (apps/edge/src/tghelp.ts), the asks answered with no model (direct.ts), and every kind of job on the brain's clock
 * (schedule.ts JOB_KINDS); and, for each tool group, WHY I MIGHT USE IT MYSELF — its `when` (tools/index.ts TOOL_GROUPS)
 * said plainly. Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';
import { TOOLS_1 } from './tools1';
import { TOOLS_2 } from './tools2';
import { TOOLS_3 } from './tools3';
import { PACK_WORDS } from './packs';
import { SOCIAL_WORDS } from './social';

/** WHY I MIGHT USE IT MYSELF: when each tool group is in front of me (its `when`, in plain words). */
export const GROUP_WHY: Record<string, string> = {
  memory: 'Every time we talk: when you tell me something worth keeping, or ask what I know about you.',
  web: 'Whenever you ask about something live, or something I don’t know: prices, news, opening times.',
  ui: 'Whenever a screen would show it better than words: the globe, a map, the camera.',
  widgets: 'When you ask for a game, a timer, a calculator or a tracker.',
  video: 'When you send me a YouTube link, or ask about a video.',
  school: 'When you ask about my school, my exams, SATs, GCSEs or A-levels.',
  extra: 'When something you send fits one of the extras added to me since.',
  sites: 'When you ask for a website, a page, a CV, an invitation, or a link put online.',
  build: 'When I have built a page, an app or a game, and when you ask me to check, fix or polish one.',
  agenda: 'When you mention a reminder, an alarm, your diary, your plans, today, tomorrow or a time.',
  data: 'When you ask about the weather, rain, the temperature or earthquakes.',
  travel: 'When you ask for directions, how far something is, or a place nearby.',
  journeys: 'When you mention a train, a bus, a tram, getting somewhere or the next departure.',
  traffic: 'When you ask about traffic, road cameras, Street View, or seeing a place live.',
  roads: 'When you ask about motorways, junctions, roadworks, delays, or the buses running now.',
  crime: 'When you ask how safe somewhere is, or about crime and the police.',
  maps: 'When you ask for a map, a postcode, how high a place is, a distance, or what is at a spot.',
  email: 'When you mention email, your inbox or replying to someone.',
  media: 'When you ask for the radio, a station or music to listen to.',
  library: 'Every time a question of yours is one my library can help with.',
  'library-admin': 'When you ask me to save, import or read something into my library, or how my studies are going.',
  notify: 'When you ask me to ping your phone or let you know.',
  pictures: 'When you ask for a picture, a drawing, a logo or a wallpaper.',
  spotify: 'When you mention Spotify, a song, an album, a playlist, or skipping.',
  knowledge: 'When I am about to build something, and when I have learned from a mistake.',
  evolve: 'When you ask me to upgrade or improve myself, or to carry on with an upgrade.',
  reverse: 'When you ask how an app, a website or a file works under the hood.',
  repo: 'When you ask me to change my own code, ship a change or roll back.',
  projects: 'When a job is too big for one go and should run over days.',
  recon: 'When a website or a server address comes up, or you ask who runs or hosts one.',
  lens: 'When you send a picture’s link and ask where it is from, or the Lens asks me to name a plant.',
  scan: 'When a barcode number comes up, or you ask for a translation.',
  home: 'When you mention furniture, sizes, room layouts or a design review.',
  homeplan: 'When you describe a home or a room you want drawn.',
  photo: 'When you ask me to cut out a background, sharpen a photo or remove something from it.',
  places: 'When you tell me an address, or ask about your saved places.',
  spending: 'When you ask about spending, budgets, subscriptions or bills.',
  guardian: 'When you mention floods, storms, crime near you, a possible scam, or walking home.',
  foresight: 'When you ask what I think will happen.',
  workbench: 'When you ask an engineering question: beams, gears, engines, wings, heat or circuits.',
  vehicle: 'When a number plate, an MOT or a car check comes up.',
  gadgets: 'When you ask about a gadget’s settings, its manual, a fault code or a spare part.',
  '3d': 'When you ask for a 3-D model, or to take something apart.',
  learn: 'When you ask me to teach you, quiz you or test you.',
  money: 'When you talk about what you spent, a statement, fuel prices, a price to watch, subscriptions, payday or saving.',
  body: 'When you talk about exercise, reps, a run, steps, sleep, water, breathing, stretching or your weight.',
  kitchen: 'When you talk about dinner, your fridge, a recipe, a timer, the shopping list, the oven, or food going off.',
};

/** Telegram (tghelp.ts), the no-model asks (direct.ts) and the jobs on my clock (schedule.ts). */
const MORE: Record<string, CatValue> = {
  // ---- Telegram
  'telegram:start': {
    name: 'What I do on Telegram', line: 'You can send /start to my Telegram bot any time to see what I do there.',
    more: 'A short list of what works on Telegram and its commands. Screens like the globe and the camera only work in the app.',
    say: ['/start'], scene: ['talking'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  'telegram:status': {
    name: 'Am I ready? on Telegram', line: 'You can send /status on Telegram to see how many AI models are ready and how many keys are set.',
    more: 'One line back, with no AI needed: models ready and keys set.',
    say: ['/status'], scene: ['talking'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  'telegram:stop': {
    name: 'Stop me from Telegram', line: 'You can send /stop on Telegram, or just "enough", and I stop whatever I am doing.',
    more: 'A stop is obeyed at once and never answered back.',
    say: ['/stop', 'Enough'], scene: ['talking'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  'telegram:unpair': {
    name: 'Unpair your Telegram chat', line: 'You can send /unpair and I stop answering that Telegram chat for good.',
    more: 'To pair again, LINKS → TELEGRAM gives a new code.',
    say: ['/unpair'], scene: ['talking'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  'telegram:ask': {
    name: 'Talk to me on Telegram', line: 'You can talk to me on Telegram, by text or a voice note, and I answer there.',
    more: 'The same me, the same memory. Voice notes are heard and answered in words; I can send you a voice note back.',
    say: ['(any message, or a voice note)'], scene: ['talking', 'out'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  'telegram:photo': {
    name: 'Send me a photo on Telegram', line: 'You can send me a photo on Telegram with a question, and I look at it.',
    more: 'A photo, or a picture sent as a file. Videos I cannot watch yet: I go by one still frame and tell you so.',
    say: ['(a photo) What is this?'], scene: ['camera', 'talking'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  'telegram:forward': {
    name: 'Forward me a dodgy message', line: 'You can forward me a message on Telegram and I check it for a scam, with no AI needed.',
    more: 'A message with a link in it, or the shape of a scam, is checked from public records at once. I never call anything safe.',
    say: ['(forward the message)'], scene: ['watching'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  'telegram:notices': {
    name: 'My messages reach Telegram', line: 'I send your reminders and the results of my jobs to Telegram too.',
    more: 'Once paired, everything I would tell you on your phone also arrives in the chat, with buttons to approve when I ask.',
    say: ['(it comes by itself)'], scene: ['talking', 'behind'], needs: ['link:telegram'], go: { open: 'links', panel: 'TELEGRAM' },
  },
  // ---- the no-model asks
  'say:time': {
    name: 'Quick answers with no AI', line: 'I still answer the quick ones when no AI is free: the time, the weather, your day, the buses, the roads.',
    more: 'If every free AI is busy, I answer these straight from my own tools and say when the first AI is back. Anything else waits for it.',
    say: ['What time is it?', 'What’s on today?', 'Buses near me'], scene: ['talking', 'behind'], cat: 'talk',
  },
  'say:weather': { same: 'say:time' },
  'say:memory': { same: 'say:time' },
  'say:agenda': { same: 'say:time' },
  'say:transit': { same: 'say:time' },
  'say:roads': { same: 'say:time' },
  'say:greet': {
    name: 'Hello, thanks and goodnight', line: 'I answer hello, thanks, okay and goodnight straight away, like a person would, with no AI.',
    more: 'One short line back, never a menu. After I ask you something, "okay" or "yeah" is taken as your answer.',
    say: ['Hey', 'Thanks', 'Night'], scene: ['talking'], cat: 'talk',
  },
  'say:how': { same: 'say:greet' },
  'say:thanks': { same: 'say:greet' },
  'say:ack': { same: 'say:greet' },
  'say:night': { same: 'say:greet' },
  'say:bye': { same: 'say:greet' },
  'say:praise': {
    name: 'Tell me I did well', line: 'You can tell me I did well, and I take it in: it counts in my weekly training.',
    more: '"Good job", "spot on", "proud of you": I answer in a line, never gush, and it is kept with its weight.',
    say: ['Good job', 'Spot on', 'Proud of you'], scene: ['talking'], cat: 'talk', go: { ask: 'Good job', send: false },
  },
  'say:rule': {
    name: 'Give me a standing rule', line: 'You can give me a rule, like "shorter" or "don’t call me mate", and I keep to it from then on.',
    more: 'I say "Noted." and it becomes one of your standing rules, shown in Settings → CHARACTER.',
    say: ['Shorter', 'Stop calling me mate', 'Too long'], scene: ['talking'], cat: 'talk', go: { ask: 'Shorter', send: false },
  },
  // ---- the jobs on my clock
  'job:reminder': { same: 'tool:set_reminder' },
  'job:task': { same: 'tool:schedule_task' },
  'job:project': { same: 'tool:start_project' },
  'job:walk': { same: 'phrase:walk' },
  'job:verify': {
    name: 'I check my own changes', line: 'I check every change to myself after it goes live, and tell you if something broke.',
    more: 'Behind the scenes, a little after each change ships.',
    say: ['(it happens by itself)'], scene: ['behind'], cat: 'do', go: { open: 'workshop', panel: 'VERSIONS' },
  },
  // (each of these is also the panel that shows it: the panel's own item is `same` as the job, catalogue/app2.ts)
  'job:study': {
    name: 'I study by myself', line: 'I study by myself every day: I read my library, take notes and drill what I learned, with no AI.',
    more: 'Little and often, on my own schedule. SELF-STUDY shows the subject I am reading, how long is left, and what I learned today; pick a subject and I read it first.',
    say: ['How are your studies going?', 'Study history next'], scene: ['behind', 'school'], cat: 'learn', go: { open: 'library', panel: 'SELF-STUDY' }, where: 'Library → SELF-STUDY',
  },
  'job:reflect': {
    name: 'My nightly diary', line: 'I look back over our day each night and write my diary: what I learned about you, and what to do better.',
    more: 'Memory → DIARY has every entry, by day; REFLECT NOW writes one straight away.',
    say: ['Read me your diary'], scene: ['behind'], cat: 'know', go: { open: 'memory', panel: 'DIARY' }, where: 'Memory → DIARY',
  },
  'job:digest': {
    name: 'The morning digest', line: 'I gather the fresh news and papers from trusted sources into my library every morning.',
    more: 'From a fixed list of feeds, each marked with how far it can be trusted. FRESH TODAY shows them, the Brief reads them, and DIGEST NOW gathers them at once.',
    say: ['What’s fresh today?'], scene: ['morning', 'behind'], cat: 'know', go: { open: 'library', panel: 'FRESH TODAY' }, where: 'Library → FRESH TODAY',
  },
  'job:upgrade': {
    name: 'Ideas to improve myself', line: 'I write down ideas to improve myself every day, with the things you asked me to learn first.',
    more: 'They wait in UPGRADE IDEAS: BUILD hands one to me in the chat, DISMISS drops it. Nothing changes in me until you ask.',
    say: ['What upgrade ideas have you got?'], scene: ['behind'], cat: 'learn', go: { open: 'workshop', panel: 'UPGRADE IDEAS' }, where: 'Workshop → UPGRADE IDEAS',
  },
  'job:revise': {
    name: 'Revise your flashcards', line: 'I bring your flashcards back just before you would forget them, and remind you each morning some are due.',
    more: 'Spaced repetition: a card you know comes back later, one you missed comes back sooner. The morning note only comes when cards are due.',
    say: ['Revise my flashcards'], scene: ['morning', 'school'], cat: 'learn', go: { run: 'open_learn', args: { view: 'revise' } }, tryText: 'Opens your flashcards', where: 'Learn → STUDY',
  },
  'job:train': {
    name: 'My weekly training', line: 'I train the brain on your phone once a week on free GPUs, and only keep it if it got better.',
    more: 'It sits an exam before and after; if it did not improve, the old one stays. The panel says what it trained on, and which free key is missing.',
    say: ['How did your training go?'], scene: ['behind', 'school'], cat: 'learn', needs: ['key:kaggle', 'key:hfwrite'], go: { open: 'system', panel: 'OFFLINE BRAIN TRAINING' }, where: 'System → OFFLINE BRAIN TRAINING',
  },
  'job:guard': {
    name: 'Watching near your places', line: 'I check the public warnings near your saved places every hour, and tell you once when one starts.',
    more: 'Floods within 5 km, Met Office warnings, the latest month of street crime within a mile. The all-clear comes once too. CHECK NOW looks straight away.',
    say: ['Any warnings near home?'], scene: ['watching', 'behind'], cat: 'watch', needs: ['places'], go: { open: 'threats', panel: 'NEAR HOME' }, where: 'Threats → NEAR HOME',
  },
  'job:foresee': {
    name: 'My daily predictions', line: 'I predict the rain at home, your commute and your first train or bus each morning, and score myself.',
    more: 'Each is scored at its time by the live feeds alone, and your own questions by your word. FORESIGHT shows how often I am right.',
    say: ['What do you expect today?', 'How often are you right?'], scene: ['morning', 'behind'], cat: 'know', needs: ['home', 'work'], go: { open: 'brief', panel: 'FORESIGHT' }, where: 'Brief → FORESIGHT, and System',
  },
  'job:speak': {
    name: 'Speaking first, when it matters', line: 'I bring things up myself a few times a day at most: the morning, a car’s MOT month, a warning for a saved place.',
    more: 'At most four unprompted cards a day across the chat, push and Telegram, never two within two hours, nothing at night unless it is danger. Any stop word silences me for the rest of the day. SETTINGS → CHARACTER → SPEAK FIRST sets QUIET, SOME or CHATTY. WHY and "what did you do today" list every line I said first and why.',
    say: ['Why did you say that?', 'What did you do today?', 'Quiet.'], scene: ['morning', 'talking'], cat: 'talk',
    since: '2026-11-01',
  },
};

export const BRAIN_WORDS: Record<string, CatValue> = { ...TOOLS_1, ...TOOLS_2, ...TOOLS_3, ...MORE, ...PACK_WORDS, ...SOCIAL_WORDS };
