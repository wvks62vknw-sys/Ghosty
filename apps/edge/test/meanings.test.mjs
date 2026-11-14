// MANY WORDINGS, ONE MEANING (packages/shared/src/meanings.ts, apps/web/src/assistant/meaningturn.ts; FINAL ROUND, the voice lane;
// his words: "if i say play music it should play the radio etc and all things like that") and COLOURS NAMED PLAINLY
// (packages/shared/src/colours.ts, themes.ts lookAsked; "if i say to him red he doesn't change the theme to red").
// Table-driven: hundreds of wordings, each mapped to the ability it means, run through the phone's own order (its tables first,
// exactly as session.ts does, then the meanings layer). Every canonical phrase is proved to be taken by its own table, every
// screen opened is a real tab, the words that mean two things ask, and words about something else are left alone.
// (Imported at the end of intent.test.mjs, which is in the test list; package.json is protected.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  entryPoints: { meanings: at('../../../packages/shared/src/meanings.ts'), colours: at('../../../packages/shared/src/colours.ts'), themes: at('../../../packages/shared/src/themes.ts'), phrases: at('../../web/src/assistant/phrases.ts'), screenasks: at('../../web/src/assistant/screenasks.ts'), learned: at('../../../packages/shared/src/learned.ts') },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/meanings'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'error',
});
const M = await import('./.build/meanings/meanings.mjs');
const C = await import('./.build/meanings/colours.mjs');
const TH = await import('./.build/meanings/themes.mjs');
const P = await import('./.build/meanings/phrases.mjs');
const SA = await import('./.build/meanings/screenasks.mjs');
const L = await import('./.build/meanings/learned.mjs');

/** The table that answers words first on the phone (assistant/local.ts localTurn's order), or null. */
const tableOf = (t) => P.LOCAL_ASKS.find((a) => a.test(t))?.id ?? null;

/** Which phone table each meaning's canonical words belong to. */
const TABLE_OF = { look: 'look', water: 'water', 'lights-on': 'house', 'lights-off': 'house', timer: 'timer', docs: 'docs', sheets: 'sheets', slides: 'slides', photo: 'photoedit', video: 'video', money: 'moneyapp', comic: 'comic' };

/** What his words end up doing on the phone: a table's id when a table takes them as said, else the meaning's id, the question, or null. */
function route(t) {
  const first = tableOf(t);
  if (first) return { by: 'table', id: first };
  const m = M.meaningOf(t);
  if (!m) return null;
  if (M.isTwo(m)) return { by: 'two', id: m.two.map((x) => x.id).join('|') };
  return { by: 'meaning', id: m.id, m };
}

// ---------------------------------------------------------------- the wordings, by ability

