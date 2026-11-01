/**
 * THE TRUST TABLE (BRIEF-OFFLINE-DEFAULT part 1; OWNER-ISSUES 72, 78): SCHOOL's report card turned into what the brain on
 * his phone may answer FIRST. Every paper a brain sat is filed with who sat it (state.ts `results`: `model` is the brain's
 * id and its weights' commit, "SmolLM2-360M-Instruct-q4f16_1-MLC@1d9a4bf", or a trained week's own), and every question
 * names its topic; the papers are held out (written from seeds no training uses). From them, for each kind of ask the
 * phone sorts his words into (apps/web/src/offline/trust.ts `categorise`), the grade on the questions that test that skill
 * — marks got of marks there were, as the report card grades — and how many questions that is. The phone decides with his
 * bar (SETTINGS → OFFLINE BRAIN → TRUST: 80% unless he moves it), the twenty-question floor and its own misses (ASK THE
 * CLOUD); the brain only says what the papers say.
 *   GET /school/trust → { brains: [{ model, at, papers, rows: [{ cat, pct, items, from }] }], floor }
 * A paper whose written answers still wait for marks is left out (its missing marks would count as wrong). The reading
 * checks (reading.ts) do not say which brain sat them, so they are not counted. Pure but for `trustView`'s reads.
 */
import type { PaperResult } from '../../../../packages/shared/src/school';
import { loadPaper, type Store } from './state';

/** The kinds of ask the phone's brain may answer first (the same ids as apps/web/src/offline/trust.ts TRUST_CATS). */
export const TRUST_CATS = ['greet', 'reword', 'summary', 'translate', 'sums', 'memory', 'reading', 'spelling', 'agenda'] as const;
export type TrustCat = (typeof TRUST_CATS)[number];
/** No kind is trusted on fewer held-out questions than this, whatever its grade. */
export const ITEM_FLOOR = 20;

/** Which questions test a kind: those of `subjects` (any, when absent) whose topic matches `topics` (any) and not `not`. */
interface Source {
  subjects?: string[];
  topics?: RegExp;
  not?: RegExp;
  /** What the grade comes from, in his words. */
  from: string;
}
const FINDING = /^(retrieval|finding information)$/;
export const SOURCES: Record<TrustCat, Source> = {
  greet: { subjects: ['talk'], from: 'talking and listening' },
  reword: { subjects: ['gps', 'writing'], not: /spelling|extended writing/, from: 'grammar and writing' },
  summary: { subjects: ['reading'], topics: /^(retrieval|finding information|inference)$/, from: 'finding and inferring in a passage' },
  translate: { topics: /translat/, from: 'translating (no paper tests it yet)' },
  sums: { subjects: ['numbers', 'maths'], not: /shape|angle|area|statistic|pattern|^time$/, from: 'number and sums' },
  memory: { subjects: ['reading'], topics: FINDING, from: 'finding things in a passage' },
  reading: { subjects: ['reading'], from: 'reading' },
  spelling: { topics: /spelling/, from: 'spelling' },
  agenda: { subjects: ['reading'], topics: FINDING, from: 'reading back what is written' },
};

/** One marked question of a paper a brain sat. */
export interface MarkedItem {
  topic: string;
  got: number;
  max: number;
}
/** A paper a brain sat, as the table reads it. */
export interface SatPaper {
  model: string;
  at: number;
  subject: string;
  items: MarkedItem[];
}
export interface TrustRow {
  cat: TrustCat;
  /** Whole per cent of the marks (null: no question tests it yet). */
  pct: number | null;
  items: number;
  from: string;
}
export interface BrainTrust {
  model: string;
  /** The newest paper it sat: its report card's date (misses before it no longer count on the phone). */
  at: number;
  papers: number;
  rows: TrustRow[];
}

const counts = (s: Source, subject: string, topic: string): boolean =>
  (!s.subjects || s.subjects.includes(subject)) && (!s.topics || s.topics.test(topic)) && !(s.not && s.not.test(topic));

/** The table for each brain that sat a paper, newest report card first. */
export function trustTable(papers: SatPaper[]): BrainTrust[] {
  const by = new Map<string, SatPaper[]>();
  for (const p of papers) if (p.model) by.set(p.model, [...(by.get(p.model) ?? []), p]);
  return [...by.entries()]
    .map(([model, ps]) => ({
      model,
      at: Math.max(...ps.map((p) => p.at)),
      papers: ps.length,
      rows: TRUST_CATS.map((cat): TrustRow => {
        let got = 0;
        let max = 0;
        let items = 0;
        for (const p of ps) for (const it of p.items) if (counts(SOURCES[cat], p.subject, it.topic)) (got += it.got), (max += it.max), items++;
        return { cat, pct: max ? Math.round((got / max) * 100) : null, items, from: SOURCES[cat].from };
      }),
    }))
    .sort((a, b) => b.at - a.at);
}

/** A filed paper as the table reads it: its questions joined to their marks (null: marks still coming, or not marked). */
export function satPaper(r: PaperResult, items: { id: string; topic: string; marks: number }[]): SatPaper | null {
  if (r.marked.pending || !r.answers.length) return null;
  const marks = new Map(r.answers.map((a) => [a.id, a]));
  return { model: r.model, at: r.at, subject: r.subject, items: items.map((it) => ({ topic: it.topic, got: Math.min(it.marks, Math.max(0, marks.get(it.id)?.got ?? 0)), max: it.marks })) };
}

/** GET /school/trust: the papers in the record (each read once with its marks) into the table. */
export async function trustView(s: Store, results: PaperResult[]): Promise<{ brains: BrainTrust[]; floor: number }> {
  const recs = await Promise.all(results.filter((r) => !r.marked.pending && r.model).map((r) => loadPaper(s, r.paperId).catch(() => undefined)));
  const papers = recs.flatMap((rec) => (rec?.result ? [satPaper(rec.result, rec.paper.items)] : [])).filter((p): p is SatPaper => !!p);
  return { brains: trustTable(papers), floor: ITEM_FLOOR };
}
