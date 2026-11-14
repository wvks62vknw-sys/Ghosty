/**
 * MANY WORDINGS, ONE MEANING (FINAL ROUND, the voice lane; his words, 13 Nov: "It should understand multiple meanings of the same
 * thing so if i say play music it should play the radio etc and all things like that").
 *
 * The phone's tables each know their own words ("I drank a glass of water", "turn off the lights", "set a timer for 10 minutes").
 * This layer sits in front of them: the synonyms, paraphrases and colloquial British wordings for every ability ("log a pint",
 * "put some tunes on", "kill the lights", "give us a shout in ten minutes", "is it gonna chuck it down") are each read to ONE
 * meaning, which is then done the way that ability is done:
 *   - `say`:   the canonical words its own table already takes (the table then does it, exactly as if he had said them);
 *   - `open`:  a screen (and a panel), opened on the phone;
 *   - `act`:   a thing the phone does itself (the radio: his last station, or a favourite);
 *   - `brain`: an ask only the brain can answer (the weather, the news): his words go to it as ever, with a one-line note of the
 *              meaning read, so the brain never has to guess.
 * Where the words could fairly mean two things ("play something": the radio or a game), it asks ONE short question with both as
 * keys (`two`), and does nothing until he taps one.
 *
 * Pure: no DOM. The phone runs it (assistant/meaningturn.ts) only when no table took his words as said, so nothing that already
 * worked changes. apps/edge/test/meanings.test.mjs holds hundreds of wordings, each mapped to its ability, and proves every
 * canonical phrase is taken by its own table.
 */
import { durationSecs, secsWords } from './amounts';

export interface Meant {
  /** The ability, for the checks and the console ("radio", "water", "lights-off"). */
  id: string;
  /** Canonical words its own table takes. */
  say?: string;
  /** A screen to open, and its panel. */
  open?: string;
  panel?: string;
  /** Something the phone does itself. */
  act?: 'radio' | 'radio-stop';
  /** An ask for the brain, as plain canonical words (sent beside his own). */
  brain?: string;
  /** What is said back when it is done here (`open` and `act`). */
  line?: string;
}

export interface TwoWays {
  /** The short question. */
  q: string;
  /** The two meanings, each with the label of its key. */
  two: [Meant & { key: string }, Meant & { key: string }];
}

