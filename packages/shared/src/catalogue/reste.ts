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
