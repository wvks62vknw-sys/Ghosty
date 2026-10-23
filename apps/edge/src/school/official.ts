/**
 * SCHOOL's OFFICIAL papers: the real exams, kept private. The owner's rule (HANDOFF.md "Raising Ghosty"): official
 * past papers where they exist, only those the Standards and Testing Agency and the exam boards publish free on
 * their own sites, never redistributed, never trained on, with the source and licence noted for each.
 *
 * `OFFICIAL` is the curated list (each URL checked when it was added; the report lists the checks): the Key Stage 2
 * SATs for the three most recent years published (gov.uk, Open Government Licence v3.0) with their mark schemes and
 * raw-to-scaled-score tables, and GCSE and A-level papers from AQA, Pearson Edexcel and OCR (free for personal use;
 * copyright stays with the board) with their mark schemes and the board's grade boundaries for that series.
 *
 * How one gets in (FETCH, in the SCHOOL tab):
 *  1. the phone downloads each part through the brain (`fileResponse`: only the curated addresses, nothing else)
 *     and reads it to text with the library's own PDF reader (apps/web/src/school/official.ts);
 *  2. the text comes here (`saveText`) and is kept privately under `school:official:<id>:text:*`;
 *  3. `officialTick` turns it into questions in slices (at most `CALLS_PER_TICK` model calls each, resumable):
 *     the separate reading texts or sources, then the questions part by part (question text, marks, type; a
 *     question that needs a diagram is noted "needs the picture"), then the mark scheme part by part (the answer,
 *     or the marking points), joined by question number, then CHECKED the same way as a bank (banks.ts
 *     `checkDrafts`); what cannot be used is left out with its marks and the reason, and the paper's real
 *     boundaries are scaled to the marks he can sit (`scaleBands`);
 *  4. the paper is kept under `school:official:<id>` with its source, licence, year and boundaries.
 * Never in the library, never exported, never trained on. A sat official paper is marked and graded exactly like
 * any other, against its real boundaries; its result says "official" and names the year and the board.
 */
import { boundaryBands, normaliseText, parseNumber, scaleBands, scaledBands, type GradeBand, type StageId } from '../../../../packages/shared/src/school';
import { CALLS_PER_TICK, checkDrafts, cleanDraft, jsonArray, nextBatch, numberedLines, subjectWords, type Draft } from './banks';
import type { Ask } from './mark';
import type { Passage, SchoolItem, SchoolPaper } from './papers';

export interface OfficialPart {
  /** 'questions': the question paper(s); 'texts': the reading texts or sources the questions are about; 'marks': the mark scheme. */
  role: 'questions' | 'texts' | 'marks';
  label: string;
  url: string;
}

export interface OfficialEntry {
  id: string;
  stage: StageId;
  subject: string;
  board: 'Standards and Testing Agency' | 'AQA' | 'Pearson Edexcel' | 'OCR';
  year: number;
  /** "May 2024", "June 2023". */
  series: string;
  /** The board's paper code, when it has one ("8300/1H"). */
  code?: string;
  /** "Key Stage 2 mathematics, papers 1–3". */
  title: string;
  parts: OfficialPart[];
  /** The paper's real total. */
  fullMarks: number;
  /** A part of the real test that is not given to him (marks left out of the total), e.g. the spelling test read aloud. */
  leftOut?: { what: string; marks: number; why: string };
  /** The real boundaries: the STA's scaled-score table (`table[raw]`), or the board's grade boundaries for the paper. */
  bands: { kind: 'scaled'; table: number[] } | { kind: 'grades'; grades: [string, number][]; top: string[] };
  /** Where the boundaries come from, in words, and the page they were read from. */
  boundaries: string;
  boundariesUrl: string;
  /** Where the paper comes from (the publisher's page) and its licence, word for word as the owner sees them. */
  source: string;
  licence: string;
  /** Something the owner should know about this paper. */
  note?: string;
}

// ---- the curated list ---------------------------------------------------------------------------------------------

const GOV = 'https://assets.publishing.service.gov.uk/media/';
const AQA = 'https://filestore.aqa.org.uk/sample-papers-and-mark-schemes/';
const PEARSON = 'https://qualifications.pearson.com/content/dam/pdf/';
const OCR = 'https://www.ocr.org.uk/Images/';
/** The hosts the curated papers come from (the brain fetches only the exact addresses below). */
export const OFFICIAL_HOSTS = ['assets.publishing.service.gov.uk', 'filestore.aqa.org.uk', 'qualifications.pearson.com', 'www.ocr.org.uk'];

const STA_LICENCE = 'Crown copyright, Open Government Licence v3.0 — texts by other authors in the reading booklets stay theirs (see STA\'s copyright note). Kept private on Ghosty; never shared.';
const AQA_LICENCE = 'Copyright AQA and its licensors. Free to download for personal, non-commercial use; copyright stays with AQA. Kept private on Ghosty; never shared or redistributed.';
const PEARSON_LICENCE = 'Copyright Pearson Education Ltd. Free to download for personal use; copyright stays with Pearson. Kept private on Ghosty; never shared or redistributed.';
const OCR_LICENCE = 'Copyright OCR. Free to download for personal use; copyright stays with OCR. Kept private on Ghosty; never shared or redistributed.';

