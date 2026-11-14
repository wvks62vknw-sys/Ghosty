/**
 * THE ONE LENS (BRIEF-LENS; STARS 151 and 152; the owner's budgets in OWNER-ISSUES 131, his three rules in 139, "everything stays
 * findable" in 143), made THE LENS THAT JUST KNOWS (BRIEF-LENS-KNOWS; OWNER-ISSUES 156: "it shouldn't have an overlay saying
 * translate etc, it should just know"). He points the camera and Ghosty KNOWS what is there and does the right thing: a thin
 * reticle round each thing (ui/machine.ts `reticle`) with its plate above it ("A LETTER · 61 WORDS", "A SIGN · FRENCH", "MUM",
 * "A LINK · MENU", "A MUG"), ONE true line under the viewfinder (what it is · one fact · the one act in his colour) and the
 * stamp line's LOOKING AT. No key sits on the picture: a tap on a thing is its act, the rest is his words. Text in his language is
 * read there and then (the OCR READ has, once for each steady scene) and its words stand in the WHAT IT SAYS plate, a tap on a
 * word reads from it aloud; text in another language is translated there and then (the WORDS go to the brain, never the picture)
 * and drawn over the sign. Drawn in the DOM over the video from each detection's box (vision/boxes.ts), not on the overlay canvas.
 *
 * THE BUDGETS (vision/tags.ts holds the rules, pure; this file does the camera and the drawing):
 *   every frame the budget allows (vision/frame.ts FrameBudget, 2 to 10 a second): the "text present" check on a 160-pixel grey
 *     frame (it never says what the text is), the barcode reader (the phone's own where there is one, else the vendored one) about
 *     three times a second, and a face he knows (BlazeFace and the on-phone store) only when the face models are already on this
 *     phone: otherwise no face tag at all, and no download without his tap;
 *   a steady frame only (frame difference under STEADY_DIFF for STEADY_MS), one pass at a time: the object finder, then the namer
 *     on the biggest thing it found ("looks like a mug"). OCR itself runs only when he taps READ or TRANSLATE;
 *   a tag lives two seconds after its last sighting, then fades; a sighting under its detector's floor makes no tag.
 *
 * THE ACTS are the old modes, their code and their cards kept: READ (into the library), TRANSLATE (ASK with the text), LOOK (what
 * SCAN does with a code), NAME IT (NAME's card), FIND THE PART (the brain, in UK shops), ASK (a question with the picture, which he
 * sends himself), MEASURE. A face he knows shows the name he introduced and nothing else; a stranger is "someone I don't know"; a face
 * has no act, and never leaves the phone. The camera opens only on his tap (index.ts), as before.
 */
import { clear, h } from '../../core/dom';
import { toast } from '../../ui/components';
import { key, reticle, tag as tagMark, truthLine, type Reticle } from '../../ui/machine';
import { askWithImage } from '../../vision/ask';
import { cleanOcr, titleFrom } from '../../vision/ocrtext';
import { sayIn, hush } from '../learning/voices';
import { classifyCode } from '../../scan/codes';
import { freeBarcodes, readCodesIn, warmBarcodes } from '../../scan/barcode';
import { cropRect, fromMediaPipe, type Box } from '../../vision/boxes';
import { cropCanvas } from '../../vision/camera';
import { memoryTrouble, namer, NAMER_SIZE, NamerMemoryError } from '../../vision/clip';
import { EYES_LENS, EYES_NAMER, eyesKept } from '../../offline/eyes';
import { bestMatch, iou, type KnownFace } from '../../vision/facemath';
import { faces, type FaceSeen } from '../../vision/faces';
import { knownFaces } from '../../vision/facestore';
import { FrameBudget, Steady, Tags, HeavyGate, FLOOR, KIND_WORD, TEXT_TRUTH, codeTruth, dominantColour, eyesLine, firstSentence, languageOf, linkWord, lookingWords, needsTranslation, plateWords, truthParts, wordList, textKind, UNKNOWN_LANG, type Known, type Lang, contextWords, finderTruth, greyOf, isPartName, limitTags, looksEnglish, markOf, MARK_WORDS, objectTruth, textTiles, withArticle, type ActId, type TextBlock, type LensMark, type LensWord, type Sighting, type Tag, type TagKind } from '../../vision/frame';
import { detector, nextStamp, type ObjectDetectorLike } from '../../vision/models';
import { go } from '../../shell/tabs';
import type { LensAsk, LensReply } from '../../workers/lens.worker';
import type { LensContext, Mode, ModeOpts } from './index';
import { letterKeys } from './letter';
import { sayError } from '../../ui/hisWords';
import { waiting as putUpWait } from '../../ui/wait';
import { cardsState, createCards, type CardInput } from './cards';
import { letterOf } from '../../../../../packages/shared/src/lifeeasier';
import { isoDay } from '../brief/day';
import { isMenuLike, livingKind, looksLikeReceipt, pairLines, readBusStop, readBusinessCard, type JobId } from '../../vision/jobs';

/** The grey frame's width: the "text present" check and the steadiness work on this, not on the camera's pixels. */
const GREY_W = 160;
/** The copy the barcode reader looks at: big enough for a code across a third of the view. */
const CODE_W = 720;
/** A look for a barcode, at most this often (ms): the reader is the costly part of the cheap pass. */
const CODE_MS = 380;
/** A look for faces, at most this often (ms), as PEOPLE does. */
const FACE_MS = 350;
const FRESH_MS = 1500;
/** The one toast about the words that are sent by themselves is said once in a session. */
let toldWords = false;
/** With nothing found by the object finder, the namer speaks about the middle of the picture only at this share or more. */
const MIDDLE_FLOOR = 0.5;

/** A box grown by `k` of its size on every side. */
const grow = (b: Box, k: number): Box => ({ x: b.x - b.w * k, y: b.y - b.h * k, w: b.w * (1 + 2 * k), h: b.h * (1 + 2 * k) });

/** The fraction of `b` that `a` covers. */
const overlap = (a: Box, b: Box): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const hh = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && hh > 0 ? (w * hh) / (b.w * b.h) : 0;
};

/** The object finder is on this phone once he has tapped GET THE EYES; from then on it loads by itself (the files are kept). */
/** The text check's cost on the last dozen frames, for the median `oneState.textMs` reports (a starved frame is not the cost). */
const tileTimes: number[] = [];
const HEAVY_KEY = 'ghosty.lens.heavy';
/** The namer started on this phone once, on his tap (GET THE NAMER): from then on it loads by itself after the finder. A phone it never started on never tries by itself. */
const NAMER_KEY = 'ghosty.lens.namer';
/** PEOPLE's face models were loaded on this phone: from then on the one view looks for a face he knows. */
export const FACES_KEY = 'ghosty.lens.faces';
/**
 * What each step costs to fetch once, in words. The object finder is its model (4.4 MB) and the vision runtime it runs on (13.8 MB:
 * the old key said 47 MB for both steps and left that runtime out); the namer is its runtime, encoder and names (42 MB, clip.ts).
 */
export const FINDER_SIZE = '18 MB';
export const HEAVY_SIZE = FINDER_SIZE;
/** What the mark row says, once, when the namer cannot start for memory (the owner's words, OWNER-ISSUES 153). */
export const NAMER_MEMORY_WORDS = 'The namer needs more memory than this phone can give it right now; the object finder works without it. Close other tabs, or close and reopen Ghosty, and try again.';
/** And when it cannot start for another reason (never the runtime's own text). */
export const NAMER_OTHER_WORDS = 'The namer could not start on this phone; the object finder works without it. Try again, and if it still will not start, close and reopen Ghosty.';
/** The object finder's own failure for memory. */
export const FINDER_MEMORY_WORDS = 'The object finder needs more memory than this phone can give it right now. Close other tabs, or close and reopen Ghosty, and try again.';

/** One step of the eyes: not asked for yet, loading, on the phone, or failed (and said). */
export type Step = 'off' | 'loading' | 'ready' | 'failed';

const flag = (k: string): boolean => {
  try {
    return localStorage.getItem(k) === '1';
  } catch {
    return false;
  }
};
const setFlag = (k: string): void => {
  try {
    localStorage.setItem(k, '1');
  } catch {
    /* private mode: it lasts this visit only */
  }
};

/** What the one view is doing, readable by a test (window.__ghosty.one) and by nothing else. Never a face's numbers. */
export const oneState = {
  tags: [] as { id: number; kind: TagKind; tag: string; truth: string; acts: string[]; box: Box; fade: number; selected: boolean; label: string; greyed: string[] }[],
  selected: 0,
  steady: false,
  diff: 255,
  /** The smoothed cost of one cheap pass, ms (the grey frame, the text check, the steadiness). */
  cheapMs: 0,
  /** The worst single cheap pass in the last second, ms. */
  cheapMax: 0,
  passes: 0,
  hz: 0,
  /** ms from the first cheap pass to the first tag (the 2-second habit), -1 until there is one. */
  firstTagMs: -1,
  /** ms from the first steady frame to the first tag (negative: the tag stood before the frame was steady), null until both. */
  steadyToTag: null as number | null,
  /** The object finder (the first step of GET THE EYES): it alone makes the objects tagged. */
  finder: 'off' as Step,
  /** The namer (the second step, GET THE NAMER): it alone makes "looks like a …". */
  namer: 'off' as Step,
  /** The words on the mark row about a step that could not start, said once (empty when nothing is wrong). */
  stepSaid: '',
  heavyPasses: 0,
  heavyMs: 0,
  codeMs: 0,
  /** Where one cheap pass spends its time, ms: the frame drawn small, the pixels read, the grey and the steadiness, the text check. */
  grabMs: 0,
  /** The "text present" check alone, ms a frame (the median of the last dozen frames the check ran alone): the budget is under 4. */
  textMs: 0,
  /** How many frames the check has been timed on since the view was entered, the heavy pass's frames left out: the budget is read once there are a dozen (the first frames of a visit are warm-up, not the cost). */
  textFrames: 0,
  stages: { draw: 0, read: 0, grey: 0, tiles: 0 },
  mark: 'degraded' as LensMark,
  markWords: '',
  faces: 'off' as 'off' | 'loading' | 'on',
  said: '',
  /** What the stamp says it is looking at ("a letter", "two people", "nothing yet"), changed at most once a second. */
  looking: 'nothing yet',
  /** The one line under the viewfinder, as words, and whether it is the honest line that is also the one key (no eyes, nothing tagged). */
  line: '',
  honest: false,
  /** The words of a read text: how the OCR READ has done (runs: once for each steady scene), the language decided on the phone, what is shown. */
  ocr: { state: 'idle' as 'idle' | 'reading' | 'read' | 'none', runs: 0, lang: 'UNKNOWN', words: 0 },
  /** The translation of a sign in another language: the words go to the brain (never the picture), once for each text read. */
  translate: { state: 'none' as 'none' | 'sending' | 'done' | 'failed' | 'offline', runs: 0, sent: false, text: '' },
  /** The WHAT IT SAYS plate and the translation over a sign: what is drawn. */
  plate: { shown: false, text: '', lit: '', inPlace: false, scrolls: false },
  /** The last words said aloud (a tap on a word), for the checks. */
  spoke: '',
  /** A menu read line by line: how many lines, the English for each, and how many are drawn in their place (lens.u1). */
  lines: { count: 0, english: [] as string[], drawn: 0 },
};

