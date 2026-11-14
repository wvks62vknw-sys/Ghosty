/**
 * THE APP LIBRARY's importers off the main thread (features/applib/importer.ts): his own export file is read here, streamed
 * and unzipped in chunks, so a health export of gigabytes never freezes the screen. It posts its progress, then the records.
 * Cancel is the page ending the worker. Nothing is fetched and nothing leaves the phone.
 */
import { importFile } from '../../../../packages/shared/src/applib/importers/index';
import { rawText } from '../ui/hisWords';

export type ImportAsk = { appId: string; file: File };
export type ImportReply = { kind: 'progress'; f: number } | { kind: 'done'; records: Record<string, string | number | boolean>[] } | { kind: 'error'; words: string };

self.onmessage = async (ev: MessageEvent<ImportAsk>) => {
  const { appId, file } = ev.data;
  let last = -1;
  try {
    const records = await importFile(appId, file, {
      progress: (f) => {
        const p = Math.floor(f * 100);
        if (p !== last) { last = p; (self as unknown as Worker).postMessage({ kind: 'progress', f } satisfies ImportReply); }
      },
    });
    (self as unknown as Worker).postMessage({ kind: 'done', records } satisfies ImportReply);
  } catch (e) {
    // the raw text only decides which of his words to show
    const msg = rawText(e);
    const words = /not a zip|bad zip|unsupported zip/.test(msg) ? 'That zip could not be opened. Try the export again.'
      : /not a FIT/.test(msg) ? 'That is not an activity file.'
      : 'That file could not be read.';
    (self as unknown as Worker).postMessage({ kind: 'error', words } satisfies ImportReply);
  }
};