/** The STA's raw-to-scaled-score tables (gov.uk "Key stage 2 tests: <year> scaled scores"): index = raw mark. */
const SCALED: Record<string, string> = {
  '2024 reading': '0,0,0,80,82,83,84,85,86,87,88,89,90,90,91,92,93,93,94,95,95,96,97,97,98,99,99,100,101,101,102,103,104,104,105,106,107,108,108,109,110,111,113,114,115,116,118,119,120,120,120',
  '2024 gps': '0,0,0,80,81,82,83,84,85,86,86,87,88,88,89,90,90,91,91,92,92,93,94,94,95,95,95,96,96,97,97,98,98,99,99,100,100,101,101,102,102,103,103,104,104,105,105,106,106,107,108,108,109,110,110,111,112,112,113,114,115,116,117,118,119,120,120,120,120,120,120',
  '2024 maths': '0,0,0,81,82,83,84,84,85,86,86,87,87,88,88,89,89,90,90,90,91,91,91,92,92,92,93,93,93,94,94,94,94,95,95,95,96,96,96,96,96,97,97,97,97,98,98,98,98,99,99,99,99,99,100,100,100,100,101,101,101,101,101,102,102,102,102,103,103,103,103,103,104,104,104,104,105,105,105,105,106,106,106,106,107,107,107,108,108,108,109,109,109,110,110,111,111,111,112,112,113,114,114,115,116,117,118,119,120,120,120',
  '2025 reading': '0,0,0,80,80,82,83,84,85,86,87,88,89,89,90,91,92,92,93,94,95,95,96,97,97,98,99,99,100,101,101,102,103,104,104,105,106,107,108,109,110,111,112,113,114,116,117,119,120,120,120',
  '2025 gps': '0,0,0,80,80,82,83,84,85,86,86,87,88,89,89,90,90,91,92,92,93,93,94,94,95,95,96,96,97,97,98,98,98,99,99,100,100,101,101,102,102,103,103,104,104,105,105,106,106,107,108,108,109,109,110,111,111,112,113,114,115,116,117,118,119,120,120,120,120,120,120',
  '2025 maths': '0,0,0,80,80,80,81,82,83,84,84,85,85,86,86,87,87,88,88,89,89,89,90,90,91,91,91,92,92,92,92,93,93,93,94,94,94,94,95,95,95,95,96,96,96,96,97,97,97,97,98,98,98,98,99,99,99,99,100,100,100,100,101,101,101,101,102,102,102,102,102,103,103,103,103,104,104,104,105,105,105,105,106,106,106,106,107,107,107,108,108,108,109,109,109,110,110,111,111,112,112,113,113,114,115,116,117,118,119,120,120',
  '2026 reading': '0,0,0,81,82,84,85,86,87,88,89,90,91,92,93,93,94,95,95,96,97,98,98,99,99,100,101,101,102,103,103,104,105,106,106,107,108,109,109,110,111,112,113,114,116,117,118,120,120,120,120',
  '2026 gps': '0,0,0,80,81,82,83,84,85,86,87,87,88,89,90,90,91,91,92,92,93,94,94,95,95,95,96,96,97,97,98,98,99,99,100,100,100,101,101,102,102,103,103,104,104,105,105,106,106,107,107,108,108,109,109,110,111,111,112,113,114,115,116,117,118,119,120,120,120,120,120',
  '2026 maths': '0,0,0,80,80,80,80,81,82,83,83,84,85,85,86,86,87,87,88,88,89,89,90,90,90,91,91,92,92,92,93,93,93,94,94,94,94,95,95,95,96,96,96,96,97,97,97,97,98,98,98,98,99,99,99,99,100,100,100,100,101,101,101,101,101,102,102,102,102,103,103,103,103,104,104,104,104,105,105,105,106,106,106,106,107,107,107,108,108,108,108,109,109,109,110,110,111,111,112,112,113,113,114,114,115,116,117,118,119,120,120',
};
const table = (k: string): number[] => SCALED[k]!.split(',').map(Number);

/** The Key Stage 2 SATs of one year: reading, grammar/punctuation/spelling (paper 1) and maths papers 1–3. */
function sats(year: number, files: { reading: [string, string, string]; gps: [string, string]; maths: [string, string, string, string] }): OfficialEntry[] {
  const common = { stage: 'ks2' as StageId, board: 'Standards and Testing Agency' as const, year, series: `May ${year}`, licence: STA_LICENCE, boundariesUrl: `https://www.gov.uk/government/publications/key-stage-2-tests-${year}-scaled-scores` };
  const page = (s: string) => `gov.uk, "Key stage 2 tests: ${year} ${s} test materials" (Standards and Testing Agency)`;
  return [
    { ...common, id: `ks2-${year}-reading`, subject: 'reading', title: `Key Stage 2 English reading (${year} SATs)`, parts: [{ role: 'texts', label: 'Reading booklet', url: GOV + files.reading[0] }, { role: 'questions', label: 'Reading answer booklet', url: GOV + files.reading[1] }, { role: 'marks', label: 'Mark schemes', url: GOV + files.reading[2] }], fullMarks: 50, bands: { kind: 'scaled', table: table(`${year} reading`) }, boundaries: `the STA's ${year} raw-to-scaled-score table for reading (110+ is the higher standard)`, source: page('English reading') },
    { ...common, id: `ks2-${year}-gps`, subject: 'gps', title: `Key Stage 2 grammar, punctuation and spelling (${year} SATs)`, parts: [{ role: 'questions', label: 'Paper 1: questions', url: GOV + files.gps[0] }, { role: 'marks', label: 'Mark schemes', url: GOV + files.gps[1] }], fullMarks: 70, leftOut: { what: 'Paper 2: spelling', marks: 20, why: 'it is read aloud by a teacher, so it cannot be sat in writing' }, bands: { kind: 'scaled', table: table(`${year} gps`) }, boundaries: `the STA's ${year} raw-to-scaled-score table for grammar, punctuation and spelling (110+ is the higher standard)`, source: page('English grammar, punctuation and spelling') },
    { ...common, id: `ks2-${year}-maths`, subject: 'maths', title: `Key Stage 2 mathematics, papers 1–3 (${year} SATs)`, parts: [{ role: 'questions', label: 'Paper 1: arithmetic', url: GOV + files.maths[0] }, { role: 'questions', label: 'Paper 2: reasoning', url: GOV + files.maths[1] }, { role: 'questions', label: 'Paper 3: reasoning', url: GOV + files.maths[2] }, { role: 'marks', label: 'Mark schemes', url: GOV + files.maths[3] }], fullMarks: 110, bands: { kind: 'scaled', table: table(`${year} maths`) }, boundaries: `the STA's ${year} raw-to-scaled-score table for mathematics (110+ is the higher standard)`, source: page('mathematics') },
  ];
}

type BoardPaper = { id: string; stage: StageId; subject: string; code: string; title: string; year?: number; files: [OfficialPart['role'], string, string][]; fullMarks: number; grades: number[]; note?: string };
const GCSE_HIGHER = ['9', '8', '7', '6', '5', '4', '3'];
const GCSE_ALL = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
const ALEVEL = ['A*', 'A', 'B', 'C', 'D', 'E'];
function board(name: 'AQA' | 'Pearson Edexcel' | 'OCR', licence: string, boundariesFor: (p: BoardPaper) => { words: string; url: string }, list: BoardPaper[]): OfficialEntry[] {
  return list.map((p) => {
    const year = p.year ?? 2023;
    const names = p.stage === 'alevel' ? ALEVEL : p.grades.length === 7 ? GCSE_HIGHER : GCSE_ALL;
    const b = boundariesFor(p);
    return {
      id: p.id,
      stage: p.stage,
      subject: p.subject,
      board: name,
      year,
      series: `June ${year}`,
      code: p.code,
      title: p.title,
      parts: p.files.map(([role, label, url]) => ({ role, label, url })),
      fullMarks: p.fullMarks,
      bands: { kind: 'grades', grades: names.map((g, i) => [g, p.grades[i]!] as [string, number]), top: p.stage === 'alevel' ? ['A*', 'A'] : ['9', '8'] },
      boundaries: b.words,
      boundariesUrl: b.url,
      source: `${name}'s own website (${p.code}, June ${year})`,
      licence,
      ...(p.note ? { note: p.note } : {}),
    };
  });
}
const aqaBounds = (p: BoardPaper) => {
  const year = p.year ?? 2023;
  return p.stage === 'alevel'
    ? { words: `AQA's June ${year} notional boundaries for ${p.code} (A* to E; AQA sets real grades on the whole A-level)`, url: `https://filestore.aqa.org.uk/over/stat_pdf/AQA-A-LEVEL-GDE-BDY-JUN-${year}.PDF` }
    : { words: `AQA's June ${year} notional boundaries for ${p.code} (AQA sets real grades on the whole GCSE)`, url: `https://filestore.aqa.org.uk/over/stat_pdf/AQA-GCSE-GDE-BDY-JUN-${year}.PDF` };
};
const qp = (code: string, y = 23): [OfficialPart['role'], string, string] => ['questions', 'Question paper', `${AQA}20${y}/june/AQA-${code}-QP-JUN${y}.PDF`];
const ms = (code: string, y = 23): [OfficialPart['role'], string, string] => ['marks', 'Mark scheme', `${AQA}20${y}/june/AQA-${code}-MS-JUN${y}.PDF`];
const ins = (code: string, label: string, y = 23): [OfficialPart['role'], string, string] => ['texts', label, `${AQA}20${y}/june/AQA-${code}-INS-JUN${y}.PDF`];

