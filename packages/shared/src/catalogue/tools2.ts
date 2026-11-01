/**
 * The catalogue's words for the brain's tools, part 2 (traffic and roads, crime, maps, email, radio, the library, phone
 * notifications, pictures, Spotify, my handbook and lessons, upgrading myself, taking software apart, my own code,
 * projects). Keyed `tool:<name>`. Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

export const TOOLS_2: Record<string, CatValue> = {
  // ---- traffic and roads
  'tool:show_cameras': {
    name: 'Live road cameras', line: 'I can show you live public road cameras on God’s eye: the West Midlands motorways, London, New York and more.',
    more: 'Official public cameras only, stills that refresh every half minute or so. Some cities, Birmingham’s streets for one, have none: then I say so and show the nearest motorway camera.',
    say: ['Show me the cameras on the M6', 'Any cameras in central London?'], scene: ['out', 'morning'], cat: 'see', where: 'God’s eye',
  },
  'tool:traffic_now': {
    name: 'Traffic right now', line: 'I can show you the traffic around any place right now: jams, hazards and crashes drivers report.',
    more: 'The live traffic map opens on God’s eye, with any public cameras nearby. With a free TomTom key I also give the speed on the main road against normal.',
    say: ['How’s the traffic in Birmingham?', 'Is the A38 jammed?'], scene: ['out', 'morning'], cat: 'see', where: 'God’s eye', needs: ['key:tomtom'],
  },
  'tool:street_view': {
    name: 'Street View of any place', line: 'I can open Street View anywhere, so you can look around and walk down the street.',
    more: 'Google’s panoramas, free, with satellite and live traffic a tap away. The pictures were taken some time ago, not live.',
    say: ['Show me Street View of Buckingham Palace', 'What does Broad Street look like?'], scene: ['out'], cat: 'see', where: 'God’s eye',
  },
  'tool:motorway_now': {
    name: 'Motorway incidents, worst first', line: 'I can list what is happening on the motorways near you: crashes, queues, closures, and when they clear.',
    more: 'National Highways’ live reports, worst first, with the delay and lanes closed, pinned on God’s eye.',
    say: ['What’s happening on the M6?', 'Any delays on the M5?'], scene: ['out', 'morning'], cat: 'see', where: 'God’s eye',
  },
  'tool:transit_now': {
    name: 'Buses and trams near you', line: 'I can show the buses and trams running near a place right now, and whether yours is late.',
    more: 'Live on God’s eye. West Midlands buses and trams with a free TfWM key, any bus in England with a free Bus Open Data key, else a community feed. Not trains.',
    say: ['What buses are running in the city centre?', 'Is the 11A late?'], scene: ['out'], cat: 'see', where: 'God’s eye', needs: ['key:tfwm', 'key:bods'],
  },
  // ---- crime
  'tool:crime_near': {
    name: 'Street crime near a place', line: 'I can tell you the reported street crime within a mile of a place: what kind, which streets, how cases ended.',
    more: 'From police.uk’s open data for England, Wales and Northern Ireland, about two months behind. Nobody is ever identified.',
    say: ['How safe is Digbeth?', 'Crime near my new flat'], scene: ['watching', 'out'], cat: 'watch',
  },
  // ---- maps
  'tool:show_map': {
    name: 'Flat and 3-D maps', line: 'I can open a map of anywhere: streets, satellite, cycle routes, rail lines or rain, flat or in 3-D.',
    more: 'Free maps with no key. With a free Mapbox token you get a few more styles, live traffic colours among them.',
    say: ['Show me a map of Birmingham', 'Show the rail lines around Leeds', 'Open a 3-D map of London'], scene: ['out'], cat: 'see', where: 'God’s eye', needs: ['key:mapbox'],
  },
  'tool:what_is_here': {
    name: 'What is this place?', line: 'I can tell you what is at a place: its address, its postcode, its council and the landmarks nearby.',
    more: 'From OpenStreetMap and Wikipedia, with the map opened there and the landmarks pinned.',
    say: ['What’s at the Bullring?', 'Tell me about where I am'], scene: ['out'], cat: 'know',
  },
  'tool:elevation': {
    name: 'How high a place is', line: 'I can tell you how high any place is above sea level, in metres and feet.',
    more: 'From a free terrain model, for any place you name.',
    say: ['How high is Snowdon?', 'What’s the altitude here?'], scene: ['out'], cat: 'know',
  },
  'tool:uk_postcode': {
    name: 'Look up a postcode', line: 'I can look up any UK postcode: where it is, its council, ward and constituency.',
    more: 'Or the other way round: the postcode of a place you name. Free, from the public postcode list.',
    say: ['Where is B1 1AA?', 'What’s the postcode of the Bullring?'], scene: ['out', 'money'], cat: 'know',
  },
  'tool:measure_distance': {
    name: 'Distance as the crow flies', line: 'I can measure the straight-line distance and compass bearing between two places, drawn on the map.',
    more: 'As the crow flies. For the road distance and time, ask me for directions.',
    say: ['How far is London from Birmingham as the crow flies?'], scene: ['out'], cat: 'know',
  },
  // ---- email
  'tool:check_email': {
    name: 'Check your email', line: 'I can check your inbox for new emails and tell you who they are from.',
    more: 'Once your email is linked I read the newest unread ones. Nothing is marked as read.',
    say: ['Any new emails?', 'Check my email'], scene: ['morning', 'money'], cat: 'talk', needs: ['link:email'],
  },
  'tool:search_email': {
    name: 'Search your email', line: 'I can search your email by who sent it, what it says or when.',
    more: 'The newest matches first, with sender and subject. Then I can open the one you want.',
    say: ['Find emails from Amazon', 'Any emails about my order this week?'], scene: ['money'], cat: 'talk', needs: ['link:email'],
  },
  'tool:read_email': {
    name: 'Read an email to you', line: 'I can open an email and read it to you, or tell you what it wants.',
    more: 'It stays unread in your inbox unless you ask me to mark it.',
    say: ['Read me the newest email', 'What does the email from the council say?'], scene: ['money'], cat: 'talk', needs: ['link:email'],
  },
  'tool:send_email': {
    name: 'Send an email for you', line: 'I can write and send an email from your address, but only after you approve it.',
    more: 'I draft it, you see exactly what goes and to whom, and nothing is sent until you tap APPROVE. Replies keep the thread.',
    say: ['Email Sam to say I’m running late', 'Reply to the council email'], scene: ['money'], cat: 'talk', needs: ['link:email'],
    go: { ask: 'Email ', send: false },
  },
  // ---- radio
  'tool:play_radio': {
    name: 'Play any radio station', line: 'I can play internet radio from anywhere: a station by name, or a kind of music.',
    more: 'Thousands of stations, searched by name, genre or country. It plays in the app, and quietens while I speak.',
    say: ['Play some jazz', 'Play BBC Radio 1', 'Play Polish radio'], scene: ['playing'], cat: 'play',
  },
  'tool:stop_audio': {
    name: 'Stop the music', line: 'I can stop the radio or anything playing in the app.',
    more: 'Say stop and it goes quiet at once; nothing else is touched.',
    say: ['Stop the radio', 'Stop the music'], scene: ['playing'], cat: 'play',
  },
  // ---- the library
  'tool:library_search': {
    name: 'Search my library', line: 'I can search my library: every book, PDF, note and paper you gave me, and the ones I started with.',
    more: 'The passages that fit best, each with where it came from. It costs no AI, and I use it myself before I answer.',
    say: ['What does my library say about black holes?', 'Find the bit about compound interest'], scene: ['school'], cat: 'learn',
  },
  'tool:library_import': {
    name: 'Add things to my library', line: 'I can add a page, a paper, a whole book or a code project to my library for good.',
    more: 'A web page, a science paper, a security advisory, a public GitHub project or a free classic book, read in and kept, with no AI needed.',
    say: ['Add this page to your library: (a link)', 'Read Pride and Prejudice into your library'], scene: ['school'], cat: 'learn',
    go: { ask: 'Add to your library: ', send: false },
  },
  'tool:library_list': {
    name: 'What is in my library', line: 'I can list what is in my library and how big each piece is.',
    more: 'Everything I have read in. The Library screen shows the same on its SHELF.',
    say: ['What’s in your library?'], scene: ['school'], cat: 'learn',
  },
  'tool:study_progress': {
    name: 'How my studies are going', line: 'I can tell you what I have been studying by myself: what I read, digested and drilled.',
    more: 'By subject and skill, with today’s counts and what is next.',
    say: ['How are your studies going?', 'What have you been learning?'], scene: ['school', 'behind'], cat: 'learn',
  },
  'tool:focus_study': {
    name: 'Steer what I study', line: 'I can put any subjects first in my self-study, then carry on with the rest.',
    more: 'Name the subjects and they jump the queue; say "none" to clear it.',
    say: ['Focus your studies on quantum computing', 'Study economics first'], scene: ['school'], cat: 'learn',
    go: { ask: 'Focus your studies on ', send: false },
  },
  'tool:library_export': {
    name: 'Export my notebooks', line: 'I can export my study notes to your own GitHub project, so you can read them anywhere.',
    more: 'As plain documents on a branch of your own repository, forty at a time.',
    say: ['Export your notebooks to GitHub'], scene: ['school', 'behind'], cat: 'learn', needs: ['key:github'],
    go: { ask: 'Export your notebooks to GitHub', send: false },
  },
  // ---- notifications
  'tool:push_to_phone': {
    name: 'Ping your phone', line: 'I can send a notification to your phone right now, with anything you want to keep.',
    more: 'It also stays in Agenda → NOTIFICATIONS. For later, a reminder is better.',
    say: ['Ping my phone with the shopping list', 'Let me know when you’re done'], scene: ['talking'], cat: 'talk', needs: ['link:push'],
  },
  // ---- pictures
  'tool:make_picture': {
    name: 'Draw a picture', line: 'I can draw you a picture from a few words: an illustration, a logo, a poster, a wallpaper.',
    more: 'I write the full scene out myself and it appears in the chat in a few seconds; on Telegram it comes as a photo. Its link lasts seven days, so save the ones you like.',
    say: ['Draw a fox in a misty forest at dawn', 'Make me a logo for a barber shop'], scene: ['making'], cat: 'build',
  },
  // ---- Spotify
  'tool:spotify_now_playing': {
    name: 'What’s playing on Spotify', line: 'I can tell you what is playing on your Spotify: the song, the artist, the device.',
    more: 'Once Spotify is linked, any time, on whatever device is playing.',
    say: ['What’s this song?', 'What’s playing?'], scene: ['playing'], cat: 'play', needs: ['link:spotify'],
  },
  'tool:spotify_control': {
    name: 'Pause, skip, louder', line: 'I can pause, skip, shuffle, repeat or turn your Spotify up and down.',
    more: 'Say it and it happens on whatever device is playing. Spotify only allows this with Premium.',
    say: ['Pause the music', 'Skip this one', 'Turn it up'], scene: ['playing'], cat: 'play', needs: ['link:spotify', 'premium'],
  },
  'tool:spotify_play': {
    name: 'Play a song or playlist', line: 'I can play any song, album, artist or playlist on your Spotify.',
    more: 'I find the best match and start it, on a named speaker if you say one.',
    say: ['Play Bohemian Rhapsody', 'Play my Chill playlist', 'Play some Drake'], scene: ['playing'], cat: 'play', needs: ['link:spotify', 'premium'],
  },
  'tool:spotify_queue': {
    name: 'Queue a song', line: 'I can add a song to your Spotify queue to play next.',
    more: 'It plays after the one on now, on the same device.',
    say: ['Queue Mr Brightside', 'Play this song next'], scene: ['playing'], cat: 'play', needs: ['link:spotify', 'premium'],
    go: { ask: 'Queue ', send: false },
  },
  'tool:spotify_playlists': {
    name: 'Your Spotify playlists', line: 'I can list your Spotify playlists, so you can pick one to play.',
    more: 'Each with who made it and how many songs, so you can pick one to play.',
    say: ['What playlists have I got?'], scene: ['playing'], cat: 'play', needs: ['link:spotify'],
  },
  'tool:spotify_devices': {
    name: 'Where Spotify can play', line: 'I can tell you which phones, computers and speakers Spotify can play on right now.',
    more: 'And which one is playing, so I can start music on the right speaker.',
    say: ['What can Spotify play on?', 'Play it on the kitchen speaker'], scene: ['playing'], cat: 'play', needs: ['link:spotify'],
  },
  // ---- my handbook and lessons
  'tool:study': {
    name: 'Read my handbook first', line: 'I read my own handbook before I build something, so it is done the right way for my code.',
    more: 'Step-by-step notes for building screens, tools, games and fixes. I use it myself; you can ask what it says.',
    say: ['What does your handbook say about widgets?'], scene: ['behind', 'making'], cat: 'learn',
  },
  'tool:learn_lesson': {
    name: 'Learn from my mistakes', line: 'I keep a lesson every time I get something wrong, so I never repeat the mistake.',
    more: 'One or two sentences: what went wrong, then the rule. Only from my own work, never from the web. Memory → LESSONS LEARNED shows them.',
    say: ['Learn this: always test the page on a phone first'], scene: ['behind'], cat: 'learn',
    go: { ask: 'Learn this lesson: ', send: false },
  },
  'tool:list_lessons': {
    name: 'The lessons I learned', line: 'I can list the lessons I learned from my own mistakes.',
    more: 'Each with its rule. Memory → LESSONS LEARNED shows the same.',
    say: ['What lessons have you learned?'], scene: ['behind'], cat: 'learn',
  },
  'tool:forget_lesson': {
    name: 'Drop a wrong lesson', line: 'I can drop a lesson that turned out to be wrong or out of date.',
    more: 'Name it in your own words and it goes from what I keep to.',
    say: ['Forget the lesson about tests'], scene: ['behind'], cat: 'learn',
    go: { ask: 'Forget the lesson about ', send: false },
  },
  // ---- upgrading myself
  'tool:self_audit': {
    name: 'Look at myself honestly', line: 'I can look myself over: what I can do, my screens, my lessons, and what I could do better.',
    more: 'The first step before any upgrade. Ask and I tell you plainly where I am weak.',
    say: ['What could you do better?', 'Audit yourself'], scene: ['behind'], cat: 'learn',
  },
  'tool:plan_upgrade': {
    name: 'Plan an upgrade to myself', line: 'I can plan a big upgrade to myself as small steps that each work on their own.',
    more: 'Two to twelve steps, each one shippable. Then I build them one by one, each waiting for your yes.',
    say: ['Plan an upgrade to make you faster', 'Make a better version of yourself'], scene: ['behind', 'making'], cat: 'learn', needs: ['key:github'],
    go: { ask: 'Plan an upgrade to ', send: false },
  },
  'tool:roadmap': {
    name: 'Where my upgrade has got to', line: 'I can tell you where my upgrade has got to and what the next step is.',
    more: 'Say "carry on" and I start the next step.',
    say: ['How’s the upgrade going?', 'Carry on with the upgrade'], scene: ['behind'], cat: 'learn', where: 'Workshop → UPGRADE ROADMAP, or ask me',
  },
  'tool:update_step': {
    name: 'Mark my upgrade’s progress', line: 'I can mark each step of my upgrade as started, done or stuck, with a note why, so the roadmap always tells the truth.',
    more: 'I do it as I work: a step is done once its change has shipped, and a stuck one says what blocked it. You see it under UPGRADE ROADMAP.',
    say: ['Mark step 2 of the upgrade as done', 'Step 3 is stuck: it needs a key'], scene: ['behind'], cat: 'learn', where: 'Workshop → UPGRADE ROADMAP, or ask me',
    go: { open: 'workshop', panel: 'UPGRADE ROADMAP' },
  },
  // ---- taking software apart
  'tool:reverse_engineer': {
    name: 'See how any software works', line: 'I can take apart a website, an app package, a code project or a file to see how it works.',
    more: 'It runs on GitHub’s free machines and takes three to eight minutes; the report comes when it is done. Only software you own or may test.',
    say: ['How does this website work? (a link)', 'Take this app apart'], scene: ['making'], cat: 'build', needs: ['key:github'],
    go: { open: 'reverse' },
  },
  'tool:reverse_status': {
    name: 'How a take-apart is going', line: 'I can check on a take-apart job and read you its report when it is done.',
    more: 'The latest one, or one you name; the report comes in plain words.',
    say: ['Is the report ready?', 'How’s the take-apart going?'], scene: ['making'], cat: 'build', needs: ['key:github'],
  },
  'tool:reverse_jobs': {
    name: 'Everything I took apart', line: 'I can list every take-apart job and how each one went.',
    more: 'The Reverse screen keeps your reports too.',
    say: ['What have you taken apart?'], scene: ['making'], cat: 'build', needs: ['key:github'],
  },
  // ---- my own code
  'tool:repo_tree': {
    name: 'List my own code', line: 'I can list the files of my own code, all of it or one part, to find my way round before I change anything.',
    more: 'The live version, with the big data files left out. Looking never changes anything.',
    say: ['What files make up your chat screen?', 'List the files of your Brief'], scene: ['behind'], cat: 'build', needs: ['key:github'],
  },
  'tool:repo_read': {
    name: 'Read a file of my code', line: 'I can open any file of my own code and read it, the live version or a change I am working on.',
    more: 'I read before I change. The files that hold my deploy settings stay closed, even to me. Reading never changes anything.',
    say: ['Read me the file that draws the Brief'], scene: ['behind'], cat: 'build', needs: ['key:github'],
  },
  'tool:repo_read_many': {
    name: 'Read several files at once', line: 'I can read up to eight files of my own code in one go, so I see everything a change will touch first.',
    more: 'When I plan a change I read every file it touches together, then decide. Reading never changes anything.',
    say: ['Read the files behind the Brief and the chat bar'], scene: ['behind'], cat: 'build', needs: ['key:github'],
  },
  'tool:repo_search': {
    name: 'Search my own code', line: 'I can search my own code for a word, to find where something is made, with each line it is on.',
    more: 'I look through up to 30 files at a time, in the part of my code where it should be. Searching never changes anything.',
    say: ['Where in your code is the Brief made?', 'Search your code for the word boot'], scene: ['behind'], cat: 'build', needs: ['key:github'],
  },
  'tool:propose_change': {
    name: 'Change my own code', line: 'I can change my own code when you ask, as a preview you can try before anything goes live.',
    more: 'I make the change, my checks run (types, tests, a real browser), and you get a private preview. Nothing goes live until you ship it.',
    say: ['Add a dark mode switch to the Brief', 'Change your greeting'], scene: ['making', 'behind'], cat: 'build', needs: ['key:github'],
    go: { open: 'workshop', panel: 'TELL GHOSTY WHAT TO BUILD' },
  },
  'tool:update_change': {
    name: 'Fix a change before it ships', line: 'I can fix a change to myself while it waits for you, for example when its checks failed, and run the checks again.',
    more: 'The fix goes onto the same change and its preview. Nothing goes live until you ship it.',
    say: ['The checks failed, fix it', 'Make the button bigger on that change'], scene: ['behind'], cat: 'build', needs: ['key:github'], where: 'Workshop → PROPOSED CHANGES, or ask me',
    go: { open: 'workshop', panel: 'PROPOSED CHANGES' },
  },
  'tool:wait_for_checks': {
    name: 'Wait for my checks', line: 'I can wait for the checks on a change, up to about six minutes, and tell you exactly what failed, if anything.',
    more: 'The checks read my code for mistakes, run my tests and build me, and a real browser tries my screens. I wait by myself after every change and every fix.',
    say: ['Have the checks finished?'], scene: ['behind'], cat: 'build', needs: ['key:github'], where: 'Workshop → PROPOSED CHANGES, or ask me',
    go: { open: 'workshop', panel: 'PROPOSED CHANGES' },
  },
  'tool:change_status': {
    name: 'How one change is doing', line: 'I can check one change to myself: did its checks pass, the exact error if not, and its preview link.',
    more: 'Shipped or still waiting, with what it changes. Checking never changes anything.',
    say: ['Why did the checks fail on my change?', 'Is change 12 shipped?'], scene: ['behind'], cat: 'build', needs: ['key:github'],
  },
  'tool:list_changes': {
    name: 'Changes waiting for you', line: 'I can show you the changes to myself that are waiting for you, with how their checks went.',
    more: 'Each with its preview link. Ship it or bin it.',
    say: ['What changes are waiting?', 'Did the checks pass?'], scene: ['behind'], cat: 'build', needs: ['key:github'], where: 'Workshop → PROPOSED CHANGES, or ask me',
  },
  'tool:ship_change': {
    name: 'Ship a change to myself', line: 'I can put a finished change to myself live, once its checks pass and you approve it.',
    more: 'Always your tap first. If it turns out badly, I can roll back.',
    say: ['Ship it'], scene: ['behind'], cat: 'build', needs: ['key:github'],
    go: { open: 'workshop', panel: 'PROPOSED CHANGES' },
  },
  'tool:discard_change': {
    name: 'Bin a change', line: 'I can throw away a change to myself you do not want.',
    more: 'It is closed without going live, and nothing in me changes.',
    say: ['Bin that change'], scene: ['behind'], cat: 'build', needs: ['key:github'],
    go: { open: 'workshop', panel: 'PROPOSED CHANGES' },
  },
  'tool:list_versions': {
    name: 'My recent versions', line: 'I can list my recent live versions, newest first, with when each went live and what it changed.',
    more: 'So you can pick one to roll back to. Listing never changes anything.',
    say: ['What versions of you are there?', 'When were you last updated?'], scene: ['behind'], cat: 'build', needs: ['key:github'], where: 'Workshop → VERSIONS, or ask me',
  },
  'tool:restore_version': {
    name: 'Roll myself back', line: 'I can roll myself back to an earlier version if a change went wrong, after you approve it.',
    more: 'My recent versions are listed newest first; pick one and I go back to it.',
    say: ['Roll back to yesterday’s version', 'Undo your last update'], scene: ['behind'], cat: 'build', needs: ['key:github'], where: 'Workshop → VERSIONS, or ask me',
    go: { open: 'workshop', panel: 'VERSIONS' },
  },
  // ---- projects
  'tool:start_project': {
    name: 'Projects that run for days', line: 'I can take on a project too big for one go and work through it over days, on my own.',
    more: 'Three to twelve steps at the pace you pick, each result filed in my library, with a note when it is done. Research, a plan, an app, a report.',
    say: ['Research the best electric cars under £30k over the next few days', 'Plan a two-week trip to Japan, step by step'], scene: ['making', 'behind'], cat: 'do',
    go: { ask: 'Start a project: ', send: false },
  },
  'tool:project_status': {
    name: 'How my projects are going', line: 'I can tell you how each project is going, step by step, and what each step found.',
    more: 'Each project with its steps and what each found. The Workshop shows them too.',
    say: ['How’s the project going?'], scene: ['behind'], cat: 'do', where: 'Workshop → PROJECTS, or ask me',
  },
  'tool:pause_project': {
    name: 'Pause a project', line: 'I can pause a running project, so its steps stop until you tell me to carry on.',
    more: 'The newest running one, or the one you name. Nothing it found is lost.',
    say: ['Pause the project'], scene: ['behind'], cat: 'do',
    go: { ask: 'Pause the project', send: false },
  },
  'tool:resume_project': {
    name: 'Carry on with a project', line: 'I can carry on with a paused project from the step it reached, and try again a step that failed.',
    more: '"Carry on" picks the newest paused project; name another to pick that one. Its next step runs at once.',
    say: ['Carry on with the project', 'Resume the Japan trip project'], scene: ['behind'], cat: 'do',
    go: { ask: 'Carry on with the project', send: false },
  },
  'tool:cancel_project': {
    name: 'Stop a project for good', line: 'I can stop a project for good; what it found stays in my library.',
    more: 'Only when you ask. What it already found stays in my library.',
    say: ['Cancel the project'], scene: ['behind'], cat: 'do',
    go: { ask: 'Cancel the project ', send: false },
  },
};
