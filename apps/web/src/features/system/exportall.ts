/**
 * EXPORT EVERYTHING IN ORDINARY FORMATS (NEXT ROUND, polish3.s3): a full copy of his own work as ordinary files any computer opens,
 * in one zip saved on the phone: each document as Word (.docx), each spreadsheet as Excel (.xlsx), each deck as PowerPoint
 * (.pptx), the workspace as Markdown and CSV, and everything remembered as a plain document (when the brain can be reached).
 * Unlike the backup it is not locked: it is his to open anywhere. Made on the phone; nothing is sent.
 */
import { brain } from '../../api/brain';
import { zipStore } from '../../convert/zip';
import { docxFrom } from '../../docs/docx';
import { listDocs } from '../../docs/store';
import { writeXlsx } from '../../sheets/xlsx';
import { listBooks } from '../../sheets/store';
import { writePptx } from '../../slides/pptx';
import { listDecks } from '../../slides/store';
import { exportTree } from '../../workspace/md';
import { loadWorkspace } from '../../workspace/store';
import { memoryDocument } from '../settings/kept';

export interface ExportCounts {
  docs: number;
  sheets: number;
  decks: number;
  pages: number;
  memory: number | null;
}

/** A file name a computer accepts, never twice in one folder. */
function namer(): (folder: string, title: string, ext: string) => string {
  const used = new Set<string>();
  return (folder, title, ext) => {
    const base = (title.trim() || 'Untitled').replace(/[\\/:*?\x22<>|#%\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[. ]+$/, '') || 'Untitled';
    let name = `${folder}/${base}.${ext}`;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${folder}/${base} (${i}).${ext}`;
    used.add(name.toLowerCase());
    return name;
  };
}

/** What the zip's first file says. Pure. */
export function readme(c: ExportCounts, at: Date): string {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return [
    'Everything of yours from Ghosty, in ordinary files',
    `Made on ${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    '',
    `Documents: ${n(c.docs, 'Word file', 'Word files')}.`,
    `Spreadsheets: ${n(c.sheets, 'Excel file', 'Excel files')}.`,
    `Presentations: ${n(c.decks, 'PowerPoint file', 'PowerPoint files')}.`,
    `Workspace: ${n(c.pages, 'page', 'pages')} as Markdown, databases as CSV.`,
    c.memory === null ? 'Memory: not included, because the brain could not be reached.' : `Memory: ${n(c.memory, 'thing', 'things')} remembered, as one document.`,
    '',
    'Pictures inside documents and decks stay in the editors on the phone.',
    '',
  ].join('\n');
}

/** Make the zip now. */
export async function exportAll(now = new Date()): Promise<{ name: string; blob: Blob; counts: ExportCounts }> {
  const files: { name: string; data: Uint8Array | string }[] = [];
  const name = namer();
  const docs = listDocs();
  for (const d of docs) files.push({ name: name('Documents', d.title, 'docx'), data: docxFrom(d) });
  const books = listBooks();
  for (const b of books) files.push({ name: name('Spreadsheets', b.title, 'xlsx'), data: writeXlsx(b) });
  const decks = listDecks();
  for (const d of decks) files.push({ name: name('Presentations', d.title, 'pptx'), data: writePptx(d) });
  const tree = exportTree(loadWorkspace(), undefined, (id) => docs.find((d) => d.id === id)?.title ?? 'a document');
  for (const f of tree.files) files.push({ name: `Workspace/${f.path}`, data: f.text });
  const items = await brain.memoryTimeline().then((r) => r.items, () => null);
  if (items) files.push({ name: 'Memory/What Ghosty remembers about you.txt', data: memoryDocument(items, now.getTime()) });
  const counts: ExportCounts = { docs: docs.length, sheets: books.length, decks: decks.length, pages: tree.pages, memory: items ? items.length : null };
  files.unshift({ name: 'README.txt', data: readme(counts, now) });
  const zip = zipStore(files, now);
  return { name: `ghosty-everything-${now.toISOString().slice(0, 10)}.zip`, blob: new Blob([zip as BlobPart], { type: 'application/zip' }), counts };
}
