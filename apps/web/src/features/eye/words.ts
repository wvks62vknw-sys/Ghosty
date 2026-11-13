/**
 * GOD'S EYE'S WORDS (BRIEF-QUALITY-SEE): the lines the globe says in his voice, in one place and with no DOM, so the spec reads the very
 * words the page is built from. Every number on a card carries its unit and where it came from.
 */
const thousands = (x: number): string => Math.round(x).toLocaleString('en-GB');

export const cardWords = {
  /** "36,000 feet · FL360": the plane's own height, in feet as pilots say it. */
  altitude: (ft: number): string => `${thousands(ft)} feet · FL${String(Math.round(ft / 100)).padStart(3, '0')}`,
  altitudeNote: 'from the feed',
  /** "412 knots" (a ship's with one decimal: "12.3 knots"). */
  knots: (kt: number, dp = 0): string => `${dp ? kt.toFixed(dp) : thousands(kt)} ${Math.round(kt * 10 ** dp) / 10 ** dp === 1 ? 'knot' : 'knots'}`,
  /** "5 hours", "less than an hour", "now": time to a launch, from the schedule. */
  hours: (ms: number): string => {
    if (ms <= 0) return 'now';
    const h = Math.round(ms / 36e5);
    return h < 1 ? 'less than an hour' : h < 48 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : `${Math.round(h / 24)} days`;
  },
};

/** A search that found nothing: what was looked for and what to try. */
export const noFindWords = (s: string): string => `I couldn’t find “${s}”. Try a town, a flight number or a ship’s name.`;
/** A search with no signal for a place the globe does not hold itself. */
export const noSignalFindWords = (s: string): string => `No signal, so I can’t look up “${s}”. The globe’s cities and your saved places still work.`;

/** The cameras' grid when none are near the view. */
export const noCamerasWords = 'No public cameras near here. Zoom out, or search a town.';

/** A camera's picture: while it opens, when it will not come, when its clip or stream will not play. */
export const CAM_CONNECTING = 'Connecting to the camera…';
export const CAM_DOWN = 'I can’t reach this camera just now.';
export const CLIP_DOWN = 'This clip won’t play.';
export const STREAM_DOWN = 'This live video won’t play.';
