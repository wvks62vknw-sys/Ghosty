/**
 * PHOTO TOOLS: a sheet over a photo the owner took or picked — BACKGROUND (removed), SHARPER (twice the
 * size) or ERASE (draw over a thing with a finger) — reached from the Lens (the PHOTO TOOLS chip once
 * a photo is on screen, or ASK with "remove the background" / "make it sharper" / "erase the …") and
 * from the chat (the brain's photo_tool opens it with `open_photo_tools`). The job runs on the brain
 * (POST /api/m3d/photo, apps/edge/src/photo.ts): free Hugging Face Spaces, never paid; their progress,
 * queue and "asleep / over its free limit — try again in a minute" come back as plain lines. The result
 * is kept at /i/<id> for 10 years; the sheet shows BEFORE and AFTER with a slider, SAVE TO PHOTOS
 * (a download) and SHARE. With no brain every job says plainly that it needs the brain. No face
 * recognition and no face editing: nothing here looks for or changes a face.
 *
 * When the free online tools are asleep, over their free limit or out of reach, BACKGROUND is not left stuck: CUT IT OUT ON THIS
 * PHONE runs the photo editor's own cut-out (the cut-out model, else the first cut from depth) where its pack is already kept, and
 * shows the result the same way; nothing leaves the phone for it. With neither kept it says which download would do it and its
 * size, and opens the photo editor's BRAIN tray, where GET fetches it on his tap, on Wi-Fi; nothing is downloaded from here.
 * SHARPER and ERASE say plainly that they wait for the free online tools.
 *
 * State for specs at window.__ghosty.photo.
 */
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { ui } from '../../state/app';
import { button, modal, toast } from '../../ui/components';
import { drawScaled, loadImageFile, toJpegBlob } from '../../vision/camera';
import { readLines } from '../studio/catalog';
import { PHOTO_JOB_WORDS, PHOTO_JOBS, photoJobOf, type PhotoJob } from '../../../../../packages/shared/src/photo';
import { sayError } from '../../ui/hisWords';
import { packHere, packSize } from '../../photo/packget';
import { cutSubject, sizeIn, SUBJECT_BYTES, subjectState } from '../../photo/subject';
import type { Alpha } from '../../photo/alpha';

/** The longest side sent to the brain: small enough for a free CPU Space, and ×2 still fits the picture store. */
export const PHOTO_MAX_SIDE = 1024;

/** Who does each job, in one line for the owner (apps/edge/src/photo.ts names the same Spaces). */
const WHO: Record<PhotoJob, string> = {
  background: 'BiRefNet (MIT) on Hugging Face’s free GPU; when it is busy or over its free limit, BRIA RMBG-1.4 (non-commercial licence) on a free computer. The background comes out transparent.',
  sharper: 'Real-ESRGAN (Apache 2.0) on Hugging Face’s free GPU makes it twice the size and sharper. A general upscaler: it does not touch faces.',
  erase: 'Draw over what to erase with your finger. LaMa (Apache 2.0) on a free computer at Hugging Face fills it in from what is around it.',
};

export interface PhotoState {
  open: boolean;
  job: PhotoJob;
  phase: 'idle' | 'working' | 'done' | 'failed';
  status: string;
  /** Every step the brain said for the last job (place in the queue, a Space over its limit, waking up…). */
  steps: string[];
  /** The before/after slider, 0 (all before) to 100 (all after). */
  slider: number;
  /** Finger strokes for ERASE. */
  strokes: number;
  /** The last mask sent: its size and how much of it is white. */
  mask: { w: number; h: number; white: number } | null;
  /** The picture's size as sent. */
  size: { w: number; h: number } | null;
  /** The kept result (/i/<id>), who made it, and the error code when it failed (asleep, busy, limit…). */
  result: string;
  by: string;
  code: string;
  offline: boolean;
  saved: string;
  /**
   * When BACKGROUND could not be done online (asleep, busy, over the limit, no brain): the cut-out on this phone instead. '' none;
   * 'offered' its key is there; 'working'; 'model' or 'depth' what made the result; 'needs-pack' a download first, said with its size
   * (never started here); 'failed'. And 'wait' for SHARPER and ERASE, which only the free online tools do.
   */
  fallback: PhotoFallback;
  /** The line said with it. */
  fallbackWords: string;
}

