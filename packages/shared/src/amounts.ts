/**
 * AMOUNTS UNDERSTOOD EXACTLY (NEXT ROUND, voice.u3; his words: "'log half a litre', 'two glasses' or 'a quarter of an hour' are
 * understood exactly, not rounded"). Durations and volumes said any everyday way, read to an exact number:
 *   - durations: "a quarter of an hour" (900 s), "twenty five minutes", "an hour and a half", "two and a half minutes",
 *     "one minute thirty", "1 hour 20", "1h20", "half a minute", "ninety seconds", "three quarters of an hour";
 *   - volumes: "half a litre" (500 ml), "750ml", "1.5 litres", "a pint and a half" (852 ml), "two glasses", "half a pint",
 *     "a bottle", "a can", with his own cup sizes where he set them.
 * Pure: the kitchen's timers and the body's water tracker read their numbers here (packages/shared/src/kitchen.ts secondsIn,
 * apps/web/src/features/body/trackcore.ts mlIn), and the meanings layer says them back exactly.
 */

const ONES: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Number words to digits, fractions to decimals: "twenty five" → "25", "a quarter of an hour" → "0.25 hour", "two and a half" → "2.5". */
export function digitsOf(text: string): string {
  let t = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/-/g, ' ').replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d)\s*(?=(?:ml|millilit|litre|liter|l\b|h\b|hrs?\b|hours?\b|m\b|mins?\b|minutes?\b|s\b|secs?\b|seconds?\b))/g, '$1 ').replace(/\s+/g, ' ')} `;
  // compound and single number words ("twenty five", "a hundred", "one hundred and twenty")
  t = t.replace(/\b(?:a|one) hundred(?: and)?(?: (twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?: (one|two|three|four|five|six|seven|eight|nine))?| (one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen))?\b/g, (_m, tens?: string, ones?: string, teen?: string) => String(100 + (tens ? TENS[tens]! : 0) + (ones ? ONES[ones]! : 0) + (teen ? ONES[teen]! : 0)));
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?: (one|two|three|four|five|six|seven|eight|nine))?\b/g, (_m, tens: string, ones?: string) => String(TENS[tens]! + (ones ? ONES[ones]! : 0)));
  t = t.replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g, (w) => String(ONES[w]));
  t = t.replace(/\ba couple(?: of)?\b/g, '2').replace(/\ba few\b/g, '3');
  // fractions of a unit
  t = t.replace(/\b(?:three|3) quarters? of an? /g, '0.75 ').replace(/\b(?:a |one )?quarter of an? /g, '0.25 ').replace(/\b(?:a |one )?third of an? /g, '0.3333 ');
  // ("an hour and a half" keeps its "and a half" for the unit before it: only "half a/an" becomes 0.5 here)
  t = t.replace(/\bhalf an? /g, '0.5 ');
  // "2 and a half minutes" → 2.5 minutes; "2 and a quarter"
  t = t.replace(/\b(\d+(?:\.\d+)?) and (?:a )?half\b/g, (_m, n: string) => String(Number(n) + 0.5)).replace(/\b(\d+(?:\.\d+)?) and (?:a )?quarter\b/g, (_m, n: string) => String(Number(n) + 0.25))  .replace(/\b(\d+(?:\.\d+)?) and (?:3|three) quarters\b/g, (_m, n: string) => String(Number(n) + 0.75));
  // "an hour", "a minute", "a pint", "a glass" → 1
  t = t.replace(/\b(?:an|a|another) (?=(?:hour|minute|min|second|sec|pint|glass|mug|bottle|cup|can|litre|liter)\b)/g, '1 ');
  return t.replace(/\s+/g, ' ').trim();
}

const UNIT_SECS: [RegExp, number][] = [
  [/^(?:h|hrs?|hours?)$/, 3600],
  [/^(?:m|mins?|minutes?)$/, 60],
  [/^(?:s|secs?|seconds?)$/, 1],
];
const unitSecs = (u: string): number => UNIT_SECS.find(([re]) => re.test(u))?.[1] ?? 0;

/**
 * The seconds his words say, exactly, or null when they say no duration. "1 hour 20" and "one minute thirty" carry the smaller unit
 * on; "an hour and a half" adds half the unit.
 */
export function durationSecs(text: string): number | null {
  const t = digitsOf(text.replace(/(\d)h(\d)/gi, '$1 h $2'));
  const re = /(\d+(?:\.\d+)?) ?(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b(?: and (?:a )?(half|quarter))?(?:,? (?:and )?(\d+(?:\.\d+)?)(?! ?(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|ml|l|litres?|pints?)\b)(?![\d.]))?/g;
  let total = 0;
  let any = false;
  for (const m of t.matchAll(re)) {
    const per = unitSecs(m[2]!);
    if (!per) continue;
    total += Number(m[1]) * per;
    if (m[3]) total += per * (m[3] === 'half' ? 0.5 : 0.25);
    else if (m[4] && per > 1) total += Number(m[4]) * (per / 60);
    any = true;
  }
  return any && total > 0 ? Math.round(total) : null;
}

/** The sizes of the everyday vessels, in millilitres (his own cups, where he set them, are passed in and win). */
export const VESSELS: Record<string, number> = { pint: 568, glass: 250, cup: 250, mug: 350, bottle: 500, can: 330 };

/**
 * The millilitres his words say, exactly, or null when they name no amount: "half a litre" 500, "750ml" 750, "1.5 litres" 1,500,
 * "a pint and a half" 852, "two glasses" 500 (or his own glass), "half a pint" 284. `sizes`: his vessel sizes over VESSELS.
 */
export function volumeMl(text: string, sizes: Record<string, number> = {}): number | null {
  const size = { ...VESSELS, ...sizes };
  const t = digitsOf(text);
  const names = Object.keys(size).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(\\d+(?:\\.\\d+)?) ?(ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|(?:big |small |large |full )?(?:${names})(?:e?s)?)\\b(?: and (?:a )?(half|quarter))?`, 'g');
  let total = 0;
  let any = false;
  for (const m of t.matchAll(re)) {
    const u = m[2]!.replace(/^(?:big|small|large|full) /, '');
    const per = /^m/.test(u) && !/^mugs?$/.test(u) ? 1 : /^l/.test(u) ? 1000 : (size[u.replace(/e?s$/, '')] ?? size[u] ?? 0);
    if (!per) continue;
    total += Number(m[1]) * per + (m[3] ? per * (m[3] === 'half' ? 0.5 : 0.25) : 0);
    any = true;
  }
  return any && total > 0 ? Math.round(total) : null;
}

/** "500 ml", "1.5 litres", "852 ml": a volume said back. */
export const mlWords = (ml: number): string => (ml >= 1000 && ml % 100 === 0 ? `${ml / 1000} litre${ml === 1000 ? '' : 's'}` : `${ml} ml`);

/** A duration said back so the timer reads it exactly: "15 minutes", "1 hour 30 minutes", "2 minutes 30 seconds", "45 seconds". */
export function secsWords(secs: number): string {
  const s = Math.max(1, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const part = (n: number, u: string) => (n ? `${n} ${u}${n === 1 ? '' : 's'}` : '');
  return [part(h, 'hour'), part(m, 'minute'), part(r, 'second')].filter(Boolean).join(' ');
}
