/**
 * The catalogue's words for the phone, part 3: the rest of the panels (School, Settings, Space, System, Threats, the
 * Workbench, the Workshop) and the Workbench's modes. Rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

export const APP_3: Record<string, CatValue> = {
  // ---- SCHOOL
  'panel:school:THE LADDER': {
    name: 'My school ladder', line: 'You can see every stage of my schooling, from nursery to university, and which I have passed.',
    more: 'Each stage stays locked until I pass the one below with top grades. Then the whole library is open to me.',
    say: ['What stage are you at?'], scene: ['school'], cat: 'learn',
  },
  'panel:school:THIS STAGE': {
    name: 'Watch me sit a paper', line: 'You can watch me sit a paper, question by question, on your phone.',
    more: 'It takes a while and the screen stays busy; my answers are kept as I go, so CARRY ON picks up after a close.',
    say: ['Sit your next paper'], scene: ['school'], cat: 'learn', needs: ['offline'],
  },
  'panel:school:PLACEMENT TEST': {
    name: 'A placement test', line: 'You can have me sit any stage’s exam straight away: a top-grade pass completes that stage at once.',
    more: 'So the stages I already know take minutes, not weeks, and training goes where I actually fail.',
    say: ['Give yourself a placement test'], scene: ['school'], cat: 'learn', needs: ['offline'],
  },
  'panel:school:WEAK SPOTS': {
    name: 'Where I lose marks', line: 'You can see where I lose marks, subject by subject, so you know what I am working on.',
    more: 'My weak spots feed what I practise next.',
    say: ['What are your weak spots?'], scene: ['school'], cat: 'learn',
  },
  'panel:school:RESULTS': {
    name: 'Every answer and its marks', line: 'You can read every answer I gave, its marks and the marker’s note.',
    more: 'Marked exactly where a question has one right answer, and against the mark scheme where it does not.',
    say: ['Show me your results'], scene: ['school'], cat: 'learn',
  },
  'panel:school:NIGHTLY REPORT': {
    name: 'A report every night', line: 'You can read a report every night on how my studies went.',
    more: 'What I practised, what improved, and what is next.',
    say: ['How did school go last night?'], scene: ['school', 'behind'], cat: 'learn',
  },
  'panel:school:OFFICIAL PAPERS': {
    name: 'Real SATs, GCSE and A-level papers', line: 'You can see the real exam papers I sit, fetched free from the exam boards’ own sites.',
    more: 'Kept private to you and never shared; each with its source and licence. Gaps are filled with papers I write in the same format.',
    say: ['Which real papers have you got?'], scene: ['school'], cat: 'learn',
  },
  'panel:school:READING': {
    name: 'My reading books', line: 'You can see the books I read at my stage, and the reading check that lets me borrow from older years.',
    more: 'Free classics and open textbooks by year group. Borrowing is earned: top marks in my own year first, a real comprehension check, two years ahead at most.',
    say: ['What are you reading?'], scene: ['school'], cat: 'learn',
  },
  // ---- SETTINGS
  'panel:settings:CHARACTER': {
    name: 'My manner: three dials', line: 'You can set how I talk: how dry, how brief, how warm, and how fiery when it matters.',
    more: 'The dials change my manner, never what I will or will not do. Your own rules for me are here too.',
    say: ['Be briefer', 'Be warmer'], scene: ['talking'], cat: 'talk',
  },
  'panel:settings:GUARDIAN': {
    name: 'The guardian: your person', line: 'You can name one person I message if you need help, and set a panic phrase only you know.',
    more: 'By their Telegram or your own email, never a text. The panic phrase is kept only as a scrambled copy; said anywhere, it messages them at once.',
    say: ['Set up walk me home'], scene: ['watching'], cat: 'watch',
    since: '2026-10-31',
  },
  'panel:settings:THEME': {
    name: 'Pick my colour', line: 'You can pick my colour: Reactor or Graphite, applied at once.',
    more: 'Each swatch is a little Home in that colour. Only the colour changes.',
    say: ['Switch to Graphite'], scene: ['talking'], cat: 'talk',
  },
  'panel:settings:NAME & UNITS': {
    name: 'Your name and units', line: 'You can tell me what to call you, and whether you think in °C and km or °F and miles.',
    more: 'Every screen and every answer follows your units.',
    say: ['Call me Boss', 'Use miles'], scene: ['talking'], cat: 'talk',
  },
  'panel:settings:VOICE & HOME': {
    name: 'My voice and your home', line: 'You can choose my voice, hear a sample, switch the sounds and tilt, and set your home city.',
    more: 'My own natural British voices or your phone’s. Talking over me to interrupt can be switched here too.',
    say: ['Change your voice'], scene: ['talking'], cat: 'talk',
  },
  'panel:settings:ABOUT': {
    name: 'Which version I am', line: 'You can see which version of me this is and when it was built.',
    more: 'The Me sheet says whether a newer version is ready.',
    say: ['What version are you?'], scene: ['behind'], cat: 'do',
  },
  'panel:settings:PRIVACY': {
    name: 'What is kept, and where', line: 'You can read plainly what I keep and where: your own account and this phone, nowhere else.',
    more: 'And the faces I know, kept only on this phone, each gone in one tap.',
    say: ['Where is my data kept?'], scene: ['phone', 'behind'], cat: 'do',
  },
  'panel:settings:HELP': {
    name: 'Four quick tips', line: 'You can read four quick tips: how to ask, search, see every screen, and make me remember.',
    more: 'Short and plain. This list has everything else.',
    say: ['How do I use you?'], scene: ['talking'], cat: 'talk',
  },
  'panel:settings:OFFLINE BRAIN': {
    name: 'A brain on your phone', line: 'You can download a small brain onto your phone, so I can answer with no signal and keep things private.',
    more: 'Off, only when there is no signal, or always: then nothing you ask leaves the phone. It shows how much of your week your own brains answered, and what still needed the cloud. The smallest is about 350 MB, on Wi-Fi; asked for once, never on its own.',
    say: ['Download the offline brain'], scene: ['phone'], cat: 'do', needs: ['wifi'],
  },
  // ---- SPACE
  'panel:space:FROM PHOTO': {
    name: 'A room plan from a photo', line: 'You can take a photo of a room and I draw a rough plan of it to start from.',
    more: 'A starting point: check the sizes with a tape or MEASURE.',
    say: ['Make a plan from this photo'], scene: ['making', 'camera'], cat: 'build', needs: ['camera'],
  },
  'panel:space:DESIGN MY HOME': {
    name: 'Describe your home', line: 'You can describe your home or a room in your own words and I draw the plan.',
    more: 'Sizes in any unit, upstairs as another floor. I say every size I had to assume.',
    say: ['My lounge is 5 by 4 metres with the door on the left'], scene: ['making'], cat: 'build',
    since: '2026-10-24',
  },
  'panel:space:ROOM PLAN': {
    name: 'Your room to scale', line: 'You can see your room to scale and drag furniture round it, with walkways and clashes marked red.',
    more: 'Gaps under 70 cm to walk through, and pieces that overlap, show in red. ROTATE and REMOVE are there too.',
    say: ['Plan my bedroom'], scene: ['making'], cat: 'build',
  },
  'panel:space:ROOMS · WALLS': {
    name: 'Doors, windows, L-shapes', line: 'You can give a room its real shape: doors, windows and L-shaped corners.',
    more: 'The plan, the review and the 3-D view all follow it.',
    say: ['Add a window on the back wall'], scene: ['making'], cat: 'build',
  },
  'panel:space:DESIGN REVIEW': { same: 'tool:design_review' },
  'panel:space:ADD FURNITURE': {
    name: 'Add furniture to the plan', line: 'You can add furniture in real UK sizes, or your own piece measured in cm.',
    more: 'Beds, sofas, desks, wardrobes and more, then drag them into place.',
    say: ['Add a double bed'], scene: ['making'], cat: 'build',
  },
  'panel:space:WILL IT FIT?': {
    name: 'Will it fit?', line: 'You can try a piece before you buy it and I find a spot where it fits, or say plainly it won’t.',
    more: 'Type its width and depth, or pick one from the shops, and I look for room for it.',
    say: ['Will a 220 cm sofa fit?'], scene: ['making', 'money'], cat: 'build',
  },
  'panel:space:MAKE SPACE': {
    name: 'Make more space', line: 'You can ask me for up to three better layouts of your room, each with what it frees up.',
    more: 'Moves only what can move, and keeps the walkways clear.',
    say: ['Make more space in my bedroom'], scene: ['making'], cat: 'build',
  },
  'panel:space:MEASURED': {
    name: 'Sizes from the camera', line: 'You can bring in the sizes you measured with the Lens and use them in the plan.',
    more: 'A wall or a sofa measured from a photo lands here.',
    say: ['Use what I measured'], scene: ['making', 'camera'], cat: 'build',
  },
  'panel:space:EXPORT': {
    name: 'Save or load a plan', line: 'You can save your plan as a picture or a file, and load a plan file back in.',
    more: 'PNG for a picture to share, JSON for a file you can import later. Importing has UNDO.',
    say: ['(tap PNG or JSON)'], scene: ['making'], cat: 'build',
  },
  // ---- SYSTEM
  'panel:system:FORESIGHT': { same: 'job:foresee' },
  'panel:system:STATUS': {
    name: 'How I am running', line: 'You can see whether I am online, connected, able to edit myself, and how fast I answer.',
    more: 'Live readings with the speed of my replies, on this phone and in my brain.',
    say: ['How fast are you today?'], scene: ['behind'], cat: 'do',
  },
  'panel:system:KEYS': {
    name: 'Your free keys', line: 'You can add free keys for more AI, live traffic, buses, MOTs and more, each with how to get it.',
    more: 'Every key is optional and free; each says what it adds. They are kept locked in my vault and never shown again.',
    say: ['What keys do you need?'], scene: ['behind'], cat: 'do',
  },
  'panel:system:AI MODELS': {
    name: 'Which free AI is answering', line: 'You can see which free AI models are answering, which are resting, and why.',
    more: 'I spread work across them so I never wait; when one runs out, the next takes over.',
    say: ['Which AI are you using?'], scene: ['behind'], cat: 'do',
  },
  'panel:system:AI ROOM': {
    name: 'Free AI left today', line: 'You can see how much free AI room is left today, provider by provider, and when it resets.',
    more: 'READY, BUSY, FULL or OUT TODAY for each. Another free key gives me more room.',
    say: ['How much AI have you got left today?'], scene: ['behind'], cat: 'do', needs: ['key:ai'],
  },
  'panel:system:STORAGE': {
    name: 'Keep my things on this phone', line: 'You can protect what I keep on this phone, so Safari never clears it after a week unused.',
    more: 'It says PROTECTED or AT RISK plainly; PROTECT asks the phone. Add me to your Home Screen first. Your daily backup can bring things back.',
    say: ['(tap PROTECT)'], scene: ['behind', 'phone'], cat: 'do',
  },
  'panel:system:BACKUP & RESTORE': {
    name: 'Back up this phone', line: 'You can back up everything on this phone every day, locked with your own password, and restore it.',
    more: 'An encrypted backup; without your password nobody can read it. Restore puts it all back on a new phone.',
    say: ['Back me up'], scene: ['phone', 'behind'], cat: 'do',
  },
  'panel:system:WHAT I LEARNED TO DO': {
    name: 'What I learned this week', line: 'You can read what I learned to do this week, in plain lines.',
    more: 'From my training and my games: measured, never just claimed. A note comes on Sunday mornings.',
    say: ['What did you learn this week?'], scene: ['behind', 'school'], cat: 'learn',
    since: '2026-10-31',
  },
  'panel:system:LOOPS': {
    name: 'How I improve myself', line: 'You can see every way I improve myself: what each practised, what got better, what was rejected.',
    more: 'A change is only kept if it beats the old one on tests it never trained on.',
    say: ['How are you improving?'], scene: ['behind', 'school'], cat: 'learn',
    since: '2026-10-24',
  },
  'panel:system:NIGHT SCHOOL': {
    name: 'Night School on your phone', line: 'You can let me study through the night on your phone while it charges, between the times you set.',
    more: 'Plugged in and open on me, from 23:00 to 06:00 unless you change it. The screen dims and I get on with it.',
    say: ['Turn on Night School'], scene: ['phone', 'school', 'behind'], cat: 'learn', needs: ['offline'],
    since: '2026-10-24',
  },
  'panel:system:OFFLINE BRAIN REPORT CARD': {
    name: 'The phone brain’s report card', line: 'You can see an honest report card for the brain on your phone, area by area.',
    more: 'From questions it never trained on, so the marks mean something.',
    say: ['How good is your offline brain?'], scene: ['phone', 'school'], cat: 'learn', needs: ['offline'],
  },
  'panel:system:OFFLINE BRAIN TRAINING': { same: 'job:train' },
  // ---- THREATS
  'panel:threats:ACTIVE SIGNALS': {
    name: 'The world’s alerts, worst first', line: 'You can see the world’s live alerts worst first: quakes, storms and disasters, each with when.',
    more: 'Tap one to fly there on the globe. From public feeds; when a feed is down it says so rather than claim all clear.',
    say: ['Anything happening in the world?'], scene: ['watching'], cat: 'watch',
  },
  'panel:threats:NEAR YOU': {
    name: 'What is near you now', line: 'You can see what is near you right now: aircraft overhead, recent quakes, live events.',
    more: 'Tap a line to see it on God’s eye, where it really is.',
    say: ['What’s flying over me?'], scene: ['watching', 'out'], cat: 'watch',
  },
  'panel:threats:SPACE WEATHER': {
    name: 'Space weather and auroras', line: 'You can see the space weather: the sun’s storms and the chance of seeing an aurora.',
    more: 'From the public space-weather feeds, said in plain words.',
    say: ['Can I see the northern lights tonight?'], scene: ['watching'], cat: 'watch',
  },
  'panel:threats:LAUNCH WINDOW': {
    name: 'Upcoming rocket launches', line: 'You can see the next rocket launches around the world and when they go.',
    more: 'From a public launch schedule, with where each goes up from.',
    say: ['When’s the next rocket launch?'], scene: ['watching'], cat: 'know',
  },
  'panel:threats:NEAR HOME': { same: 'job:guard' },
  'panel:threats:RECON': {
    name: 'Check a website’s weak spots', line: 'You can type a website and I run every public check on it, worst findings first.',
    more: 'Its records, certificates, hosting and missing safety settings, from public records only: never a person.',
    say: ['Check bbc.co.uk'], scene: ['watching'], cat: 'watch',
  },
  // ---- THE WORKBENCH (a first estimate each, never certified)
  'panel:workbench:WIND TUNNEL': {
    name: 'A wind tunnel on your phone', line: 'You can watch air flow round a wing, a car or a shape you draw, live, with its lift and drag.',
    more: 'A 2-D flow worked out on your phone: change the wing’s camber, thickness and angle as it runs. A first estimate, never certified.',
    say: ['Wind tunnel'], scene: ['making', 'playing'], cat: 'build',
  },
  'panel:workbench:BEAM': {
    name: 'Will a beam hold?', line: 'You can work out how much a beam bends and how hard it is worked, for steel, timber or concrete.',
    more: 'Its span, its load and its section, in your units; the answer follows each change. For anything real, a chartered engineer signs it, not me.',
    say: ['Beam calculator', '3 m steel beam 5 kN in the middle'], scene: ['making'], cat: 'build',
  },
  'panel:workbench:COLUMN': {
    name: 'Will a post buckle?', line: 'You can work out the load a post or column can take before it buckles.',
    more: 'With how its ends are held. A first estimate, never certified.',
    say: ['Column calculator'], scene: ['making'], cat: 'build',
  },
  'panel:workbench:GEARS': {
    name: 'Work out gear ratios', line: 'You can work out a gear train’s ratio, its output speed and its torque, from the teeth.',
    more: 'Driver to driven, stage by stage, with the losses. Bicycle gearing is next to it.',
    say: ['Gear calculator', '20 to 60 teeth at 1500 rpm'], scene: ['making'], cat: 'build',
  },
  'panel:workbench:ENGINE': {
    name: 'An engine’s power', line: 'You can estimate an engine’s power and torque from its size and kind, or check a claimed figure.',
    more: 'Rough by nature: from a stated pressure guess for petrol, turbo or diesel.',
    say: ['How much power from a 2-litre turbo?'], scene: ['making'], cat: 'build',
  },
  'panel:workbench:WING & CAR': {
    name: 'A wing’s lift', line: 'You can work out a wing’s lift and drag from its shape, angle, speed and size.',
    more: 'With a stop at the stall. A car’s drag and a falling object’s top speed are its other modes.',
    say: ['Lift of a NACA 2412 wing at 4 degrees'], scene: ['making'], cat: 'build',
  },
  'panel:workbench:PROJECTILE': {
    name: 'How far a throw goes', line: 'You can work out how far and how high something thrown goes, with the air slowing it.',
    more: 'Angle, speed and what it is; drawn as it flies.',
    say: ['How far does a ball go at 20 m/s?'], scene: ['making', 'playing'], cat: 'build',
  },
  'panel:workbench:ORBIT': {
    name: 'Orbits and escape speed', line: 'You can work out an orbit: its speed, its period, the speed to escape, the transfer between two.',
    more: 'Round Earth or another planet, from its height above the ground.',
    say: ['How fast is an orbit at 400 km?'], scene: ['making', 'school'], cat: 'build',
  },
  'panel:workbench:HEAT': {
    name: 'A room’s heat loss', line: 'You can work out how much heat a room loses, and a wall’s U-value from its layers.',
    more: 'Useful before choosing a radiator or insulation. A first estimate, never certified.',
    say: ['How much heat does my room lose?'], scene: ['making', 'money'], cat: 'build',
  },
  'panel:workbench:SUN & SHADOW': {
    name: 'The sun and shadows at home', line: 'You can see where the sun is at your home at any date and time, and how long a shadow falls.',
    more: 'For your saved home, from the standard solar position.',
    say: ['Where’s the sun at 4pm in December?'], scene: ['making', 'out'], cat: 'build', needs: ['home'],
  },
  'panel:workbench:CIRCUIT': {
    name: 'Circuits and Ohm’s law', line: 'You can work out a circuit: Ohm’s law, resistors, a divider, a capacitor’s timing, an LED’s resistor.',
    more: 'And what an appliance costs to run. Each is a mode on the same card.',
    say: ['Ohm’s law calculator'], scene: ['making'], cat: 'build',
  },
  // the Workbench's modes, where a panel has several
  'bench:gears:train': { same: 'panel:workbench:GEARS' },
  'bench:gears:bike': {
    name: 'Your bicycle’s gearing', line: 'You can work out a bike’s gear: inches, how far one turn of the pedals takes you, your speed.',
    more: 'From the chainring, the sprocket, the wheel and how fast you pedal.',
    say: ['50 by 11 on a road bike'], scene: ['making', 'out'], cat: 'build',
  },
  'bench:wing:wing': { same: 'panel:workbench:WING & CAR' },
  'bench:wing:car': {
    name: 'A car’s drag and power', line: 'You can work out a car’s drag and the power it needs at a speed.',
    more: 'From its shape, its frontal area and the speed.',
    say: ['Power for a car at 70 mph'], scene: ['making'], cat: 'build',
  },
  'bench:wing:fall': {
    name: 'How fast things fall', line: 'You can work out how fast something falls through air and its top speed.',
    more: 'For a skydiver, a ball, a raindrop: the air decides the top speed.',
    say: ['Top speed of a skydiver'], scene: ['making', 'school'], cat: 'build',
  },
  'bench:circuit:led': {
    name: 'An LED’s resistor', line: 'You can work out the resistor an LED needs, to the nearest value you can buy.',
    more: 'From the supply voltage, the LED and its current.',
    say: ['Resistor for a red LED on 5 volts'], scene: ['making'], cat: 'build',
  },
  'bench:circuit:ohm': { same: 'panel:workbench:CIRCUIT' },
  'bench:circuit:resistors': {
    name: 'Resistors added together', line: 'You can work out resistors in series or in parallel.',
    more: 'List the values and get the total, either way round.',
    say: ['100 and 220 ohms in parallel'], scene: ['making'], cat: 'build',
  },
  'bench:circuit:divider': {
    name: 'A voltage divider', line: 'You can work out the voltage out of a divider from its two resistors.',
    more: 'And the current it draws through the two resistors.',
    say: ['Divider from 9 volts with 10k and 4.7k'], scene: ['making'], cat: 'build',
  },
  'bench:circuit:rc': {
    name: 'A capacitor’s timing', line: 'You can work out how quickly a capacitor charges through a resistor.',
    more: 'The time constant and how long to nearly full.',
    say: ['RC time for 10k and 100 microfarads'], scene: ['making'], cat: 'build',
  },
  'bench:circuit:power': {
    name: 'What it costs to run', line: 'You can work out what an appliance costs to run, by the hour, the day or the year.',
    more: 'From its watts, how long it is on, and your price per unit.',
    say: ['What does a 2 kW heater cost for 3 hours?'], scene: ['money', 'making'], cat: 'build',
  },
  // ---- THE WORKSHOP
  'panel:workshop:TELL GHOSTY WHAT TO BUILD': {
    name: 'Tell me what to build', line: 'You can type anything you want built or changed in me, and I start on it in the chat.',
    more: 'A new panel, a game, a tool, a fix. A change to my code comes back as a preview for your yes.',
    say: ['Add a rain radar to the Brief', 'Make me a pomodoro timer'], scene: ['making'], cat: 'build',
  },
  'panel:workshop:UPGRADE ROADMAP': { same: 'tool:roadmap' },
  'panel:workshop:PROJECTS': { same: 'tool:project_status' },
  'panel:workshop:UPGRADE IDEAS': { same: 'job:upgrade' },
  'panel:workshop:PROPOSED CHANGES': { same: 'tool:list_changes' },
  'panel:workshop:VERSIONS': { same: 'tool:restore_version' },
  'panel:workshop:WIDGETS': { same: 'tool:list_widgets' },
  'panel:workshop:PUBLISHED PAGES': { same: 'tool:list_sites' },
  'panel:workshop:KERNEL LOCK': {
    name: 'The lock on my core', line: 'You can keep my core locked, so I can never change my keys, my safety rules or my checks.',
    more: 'Even when you ask me to change myself, the core stays out of reach unless you unlock it here.',
    say: ['Is your kernel locked?'], scene: ['behind'], cat: 'do',
  },
  "panel:workshop:WHAT'S NEW": {
    name: 'What’s new this week', line: 'You can read what changed in me this week, in plain words, once per update.',
    more: 'At the top of the Workshop when something new has landed.',
    say: ['What’s new?'], scene: ['behind'], cat: 'do',
    since: '2026-10-23',
  },
  'panel:workshop:TRAINING GROUND': {
    name: 'My coding practice', line: 'You can watch me practise coding on exercises with hidden tests, and see how I do.',
    more: 'Forty exercises, each checked by tests I cannot see. What I solve becomes a note; what took tries becomes a lesson.',
    say: ['Practise your coding'], scene: ['behind', 'school'], cat: 'learn',
  },
};
