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
