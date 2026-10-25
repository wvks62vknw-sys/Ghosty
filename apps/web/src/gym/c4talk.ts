/**
 * What Ghosty says about the games he plays with the owner (light: the page imports it; no engine). The lines
 * come only from what happened — the games kept on this phone, the solver's study of a loss, his own reasons
 * for his moves — never from a template that could say something untrue. One voice: first person, few words,
 * exact. With no games yet, the lines say so.
 */

/** What a study found (made in the worker by c4study.ts; kept with the game). */
export interface Study {
  /** Stones on the board when the owner's winning stone landed ("move 23"), 0 if the owner did not win. */
  wonAt: number;
  /** The owner's winning idea in words ("a double threat on columns 3 and 5"). */
  idea: string;
  kind: 'double' | 'stacked' | 'odd' | 'even' | 'under' | 'four' | 'none';
  /** Ghosty's first move proved to give the result away: its stone number, the column he played (0–6), the columns that held, and what they held (1 win, 0 draw; null not lost by force, the rest not proved). */
  turn: { at: number; played: number; held: number[]; value: number | null } | null;
  /** Positions the solver labelled for the network. */
  labelled: number;
  /** Every position up to the turning point was solved. */
  complete: boolean;
}

/** One game the owner played him, kept on the phone. */
export interface OwnerGame {
  /** When it ended (ms). */
  at: number;
  /** Columns played (0–6), from the empty board. */
  moves: number[];
  /** Ghosty's side: 1 he moved first, 2 the owner did. */
  ghosty: 1 | 2;
  result: 'you' | 'me' | 'draw';
  /** His reason for each of his moves, in order, with what decided it. */
  why: { r: string; k?: string }[];
  /** The study of a game the owner won (null: not studied yet). */
  study?: Study | null;
  /** Played by a test, not the owner: left out of everything he is told. */
  spec?: boolean;
}

const s = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
const real = (games: OwnerGame[]) => games.filter((g) => !g.spec);
/** Games the owner won that Ghosty has studied: his lessons. */
export const lessons = (games: OwnerGame[]) => real(games).filter((g) => g.result === 'you' && g.study).length;

/** "You've taught me 3 lessons; I've won 2 of the last 5." (or what there is so far). */
export function countLine(games: OwnerGame[]): string {
  const g = real(games);
  if (!g.length) return 'We haven’t played yet.';
  const last = g.slice(-5);
  const won = last.filter((x) => x.result === 'me').length;
  const n = lessons(g);
  const only = last[0]!.result;
  const record = g.length === 1 ? (only === 'me' ? 'I won our only game' : only === 'draw' ? 'our only game was a draw' : 'you won our only game') : `I’ve won ${won} of ${g.length > 5 ? 'the last 5' : `our ${g.length}`}`;
  const cap = (x: string) => `${x[0]!.toUpperCase()}${x.slice(1)}`;
  return n ? `You’ve taught me ${s(n, 'lesson')}; ${record}.` : `${cap(record)}.`;
}

/** The short line on the GYM card. */
export function cardLine(games: OwnerGame[]): string {
  const g = real(games);
  const last = g.at(-1);
  if (!last) return 'We haven’t played yet.';
  if (last.result === 'you' && !last.study) return `You won at move ${last.moves.length}. Studying it.`;
  const n = lessons(g);
  if (n) return `You’ve taught me ${s(n, 'lesson')}.`;
  const won = g.slice(-5).filter((x) => x.result === 'me').length;
  return g.length === 1 ? (won ? 'I won our first game.' : 'A draw, our first game.') : `I’ve won ${won} of ${g.length > 5 ? 'the last 5' : `our ${g.length}`}.`;
}

/** The first of his moves in a game where he saw a trap or used a lesson: its stone number and which. */
function sawTrap(g: OwnerGame): { at: number; lesson: boolean } | null {
  const mine = (i: number) => (g.ghosty === 1 ? 2 * i + 1 : 2 * i + 2);
  for (let i = 0; i < g.why.length; i++) {
    const w = g.why[i]!;
    if (w.k === 'lesson') return { at: mine(i), lesson: true };
    if (/lose by force|loses by force/.test(w.r)) return { at: mine(i), lesson: false };
  }
  return null;
}

