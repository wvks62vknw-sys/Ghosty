/**
 * THE CHAT'S WORDS FOR THE VIDEO EDITOR (BRIEF-EDITOR-VIDEO), on the phone with no model: "my videos", "edit a video" and "cut this
 * video" open the editor (a clip he drops on the chat opens it with the clip in; features/core/index.ts). Nothing is sent anywhere.
 */
import { videoAsked } from '../video/asks';
import type { PackReply } from './packs';

export async function videoTurn(text: string): Promise<PackReply> {
  const ask = videoAsked(text) ?? { what: 'list' as const };
  const { openVideo } = await import('../video/screen');
  void openVideo();
  const reply = ask.what === 'cut'
    ? 'The video editor is open: press ADD A CLIP and choose the video, or drop it on the chat. Then TRIM it with the handles, SPLIT it at the playhead, and EXPORT when it’s right. Your clip stays on this phone, untouched.'
    : ask.what === 'open'
      ? 'The video editor is open: add clips from your phone, then cut, grade and score them. When you export, the file is made right here.'
      : 'My videos are open: the ones you’ve cut here, kept on this phone with their clips, so you can carry on where you left off.';
  return { said: text, reply, go: [{ id: 'video', ask: -1, label: 'Open the video editor', run: 'open_video', args: {} }] };
}
