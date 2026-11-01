/**
 * The Lens → SHAPES (BRIEF-REST-C part 2; OWNER-ISSUES 91 (c): "i make shapes with my hand, Ghosty builds it as
 * blueprints"). He draws in the air with one finger at arm's length, one-handed: POINT draws, PINCH places (finishes the
 * shape, puts a piece down, or picks a wall), TWO FINGERS held on a wall cut a door (or a window), an OPEN HAND lifts
 * the pen (pose.ts). The trace becomes clean geometry (shapes.ts: corners snapped to right angles within 12°, every
 * length on 5 cm once he says one real length — "that wall is four metres"); the shapes become a plan (plan.ts: rooms,
 * openings, furniture by its size words, a north he sets) drawn as a 2-D blueprint here (blueprint.ts) and built in 3-D
 * in the 3D STUDIO the way DESIGN MY HOME lands its plans (walls with height, openings, CEILING for the roof), with
 * EXPORT as a PNG and as a measured list. Everything says what it is: a sketch to measurements he gave, not a survey.
 *
 * The hand tracker is the Lens's own (MediaPipe's gesture recogniser, vendored: vision/models.ts, the same task HANDS
 * uses), on the phone; the frames and the points never leave it. His words are read here with no model (words.ts), typed
 * or heard by the phone's own recogniser. A first open shows the four gestures; VoiceOver hears what was placed. The
 * specs stand the tracker in (window.__ghostyHands, honoured only under a test runner) and script a hand's trace.
 */
import { clear, h } from '../core/dom';
import { createStore } from '../core/store';
import { listen, speak, voiceSupport } from '../assistant/voice';
import { settings } from '../state/app';
import { button, toast, undo as offerUndo } from '../ui/components';
import { gestures, nextStamp, type GestureRecognizerLike, type MPGestureResult } from '../vision/models';
import type { LensContext, Mode } from '../features/lens/index';
import { drawBlueprint } from './blueprint';
import { addCut, addShape, buildPlan, emptySketch, HONEST, measuredList, nearestWall, setLength, undoLast, type BuiltPlan, type Sketch } from './plan';
import { LESSON, poseOf, type Pose } from './pose';
import { align, recognise, type Pt } from './shapes';
import { commandSaid, itemSaid, lengthSaid, materialSaid, nameSaid, northSaid, type ItemWords } from './words';

type Placed = 'shape' | 'cut' | 'item';
/** The sketch, kept on this phone between visits (never sent anywhere). */
const kept = createStore({ sketch: emptySketch(), order: [] as Placed[], taught: false }, { persist: 'ghosty.shapes' });

/** What a test (and the console) reads: window.__ghosty.shapes. */
export const shapesState = {
  pose: 'none' as Pose,
  tracing: 0,
  said: '',
  built: null as BuiltPlan | null,
  exported: { png: 0, list: 0, listText: '' },
  taught: false,
};

const SHAPE_WORDS: Record<string, string> = { rect: 'a rectangle', L: 'an L', circle: 'a circle', line: 'a wall', poly: 'a shape' };

