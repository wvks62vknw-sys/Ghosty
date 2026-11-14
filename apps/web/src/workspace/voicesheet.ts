/**
 * THE VOICE NOTE PANEL (editors.s6; the workspace's home → VOICE NOTE, "take a voice note", "turn my voice note into a page"): RECORD with the
 * phone's own microphone (or CHOOSE A RECORDING from Voice Memos), STOP, and Ghosty writes it down and tidies it into a Workspace page or a
 * Document with the actions as to-dos. Each state is said: recording, listening, writing, done, and offline (the recording is kept on this
 * phone in its own little database and tidied when the brain is back). Only the sound goes to his brain to be written down, then his words
 * to be tidied; the recording itself never leaves the phone otherwise, and is let go once its page is made.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { encodeWav } from '../convert/audio';
import { pieces } from '../video/subs';
import { clockWords, doneWords, letGoOfRecording, MAX_NOTE_MS, parseTidy, tidyAsk, tidyHere, type Tidy } from './voicenote';

export type VoiceState = 'idle' | 'recording' | 'listening' | 'writing' | 'done' | 'offline' | 'error';
export const voiceState = { state: 'idle' as VoiceState, said: '', kept: 0, target: 'page' as 'page' | 'document', made: '' };

// ---------------------------------------------------------------- the kept recordings (IndexedDB: a blob is too big for localStorage)
interface Kept {
  id: string;
  at: number;
  blob: Blob;
  target: 'page' | 'document';
}
const DB = 'ghosty-voicenotes';
const openDb = (): Promise<IDBDatabase> =>
  new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('notes', { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
async function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((ok, no) => {
    const t = db.transaction('notes', mode);
    const q = f(t.objectStore('notes'));
    t.oncomplete = () => {
      db.close();
      ok(q.result as T);
    };
    t.onerror = () => {
      db.close();
      no(t.error);
    };
  });
}
export const keptNotes = (): Promise<Kept[]> => tx<Kept[]>('readonly', (s) => s.getAll()).then((l) => l.sort((a, b) => a.at - b.at)).catch(() => []);
const keepNote = (k: Kept): Promise<void> => tx<void>('readwrite', (s) => s.put(k)).then(() => undefined);
const dropNote = (id: string): Promise<void> => tx<void>('readwrite', (s) => s.delete(id)).then(() => undefined).catch(() => undefined);

/** A sound cut to mono 16 kHz WAV pieces for the hearing route (as the video's subtitles are made). */
async function wavPieces(blob: Blob): Promise<Blob[]> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new Ctx();
  let buf: AudioBuffer;
  try {
    buf = await ac.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ac.close().catch(() => undefined);
  }
  const rate = 16_000;
  const out: Blob[] = [];
  for (const [a, b] of pieces(Math.min(buf.duration * 1000, MAX_NOTE_MS), 25_000)) {
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(((b - a) / 1000) * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination);
    src.start(0, a / 1000, (b - a) / 1000);
    const r = await off.startRendering();
    out.push(new Blob([encodeWav({ rate, channels: [r.getChannelData(0)] }) as BlobPart], { type: 'audio/wav' }));
  }
  return out;
}

export interface VoiceHooks {
  /** A tidy note made into a page or a document; returns what to say, and whether it was kept (when not, the recording stays on the phone). */
  made(t: Tidy, target: 'page' | 'document', at: number): { words: string; ok: boolean };
}

