/**
 * The catalogue's words for the video editor (BRIEF-EDITOR-VIDEO): MAKE → VIDEO, the seventh full editor. Each key is a registry
 * item the code runs on (the MAKE hub's card `hub:video`, the screen, the phone's phrase `phrase:video`, the deck's lines);
 * rules: packages/shared/src/catalogue.ts `wordProblems`. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-12';

export const VIDEO_WORDS: Record<string, CatValue> = {
  'hub:video': {
    name: 'Cut and edit a video',
    line: 'You can cut, grade and score a video from your phone’s clips, and I make the .mp4 right here.',
    more: 'Add clips and trim, split, speed up and order them on a timeline, with a crossfade, dip, wipe or slide between them, a title, a grade or a LUT, music that drops under your voice, your own voice-over, subtitles, a clip laid over another and a colour keyed out. I can find the scene cuts and cut the pauses. Your clips are never changed, and only the sound of a clip you ask me to subtitle goes to your brain.',
    say: ['Edit a video', 'My videos', 'Cut this video'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { run: 'open_video' }, tryText: 'Opens the video editor',
  },
  'phrase:video': { same: 'hub:video' },
  'screen:video': { same: 'hub:video' },
  'deck:video:your-videos-kept-on-this-phone': { same: 'hub:video' },
  'deck:video:edit-a-video': { same: 'hub:video' },
  'deck:video:cut-this-video': { same: 'hub:video' },
};
