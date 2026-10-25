/**
 * Official exam papers the owner adds to his Library by hand (OWNER-ISSUES 17: a paper is private, never redistributed,
 * never trained on). The School keeps its own papers out of training by construction; a PDF of a past paper added through
 * ADD becomes an ordinary document, so the weekly training (selftrain/factory.ts ownerPassages) asks this before it reads
 * one, and the Library can say "kept private" on the shelf. Conservative on purpose: a board's name with a paper's
 * markings, or two markings alone, counts; a textbook that mentions GCSE once does not.
 */
const BOARD = /\b(AQA|Edexcel|Pearson|OCR|WJEC|Eduqas|CCEA|SQA|Cambridge (International|Assessment)|CIE|IB(DP)?|International Baccalaureate)\b/;
const MARK = /\b(GCSE|I?GCSE|A[- ]?level|AS[- ]?level|Paper [1-4]\b|Question Paper|Mark Scheme|Marking Scheme|Specimen|Candidate (number|name)|Centre number|Time allowed|Do not write outside the box|Answer all (the )?questions|Total for (this )?question|Surname|Other names|for this paper you must have)/i;

/** True when a title and a document's opening words read as an exam paper or its mark scheme. */
export function looksLikeExamPaper(title: string, text: string): boolean {
  const head = `${title}\n${text}`.slice(0, 4000);
  const marks = new Set((head.match(new RegExp(MARK.source, 'gi')) ?? []).map((m) => m.toLowerCase().replace(/\s+/g, ' ')));
  return (BOARD.test(head) && marks.size >= 1) || marks.size >= 2;
}
