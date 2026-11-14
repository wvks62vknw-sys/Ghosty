/**
 * THE CHAT'S WORDS FOR BATCH 8 PART E, on the phone with no model (the tables are assistant/phrases.ts LOCAL_ASKS; local.ts
 * writes the chat from what these return): the converter opened ("convert this to PDF", "make a QR code"), its units
 * and numbers answered here ("3.5 miles in km", "hello in base64", "1700000000 as a date"), and DOCUMENTS opened ("my
 * documents", "translate my letter into Urdu"). Money at today's rate is not here: the brain gives the rate with its
 * source; and writing a letter is the brain's, in the ordinary chat (docs/ask.ts offers the reply laid out).
 */
import { convertAsked } from '../convert/asks';
import { docsAsked } from '../docs/asks';
import { sheetsAsked } from '../sheets/asks';
import { slidesAsked } from '../slides/asks';
import { workspaceAsked } from '../workspace/asks';
import { photoAsked } from '../photo/asks';
import { gameAsked } from '../studio-game/asks';
import { base64Asked, unitsAsked, unixAsked } from '../convert/units';
import type { PackReply } from './packs';

const TO_WORDS: Record<string, string> = { pdf: 'a PDF', jpg: 'a JPG', png: 'a PNG', webp: 'a WebP', docx: 'a Word document', xlsx: 'an Excel spreadsheet', csv: 'a CSV', json: 'JSON', txt: 'text', md: 'Markdown', html: 'a web page', wav: 'a WAV', mp3: 'an MP3' };

/** "convert this to PDF", "make a QR code", "file converter": the sheet, open on what he asked for. */
export async function convertTurn(text: string): Promise<PackReply> {
  const ask = convertAsked(text) ?? {};
  const { openConvert } = await import('../convert/sheet');
  void openConvert([], ask);
  const reply = ask.tool === 'qr-make'
    ? 'The QR maker is open: type the words, a link or your Wi-Fi details and I draw the code here, to save or share.'
    : ask.tool === 'table-csv'
      ? 'Paste the table into the box and I make it a CSV here, the first row its header.'
      : ask.tool === 'record-wav'
        ? 'Press START RECORDING and I keep it as a WAV, on this phone.'
        : ask.to
          ? `The converter is open: choose the file and I make it ${TO_WORDS[ask.to] ?? ask.to.toUpperCase()} here on the phone. Nothing is uploaded.`
          : 'The converter is open: choose or drop a file and I show what it can become: pictures, PDFs, Word, tables and sound, all done on this phone. Nothing is uploaded.';
  return { said: text, reply, go: [{ id: 'convert', ask: -1, label: 'Open the converter', run: 'open_convert', args: ask }] };
}