const W = {
  radio: ['play music', 'play some music', 'put some music on', 'put some tunes on', 'stick some tunes on', 'bung the radio on', 'put the radio on', 'whack some music on', 'play the radio', 'play radio', 'radio on', 'music on', 'turn on the radio', 'fire up the radio', 'I want some music', 'I fancy some music', 'I want to hear something', 'I wanna listen to some music', 'let me hear some tunes', 'listen to the radio', 'play my last station', 'play my favourite station', 'give me some tunes', 'chuck some music on', 'music', 'tunes', 'some tunes please', "it's too quiet in here", 'get the party started', 'play some bangers', 'put a song on', 'play a tune', 'I need some background music', 'switch on the radio', 'start the radio', 'pop some music on', 'throw some tunes on', 'play something to listen to', 'bang some music on', 'can we have some music', 'some music would be nice', 'play us a tune', 'get some music going', 'drop some beats'],
  'radio-stop': ['stop the music', 'kill the music', 'turn off the radio', 'radio off', 'music off', 'turn the music off', 'pause the music', 'mute the radio', 'cut the music', 'switch off the radio', 'enough music', 'shut the radio off', 'stop the radio'],
  'radio screen': ['open the radio', 'show me the radio stations', 'go to the radio', 'take me to the radio'],
  water: ['log a glass of water', 'log a glass', 'log a cup of water', 'add a glass of water', "I've had a glass of water", 'I had a glass of water', 'just had a glass of water', 'I drank a glass of water', "I've just drunk a bottle of water", 'had some water', 'I necked a glass of water', 'record a glass of water', 'track a water', 'count another glass', 'water logged', "I'm hydrated", 'another water', 'one water', "I've had a glass", 'log another glass of water', 'mark a bottle of water', 'add water', 'just drank some water', 'log my water'],
  'water-pint': ['log a pint', 'log a pint of water', "I've had a pint of water", 'just necked a pint of water', 'add a pint', 'I drank a pint of water', 'record a pint of water'],
  'lights-on': ['turn the lights on', 'turn on the lights', 'switch the lights on', 'flick the lights on', 'put the lights on', 'let there be light', "it's too dark in here", 'get the lights', 'switch on the lights'],
  'lights-off': ['turn the lights off', 'turn off the lights', 'kill the lights', 'cut the lights', 'switch the lights off', 'knock the lights off', 'shut the lights off', "it's too bright in here", 'lose the lights', 'flick the lights off', 'all lights out'],
  timer: ['timer for 10 minutes', 'set a timer for ten minutes', 'countdown 5 minutes', 'count down three minutes', 'give me a shout in 10 minutes', 'give us a shout in twenty minutes', 'buzz me in 5 minutes', 'shout at me in 2 minutes', 'time 4 minutes', 'ten minute timer', '5 min timer', 'timer 30 seconds', 'start a timer for 15 minutes', 'set an alarm for 20 minutes', 'ping me in 3 mins', 'nudge me in a couple of minutes', 'remind me when 10 minutes is up', 'eggs for 6 minutes', 'pasta needs 11 minutes', 'tea 4 minutes', 'timer for an hour', 'timer for half an hour', 'timer for a minute', 'give me a buzz in five minutes', 'set timer 45 minutes', 'countdown of 90 seconds', 'start a countdown for 2 minutes', 'wake me in 20 minutes', 'time me for 3 minutes'],
  map: ['show me the map', 'open the map', 'bring up the map', 'pull up the map', 'open maps', 'take me to the map', 'show me the globe', "open god's eye", 'gods eye', 'let me see the map', 'I need the map', 'where am I on the map', 'show me where I am', 'open google maps', 'show me the world map'],
  lens: ['open the lens', 'open lens', 'start the lens', 'launch the scanner', 'fire up the lens', 'use the lens', 'tell me what this is', 'have a look at this', 'bring up the lens', 'google lens', 'open visual search'],
  comic: ['open the comic', 'make a comic', 'draw a comic', 'write a comic', 'create a comic book', 'make me a comic strip', 'read a comic', 'open my comics', 'show me the comics', 'start a graphic novel', 'make a manga', "let's make a comic", 'comic time', 'new comic'],
  docs: ['write a letter', 'write a document', 'start a doc', 'open a new document', 'draft a letter', 'type up a report', 'make a word document', 'create a document', 'write an essay', 'open my documents', 'type a letter'],
  sheets: ['make a spreadsheet', 'start a spreadsheet', 'create a sheet', 'open excel', 'make an excel sheet', 'build a budget sheet', 'open my spreadsheets', 'make a table', 'new workbook'],
  slides: ['make a presentation', 'build a slideshow', 'create a slide deck', 'make a powerpoint', 'put together a presentation', 'open my presentations', 'start a deck', 'make some slides', 'make a keynote'],
  photo: ['edit a photo', 'edit my photo', 'touch up this picture', 'crop a picture', 'fix my selfie', 'enhance this photo', 'open my photos', 'show my pictures', 'open the camera roll', 'photo editor', 'retouch a pic', 'brighten this photo', 'filter my picture'],
  video: ['edit a video', 'trim a clip', 'cut my video', 'make a video', 'splice this footage', 'open my videos', 'show my clips', 'video editor', 'chop a clip', 'edit my film', 'make a reel'],
  games: ['open the arcade', 'go to the arcade', 'play an arcade game', 'play some retro games', 'fancy an arcade game', "let's play arcade games"],
  'board games': ['play chess', 'play a game of chess', "let's play draughts", 'play checkers', 'play a board game', 'fancy a game of chess', 'play connect four'],
  weather: ["what's the weather", 'what is the weather like', "how's the weather looking", 'is it going to rain', 'is it gonna rain today', 'will it rain later', 'is it gonna chuck it down', 'is it going to tip it down', 'do I need a coat', 'should I take a brolly', 'should I bring an umbrella today', 'weather', 'the forecast', 'forecast tomorrow', "what's it like outside", 'will it be cold tomorrow', 'is it sunny', 'will it snow tonight', "how's the forecast today", 'is it windy', 'what is the weather going to be like tomorrow'],
  news: ["what's the news", "what's in the news", 'any news', 'the headlines', 'news please', 'read me the news', 'tell me the headlines', "what's the latest news", 'what is happening in the world', 'give me the top stories', 'headlines today', "what's going on out there"],
  settings: ['open settings', 'show the settings', 'go to settings', 'preferences', 'open the options', 'change my settings', 'take me to settings', 'bring up the control panel', 'settings'],
  agenda: ['open my diary', 'show my calendar', 'check my schedule', 'my diary', 'calendar', "what's on my calendar", 'open the agenda', 'show me my week', 'bring up my planner'],
  money: ['show me my money', 'open my finances', 'check my spending', 'how much have I spent', "where's my money gone", 'open my budget', 'check my bank', 'show my accounts'],
  library: ['open the library', 'show me my books', 'take me to my bookshelf', 'read a book', 'I want to read a book', 'open my reading list', 'read me a book'],
  look: ['change the colour', 'change the theme', 'pick a colour', 'show me the colours', 'open the themes', 'change your colour'],
  learn: ['open learn', 'show me the lessons', 'teach me something', 'learn something new', 'I want to learn something', 'take me to the courses', 'help me learn something'],
};
const EXPECT = { 'water-pint': 'water' };
/** The wrappings round a request, which change nothing of what is asked. */
const WRAP = [(b) => b, (b) => `please ${b}`, (b) => `${b} please`, (b) => `ghosty, ${b}`, (b) => `hey ghosty ${b}`, (b) => `${b} mate`, (b) => `${b[0].toUpperCase()}${b.slice(1)}!`];
/** (POLISH 3) The meanings that open a screen, and that screen: a plain "open the arcade" is taken first by the phone's open-a-screen table, which opens the same screen. */
const SCREEN_OF = { games: 'arcade', learn: 'learn' };
const accepts = (want, r, t = '') => {
  if (!r) return false;
  if (r.by === 'meaning') return r.id === want;
  if (r.by === 'table' && r.id === 'openscreen') return !!SCREEN_OF[want] && SA.screenAsked(t)?.tab === SCREEN_OF[want];
  if (r.by === 'table') return TABLE_OF[want] === r.id;
  return false;
};

