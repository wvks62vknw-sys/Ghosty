/**
 * TRIP MODE's words (ui/tripsheet.ts): every state of "getting there" said in his words. Pure (no page), so the seelane spec reads the
 * very lines the sheet shows.
 */
/* state: trip.plan loading */
export const TRIP_PLANNING = 'Working out how to get there in time…';
/* state: trip.place empty */
export const TRIP_NO_PLACE = 'This appointment has no place yet. Add where it is, and I can plan getting there.';
/* state: trip.plan error */
export const TRIP_NO_ROUTE = 'I couldn’t find a public transport journey that gets you there in time. Try the journey planner for another time.';
/* state: trip.plan offline */
export const TRIP_OFFLINE = 'No signal, so I can’t plan getting there right now. Your last journey is kept on this phone if you need it.';
/* state: trip.roads empty */
export const TRIP_ROADS_NONE = 'No road reports along the way.';
/* state: trip.roads offline */
export const TRIP_ROADS_FAR = 'Road reports cover the motorways in the West Midlands; this route is outside them.';
/* state: trip.cams empty */
export const TRIP_CAMS_NONE = 'No public cameras along the way.';
/* state: trip.weather error */
export const TRIP_WEATHER_DOWN = 'I couldn’t get the weather for there just now.';
/* state: trip.none empty */
export const TRIP_NOTHING_NEXT = 'Nothing coming up with a place in the next two weeks. Add one in AGENDA with where it is.';
/** "in 2 h 10 min", "in 25 min", "now" */
export function tripIn(ms: number): string {
  if (ms <= 60_000) return 'now';
  const m = Math.round(ms / 60_000);
  return m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}
/** The leave-by line: "Leave by 08:14 to arrive 08:52 (38 min, 1 change)". */
export const leaveLine = (leave: string, arrive: string, mins: string, changes: string): string => `Leave by ${leave} to arrive ${arrive} (${mins}, ${changes}).`;
/** The weather when he gets there: "Light rain, 9°C, 60% chance of rain at 08:52". */
export const weatherLine = (sky: string, temp: string, rainPct: number | null, at: string): string => `${sky}, ${temp}${rainPct != null ? `, ${rainPct}% chance of rain` : ''} at ${at}.`;
/** His words for TRIP MODE, many wordings one meaning: "trip mode", "how do I get to my next appointment?", "when should I leave for my meeting?". */
export const TRIP_ASK = /^(?:(?:hey |ok )?(?:ghosty,? )?)(?:trip mode|getting there|get me to my next (?:appointment|meeting|event)|how (?:do|can|should) i get to (?:my )?(?:next )?(?:appointment|meeting|event)|how do i get there(?: in time)?|when (?:should|do|must) i (?:need to )?leave(?: for (?:my )?(?:next )?(?:appointment|meeting|event))?|plan (?:the |my )?(?:trip|journey) (?:to|for) my next (?:appointment|meeting|event)|what(?:'s| is) the journey to my next (?:appointment|meeting|event))[?.!]*$/i;
