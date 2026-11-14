/**
 * How he asks for the CLOCK and the CALCULATOR in the chat (APPS ROUND, polish3). Answered on the phone, with no model.
 * "Set a timer for 5 minutes" stays the kitchen's timer words; these only open the apps.
 */
const LEAD = '^(?:(?:hey |ok )?(?:ghosty,? )?)';

export const CLOCK_ASK = new RegExp(`${LEAD}(?:(?:open|show)(?: me)? (?:the |my )?)?(?:clock(?: app)?|world ?clocks?|stop ?watch|(?:my |the )?timers app|the time around the world)$`, 'i');
export const CALC_ASK = new RegExp(`${LEAD}(?:(?:open|show)(?: me)? (?:the |a |my )?)?calculator(?: app)?$`, 'i');

/** The ARCADE's own record by words: "show my trophies", "what have I earned?", "continue my game", "what did I play last?". */
export const TROPHY_ASK = new RegExp(`${LEAD}(?:(?:open|show)(?: me)? )?(?:(?:my|the) )?(?:trophies|trophy room|arcade achievements|achievements)|${LEAD}what (?:have i|did i) (?:earned?|won)(?: in the arcade)?$`, 'i');
export const CONTINUE_ASK = new RegExp(`${LEAD}(?:(?:continue|carry on with|resume|go back to) (?:my |the )?(?:last )?game|continue playing|what (?:did i|was i) (?:play|playing) last)$`, 'i');
