/**
 * THE CHAT'S WORDS FOR BATCH 8 PART E, on the phone with no model (the tables are assistant/phrases.ts LOCAL_ASKS; local.ts
 * writes the chat from what these return): the converter opened ("convert this to PDF", "make a QR code"), and its units
 * and numbers answered here ("3.5 miles in km", "hello in base64", "1700000000 as a date"). Money at today's rate is
 * not here: the brain gives the rate with its source.
 */
import { convertAsked } from '../convert/asks';
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
