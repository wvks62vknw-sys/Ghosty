/**
 * The PDF's own letters: the standard fonts every PDF reader carries (Times for the words, Helvetica for headings), so a
 * document made here needs no font inside it. Their widths, for laying a line out, are the fonts' published metrics as
 * pdf.js carries them (vendor/pdfjs, Apache-2.0), for the Windows-1252 ("WinAnsi") letters codes 32 to 255: two base-36
 * digits a letter, in thousandths of the size. Text with letters outside that set (Urdu, Greek, Chinese) is drawn by the
 * phone instead (docs/layout.ts). Pure.
 */

export type PdfFont = 'Times-Roman' | 'Times-Bold' | 'Times-Italic' | 'Times-BoldItalic' | 'Helvetica' | 'Helvetica-Bold';

const W: Record<PdfFont, string> = {
  'Times-Roman': '6y99bcdwdwn5lm509999dwfo6y996y7qdwdwdwdwdwdwdwdwdwdw7q7qfofofoccplk2ijijk2gzfgk2k299atk2gzopk2k2fgk2ijfggzk2k2q8k2k2gz997q99d1dw99ccdwccdwcc99dwdw7q7qdw7qlmdwdwdwdw99at7qdwdwk2dwdwccdc5kdcf100dw0099dwccrsdwdw99rsfg99op00gz00009999cccc9qdwrs99r8at99k200cck26y99dwdwdwdw5kdw99l47odwfo99l499b4fo8c8c99dwcl6y998c8mdwkukukucck2k2k2k2k2k2opijgzgzgzgz99999999k2k2k2k2k2k2k2fok2k2k2k2k2k2fgdwccccccccccccijcccccccccc7q7q7q7qdwdwdwdwdwdwdwfodwdwdwdwdwdwdwdw',
  'Times-Bold': '6y99ffdwdwrsn57q9999dwfu6y996y7qdwdwdwdwdwdwdwdwdwdw9999fufufudwpuk2ijk2k2ijgzlmlmatdwlmijq8k2lmgzlmk2fgijk2k2rsk2k2ij997q99g5dw99dwfgccfgcc99dwfg7q99fg7qn5fgdwfgfgccat99fgdwk2dwdwccay64ayeg00dw0099dwdwrsdwdw99rsfg99rs00ij00009999dwdw9qdwrs99rsat99k200cck26y99dwdwdwdw64dw99kr8cdwfu99kr99b4fu8c8c99fgf06y998c96dwkukukudwk2k2k2k2k2k2rsk2ijijijijatatatatk2k2lmlmlmlmlmfulmk2k2k2k2k2gzfgdwdwdwdwdwdwk2cccccccccc7q7q7q7qdwfgdwdwdwdwdwfudwfgfgfgfgdwfgdw',
  'Times-Italic': '6y99bodwdwn5lm5y9999dwir6y996y7qdwdwdwdwdwdwdwdwdwdw9999iririrdwpkgzgzijk2gzgzk2k299ccijfgn5ijk2gzk2gzdwfgk2gzn5gzfgfgat7qatbqdw99dwdwccdwcc7qdwdw7q7qcc7qk2dwdwdwdwatat7qdwccijccccatb47nb4f100dw0099dwfgopdwdw99rsdw99q800fg00009999fgfg9qdwop99r8at99ij00atfg6yatdwdwdwdw7ndw99l47odwir99l499b4ir8c8c99dwej6y998c8mdwkukukudwgzgzgzgzgzgzopijgzgzgzgz99999999k2ijk2k2k2k2k2irk2k2k2k2k2fggzdwdwdwdwdwdwdwijcccccccccc7q7q7q7qdwdwdwdwdwdwdwirdwdwdwdwdwccdwcc',
  'Times-BoldItalic': '6yatffdwdwn5lm7q9999dwfu6y996y7qdwdwdwdwdwdwdwdwdwdw9999fufufudwn4ijijijk2ijijk2lmatdwijgzopk2k2gzk2ijfggzk2ijopijgzgz997q99fudw99dwdwccdwcc99dwfg7q7qdw7qlmfgdwdwdwatat7qfgccijdwccat9o649ofu00dw0099dwdwrsdwdw99rsfg99q800gz00009999dwdw9qdwrs99rsat99k200atgz6yatdwdwdwdw64dw99kr7edwgu99kr99b4fu8c8c99g0dw6y998c8cdwkukukudwijijijijijijq8ijijijijijatatatatk2k2k2k2k2k2k2fuk2k2k2k2k2gzgzdwdwdwdwdwdwdwk2cccccccccc7q7q7q7qdwfgdwdwdwdwdwfudwfgfgfgfgccdwcc',
  'Helvetica': '7q7q9vfgfgopij5b9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg7q7qg8g8g8fgs7ijijk2k2ijgzlmk27qdwijfgn5k2lmijlmk2ijgzk2ijq8ijijgz7q7q7qd1fg99fgfgdwfgfg7qfgfg6666dw66n5fgfgfgfg99dw7qfgdwk2dwdwdw9a789ag800fg0066fg99rsfgfg99rsij99rs00gz0000666699999qfgrs99rsdw99q800dwij7q99fgfgfgfg78fg99khaafgg899kh99b4g8999999fgex7q9999a5fgn6n6n6gzijijijijijijrsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgzfgfgfgfgfgfgopdwfgfgfgfg7q7q7q7qfgfgfgfgfgfgfgg8gzfgfgfgfgdwfgdw',
  'Helvetica-Bold': '7q99d6fgfgopk26m9999atg87q997q7qfgfgfgfgfgfgfgfgfgfg9999g8g8g8gzr3k2k2k2k2ijgzlmk27qfgk2gzn5k2lmijlmk2ijgzk2ijq8ijijgz997q99g8fg99fggzfggzfg99gzgz7q7qfg7qopgzgzgzgzatfg99gzfglmfgfgdwat7satg800fg007qfgdwrsfgfg99rsij99rs00gz00007q7qdwdw9qfgrs99rsfg99q800dwij7q99fgfgfgfg7sfg99khaafgg899kh99b4g8999999gzfg7q9999a5fgn6n6n6gzk2k2k2k2k2k2rsk2ijijijij7q7q7q7qk2k2lmlmlmlmlmg8lmk2k2k2k2ijijgzfgfgfgfgfgfgopfgfgfgfgfg7q7q7q7qgzgzgzgzgzgzgzg8gzgzgzgzgzfggzfg',
};

