/**
 * [sites] NEXT ROUND sites.u10: a game's high-score table, kept only on the phone that plays it (beside its saves, under its own
 * key), and a picture of a high score to share. No names are asked for and nothing is sent anywhere: each row is a score, whether
 * the game was won and the day it was played. The share card is drawn here, on the phone, and handed to the phone's own share sheet.
 */

export interface Score {
  score: number;
  won: boolean;
  /** When it was played (ms). */
  at: number;
}

/** How many rows the table keeps. */
export const TOP = 10;

/** The key the table lives under: the game's own save key, plus ":scores". */
export const scoresKey = (saveKey: string): string => `${saveKey}:scores`;

const isScore = (x: unknown): x is Score => {
  const s = x as Score;
  return !!s && typeof s === 'object' && Number.isFinite(s.score) && s.score >= 0 && typeof s.won === 'boolean' && Number.isFinite(s.at);
};

/** Read a kept table, dropping anything that is not a score row (a page may have kept anything under the key). */
export function readScores(raw: string | null): Score[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter(isScore).map((s) => ({ score: Math.floor(s.score), won: s.won, at: s.at })).sort(byScore).slice(0, TOP) : [];
  } catch {
    return [];
  }
}

/** Highest first; on a tie, the earlier one stays above. */
const byScore = (a: Score, b: Score): number => b.score - a.score || a.at - b.at;

/** Add a run to the table: the new top ten, and where the run landed (its place from 1, or 0 when it did not make the table). */
export function addScore(list: Score[], s: Score): { list: Score[]; place: number } {
  const all = [...list, s].sort(byScore).slice(0, TOP);
  return { list: all, place: all.indexOf(s) + 1 };
}

/** The line under GAME OVER or YOU DID IT. */
export function scoreLine(s: Score, list: Score[], place: number): string {
  const best = list[0]?.score ?? s.score;
  if (place === 1 && list.length > 1) return `Score ${s.score}: a new best!`;
  if (place === 1) return `Score ${s.score}: your first on this phone.`;
  if (place > 0) return `Score ${s.score}: number ${place} on this phone. Your best is ${best}.`;
  return `Score ${s.score}. Your best is ${best}.`;
}

/** A day in the table and on the card, said the British way ("14 Nov 2026"). */
export const dayOf = (at: number): string => new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The words on the share card, top to bottom. */
export function cardWords(game: string, s: Score): string[] {
  return [game.slice(0, 40), s.won ? 'I finished it with' : 'I scored', `${s.score}`, `points on ${dayOf(s.at)}`, 'Made in Ghosty’s game studio'];
}

/** The share card, 1080 × 1080, drawn on the phone: the game's sky, its name and the score. */
export function drawCard(c: HTMLCanvasElement, game: string, s: Score, sky: string): void {
  c.width = 1080;
  c.height = 1080;
  const g = c.getContext('2d');
  if (!g) return;
  g.fillStyle = /^#[0-9a-f]{6}$/i.test(sky) ? sky : 'black';
  g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(60, 60, 960, 960);
  g.fillStyle = 'white';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const [name = '', said = '', n = '', when = '', by = ''] = cardWords(game, s);
  const font = (px: number, w = 700) => `${w} ${px}px -apple-system, system-ui, sans-serif`;
  let px = 84;
  g.font = font(px);
  while (px > 40 && g.measureText(name).width > 880) g.font = font((px -= 4));
  g.fillText(name, 540, 250);
  g.font = font(52, 500);
  g.fillText(said, 540, 400);
  g.font = font(240, 800);
  g.fillText(n, 540, 580);
  g.font = font(52, 500);
  g.fillText(when, 540, 760);
  g.font = font(36, 500);
  g.fillText(by, 540, 920);
}

/** Share the card through the phone's share sheet; where there is none, save it as a picture. Says what happened, in words. */
export async function shareCard(c: HTMLCanvasElement, game: string): Promise<string> {
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) return 'This phone could not draw the picture.';
  const file = new File([blob], `${game.replace(/[^\w -]/g, '').trim().slice(0, 30) || 'game'} high score.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'Shared.';
    } catch {
      return 'Not shared.';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'Saved as a picture.';
}