export type PhotoFallback = '' | 'offered' | 'working' | 'model' | 'depth' | 'needs-pack' | 'failed' | 'wait';

export const photoState: PhotoState = { open: false, job: 'background', phase: 'idle', status: '', steps: [], slider: 50, strokes: 0, mask: null, size: null, result: '', by: '', code: '', offline: false, saved: '', fallback: '', fallbackWords: '' };

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.photo = photoState;
}

export interface PhotoOpen {
  /** The photo in hand (the Lens's still). */
  still?: HTMLCanvasElement | null;
  /** Or one of Ghosty's own pictures (/i/<id>), and a result already made from it. */
  picture?: string;
  result?: string;
  by?: string;
  job?: string;
}

/** Only Ghosty's own pictures are loaded into the sheet (the security policy shows nothing else, and nothing else is asked for). */
const ownPicture = (s: unknown): string => {
  const m = typeof s === 'string' ? s.match(/\/i\/([A-Za-z0-9_-]{16})(?![A-Za-z0-9_-])/) : null;
  return m ? `/i/${m[1]}` : '';
};

/**
 * The photo with the cut as its opacity, a PNG at the photo's own size: the alpha (smaller than the picture) is brought up to it by
 * the canvas's smooth scaling, and only the photo's own pixels are kept, as solid as the cut says.
 */
