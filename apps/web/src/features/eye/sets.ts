/**
 * ONE-TAP LAYER SETS (NEXT ROUND, see.u3): God's Eye's layers in three sets he can pick at once instead of flicking switches:
 * COMMUTE (the roads), STORM (the weather and hazards), SKY (planes, satellites and their orbits). Pure, so the spec reads them.
 */
export type SetKey = 'commute' | 'storm' | 'sky';
export interface LayerSet {
  key: SetKey;
  name: string;
  /** The layers it turns on; the others it lists in `off` go quiet so the set reads clearly. */
  on: string[];
  off: string[];
  /** Said when it is picked. */
  said: string;
}
export const LAYER_SETS: LayerSet[] = [
  { key: 'commute', name: 'COMMUTE', on: ['cams', 'traffic', 'incidents', 'transit', 'enforce'], off: ['air', 'ships', 'sats', 'orbits', 'quakes', 'events', 'disasters', 'aurora', 'buoys', 'dispatch'], said: 'Commute: cameras, traffic, road incidents, buses and trams, and safety cameras on.' },
  { key: 'storm', name: 'STORM', on: ['radar', 'alerts', 'disasters', 'quakes', 'events', 'clouds'], off: ['air', 'ships', 'sats', 'orbits', 'transit', 'enforce', 'crime', 'dispatch'], said: 'Storm: rain radar, weather alerts, disasters, quakes, events and clouds on.' },
  { key: 'sky', name: 'SKY', on: ['air', 'sats', 'orbits'], off: ['transit', 'enforce', 'crime', 'incidents', 'dispatch', 'radar', 'alerts'], said: 'Sky: aircraft, satellites and their orbits on.' },
];
/** His words for a set: "commute view", "show me the storm layers", "sky mode", "the sky set". */
export function setAsked(text: string): SetKey | null {
  const t = text.trim().toLowerCase().replace(/[?.!]+$/, '');
  const m = /^(?:(?:show|give) me |switch to |turn on |put on |use )?(?:the )?(commute|commuting|storm|weather|sky)(?: (?:view|mode|set|layers|map))$/.exec(t) ?? /^(?:show|give) me the (commute|storm|sky)$/.exec(t);
  if (!m) return null;
  return m[1] === 'commuting' ? 'commute' : m[1] === 'weather' ? 'storm' : (m[1] as SetKey);
}
/** His words for his camera wall (wall.ts): "my camera wall", "show my cameras", "open the camera wall". */
export const WALL_ASK = /^(?:(?:hey |ok )?(?:ghosty,? )?)(?:(?:show|open|give)(?: me)? )?(?:my|the) (?:camera wall|wall of cameras|cameras wall|pinned cameras)$|^(?:(?:show|open)(?: me)? )?my cameras$|^camera wall$/i;

/** The line for home from the next two hours in quarter hours (mm of rain each); pure, so the spec reads it. */
export function rainLine(slots: { t: number; mm: number }[], now: number, place: string): string {
  const next = slots.filter((s) => s.t + 15 * 60_000 > now).slice(0, 8);
  if (!next.length) return '';
  const wet = next.find((s) => s.mm >= 0.1);
  const raining = next[0]!.mm >= 0.1;
  const kind = (mm: number) => (mm >= 4 ? 'heavy rain' : mm >= 1 ? 'rain' : 'light rain');
  if (raining) {
    const dry = next.find((s) => s.mm < 0.1);
    return dry ? `${kind(next[0]!.mm)[0]!.toUpperCase()}${kind(next[0]!.mm).slice(1)} at ${place} now, easing in about ${Math.max(15, Math.round((dry.t - now) / 60_000 / 5) * 5)} minutes.` : `${kind(next[0]!.mm)[0]!.toUpperCase()}${kind(next[0]!.mm).slice(1)} at ${place} now, for the next two hours.`;
  }
  if (!wet) return `No rain at ${place} in the next two hours.`;
  const mins = Math.max(5, Math.round((wet.t - now) / 60_000 / 5) * 5);
  return `${kind(wet.mm)[0]!.toUpperCase()}${kind(wet.mm).slice(1)} at ${place} in about ${mins} minutes.`;
}

/** His words for the radar: "rain radar", "show me the rain radar", "the rain map", "replay the rain". */
export const RAIN_ASK = /^(?:(?:hey |ok )?(?:ghosty,? )?)(?:(?:show|open|give)(?: me)? )?(?:the )?(?:rain radar|rain map|weather radar|radar)(?: for home)?$|^replay the (?:rain|radar)$/i;

/** A pass nudge (see.u4): the diary entry's title and what is said when it is added. */
export const passTitle = (name: string, max: number): string => `${name.replace(/ \(.*\)$/, '')} passes over (${Math.round(max)}° high)`;
export const passSaid = (name: string, rise: number): string => `In your diary: ${name.replace(/ \(.*\)$/, '')} at ${new Date(rise).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, with a nudge 10 minutes before.`;
