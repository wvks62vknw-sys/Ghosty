/**
 * EVERYTHING GHOSTY KEEPS, AS ONE LIST (THE APPS ROUND, lane BOOT). Each app keeps its own things in its own store; Files reads them all
 * and says what each can do here:
 *  - DOCUMENTS, SPREADSHEETS, PRESENTATIONS (docs/, sheets/, slides/ stores): everything: open, rename, duplicate, delete to Recently
 *    deleted (kept whole, so RESTORE puts it back exactly), search inside the words, a preview, and export as .docx, .xlsx or .pptx.
 *  - PHOTO, VIDEO, GAME STUDIO, COMIC: listed with their sizes, opened in their own app, starred, tagged and filed in folders here;
 *    deleting them is their own app's (each has its own way back), so Files does not offer it.
 *  - YOUR FILES (imported here from the phone's Files or a zip): everything, the bytes kept untouched.
 */
import { listDocs, removeDoc, saveDoc } from '../../docs/store';
import { listBooks, removeBook, saveBook } from '../../sheets/store';
import { listDecks, removeDeck, saveDeck } from '../../slides/store';
import { dropOwn, keepOwn, ownFiles, noteOf, type Binned, type OwnFile } from './store';
import { wordsIn, type Kind } from './words';

export type Src = 'docs' | 'sheets' | 'slides' | 'photo' | 'video' | 'game' | 'comic' | 'own';
export interface Item {
  key: string;
  src: Src;
  id: string;
  name: string;
  kind: Kind;
  at: number;
  size: number;
  /** The words inside, for search and the preview ('' when the app keeps none Files can read). */
  text: string;
  /** What it was made in, as the row says it. */
  app: string;
  /** The tab that opens it. */
  tab: string;
  can: { rename: boolean; duplicate: boolean; del: boolean };
  /** A small picture, where the app keeps one. */
  thumb?: () => Promise<string | null>;
  own?: OwnFile;
}

const bytes = (s: string) => new Blob([s]).size;
const txt = (x: unknown) => wordsIn(x).join(' ').slice(0, 20_000);
const full = { rename: true, duplicate: true, del: true };
const none = { rename: false, duplicate: false, del: false };
const blobUrl = (b: Blob | null | undefined): string | null => (b ? URL.createObjectURL(b) : null);
const kindOfFile = (type: string, name: string): Kind => (type.startsWith('image/') ? 'Photo' : type.startsWith('video/') ? 'Video' : /\.(docx?|md|txt|rtf|odt)$/i.test(name) ? 'Document' : /\.(xlsx?|csv|ods)$/i.test(name) ? 'Spreadsheet' : /\.(pptx?|key|odp)$/i.test(name) ? 'Presentation' : /\.(cbz|cbr)$/i.test(name) ? 'Comic' : 'File');

