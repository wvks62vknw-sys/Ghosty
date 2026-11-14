/**
 * How he asks for the CLOCK and the CALCULATOR in the chat (APPS ROUND, polish3). Answered on the phone, with no model.
 * "Set a timer for 5 minutes" stays the kitchen's timer words; these only open the apps.
 */
const LEAD = '^(?:(?:hey |ok )?(?:ghosty,? )?)';

export const CLOCK_ASK = new RegExp(`${LEAD}(?:(?:open|show)(?: me)? (?:the |my )?)?(?:clock(?: app)?|world ?clocks?|stop ?watch|(?:my |the )?timers app|the time around the world)$`, 'i');
export const CALC_ASK = new RegExp(`${LEAD}(?:(?:open|show)(?: me)? (?:the |a |my )?)?calculator(?: app)?$`, 'i');
