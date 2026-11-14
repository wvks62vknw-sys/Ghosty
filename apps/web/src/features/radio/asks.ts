/**
 * THE RADIO BY CHAT (planlane): the words that work this screen from the chat, read on the phone with no model, in many wordings.
 * Pure (no DOM, no storage): the spec and the chat both read this. Returns null when the words are not for this screen, so the next
 * table (and then the brain) gets them. Never take words another table owns ("play music", "play the radio", "stop the radio",
 * "open the radio", "play my favourite station": the VOICE lane's meanings; "play <a station>": the brain's play_radio; a bare "it",
 * "this" or "one" ("turn it off in 20 minutes", "save this", "skip it", "next one"): what is on screen, or the brain's).
 * `loose` marks words that do not name the radio ("what's playing", "add this to my favourites"): the chat answers them only while a
 * station is on, and otherwise leaves them to the brain (Spotify's "what's playing", another screen's favourites).
 * The kitchen's timer table comes first and takes "sleep timer 30 minutes", "set a sleep timer for ..." and "cancel the sleep timer"
 * (it starts or stops a kitchen timer named "sleep"): the words below match them, but the chat says only the ones that reach here.
 */
export type RadioAsk =
  | { what: 'sleep'; min: number }
  | { what: 'sleepAt'; h: number; m: number; half: '' | 'am' | 'pm' }
  | { what: 'sleepHour' }
  | { what: 'sleepOff' }
  | { what: 'sleepLeft' }
  // [planlane2:podcasts] after a reload: play the station shown again with the stop time the reload left
  | { what: 'carryOn' }
  | { what: 'step'; dir: 1 | -1 }
  | { what: 'favs' }
  | { what: 'fav'; n: number }
  | { what: 'save'; loose?: true }
  | { what: 'unsave'; loose?: true }
  | { what: 'now'; loose?: true };

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty five': 45, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90 };
const ORD: Record<string, number> = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, fifth: 5, '5th': 5, sixth: 6, '6th': 6, seventh: 7, '7th': 7, eighth: 8, '8th': 8, ninth: 9, '9th': 9, tenth: 10, '10th': 10, top: 1 };

/** "30 minutes", "an hour", "half an hour", "1 and a half hours", "90 mins", "2 hours": minutes, or 0. */
export function minutesIn(s: string): number {
  const t = s.trim().toLowerCase();
  if (/^(?:a )?half (?:an )?hour$/.test(t) || t === 'half hour') return 30;
  if (/^(?:a |an )?quarter (?:of )?(?:an )?hour$/.test(t)) return 15;
  if (/^(?:an|one|1) (?:and a half|½) hours?$|^(?:an|one|1) hour and a half$|^1\.5 hours?$/.test(t)) return 90;
  const m = /^(\d{1,3}|[a-z]+(?:[ -]five)?) ?(minutes?|mins?|m|hours?|hrs?|h)$/.exec(t);
  if (!m) return 0;
  const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : NUM[m[1]!] ?? 0;
  const min = /^h/.test(m[2]!) ? n * 60 : n;
  return min >= 1 && min <= 12 * 60 ? min : 0;
}

/** "11", "11pm", "11:30", "half eleven", "23:15", "midnight": the clock time asked for, or null. */
export function clockIn(s: string): { h: number; m: number; half: '' | 'am' | 'pm' } | null {
  const t = s.trim().toLowerCase().replace(/\s*o'?clock$/, '').replace(/\b([ap])\.m\.?$/, '$1m').replace(/\./g, ':');
  if (t === 'midnight') return { h: 0, m: 0, half: '' };
  if (t === 'midday' || t === 'noon') return { h: 12, m: 0, half: 'pm' };
  const halfPast = /^half (?:past )?(\d{1,2}|[a-z]+)$/.exec(t);
  if (halfPast) {
    const h = /^\d+$/.test(halfPast[1]!) ? Number(halfPast[1]) : NUM[halfPast[1]!] ?? -1;
    return h >= 1 && h <= 12 ? { h, m: 30, half: '' } : null;
  }
  const m = /^(\d{1,2}|[a-z]+)(?::(\d{2}))? ?(am|pm|a\.m|p\.m|in the morning|at night|tonight)?$/.exec(t);
  if (!m) return null;
  const h = /^\d+$/.test(m[1]!) ? Number(m[1]) : NUM[m[1]!] ?? -1;
  const mm = m[2] ? Number(m[2]) : 0;
  if (h < 0 || h > 23 || mm > 59) return null;
  const suf = m[3] ?? '';
  const half: '' | 'am' | 'pm' = /^a|morning/.test(suf) ? 'am' : /^p|night/.test(suf) ? 'pm' : '';
  if (half && (h < 1 || h > 12)) return null;
  return { h, m: mm, half };
}

const clean = (t: string) =>
  String(t ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:hey ghosty|ghosty|ok(?:ay)?|right|so|now|please|can you|could you|will you|would you)[, ]+/, '')
    .replace(/^(?:please|can you|could you|will you) /, '')
    .replace(/[, ]+please$/, '')
    .trim();

