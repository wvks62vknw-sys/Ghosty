/**
 * Asks that reach the studio from outside it (the chat's "make a game", "sketch a cave room with two ledges"): kept until the
 * studio screen is on and ready to take them. Plain data, no screen.
 */
export interface StudioAsk {
  /** 'new' opens the templates; 'sketch' draws a draft room from the words. */
  what: 'list' | 'new' | 'sketch' | 'open';
  wish?: string;
  /** A game to open in the editor (the arcade's EDIT). */
  id?: string;
  template?: string;
}
let waiting: StudioAsk | null = null;
let taker: ((a: StudioAsk) => void) | null = null;
export const ask = (a: StudioAsk): void => {
  if (taker) taker(a);
  else waiting = a;
};
export const takeAsks = (fn: (a: StudioAsk) => void): (() => void) => {
  taker = fn;
  if (waiting) {
    const a = waiting;
    waiting = null;
    fn(a);
  }
  return () => {
    if (taker === fn) taker = null;
  };
};
/** What the hub card and the deck say, kept current by the studio and by a light read when the hub opens. */
export const info = { games: 0, last: '', loaded: false };