test('hundreds of wordings, each to its one ability, through the phone’s own order (its tables first, then the meanings)', () => {
  let n = 0;
  const wrong = [];
  for (const [id, words] of Object.entries(W)) {
    const want = EXPECT[id] ?? id;
    for (const base of words)
      for (const wrap of WRAP) {
        const t = wrap(base);
        n++;
        const r = route(t);
        if (!accepts(want, r, t)) wrong.push(`"${t}" → ${r ? `${r.by} ${r.id}` : 'nothing'} (want ${want})`);
      }
  }
  console.log(`MEASURED meanings: ${n} wordings over ${Object.keys(W).length} abilities, ${n - wrong.length} right`);
  assert.ok(n >= 1500, `${n} wordings`);
  assert.deepEqual(wrong.filter((w, i) => i % 7 === 0 || !wrong[i - 1]?.includes(w.split('"')[1])).slice(0, 40), [], `${wrong.length} wrong`);
  // every ability the layer can mean has wordings here
  for (const id of M.MEANING_IDS) assert.ok(Object.values(EXPECT).includes(id) || W[id]?.length >= 4, `${id} has wordings in the table`);
});

test('every canonical phrase is taken by its own table, and a timer keeps his minutes', () => {
  const seen = new Set();
  for (const words of Object.values(W))
    for (const t of words) {
      const m = M.meaningOf(t);
      if (!m || M.isTwo(m) || !m.say || seen.has(m.say)) continue;
      seen.add(m.say);
      assert.equal(tableOf(m.say), TABLE_OF[m.id], `"${m.say}" (from "${t}") is taken by the ${TABLE_OF[m.id]} table`);
    }
  assert.ok(seen.size >= 10, [...seen].join(' | '));
  const say = (t) => M.meaningOf(t)?.say;
  assert.equal(say('give me a shout in ten minutes'), 'set a timer for 10 minutes');
  assert.equal(say('buzz me in 90 seconds'), 'set a timer for 90 seconds');
  assert.equal(say('timer for half an hour'), 'set a timer for 30 minutes');
  assert.equal(say('timer for an hour'), 'set a timer for 1 hour');
  assert.equal(say('nudge me in a couple of minutes'), 'set a timer for 2 minutes');
  assert.equal(say('log a pint'), 'I drank a pint of water');
});

