/**
 * THE VOICE MODEL ON THE PHONE (STARS 171): turns a capture of his microphone into 256 numbers that tell voices apart. It runs only
 * from the pack he fetched on his tap on Wi-Fi (offline/speakerpack.ts): it never fetches anything itself, and with the pack not on
 * the phone `embed` answers null and the phone's own features judge as they always did. The runtime is the namer's and the faces'
 * (ONNX Runtime Web, WebAssembly, its own worker in public/vendor/speaker, one thread), ended after a quiet minute so its memory
 * goes back to the phone. The numbers it makes stay in memory until they are scored or kept in IndexedDB (voicestore.ts); a capture
 * is never sent anywhere, and nothing here is read by anything that confirms, pays, unlocks or approves.
 *
 * The specs stand the model in (window.__ghostySpeakerEngine, honoured only under a test runner), the way the faces' specs do: the
 * pack, the filterbank, the judging, the words and the screens are real.
 */
import { rawText, trail } from '../ui/hisWords';
import { fromPack, isHere } from '../offline/pack';
import { EYES_CACHE } from '../offline/eyes';
import { onSpeakerPack, SPEAKER_PACK } from '../offline/speakerpack';
import { VOICE_MODEL_PIN } from '../offline/speakerfiles';
import { fbank } from './speakerfbank';
import { EMB_LEN, norm } from './speakerjudge';

/** The runtime's WebAssembly memory cap (64 KB pages): 1 GB, then 256 MB if the phone refuses that. */
const MAX_PAGES = [16384, 4096] as const;
const IDLE_MS = 60_000;
const memoryTrouble = (e: unknown) => /RangeError|out of memory|no available backend|could not allocate|allocation failed/i.test(rawText(e));

interface StandIn {
  embed(pcm: Float32Array): number[] | Promise<number[] | null> | null;
}
function standIn(): StandIn | null {
  const w = window as unknown as { __ghostySpeakerEngine?: StandIn };
  return navigator.webdriver && w.__ghostySpeakerEngine ? w.__ghostySpeakerEngine : null;
}

type Reply = { id: number; t: 'done' | 'error'; message?: string; data?: Float32Array };

class Engine {
  private worker: Worker | null = null;
  private loading: Promise<void> | null = null;
  private seq = 0;
  private calls = new Map<number, { ok: (r: Reply) => void; bad: (e: Error) => void }>();
  private idle = 0;
  private here: boolean | null = null;
  /** The model could not start on this phone (no SIMD, no memory): the phone's own features judge for the rest of this session. */
  broken = '';
  /** How many embeddings have been made (for the checks). */
  made = 0;

  /** The pack is on this phone (its files are all in the phone's cache), checked once and again after a GET or a DELETE. */
  async onPhone(): Promise<boolean> {
    if (this.broken) return false;
    this.here ??= await isHere(SPEAKER_PACK).catch(() => false);
    return this.here;
  }
  forget(): void {
    this.here = null;
    this.broken = '';
    this.end();
  }

  private ask(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<Reply> {
    return new Promise((ok, bad) => {
      const w = this.worker;
      if (!w) return bad(new Error('the voice model is not running'));
      const id = ++this.seq;
      this.calls.set(id, { ok, bad });
      w.postMessage({ ...msg, id }, transfer);
    });
  }

  private load(): Promise<void> {
    this.loading ??= (async () => {
      const kept = await Promise.all(VOICE_MODEL_PIN.parts.map((u) => fromPack(EYES_CACHE, u)));
      if (!kept.every((r) => r?.ok)) throw new Error('The voice model is not on this phone');
      const bytes = await Promise.all(kept.map((r) => r!.arrayBuffer()));
      let failed: unknown = null;
      for (const pages of MAX_PAGES) {
        try {
          this.start(pages);
          await this.ask({ op: 'load', parts: bytes.map((b) => b.slice(0)) }, []);
          failed = null;
          break;
        } catch (e) {
          failed = e;
          this.end();
          if (!memoryTrouble(e)) break;
        }
      }
      if (failed) throw failed;
    })().catch((e: unknown) => {
      this.loading = null;
      throw e;
    });
    return this.loading;
  }

  private start(maxPages: number): void {
    const w = new Worker(`${VOICE_MODEL_PIN.worker}?maxPages=${maxPages}`, { type: 'module' });
    w.onmessage = (ev: MessageEvent<Reply>) => {
      const c = this.calls.get(ev.data.id);
      if (!c) return;
      this.calls.delete(ev.data.id);
      if (ev.data.t === 'error') c.bad(new Error(ev.data.message ?? 'the voice model failed'));
      else c.ok(ev.data);
    };
    w.onerror = (ev) => {
      for (const [, c] of this.calls) c.bad(new Error(ev.message || 'the voice model stopped'));
      this.calls.clear();
    };
    this.worker = w;
  }

  /** End the worker: the runtime's memory goes back to the phone. */
  end(): void {
    clearTimeout(this.idle);
    this.worker?.terminate();
    this.worker = null;
    this.loading = null;
    for (const [, c] of this.calls) c.bad(new Error('the voice model was ended'));
    this.calls.clear();
  }

  /**
   * The 256 numbers of a capture (16 kHz mono, -1 to 1), length 1; null when the model is not on this phone, could not start, or
   * there was too little speech to tell a voice by. Never throws.
   */
  async embed(pcm: Float32Array): Promise<number[] | null> {
    try {
      if (!(await this.onPhone())) return null;
      const fake = standIn();
      if (fake) {
        const e = await fake.embed(pcm);
        this.made++;
        return e && e.length === EMB_LEN && e.every(Number.isFinite) ? norm(e) : null;
      }
      const fb = fbank(pcm);
      if (!fb) return null;
      await this.load();
      clearTimeout(this.idle);
      const r = await this.ask({ op: 'run', input: fb.data, frames: fb.frames });
      this.idle = window.setTimeout(() => this.end(), IDLE_MS);
      this.made++;
      const out = r.data ? Array.from(r.data) : [];
      return out.length === EMB_LEN && out.every(Number.isFinite) ? norm(out) : null;
    } catch (e) {
      // a model that cannot start on this phone is given up for the session (the features judge); a one-off miss is just a miss
      if (/not on this phone|no available backend|WebAssembly|SIMD|Worker/i.test(rawText(e))) {
        trail(e, 'voice model');
        this.broken = 'The voice model would not start on this phone.';
      }
      return null;
    }
  }
}

export const speaker = new Engine();
onSpeakerPack(() => speaker.forget());
/** The embedding of a capture, or null (the model is not on the phone, or not enough speech). */
export const embed = (pcm: Float32Array): Promise<number[] | null> => speaker.embed(pcm);
/** Is the model on this phone and able to run? */
export const modelReady = (): Promise<boolean> => speaker.onPhone();
