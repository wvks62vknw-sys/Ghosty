/**
 * MEASURE: real sizes from a picture. With no settings (AUTO, the default): take or pick a photo
 * and the phone works out how far away everything is (Depth Anything V2 on the phone,
 * measure/depth.ts), reads the camera's lens from the photo (measure/exif.ts), corrects the scale
 * with things of known size it recognises (an A4 sheet, a phone, a person…: measure/cues.ts) and
 * measures the main thing in view by itself; tap any other thing for its width × height × depth,
 * each with a likely range and the cues named. The old ways stay as overrides: tell MEASURE the scale — tap
 * the four corners of a bank card or an A4 sheet lying on the surface, tap a door's top and
 * bottom (its height typed, 1981 mm by default: a UK standard door), or type the distance to
 * the wall — then tap two points for a length or a wall's (or an opening's) four corners for
 * width × height. Values in cm and ft/in with how far to trust them; UNDO, CLEAR. SAVE puts the
 * set in the SPACE PLANNER (a wall's width becomes the room's) and opens it; ASK GHOSTY sends the
 * set to the chat as the phone's own data (never as the owner's words). Pure maths in
 * measure/geom.ts; everything stays on the phone until ASK GHOSTY.
 *
 * A picked photo is shown whole (padded to the viewfinder's shape) so every corner can be
 * tapped. The state a test reads is at window.__ghosty.measure.
 */
import { clear, h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { button, toast } from '../../ui/components';
import { askWithImage } from '../../vision/ask';
import { hitBox, type Detection } from '../../vision/boxes';
import { loadImageFile } from '../../vision/camera';
import { scalePhoto } from '../../measure/autoscale';
import { cuesLine, type Fused } from '../../measure/cues';
import { depthModel } from '../../measure/depth';
import { band, lengthFromDepth, rectFromDepth, regionAt, regionSize, type DepthMap } from '../../measure/depth3d';
import { intrinsicsFor, readExif, type Exif, type Intrinsics } from '../../measure/exif';
import { bothText, calibrateDistance, calibrateHeight, calibrateRect, CARD_MM, A4_MM, cmText, confidence, describeMeasurements, DOOR_MM, ftInText, lengthMm, orderCorners, parseLength, rangeText, rectMm, type Calibration, type Measurement, type Pt, type RefKind } from '../../measure/geom';
import { space } from '../../space/store';
import type { LensContext, Mode } from './index';

type Tool = 'thing' | 'length' | 'rect';

interface Result {
  m: Measurement;
  pts: Pt[];
  note: string;
}

/** What MEASURE is doing, for tests and the console (window.__ghosty.measure). */
export interface MeasureState {
  ref: RefKind;
  refPoints: number;
  calibrated: boolean;
  tool: Tool;
  points: number;
  results: { kind: Measurement['kind']; w: number; h?: number; d?: number; range?: number; name?: string; confidence: string; text: string }[];
  status: string;
  /** AUTO: where the depth work is, the camera it assumed, the cues used and set aside, the scale's doubt. */
  auto: { state: 'off' | 'loading' | 'working' | 'ready' | 'failed'; camera: string; cues: string[]; ignored: string[]; scale: number; sigma: number; ms: number; error: string };
  /** The picture being measured (pixels), when there is one. */
  frame: { w: number; h: number } | null;
  /** Where a picture pixel is on the page (client pixels), for a test's taps. */
  at?: (x: number, y: number) => { x: number; y: number } | null;
}

export const measureState: MeasureState = {
  ref: 'auto',
  refPoints: 0,
  calibrated: false,
  tool: 'thing',
  points: 0,
  results: [],
  status: '',
  frame: null,
  auto: { state: 'off', camera: '', cues: [], ignored: [], scale: 1, sigma: 0, ms: 0, error: '' },
};

/** On the console/test handle; main.ts makes __ghosty after the first tab opens (a reload landing here), so this retries. */
function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.measure = measureState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

const REFS: { id: RefKind; label: string; taps: number; hint: string }[] = [
  { id: 'auto', label: 'AUTO', taps: 0, hint: 'tap the thing to measure' },
  { id: 'card', label: 'BANK CARD', taps: 4, hint: 'tap the card’s four corners' },
  { id: 'a4', label: 'A4 SHEET', taps: 4, hint: 'tap the sheet’s four corners' },
  { id: 'door', label: 'DOOR', taps: 2, hint: 'tap the top of the door, then the bottom' },
  { id: 'distance', label: 'DISTANCE', taps: 0, hint: 'type how far the wall is, then SET' },
];

/** The picture padded (black bars) to the viewfinder's shape, so the whole of it shows under the Lens's cover-fit view. */
function letterbox(src: HTMLCanvasElement, view: { w: number; h: number }): HTMLCanvasElement {
  if (!(view.w > 0 && view.h > 0)) return src;
  const want = view.w / view.h;
  const have = src.width / src.height;
  if (Math.abs(want - have) < 0.01) return src;
  const c = document.createElement('canvas');
  c.width = have > want ? src.width : Math.round(src.height * want);
  c.height = have > want ? Math.round(src.width / want) : src.height;
  const g = c.getContext('2d');
  if (!g) return src;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, Math.round((c.width - src.width) / 2), Math.round((c.height - src.height) / 2));
  return c;
}

