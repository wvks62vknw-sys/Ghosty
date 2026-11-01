/**
 * The catalogue's words for the brain's tools, part 1 (memory, web, the screen, widgets, video, school, the extras,
 * websites, the page check, the agenda, the weather, directions, journeys). Keyed `tool:<name>`; each read against the
 * tool's own code before it was written. Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

export const TOOLS_1: Record<string, CatValue> = {
  // ---- memory
  'tool:remember': {
    name: 'Remember things about you', line: 'I can remember what you tell me about yourself: people, plans, likes and the details that matter.',
    more: 'Say "remember…" and I keep it for good, with where it came from. Only what you tell me, never what I read online. Memory shows all of it, and you can edit, lock or forget any of it.',
    say: ['Remember that my sister is called Aisha', 'Remember I don’t eat pork', 'Remember my gym is on Broad Street'], scene: ['talking'], cat: 'know',
    go: { ask: 'Remember that ', send: false }, tryText: 'Starts “Remember that…” in the chat box for you',
  },
  'tool:forget': {
    name: 'Forget one thing', line: 'I can forget one thing I remembered about you, the moment you ask.',
    more: 'Tell me what to forget, in your own words, and it goes. Memory has UNDO for a few seconds if you change your mind.',
    say: ['Forget my old address', 'Forget what I said about Sam'], scene: ['talking'], cat: 'know',
    go: { ask: 'Forget that ', send: false }, tryText: 'Starts “Forget that…” in the chat box for you',
  },
  'tool:forget_everything': {
    name: 'Forget everything about you', line: 'I can wipe everything I remember about you, but only after you approve it.',
    more: 'It clears every fact I kept about you. I always ask first with an APPROVE button, and nothing goes without your tap.',
    say: ['Forget everything you know about me'], scene: ['talking'], cat: 'know',
    go: { open: 'memory', panel: 'WHAT I REMEMBER' }, tryText: 'Opens Memory (wiping it always asks you first)',
  },
  'tool:list_memory': {
    name: 'What I know about you', line: 'I can tell you everything I remember about you, any time you ask.',
    more: 'A plain list of what you have told me, newest first. Memory shows the same with where each came from, and lets you change it.',
    say: ['What do you remember about me?', 'What do you know about me?'], scene: ['talking'], cat: 'know',
  },
  // ---- the web
  'tool:web_search': {
    name: 'Search the web', line: 'I can look things up on the web: prices, news, opening times, anything that changes.',
    more: 'I search when it is something live or something I don’t know, and say where the answer came from. For things I already know, I just answer.',
    say: ['What’s the latest on the Champions League?', 'How much is a PS5 right now?', 'Is the Bullring open on Sunday?'], scene: ['talking'], cat: 'know',
  },
  'tool:web_fetch': {
    name: 'Read a web page for you', line: 'I can read any web page you give me and tell you what it says.',
    more: 'Paste a link and I read the page itself, then sum it up or answer your question about it. Pages that need a login stay closed to me.',
    say: ['Read this and sum it up: https://www.bbc.co.uk/news', 'What does this page say about prices?'], scene: ['talking'], cat: 'know',
  },
  // ---- the screen
  'tool:open_tab': {
    name: 'Open any screen for you', line: 'I can open any screen when you ask: God’s eye, the Brief, the Gym, anything.',
    more: 'Say the screen’s name and I take you there. Handy when you are talking to me rather than tapping.',
    say: ['Open God’s eye', 'Take me to the Brief', 'Open the Gym'], scene: ['talking'], cat: 'do',
  },
  'tool:fly_to': {
    name: 'Fly the globe anywhere', line: 'I can fly God’s eye to any place on Earth, by its name.',
    more: 'The globe swoops to the place you name, with whatever layers you have on. It is the real Earth from public data, not a live camera.',
    say: ['Fly to the Eiffel Tower', 'Show me Tokyo on the globe'], scene: ['out'], cat: 'see', where: 'God’s eye',
  },
  'tool:set_layer': {
    name: 'Show live layers on the globe', line: 'I can switch God’s eye layers on or off: planes, ships, satellites, quakes, rain radar, cameras.',
    more: 'Every layer is public live data: aircraft, satellites, earthquakes, rain radar, road cameras and more. Ships need a free key.',
    say: ['Show the planes on the globe', 'Turn on the rain radar', 'Hide the satellites'], scene: ['out'], cat: 'see', where: 'God’s eye', needs: ['key:aisstream'],
  },
  'tool:set_theme': {
    name: 'Change my colour', line: 'I can change my colour when you ask: Reactor’s bright cyan or Graphite’s quieter steel.',
    more: 'A theme changes my colour and nothing else: every screen keeps its layout. You can also tap it in Settings → THEME.',
    say: ['Switch to Graphite', 'Go back to Reactor'], scene: ['talking'], cat: 'talk',
    go: { open: 'settings', panel: 'THEME' },
  },
  'tool:set_sensor_mode': {
    name: 'Night vision on the globe', line: 'I can change how God’s eye looks: night vision, thermal, an old monitor or black and white.',
    more: 'Just a look over the globe, for fun or to pick things out. It does not change the data underneath.',
    say: ['Switch God’s eye to night vision', 'Make the globe look thermal', 'Back to normal view'], scene: ['out'], cat: 'see', where: 'God’s eye',
  },
  'tool:notify': {
    name: 'A note on your screen', line: 'I can put a short note on your screen while we talk.',
    more: 'A small message that pops up for a few seconds. For something that should reach your phone later, a reminder is better.',
    say: ['Put “call the garage” on my screen'], scene: ['talking'], cat: 'talk',
  },
  'tool:road_ahead': {
    name: 'The road ahead, live', line: 'I can follow your drive or walk on God’s eye and list what is ahead: incidents, cameras, buses.',
    more: 'The globe turns heading-up with you, using your phone’s own position, which never leaves the phone. It lists road incidents, safety cameras and buses in front of you. Not for steering by: keep your eyes on the road.',
    say: ['Show me the road ahead', 'Follow my drive'], scene: ['out'], cat: 'see', where: 'God’s eye → ROAD AHEAD', needs: ['location'],
  },
  'tool:reload_interface': {
    name: 'Reload the app', line: 'I can reload the app so a fresh change of mine shows straight away.',
    more: 'After I ship a change to myself, a reload puts the new version on your screen. Nothing you saved is lost.',
    say: ['Reload yourself', 'Refresh the app'], scene: ['behind'], cat: 'do',
    go: { ask: 'Reload yourself', send: false },
  },
  'tool:open_lens': {
    name: 'Open the camera for you', line: 'I can open the Lens in the right mode when you ask: read, translate, measure, name.',
    more: 'Say what you want the camera for and I open it ready. The Lens does its work on this phone.',
    say: ['Open the camera', 'Open the Lens to translate a sign', 'I want to measure something'], scene: ['camera'], cat: 'see', needs: ['camera'],
  },
  'tool:open_space': {
    name: 'Open the space planner', line: 'I can open the space planner with your room’s size already in it.',
    more: 'Tell me the room’s size and I open SPACE ready to place furniture to scale.',
    say: ['Open the space planner', 'Plan my bedroom, 4 by 3 metres'], scene: ['making'], cat: 'build',
  },
  // ---- widgets
  'tool:create_widget': {
    name: 'Make a little game or tool', line: 'I can make you a little game or tool that runs in the chat: snake, a timer, a calculator, a tracker.',
    more: 'I build it in one go and it appears in the chat, ready to use. It runs sealed off from everything else. If it is not right, tell me and I change it.',
    say: ['Make me a little snake game', 'Make me a pomodoro timer', 'Make a tip calculator'], scene: ['making', 'playing'], cat: 'build',
  },
  'tool:list_widgets': {
    name: 'The games and tools I made', line: 'I can list the little games and tools I have made you, so you can open one again.',
    more: 'Every widget I have installed, by name. The Workshop shows them too.',
    say: ['What widgets have I got?', 'Show me the games you made'], scene: ['making'], cat: 'build', where: 'Workshop → WIDGETS, or ask me',
  },
  'tool:delete_widget': {
    name: 'Remove a game or tool', line: 'I can remove a little game or tool I made, when you no longer want it.',
    more: 'Name it and it goes. This one cannot be undone, so I only do it when you ask.',
    say: ['Delete the snake game'], scene: ['making'], cat: 'build',
    go: { ask: 'Delete the widget called ', send: false },
  },
  // ---- video
  'tool:summarise_video': {
    name: 'Sum up a YouTube video', line: 'I can sum up a YouTube video for you, with the moments that matter linked to their times.',
    more: 'Paste a link and I read its captions: the gist, then the key moments, each opening the video at that second. Say "quiz me on this" and I make five flashcards from it. A video with no captions I cannot read.',
    say: ['Sum up this video: (paste the link)', 'Quiz me on this video'], scene: ['talking', 'school'], cat: 'know',
    go: { ask: 'Sum up this video: ', send: false }, tryText: 'Starts it in the chat box: paste the link',
  },
  // ---- school
  'tool:school_status': {
    name: 'How my school is going', line: 'I can tell you how my school is going: my stage, my grades and my weak spots.',
    more: 'The offline brain on your phone sits real exam papers, stage by stage. Ask and I say where it is, what it passed, and the gap to the best free online brains.',
    say: ['How’s school going?', 'What grades did you get?'], scene: ['school'], cat: 'learn',
  },
  'tool:sit_exam': {
    name: 'Start one of my exams', line: 'I can tell you how to start one of my exams, on your phone or on a free GPU.',
    more: 'Papers are sat from the SCHOOL screen: on your phone it takes a while and the screen stays busy. Any stage can be a placement test, so I skip what I already know.',
    say: ['How do I start an exam for you?', 'Sit your next paper'], scene: ['school'], cat: 'learn', needs: ['offline'],
  },
  // ---- the extras
  'tool:detect_crime': {
    name: 'An object spotter (not set up)', line: 'I have an object spotter for photos, but it needs a key there is no place for yet, so it does not work today.',
    more: 'It was added to me later and asks for a key that SYSTEM → KEYS does not offer, so it cannot run. The Lens’s SEE spots objects on your phone instead, and that works.',
    say: ['What’s in this photo?'], scene: ['camera'], cat: 'see',
    go: { run: 'open_lens', args: { mode: 'see' } }, tryText: 'Opens the Lens on SEE instead',
  },
  // ---- websites
  'tool:build_website': {
    name: 'Build a whole website', line: 'I can build a proper website for a business, an event or a person from one sentence, and put it online.',
    more: 'I plan the pages, write the words, pick the photos with their credits and check it all. It stays a draft until you say yes, then it gets its own free link. Forms open WhatsApp or email.',
    say: ['Build a website for my friend’s barber shop in Walsall', 'Make a site for my football team'], scene: ['making'], cat: 'build',
    go: { ask: 'Build a website for ', send: false },
  },
  'tool:build_app': {
    name: 'Make an app for your phone', line: 'I can make you a small app that installs on your Home Screen: a tracker, a list, a timer, flash cards.',
    more: 'One request and I build it, then publish it at a link you add to your Home Screen. It keeps what you save on your phone and works offline. I say what it does before it goes live.',
    say: ['Make me a habit tracker app', 'Make an app to track my gym sessions'], scene: ['making'], cat: 'build',
    go: { ask: 'Make me an app for ', send: false },
  },
  'tool:study_site': {
    name: 'Study a website to rebuild it', line: 'I can study any website, its layout, words and colours, so I can rebuild it better.',
    more: 'Step one of a rebuild: I read the page and its styles and see how it is made. Then I write an improved version and put it online for you.',
    say: ['Rebuild this site but better: https://example.com', 'How is this website made?'], scene: ['making'], cat: 'build',
  },
  'tool:publish_site': {
    name: 'Put a page online', line: 'I can put a page I made online at its own free link the moment you tap APPROVE.',
    more: 'A CV, a menu, an invitation, a landing page: one page, built for phones, on my own address, with no account or hosting to set up. I always give you the exact link.',
    say: ['Make a page for my party and put it online', 'Make me an online CV'], scene: ['making'], cat: 'build',
    go: { ask: 'Make me a one-page invitation for my birthday and put it online', send: false },
  },
  'tool:draft_site': { same: 'tool:publish_site' },
  'tool:list_sites': {
    name: 'The pages I put online', line: 'I can list every page I have put online for you, with its link.',
    more: 'Name, link, when and how big. Ask for a link again, an update, or for one to be taken down.',
    say: ['What have you published?', 'Give me the link to my CV again'], scene: ['making'], cat: 'build', where: 'Workshop → PUBLISHED PAGES, or ask me',
  },
  'tool:unpublish_site': {
    name: 'Take a page down', line: 'I can take a page down when you ask, so its link stops working.',
    more: 'Only when you ask, and only your own pages. Once it is down, the link stops working for everyone.',
    say: ['Take my party page down'], scene: ['making'], cat: 'build',
    go: { ask: 'Take down the page called ', send: false },
  },
  'tool:check_html': {
    name: 'Check a page before it goes out', line: 'I can check any page, app or game I made for problems before you see it: broken bits, errors, what is missing.',
    more: 'The same check that runs before anything is published: it lists each problem with its line. A page with errors is never put online.',
    say: ['Check the page you made me', 'Is my site broken anywhere?'], scene: ['making', 'behind'], cat: 'build',
  },
  // ---- the agenda
  'tool:set_reminder': {
    name: 'Remind you of anything', line: 'I can remind you of anything at the time you say, a birthday or the bins: once, or every day, week or month.',
    more: 'The reminder reaches your phone as a notification and sits in Agenda → NOTIFICATIONS. Timers and alarms work the same way.',
    say: ['Remind me at 5 to call Mum', 'Remind me of Mum’s birthday on 3 May', 'Set a timer for 20 minutes'], scene: ['morning', 'money'], cat: 'watch',
    go: { ask: 'Remind me ', send: false }, tryText: 'Starts “Remind me…” in the chat box for you', needs: ['link:push'],
  },
  'tool:schedule_task': {
    name: 'Do jobs on a schedule', line: 'I can do a job for you later or on a schedule and send you the result: a morning briefing, a price check.',
    more: 'I run it myself while you are away, with my web, weather and memory, and the result reaches your phone. Say how often and when; I ask you to approve it first.',
    say: ['Every weekday at 7:30 brief me on the weather and the news', 'At 6 tonight check if bitcoin is above 100k'], scene: ['morning', 'behind'], cat: 'do',
    go: { ask: 'Every weekday at 7:30, brief me on ', send: false },
  },
  'tool:list_scheduled': {
    name: 'Your reminders and my jobs', line: 'I can list your reminders and the jobs I run on a schedule, with when each is next.',
    more: 'Everything waiting on my clock that you asked for. Agenda → REMINDERS & TASKS shows the same.',
    say: ['What reminders have I got?', 'What jobs are you running for me?'], scene: ['morning'], cat: 'watch',
  },
  'tool:cancel_scheduled': {
    name: 'Cancel a reminder', line: 'I can cancel a reminder or a scheduled job when you no longer need it.',
    more: 'Tell me which one, in your own words, and it stops.',
    say: ['Cancel my bins reminder', 'Stop the morning briefing'], scene: ['morning'], cat: 'watch',
    go: { ask: 'Cancel my reminder about ', send: false },
  },
  'tool:add_event': {
    name: 'Put things in your diary', line: 'I can put an event in your diary, with a reminder before it if you like.',
    more: 'Tell me what and when; I add it to your Agenda and remind you beforehand if you ask.',
    say: ['Put the dentist in my diary for Thursday at 3', 'Put Sam’s birthday party in my diary for Saturday'], scene: ['morning', 'money'], cat: 'watch',
    go: { ask: 'Put in my diary: ', send: false },
  },
  'tool:remove_event': {
    name: 'Take things out of your diary', line: 'I can take an event out of your diary when plans change.',
    more: 'Only the events you added: a calendar you connected is never changed.',
    say: ['Take the dentist out of my diary'], scene: ['morning'], cat: 'watch',
    go: { ask: 'Take out of my diary: ', send: false },
  },
  'tool:list_agenda': {
    name: 'What’s on, today or this week', line: 'I can tell you what is on today, tomorrow or this week, from your diary and your calendars.',
    more: 'Your own events and the calendars you connected, in one list. Ask in the morning and you have your day.',
    say: ['What’s on this week?', 'What have I got tomorrow?'], scene: ['morning'], cat: 'watch',
  },
  'tool:add_calendar_feed': {
    name: 'Connect your calendars', line: 'I can read your Google, Outlook or Apple calendar if you give me its private link.',
    more: 'Read-only: I see your events, I never change them. The link is kept locked away and never shown again.',
    say: ['Connect my Google calendar'], scene: ['morning', 'money'], cat: 'watch',
    go: { open: 'agenda', panel: 'CALENDARS' },
  },
  'tool:list_calendar_feeds': {
    name: 'Which calendars are connected', line: 'I can tell you which calendars I am reading, by name.',
    more: 'Just the names: the links themselves stay secret.',
    say: ['Which calendars are connected?'], scene: ['money'], cat: 'watch',
  },
  'tool:remove_calendar_feed': {
    name: 'Disconnect a calendar', line: 'I can stop reading a calendar you connected.',
    more: 'Its events leave your Agenda. The calendar itself is untouched.',
    say: ['Disconnect my work calendar'], scene: ['money'], cat: 'watch',
    go: { open: 'agenda', panel: 'CALENDARS' },
  },
  // ---- the weather
  'tool:weather': {
    name: 'The weather anywhere', line: 'I can tell you the weather, the air quality and the next three days, here or anywhere.',
    more: 'Live from the forecast, for where you are or any place you name. The Brief has it hour by hour.',
    say: ['What’s the weather today?', 'Will I need an umbrella in Leeds tomorrow?'], scene: ['morning', 'out'], cat: 'know',
  },
  'tool:earthquakes': {
    name: 'Earthquakes around the world', line: 'I can list the earthquakes of the last day around the world, biggest first.',
    more: 'From the US Geological Survey, magnitude 2.5 and up. God’s eye can show them on the globe.',
    say: ['Any earthquakes today?', 'Was there a big quake anywhere?'], scene: ['watching'], cat: 'watch',
  },
  // ---- directions
  'tool:get_directions': {
    name: 'Directions by car, foot or bike', line: 'I can give you directions by car, on foot or by bike, drawn on the globe.',
    more: 'Distance, time and the main turns, from where you are or anywhere you say. No buses or trains here: ask for a journey for those.',
    say: ['How do I walk to New Street station?', 'Drive me to Birmingham Airport'], scene: ['out'], cat: 'do',
  },
  'tool:find_nearby': {
    name: 'Find places near you', line: 'I can find what is near you or near anywhere: a pharmacy, a petrol station, coffee.',
    more: 'From OpenStreetMap, nearest first. Opening hours are only as the map has them.',
    say: ['Find a pharmacy near me', 'Where’s the nearest petrol station?'], scene: ['out'], cat: 'do',
  },
  // ---- journeys
  'tool:plan_journey': {
    name: 'Plan a journey by bus or train', line: 'I can plan a door-to-door journey by bus, tram, train or ferry, with live times where they exist.',
    more: 'Up to five ways there, with when to leave, changes and walking, drawn on the map. It knows your saved places, so "get me home" works.',
    say: ['How do I get to Manchester by train?', 'Get me home by bus'], scene: ['out', 'morning'], cat: 'do',
    go: { run: 'journey_planner' }, tryText: 'Opens the journey planner',
  },
  'tool:next_departures': {
    name: 'Live train and bus times', line: 'I can look up the next trains, buses or trams from any stop or station, live where it is published.',
    more: 'The line, where it goes, the platform or stand, and whether it is on time. Say "here" for every stop near you.',
    say: ['When’s the next train from New Street?', 'Next buses from here'], scene: ['out', 'morning'], cat: 'do',
  },
};
