/**
 * LENS tab: the phone's camera with its modes — SEE (what is in view, boxed and counted), READ
 * (text in a picture, into the library), HANDS (gestures that drive the Lens), ASK (a
 * question with a picture for Ghosty), NAME (the closest of thousands of names, name.ts) and PEOPLE (people.ts: the owner,
 * enrolled by himself, and people he introduces in person — on this phone only). Everything runs on the phone; nothing
 * leaves it until the owner presses ASK GHOSTY or shares a crop for a picture search, and a face never leaves it at all.
 * Faces only in PEOPLE (never in NAME, PHOTO TOOLS or a picture); a number plate is looked up only from READ's chip, on a
 * tap (ui/vehiclecheck.ts): Ghosty never identifies anyone else.
 *
 * The modes live in see.ts, read.ts, hands.ts and ask.ts; crop.ts is the picture-search sheet;
 * photo.ts is PHOTO TOOLS (background, sharper, erase), the bar's chip once a photo is on screen.
 * This file owns the viewfinder (video + overlay canvas), the mode tiles, the bottom bar, the
 * frame loop and the state a test can read at window.__ghosty.lens. The camera opens from the
 * owner's own tap (the START button, a tap that brought the tab up), never on its own: not on a
 * reload that lands on #lens, and not because the brain called open_lens.
 */
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { onFrame } from '../../engine/scheduler';
import { go, type TabDef } from '../../shell/tabs';
import { ui } from '../../state/app';
import { button, toast, type Light } from '../../ui/components';
import { askWithImage, type AskResult } from '../../vision/ask';
import { coverTransform, sceneLine, toFrame, toView, type Box, type Category, type Detection, type Size, type Transform } from '../../vision/boxes';
import { Camera, cameraMessage, cameraSupported, drawScaled, type Facing } from '../../vision/camera';
import { namesLine, type NameGuess } from '../../vision/clipmath';
import { forgetImage, shareImage } from '../../vision/engines';
import { closeAll } from '../../vision/models';
import { Reader } from '../../vision/ocr';
import { createAimMode } from './aim';
import { createAskMode } from './ask';
import { openCrop } from './crop';
import { createHandsMode } from './hands';
import type { LensCard } from './living';
import { createMeasureMode } from './measure';
import { createNameMode } from './name';
import { createPeopleMode, peopleState } from './people'; // [guardian] PEOPLE: his face and the people he introduces (OWNER-ISSUES 55, 56)
import { faces } from '../../vision/faces';
import type { MarkState } from './mark';
import { openPhotoTools } from './photo';
import { createReadMode } from './read';
import { createSeeMode } from './see';
import { createScanMode } from './scan';
import { createSoundMode } from './sound';

// (the modes and their tiles: a pure list the ABILITIES catalogue reads too)
import { LENS_MODES, TILES, type LensMode } from './tiles';
export { LENS_MODES, TILES, type LensMode };

/** What the Lens is doing, readable by a test at window.__ghosty.lens (and by describe() for Ghosty). */
export interface LensState {
  mode: LensMode;
  status: string;
  camera: 'off' | 'starting' | 'on' | 'error';
  facing: Facing;
  frozen: boolean;
  /** Detector runs a second (SEE) or recogniser runs a second (HANDS). */
  fps: number;
  detections: Detection[];
  scene: Category[];
  /** NAME's closest names for the picture (share 0–1), best first. */
  names: NameGuess[];
  /** How long NAME's last look took, in ms (kept off the status line, which says what it is doing in words). */
  lookMs?: number;
  counts: string;
  selected: number;
  ocrText: string;
  ocrConfidence: number;
  gesture: string;
  hand: string;
  lastAction: string;
  reply: string;
  /** NAME IT's or WHAT'S IN IT's card (living.ts): what it is and its words. */
  card: LensCard;
  error: string;
  /** MARK MY WORK (READ's MARK chip): what it is doing and the last result (mark.ts). */
  mark?: MarkState;
  setMode?: (m: LensMode) => void;
}

export interface ModeOpts {
  /** A picture to work on (a crop from SEE, a photo for READ, the picture ASK sends). */
  still?: HTMLCanvasElement;
  /** Capture a still from the camera on entering (HANDS → READ). */
  capture?: boolean;
  question?: string;
  /** Scanned text to ask about (sent as text, not a picture). */
  text?: string;
  /** Send straight away. */
  send?: boolean;
  /** SCAN's part to open on: CODE, DOCUMENT or TRANSLATE (the deck's "Translate a sign or a menu"). */
  sub?: 'code' | 'document' | 'translate';
}

