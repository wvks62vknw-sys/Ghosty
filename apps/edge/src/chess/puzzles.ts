/**
 * CHESS PUZZLES from Lichess's open puzzle database (CC0, public domain), through Lichess's public API: no key, no account,
 * never a player looked up. The phone can't reach other sites (its connect-src), so the brain fetches them, only when he taps.
 *  GET /chess/puzzles?n=10  a pack of up to 20 puzzles (each a few hundred bytes), for the phone to keep and solve offline.
 *  GET /chess/puzzles/daily  Lichess's puzzle of the day.
 * Each puzzle is kept as Lichess gives it: the game's moves up to the puzzle (SAN), and the solution (UCI), its rating and
 * themes. The phone sets up the position by playing the moves on its own board.
 */
export interface ChessPuzzle {
  id: string;
  rating: number;
  themes: string[];
  /** The game's moves up to the puzzle position, in SAN. */
  moves: string[];
  /** The solution in UCI, starting with his move. */
  solution: string[];
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const API = 'https://lichess.org/api/puzzle';
export const PACK_MAX = 20;

/** One puzzle from Lichess's answer, or null when it is not one. Pure. */
export function puzzleOf(x: unknown): ChessPuzzle | null {
  const o = x as { game?: { pgn?: unknown }; puzzle?: { id?: unknown; rating?: unknown; themes?: unknown; solution?: unknown } } | null;
  const p = o?.puzzle;
  const pgn = typeof o?.game?.pgn === 'string' ? o.game.pgn : '';
  if (!p || typeof p.id !== 'string' || !Array.isArray(p.solution) || !pgn) return null;
  const moves = pgn.replace(/\{[^}]*\}/g, ' ').split(/\s+/).filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).map((t) => t.replace(/^\d+\.+/, ''));
  const solution = p.solution.filter((m): m is string => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m));
  if (!moves.length || !solution.length) return null;
  return { id: p.id, rating: typeof p.rating === 'number' ? Math.round(p.rating) : 1500, themes: Array.isArray(p.themes) ? p.themes.filter((t): t is string => typeof t === 'string').slice(0, 6) : [], moves, solution };
}

async function one(path: string): Promise<ChessPuzzle | null> {
  const r = await fetch(`${API}/${path}`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Lichess answered ${r.status}`);
  return puzzleOf(await r.json());
}

export async function chessPuzzlesRoute(req: Request, path: string, method: string): Promise<Response> {
  if (method !== 'GET') return json({ error: 'GET only' }, 405);
  try {
    if (path === '/chess/puzzles/daily') {
      const p = await one('daily');
      return p ? json({ puzzle: p }) : json({ error: 'Lichess sent no puzzle of the day.' }, 502);
    }
    const n = Math.max(1, Math.min(PACK_MAX, Math.round(Number(new URL(req.url).searchParams.get('n') ?? 10) || 10)));
    const out: ChessPuzzle[] = [];
    // (one at a time: Lichess asks callers not to send requests in parallel)
    for (let i = 0; i < n * 2 && out.length < n; i++) {
      const p = await one('next').catch(() => null);
      if (p && !out.some((x) => x.id === p.id)) out.push(p);
    }
    if (!out.length) return json({ error: 'Lichess sent no puzzles just now.' }, 502);
    return json({ puzzles: out, source: 'Lichess puzzle database (CC0)' });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
}