export const OFFICIAL: OfficialEntry[] = [
  ...sats(2024, {
    reading: ['664dc1c9ae748c43d3793ff6/STA248811e_2024_ks2_English_reading_Reading_booklet.pdf', '664dc1d8f34f9b5a56adcc23/STA248810e_2024_ks2_English_reading_Reading_answer_booklet.pdf', '664dc202f34f9b5a56adcc26/STA248812e_2024_ks2_English_reading_mark_schemes.pdf'],
    gps: ['664dbfb8bd01f5ed32794010/STA248814e_2024_ks2_English_GPS_Paper1_questions.pdf', '664dc027993111924d9d397b/STA248816e_2024_ks2_English_GPS_Mark_schemes.pdf'],
    maths: ['664dc7a9bd01f5ed32794027/STA248817e_2024_ks2_mathematics_Paper1_arithmetic.pdf', '664dc7b6f34f9b5a56adcc33/STA248818e_2024_ks2_mathematics_Paper2_reasoning.pdf', '664dc7c14f29e1d07fadcc6f/STA248819e_2024_ks2_mathematics_Paper3_reasoning.pdf', '664dc7cdbd01f5ed3279402a/STA248820e_2024_ks2_mathematics_Mark_schemes.pdf'],
  }),
  ...sats(2025, {
    reading: ['682dbf58baff3dab99775154/2025_KS2_English_reading_booklet.pdf', '682dbe67a599d03a16bff380/2025_KS2_English_reading_answer_booklet.pdf', '682dbf86baff3dab99775155/2025_KS2_English_reading_mark_schemes.pdf'],
    gps: ['682dbbc6baff3dab99775152/2025_KS2_English_GPS_Paper1_questions.pdf', '682dc190baff3dab99775157/2025_KS2_English_GPS_mark_schemes.pdf'],
    maths: ['682dc2d8e9440506ee9538ef/2025_KS2_mathematics_Paper1_arithmetic.pdf', '682dc30b7fb7a7d9cd77515a/2025_KS2_mathematics_Paper2_reasoning.pdf', '682dc339a599d03a16bff385/2025_KS2_mathematics_Paper3_reasoning.pdf', '682dc3717fb7a7d9cd77515b/2025_KS2_mathematics_mark_schemes.pdf'],
  }),
  ...sats(2026, {
    reading: ['6a0af4c9229555d0fe826722/2026_KS2_English_reading_booklet.pdf', '6a0af4ea229555d0fe826723/2026_KS2_English_reading_answer_booklet.pdf', '6a0af5ae279ebb7d24f8f3ae/2026_KS2_English_reading_mark_schemes.pdf'],
    gps: ['6a0af089229555d0fe82671d/2026_KS2_English_GPS_Paper1_questions.pdf', '6a0af15cc510c3913d826736/2026_KS2_English_GPS_mark_schemes.pdf'],
    maths: ['6a0af8a5279ebb7d24f8f3b1/2026_KS2_mathematics_Paper1_arithmetic.pdf', '6a0af8b9229555d0fe826727/2026_KS2_mathematics_Paper2_reasoning.pdf', '6a0af8d3c75cc34a8ff8f3e2/2026_KS2_mathematics_Paper3_reasoning.pdf', '6a0af983279ebb7d24f8f3b2/2026_KS2_mathematics_mark_schemes.pdf'],
  }),
  // GCSE: AQA June 2023 (geography: June 2022, the newest paper 1 AQA has public), Pearson Edexcel and OCR June 2023.
  ...board('AQA', AQA_LICENCE, aqaBounds, [
    { id: 'gcse-aqa-8300-1h-2023', stage: 'gcse', subject: 'maths', code: '8300/1H', title: 'GCSE mathematics, Paper 1 Higher (non-calculator)', files: [qp('83001H'), ms('83001H')], fullMarks: 80, grades: [70, 59, 49, 39, 30, 21, 16] },
    { id: 'gcse-aqa-8461-1h-2023', stage: 'gcse', subject: 'biology', code: '8461/1H', title: 'GCSE biology, Paper 1 Higher', files: [qp('84611H'), ms('84611H')], fullMarks: 100, grades: [67, 60, 54, 45, 36, 27, 22] },
    { id: 'gcse-aqa-8462-1h-2023', stage: 'gcse', subject: 'chemistry', code: '8462/1H', title: 'GCSE chemistry, Paper 1 Higher', files: [qp('84621H'), ms('84621H')], fullMarks: 100, grades: [72, 62, 52, 41, 31, 21, 16] },
    { id: 'gcse-aqa-8463-1h-2023', stage: 'gcse', subject: 'physics', code: '8463/1H', title: 'GCSE physics, Paper 1 Higher', files: [qp('84631H'), ms('84631H')], fullMarks: 100, grades: [76, 70, 64, 56, 48, 40, 36] },
    { id: 'gcse-aqa-8700-2-2023', stage: 'gcse', subject: 'english-language', code: '8700/2', title: "GCSE English language, Paper 2: Writers' viewpoints and perspectives", files: [qp('87002'), ins('87002', 'Insert: the two sources'), ms('87002')], fullMarks: 80, grades: [60, 55, 50, 45, 40, 35, 26, 17, 8] },
    { id: 'gcse-aqa-8702-1-2023', stage: 'gcse', subject: 'english-literature', code: '8702/1', title: 'GCSE English literature, Paper 1: Shakespeare and the 19th-century novel', files: [qp('87021'), ms('87021')], fullMarks: 64, grades: [54, 48, 42, 36, 30, 25, 18, 11, 5], note: 'He answers the first question offered in each section (the paper lets a pupil choose one).' },
    { id: 'gcse-aqa-8145-1aa-2023', stage: 'gcse', subject: 'history', code: '8145/1A/A', title: 'GCSE history, Paper 1 Section A: America, 1840–1895', files: [qp('81451AA'), ins('81451AA', 'Interpretations booklet'), ms('81451AA')], fullMarks: 40, grades: [27, 24, 21, 18, 15, 13, 9, 5, 2] },
    { id: 'gcse-aqa-8035-1-2022', stage: 'gcse', subject: 'geography', code: '8035/1', year: 2022, title: 'GCSE geography, Paper 1: Living with the physical environment', files: [qp('80351', 22), ms('80351', 22)], fullMarks: 88, grades: [67, 60, 53, 45, 38, 31, 22, 14, 6], note: 'Many questions use maps and photos he cannot see: those are left out, with their marks.' },
    { id: 'gcse-aqa-8525-2-2023', stage: 'gcse', subject: 'computer-science', code: '8525/2', title: 'GCSE computer science, Paper 2: Computing concepts', files: [qp('85252'), ms('85252')], fullMarks: 90, grades: [74, 67, 60, 51, 43, 35, 25, 16, 7] },
  ]),
  ...board('Pearson Edexcel', PEARSON_LICENCE, (p) => ({ words: `Pearson Edexcel's June 2023 notional boundaries for ${p.code} (Pearson sets real grades on the whole GCSE)`, url: `${PEARSON}Support/Grade-boundaries/GCSE/2306-gcse-9-1-notional-component-grade-boundaries.pdf` }), [
    { id: 'gcse-edexcel-1ma1-1h-2023', stage: 'gcse', subject: 'maths', code: '1MA1/1H', title: 'GCSE mathematics, Paper 1 Higher (non-calculator)', files: [['questions', 'Question paper', `${PEARSON}GCSE/Mathematics/2015/Exam-materials/1ma1-1h-que-20230520.pdf`], ['marks', 'Mark scheme', `${PEARSON}GCSE/Mathematics/2015/Exam-materials/1ma1-1h-rms-20230824.pdf`]], fullMarks: 80, grades: [67, 57, 48, 36, 25, 14, 8] },
  ]),
  ...board('OCR', OCR_LICENCE, (p) => ({ words: `OCR's June 2023 notional boundaries for ${p.code} (OCR sets real grades on the whole GCSE)`, url: `${OCR}690906-gcse-grade-boundaries-june-2023.pdf` }), [
    { id: 'gcse-ocr-j277-01-2023', stage: 'gcse', subject: 'computer-science', code: 'J277/01', title: 'GCSE computer science, Paper 1: Computer systems', files: [['questions', 'Question paper', `${OCR}704760-question-paper-computer-systems.pdf`], ['marks', 'Mark scheme', `${OCR}704882-mark-scheme-computer-systems.pdf`]], fullMarks: 80, grades: [69, 63, 57, 50, 44, 37, 27, 17, 7] },
  ]),
  // A-level: AQA June 2023.
  ...board('AQA', AQA_LICENCE, aqaBounds, [
    { id: 'alevel-aqa-7357-1-2023', stage: 'alevel', subject: 'maths', code: '7357/1', title: 'A-level mathematics, Paper 1', files: [qp('73571'), ms('73571')], fullMarks: 100, grades: [82, 65, 52, 39, 27, 15] },
    { id: 'alevel-aqa-7367-1-2023', stage: 'alevel', subject: 'further-maths', code: '7367/1', title: 'A-level further mathematics, Paper 1', files: [qp('73671'), ms('73671')], fullMarks: 100, grades: [75, 62, 50, 39, 28, 17] },
    { id: 'alevel-aqa-7408-1-2023', stage: 'alevel', subject: 'physics', code: '7408/1', title: 'A-level physics, Paper 1', files: [qp('74081'), ms('74081')], fullMarks: 85, grades: [59, 48, 40, 32, 25, 18], note: 'The data and formulae booklet is not given to him: he must know the constants.' },
    { id: 'alevel-aqa-7405-1-2023', stage: 'alevel', subject: 'chemistry', code: '7405/1', title: 'A-level chemistry, Paper 1: Inorganic and physical chemistry', files: [qp('74051'), ms('74051')], fullMarks: 105, grades: [87, 72, 58, 45, 32, 19], note: 'The data booklet (periodic table) is not given to him.' },
    { id: 'alevel-aqa-7402-1-2023', stage: 'alevel', subject: 'biology', code: '7402/1', title: 'A-level biology, Paper 1', files: [qp('74021'), ms('74021')], fullMarks: 91, grades: [63, 53, 43, 34, 25, 16] },
    { id: 'alevel-aqa-7517-2-2023', stage: 'alevel', subject: 'computer-science', code: '7517/2', title: 'A-level computer science, Paper 2', files: [qp('75172'), ms('75172')], fullMarks: 100, grades: [76, 58, 46, 34, 23, 12] },
    { id: 'alevel-aqa-7136-1-2023', stage: 'alevel', subject: 'economics', code: '7136/1', title: 'A-level economics, Paper 1: Markets and market failure', files: [qp('71361'), ms('71361')], fullMarks: 80, grades: [63, 56, 46, 37, 28, 19], note: 'He answers the first question offered in each section (the paper lets a pupil choose).' },
    { id: 'alevel-aqa-7712-2b-2023', stage: 'alevel', subject: 'english-literature', code: '7712/2B', title: 'A-level English literature A, Paper 2B: Modern times (1945 to today)', files: [qp('77122B'), ins('77122B', 'Insert: the unseen extract'), ms('77122B')], fullMarks: 75, grades: [62, 54, 45, 36, 27, 18], note: 'He answers the first question offered in each section (the paper lets a pupil choose).' },
    { id: 'alevel-aqa-7042-1h-2023', stage: 'alevel', subject: 'history', code: '7042/1H', title: 'A-level history, Component 1H: Tsarist and Communist Russia, 1855–1964', files: [qp('70421H'), ms('70421H')], fullMarks: 80, grades: [59, 48, 39, 30, 22, 14], note: 'He answers the first essay offered in Section B (the paper lets a pupil choose).' },
  ]),
];
export const officialById = (id: string): OfficialEntry | undefined => OFFICIAL.find((e) => e.id === id);