/** Everything, from every store (a store that cannot be read gives nothing, never an error). */
export async function gather(): Promise<Item[]> {
  const out: Item[] = [];
  const safe = async (f: () => Promise<void> | void) => {
    try {
      await f();
    } catch {
      /* that app's store could not be read just now */
    }
  };
  await safe(() => { for (const d of listDocs()) out.push({ key: `docs:${d.id}`, src: 'docs', id: d.id, name: d.title || 'Untitled document', kind: 'Document', at: d.at, size: bytes(JSON.stringify(d)), text: txt(d.blocks), app: 'Documents', tab: 'docs', can: full }); });
  await safe(() => { for (const b of listBooks()) out.push({ key: `sheets:${b.id}`, src: 'sheets', id: b.id, name: b.title || 'Untitled spreadsheet', kind: 'Spreadsheet', at: b.at, size: bytes(JSON.stringify(b)), text: txt(b.sheets), app: 'Spreadsheets', tab: 'sheets', can: full }); });
  await safe(() => { for (const d of listDecks()) out.push({ key: `slides:${d.id}`, src: 'slides', id: d.id, name: d.title || 'Untitled presentation', kind: 'Presentation', at: d.at, size: bytes(JSON.stringify(d)), text: txt(d.slides.map((s) => [s.title, s.body, s.body2, s.notes])), app: 'Presentations', tab: 'slides', can: full }); });
  await safe(async () => {
    const m = await import('../../photo/store');
    for (const p of await m.listPhotos()) out.push({ key: `photo:${p.id}`, src: 'photo', id: p.id, name: p.name || 'Photo', kind: 'Photo', at: p.at, size: p.bytes, text: '', app: 'Photo', tab: 'photo', can: none, thumb: async () => blobUrl(p.thumb) });
  });
  await safe(async () => {
    const m = await import('../../video/store');
    for (const p of await m.listProjects()) out.push({ key: `video:${p.id}`, src: 'video', id: p.id, name: p.name || 'Video', kind: 'Video', at: p.at, size: p.bytes, text: '', app: 'Video', tab: 'video', can: none });
  });
  await safe(async () => {
    const m = await import('../../studio-game/store');
    for (const g of await m.listGames()) out.push({ key: `game:${g.id}`, src: 'game', id: g.id, name: g.name || 'Game', kind: 'Game', at: g.at, size: g.bytes, text: '', app: 'Game Studio', tab: 'gamestudio', can: none, thumb: async () => g.thumb || null });
  });
  await safe(async () => {
    const m = await import('../comic/store');
    for (const b of await m.books()) out.push({ key: `comic:${b.id}`, src: 'comic', id: b.id, name: b.title || 'Comic', kind: 'Comic', at: b.added, size: b.bytes, text: '', app: 'Comic', tab: 'comic', can: none });
  });
  await safe(async () => {
    for (const f of await ownFiles()) out.push({ key: `own:${f.id}`, src: 'own', id: f.id, name: f.name, kind: kindOfFile(f.type, f.name), at: f.at, size: f.size, text: /^text\/|json|csv|markdown/.test(f.type) || /\.(txt|md|csv|json)$/i.test(f.name) ? (await f.blob.text()).slice(0, 20_000) : '', app: 'Imported', tab: 'files', can: full, own: f, thumb: async () => (f.type.startsWith('image/') ? blobUrl(f.blob) : null) });
  });
  // the name he gave it here wins (only where the app's own store cannot be renamed from Files: imported files)
  for (const it of out) {
    const n = noteOf(it.key);
    if (it.src === 'own' && n.name) it.name = n.name;
  }
  return out;
}

const newId = (id: string) => `${id.slice(0, 24)}-${Date.now().toString(36)}`;

/** A new name, saved in the app's own store (so the app shows it too). */
export async function rename(it: Item, name: string): Promise<boolean> {
  const n = name.trim().slice(0, 120);
  if (!n) return false;
  if (it.src === 'docs') { const d = listDocs().find((x) => x.id === it.id); return !!d && saveDoc({ ...d, title: n }); }
  if (it.src === 'sheets') { const b = listBooks().find((x) => x.id === it.id); return !!b && saveBook({ ...b, title: n }); }
  if (it.src === 'slides') { const d = listDecks().find((x) => x.id === it.id); return !!d && saveDeck({ ...d, title: n }); }
  if (it.src === 'own' && it.own) { await keepOwn({ ...it.own, name: n }); return true; }
  return false;
}

/** A copy beside it, named "… copy". */
export async function duplicate(it: Item): Promise<boolean> {
  const now = Date.now();
  if (it.src === 'docs') { const d = listDocs().find((x) => x.id === it.id); return !!d && saveDoc({ ...structuredClone(d), id: newId(d.id), title: `${d.title} copy`, at: now }); }
  if (it.src === 'sheets') { const b = listBooks().find((x) => x.id === it.id); return !!b && saveBook({ ...structuredClone(b), id: newId(b.id), title: `${b.title} copy`, at: now }); }
  if (it.src === 'slides') { const d = listDecks().find((x) => x.id === it.id); return !!d && saveDeck({ ...structuredClone(d), id: newId(d.id), title: `${d.title} copy`, at: now }); }
  if (it.src === 'own' && it.own) { await keepOwn({ ...it.own, id: newId(it.own.id), name: it.own.name.replace(/(\.[a-z0-9]+)?$/i, ' copy$1'), at: now }); return true; }
  return false;
}

