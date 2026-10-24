/**
 * The SPACE PLANNER's FROM PHOTO panel: a plan from pictures, with real sizes.
 * - A photo (or scan) of a DRAWN OR PRINTED PLAN: the page is found and straightened (scan/page.ts),
 *   the writing read (Tesseract, vision/ocr.ts), then space/planphoto.ts finds the walls, rooms,
 *   doors and windows and takes the scale from the written sizes.
 * - Photos of THE ROOM ITSELF: the depth model (measure/autoscale.ts) gives metres for every pixel,
 *   space/roomphoto.ts finds the floor and the walls and gives the room's width and depth; a second
 *   photo a quarter turn round makes it surer.
 * Either way the result shows on its picture with how sure it is, and USE THIS PLAN puts it in the
 * planner (UNDO takes it back). A wrong length is put right by tapping that wall on the plan and
 * typing its real length: everything rescales (`rescaleWall`, space/planphoto.ts rescalePlan).
 * Everything stays on the phone. The state a test reads is at window.__ghosty.space.fromPhoto.
 */
import { clear, h } from '../../core/dom';
import { cmText } from '../../measure/geom';
import { scalePhoto } from '../../measure/autoscale';
import { allowDepthDownload, depthModel, depthNeedsAsking } from '../../measure/depth';
import { readExif } from '../../measure/exif';
import type { Cue } from '../../measure/cues';
import { enhance, findPageIn, quadArea, toGray, warpPage, type Quad } from '../../scan/page';
import { button, panel, toast } from '../../ui/components';
import { loadImageFile } from '../../vision/camera';
import { Reader } from '../../vision/ocr';
import type { Plan } from '../../space/plan';
import { linesFromWords, looksLikeDrawing, planFromDrawing, rescalePlan, type Gray, type PlanFromDrawing } from '../../space/planphoto';
import { cloudOf, findFloor, joinRoom, roomFromCloud, STANCE, withScaleDoubt, type RoomSize, type Seen } from '../../space/roomphoto';
import { space } from '../../space/store';
import type { DepthMap } from '../../measure/depth3d';
import type { Intrinsics } from '../../measure/exif';

type Kind = 'auto' | 'drawing' | 'room';

/** What FROM PHOTO did last, for tests (window.__ghosty.space.fromPhoto). */
export interface FromPhotoState {
  busy: boolean;
  kind: 'drawing' | 'room' | '';
  status: string;
  /** A drawn plan: rooms, doors, windows found, mm per picture pixel, the scale's doubt, whether it was guessed. */
  drawing: { rooms: number; doors: number; windows: number; mmPerPx: number; sigma: number; guessed: boolean; notes: string[]; read: string[] } | null;
  /** Photos of the room: its width and depth (cm) and their doubt. */
  room: (RoomSize & { photos: number; cues: string[] }) | null;
  applied: number;
  undo: number;
}

export const fromPhotoState: FromPhotoState = { busy: false, kind: '', status: '', drawing: null, room: null, applied: 0, undo: 0 };

const undoStack: Plan[] = [];
/** Remember the plan before a change made here (or a wall's length typed), for UNDO. */
export function rememberPlan(): void {
  undoStack.push(space.get().plan);
  if (undoStack.length > 6) undoStack.shift();
  fromPhotoState.undo = undoStack.length;
}

/**
 * The owner says wall `wall` of room `roomId` is really `cm` long: the whole plan is scaled to
 * match (rooms, doors, windows; furniture keeps its size). Returns the factor, or null.
 */
export function rescaleWall(roomId: string, wall: number, cm: number): number | null {
  const plan = space.get().plan;
  const got = rescalePlan(plan.rooms?.length ? plan : { ...plan, v: 2, rooms: [{ id: 'r1', name: 'Room', poly: [[0, 0], [plan.room.w, 0], [plan.room.w, plan.room.d], [0, plan.room.d]] }], openings: plan.openings ?? [] }, roomId, wall, cm);
  if (!got) return null;
  rememberPlan();
  space.setPlan(got.plan);
  return got.factor;
}

/**
 * The page flattened to its own shape: the shape its corners show in the photo, snapped to A4's or
 * US Letter's when within 5 % of one (a photo from a little off straight above shortens one side;
 * plans are mostly printed on those). The written sizes put right what is left, each way.
 */
