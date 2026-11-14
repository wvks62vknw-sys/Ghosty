/**
 * KITCHEN AND BODY AS ONE COACH (NEXT ROUND, BODY AND KITCHEN lane): the chat's words for it, pure so the chat's tables can read
 * them without loading the screens (assistant/phrases.ts → assistant/local.ts → ./coach.ts). Each answered on the phone, no model.
 */
export type CoachAsk = 'weekshop' | 'fillweek' | 'meds' | 'sleepscore' | 'patterns' | 'review' | 'drink' | 'fast' | 'symptom' | 'gym' | 'walk' | 'plan';

const MEDS = /tablets?|pills?|medication|meds|medicines?|supplements?|vitamins?/;
const norm = (t: string) => t.trim().toLowerCase().replace(/’/g, "'").replace(/[.!?]+$/, '').replace(/^(?:hey ghosty,?\s+|ghosty,?\s+|please\s+|can you\s+|could you\s+)/, '').replace(/\s+please$/, '');

export function bodyCoachAsked(text: string): CoachAsk | null {
  const t = norm(text);
  if (t.length > 90) return null;
  if (drinkAsked(t)) return 'drink';
  if (/^start (?:a |my |the )?(?:six[- ]week )?(squat|push-?up|running|run) plan$|^i (?:hit|did|smashed|nailed) my (?:plan|session)(?: today)?$|^i (?:missed|didn'?t (?:hit|finish)) my (?:plan|session)(?: today)?$/.test(t)) return 'plan';
  if (/^(?:what'?s |when'?s |what is |when is )?(?:the )?best (?:time|hour) (?:for|to go for|to take) a walk(?: today)?$|^when should i (?:go for a |take a )?walk(?: today)?$/.test(t)) return 'walk';
  if (/^(?:start(?:ing)?|begin|end|stop|break|finish) (?:a |the |my )?fast(?:ing)?$|^i'?m (?:starting|beginning) (?:a |my )?fast$|^i'?ve (?:broken|ended) my fast$|^how long have i been fasting$|^(?:my )?fast(?:ing)? (?:so far|status)$/.test(t)) return 'fast';
  if (/^(?:my )?(?:waist|chest|hips?|arms?)(?: is| measures?|:)?\s*\d+(?:\.\d+)?\s*(?:cm|centimetres?|in|inches|")$/.test(t)) return 'fast';
  if (/^(?:squats?|bench(?: press)?|deadlifts?|overhead press|press|rows?|barbell rows?|pull-?ups?|leg press|curls?|lunges?)\s+(?:\d+ sets? of )?\d+(?: reps)?(?: (?:at|with|@) \d+(?:\.\d+)?\s*(?:kg|kilos?))?$|^(?:my )?(?:personal bests|pbs|gym bests)$/.test(t)) return 'gym';
  if (/^(?:log |note |i have (?:a |an )?|i've got (?:a |an )?)?(?:headache|migraine|back pain|hay fever|stomach ache|tiredness|cough|joint pain)[, ]+(?:a |about )?\d{1,2}(?: out of 10|\/10)?$|^(?:my |open my |show my )?symptoms?(?: diary)?$/.test(t)) return 'symptom';
  if (/^(?:do |make |write |sort )?(?:the |my )?(?:shopping|shopping list|food shop|weekly shop) (?:for|from) (?:the|this|my) (?:week|meal plan|week's (?:meals|dinners|meal plan))$|^(?:put|add) (?:the |this |my )?(?:week's |weekly )?(?:meals|dinners|meal plan) (?:on|to|onto) (?:the |my )?(?:shopping )?list$|^(?:what do i need|what should i buy) (?:for|from) (?:the|this|my) (?:week's )?(?:meals|dinners|meal plan)$/.test(t)) return 'weekshop';
  if (/^plan (?:my|the|this week's|the week's) (?:dinners|meals|tea|teas)(?: for (?:me|the week))?$|^(?:fill|plan) (?:in )?(?:my|the) meal plan(?: for me)?$|^what should i (?:cook|have for dinner|make) this week$/.test(t)) return 'fillweek';
  if (new RegExp(`^(?:i\\s+)?(?:took|have taken|had|skipped|missed)\\s+(?:my\\s+)?(?:morning |evening |night |lunchtime )?.*(?:${MEDS.source})`).test(t) || new RegExp(`^(?:did|have) i (?:take|taken|had) (?:my )?(?:${MEDS.source})(?: today)?$|^(?:open|show(?: me)?) (?:my )?(?:${MEDS.source})$`).test(t)) return 'meds';
  if (/^how (?:was|has been) my body(?: this week)?$|^how(?: was|'s) my body week$|^(?:my |the )?(?:weekly |sunday |week'?s? )?body review$|^review my body(?: week)?$/.test(t)) return 'review';
  if (/^(?:what'?s |what is |show me )?(?:my )?sleep score$|^how (?:well |regularly )?(?:am i|have i been) sleeping$|^score my sleep$/.test(t)) return 'sleepscore';
  if (/^(?:any|show me (?:my )?|what are my|find|spot) patterns?(?: in my (?:numbers|health|body))?$|^what goes with my good days$/.test(t)) return 'patterns';
  return null;
}

/** "I had a coffee", "a cup of tea", "had a pint of beer", "a glass of wine", "a double vodka"… (null: not a drink here). */
export function drinkAsked(text: string): { id: string; n: number } | { ask: 'caffeine' | 'units' } | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/’/g, "'");
  if (/^how much caffeine(?: have i had)?(?: today)?$|^my caffeine(?: today)?$/.test(t)) return { ask: 'caffeine' };
  if (/^how many (?:units|drinks)(?: of alcohol)?(?: have i had)?(?: this week)?$|^my (?:alcohol )?units(?: this week)?$/.test(t)) return { ask: 'units' };
  const m = /^(?:i(?:'ve| have)? (?:had|drank|drunk)|had|drank|log|add)\s+(a|an|one|two|2|three|3)?\s*(?:cup of |mug of |glass of |can of |bottle of )?(double )?(coffee|latte|cappuccino|flat white|americano|espresso|tea|cuppa|juice|orange juice|apple juice|cola|coke|pint of (?:beer|lager|bitter|cider)|pint of (?:ale)|beer|lager|cider|wine|red wine|white wine|vodka|gin|whisky|whiskey|rum|spirit)s?$/.exec(t);
  if (!m) return null;
  const n = ({ two: 2, '2': 2, three: 3, '3': 3 } as Record<string, number>)[m[1] ?? ''] ?? 1;
  const w = m[3]!;
  const id = /espresso/.test(w) ? 'espresso' : /coffee|latte|cappuccino|flat white|americano/.test(w) ? 'coffee' : /tea|cuppa/.test(w) ? 'tea' : /juice/.test(w) ? 'juice' : /cola|coke/.test(w) ? 'cola' : /wine/.test(w) ? 'wine' : /vodka|gin|whisk|rum|spirit/.test(w) ? 'spirit' : 'beer';
  // (a double is two measures: "a double vodka" is two singles)
  return { id, n: id === 'spirit' && m[2] ? n * 2 : n };
}