/** What goes into Recently deleted: the thing whole, so RESTORE puts it back exactly; then it leaves its app. */
export function binOf(it: Item): Binned | null {
  const base = { key: it.key, src: it.src, id: it.id, name: it.name, kind: it.kind, size: it.size, deletedAt: Date.now(), note: noteOf(it.key) };
  if (it.src === 'docs') { const d = listDocs().find((x) => x.id === it.id); return d ? { ...base, data: JSON.stringify(d) } : null; }
  if (it.src === 'sheets') { const b = listBooks().find((x) => x.id === it.id); return b ? { ...base, data: JSON.stringify(b) } : null; }
  if (it.src === 'slides') { const d = listDecks().find((x) => x.id === it.id); return d ? { ...base, data: JSON.stringify(d) } : null; }
  if (it.src === 'own' && it.own) return { ...base, own: it.own };
  return null;
}
export async function removeFromApp(b: Binned): Promise<void> {
  if (b.src === 'docs') removeDoc(b.id);
  else if (b.src === 'sheets') removeBook(b.id);
  else if (b.src === 'slides') removeDeck(b.id);
  else if (b.src === 'own') await dropOwn(b.id);
}
export async function putBack(b: Binned): Promise<boolean> {
  if (b.src === 'docs' && b.data) return saveDoc(JSON.parse(b.data));
  if (b.src === 'sheets' && b.data) return saveBook(JSON.parse(b.data));
  if (b.src === 'slides' && b.data) return saveDeck(JSON.parse(b.data));
  if (b.src === 'own' && b.own) { await keepOwn(b.own); return true; }
  return false;
}

/** The thing as a file in the leaders' format, for SHARE and ZIP: .docx, .xlsx, .pptx, the photo's original, the video's project zip, the game's JSON, an imported file's own bytes. */
export async function asFile(it: Item): Promise<{ name: string; blob: Blob } | null> {
  const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'file';
  const u8 = (b: Uint8Array) => new Uint8Array(b).buffer as ArrayBuffer;
  if (it.src === 'docs') { const d = listDocs().find((x) => x.id === it.id); if (!d) return null; const { docxFrom } = await import('../../docs/docx'); return { name: `${safeName(it.name)}.docx`, blob: new Blob([u8(docxFrom(d))], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) }; }
  if (it.src === 'sheets') { const b = listBooks().find((x) => x.id === it.id); if (!b) return null; const { writeXlsx } = await import('../../sheets/xlsx'); return { name: `${safeName(it.name)}.xlsx`, blob: new Blob([u8(writeXlsx(b))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) }; }
  if (it.src === 'slides') { const d = listDecks().find((x) => x.id === it.id); if (!d) return null; const { writePptx } = await import('../../slides/pptx'); return { name: `${safeName(it.name)}.pptx`, blob: new Blob([u8(writePptx(d))], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }) }; }
  if (it.src === 'photo') { const m = await import('../../photo/store'); const b = await m.getOriginal(it.id); return b ? { name: safeName(it.name), blob: b } : null; }
  if (it.src === 'video') { const m = await import('../../video/store'); const p = await m.loadProject(it.id); if (!p) return null; const z = await m.projectZip(p); return { name: `${safeName(it.name)}.zip`, blob: z.blob }; }
  if (it.src === 'game') { const m = await import('../../studio-game/store'); const g = await m.getGame(it.id); return g ? { name: `${safeName(it.name)}.json`, blob: new Blob([JSON.stringify(g)], { type: 'application/json' }) } : null; }
  if (it.src === 'own' && it.own) return { name: safeName(it.name), blob: it.own.blob };
  return null;
}
