/**
 * SCHOOL part 2 on the phone: the OFFICIAL papers and the question banks being written.
 *  - FETCH: each part of a curated official paper (the list is the brain's, apps/edge/src/school/official.ts) is
 *    downloaded through the brain (GET /api/school/official/file: only the listed addresses), read to text HERE
 *    with the library's own PDF reader (`readExamPdf` prepares the boards' files for it first), and the text goes
 *    to the brain (POST /api/school/official/text), which turns it into a paper with a stronger model. The PDF
 *    itself is never kept on the phone and never shared.
 *  - The work loop: while SCHOOL is open and something is being written or read, one slice at a time
 *    (POST /api/school/work: at most a few model calls each), quickly while it makes progress, slowly while every
 *    model is busy. The brain also does a few slices each day on its own.
 */
import type { StageId } from '../../../../packages/shared/src/school';
import { headers } from '../api/brain';
import { createStore } from '../core/store';
import { readExamPdf } from './pdfprep';

/** An official paper as GET /api/school/official lists it. */
export interface OfficialRow {
  id: string;
  stage: StageId;
  subject: string;
  board: string;
  year: number;
  series: string;
  code: string | null;
  title: string;
  parts: { role: 'questions' | 'texts' | 'marks'; label: string }[];
  fullMarks: number;
  source: string;
  licence: string;
  licenceShort: string;
  boundaries: string;
  note: string | null;
  status: 'available' | 'fetching' | 'reading' | 'ready' | 'failed';
  used: boolean;
  got: number;
  steps: number;
  plan: number;
  line: string;
  ready: { items: number; marks: number; leftOut: { what: string; marks: number; why: string }[] } | null;
  error: string | null;
}
/** A question bank as the brain reports it. */
export interface BankRow {
  stage: StageId;
  subject: string;
  kept: number;
  target: number;
  checking: number;
  rejected: { wrong: number; unsound: number; picture: number; malformed: number; repeat: number; all: number };
  calls: number;
  done: boolean;
  line: string;
}
export interface WorkView {
  busy: boolean;
  banks: BankRow[];
  official: OfficialRow[];
  calls: number;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(j?.error ?? (r.status === 401 ? 'Not signed in.' : `Ghosty could not be reached (${r.status}).`));
  return j as T;
}

export const officialApi = {
  list: () => call<{ papers: OfficialRow[]; hosts: string[] }>('GET', '/school/official'),
  text: (id: string, part: number, pages: string[]) => call<{ paper: OfficialRow }>('POST', '/school/official/text', { id, part, pages }),
  work: () => call<WorkView>('POST', '/school/work'),
  write: (stage: string, subject?: string) => call<WorkView>('POST', '/school/bank/write', subject ? { stage, subject } : { stage }),
};

/** What is being written and read now, for the SCHOOL tab (and a spec at window.__ghosty.school). */
export const work = createStore({
  /** The loop is running on this phone. */
  running: false,
  busy: false,
  banks: [] as BankRow[],
  official: [] as OfficialRow[],
  /** Official papers being fetched and read here: id → plain words ("reading Mark scheme (2 of 3)"). */
  fetching: {} as Record<string, string>,
  /** Waiting for a free model (the last slice could make no call). */
  waiting: false,
});

/** Long text is sent in pieces the brain takes in one go (it keeps at most 400,000 characters a part). */
const MAX_PART_CHARS = 380_000;

/**
 * FETCH one official paper: every part downloaded through the brain, read to text on this phone, and sent to the
 * brain, which then reads it into a paper (the work loop drives that). Throws with plain words when a part cannot
 * be fetched or read.
 */
export async function fetchOfficial(row: Pick<OfficialRow, 'id' | 'parts' | 'title'>): Promise<OfficialRow> {
  const say = (line: string) => work.set((s) => ({ fetching: { ...s.fetching, [row.id]: line } }));
  let last: OfficialRow | null = null;
  try {
    for (const [i, part] of row.parts.entries()) {
      const of = `(${i + 1} of ${row.parts.length})`;
      say(`downloading ${part.label} ${of}…`);
      const r = await fetch(`/api/school/official/file?id=${encodeURIComponent(row.id)}&part=${i}`, { headers: headers(), credentials: 'same-origin' });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `${part.label} could not be downloaded (${r.status}).`);
      }
      const bytes = new Uint8Array(await r.arrayBuffer());
      say(`reading ${part.label} on this phone ${of}…`);
      const read = await readExamPdf(bytes, `${row.title}: ${part.label}`);
      if (read.warning && !read.pages.join('').trim()) throw new Error(`${part.label}: ${read.warning}`);
      let total = 0;
      const pages = read.pages.filter((p) => {
        total += p.length;
        return total <= MAX_PART_CHARS;
      });
      say(`sending ${part.label} to Ghosty ${of}…`);
      last = (await officialApi.text(row.id, i, pages)).paper;
    }
  } finally {
    work.set((s) => {
      const f = { ...s.fetching };
      delete f[row.id];
      return { fetching: f };
    });
  }
  startWork();
  return last!;
}

let loop: Promise<void> | null = null;
let stopAsked = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** After a slice that made progress the next follows soon; while every model is busy, much later. */
export const PACE = { busy: 300, waiting: 30_000 } as const;

/** Run slices while something is being written or read (one at a time; STOP by leaving the tab). */
export function startWork(): void {
  stopAsked = false;
  if (loop) return;
  work.set({ running: true });
  loop = (async () => {
    try {
      for (;;) {
        if (stopAsked || document.visibilityState === 'hidden') break;
        let v: WorkView;
        try {
          v = await officialApi.work();
        } catch {
          await sleep(PACE.waiting);
          continue;
        }
        work.set({ busy: v.busy, banks: v.banks, official: v.official, waiting: v.busy && !v.calls });
        if (!v.busy) break;
        await sleep(v.calls ? PACE.busy : PACE.waiting);
      }
    } finally {
      loop = null;
      work.set({ running: false });
    }
  })();
}
/** The loop stops after its current slice (leaving SCHOOL); the brain's daily step carries on meanwhile. */
export function stopWork(): void {
  stopAsked = true;
}

/** WRITE THE PAPERS: a stage's question banks (or one subject's) queued, and the loop started. */
export async function writePapers(stage: string, subject?: string): Promise<WorkView> {
  const v = await officialApi.write(stage, subject);
  work.set({ busy: v.busy, banks: v.banks, official: v.official, waiting: v.busy && !v.calls });
  if (v.busy) startWork();
  return v;
}