const TABLES = new Map<PdfFont, Uint16Array>();
function table(f: PdfFont): Uint16Array {
  let t = TABLES.get(f);
  if (!t) {
    const s = W[f];
    t = new Uint16Array(256);
    for (let i = 0; i < 224; i++) t[32 + i] = parseInt(s.slice(i * 2, i * 2 + 2), 36);
    TABLES.set(f, t);
  }
  return t;
}

/** Windows-1252's letters 128 to 159, as Unicode (the rest of 32 to 255 is Latin-1 itself). */
const HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
const TO_ANSI = new Map<number, number>();
for (let i = 0; i < 32; i++) if (!/[\u0081\u008d\u008f\u0090\u009d]/.test(HIGH[i]!)) TO_ANSI.set(HIGH.charCodeAt(i), 128 + i);

/** A letter's WinAnsi code (-1: not in the set). Tabs and the odd spaces are spaces. */
export function ansiCode(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  if (c === 9 || c === 0x2009 || c === 0x202f || c === 0x2002 || c === 0x2003 || c === 0x200a) return 32;
  if (c >= 32 && c < 127) return c;
  if (c >= 160 && c <= 255) return c;
  if (c === 0x2011 || c === 0x2010 || c === 0x2212) return 45;
  if (c === 0x2032) return 39;
  return TO_ANSI.get(c) ?? -1;
}

/** Every letter of the text is one the standard fonts have. */
export const fitsAnsi = (text: string): boolean => [...text].every((ch) => ch === '\n' || ansiCode(ch) >= 0);

/** The text in WinAnsi bytes (a letter the set lacks becomes "?"). */
export function ansiBytes(text: string): number[] {
  return [...text].map((ch) => {
    const a = ansiCode(ch);
    return a < 0 ? 63 : a;
  });
}

/** How wide the text is, in points, at this size. */
export function textWidth(text: string, font: PdfFont, size: number): number {
  const t = table(font);
  let w = 0;
  for (const b of ansiBytes(text)) w += t[b] || 500;
  return (w * size) / 1000;
}
