/**
 * THE ONE LENS (BRIEF-LENS; STARS 151 and 152; the owner's budgets in OWNER-ISSUES 131, his three rules in 139, "everything stays
 * findable" in 143). He points the camera and Ghosty TAGS what is there, in the Machine's marks: a thin reticle round each thing
 * (ui/machine.ts `reticle`), its tag above ("TEXT"), one true line under it ("I see text — tap to read it"), and the act it
 * offers as a key ("READ"). Drawn in the DOM over the video from each detection's box (vision/boxes.ts), not on the overlay canvas.
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
import { classifyCode } from '../../scan/codes';
import { freeBarcodes, readCodesIn, warmBarcodes } from '../../scan/barcode';
import { cropRect, fromMediaPipe, type Box } from '../../vision/boxes';
import { cropCanvas } from '../../vision/camera';
import { namer, NAMER_SIZE } from '../../vision/clip';
import { bestMatch, iou, type KnownFace } from '../../vision/facemath';
import { faces, type FaceSeen } from '../../vision/faces';
import { knownFaces } from '../../vision/facestore';
import { FrameBudget, Steady, Tags, HeavyGate, FLOOR, KIND_WORD, TEXT_TRUTH, actsFor, codeTruth, contextWords, greyOf, isPartName, looksEnglish, markOf, MARK_WORDS, objectTruth, textTiles, withArticle, type ActId, type TextBlock, type LensMark, type LensWord, type Sighting, type Tag, type TagKind } from '../../vision/frame';
import { detector, nextStamp, type ObjectDetectorLike } from '../../vision/models';
import { go } from '../../shell/tabs';
import type { LensAsk, LensReply } from '../../workers/lens.worker';
import type { LensContext, Mode, ModeOpts } from './index';

/** The grey frame's width: the "text present" check and the steadiness work on this, not on the camera's pixels. */
const GREY_W = 160;
/** The copy the barcode reader looks at: big enough for a code across a third of the view. */
const CODE_W = 720;
/** A look for a barcode, at most this often (ms): the reader is the costly part of the cheap pass. */
const CODE_MS = 380;
/** A look for faces, at most this often (ms), as PEOPLE does. */
const FACE_MS = 350;
const FRESH_MS = 1500;
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

/** The text check's cost on the last dozen frames, for the median `oneState.textMs` reports (a starved frame is not the cost). */
const tileTimes: number[] = [];
/** The heavy detectors are on this phone once he has tapped GET THE EYES; from then on they load by themselves (the files are kept). */
const HEAVY_KEY = 'ghosty.lens.heavy';
/** PEOPLE's face models were loaded on this phone: from then on the one view looks for a face he knows. */
export const FACES_KEY = 'ghosty.lens.faces';
/** What the heavy detectors cost to fetch once, in words: the object finder (4.4 MB) and the namer (42 MB). */
export const HEAVY_SIZE = '47 MB';

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
  heavy: 'off' as 'off' | 'loading' | 'ready' | 'failed',
  heavyPasses: 0,
  heavyMs: 0,
  codeMs: 0,
  /** Where one cheap pass spends its time, ms: the frame drawn small, the pixels read, the grey and the steadiness, the text check. */
  grabMs: 0,
  /** The "text present" check alone, ms a frame (smoothed): the budget is under 4. */
  textMs: 0,
  stages: { draw: 0, read: 0, grey: 0, tiles: 0 },
  mark: 'degraded' as LensMark,
  markWords: '',
  faces: 'off' as 'off' | 'loading' | 'on',
  said: '',
};

/** The tag he tapped, as the screen's selection (BRIEF-AWARENESS "that one"): its kind, never who. */
export function oneSelected(): { kind: 'thing'; id: string; label: string; detail?: string } | undefined {
  const t = oneState.tags.find((x) => x.selected);
  if (!t) return undefined;
  const label = t.kind === 'text' ? 'the text' : t.kind === 'code' ? 'the code' : t.kind === 'object' ? 'the object' : t.kind === 'face' ? 'someone I know' : 'someone I don’t know';
  return { kind: 'thing', id: t.kind, label, ...(t.kind === 'object' && t.truth.startsWith('looks like') ? { detail: t.truth } : {}) };
}

