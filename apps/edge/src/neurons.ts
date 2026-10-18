/**
 * The Workers AI ledger: one count of the free daily allowance (10,000 neurons, reset at
 * midnight UTC) shared by everything that uses it — hearing (Whisper), the fallback brain (the
 * LLM through the router), Ghosty's voices (Aura, MeloTTS), library meaning vectors,
 * translation and pictures — so together they never run past it, and the important uses keep
 * room: each use must leave a reserve free for the uses above it.
 *
 *   hearing (stt)            leaves nothing: the owner talking always comes first
 *   the fallback brain       leaves  300 for hearing
 *   the plain voice (Melo)   leaves  800
 *   vectors, translation     leaves 1,500
 *   pictures                 leaves 2,500
 *   background model work    leaves 3,500 (study, projects, the weekly self-training factory: the router's 'background' lane)
 *   the natural voice (Aura) leaves 4,000, and spends at most VOICE_SHARE a day
 *
 * Neurons are Cloudflare's billing unit; the numbers here are estimates from the published
 * per-model prices (workers-ai/platform/pricing), rounded up. The day's counts are kept in the
 * Durable Object's storage (key `ai:neurons`), so a restart or an eviction never forgets what
 * was spent: every check loads them first, and every charge saves them.
 */

export const FREE_NEURONS = 10_000;
/** The most the natural (Aura) voice may spend in a day: about 2,200 characters of Aura 1, or half that of Aura 2. */
export const VOICE_SHARE = 3_000;
export const NEURONS_KEY = 'ai:neurons';

export type AiUse = 'stt' | 'chat' | 'plain-voice' | 'embed' | 'translate' | 'image' | 'background' | 'voice';

/** What each use must leave free for the more important ones (see the file comment). */
export const LEAVE: Record<AiUse, number> = { stt: 0, chat: 300, 'plain-voice': 800, embed: 1500, translate: 1500, image: 2500, background: 3500, voice: 4000 };

interface Day {
  d: string;
  used: number;
  by: Partial<Record<AiUse, number>>;
}

const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

/** Estimates, in neurons (rounded up; see the pricing page). */
export const cost = {
  /** Whisper large-v3-turbo: ~47 a minute of audio. A WAV's length is known; other recordings are taken at 4 KB a second (low, so the count errs high). */
  stt(bytes: number, mime = ''): number {
    const seconds = /wav/i.test(mime) ? Math.max(0, bytes - 44) / 32_000 : bytes / 4_000;
    return Math.max(1, Math.ceil((seconds / 60) * 47));
  },
  /** MeloTTS: ~19 a minute of speech (about 14 characters a second). */
  melo: (chars: number): number => Math.max(1, Math.ceil((chars / 14 / 60) * 19)),
  /** Aura 1 ~1.37 a character; Aura 2 twice that. */
  aura: (chars: number, units: 1 | 2): number => Math.ceil(chars * 1.37 * units),
  /** The fallback brain: ~0.05 a token, a middle figure across the Workers AI chat models. */
  chat: (tokens: number): number => Math.max(1, Math.ceil(tokens * 0.05)),
  /** bge-small vectors: next to nothing (~2 per million tokens), one per call at least. */
  embed: (chars: number): number => Math.max(1, Math.ceil(chars / 4 / 500_000)),
  /** m2m100 translation: one per 1,000 characters at least. */
  translate: (chars: number): number => Math.max(1, Math.ceil(chars / 1000)),
  /** A FLUX schnell picture, 4 steps at 1024 px: ~80. */
  image: (steps = 4): number => Math.ceil(20 * Math.max(1, steps)),
};

export class NeuronLedger {
  private day: Day = { d: today(), used: 0, by: {} };
  private loading: Promise<void> | null = null;
  private saving: Promise<void> = Promise.resolve();

  constructor(private storage: DurableObjectStorage | null = null) {}

  private async load(now: number): Promise<void> {
    // Once per brain: the stored count of the day (loads that overlap share the one read).
    this.loading ??= (async () => {
      const s = this.storage ? await this.storage.get<Day>(NEURONS_KEY).catch(() => undefined) : undefined;
      if (s && s.d === this.day.d) {
        this.day.used += Number(s.used) || 0;
        for (const [k, v] of Object.entries(s.by ?? {})) this.day.by[k as AiUse] = (this.day.by[k as AiUse] ?? 0) + (Number(v) || 0);
      }
    })();
    await this.loading;
    if (this.day.d !== today(now)) this.day = { d: today(now), used: 0, by: {} };
  }

  /** Is there room for `n` neurons of this use today, leaving its reserve (and, for the natural voice, within its share)? */
  async room(use: AiUse, n: number, now = Date.now()): Promise<boolean> {
    await this.load(now);
    if (this.day.used + n > FREE_NEURONS - LEAVE[use]) return false;
    if (use === 'voice' && (this.day.by.voice ?? 0) + n > VOICE_SHARE) return false;
    return true;
  }

  /** Count `n` neurons spent on this use, and keep the count. */
  async charge(use: AiUse, n: number, now = Date.now()): Promise<void> {
    await this.load(now);
    this.day.used += n;
    this.day.by[use] = (this.day.by[use] ?? 0) + n;
    if (!this.storage) return;
    const snap = structuredClone(this.day);
    this.saving = this.saving.then(() => this.storage!.put(NEURONS_KEY, snap)).catch(() => undefined);
    await this.saving;
  }

  async today(now = Date.now()): Promise<{ used: number; by: Partial<Record<AiUse, number>> }> {
    await this.load(now);
    return { used: this.day.used, by: { ...this.day.by } };
  }
}

const ledgers = new WeakMap<object, NeuronLedger>();
let current: NeuronLedger | null = null;

/** The ledger kept in this storage (one per Durable Object); the latest bound is the one `neurons()` answers with. */
export function bindNeurons(storage: DurableObjectStorage): NeuronLedger {
  let l = ledgers.get(storage);
  if (!l) ledgers.set(storage, (l = new NeuronLedger(storage)));
  current = l;
  return l;
}

/**
 * The ledger of this brain. Bound when the brain's router is made (llm/quota.ts quotaFor, in the
 * Durable Object's constructor), so it is in place before any request; outside a brain (a unit
 * test) it counts in memory only.
 */
export function neurons(): NeuronLedger {
  return current ?? (current = new NeuronLedger(null));
}

/** Tests only: forget the bound ledger. */
export function _resetNeurons(): void {
  current = null;
}
