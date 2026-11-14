/**
 * SYSTEM → BACKUP & RESTORE: the backup kept as a file (NEXT ROUND, polish3.u5). SAVE AS A FILE makes the same locked copy the daily
 * backup sends and hands it to the phone's share sheet (an iPhone's Save to Files, iCloud Drive) or its downloads; OPEN A BACKUP
 * FILE reads one back and joins it with what is here, exactly as RESTORE does (newer wins, nothing deleted, a reload after).
 * It opens only with his owner key. Nothing is sent anywhere by either key.
 */
import { h } from '../../core/dom';
import { MAX_IMPORT_BYTES } from '../../core/safeurl';
import { button } from '../../ui/components';
import { chooseRestore } from './restorepreview';
import { sayError } from '../../ui/hisWords';
import { backupFile, readBackupFile, restoreAndReload, sizeText } from './backup';

export const FILE_WORDS = {
  save: 'SAVE AS A FILE',
  open: 'OPEN A BACKUP FILE',
  making: 'Locking a copy for the file…',
  saved: (name: string, size: string) => `Saved ${name} (${size}), locked with your owner key; keep it in Files or iCloud Drive.`,
  shared: (name: string, size: string) => `${name} (${size}) is ready to keep: choose Save to Files.`,
  reading: 'Opening the backup file…',
  line: 'Keep a copy as a file too, so your backup never depends only on the brain.',
  all: 'EXPORT EVERYTHING',
  allLine: 'Your documents, sheets, decks, workspace and memory as ordinary files, in one zip.',
  allMaking: 'Making ordinary files of everything…',
  allDone: (name: string, size: string) => `Saved ${name} (${size}): Word, Excel, PowerPoint, Markdown and a memory document.`,
};

/** The two keys and the line under them, for the backup panel. `say` writes into the panel's message line. */
export function backupFileKeys(say: (text: string, tone: '' | 'good' | 'bad') => void): HTMLElement {
  const pick = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Pick a backup file' }) as HTMLInputElement;
  const save = button(FILE_WORDS.save, async (b) => {
    b.disabled = true;
    say(FILE_WORDS.making, '');
    try {
      const f = await backupFile();
      const run = await import('../../convert/run');
      const size = sizeText(f.size);
      if (await run.shareBlob(f.blob, f.name)) say(FILE_WORDS.shared(f.name, size), 'good');
      else {
        run.saveBlob(f.blob, f.name);
        say(FILE_WORDS.saved(f.name, size), 'good');
      }
    } catch (e) {
      say(sayError(e, 'save the backup file'), 'bad');
    } finally {
      b.disabled = false;
    }
  });
  save.dataset.act = 'backupfile';
  const open = button(FILE_WORDS.open, () => pick.click());
  open.dataset.act = 'openbackupfile';
  pick.addEventListener('change', async () => {
    const file = pick.files?.[0];
    pick.value = '';
    if (!file) return;
    // [security] the size is checked before the file is read whole (a phone tab is not a server)
    if (file.size > MAX_IMPORT_BYTES) return say('That file is too big to be a Ghosty backup.', 'bad');
    const read = readBackupFile(await file.text().catch(() => ''));
    if (!read.ok) return say(read.why, 'bad');
    const day = read.file.at ? new Date(read.file.at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : 'an unknown day';
    say(FILE_WORDS.reading, '');
    try {
      // what it would bring back, chosen item by item before anything is written (restorepreview.ts)
      const leave = await chooseRestore(read.file.sealed, `Restore the file from ${day}?`);
      if (!leave) return say('', '');
      say(`${await restoreAndReload(read.file.sealed, leave)} Reloading…`, 'good');
    } catch (e) {
      say(sayError(e, 'open the backup file'), 'bad');
    }
  });
  // [next] EXPORT EVERYTHING (polish3.s3): his work as ordinary files any computer opens, in one zip (exportall.ts)
  const all = button(FILE_WORDS.all, async (b) => {
    b.disabled = true;
    say(FILE_WORDS.allMaking, '');
    try {
      const f = await (await import('./exportall')).exportAll();
      const run = await import('../../convert/run');
      if (!(await run.shareBlob(f.blob, f.name))) run.saveBlob(f.blob, f.name);
      say(FILE_WORDS.allDone(f.name, sizeText(f.blob.size)), 'good');
    } catch (e) {
      say(sayError(e, 'export everything'), 'bad');
    } finally {
      b.disabled = false;
    }
  });
  all.dataset.act = 'exportall';
  return h('div.backupfile', h('div.note', FILE_WORDS.line), h('div.keyrow', save, open), h('div.note', FILE_WORDS.allLine), h('div.keyrow', all), pick);
}