// "the radio", "the music": what the timer stops (never a bare "it": that is whatever he last spoke of)
const IT = '(?:the )?(?:radio|music|station|stream)';
const SLEEP = '(?:a |the )?sleep ?timer';

export function radioAsked(text: string): RadioAsk | null {
  if (String(text ?? '').length > 90) return null;
  const t = clean(text);
  if (!t || /\bspotify\b|\bpodcast\b|\bsong\b|\btrack\b|\balbum\b/.test(t)) return null;

  // THE SLEEP TIMER: off, how long left, a length, a clock time, the end of the hour
  if (new RegExp(`^(?:cancel|clear|stop|remove|turn off|switch off|kill|delete|end) ${SLEEP}$|^${SLEEP} off$|^no ${SLEEP}$|^don't stop (?:${IT}|${SLEEP})$|^turn ${SLEEP} off$`).test(t) || /^(?:keep|leave) (?:the )?radio (?:on|playing)$/.test(t)) return { what: 'sleepOff' };
  // [planlane2:podcasts] PLAY AND KEEP THE TIMER in words (only words that name the radio or the sleep timer, never a bare "it" or
  // "timer": another screen has its own; "play the radio" alone stays VOICE's)
  if (new RegExp(`^(?:play (?:the radio |the station )(?:again )?and keep (?:the )?(?:sleep ?)?timer|play (?:again )?and keep (?:the )?sleep ?timer|carry on (?:with )?${SLEEP}|keep ${SLEEP}(?: going)?|put ${SLEEP} back(?: on)?|bring back ${SLEEP}|carry on (?:with )?${IT} and (?:the |its )?(?:sleep ?)?timer)$`).test(t)) return { what: 'carryOn' };
  if (new RegExp(`^(?:how long|how much longer|how many minutes) (?:until|till|til|before) (?:${IT}) (?:stops|goes off|turns off|ends|switches off|goes quiet)$|^how (?:long|much time) (?:is )?(?:left )?on ${SLEEP}$|^(?:when|what time) (?:does|will) (?:${IT}) (?:stop|go off|turn off|switch off|end|go quiet)$|^(?:is there|have i set|did i set) ${SLEEP}(?: on| set)?$|^${SLEEP}\\??$|^when is ${SLEEP}$`).test(t)) return { what: 'sleepLeft' };
  const hourEnd = '(?:the )?(?:end|top) of (?:the|this) hour|on the hour';
  if (new RegExp(`^(?:(?:set )?${SLEEP} (?:for|till|until|to|at)? ?(?:${hourEnd})|(?:turn|switch) (?:${IT}) off (?:at )?(?:${hourEnd})|(?:stop|turn off|switch off) (?:${IT}) (?:at )?(?:${hourEnd})|(?:${IT}) off (?:at )?(?:${hourEnd}))$`).test(t)) return { what: 'sleepHour' };
  // a length: "sleep timer 30 minutes", "set a sleep timer for an hour", "turn the radio off in 20 minutes", "stop the radio in half an hour"
  const len =
    new RegExp(`^(?:set |start )?${SLEEP} (?:for |of |to )?(.+?)$`).exec(t) ??
    new RegExp(`^(?:turn|switch) (?:${IT}) off (?:in|after) (.+?)$`).exec(t) ??
    new RegExp(`^(?:stop|turn off|switch off|end) (?:${IT}) (?:in|after) (.+?)$`).exec(t) ??
    new RegExp(`^(?:${IT}) off (?:in|after) (.+?)$`).exec(t) ??
    new RegExp(`^(?:play|keep playing) (?:${IT}|for) (?:for )?(.+?) (?:then|and then) (?:stop|turn off)$`).exec(t);
  if (len) {
    const min = minutesIn(len[1]!);
    if (min) return { what: 'sleep', min };
  }
  // a clock time: "stop the radio at 11", "turn the radio off at half eleven", "sleep timer till midnight"
  const at =
    new RegExp(`^(?:stop|turn off|switch off|end) (?:${IT}) (?:at|by) (.+?)$`).exec(t) ??
    new RegExp(`^(?:turn|switch) (?:${IT}) off (?:at|by) (.+?)$`).exec(t) ??
    new RegExp(`^(?:${IT}) off (?:at|by) (.+?)$`).exec(t) ??
    new RegExp(`^(?:set )?${SLEEP} (?:for|till|until|to|at) (.+?)$`).exec(t);
  if (at) {
    const c = clockIn(at[1]!);
    if (c) return { what: 'sleepAt', ...c };
  }

  // NEXT and PREVIOUS: through his favourites (or the stations he played lately)
  if (/^(?:next|another|a different|change|change the|switch|skip(?: this)?|skip the) (?:station|channel|radio station)$|^(?:go to |play )?(?:the )?next (?:radio )?station$/.test(t)) return { what: 'step', dir: 1 };
  if (/^(?:previous|last|go back a|back a|the previous|the last) (?:station|channel|radio station)$|^(?:go back to|play) (?:the )?(?:previous|last|other) station$/.test(t)) return { what: 'step', dir: -1 };

  // HIS FAVOURITES: play them, play the second one, keep this one, take this one off
  // ("play my favourite station", one station, is the VOICE lane's: it plays the radio)
  if (/^(?:play|put on|start|listen to) (?:my |one of my )?(?:favourites|favorites|favourite stations|favorite stations|starred stations?)$/.test(t)) return { what: 'favs' };
  const nth = /^(?:play|put on|start|listen to) (?:my )?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|top|1st|2nd|3rd|[4-9]th|10th) (?:favourite|favorite)(?: station| radio station)?$/.exec(t) ?? /^(?:play|put on) (?:my )?(?:favourite|favorite)(?: station)? (?:number |no )?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)$/.exec(t);
  if (nth) {
    const n = ORD[nth[1]!] ?? (/^\d+$/.test(nth[1]!) ? Number(nth[1]) : NUM[nth[1]!] ?? 0);
    if (n >= 1) return { what: 'fav', n };
  }
  if (/^(?:save|star|keep|favourite|favorite|bookmark) (?:this|the) (?:radio )?station(?: (?:to|in) (?:my )?(?:favourites|favorites))?$|^(?:add|put) (?:this|the) station (?:to|in|into) (?:my )?(?:favourites|favorites|starred stations)$/.test(t)) return { what: 'save' };
  if (/^(?:add|put) (?:this|it|this one) (?:to|in|into) (?:my )?(?:favourites|favorites|starred stations)$|^(?:save|add) (?:it|this) as a (?:favourite|favorite)$/.test(t)) return { what: 'save', loose: true };
  if (/^(?:remove|take|delete|drop|unstar) (?:this|the) station (?:from|out of|off) (?:my )?(?:favourites|favorites)$|^(?:unsave|unfavourite|unfavorite|unstar) this station$/.test(t)) return { what: 'unsave' };
  if (/^(?:remove|take|delete|drop) (?:this|it|this one) (?:from|out of|off) (?:my )?(?:favourites|favorites)$/.test(t)) return { what: 'unsave', loose: true };

  // WHAT'S ON: the station by its name, its line, and the timer
  if (/^(?:what's|what is|whats) (?:on the radio|on air|this station|this radio station)(?: now| right now)?$|^(?:what|which) (?:station|radio station|radio) (?:is this|is that|is on|is playing|am i listening to|are we listening to|is it)$|^(?:what's|what is) (?:this|that) (?:station|on the radio)$|^is the radio (?:playing|on)$/.test(t)) return { what: 'now' };
  if (/^(?:what's|what is|whats) playing(?: now| right now)?$|^what (?:am i|are we) listening to$|^is anything (?:playing|on)$/.test(t)) return { what: 'now', loose: true };
  return null;
}
