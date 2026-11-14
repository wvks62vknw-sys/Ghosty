/**
 * The catalogue's words for the NEXT ROUND's photo and video tools (the editors lane, MEDIA): each key is a line of the deck's YOU CAN
 * (shell/deckcopy.ts) on the Photo or Video screen, so each new ability is its own entry in Abilities. Rules: packages/shared/src/catalogue.ts
 * `wordProblems`. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-14';

export const MEDIA_WORDS: Record<string, CatValue> = {
  'deck:photo:make-this-photo-warmer': {
    name: 'Approve my photo changes',
    line: 'You can ask me to change a photo in words, and I mark each change in the editor for you to accept or reject.',
    more: 'Say “make this photo warmer and crop it to 4:5”, or tap FIX IT in the editor’s BRAIN tray. Each change is marked with its number, like +0.3 exposure or warmer +600 K. ACCEPT or REJECT each one, or ACCEPT ALL or NO THANKS; each accepted change is one UNDO step, and nothing leaves the phone.',
    say: ['Make this photo warmer', 'Crop this picture to 4:5', 'Fix this photo'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { ask: 'Make this photo warmer' }, tryText: 'Marks a warmer look on your photo',
  },
  'deck:video:fade-lengths-and-colour-over-time': {
    name: 'Fades and colour over time',
    line: 'You can set how long each clip fades, and key the grade so a clip’s colour changes as it plays.',
    more: 'In TRANSITION, FADE IN or FADE OUT shows a slider for its length, from 0.1 s up to a third of the clip (two seconds at most). In GRADE, KEY THE GRADE AT THE PLAYHEAD, move the playhead and change a slider: the colour moves between the keys. The preview and the exported file draw it the same, and UNDO takes back one step at a time.',
    say: ['Fade this clip for half a second', 'Change the colour over time', 'Key the grade'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { open: 'video' }, tryText: 'Opens the video editor',
  },
  'deck:photo:draft-a-post-with-this-photo': {
    name: 'Post an edited photo',
    line: 'You can put an edited photo straight into a new post, and it goes out only when you tap APPROVE.',
    more: 'In the Photo editor, EXPORT, then DRAFT A POST: the picture lands in WRITE A POST on SOCIAL. Choose the accounts, say what is in the picture and make the draft; it waits in the queue and goes out only when you tap APPROVE, every time.',
    say: ['Post this photo', 'Draft a post with my photo'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { open: 'photo' }, tryText: 'Opens the photo editor',
  },
  'deck:video:a-photo-film-cut-to-a': {
    name: 'A photo film with music',
    line: 'You can pick photos and a song, and I make a short film of them cut to the song’s beat.',
    more: 'In the Video editor, PROJECT, then PHOTO FILM: pick the photos and the song, and MAKE THE FILM. Each photo holds for whole beats with a slow zoom, the song under it from its first beat; it opens as a new video you can trim, grade and export. Photos also go into any video as still clips.',
    say: ['Make a photo film', 'Make a slideshow with music', 'Photos to a video'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { open: 'video' }, tryText: 'Opens the video editor',
  },
  'deck:photo:twice-the-size-for-printing': {
    name: 'Enlarge a photo twice',
    line: 'You can export a photo twice as wide and tall, drawn up smoothly and sharpened on this phone.',
    more: 'In the Photo editor, EXPORT, then 2× BIGGER: the finished picture is drawn up in steps with the phone’s best smoothing and sharpened, held to the 16.7 megapixels a phone takes. It adds no detail that was not there; no model for that is offered. DETAIL’s Noise reduction cleans a noisy photo before you do.',
    say: ['Make this photo bigger', 'Enlarge my photo'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { open: 'photo' }, tryText: 'Opens the photo editor',
  },
  'deck:video:freeze-a-frame-for-two-seconds': {
    name: 'Freeze a frame',
    line: 'You can hold the picture at the playhead for two seconds, as a still between the two halves of the clip.',
    more: 'In the Video editor, SPLIT, then FREEZE FRAME (2 S): the clip is split at the playhead and its own picture there goes between the halves for two seconds, with the clip’s grade. TRIM sets how long it holds; UNDO takes it out.',
    say: ['Freeze this frame', 'Hold this picture'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { open: 'video' }, tryText: 'Opens the video editor',
  },
};
