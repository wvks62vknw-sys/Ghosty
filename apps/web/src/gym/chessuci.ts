/**
 * The words of UCI, the language the vendored Stockfish speaks over postMessage (apps/web/public/vendor/stockfish): its lines
 * read in code, and the commands that set a level. Pure, so it is tested without the engine (apps/edge/test/restb.test.mjs).
 */
import type { ChessLevel } from './chessrate';
import { UCI_MAX, UCI_MIN } from './chessrate';

/** `option name UCI_Elo type spin default 1320 min 1320 max 3190` */
export interface UciOption {
  name: string;
  type: string;
  def?: string;
  min?: number;
  max?: number;
}

export function parseOption(line: string): UciOption | null {
  const m = /^option name (.+?) type (\w+)(?: default (.*?))?(?: min (-?\d+))?(?: max (-?\d+))?(?: var .*)?$/.exec(line.trim());
  if (!m) return null;
  return { name: m[1]!, type: m[2]!, ...(m[3] !== undefined ? { def: m[3] } : {}), ...(m[4] !== undefined ? { min: Number(m[4]) } : {}), ...(m[5] !== undefined ? { max: Number(m[5]) } : {}) };
}

/** What an `info` line says: the depth, the score (centipawns or mate in n, for the side to move) and the best line. */
export interface Info {
  depth?: number;
  cp?: number;
  mate?: number;
  pv?: string[];
  nps?: number;
}

export function parseInfo(line: string): Info | null {
  if (!line.startsWith('info ') || /\bstring\b/.test(line.split(' pv ')[0]!)) return null;
  const out: Info = {};
  const d = /\bdepth (\d+)/.exec(line);
  if (d) out.depth = Number(d[1]);
  const cp = /\bscore cp (-?\d+)/.exec(line);
  if (cp) out.cp = Number(cp[1]);
  const mate = /\bscore mate (-?\d+)/.exec(line);
  if (mate) out.mate = Number(mate[1]);
  const nps = /\bnps (\d+)/.exec(line);
  if (nps) out.nps = Number(nps[1]);
  const pv = / pv ((?:[a-h][1-8][a-h][1-8][qrbn]?\s*)+)/.exec(line);
  if (pv) out.pv = pv[1]!.trim().split(/\s+/);
  return out.cp === undefined && out.mate === undefined && out.pv === undefined ? null : out;
}

/** `bestmove e2e4 ponder e7e5` → "e2e4"; "(none)" (no legal move) → null. */
export function parseBestmove(line: string): { move: string; ponder?: string } | null {
  const m = /^bestmove (\S+)(?: ponder (\S+))?/.exec(line.trim());
  if (!m || m[1] === '(none)' || m[1] === '0000') return null;
  return { move: m[1]!, ...(m[2] ? { ponder: m[2] } : {}) };
}

/** The commands that make the engine play a level, given the range it reported (UCI_Elo's min and max). */
export function levelCommands(l: ChessLevel, range: { min: number; max: number } = { min: UCI_MIN, max: UCI_MAX }): string[] {
  if (l.kind === 'starter') return ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 0'];
  const elo = Math.min(range.max, Math.max(range.min, l.elo));
  return ['setoption name UCI_LimitStrength value true', `setoption name UCI_Elo value ${elo}`];
}

/** The commands that make it play its best (for a hint and for the check after a game). */
export const FULL_STRENGTH = ['setoption name UCI_LimitStrength value false', 'setoption name Skill Level value 20'];

/** The `go` for a level. */
export const goFor = (l: ChessLevel): string => (l.depth ? `go depth ${l.depth}` : `go movetime ${l.movetime}`);

/** A score as the side to move sees it, in centipawns; a mate is worth a great deal, a nearer one more (capped at ±3000). */
export function toCp(e: { cp?: number | null; mate?: number | null }): number {
  if (typeof e.mate === 'number') return e.mate === 0 ? -3000 : Math.sign(e.mate) * Math.max(1500, 3000 - 100 * Math.abs(e.mate));
  return Math.max(-3000, Math.min(3000, e.cp ?? 0));
}
