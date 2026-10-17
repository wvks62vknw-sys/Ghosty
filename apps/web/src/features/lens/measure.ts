/**
 * MEASURE: real sizes from a picture. Hold a frame (or PICK PHOTO), tell MEASURE the scale — tap
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
import { loadImageFile } from '../../vision/camera';
import { bothText, calibrateDistance, calibrateHeight, calibrateRect, CARD_MM, A4_MM, cmText, confidence, describeMeasurements, DOOR_MM, ftInText, lengthMm, parseLength, rectMm, type Calibration, type Measurement, type Pt, type RefKind } from '../../measure/geom';
import { space } from '../../space/store';
import type { LensContext, Mode } from './index';

type Tool = 'length' | 'rect';

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
  results: { kind: Measurement['kind']; w: number; h?: number; confidence: string; text: string }[];
  status: string;
  /** The picture being measured (pixels), when there is one. */
  frame: { w: number; h: number } | null;
  /** Where a picture pixel is on the page (client pixels), for a test's taps. */
  at?: (x: number, y: number) => { x: number; y: number } | null;
}

export const measureState: MeasureState = { ref: 'card', refPoints: 0, calibrated: false, tool: 'length', points: 0, results: [], status: '', frame: null };

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
  let fromFreeze = false;
  let refPts: Pt[] = [];
  let cal: Calibration | null = null;
  let tool: Tool = 'length';
  let pts: Pt[] = [];
  let results: Result[] = [];

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

  // ---- what to measure
  const lenBtn = button('LENGTH · 2 TAPS', () => setTool('length'));
  const rectBtn = button('WALL · 4 CORNERS', () => setTool('rect'));
  const toolRow = h('div.lenschips.meastools', lenBtn, rectBtn);

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
    doorRow,
    distRow,
    h('div.lab', '2 · MEASURE'),
    toolRow,
    guide,
    list,
    h('div.row.wrap', undoBtn, clearBtn, saveBtn, askBtn),
    h('div.note', 'Exact for things on the same flat surface as the card or sheet (a card on the wall measures that wall). A door or a distance gives estimates for a wall seen square on. Nothing leaves the phone unless you press ASK GHOSTY.'),
  );

  const refDef = () => REFS.find((r) => r.id === S.ref)!;
  const via = (): string => (S.ref === 'card' ? 'bank card' : S.ref === 'a4' ? 'A4 sheet' : S.ref === 'door' ? `door ${Math.round(parseLength(doorIn.value) ?? DOOR_MM)} mm` : `distance ${distIn.value.trim()} m`);

  const paintState = () => {
    S.refPoints = refPts.length;
    S.calibrated = !!cal;
    S.tool = tool;
    S.points = pts.length;
    S.frame = photo ? { w: photo.width, h: photo.height } : null;
    S.results = results.map((r) => ({ kind: r.m.kind, w: r.m.w, h: r.m.h, confidence: r.m.confidence, text: r.m.kind === 'rect' ? `${cmText(r.m.w)} × ${cmText(r.m.h ?? 0)}` : cmText(r.m.w) }));
    for (const [id, b] of refBtns) b.classList.toggle('on', id === S.ref);
    doorRow.hidden = S.ref !== 'door';
    distRow.hidden = S.ref !== 'distance';
    lenBtn.classList.toggle('on', tool === 'length');
    rectBtn.classList.toggle('on', tool === 'rect');
    clear(list);
    results.forEach((r, i) => {
      const m = r.m;
      const big = m.kind === 'rect' ? `${cmText(m.w)} × ${cmText(m.h ?? 0)}` : cmText(m.w);
      const imp = m.kind === 'rect' ? `${ftInText(m.w)} × ${ftInText(m.h ?? 0)}` : ftInText(m.w);
      list.append(h(`div.measrow.${m.confidence}` as 'div', h('b', `${i + 1}`), h('span.measv', big), h('span.measi', imp), h('small', `${m.confidence.toUpperCase()} · ${r.note}`)));
    });
    // what to do next, in one line
    let next = '';
    if (!photo) next = 'HOLD FRAME (or tap the picture) or PICK PHOTO: a still to measure on.';
    else if (!cal) next = refDef().taps ? `Scale: ${refDef().hint} (${refPts.length} of ${refDef().taps}).` : 'Scale: type the distance to the wall, then SET.';
    else next = tool === 'length' ? `Tap two points (${pts.length} of 2).` : `Tap the wall’s four corners (${pts.length} of 4).`;
    guide.textContent = next;
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
    if (r === 'distance' && photo && parseLength(distIn.value, 'auto')) setDistance();
    paintState();
    if (photo) status(r === 'distance' ? 'type the distance to the wall' : refDef().hint, 'mid');
  };
  const setTool = (t: Tool) => {
    tool = t;
    pts = [];
    paintState();
  };
  const setDistance = () => {
    const mm = parseLength(distIn.value, 'auto');
    if (!mm) return void toast('Type the distance to the wall, e.g. 2.5 (metres)', 'warn');
    if (!photo) return void toast('HOLD FRAME or PICK PHOTO first', 'warn');
    cal = calibrateDistance(mm, orig.w ? orig : { w: photo.width, h: photo.height });
    S.ref = 'distance';
    paintState();
    status(`scale set from ${bothText(mm)} away · ${tool === 'length' ? 'tap two points' : 'tap four corners'}`, 'ok');
  };

  const usePhoto = (c: HTMLCanvasElement, real: { w: number; h: number }, frozen: boolean) => {
    photo = c;
    orig = real;
    fromFreeze = frozen;
    refPts = [];
    cal = null;
    pts = [];
    if (S.ref === 'distance' && parseLength(distIn.value, 'auto')) setDistance();
    paintState();
    status(S.ref === 'distance' ? 'type the distance to the wall, then SET' : refDef().hint, 'mid');
  };

  const addResult = (m: Measurement, at: Pt[], note: string) => {
    results.push({ m, pts: at, note });
    pts = [];
    const v = m.kind === 'rect' ? `${bothText(m.w)} × ${bothText(m.h ?? 0)}` : bothText(m.w);
    paintState();
    status(`${v} · ${m.confidence}`, m.confidence === 'rough' ? 'mid' : 'ok');
  };

  const tap = (x: number, y: number) => {
    if (!photo) {
      // a tap on the live picture holds it, and counts
      if (L.state.camera !== 'on') return void toast('START the camera, or PICK PHOTO', 'warn');
      L.freeze(true);
      if (!photo) return;
    }
    const p = { x: Math.max(0, Math.min(photo.width, x)), y: Math.max(0, Math.min(photo.height, y)) };
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
      orig = { w: 0, h: 0 };
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
      const c = await loadImageFile(f, 2048);
      if (L.state.frozen) L.freeze(false);
      const shown = letterbox(c, L.view().size);
      L.showStill(shown);
      usePhoto(shown, { w: c.width, h: c.height }, false);
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
      paintState();
      if (!photo) status(L.state.camera === 'on' ? 'point at the wall · HOLD FRAME' : 'START the camera, or PICK PHOTO', L.state.camera === 'on' ? 'ok' : undefined);
    },
    leave() {
      L.showStill(null);
      L.clearOverlay();
      if (fromFreeze) reset(true);
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