/** The tag he tapped, as the screen's selection (BRIEF-AWARENESS "that one"): its kind, never who. */
export function oneSelected(): { kind: 'thing'; id: string; label: string; detail?: string } | undefined {
  const t = oneState.tags.find((x) => x.selected);
  if (!t) return undefined;
  const label = t.kind === 'text' ? 'the text' : t.kind === 'code' ? 'the code' : t.kind === 'object' ? 'the object' : t.kind === 'face' ? 'someone I know' : 'someone I don’t know';
  return { kind: 'thing', id: t.kind, label, ...(t.kind === 'object' && t.truth.startsWith('looks like') ? { detail: t.truth } : {}) };
}

/** What the words ("read that", "what is that", "translate it", "measure it") reach while the one view is open. */
export const oneHooks: { act?: (w: LensWord, text?: string) => string | null; feed?: OneFeed } = {};

/** A fixture feed for the specs (window.__ghosty.oneFeed, only under a test runner): each `see` is one frame of the feed. */
export interface OneFeed {
  /** One frame: these sightings are taken in at once and the tags are drawn (an empty list is a frame the finder missed). */
  see(sightings: Sighting[]): void;
  /** The feed's own (object) tags go. */
  reset(): void;
  /** A tag of this kind goes (it leaves the picture). */
  drop(kind: TagKind): void;
  /** The words the reader read off the text in view, as if it had just read them (the fixture frames of lens2). */
  text?(words: string): void;
  /** Whether the phone has a signal, as the browser would say (the no-signal cards). */
  online?(on: boolean): void;
}
export const oneFeed: OneFeed = {
  see: (s) => oneHooks.feed?.see(s),
  reset: () => oneHooks.feed?.reset(),
  drop: (k) => oneHooks.feed?.drop(k),
  text: (w) => oneHooks.feed?.text?.(w),
  online: (on) => oneHooks.feed?.online?.(on),
};

/** The follow: a box eases to where its tag is (the time constant, ms), never a jump; a long gap between frames counts as at most this much. */
const FOLLOW_MS = 90;
const FOLLOW_STEP_MAX_MS = 50;
/** A tag that has left is drawn fading for this long before it goes. */
const LEAVE_MS = 240;
/** The namer's word stands in for the finder's only after it has been the same for this many frames. */
const NAME_FRAMES = 2;

