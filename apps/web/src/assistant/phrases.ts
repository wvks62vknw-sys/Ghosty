/**
 * What the chat answers on this phone with no model, as the tables that recognise it. Pure, so the ABILITIES catalogue
 * reads the same list (apps/web/src/abilities/sources.ts) and its test can too.
 *
 *  - LOCAL_ASKS: the questions about Ghosty himself, in the order assistant/local.ts `localTurn` tries them — it dispatches
 *    from this list (a table added here needs its handler there, or the typecheck fails; a handler not listed here is never
 *    asked). A table that matches but has nothing to say (no open question for "you were right") lets the next one try.
 *    The car's two come first (BRIEF-CAR): what is wrong with a car (car/faults.ts, the fault table), and the words that
 *    open its views ("open the bonnet", "show me the engine": before the Workbench's engine panel, which has them too).
 *    Then the look (BRIEF-THEMES-2: "black background", "lighter", "paper", "the map", "calm", "bigger text", "follow the
 *    day"; packages/shared/src/themes.ts lookAsked), before anything that could hear "calm" or "paper" its own way.
 *  - FIRST_ASKS: what assistant/session.ts `send` reads before anything else, with the same matchers it uses: the walk home
 *    (assistant/guard.ts), a stop by intent, "reboot".
 * The panic phrase is his own words, checked by their hash only (Settings → GUARDIAN), so it has no table here; PEOPLE's
 * "this is Sam" is the Lens's while PEOPLE is open (features/lens/people.ts).
 */
import { canYouAsked, todayAsked, whyAsked } from '../../../../packages/shared/src/abilities';
import { foresightAsked, rightSaid } from '../../../../packages/shared/src/foresight';
import { homeSaid, walkCancelled, walkStart } from '../../../../packages/shared/src/guardian';
import { readingIntent, stopIntent } from '../../../../packages/shared/src/intent';
import { workbenchAsked } from '../../../../packages/shared/src/workbench';
import { machineAsked } from '../features/eye/machine';
import { looksLikeStatement } from '../../../../packages/shared/src/money';
import { moneyAsked } from '../features/money/words';
import { bodyAsked } from '../../../../packages/shared/src/body';
import { trackAsked } from '../features/body/trackcore';
import { larderAsked } from '../features/kitchen/larderwords';
import { ovenAsked, shoppingAsked, timerAsked } from '../../../../packages/shared/src/kitchen';
import { symptomOf, viewAsked } from '../car/faults';
import { originAsked } from '../../../../packages/shared/src/social';
import { wikiAsked } from '../wiki/words';
import { morseAsked } from '../morse/code';
import { COMING_ASK, PEOPLE_ASK } from '../../../../packages/shared/src/people';
import { INTERVIEW_ASK, POMO_ASK } from '../../../../packages/shared/src/work';
import { BEAT_ASK, DRAW_ASK } from '../../../../packages/shared/src/creative';
import { ratingAsked } from '../gym/chessrate';
import { coachAsked } from '../coach/ask';
import { shapesAsked } from '../hands/words';
import { tvAsked } from '../tv/detect';
import { lookAsked } from '../../../../packages/shared/src/themes';
import { looksAsked } from '../../../../packages/shared/src/looks';
import { INDEPENDENT_ASK } from '../offline/trust';
import { buildAsked } from '../build/words';
import { thatOne } from './thatwords';
import { whatCanAsked } from './words';
import { numberIn, roomNumberIn } from '../shell/rooms';
import { houseAsked } from '../../../../packages/shared/src/house';
import { convertAsked } from '../convert/asks';
import { commentsAsked, docsAsked, fillAsked, mergeAsked, paperAsked } from '../docs/asks';
import { sheetsAsked } from '../sheets/asks';
import { slidesAsked } from '../slides/asks';
import { cardsAsked, voiceNoteAsked, workspaceAsked } from '../workspace/asks';
import { photoAsked } from '../photo/asks';
import { videoAsked } from '../video/asks';
import { gameAsked } from '../studio-game/asks';
// [planlane] the PLAN AND HOME lane's screens by chat (each features/<screen>/asks.ts, pure)
import { agendaAsked } from '../features/agenda/asks';
import { radioAsked } from '../features/radio/asks';
import { meaningOf } from '../../../../packages/shared/src/meanings';
import { marketsAsked } from '../features/markets/asks';
import { briefAsked } from '../features/brief/asks';
import { screenAsked } from './screenasks';
import { comicAsked } from '../features/comic/asks';
import { base64Asked, unitsAsked, unixAsked } from '../convert/units';
import { outsideAsked } from '../../../../packages/shared/src/outside';
import { homeAsked } from '../../../../packages/shared/src/homeadmin';
import { learningAsked } from '../../../../packages/shared/src/learning';
import { typingPending } from '../features/learning/typing';
import { furtherAsked } from '../further/words';
import { missedAsked, teachAsked, watcherAsked } from '../../../../packages/shared/src/lifeeasier';
import { chaseAsked, chasingAsked, recallAsked } from '../../../../packages/shared/src/recall';

