/**
 * The catalogue's words for BATCH 8 PART E (BRIEF-REST-E): the converter, documents, and the rights-and-law topics. Each
 * key is a registry item the code runs on (the phone's phrases in assistant/phrases.ts LOCAL_ASKS, `phrase:<id>`; the
 * MAKE hub's cards in shell/hubcards.ts, `hub:<id>`); rules: packages/shared/src/catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const RESTE_WORDS: Record<string, CatValue> = {
  'hub:convert': {
    name: 'Convert files on the phone',
    line: 'You can turn pictures, PDFs, Word files, tables and sound into other formats here, and nothing is uploaded.',
    more: 'Choose or drop a file and I show what it can become: JPG, PNG or WebP, a smaller or cropped picture, a photo with its location taken out, pictures into one PDF, a PDF split or joined or as pictures or words, CSV, JSON and Excel each way, Word to text, anything to a PDF or a Word file, sound to WAV or MP3, a stretch cut out. It also makes QR codes and works out units, base64 and Unix times. Video is not done here: a converter for it would be about 30 MB.',
    say: ['Convert this to PDF', 'Open the converter', 'Make a QR code'],
    scene: ['making', 'phone'], cat: 'build', since: SINCE,
    go: { run: 'open_convert' }, tryText: 'Opens the converter',
  },
  'phrase:convert': { same: 'hub:convert' },
  'hub:docs': {
    name: 'Read, write and translate documents',
    line: 'You can have a letter written in the chat and laid out, a PDF or Word file read to you, or a document translated.',
    more: 'Ask me to “write a letter to my landlord about the damp” and the reply comes as a document with your name and the date, to edit and save as PDF, Word, Markdown or a web page. Open a PDF, Word file or e-book and it shows its contents, finds words and reads it aloud. Ask me to make it shorter, more formal or fix the grammar: each change comes as a suggestion you accept or reject. A translation keeps every heading and list in its place, beside the original.',
    say: ['Write a letter to my landlord about the damp', 'My documents', 'Translate my letter into Urdu'],
    scene: ['making', 'money', 'school'], cat: 'do', since: SINCE,
    go: { run: 'open_docs' }, tryText: 'Opens my documents',
  },
  'phrase:docs': { same: 'hub:docs' },
  // [editors.s3] paper into an editable document, a receipt into a spreadsheet row
  'phrase:docspaper': {
    name: 'Scan paper into a document',
    line: 'You can scan a letter into a document to edit, or a receipt into a new row of your spreadsheet.',
    more: 'Lay the page flat and capture it in the scanner, then READ ALL. INTO A DOCUMENT keeps its headings, paragraphs, lists and the address on the right, as well as the reader can, ready to edit. RECEIPT TO SPREADSHEET shows the date, shop and total for you to check, and ADD ROW puts them in your Receipts spreadsheet. All of it stays on this phone.',
    say: ['Scan this letter into a document', 'Scan a receipt into my spreadsheet', 'Turn this letter into a document I can edit'],
    scene: ['making', 'money', 'phone'], cat: 'do', since: '2026-11-14',
    go: { run: 'open_lens', args: { mode: 'document' } }, tryText: 'Opens the scanner on a page',
  },
  // [editors.s12] fill in and sign a PDF form
  'phrase:docsfill': {
    name: 'Fill in and sign a PDF',
    line: 'You can type into a PDF form’s boxes, sign it with your finger and save or share it, without printing.',
    more: 'Choose the PDF in DOCUMENTS → FILL AND SIGN A PDF. Its boxes come as fields to type into, tick or choose from, and its pages show what you wrote. SIGN lets you draw your signature and tap the page where it goes; it is kept for next time only if you press KEEP IT. I say which boxes I could not fill, like round-button choices. Nothing is sent anywhere.',
    say: ['Fill in a PDF form', 'Sign this PDF', 'Fill and sign a form'],
    scene: ['making', 'money', 'phone'], cat: 'do', since: '2026-11-14',
    go: { run: 'open_docs', args: { what: 'fill' } }, tryText: 'Opens fill and sign',
  },
  // [editors.s2] mail merge
  'phrase:docsmerge': {
    name: 'One letter for every name',
    line: 'You can write one letter and get a copy for every name and address in a spreadsheet, as one PDF, one Word file or a file each.',
    more: 'In a document, MAIL MERGE: choose your spreadsheet (its first row names the columns, like Name and Address), tap where each name goes and the column’s key, and step through the copies to check them. A field with no column is said. Nothing is sent anywhere; the files are made here for you to print or share.',
    say: ['Mail merge', 'Make this letter for everyone in my spreadsheet', 'Mail merge my letter from a spreadsheet'],
    scene: ['making', 'school'], cat: 'do', since: '2026-11-14',
    go: { run: 'open_docs', args: { what: 'merge' } }, tryText: 'Opens mail merge',
  },
  'hub:sheets': {
    name: 'Budgets and lists with formulas',
    line: 'You can keep a budget or a list with formulas that follow, open an Excel file, and hand one back that opens unchanged.',
    more: 'Start with a household budget and twelve months and a summary appear, with the formulas already in; change a rent and the month, the summary and the year move together. Tap a column’s letter to sort or filter it, choose cells to format them as pounds, percent or dates, or to draw a chart. Export an Excel file, a CSV or a PDF, or open someone’s .xlsx here, and I say once what I could not keep. I can explain a cell or write you a formula.',
    say: ['My spreadsheets', 'Start a household budget', 'Open a spreadsheet'],
    scene: ['making', 'money', 'school'], cat: 'do', since: '2026-11-11',
    go: { run: 'open_sheets' }, tryText: 'Opens my spreadsheets',
  },
  'phrase:sheets': { same: 'hub:sheets' },
  // [editors grid, NEXT ROUND] colour by rules (editors.u2)
  'deck:sheets:colour-cells-by-rules': {
    name: 'Colour cells by rules',
    line: 'You can have cells colour themselves: overdue dates red, the top ten green, bars that show how big each number is.',
    more: 'Choose the cells, open RULES and pick one: more than, less than, between, equal to, contains, overdue, top or bottom, duplicates, data bars or a colour scale. The colours follow the numbers as they change. Each sheet lists its rules with EDIT and DELETE, UNDO takes any change back, and an Excel file keeps them both ways.',
    say: ['Open my spreadsheets', 'Open a spreadsheet'],
    scene: ['making', 'money'], cat: 'do', since: '2026-11-14',
    go: { open: 'sheets' }, tryText: 'Opens my spreadsheets',
  },
  // [editors grid, NEXT ROUND] one-tap table summaries (editors.u3)
  'deck:sheets:summarise-a-table-in-one-tap': {
    name: 'Summarise a table in one tap',
    line: 'You can see how much went where each month, or at each shop, without writing a single formula.',
    more: 'Choose a table, open SUMMARY and pick BY (each month of a date column, or each shop or category) and OF (the total, count or average of a column of numbers). The summary lands on a sheet of its own and follows the table: change a number, add a row or a new shop, and it keeps up. MAKE A CHART OF IT draws it as bars in one more tap.',
    say: ['Open my spreadsheets', 'Start a household budget'],
    scene: ['making', 'money'], cat: 'do', since: '2026-11-14',
    go: { open: 'sheets' }, tryText: 'Opens my spreadsheets',
  },
  'hub:slides': {
    name: 'Slides and talks',
    line: 'You can make a deck of slides from a report, or from scratch, give the talk with your notes in your hand, and send it as a PowerPoint file.',
    more: 'Make slides of a research answer, one of your documents or any reply with headings: a slide for each heading, a chart where there are numbers, the sources last. Change the words in the line above a slide, add a picture, a chart from numbers you type, a table or a shape, pick a theme and every slide repaints. Press and hold a slide to move it. When you give the talk the slide, your notes and the next title are on the phone, and a tap brings in the next part. I save a .pptx that opens in PowerPoint or Keynote, a PDF or a picture of one slide, and open someone’s .pptx here, saying once what I could not keep.',
    say: ['My slides', 'Make slides from a report', 'Open a PowerPoint file'],
    scene: ['making', 'school'], cat: 'do', since: '2026-11-12',
    go: { run: 'open_slides' }, tryText: 'Opens my slides',
  },
  'phrase:slides': { same: 'hub:slides' },
  // [editors grid, NEXT ROUND] the builds and Magic Move carried in and out of PowerPoint (editors.u4)
  'deck:slides:builds-and-magic-move-kept-in': {
    name: 'Builds and Magic Move in PowerPoint',
    line: 'You can have parts of a slide come in on a tap and glide between slides, and PowerPoint plays both the same way.',
    more: 'On a slide, SLIDE sets how each part comes in: it appears, fades in or rises in. MAGIC MOVE glides what is on both slides from the last slide to its place. The PowerPoint file carries them as its own Appear, Fade, Fly In and Morph, and a PowerPoint file you open brings its animations in as builds, saying once what it could not keep.',
    say: ['Open my slides', 'Open a PowerPoint file'],
    scene: ['making', 'school'], cat: 'do', since: '2026-11-14',
    go: { open: 'slides' }, tryText: 'Opens my slides',
  },
  'hub:workspace': {
    name: 'Pages, projects and databases',
    line: 'You can keep pages inside pages and a project with its tasks and dates, and I read all of it before I answer.',
    more: 'Start a project and a board of tasks, notes, decisions and a calendar of deadlines appear, all over one list of rows. The same rows can be a table, a board, a calendar, a timeline or a gallery, and a column can work something out. Every page keeps sixty versions, a BIN holds deleted ones for thirty days, and it is all on this phone: only a question about a project leaves it, and I say how big first.',
    say: ['My workspace', 'Start a project', 'What is due this week in my project'],
    scene: ['making', 'school', 'money'], cat: 'do', since: '2026-11-12',
    go: { run: 'open_workspace' }, tryText: 'Opens my workspace',
  },
  'hub:editors': {
    name: 'Every editor in one place',
    line: 'You can write, calculate, present and plan in one place, and all of it is kept on this phone.',
    more: 'The seven editors sit under one card in MAKE: documents, spreadsheets, slides, the workspace, photos, video and the game studio. Each opens in one tap, and the card says how many things live on this phone across them.',
    say: ['My documents', 'My spreadsheets', 'My slides', 'My workspace'],
    scene: ['making', 'school', 'money'], cat: 'do', since: '2026-11-12',
    go: { open: 'docs' }, tryText: 'Opens my documents',
  },
  'phrase:workspace': { same: 'hub:workspace' },
  'phrase:wsvoice': {
    name: 'Voice notes into tidy pages',
    line: 'You can talk for a few minutes and I turn it into a clean page, with every action you said pulled out as a to-do.',
    more: 'Record with the phone’s own microphone, or choose a recording from Voice Memos. Your brain writes the words down, then I tidy them into a Workspace page or a Document: short paragraphs in your words, a TO DO list, and what you said word for word at the end. Offline, the recording is kept on this phone and tidied when you are back; once its page is made it is let go.',
    say: ['Take a voice note', 'Turn my voice note into a page'],
    scene: ['making', 'phone'], cat: 'do', since: '2026-11-14',
    go: { run: 'open_workspace', args: { what: 'voice' } }, tryText: 'Opens a voice note',
  },
  'hub:photo': {
    name: 'Edit and grade a photo',
    line: 'You can edit a photo here like a real editor: light, colour, curves, masks, healing, a crop, and a look saved for many.',
    more: 'Open a photo from your camera roll and it is kept on this phone untouched, with every edit beside it. Straighten a horizon, darken a sky with a gradient, heal a blemish, lay a second photo over it, save the look and put it on five photos at once, then export at full size. Background removal, sharper and erase are in it too; those three go to my brain, and everything else stays on the phone.',
    say: ['Edit a photo', 'My photos', 'Open the photo editor'],
    scene: ['making', 'phone'], cat: 'build', since: '2026-11-12',
    go: { run: 'open_photo' }, tryText: 'Opens the photo editor',
  },
  'phrase:photoedit': { same: 'hub:photo' },
  'screen:photo': { same: 'hub:photo' },
  'panel:library:RIGHTS AND LAW': {
    name: 'Your rights, from the documents',
    line: 'You can open what the law and the courts actually say: your rights in the UK, and the rulings and findings in the news.',
    more: 'Stopped and searched, at a police station, renting and eviction, things you buy, work, school exclusions, disability and your data, each from GOV.UK, the law itself, Citizens Advice, Shelter or the regulator, with who to call; and the ICJ’s orders, the ICC’s warrants and the UN commission’s findings, put exactly as strongly as each document does. Every document was read and dated, with a link to it. It is not legal advice.',
    say: ['What are my rights if the police stop and search me?', 'What did the ICJ order about Gaza?', 'My rights as a tenant'],
    scene: ['school', 'out', 'money'], cat: 'know', since: SINCE,
    go: { open: 'library', panel: 'RIGHTS AND LAW' }, tryText: 'Opens rights and law',
  },
  'phrase:units': {
    name: 'Units worked out instantly',
    line: 'You can ask me “3.5 miles in km” or “100 F in C”, and I answer on the phone with no AI.',
    more: 'Lengths, weights, volumes, areas, speeds, temperatures, time, data sizes, energy, power, pressure and fuel use, feet and inches, stone and pounds too. Money is different: the phone has no live rate, so ask me and I give today’s rate with where it came from.',
    say: ['3.5 miles in km', '100 F in C', '5 ft 10 in cm'],
    scene: ['phone', 'school'], cat: 'know', since: SINCE,
    go: { ask: '3.5 miles in km', send: true }, tryText: 'Works it out',
  },
  'phrase:base64': {
    name: 'Base64 both ways',
    line: 'You can turn words into base64 and base64 back into words, on the phone.',
    more: 'Say “hello in base64” or “decode aGVsbG8=”. Base64 that holds a file rather than words is said so; the converter keeps that file. Nothing is sent anywhere.',
    say: ['Hello in base64', 'Decode aGVsbG8='],
    scene: ['phone'], cat: 'build', since: SINCE,
    go: { ask: 'Hello in base64', send: true }, tryText: 'Encodes it',
  },
  'phrase:unixtime': {
    name: 'Unix times as dates',
    line: 'You can turn a Unix time into a date and a date into a Unix time.',
    more: 'Say “1700000000 as a date” or “2025-03-01 in unix time”, or ask the Unix time now. It is worked out on the phone, in UK time.',
    say: ['1700000000 as a date', 'What is the unix time now?'],
    scene: ['phone'], cat: 'build', since: SINCE,
    go: { ask: '1700000000 as a date', send: true }, tryText: 'Says the date',
  },
};