/** The real boundaries of an entry, scaled to the marks he can sit. */
export function entryBands(e: OfficialEntry, sittable: number): GradeBand[] {
  const real = e.bands.kind === 'scaled' ? scaledBands(e.bands.table) : boundaryBands(e.bands.grades, e.bands.top);
  return scaleBands(real, e.fullMarks, sittable);
}

// ---- the record --------------------------------------------------------------------------------------------------

/** A question as read from the paper (before its mark scheme is joined). */
interface ReadQ {
  n: string;
  q: string;
  marks: number;
  type: string;
  options?: string[];
  picture?: boolean;
  text?: string;
  topic?: string;
}
/** A mark scheme entry as read. */
interface ReadA {
  n: string;
  answer: string;
  also?: string[];
  rubric?: string;
}

export type OfficialStatus = 'fetching' | 'reading' | 'ready' | 'failed';
type Phase = 'texts' | 'questions' | 'marks' | 'check' | 'done';

/** An official paper's record (`school:official:<id>`): how far it has got, and the paper once it is ready. */
export interface OfficialRecord {
  id: string;
  status: OfficialStatus;
  /** The parts whose text the phone has sent (part index → pages). */
  got: Record<number, number>;
  phase: Phase;
  /** The window (slice of the text) the phase is at, and how many tries the current one has had. */
  win: number;
  tries: number;
  /** Model calls made, and the total expected (it grows as the questions are found). */
  steps: number;
  plan: number;
  /** Questions found, and those left out (with their marks and why). */
  found: number;
  leftOut: { what: string; marks: number; why: string }[];
  /** Parts of the text that could not be read (after `MAX_TRIES`). */
  unread: number;
  error?: string;
  note: string;
  paper?: SchoolPaper;
  startedAt: number;
  updatedAt: number;
}
/** What is being worked on (kept apart from the record, and dropped when the paper is ready). */
interface Wip {
  passages: Passage[];
  questions: ReadQ[];
  answers: ReadA[];
  drafts: (Draft & { n: string })[];
  kept: (Draft & { n: string })[];
}

