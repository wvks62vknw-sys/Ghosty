/**
 * KITCHEN AND BODY AS ONE COACH (NEXT ROUND, BODY AND KITCHEN lane): the chat's words for it, pure so the chat's tables can read
 * them without loading the screens (assistant/phrases.ts → assistant/local.ts → ./coach.ts). Each answered on the phone, no model.
 */
export type CoachAsk = 'weekshop' | 'fillweek' | 'meds' | 'sleepscore' | 'patterns' | 'review' | 'drink' | 'fast' | 'symptom' | 'gym';

const MEDS = /tablets?|pills?|medication|meds|medicines?|supplements?|vitamins?/;
const norm = (t: string) => t.trim().toLowerCase().replace(/’/g, "'").replace(/[.!?]+$/, '').replace(/^(?:hey ghosty,?\s+|ghosty,?\s+|please\s+|can you\s+|could you\s+)/, '').replace(/\s+please$/, '');

export function bodyCoachAsked(text: string): CoachAsk | null {
  const t = norm(text);
  if (t.length > 90) return null;
  if (/^(?:do |make |write |sort )?(?:the |my )?(?:shopping|shopping list|food shop|weekly shop) (?:for|from) (?:the|this|my) (?:week|meal plan|week's (?:meals|dinners|meal plan))$|^(?:put|add) (?:the |this |my )?(?:week's |weekly )?(?:meals|dinners|meal plan) (?:on|to|onto) (?:the |my )?(?:shopping )?list$|^(?:what do i need|what should i buy) (?:for|from) (?:the|this|my) (?:week's )?(?:meals|dinners|meal plan)$/.test(t)) return 'weekshop';
  if (/^plan (?:my|the|this week's|the week's) (?:dinners|meals|tea|teas)(?: for (?:me|the week))?$|^(?:fill|plan) (?:in )?(?:my|the) meal plan(?: for me)?$|^what should i (?:cook|have for dinner|make) this week$/.test(t)) return 'fillweek';
  if (new RegExp(`^(?:i\\s+)?(?:took|have taken|had|skipped|missed)\\s+(?:my\\s+)?(?:morning |evening |night |lunchtime )?.*(?:${MEDS.source})`).test(t) || new RegExp(`^(?:did|have) i (?:take|taken|had) (?:my )?(?:${MEDS.source})(?: today)?$|^(?:open|show(?: me)?) (?:my )?(?:${MEDS.source})$`).test(t)) return 'meds';
  return null;
}