async function cutOutPng(src: HTMLCanvasElement, a: Alpha): Promise<Blob> {
  const m = document.createElement('canvas');
  m.width = a.w;
  m.height = a.h;
  const mg = m.getContext('2d')!;
  const px = mg.createImageData(a.w, a.h);
  for (let i = 0; i < a.w * a.h; i++) px.data[i * 4 + 3] = a.data[i] ?? 0;
  mg.putImageData(px, 0, 0);
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(m, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
  if (!b) throw new Error('the cut-out picture could not be made');
  return b;
}

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

async function canvasFrom(url: string): Promise<HTMLCanvasElement> {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(r.status === 404 ? 'that picture is no longer kept' : `the picture could not be loaded (${r.status})`);
  return loadImageFile(await r.blob(), PHOTO_MAX_SIDE);
}

let current: { close(): void } | null = null;

/** Open PHOTO TOOLS on a photo (or on nothing yet: PICK A PHOTO). */
export function openPhotoTools(o: PhotoOpen = {}): void {
  current?.close();
  const S = photoState;
  Object.assign(S, { open: true, job: photoJobOf(String(o.job ?? '')) ?? 'background', phase: 'idle', status: '', steps: [], slider: 50, strokes: 0, mask: null, size: null, result: '', by: '', code: '', saved: '', fallback: '', fallbackWords: '' });
  expose();

  /** The photo as sent (at most PHOTO_MAX_SIDE), and the strokes over it in its own pixels. */
  let work: HTMLCanvasElement | null = null;
  let strokes: { r: number; pts: { x: number; y: number }[] }[] = [];
  let brush = 0.035;
  let resultBlob: Blob | null = null;
  /** A result made on this phone has no /i/<id>: its file name takes this instead. */
  let localId = '';
  let busy = false;
  /** CSS pixels per photo pixel. */
  let k = 1;

  const before = h('canvas.ptbefore');
  const after = h('img.ptafter', { alt: 'After' });
  after.hidden = true;
  const divider = h('i.ptdivider');
  divider.hidden = true;
  const ink = h('canvas.ptink', { 'aria-label': 'Draw over what to erase' });
  const frame = h('div.ptframe', before, after, divider, ink);
  const stage = h('div.ptstage', frame);
  const empty = h('div.note.ptempty', 'No photo yet: take one with the Lens, or pick one.');
  const slider = h('input.ptslider', { type: 'range', min: '0', max: '100', value: '50', step: '1', 'aria-label': 'Before and after' });
  const sliderRow = h('div.ptsliderrow', h('small', 'BEFORE'), slider, h('small', 'AFTER'));
  sliderRow.hidden = true;
  const who = h('div.note.ptwho');
  const status = h('div.note.ptstatus', { role: 'status' });
  const credit = h('div.note.ptcredit');
  const link = h('a.ptlink', { target: '_blank', rel: 'noopener' });
  const chips = h('div.ptjobs');
  const jobBtns = new Map<PhotoJob, HTMLButtonElement>();
  const runBtn = button('', () => void run(), 'warn');
  const eraseTools = h('div.row.wrap.pterase');
  const saveBtn = button('SAVE TO PHOTOS', () => void save(), 'on');
  const shareBtn = button('SHARE', () => void share());
  const editBtn = button('EDIT IT', () => {
    // the result kept at /i/<id> opens in the photo editor (BRIEF-EDITOR-PHOTO)
    const at = S.result;
    if (!at) return;
    void import('../photo').then((m) => m.openPhotoEditor({ picture: at }));
    current?.close();
  });
  editBtn.setAttribute('aria-label', 'Edit this picture in the photo editor');
  const done = h('div.row.wrap.ptdone', saveBtn, shareBtn, editBtn);
  done.hidden = true;
  // BACKGROUND not done online: the cut-out on this phone, or the download it needs (said, never started here)
  const fbLine = h('div.note.ptfbline', { role: 'status', 'aria-live': 'polite' });
  const cutBtn = button('CUT IT OUT ON THIS PHONE', () => void cutHere(), 'on');
  cutBtn.setAttribute('aria-label', 'Cut the background out on this phone. Nothing leaves it');
  const toEditorBtn = button('OPEN THE PHOTO EDITOR', () => toEditor());
  toEditorBtn.setAttribute('aria-label', 'Open the photo editor on its BRAIN tray, where the cut-out model is offered');
  const fallback = h('div.ptfallback', fbLine, h('div.row.wrap.ptfbkeys', cutBtn, toEditorBtn));
  fallback.hidden = true;
  const picker = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Pick a photo' });
  const pickBtn = button('PICK A PHOTO', () => picker.click());

  const offline = () => ui.get().connected === false;

  const setStatus = (text: string, bad = false) => {
    S.status = text;
    status.textContent = text;
    status.classList.toggle('bad', bad);
  };

  const paintFallback = () => {
    const f = S.fallback;
    fallback.hidden = !f || f === 'model' || f === 'depth';
    fallback.dataset.fallback = f;
    /* state: lens.photo error */
    if (S.phase === 'failed' || f === 'failed' || f === 'wait') fallback.dataset.state = 'error';
    else delete fallback.dataset.state;
    fbLine.textContent = S.fallbackWords;
    fbLine.classList.toggle('bad', f === 'failed' || f === 'wait');
    cutBtn.hidden = !(f === 'offered' || f === 'working' || f === 'failed');
    cutBtn.disabled = busy || !work;
    toEditorBtn.hidden = f !== 'needs-pack';
  };
  const sayFallback = (f: PhotoFallback, words = '') => {
    S.fallback = f;
    S.fallbackWords = words;
    paintFallback();
  };
  /** After a job the free online tools did not do: BACKGROUND offers the cut-out on this phone; SHARPER and ERASE say they wait. */
  const afterFail = (code: string) => {
    if (S.job === 'background') return sayFallback('offered', 'I can cut it out on this phone instead: nothing leaves it.');
    if (['asleep', 'busy', 'limit'].includes(code)) return sayFallback('wait', 'SHARPER and ERASE must wait: only the free online tools do those two, and they are asleep or over their free limit right now. Try again in a minute.');
    if (code === 'failed') return sayFallback('wait', 'SHARPER and ERASE must wait: only the free online tools do those two, and they did not do it just now. Try again in a minute.');
  };

  // ---- the stage: the photo, the result over it up to the slider, and the ink for ERASE
  const fit = () => {
    if (!work) return;
    const availW = stage.clientWidth || 320;
    const availH = Math.max(180, Math.min(window.innerHeight * 0.46, 520));
    k = Math.min(availW / work.width, availH / work.height);
    const w = Math.round(work.width * k);
    const hh = Math.round(work.height * k);
    for (const el of [frame, before, after, ink]) {
      el.style.width = `${w}px`;
      el.style.height = `${hh}px`;
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ink.width = Math.round(w * dpr);
    ink.height = Math.round(hh * dpr);
    paintInk();
    paintSlider();
  };
  new ResizeObserver(fit).observe(stage);

  const paintInk = () => {
    const c = ink.getContext('2d');
    if (!c || !work) return;
    const dpr = ink.width / Math.max(1, work.width * k);
    c.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    c.clearRect(0, 0, work.width, work.height);
    if (S.job !== 'erase' || S.phase === 'done') return;
    c.strokeStyle = 'rgba(255, 120, 60, .6)';
    c.fillStyle = 'rgba(255, 120, 60, .6)';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const s of strokes) drawStroke(c, s);
  };
  const drawStroke = (c: CanvasRenderingContext2D, s: { r: number; pts: { x: number; y: number }[] }) => {
    c.lineWidth = s.r * 2;
    if (s.pts.length === 1) {
      c.beginPath();
      c.arc(s.pts[0]!.x, s.pts[0]!.y, s.r, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    s.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.stroke();
  };
  const paintSlider = () => {
    const v = S.slider;
    after.style.clipPath = `inset(0 ${100 - v}% 0 0)`;
    divider.style.left = `calc(${v}% - 1px)`;
  };
  slider.addEventListener('input', () => {
    S.slider = Number(slider.value);
    paintSlider();
  });

  // ---- drawing the mask with a finger (ERASE)
  let drawing: { r: number; pts: { x: number; y: number }[] } | null = null;
  const at = (e: PointerEvent) => {
    const r = ink.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  ink.addEventListener('pointerdown', (e) => {
    if (S.job !== 'erase' || !work || busy || S.phase === 'done') return;
    e.preventDefault();
    ink.setPointerCapture(e.pointerId);
    drawing = { r: Math.max(4, Math.round(Math.max(work.width, work.height) * brush)), pts: [at(e)] };
    strokes.push(drawing);
    paintInk();
  });
  ink.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    drawing.pts.push(at(e));
    paintInk();
  });
  const lift = () => {
    if (!drawing) return;
    drawing = null;
    S.strokes = strokes.length;
    paintJob();
  };
  ink.addEventListener('pointerup', lift);
  ink.addEventListener('pointercancel', lift);

  /** The mask: the photo's own size, black, white where the finger went (what LaMa reads). */
  const maskBlob = async (w: number, hh: number): Promise<Blob> => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = hh;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, hh);
    const sx = w / work!.width;
    const sy = hh / work!.height;
    g.setTransform(sx, 0, 0, sy, 0, 0);
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of strokes) drawStroke(g, s);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const px = g.getImageData(0, 0, w, hh).data;
    let white = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i]! > 127) white++;
    S.mask = { w, h: hh, white: white / (w * hh) };
    const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
    if (!b) throw new Error('the mask could not be made');
    return b;
  };

  // ---- the job chips, the button and the words under them
  const paintJob = () => {
    for (const [j, b] of jobBtns) b.classList.toggle('on', j === S.job);
    runBtn.textContent = PHOTO_JOB_WORDS[S.job].run;
    S.offline = offline();
    /* state: lens.photo offline */
    who.textContent = S.offline ? `I need my brain for ${PHOTO_JOB_WORDS[S.job].doing}, and it isn’t reachable just now. Try again in a moment.` : WHO[S.job];
    if (S.offline) who.dataset.state = 'offline';
    else delete who.dataset.state;
    who.classList.toggle('bad', S.offline);
    runBtn.disabled = busy || S.offline || !work || (S.job === 'erase' && !strokes.length);
    runBtn.hidden = S.phase === 'done';
    clear(
      eraseTools,
      ...(S.job === 'erase' && S.phase !== 'done'
        ? [
            h('small', 'BRUSH'),
            ...([['S', 0.02], ['M', 0.035], ['L', 0.06]] as const).map(([l, v]) => {
              const b = button(l, () => {
                brush = v;
                paintJob();
              });
              b.classList.toggle('on', brush === v);
              return b;
            }),
            button('UNDO', () => {
              strokes.pop();
              S.strokes = strokes.length;
              paintInk();
              paintJob();
            }),
            button('CLEAR', () => {
              strokes = [];
              S.strokes = 0;
              paintInk();
              paintJob();
            }),
          ]
        : []),
    );
    ink.classList.toggle('on', S.job === 'erase' && S.phase !== 'done');
    empty.hidden = !!work;
    stage.hidden = !work;
    // with no brain, BACKGROUND can still be cut out on this phone
    if (S.offline && S.job === 'background' && work && S.phase === 'idle' && !S.fallback) sayFallback('offered', 'With no brain I can still cut it out on this phone: nothing leaves it.');
    else if (!S.offline && S.phase === 'idle' && S.fallback === 'offered') sayFallback('');
    else paintFallback();
  };
  for (const j of PHOTO_JOBS) {
    const b = button(PHOTO_JOB_WORDS[j].chip, () => {
      if (busy) return;
      S.job = j;
      // a new job starts from the photo again
      if (S.phase !== 'working') resetResult();
      paintInk();
      paintJob();
    });
    jobBtns.set(j, b);
    chips.append(b);
  }

  const resetResult = () => {
    S.phase = 'idle';
    S.result = '';
    S.by = '';
    S.code = '';
    resultBlob = null;
    localId = '';
    after.hidden = true;
    divider.hidden = true;
    sliderRow.hidden = true;
    done.hidden = true;
    credit.textContent = '';
    link.textContent = '';
    link.hidden = false;
    editBtn.hidden = false;
    setStatus('');
    sayFallback('');
  };

  /** BEFORE and AFTER with the slider, SAVE TO PHOTOS and SHARE, for a result from the brain or from this phone. */
  const showBlob = (blob: Blob, words: string) => {
    resultBlob = blob;
    if (after.src.startsWith('blob:')) URL.revokeObjectURL(after.src);
    after.src = URL.createObjectURL(blob);
    after.hidden = false;
    divider.hidden = false;
    sliderRow.hidden = false;
    done.hidden = false;
    S.phase = 'done';
    S.slider = 50;
    slider.value = '50';
    paintSlider();
    setStatus(words);
    paintInk();
    paintJob();
  };

  const showResult = async (url: string, by: string, words: string) => {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`the result could not be loaded (${r.status})`);
    const blob = await r.blob();
    S.result = url;
    S.by = by;
    localId = '';
    credit.textContent = by ? `Made by ${by}, free on Hugging Face. Kept for 10 years at:` : 'Kept for 10 years at:';
    link.href = url;
    link.textContent = new URL(url, location.href).href;
    link.hidden = false;
    editBtn.hidden = false;
    showBlob(blob, words);
  };

  /** A cut made on this phone: no /i/<id> and no "kept for 10 years", and it says which cut it was. */
  const showLocal = (blob: Blob, from: 'model' | 'depth', lead = '') => {
    S.result = '';
    S.by = '';
    localId = Date.now().toString(36).slice(-8);
    credit.textContent = 'Cut out on this phone: nothing left it.';
    link.textContent = '';
    link.removeAttribute('href');
    link.hidden = true;
    editBtn.hidden = true;
    S.fallback = from;
    S.fallbackWords = from === 'model' ? 'From the cut-out model.' : 'A first cut from depth: check the edges.';
    showBlob(blob, `${lead}Done on this phone: the background is gone. ${S.fallbackWords} Slide to compare.`);
  };

  const setPhoto = (c: HTMLCanvasElement) => {
    work = Math.max(c.width, c.height) > PHOTO_MAX_SIDE ? drawScaled(c, { w: c.width, h: c.height }, PHOTO_MAX_SIDE) : drawScaled(c, { w: c.width, h: c.height });
    before.width = work.width;
    before.height = work.height;
    before.getContext('2d')?.drawImage(work, 0, 0);
    strokes = [];
    S.strokes = 0;
    S.size = { w: work.width, h: work.height };
    resetResult();
    paintJob();
    setTimeout(fit, 0);
  };
  picker.addEventListener('change', async () => {
    const f = picker.files?.[0];
    picker.value = '';
    if (!f) return;
    try {
      setPhoto(await loadImageFile(f, PHOTO_MAX_SIDE));
    } catch (e) {
      toast(sayError(e, 'read that photo'), 'bad');
    }
  });

  // ---- run the job on the brain
  async function run(): Promise<void> {
    if (busy || !work) return;
    if (offline()) return paintJob();
    if (S.job === 'erase' && !strokes.length) return void setStatus('Draw over what to erase first.', true);
    busy = true;
    S.phase = 'working';
    S.code = '';
    S.steps = [];
    sayFallback('');
    paintJob();
    setStatus('Sending the photo to the brain…');
    try {
      const photo = await toJpegBlob(work, 1_500_000, PHOTO_MAX_SIDE);
      const form = new FormData();
      form.append('job', S.job);
      form.append('picture', photo, 'photo.jpg');
      if (S.job === 'erase') {
        // the mask matches the picture as sent, to the pixel
        const bmp = await createImageBitmap(photo);
        const size = { w: bmp.width, h: bmp.height };
        bmp.close();
        form.append('mask', await maskBlob(size.w, size.h), 'mask.png');
      }
      const r = await fetch('/api/m3d/photo', { method: 'POST', headers: headers(), body: form, credentials: 'same-origin' });
      let got: { url: string; by: string } | null = null;
      let fail: { error: string; code: string } | null = null;
      if (!(r.headers.get('content-type') ?? '').includes('ndjson')) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        fail = { error: j.error ?? (r.status === 404 ? 'the brain does not have the photo tools yet: it needs an update' : `the brain answered ${r.status}`), code: 'failed' };
      } else
        await readLines(r, (l) => {
          if (typeof l.step === 'string') {
            S.steps.push(l.step);
            setStatus(`${l.step.charAt(0).toUpperCase()}${l.step.slice(1)}`);
          }
          const p = l.photo as { url?: unknown; by?: unknown } | undefined;
          if (p && typeof p === 'object' && ownPicture(p.url)) got = { url: ownPicture(p.url), by: typeof p.by === 'string' ? p.by : '' };
          if (typeof l.error === 'string') fail = { error: l.error, code: typeof l.code === 'string' ? l.code : 'failed' };
        });
      const g = got as { url: string; by: string } | null;
      if (!g) {
        const f = (fail ?? { error: 'the brain stopped answering before it was done — try again in a minute', code: 'busy' }) as { error: string; code: string };
        S.phase = 'failed';
        S.code = f.code;
        setStatus(`Not done: ${f.error.replace(/\.$/, '')}.`, true);
        afterFail(f.code);
        return;
      }
      await showResult(g.url, g.by, S.job === 'background' ? 'Done: the background is gone. Slide to compare.' : S.job === 'sharper' ? 'Done: twice the size and sharper. Slide to compare.' : 'Done: erased. Slide to compare.');
    } catch (e) {
      S.phase = 'failed';
      S.code = 'failed';
      setStatus(sayError(e, 'finish that'), true);
      afterFail('failed');
    } finally {
      busy = false;
      paintJob();
    }
  }

  // ---- BACKGROUND on this phone: the photo editor's own cut-out, where its pack is already kept (never a download from here)
  async function cutHere(): Promise<void> {
    if (busy || !work || S.job !== 'background') return;
    const src = work;
    const was = S.phase;
    busy = true;
    S.phase = 'working';
    sayFallback('working', 'Looking for what is kept on this phone…');
    paintJob();
    const tell = (w: string) => {
      S.fallbackWords = w;
      fbLine.textContent = w;
    };
    try {
      const [here, st] = await Promise.all([packHere('cutout'), subjectState()]);
      let why = '';
      if (here) {
        try {
          const { cutWithModel } = await import('../../photo/matting');
          const { alpha } = await cutWithModel(src, (w) => tell(cap(w)));
          // (another photo picked meanwhile: this cut is not for it)
          if (work === src) showLocal(await cutOutPng(src, alpha), 'model');
          return;
        } catch (e) {
          // never a silent fallback: its line, and the first cut used instead where that is kept
          why = sayError(e, 'run the cut-out model');
        }
      }
      if (!st.ready) {
        S.phase = was;
        if (why) sayFallback('failed', `${why} Nothing left the phone.`);
        else
          sayFallback(
            'needs-pack',
            `To cut it out on this phone I need the cut-out model kept here (${packSize('cutout')}). It comes only when you tap GET, on Wi-Fi, in the photo editor’s BRAIN tray: nothing is downloaded until then. (A first cut from depth needs MEASURE’S DISTANCE and THE LENS’S EYES instead, ${sizeIn(SUBJECT_BYTES)} together, from Settings.)`,
          );
        return;
      }
      const { alpha } = await cutSubject(src, (w) => tell(w));
      if (work !== src) return;
      showLocal(await cutOutPng(src, alpha), 'depth', why ? `The cut-out model would not run (${why.replace(/\.$/, '')}), so I used the first cut. ` : '');
    } catch (e) {
      S.phase = was;
      sayFallback('failed', `${sayError(e, 'cut it out on this phone')} Nothing left the phone.`);
    } finally {
      busy = false;
      paintJob();
    }
  }

  /** The photo editor on its BRAIN tray, where the cut-out model is offered (GET, on his tap, on Wi-Fi). */
  const toEditor = () => {
    const still = work;
    current?.close();
    void (async () => {
      const [{ openPhotoEditor }, { peState }] = await Promise.all([import('../photo'), import('../photo/editor')]);
      // already in the editor (its BRAIN key opened this sheet): its BRAIN tray, without the photo kept a second time
      if (ui.get().tab === 'photo' && peState.open) (await import('../../shell/tabs')).go('photo?brain');
      else await openPhotoEditor({ still, tool: 'brain' });
    })();
  };

  const fileName = () => `ghosty-${S.job}-${S.result ? S.result.slice(3, 11) : localId}.${(resultBlob?.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg')}`;
  async function save(): Promise<void> {
    if (!resultBlob) return;
    const a = h('a', { href: URL.createObjectURL(resultBlob), download: fileName() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    S.saved = fileName();
    toast('Saved: on an iPhone, open it from Downloads and choose Save to Photos (or use SHARE → Save Image)', 'ok');
  }
  async function share(): Promise<void> {
    if (!resultBlob) return;
    // a cut made on this phone has no link: the picture itself, or SAVE TO PHOTOS
    const url = S.result ? new URL(S.result, location.href).href : '';
    const file = new File([resultBlob], fileName(), { type: resultBlob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Photo from Ghosty' });
      else if (!url) toast('This phone cannot share the picture from here: SAVE TO PHOTOS keeps it.', 'warn');
      else if (navigator.share) await navigator.share({ url, title: 'Photo from Ghosty' });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied', 'ok');
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast(sayError(e, 'share it'), 'bad');
    }
  }

  const body = h('div.lenscrop.ptsheet',
    chips,
    who,
    empty,
    stage,
    sliderRow,
    eraseTools,
    h('div.row.wrap', runBtn, pickBtn, picker),
    status,
    fallback,
    done,
    credit,
    link,
    h('div.note.ptprivacy', 'The photo goes to the brain and on to the free Space doing the job; the result is kept at its link for 10 years. No face recognition and no face editing.'),
  );
  const m = modal('PHOTO TOOLS', body, () => {
    S.open = false;
    if (after.src.startsWith('blob:')) URL.revokeObjectURL(after.src);
    if (current === m) current = null;
  });
  current = m;
  paintJob();

  void (async () => {
    try {
      if (o.still) setPhoto(o.still);
      else if (ownPicture(o.picture)) {
        setStatus('Loading the picture…');
        setPhoto(await canvasFrom(ownPicture(o.picture)));
      } else if (ownPicture(o.result)) {
        // a result with no "before" Ghosty can show: the result alone
        setPhoto(await canvasFrom(ownPicture(o.result)));
      }
      if (work && ownPicture(o.result) && ownPicture(o.picture)) await showResult(ownPicture(o.result), String(o.by ?? ''), 'Done. Slide to compare.');
    } catch (e) {
      setStatus(sayError(e, 'open the picture'), true);
    }
  })();
}