/** Save a file he asked for: the share sheet on a phone that has one for files, else a download. */
async function saveFile(blob: Blob, name: string): Promise<void> {
  const f = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [f] }) && /iPhone|iPad|Android/i.test(navigator.userAgent) && nav.share) {
    try {
      await nav.share({ files: [f], title: name });
      return;
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** The specs' stand-in for the hand tracker (only under a test runner). */
function standIn(): GestureRecognizerLike | null {
  const w = window as unknown as { __ghostyHands?: GestureRecognizerLike };
  return navigator.webdriver && w.__ghostyHands && typeof w.__ghostyHands.recognizeForVideo === 'function' ? w.__ghostyHands : null;
}

export function createShapesMode(L: LensContext): Mode {
  const S = L.state;
  let sk: Sketch = kept.get().sketch;
  let order: Placed[] = kept.get().order;
  let rec: GestureRecognizerLike | null = null;
  let loading: Promise<void> | null = null;
  let visit = 0;
  let trace: Pt[] = [];
  let tip: Pt | null = null;
  let pinched = false;
  let lastPinch = 0;
  let twoSince = 0;
  let cutDone = false;
  let pending: ItemWords | null = null;
  let openingType: 'door' | 'window' = 'door';
  let lastStatus = 0;

  const say = h('div.shpsay', { role: 'status', 'aria-live': 'polite' });
  const canvas = h('canvas.shpcanvas', { role: 'img', 'aria-label': 'Blueprint: nothing drawn yet.' }) as HTMLCanvasElement;
  const scaleLine = h('div.shpscale', { dataset: { case: 'keep' } });
  const field = h('input.shpin', { placeholder: 'that wall is 4 metres · a bed here · north is left', autocomplete: 'off', enterKeyHint: 'send', 'aria-label': 'Tell SHAPES a length, a piece or where north is' });
  const sendBtn = button('SAY', () => void typed());
  const micBtn = button('MIC', () => void heard());
  micBtn.setAttribute('aria-label', 'Say it (heard on this phone only)');
  const undoBtn = button('UNDO', () => undo());
  const clearBtn = button('CLEAR', () => wipe(), 'warn');
  const see3d = button('SEE IN 3-D', () => void open3d(), 'on');
  const pngBtn = button('PNG', () => void exportPng());
  pngBtn.setAttribute('aria-label', 'Export the blueprint as a picture');
  const listBtn = button('LIST', () => void exportList());
  listBtn.setAttribute('aria-label', 'Export the measured list');
  const lesson = h('div.shptut', { role: 'group', 'aria-label': 'Four gestures' },
    h('div.lab', 'FOUR GESTURES'),
    ...LESSON.map((l) => h('div.shprow', h('b', l.name), h('span', l.does))),
    h('div.note', 'One hand, at arm’s length. Then say one real length, like “that wall is four metres”.'),
    button('GOT IT', () => {
      kept.set({ taught: true });
      shapesState.taught = true;
      lesson.hidden = true;
    }, 'on'),
  );
  const root = h('div.stackf.shapes',
    say,
    lesson,
    h('div.shpbp', canvas),
    scaleLine,
    h('div.row.shpask', field, sendBtn, micBtn),
    h('div.row.wrap.shpacts', undoBtn, clearBtn, see3d, pngBtn, listBtn),
    h('div.note.shphonest', `${HONEST}. Your hands and the camera stay on this phone.`),
  );
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void typed();
  });

  const tell = (text: string, voice = false) => {
    say.textContent = text;
    shapesState.said = text;
    if (voice || settings.get().speak) void speak(text, { here: true }).catch(() => undefined);
  };

  /** The sketch changed: keep it, build the plan, redraw the blueprint, tell VoiceOver what it shows. */
  const changed = () => {
    kept.set({ sketch: sk, order });
    const built = buildPlan(sk);
    shapesState.built = built;
    canvas.setAttribute('aria-label', `Blueprint: ${built.words}`);
    scaleLine.textContent = sk.said ? `Scale: from the ${sk.said.metres.toFixed(2)} m you gave · north ${sk.north === 0 ? 'up' : `${sk.north}°`}` : 'Scale: a guess. Say one real length: “that wall is four metres”.';
    paintBlueprint(built);
  };
  const paintBlueprint = (built = shapesState.built ?? buildPlan(sk)) => {
    const w = Math.max(200, Math.round(canvas.clientWidth || L.panel.clientWidth || 320));
    const hh = Math.round(w * 0.72);
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
    }
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBlueprint(g, built, w, hh, { guessed: !sk.said });
  };

  /** A point of the picture (frame pixels) in sketch units: as he sees it (mirrored for the front camera), one unit its width. */
  const toSketch = (x: number, y: number): Pt => {
    const v = L.viewPoint(x, y);
    const size = L.view().size;
    return [v.x / Math.max(1, size.w), v.y / Math.max(1, size.w)];
  };
  /** A sketch point in the plan's own straight (the shapes are kept turned that way). */
  const inPlan = (p: Pt): Pt => align([p], sk.axis ?? 0)[0]!;

  const finishShape = () => {
    const r = recognise(trace, sk.axis);
    trace = [];
    if (!r) return tell('That was too small to be a wall: draw it bigger, then pinch.');
    sk = addShape(sk, r.shape, r.axis);
    order = [...order, 'shape'];
    changed();
    const built = shapesState.built!;
    const room = r.shape.closed ? built.rooms[built.rooms.length - 1] : null;
    tell(`Placed ${SHAPE_WORDS[r.shape.kind]}${room?.box ? `, ${room.box[0].toFixed(2)} by ${room.box[1].toFixed(2)} metres` : ''}${sk.said ? '' : '. Say how long that wall is'}.`);
  };
  const placeItem = (p: Pt, it: ItemWords) => {
    sk = { ...sk, items: [...sk.items, { ...it, at: inPlan(p) }] };
    order = [...order, 'item'];
    pending = null;
    changed();
    tell(`Placed ${it.label.toLowerCase()}, ${(it.w / 100).toFixed(2)} by ${(it.d / 100).toFixed(2)} metres.`);
  };
  const pinch = (p: Pt) => {
    if (trace.length >= 5) return finishShape();
    if (pending) return placeItem(p, pending);
    const w = nearestWall(sk, inPlan(p), 0.1);
    if (!w) return tell('Point to draw a wall first, then pinch to finish it.');
    sk = { ...sk, selected: { shape: w.shape, edge: w.edge } };
    changed();
    tell('That wall. Say how long it is, or hold two fingers on it for a door.');
  };
  const cut = (p: Pt) => {
    const next = addCut(sk, inPlan(p), openingType);
    if (!next) return tell('Hold two fingers on a room’s wall to cut a door there.');
    sk = next;
    order = [...order, 'cut'];
    changed();
    const o = shapesState.built!.openings[shapesState.built!.openings.length - 1];
    tell(o ? `${o.type === 'door' ? 'A door' : 'A window'}, ${o.w.toFixed(2)} metres, in ${o.room}.` : 'That wall is too short for an opening.');
  };
  const undo = () => {
    if (trace.length) {
      trace = [];
      return tell('Trace cleared.');
    }
    if (!order.length) return tell('Nothing to undo.');
    ({ sk, order } = undoLast(sk, order));
    changed();
    tell('Taken back.');
  };
  const wipe = () => {
    const was = { sk, order };
    sk = emptySketch();
    order = [];
    trace = [];
    changed();
    tell('Cleared. Point to draw again.');
    offerUndo('Sketch cleared', () => {
      ({ sk, order } = was);
      changed();
    });
  };

  /** His words: a length, a piece, north, a material, a name, or a small command. True when they were for SHAPES. */
  const words = (text: string, voice: boolean): boolean => {
    const cmd = commandSaid(text);
    if (cmd === 'undo') return undo(), true;
    if (cmd === 'clear') return wipe(), true;
    if (cmd === 'done') return void open3d(), true;
    if (cmd === 'window' || cmd === 'door') {
      openingType = cmd;
      const last = sk.cuts[sk.cuts.length - 1];
      if (last && order[order.length - 1] === 'cut') {
        sk = { ...sk, cuts: [...sk.cuts.slice(0, -1), { ...last, type: cmd }] };
        changed();
        return tell(`That opening is a ${cmd} now.`, voice), true;
      }
      return tell(`The next cut is a ${cmd}.`, voice), true;
    }
    const m = lengthSaid(text);
    if (m !== null) {
      if (!sk.shapes.length) return tell('Draw a wall first, then tell me how long it is.', voice), true;
      sk = setLength(sk, m);
      changed();
      return tell(`Scale set: that wall is ${m.toFixed(2)} metres. Every length follows from it.`, voice), true;
    }
    const n = northSaid(text);
    if (n !== null) {
      sk = { ...sk, north: n };
      changed();
      return tell(`North is ${n === 0 ? 'up' : n === 90 ? 'to the left' : n === 270 ? 'to the right' : 'down'} on the plan.`, voice), true;
    }
    const it = itemSaid(text);
    if (it) {
      // "here": where the finger is now, else the middle of the last room; otherwise the next pinch puts it down
      if (/\b(?:here|there)\b/i.test(text) && (tip || sk.shapes.length)) {
        const at = tip ?? lastRoomMiddle();
        if (at) return placeItem(at, it), true;
      }
      pending = it;
      return tell(`Pinch where the ${it.label.split(',')[0]!.toLowerCase()} goes.`, voice), true;
    }
    const mat = materialSaid(text);
    if (mat) {
      sk = { ...sk, material: mat };
      changed();
      return tell(`Walls: ${mat}, as a guess from your words.`, voice), true;
    }
    const name = nameSaid(text);
    if (name && sk.shapes.length) {
      const i = sk.selected?.shape ?? sk.shapes.length - 1;
      sk = { ...sk, names: { ...sk.names, [i]: name } };
      changed();
      return tell(`Called it ${name}.`, voice), true;
    }
    return false;
  };
  /** The middle of the last room, in the picture's sketch units (turned back out of the plan's straight). */
  const lastRoomMiddle = (): Pt | null => {
    const s = sk.shapes[sk.shapes.length - 1];
    if (!s) return null;
    const c: Pt = [s.pts.reduce((a, p) => a + p[0], 0) / s.pts.length, s.pts.reduce((a, p) => a + p[1], 0) / s.pts.length];
    return align([c], -(sk.axis ?? 0))[0]!;
  };
  const typed = () => {
    const t = field.value.trim();
    if (!t) return void field.focus();
    field.value = '';
    if (!words(t, false)) tell('Here I take a length (“that wall is four metres”), a piece (“a bed here”), north, or undo.');
  };
  const heard = async () => {
    if (!voiceSupport.browserStt) return void toast('I can’t hear on the phone alone in this browser: type it instead.', 'warn');
    try {
      const t = await listen(false, (x) => (say.textContent = x));
      if (t && !words(t, true)) tell('Say a length, a piece, or where north is.', true);
    } catch (e) {
      toast(String((e as Error)?.message ?? e), 'warn');
    }
  };

  /** SEE IN 3-D: the plan built in the 3D STUDIO (walls with height, openings; CEILING there is the roof). */
  const open3d = async () => {
    const built = buildPlan(sk);
    if (!built.room.rooms.length && !built.room.items.length) return tell('Draw a room first: point, trace it, pinch.');
    const { openStudio } = await import('../features/studio');
    openStudio({ room: built.room });
    toast(`${HONEST}.`, 'ok');
  };
  const exportPng = async () => {
    const built = buildPlan(sk);
    const c = h('canvas', { width: 1600, height: 1150 }) as HTMLCanvasElement;
    const g = c.getContext('2d');
    if (!g) return;
    const day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    drawBlueprint(g, built, c.width, c.height, { guessed: !sk.said, title: `GHOSTY · A PLAN FROM YOUR HANDS · ${day}` });
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
    if (!blob) return void toast('Could not make the picture', 'bad');
    shapesState.exported.png = blob.size;
    await saveFile(blob, 'ghosty-plan.png');
    tell('The blueprint is saved as a picture.');
  };
  const exportList = async () => {
    const built = buildPlan(sk);
    const text = measuredList(sk, built);
    shapesState.exported.list = text.length;
    shapesState.exported.listText = text;
    await saveFile(new Blob([text], { type: 'text/plain' }), 'ghosty-plan-measurements.txt');
    tell('The measured list is saved.');
  };

  /** The fingertip's trail and the placed shapes, over the camera picture. */
  const paintOverlay = () => {
    const c = L.overlay();
    if (!c) return;
    const w = L.view().size.w;
    const ax = sk.axis ?? 0;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(232, 244, 255, .55)';
    c.lineWidth = 2;
    for (const s of sk.shapes) {
      const pts = align(s.pts, -ax);
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * w) : c.moveTo(x * w, y * w)));
      if (s.closed) c.closePath();
      c.stroke();
    }
    if (trace.length > 1) {
      c.strokeStyle = '#62e4ff';
      c.lineWidth = 3;
      c.beginPath();
      trace.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * w) : c.moveTo(x * w, y * w)));
      c.stroke();
    }
    if (tip) {
      c.strokeStyle = shapesState.pose === 'point' ? '#62e4ff' : 'rgba(255,255,255,.8)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(tip[0] * w, tip[1] * w, shapesState.pose === 'pinch' ? 5 : 9, 0, Math.PI * 2);
      c.stroke();
    }
  };

  const load = () => {
    const fake = standIn();
    if (fake) {
      rec = fake;
      return;
    }
    loading ??= (async () => {
      const v = visit;
      try {
        const r = await gestures.get((t) => S.mode === 'shapes' && L.status(t, 'mid'));
        if (v !== visit) return;
        rec = r;
        if (S.mode === 'shapes') L.status(S.camera === 'on' ? 'point a finger to draw' : 'hand tracker ready · START the camera', 'ok');
      } catch (e) {
        if (v !== visit) return;
        loading = null;
        L.status(`The hand tracker cannot run here: ${String((e as Error)?.message ?? e)}`, 'off');
      }
    })();
  };

  /** One frame of the hand: its pose, the smoothed fingertip, and what the pose does. */
  const frame = (r: MPGestureResult, now: number) => {
    const lm = r.landmarks?.[0];
    const view = L.view();
    if (!lm) {
      shapesState.pose = 'none';
      tip = null;
      return;
    }
    const pose = poseOf(lm);
    shapesState.pose = pose;
    const raw = toSketch(lm[8]!.x * view.frame.w, lm[8]!.y * view.frame.h);
    // at arm's length the fingertip shakes: half of each new position, half the last
    tip = tip ? [tip[0] + (raw[0] - tip[0]) * 0.5, tip[1] + (raw[1] - tip[1]) * 0.5] : raw;
    if (pose === 'point') {
      const last = trace[trace.length - 1];
      if (!last || Math.hypot(tip[0] - last[0], tip[1] - last[1]) > 0.004) trace.push([tip[0], tip[1]]);
    }
    if (pose === 'pinch' && !pinched && now - lastPinch > 700) {
      pinched = true;
      lastPinch = now;
      pinch(tip);
    }
    if (pose !== 'pinch') pinched = false;
    if (pose === 'two') {
      if (!twoSince) twoSince = now;
      else if (now - twoSince > 500 && !cutDone) {
        cutDone = true;
        cut(tip);
      }
    } else {
      twoSince = 0;
      cutDone = false;
    }
    shapesState.tracing = trace.length;
  };

  return {
    id: 'shapes',
    enter() {
      visit++;
      clear(L.panel, root);
      sk = kept.get().sketch;
      order = kept.get().order;
      shapesState.taught = kept.get().taught;
      lesson.hidden = kept.get().taught;
      trace = [];
      tip = null;
      requestAnimationFrame(() => changed());
      load();
      tell(sk.shapes.length ? 'Your sketch is here. Point to add to it.' : 'Point one finger to draw a room in the air; pinch to finish.');
    },
    leave() {
      visit++;
      rec = null;
      loading = null;
      trace = [];
      tip = null;
      L.clearOverlay();
    },
    tick(now) {
      if (!rec) return;
      let r: MPGestureResult;
      try {
        r = rec.recognizeForVideo(L.video, nextStamp(now));
      } catch {
        return;
      }
      frame(r, now);
      paintOverlay();
      if (now - lastStatus > 600 && S.camera === 'on' && !S.frozen) {
        lastStatus = now;
        L.status(shapesState.pose === 'point' ? 'drawing' : shapesState.pose === 'none' ? 'show one hand' : shapesState.pose === 'open' ? 'pen up' : shapesState.pose, 'ok');
      }
    },
  };
}

/** The chat's "draw a room with my hands": the Lens on SHAPES (assistant/local.ts). */
export async function openShapes(): Promise<void> {
  const { openLens } = await import('../features/lens/index');
  openLens('shapes');
}