export function createMeasureMode(L: LensContext): Mode {
  const S = measureState;
  let photo: HTMLCanvasElement | null = null;
  /** The camera's own picture size (for the field-of-view scale), before any padding. */
  let orig = { w: 0, h: 0 };
  /** Where the camera's picture sits inside `photo` (the padding round a picked photo). */
  let pad = { x: 0, y: 0 };
  /** The picture itself, unpadded (AUTO works on it), and what its EXIF said. */
  let source: HTMLCanvasElement | null = null;
  let exif: Exif | null = null;
  let fromFreeze = false;
  let refPts: Pt[] = [];
  let cal: Calibration | null = null;
  let tool: Tool = 'thing';
  let pts: Pt[] = [];
  let results: Result[] = [];
  // AUTO: the depth map (corrected by the cues), the camera, what the detector saw
  let depth: DepthMap | null = null;
  let K: Intrinsics | null = null;
  let fused: Fused | null = null;
  let dets: Detection[] = [];
  let colours: Uint8ClampedArray | null = null;
  /** Bumped for every new picture: work for an older one is dropped when it finishes. */
  let autoGen = 0;

  const status = (text: string, light?: 'ok' | 'mid' | 'off') => {
    S.status = text;
    L.status(text, light);
  };

  // ---- the reference
  const refBtns = new Map<RefKind, HTMLButtonElement>();
  const refRow = h('div.lenschips.measrefs');
  for (const r of REFS) {
    const b = button(r.label, () => setRef(r.id));
    refBtns.set(r.id, b);
    refRow.append(b);
  }
  const doorIn = h('input', { value: '198.1', inputmode: 'decimal', 'aria-label': 'Door height in cm (or 6 ft 6 in)' });
  const doorRow = h('div.keyrow.measin', h('span.lab', 'DOOR HEIGHT'), doorIn, h('small.note', 'cm'));
  const distIn = h('input', { placeholder: 'e.g. 2.5', inputmode: 'decimal', 'aria-label': 'Distance to the wall in metres' });
  const distRow = h('div.keyrow.measin', h('span.lab', 'TO THE WALL'), distIn, h('small.note', 'm'), button('SET', () => setDistance()));
  distIn.addEventListener('keydown', (e) => e.key === 'Enter' && setDistance());
  const autoNote = h('div.note.measauto');

  // ---- what to measure
  const thingBtn = button('THING · 1 TAP', () => setTool('thing'));
  const lenBtn = button('LENGTH · 2 TAPS', () => setTool('length'));
  const rectBtn = button('WALL · 4 CORNERS', () => setTool('rect'));
  const toolRow = h('div.lenschips.meastools', thingBtn, lenBtn, rectBtn);

  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Pick a photo to measure' });
  file.hidden = true;
  const pickBtn = button('PICK PHOTO', () => file.click());
  const holdBtn = button('HOLD FRAME', () => {
    if (L.state.camera !== 'on') return void toast('START the camera, or PICK PHOTO', 'warn');
    L.freeze(true);
  }, 'on');
  const undoBtn = button('UNDO', () => undo());
  const clearBtn = button('CLEAR', () => reset(false));
  const saveBtn = button('SAVE → PLANNER', () => saveSet(), 'on');
  const askBtn = button('ASK GHOSTY', () => void askSet(), 'warn');
  const list = h('div.measlist');
  const guide = h('div.note.measguide');
  const root = h('div.stackf',
    h('div.row', pickBtn, holdBtn),
    h('div.lab', '1 · THE SCALE'),
    refRow,
    autoNote,
    doorRow,
    distRow,
    h('div.lab', '2 · MEASURE'),
    toolRow,
    guide,
    list,
    h('div.row.wrap', undoBtn, clearBtn, saveBtn, askBtn),
    h('div.note', 'AUTO needs nothing: the phone works out distances from the photo itself (a 50 MB model, downloaded once) and checks them against things of known size it can see; it gives a likely range. For exact sizes on one surface, use a bank card or A4 sheet on it. Nothing leaves the phone unless you press ASK GHOSTY.'),
  );

  const refDef = () => REFS.find((r) => r.id === S.ref)!;
  const autoVia = () => (fused?.used.length ? `depth + ${fused.used.join(' + ')}` : 'depth from the photo');
  const via = (): string => (S.ref === 'auto' ? autoVia() : S.ref === 'card' ? 'bank card' : S.ref === 'a4' ? 'A4 sheet' : S.ref === 'door' ? `door ${Math.round(parseLength(doorIn.value) ?? DOOR_MM)} mm` : `distance ${distIn.value.trim()} m`);
  const auto = () => S.ref === 'auto';
  /** Ready to measure: AUTO's depth worked out, or a reference set. */
  const scaled = () => (auto() ? !!depth : !!cal);

  const sizeText = (m: Measurement) => (m.kind === 'object' ? `${cmText(m.w)} × ${cmText(m.h ?? 0)}${m.d ? ` × ${cmText(m.d)}` : ''}` : m.kind === 'rect' ? `${cmText(m.w)} × ${cmText(m.h ?? 0)}` : cmText(m.w));

  const paintState = () => {
    S.refPoints = refPts.length;
    S.calibrated = scaled();
    S.tool = tool;
    S.points = pts.length;
    S.frame = photo ? { w: photo.width, h: photo.height } : null;
    S.results = results.map((r) => ({ kind: r.m.kind, w: r.m.w, h: r.m.h, d: r.m.d, range: r.m.range, name: r.m.name, confidence: r.m.confidence, text: sizeText(r.m) }));
    for (const [id, b] of refBtns) b.classList.toggle('on', id === S.ref);
    doorRow.hidden = S.ref !== 'door';
    distRow.hidden = S.ref !== 'distance';
    autoNote.hidden = !auto();
    thingBtn.hidden = !auto();
    thingBtn.classList.toggle('on', tool === 'thing');
    lenBtn.classList.toggle('on', tool === 'length');
    rectBtn.classList.toggle('on', tool === 'rect');
    clear(list);
    results.forEach((r, i) => {
      const m = r.m;
      const big = sizeText(m);
      const imp = m.kind === 'length' ? ftInText(m.w) : `${ftInText(m.w)} × ${ftInText(m.h ?? 0)}${m.kind === 'object' && m.d ? ` × ${ftInText(m.d)}` : ''}`;
      const label = m.kind === 'object' ? `${m.name ? `${m.name.toUpperCase()} · ` : ''}W × H${m.d ? ' × D' : ''} · ` : '';
      list.append(h(`div.measrow.${m.confidence}` as 'div', h('b', `${i + 1}`), h('span.measv', big), h('span.measi', imp), h('small', `${label}${m.confidence.toUpperCase()}${rangeText(m)} · ${r.note}`)));
    });
    // what to do next, in one line
    let next = '';
    if (!photo) next = 'HOLD FRAME (or tap the picture) or PICK PHOTO: a still to measure on.';
    else if (auto() && !depth) next = S.auto.state === 'failed' ? `AUTO could not run: ${S.auto.error}. Use a BANK CARD, A4 SHEET, DOOR or DISTANCE instead.` : 'Working out distances in the photo…';
    else if (!auto() && !cal) next = refDef().taps ? `Scale: ${refDef().hint} (${refPts.length} of ${refDef().taps}).` : 'Scale: type the distance to the wall, then SET.';
    else next = tool === 'thing' ? 'Tap a thing for its width × height × depth.' : tool === 'length' ? `Tap two points (${pts.length} of 2).` : `Tap the wall’s four corners (${pts.length} of 4).`;
    guide.textContent = next;
    const A = S.auto;
    autoNote.textContent = A.state === 'ready' ? `${fused ? cuesLine(fused, A.camera) : ''}${A.ignored.length ? `. Not used: ${A.ignored.join('; ')}` : ''}.` : A.state === 'failed' ? `AUTO could not run: ${A.error}` : A.state === 'off' ? 'AUTO: pick or hold a photo; nothing to set.' : 'AUTO: working out distances…';
    draw();
  };

  const draw = () => {
    const g = L.overlay();
    if (!g || !photo) return;
    const P = (p: Pt) => L.viewPoint(p.x, p.y);
    const dot = (p: Pt, color: string) => {
      const v = P(p);
      g.fillStyle = color;
      g.beginPath();
      g.arc(v.x, v.y, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(2,7,13,.9)';
      g.lineWidth = 1.5;
      g.stroke();
    };
    const poly = (list: Pt[], color: string, close: boolean, width = 2) => {
      if (list.length < 2) return;
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      list.forEach((p, i) => {
        const v = P(p);
        if (i) g.lineTo(v.x, v.y);
        else g.moveTo(v.x, v.y);
      });
      if (close) g.closePath();
      g.stroke();
    };
    const tag = (p: Pt, text: string, color: string) => {
      const v = P(p);
      g.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
      const w = g.measureText(text).width + 10;
      g.fillStyle = 'rgba(2, 7, 13, .82)';
      g.fillRect(v.x - w / 2, v.y - 9, w, 18);
      g.fillStyle = color;
      g.fillText(text, v.x - w / 2 + 5, v.y + 4);
    };
    const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    // the reference (amber)
    const amber = '#ffb23e';
    if (cal?.kind === 'plane') poly([...cal.quad], amber, true);
    else poly(refPts, amber, refPts.length === 4);
    for (const p of refPts) dot(p, amber);
    // the measurements (cyan), labelled
    const cyan = '#62e4ff';
    for (const r of results) {
      if (r.m.kind === 'length') {
        poly(r.pts, cyan, false, 2.5);
        r.pts.forEach((p) => dot(p, cyan));
        tag(mid(r.pts[0]!, r.pts[1]!), cmText(r.m.w), cyan);
      } else if (r.m.kind === 'object') {
        poly(r.pts, cyan, true, 2);
        tag(mid(r.pts[0]!, r.pts[1]!), `${cmText(r.m.w)} × ${cmText(r.m.h ?? 0)}`, cyan);
      } else {
        const q = r.pts;
        poly(q, cyan, true, 2.5);
        q.forEach((p) => dot(p, cyan));
        tag(mid(q[0]!, q[1]!), cmText(r.m.w), cyan);
        tag(mid(q[1]!, q[2]!), cmText(r.m.h ?? 0), cyan);
      }
    }
    poly(pts, '#52f2b5', false);
    for (const p of pts) dot(p, '#52f2b5');
  };

  const setRef = (r: RefKind) => {
    S.ref = r;
    refPts = [];
    cal = null;
    pts = [];
    if (r === 'auto') tool = 'thing';
    else {
      if (tool === 'thing') tool = 'length';
      // a reference chosen by hand: AUTO's work on this picture stops (it starts again on AUTO)
      if (S.auto.state !== 'off') {
        autoGen++;
        depth = null;
        fused = null;
        S.auto.state = 'off';
      }
    }
    if (r === 'distance' && photo && parseLength(distIn.value, 'm')) setDistance();
    if (r === 'auto' && photo && S.auto.state === 'off') startAuto();
    paintState();
    if (photo) status(r === 'distance' ? 'type the distance to the wall' : r === 'auto' ? (depth ? 'tap a thing to measure it' : 'working out distances…') : refDef().hint, 'mid');
  };
  const setTool = (t: Tool) => {
    tool = t;
    pts = [];
    paintState();
  };
  const setDistance = () => {
    const mm = parseLength(distIn.value, 'm');
    if (!mm) return void toast('Type the distance to the wall, e.g. 2.5 (metres)', 'warn');
    if (!photo) return void toast('HOLD FRAME or PICK PHOTO first', 'warn');
    cal = calibrateDistance(mm, orig.w ? orig : { w: photo.width, h: photo.height });
    S.ref = 'distance';
    paintState();
    status(`scale set from ${bothText(mm)} away · ${tool === 'length' ? 'tap two points' : 'tap four corners'}`, 'ok');
  };

  // ---- AUTO: depth, the camera, the cues
  /** A point on the shown picture → the camera's own picture (unpadded). */
  const inSource = (p: Pt): Pt => ({ x: p.x - pad.x, y: p.y - pad.y });
  const outSource = (p: Pt): Pt => ({ x: p.x + pad.x, y: p.y + pad.y });

  const startAuto = () => {
    const c = source;
    if (!c) return;
    const gen = ++autoGen;
    depth = null;
    fused = null;
    dets = [];
    const size = { w: c.width, h: c.height };
    K = intrinsicsFor(size, exif);
    Object.assign(S.auto, { state: 'loading', camera: K.source, cues: [], ignored: [], scale: 1, sigma: 0, ms: 0, error: '' });
    paintState();
    void (async () => {
      try {
        const got = await scalePhoto(c, exif, (t) => {
          if (gen !== autoGen) return;
          if (/working out/.test(t) && S.auto.state !== 'working') {
            S.auto.state = 'working';
            paintState();
          }
          if (auto()) status(t, 'mid');
        }, { alive: () => gen === autoGen });
        if (gen !== autoGen) return;
        K = got.K;
        fused = got.fused;
        dets = got.dets;
        colours = got.rgb;
        depth = got.D;
        Object.assign(S.auto, { state: 'ready', cues: fused.used, ignored: fused.ignored, scale: fused.scale, sigma: fused.sigma, ms: Math.round(got.ms) });
        // the main thing in view, measured straight away: the detector's biggest, most central box, else the middle of the picture
        const centre = { x: size.w / 2, y: size.h / 2 };
        const main = dets
          .filter((d) => d.label.toLowerCase() !== 'person' || dets.length === 1)
          .map((d) => ({ d, s: (d.box.w * d.box.h) / (size.w * size.h) - Math.hypot(d.box.x + d.box.w / 2 - centre.x, d.box.y + d.box.h / 2 - centre.y) / Math.hypot(size.w, size.h) }))
          .sort((a2, b2) => b2.s - a2.s)[0]?.d;
        const seed = main ? { x: main.box.x + main.box.w / 2, y: main.box.y + main.box.h / 2 } : centre;
        if (auto() && !results.length) measureThing(outSource(seed), 'the main thing in view');
        paintState();
        if (auto()) status(`distances ready (${(got.ms / 1000).toFixed(1)} s) · tap a thing to measure it`, 'ok');
      } catch (e) {
        if (gen !== autoGen) return;
        Object.assign(S.auto, { state: 'failed', error: String((e as Error)?.message ?? e) });
        paintState();
        if (auto()) status(`AUTO could not run: ${S.auto.error}`, 'off');
      }
    })();
  };

  /** AUTO: the thing under a tap (shown-picture pixels): its region in the depth map, its size in 3-D. */
  const measureThing = (p: Pt, note?: string) => {
    if (!depth || !K || !source || !fused) return;
    const size = { w: source.width, h: source.height };
    const sp = inSource(p);
    const hit = hitBox(dets, sp.x, sp.y);
    const det = hit >= 0 ? dets[hit]! : null;
    const within = det ? { x: det.box.x - det.box.w * 0.04, y: det.box.y - det.box.h * 0.04, w: det.box.w * 1.08, h: det.box.h * 1.08 } : undefined;
    const region = regionAt(depth, size, sp, { within, ...(colours ? { rgb: colours } : {}) });
    const sz = regionSize(depth, K, size, region);
    if (!(sz.w > 0 && sz.h > 0)) return void toast('Nothing to measure there: tap the middle of the thing', 'warn');
    const b = band(Math.max(sz.w, sz.h), fused.sigma, Math.hypot(region.box.w, region.box.h));
    const bx = region.box;
    const corners: Pt[] = [{ x: bx.x, y: bx.y }, { x: bx.x + bx.w, y: bx.y }, { x: bx.x + bx.w, y: bx.y + bx.h }, { x: bx.x, y: bx.y + bx.h }].map(outSource);
    const d = sz.d >= 20 ? sz.d : undefined;
    addResult({ kind: 'object', w: sz.w, h: sz.h, ...(d ? { d } : {}), confidence: b.level, via: autoVia(), range: b.sigma, ...(det ? { name: det.label } : {}) }, corners, `${note ? `${note}; ` : ''}likely ${cmText(sz.w * Math.exp(-b.sigma))}–${cmText(sz.w * Math.exp(b.sigma))} wide${d ? '; depth is the side the camera saw' : ''}`);
  };

  const usePhoto = (c: HTMLCanvasElement, real: { w: number; h: number }, frozen: boolean, src?: { canvas: HTMLCanvasElement; pad: { x: number; y: number }; exif: Exif | null }) => {
    photo = c;
    orig = real;
    fromFreeze = frozen;
    source = src?.canvas ?? c;
    pad = src?.pad ?? { x: 0, y: 0 };
    exif = src?.exif ?? null;
    refPts = [];
    cal = null;
    pts = [];
    depth = null;
    fused = null;
    dets = [];
    autoGen++;
    S.auto.state = 'off';
    if (S.ref === 'distance' && parseLength(distIn.value, 'm')) setDistance();
    if (auto()) startAuto();
    paintState();
    status(S.ref === 'distance' ? 'type the distance to the wall, then SET' : auto() ? 'working out distances…' : refDef().hint, 'mid');
  };

  const addResult = (m: Measurement, at: Pt[], note: string) => {
    results.push({ m, pts: at, note });
    pts = [];
    const v = m.kind === 'object' ? `${bothText(m.w)} × ${bothText(m.h ?? 0)}` : m.kind === 'rect' ? `${bothText(m.w)} × ${bothText(m.h ?? 0)}` : bothText(m.w);
    paintState();
    status(`${v} · ${m.confidence}${rangeText(m)}`, m.confidence === 'rough' ? 'mid' : 'ok');
  };

  const tap = (x: number, y: number) => {
    if (!photo) {
      // a tap on the live picture holds it, and counts
      if (L.state.camera !== 'on') return void toast('START the camera, or PICK PHOTO', 'warn');
      L.freeze(true);
      if (!photo) return;
    }
    const p = { x: Math.max(0, Math.min(photo.width, x)), y: Math.max(0, Math.min(photo.height, y)) };
    if (auto()) {
      if (!depth || !K || !source || !fused) return void toast(S.auto.state === 'failed' ? 'AUTO could not run here: pick BANK CARD, A4 SHEET, DOOR or DISTANCE' : 'Still working out distances: a moment', 'warn');
      if (tool === 'thing') return measureThing(p);
      const size = { w: source.width, h: source.height };
      pts.push(p);
      if (tool === 'length' && pts.length === 2) {
        const mm = lengthFromDepth(depth, K, size, inSource(pts[0]!), inSource(pts[1]!));
        const b = band(mm, fused.sigma, Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y));
        addResult({ kind: 'length', w: mm, confidence: b.level, via: autoVia(), range: b.sigma }, [...pts], `likely ${cmText(b.lo)}–${cmText(b.hi)}`);
      } else if (tool === 'rect' && pts.length === 4) {
        const q = orderCorners(pts);
        const r = rectFromDepth(depth, K, size, [inSource(q[0]), inSource(q[1]), inSource(q[2]), inSource(q[3])]);
        const b = band(Math.max(r.w, r.h), fused.sigma, Math.hypot(q[2].x - q[0].x, q[2].y - q[0].y));
        addResult({ kind: 'rect', w: r.w, h: r.h, confidence: b.level, via: autoVia(), range: b.sigma }, [...q], `likely ${cmText(r.w * Math.exp(-b.sigma))}–${cmText(r.w * Math.exp(b.sigma))} wide`);
      } else paintState();
      return;
    }
    if (!cal) {
      const need = refDef().taps;
      if (!need) return void toast('Type the distance to the wall, then SET', 'warn');
      refPts.push(p);
      if (refPts.length === need) {
        try {
          if (S.ref === 'door') {
            const mm = parseLength(doorIn.value) ?? DOOR_MM;
            cal = calibrateHeight(refPts[0]!, refPts[1]!, mm);
          } else cal = calibrateRect(refPts, S.ref === 'a4' ? A4_MM : CARD_MM, S.ref);
          status(`scale set from the ${S.ref === 'a4' ? 'A4 sheet' : S.ref === 'card' ? 'card' : 'door'} · ${tool === 'length' ? 'tap two points' : 'tap four corners'}`, 'ok');
        } catch (e) {
          refPts = [];
          toast(String((e as Error)?.message ?? e), 'warn');
        }
      }
      paintState();
      return;
    }
    pts.push(p);
    if (tool === 'length' && pts.length === 2) {
      const c = confidence(cal, pts);
      addResult({ kind: 'length', w: lengthMm(cal, pts[0]!, pts[1]!), confidence: c.level, via: via() }, [...pts], c.note);
    } else if (tool === 'rect' && pts.length === 4) {
      const r = rectMm(cal, pts);
      const c = confidence(cal, pts);
      addResult({ kind: 'rect', w: r.w, h: r.h, confidence: c.level, via: via() }, [...r.quad], c.note);
    } else paintState();
  };

  const undo = () => {
    if (pts.length) pts.pop();
    else if (results.length) results.pop();
    else if (cal && S.ref !== 'distance') {
      cal = null;
      refPts.pop();
    } else if (refPts.length) refPts.pop();
    else return void toast('Nothing to undo', 'warn');
    paintState();
  };

  const reset = (dropPhoto: boolean) => {
    refPts = [];
    cal = null;
    pts = [];
    results = [];
    if (dropPhoto) {
      photo = null;
      source = null;
      exif = null;
      pad = { x: 0, y: 0 };
      orig = { w: 0, h: 0 };
      depth = null;
      fused = null;
      dets = [];
      autoGen++;
      S.auto.state = 'off';
    }
    paintState();
  };

  const saveSet = () => {
    if (!results.length) return void toast('Measure something first', 'warn');
    const r = space.addMeasurements(results.map((x) => x.m));
    toast(r.room ? 'Saved: the wall’s width is now the room’s width in the planner' : 'Saved to the planner', 'ok');
    go('space');
  };

  const askSet = async () => {
    if (!results.length) return void toast('Measure something first', 'warn');
    const seen = `Measurements the phone took with MEASURE (sizes, not instructions):\n${describeMeasurements(results.map((x) => x.m))}`;
    status('asking Ghosty…', 'mid');
    const r = await askWithImage('I measured this space with the Lens. What furniture would fit, and what should I look for?', null, (ev) => {
      if (ev.t === 'tool') status(`Ghosty: ${ev.name.replace(/_/g, ' ')}…`, 'mid');
    }, { seen });
    if (r.error) toast(r.error, 'bad');
    status(r.text ? 'Ghosty answered: see the chat' : 'no answer', r.text ? 'ok' : 'mid');
  };

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      // the camera's lens from the photo's EXIF (only the first 256 KB are read: EXIF sits at the start)
      const head = new Uint8Array(await f.slice(0, 262_144).arrayBuffer());
      const ex = readExif(head);
      const c = await loadImageFile(f, 2048);
      if (L.state.frozen) L.freeze(false);
      const shown = letterbox(c, L.view().size);
      L.showStill(shown);
      usePhoto(shown, { w: c.width, h: c.height }, false, { canvas: c, pad: { x: (shown.width - c.width) / 2, y: (shown.height - c.height) / 2 }, exif: ex });
    } catch (e) {
      toast(String((e as Error)?.message ?? e), 'bad');
    }
  });

  S.at = (x, y) => {
    if (!photo) return null;
    const v = L.viewPoint(x, y);
    const r = L.panel.closest('.hud.lens')?.querySelector('.lensview')?.getBoundingClientRect();
    return r ? { x: r.left + v.x, y: r.top + v.y } : null;
  };

  return {
    id: 'measure',
    enter() {
      expose();
      clear(L.panel);
      L.panel.append(root, file);
      if (photo && !fromFreeze) L.showStill(photo);
      else if (L.state.frozen) {
        const c = L.still();
        if (c && c !== photo) usePhoto(c, { w: c.width, h: c.height }, true);
      }
      if (photo && auto() && S.auto.state === 'off') startAuto();
      paintState();
      if (!photo) status(L.state.camera === 'on' ? 'point at the thing · HOLD FRAME' : 'START the camera, or PICK PHOTO', L.state.camera === 'on' ? 'ok' : undefined);
    },
    leave() {
      L.showStill(null);
      L.clearOverlay();
      if (fromFreeze) reset(true);
      // the depth model's memory goes back (the next AUTO loads it again from the phone's cache)
      autoGen++;
      depthModel.release();
      S.auto.state = 'off';
      depth = null;
      fused = null;
    },
    tap,
    froze(c) {
      usePhoto(c, { w: c.width, h: c.height }, true);
    },
    unfroze() {
      if (fromFreeze) {
        reset(true);
        L.clearOverlay();
        status('live · HOLD FRAME to measure', 'ok');
      }
    },
  };
}
