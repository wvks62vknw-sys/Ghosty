/**
 * The catalogue's words for PHOTOS (THE APPS ROUND, lane LENS): his private photo library behind the photo editor, its four views
 * and the things he can say. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-14';

export const PHOTOS_WORDS: Record<string, CatValue> = {
  'screen:photos': {
    name: 'Your photo library',
    line: 'You can keep your photos and videos in one private library on this phone, with albums, favourites, search and memories.',
    more: 'Photo → MY LIBRARY. ADD PHOTOS brings them in from your phone’s picker, each kept as it came. Albums, favourites, hidden photos, a 30-day Recently deleted, duplicates with the best shot, search by what is in a photo or by date, On this day and memories that play as a short film. Nothing is sent anywhere.',
    say: ['Open my photo library', 'Show my albums', 'Find photos of the beach'], scene: ['behind'], cat: 'do', since: SINCE,
  },
};
