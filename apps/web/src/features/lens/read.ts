/**
 * READ: text in a picture. Capture a still (or pick a photo: on the phone that offers the camera
 * roll), read it on the phone with a progress bar, then edit the text, SAVE TO LIBRARY (kind
 * 'scan', title from the first line), COPY, ASK GHOSTY (sends the text, not the picture, so any
 * model can answer) or WORDS to see each word's box on the still. The reader stays warm between
 * captures and is terminated when the Lens is left.
 */
import { clear, h } from '../../core/dom';
import { bar, button, toast } from '../../ui/components';
import { loadImageFile } from '../../vision/camera';
import { cleanOcr, ocrSummary, titleFrom, wordRegions, type Region } from '../../vision/ocrtext';
import type { LensContext, Mode, ModeOpts } from './index';

export function createReadMode(L: LensContext): Mode {
  const S = L.state;
  let still: HTMLCanvasElement | null = null;
  let regions: Region[] = [];
  let words = false;
  let reading = false;

  const text = h('textarea.lensocr', { rows: 7, placeholder: 'The text in the picture appears here. You can edit it before saving.', 'aria-label': 'Text read from the picture' });
  const sure = h('div.note');
  const progress = h('div.lensprog');
  progress.hidden = true;
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Pick a photo' });
  file.hidden = true;
  const live = button('LIVE VIEW', () => {
    still = null;
    // a held frame is a still on screen too: let go of it
    if (S.frozen) L.freeze(false);
    L.showStill(null);
    L.clearOverlay();
    live.hidden = true;
  });
  live.hidden = true;
  const capture = button('CAPTURE', () => void readStill(L.still(1600)), 'on');
  const pick = button('PICK PHOTO', () => file.click());
  const wordsBtn = button('WORDS', (b) => {
    words = !words;
    b.classList.toggle('on', words);
    paintWords();
  });
  const save = button('SAVE TO LIBRARY', async () => {
    const t = text.value.trim();
    if (!t) return void toast('Nothing to save yet', 'warn');
    await L.saveNote(titleFrom(t), t, 'scan');
  });
  const copy = button('COPY', async () => {
    const t = text.value.trim();
    if (!t) return void toast('Nothing to copy yet', 'warn');
    try {
      await navigator.clipboard.writeText(t);
      toast('Copied', 'ok');
    } catch {
      text.focus();
      text.select();
      toast('Copy blocked by the browser: the text is selected, copy it yourself', 'warn');
    }
  });
  const ask = button('ASK GHOSTY', () => {
    const t = text.value.trim();
    if (!t) return void toast('Read something first', 'warn');
    S.lastAction = 'ask about the text';
    L.setMode('ask', { text: t, question: 'What is this text about? Anything important in it?', send: true });
  }, 'warn');
  const root = h('div.stackf',
    h('div.row', capture, pick, live),
    h('div.note', 'Reads English text on the phone (Tesseract). Best with the text filling the frame, flat and well lit. Nothing is sent anywhere.'),
    progress,
    text,
    sure,
    h('div.row.wrap', save, copy, ask, wordsBtn),
  );
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (!f) return;
    try {
      await readStill(await loadImageFile(f, 2048));
    } catch (e) {
      toast(String((e as Error)?.message ?? e), 'bad');
    }
  });
  text.addEventListener('input', () => (S.ocrText = text.value));

  const setProgress = (status: string, frac?: number) => {
    progress.hidden = false;
    clear(progress, bar(status.replace(/…$/, '').toUpperCase().slice(0, 22), frac ?? 0, frac != null ? `${Math.round(frac * 100)}%` : ''));
  };
  const paintWords = () => {
    if (!L.overlay() || !still || !words) return;
    for (const r of regions) L.drawBox(r.box, '', { color: r.confidence >= 70 ? '#62e4ff' : '#ffb23e' });
  };
  const readStill = async (c: HTMLCanvasElement | null) => {
    if (!c) return void toast('No picture yet: START the camera, or PICK PHOTO', 'warn');
    if (reading) return void toast('Still reading the last picture', 'warn');
    reading = true;
    still = c;
    L.showStill(c);
    live.hidden = false;
    regions = [];
    L.clearOverlay();
    text.value = '';
    sure.textContent = '';
    try {
      const r = await L.reader.read(c, (s, f) => {
        setProgress(s, f);
        L.status(s, 'mid');
      });
      const t = cleanOcr(r);
      text.value = t;
      S.ocrText = t;
      S.ocrConfidence = r.confidence;
      regions = wordRegions(r.words);
      const summary = ocrSummary(t, r.confidence);
      sure.textContent = t ? `${summary} · edit the text, then save, copy or ask` : 'No text found: try closer, flatter, with more light';
      L.status(summary, t ? 'ok' : 'mid');
      progress.hidden = true;
      paintWords();
    } catch (e) {
      progress.hidden = true;
      const msg = String((e as Error)?.message ?? e);
      L.status(`Could not read it: ${msg}`, 'off');
      // no pop-up for a read the owner ended themselves by leaving the Lens ("reader stopped")
      if (L.active()) toast(`Could not read it: ${msg}`, 'bad');
    } finally {
      reading = false;
    }
  };

  return {
    id: 'read',
    enter(opts?: ModeOpts) {
      clear(L.panel);
      L.panel.append(root, file);
      if (!L.reader.warmed) {
        void L.reader
          .warm((s) => S.mode === 'read' && !reading && L.status(s, 'mid'))
          .then(() => S.mode === 'read' && !reading && L.status('reader ready · CAPTURE or PICK PHOTO', 'ok'))
          .catch((e: unknown) => S.mode === 'read' && L.status(`The reader could not load: ${String((e as Error)?.message ?? e)}`, 'off'));
      }
      if (opts?.still) void readStill(opts.still);
      else if (opts?.capture) void readStill(L.still(1600));
      else if (still) {
        L.showStill(still);
        live.hidden = false;
        paintWords();
      }
    },
    leave() {
      L.showStill(null);
      L.clearOverlay();
      // Leaving the Lens terminates the reader, which ends any read in flight: READ must not stay "still reading".
      reading = false;
      progress.hidden = true;
    },
    froze() {
      // the held frame is a still on screen: LIVE VIEW lets go of it too
      live.hidden = false;
    },
    unfroze() {
      live.hidden = !still;
    },
  };
}
