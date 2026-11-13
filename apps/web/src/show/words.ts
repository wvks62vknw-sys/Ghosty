/**
 * THE STAGE'S WORDS (BRIEF-QUALITY-CHAT 4): the line said while a picture is drawn (with the kind of picture), and the one line of why
 * when there is nothing to draw. Pure (no screen): show/stage.ts says them and the spec reads this same file. Ghosty's voice, one sentence each.
 */

/** What he is drawing while the Stage's picture is on its way, from his own words (the kind is known before the picture is). */
export function drawingWords(ask: string): string {
  const t = ask.toLowerCase();
  if (/\b(chart|graph|plot|bars?|compare|spending)\b/.test(t)) return 'Drawing the chart…';
  if (/\b(map|where is|where's|take me to)\b/.test(t)) return 'Drawing the map…';
  if (/\b(globe|god'?s eye)\b/.test(t)) return 'Drawing the globe…';
  if (/\b(room|desk|table|bed|sofa|shelf|wardrobe|cabinet|bookcase)\b/.test(t)) return 'Drawing it in 3-D…';
  if (/\b(letter|write|draft|itinerary|schedule|plan)\b/.test(t)) return 'Laying out the page…';
  if (/\b(beam|wind|orbit|gear|simulat|projectile|pendulum)\b/.test(t)) return 'Working out the picture…';
  return 'Drawing it…';
}

/**
 * Why there is no picture, when he asked for one and there is nothing to draw it from: one line and no plate (never an empty one).
 * Null when he did not ask for a picture at all (an answer with nothing to show says nothing about it).
 */
export function noPictureWords(ask: string): string | null {
  const t = ask.toLowerCase();
  if (/\b(chart|graph|plot|bars?)\b/.test(t)) return 'I have no numbers to draw that. Give me a few and I’ll chart them.';
  if (/\b(map|globe|god'?s eye)\b/.test(t)) return 'I can’t place that on a map yet. Name a city, or a place you saved.';
  if (/\b(draw|diagram|picture of|sketch)\b/.test(t)) return 'I have nothing to draw for that yet.';
  return null;
}
export const NO_PICTURE_LABEL = 'NO PICTURE';
/** The picture could not be drawn (something went wrong on the way): one line, and the sentence he has stays as it was. */
export const NO_PICTURE_BROKE = 'I couldn’t draw that just now. What I said is above.';