/** The panel. `start` true: the microphone starts at once (asked for by voice). */
export function voicePanel(hooks: VoiceHooks, o: { start?: boolean } = {}): { el: HTMLElement; stop(): void } {
  const line = h('p.wsvoiceline', { 'aria-live': 'polite', dataset: { case: 'keep' } });
  const clock = h('b.wsvoiceclock', { 'aria-hidden': 'true' });
  const keys = h('div.wsrow.wsvoicekeys');
  const keptEl = h('div.wsvoicekept');
  const fileIn = h('input', { type: 'file', hidden: true, accept: 'audio/*,.m4a,.mp3,.wav,.webm,.ogg,.aac', 'aria-label': 'Choose a recording of my own' }) as HTMLInputElement;
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let t0 = 0;
  let tick = 0;
  let busy = false;
  let gone = false;
  const set = (s: VoiceState, words: string): void => {
    voiceState.state = s;
    voiceState.said = words;
    el.dataset.state = s;
    line.textContent = words;
  };
  const targetKeys = (): HTMLElement => {
    const mk = (t: 'page' | 'document', label: string): HTMLButtonElement => {
      const b = button(label, () => {
        voiceState.target = t;
        draw();
      }, voiceState.target === t ? 'on' : '');
      b.setAttribute('aria-pressed', String(voiceState.target === t));
      b.dataset.target = t;
      return b;
    };
    return h('div.wsrow.wsvoicetarget', { role: 'group', 'aria-label': 'What the note becomes' }, mk('page', 'A WORKSPACE PAGE'), mk('document', 'A DOCUMENT'));
  };
  const draw = (): void => {
    if (gone) return;
    clear(keys);
    if (voiceState.state === 'recording') keys.append(button('STOP', () => stopRec(), 'on'), button('THROW IT AWAY', () => stopRec(true)));
    else if (!busy) keys.append(button('RECORD', () => void startRec(), 'on'), button('CHOOSE A RECORDING', () => fileIn.click()));
    clear(el, h('small.wsh', 'VOICE NOTE'), line, clock, keys, busy || voiceState.state === 'recording' ? '' : targetKeys(), keptEl, fileIn);
    void drawKept();
  };
  const drawKept = async (): Promise<void> => {
    const l = await keptNotes();
    voiceState.kept = l.length;
    clear(keptEl);
    if (!l.length || gone) return;
    keptEl.append(h('small.wsh', `KEPT TO TIDY · ${l.length}`), ...l.map((k) => h('div.wsvoicek', { dataset: { id: k.id } },
      h('span', `Recorded ${new Date(k.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`),
      h('div.wsrow', button('TIDY IT NOW', () => void tidy(k)), button('DELETE', () => void dropNote(k.id).then(() => {
        set('idle', 'The kept recording is deleted from this phone.');
        draw();
      }))))));
  };
  const startRec = async (): Promise<void> => {
    if (busy || rec) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      set('error', 'This browser cannot record here. Record in Voice Memos, then CHOOSE A RECORDING.');
      return draw();
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      set('error', 'I can’t use the microphone: allow it for Ghosty in the phone’s Settings, or record in Voice Memos and CHOOSE A RECORDING.');
      return draw();
    }
    chunks = [];
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
    rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start(1000);
    t0 = Date.now();
    set('recording', 'Recording… talk as long as you like, up to ten minutes. Tap STOP when you are done.');
    const paint = (): void => {
      const ms = Date.now() - t0;
      clock.textContent = clockWords(ms);
      line.textContent = `Recording… ${clockWords(ms)}. Tap STOP when you are done.`;
      voiceState.said = line.textContent;
      if (ms >= MAX_NOTE_MS) stopRec();
    };
    paint();
    tick = window.setInterval(paint, 1000);
    draw();
  };
  const stopRec = (throwAway = false): void => {
    const r = rec;
    if (!r) return;
    clearInterval(tick);
    clock.textContent = '';
    rec = null;
    r.onstop = () => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
      chunks = [];
      if (throwAway) {
        set('idle', 'Thrown away: nothing was kept.');
        return draw();
      }
      // (the sheet closed while recording: the recording is kept, to tidy next time)
      if (gone) return void keepNote({ id: `v${Date.now().toString(36)}`, at: t0, blob, target: voiceState.target }).catch(() => undefined);
      void take(blob);
    };
    r.stop();
  };
  const take = async (blob: Blob): Promise<void> => {
    const k: Kept = { id: `v${Date.now().toString(36)}`, at: Date.now(), blob, target: voiceState.target };
    try {
      await keepNote(k);
    } catch {
      /* not kept: it is tidied now or lost with this page, and the line says so if the brain is away */
    }
    await tidy(k);
  };
  const tidy = async (k: Kept): Promise<void> => {
    if (busy) return;
    if (!navigator.onLine) {
      set('offline', 'Offline: your recording is kept on this phone, and I tidy it into a page when you are back.');
      return draw();
    }
    busy = true;
    draw();
    let said = '';
    try {
      set('listening', 'Listening to what you said…');
      const parts = await wavPieces(k.blob);
      const { brain } = await import('../api/brain');
      const words: string[] = [];
      for (const [i, p] of parts.entries()) {
        set('listening', `Listening to what you said… part ${i + 1} of ${parts.length}.`);
        words.push(await brain.stt(p));
      }
      said = words.join(' ').replace(/\s+/g, ' ').trim();
    } catch (e) {
      busy = false;
      const decode = e instanceof DOMException && /Encoding|NotSupported/i.test(e.name);
      if (decode) {
        await dropNote(k.id);
        set('error', 'I could not read that recording’s sound. Try an .m4a from Voice Memos, or RECORD here.');
      } else set('offline', 'Offline: my brain is away, so your recording is kept on this phone, and I tidy it into a page when you are back.');
      return draw();
    }
    if (!said) {
      busy = false;
      await dropNote(k.id);
      set('error', 'I couldn’t hear any words in that recording, so nothing was made. Try again closer to the phone.');
      return draw();
    }
    set('writing', 'Writing your page…');
    let t: Tidy | null = null;
    try {
      const { askBrain } = await import('../docs/ask');
      const r = await askBrain(tidyAsk(said), () => undefined, 'workspace');
      t = parseTidy(r.text, said);
    } catch {
      t = null;
    }
    t ??= tidyHere(said);
    const made = hooks.made(t, k.target, k.at);
    const { words } = made;
    busy = false;
    // (the recording and its words are let go only once the page or document is really kept: TIDY IT NOW must have something to try again)
    if (!letGoOfRecording(made)) {
      set('error', words);
      return draw();
    }
    await dropNote(k.id);
    voiceState.made = t.title;
    set('done', words || doneWords(t, k.target));
    draw();
  };
  fileIn.addEventListener('change', () => {
    const f = fileIn.files?.[0];
    fileIn.value = '';
    if (f) void take(f);
  });
  const online = (): void => {
    void keptNotes().then((l) => {
      if (l[0] && !busy && !gone) void tidy(l[0]);
    });
  };
  window.addEventListener('online', online);
  const el = h('div.wspanel.wsvoice', { dataset: { panel: 'voice', state: 'idle' } });
  set('idle', 'Talk for a few minutes. I keep the recording on this phone, write down what you said, and tidy it into a page with the actions as to-dos.');
  draw();
  if (o.start) void startRec();
  else if (navigator.onLine) void keptNotes().then((l) => l.length && set('idle', `${l.length} recording${l.length === 1 ? ' is' : 's are'} kept to tidy: TIDY IT NOW makes the page.`));
  return {
    el,
    stop: () => {
      gone = true;
      window.removeEventListener('online', online);
      if (rec) stopRec();
      clearInterval(tick);
    },
  };
}