test('every screen a meaning opens is a real tab of the app, and its line is said', () => {
  const idx = readFileSync(at('../../web/src/features/index.ts'), 'utf8');
  const tabs = new Set();
  for (const m of idx.matchAll(/import \{ \w+ \} from '\.\/(\w+)';/g)) {
    const src = readFileSync(at(`../../web/src/features/${m[1]}/index.ts`), 'utf8');
    const id = /TabDef = \{\s*id: '([^']+)'/.exec(src);
    if (id) tabs.add(id[1]);
  }
  assert.ok(tabs.has('radio') && tabs.has('eye'), [...tabs].join(' '));
  for (const words of Object.values(W))
    for (const t of words) {
      const m = M.meaningOf(t);
      if (m && !M.isTwo(m) && m.open) {
        assert.ok(tabs.has(m.open), `"${t}" opens ${m.open}, a real tab`);
        assert.ok(m.line, `"${t}" says what it did`);
      }
    }
  const comic = M.meaningOf('make a comic');
  // (the comic is its own screen since the FINAL ROUND's comic lane: features/comic, its shelf, MAKE and the library)
  assert.deepEqual([comic.open, comic.panel], ['comic', undefined], 'the comic opens the COMIC screen');
  const comicTab = readFileSync(at('../../web/src/features/comic/index.ts'), 'utf8');
  assert.match(comicTab, /id: 'comic'/, 'the comic screen is a tab of its own');
});

test('words that could mean two things ask one short question, with both as keys', () => {
  const two = (t) => {
    const m = M.meaningOf(t);
    assert.ok(M.isTwo(m), `"${t}" asks`);
    assert.ok(m.q.length <= 70 && m.q.endsWith('?'), m.q);
    assert.equal(m.two.length, 2);
    for (const k of m.two) assert.ok(k.key && k.key === k.key.toUpperCase() && k.key.length <= 14, k.key);
    return m.two.map((x) => x.id).join('|');
  };
  assert.equal(two('play something'), 'radio|games');
  assert.equal(two('put something on'), 'radio|games');
  assert.equal(two('play a game'), 'games|board games');
  assert.equal(two("I'm bored"), 'games|board games');
  assert.equal(two('open the camera'), 'lens|map');
  assert.equal(two('lights'), 'lights-on|lights-off');
  assert.equal(two('lights off'), 'lights-off|dark screen');
  assert.equal(two('the lights on'), 'lights-on|light screen');
  // the words each key sends are read to exactly that meaning again (assistant/meaningturn.ts KEY_WORDS)
  const src = readFileSync(at('../../web/src/assistant/meaningturn.ts'), 'utf8');
  for (const [id, words] of [...src.matchAll(/^\s+'?([\w ]+)'?: '([^']+)',$/gm)].map((m) => [m[1], m[2]])) {
    const r = route(words);
    assert.ok(r && r.by !== 'two' && (r.id === id || TABLE_OF[id] === r.id || accepts(id, r, words)), `the ${id} key's words "${words}" → ${JSON.stringify(r && r.id)}`);
  }
});

