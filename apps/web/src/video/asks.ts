/**
 * The chat's words for the video editor (BRIEF-EDITOR-VIDEO), read with no model: "my videos", "edit a video", "cut this video",
 * "make a video". Pure, so the phrase table (assistant/phrases.ts) and the catalogue's test read them too.
 */
export type VideoAsk = { what: 'open' | 'list' | 'cut' };

export function videoAsked(text: string): VideoAsk | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (/^(?:open |show |show me )?(?:my|the) videos?$|^(?:open )?(?:the )?video (?:editor|maker)$/.test(t)) return { what: 'list' };
  if (/^(?:cut|trim|edit) (?:this|my|that|the) (?:video|clip|footage)s?$|^(?:cut|trim) (?:a|some|the) (?:video|clip)s?$/.test(t)) return { what: 'cut' };
  if (/^(?:edit|make|start|create|new) (?:me )?(?:a |an |my )?(?:new )?(?:video|movie|film)$|^video edit(?:or|ing)$/.test(t)) return { what: 'open' };
  return null;
}