export const officialKey = (id: string): string => `school:official:${id}`;
const wipKey = (id: string) => `${officialKey(id)}:wip`;
const textKey = (id: string, part: number, k: number) => `${officialKey(id)}:text:${part}:${k}`;

/** Where official papers live: the brain's own storage, never KV, never the library. */
export interface OfficialStore {
  storage: DurableObjectStorage;
}

export const loadOfficial = async (s: OfficialStore, id: string): Promise<OfficialRecord | undefined> => (await s.storage.get<OfficialRecord>(officialKey(id))) ?? undefined;
/** Every record there is (one read). */
export async function loadAllOfficial(s: OfficialStore): Promise<Map<string, OfficialRecord>> {
  const got = await s.storage.get<OfficialRecord>(OFFICIAL.map((e) => officialKey(e.id)));
  const out = new Map<string, OfficialRecord>();
  for (const e of OFFICIAL) {
    const r = got.get(officialKey(e.id));
    if (r) out.set(e.id, r);
  }
  return out;
}

/** Text the brain keeps of one part: at most this much (a whole mark scheme fits easily). */
export const PART_MAX_CHARS = 400_000;
const CHUNK_CHARS = 90_000;
/** The size of one slice of text sent to the model. */
export const WINDOW_CHARS = 7_000;
const MAX_TRIES = 3;

const fresh = (id: string, now: number): OfficialRecord => ({ id, status: 'fetching', got: {}, phase: 'texts', win: 0, tries: 0, steps: 0, plan: 0, found: 0, leftOut: [], unread: 0, note: '', startedAt: now, updatedAt: now });

/** Page text as the phone read it, tidied: answer lines of dots and underscores shortened, spaces squeezed. */
export function tidyPage(t: string): string {
  return String(t ?? '')
    .replace(/[.…_]{4,}/g, '…')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*(\n\s*)+/g, '\n\n')
    .trim();
}

/**
 * One part's text from the phone. Kept privately in chunks; a FETCH AGAIN (or the first part of a failed one)
 * starts the paper over. When every part is in, the reading starts.
 */
export async function saveText(s: OfficialStore, id: string, part: number, pages: unknown, now: number): Promise<OfficialRecord> {
  const e = officialById(id);
  if (!e) throw new Error('That paper is not on the list.');
  if (!Number.isInteger(part) || part < 0 || part >= e.parts.length) throw new Error('Which part?');
  if (!Array.isArray(pages) || !pages.length) throw new Error('No text came with that part.');
  let r = await loadOfficial(s, id);
  if (r?.status === 'ready') return r;
  // A first look, a FETCH AGAIN after a failure, or the phone starting over from the first part: from the start.
  if (!r || r.status === 'failed' || (part === 0 && r.status !== 'fetching') || (part === 0 && r.got[0])) {
    if (r) await forgetWork(s, id);
    r = fresh(id, now);
  }
  const tidy: string[] = [];
  let total = 0;
  for (const p of pages.slice(0, 200)) {
    const t = tidyPage(String(p ?? '')).slice(0, 20_000);
    if (total + t.length > PART_MAX_CHARS) break;
    tidy.push(t);
    total += t.length + 1;
  }
  if (tidy.join('').replace(/\s/g, '').length < 40) throw new Error(`Hardly any text came out of "${e.parts[part]!.label}": it may be pictures of pages.`);
  // In chunks under the record limit.
  const chunks: string[][] = [[]];
  let size = 0;
  for (const t of tidy) {
    if (size + t.length > CHUNK_CHARS && chunks.at(-1)!.length) (chunks.push([]), (size = 0));
    chunks.at(-1)!.push(t);
    size += t.length;
  }
  for (const [k, c] of chunks.entries()) await s.storage.put(textKey(id, part, k), { pages: c });
  r.got[part] = chunks.length;
  const all = e.parts.every((_, i) => r!.got[i]);
  r.status = all ? 'reading' : 'fetching';
  r.note = all ? '' : `${Object.keys(r.got).length} of ${e.parts.length} parts read on the phone`;
  r.updatedAt = now;
  if (all) {
    const wins = await windowsByRole(s, e, r);
    r.plan = wins.texts.length + wins.questions.length + wins.marks.length + 4;
  }
  await s.storage.put(officialKey(id), r);
  return r;
}

/** The work in progress and the texts of a paper dropped (once it is ready, or when it starts over). */
async function forgetWork(s: OfficialStore, id: string): Promise<void> {
  const r = await loadOfficial(s, id);
  const keys = [wipKey(id)];
  for (const [part, n] of Object.entries(r?.got ?? {})) for (let k = 0; k < n; k++) keys.push(textKey(id, Number(part), k));
  await s.storage.delete(keys);
}

/** The text of the parts of one role, as windows of at most `WINDOW_CHARS` (whole pages where they fit). */
async function windowsByRole(s: OfficialStore, e: OfficialEntry, r: OfficialRecord): Promise<Record<'texts' | 'questions' | 'marks', string[]>> {
  const out: Record<'texts' | 'questions' | 'marks', string[]> = { texts: [], questions: [], marks: [] };
  for (const [i, part] of e.parts.entries()) {
    const keys = Array.from({ length: r.got[i] ?? 0 }, (_, k) => textKey(e.id, i, k));
    const got = keys.length ? await s.storage.get<{ pages: string[] }>(keys) : new Map();
    const pages = keys.flatMap((k) => got.get(k)?.pages ?? []);
    if (part.role === 'texts') {
      // A booklet of texts is split into its texts by the model from one look at it (its first window).
      out.texts.push(`=== ${part.label} ===\n${pages.join('\n\n')}`);
      continue;
    }
    let cur = `=== ${part.label} ===\n`;
    for (const p of pages) {
      if (cur.length + p.length > WINDOW_CHARS && cur.length > 200) {
        out[part.role].push(cur);
        cur = `=== ${part.label} (continued) ===\n`;
      }
      // One page longer than a window is cut where a line ends.
      let rest = p;
      while (rest.length > WINDOW_CHARS) {
        const cut = rest.lastIndexOf('\n', WINDOW_CHARS) > WINDOW_CHARS / 2 ? rest.lastIndexOf('\n', WINDOW_CHARS) : WINDOW_CHARS;
        out[part.role].push(cur + rest.slice(0, cut));
        cur = `=== ${part.label} (continued) ===\n`;
        rest = rest.slice(cut);
      }
      cur += `${rest}\n\n`;
    }
    if (cur.trim().split('\n').length > 1) out[part.role].push(cur);
  }
  return out;
}