test('words about something else are left alone (the tables and the brain have them exactly as before)', () => {
  for (const t of ['what music do you like', 'who invented the radio', 'tell me about the history of music', 'is water wet', 'what is the speed of light', 'how do maps work', 'the weather in Rome in 1850 was', 'remind me to buy water at 5pm', 'I love this song', 'what time is it', 'write me a poem about rain', 'how much water should I drink a day', 'play devil’s advocate', 'what does crimson mean', 'translate this letter into French', 'what is a lens in physics', 'call mum', 'the news was bad yesterday because my cat died', 'can you explain photosynthesis']) {
    const m = M.meaningOf(t);
    assert.equal(m, null, `"${t}" → ${JSON.stringify(m)}`);
  }
  // an ask only the brain can answer is noted for it in one short line, and only then
  assert.equal(M.meantNote(M.meaningOf('is it gonna chuck it down')), "\n\n(The phone read this as: what's the weather.)");
  assert.equal(M.meantNote(M.meaningOf('play music')), '');
});

// ---------------------------------------------------------------- colours named plainly

test('every colour the app offers has a plain name, shown that way, and every fancy name and synonym maps to it both ways', () => {
  const plain = new Set(['blue', 'grey', 'orange', 'yellow', 'red', 'purple', 'green', 'light blue', 'pink', 'lime', 'peach', 'white']);
  for (const k of TH.COLOUR_KEYS) {
    const name = TH.COLOUR_LABELS[k];
    assert.ok(plain.has(name.toLowerCase()), `${k} is shown as "${name}"`);
    assert.equal(C.colourWord(name), k, `"${name}" → ${k}`);
    assert.equal(C.colourWord(C.FANCY[k]), k, `its old name "${C.FANCY[k]}" → ${k}`);
    for (const w of C.COLOUR_SYNONYMS[k]) assert.equal(C.colourWord(w), k, `"${w}" → ${k}`);
  }
  // no word means two colours
  const owner = new Map();
  for (const [k, ws] of Object.entries(C.COLOUR_SYNONYMS)) for (const w of ws) {
    assert.ok(!owner.has(w), `"${w}" is both ${owner.get(w)} and ${k}`);
    owner.set(w, k);
  }
  const map = { crimson: 'crimson', scarlet: 'crimson', ruby: 'crimson', maroon: 'crimson', burgundy: 'crimson', navy: 'reactor', cyan: 'reactor', teal: 'reactor', turquoise: 'reactor', cobalt: 'reactor', emerald: 'emerald', jade: 'emerald', mint: 'emerald', olive: 'emerald', violet: 'violet', lilac: 'violet', lavender: 'violet', magenta: 'violet', gold: 'gold', amber: 'gold', mustard: 'gold', silver: 'graphite', charcoal: 'graphite', gray: 'graphite', 'baby blue': 'ice', 'sky blue': 'reactor', 'hot pink': 'rose', fuchsia: 'rose', 'lime green': 'lime', salmon: 'sunset', coral: 'sunset', tangerine: 'ember', rust: 'ember' };
  for (const [w, k] of Object.entries(map)) assert.equal(C.colourWord(w), k, `${w} → ${k}`);
  // the slides' own themes are named plainly too
  const slides = readFileSync(at('../../web/src/slides/themes.ts'), 'utf8');
  for (const fancy of ['Crimson', 'Ember', 'Emerald', 'Violet', 'Sunset', 'Mono']) assert.ok(!slides.includes(`dark('${fancy}'`), `slides no longer name a theme "${fancy}"`);
  const theme = readFileSync(at('../../web/src/state/theme.ts'), 'utf8');
  for (const k of TH.COLOUR_KEYS) assert.ok(theme.includes(`${k}: { label: '${TH.COLOUR_LABELS[k]}'`), `state/theme.ts shows ${k} as ${TH.COLOUR_LABELS[k]}`);
});