function flatten(c: HTMLCanvasElement, q: Quad, long: number, clean = true): HTMLCanvasElement {
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const wide = (d(q[0], q[1]) + d(q[3], q[2])) / 2;
  const tall = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
  let ratio = Math.max(wide, tall) / Math.min(wide, tall);
  for (const paper of [297 / 210, 279.4 / 215.9]) if (Math.abs(ratio / paper - 1) <= 0.05) ratio = paper;
  const short = Math.round(long / ratio);
  const size = wide >= tall ? { w: long, h: short } : { w: short, h: long };
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('The picture could not be read');
  const px = warpPage(g.getImageData(0, 0, c.width, c.height), q, size.w, size.h);
  if (clean) enhance(px);
  const out = document.createElement('canvas');
  out.width = size.w;
  out.height = size.h;
  out.getContext('2d')?.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, size.w, size.h), 0, 0);
  return out;
}

/** The camera's focal length etc. in the depth map's own pixels. */
const mapK = (K: Intrinsics, D: DepthMap, size: { w: number; h: number }) => ({ f: (K.f * D.w) / size.w, cx: (K.cx * D.w) / size.w, cy: (K.cy * D.h) / size.h });

export function createFromPhotoPanel(onApplied: () => void): { el: HTMLElement } {
  const S = fromPhotoState;
  const fp = panel('FROM PHOTO', { status: 'plan · room', cls: 'spacefromphoto' });
  let kind: Kind = 'auto';
  let result: { plan?: Plan; size?: RoomSize } | null = null;
  const file = h('input', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': 'Pick photos of a floor plan or of the room' });
  file.hidden = true;
  const kindBtns = new Map<Kind, HTMLButtonElement>();
  const kinds = h('div.lenschips.spacephotokind');
  for (const [k, label] of [['auto', 'AUTO'], ['drawing', 'DRAWN PLAN'], ['room', 'THE ROOM']] as const) {
    const b = button(label, () => {
      kind = k;
      paint();
    });
    b.dataset.label = label.charAt(0) + label.slice(1).toLowerCase(); // route C: sentence case
    kindBtns.set(k, b);
    kinds.append(b);
  }
  const pickBtn = button('PICK PHOTOS', () => file.click(), 'on');
  const useBtn = button('USE THIS PLAN', () => use(), 'warn');
  const undoBtn = button('UNDO', () => undo());
  // the room's photos need the 50 MB distance model: one tap before the first download
  let waiting: File[] | null = null;
  const getBtn = button('DOWNLOAD 50 MB, ONCE', () => {
    allowDepthDownload();
    const f = waiting;
    waiting = null;
    getBtn.hidden = true;
    if (f) void run(f, true);
  }, 'on');
  getBtn.hidden = true;
  /** Photos picked while others are still being worked on wait their turn. */
  let queued: File[] | null = null;
  const preview = h('canvas.spacephotoview', { 'aria-label': 'What was found in the photo' });
  const notes = h('div.note.spacephotonotes');
  fp.body.append(
    h('div.row.wrap', pickBtn, undoBtn),
    kinds,
    preview,
    notes,
    h('div.row.wrap', useBtn, getBtn),
    h('div.note', 'A photo of a drawn or printed plan with its sizes written on gives every room, door and window. Photos of the room itself: stand with your back to a wall, phone at chest height, and take the opposite wall with a strip of floor; a second photo a quarter turn round makes it surer (the 0.5× lens sees more of a wide room). A wrong length? Tap that wall on the plan and type its real length: everything rescales. Nothing leaves the phone.'),
    file,
  );

  const status = (t: string, light?: 'ok' | 'mid' | 'off') => {
    S.status = t;
    fp.setStatus(t.length > 40 ? `${t.slice(0, 38)}…` : t, light);
    notes.textContent = t;
  };

  const paint = () => {
    for (const [k, b] of kindBtns) b.classList.toggle('on', k === kind);
    useBtn.hidden = !result;
    undoBtn.hidden = !undoStack.length;
    pickBtn.disabled = S.busy;
    S.undo = undoStack.length;
  };

  /** The picture with what was found drawn over it. */
  const show = (pic: HTMLCanvasElement, draw?: (g: CanvasRenderingContext2D, k: number) => void, angle = 0) => {
    const W = 320;
    const k = W / pic.width;
    preview.width = W;
    preview.height = Math.round(pic.height * k);
    const g = preview.getContext('2d');
    if (!g) return;
    g.save();
    g.translate(W / 2, preview.height / 2);
    g.rotate((angle * Math.PI) / 180);
    g.drawImage(pic, (-pic.width * k) / 2, (-pic.height * k) / 2, pic.width * k, pic.height * k);
    g.restore();
    draw?.(g, k);
  };

  const fromDrawing = async (f: File) => {
    const c = await loadImageFile(f, 2400);
    // a photo of a page: find it and flatten it; a scan or screenshot is used as it is
    const q = findPageIn(c);
    const share = q ? quadArea(q) / (c.width * c.height) : 0;
    const page = q && share > 0.2 && share < 0.97 ? flatten(c, q, 1800) : c;
    const g2 = page.getContext('2d', { willReadFrequently: true });
    if (!g2) throw new Error('The picture could not be read');
    const img: Gray = { w: page.width, h: page.height, g: toGray(g2.getImageData(0, 0, page.width, page.height).data, page.width, page.height) };
    status('reading the sizes written on the plan…', 'mid');
    const reader = new Reader();
    let words: Parameters<typeof linesFromWords>[0] = [];
    try {
      const r = await reader.read(page, (t, frac) => status(`reading the plan: ${t}${frac != null ? ` ${Math.round(frac * 100)}%` : ''}`, 'mid'));
      words = (r.words ?? []).filter((w) => w.bbox);
    } catch (e) {
      toast(`Could not read the writing (${String((e as Error)?.message ?? e).slice(0, 80)}): the scale will be a guess`, 'warn');
    } finally {
      reader.terminate();
    }
    status('finding the walls, rooms, doors and windows…', 'mid');
    // written sizes in feet and inches read with low confidence (the ' and " marks): keep words down to 30 %
    const lines = linesFromWords(words, 30);
    const res = planFromDrawing(img, lines);
    if ('error' in res) throw new Error(res.error);
    const r = res as PlanFromDrawing;
    const doors = (r.plan.openings ?? []).filter((o) => o.type === 'door').length;
    S.kind = 'drawing';
    S.drawing = { rooms: r.plan.rooms?.length ?? 0, doors, windows: (r.plan.openings?.length ?? 0) - doors, mmPerPx: r.mmPerPx, sigma: r.sigma, guessed: r.guessed, notes: r.notes, read: lines.map((l) => l.text) };
    S.room = null;
    result = { plan: r.plan };
    // the outlines are in the straightened picture's pixels: the picture is shown turned the same way
    show(page, (g, k) => {
      g.lineWidth = 2;
      g.strokeStyle = '#62e4ff';
      for (const poly of r.outlines) {
        g.beginPath();
        poly.forEach((p, i) => (i ? g.lineTo(p[0] * k, p[1] * k) : g.moveTo(p[0] * k, p[1] * k)));
        g.closePath();
        g.stroke();
      }
    }, r.angle);
    const sure = r.guessed ? 'scale guessed: type one wall’s real length' : `scale ±${Math.max(1, Math.round((Math.exp(r.sigma) - 1) * 100))} %`;
    status(`${r.notes.join(' ')} (${sure}) USE THIS PLAN puts it in the planner.`, r.guessed ? 'mid' : 'ok');
  };

  const fromRoom = async (files: File[]) => {
    const seen: Seen[] = [];
    const used = new Set<string>();
    let first: HTMLCanvasElement | null = null;
    try {
      for (const [i, f] of files.slice(0, 4).entries()) {
        const ex = readExif(new Uint8Array(await f.slice(0, 262_144).arrayBuffer()));
        const c = await loadImageFile(f, 1280);
        first ??= c;
        const size = { w: c.width, h: c.height };
        const got = await scalePhoto(c, ex, (t) => status(`photo ${i + 1} of ${Math.min(4, files.length)}: ${t}`, 'mid'), {
          // the phone's height above the floor: a weak cue when nothing of known size is in view
          extra: (D0, K): Cue[] => {
            const fl = findFloor(cloudOf(D0, mapK(K, D0, size), 4));
            return fl && fl.height > 0.4 && fl.height < 3 ? [{ name: 'the phone at chest height (about 1.3 m)', scale: STANCE.height / fl.height, sigma: STANCE.heightSigma, weak: true }] : [];
          },
        });
        for (const u of got.fused.used) used.add(u);
        const s = roomFromCloud(cloudOf(got.D, mapK(got.K, got.D, size), 3));
        if ('error' in s) {
          toast(`Photo ${i + 1}: ${s.error}`, 'warn');
          continue;
        }
        // the scale's own doubt, and the depth model's shape error, widen every size
        seen.push(withScaleDoubt(s, got.fused.sigma));
      }
    } finally {
      depthModel.release();
    }
    const size = joinRoom(seen);
    if (!size) throw new Error('No walls could be measured in those photos: see the tips below');
    S.kind = 'room';
    S.room = { ...size, photos: seen.length, cues: [...used] };
    S.drawing = null;
    result = { size };
    if (first) {
      show(first, (g) => {
        const W = preview.width;
        const H = preview.height;
        const k = Math.min((W - 40) / size.w, (H - 40) / size.d);
        const x = (W - size.w * k) / 2;
        const y = (H - size.d * k) / 2;
        g.fillStyle = 'rgba(2,7,13,.6)';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = '#62e4ff';
        g.lineWidth = 3;
        g.strokeRect(x, y, size.w * k, size.d * k);
        g.fillStyle = '#62e4ff';
        g.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
        g.fillText(`${cmText(size.w * 10)} ±${size.wSd} cm`, x + 4, y - 6);
        g.fillText(`${cmText(size.d * 10)} ±${size.dSd} cm`, x + 4, y + size.d * k + 16);
      });
    }
    status(`The room: ${cmText(size.w * 10)} × ${cmText(size.d * 10)} (±${size.wSd} × ±${size.dSd} cm) from ${seen.length} photo${seen.length === 1 ? '' : 's'}; scale from ${used.size ? [...used].join(', ') : 'the depth alone'}.${size.notes.length ? ` Note: ${size.notes.join('; ')}.` : ''} Doors and windows are not found from room photos: add them on the plan.`, 'ok');
  };

  const run = async (files: File[], asked = false): Promise<void> => {
    if (!files.length) return;
    if (S.busy) {
      queued = files;
      status('Still working on the last photos: these are next.', 'mid');
      return;
    }
    S.busy = true;
    result = null;
    paint();
    try {
      let k: Kind = kind;
      if (k === 'auto') {
        // a drawing, or a page with one on it (looked at flattened), is a plan; anything else is the room
        const c0 = await loadImageFile(files[0]!, 800);
        const q = findPageIn(c0);
        const share = q ? quadArea(q) / (c0.width * c0.height) : 0;
        const c = q && share > 0.2 && share < 0.97 ? flatten(c0, q, 600, false) : c0;
        const g = c.getContext('2d', { willReadFrequently: true });
        k = g && looksLikeDrawing({ w: c.width, h: c.height, g: toGray(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height) }) ? 'drawing' : 'room';
      }
      if (k === 'drawing') await fromDrawing(files[0]!);
      else if (!asked && (await depthNeedsAsking())) {
        waiting = files;
        getBtn.hidden = false;
        status('Photos of the room need a 50 MB distance model, downloaded once and kept on the phone (Wi-Fi is best): DOWNLOAD to go on.', 'mid');
      } else await fromRoom(files);
    } catch (e) {
      status(String((e as Error)?.message ?? e), 'off');
    } finally {
      S.busy = false;
      paint();
      const next = queued;
      queued = null;
      if (next) void run(next);
    }
  };

  const use = () => {
    if (!result) return;
    rememberPlan();
    if (result.plan) {
      // the found plan, empty: furniture placed for the old rooms would land anywhere in the new ones (UNDO brings it back)
      const had = space.get().plan.items.length;
      space.setPlan(result.plan);
      if (had) toast('The furniture was taken off for the new rooms: UNDO brings it back', 'warn');
    } else if (result.size) {
      try {
        space.setRoom({ w: result.size.w, d: result.size.d });
      } catch (e) {
        undoStack.pop();
        return void toast(String((e as Error)?.message ?? e), 'warn');
      }
    }
    S.applied++;
    result = null;
    toast('Plan updated from the photo', 'ok');
    paint();
    onApplied();
  };

  const undo = () => {
    const prev = undoStack.pop();
    if (!prev) return void toast('Nothing to undo', 'warn');
    space.setPlan(prev);
    toast('Back to the plan before', 'ok');
    paint();
    onApplied();
  };

  file.addEventListener('change', () => {
    const files = [...(file.files ?? [])];
    file.value = '';
    void run(files);
  });

  paint();
  status('PICK PHOTOS: a drawn plan, or the room itself.');
  return { el: fp.el };
}
