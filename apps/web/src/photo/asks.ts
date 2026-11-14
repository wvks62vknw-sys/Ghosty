/**
 * The chat's words for the photo editor (BRIEF-EDITOR-PHOTO), read with no model: "edit a photo", "my photos", "photo editor", "grade this
 * photo", "straighten my photo". The Lens's own photo jobs ("remove the background", "make it sharper", "erase the …") are the Lens's and
 * keep opening PHOTO TOOLS there; this is the editor. Pure.
 */
import { changesFor } from './suggest';
export interface PhotoAsk {
  what: 'shelf' | 'edit' | 'change';
  /** A change in his words ("make this photo warmer", "crop the picture to 4:5"): Ghosty's marked changes, accepted one by one (photo/suggest.ts). */
  ask?: string;
}

export function photoAsked(text: string): PhotoAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '').toLowerCase();
  // a change to the photo, said in words: the photo named, a change I can make in the editor, and none of the Lens's own jobs (the background, sharper, erase)
  if (/\b(?:photo|picture|pic|image|selfie|shot)\b/.test(t) && changesFor(t).length > 0 && !/\b(?:background|sharper|upscale|enlarge|erase|remove|delete|send|post|share|print|of me in|find|search|show me|what|draw|generate|paint|create|imagine|design)\b/.test(t) && !/\b(?:a|an|some) (?:photo|picture|image|pic)s? (?:of|with)\b/.test(t) && t.split(/\s+/).length <= 16) return { what: 'change', ask: text.trim() };
  if (/^(?:open |show |go to )?(?:me )?(?:my )?(?:edited )?(?:photos|pictures|photo library)$/.test(t) && /photo/.test(t)) return { what: 'shelf' };
  if (/^(?:open |show |start )?(?:the |my )?(?:photo|picture|image) (?:editor|studio|darkroom)$/.test(t)) return { what: 'shelf' };
  if (/^(?:edit|retouch|touch up|grade|colou?r grade|straighten|crop|enhance|fix) (?:a|an|my|this|the|some) (?:photos?|pictures?|pics?|images?|selfie)$/.test(t)) return { what: 'edit' };
  if (/^(?:i want to |let me |can you |help me )?(?:edit|retouch|grade) (?:a |my )?(?:photo|picture)s?$/.test(t)) return { what: 'edit' };
  return null;
}