// ---- the readers' words --------------------------------------------------------------------------------------------

export const READ_TEXTS_SYSTEM =
  'PAPER TEXTS. Below is a booklet of reading texts or sources from an official exam, read from its PDF. List each separate text or source in it, in order ' +
  '(not the cover, contents or instructions). Reply with ONLY one line per text, exactly:\nTITLE | the first eight words of the text itself';
export const READ_QUESTIONS_SYSTEM =
  'PAPER QUESTIONS. Below is part of an official UK exam paper, read from its PDF (so the layout is lost). List every question in it that a pupil answers. ' +
  'Reply with ONLY a JSON array, each element: {"n": "the question number as printed, e.g. 3 or 4(b)(ii)", "q": "the whole question with the information it gives, numbers exact", ' +
  '"marks": <the marks shown for it>, "type": "number" (one numeric answer) | "exact" (a word or short expression) | "mcq" (tick or circle one of the choices) | "short" (a sentence or two) | "extended" (a long answer or essay), ' +
  '"options": ["the choices, in order (mcq only)"], "picture": true when answering needs a diagram, graph, map, photo, grid or table that is not written out in the text, ' +
  '"text": "for a question about a reading text or source: its title", "topic": "what it tests, in a few words"}. Skip the cover, instructions and any question cut off at the start or end of this part. ' +
  'Where the paper offers a choice (answer ONE of these), list only the first choice in each section.';
export const READ_MARKS_SYSTEM =
  'MARK SCHEME. Below is part of an official UK mark scheme, read from its PDF. For each question it gives answers for, reply with ONLY a JSON array, each element: ' +
  '{"n": "the question number as printed, e.g. 3 or 4(b)(ii)", "answer": "the answer that earns the marks: the number, the word, the right choice exactly as written, or for a written answer a model answer", ' +
  '"also": ["other answers it accepts"], "rubric": "for written answers: the marking points or the levels, briefly but completely"}. Skip the general marking guidance.';

/** "4(b)(ii)", "Q4 b ii", "04.2" → one key ("4bii", "4.2"). */
export const qKey = (n: unknown): string => String(n ?? '').toLowerCase().replace(/^q(uestion)?\s*/, '').replace(/^0+(?=\d)/, '').replace(/[\s()[\]]/g, '');

const stageWords: Record<string, string> = { ks2: 'Key Stage 2', gcse: 'GCSE', alevel: 'A-level' };
/** "the 2024 Key Stage 2 maths papers". */
export const officialName = (e: OfficialEntry): string => `the ${e.year} ${stageWords[e.stage] ?? e.stage} ${subjectWords(e.subject)} ${e.board === 'Standards and Testing Agency' ? 'SATs paper' : `paper (${e.board} ${e.code})`}`;

/** The line the owner sees for an official paper. */
export function officialLine(e: OfficialEntry, r: OfficialRecord | undefined, used: boolean): string {
  if (!r) return 'Available: FETCH reads it on this phone and keeps it private';
  if (r.status === 'fetching') return `Fetching on the phone${r.note ? ` · ${r.note}` : ''}`;
  if (r.status === 'failed') return `Could not be read: ${r.error ?? 'unknown problem'}`;
  if (r.status === 'reading') return `Reading ${officialName(e)} · step ${Math.min(r.steps, r.plan)} of ${Math.max(r.plan, r.steps)}${r.note ? ` · ${r.note}` : ''}`;
  const p = r.paper!;
  return `${used ? 'Sat' : 'Ready'}: ${p.items.length} questions, ${p.maxMarks === e.fullMarks ? `${p.maxMarks} marks` : `${p.maxMarks} of the paper's ${e.fullMarks} marks`}`;
}

// ---- one slice of reading ----------------------------------------------------------------------------------------

const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+\n/g, '\n').trim().slice(0, n);

/** Cut a booklet into its texts at the start words the model found (falling back to the whole booklet). */
export function cutTexts(booklet: string, lines: { title: string; start: string }[], base: string): Passage[] {
  const flat = booklet.replace(/^=== .* ===\n/, '');
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hay = norm(flat);
  // Positions in the normalised text, mapped back by counting words.
  const words = flat.split(/\s+/);
  const wordNorm = words.map(norm);
  const starts: { title: string; at: number }[] = [];
  for (const l of lines) {
    const want = norm(l.start).split(' ').slice(0, 5);
    if (want.length < 3 || !hay.includes(want.join(' '))) continue;
    for (let i = 0; i < wordNorm.length; i++) {
      if (want.every((w, k) => (wordNorm[i + k] ?? '') === w)) {
        if (!starts.some((s) => s.at === i)) starts.push({ title: l.title, at: i });
        break;
      }
    }
  }
  starts.sort((a, b) => a.at - b.at);
  if (!starts.length) return [{ id: `${base}1`, title: 'The texts', text: flat.slice(0, 9000), source: '' }];
  return starts.map((s, k) => ({ id: `${base}${k + 1}`, title: clip(s.title, 120), text: words.slice(s.at, starts[k + 1]?.at ?? words.length).join(' ').slice(0, 9000), source: '' }));
}

/** Questions read from one window. */
function readQuestions(arr: unknown[]): ReadQ[] {
  const out: ReadQ[] = [];
  for (const x of arr) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const n = clip(o.n ?? o.number, 20);
    const q = clip(o.q ?? o.question, 2400);
    const marks = Math.round(Number(o.marks));
    if (!n || q.length < 3 || !Number.isFinite(marks) || marks < 1 || marks > 60) continue;
    out.push({ n, q, marks, type: clip(o.type, 12).toLowerCase(), ...(Array.isArray(o.options) ? { options: o.options.map((v) => clip(v, 300)).filter(Boolean).slice(0, 8) } : {}), ...(o.picture === true ? { picture: true } : {}), ...(o.text ? { text: clip(o.text, 120) } : {}), ...(o.topic ? { topic: clip(o.topic, 60) } : {}) });
  }
  return out;
}
function readAnswers(arr: unknown[]): ReadA[] {
  const out: ReadA[] = [];
  for (const x of arr) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const n = clip(o.n ?? o.number, 20);
    const answer = clip(o.answer, 3000);
    if (!n || !answer) continue;
    out.push({ n, answer, ...(Array.isArray(o.also) ? { also: o.also.map((v) => clip(v, 200)).filter(Boolean).slice(0, 6) } : {}), ...(o.rubric ? { rubric: clip(o.rubric, 3000) } : {}) });
  }
  return out;
}

/**
 * A question and its mark-scheme entry made into an item (or the reason it cannot be used): the type as the
 * question reads it; a choice answer turned into its letter; a number that does not parse kept as an exact answer.
 */
