/**
 * The chat's words for PRESENTATIONS (BRIEF-EDITOR-PRESENTATIONS), read with no model: "my slides", "new presentation", "make slides from my
 * last answer", "open a PowerPoint file". Writing a report is the brain's, in the ordinary chat; the Stage offers MAKE SLIDES OF IT
 * afterwards. Pure.
 */
export interface SlidesAsk {
  what: 'list' | 'new' | 'report' | 'import';
}

export function slidesAsked(text: string): SlidesAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  if (/^(?:open |show )?(?:me )?(?:my )?(?:slides|slide ?decks?|presentations?|power ?points?)$/i.test(t)) return { what: 'list' };
  if (/^(?:new|start a|make a(?: new)?|create a(?: new)?) (?:blank |new )?(?:presentation|slide ?show|slide ?deck|deck|power ?point)$/i.test(t)) return { what: 'new' };
  if (/^(?:make|create|turn (?:this|that|it) into|build) (?:me )?(?:some )?(?:slides|a (?:slide ?deck|deck|presentation))(?: (?:of|from|out of) (?:this|that|it|the last answer|my last answer|a report|the report|my (?:report|document|letter)))?$/i.test(t)) return { what: 'report' };
  if (/^(?:open|read|import) (?:a|my|this) (?:power ?point|presentation|pptx|\.pptx)(?: file| deck)?$/i.test(t)) return { what: 'import' };
  return null;
}
