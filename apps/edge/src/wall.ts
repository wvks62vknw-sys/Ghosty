/**
 * THE WALL's brain side (BRIEF-MACHINE-WALL; STARS 165): a second screen of the same Ghosty, a television or a laptop, that shows what
 * his phone is talking about. Both screens already carry his own key, so the brain only joins them: the wall asks for a code (six
 * letters, no look-alikes, new every two minutes until used), the phone types it, and the two are one pair under his account. One
 * wall at a time; the pair is kept until LEAVE on either side or thirty days. The code never leaves his brain; a wrong code three
 * times waits a minute.
 *
 * The phone sends what the Stage draws from (a kind and its data: packages/shared/src/wall.ts is the one gate, the phone uses it first
 * and this file again) and the wall reads it through one long-poll stream. No schedule: nothing runs between a request and its answer.
 * A kind off the list is refused here too; the last picture is kept under the pair; with the phone silent for an hour the wall rests.
 *
 * Routes (owner only; under /guardian because that is where the feature routes already mount, apps/edge/src/guardian.ts):
 *   GET  /guardian/wall                   → WallInfo (THE WALL page)
 *   GET  /guardian/wall/stream?screen=…&seq=…&pair=…&hold=ms[&fresh=1] → WallFrame (answers at once when seq differs, else when it changes)
 *   POST /guardian/wall/pair   {code}     → WallInfo, or 400 wrong / 410 expired / 429 wait
 *   POST /guardian/wall/show   {kind,data,sentence,pair?} → WallInfo, or 422 "That stays on the phone."
 *   POST /guardian/wall/clear             → WallInfo (the wall rests)
 *   POST /guardian/wall/leave  {screen?}  → WallInfo (unpaired)
 */
import { CODE_LENGTH, CODE_LIFE, PAIR_LIFE, SILENCE, WALL_SAYS, WRONG_MAX, WRONG_WAIT, cleanCode, codeFrom, codeOk, footSentence, wallCheck, type WallFrame, type WallInfo, type WallPicture } from '../../../packages/shared/src/wall';

export const WALL_KEY = 'wall:state';

interface Pair {
  id: string;
  screen: string;
  at: number;
  /** The phone's last word to the wall (a picture or its clearing); the hour of silence counts from here. */
  lastAt: number;
  picture: WallPicture | null;
}
export interface WallState {
  /** Moves each time anything a wall can see changes. */
  seq: number;
  /** The codes on screens now, by screen. */
  codes: Record<string, { code: string; at: number }>;
  pair?: Pair;
  wrong: { n: number; until: number };
}

export interface WallDeps {
  storage: Pick<DurableObjectStorage, 'get' | 'put'>;
  now?: () => number;
}

const fresh = (): WallState => ({ seq: 1, codes: {}, wrong: { n: 0, until: 0 } });
const clock = (d: WallDeps) => (d.now ? d.now() : Date.now());
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Who is waiting on a change (the long polls), woken by anything that moves `seq`. */
const waiters = new Set<() => void>();
const wake = () => {
  for (const w of [...waiters]) w();
};

/** One change at a time: a read-change-write is never interleaved with another (the pair and its counters stay whole). */
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(f: () => Promise<T>): Promise<T> {
  const run = chain.then(f, f);
  chain = run.catch(() => undefined);
  return run;
}

async function load(d: WallDeps): Promise<WallState> {
  const s = (await d.storage.get(WALL_KEY)) as WallState | undefined;
  return s && typeof s.seq === 'number' ? { ...fresh(), ...s, codes: s.codes ?? {}, wrong: s.wrong ?? { n: 0, until: 0 } } : fresh();
}

/** What time has done since the last look: a code that ran out, a pair past its thirty days, a picture the phone went silent on. */
function settle(s: WallState, now: number): boolean {
  let changed = false;
  for (const [screen, c] of Object.entries(s.codes)) {
    if (now - c.at >= CODE_LIFE) {
      delete s.codes[screen];
      changed = true;
    }
  }
  if (s.pair && now - s.pair.at >= PAIR_LIFE) {
    delete s.pair;
    changed = true;
  }
  if (s.pair?.picture && now - s.pair.lastAt >= SILENCE) {
    s.pair.picture = null;
    changed = true;
  }
  if (changed) s.seq++;
  return changed;
}

