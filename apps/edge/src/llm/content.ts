/**
 * What a message carries: plain text, or parts when a picture rides along — the
 * OpenAI-compatible shape every provider here speaks ({ type: 'text' } and
 * { type: 'image_url' } parts). These helpers let the rest of the brain read any message
 * as text, count what a picture costs, and make sure a picture is never written to storage
 * (a "[photo]" marker stands in for it).
 */
import type { Msg } from './router';

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type Content = string | ContentPart[] | null;

/** What a picture costs in a model's context, roughly (a 1024 px photo on most providers). */
export const IMAGE_TOKENS = 1000;
/** Stands in for a picture wherever a message is stored or shown as text. */
export const PHOTO_MARK = '[photo]';

/** The text of a message: a string as it is, the text parts joined. */
export function textOf(c: Content | undefined): string {
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  return c
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/** How many pictures a message carries. */
export const imagesIn = (c: Content | undefined): number => (Array.isArray(c) ? c.filter((p) => p.type === 'image_url').length : 0);

/** Does any message of this request carry a picture? (Then only a model that can see may answer.) */
export const hasImage = (messages: Msg[]): boolean => messages.some((m) => imagesIn(m.content) > 0);

/** A message with pictures: the words first, then each picture (a data URL). */
export const withImages = (text: string, images: string[]): ContentPart[] => [{ type: 'text', text }, ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } }))];

/** The words of a message with pictures, as they are kept: the text plus a marker per picture. */
export const markPhotos = (text: string, n: number): string => (n > 0 ? `${text}${text ? ' ' : ''}${Array.from({ length: n }, () => PHOTO_MARK).join(' ')}` : text);

/**
 * The owner's own words of a message: the blocks the brain itself attached as marked data
 * (what the phone's camera saw, text it read off a picture — see asData in kernel/permissions.ts)
 * are left out, so they steer neither the tools offered nor the library lookup.
 */
export const ownerWords = (text: string): string => text.replace(/\n*<<external content from [^\n]*>>\n[\s\S]*?\n<<end external content>>/g, '').trim();

/**
 * The same messages with every picture replaced by its marker, so nothing stored is ever a
 * picture. Any parts content becomes plain text; messages already in text are returned as they are.
 */
export function stripImages(messages: Msg[]): Msg[] {
  return messages.map((m) => (Array.isArray(m.content) ? { ...m, content: markPhotos(textOf(m.content), imagesIn(m.content)) } : m));
}
