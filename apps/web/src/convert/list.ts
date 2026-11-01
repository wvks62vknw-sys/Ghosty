/**
 * THE CONVERSIONS (BRIEF-REST-E part 1), as data: each one's words, the kinds of file it takes, how many, and what it
 * makes. The sheet offers the ones that apply to what he chose (convert/sheet.ts runs them, convert/run.ts does the
 * work); the tests count them. All on the phone, nothing uploaded anywhere. Pure.
 */
import type { Kind } from './bytes';

export type Group = 'images' | 'pdf' | 'text' | 'documents' | 'audio' | 'codes' | 'numbers';
export interface Conversion {
  id: string;
  label: string;
  group: Group;
  /** The kinds it takes; [] for a tool that needs no file (a QR code made, units, base64, Unix time, a pasted table, recording). */
  from: Kind[];
  /** At least this many files (two PDFs to join). */
  min?: number;
  /** Several files at once (pictures into one PDF). */
  many?: boolean;
  /** What it makes. */
  to: string;
  /** What it needs that only some phones have, said on its button. */
  note?: string;
}

const PICS: Kind[] = ['jpg', 'png', 'webp', 'gif', 'heic', 'bmp', 'tiff'];
const SOUND: Kind[] = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac', 'webm', 'mp4', 'mov'];
const READABLE: Kind[] = ['txt', 'md', 'html', 'docx', 'epub', 'pdf', 'csv', 'json'];

export const CONVERSIONS: Conversion[] = [
  // IMAGES
  { id: 'img-jpg', label: 'To JPG', group: 'images', from: PICS, many: true, to: 'jpg', note: 'HEIC where this phone opens it' },
  { id: 'img-png', label: 'To PNG', group: 'images', from: PICS, many: true, to: 'png' },
  { id: 'img-webp', label: 'To WebP', group: 'images', from: PICS, many: true, to: 'webp', note: 'where this phone writes WebP' },
  { id: 'img-resize', label: 'Resize', group: 'images', from: PICS, many: true, to: 'same' },
  { id: 'img-compress', label: 'Shrink to a size', group: 'images', from: PICS, many: true, to: 'jpg' },
  { id: 'img-crop', label: 'Crop to a shape', group: 'images', from: PICS, many: true, to: 'same' },
  { id: 'img-strip', label: 'Take the location out', group: 'images', from: ['jpg', 'png', 'webp'], many: true, to: 'same' },
  { id: 'images-pdf', label: 'Pictures into one PDF', group: 'images', from: PICS, many: true, to: 'pdf' },
  // PDF
  { id: 'pdf-png', label: 'Pages to PNG pictures', group: 'pdf', from: ['pdf'], to: 'png' },
  { id: 'pdf-split', label: 'Take pages out', group: 'pdf', from: ['pdf'], to: 'pdf' },
  { id: 'pdf-join', label: 'Join PDFs into one', group: 'pdf', from: ['pdf'], min: 2, many: true, to: 'pdf' },
  { id: 'pdf-text', label: 'Its words as text', group: 'pdf', from: ['pdf'], to: 'txt' },
  // TEXT AND DATA
  { id: 'txt-md', label: 'Text to Markdown', group: 'text', from: ['txt'], to: 'md' },
  { id: 'md-html', label: 'To a web page (HTML)', group: 'text', from: ['md', 'txt'], to: 'html' },
  { id: 'html-md', label: 'Web page to Markdown', group: 'text', from: ['html'], to: 'md' },
  { id: 'html-txt', label: 'Web page to text', group: 'text', from: ['html', 'md'], to: 'txt' },
  { id: 'csv-json', label: 'CSV to JSON', group: 'text', from: ['csv', 'tsv'], to: 'json' },
  { id: 'json-csv', label: 'JSON to CSV', group: 'text', from: ['json'], to: 'csv' },
  { id: 'csv-xlsx', label: 'CSV to Excel', group: 'text', from: ['csv', 'tsv'], to: 'xlsx' },
  { id: 'json-xlsx', label: 'JSON to Excel', group: 'text', from: ['json'], to: 'xlsx' },
  { id: 'xlsx-csv', label: 'Excel to CSV', group: 'text', from: ['xlsx', 'ods'], to: 'csv' },
  { id: 'xlsx-json', label: 'Excel to JSON', group: 'text', from: ['xlsx', 'ods'], to: 'json' },
  { id: 'json-pretty', label: 'JSON made tidy', group: 'text', from: ['json'], to: 'json' },
  { id: 'json-small', label: 'JSON made small', group: 'text', from: ['json'], to: 'json' },
  { id: 'table-csv', label: 'A pasted table to CSV', group: 'text', from: [], to: 'csv' },
  // DOCUMENTS
  { id: 'docx-txt', label: 'Word to text', group: 'documents', from: ['docx'], to: 'txt' },
  { id: 'docx-html', label: 'Word to a web page', group: 'documents', from: ['docx'], to: 'html' },
  { id: 'to-docx', label: 'To a Word document', group: 'documents', from: ['txt', 'md', 'html', 'docx', 'epub', 'pdf'], to: 'docx' },
  { id: 'to-pdf', label: 'To a PDF document', group: 'documents', from: READABLE.filter((k) => k !== 'pdf'), to: 'pdf' },
  { id: 'open-doc', label: 'Open as a document', group: 'documents', from: READABLE, to: 'doc' },
  // AUDIO
  { id: 'audio-wav', label: 'To WAV', group: 'audio', from: SOUND.filter((k) => k !== 'wav'), to: 'wav', note: 'what this phone’s player reads' },
  { id: 'audio-mp3', label: 'To MP3', group: 'audio', from: SOUND, to: 'mp3' },
  { id: 'audio-phone', label: 'To this phone’s own format', group: 'audio', from: ['wav'], to: 'm4a', note: 'played through once, in real time' },
  { id: 'audio-trim', label: 'Cut a stretch out', group: 'audio', from: SOUND, to: 'wav' },
  { id: 'record-wav', label: 'Record a WAV', group: 'audio', from: [], to: 'wav' },
  // CODES
  { id: 'code-read', label: 'Read a QR code or barcode', group: 'codes', from: PICS, to: 'text' },
  { id: 'qr-make', label: 'Make a QR code', group: 'codes', from: [], to: 'png' },
  // UNITS AND NUMBERS
  { id: 'units', label: 'Units', group: 'numbers', from: [], to: 'text' },
  { id: 'money', label: 'Money at a rate', group: 'numbers', from: [], to: 'text' },
  { id: 'base64', label: 'Base64 and text', group: 'numbers', from: [], to: 'text' },
  { id: 'unix-time', label: 'Unix time and dates', group: 'numbers', from: [], to: 'text' },
];

export const GROUP_WORDS: Record<Group, string> = { images: 'PICTURES', pdf: 'PDF', text: 'TEXT AND DATA', documents: 'DOCUMENTS', audio: 'SOUND', codes: 'CODES', numbers: 'UNITS AND NUMBERS' };

/** What is not done, and why: the sheet says it in these words when a video is chosen. */
export const VIDEO_LINE = 'Video is not on the phone: a video converter would be about 30 MB to download and very slow here. Your phone can share or save the video as it is.';

/** The conversions for these files (their kinds), in the list's order: each needs every file to be a kind it takes. */
export function forKinds(kinds: Kind[]): Conversion[] {
  if (!kinds.length) return CONVERSIONS.filter((c) => !c.from.length);
  return CONVERSIONS.filter((c) => c.from.length && kinds.every((k) => c.from.includes(k)) && kinds.length >= (c.min ?? 1) && (kinds.length === 1 || c.many));
}