/** The earliest moment time will change what a wall sees (so a long poll never sleeps through it). */
function nextDeadline(s: WallState, screen: string): number {
  const at: number[] = [];
  if (s.codes[screen]) at.push(s.codes[screen]!.at + CODE_LIFE);
  if (s.pair) {
    at.push(s.pair.at + PAIR_LIFE);
    if (s.pair.picture) at.push(s.pair.lastAt + SILENCE);
  }
  return at.length ? Math.min(...at) : Infinity;
}

function frameOf(s: WallState, screen: string, pair: string | undefined): WallFrame {
  if (s.pair && s.pair.screen === screen && (!pair || pair === s.pair.id)) return { seq: s.seq, state: 'paired', since: s.pair.at, picture: s.pair.picture, pair: s.pair.id };
  const c = s.codes[screen];
  return { seq: s.seq, state: 'unpaired', ...(c ? { code: c.code, expires: c.at + CODE_LIFE } : {}) };
}

function infoOf(s: WallState, now: number): WallInfo {
  const wait = s.wrong.until > now ? { retryAt: s.wrong.until } : {};
  if (!s.pair) return { paired: false, ...wait };
  const p = s.pair;
  return { paired: true, pair: p.id, since: p.at, expires: p.at + PAIR_LIFE, showing: p.picture ? { kind: p.picture.kind, sentence: p.picture.sentence, at: p.picture.at } : null, ...wait };
}

/** The stream: the wall's code (made when it asks and has none), or its pair's picture. Answers when `seq` differs, else on change. */
async function stream(d: WallDeps, url: URL): Promise<Response> {
  const screen = (url.searchParams.get('screen') ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  if (screen.length < 8) return json({ error: 'a wall names itself' }, 400);
  const pair = url.searchParams.get('pair') ?? undefined;
  const seen = Number(url.searchParams.get('seq') ?? -1);
  const hold = Math.max(0, Math.min(25_000, Number(url.searchParams.get('hold') ?? 20_000) || 0));
  // PAIR on the wall itself: a new code now, the old one spent
  let fresh = url.searchParams.get('fresh') === '1';
  const t0 = clock(d);
  for (;;) {
    const now = clock(d);
    // the waiter is in place BEFORE the look, so a change made while the look is being taken is never slept through
    let woke!: () => void;
    const rang = new Promise<void>((ok) => (woke = ok));
    waiters.add(woke);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const f = await locked(async () => {
        const s = await load(d);
        let changed = settle(s, now);
        if (fresh && s.codes[screen]) {
          delete s.codes[screen];
          changed = true;
        }
        fresh = false;
        if ((!s.pair || s.pair.screen !== screen) && !s.codes[screen]) {
          const bytes = new Uint8Array(CODE_LENGTH);
          crypto.getRandomValues(bytes);
          s.codes[screen] = { code: codeFrom(bytes), at: now };
          // (a few screens at most hold a code: the oldest goes)
          const all = Object.entries(s.codes).sort((a, b) => a[1].at - b[1].at);
          for (const [k] of all.slice(0, Math.max(0, all.length - 6))) delete s.codes[k];
          s.seq++;
          changed = true;
        }
        if (changed) await d.storage.put(WALL_KEY, s);
        return { frame: frameOf(s, screen, pair), until: nextDeadline(s, screen) };
      });
      if (f.frame.seq !== seen || hold === 0 || clock(d) - t0 >= hold) return json(f.frame);
      const left = Math.min(hold - (clock(d) - t0), Math.max(50, f.until - clock(d) + 30));
      await Promise.race([rang, new Promise<void>((ok) => (timer = setTimeout(ok, Math.max(50, left))))]);
    } finally {
      clearTimeout(timer);
      waiters.delete(woke);
    }
  }
}