test('"make it red", "red theme" and "change the colour to blue" change the colour, and the reply says what changed', () => {
  const base = TH.recipeFrom('reactor');
  const asks = {
    'make it red': 'crimson', 'red theme': 'crimson', 'Red': 'crimson', 'change the colour to blue': 'reactor', 'change the theme to green': 'emerald', 'can you make it purple please': 'violet',
    'make everything pink': 'rose', 'switch to orange': 'ember', 'go yellow': 'gold', 'set the accent to teal': 'reactor', 'paint it scarlet': 'crimson', 'turn yourself red': 'crimson', 'make yourself green': 'emerald', 'crimson theme': 'crimson', 'make it navy': 'reactor', 'emerald': 'emerald',
    'I want it lime green': 'lime', 'light blue please': 'ice', 'make it light blue': 'ice', 'turn it peach': 'sunset', 'the colour to coral': 'sunset', 'white light': 'mono', 'grey colour': 'graphite', 'blue colour scheme': 'reactor',
    'change the colour to red please': 'crimson', 'Ghosty, make it gold': 'gold', 'switch the theme to violet': 'violet', 'red mode': 'crimson', 'make it maroon': 'crimson', 'change your colour to green': 'emerald',
  };
  for (const [t, k] of Object.entries(asks)) {
    const ask = TH.lookAsked(t);
    assert.equal(ask?.colour, k, `"${t}" → ${JSON.stringify(ask)}`);
    const { recipe, said } = TH.applyAsk(base, ask);
    assert.equal(recipe.colour, k);
    const name = TH.COLOUR_LABELS[k];
    assert.ok(said.startsWith(name), `"${t}": "${said}" names ${name}`);
    if (k !== 'reactor') assert.match(said, /instead of blue\. Only my colour changed\.$/, said);
  }
  // a fancy word is said back beside the plain name
  assert.equal(TH.applyAsk(base, TH.lookAsked('make it crimson')).said, 'Red (crimson) now, instead of blue. Only my colour changed.');
  assert.equal(TH.applyAsk(base, TH.lookAsked('make it blue')).said, 'Blue is on already: nothing changed.');
  // "white" and "grey" are a colour and a ground both: one question, nothing changed yet; "white background" is the ground
  for (const t of ['make it white', 'white theme', 'make it grey', 'white']) {
    const ask = TH.lookAsked(t);
    assert.ok(ask?.two, `"${t}" asks: ${JSON.stringify(ask)}`);
    assert.equal(TH.applyAsk(base, ask).recipe.colour, 'reactor', 'nothing changes until he says which');
    assert.match(C.TWO_WAYS[ask.two].q, /\?$/);
  }
  assert.deepEqual(TH.lookAsked('white background'), { ground: 'paper' });
  assert.deepEqual(TH.lookAsked('black theme'), { ground: 'black' });
  assert.equal(TH.lookAsked('white colour')?.colour, 'mono');
  // never taken: words about something else
  for (const t of ['what colour is the sky', 'turn the lights blue', 'make it snappy', 'olive', 'mint', 'I feel blue today', 'the red one', 'red sky at night', 'paint the fence green']) assert.equal(TH.lookAsked(t)?.colour, undefined, `"${t}" → ${JSON.stringify(TH.lookAsked(t))}`);
});

// ---------------------------------------------------------------- his own wordings, learned (NEXT ROUND, voice.u1)