export interface Mode {
  id: LensMode;
  enter(opts?: ModeOpts): void;
  leave(): void;
  /** Every animation frame while the camera is on and the tab is showing. */
  tick?(now: number): void;
  /** A tap on the viewfinder, in frame pixels. */
  tap?(x: number, y: number): void;
  /** The picture was just frozen (the held frame). */
  froze?(still: HTMLCanvasElement): void;
  /** The held frame was let go of. */
  unfroze?(): void;
}

/** What every mode gets to work with. */
export interface LensContext {
  state: LensState;
  camera: Camera;
  video: HTMLVideoElement;
  reader: Reader;
  /** The mode's own area under the tiles (cleared when the mode changes). */
  panel: HTMLElement;
  status(text: string, light?: Light): void;
  /** The small lines over the viewfinder: the scene (left) and the counts (right). */
  lines(scene: string, counts: string): void;
  /** The picture on screen (a still, or the live frame) and how it maps onto the viewfinder. */
  view(): { frame: Size; size: Size; t: Transform; mirror: boolean };
  /** The overlay's drawing context in CSS pixels, cleared first. */
  overlay(): CanvasRenderingContext2D | null;
  clearOverlay(): void;
  /** Bring a result the owner just asked for into view (on a phone the Lens scrolls as one page, and the tab bar covers its foot). */
  reveal(el: HTMLElement): void;
  /** Frame pixels → viewfinder pixels (mirrored for the front camera). */
  viewBox(b: Box): Box;
  viewPoint(x: number, y: number): { x: number; y: number };
  drawBox(b: Box, label: string, opts?: { on?: boolean; color?: string }): void;
  /** Show a still over the live video (null: the live video again). */
  showStill(c: HTMLCanvasElement | null): void;
  freeze(on: boolean): void;
  /** The held frame, or a capture now (at most `maxSide` px on the long side; 0 = full size). */
  still(maxSide?: number): HTMLCanvasElement | null;
  setMode(m: LensMode, opts?: ModeOpts): void;
  saveNote(title: string, text: string, kind?: 'scan' | 'note'): Promise<boolean>;
  ask(message: string, dataUrl: string | null): Promise<AskResult>;
  /** The picture-search sheet: crop, share through the brain, open an engine. */
  search(still: HTMLCanvasElement, rect?: Box): void;
  startCamera(): Promise<void>;
  stopCamera(): void;
  flip(): Promise<void>;
  active(): boolean;
}

export const lensState: LensState = {
  mode: 'see',
  status: '',
  camera: 'off',
  facing: 'environment',
  frozen: false,
  fps: 0,
  detections: [],
  scene: [],
  names: [],
  counts: '',
  selected: -1,
  ocrText: '',
  ocrConfidence: 0,
  gesture: '',
  hand: '',
  lastAction: '',
  reply: '',
  card: { what: '', text: '' },
  error: '',
};

/** The state object sits on the console/test handle (window.__ghosty.lens); main.ts makes __ghosty after the first tab opens, so this retries. */
function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => {
    if (!w.__ghosty) return false;
    w.__ghosty.lens = lensState;
    // PEOPLE's state and the face engine (whose only way in is the live camera), for the specs
    w.__ghosty.people = peopleState;
    w.__ghosty.faces = faces;
    // the chat's own way in (assistant/session.ts send), with the Lens still open: what he types or says in the chat
    w.__ghosty.send = (t: string, voice = false) => import('../../assistant/session').then((m) => m.send(t, { voice }));
    return true;
  };
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

let controller: { setMode(m: LensMode, opts?: ModeOpts): void } | null = null;

/** What openLens asked for, taken by the tab's enter() so the first mode entered is that one (only its models load). */
let wanted: { mode: LensMode; opts?: ModeOpts; start: boolean } | null = null;

/** True for a few seconds after the owner's own tap or key press: the only time the camera opens on entering the tab. */
const recentTap = (): boolean => !!navigator.userActivation?.isActive;

/**
 * Open the Lens in a mode (the `open_lens` client command: "read this document" → open_lens read).
 * `start` opens the camera too; only a button the owner tapped may pass it — the brain's open_lens
 * never does, so a command in a model reply switches the screen but cannot switch the camera on.
 */
