/**
 * FORESIGHT's tool (foresight.ts; OWNER-ISSUES 61a): `foresee`, one tool in its own group, on by his words, never always.
 *  - what: 'expect' — what Ghosty reckons, put on record when the owner asked ("will it rain Saturday?", "will the price
 *    drop?", "will I finish by Friday?"): scored later only by his word; refused, recording nothing, about a person;
 *  - what: 'today' — today's open predictions; what: 'record' — how often Ghosty has been right, per kind.
 */
import { clampConfidence, foresightWords, NOT_PEOPLE } from '../../../../packages/shared/src/foresight';
import { foresightInfo, recordExpectation, type ForeDeps } from '../foresight';
import { zoneOf } from '../guardstate';
import { whenToTime } from '../integrations/transitous';
import { fromZoned, zoned } from '../time';
import { arg, type Tool, type ToolContext } from './types';

/** The group's line for the model, and when its tool is described in full (his words: never always). */
export const FORESIGHT_ABOUT = "You can put on record what you expect (foresee what: expect) when he asks what will happen — weather, roads, timetables, prices, his plans; never a person; say you'll check yourself. Your record: foresee today, record.";
export const FORESIGHT_WHEN = /\b(?:what do you (?:think|reckon|expect)|will (?:it|the|i|my)\b|predict\w*|prediction|forecast(?!\s*(?:for|says))|how often are you right|were you right|your record|foresight|foresee)\b/i;

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * When an expectation can be checked, from his words: what the journey planner's clock understands ("tomorrow 18:00",
 * "5pm", "in 2 hours"), a day ("Saturday", "on Monday at 9", "next week", "the weekend"), else tomorrow at 09:00.
 */
export function byWhen(words: string, tz: string, now = Date.now()): number {
  const z = zoned(now, tz);
  const tomorrow9 = fromZoned(z.y, z.m, z.d + 1, 9, 0, tz);
  const w = String(words ?? '').trim().toLowerCase().replace(/^(?:by|on|this|before|until)\s+/, '');
  if (!w) return tomorrow9;
  const day = /^(?:next\s+)?(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?(?:\s+(?:at\s+)?(.+))?$/.exec(w);
  if (day) {
    const want = DAYS.findIndex((d) => d.startsWith(day[1]!.slice(0, 3)));
    let ahead = (want - z.wd + 7) % 7 || 7;
    if (/^next\s/.test(w) && ahead < 7) ahead += 7;
    let h = 20;
    let mi = 0;
    if (day[2]) {
      try {
        const t = whenToTime(day[2], tz, false, now);
        const zt = zoned(t.time, tz);
        h = zt.h;
        mi = zt.mi;
      } catch {
        /* the day alone */
      }
    }
    return fromZoned(z.y, z.m, z.d + ahead, h, mi, tz);
  }
  if (/^(?:next week|in a week|a week)$/.test(w)) return fromZoned(z.y, z.m, z.d + 7, 9, 0, tz);
  if (/^(?:the )?weekend$/.test(w)) return fromZoned(z.y, z.m, z.d + (((6 - z.wd + 7) % 7) || 7), 20, 0, tz);
  try {
    const t = whenToTime(w, tz, false, now).time;
    return t > now ? t : tomorrow9;
  } catch {
    return tomorrow9;
  }
}

/** "on Saturday", "tomorrow at 18:00", "today at 17:00". */
function whenWords(t: number, tz: string, now: number): string {
  const a = zoned(now, tz);
  const b = zoned(t, tz);
  const clock = `${String(b.h).padStart(2, '0')}:${String(b.mi).padStart(2, '0')}`;
  const days = Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
  if (days === 0) return `today at ${clock}`;
  if (days === 1) return `tomorrow at ${clock}`;
  const name = DAYS[b.wd]!;
  return `on ${name.charAt(0).toUpperCase()}${name.slice(1)}${days > 6 ? ` ${b.d}/${b.m}` : ''}`;
}

const depsOf = (ctx: ToolContext): ForeDeps => ({ storage: ctx.storage, vault: ctx.vault, notify: async () => undefined });

export const foresightTools: Tool[] = [
  {
    name: 'foresee',
    description:
      "Ghosty's prediction ledger. what='expect': when the owner asks what you think will happen (\"will it rain Saturday?\", \"will the price drop?\", \"will I finish by Friday?\"), put your expectation on record: subject = his question in his words, expect = what you expect, completing \"I expect …\" (\"rain on Saturday\", \"the price to drop by Friday\"), by = when it can be checked in his words (default tomorrow 09:00), confidence 0.5–0.95. Never about a person (him, her, them, a relative, a friend, a name, people): it is refused. Then tell him your expectation and that it is on record. what='today': today's open predictions. what='record': how often you have been right, per kind (rain, trains, the commute, his questions). Scored only against the public feeds or his own word.",
    parameters: {
      type: 'object',
      properties: {
        what: { type: 'string', enum: ['expect', 'today', 'record'] },
        subject: { type: 'string', description: "his question, in his words (what: 'expect')" },
        expect: { type: 'string', description: "what you expect, completing \"I expect …\" (what: 'expect')" },
        by: { type: 'string', description: 'when it can be checked: "tomorrow 18:00", "Saturday", "Friday 5pm" (default tomorrow 09:00)' },
        confidence: { type: 'number', description: '0.5 (a coin toss) to 0.95' },
      },
      required: ['what'],
    },
    risk: 'auto',
    pure: (a) => a.what !== 'expect',
    async run(a, ctx) {
      const what = arg.str(a, 'what', false) || 'today';
      const d = depsOf(ctx);
      if (what === 'today' || what === 'record') {
        const info = await foresightInfo(d);
        const words = foresightWords(what === 'today' ? 'today' : 'score', info);
        return what === 'record' && info.yesterday ? `${words}\n${info.yesterday}` : words;
      }
      const subject = arg.str(a, 'subject', false) || arg.str(a, 'expect', false);
      const expect = arg.str(a, 'expect', false);
      if (!subject || !expect) return 'Nothing recorded: give subject (his question) and expect (what you expect).';
      const tz = await zoneOf(ctx.storage);
      const now = Date.now();
      const by = byWhen(arg.str(a, 'by', false), tz, now);
      const confidence = clampConfidence(arg.num(a, 'confidence', 0.6));
      const r = await recordExpectation(d, { subject, expect, by, confidence });
      if ('refused' in r) return `${NOT_PEOPLE} (Nothing was recorded. Say exactly that to him, and say nothing about the person.)`;
      return `On record: I expect ${r.p.expect} (${Math.round(r.p.confidence * 100)}%), to be checked ${whenWords(r.p.by, tz, now)}. Tell him your expectation in a line and that it's on record — you'll check yourself ${whenWords(r.p.by, tz, now)}; he can tell you "you were right" or "you were wrong".`;
    },
  },
];
