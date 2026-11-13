/**
 * THE WORKBENCH'S WORDS (BRIEF-QUALITY-MAKE): the lines it says in his voice, in one place and with no DOM, so the spec reads the very
 * words the page is built from. FIRST ESTIMATE · NOT CERTIFIED is the shared label (packages/shared/src/workbench), kept as it stands.
 * The solvers' numbers are never touched: a number is re-said with its unit, never re-computed.
 */

/** A number typed wrong, said beside its field: what was read, and what to type. */
export function badNumber(label: string, typed: string, unit = ''): string {
  const t = typed.trim();
  const inUnit = unit ? ` in ${unit}` : '';
  return t ? `“${t.slice(0, 16)}” isn’t a number I can read. Type the ${label.toLowerCase()}${inUnit}, like 12.` : `${label} is empty. Type a number${inUnit}.`;
}

/** A value that is only digits has no unit: the row says so in its own words (a ratio, a coefficient), never leaving it bare. */
const PLAIN = /^[−-]?\d[\d,.]*(?:\s?[–-]\s?\d[\d,.]*)?$/;
export function unitNote(label: string, value: string): string {
  if (!PLAIN.test(value.trim()) || /^steps$/i.test(label.trim())) return '';
  return /\b(?:Cl|Cd)\b|coefficient/i.test(label) ? 'a coefficient, no unit' : 'a ratio, no unit';
}
/** A row's note with the no-unit words joined on (a note a solver wrote is kept). */
export const noteWith = (note: string | undefined, extra: string): string => (extra ? (note ? `${note} · ${extra}` : extra) : note ?? '');

/** The wind tunnel: starting, stopped, and unable to run here. */
export const TUNNEL = {
  starting: 'Starting the wind…',
  stopped: 'The wind stopped. Tap RETRY and I’ll start it again.',
  cannot: 'I can’t run the wind tunnel on this phone just now. Tap RETRY to try again.',
  retry: 'RETRY',
};

/** The chat phrases that open the Workbench on the phone, listed in one line. */
export const PHRASES = ['beam calculator', 'the wind tunnel', '3 m steel beam 5 kN in the middle'];

/** COPY under an estimate (FINAL ROUND, MAKE lane): the estimate as text, its label always with it. */
export const COPY = {
  key: 'COPY',
  done: 'Copied, with “first estimate, not certified” at the top.',
  cannot: 'I can’t copy on this phone just now. Hold the numbers to select them.',
};
