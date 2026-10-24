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
 * State for specs at window.__ghosty.photo.
 */
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { ui } from '../../state/app';
import { button, modal, toast } from '../../ui/components';
import { drawScaled, loadImageFile, toJpegBlob } from '../../vision/camera';
import { readLines } from '../studio/catalog';
import { PHOTO_JOB_WORDS, PHOTO_JOBS, photoJobOf, type PhotoJob } from '../../../../../packages/shared/src/photo';

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
}

export const photoState: PhotoState = { open: false, job: 'background', phase: 'idle', status: '', steps: [], slider: 50, strokes: 0, mask: null, size: null, result: '', by: '', code: '', offline: false, saved: '' };

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
  Object.assign(S, { open: true, job: photoJobOf(String(o.job ?? '')) ?? 'background', phase: 'idle', status: '', steps: [], slider: 50, strokes: 0, mask: null, size: null, result: '', by: '', code: '', saved: '' });
  expose();

  /** The photo as sent (at most PHOTO_MAX_SIDE), and the strokes over it in its own pixels. */
  let work: HTMLCanvasElement | null = null;
  let strokes: { r: number; pts: { x: number; y: number }[] }[] = [];
  let brush = 0.035;
  let resultBlob: Blob | null = null;
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
  const done = h('div.row.wrap.ptdone', saveBtn, shareBtn);
  done.hidden = true;
  const picker = h('input', { type: 'file', accept: 'image/*', hidden: true, 'aria-label': 'Pick a photo' });
  const pickBtn = button('PICK A PHOTO', () => picker.click());

  const offline = () => ui.get().connected === false;

  const setStatus = (text: string, bad = false) => {
    S.status = text;
    status.textContent = text;
    status.classList.toggle('bad', bad);
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
    who.textContent = S.offline ? `Needs the brain: ${PHOTO_JOB_WORDS[S.job].doing} runs on free computers that Ghosty's brain asks, and the brain is not reachable right now.` : WHO[S.job];
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
    after.hidden = true;
    divider.hidden = true;
    sliderRow.hidden = true;
    done.hidden = true;
    credit.textContent = '';
    link.textContent = '';
    setStatus('');
  };

  const showResult = async (url: string, by: string, words: string) => {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`the result could not be loaded (${r.status})`);
    resultBlob = await r.blob();
    if (after.src.startsWith('blob:')) URL.revokeObjectURL(after.src);
    after.src = URL.createObjectURL(resultBlob);
    after.hidden = false;
    divider.hidden = false;
    sliderRow.hidden = false;
    done.hidden = false;
    S.phase = 'done';
    S.result = url;
    S.by = by;
    S.slider = 50;
    slider.value = '50';
    paintSlider();
    credit.textContent = by ? `Made by ${by}, free on Hugging Face. Kept for 10 years at:` : 'Kept for 10 years at:';
    link.href = url;
    link.textContent = new URL(url, location.href).href;
    setStatus(words);
    paintInk();
    paintJob();
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
      toast(`Could not read that photo: ${String((e as Error)?.message ?? e)}`, 'bad');
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
        return;
      }
      await showResult(g.url, g.by, S.job === 'background' ? 'Done: the background is gone. Slide to compare.' : S.job === 'sharper' ? 'Done: twice the size and sharper. Slide to compare.' : 'Done: erased. Slide to compare.');
    } catch (e) {
      S.phase = 'failed';
      S.code = 'failed';
      setStatus(`Not done: ${String((e as Error)?.message ?? e)} — try again in a minute.`, true);
    } finally {
      busy = false;
      paintJob();
    }
  }

  const fileName = () => `ghosty-${S.job}-${S.result.slice(3, 11)}.${(resultBlob?.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg')}`;
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
    const url = new URL(S.result, location.href).href;
    const file = new File([resultBlob], fileName(), { type: resultBlob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Photo from Ghosty' });
      else if (navigator.share) await navigator.share({ url, title: 'Photo from Ghosty' });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied', 'ok');
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast(`Could not share it: ${String((e as Error)?.message ?? e)}`, 'bad');
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
      setStatus(`Could not open the picture: ${String((e as Error)?.message ?? e)}`, true);
    }
  })();
}
