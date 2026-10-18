/**
 * The GYM's puzzles as training tasks for the offline brain's weekly run (apps/edge/src/selftrain,
 * training/kaggle). A task is only (game, level, seed): `makeTask` builds the question from it and
 * `checkTask` builds it again and checks an answer with the game's own exact checker, so nothing but
 * those three numbers ever travels. The notebook runs these in node from a bundle
 * (training/kaggle/build.mjs → tasks.mjs). Pure.
 */
import { lvl } from './core';
import { GAMES, gameById } from './index';

/** What the model is asked after the puzzle: think briefly, then the answer alone on the last line (core.ts `finalLine` reads it). */
export const ANSWER_HINT = 'Think it through briefly, then give only the final answer on the last line.';

export interface GymTask {
  game: string;
  level: number;
  seed: number;
  prompt: string;
}

/** The games that make checkable puzzles (every game in the GYM does). */
export const TASK_GAMES = (): string[] => GAMES.map((g) => g.id);

export function makeTask(game: string, level: number, seed: number): GymTask {
  const g = gameById(game);
  if (!g) throw new Error(`no game ${game}`);
  const p = g.generate(lvl(level), seed >>> 0);
  return { game, level: lvl(level), seed: seed >>> 0, prompt: `${p.text}\n\n${ANSWER_HINT}` };
}

/** The game's verdict on an answer (score 0–1: partial credit where the game gives it). */
export function checkTask(game: string, level: number, seed: number, answer: string): { correct: boolean; score: number; why: string } {
  const g = gameById(game);
  if (!g) return { correct: false, score: 0, why: `no game ${game}` };
  try {
    const v = g.check(g.generate(lvl(level), seed >>> 0), answer);
    return { correct: !!v.correct, score: Math.max(0, Math.min(1, Number(v.score) || 0)), why: String(v.why ?? '') };
  } catch (e) {
    return { correct: false, score: 0, why: `the checker failed: ${String((e as Error)?.message ?? e).slice(0, 120)}` };
  }
}
