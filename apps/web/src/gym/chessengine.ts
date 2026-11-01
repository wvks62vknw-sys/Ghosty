/**
 * THE ENGINE ON THE PHONE (BRIEF-REST-B part 1): Stockfish 19 (the "lite", single-threaded WebAssembly build the npm package
 * `stockfish` ships; vendored in /vendor/stockfish with its licence and source note) in a Web Worker, spoken to in UCI. It is
 * loaded on the first rated game or hint, never at start-up; it needs no special headers (single-threaded) and nothing leaves
 * the phone. The Worker answers each command with lines of text (`postMessage`), read here by gym/chessuci.ts.
 *
 * The specs stand an engine in (window.__ghostyChessEngine, honoured only under a test runner) where the real one would be
 * too slow for the spec's clock, as they do for the pose model.
 */
import { type ChessLevel, levelById } from './chessrate';
import { FULL_STRENGTH, goFor, levelCommands, parseBestmove, parseInfo, parseOption, type Info } from './chessuci';
import type { Score } from './chessreview';

export const ENGINE_URL = '/vendor/stockfish/stockfish-19-lite-single.js';

/** What the rest of the page needs from an engine. */
export interface ChessEngine {
  /** Its move (UCI) for the position, at a level; null when there is none. */
  play(fen: string, level: ChessLevel): Promise<{ move: string; score: Score } | null>;
  /** Its best move and score at full strength for a moment (the hint, the check after a game). */
  best(fen: string, ms: number): Promise<{ move: string | null; score: Score }>;
  close(): void;
}

class UciEngine implements ChessEngine {
  private w: Worker;
  private lines: ((l: string) => void)[] = [];
  private ready: Promise<void>;
  private range = { min: 1320, max: 3190 };
  private busy: Promise<unknown> = Promise.resolve();
  constructor() {
    this.w = new Worker(ENGINE_URL);
    this.w.onmessage = (e: MessageEvent) => {
      const text = typeof e.data === 'string' ? e.data : '';
      for (const l of text.split('\n')) if (l.trim()) for (const f of [...this.lines]) f(l.trim());
    };
    this.ready = this.start();
  }
  private send(cmd: string) {
    this.w.postMessage(cmd);
  }
  /** Send `cmd`; collect lines until one satisfies `until`. */
  private ask(cmd: string, until: (l: string) => boolean, timeout = 20_000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const got: string[] = [];
      const t = setTimeout(() => {
        this.lines = this.lines.filter((f) => f !== on);
        reject(new Error('the engine did not answer'));
      }, timeout);
      const on = (l: string) => {
        got.push(l);
        if (until(l)) {
          clearTimeout(t);
          this.lines = this.lines.filter((f) => f !== on);
          resolve(got);
        }
      };
      this.lines.push(on);
      this.send(cmd);
    });
  }
  private async start() {
    const out = await this.ask('uci', (l) => l === 'uciok', 30_000);
    const elo = out.map(parseOption).find((o) => o?.name === 'UCI_Elo');
    if (elo?.min !== undefined && elo.max !== undefined) this.range = { min: elo.min, max: elo.max };
    this.send('setoption name Hash value 16');
    await this.ask('isready', (l) => l === 'readyok');
  }
  /** One job at a time: the engine has one board. */
  private queue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.busy.then(() => this.ready).then(job);
    this.busy = run.catch(() => undefined);
    return run;
  }
  play(fen: string, level: ChessLevel) {
    return this.queue(async () => {
      for (const c of levelCommands(level, this.range)) this.send(c);
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      let last: Info = {};
      const out = await this.ask(goFor(level), (l) => {
        const i = parseInfo(l);
        if (i && (i.cp !== undefined || i.mate !== undefined)) last = i;
        return l.startsWith('bestmove');
      });
      const bm = parseBestmove(out[out.length - 1]!);
      return bm ? { move: bm.move, score: { cp: last.cp ?? null, mate: last.mate ?? null } } : null;
    });
  }
  best(fen: string, ms: number) {
    return this.queue(async () => {
      for (const c of FULL_STRENGTH) this.send(c);
      this.send(`position fen ${fen}`);
      let last: Info = {};
      const out = await this.ask(`go movetime ${ms}`, (l) => {
        const i = parseInfo(l);
        if (i && (i.cp !== undefined || i.mate !== undefined)) last = i;
        return l.startsWith('bestmove');
      });
      const bm = parseBestmove(out[out.length - 1]!);
      // a checkmated or stalemated position has no move: a mate of 0 for the side to move, or level
      const score: Score = last.cp === undefined && last.mate === undefined ? { cp: 0, mate: null } : { cp: last.cp ?? null, mate: last.mate ?? null };
      return { move: bm?.move ?? null, score };
    });
  }
  close() {
    try {
      this.w.postMessage('quit');
    } catch {
      /* already gone */
    }
    this.w.terminate();
  }
}

let engine: ChessEngine | null = null;

/** The engine, started on first use (the specs' stand-in under a test runner). */
export function chessEngine(): ChessEngine {
  const w = window as unknown as { __ghostyChessEngine?: ChessEngine };
  if (navigator.webdriver && w.__ghostyChessEngine) return w.__ghostyChessEngine;
  engine ??= new UciEngine();
  return engine;
}

/** Let go of the engine's Worker (its memory) when the rated page is left. */
export function closeChessEngine(): void {
  engine?.close();
  engine = null;
}

export { levelById };
