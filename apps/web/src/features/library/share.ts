/**
 * SHARE TO GHOSTY (the manifest's share_target, public/sw.js): what another app's share sheet sent, kept by the service worker in this
 * phone's own database ('ghosty-share'), is taken out here once, when Ghosty opens on `?shared=<id>`. The files go to the library's Add
 * path (the same words and sizes as a file picked there); shared words or a link become his typed line in the chat's box, never sent by
 * themselves. Said once, the first time: "Shared from another app; kept here." Nothing leaves the phone from here.
 */
import { toast } from '../../ui/components';

export const SHARED_SAID = 'Shared from another app; kept here.';
const SAID_KEY = 'ghosty.sharedsaid';
const DB = 'ghosty-share';

export interface SharedItem {
  id: string;
  title: string;
  text: string;
  url: string;
  files: { name: string; type: string; blob: Blob }[];
}

/** Every kept share, removed from the database as it is taken. */
export function takeShared(): Promise<SharedItem[]> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve([]);
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('items', { keyPath: 'id' });
    open.onerror = () => resolve([]);
    open.onsuccess = () => {
      const tx = open.result.transaction('items', 'readwrite');
      const st = tx.objectStore('items');
      const all = st.getAll();
      all.onsuccess = () => {
        const items = all.result as SharedItem[];
        for (const i of items) st.delete(i.id);
        tx.oncomplete = () => {
          open.result.close();
          resolve(items);
        };
      };
      all.onerror = () => resolve([]);
    };
  });
}

/** The words a share leaves in the chat's box: its words, then its link; a title only when it is all there is. */
export function sharedLine(i: Pick<SharedItem, 'title' | 'text' | 'url'>): string {
  const parts = [i.text.trim(), i.url.trim()].filter(Boolean);
  const words = parts.join(' ').replace(/\s+/g, ' ').trim();
  return (words || i.title.trim()).slice(0, 4000);
}

/** Opened on `?shared=…`: files to the library, words to the box, the marker cleaned from the address. */
export async function followShared(): Promise<void> {
  if (!/[?&]shared=/.test(location.search)) return;
  try {
    history.replaceState(null, '', `${location.pathname}${location.hash}`);
  } catch {
    /* no address here */
  }
  const items = await takeShared();
  if (!items.length) return;
  const files = items.flatMap((i) => i.files.map((f) => new File([f.blob], f.name || 'shared', { type: f.type || f.blob.type })));
  const line = items.map(sharedLine).filter(Boolean).join('\n');
  try {
    if (!localStorage.getItem(SAID_KEY)) {
      localStorage.setItem(SAID_KEY, '1');
      toast(SHARED_SAID, 'ok');
    }
  } catch {
    toast(SHARED_SAID, 'ok');
  }
  if (files.length) {
    const { go } = await import('../../shell/tabs');
    go('library');
    const { addSharedFiles } = await import('./index');
    addSharedFiles(files);
  }
  if (line) {
    // his typed line, left in the ask line for him to send (a share never asks anything by itself)
    if (files.length) {
      // (the library stays on screen to show the files being read; the words wait in the ask line)
      let tries = 0;
      const put = () => {
        const box = document.querySelector<HTMLInputElement>('#cin');
        if (!box) return void (++tries < 20 && setTimeout(put, 150));
        box.value = line;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      };
      put();
    } else (await import('../core/cards')).askInBox(line);
  }
}
