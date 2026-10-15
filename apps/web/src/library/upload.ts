/**
 * Putting things into Ghosty's library from the interface: read the file here in the
 * browser, cut it into passages, and send them to the brain in small batches (the brain
 * stores and indexes them; no AI model is used).
 */
import { brain, unreachable } from '../api/brain';
import { keepDoc, markSynced, pendingDocs, removeDoc, type LocalPassage } from './local';
import type { LibraryDoc } from '../../../../packages/shared/src/protocol';
import { chunkText } from '../../../../packages/shared/src/chunk';
import { extractFile, type Extracted } from './extract';

export type Progress = (text: string, frac: number) => void;

const BATCH = 30;

export async function addExtracted(x: Extracted, source: string, progress: Progress): Promise<LibraryDoc> {
  const passages = chunkText(x.pages, { code: x.code, heading: x.code ? x.title : undefined });
  if (!passages.length) throw new Error('no readable text found');
  const meta = { title: x.title, source, kind: x.kind, pages: x.pages.length > 1 ? x.pages.length : 0 };
  // A copy stays on this device: searchable while the brain's database is paused, and sent later if it is.
  const local = await keepDoc(meta, passages);
  try {
    const doc = await uploadPassages(meta, passages, progress);
    await markSynced(local.id, doc.id);
    return doc;
  } catch (e) {
    if (!unreachable(e)) {
      await removeDoc(local.id);
      throw e;
    }
    progress('kept on this device', 1);
    return (await pendingDocs()).find((d) => d.id === local.id)!;
  }
}

/** Send a document to the brain in small batches (removed again if that fails half way). */
export async function uploadPassages(meta: { title: string; source: string; kind: string; pages: number }, passages: LocalPassage[], progress: Progress = () => undefined): Promise<LibraryDoc> {
  const { doc } = await brain.libraryCreate(meta);
  try {
    for (let i = 0; i < passages.length; i += BATCH) {
      progress(`saving ${Math.min(i + BATCH, passages.length)} / ${passages.length} passages`, i / passages.length);
      await brain.libraryAdd(doc.id, passages.slice(i, i + BATCH));
    }
  } catch (e) {
    await brain.libraryRemove(doc.id).catch(() => undefined);
    throw e;
  }
  progress('done', 1);
  return (await brain.libraryDone(doc.id)).doc;
}

export async function addFile(file: File, progress: Progress): Promise<{ doc: LibraryDoc; warning?: string }> {
  progress('reading…', 0);
  let x: Extracted;
  let failed: Error | null = null;
  try {
    x = await extractFile(file);
  } catch (e) {
    // Formats the browser can't read: let the brain convert them (Workers AI, no key).
    if (!/\.(pdf|docx|epub|pptx|xlsx)$/i.test(file.name)) throw e;
    failed = e as Error;
    x = { title: file.name.replace(/\.[^.]+$/, ''), pages: [], kind: 'document' };
  }
  let warning = x.warning;
  const chars = x.pages.join('').replace(/\s/g, '').length;
  // Empty, scanned or encrypted: try the brain's converter. Short but readable documents are fine as they are.
  if (failed || !chars || (x.kind === 'pdf' && x.warning)) {
    progress('converting on the brain (looks scanned or unusual)…', 0.05);
    try {
      x = { ...x, pages: [await brain.libraryConvert(file)], warning: undefined };
      warning = undefined;
    } catch (e) {
      if (!chars) throw new Error(`couldn't read any text from ${file.name}${x.warning ? ` (${x.warning})` : failed ? ` (${failed.message})` : ''}: ${(e as Error).message}`);
      // keep the little text we found
    }
  }
  return { doc: await addExtracted(x, file.name, progress), warning };
}

export async function addText(title: string, text: string, progress: Progress): Promise<LibraryDoc> {
  return addExtracted({ title: title.trim() || text.trim().split('\n')[0]!.slice(0, 80) || 'Note', pages: [text], kind: 'notes' }, 'typed in', progress);
}