async function pairWith(d: WallDeps, codeIn: unknown): Promise<Response> {
  const now = clock(d);
  return locked(async () => {
    const s = await load(d);
    let changed = settle(s, now);
    const save = async () => (changed ? d.storage.put(WALL_KEY, s) : undefined);
    if (s.wrong.until > now) {
      await save();
      return json({ error: WALL_SAYS.wait, wait: true, retryAt: s.wrong.until }, 429);
    }
    const code = cleanCode(String(codeIn ?? ''));
    const hit = codeOk(code) ? Object.entries(s.codes).find(([, c]) => c.code === code) : undefined;
    if (!hit) {
      // a code that ran out a moment ago is said to have run out, never counted as a guess at someone else's
      s.wrong.n++;
      changed = true;
      if (s.wrong.n >= WRONG_MAX) {
        s.wrong = { n: 0, until: now + WRONG_WAIT };
        await save();
        return json({ error: WALL_SAYS.wait, wait: true, retryAt: s.wrong.until }, 429);
      }
      await save();
      return json({ error: WALL_SAYS.wrong, left: WRONG_MAX - s.wrong.n }, 400);
    }
    s.wrong = { n: 0, until: 0 };
    // one wall at a time: the new pair replaces any older one, and every code is spent
    s.pair = { id: crypto.randomUUID().replace(/-/g, '').slice(0, 16), screen: hit[0], at: now, lastAt: now, picture: null };
    s.codes = {};
    s.seq++;
    await d.storage.put(WALL_KEY, s);
    wake();
    return json(infoOf(s, now));
  });
}

async function show(d: WallDeps, body: Record<string, unknown>): Promise<Response> {
  const now = clock(d);
  return locked(async () => {
    const s = await load(d);
    const changed = settle(s, now);
    if (!s.pair) {
      if (changed) await d.storage.put(WALL_KEY, s);
      return json({ error: WALL_SAYS.noPair, none: true }, 404);
    }
    if (typeof body.pair === 'string' && body.pair !== s.pair.id) return json({ error: WALL_SAYS.noPair, none: true }, 409);
    const v = wallCheck(body.kind, body.data);
    if (!v.ok) return json({ error: WALL_SAYS.stays, refused: true, why: v.why }, 422);
    s.pair.picture = { kind: v.kind, data: v.data, sentence: footSentence(typeof body.sentence === 'string' ? body.sentence : '', ''), at: now };
    s.pair.lastAt = now;
    s.seq++;
    await d.storage.put(WALL_KEY, s);
    wake();
    return json(infoOf(s, now));
  });
}

async function clear(d: WallDeps): Promise<Response> {
  const now = clock(d);
  return locked(async () => {
    const s = await load(d);
    settle(s, now);
    if (s.pair) {
      s.pair.picture = null;
      s.pair.lastAt = now;
    }
    s.seq++;
    await d.storage.put(WALL_KEY, s);
    wake();
    return json(infoOf(s, now));
  });
}

async function leave(d: WallDeps, screen: unknown): Promise<Response> {
  const now = clock(d);
  return locked(async () => {
    const s = await load(d);
    settle(s, now);
    // from the wall, only its own pairing goes; from the phone (no screen named), whichever wall is paired
    if (s.pair && (typeof screen !== 'string' || !screen || screen === s.pair.screen)) delete s.pair;
    s.codes = {};
    s.seq++;
    await d.storage.put(WALL_KEY, s);
    wake();
    return json(infoOf(s, now));
  });
}

export async function wallRoute(req: Request, path: string, method: string, d: WallDeps): Promise<Response> {
  const url = new URL(req.url);
  const body = async () => ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  if (path === '/guardian/wall' && method === 'GET') {
    const now = clock(d);
    return locked(async () => {
      const s = await load(d);
      if (settle(s, now)) await d.storage.put(WALL_KEY, s);
      return json(infoOf(s, now));
    });
  }
  if (path === '/guardian/wall/stream' && method === 'GET') return stream(d, url);
  if (path === '/guardian/wall/pair' && method === 'POST') return pairWith(d, (await body()).code);
  if (path === '/guardian/wall/show' && method === 'POST') return show(d, await body());
  if (path === '/guardian/wall/clear' && method === 'POST') return clear(d);
  if (path === '/guardian/wall/leave' && method === 'POST') return leave(d, (await body()).screen);
  return json({ error: 'not found' }, 404);
}