/** The polite and chatty wrapping round a request, which changes nothing of what is asked. */
export function plainWords(text: string): string {
  let t = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”"]/g, '').replace(/[.!?,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) {
    const was = t;
    t = t
      .replace(/^(?:hey|hi|oi|ok|okay|right|so|now|um|erm|yo|alright|ghosty|mate|boss|bro|listen up)\s+/, '')
      .replace(/^(?:please|pls|plz|kindly|just|quickly|go on|could you|can you|would you|will you|can u|could u|would u|will u|you can|i need you to|i want you to|i'd like you to|id like you to|i need to|i want to|i wanna|i'd like to|id like to|i would like to|let's|lets|let us|wanna|can we have|could we have|can i have|can i get|let me|help me|mind if i|can i|could i|may i|i'm gonna|im gonna|i'm going to|im going to|time to|we need to|need to)\s+/, '')
      .replace(/\s+(?:please|pls|plz|thanks|thank you|cheers|ta|mate|ghosty|for me|now|right now|for us|then|innit|yeah|ok|okay|asap|quick|real quick|if you can|if you could|would you|will you|bro|boss|lad)$/, '')
      .trim();
    if (t === was) break;
  }
  return t;
}

// ---------------------------------------------------------------- numbers said as words ("ten minutes", "a couple of minutes")

const UNITS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty five': 45, fifty: 50, sixty: 60, ninety: 90, couple: 2, 'a couple of': 2, 'a couple': 2, few: 3, 'a few': 3 };
/** "10", "ten", "a couple of" → a number, or null. */
export function amount(w: string): number | null {
  const t = w.trim();
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  if (t === 'half an' || t === 'half a') return 0.5;
  return UNITS[t] ?? null;
}

const NUM = String.raw`(\d+(?:\.\d+)?|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty(?: five)?|fifty|sixty|ninety|a couple(?: of)?|couple|a few|few|half an?)`;
const UNIT = String.raw`(sec(?:ond)?s?|min(?:ute)?s?|mins?|hours?|hrs?|h|m|s)`;

/** A duration in his words → "N minutes" / "N seconds" / "N hours" for the timer's own table, or null. */
function duration(n: string, u: string): string | null {
  const x = amount(n);
  if (x == null) return null;
  const unit = /^s/.test(u) ? 'second' : /^h/.test(u) ? 'hour' : 'minute';
  if (x === 0.5 && unit === 'hour') return '30 minutes';
  if (x === 0.5 && unit === 'minute') return '30 seconds';
  return `${x} ${unit}${x === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------- the table

/** One ability's wordings: whole-message patterns over plainWords(text), and what they mean. */
interface Row {
  re: RegExp;
  /** The meaning, or a function of the match (a timer's minutes). */
  m: Meant | ((x: RegExpExecArray) => Meant | null);
}

const R = (re: RegExp, m: Row['m']): Row => ({ re, m });

const MUSIC = String.raw`(?:some |a bit of |a little |the )?(?:music|tunes|choons|toons|songs|a song|a tune|some sounds|sounds|beats|bangers|something to listen to|anything to listen to|background music|tunes on)`;
const PLAY = String.raw`(?:play|put on|stick on|bung on|throw on|chuck on|whack on|pop on|get|start|give me|gimme|i want|i fancy|fancy|hear|listen to|blast|crank up|turn on|switch on)`;
const RADIO_LINE = 'Playing your radio.';
const radio: Meant = { id: 'radio', act: 'radio', open: 'radio', line: RADIO_LINE };
const radioStop: Meant = { id: 'radio-stop', act: 'radio-stop', line: 'Radio off.' };
const water: Meant = { id: 'water', say: 'I drank a glass of water' };
const pint: Meant = { id: 'water', say: 'I drank a pint of water' };
const lightsOn: Meant = { id: 'lights-on', say: 'turn on the lights' };
const lightsOff: Meant = { id: 'lights-off', say: 'turn off the lights' };
const open = (id: string, tab: string, line: string, panel?: string): Meant => ({ id, open: tab, line, ...(panel ? { panel } : {}) });
const map = open('map', 'eye', 'Opening the map.');
const lens = open('lens', 'lens', 'Opening the Lens: point it at anything.');
// [comic] THE COMIC is its own screen since the FINAL ROUND's comic lane (features/comic): its shelf, MAKE and the public-domain library
const comic = open('comic', 'comic', 'Opening Comic: your shelf, MAKE and the free library.');
const arcade = open('games', 'arcade', 'Opening the arcade.');
const gym = open('board games', 'gym', 'Opening the gym: chess, draughts and the board games.');
const settings = open('settings', 'settings', 'Opening Settings.');
const look = open('look', 'look', 'Here are my colours and looks: say one, like “make it red”.');
const agenda = open('agenda', 'agenda', 'Opening your agenda.');
const money = open('money', 'money', 'Opening your money.');
const library = open('library', 'library', 'Opening the library.');
const learn = open('learn', 'learn', 'Opening Learn.');
const radioScreen = open('radio screen', 'radio', 'Opening the radio.');
const weather: Meant = { id: 'weather', brain: "what's the weather" };
const news: Meant = { id: 'news', brain: "what's in the news today" };
/** [voice.u3] Any everyday duration ("a quarter of an hour", "twenty five minutes", "two and a half minutes"), said back exactly. */
const exactTimer = (x: RegExpExecArray): Meant | null => {
  // ("give us a shout in ten": a bare number there is minutes, as people say it)
  const bare = /^(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty five|forty|fifty|sixty)$/.exec(x[1]!.trim());
  const s = bare ? (amount(bare[1]!) ?? 0) * 60 : durationSecs(x[1]!);
  return s && s <= 24 * 3600 ? { id: 'timer', say: `set a timer for ${secsWords(s)}` } : null;
};
const timer = (x: RegExpExecArray): Meant | null => {
  const d = duration(x[1]!, x[2]!);
  return d ? { id: 'timer', say: `set a timer for ${d}` } : null;
};

const ROWS: Row[] = [
  // ---- the radio and music
  R(new RegExp(`^${PLAY} ${MUSIC}(?: on)?$`), radio),
  R(new RegExp(`^(?:put|stick|bung|chuck|whack|pop|throw|get|bang) ${MUSIC} (?:on|going)$`), radio),
  R(new RegExp(`^(?:play|sing) (?:us|me) ${MUSIC}$|^(?:drop|spin) (?:some |a few )?(?:beats|tunes|tracks|records|bangers)$|^${MUSIC} would be (?:nice|good|lovely|great)$`), radio),
  R(/^(?:put|stick|bung|chuck|whack|pop|throw|get) (?:the |a |some )?(?:radio|wireless|tunes|music|some tunes|some music) on$/, radio),
  R(/^(?:play|put on|stick on|turn on|switch on|start|bung on|fire up|crank up|give me|gimme) (?:the |a |some |my )?(?:radio|wireless|station|radio station|my station|my radio|last station|my last station|my favourite station|favourite station)$/, radio),
  R(/^(?:radio|radio on|music on|music please|tunes|tunes please|some tunes|some music|some music please|music|play music|play some music|play tunes|play the radio|play radio)$/, radio),
  R(/^(?:i want|i fancy|fancy|i need|need|i'd love|id love) (?:some |a bit of |a little )?(?:music|tunes|a tune|a song|some background music|something to listen to)$/, radio),
  R(/^(?:i want to|i wanna|let me) (?:hear|listen to) (?:something|some music|some tunes|music|tunes|the radio|a song)$/, radio),
  R(/^(?:hear|listen to) (?:something|some music|some tunes|music|tunes|the radio|a song)$/, radio),
  R(/^(?:it's|its|it is) (?:too )?quiet in here$|^(?:make some|some) noise$|^entertain me with (?:some )?music$|^(?:get|start) the (?:party|music) (?:started|going)$/, radio),
  R(/^(?:stop|kill|cut|turn off|switch off|pause|silence|mute|shut off|end|enough) (?:the )?(?:music|radio|tunes|song|station|wireless)(?: off)?$|^(?:music|radio|tunes) off$|^(?:turn|switch|shut) (?:the )?(?:music|radio|tunes) off$/, radioStop),
  R(/^(?:open|show|show me|go to|take me to|bring up) (?:the )?(?:radio|radio stations|stations|radio page|radio screen)$/, radioScreen),
  // ---- water
  R(/^(?:log|add|record|note|track|count|put down|mark) (?:a |one |another )?(?:glass|cup|mug|bottle|drink|cuppa)(?: of water| water)?$/, water),
  R(/^(?:log|add|record|note|track|count|put down|mark) (?:a |one |another )?(?:water|glass of water|cup of water|bottle of water|drink of water)$/, water),
  R(/^(?:log|add|record|note|track|count|put down|mark) (?:a |one |another )?pint(?: of water)?$/, pint),
  R(/^(?:i(?:'ve| have)? (?:just )?(?:had|drank|drunk|finished|downed|necked)|just (?:had|drank|drunk|finished|downed|necked)|had|drank|drunk|necked|downed|finished) (?:a |one |another |some )?(?:glass|cup|mug|bottle|drink|glass of water|cup of water|bottle of water|drink of water|water|bit of water)(?: of water)?$/, water),
  R(/^(?:i(?:'ve| have)? (?:just )?(?:had|drank|drunk|finished|downed|necked)|just (?:had|drank|drunk|necked)|had|drank|drunk|necked|downed) (?:a |one |another )?pint(?: of water)?$/, pint),
  R(/^(?:log|track|add|count) (?:my )?water$|^(?:water (?:logged|drunk|done|had)|one water|another water|glass of water down|hydrated|i'm hydrated|im hydrated|just hydrated|stayed hydrated)$/, water),
  // ---- the lights (his own Home Assistant)
  R(/^(?:lights?|the lights?|all the lights|all lights) (?:on|up)$|^(?:turn|switch|flick|put|stick|pop) (?:on )?(?:the |all the |my )?lights?(?: on)?$|^(?:lights|light) please$|^(?:let there be light|it's too dark in here|its too dark in here|too dark in here|i can't see a thing|i cant see a thing|brighten the room|brighten up the room|get the lights)$/, lightsOn),
  R(/^(?:lights?|the lights?|all the lights|all lights) (?:off|out|down)$|^(?:turn|switch|flick|put|knock|shut|kill|cut) (?:off |out )?(?:the |all the |my )?lights?(?: off| out)?$|^(?:kill|cut|lose|douse) (?:the |all the )?lights?$|^(?:lights out|blackout|it's too bright in here|its too bright in here|too bright in here|darkness please|make it dark in here)$/, lightsOff),
  // ---- timers
  R(new RegExp(`^(?:timer|time|countdown|count down|start a timer|start a countdown|set a timer|set timer|set a countdown|set an alarm|alarm|ring|buzz) (?:for |of )?${NUM} ${UNIT}$`), timer),
  R(new RegExp(`^${NUM} ${UNIT} (?:timer|countdown|alarm)$`), timer),
  R(new RegExp(`^(?:give me|give us|gimme) a (?:shout|buzz|bell|nudge|ping|ring|knock) in ${NUM} ${UNIT}$`), timer),
  R(new RegExp(`^(?:shout|buzz|ping|nudge|beep|wake) (?:at )?(?:me |us )?in ${NUM} ${UNIT}$`), timer),
  R(new RegExp(`^time (?:me|us|this|it) (?:for )?${NUM} ${UNIT}$`), timer),
  R(new RegExp(`^(?:tell|remind|warn) me when ${NUM} ${UNIT} (?:is|are|has|have) (?:up|gone|passed)$`), timer),
  R(new RegExp(`^(?:time|count down|countdown) ${NUM} ${UNIT}$`), timer),
  R(new RegExp(`^(?:the |my )?(?:eggs?|pasta|rice|tea|brew|kettle|oven|pizza) (?:for |needs |takes )?${NUM} ${UNIT}$`), timer),
  // [voice.u3] the same asks with any duration in them, read exactly ("give us a shout in a quarter of an hour", "time me for one minute thirty")
  R(/^(?:timer|time|countdown|count down|start a timer|start a countdown|set a timer|set timer|set a countdown|set an alarm|alarm|ring|buzz) (?:for |of )?(.+)$/, exactTimer),
  R(/^(?:give me|give us|gimme) a (?:shout|buzz|bell|nudge|ping|ring|knock) in (.+)$/, exactTimer),
  R(/^(?:shout|buzz|ping|nudge|beep|wake) (?:at )?(?:me |us )?in (.+)$/, exactTimer),
  R(/^time (?:me|us|this|it) (?:for )?(.+)$/, exactTimer),
  // ---- the map, the Lens, the comic
  R(/^(?:open|show|show me|bring up|pull up|load|go to|take me to|get|i need|i want|see|lemme see) (?:the |a |my )?(?:map|maps|world map|globe|god's eye|gods eye|the world)$|^where am i on the map$|^show me where i am(?: on the map)?$|^(?:open|show) (?:google|apple) maps$|^(?:god's eye|gods eye|world map|the globe)$/, map),
  R(/^(?:open|start|launch|fire up|bring up|pull up|go to|use|get|show me) (?:the |my )?(?:lens|camera lens|scanner|camera to look|look camera|visual search|google lens|lens camera)$|^(?:the )?(?:lens|google lens|visual search)$|^(?:point and look|look at this for me|have a look at this|tell me what this is|what is that thing)$/, lens),
  R(/^(?:open|start|make|draw|write|create|show|show me|read|go to|bring up) (?:the |a |my |me a )?(?:comic|comics|comic book|comic strip|graphic novel|manga|strip)$|^(?:i want to|let's) (?:make|draw|read) (?:a )?comics?$|^comic time$|^new comic$/, comic),
  // ---- the editors (their own tables take the canonical words)
  R(/^(?:write|start|make|create|open|draft|type|type up|begin) (?:a |an |up a |me a )?(?:new )?(?:document|doc|letter|word doc|word document|essay|note|text document|report)$|^new (?:document|doc|letter|word doc|word document|text document)$|^(?:open|show) (?:my )?(?:documents|docs|word)$/, { id: 'docs', say: 'new document' }),
  R(/^(?:make|start|create|open|build|do) (?:a |an |me a )?(?:new )?(?:spreadsheet|sheet|excel|excel sheet|table|budget sheet|workbook)$|^new (?:spreadsheet|sheet|excel sheet|workbook)$|^(?:open|show) (?:my )?(?:spreadsheets|sheets|excel)$/, { id: 'sheets', say: 'new spreadsheet' }),
  R(/^(?:make|start|create|open|build|do|put together) (?:a |an |me a |some )?(?:new )?(?:presentation|slideshow|slide show|slide deck|deck|powerpoint|power point|keynote|slides)$|^new (?:presentation|slideshow|slide deck|deck|slides)$|^(?:open|show) (?:my )?(?:presentations|slides|decks|powerpoint)$/, { id: 'slides', say: 'open slides' }),
  R(/^(?:edit|fix|touch up|retouch|crop|tweak|enhance|filter|brighten|sort out) (?:a |my |this |that |the )?(?:photo|picture|pic|snap|selfie|image)$|^(?:open|show) (?:my |the )?(?:photos|pictures|pics|camera roll|gallery|snaps)$|^photo editor$/, { id: 'photo', say: 'edit a photo' }),
  R(/^(?:edit|cut|trim|make|fix|splice|chop) (?:a |my |this |that |the )?(?:video|clip|vid|film|movie|reel|footage)$|^(?:open|show) (?:my )?(?:videos|clips|vids|films|reels)$|^video editor$/, { id: 'video', say: 'edit a video' }),
  // ---- games: the arcade, the gym's board games, or ask
  R(/^(?:open|go to|show me|take me to) (?:the )?arcade$|^(?:play|start|fancy|i fancy|let's play) (?:an |some )?(?:arcade game|arcade games|arcade|retro game|retro games)$/, arcade),
  R(/^(?:play|start|fancy|i fancy|let's play|give me|gimme) (?:a )?(?:game of )?(?:chess|draughts|checkers|board game|board games|connect four|connect 4)$/, gym),
  // ---- paint and materials for a room (make.c6): SPACE opened on MATERIALS, first estimates for his plan
  R(/^(?:how much|how many tins of|how many litres of) (?:paint|emulsion|wallpaper|flooring|carpet|laminate|skirting)(?: do i need| would i need| will i need)?(?: for| to do| to paint)? (?:my |the |a )?([a-z ]{2,30}?)(?: room)?$|^(?:paint|wallpaper|flooring|materials) (?:for|calculator for) (?:my |the |a )?([a-z ]{2,30}?)$|^(?:paint|materials|wallpaper) calculator$/, (x) => {
    const room = (x[1] ?? x[2] ?? '').trim();
    return { id: 'materials', open: 'space', panel: 'MATERIALS', line: `Materials are open: paint, flooring, skirting and wallpaper for your plan, first estimates.${room ? ` Draw or pick the ${room} on the plan and it works it out for that room.` : ''}` };
  }),
  // ---- traffic cameras on a road (see.c6): the brain finds and shows them; the meaning is noted for it
  R(/^(?:show me |open |bring up |are there |any )?(?:the )?(?:traffic |road |live )?cameras? (?:on|near|at|along|by|around) (?:the )?([a-z0-9 ]{2,30})$|^(?:what'?s|how'?s) (?:the )?traffic (?:like )?(?:on|near|at) (?:the )?([a-z0-9 ]{2,30})$/, (x) => ({ id: 'cameras', brain: `show the traffic cameras on the ${(x[1] ?? x[2] ?? '').trim()}` })),
  // ---- the weather and the news (the brain answers; the meaning is noted for it)
  R(/^(?:what's|whats|what is|how's|hows|how is) (?:the )?(?:weather|forecast|weather like|weather looking|weather doing)(?: (?:today|tomorrow|like|outside|out there|later))?$|^(?:is it|will it|is it going to|is it gonna|will it be|gonna) (?:rain|raining|snow|snowing|sunny|cold|hot|warm|wet|windy|chuck it down|tip it down|pour|pouring|be nice|be cold|be warm|be wet)(?: (?:today|tomorrow|later|outside|out|this afternoon|tonight|this evening|at home|here|at work))?$|^(?:what's|whats|what is) the (?:weather|forecast) (?:going to be|gonna be|looking) like(?: today| tomorrow| later| this weekend)?$|^(?:do i need|should i take|should i bring) (?:a |an )?(?:coat|brolly|umbrella|jacket)(?: today)?$|^(?:weather|forecast|the weather|the forecast)(?: today| tomorrow)?$|^(?:what's|whats) it (?:like|doing) outside$/, weather),
  R(/^(?:what's|whats|what is|any|what's the|whats the) (?:in )?(?:the )?(?:news|headlines|latest|latest news|top stories|happening in the world|going on in the world)(?: today)?$|^(?:news|headlines|the news|the headlines)(?: today| please)?$|^(?:read|tell|give|show) me (?:the )?(?:news|headlines|top stories)$|^(?:what did i miss in the world|anything happening in the world|what's going on out there|whats going on out there)$/, news),
  // ---- the rooms by plainer names
  R(/^(?:open|show|go to|take me to|bring up) (?:the |my )?(?:settings|preferences|options|setup|config|control panel)$|^(?:settings|preferences|options)$|^(?:change|adjust) (?:my |your |the )?settings$/, settings),
  R(/^(?:change|switch|pick|choose|set) (?:the |your |my |a |a new )?(?:theme|colour|color|colours|colors|look|accent)$|^(?:open|show|show me) (?:the |your )?(?:themes|colours|colors|looks)$/, look),
  R(/^(?:open|show|go to|show me|take me to|bring up|check) (?:the |my )?(?:agenda|diary|calendar|schedule|planner|day plan|week)$|^(?:my )?(?:diary|calendar|schedule)$|^what's on my (?:calendar|diary|schedule)$/, agenda),
  R(/^(?:open|show|go to|show me|take me to|bring up|check) (?:the |my )?(?:money|finances|budget|spending|bank|accounts|wallet)$|^how much (?:have i|did i) spen[dt](?: this month)?$|^where's my money gone$|^wheres my money gone$/, money),
  R(/^(?:open|show|go to|show me|take me to|bring up) (?:the |my )?(?:library|books|bookshelf|reading list|shelf)$|^(?:i want to|let me) read (?:a |my )?book$|^read (?:me )?(?:a |my )?book$/, library),
  R(/^(?:open|show|show me|go to|take me to|bring up) (?:the |my )?(?:learn|learning page|lessons|courses|study page)$|^(?:learn something|learn something new|teach me something|i want to learn something|help me learn something|i'm bored teach me something|im bored teach me something)$/, learn),
];

// ---------------------------------------------------------------- every screen by its everyday names (NEXT ROUND, voice.u2)

/**
 * Every screen of the app with the names people call it. `names` are said after a verb ("open", "show me", "take me to", "bring up",
 * "I need", "let me see"…) with or without "the/my" and "screen/page/app"; `bare` names are distinctive enough to work on their own.
 * The rows above win (they are more particular), and every table on the phone has his words before this does.
 */
// (`place`: the screen shares its name with a real place he could go to — school, work, the gym, the library, the bank, the kitchen:
//  only a screen verb opens it ("open the gym", "show me the library page"); "take me to school", "go to work" or "where is the library"
//  are left to the brain, which can plan the journey)
export const SCREENS: { tab: string; label: string; names: string[]; bare?: string[]; panel?: string; place?: true }[] = [
  { tab: 'core', label: 'Home', place: true, names: ['home', 'home screen', 'chat', 'the chat', 'conversation', 'main screen', 'start screen'] },
  { tab: 'eye', label: 'God’s Eye', names: ['god’s eye', "god's eye", 'gods eye', 'the eye', 'globe', 'world view', 'live map', 'flight tracker', 'planes', 'ships'], bare: ["god's eye", 'gods eye'] },
  { tab: 'lens', label: 'the Lens', names: ['lens', 'camera lens', 'scanner', 'visual search'] },
  { tab: 'interpreter', label: 'the Interpreter', names: ['interpreter', 'translator', 'translation', 'live translation', 'translate app'], bare: ['interpreter', 'translator'] },
  { tab: 'lab', label: 'the Lab', place: true, names: ['lab', 'laboratory', 'science lab', 'experiments'] },
  { tab: 'rehearse', label: 'Rehearse', names: ['rehearse', 'rehearsal', 'practice a speech', 'speech practice', 'presentation practice'] },
  { tab: 'brief', label: 'the Brief', names: ['brief', 'briefing', 'morning brief', 'daily brief', 'my day', 'daily summary'], bare: ['morning brief', 'daily brief', 'my briefing'] },
  { tab: 'agenda', label: 'your agenda', names: ['agenda', 'diary', 'calendar', 'schedule', 'planner', 'to do list', 'to-do list', 'todo list', 'reminders', 'appointments'] },
  { tab: 'threats', label: 'Threats', names: ['threats', 'threat map', 'safety map', 'alerts', 'warnings', 'security alerts'] },
  { tab: 'markets', label: 'Markets', place: true, names: ['markets', 'stocks', 'stock market', 'shares', 'crypto', 'prices', 'my portfolio', 'portfolio', 'investments'] },
  { tab: 'radio', label: 'the radio', names: ['radio', 'radio stations', 'stations', 'wireless'] },
  { tab: 'memory', label: 'Memory', names: ['memory', 'memories', 'what you remember', 'what you know about me', 'your memory'] },
  { tab: 'library', label: 'the library', place: true, names: ['library', 'books', 'my books', 'bookshelf', 'reading list', 'ebooks'] },
  { tab: 'reader', label: 'the reader', place: true, names: ['reader', 'book reader', 'e-reader', 'ereader', 'kindle', 'the book i was reading'] },
  { tab: 'workshop', label: 'the Workshop', names: ['workshop', 'upgrades', 'what you are building', "what's new", 'whats new', 'changes'] },
  { tab: 'learn', label: 'Learn', names: ['learn', 'courses', 'lessons', 'learning hub', 'study'] },
  { tab: 'gym', label: 'the gym', place: true, names: ['gym', 'chess', 'board games', 'brain gym', 'puzzles'] },
  { tab: 'school', label: 'School', place: true, names: ['school', 'exams', 'papers', 'your school', 'your grades'] },
  { tab: 'studio', label: 'the 3D studio', names: ['3d studio', '3-d studio', 'three d studio', '3d', 'modelling', 'modeling', '3d models', 'design studio'], bare: ['3d studio'] },
  { tab: 'reverse', label: 'Reverse', names: ['reverse', 'reverse engineer', 'reverse engineering', 'teardown'] },
  { tab: 'space', label: 'Space', names: ['space', 'space planner', 'room planner', 'floor plan', 'floorplan', 'room layout', 'house plan', 'interior design'], bare: ['room planner', 'floor plan', 'floorplan'] },
  { tab: 'workbench', label: 'the Workbench', names: ['workbench', 'calculators', 'engineering', 'wind tunnel', 'beam calculator', 'estimates'], bare: ['workbench', 'wind tunnel'] },
  { tab: 'links', label: 'Links', names: ['links', 'connections', 'connected accounts', 'integrations', 'linked accounts'] },
  { tab: 'settings', label: 'Settings', names: ['settings', 'preferences', 'options', 'setup', 'control panel', 'config'] },
  { tab: 'look', label: 'The look', names: ['look', 'the look', 'themes', 'theme', 'colours', 'colors', 'looks', 'appearance', 'wallpaper'] },
  { tab: 'system', label: 'System', names: ['system', 'status', 'diagnostics', 'system status', 'health check', 'brain status'] },
  { tab: 'arcade', label: 'the Arcade', names: ['arcade', 'games', 'retro games', 'my games', 'video games'] },
  { tab: 'money', label: 'Money', place: true, names: ['money', 'finances', 'budget', 'budgets', 'spending', 'bank', 'bills', 'wallet', 'subscriptions'] },
  { tab: 'body', label: 'Body', names: ['body', 'health', 'fitness', 'my health', 'trackers', 'health tracker', 'water tracker', 'sleep tracker', 'steps', 'workouts'] },
  { tab: 'kitchen', label: 'the kitchen', place: true, names: ['kitchen', 'recipes', 'cooking', 'meal plan', 'pantry', 'larder', 'shopping list', 'cookbook'] },
  { tab: 'people', label: 'People', names: ['people', 'contacts', 'my people', 'friends', 'family', 'birthdays', 'who is who'] },
  { tab: 'work', label: 'Work', place: true, names: ['work', 'work stuff', 'my work', 'jobs', 'tasks', 'pomodoro', 'focus timer', 'interview practice'] },
  { tab: 'creative', label: 'Creative', names: ['creative', 'creative stuff', 'drawing', 'art', 'music maker', 'beat maker', 'poems', 'writing prompts'] },
  { tab: 'outside', label: 'Outside', place: true, names: ['outside', 'out and about', 'parking', 'car park', 'toilets', 'walks', 'safe walk'] },
  { tab: 'homeadmin', label: 'Household', names: ['household', 'home admin', 'house admin', 'bins', 'meter readings', 'warranties', 'renewals'] },
  { tab: 'learning', label: 'Learning', names: ['typing practice', 'typing test', 'spelling practice', 'speed reading', 'first aid'] },
  { tab: 'coach', label: 'the Coach', names: ['coach', 'tuner', 'guitar tuner', 'instrument lessons', 'music lessons', 'juggling'] },
  { tab: 'social', label: 'Social', names: ['social', 'socials', 'social media', 'my accounts posts', 'posts', 'my posts'] },
  { tab: 'convert', label: 'Convert', names: ['convert', 'converter', 'unit converter', 'conversions', 'currency converter'], bare: ['unit converter', 'converter'] },
  { tab: 'docs', label: 'Documents', names: ['documents', 'docs', 'word processor', 'letters', 'my documents', 'notes'] },
  { tab: 'sheets', label: 'Spreadsheets', names: ['spreadsheets', 'sheets', 'excel', 'tables'] },
  { tab: 'slides', label: 'Presentations', names: ['presentations', 'slides', 'decks', 'powerpoint', 'keynote', 'slideshows'] },
  { tab: 'workspace', label: 'the Workspace', names: ['workspace', 'notion', 'wiki', 'pages', 'my pages', 'notebook'] },
  { tab: 'photo', label: 'Photo', names: ['photo editor', 'photos', 'pictures', 'camera roll', 'gallery', 'my photos'], bare: ['photo editor'] },
  { tab: 'video', label: 'Video', names: ['video editor', 'videos', 'my videos', 'clips', 'films'], bare: ['video editor'] },
  { tab: 'gamestudio', label: 'the Game Studio', names: ['game studio', 'game maker', 'game builder', 'make games', 'my game projects'], bare: ['game studio', 'game maker'] },
  { tab: 'comic', label: 'the comic', names: ['comic', 'comics', 'comic book', 'comic maker', 'graphic novels', 'manga'] },
  { tab: 'house', label: 'the house', place: true, names: ['house', 'smart home', 'home controls', 'lights and heating', 'heating', 'thermostat', 'my house'] },
];

const SCREEN_VERB = String.raw`(?:open(?: up)?|show(?: me)?|go to|go into|take me to|bring up|pull up|load|launch|start|get|switch to|jump to|i need|i want|let me see|lemme see|see|where'?s|where is|find)`;
/** The verbs that can only mean the app's screen, never a trip there. */
const SCREEN_ONLY = /^(?:open(?: up)?|show(?: me)?|bring up|pull up|load|launch|switch to|jump to|let me see|lemme see)$/;
/** The screen his words name, by any of its everyday names, or null. */
export function screenOf(text: string): (typeof SCREENS)[number] | null {
  const t = plainWords(text).replace(/[’]/g, "'");
  if (!t || t.length > 50) return null;
  const m = new RegExp(`^(${SCREEN_VERB}) (.+)$`).exec(t);
  const rest = (m ? m[2]! : t).replace(/^(?:the|my|your|a) /, '');
  const appWord = / (?:screen|page|tab|app|section)$/.test(rest);
  const screenVerb = !!m && SCREEN_ONLY.test(m[1]!);
  // the name as said, and without a trailing "screen", "page", "app"… ("the main screen" is a name; "the money page" is Money)
  const said = [rest, rest.replace(/ (?:screen|page|tab|app|room|section|bit|thing)$/, '')];
  const norm = (n: string) => n.replace(/[’]/g, "'").replace(/^(?:the|my|your) /, '');
  for (const s of SCREENS) {
    const names = m ? s.names : (s.bare ?? []);
    if (!names.some((n) => said.includes(norm(n)))) continue;
    if (s.place && m && !screenVerb && !appWord) continue;
    return s;
  }
  return null;
}

/** The words that could fairly mean two things: one short question, both as keys. */
const TWO: { re: RegExp; ask: TwoWays }[] = [
  {
    re: /^(?:play|put on|stick on|start|put|throw on) (?:something|anything|summat|something fun|something good|whatever)(?: on)?$|^(?:play|let's play|i want to play|fancy playing) (?:a game or music|something)$/,
    ask: { q: 'Music, or a game?', two: [{ ...radio, key: 'MUSIC' }, { ...arcade, key: 'A GAME' }] },
  },
  {
    re: /^(?:play|start|let's play|i want to play|fancy|i fancy|give me|gimme) (?:a |an |some )?(?:game|games|quick game)$|^(?:i'm|im) bored(?: play something| let's play)?$|^(?:games|game time)$/,
    ask: { q: 'The arcade, or a board game?', two: [{ ...arcade, key: 'ARCADE' }, { ...gym, key: 'BOARD GAME' }] },
  },
  {
    re: /^(?:open|show|show me|bring up) (?:the )?(?:camera|cam)$|^(?:camera|cam)$/,
    ask: { q: 'The Lens, to name what it sees, or the map’s cameras?', two: [{ ...lens, key: 'LENS' }, { ...map, key: 'CAMERAS' }] },
  },
  {
    // "lights off" is the room's lights or a dark screen (the look's words for the ground): asked, never guessed
    re: /^(?:lights?|the lights?) (?:off|out)$/,
    ask: { q: 'The room’s lights, or a dark screen?', two: [{ ...lightsOff, key: 'ROOM LIGHTS' }, { id: 'dark screen', say: 'dark mode', key: 'DARK SCREEN' }] },
  },
  {
    re: /^(?:lights?|the lights?) on$/,
    ask: { q: 'The room’s lights, or a light screen?', two: [{ ...lightsOn, key: 'ROOM LIGHTS' }, { id: 'light screen', say: 'light mode', key: 'LIGHT SCREEN' }] },
  },
  {
    re: /^(?:light|lights|the lights|the light)$/,
    ask: { q: 'Lights on, or off?', two: [{ ...lightsOn, key: 'ON' }, { ...lightsOff, key: 'OFF' }] },
  },
];

/**
 * His words → their one meaning, the question between two, or null (words this layer does not know, left to the tables and the
 * brain exactly as before).
 */
export function meaningOf(text: string): Meant | TwoWays | null {
  const t = plainWords(text);
  if (!t || t.length > 90) return null;
  for (const { re, ask } of TWO) if (re.test(t)) return ask;
  for (const r of ROWS) {
    const x = r.re.exec(t);
    if (!x) continue;
    const m = typeof r.m === 'function' ? r.m(x) : r.m;
    if (m) return m;
  }
  // [voice.u2] every screen by its everyday names
  const sc = screenOf(t);
  if (sc) return { id: `screen:${sc.tab}`, open: sc.tab, line: `Opening ${sc.label}.`, ...(sc.panel ? { panel: sc.panel } : {}) };
  return null;
}

export const isTwo = (m: Meant | TwoWays | null): m is TwoWays => !!m && 'two' in m;

/** The ids this layer can mean (for the checks: each must have wordings in the table test). */
export const MEANING_IDS = ['radio', 'radio-stop', 'radio screen', 'water', 'lights-on', 'lights-off', 'timer', 'map', 'lens', 'comic', 'docs', 'sheets', 'slides', 'photo', 'video', 'games', 'board games', 'weather', 'news', 'settings', 'look', 'agenda', 'materials', 'cameras', 'money', 'library', 'learn'] as const;

/** The note the brain is given beside his words when the phone read a meaning it cannot do itself (one short line). */
export const meantNote = (m: Meant): string => (m.brain ? `\n\n(The phone read this as: ${m.brain}.)` : '');