export function joinItem(q: ReadQ, a: ReadA | undefined, maxMarks: number): Omit<Draft, 'id'> | { why: string } {
  if (q.picture) return { why: 'needs the picture' };
  if (!a) return { why: 'no mark scheme entry was found for it' };
  let type = (['number', 'exact', 'mcq', 'short', 'extended'].includes(q.type) ? q.type : q.marks >= 4 ? 'extended' : 'short') as Draft['type'];
  let answer = a.answer;
  let options = q.options;
  if (type === 'mcq') {
    const opts = options ?? [];
    const letter = answer.trim().match(/^\(?([a-h])\)?$/i)?.[1]?.toLowerCase();
    const idx = letter ? 'abcdefgh'.indexOf(letter) : opts.findIndex((o) => normaliseText(o) === normaliseText(answer) || normaliseText(answer).includes(normaliseText(o)));
    if (opts.length >= 2 && opts.length <= 4 && idx >= 0 && idx < opts.length) {
      // Fewer than four choices are made up to four with "None of these" (never right).
      options = [...opts, ...['None of these', 'Not enough information', 'Cannot tell'].filter((x) => !opts.includes(x))].slice(0, 4);
      answer = 'abcd'[idx]!;
    } else type = 'exact';
  }
  if (type === 'number' && parseNumber(answer) == null) type = 'exact';
  if ((type === 'exact' || type === 'number') && answer.length > 60) type = q.marks >= 4 ? 'extended' : 'short';
  const raw = { topic: q.topic || 'official paper', type, marks: q.marks, q: q.q, answer, ...(options && type === 'mcq' ? { options } : {}), ...(a.also?.length ? { also: a.also } : {}), rubric: a.rubric || (type === 'short' || type === 'extended' ? `Award marks for: ${answer}` : undefined) };
  const d = cleanDraft(raw, 1, maxMarks);
  if ('reject' in d) return { why: d.reject === 'picture' ? 'needs the picture' : 'it could not be read cleanly' };
  return d;
}

/**
 * One slice of reading an official paper: at most `CALLS_PER_TICK` model calls through the phases (texts →
 * questions → mark scheme → checks → the paper), saved as it goes; a busy model ends the slice and the next one
 * carries on. When it is done the paper is kept in the record with its real (scaled) boundaries.
 */
export async function officialTick(s: OfficialStore, id: string, write: Ask | undefined, now: number): Promise<{ record: OfficialRecord; calls: number }> {
  const e = officialById(id);
  const r = await loadOfficial(s, id);
  if (!e || !r) throw new Error('That paper has not been fetched.');
  if (r.status !== 'reading') return { record: r, calls: 0 };
  const w: Wip = (await s.storage.get<Wip>(wipKey(id))) ?? { passages: [], questions: [], answers: [], drafts: [], kept: [] };
  const wins = await windowsByRole(s, e, r);
  let calls = 0;
  if (!write) r.note = 'waiting for a free model';
  const nextPhase = (p: Phase) => ((r.phase = p), (r.win = 0), (r.tries = 0));
  const failedTry = () => {
    r.tries++;
    if (r.tries >= MAX_TRIES) ((r.unread++), (r.win++), (r.tries = 0));
  };
  while (write && r.phase !== 'done' && calls < CALLS_PER_TICK) {
    try {
      if (r.phase === 'texts') {
        const booklet = wins.texts[r.win];
        if (booklet == null) {
          nextPhase('questions');
          continue;
        }
        calls++;
        r.steps++;
        const lines = [...numberedLinesOrPlain(await write(READ_TEXTS_SYSTEM, booklet.slice(0, 24_000)))];
        w.passages.push(...cutTexts(booklet, lines, `t${r.win + 1}-`).map((p) => ({ ...p, source: `${e.board}, ${e.series} (${e.code ?? 'SATs'})` })));
        r.win++;
      } else if (r.phase === 'questions' || r.phase === 'marks') {
        const list = wins[r.phase];
        const text = list[r.win];
        if (text == null) {
          if (r.phase === 'questions') nextPhase('marks');
          else {
            joinAll(r, w);
            nextPhase('check');
          }
          continue;
        }
        calls++;
        r.steps++;
        const arr = jsonArray(await write(r.phase === 'questions' ? READ_QUESTIONS_SYSTEM : READ_MARKS_SYSTEM, text));
        if (!arr) {
          failedTry();
          continue;
        }
        if (r.phase === 'questions') {
          for (const q of readQuestions(arr)) if (!w.questions.some((x) => qKey(x.n) === qKey(q.n))) w.questions.push(q);
          r.found = w.questions.length;
        } else {
          for (const a of readAnswers(arr)) {
            const had = w.answers.find((x) => qKey(x.n) === qKey(a.n));
            if (!had) w.answers.push(a);
            else if (a.rubric && !(had.rubric ?? '').includes(a.rubric.slice(0, 40))) had.rubric = clip(`${had.rubric ?? ''}\n${a.rubric}`, 3000);
          }
        }
        r.win++;
        r.tries = 0;
      } else if (r.phase === 'check') {
        if (!w.drafts.length) {
          buildPaper(e, r, w, now);
          await s.storage.put(officialKey(id), r);
          await forgetWork(s, id);
          return { record: r, calls };
        }
        const batch = nextBatch(w.drafts);
        calls++;
        r.steps++;
        const res = await checkDrafts(batch, write);
        const done = new Set([...res.kept, ...res.rejected.map((x) => x.d)].map((d) => d.id));
        for (const d of res.kept) w.kept.push(d as Draft & { n: string });
        for (const x of res.rejected) r.leftOut.push({ what: `Question ${(x.d as Draft & { n: string }).n}`, marks: x.d.marks, why: x.why === 'wrong' ? "a second check did not reach the mark scheme's answer" : 'a second check did not find its mark scheme sound' });
        const again = res.again.map((d) => ({ ...d, tries: (d.tries ?? 0) + 1 }));
        for (const d of again.filter((x) => x.tries >= MAX_TRIES)) (done.add(d.id), r.leftOut.push({ what: `Question ${(d as Draft & { n: string }).n}`, marks: d.marks, why: 'the second check gave no answer for it' }));
        w.drafts = [...w.drafts.filter((d) => !done.has(d.id) && !again.some((a) => a.id === d.id)), ...(again.filter((x) => x.tries < MAX_TRIES) as (Draft & { n: string })[])];
      }
      r.note = '';
    } catch {
      // No model free: nothing is lost; the next slice carries on. (A call that failed is not counted.)
      calls--;
      r.steps--;
      r.note = 'waiting for a free model';
      break;
    }
  }
  r.updatedAt = now;
  await s.storage.put(officialKey(id), r);
  await s.storage.put(wipKey(id), w);
  return { record: r, calls };
}