/** "my documents", "new document", "read a document", "translate my letter into Urdu": the DOCUMENTS sheet, open on it. */
export async function docsTurn(text: string): Promise<PackReply> {
  const ask = docsAsked(text) ?? { what: 'list' as const };
  // [editors.s3] paper into a document or a spreadsheet row: the scan opens on DOCUMENT, its key for this waiting
  if (ask.what === 'scan' || ask.what === 'receipt') {
    const { wantPaper } = await import('../docs/paperui');
    wantPaper(ask.what === 'scan' ? 'doc' : 'receipt');
    const { openLens } = await import('../features/lens');
    openLens('document');
    const reply = ask.what === 'scan'
      ? 'The scanner is open on DOCUMENT: lay the letter flat, CAPTURE PAGE (or PICK PHOTO), KEEP PAGE, then READ ALL and INTO A DOCUMENT. Its headings and paragraphs come with it, to edit, kept on this phone.'
      : 'The scanner is open on DOCUMENT: capture the receipt, KEEP PAGE, READ ALL, then RECEIPT TO SPREADSHEET. You check the date, shop and total, and ADD ROW puts them in your Receipts spreadsheet, kept on this phone.';
    return { said: text, reply, go: [{ id: 'docspaper', ask: -1, label: 'Open the scanner', run: 'open_lens', args: { mode: 'document' } }] };
  }
  if (ask.what === 'outline') {
    const { openDocs } = await import('../docs/sheet');
    void openDocs({ what: 'outline' });
    return { said: text, reply: 'Your latest document is open on its CONTENTS: tap a heading to jump to it, or ▲ and ▼ to move its whole section, everything under it with it. UNDO takes a move back.', go: [{ id: 'docsoutline', ask: -1, label: 'Open the contents', run: 'open_docs', args: { what: 'outline' } }] };
  }
  if (ask.what === 'comments') {
    const { openDocs } = await import('../docs/sheet');
    void openDocs({ what: 'comments' });
    return { said: text, reply: 'Your latest document is open with its comments: choose some words and WRITE → COMMENT to add one; reply, resolve, or ASK GHOSTY about that one sentence.', go: [{ id: 'docscomments', ask: -1, label: 'Open the comments', run: 'open_docs', args: { what: 'comments' } }] };
  }
  if (ask.what === 'merge') {
    const { openDocs } = await import('../docs/sheet');
    void openDocs({ what: 'merge' });
    return { said: text, reply: 'Mail merge is open on your latest document: choose the spreadsheet of names, tap where each name goes and its column’s key, step through the copies, then ONE PDF, ONE WORD FILE or SEPARATE FILES. Nothing is sent anywhere.', go: [{ id: 'docsmerge', ask: -1, label: 'Open mail merge', run: 'open_docs', args: { what: 'merge' } }] };
  }
  if (ask.what === 'fill') {
    const { openPdfForm } = await import('../docs/pdfformui');
    openPdfForm();
    return { said: text, reply: 'Fill and sign is open: CHOOSE A PDF, type into its boxes, tick its boxes, SIGN with your finger and tap the page where it goes, then SAVE PDF or SHARE. I say what I could not fill. Nothing is sent anywhere.', go: [{ id: 'docsfill', ask: -1, label: 'Open fill and sign', run: 'open_docs', args: { what: 'fill' } }] };
  }
  const { openDocs } = await import('../docs/sheet');
  void openDocs({ ...ask, what: ask.what });
  const reply = ask.what === 'new'
    ? 'A new document is open: type, or ask me to write it in the chat and it comes laid out.'
    : ask.what === 'open'
      ? 'Choose the document and I read it here: PDF, Word, EPUB, a web page, Markdown or text. READ IT TO ME reads it in this phone’s voice.'
      : ask.what === 'translate'
        ? `Translating your latest document into ${ask.language}, paragraph by paragraph, the original beside it.`
        : ask.what === 'letters'
          ? 'Your latest document in Latin letters, by the script’s own table: the sounds, not a translation.'
          : 'My documents are open: the ones you wrote with me, read or translated, kept on this phone with their dates.';
  return { said: text, reply, go: [{ id: 'docs', ask: -1, label: 'Open my documents', run: 'open_docs', args: {} }] };
}

/** "my spreadsheets", "new spreadsheet", "start a household budget", "open a spreadsheet": the SPREADSHEETS sheet, open on it. */
export async function sheetsTurn(text: string): Promise<PackReply> {
  const ask = sheetsAsked(text) ?? { what: 'list' as const };
  const { openSheets } = await import('../sheets/sheet');
  void openSheets({ what: ask.what });
  const reply =
    ask.what === 'budget'
      ? 'A household budget is open: twelve months and a summary, with the formulas already in. Change a rent and watch the year move.'
      : ask.what === 'new'
        ? 'A blank spreadsheet is open: tap a cell and type, or start with a budget.'
        : ask.what === 'import'
          ? 'Choose the file and I open it here: an Excel .xlsx or a CSV. Nothing is uploaded, and what I could not keep I say once.'
          : ask.what === 'money'
            ? 'Making your spending a budget sheet: months by categories with the totals, your budgets and a chart, a fresh copy from MONEY each time you ask.'
          : 'My spreadsheets are open: the ones you made or opened, kept on this phone with their dates.';
  return { said: text, reply, go: [{ id: 'sheets', ask: -1, label: 'Open my spreadsheets', run: 'open_sheets', args: {} }] };
}

/** "my slides", "new presentation", "make slides from my last answer", "open a PowerPoint file": the PRESENTATIONS sheet, open on it. */
export async function slidesTurn(text: string): Promise<PackReply> {
  const ask = slidesAsked(text) ?? { what: 'list' as const };
  const { openSlides } = await import('../slides/sheet');
  void openSlides({ what: ask.what });
  const reply =
    ask.what === 'new'
      ? 'A blank deck is open: a title slide and a slide of bullets. Tap one to type into it.'
      : ask.what === 'report'
        ? 'Pick the report to make slides of: my last answer with headings, one of your documents, or paste one. Every slide stays yours to change.'
        : ask.what === 'import'
          ? 'Choose the PowerPoint file (.pptx) and I open it here. Nothing is uploaded, and what I could not keep I say once.'
          : 'My slides are open: the decks you made or opened, kept on this phone with their dates.';
  return { said: text, reply, go: [{ id: 'slides', ask: -1, label: 'Open my slides', run: 'open_slides', args: {} }] };
}

