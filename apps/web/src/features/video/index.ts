/**
 * VIDEO (BRIEF-EDITOR-VIDEO; MAKE): the seventh full editor, a real timeline on this phone: clips trimmed, split and ordered, with
 * transitions, titles, a grade and LUTs, music and a voice-over, subtitles, and an .mp4 out. Its page is video/screen.ts; "my
 * videos", "edit a video" and "cut this video" in the chat, a clip dropped on the chat and the Library's OPEN IN VIDEO all land here.
 * The clips stay on this phone, untouched; only the sound of a clip he asks to subtitle goes to his own brain.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const videoTab: TabDef = {
  id: 'video',
  title: 'VIDEO',
  icon: '<rect x="3.5" y="6" width="12.5" height="12" rx="2.2"/><path d="M16 10.5l4.5-2.5v8L16 13.5"/>',
  scene: 'backdrop',
  blurb: 'cut · grade · score · export, on this phone',
  now: () => cardNow('video'),
  mount: (root) =>
    sheetPage(root, {
      screen: 'video',
      tag: 'MAKE // VIDEO',
      sub: 'Clips on a timeline, trimmed, split and ordered, with transitions, titles, a grade, music, your voice and subtitles. Your clips stay on this phone.',
      big: () => cardBig('video'),
      load: () => cardLoad('video'),
      sections: async () => {
        const m = await import('../../video/screen');
        return [{
          id: 'video',
          label: 'Video',
          parts: [{
            title: m.VIDEO_TITLE,
            build: () => {
              const v = m.videoParts();
              const take = () => void v.start({ files: m.takeHanded() });
              m.registerMounted({ take });
              take();
              return { el: v.el, stop: () => (m.registerMounted(null), v.stop()) };
            },
          }],
        }];
      },
    }),
};
