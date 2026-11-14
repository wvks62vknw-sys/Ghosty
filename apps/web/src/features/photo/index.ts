/**
 * PHOTO (BRIEF-EDITOR-PHOTO; MAKE): a real, non-destructive photo editor on the phone, the sixth of the full editors. The shelf of his
 * edited photos (shelf.ts), the editor (editor.ts, trays.ts, curves.ts, slider.ts, exportsheet.ts) and the pipeline under it
 * (photo/gpu.ts, photo/cpu.ts, photo/math.ts, photo/recipe.ts, photo/store.ts). The PHOTO TOOLS that were already here (BACKGROUND,
 * SHARPER, ERASE through the brain's free Hugging Face Spaces, features/lens/photo.ts) are the BRAIN group inside it. Everything else
 * runs on the phone; the original is never touched; nothing is sent anywhere but by those three keys, each saying so first.
 *
 * Reached from MAKE → PHOTO, "edit a photo" and "my photos" in the chat, the Lens's PHOTO TOOLS chip (open_photo with a still), EDIT IT
 * on a picture in the chat or in the PHOTO TOOLS sheet, and `#photo` / `?open=photo`. State for specs: window.__ghosty.photoedit.
 */
import type { TabDef, TabInstance } from '../../shell/tabs';
import { cardNow } from '../../shell/cardline';
import { h } from '../../core/dom';
import { screenSays } from '../../shell/awareness';
import { photoEditor, peState } from './editor';
import { shelf } from './shelf';
import type { Tool } from './trays';
import { forgetLast, lastOpen } from '../../photo/store';

export interface PhotoOpenReq {
  /** The Lens's still, or one of Ghosty's own pictures (/i/<id>), or one of his kept photos by id, or files shared in. */
  still?: HTMLCanvasElement | null;
  picture?: string;
  id?: string;
  files?: File[];
  tool?: string;
  /** A change in his words ("make this photo warmer"): marked changes on the photo open now, or the last one he edited (editors.u7). */
  suggest?: string;
}

let pending: PhotoOpenReq | null = null;
let live: { run(o: PhotoOpenReq): Promise<void> } | null = null;

const ownPicture = (s: unknown): string => {
  const m = typeof s === 'string' ? s.match(/\/i\/([A-Za-z0-9_-]{16})(?![A-Za-z0-9_-])/) : null;
  return m ? `/i/${m[1]}` : '';
};

/** Open the editor on a photo (or on his shelf): from the Lens, the chat, a card, a link. */
export async function openPhotoEditor(o: PhotoOpenReq = {}): Promise<void> {
  pending = o;
  const { go } = await import('../../shell/tabs');
  if (!go('photo')) return;
  // already mounted and on screen: the screen's own enter() will not run, so ask it directly
  if (live) {
    const r = pending;
    pending = null;
    if (r) await live.run(r);
  }
}

export const photoTab: TabDef = {
  id: 'photo',
  title: 'PHOTO',
  icon: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10.5" r="1.7"/><path d="M4 17l5-4.5 3.5 3L15 13l5 4.5"/>',
  scene: 'backdrop',
  blurb: 'edit · grade · mask · heal · crop · looks · kept untouched',
  now: () => cardNow('photo'),
  mount: (root): TabInstance => {
    let editor: ReturnType<typeof photoEditor>;
    /** The tool a request asked to land on (the Lens's chip lands on BRAIN), used once by the next photo opened. */
    let wanted: Tool | null = null;
    /** The change in words to mark on the next photo opened (the chat's "make this photo warmer" with no photo open yet). */
    let wish = '';
    const sh = shelf((id) => {
      const t = wanted ?? undefined;
      wanted = null;
      void openId(id, t);
    });
    editor = photoEditor(() => {
      editor.unload();
      forgetLast();
      sh.el.hidden = false;
      void sh.show();
      peState.open = false;
    });
    const frame = h('div.peroot', sh.el, editor.el);
    root.append(frame);
    root.classList.add('pephoto');

    async function openId(id: string, tool?: Tool): Promise<void> {
      sh.el.hidden = true;
      await editor.load(id, tool);
      if (wish && editor.isOpen()) {
        const w = wish;
        wish = '';
        await editor.propose(w);
      }
    }
    async function run(o: PhotoOpenReq): Promise<void> {
      const tool = (o.tool as Tool | undefined) ?? undefined;
      if (o.suggest) {
        wish = o.suggest;
        if (editor.isOpen()) {
          wish = '';
          await editor.propose(o.suggest);
          return;
        }
        const last = lastOpen();
        if (last && !o.id) return openId(last.id);
      }
      if (o.id) return openId(o.id, tool);
      let files = o.files ?? [];
      if (o.still) {
        const blob = await new Promise<Blob | null>((ok) => o.still!.toBlob(ok, 'image/jpeg', 0.92));
        if (blob) files = [new File([blob], `Lens photo ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.jpg`, { type: 'image/jpeg' })];
      } else if (ownPicture(o.picture)) {
        const r = await fetch(ownPicture(o.picture), { credentials: 'same-origin' });
        if (r.ok) {
          const b = await r.blob();
          files = [new File([b], `Ghosty picture ${ownPicture(o.picture).slice(3, 9)}.${b.type.includes('png') ? 'png' : 'jpg'}`, { type: b.type || 'image/jpeg' })];
        }
      }
      if (!files.length) {
        await sh.show();
        return;
      }
      sh.el.hidden = false;
      // the editor opens on the first kept photo (and on the tool asked for)
      wanted = tool ?? null;
      await sh.take(files);
    }
    live = { run };
    const inst: TabInstance = {
      async enter() {
        if (pending) {
          const r = pending;
          pending = null;
          await run(r);
          return;
        }
        if (editor.isOpen()) return;
        const last = lastOpen();
        if (last) {
          await openId(last.id);
          if (!editor.isOpen()) {
            sh.el.hidden = false;
            await sh.show();
          }
        } else {
          sh.el.hidden = false;
          await sh.show();
        }
      },
      leave() {
        editor.unload();
      },
      open(arg: string) {
        if (editor.isOpen()) editor.tool(arg as Tool);
        else void run({ tool: arg });
      },
      context() {
        return screenSays('photo', 'Photo', peState.open ? `the photo editor, on “${peState.name}”, the ${peState.tool} tool` : 'the photo editor, on my photos', { looking: peState.open ? `“${peState.name}”`.slice(0, 80) : 'my photos' });
      },
    };
    return inst;
  },
};