/** "my workspace", "start a project", "a blank page", "what is due this week in my project": THE WORKSPACE, open on it; the dates answered here from the phone. */
export async function workspaceTurn(text: string): Promise<PackReply> {
  const ask = workspaceAsked(text) ?? { what: 'list' as const };
  if (ask.what === 'due') {
    // his own dates are his data: no brain is asked, so this answers with the brain out of reach too
    const [{ loadWorkspace }, { dueWords }, { isoOf }] = await Promise.all([import('../workspace/store'), import('../workspace/context'), import('../workspace/db')]);
    const d = dueWords(loadWorkspace(), isoOf(new Date()));
    return { said: text, reply: d.text, go: [{ id: 'workspace', ask: -1, label: 'Open my workspace', run: 'open_workspace', args: {} }] };
  }
  const { openWorkspace } = await import('../workspace/sheet');
  void openWorkspace({ what: ask.what });
  const reply =
    ask.what === 'project'
      ? 'A project is open: a board of tasks, notes, a decisions table and a calendar of deadlines, with every word yours to change.'
      : ask.what === 'blank'
        ? 'A blank page is open: type its name in the line above, then write, or type “/” for more.'
        : ask.what === 'import'
          ? 'Choose the Markdown, the zip of a folder, or the CSV and I read it here. A CSV becomes a database. Nothing is uploaded, and what I could not keep I say once.'
          : ask.what === 'bin'
            ? 'The BIN is open: pages I deleted sit there for 30 days.'
            : 'My workspace is open: your pages as a tree, your projects, search, and the pages you touched last.';
  return { said: text, reply, go: [{ id: 'workspace', ask: -1, label: 'Open my workspace', run: 'open_workspace', args: {} }] };
}

/** "take a voice note", "turn my voice note into a page": THE WORKSPACE’s VOICE NOTE open, one tap from RECORD (editors.s6). */
export async function voiceNoteTurn(text: string): Promise<PackReply> {
  const { openWorkspace } = await import('../workspace/sheet');
  void openWorkspace({ what: 'voice' });
  const reply = 'VOICE NOTE is open in your workspace: tap RECORD and talk, or CHOOSE A RECORDING from Voice Memos. I write it down and tidy it into a page, with the actions as to-dos.';
  return { said: text, reply, go: [{ id: 'workspace', ask: -1, label: 'Open my workspace', run: 'open_workspace', args: { what: 'voice' } }] };
}

/** "make flashcards from my notes": THE WORKSPACE where he was, and how to make them (editors.c3). */
export async function cardsTurn(text: string): Promise<PackReply> {
  const { openWorkspace } = await import('../workspace/sheet');
  void openWorkspace({});
  const reply = 'Your workspace is open: on the page of notes, tap … then MAKE FLASHCARDS (one of your documents works too). “Term: what it means” lines, toggles and headings with the answer under them become cards in Learn’s revision.';
  return { said: text, reply, go: [{ id: 'workspace', ask: -1, label: 'Open my workspace', run: 'open_workspace', args: {} }] };
}

/** "edit a photo", "my photos": the photo editor, open on my photos. */
export async function photoTurn(text: string): Promise<PackReply> {
  const ask = photoAsked(text) ?? { what: 'shelf' as const };
  const { openPhotoEditor } = await import('../features/photo');
  void openPhotoEditor({});
  const reply = ask.what === 'edit'
    ? 'The photo editor is open: OPEN A PHOTO from your camera roll and I keep it here untouched, with every edit beside it.'
    : 'My photos are open: the ones you have edited here, newest first, each kept untouched with its edits beside it. OPEN A PHOTO for another.';
  return { said: text, reply, go: [{ id: 'photo', ask: -1, label: 'Open the photo editor', run: 'open_photo', args: {} }] };
}

/** "3.5 miles in km", "hello in base64", "decode aGVsbG8=", "1700000000 as a date": answered here. */
export function numbersTurn(text: string): PackReply | null {
  const u = unitsAsked(text);
  if (u) return { said: text, reply: `${u.text}.` };
  const b = base64Asked(text);
  if (b) return { said: text, reply: b.text };
  const x = unixAsked(text);
  if (x) return { said: text, reply: x.text };
  return null;
}

/** "make a game", "my games", "sketch a cave room with two ledges": the game studio, open on it (the sketch is made in the editor). */
export async function gameTurn(text: string): Promise<PackReply> {
  const ask = gameAsked(text) ?? { what: 'list' as const };
  const { ask: studioAsk } = await import('../studio-game/hub');
  const { go } = await import('../shell/tabs');
  studioAsk(ask.what === 'sketch' ? { what: 'sketch', wish: ask.wish } : { what: ask.what });
  go('gamestudio');
  const reply = ask.what === 'new'
    ? 'The game studio is open: pick a template, or blank, and you are making a game.'
    : ask.what === 'sketch'
      ? `I am sketching “${ask.wish}” into the room you have open: a first draft, so paint over it. If no game is open, the newest one opens.`
      : 'These are your games, kept on this phone. Open one to change it, or play it from the arcade.';
  return { said: text, reply, go: [{ id: 'gamestudio', ask: -1, label: 'Open the game studio', run: 'open_gamestudio', args: {} }] };
}