export function createOneMode(L: LensContext): Mode {
  const S = L.state;
  const budget = new FrameBudget({ maxHz: 10, minHz: 2 });
  const steady = new Steady();
  const gate = new HeavyGate();
  const tags = new Tags();
  const layer = h('div.lenstags');
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', 'What I see');
  const sayLine = h('p.lenssay', { role: 'status', 'aria-live': 'polite' });
  sayLine.hidden = true;
  const grey = document.createElement('canvas');
  const gctx = grey.getContext('2d', { willReadFrequently: true });
  grey.width = GREY_W;

  let visit = 0;
  let selectedId = 0;
  let det: ObjectDetectorLike | null = null;
  let known: KnownFace[] = [];
  let tracks: { box: Box; emb?: number[]; embAt: number; match: ReturnType<typeof bestMatch> }[] = [];
  let lastCode = 0;
  let lastFace = 0;
  let codeBusy = false;
  let grabBusy = false;
  let faceBusy = false;
  let firstPassAt = 0;
  let steadyAt = 0;
  let firstTagAt = 0;
  let codeBroken = false;
  let heavyFailures = 0;
  let max = 0;
  let maxAt = 0;
  let online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;

  // ---------------------------------------------------------------- the mark on the bar, and its two download keys
  const markEl = h('span.lensmark', { role: 'status' });
  // NAMER OFF, said beside the mark while the namer is not on the phone (the object finder works without it)
  const namerOffEl = h('span.lensmark.lensnameroff', tagMark('NAMER OFF', { tone: 'warn' }));
  namerOffEl.hidden = true;
  const getBtn = key('GET THE EYES', () => void loadFinder());
  getBtn.classList.add('lensget');
  const namerBtn = key('GET THE NAMER', () => void loadNamer());
  namerBtn.classList.add('lensgetnamer');
  namerBtn.hidden = true;
  // what could not start, in words, once (a step's own words; never the runtime's text)
  const whyEl = h('p.lensmarkwhy', { role: 'status', 'aria-live': 'polite' });
  whyEl.hidden = true;
  const setKey = (btn: HTMLButtonElement, t: string): void => {
    const sp = btn.querySelector('span');
    if (!sp) return;
    // (the honest line wraps on a phone; WI-FI stays one word across the break, its text unchanged)
    const parts = t.split('WI-FI');
    sp.replaceChildren(...parts.flatMap((p, i) => (i ? [h('span', { style: 'white-space: nowrap' }, 'WI-FI'), p] : [p])));
  };
  const setGet = (t: string): void => setKey(getBtn, t);
  const setNamerKey = (t: string): void => setKey(namerBtn, t);
  // WORDS SENT: the privacy mark, shown while the words of a sign are with the brain to be translated (the one thing the Lens sends unasked)
  const sentEl = h('span.lensmark.lenssent', tagMark('WORDS SENT', { tone: 'warn' }));
  sentEl.hidden = true;
  const markRow = h('div.lensmarkrow', markEl, sentEl, namerOffEl, whyEl);
  // the download keys and the one true line sit UNDER the viewfinder: never on the picture, never in the camera's bar
  const truthEl = h('div.lenstruth');
  // THE CARDS (FINAL-LENS): one for each thing the frame holds, each with the keys that do its job (cards.ts; the decisions in vision/jobs.ts)
  const cards = createCards({
    picture: (job: JobId) => {
      const kind: TagKind | null = job === 'place' || job === 'living' || job === 'thing' ? 'object' : job === 'code' || job === 'product' ? 'code' : job === 'text' || job === 'document' ? 'text' : null;
      const t = kind ? textOrKind(kind) : undefined;
      return t ? cropOf(t) : L.still(1600);
    },
    act: (what) => {
      const now = performance.now();
      const alive = tags.alive(now);
      const pick = (k: TagKind) => alive.find((t) => t.kind === k);
      if (what === 'look') {
        const t = pick('code');
        if (t) void doAct(t, 'look');
      } else if (what === 'nameit') {
        // the species, in one tap: NAME's LIVING THING runs at once on the crop, as the kind the phone's name says (a plant to Pl@ntNet)
        const t = pick('object');
        const c = t ? cropOf(t) : L.still(1600);
        if (!c) return void toast('Open the camera first', 'warn');
        const label = (t && nodes.get(t.id)?.label) || t?.data?.label || '';
        S.lastAction = `which species: ${label || 'the picture'}`;
        L.setMode('name', { still: c, living: livingKind(label) });
      } else if (what === 'measure') {
        const t = pick('object');
        if (t) void doAct(t, what);
        else if (what === 'measure') {
          L.freeze(true);
          L.setMode('measure');
        }
      } else if (what === 'document') {
        const c = L.still(1600);
        if (!c) return void toast('Open the camera first', 'warn');
        L.setMode('scan', { sub: 'document', still: c });
      } else if (what === 'translate') {
        // the text card's TRANSLATE: its words, and only its words, to be translated (never the picture)
        if (needBrain('translating')) return;
        if (ocr.text && needsTranslation(ocr.lang)) L.setMode('ask', { text: ocr.text, question: 'Translate this text into English. Tell me which language it is.', send: true });
      } else {
        // a thing card's ASK ABOUT IT: the question about that thing with its picture, which he sends himself
        if (needBrain('asking')) return;
        const t = pick('object');
        if (t) void doAct(t, 'ask');
        else L.setMode('ask', { still: L.still(1600) ?? undefined });
      }
    },
  });
  const knowRow = h('div.lensknow', truthEl, cards.el, getBtn, namerBtn);
  /** Nothing tagged and the eyes not on the phone: the one true line is the key (his tap, the size said). Set by paint. */
  let honest = true;
  const getWords = (): string => (oneState.finder === 'failed' ? `TRY AGAIN · ${FINDER_SIZE}` : honest ? eyesLine(FINDER_SIZE) : `GET THE EYES · ${FINDER_SIZE}, ON WI-FI`);
  const markAll = (): void => {
    const finderOn = oneState.finder === 'ready';
    const m = markOf({ cheap: !codeBroken, heavy: finderOn, online });
    oneState.mark = m;
    oneState.markWords = MARK_WORDS[m];
    markEl.dataset.mark = m;
    markEl.replaceChildren(tagMark(MARK_WORDS[m], { tone: m === 'working' ? 'on' : m === 'offline' ? 'off' : 'warn' }));
    const why =
      m === 'offline'
        ? 'No signal: ASK and TRANSLATE are greyed, reading and the codes still work.'
        : m === 'degraded'
          ? oneState.finder === 'loading'
            ? 'Getting the eyes…'
            : 'I can see text, codes and faces. Getting the eyes lets me find objects too.'
          : oneState.namer === 'ready'
            ? 'Everything is working.'
            : 'The object finder is on. The namer is off, so I can say something is there but not what it looks like.';
    markEl.title = why;
    markEl.setAttribute('aria-label', `${MARK_WORDS[m].toLowerCase()}${finderOn && oneState.namer !== 'ready' ? ', namer off' : ''}: ${why}`);
    namerOffEl.hidden = !(finderOn && oneState.namer !== 'ready');
    // the first key (GET THE EYES): only while the object finder is not on the phone, and it needs a signal
    const needFinder = oneState.finder === 'off' || oneState.finder === 'failed';
    getBtn.hidden = !needFinder && oneState.finder !== 'loading';
    truthEl.hidden = honest && !getBtn.hidden && oneState.finder !== 'ready';
    if (oneState.finder === 'loading') getBtn.disabled = true;
    else {
      setGet(getWords());
      getBtn.classList.toggle('honest', honest);
      // (with the Lens's eyes kept on this phone by his tap, Settings → OFFLINE EYES, the key works with no signal: its files are here)
      const eyesHere = eyesKept(EYES_LENS.id);
      getBtn.disabled = !online && !eyesHere;
      getBtn.setAttribute('aria-label', online || eyesHere ? `Get the eyes: the object finder, ${FINDER_SIZE} once, kept on this phone` : `Get the eyes, ${FINDER_SIZE}: needs a signal`);
      getBtn.title = online ? `Downloads the object finder (${FINDER_SIZE}, once). Nothing of what I see is sent.` : eyesHere ? 'The eyes are kept on this phone: this loads them.' : 'I need a signal to download it.';
    }
    // the second key (GET THE NAMER): only once the finder works, and only while the namer is not on the phone; his tap, with its size said
    const needNamer = finderOn && (oneState.namer === 'off' || oneState.namer === 'failed');
    namerBtn.hidden = !needNamer && !(finderOn && oneState.namer === 'loading');
    if (oneState.namer === 'loading') namerBtn.disabled = true;
    else {
      setNamerKey(oneState.namer === 'failed' ? `TRY AGAIN · ${NAMER_SIZE}` : `GET THE NAMER · ${NAMER_SIZE}`);
      const namerHere = eyesKept(EYES_NAMER.id);
      namerBtn.disabled = !online && !namerHere;
      namerBtn.setAttribute('aria-label', online || namerHere ? `${oneState.namer === 'failed' ? 'Try the namer again' : 'Get the namer'}: ${NAMER_SIZE} once, best on Wi-Fi, kept on this phone` : `Get the namer, ${NAMER_SIZE}: needs a signal`);
      namerBtn.title = online ? `Downloads the namer (${NAMER_SIZE}, once; best on Wi-Fi). It lets me say what things look like. Nothing of what I see is sent.` : namerHere ? 'The namer is kept on this phone: this loads it.' : 'I need a signal to download it.';
    }
    whyEl.textContent = oneState.stepSaid;
    whyEl.hidden = !oneState.stepSaid;
  };
  const netChanged = () => {
    online = navigator.onLine !== false;
    markAll();
    paint(performance.now());
  };

  // ---------------------------------------------------------------- the eyes, in two steps, each on his tap (or from the cache once it has started on this phone)
  const progressFor = (setter: (t: string) => void, word: string) => (s: string, f?: number) => {
    if (S.mode !== 'lens') return;
    L.status(s, 'mid');
    if (f != null) setter(`GETTING THE ${word} · ${Math.round(f * 100)}%`);
  };
  /** Step 1: the object finder, alone. Objects are tagged from here on, without the namer. */
  const loadFinder = async (): Promise<void> => {
    if (oneState.finder === 'loading' || oneState.finder === 'ready') return;
    const v = visit;
    oneState.finder = 'loading';
    oneState.stepSaid = '';
    setGet('GETTING THE EYES…');
    markAll();
    const woken = putUpWait(layer, 'Waking the eyes…', { as: 'tag' });
    try {
      const d = await detector.get(progressFor(setGet, 'EYES'));
      woken();
      if (v !== visit) return d.close();
      det = d;
      oneState.finder = 'ready';
      setFlag(HEAVY_KEY);
      gate.reset();
      markAll();
      if (S.mode === 'lens') L.status(S.camera === 'on' ? 'looking…' : 'ready · START the camera', 'ok');
      // a phone the namer has started on before loads it too, by itself, from the kept files
      if (flag(NAMER_KEY)) void loadNamer();
    } catch (e) {
      woken();
      if (v !== visit) return;
      oneState.finder = 'failed';
      oneState.stepSaid = memoryTrouble(e) ? FINDER_MEMORY_WORDS : sayError(e, 'get the object finder');
      markAll();
    }
  };
  /** Step 2: the namer, its own key. A phone that cannot hold it says so, once, in words, and never tries again by itself. */
  const loadNamer = async (): Promise<void> => {
    if (oneState.finder !== 'ready' || oneState.namer === 'loading' || oneState.namer === 'ready') return;
    const v = visit;
    oneState.namer = 'loading';
    oneState.stepSaid = '';
    setNamerKey('GETTING THE NAMER…');
    markAll();
    try {
      await namer.load(progressFor(setNamerKey, 'NAMER'), false);
      if (v !== visit) return;
      oneState.namer = 'ready';
      setFlag(NAMER_KEY);
      gate.reset();
      markAll();
    } catch (e) {
      if (v !== visit) return;
      oneState.namer = 'failed';
      oneState.stepSaid = e instanceof NamerMemoryError || memoryTrouble(e) ? NAMER_MEMORY_WORDS : NAMER_OTHER_WORDS;
      markAll();
    }
  };

  // ---------------------------------------------------------------- what the Lens knows of the text in view
  /** The text of the steady scene, read on the phone: its words, the language decided from them, and what became of the translation. */
  const ocr = { state: 'idle' as 'idle' | 'reading' | 'read' | 'none', epoch: 0, text: '', tokens: [] as string[], lang: UNKNOWN_LANG as Lang, tr: 'none' as 'none' | 'sending' | 'done' | 'failed' | 'offline', translation: '',
    /** A menu read line by line (lens.u1): its lines, where each stood as a share of the text's box, and the English for each. */
    lines: [] as string[], lineRel: [] as { x: number; y: number; w: number; h: number }[], lineEn: null as string[] | null };
  /** The English laid over each line of a menu, in the line's own place on the picture. */
  const lineLayer = h('div.lenslines', { role: 'group', 'aria-label': 'The menu in English, line by line' });
  lineLayer.hidden = true;
  let lineSig = '';
  /** Words already translated this visit: the same words are not sent twice. */
  const translated = new Map<string, string>();
  interface Node {
    id: number;
    box: HTMLElement;
    ret: Reticle;
    body: HTMLElement;
    tag: HTMLElement;
    geo: string;
    aria: string;
    word: string;
    kind: TagKind;
    /** Where the box is drawn now (it eases toward its tag) and when it was last moved. */
    cur?: { x: number; y: number; w: number; h: number };
    at: number;
    /** The object's word as drawn, and the word that wants to replace it with how many frames it has been the same. */
    label: string;
    cand: string;
    candN: number;
  }
  const nodes = new Map<number, Node>();
  /** Reduce Motion: no eased follow (the box is where its tag is), still no flicker. */
  const reduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const calm = (): boolean => !!reduce?.matches || document.documentElement.dataset.motion === 'calm';

  /** The crop round a tag, from a still (the text check's box covers only the tiles it was sure of, often less than the words: the crop for text is generous) of the live frame (frame pixels → the still's), for READ, NAME and ASK. */
  const cropOf = (t: Tag): HTMLCanvasElement | null => {
    const still = L.still(1600);
    if (!still) return null;
    const { frame } = L.view();
    if (!frame.w) return null;
    const k = still.width / frame.w;
    const r = cropRect(t.box, frame, t.kind === 'text' ? 0.6 : 0.08);
    return cropCanvas(still, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
  };

  let sayTimer = 0;
  const say = (words: string): void => {
    oneState.said = words;
    sayLine.textContent = words;
    sayLine.hidden = !words;
    // what I said to his words stays long enough to read, then goes (the one true line is the screen's only standing words)
    window.clearTimeout(sayTimer);
    if (words) sayTimer = window.setTimeout(() => { sayLine.hidden = true; sayLine.textContent = ''; }, 8000);
    if (words) L.status(words, 'ok');
  };

  const needBrain = (what: string): boolean => {
    if (online) return false;
    say(`I’m offline: ${what} needs a signal. Reading and the codes still work.`);
    return true;
  };

  /** Do an act on a tag: the old mode's code, its card kept (BRIEF-LENS 1). */
  const doAct = async (t: Tag, act: ActId, send = false): Promise<void> => {
    selectedId = t.id;
    S.lastAction = `${act} the ${KIND_WORD[t.kind]} tag`;
    switch (act) {
      case 'read': {
        const c = cropOf(t);
        if (!c) return void toast('Open the camera first', 'warn');
        L.setMode('read', { still: c });
        return;
      }
      case 'translate': {
        if (needBrain('translating')) return;
        const c = cropOf(t);
        if (!c) return void toast('Open the camera first', 'warn');
        say('Reading it first…');
        try {
          const r = await L.reader.read(c, (s) => L.status(s, 'mid'));
          const text = r.text.replace(/\s+/g, ' ').trim();
          if (!text) return say('I couldn’t read any words there: try closer and flatter.');
          // nothing is spent on a model for words he already reads
          if (looksEnglish(text)) return say('That reads as English already, so there is nothing to translate.');
          say('');
          L.setMode('ask', { text, question: 'Translate this text into English. Tell me which language it is.', send: true });
        } catch (e) {
          say(sayError(e, 'read it'));
        }
        return;
      }
      case 'look': {
        L.setMode('scan', { sub: 'code', code: { text: t.data?.text ?? '', format: t.data?.format ?? '' } });
        return;
      }
      case 'nameit': {
        const c = cropOf(t);
        if (!c) return void toast('Open the camera first', 'warn');
        L.setMode('name', { still: c });
        return;
      }
      case 'findpart': {
        if (needBrain('finding a part')) return;
        const name = t.data?.label ?? 'part';
        go('core');
        void import('../../assistant/session').then((m) => m.send(`Find me a replacement ${name} in UK shops`));
        return;
      }
      case 'ask': {
        if (needBrain('asking')) return;
        const c = cropOf(t);
        if (!c) return void toast('Open the camera first', 'warn');
        // his tap on ASK GHOSTY sends it; opening the question sends nothing
        L.setMode('ask', { still: c, question: t.kind === 'object' && t.data?.label ? `What is this ${t.data.label}? Tell me about it.` : t.kind === 'code' ? 'I scanned this code. What is it, and is there anything I should know?' : 'What is this?', ...(send ? { send: true } : {}) });
        return;
      }
      case 'measure': {
        L.freeze(true);
        L.setMode('measure');
      }
    }
  };

  // ---------------------------------------------------------------- the words on a thing: read there and then, translated there and then
  const plate = h('div.lensplate', { role: 'group', 'aria-label': 'What it says' });
  const inplace = h('div.lensinplace', { role: 'button', tabindex: '0', 'aria-label': 'The English of this sign: tap to hear it' });
  plate.hidden = true;
  inplace.hidden = true;
  layer.append(plate, inplace, lineLayer);
  let plateSig = '';
  let plateH = 0;
  let plateAt = 0;

  /** The phone's own voice says `text` (in the language's own tag): nothing is sent anywhere to do it. */
  const speak = (text: string, tag: string): void => {
    if (typeof speechSynthesis === 'undefined') return void toast('This phone has no voice of its own', 'warn');
    oneState.spoke = text;
    S.lastAction = 'read aloud from a word';
    sayIn(text, tag || 'en-GB', 0.95);
  };

  /** One word of the plate: a tap on it reads aloud from it (a 44 pt target: the box is taller and wider than the word, the layout is not). */
  const wordEl = (tokens: string[], i: number, lit: number, tag: string): HTMLElement => {
    const el = h(`span.lw${i < lit ? '.lit' : ''}` as 'span', { role: 'button', tabindex: '0', 'aria-label': `Read aloud from ${tokens[i]}` }, tokens[i]!);
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      speak(tokens.slice(i).join(' '), tag);
    });
    return el;
  };
  const wordsOf = (text: string, tag: string): { nodes: (HTMLElement | string)[]; lit: number; tokens: string[] } => {
    const tokens = text.match(/\S+/g) ?? [];
    const lit = firstSentence(text);
    const kids: (HTMLElement | string)[] = [];
    tokens.forEach((_, i) => kids.push(wordEl(tokens, i, lit, tag), ' '));
    return { nodes: kids, lit, tokens };
  };

  /** Draw the plate (the words) or the English over the sign, whichever the state says; only when the words or the state changed. */
  const drawPlates = (): void => {
    const sig = `${ocr.state}|${ocr.text}|${ocr.tr}|${ocr.translation}|${ocr.lineEn?.length ?? 0}`;
    if (sig === plateSig) return;
    plateSig = sig;
    const read = ocr.state === 'read';
    const swapped = read && ocr.tr === 'done' && !!ocr.translation;
    const sign = read && textKind(wordList(ocr.text).length) === 'sign';
    // a menu whose English came back line for line: each line's English in its own place, and no plate over it
    const lined = read && ocr.tr === 'done' && !!ocr.lineEn && ocr.lineRel.length === ocr.lineEn.length;
    const over = swapped && sign && !lined;
    inplace.hidden = !over;
    plate.hidden = !read || over || lined;
    lineLayer.hidden = !lined;
    oneState.lines = { count: ocr.lines.length, english: ocr.lineEn ?? [], drawn: 0 };
    if (lined && lineSig !== sig) {
      lineSig = sig;
      lineLayer.replaceChildren(...ocr.lineEn!.map((en, i) => h('p.lensline', { dataset: { i: String(i) }, title: ocr.lines[i] ?? '' }, en)));
    }
    oneState.plate = { shown: read, text: '', lit: '', inPlace: over, scrolls: false };
    plateH = 0;
    if (!read) return;
    const en = swapped ? wordsOf(ocr.translation, 'en-GB') : null;
    const own = wordsOf(ocr.text, ocr.lang.tag);
    const shown = en ?? own;
    oneState.plate.text = shown.tokens.join(' ');
    oneState.plate.lit = shown.tokens.slice(0, shown.lit).join(' ');
    if (over) {
      inplace.replaceChildren(h('p.lp-big', ocr.translation), h('p.lp-small', `${ocr.text.replace(/\s+/g, ' ')} · ${ocr.lang.name}`));
      return;
    }
    const offer = swapped ? null : letterKeys(ocr.text, (t, b) => L.saveNote(t, b, 'scan'));
    plate.replaceChildren(
      h('p.lp-label', swapped ? 'IN ENGLISH' : 'WHAT IT SAYS'),
      h('p.lp-text', ...shown.nodes),
      ...(swapped ? [h('p.lp-small', `${ocr.text.replace(/\s+/g, ' ').slice(0, 160)} · ${ocr.lang.name}`)] : []),
      // [lifeeasier] a letter or a bill: REMIND (the date found, confirmed in one tap) and FILE (the library, under its sender)
      ...(offer ? [offer] : []),
    );
    plate.scrollTop = 0;
  };
  inplace.addEventListener('click', () => speak(ocr.translation, 'en-GB'));
  inplace.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') speak(ocr.translation, 'en-GB');
  });

  /** Forget the words (the text left the picture, or the Lens was left). */
  const forgetText = (): void => {
    fixtureWords = false;
    ocr.lines = [];
    ocr.lineRel = [];
    ocr.lineEn = null;
    lineLayer.hidden = true;
    lineSig = '';
    ocr.state = 'idle';
    ocr.text = '';
    ocr.tokens = [];
    ocr.tr = 'none';
    ocr.translation = '';
    ocr.epoch = 0;
    oneState.ocr = { state: 'idle', runs: oneState.ocr.runs, lang: 'UNKNOWN', words: 0 };
    oneState.translate = { ...oneState.translate, state: 'none', sent: false, text: '' };
    sentEl.hidden = true;
    drawPlates();
  };

  /** The words in view came from a spec's fixture frame (oneFeed.text): the reader leaves them be until the text leaves. */
  let fixtureWords = false;
  const textTagNow = (now: number): Tag | undefined => tags.alive(now).find((t) => t.kind === 'text');
  /** The live tag of a kind, for a card's act that needs its picture. */
  const textOrKind = (k: TagKind): Tag | undefined => tags.alive(performance.now()).find((t) => t.kind === k);
  /** Does the read text look like a letter or a bill (kept for the text, not worked out again on every frame)? */
  let letterFor = { text: '', is: false };
  const isLetter = (text: string): boolean => {
    if (letterFor.text !== text) letterFor = { text, is: !!text && !!letterOf(text, isoDay(new Date())) };
    return letterFor.is;
  };
  /** What the cards are told about the frame: the facts, never a face's numbers (a known face by the name he gave, a stranger as one). */
  /** What kind of print the words are (a business card, a bus stop sign), worked out once for each text read. */
  let printKind = { text: '', contact: false, stop: false };
  const printOf = (read: string) => {
    if (printKind.text !== read) printKind = { text: read, contact: !!read && !!readBusinessCard(read), stop: !!read && !!readBusStop(read) };
    return printKind;
  };
  const cardInput = (list: Tag[], labels: Map<number, string>): CardInput => {
    const frame = L.camera.size;
    const area = Math.max(1, frame.w * frame.h);
    const text = list.find((t) => t.kind === 'text');
    const code = list.find((t) => t.kind === 'code');
    const objs = list.filter((t) => t.kind === 'object' && (labels.get(t.id) || t.data?.label)).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
    const face = list.find((t) => t.kind === 'face');
    // (while the words are read again after a small move, the cards know the words were there, and say they are being read again)
    const read = ocr.state === 'read' || (ocr.state === 'reading' && ocr.text) ? ocr.text : '';
    return {
      text: read,
      textShare: text ? (text.box.w * text.box.h) / area : 0,
      ...(text ? { textId: text.id } : {}),
      ...(code?.data?.text ? { code: { text: code.data.text, format: code.data.format } } : {}),
      ...(objs[0] ? { thing: { label: labels.get(objs[0].id) || objs[0].data?.label || '', score: objs[0].score }, thingId: objs[0].id } : {}),
      known: !!face,
      knownName: face?.data?.label ?? '',
      stranger: list.some((t) => t.kind === 'stranger'),
      letter: !!read && isLetter(read),
      receipt: !!read && looksLikeReceipt(read),
      contact: printOf(read).contact,
      stop: printOf(read).stop,
      ...(read && ocr.lineEn ? { lines: ocr.lines, lineEnglish: ocr.lineEn } : {}),
      lang: read ? ocr.lang.name : '',
      langTag: read ? ocr.lang.tag : '',
      english: ocr.tr === 'done' ? ocr.translation : '',
      reading: ocr.state === 'reading',
      online,
      eyes: oneState.finder === 'ready',
      camera: S.camera === 'on',
    };
  };

  /** May the OCR READ run now: a steady scene it has not read, text in it, one heavy pass at a time, the reader free. */
  const wantsRead = (now: number): boolean => !fixtureWords && !heavyInFlight && !gate.busy && mirror.steady && mirror.epoch !== ocr.epoch && !L.reader.busy && !!textTagNow(now);

  /** The words of a sign go to the brain, by themselves, to be put into English: never the picture, nothing of where he is (BRIEF-LENS-KNOWS 4). */
  const sendWords = async (v: number, text: string): Promise<void> => {
    const kept = translated.get(text);
    if (kept) {
      ocr.tr = 'done';
      ocr.translation = kept;
      oneState.translate = { state: 'done', runs: oneState.translate.runs, sent: false, text: kept };
      return;
    }
    if (!online) {
      ocr.tr = 'offline';
      oneState.translate.state = 'offline';
      return;
    }
    ocr.tr = 'sending';
    oneState.translate = { state: 'sending', runs: oneState.translate.runs + 1, sent: true, text: '' };
    S.translations = oneState.translate.runs;
    sentEl.hidden = false;
    if (!toldWords) {
      toldWords = true;
      toast('I sent the words, not the picture', 'ok');
    }
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 20000);
    try {
      // a menu or a page (four lines or more): one line of English for each line, so each is laid over its own (lens.u1)
      const menu = ocr.lines.length >= 4 && isMenuLike(ocr.lines.join('\n'));
      const r = await askWithImage(menu ? 'Translate each line into English. Reply with exactly one line of English for each line, in the same order, and nothing else.' : 'Translate this into English. Reply with the English words only.', null, undefined, { scan: menu ? ocr.lines.join('\n') : text, quiet: true, bare: true, signal: ctl.signal });
      if (v !== visit) return;
      const got = r.text.trim();
      if (menu && got && !r.error) {
        ocr.lineEn = pairLines(ocr.lines, got);
        oneState.lines = { count: ocr.lines.length, english: ocr.lineEn ?? [], drawn: 0 };
      }
      if (got && !r.error) {
        translated.set(text, got);
        if (translated.size > 8) translated.delete(translated.keys().next().value as string);
        ocr.tr = 'done';
        ocr.translation = got;
        oneState.translate.state = 'done';
        oneState.translate.text = got;
      } else {
        ocr.tr = 'failed';
        oneState.translate.state = 'failed';
      }
    } catch {
      if (v !== visit) return;
      ocr.tr = 'failed';
      oneState.translate.state = 'failed';
    } finally {
      window.clearTimeout(timer);
      sentEl.hidden = true;
      oneState.translate.sent = false;
    }
  };

  /** The heavy pass for text: the OCR READ already has, on the steady frame, once for each steady scene; the language decided here; a sign in another language translated. */
  const textPass = async (t: Tag): Promise<void> => {
    const v = visit;
    heavyInFlight = true;
    ocr.epoch = mirror.epoch;
    ocr.state = 'reading';
    oneState.ocr.state = 'reading';
    const t0 = performance.now();
    try {
      const c = cropOf(t);
      if (!c) {
        ocr.state = 'idle';
        ocr.epoch = 0;
        oneState.ocr.state = 'idle';
        return;
      }
      // where the crop stood in the frame, so each line's box can be said as a share of the text's box (lens.u1)
      const fr = L.view().frame;
      const crop = cropRect(t.box, fr, 0.6);
      const kk = fr.w ? c.width / crop.w : 1;
      const box0 = { ...t.box };
      const r = await L.reader.read(c);
      if (v !== visit) return;
      const text = cleanOcr(r).replace(/[ \t]+\n/g, '\n');
      const words = wordList(text);
      S.ocrRuns++;
      oneState.ocr.runs++;
      oneState.heavyMs = Math.round(performance.now() - t0);
      if (words.length < 2 || r.confidence < 35) {
        ocr.state = 'none';
        ocr.text = '';
        oneState.ocr = { ...oneState.ocr, state: 'none', words: 0, lang: 'UNKNOWN' };
        return;
      }
      const same = text === ocr.text;
      ocr.text = text;
      ocr.tokens = text.match(/\S+/g) ?? [];
      const ls = (r.lines ?? []).filter((l) => /\p{L}{2}/u.test(l.text) && l.bbox);
      if (!same) {
        ocr.lines = ls.map((l) => l.text.replace(/\s+/g, ' ').trim());
        ocr.lineRel = ls.map((l) => {
          const b = l.bbox!;
          const fx = crop.x + b.x0 / kk;
          const fy = crop.y + b.y0 / kk;
          return { x: (fx - box0.x) / box0.w, y: (fy - box0.y) / box0.h, w: (b.x1 - b.x0) / kk / box0.w, h: (b.y1 - b.y0) / kk / box0.h };
        });
        ocr.lineEn = null;
      }
      ocr.lang = languageOf(text);
      ocr.state = 'read';
      if (!same || ocr.tr === 'none') {
        ocr.tr = 'none';
        ocr.translation = '';
      }
      oneState.ocr = { ...oneState.ocr, state: 'read', words: words.length, lang: ocr.lang.name };
      if (needsTranslation(ocr.lang) && ocr.tr === 'none') await sendWords(v, text);
    } catch {
      if (v !== visit) return;
      ocr.state = 'none';
      oneState.ocr.state = 'none';
    } finally {
      heavyInFlight = false;
    }
  };

  /** The text itself is kept in the library on his word ("keep it") or his tap on the tag (READ), never by itself. */
  const keepText = (): string => {
    if (ocr.state !== 'read' || !ocr.text) return 'There is nothing read yet to keep: hold the phone still on some text.';
    void L.saveNote(titleFrom(ocr.text), ocr.text, 'scan');
    return 'Keeping what it says in the library.';
  };

  // ---------------------------------------------------------------- drawing the tags: a reticle and its plate, nothing else on the picture
  const select = (id: number): void => {
    selectedId = id;
    oneState.selected = id;
    paint(performance.now());
  };

  /** A tap on a thing is its act (the keys are gone): text is read into READ (and so into the library on his save), a code is opened as what it is, a thing is asked about with its picture (his tap is the consent); a face does nothing but say where it stays. */
  const tapped = (t: Tag): void => {
    select(t.id);
    if (t.kind === 'face' || t.kind === 'stranger') return void toast('Faces stay on this phone', 'ok');
    if (t.kind === 'text') return void doAct(t, 'read');
    if (t.kind === 'code') return void doAct(t, 'look');
    void doAct(t, 'ask', true);
  };

  const makeNode = (t: Tag): Node => {
    const body = h('span.lt-body');
    const ret = reticle({
      name: t.kind,
      body,
      onTap: () => {
        const cur = tags.byId(t.id);
        if (cur) tapped(cur);
      },
    });
    const tagEl = h('span.lt-tag');
    const box = h('div.lenstag', { dataset: { kind: t.kind } }, ret.el, tagEl);
    layer.append(box);
    return { id: t.id, box, ret, body, tag: tagEl, geo: '', aria: '', word: '', kind: t.kind, at: 0, label: '', cand: '', candN: 0 };
  };

  /** What one tag is, for the words (the text's state is the scene's: one text tag stands). Never a known face's name beyond the plate. */
  const knownOf = (t: Tag, frame: { w: number; h: number }): Known => {
    const cx = (t.box.x + t.box.w / 2) / (frame.w || 640) - 0.5;
    const cy = (t.box.y + t.box.h / 2) / (frame.h || 480) - 0.5;
    const away = Math.min(1, Math.hypot(cx, cy) * 1.4);
    switch (t.kind) {
      case 'text': {
        if (ocr.state === 'reading') return { kind: 'text', reading: true, away };
        if (ocr.state !== 'read') return { kind: 'text', away };
        const words = wordList(ocr.text).length;
        return { kind: 'text', words, lang: ocr.lang, away, translating: ocr.tr === 'sending', translated: ocr.tr === 'done', untranslated: ocr.tr === 'failed' || ocr.tr === 'offline' };
      }
      case 'code':
        return { kind: 'code', codeKind: t.data?.codeKind, linkWord: t.data?.word, away };
      case 'face':
        return { kind: 'face', name: t.data?.label, away };
      case 'stranger':
        return { kind: 'stranger', away };
      default:
        return { kind: 'object', label: t.data?.label, named: !!t.data?.named, colour: t.data?.colour, away };
    }
  };

  let lookSince = 0;
  let lookingWait: (() => void) | null = null;
  /** The stamp's words: at most once a second. */
  let lookedAt = 0;
  const looked = (words: string, now: number): void => {
    if (words === oneState.looking || now - lookedAt < 1000) return;
    lookedAt = now;
    oneState.looking = words;
    L.looked(words);
  };

  /** Put every tag where its box is, with its plate; the ones that are gone leave; then the one line, the stamp and the words. */
  const paint = (now: number): void => {
    // at most three tags on screen (limitTags); the rest, if any, wait unseen
    const list = limitTags(tags.alive(now));
    const live = new Set(list.map((t) => t.id));
    for (const [id, n] of nodes) {
      if (live.has(id)) continue;
      nodes.delete(id);
      // a tag that leaves fades out where it stood, rather than vanishing: a faint ghost of its box (never a tag: nothing can be tapped or counted)
      if (calm()) n.box.remove();
      else {
        const ghost = h('div.lensghost', { dataset: { kind: n.kind }, 'aria-hidden': 'true' });
        Object.assign(ghost.style, { left: n.box.style.left, top: n.box.style.top, width: n.box.style.width, height: n.box.style.height, opacity: n.box.style.opacity || '1' });
        layer.append(ghost);
        n.box.remove();
        requestAnimationFrame(() => (ghost.style.opacity = '0'));
        setTimeout(() => ghost.remove(), LEAVE_MS);
      }
    }
    if (selectedId && !live.has(selectedId)) selectedId = 0;
    // the words of a text that has left the picture go with it
    if (!list.some((t) => t.kind === 'text') && ocr.state !== 'idle' && ocr.state !== 'reading') forgetText();
    const vw = layer.clientWidth || 360;
    const vh = layer.clientHeight || 400;
    const frame = L.camera.size;
    const still = calm();
    const sorted = [...list].sort((a, b) => a.box.y - b.box.y);
    oneState.tags = [];
    const rects = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();
    const knowns: Known[] = [];
    for (const t of sorted) {
      const n = nodes.get(t.id) ?? (nodes.set(t.id, makeNode(t)), nodes.get(t.id)!);
      // the namer's word replaces the finder's only once it has been the same for two frames (one odd frame changes nothing)
      if (t.kind === 'object') {
        const want = t.data?.label ?? '';
        if (!n.label || want === n.label) {
          n.label = want;
          n.candN = 0;
        } else {
          if (want === n.cand) n.candN++;
          else {
            n.cand = want;
            n.candN = 1;
          }
          if (n.candN >= NAME_FRAMES) {
            n.label = want;
            n.candN = 0;
          }
        }
      }
      const k = knownOf(t, frame);
      if (k.kind === 'object') k.label = n.label || k.label;
      knowns.push(k);
      const b = L.viewBox(t.box);
      const w0 = Math.max(44, Math.min(vw - 8, b.w));
      const hh0 = Math.max(44, Math.min(vh - 8, b.h));
      const x0 = Math.max(4, Math.min(vw - w0 - 4, b.x));
      const y0 = Math.max(STAMP_ROOM, Math.min(vh - hh0 - 4, b.y));
      // the box follows its tag by easing; with Reduce Motion it is where the tag is
      const dt = Math.max(0, Math.min(FOLLOW_STEP_MAX_MS, n.at ? now - n.at : 0));
      const a = !n.cur || still ? 1 : 1 - Math.exp(-dt / FOLLOW_MS);
      const cur = n.cur ?? { x: x0, y: y0, w: w0, h: hh0 };
      const near = (c: number, to: number) => (Math.abs(to - c) < 0.6 ? to : c + (to - c) * a);
      n.cur = { x: near(cur.x, x0), y: near(cur.y, y0), w: near(cur.w, w0), h: near(cur.h, hh0) };
      n.at = now;
      const x = n.cur.x;
      const y = n.cur.y;
      const w = n.cur.w;
      const hh = n.cur.h;
      rects.set(t.id, { x0: x, y0: y, x1: x + w, y1: y + hh });
      const fade = tags.fade(t, now);
      // (only what changed is written: a layout for nothing on every frame is a frame the UI does not have)
      const op = (1 - fade * 0.85).toFixed(2);
      const geo = `${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(hh)},${op}`;
      if (n.geo !== geo) {
        n.geo = geo;
        Object.assign(n.box.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px`, opacity: op });
      }
      const want = selectedId === t.id ? 'attend' : 'watch';
      if (n.ret.state() !== want) n.ret.set(want);
      const word = plateWords(k);
      const aria = `${word.toLowerCase()}${selectedId === t.id ? ', selected' : ''}${t.kind === 'face' || t.kind === 'stranger' ? ': faces stay on this phone' : ''}`;
      if (n.aria !== aria) {
        n.aria = aria;
        n.ret.el.setAttribute('aria-label', aria);
      }
      if (n.word !== word) {
        n.word = word;
        n.tag.replaceChildren(tagMark(word, { tone: t.kind === 'stranger' ? 'off' : selectedId === t.id ? 'on' : undefined }));
      }
      oneState.tags.push({ id: t.id, kind: t.kind, tag: word, truth: t.truth, acts: [], box: t.box, fade, selected: selectedId === t.id, label: t.kind === 'object' ? n.label : t.data?.label ?? '', greyed: [] });
    }
    oneState.selected = selectedId;
    // the first tag: LOOKING… as a tag row until the first real one lands (every wait said)
    if (!list.length && S.camera === 'on' && S.mode === 'lens' && oneState.finder === 'ready') {
      lookSince ||= now;
      if (!lookingWait && now - lookSince > 350) lookingWait = putUpWait(layer, 'Looking…', { as: 'tag' });
    } else {
      lookSince = 0;
      lookingWait?.();
      lookingWait = null;
    }
    drawPlates();
    placePlates(list, rects, vw, vh);
    // the one true line under the viewfinder, and the stamp's LOOKING AT
    const parts = truthParts(knowns);
    const text = parts.map((p) => (typeof p === 'string' ? p : p.text)).join(' · ');
    const flat = !knowns.length && oneState.finder !== 'ready';
    if (flat !== honest) {
      honest = flat;
      markAll();
    }
    oneState.honest = honest;
    if (text !== oneState.line) {
      oneState.line = text;
      truthEl.replaceChildren(truthLine(parts));
    }
    looked(lookingWords(knowns), now);
    const labels = new Map<number, string>();
    for (const t of list) if (t.kind === 'object') labels.set(t.id, nodes.get(t.id)?.label ?? '');
    cards.update(cardInput(list, labels));
    const counts = list.length ? contextWords(list) : '';
    if (S.counts !== counts) {
      S.counts = counts;
      L.lines('', '');
    }
  };

  /** The room the stamp line takes at the top of the viewfinder: a tag never sits under it. */
  const STAMP_ROOM = 54;

  /** Where the plate (under the text, or over the sign) goes: clear of the other tags, inside the viewfinder, never past it. */
  const placePlates = (list: Tag[], rects: Map<number, { x0: number; y0: number; x1: number; y1: number }>, vw: number, vh: number): void => {
    const t = list.find((x) => x.kind === 'text');
    const r = t ? rects.get(t.id) : undefined;
    if (!lineLayer.hidden && r) {
      // each line's English where that line stands, as a share of the text's box: it follows the page as the phone moves
      const bw = r.x1 - r.x0;
      const bh = r.y1 - r.y0;
      let drawn = 0;
      lineLayer.querySelectorAll<HTMLElement>('.lensline').forEach((el) => {
        const q = ocr.lineRel[Number(el.dataset.i)];
        if (!q) return;
        const x = Math.max(2, r.x0 + q.x * bw);
        const y = Math.max(STAMP_ROOM, r.y0 + q.y * bh);
        const w = Math.max(60, Math.min(vw - x - 2, q.w * bw));
        const hh = Math.max(18, q.h * bh);
        Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, minHeight: `${hh}px`, fontSize: `${Math.max(12, Math.min(22, Math.round(hh * 0.62)))}px` });
        drawn++;
      });
      oneState.lines.drawn = drawn;
      lineLayer.classList.toggle('stale', !mirror.steady);
    }
    const showing = !!t && !!r && (!plate.hidden || !inplace.hidden);
    if (!showing || !r) return;
    const others = list.filter((x) => x.id !== t!.id).map((x) => rects.get(x.id)!).filter(Boolean);
    const stale = !mirror.steady ? 'stale' : '';
    plate.classList.toggle('stale', !!stale);
    inplace.classList.toggle('stale', !!stale);
    if (!inplace.hidden) {
      // the English in the sign's own place, a little larger than the sign so its edges are covered
      const x = Math.max(4, r.x0 - 6);
      const y = Math.max(STAMP_ROOM - 8, r.y0 - 6);
      const w = Math.min(vw - x - 4, Math.max(120, r.x1 - r.x0 + 12));
      const hh = Math.min(vh - y - 4, Math.max(64, r.y1 - r.y0 + 12));
      Object.assign(inplace.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, minHeight: `${hh}px`, fontSize: `${Math.max(18, Math.min(30, Math.round(hh * 0.34)))}px` });
      return;
    }
    const cap = Math.max(96, Math.round((vh - STAMP_ROOM) * 0.5));
    if (plateAt !== cap) {
      plateAt = cap;
      plate.style.maxHeight = `${cap}px`;
    }
    if (!plateH || now0() - plateMeasured > 500) {
      plateH = Math.ceil(plate.offsetHeight) || 120;
      plateMeasured = now0();
    }
    const ph = Math.min(plateH, cap);
    const w = vw - 16;
    const clear = (y: number): boolean => y >= STAMP_ROOM && y + ph <= vh - 4 && !others.some((o) => 8 < o.x1 && 8 + w > o.x0 && y < o.y1 && y + ph > o.y0);
    const tries = [r.y1 + 6, r.y0 - ph - 6, vh - ph - 4, STAMP_ROOM];
    const y = tries.find(clear) ?? Math.max(STAMP_ROOM, Math.min(vh - ph - 4, r.y1 + 6));
    Object.assign(plate.style, { left: '8px', width: `${w}px`, top: `${Math.round(y)}px` });
    oneState.plate.scrolls = plate.scrollHeight > plate.clientHeight + 1;
  };
  const now0 = (): number => performance.now();
  let plateMeasured = 0;

  // ---------------------------------------------------------------- the cheap pass
  /**
   * One frame of the live video as a canvas `w` wide, taken the way that does not stall the page: createImageBitmap reads the
   * frame off the main thread (drawImage of a video onto a canvas waits for the graphics process, which on a busy phone, and
   * under the preview's software graphics, is tens to hundreds of ms of frozen UI). Where the browser cannot, drawImage.
   */
  const grab = async (w: number): Promise<HTMLCanvasElement | null> => {
    const frame = L.camera.size;
    if (!frame.w || !frame.h) return null;
    const hh = Math.max(24, Math.round((w * frame.h) / frame.w));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    try {
      const bm = await createImageBitmap(L.video, { resizeWidth: w, resizeHeight: hh, resizeQuality: 'low' });
      g.drawImage(bm, 0, 0);
      bm.close();
    } catch {
      g.drawImage(L.video, 0, 0, w, hh);
    }
    return c;
  };

  // ---- the worker: the frame's pixels are read, and the steadiness and the text check run, off the main thread
  let worker: Worker | null = null;
  let seq = 0;
  const waiting = new Map<number, (r: LensReply) => void>();
  /** The worker's view of the steadiness, mirrored here for the gate (the rule itself is vision/tags.ts `Steady`, run in the worker). */
  const mirror = { steady: false, epoch: 0, diff: 255 };
  const startWorker = (): void => {
    if (worker || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return;
    try {
      const w = new Worker('/lens.worker.js');
      w.onmessage = (ev: MessageEvent<LensReply>) => {
        const f = waiting.get(ev.data.id);
        waiting.delete(ev.data.id);
        f?.(ev.data);
      };
      w.onerror = (ev) => {
        // the worker could not start: the same pass runs on this thread instead (slower to read, as before)
        ev.preventDefault?.();
        worker = null;
        for (const f of waiting.values()) f({ id: 0, ms: 0, tiles: 0, blocks: [], steady: false, epoch: 0, diff: 255, w: 0, h: 0, error: 'worker' });
        waiting.clear();
      };
      worker = w;
    } catch {
      worker = null;
    }
  };
  const bitmapOf = async (w: number): Promise<ImageBitmap | null> => {
    const frame = L.camera.size;
    if (!frame.w || !frame.h) return null;
    try {
      return await createImageBitmap(L.video, { resizeWidth: w, resizeHeight: Math.max(24, Math.round((w * frame.h) / frame.w)), resizeQuality: 'low' });
    } catch {
      return null;
    }
  };

  /** What a cheap pass found: take it in (the tags, the budget, the numbers a test reads). */
  const took = (blocks: TextBlock[], gw: number, ms: number, now: number, at: number, asked: number): void => {
    const frame = L.camera.size;
    // the clock of the 2-second habit starts when the first look at a real frame was asked for, not when it came back
    if (!firstPassAt) firstPassAt = asked;
    if (mirror.steady && !steadyAt) steadyAt = at;
    const k = frame.w / gw;
    const sightings: Sighting[] = blocks.map((b) => ({ kind: 'text', score: b.score, truth: TEXT_TRUTH, box: { x: b.box.x * k, y: b.box.y * k, w: b.box.w * k, h: b.box.h * k } }));
    // a code's squares look like print to the check: where a code is standing, it is the code, not text
    const codesNow = tags.alive(at).filter((t) => t.kind === 'code');
    const plain = sightings.filter((x) => !codesNow.some((c) => overlap(grow(c.box, 0.3), x.box) > 0.4));
    note(tags.see(plain, at, frame), at);
    tags.keep(mirror.epoch, mirror.steady, at);
    budget.record(ms, now);
    if (now - maxAt > 1000) {
      max = 0;
      maxAt = now;
    }
    max = Math.max(max, ms);
    oneState.cheapMs = Math.round(budget.ms * 100) / 100;
    oneState.cheapMax = Math.round(max * 100) / 100;
    oneState.passes++;
    oneState.steady = mirror.steady;
    oneState.diff = Math.round(mirror.diff * 10) / 10;
    oneState.hz = budget.rate(now);
    S.fps = oneState.hz;
  };

  /** One cheap pass: a copy of the frame (160 pixels wide, or 720 when a code look is due), the steadiness and the text check. */
  const pass = async (now: number): Promise<void> => {
    const wantCode = !codeBroken && !codeBusy && now - lastCode >= CODE_MS;
    grabBusy = true;
    const v = visit;
    const tg = performance.now();
    try {
      startWorker();
      const bm = worker ? await bitmapOf(wantCode ? CODE_W : GREY_W) : null;
      if (v !== visit || S.camera !== 'on') return bm?.close();
      if (bm && worker) {
        const id = ++seq;
        const got = new Promise<LensReply>((ok) => waiting.set(id, ok));
        worker.postMessage({ id, bitmap: bm, now: performance.now(), pixels: wantCode } satisfies LensAsk, [bm]);
        const r = await got;
        if (v !== visit || S.camera !== 'on') return;
        if (!r.error) {
          oneState.grabMs = Math.round((performance.now() - tg) * 10) / 10;
          mirror.steady = r.steady;
          mirror.epoch = r.epoch;
          mirror.diff = r.diff;
          oneState.stages = { draw: 0, read: Math.round(r.ms * 10) / 10, grey: 0, tiles: Math.round(r.tiles * 100) / 100 };
          // what the check costs on THIS phone: the median of the last dozen frames it ran alone. A frame under the heavy pass
          // is left out (the worker waits for a core while the object finder runs), and the budget's spec reads the value only
          // once a dozen frames are in (8 Nov: on a two-core runner the first frames of a visit, with the camera starting and
          // the first look drawn through software graphics, read a 1.5 ms check as 4.6 to 8 ms; main went red on it twice)
          if (!heavyInFlight) {
            tileTimes.push(r.tiles);
            if (tileTimes.length > 12) tileTimes.shift();
            oneState.textFrames++;
          }
          const sorted = [...tileTimes].sort((a, b) => a - b);
          if (sorted.length) oneState.textMs = Math.round(sorted[Math.floor(sorted.length / 2)]! * 100) / 100;
          took(r.blocks, r.w, r.ms, now, performance.now(), tg);
          if (r.px && r.pw && r.ph) codes(new ImageData(new Uint8ClampedArray(r.px), r.pw, r.ph), now);
          return;
        }
      }
      // no worker: the same pass on this thread
      const c = await grab(wantCode ? CODE_W : GREY_W);
      if (!c || v !== visit || S.camera !== 'on') return;
      const t0 = performance.now();
      const frame = L.camera.size;
      let small = c;
      if (c.width !== GREY_W) {
        const gh = Math.max(24, Math.round((GREY_W * frame.h) / frame.w));
        if (grey.height !== gh) grey.height = gh;
        gctx?.drawImage(c, 0, 0, grey.width, grey.height);
        small = grey;
      }
      const px = (small === grey ? gctx : small.getContext('2d'))?.getImageData(0, 0, small.width, small.height);
      if (!px) return;
      const g = greyOf(px.data, small.width, small.height);
      steady.push(g, t0);
      mirror.steady = steady.steady;
      mirror.epoch = steady.epoch;
      mirror.diff = steady.diff;
      const blocks = textTiles(g);
      oneState.grabMs = Math.round((t0 - tg) * 10) / 10;
      oneState.textMs = Math.round((performance.now() - t0) * 100) / 100;
      took(blocks, g.w, performance.now() - t0, now, t0, tg);
      if (wantCode) {
        const cx = c.getContext('2d');
        if (cx) codes(cx.getImageData(0, 0, c.width, c.height), now);
      }
    } finally {
      grabBusy = false;
    }
  };

  /** The first tag's time, for the 2-second habit. */
  const note = (born: Tag[], now: number): void => {
    if (!born.length || firstTagAt) return;
    firstTagAt = now;
    oneState.firstTagMs = Math.round(now - firstPassAt);
    oneState.steadyToTag = steadyAt ? Math.round(now - steadyAt) : null;
  };

  /** A barcode or QR code in the 720-pixel copy of the frame (pixels already read), about three times a second, never blocking a frame. */
  const codes = (img: ImageData, now: number): void => {
    lastCode = now;
    codeBusy = true;
    const v = visit;
    const t0 = performance.now();
    void readCodesIn(img)
      .then((found) => {
        if (v !== visit) return;
        oneState.codeMs = Math.round(performance.now() - t0);
        const frame = L.camera.size;
        const k = frame.w / img.width;
        const sightings: Sighting[] = found.slice(0, 2).map((f) => {
          const info = classifyCode(f.text, f.format);
          const xs = f.points.map((p) => p.x * k);
          const ys = f.points.map((p) => p.y * k);
          const box: Box = f.points.length
            ? { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
            : { x: frame.w * 0.3, y: frame.h * 0.3, w: frame.w * 0.4, h: frame.h * 0.4 };
          return { kind: 'code' as const, score: 1, truth: codeTruth(info.kind), box, data: { text: f.text, format: f.format, codeKind: info.kind, ...(info.kind === 'url' && info.url ? { word: linkWord(info.url.href, info.url.host) } : {}) } };
        });
        const now2 = performance.now();
        for (const c of sightings) tags.drop((t) => t.kind === 'text' && overlap(grow(c.box, 0.3), t.box) > 0.4);
        note(tags.see(sightings, now2, frame), now2);
      })
      .catch((e: unknown) => {
        // the reader could not load (offline with no copy): the cheap pass says so on the bar, nothing else
        codeBroken = true;
        S.error = sayError(e, 'read that');
        markAll();
      })
      .finally(() => (codeBusy = false));
  };

  // ---------------------------------------------------------------- a face he knows (only when the face models are already on this phone)
  const facesOnPhone = (): boolean => faces.ready || flag(FACES_KEY);
  const faceStep = (now: number): void => {
    if (faceBusy || now - lastFace < FACE_MS || !facesOnPhone()) return;
    lastFace = now;
    faceBusy = true;
    const v = visit;
    oneState.faces = faces.ready ? 'on' : 'loading';
    const pickFor = (fs: FaceSeen[]): number[] => {
      const need = fs
        .map((f, i) => {
          const tr = tracks.find((x) => iou(x.box, f.box) > 0.3);
          return { i, area: f.box.w * f.box.h, fresh: !!tr?.emb && now - tr.embAt < FRESH_MS };
        })
        .filter((x) => !x.fresh)
        .sort((a, b) => b.area - a.area);
      return need.slice(0, 1).map((x) => x.i);
    };
    void (async () => {
      if (!faces.ready) await faces.load();
      if (v !== visit) return;
      oneState.faces = 'on';
      const look = await faces.look(L.camera, pickFor);
      if (v !== visit) return;
      tracks = look.faces.map((f) => {
        const prev = tracks.find((x) => iou(x.box, f.box) > 0.3);
        if (f.emb) return { box: f.box, emb: f.emb, embAt: now, match: bestMatch(f.emb, known) };
        return { box: f.box, emb: prev?.emb, embAt: prev?.embAt ?? 0, match: prev?.match ?? null };
      });
      const sightings: Sighting[] = tracks.map((tr, i) => {
        const score = look.faces[i]?.score ?? 0.9;
        const m = tr.match;
        // the one numbers-less question "who": only a person he knows, and only when it is sure, is named (ME, or the name he gave), on
        // the phone; everyone else, a likeness that is not sure included, is "someone I don't know": a stranger is never put a name to
        if (!m || !m.sure) return { kind: 'stranger' as const, score, box: tr.box, truth: 'someone I don’t know' };
        return { kind: 'face' as const, score, box: tr.box, truth: '', data: { label: m.me ? 'ME' : m.name } };
      });
      const now2 = performance.now();
      note(tags.see(sightings, now2, L.camera.size), now2);
    })()
      .catch(() => {
        // the models would not start or the camera is not live: no face tags, and nothing to say about it
        oneState.faces = 'off';
      })
      .finally(() => (faceBusy = false));
  };

  // ---------------------------------------------------------------- the heavy pass: a steady frame, one at a time (the OCR READ and the translation are heavy passes too)
  let heavyInFlight = false;
  /** The dominant colour of a thing, named from its own pixels (a twelve-colour table, pure and tested): a small copy of the live frame, read once. */
  const colourOf = (box: Box, frame: { w: number; h: number }): string | undefined => {
    try {
      const c = L.camera.capture(200);
      const g = c?.getContext('2d', { willReadFrequently: true });
      if (!c || !g || !frame.w) return undefined;
      const k = c.width / frame.w;
      const px = g.getImageData(0, 0, c.width, c.height);
      return dominantColour(px.data, c.width, c.height, { x: box.x * k, y: box.y * k, w: box.w * k, h: box.h * k }) ?? undefined;
    } catch {
      return undefined;
    }
  };
  const heavyPass = async (now: number): Promise<void> => {
    if (!det || oneState.finder !== 'ready' || heavyInFlight) return;
    gate.start(mirror);
    heavyInFlight = true;
    const v = visit;
    const t0 = performance.now();
    try {
      const frame = L.camera.size;
      const objs = fromMediaPipe(det.detectForVideo(L.video, nextStamp(now)))
        .filter((d) => d.label !== 'person' && d.score >= FLOOR.object)
        .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)
        .slice(0, 1);
      if (v !== visit) return;
      // with the namer on, "something here · hold still" until it has looked; with it off, the finder's own call is all there will be
      const colour = objs[0] ? colourOf(objs[0].box, frame) : undefined;
      const first: Sighting[] = objs.map((d) => ({ kind: 'object' as const, score: d.score, box: d.box, truth: namer.ready ? objectTruth(null, false) : finderTruth(d.label), hold: mirror.epoch, data: { label: d.label, named: false, ...(colour ? { colour } : {}) } }));
      const t1 = performance.now();
      note(tags.see(first, t1, frame), t1);
      // the object finder knows 80 everyday things; a plant, a part or a lemon is not one of them. With nothing found, the namer looks
      // at the middle of the picture (what NAME names) and speaks only when it is quite sure; a tag there says "looks like", never more
      if (!objs.length && namer.ready) {
        const side = Math.round(Math.min(frame.w, frame.h) * 0.5);
        const mid: Box = { x: Math.round((frame.w - side) / 2), y: Math.round((frame.h - side) / 2), w: side, h: side };
        const covered = tags.alive(performance.now()).some((t) => (t.kind === 'text' || t.kind === 'code') && overlap(t.box, mid) > 0.25);
        if (!covered) {
          const r = await namer.name(L.video, frame, mid);
          if (v !== visit || !r) return;
          const best = r.names[0];
          if (best && best.p >= MIDDLE_FLOOR) {
            const t2 = performance.now();
            const colour = colourOf(mid, frame);
            tags.see([{ kind: 'object', score: Math.max(FLOOR.object, best.p), box: mid, truth: objectTruth(best, true), hold: mirror.epoch, data: { label: best.label, named: true, part: isPartName(best.label), ...(colour ? { colour } : {}) } }], t2, frame);
          }
        }
      }
      // the namer looks at the biggest thing: "looks like a …", never stronger
      const top = objs[0];
      if (top && namer.ready) {
        const r = await namer.name(L.video, frame, cropRect(top.box, frame, 0.1));
        if (v !== visit || !r) return;
        const best = r.names[0];
        const named = !!best && best.p >= 0.2;
        const label = named ? best!.label : top.label;
        const t2 = performance.now();
        const colour = colourOf(top.box, frame);
        tags.see([{ kind: 'object', score: top.score, box: top.box, truth: objectTruth(best, true), hold: mirror.epoch, data: { label, named, part: named && isPartName(label), ...(colour ? { colour } : {}) } }], t2, frame);
      }
      oneState.heavyPasses++;
      oneState.heavyMs = Math.round(performance.now() - t0);
      heavyFailures = 0;
    } catch (e) {
      // one slip is nothing; a few in a row means the detector cannot run here: it is not asked again this visit
      if (++heavyFailures >= 3 && v === visit) {
        det = null;
        oneState.finder = 'failed';
        oneState.stepSaid = 'The object finder keeps failing on this phone; reading and the codes still work. Try again, or close and reopen Ghosty.';
        markAll();
      }
    } finally {
      heavyInFlight = false;
      gate.finish();
    }
  };

  // ---------------------------------------------------------------- his words
  const tagOf = (kinds: TagKind[], now: number): Tag | null => {
    const list = tags.alive(now);
    const sel = list.find((t) => t.id === selectedId);
    if (sel && kinds.includes(sel.kind)) return sel;
    return list.find((t) => kinds.includes(t.kind)) ?? null;
  };
  const said = (list: Tag[]): string => {
    if (!list.length) return 'I don’t see anything I can name yet. Hold the phone still for a moment.';
    const frame = L.camera.size;
    const bits = list.map((t) => {
      if (t.kind === 'face') return 'someone I know';
      if (t.kind === 'stranger') return 'someone I don’t know';
      const k = knownOf(t, frame);
      if (t.kind === 'object') return t.data?.named && t.data.label ? `something that looks like ${withArticle(t.data.label)}` : 'something there';
      return plateWords(k).toLowerCase().replace(/ · /g, ', ');
    });
    return `I see ${bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]}.`;
  };
  /** "translate it": the English of the sign read aloud; the words sent again if the first try failed; English already said so. */
  const translateWord = (): string => {
    if (ocr.state !== 'read') {
      const line = ocr.state === 'reading' ? 'I’m still reading it: a moment.' : 'I don’t see any text to translate yet: hold the phone still on it.';
      say(line);
      return line;
    }
    if (!needsTranslation(ocr.lang)) {
      const line = ocr.lang.id === 'en' ? 'That reads as English already, so there is nothing to translate.' : 'I can’t tell which language that is, so I haven’t translated it.';
      say(line);
      return line;
    }
    if (ocr.tr === 'done') {
      speak(ocr.translation, 'en-GB');
      return 'Reading the English aloud.';
    }
    if (!online) {
      const line = 'I’m offline: I can’t translate it without a signal.';
      say(line);
      return line;
    }
    if (ocr.tr !== 'sending') {
      const v = visit;
      void sendWords(v, ocr.text);
    }
    return 'Translating it.';
  };
  const byWord = (w: LensWord, text = ''): string | null => {
    const now = performance.now();
    if (w === 'avoid') {
      const line = cards.avoid(text);
      say(line);
      return line;
    }
    if (w === 'what') {
      const sel = tags.alive(now).find((t) => t.id === selectedId);
      const line = sel ? said([sel]) : said(tags.alive(now));
      say(line);
      return line;
    }
    if (w === 'who') {
      // the tag's own words and nothing more: a name he gave, or someone he doesn't know; with no face models on the phone there are no face tags
      const people = tags.alive(now).filter((t) => t.kind === 'face' || t.kind === 'stranger');
      const names = people.map((t) => (t.kind === 'face' ? (t.data?.label ?? 'someone I know') : 'someone I don’t know'));
      const line = names.length ? `I see ${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]}.` : 'I don’t see anyone yet.';
      say(line);
      return line;
    }
    if (w === 'keep') {
      const line = keepText();
      say(line);
      return line;
    }
    if (w === 'translate') return translateWord();
    // "when's the next bus" with no stop sign in view is the brain's (the stops near where he is), not the Lens's
    if (w === 'buses' && !cardsState.jobs.includes('stop')) return null;
    if (w === 'solve' || w === 'call' || w === 'agenda' || w === 'map' || w === 'species' || w === 'place' || w === 'aloud' || w === 'copy' || w === 'contacts' || w === 'buses') {
      const line = cards.press(w);
      say(line);
      return line;
    }
    const map: Record<Exclude<LensWord, 'what' | 'who' | 'keep' | 'translate' | 'solve' | 'call' | 'agenda' | 'map' | 'species' | 'place' | 'aloud' | 'copy' | 'avoid' | 'contacts' | 'buses'>, { kinds: TagKind[]; act: ActId; none: string }> = {
      read: { kinds: ['text'], act: 'read', none: 'I don’t see any text to read yet.' },
      look: { kinds: ['code'], act: 'look', none: 'I don’t see a code yet.' },
      name: { kinds: ['object'], act: 'nameit', none: 'I don’t see an object to name yet. Getting the eyes helps.' },
      part: { kinds: ['object'], act: 'findpart', none: 'I don’t see a part to find yet. Getting the eyes helps.' },
      measure: { kinds: ['object', 'text', 'code'], act: 'measure', none: 'I don’t see anything to measure yet.' },
      ask: { kinds: ['text', 'code', 'object'], act: 'ask', none: 'I don’t see anything to ask about yet.' },
    };
    const m = map[w];
    const t = tagOf(m.kinds, now);
    if (!t) {
      say(m.none);
      return m.none;
    }
    if (m.act === 'nameit' && !t.data?.named) {
      const line = 'I haven’t named it yet: hold still for a moment.';
      say(line);
      return line;
    }
    select(t.id);
    void doAct(t, m.act);
    return { read: 'Reading the text.', look: 'Looking at the code.', name: 'Opening its name.', part: 'Looking for the part in UK shops.', measure: 'Opening MEASURE on it.', ask: 'Opening the question with the picture.' }[w];
  };

  // ---------------------------------------------------------------- the mode
  // under the viewfinder: the one true line (or, with nothing in view and no eyes, the one key that is that line), and what I said to his words
  const root = h('div.stackf.lensone', knowRow, sayLine);

  return {
    id: 'lens',
    enter(_opts?: ModeOpts) {
      visit++;
      clear(L.panel);
      L.panel.append(root);
      L.host.append(layer);
      L.bar.prepend(markRow);
      window.addEventListener('online', netChanged);
      window.addEventListener('offline', netChanged);
      oneHooks.act = byWord;
      if (typeof navigator !== 'undefined' && navigator.webdriver) {
        oneHooks.feed = {
          see: (list) => {
            const t = performance.now();
            note(tags.see(list, t, L.camera.size), t);
            paint(t);
          },
          reset: () => {
            tags.drop((x) => x.kind === 'object');
            paint(performance.now());
          },
          drop: (kind) => {
            tags.drop((x) => x.kind === kind);
            paint(performance.now());
          },
          // a fixture frame of print: a text tag over the page, and the words as the reader would have read them
          text: (words) => {
            const t = performance.now();
            const f = L.camera.size.w ? L.camera.size : { w: 640, h: 480 };
            const share = (words.match(/\S+/g)?.length ?? 0) >= 40 ? 0.8 : 0.5;
            note(tags.see([{ kind: 'text', box: { x: f.w * 0.05, y: f.h * 0.1, w: f.w * 0.9, h: f.h * share }, score: 0.95, truth: TEXT_TRUTH }], t, f), t);
            fixtureWords = true;
            ocr.text = words;
            ocr.tokens = words.match(/\S+/g) ?? [];
            // (a fixture's lines stand evenly down the text's box, as a printed menu's do)
            const fl = words.split('\n').map((l) => l.trim()).filter((l) => /\p{L}{2}/u.test(l));
            ocr.lines = fl;
            ocr.lineRel = fl.map((_, i) => ({ x: 0.03, y: (i + 0.1) / fl.length, w: 0.94, h: 0.8 / fl.length }));
            ocr.lineEn = null;
            ocr.lang = languageOf(words);
            ocr.state = 'read';
            ocr.tr = 'none';
            ocr.translation = '';
            ocr.epoch = mirror.epoch;
            oneState.ocr = { ...oneState.ocr, state: 'read', words: ocr.tokens.length, lang: ocr.lang.name };
            if (needsTranslation(ocr.lang)) void sendWords(visit, words);
            paint(t);
          },
          online: (on) => {
            online = on;
            markAll();
            paint(performance.now());
          },
        };
      }
      oneState.faces = 'off';
      tileTimes.length = 0;
      oneState.textFrames = 0;
      // what was on the phone when he left is gone from memory (leave() freed it): ready/loading start again; a failure stays said
      if (oneState.finder !== 'failed') oneState.finder = 'off';
      if (oneState.namer !== 'failed') oneState.namer = 'off';
      void warmBarcodes().catch(() => undefined);
      void knownFaces().then((k) => (known = k)).catch(() => undefined);
      // the heavy detectors are on the phone once he has tapped for them: from then on they load by themselves, from the kept files
      if (flag(HEAVY_KEY)) void loadFinder();
      markAll();
      L.status(S.camera === 'on' ? 'looking…' : 'camera off · START to open it', S.camera === 'on' ? 'ok' : undefined);
    },
    leave() {
      visit++;
      lookingWait?.(); // (the first tag's wait goes with the mode)
      lookingWait = null;
      lookSince = 0;
      layer.remove();
      markRow.remove();
      for (const n of nodes.values()) n.box.remove();
      nodes.clear();
      forgetText();
      cards.clear();
      translated.clear();
      hush();
      tags.clear();
      tracks = [];
      steady.reset();
      mirror.steady = false;
      mirror.epoch = 0;
      worker?.postMessage({ id: 0, now: 0, reset: true } satisfies LensAsk);
      worker?.terminate();
      worker = null;
      for (const f of waiting.values()) f({ id: 0, ms: 0, tiles: 0, blocks: [], steady: false, epoch: 0, diff: 255, w: 0, h: 0, error: 'left' });
      waiting.clear();
      gate.reset();
      budget.reset();
      selectedId = 0;
      firstPassAt = 0;
      steadyAt = 0;
      firstTagAt = 0;
      oneState.firstTagMs = -1;
      oneState.steadyToTag = null;
      oneState.tags = [];
      oneState.steady = false;
      det = null;
      if (oneState.finder !== 'failed') oneState.finder = 'off';
      if (oneState.namer !== 'failed') oneState.namer = 'off';
      oneHooks.act = undefined;
      oneHooks.feed = undefined;
      window.removeEventListener('online', netChanged);
      window.removeEventListener('offline', netChanged);
      // the heavy models and the code reader go back with the view (their memory); the files stay kept
      namer.release();
      freeBarcodes();
      faces.release();
      S.counts = '';
      L.lines('', '');
    },
    cameraOff() {
      forgetText();
      cards.clear();
      tags.clear();
      tracks = [];
      steady.reset();
      mirror.steady = false;
      worker?.postMessage({ id: 0, now: 0, reset: true } satisfies LensAsk);
      gate.reset();
      firstPassAt = 0;
      steadyAt = 0;
      firstTagAt = 0;
      oneState.firstTagMs = -1;
      paint(performance.now());
    },
    tick(now) {
      if (!S.frozen) {
        if (!grabBusy && budget.due(now)) void pass(now);
        faceStep(now);
        if (!heavyInFlight) {
          // the OCR READ on a steady scene with text in it, else the object finder and the namer: one heavy pass at a time
          const textNow = wantsRead(now) ? textTagNow(now) : undefined;
          if (textNow) void textPass(textNow);
          else if (gate.allow(mirror)) void heavyPass(now);
        }
        // the reader (vendored, on the phone) is started when text is first in view, so the first read is quick
        if (!L.reader.warmed && textTagNow(now)) void L.reader.warm(() => undefined).catch(() => undefined);
      }
      paint(now);
    },
    froze() {
      paint(performance.now());
    },
  };
}