test('his own wordings: a short ask that opens a screen can be learned; one that sends, pays, posts or deletes never is', () => {
  for (const t of ['money stuff', 'my dosh', 'the wonga page please', 'Ghosty, bills and that', 'how am I doing for cash', 'gym things']) assert.ok(L.learnKey(t), `"${t}" can be learned`);
  for (const t of ['send mum a text', 'pay the gas bill', 'post this to my page', 'delete my notes', 'remind me at 5', 'email Sam', 'call dad', 'yes', 'no', '42', 'ok thanks', 'a', 'one two three four five six seven eight nine ten']) assert.equal(L.learnKey(t), '', `"${t}" is never learned`);
  // the polite wrapping changes nothing: one wording, however it is wrapped
  assert.equal(L.learnKey('please money stuff'), L.learnKey('money stuff mate'));
  const kept = L.withLearned([], { words: 'money stuff', key: L.learnKey('money stuff'), tab: 'money', label: 'Money', at: 1 });
  assert.equal(L.learnedFor(kept, 'Money stuff, please!')?.tab, 'money');
  assert.equal(L.learnedFor(kept, 'money'), null, 'only that wording, not a part of it');
  assert.equal(L.learnedFor(kept, 'send money stuff'), null, 'a sending ask is never read as the wording');
  // taught again, it points at the new screen; never two of one wording; capped
  const again = L.withLearned(kept, { words: 'money stuff', key: L.learnKey('money stuff'), tab: 'markets', label: 'Markets', at: 2 });
  assert.equal(again.length, 1);
  assert.equal(L.learnedFor(again, 'money stuff').tab, 'markets');
  let many = [];
  for (let i = 0; i < 130; i++) many = L.withLearned(many, { words: `thing ${i} page`, key: L.learnKey(`thing ${i} page`), tab: 'money', label: 'Money', at: i });
  assert.equal(many.length, L.MAX_LEARNED);
  // forgotten by its words, wrapped or not
  const f = L.withoutLearned(again, 'please money stuff');
  assert.equal(f.gone?.words, 'money stuff');
  assert.equal(f.list.length, 0);
  assert.equal(L.withoutLearned(again, 'nothing like it').gone, null);
  // his words about the list
  for (const t of ['what wordings have you learned?', 'my wordings', 'show me my wordings', 'Ghosty, which words have you learnt from me', 'list the words you have learned']) assert.equal(L.learnedAsked(t)?.kind, 'list', t);
  for (const [t, w] of [['forget the wording money stuff', 'money stuff'], ['unlearn “money stuff”', 'money stuff'], ['please forget the phrase gym things', 'gym things']]) assert.deepEqual(L.learnedAsked(t), { kind: 'forget', words: w }, t);
  for (const t of ['forget that I like tea', 'forget it', 'what words do you know', 'my words are my own']) assert.equal(L.learnedAsked(t), null, `"${t}" is not about the wordings (memory's "forget" stays memory's)`);
  assert.equal(L.offerLine('money stuff', 'Money'), 'Next time you say “money stuff”, open Money?');
  assert.equal(L.usedLine({ words: 'money stuff', label: 'Money' }), 'Opening Money: you taught me “money stuff”.');
});

test('a taught wording is read first, before any table, and only once it is kept', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try {
    const first = (t) => P.LOCAL_ASKS.find((a) => a.test(t))?.id ?? null;
    assert.notEqual(first('wonga page'), 'learned', 'not before it is taught');
    store.set(L.LEARNED_KEY, JSON.stringify([{ words: 'wonga page', key: L.learnKey('wonga page'), tab: 'money', label: 'Money', at: 1 }]));
    assert.equal(first('wonga page'), 'learned');
    assert.equal(first('please, wonga page'), 'learned');
    assert.equal(first('my wordings'), 'learned');
    // the car's two stay first (car.test), and a stop is never the table's (session.ts runs it before any table)
    assert.deepEqual(P.LOCAL_ASKS.slice(0, 2).map((a) => a.id), ['carview', 'carfault']);
    store.set(L.LEARNED_KEY, 'not json');
    assert.deepEqual(L.storedLearned(), [], 'a hurt list reads as none');
  } finally {
    delete globalThis.localStorage;
  }
});
