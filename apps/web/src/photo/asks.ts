/**
 * The chat's words for the photo editor (BRIEF-EDITOR-PHOTO), read with no model: "edit a photo", "my photos", "photo editor", "grade this
 * photo", "straighten my photo". The Lens's own photo jobs ("remove the background", "make it sharper", "erase the …") are the Lens's and
 * keep opening PHOTO TOOLS there; this is the editor. Pure.
 */
export interface PhotoAsk {
  what: 'shelf' | 'edit';
}

export function photoAsked(text: string): PhotoAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '').toLowerCase();
  if (/^(?:open |show |go to )?(?:me )?(?:my )?(?:edited )?(?:photos|pictures|photo library)$/.test(t) && /photo/.test(t)) return { what: 'shelf' };
  if (/^(?:open |show |start )?(?:the |my )?(?:photo|picture|image) (?:editor|studio|darkroom)$/.test(t)) return { what: 'shelf' };
  if (/^(?:edit|retouch|touch up|grade|colou?r grade|straighten|crop|enhance|fix) (?:a|an|my|this|the|some) (?:photos?|pictures?|pics?|images?|selfie)$/.test(t)) return { what: 'edit' };
  if (/^(?:i want to |let me |can you |help me )?(?:edit|retouch|grade) (?:a |my )?(?:photo|picture)s?$/.test(t)) return { what: 'edit' };
  return null;
}