/** The line before a rematch: about the last game, then the count. */
export function screenLine(games: OwnerGame[]): string {
  const g = real(games);
  const last = g.at(-1);
  if (!last) return 'We haven’t played yet. You move first.';
  if (last.result === 'you') {
    const st = last.study;
    if (!st) return `You beat me at move ${last.moves.length}. I’m studying it.`;
    return `You beat me at move ${st.wonAt || last.moves.length}${st.idea ? ` with ${st.idea}` : ''}. I’ve studied it. Play me again.`;
  }
  if (last.result === 'me') {
    const trap = sawTrap(last);
    const before = g.slice(0, -1).some((x) => x.result === 'you');
    if (trap?.lesson) return `I remembered your lesson at move ${trap.at}.`;
    if (trap && before) return `I saw the trap at move ${trap.at} this time.`;
    if (trap) return `I saw the trap at move ${trap.at}.`;
    return `I won at move ${last.moves.length}.`;
  }
  return `A draw. The board is full.`;
}

/** The review after a game: the moments that mattered, each with its move number. */
export function review(g: OwnerGame): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  const mine = (i: number) => (g.ghosty === 1 ? 2 * i + 1 : 2 * i + 2);
  for (let i = 0; i < g.why.length; i++) {
    const w = g.why[i]!;
    if (!w.r || !['block', 'lesson', 'lost', 'book'].includes(w.k ?? '') && !/by force/.test(w.r)) continue;
    // a proved line said once is enough ("Column 3 wins by force." every move after is not news)
    if (out.some((o) => o.text === w.r)) continue;
    out.push({ at: mine(i), text: w.r });
  }
  const st = g.study;
  if (st?.turn) {
    const t = st.turn;
    const held = t.held.map((c) => c + 1);
    const what = t.value === 1 ? 'won' : t.value === 0 ? 'held the draw' : 'held';
    out.push({ at: t.at, text: `I played column ${t.played + 1}. ${held.length > 1 ? `Columns ${held.slice(0, -1).join(', ')} or ${held.at(-1)}` : `Column ${held[0]}`} ${what}.` });
  } else if (st && g.result === 'you') {
    out.push({ at: 0, text: st.complete ? 'Every move I made was already lost: the mistake was before I could see.' : 'Where I went wrong is earlier than I can prove yet. I’ll keep solving it.' });
  }
  if (st?.idea && g.result === 'you') out.push({ at: st.wonAt || g.moves.length, text: `Your ${st.idea.replace(/^an? /, '')}.` });
  return out.sort((a, b) => a.at - b.at).slice(-6);
}

// ---- the GYM's greeting: what changed since he last looked ----------------------------------------------------------

/** What the greeting counts. */
export interface Totals {
  /** Lessons from the owner (studied losses). */
  lessons: number;
  /** Games he played against himself (the board games' training games). */
  self: number;
  /** Positions he has proved and keeps. */
  solved: number;
  /** Games the owner played him. */
  played: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "yesterday", "earlier today", "Tuesday", "12 October" (UK). */
export function since(then: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const days = Math.round((day(now) - day(then)) / 86_400_000);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days < 7) return DAYS[new Date(then).getDay()]!;
  return new Date(then).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/** "Since yesterday: 2 lessons from you, 4,000 games against myself." — or null when there is nothing to compare with. */
export function greeting(seen: { at: number; t: Totals } | null | undefined, now: Totals, at: number): string | null {
  if (!seen) return null;
  const parts: string[] = [];
  const d = (k: keyof Totals) => Math.max(0, now[k] - seen.t[k]);
  if (d('played')) parts.push(`${s(d('played'), 'game')} with you`);
  if (d('lessons')) parts.push(`${s(d('lessons'), 'lesson')} from you`);
  // (thousands to the nearest hundred: "4,000 games", not "4,013")
  const self = d('self') >= 1000 ? Math.round(d('self') / 100) * 100 : d('self');
  if (self) parts.push(`${s(self, 'game')} against myself`);
  if (d('solved')) parts.push(`${s(d('solved'), 'position')} solved`);
  return `Since ${since(seen.at, at)}: ${parts.length ? parts.join(', ') : 'nothing new'}.`;
}