/** "Title | first words" lines (numbered or not). */
function* numberedLinesOrPlain(reply: string): Generator<{ title: string; start: string }> {
  const text = reply.replace(/<think>[\s\S]*?<\/think>/g, '');
  const lines = numberedLines(text).size ? [...numberedLines(text).values()] : text.split('\n');
  for (const l of lines) {
    const [title, start] = l.split('|').map((x) => x.trim());
    if (title && start) yield { title: title.replace(/^[-*•\d.)\s]+/, ''), start };
  }
}

/** Questions and mark scheme joined by number; what cannot be used is left out with its marks. */
function joinAll(r: OfficialRecord, w: Wip): void {
  const byN = new Map(w.answers.map((a) => [qKey(a.n), a]));
  let k = 0;
  for (const q of w.questions) {
    const j = joinItem(q, byN.get(qKey(q.n)), 60);
    if ('why' in j) {
      r.leftOut.push({ what: `Question ${q.n}`, marks: q.marks, why: j.why });
      continue;
    }
    const passage = q.text ? w.passages.find((p) => normaliseText(p.title).includes(normaliseText(q.text!)) || normaliseText(q.text!).includes(normaliseText(p.title))) : w.passages.length === 1 ? w.passages[0] : undefined;
    w.drafts.push({ ...j, id: `o${++k}`, n: q.n, ...(passage ? { passage: passage.id } : {}) });
  }
  r.found = w.questions.length;
  r.plan = r.steps + Math.ceil(w.drafts.length / 6) + 1;
}

/** The paper, once every question is checked: its real boundaries scaled to the marks he can sit. */
function buildPaper(e: OfficialEntry, r: OfficialRecord, w: Wip, now: number): void {
  const items: SchoolItem[] = w.kept.map(({ n: _n, tries: _t, ...it }, i) => ({ ...(it as SchoolItem), id: `q${i + 1}` }));
  if (!items.length) {
    r.status = 'failed';
    r.error = r.found ? 'none of its questions could be used (see what was left out)' : 'no questions could be read from it';
    r.phase = 'done';
    r.updatedAt = now;
    return;
  }
  const maxMarks = items.reduce((a, x) => a + x.marks, 0);
  const used = new Set(items.map((i) => i.passage).filter(Boolean));
  const leftOut = [...(e.leftOut ? [e.leftOut] : []), ...r.leftOut];
  const outMarks = e.fullMarks - maxMarks;
  r.paper = {
    id: `official-${e.id}`,
    stage: e.stage,
    subject: e.subject,
    title: `${e.title} · official ${e.board === 'Standards and Testing Agency' ? `${e.year} SATs (Standards and Testing Agency)` : `${e.board} ${e.code}, ${e.series}`}`,
    official: true,
    from: 'official',
    board: e.board,
    year: e.year,
    fullMarks: e.fullMarks,
    source: e.source,
    licence: e.licence,
    items,
    maxMarks,
    bands: entryBands(e, maxMarks),
    boundaries: `${e.boundaries}${outMarks > 0 ? `, scaled to the ${maxMarks} of ${e.fullMarks} marks he can sit` : ''}`,
    leftOut,
    ...(used.size ? { passages: w.passages.filter((p) => used.has(p.id)) } : {}),
  };
  r.status = 'ready';
  r.phase = 'done';
  r.steps = Math.max(r.steps, r.plan);
  r.plan = r.steps;
  r.updatedAt = now;
}

// ---- the files, through the brain ------------------------------------------------------------------------------------

/** The most a paper's file may be (the largest on the list is about 12 MB). */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * One part of a curated paper, fetched by the brain for the phone (GET /school/official/file?id=&part=): only the
 * exact addresses on the list, redirects only to the same official hosts, a PDF only, served as a download with
 * no scripts — the same guards as the feed proxy (index.ts `/api/proxy`).
 */
export async function fileResponse(id: string, part: number, fetcher: typeof fetch = (u, i) => fetch(u, i)): Promise<Response> {
  const json = (v: unknown, status: number) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  const e = officialById(id);
  const p = e?.parts[part];
  if (!e || !p) return json({ error: 'That paper is not on the list.' }, 404);
  // Redirects are followed by hand, and only to the official hosts: nothing else is ever asked for.
  let r: Response;
  let at = p.url;
  try {
    for (let hop = 0; ; hop++) {
      r = await fetcher(at, { headers: { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)', Accept: 'application/pdf,*/*' }, redirect: 'manual' });
      const next = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
      if (!next) break;
      const u = new URL(next, at);
      if (u.protocol !== 'https:' || !OFFICIAL_HOSTS.includes(u.hostname) || hop >= 3) return json({ error: 'The file moved to a site that is not on the list, so it was not fetched.' }, 403);
      at = u.toString();
    }
  } catch {
    return json({ error: `${e.board}'s site could not be reached just now. Try again later.` }, 502);
  }
  const final = new URL(r.url || at);
  if (final.protocol !== 'https:' || !OFFICIAL_HOSTS.includes(final.hostname)) return json({ error: 'The file moved to a site that is not on the list, so it was not fetched.' }, 403);
  if (!r.ok) return json({ error: `${e.board}'s site answered ${r.status}: the file may have moved. It was checked when it was added to the list.` }, 502);
  const type = r.headers.get('content-type') ?? '';
  if (!/pdf|octet-stream/i.test(type)) return json({ error: `${e.board}'s site sent a page instead of the paper (it may need a sign-in now).` }, 502);
  const len = Number(r.headers.get('content-length') ?? 0);
  if (len > MAX_FILE_BYTES) return json({ error: 'That file is too big to fetch.' }, 413);
  return new Response(r.body, {
    status: 200,
    headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', 'content-security-policy': "sandbox; default-src 'none'", 'x-content-type-options': 'nosniff', 'content-disposition': 'attachment' },
  });
}

/** An entry as the SCHOOL tab lists it (with its record's progress, and whether he has sat it). */
export function officialRow(e: OfficialEntry, r: OfficialRecord | undefined, used: boolean) {
  const p = r?.paper;
  return {
    id: e.id,
    stage: e.stage,
    subject: e.subject,
    board: e.board,
    year: e.year,
    series: e.series,
    code: e.code ?? null,
    title: e.title,
    parts: e.parts.map((x) => ({ role: x.role, label: x.label })),
    fullMarks: e.fullMarks,
    source: e.source,
    licence: e.licence,
    /** The licence in a few words, for the list. */
    licenceShort: e.board === 'Standards and Testing Agency' ? 'Crown copyright · Open Government Licence v3.0' : `© ${e.board === 'Pearson Edexcel' ? 'Pearson' : e.board} · free for personal use`,
    boundaries: e.boundaries,
    note: e.note ?? null,
    status: (r?.status ?? 'available') as OfficialStatus | 'available',
    used,
    got: r ? Object.keys(r.got).length : 0,
    steps: r?.steps ?? 0,
    plan: r?.plan ?? 0,
    line: officialLine(e, r, used),
    ready: p ? { items: p.items.length, marks: p.maxMarks, leftOut: p.leftOut ?? [] } : null,
    error: r?.error ?? null,
  };
}