/** [recall] FIND over his own things: "find garden in my things", "search my notes for garden"; the words looked for, else null. */
export function findAsked(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, '');
  const m = /^(?:find|search(?: for)?|look for) (.+?) (?:in|across|through) (?:all )?my (?:things|stuff|notes|documents|docs|files|pages|workspace)$/i.exec(t) ?? /^search (?:all )?my (?:things|stuff|notes|documents|docs|files|pages|workspace) for (.+)$/i.exec(t);
  return m ? m[1]!.trim() : null;
}

/**
 * [voice lane] "Do you know it's me?", "who's talking?", "can you recognise my voice?": answered from the phone's own tag, truly
 * (assistant/voiceknown.ts whoWords), before "can you …?" could call it an ability he lacks. His voice is never a lock.
 */
export const SPEAKER_ASK = /^(?:(?:hey |ok |so )?(?:ghosty,? )?)(?:do you (?:know|recognise|recognize) (?:it's|its|it is|that it's|that its) me|(?:do|can|could) you (?:know|recognise|recognize|tell|hear) (?:my voice|it's me|its me|it is me|who i am|who's (?:talking|speaking)|who is (?:talking|speaking)|me by my voice|me from my voice|that it's me)|do you know (?:my voice|who's talking|who is talking|who's speaking|who is speaking|who i am|me)|who(?:'s| is) (?:talking|speaking)(?: (?:now|to you|right now))?|whose voice (?:is (?:this|that)|was that|is it)|(?:is|was) (?:that|this|it) me(?: (?:talking|speaking))?|did you recognise (?:me|my voice)|did you recognize (?:me|my voice)|how do you know it's me|are you sure it's me|who said that|who am i to you|recognise me|recognize me)[?.!]*$/i;

/** "reboot": the boot cinematic again, here on the phone (shell/boot.ts); the brain is not asked. */
export const REBOOT = /^(reboot|reboot (him|yourself|ghosty)|restart yourself)[.!]?$/i;