export function openLens(mode?: string, question?: string, start = false): void {
  const want = String(mode ?? '').toLowerCase();
  // SCAN's three parts may be named on their own ("translate" opens SCAN on TRANSLATE).
  const sub = want === 'translate' || want === 'document' || want === 'code' ? want : undefined;
  const m = sub ? 'scan' : LENS_MODES.find((x) => x === want) ?? (question ? 'ask' : 'see');
  const opts: ModeOpts | undefined = question ? { question } : sub ? { sub } : undefined;
  wanted = { mode: m, opts, start };
  go('lens');
  if (wanted) {
    // the tab was already showing (enter() did not run): switch mode now
    wanted = null;
    controller?.setMode(m, opts);
  }
}

export const lensTab: TabDef = {
  id: 'lens',
  title: 'LENS',
  icon: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  scene: 'backdrop',
  blurb: 'camera · see · read · hands · ask · name · scan · aim · measure · sound',
  mount(root) {
    const S = lensState;
    const camera = new Camera(h('video.lensvideo'));
    const video = camera.video;
    const still = h('canvas.lensstill');
    still.hidden = true;
    let ov = h('canvas.lensov');
    const light = h('i');
    const statusText = h('span');
    const statusEl = h('div.lensstatus', light, statusText);
    const sceneEl = h('div.lensscene');
    const countEl = h('div.lenscount');
    // The viewfinder with no picture in it says why and what to do, in full (the status pill cuts a long reason short).
    const emptyTitle = h('b');
    const emptyText = h('span');
    const empty = h('div.lensempty', emptyTitle, emptyText);
    const view = h('div.lensview', video, still, ov, empty, statusEl, sceneEl, countEl);
    const panel = h('div.lenspanel');
    const privacy = h('div.lensprivacy', 'Runs on your phone. Faces only in PEOPLE: you, and people you introduce here — kept on this phone, never anyone else. A number plate is looked up only when you tap CHECK, never who owns the car.');
    const reader = new Reader();

    // ---- the viewfinder's size, the overlay's pixels and the frame → view mapping
    let viewSize: Size = { w: 0, h: 0 };
    let shown: HTMLCanvasElement | null = null;
    let frozenStill: HTMLCanvasElement | null = null;
    /** Bumped by every start and stop: a start still waiting on the browser stands down if a stop came meanwhile. */
    let cameraGen = 0;
    const dpr = () => Math.min(2, window.devicePixelRatio || 1);
    const fit = () => {
      viewSize = { w: view.clientWidth, h: view.clientHeight };
      const k = dpr();
      const w = Math.round(viewSize.w * k);
      const hh = Math.round(viewSize.h * k);
      if (ov.width !== w || ov.height !== hh) {
        ov.width = w;
        ov.height = hh;
      }
    };
    new ResizeObserver(fit).observe(view);
    const frameSize = (): Size => (shown ? { w: shown.width, h: shown.height } : camera.size);
    const mirror = () => !shown && camera.facing === 'user';
    const L: LensContext = {
      state: S,
      camera,
      video,
      reader,
      panel,
      status(text, lightKind) {
        S.status = text;
        statusText.textContent = text;
        light.className = lightKind ?? '';
      },
      lines(scene, counts) {
        sceneEl.textContent = scene;
        countEl.textContent = counts;
      },
      view() {
        if (!viewSize.w) fit();
        const frame = frameSize();
        return { frame, size: viewSize, t: coverTransform(frame, viewSize), mirror: mirror() };
      },
      overlay() {
        const c = ov.getContext('2d');
        if (!c) return null;
        const k = dpr();
        c.setTransform(k, 0, 0, k, 0, 0);
        c.clearRect(0, 0, viewSize.w, viewSize.h);
        return c;
      },
      clearOverlay() {
        // A fresh canvas, not clearRect: after AIM's labels Chromium kept showing them through every clear.
        const fresh = h('canvas.lensov');
        fresh.width = ov.width;
        fresh.height = ov.height;
        ov.replaceWith(fresh);
        ov = fresh;
      },
      reveal(el) {
        requestAnimationFrame(() => el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }));
      },
      viewBox(b) {
        const { t, size } = L.view();
        const v = toView(b, t);
        return mirror() ? { ...v, x: size.w - v.x - v.w } : v;
      },
      viewPoint(x, y) {
        const { t, size } = L.view();
        const p = toView({ x, y, w: 0, h: 0 }, t);
        return { x: mirror() ? size.w - p.x : p.x, y: p.y };
      },
      drawBox(b, label, opts = {}) {
        const c = ov.getContext('2d');
        if (!c) return;
        const v = L.viewBox(b);
        const color = opts.color ?? (opts.on ? '#ffb23e' : '#62e4ff');
        c.lineWidth = opts.on ? 2.5 : 1.5;
        c.strokeStyle = color;
        c.strokeRect(v.x, v.y, v.w, v.h);
        if (label) {
          c.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
          const tw = c.measureText(label).width + 10;
          const ty = v.y >= 18 ? v.y - 18 : v.y + 2;
          c.fillStyle = 'rgba(2, 7, 13, .78)';
          c.fillRect(v.x, ty, tw, 16);
          c.fillStyle = color;
          c.fillText(label, v.x + 5, ty + 12);
        }
      },
      showStill(c) {
        // null means the usual view: the held frame while frozen, else the live video
        const pic = c ?? frozenStill;
        shown = pic;
        if (pic) {
          still.width = pic.width;
          still.height = pic.height;
          still.getContext('2d')?.drawImage(pic, 0, 0);
          still.hidden = false;
        } else still.hidden = true;
        // PHOTO TOOLS is offered once there is a photo on screen: a held frame, a picked photo, ASK's still
        photoBtn.hidden = !pic;
        syncEmpty();
        video.classList.toggle('mirror', mirror());
      },
      freeze(on) {
        if (on) {
          const c = frozenStill ?? camera.capture();
          if (!c) return void toast('Nothing to freeze: the camera is off', 'warn');
          frozenStill = c;
          S.frozen = true;
          L.showStill(c);
          freezeBtn.textContent = 'UNFREEZE';
          freezeBtn.classList.add('on');
          syncBar();
          mode?.froze?.(c);
          L.status('frozen · tap a box or an action', 'mid');
        } else {
          // the held frame goes; a mode's own still (READ's picture, ASK's crop) stays on screen
          const held = shown === frozenStill;
          frozenStill = null;
          S.frozen = false;
          if (held) L.showStill(null);
          freezeBtn.textContent = 'FREEZE';
          freezeBtn.classList.remove('on');
          syncBar();
          mode?.unfroze?.();
          L.status(camera.on ? 'live' : S.status, camera.on ? 'ok' : undefined);
        }
      },
      still(maxSide = 0) {
        if (frozenStill) return maxSide > 0 && Math.max(frozenStill.width, frozenStill.height) > maxSide ? drawScaled(frozenStill, { w: frozenStill.width, h: frozenStill.height }, maxSide) : frozenStill;
        return camera.capture(maxSide);
      },
      setMode(m, opts) {
        setMode(m, opts);
      },
      async saveNote(title, text, kind = 'note') {
        try {
          const r = await fetch('/api/library/text', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify({ title, text, kind, source: 'Lens' }), credentials: 'same-origin' });
          const j = (await r.json().catch(() => ({}))) as { title?: string; error?: string };
          if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
          S.lastAction = `saved: ${j.title ?? title}`;
          toast(`Saved to the library: ${j.title ?? title}`, 'ok');
          return true;
        } catch (e) {
          toast(`Could not save it: ${String((e as Error)?.message ?? e)}`, 'bad');
          return false;
        }
      },
      ask: (message, dataUrl) => askWithImage(message, dataUrl, (ev) => {
        if (ev.t === 'tool') L.status(`Ghosty: ${ev.name.replace(/_/g, ' ')}…`, 'mid');
      }),
      search(src, rect) {
        S.lastAction = 'search';
        openCrop(src, {
          rect,
          share: (blob) => shareImage(blob, { fetch: (u, i) => fetch(u, i), headers }),
          forget: (id) => forgetImage(id, { fetch: (u, i) => fetch(u, i), headers }),
        });
      },
      async startCamera() {
        if (S.camera === 'starting') return;
        S.error = '';
        if (!cameraSupported()) {
          S.camera = 'error';
          S.error = 'This browser cannot open the camera';
          L.status(`${S.error} · READ can still pick a photo`, 'off');
          syncBar();
          return;
        }
        S.camera = 'starting';
        const gen = ++cameraGen;
        // STOP from the first moment: a second tap on a START still showing while the camera opens used to stop it
        startBtn.textContent = 'STOP';
        syncBar();
        L.status('opening the camera…', 'mid');
        try {
          await camera.start(S.facing);
          // STOP was pressed, or the Lens left, while the browser was opening the camera: it is off (camera.ts let the stream go)
          if (gen !== cameraGen) return;
          S.camera = 'on';
          S.facing = camera.facing;
          video.classList.toggle('mirror', mirror());
          torchBtn.hidden = !camera.torchAvailable;
          startBtn.textContent = 'STOP';
          syncBar();
          L.status('live', 'ok');
        } catch (e) {
          if (gen !== cameraGen) return;
          S.camera = 'error';
          S.error = cameraMessage(e);
          startBtn.textContent = 'START';
          syncBar();
          L.status(S.error, 'off');
          toast(S.error, 'warn');
        }
      },
      stopCamera() {
        cameraGen++;
        camera.stop();
        if (S.frozen) L.freeze(false);
        S.camera = 'off';
        S.fps = 0;
        startBtn.textContent = 'START';
        syncBar();
        torchBtn.hidden = true;
        torchBtn.classList.remove('on');
        L.clearOverlay();
        L.lines('', '');
        L.status('camera off · START to open it', undefined);
      },
      async flip() {
        if (S.camera !== 'on') return;
        S.facing = S.facing === 'environment' ? 'user' : 'environment';
        if (S.frozen) L.freeze(false);
        await L.startCamera();
        S.lastAction = `flipped to the ${S.facing === 'user' ? 'front' : 'rear'} camera`;
      },
      active: () => ui.get().tab === 'lens' && !document.hidden,
    };

    // ---- modes
    const modes: Record<LensMode, Mode> = { see: createSeeMode(L), read: createReadMode(L), hands: createHandsMode(L), ask: createAskMode(L), name: createNameMode(L), people: createPeopleMode(L), scan: createScanMode(L), aim: createAimMode(L), measure: createMeasureMode(L), sound: createSoundMode(L) };
    let mode: Mode | null = null;
    const tiles = h('div.lensmodes');
    const tileBtns = new Map<LensMode, HTMLButtonElement>();
    for (const t of TILES) {
      const b = button(h('span', t.label), () => setMode(t.id), '');
      b.append(h('small', t.hint));
      b.setAttribute('aria-label', `${t.label}: ${t.hint}`);
      tileBtns.set(t.id, b);
      tiles.append(b);
    }
    const setMode = (m: LensMode, opts?: ModeOpts) => {
      if (mode?.id !== m) {
        mode?.leave();
        clear(panel);
        L.clearOverlay();
        L.lines('', '');
        if (shown) L.showStill(null);
        S.mode = m;
        S.selected = -1;
        // SOUND switches the camera off and listens: the camera's START / FLIP / FREEZE mean nothing there (START reopened it)
        bar.hidden = m === 'sound';
        for (const [id, b] of tileBtns) b.classList.toggle('on', id === m);
        mode = modes[m];
        syncEmpty();
        // the last mode's line ("8 words · 95% sure", "LISTEN: …") does not belong here: the camera's own, until this mode says more
        cameraLine();
      }
      showTile(m);
      mode.enter(opts);
    };
    /** The mode in use stays in sight: the row scrolls sideways, and AIM, MEASURE and SOUND start past its right edge (under its fade). */
    const showTile = (m: LensMode) =>
      requestAnimationFrame(() => {
        const b = tileBtns.get(m);
        if (!b) return;
        const r = b.getBoundingClientRect();
        const row = tiles.getBoundingClientRect();
        if (!row.width || (r.left >= row.left && r.right <= row.right - 28)) return;
        tiles.scrollTo({ left: tiles.scrollLeft + r.left - row.left - (row.width - r.width) / 2, behavior: 'smooth' });
      });
    S.setMode = (m) => setMode(m);

    // ---- bottom bar: thumb-reachable, 44 px targets
    const startBtn = button('START', () => (S.camera === 'on' || S.camera === 'starting' ? L.stopCamera() : void L.startCamera()));
    const flipBtn = button('FLIP', () => void L.flip());
    const freezeBtn = button('FREEZE', () => L.freeze(!S.frozen));
    const torchBtn = button('TORCH', async (b) => {
      const on = !b.classList.contains('on');
      if (await camera.torch(on)) b.classList.toggle('on', on);
      else toast('No torch on this camera', 'warn');
    });
    torchBtn.hidden = true;
    /** FLIP and FREEZE need a live camera: dimmed until it is on (FLIP with the camera off did nothing at all), FREEZE kept while a frame is held. */
    const syncBar = () => {
      flipBtn.disabled = S.camera !== 'on';
      freezeBtn.disabled = S.camera !== 'on' && !S.frozen;
      syncEmpty();
    };
    /** The status line for the camera alone: what a mode shows until it has something of its own to say. */
    const cameraLine = () => {
      if (S.camera === 'on') L.status(S.frozen ? 'frozen · tap a box or an action' : 'live', S.frozen ? 'mid' : 'ok');
      else if (S.camera === 'starting') L.status('opening the camera…', 'mid');
      else if (S.camera === 'error') L.status(S.error, 'off');
      else L.status('camera off · START to open it', undefined);
    };
    /** No live picture and no still: say so in the viewfinder (AIM and SOUND draw their own there). */
    const syncEmpty = () => {
      const blank = S.camera !== 'on' && !shown && S.mode !== 'aim' && S.mode !== 'sound';
      empty.hidden = !blank;
      if (!blank) return;
      const photo = ['read', 'name', 'scan', 'measure'].includes(S.mode) ? ' Or PICK PHOTO below to use one from your phone.' : '';
      emptyTitle.textContent = S.camera === 'starting' ? 'Opening the camera…' : S.camera === 'error' ? 'The camera did not open' : 'Camera off';
      emptyText.textContent = S.camera === 'starting' ? '' : S.camera === 'error' ? `${S.error}.${photo}` : `Tap START to look through it.${photo}`;
    };
    syncBar();
    const photoBtn = button('PHOTO TOOLS', () => {
      if (!shown) return void toast('Take or pick a photo first', 'warn');
      S.lastAction = 'photo tools';
      openPhotoTools({ still: shown });
    }, 'on');
    photoBtn.hidden = true;
    photoBtn.classList.add('lensphoto');
    const bar = h('div.lensbar', startBtn, flipBtn, freezeBtn, torchBtn, photoBtn);

    // ---- a tap on the viewfinder (not a drag)
    let down: { x: number; y: number } | null = null;
    view.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    view.addEventListener('pointercancel', () => (down = null));
    view.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 10 || !mode?.tap) return;
      const r = view.getBoundingClientRect();
      const { t, size } = L.view();
      const vx = mirror() ? size.w - (e.clientX - r.left) : e.clientX - r.left;
      const p = toFrame(vx, e.clientY - r.top, t);
      mode.tap(p.x, p.y);
    });

    // ---- the frame loop: the one scheduler, nothing of our own
    onFrame((_dt, now) => {
      if (!L.active() || S.camera !== 'on') return;
      mode?.tick?.(now);
    });

    const hud = h('div.hud.lens', view, tiles, panel, bar, privacy);
    root.append(hud);
    expose();

    controller = { setMode };
    // The first mode is chosen now; it starts working when the tab is entered.
    mode = modes.see;
    tileBtns.get('see')?.classList.add('on');
    return {
      enter() {
        expose();
        const w = wanted;
        wanted = null;
        // The camera opens from a tap: the dock or deck tile just tapped, the chat bar's camera
        // button (openLens with start). A reload landing on #lens or the brain's open_lens is no
        // tap, so the camera stays off and START is the way to open it.
        if (S.camera === 'off') {
          if (w?.start || recentTap()) void L.startCamera();
          else L.status('camera off · START to open it', undefined);
        }
        if (w) setMode(w.mode, w.opts);
        else mode?.enter();
      },
      leave() {
        L.stopCamera();
        reader.terminate();
        mode?.leave();
        // Free every model (GPU memory); the modes take them again on entering, from the cached bytes.
        closeAll();
      },
      describe: () => {
        const bits = [`Lens tab in ${S.mode.toUpperCase()} mode, camera ${S.camera}${S.frozen ? ' (frozen)' : ''}`];
        // PEOPLE: only that it is open — never who is in the picture (a face, a name, a count: none of it leaves the phone)
        if (S.mode === 'people') return `${bits[0]}.`;
        if (S.counts) bits.push(`in view: ${S.counts}`);
        if (sceneLine(S.scene)) bits.push(`scene: ${sceneLine(S.scene)}`);
        if (S.mode === 'name' && S.names.length) bits.push(`closest names (phone guesses): ${namesLine(S.names)}`);
        if (S.gesture) bits.push(`gesture: ${S.gesture}`);
        if (S.card.what === 'living' || S.card.what === 'meal') bits.push(`card: ${S.card.text.slice(0, 200)}`);
        return `${bits.join('; ')}.`;
      },
    };
  },
};