/** What the words ("read that", "what is that", "translate it", "measure it") reach while the one view is open. */
export const oneHooks: { act?: (w: LensWord) => string | null } = {};

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

  // ---------------------------------------------------------------- the mark on the bar, and its download key
  const markEl = h('span.lensmark', { role: 'status' });
  const getBtn = key('GET THE EYES', () => void loadHeavy());
  getBtn.classList.add('lensget');
  const setGet = (t: string): void => {
    const sp = getBtn.querySelector('span');
    if (sp) sp.textContent = t;
  };
  const markRow = h('div.lensmarkrow', markEl, getBtn);
  const markAll = (): void => {
    const heavy = oneState.heavy === 'ready';
    const m = markOf({ cheap: !codeBroken, heavy, online });
    oneState.mark = m;
    oneState.markWords = MARK_WORDS[m];
    markEl.dataset.mark = m;
    markEl.replaceChildren(tagMark(MARK_WORDS[m], { tone: m === 'working' ? 'on' : m === 'offline' ? 'off' : 'warn' }));
    const why = m === 'offline' ? 'No signal: ASK and TRANSLATE are greyed, reading and the codes still work.' : m === 'degraded' ? (oneState.heavy === 'loading' ? 'Getting the eyes…' : 'I can see text, codes and faces. Getting the eyes lets me name objects too.') : 'Everything is working.';
    markEl.title = why;
    markEl.setAttribute('aria-label', `${MARK_WORDS[m].toLowerCase()}: ${why}`);
    // the download key: only while the heavy detectors are not on the phone, and it needs a signal
    const need = oneState.heavy === 'off' || oneState.heavy === 'failed';
    getBtn.hidden = !need && oneState.heavy !== 'loading';
    if (oneState.heavy === 'loading') {
      getBtn.disabled = true;
      return;
    }
    setGet(oneState.heavy === 'failed' ? `TRY AGAIN · ${HEAVY_SIZE}` : `GET THE EYES · ${HEAVY_SIZE}`);
    getBtn.disabled = !online;
    getBtn.setAttribute('aria-label', online ? `Get the eyes: the object finder and the namer, ${HEAVY_SIZE} once, kept on this phone` : `Get the eyes, ${HEAVY_SIZE}: needs a signal`);
    getBtn.title = online ? `Downloads the object finder and the namer (${HEAVY_SIZE}, once). Nothing of what I see is sent.` : 'I need a signal to download them.';
  };
  const netChanged = () => {
    online = navigator.onLine !== false;
    markAll();
    paint(performance.now());
  };

  // ---------------------------------------------------------------- the heavy detectors, on his tap (or from the cache once he has tapped)
  const progress = (s: string, f?: number) => {
    if (S.mode !== 'lens') return;
    L.status(s, 'mid');
    if (f != null) setGet(`GETTING THE EYES · ${Math.round(f * 100)}%`);
  };
  const loadHeavy = async (): Promise<void> => {
    if (oneState.heavy === 'loading' || oneState.heavy === 'ready') return;
    const v = visit;
    oneState.heavy = 'loading';
    setGet('GETTING THE EYES…');
    markAll();
    try {
      const d = await detector.get(progress);
      await namer.load(progress, false);
      if (v !== visit) return;
      det = d;
      oneState.heavy = 'ready';
      setFlag(HEAVY_KEY);
      gate.reset();
      markAll();
      if (S.mode === 'lens') L.status(S.camera === 'on' ? 'looking…' : 'ready · START the camera', 'ok');
    } catch (e) {
      if (v !== visit) return;
      oneState.heavy = 'failed';
      S.error = String((e as Error)?.message ?? e);
      markAll();
      if (S.mode === 'lens') L.status(`I couldn’t get the eyes: ${S.error}`, 'off');
    }
  };

  // ---------------------------------------------------------------- what is under a tag
  interface Node {
    id: number;
    box: HTMLElement;
    ret: Reticle;
    body: HTMLElement;
    tag: HTMLElement;
    under: HTMLElement;
    truth: HTMLElement;
    keys: HTMLElement;
    sig: string;
    truthText: string;
    geo: string;
    ugeo: string;
    aria: string;
    uw: number;
    uh: number;
    msig: string;
    mt: number;
  }
  const nodes = new Map<number, Node>();
  const nameOf = (t: Tag): string => {
    if (t.kind === 'text') return 'Text in the picture';
    if (t.kind === 'code') return 'A code';
    if (t.kind === 'object') return t.data?.named && t.data.label ? withArticle(t.data.label) : 'An object';
    if (t.kind === 'face') return t.data?.label ? `${t.data.label}'s face` : 'Someone I know';
    return 'Someone I don’t know';
  };
  const acts = (t: Tag) => actsFor(t.kind, { part: t.data?.part, named: !!t.data?.named, still: S.camera === 'on' });
  const greyed = (a: { brain?: boolean }): boolean => !!a.brain && !online;

  /** The crop round a tag, from a still of the live frame (frame pixels → the still's), for READ, NAME and ASK. */
  const cropOf = (t: Tag): HTMLCanvasElement | null => {
    const still = L.still(1600);
    if (!still) return null;
    const { frame } = L.view();
    if (!frame.w) return null;
    const k = still.width / frame.w;
    const r = cropRect(t.box, frame, t.kind === 'text' ? 0.25 : 0.08);
    return cropCanvas(still, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k });
  };

  const say = (words: string): void => {
    oneState.said = words;
    sayLine.textContent = words;
    sayLine.hidden = !words;
    if (words) L.status(words, 'ok');
  };

  const needBrain = (what: string): boolean => {
    if (online) return false;
    say(`I’m offline: ${what} needs a signal. Reading and the codes still work.`);
    return true;
  };

  /** Do an act on a tag: the old mode's code, its card kept (BRIEF-LENS 1). */
  const doAct = async (t: Tag, act: ActId): Promise<void> => {
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
          say(`I couldn’t read it: ${String((e as Error)?.message ?? e)}`);
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
        L.setMode('ask', { still: c, question: t.kind === 'object' && t.data?.label ? `What is this ${t.data.label}? Tell me about it.` : t.kind === 'code' ? 'I scanned this code. What is it, and is there anything I should know?' : 'What is this?' });
        return;
      }
      case 'measure': {
        L.freeze(true);
        L.setMode('measure');
      }
    }
  };

  // ---------------------------------------------------------------- drawing the tags
  const select = (id: number): void => {
    selectedId = id;
    oneState.selected = id;
    paint(performance.now());
  };

  const makeNode = (t: Tag): Node => {
    const body = h('span.lt-body');
    const ret = reticle({
      name: nameOf(t),
      body,
      onTap: () => {
        const cur = tags.byId(t.id);
        if (!cur) return;
        select(t.id);
        const a = acts(cur)[0];
        if (a && !greyed(a)) void doAct(cur, a.id);
      },
    });
    const tagEl = h('span.lt-tag');
    const box = h('div.lenstag', { dataset: { kind: t.kind } }, ret.el, tagEl);
    const truth = h('span.lt-truth');
    const keys = h('div.lt-keys');
    const under = h('div.lenstagunder', { dataset: { kind: t.kind } }, truth, keys);
    layer.append(box, under);
    return { id: t.id, box, ret, body, tag: tagEl, under, truth, keys, sig: '', truthText: '', geo: '', ugeo: '', aria: '', uw: 0, uh: 0, msig: '', mt: 0 };
  };

  const tagWord = (t: Tag): string => (t.kind === 'face' ? (t.data?.label ?? 'FACE') : KIND_WORD[t.kind]);

  /** Put every tag where its box is, with its words and keys; the ones that are gone leave. */
  const paint = (now: number): void => {
    const list = tags.alive(now);
    const live = new Set(list.map((t) => t.id));
    for (const [id, n] of nodes) {
      if (live.has(id)) continue;
      n.box.remove();
      n.under.remove();
      nodes.delete(id);
    }
    if (selectedId && !live.has(selectedId)) selectedId = 0;
    const vw = layer.clientWidth || 360;
    const vh = layer.clientHeight || 400;
    const used: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const sorted = [...list].sort((a, b) => a.box.y - b.box.y);
    oneState.tags = [];
    for (const t of sorted) {
      const n = nodes.get(t.id) ?? (nodes.set(t.id, makeNode(t)), nodes.get(t.id)!);
      const b = L.viewBox(t.box);
      const w = Math.max(44, Math.min(vw - 8, b.w));
      const hh = Math.max(44, Math.min(vh - 8, b.h));
      const x = Math.max(4, Math.min(vw - w - 4, b.x));
      const y = Math.max(22, Math.min(vh - hh - 4, b.y));
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
      const aria = `${nameOf(t)}: ${t.truth}${selectedId === t.id ? ', selected' : ''}`;
      if (n.aria !== aria) {
        n.aria = aria;
        n.ret.el.setAttribute('aria-label', aria);
      }
      const word = tagWord(t);
      if (n.tag.textContent !== word) n.tag.replaceChildren(tagMark(word, { tone: t.kind === 'stranger' ? 'off' : selectedId === t.id ? 'on' : undefined }));
      // the true line under the thing; a face he knows says nothing more than its name
      if (n.truthText !== t.truth) {
        n.truthText = t.truth;
        n.truth.replaceChildren(t.truth ? truthLine(t.truth) : '');
      }
      // the keys, rebuilt only when the acts or the signal change (a rebuild would swallow a tap that lands mid-update)
      const list2 = acts(t);
      const sig = `${list2.map((a) => a.id + (greyed(a) ? '!' : '')).join(',')}`;
      if (sig !== n.sig) {
        n.sig = sig;
        n.keys.replaceChildren(
          ...list2.map((a) => {
            const k = key(a.word, () => {
              select(t.id);
              const cur = tags.byId(t.id);
              if (cur && !greyed(a)) void doAct(cur, a.id);
            }, { label: greyed(a) ? `${a.name}: needs a signal` : a.name });
            if (greyed(a)) {
              k.disabled = true;
              k.title = 'I’m offline: this needs a signal';
            }
            return k;
          }),
        );
      }
      n.under.hidden = list2.length === 0 && !t.truth;
      // under the box when there is room; else beside it, in its foot or under its tag, wherever it covers no other tag's words
      // (measured when its keys change and twice a second after: a font that arrives late makes the words wider)
      if (!n.uw || n.sig !== n.msig || now - n.mt > 500) {
        n.msig = n.sig;
        n.mt = now;
        n.uw = Math.ceil(n.under.offsetWidth) || 120;
        n.uh = Math.ceil(n.under.offsetHeight) || 50;
      }
      const uw = Math.min(n.uw, vw - 8);
      const uh = n.uh;
      const fits = (cx: number, cy: number): boolean => cx >= 2 && cy >= 2 && cx + uw <= vw - 2 && cy + uh <= vh - 2 && !used.some((r) => cx < r.x1 && cx + uw > r.x0 && cy < r.y1 && cy + uh > r.y0);
      const tries: [number, number][] = [[x, y + hh + 2], [x + w - uw, y + hh + 2], [x, y + hh - uh], [x + w - uw, y + hh - uh], [x, y + 2], [x + w - uw, y + 2]];
      let at = tries.find(([cx, cy]) => fits(cx, cy));
      if (!at) {
        // nothing clear: slide down from under the box to the first free row, else the foot of the view
        let cy = y + hh + 2;
        while (cy + uh <= vh - 2 && !fits(x, cy)) cy += 8;
        at = [x, Math.min(cy, vh - uh - 2)];
      }
      const ux = Math.max(2, Math.min(vw - uw - 2, at[0]));
      const uy = Math.max(2, at[1]);
      used.push({ x0: ux, y0: uy, x1: ux + uw, y1: uy + uh });
      const ugeo = `${Math.round(ux)},${Math.round(uy)},${op}`;
      if (n.ugeo !== ugeo) {
        n.ugeo = ugeo;
        Object.assign(n.under.style, { left: `${ux}px`, top: `${uy}px`, opacity: op });
      }
      oneState.tags.push({ id: t.id, kind: t.kind, tag: word, truth: t.truth, acts: list2.map((a) => a.word), box: t.box, fade, selected: selectedId === t.id, label: t.data?.label ?? '', greyed: list2.filter(greyed).map((a) => a.word) });
    }
    oneState.selected = selectedId;
    const counts = list.length ? contextWords(list) : '';
    if (S.counts !== counts) {
      S.counts = counts;
      L.lines('', list.length ? `${list.length} ${list.length === 1 ? 'tag' : 'tags'}` : '');
    }
  };

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
    note(tags.see(plain, at), at);
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
          // what the check costs on THIS phone: the median of the last dozen frames, so a frame the heavy pass starved (the worker
          // waits for a core while the object finder runs) does not stand for the check's cost (8 Nov: the budget's spec read a
          // smoothed value at exactly such a moment on a two-core runner and called a 1.5 ms check 8 ms)
          tileTimes.push(r.tiles);
          if (tileTimes.length > 12) tileTimes.shift();
          const sorted = [...tileTimes].sort((a, b) => a - b);
          oneState.textMs = Math.round(sorted[Math.floor(sorted.length / 2)]! * 100) / 100;
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
          return { kind: 'code' as const, score: 1, truth: codeTruth(info.kind), box, data: { text: f.text, format: f.format, codeKind: info.kind } };
        });
        const now2 = performance.now();
        for (const c of sightings) tags.drop((t) => t.kind === 'text' && overlap(grow(c.box, 0.3), t.box) > 0.4);
        note(tags.see(sightings, now2), now2);
      })
      .catch((e: unknown) => {
        // the reader could not load (offline with no copy): the cheap pass says so on the bar, nothing else
        codeBroken = true;
        S.error = String((e as Error)?.message ?? e);
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
        // the one numbers-less question "who": only a person he knows is named, on the phone; a stranger is "someone I don't know"
        if (!m) return { kind: 'stranger' as const, score, box: tr.box, truth: 'someone I don’t know' };
        const label = m.me ? 'ADMIN' : m.name;
        return { kind: 'face' as const, score, box: tr.box, truth: m.sure ? '' : 'I think so', data: { label: m.sure ? label : `${label}?` } };
      });
      const now2 = performance.now();
      note(tags.see(sightings, now2), now2);
    })()
      .catch(() => {
        // the models would not start or the camera is not live: no face tags, and nothing to say about it
        oneState.faces = 'off';
      })
      .finally(() => (faceBusy = false));
  };

  // ---------------------------------------------------------------- the heavy pass: a steady frame, one at a time
  const heavyPass = async (now: number): Promise<void> => {
    if (!det || oneState.heavy !== 'ready') return;
    gate.start(mirror);
    const v = visit;
    const t0 = performance.now();
    try {
      const frame = L.camera.size;
      const objs = fromMediaPipe(det.detectForVideo(L.video, nextStamp(now)))
        .filter((d) => d.label !== 'person' && d.score >= FLOOR.object)
        .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)
        .slice(0, 2);
      if (v !== visit) return;
      const first: Sighting[] = objs.map((d) => ({ kind: 'object' as const, score: d.score, box: d.box, truth: objectTruth(null, false), hold: mirror.epoch, data: { label: d.label, named: false } }));
      const t1 = performance.now();
      note(tags.see(first, t1), t1);
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
            tags.see([{ kind: 'object', score: Math.max(FLOOR.object, best.p), box: mid, truth: objectTruth(best, true), hold: mirror.epoch, data: { label: best.label, named: true, part: isPartName(best.label) } }], t2);
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
        tags.see([{ kind: 'object', score: top.score, box: top.box, truth: objectTruth(best, true), hold: mirror.epoch, data: { label, named, part: named && isPartName(label) } }], t2);
      }
      oneState.heavyPasses++;
      oneState.heavyMs = Math.round(performance.now() - t0);
      heavyFailures = 0;
    } catch (e) {
      // one slip is nothing; a few in a row means the detector cannot run here: it is not asked again this visit
      if (++heavyFailures >= 3 && v === visit) {
        det = null;
        oneState.heavy = 'failed';
        S.error = `The object finder keeps failing: ${String((e as Error)?.message ?? e)}`;
        markAll();
      }
    } finally {
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
    const bits = list.map((t) => (t.kind === 'text' ? 'some text' : t.kind === 'code' ? 'a code' : t.kind === 'object' ? (t.data?.named && t.data.label ? `something that looks like ${withArticle(t.data.label)}` : 'something there') : t.kind === 'face' ? 'someone I know' : 'someone I don’t know'));
    return `I see ${bits.length > 1 ? `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}` : bits[0]}.`;
  };
  const byWord = (w: LensWord): string | null => {
    const now = performance.now();
    if (w === 'what') {
      const sel = tags.alive(now).find((t) => t.id === selectedId);
      const line = sel ? said([sel]) : said(tags.alive(now));
      say(line);
      return line;
    }
    const map: Record<Exclude<LensWord, 'what'>, { kinds: TagKind[]; act: ActId; none: string }> = {
      read: { kinds: ['text'], act: 'read', none: 'I don’t see any text to read yet.' },
      translate: { kinds: ['text'], act: 'translate', none: 'I don’t see any text to translate yet.' },
      look: { kinds: ['code'], act: 'look', none: 'I don’t see a code yet.' },
      name: { kinds: ['object'], act: 'nameit', none: 'I don’t see an object to name yet. Getting the eyes helps.' },
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
    const a = acts(t).find((x) => x.id === m.act);
    if (!a) return null;
    if (greyed(a)) {
      const line = `I’m offline: ${a.word.toLowerCase()} needs a signal.`;
      say(line);
      return line;
    }
    select(t.id);
    void doAct(t, m.act);
    return { read: 'Reading the text.', translate: 'Reading it to translate it.', look: 'Looking at the code.', name: 'Opening its name.', measure: 'Opening MEASURE on it.', ask: 'Opening the question with the picture.' }[w];
  };

  // ---------------------------------------------------------------- the mode
  const panelNote = h('div.note', 'Point the camera: I tag what I see. Tap a tag, or its key, and I do the act. A face I know shows only its name; a stranger is just “someone I don’t know”. Faces never leave this phone.');
  const root = h('div.stackf', sayLine, panelNote);

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
      oneState.faces = 'off';
      oneState.heavy = oneState.heavy === 'ready' ? 'off' : oneState.heavy;
      void warmBarcodes().catch(() => undefined);
      void knownFaces().then((k) => (known = k)).catch(() => undefined);
      // the heavy detectors are on the phone once he has tapped for them: from then on they load by themselves, from the kept files
      if (flag(HEAVY_KEY)) void loadHeavy();
      markAll();
      L.status(S.camera === 'on' ? 'looking…' : 'camera off · START to open it', S.camera === 'on' ? 'ok' : undefined);
    },
    leave() {
      visit++;
      layer.remove();
      markRow.remove();
      for (const n of nodes.values()) {
        n.box.remove();
        n.under.remove();
      }
      nodes.clear();
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
      if (oneState.heavy !== 'failed') oneState.heavy = 'off';
      oneHooks.act = undefined;
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
        if (gate.allow(mirror)) void heavyPass(now);
      }
      paint(now);
    },
    froze() {
      paint(performance.now());
    },
  };
}