export const LOCAL_ASKS = [
  { id: 'carview', test: (t: string) => viewAsked(t) !== null },
  { id: 'carfault', test: (t: string) => symptomOf(t) !== null },
  // [voice lane] "do you know it's me?": from the phone's own tag (before "can you…?" could call it an ability he lacks)
  { id: 'speaker', test: (t: string) => SPEAKER_ASK.test(t.trim().replace(/[’]/g, "'")) },
  // [awareness] "make that wall longer", "add a wardrobe there", "find me a replacement", "open that one": the words that point at what is
  // selected on the screen, acted on here with no model (assistant/thatone.ts); when nothing fitting is selected the next table, then the brain
  { id: 'thatone', test: (t: string) => thatOne(t) !== null },
  // [shell2] "open two", "go to number three", "open learn 5": a number said where he is opens that thing (shell/rooms.ts numbers, assistant/roomnumber.ts); only with a verb, so a bare "2" in a conversation is not taken
  { id: 'roomnumber', test: (t: string) => /^(?:ok(?:ay)?[, ]+|please[, ]+)?(?:open|go to|show|take me to)\b/i.test(t.trim()) && (numberIn(t) !== null || roomNumberIn(t) !== null) },
  // [lifeeasier] "what did I miss?", "teach me what you learned this week", "tell me when this price drops": his own records and the pages he names (assistant/life.ts)
  // [recall] "what did I ask you about trains?", "find garden in my things", "remind me to chase this if Sam doesn't reply by Thursday":
  // his own turns and things, answered from the phone's own index with no model (features/memory/recall.ts); a chase set on the brain
  { id: 'recall', test: (t: string) => recallAsked(t) !== null || findAsked(t) !== null },
  { id: 'chase', test: (t: string) => chaseAsked(t) !== null || chasingAsked(t) },
  { id: 'missed', test: (t: string) => missedAsked(t) },
  { id: 'teach', test: (t: string) => teachAsked(t) },
  { id: 'watcher', test: (t: string) => watcherAsked(t) !== null },
  // [themes2] the look by words, applied at once with no model (state/theme.ts)
  { id: 'look', test: (t: string) => lookAsked(t) !== null || looksAsked(t) !== null },
  // [further] the interpreter, the map of what I know, a walk through a screen, what changed, REHEARSE (further/ask.ts): the phone's own, no model
  { id: 'further', test: (t: string) => furtherAsked(t) },
  // [packs] a statement pasted in the chat: to his brain's SPENDING by the rule table, never to a model (assistant/packs.ts)
  { id: 'statement', test: (t: string) => looksLikeStatement(t) || /^(?:i want to |let me |can i )?(?:paste|add|read|send)\s+(?:in\s+)?(?:a|my)\s+(?:bank\s+)?statement[.!?]?$/i.test(t.trim()) },
  // [moneylane] "my budgets", "my subscriptions", "spending trends", "my spending": the MONEY screen opened on that page (features/money/words.ts)
  { id: 'moneyapp', test: (t: string) => moneyAsked(t) !== null },
  // [bodylane] the body trackers on the phone, no model (features/body/track.ts): water, sleep, steps, weight, mood, kept and asked
  // (a drink logged is the water table's, below, which keeps it on the phone the same way: the voice lane's meanings expect it there)
  { id: 'track', test: (t: string) => { const a = trackAsked(t); return a !== null && !(a.kind === 'log' && a.m === 'water'); } },
  // [packs] the body pack's screens and a glass of water, on the phone (features/body)
  { id: 'reps', test: (t: string) => bodyAsked(t)?.what === 'reps' },
  { id: 'run', test: (t: string) => bodyAsked(t)?.what === 'run' },
  { id: 'breathe', test: (t: string) => bodyAsked(t)?.what === 'breathe' },
  { id: 'stretch', test: (t: string) => bodyAsked(t)?.what === 'stretch' },
  { id: 'water', test: (t: string) => { const a = trackAsked(t); return bodyAsked(t)?.what === 'water' || (a?.kind === 'log' && a.m === 'water'); } },
  // [packs] the kitchen pack on the phone: timers, the shopping list, the oven line (features/kitchen)
  // [planlane] the radio's sleep timer and stations before the kitchen's timers: "sleep timer 30 minutes" is the radio's (radioAsked never takes a plain timer)
  // (a wording the VOICE lane's meanings own, "play my favourite station", stays theirs: they play it the one way everywhere)
  { id: 'planradio', test: (t: string) => !!radioAsked(t) && !meaningOf(t) },
  { id: 'timer', test: (t: string) => !!timerAsked(t) },
  // [bodylane] the pantry and the recipe book, kept on this phone (features/kitchen/larder.ts)
  { id: 'larder', test: (t: string) => larderAsked(t) },
  { id: 'shopping', test: (t: string) => shoppingAsked(t) },
  { id: 'oven', test: (t: string) => !!ovenAsked(t) },
  // [social] "who made you?", "where did you come from?": FATHER AND THE ORIGIN's first lines and its card (features/me)
  { id: 'origin', test: (t: string) => originAsked(t) },
  // [resta] Wikipedia from the file on this phone (wiki/ask.ts) and the Morse sheet (morse/sheet.ts), both with no model
  { id: 'wiki', test: (t: string) => !!wikiAsked(t) },
  { id: 'morse', test: (t: string) => !!morseAsked(t) },
  // [packs2] the people pack's who's who, on the phone (features/people); the work and creative packs' phrases follow
  { id: 'people', test: (t: string) => PEOPLE_ASK.test(t.trim()) || COMING_ASK.test(t.trim()) },
  { id: 'interview', test: (t: string) => INTERVIEW_ASK.test(t.trim()) },
  { id: 'pomodoro', test: (t: string) => POMO_ASK.test(t.trim()) },
  { id: 'beat', test: (t: string) => BEAT_ASK.test(t.trim()) },
  // [restb] the coach's skills first: its DRAW lesson (the prompt of the day with his picture beside it) answers "what should I
  // draw" and "drawing prompt" ahead of the creative pack's one-line prompt below, which keeps the forms the coach does not take
  { id: 'skill', test: (t: string) => ['typing', 'draw', 'words', 'juggle'].includes(coachAsked(t)?.what ?? '') },
  { id: 'drawing', test: (t: string) => DRAW_ASK.test(t.trim()) },
  // [restc] "draw a room with my hands": the Lens on SHAPES (apps/web/src/hands)
  { id: 'shapes', test: (t: string) => shapesAsked(t) },
  // [restc] "TV mode on" / "TV mode off": the big layout for a television (apps/web/src/tv)
  { id: 'tvmode', test: (t: string) => tvAsked(t) !== null },
  // [offline2] "how independent are you?": the INDEPENDENCE sheet (features/system/independence.ts), and the week said
  { id: 'independent', test: (t: string) => INDEPENDENT_ASK.test(t.trim()) },
  // [restd] DESIGN A BUILD with no model: "design me a shed three by two", "show me the build", "price the roof", "make it 4 by 3"
  { id: 'build', test: (t: string) => !!buildAsked(t) },
  // [restd] his house through his own Home Assistant, with no model: "turn off the hall light", "set the heating to 21"
  { id: 'house', test: (t: string) => !!houseAsked(t) },
  // [packs3] the outside pack on the phone (features/outside): a car park, toilets, the car, "I'm lost", a safer walk; the home and learning packs' phrases follow
  { id: 'outside', test: (t: string) => outsideAsked(t) !== null },
  { id: 'homeadmin', test: (t: string) => homeAsked(t) !== null },
  // (and while a typing test is up in the chat's own box, what he sends next: features/learning/typing.ts)
  { id: 'learning', test: (t: string) => typingPending() || learningAsked(t) !== null },
  { id: 'machine', test: (t: string) => machineAsked(t) },
  { id: 'workbench', test: (t: string) => !!workbenchAsked(t) },
  { id: 'foresight', test: (t: string) => !!foresightAsked(t) },
  { id: 'right', test: (t: string) => !!rightSaid(t) },
  { id: 'today', test: (t: string) => todayAsked(t) },
  { id: 'why', test: (t: string) => !!whyAsked(t) },
  // [restb] chess with a real rating: both ratings in words (assistant/restb.ts, gym/chessrate.ts)
  { id: 'chessrating', test: (t: string) => ratingAsked(t) },
  // [restb] the instrument and skills coach on the phone: the tuner, the lessons, and typing, drawing and words (assistant/restb.ts, coach/)
  { id: 'tuner', test: (t: string) => coachAsked(t)?.what === 'tuner' },
  { id: 'coach', test: (t: string) => coachAsked(t)?.what === 'lessons' },
  // [reste] the converter on the phone, and its units and numbers answered here with no model (assistant/reste.ts, convert/)
  { id: 'convert', test: (t: string) => !!convertAsked(t) },
  // [editors] a voice note into a tidy page (workspace/voicenote.ts): "take a voice note", "turn my voice note into a page"
  { id: 'wsvoice', test: (t: string) => voiceNoteAsked(t) },
  // [editors.s3] paper into an editable document, a receipt into a spreadsheet row (docs/asks.ts paperAsked; docs/paperui.ts)
  { id: 'docspaper', test: (t: string) => !!paperAsked(t) },
  // [editors.s12] fill in and sign a PDF form (docs/pdfformui.ts)
  { id: 'docsfill', test: (t: string) => fillAsked(t) },
  // [editors.s2] mail merge: one letter, a copy for every row of a spreadsheet (docs/mergeui.ts)
  { id: 'docsmerge', test: (t: string) => mergeAsked(t) },
  // [editors] flashcards from his own notes (workspace/cards.ts): "make flashcards from my notes"
  { id: 'wscards', test: (t: string) => cardsAsked(t) },
  // [editors.u1] comments on words in a document (docs/commentsui.ts)
  { id: 'docscomments', test: (t: string) => commentsAsked(t) },
  { id: 'docs', test: (t: string) => !!docsAsked(t) },
  { id: 'sheets', test: (t: string) => !!sheetsAsked(t) },
  { id: 'slides', test: (t: string) => !!slidesAsked(t) },
  { id: 'workspace', test: (t: string) => !!workspaceAsked(t) },
  // [photo] the photo editor (BRIEF-EDITOR-PHOTO): "edit a photo", "my photos"
  { id: 'photoedit', test: (t: string) => !!photoAsked(t) },
  // [video] the video editor (video/asks.ts): "my videos", "edit a video", "cut this video"
  { id: 'video', test: (t: string) => !!videoAsked(t) },
  // [gamestudio] the game studio (studio-game/): "make a game", "my games", "sketch a cave room with two ledges"
  { id: 'gamestudio', test: (t: string) => !!gameAsked(t) },
  // [planlane] the agenda's to-dos and month, the radio's sleep timer and stations, markets' prices and holdings, the brief (the house has its own table above)
  // (the WORK screen's own words, "add to my to-do: send the invoice by Friday", stay with its list in the brain)
  { id: 'planagenda', test: (t: string) => !/^(?:please\s+)?add to my to-?do\s*:/i.test(t.trim()) && !!agendaAsked(t) },
  { id: 'planmarkets', test: (t: string) => !!marketsAsked(t) },
  { id: 'planbrief', test: (t: string) => !!briefAsked(t) },
  // [polish3] the Workshop, the 3D studio, Reverse, Space, COURSES, the Arcade and SCHOOL, opened by name (assistant/screenasks.ts)
  { id: 'openscreen', test: (t: string) => !!screenAsked(t) },
  // [comic] THE COMIC (features/comic/asks.ts): "make me a comic about…", "read a comic", "import this comic", "public domain comics"
  { id: 'comic', test: (t: string) => !!comicAsked(t) },
  { id: 'units', test: (t: string) => !!unitsAsked(t) },
  { id: 'base64', test: (t: string) => !!base64Asked(t) },
  { id: 'unixtime', test: (t: string) => !!unixAsked(t) },
  { id: 'canyou', test: (t: string) => canYouAsked(t) !== null || whatCanAsked(t) },
] as const;
export type LocalAsk = (typeof LOCAL_ASKS)[number]['id'];

export const FIRST_ASKS = [
  { id: 'walk', test: (t: string) => !!walkStart(t) || homeSaid(t) || walkCancelled(t) },
  // [reader] a book read to him by words (features/library/reader.ts readingTurn; BRIEF-LIBRARY-READER 4): before the stop, so a
  // plain "stop" while a book is read ends it and says the page
  { id: 'reading', test: (t: string) => !!readingIntent(t) },
  { id: 'stop', test: (t: string) => !!stopIntent(t) },
  { id: 'reboot', test: (t: string) => REBOOT.test(t) },
] as const;
