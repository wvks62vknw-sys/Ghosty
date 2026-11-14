import type { AppDef } from '../types';

/**
 * Ghosty's own full screens, listed in the Library (archetype screen) so it holds everything (docs/build-plan/APPLIB.md). Each
 * opens its screen at its hash; the Jump bar and "open radio" already find these, so the Library's own words never shadow them.
 */
const screen = (id: string, name: string, family: AppDef['family'], glyph: AppDef['glyph'], pitch: string, keywords: string[]): AppDef => ({
  id: `ghosty-${id}`, name, family, glyph, pitch, keywords, archetype: 'screen',
  tour: ['This is one of Ghosty’s own screens.', 'OPEN takes you straight to it.', 'Pin it to Home to keep it one tap away.'],
  screen: { hash: id },
});

export const GHOSTY: AppDef[] = [
  screen('core', 'Home', 'tools', 'home', 'Talk or type to Ghosty, and he gets it done for you.', ['home', 'talk', 'ask']),
  screen('brief', 'Brief', 'life', 'sun', 'Your day in one look: weather, diary and news, or read aloud.', ['brief', 'day', 'morning']),
  screen('eye', 'God’s Eye', 'world', 'globe', 'The planet live: planes, ships and satellites on one globe.', ['planes', 'ships', 'satellites', 'globe']),
  screen('lens', 'Lens', 'tools', 'camera', 'Point the camera and Ghosty names what he sees.', ['camera', 'lens', 'identify']),
  screen('interpreter', 'Interpret', 'world', 'chat', 'Two halves, two languages: hold to talk, and both understand.', ['interpret', 'translate', 'languages']),
  screen('rehearse', 'Rehearse', 'learn', 'mic', 'Practise a hard talk against Ghosty in three rounds, then notes.', ['rehearse', 'practise', 'speech']),
  screen('studio', '3D Studio', 'create', 'cube', 'Make 3D models on the phone, then take them apart.', ['3d', 'models', 'studio']),
  screen('workshop', 'Workshop', 'maker', 'wrench', 'Ghosty changes his own code when you ask, step by step.', ['workshop', 'code', 'build']),
  screen('reverse', 'Reverse', 'maker', 'layers', 'Take a thing apart to see how it is made and why.', ['reverse', 'teardown', 'how it works']),
  screen('space', 'Space', 'life', 'ruler', 'Plan a room to scale and see if the sofa will fit.', ['room', 'plan', 'measure']),
  screen('workbench', 'Workbench', 'maker', 'tool', 'Engineering first estimates on the phone, never certified.', ['engineering', 'beam', 'estimate']),
  screen('learn', 'Courses', 'learn', 'book', 'Say teach me, and Ghosty builds you a whole course.', ['courses', 'teach me', 'lessons']),
  screen('arcade', 'Arcade', 'games', 'game', 'Classic free games, kept on the phone to play any time.', ['arcade', 'classics', 'games']),
  screen('gym', 'Gym', 'learn', 'brain', 'Watch Ghosty teach himself by playing dozens of games.', ['gym', 'training', 'self play']),
  screen('school', 'School', 'learn', 'flag', 'Ghosty sits real exams, from nursery to university.', ['school', 'exams']),
  screen('library', 'Library', 'learn', 'book', 'Your books, read here on the phone or read aloud to you.', ['books', 'reading', 'library']),
  screen('agenda', 'Agenda', 'life', 'calendar', 'Your diary, your reminders and the jobs Ghosty runs for you.', ['diary', 'reminders', 'agenda']),
  screen('markets', 'Markets', 'money', 'chart', 'Crypto, gold and currencies, live and in pounds.', ['markets', 'prices', 'crypto']),
  screen('threats', 'Threats', 'world', 'shield', 'Quakes, storms and space weather, the worst first.', ['quakes', 'storms', 'alerts']),
  screen('radio', 'Radio', 'create', 'music', 'Stations from everywhere: say play some jazz.', ['radio', 'stations', 'music']),
  screen('memory', 'Memory', 'life', 'brain', 'What Ghosty knows about you, and where he learned it.', ['memory', 'about me']),
  screen('settings', 'Settings', 'tools', 'tool', 'Make Ghosty yours: his look, his voice and his manner.', ['settings', 'look', 'voice']),
  screen('system', 'System', 'tools', 'chip', 'Under the bonnet: models, keys and backups.', ['system', 'backups']),
  screen('links', 'Links', 'tools', 'link', 'Connect your email, music, messages and phone.', ['links', 'connect', 'accounts']),
  screen('money', 'Money', 'money', 'wallet', 'Your spending, read from your own bank statements.', ['money', 'spending', 'statements']),
  screen('body', 'Body', 'body', 'heart', 'Reps, runs, breathing and water, all counted on the phone.', ['body', 'reps', 'water']),
  screen('kitchen', 'Kitchen', 'body', 'bowl', 'Kitchen timers, the shopping list and the meals you make.', ['kitchen', 'timers', 'shopping']),
  screen('people', 'People', 'life', 'people', 'The people you told Ghosty about, and their birthdays.', ['people', 'birthdays']),
  screen('work', 'Work', 'office', 'case', 'Your to-do list and practice for interviews.', ['work', 'to do', 'interviews']),
  screen('creative', 'Creative', 'create', 'palette', 'Songs, posters, cards, comics and beats, made with Ghosty.', ['creative', 'posters', 'songs']),
  screen('outside', 'Outside', 'world', 'compass', 'A safer walk, toilets, parking and the way there.', ['outside', 'walk', 'parking']),
  screen('homeadmin', 'Household', 'money', 'home', 'Bins, bills, meters and whatever is due next.', ['household', 'bins', 'bills']),
  screen('learning', 'Learning', 'learn', 'pen', 'Words, typing, maths and first aid, a little each day.', ['learning', 'typing', 'maths']),
  screen('coach', 'Coach', 'learn', 'headphones', 'A tuner, and music lessons that listen as you play.', ['coach', 'tuner', 'lessons']),
  screen('social', 'Social', 'life', 'chat', 'Your accounts in one place, and every post waits for you.', ['social', 'posts']),
  screen('convert', 'Convert', 'tools', 'file', 'Turn files into other formats right here on the phone.', ['convert', 'files', 'formats']),
  screen('docs', 'Documents', 'office', 'note', 'Read, write, edit and translate documents on the phone.', ['documents', 'write', 'translate']),
  screen('sheets', 'Spreadsheets', 'office', 'grid', 'Budgets and lists with formulas that follow, kept here.', ['spreadsheets', 'formulas', 'budget']),
  screen('slides', 'Presentations', 'office', 'film', 'Slides to show, with your notes in your hand.', ['slides', 'presentations', 'deck']),
  screen('workspace', 'Workspace', 'office', 'folder', 'Pages in pages, with a brain that has read all of it.', ['workspace', 'pages', 'notes']),
  screen('photo', 'Photo', 'create', 'camera', 'Edit a photo, with the original always kept untouched.', ['photo', 'edit', 'pictures']),
  screen('video', 'Video', 'create', 'film', 'Cut, grade and score a video right here on the phone.', ['video', 'edit', 'cut']),
  screen('house', 'House', 'life', 'home', 'Your smart home, room by room, in one place.', ['smart home', 'lights']),
  screen('gamestudio', 'Game Studio', 'games', 'puzzle', 'Make your own 2D game on the phone and play it.', ['game studio', 'make a game']),
  screen('comic', 'Comic', 'create', 'book', 'Read your comics, and make your own panel by panel.', ['comic', 'comics']),
];
