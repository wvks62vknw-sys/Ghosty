/**
 * SCHOOL tab — the offline brain (the small model on this phone) goes to school, from nursery to the whole
 * library, strictly in order (the owner's rules: docs/build-plan/HANDOFF.md "Raising Ghosty"). The page is his
 * report card:
 *  - the LADDER: every stage with its years; a lock on the locked ones, a tick and the day on the passed ones,
 *    NOW on the current one;
 *  - the current stage: each subject with its latest grade and whether it is top grades, SIT THE EXAM (every
 *    subject in turn) and a SIT per subject; while he sits, "Question 7 of 20" and STOP (the answers so far are
 *    handed in); the result card when a paper is marked;
 *  - SIT A PLACEMENT TEST: any stage; top grades in every subject pass it and everything below it at once;
 *  - WEAK SPOTS, RESULTS (tap one: every question, his answer, the marks, the marker's note, and whether the paper
 *    is official or written by Ghosty), the NIGHTLY REPORT switch and how marking works.
 *  - Part 2: each subject row says where its next paper comes from (official, written by Ghosty, his checked
 *    question bank, or none yet); a stage with no papers offers WRITE THE PAPERS (a stronger model writes its
 *    question banks, checked twice, a slice at a time: "Writing the GCSE maths bank · 48 of 120"); OFFICIAL PAPERS
 *    lists the real papers (SATs, GCSE, A-level) with their source and licence, FETCH reads one on this phone and
 *    the brain makes it into a paper (school/official.ts); the result and the paper show the real boundary reached.
 *  - Part 3: READING — his stage's shelf (public-domain classics and open textbooks, each with its source and
 *    licence; READ puts one in his library chapter by chapter; SIT THE READING CHECK: ten questions on the book's own
 *    words, sat here like a paper, 80% passes), BORROW from up to two stages ahead (earned: top grades in his
 *    reading first, then that book's check), and what self-study may not read yet (apps/edge/src/school/reading.ts).
 *  - The free GPU (part 2b, wired here): FREE GPU beside each subject's SIT and SIT ON THE FREE GPU beside SIT THE
 *    EXAM (and a placement's SIT) have the same brain sit the paper on Kaggle's free GPU (POST /school/sit-remote):
 *    while it runs, its honest note shows and /school/remote is asked every 20 s; one paper at a time (a 409 shows
 *    the run already going); the result is filed like any other, "sat on the free GPU". Hidden, with one line why,
 *    until the Kaggle and Hugging Face keys are saved (the training status's `keys`). Each subject sat shows the
 *    honest gap ("offline 14/40 · online 36/40") and WEAK SPOTS what is being practised — both from GET /school.
 * Papers are set and marked by the brain (/api/school, apps/edge/src/school); they are sat here, on the phone's
 * own model (school/sit.ts). State for specs at window.__ghosty.school.
 */
import type { PaperResult, StageId, StageRow, StageView } from '../../school/sit';
import { STAGES, SUBJECT_LABEL } from '../../../../../packages/shared/src/school';
import { clear, h, icon } from '../../core/dom';
import { mayUse, offlineBrain, offlineReady, offlineSupport } from '../../offline/brain';
import { CHAIN, MODELS, NO_BRAIN, sitOffer, sitOfferWhy, sizeText, type ModelDef } from '../../offline/models';
import { fetchOfficial, officialApi, startWork, stopWork, work, writePapers, type OfficialRow } from '../../school/official';
import { brainLine, getForSit, notDownloaded, resumeNow, runPaper, school, sitGen, sitPlan, sitPrefs, sitSubjects, sitting, stopSitting, type SitPaper } from '../../school/sit';
import { brain, headers } from '../../api/brain';
import { loadOffline, withModel } from '../../offline/brain';
import type { TabDef } from '../../shell/tabs';
import { bar, button, modal, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { goToPanel, revealSection, sections } from '../../ui/sections';

const LOCK = '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>';
const TICK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** "Key Stage 2 (SATs)" → "Key Stage 2". */
const short = (label: string) => label.replace(/\s*\(.*\)$/, '');
const pct = (r: Pick<PaperResult, 'raw' | 'max'>) => Math.round((r.raw / Math.max(1, r.max)) * 100);

/** What the tab shows, for tests and the console (window.__ghosty.school). */
export const schoolState = { gpu: { shown: false, phase: '', note: '', why: '' }, gap: {} as Record<string, string>, practice: '', stage: '', stages: [] as { id: string; status: string; papers?: boolean }[], results: 0, sitting: false, line: '', brain: '', resume: '', closed: '', last: null as null | { grade: string; raw: number; max: number }, placement: [] as string[], error: '', official: [] as { id: string; status: string; line: string }[], banks: [] as { stage: string; subject: string; kept: number; target: number; done: boolean; line: string }[], working: false, reading: null as null | { stage: string; shelf: { id: string; status: string; check: string }[]; ahead: string[]; rule: string; borrow: string; locks: string; live: string; last: string } };
function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.school = schoolState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

/**
 * After a brain closed Ghosty (offline/brain.ts recoverFromClose, 1 Nov): one line when Ghosty is open again, once per
 * record, said as a toast once the boot screen has gone: "Qwen3 0.6B closed Ghosty while answering. Next time SIT uses
 * Qwen2.5 0.5B." It is kept on this phone until it has been said.
 */
function sayClosed(): void {
  const line = offlineBrain.get().closedNote;
  if (!line || typeof document === 'undefined') return;
  if (document.getElementById('boot')) return void setTimeout(sayClosed, 500);
  offlineBrain.set({ closedNote: '' });
  schoolState.closed = line;
  toast(line, 'warn');
}
if (typeof window !== 'undefined') setTimeout(sayClosed, 300);

export const schoolTab: TabDef = {
  id: 'school',
  title: 'SCHOOL',
  icon: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2"/><path d="M12 14v6.5"/>',
  scene: 'backdrop',
  blurb: 'the offline brain goes to school',
  // what the tab last read from the brain (schoolState): "Nursery · 2 papers sat"
  now() {
    const st = STAGES.find((x) => x.id === schoolState.stage);
    return st ? `${st.label} · ${schoolState.results} ${schoolState.results === 1 ? 'paper' : 'papers'} sat` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'SCHOOL', sub: 'the offline brain on this phone, from nursery up · top grades to move on', leftLabel: 'STAGE', rightLabel: 'REPORT', stack: true });
    expose();
    // The stage's name as written ("Key Stage 2", "GCSE"), not re-cased by the stylesheet.
    P.big.dataset.case = 'keep';
    let view: WiredView | null = null;
    /** The phone can run the offline brain / has it downloaded (null: not looked yet). */
    let can: boolean | null = null;
    let ready: boolean | null = null;
    let placementOpen = false;
    let placementPick: StageId | null = null;
    /** The official papers (null: not looked yet), and why they could not be listed. */
    let official: OfficialRow[] | null = null;
    let officialError = '';
    /** The tab is on screen (the work loop runs only then). */
    let shown = false;

    // ======================= panels
    const ladderP = panel('THE LADDER', { cls: 'school.schladder' });
    const stageP = panel('THIS STAGE', { cls: 'school.schstage' });
    const placeP = panel('PLACEMENT TEST', { cls: 'school.schplace' });
    const weakP = panel('WEAK SPOTS', { cls: 'school.schweak', grow: false });
    const resultsP = panel('RESULTS', { cls: 'school.schresults' });
    const setP = panel('NIGHTLY REPORT', { cls: 'school.schset', grow: false });
    const offP = panel('OFFICIAL PAPERS', { cls: 'school.schofficial' });
    P.left.append(ladderP.el, stageP.el, placeP.el);
    P.right.append(resultsP.el, offP.el, weakP.el, setP.el);

    /** The brain the next paper is sat on, and the smaller one he could choose instead (school/sit.ts sitPlan). */
    let plan: Awaited<ReturnType<typeof sitPlan>> | null = null;

    // ======================= sitting
    /** `small`: CARRY ON after a close or a failed brain sits on the smallest brain here. */
    const start = (stage: StageId, subjects: string[], small = false) => {
      if (sitting.get().busy) return;
      void sitSubjects(stage, subjects, { small })
        .then((rs) => {
          const last = rs.at(-1);
          if (sitting.get().stopped) toast(rs.length ? 'Stopped: the answers so far were handed in' : 'Stopped', 'warn');
          else if (last) toast(`${stageLabel(stage)} ${subjectName(last.subject).toLowerCase()}: ${last.grade}`, last.top ? 'ok' : '');
        })
        .catch((e) => toast(String((e as Error)?.message ?? e).slice(0, 180), 'bad'))
        .finally(() => void refresh());
      paint();
    };
    /** The brain the one tap is getting now (null: none), and the line it waits with on mobile data. */
    let getting: ModelDef | null = null;
    let waitLine = '';
    /**
     * The one tap after a close (1 Nov: "press SIT and it works"): GET the next brain down (his tap; on Wi-Fi only, the
     * size on the button), then sit on it, or carry on the paper that stopped (`small`). On mobile data nothing is
     * fetched: it says so and the button stays.
     */
    const oneTap = (m: ModelDef, stage: StageId, subjects: string[], small: boolean) => {
      if (getting || sitting.get().busy) return;
      waitLine = '';
      getting = m;
      paint();
      void getForSit(m.id, () => paint())
        .then(() => {
          getting = null;
          start(stage, subjects, small);
        })
        .catch((e) => {
          getting = null;
          const msg = String((e as Error)?.message ?? e).slice(0, 220);
          const wait = !!(e as { wait?: boolean })?.wait;
          if (wait) waitLine = msg;
          toast(wait ? msg : `Download stopped: ${msg}`, wait ? 'warn' : 'bad');
          void refresh();
        });
    };
    const subjectName = (id: string) => SUBJECT_LABEL[id] ?? id;
    const stageLabel = (id: string) => short(view?.stages.find((s) => s.id === id)?.label ?? id);
    /** A button whose words are a name ("Key Stage 2", "GCSE"): shown as written, not re-cased. */
    const named = (b: HTMLButtonElement, words: string) => ((b.dataset.label = words), b);
    const isBankStage = (id: string) => !!view?.bankStages.includes(id as StageId);

    // ======================= writing the papers (question banks)
    /** WRITE THE PAPERS for a stage: its banks queued; the slices run while SCHOOL is open (and a little each night). */
    const write = (stage: StageId, b?: HTMLButtonElement) => {
      if (b) b.disabled = true;
      void writePapers(stage)
        .then(() => toast(`Writing the ${stageLabel(stage)} papers: a little at a time while SCHOOL is open, and a little each night`, 'ok'))
        .catch((e) => toast(String((e as Error)?.message ?? e).slice(0, 180), 'bad'))
        .finally(() => void refresh());
    };
    /** The banks of a stage as the brain last reported them (the live slices first). */
    const banksOf = (stage: StageId) => {
      const live = work.get().banks.filter((b) => b.stage === stage);
      return (view?.stages.find((s) => s.id === stage)?.subjects ?? []).map((sub) => live.find((b) => b.subject === sub) ?? view?.sources[stage]?.[sub]?.bank ?? null);
    };
    /** "3 of 6 banks written · Writing the GCSE maths bank · 48 of 120" (or null: nothing started). */
    function bankSummary(stage: StageId): { done: number; of: number; lines: string[] } | null {
      const rows = banksOf(stage);
      if (!rows.some(Boolean)) return null;
      return { done: rows.filter((r) => r?.done).length, of: rows.length, lines: rows.filter((r): r is NonNullable<typeof r> => !!r && !r.done).map((r) => r.line) };
    }
    function writeBlock(stage: StageId): HTMLElement {
      const sum = bankSummary(stage);
      const queued = (view?.work.banks ?? []).some((k) => k.startsWith(`${stage}:`)) || work.get().banks.some((b) => b.stage === stage && !b.done);
      const btn = named(button(queued ? 'WRITING THE PAPERS…' : 'WRITE THE PAPERS', (b) => write(stage, b), queued ? '' : 'on'), queued ? 'Writing the papers…' : 'Write the papers');
      btn.disabled = queued && work.get().running;
      btn.classList.add('schwrite');
      return h('div.schbank',
        h('div.note', `Ghosty has no ${stageLabel(stage)} papers yet. WRITE THE PAPERS has a stronger online model write a question bank for each subject in the real exam style — every exact answer worked out again by a second check, every mark scheme judged by one — and papers are drawn from it. It runs a few questions at a time while SCHOOL is open, and a little each night.`),
        sum ? h('div.schbanklines', h('b', `${sum.done} of ${sum.of} subjects written${work.get().waiting ? ' · waiting for a free model' : ''}`), ...sum.lines.slice(0, 4).map((l) => h('small', l)), sum.lines.length > 4 ? h('small', `and ${sum.lines.length - 4} more`) : null) : null,
        h('div.keyrow', btn),
      );
    }

    // ======================= the free GPU (a paper sat on Kaggle by the same brain: school/remote.ts on the brain)
    /** The run as the brain last reported it, the keys it needs (null: not known yet) and subjects still to send. */
    let remote: RemoteView | null = null;
    let keys: { kaggle: boolean; hf: boolean } | null = null;
    let gpuQueue: { stage: StageId; subjects: string[] } | null = null;
    /** The paper the last run sat, for the result card once it is filed. */
    let gpuPaper: string | null = null;
    let pollTimer = 0;
    const gpuBusy = () => !!remote && remote.phase !== 'idle';
    const gpuOk = () => !!keys?.kaggle && !!keys?.hf;
    /** Why the free GPU buttons are not there (one line), or '' when they are (or the keys are not known yet). */
    const gpuWhy = () => {
      if (!keys || gpuOk()) return '';
      const need = [!keys.kaggle ? 'the Kaggle key' : '', !keys.hf ? 'the Hugging Face write token' : ''].filter(Boolean).join(' and ');
      return `SIT ON THE FREE GPU (the same brain sits a paper on Kaggle's free computers in about 10 minutes, no phone time) needs ${need}: save ${need.includes(' and ') ? 'them' : 'it'} in SYSTEM → KEYS.`;
    };
    /** Sit these subjects on the free GPU, one after another (the next is sent when the last is filed, while SCHOOL is open). */
    async function sitGpu(stage: StageId, subjects: string[], b?: HTMLButtonElement): Promise<void> {
      const [first, ...rest] = subjects;
      if (!first) return;
      if (b) b.disabled = true;
      try {
        const r = await gcall<{ remote?: RemoteView; error?: string }>('POST', '/sit-remote', { stage, subject: first });
        if (r.body.remote) remote = r.body.remote;
        if (r.status === 409) {
          gpuQueue = null;
          toast(r.body.error ?? 'Another paper is being sat on the free GPU: one at a time.', 'warn');
        } else if (r.status !== 200) toast(r.body.error ?? `Ghosty could not be reached (${r.status}).`, 'bad');
        else {
          gpuQueue = rest.length ? { stage, subjects: rest } : null;
          gpuPaper = remote?.paperId ?? null;
          toast(`${stageLabel(stage)} ${subjectName(first).toLowerCase()}: sent to the free GPU · about 10 minutes`, 'ok');
        }
      } catch (e) {
        toast(String((e as Error)?.message ?? e).slice(0, 180), 'bad');
      }
      ensurePoll();
      paint();
    }
    /** How the run is going (every 20 s while one is on): a finished one is filed by the brain, then shown. */
    async function pollGpu(): Promise<void> {
      const was = gpuBusy();
      try {
        const r = await gcall<{ remote?: RemoteView; gap?: WiredView['gap'] }>('GET', '/remote');
        if (r.status !== 200 || !r.body.remote) return;
        remote = r.body.remote;
        if (view && r.body.gap) view = { ...view, gap: r.body.gap };
      } catch {
        return; // not reached this time: asked again in 20 s
      }
      if (was && !gpuBusy()) {
        toast(remote!.note, remote!.last?.error ? 'bad' : 'ok');
        await refresh();
        const q = gpuQueue;
        gpuQueue = null;
        if (q && shown && !remote!.last?.error) void sitGpu(q.stage, q.subjects);
      }
      ensurePoll();
      paint();
    }
    function ensurePoll(): void {
      const want = shown && gpuBusy();
      if (want && !pollTimer) pollTimer = window.setInterval(() => void pollGpu(), 20_000);
      if (!want && pollTimer) (clearInterval(pollTimer), (pollTimer = 0));
    }
    async function loadKeys(): Promise<void> {
      try {
        keys = (await brain.selftrain.status()).keys ?? null;
      } catch {
        keys = null; // not known: the buttons stay hidden, without a line
      }
      paint();
    }
    /** The live note under the buttons: the run going on, or the last one's outcome. */
    const gpuLine = () => (remote && (gpuBusy() || remote.last) ? h(`div.note.schgpunote${gpuBusy() ? '.live' : ''}` as 'div', gpuBusy() ? `${remote.note}${gpuQueue ? ` · then ${gpuQueue.subjects.length} more while SCHOOL is open` : ''}` : `Last on the free GPU: ${remote.note}`) : null);

    // ======================= the ladder
    function paintLadder(v: StageView): void {
      const rows = v.stages.map((s) => {
        const mark = s.status === 'passed' ? h('span.schmark.ok', icon(TICK)) : s.status === 'now' ? h('span.schmark.now', h('i')) : h('span.schmark.lock', icon(LOCK));
        const state =
          s.status === 'passed'
            ? `Passed ${s.passedAt ? day(s.passedAt) : ''}${s.placement ? ' · placement' : ''}`.replace(/\s+·/, ' ·').trim()
            : s.status === 'now'
              ? 'Now'
              : 'Locked';
        return h(`li.schrung.s-${s.status}` as 'li', { 'aria-label': `${s.label}, ${s.years}: ${state}` }, mark, h('span.schname', h('b', short(s.label)), h('small', s.years)), h(`span.schstate${s.status === 'now' ? '.now' : ''}` as 'span', state));
      });
      clear(ladderP.body, h('ol.schrungs', ...rows), h('div.note', 'Strictly in order: a stage opens only when the one below is passed with top grades in every subject. A placement test can skip ahead.'));
      ladderP.setStatus(short(v.current.label).toUpperCase(), 'ok');
    }

    // ======================= this stage
    const sitAll = button('SIT THE EXAM', () => view && start(view.current.stage, view.current.subjects.map((s) => s.id)), 'on');
    sitAll.title = 'Every subject of this stage, one after another, on the offline brain';
    const stop = button('STOP', () => stopSitting(), 'warn');
    const gpuAll = named(button('SIT ON THE FREE GPU', (b) => view && void sitGpu(view.current.stage, view.current.subjects.filter((s) => s.source).map((s) => s.id), b)), 'Sit on the free GPU');
    gpuAll.classList.add('schgpuall');
    gpuAll.title = 'Every subject of this stage on the free GPU, one after another · about 10 minutes each, no phone time';
    // (Settings is in sections now: the offline brain is under Voice & home, so the button goes straight to that part)
    const toSettings = button('DOWNLOAD IT IN SETTINGS', () => goToPanel('settings', 'OFFLINE BRAIN'));
    const resultCard = h('div.schresult');

    function paintResult(r: PaperResult | null): void {
      if (!r) return void clear(resultCard);
      const pending = r.marked.pending;
      clear(
        resultCard,
        h('div.schgrade', h('b', pending ? '…' : r.grade), h('span', `${r.raw}/${r.max} · ${pct(r)}%`)),
        h('div.schresline', `${stageLabel(r.stage)} ${subjectName(r.subject).toLowerCase()} · ${pending ? `${pending} written answer${pending === 1 ? '' : 's'} waiting for a marker: no final grade yet` : r.top ? 'top grades ✓' : 'not top grades yet'}`),
        r.boundary && !pending ? h('div.schbound', r.boundary) : null,
        h('div.schresfrom', `${r.official ? `Official paper: ${r.title.split(' · official ')[1] ?? r.title}` : 'Written by Ghosty in the same style'}${r.where === 'kaggle' ? ' · sat on the free GPU' : ''}`),
        button('SEE THE PAPER', () => openPaper(r)),
      );
      resultCard.classList.toggle('top', r.top);
      resultCard.classList.toggle('pending', !!pending);
    }

    function paintStage(v: WiredView): void {
      const st = sitting.get();
      const cur = v.current;
      const busy = st.busy;
      // The plan (school/sit.ts sitPlan): the brain the next paper is sat on and whether it is on this phone; after a close
      // with none here that may sit, the one tap (GET the next brain down and sit), or the truth when no brain is left.
      const p = !busy ? plan : null;
      const sitReady = can !== false && (p ? !!p.brain && p.here : !!ready);
      const re = busy ? null : st.resume;
      const tapM = can === false ? null : p ? p.get : re?.get ? (CHAIN.find((x) => x.id === re.get) ?? null) : null;
      const rows = cur.subjects.map((s) => {
        const r = s.latest;
        const grade = r ? (r.marked.pending ? 'marks pending' : `${r.grade} · ${r.raw}/${r.max}`) : 'not sat yet';
        const sitOne = button('SIT', () => start(cur.stage, [s.id]));
        sitOne.disabled = busy || !sitReady || !cur.papers || !!getting;
        sitOne.setAttribute('aria-label', `Sit ${s.label}`);
        const now = busy && st.stage === cur.stage && st.subject === s.id;
        sitOne.disabled = sitOne.disabled || !s.source;
        const onGpu = gpuBusy() && remote?.stage === cur.stage && remote?.subject === s.id;
        const gpuOne = named(button('FREE GPU', (b) => void sitGpu(cur.stage, [s.id], b), 'schgpu'), 'Free GPU');
        gpuOne.setAttribute('aria-label', `Sit ${s.label} on the free GPU`);
        gpuOne.title = 'Sit on the free GPU · about 10 minutes, no phone time';
        gpuOne.disabled = gpuBusy() || !s.source || now;
        gpuOne.hidden = !gpuOk();
        const gap = v.gap?.[s.id]?.line;
        return h(`div.schsub${s.top ? '.top' : ''}${now || onGpu ? '.live' : ''}` as 'div', { dataset: { subject: s.id } },
          h('span.schsubname', h('b', s.label), h('small', `${grade}${r?.where === 'kaggle' ? ' · sat on the free GPU' : ''}`), gap ? h('small.schgap', gap) : null, onGpu ? h('small.schgpunote', remote!.note) : null, h(`small.schfrom${s.source === 'official' ? '.off' : ''}` as 'small', s.source ? `Next paper: ${s.from}` : s.from)),
          h(`span.schtop${s.top ? '.ok' : ''}` as 'span', s.top ? 'Top ✓' : r ? 'Not yet' : '—'),
          h('span.schsubbtns', sitOne, gpuOne));
      });
      const done = cur.subjects.filter((s) => s.top).length;
      const live = busy
        ? h('div.schlive',
            h('div.schliveh', h('b', st.line || 'Sitting…'), h('small', `${subjectName(st.subject)}${st.left.length ? ` · then ${st.left.length} more` : ''}`)),
            st.of ? bar('PAPER', st.n / st.of, `${st.n}/${st.of}`) : null,
            st.brain ? h('div.note.schbrain', st.brain) : null,
            h('div.note', 'Keep Ghosty open while he sits it. STOP hands in the answers so far.'),
          )
        : getting
          ? h('div.schlive.schgetting',
              h('div.schliveh', h('b', `Getting ${getting.label}…`), h('small', 'then I sit on it')),
              bar('GET', offlineBrain.get().progress, `${Math.round(offlineBrain.get().progress * 100)}%`),
              offlineBrain.get().text ? h('div.note', offlineBrain.get().text) : null,
              h('div.note', 'Keep Ghosty open, on Wi-Fi: nothing is loaded until it is all here.'),
            )
          : null;
      // ONE button after a close, with the brain's name and size (1 Nov): GET it, on Wi-Fi, and sit (or carry on).
      const tap = (m: ModelDef, stage: StageId, subjects: string[], small: boolean): HTMLButtonElement => {
        const words = sitOffer(m, false).button;
        // (the brain's name and size as written: a text node, kept out of the stylesheet's sentence case)
        const b = button(document.createTextNode(words), () => oneTap(m, stage, subjects, small), 'on');
        b.dataset.case = 'keep';
        b.style.textTransform = 'none';
        b.classList.add('schgetsit');
        b.setAttribute('aria-label', `${words}: about ${sizeText(m.mb)}, on Wi-Fi`);
        b.disabled = !!getting || !!offlineBrain.get().busy;
        return b;
      };
      // A sitting that closed Ghosty, or whose brain failed: the one line, how far it got, and CARRY ON (never by itself).
      const kept = re ? Math.max(0, re.n - 1) : 0;
      const resume = re
        ? h('div.schlive.schresume',
            h('div.schliveh', h('b', re.line)),
            re.of ? bar('PAPER', kept / re.of, `${kept}/${re.of}`) : null,
            h('div.keyrow', tapM ? tap(tapM, re.stage as StageId, re.subjects, true) : Object.assign(button('CARRY ON', () => start(re.stage as StageId, re.subjects, true), 'on'), { disabled: !!re.blocked || !!getting })),
            tapM && waitLine ? h('div.note.schwait', waitLine) : null,
          )
        : null;
      // Which brain sits the papers, in one line; when the brain in use is a bigger one, he may choose it for school.
      const choose = p?.least && sitReady
        ? named(button(p.chosen ? 'SIT ON THE SMALLEST' : `SIT ON ${p.cur.label.toUpperCase()}`, () => {
            sitPrefs.set({ brain: p.chosen ? '' : p.cur.id });
            void sitPlan().then((x) => ((plan = x), paint()));
          }), p.chosen ? 'Sit on the smallest' : `Sit on ${p.cur.label}`)
        : null;
      const which = p?.brain && sitReady ? h('div.schbrain', h('div.note', brainLine({ ...p, brain: p.brain }, false)), choose ? h('div.keyrow', choose) : null) : null;
      // The brain it would sit on closed Ghosty on this phone and nothing else may sit (a bigger one alone): no SIT by
      // itself; the words say what to do (a smaller brain, or USE in SETTINGS as his yes).
      const blocked = p?.brain && !mayUse(p.brain) ? offlineBrain.get().fellBack || `${p.brain.label} closed Ghosty on this phone: in Settings → Offline brain, GET the smaller ${MODELS[1]!.label} or press USE to try it again.` : '';
      // (the one tap stands in for SIT THE EXAM: in CARRY ON's place when a paper waits, else here)
      const keyTap = tapM && !re && cur.papers ? tap(tapM, cur.stage, cur.subjects.map((s) => s.id), false) : null;
      sitAll.disabled = busy || !sitReady || !cur.papers || !!blocked || !!getting;
      sitAll.hidden = !!p?.none || (!!tapM && (!!re || !!cur.papers));
      gpuAll.disabled = gpuBusy() || !cur.papers;
      gpuAll.hidden = !gpuOk();
      stop.hidden = !busy;
      toSettings.hidden = !(blocked || (can !== false && (p ? !p.here : ready === false) && !tapM && !p?.none));
      const why =
        blocked
          ? blocked
          : can === false
          ? 'This phone cannot run the offline brain, so he cannot sit exams on it.'
          : p?.none
            ? re ? '' : NO_BRAIN
            : tapM
              ? re ? '' : `${sitOfferWhy(p?.after ?? null, tapM)}${waitLine ? ` ${waitLine}` : ''}`
              : (p ? !p.here : ready === false)
                ? notDownloaded
                : !cur.papers && !cur.bank
                  ? `There are no papers for ${short(cur.label)} yet, so it cannot be sat. Earlier stages can still be sat for revision.`
                  : '';
      const row = v.stages.find((s) => s.id === cur.stage);
      clear(
        stageP.body,
        h('div.schhead', h('b', short(cur.label)), h('small', `${row?.years ?? ''} · his stage now`)),
        resume,
        h('div.note.schpass', `To move up: ${cur.pass}.${row && /scaled score|grade|A\*/.test(cur.pass) ? ' Until the official papers come, the papers Ghosty writes count with their top band (85%+).' : ''} ${done} of ${cur.subjects.length} subjects at top grades.`),
        h('div.schsubs', ...rows),
        live,
        why ? h('div.note.schwhy', why) : null,
        !cur.papers && cur.bank ? writeBlock(cur.stage) : null,
        which,
        h('div.keyrow.schbtns', sitAll, keyTap, gpuAll, stop, toSettings),
        gpuOk() ? (gpuLine() ?? h('div.note.schgpunote', 'Sit on the free GPU · about 10 minutes a paper, no phone time: the same brain sits it on Kaggle’s free GPU, one subject after another.')) : null,
        gpuWhy() ? h('div.note.schgpuwhy', gpuWhy()) : null,
        resultCard,
      );
      stageP.setStatus(busy ? 'SITTING' : v.pending.length ? 'MARKS PENDING' : `${done}/${cur.subjects.length} TOP`, busy ? 'mid' : v.pending.length ? 'mid' : done === cur.subjects.length ? 'ok' : 'off');
    }

    // ======================= placement
    const placeBtn = button('SIT A PLACEMENT TEST', () => {
      placementOpen = !placementOpen;
      placementPick = null;
      paint();
    });
    function paintPlacement(v: StageView): void {
      const busy = sitting.get().busy;
      placeBtn.textContent = placementOpen ? 'CLOSE' : 'SIT A PLACEMENT TEST';
      placeBtn.disabled = busy || !ready;
      const pick = placementPick ? v.stages.find((s) => s.id === placementPick) : null;
      const list = placementOpen
        ? h('div.schpicks', { role: 'group', 'aria-label': 'Pick a stage' },
            ...v.stages.map((s) => {
              const b = named(button(short(s.label).toUpperCase(), () => ((placementPick = s.id), paint()), s.id === placementPick ? 'on' : ''), short(s.label));
              const bank = isBankStage(s.id);
              b.disabled = (!s.papers && !bank) || busy;
              b.dataset.stage = s.id;
              b.dataset.papers = String(s.papers);
              if (!s.papers) b.title = bank ? 'Its papers are not written yet: pick it to write them' : 'There are no papers for this stage yet';
              const sum = !s.papers && bank ? bankSummary(s.id) : null;
              return h('div.schpick', b, h('small', s.papers ? `${s.years}${s.status === 'passed' ? ' · passed' : s.status === 'now' ? ' · now' : ''}` : sum ? `writing its papers · ${sum.done} of ${sum.of}` : bank ? 'papers not written yet' : 'no papers yet'));
            }))
        : null;
      const from = (id: StageId, sub: string) => v.sources[id]?.[sub]?.source;
      const go2 = pick
        ? pick.papers
          ? h('div.schgo',
              h('div.note', `${short(pick.label)}: ${pick.subjects.length} papers (${pick.subjects.map((x) => `${subjectName(x)}${from(pick.id, x) === 'official' ? ' — official' : ''}`).join(', ')}). If he gets top grades, that stage and everything below it is done at once.`),
              named(button(`SIT ${short(pick.label).toUpperCase()}`, () => {
                placementOpen = false;
                start(pick.id, pick.subjects);
              }, 'on'), `Sit ${short(pick.label)}`),
              gpuOk()
                ? (() => {
                    const b = named(button(`SIT ${short(pick.label).toUpperCase()} ON THE FREE GPU`, (btn) => {
                      placementOpen = false;
                      void sitGpu(pick.id, pick.subjects.filter((x) => from(pick.id, x)), btn);
                    }), `Sit ${short(pick.label)} on the free GPU`);
                    b.disabled = gpuBusy();
                    return b;
                  })()
                : null,
            )
          : h('div.schgo', writeBlock(pick.id))
        : null;
      clear(placeP.body, h('div.note', 'He may sit any stage straight away. If he gets top grades, that stage and everything below it is done at once — training time goes only where he fails. Moving up still needs every subject.'), h('div.keyrow', placeBtn), list, go2);
      schoolState.placement = placementOpen ? v.stages.map((s) => s.id) : [];
    }

    // ======================= weak spots
    function paintWeak(v: WiredView): void {
      // What the weekly training practises for them (school/practice.ts on the brain): "practising: 3 weak spots · 24 items checked this week".
      const practice = v.practice ? h('div.schpractice', v.practice.line) : null;
      if (!v.weak.length) return void clear(weakP.body, h('div.note', v.state.results.length ? 'No weak spots: every topic so far got full marks.' : 'Weak spots show after his first papers: the topics where he lost the most marks.'), practice);
      clear(weakP.body, ...v.weak.map((w) => bar(w.topic.toUpperCase(), (w.of - w.lost) / Math.max(1, w.of), `${w.of - w.lost}/${w.of}`)), practice, h('div.note', `Share of marks he got in each topic, worst first, across his recent papers.${v.practice ? ' The weekly training practises his weak spots with checked questions (never a paper’s own).' : ''}`));
    }

    // ======================= results
    function paintResults(v: StageView): void {
      const rs = v.state.results;
      if (!rs.length) return void clear(resultsP.body, h('div.note', 'Nothing sat yet. SIT THE EXAM above sets him this stage’s papers, one subject at a time.'));
      clear(
        resultsP.body,
        h('div.schlist', ...rs.slice(0, 20).map((r) =>
          h(`button.schrow${r.top ? '.top' : ''}` as 'button', { type: 'button', onclick: () => openPaper(r), 'aria-label': `${r.title}: ${r.grade}, ${r.raw} out of ${r.max}` },
            h('span.schrowt', h('b', `${stageLabel(r.stage)} ${subjectName(r.subject).toLowerCase()}`), h('small', `${day(r.at)} · ${r.official ? 'official paper' : 'written by Ghosty'}${r.where === 'kaggle' ? ' · sat on the free GPU' : ''}${r.marked.pending ? ' · marks pending' : ''}`)),
            h('span.schrowg', h('b', r.marked.pending ? '…' : r.grade), h('small', `${r.raw}/${r.max}`)),
          ))),
      );
    }

    /** Every question of a sat paper: his answer, the marks, the marker's note, and the right answer. */
    function openPaper(r: PaperResult): void {
      const body = h('div.schpaper', h('div.note', 'Loading the paper…'));
      modal(`${stageLabel(r.stage)} ${subjectName(r.subject).toLowerCase()}`.toUpperCase(), body);
      void school.paper(r.paperId).then(
        (d) => {
          const res = d.result;
          const byId = new Map(res.answers.map((a) => [a.id, a]));
          const passages = d.paper.passages ?? [];
          clear(
            body,
            h('div.schpaperhd', h('b', `${res.grade} · ${res.raw}/${res.max}`), h('small', `${d.paper.official ? `Official paper: ${d.paper.title.split(' · official ')[1] ?? d.paper.title}` : d.from === 'bank' ? 'Written by Ghosty from his checked question bank' : 'Written by Ghosty in the same style'} · sat ${day(res.at)} on ${res.where === 'phone' ? 'this phone' : 'the free GPU'} · ${res.model.split('@')[0]}`)),
            res.boundary ? h('div.schbound', res.boundary) : null,
            d.paper.boundaries ? h('div.note', `Boundaries: ${d.paper.boundaries}.`) : null,
            d.paper.leftOut?.length
              ? h('details.schpassage', h('summary', `Left out: ${d.paper.leftOut.length} question${d.paper.leftOut.length === 1 ? '' : 's'} (${d.paper.leftOut.reduce((a, x) => a + x.marks, 0)} marks)`), ...d.paper.leftOut.map((x) => h('p', `${x.what} (${x.marks} mark${x.marks === 1 ? '' : 's'}): ${x.why}`)))
              : null,
            ...passages.map((p) => h('details.schpassage', h('summary', `Passage: ${p.title}`), h('p', p.text), h('small', p.source))),
            ...d.paper.items.map((it, i) => {
              const a = byId.get(it.id);
              const how = a?.how === 'model' ? 'marked by a stronger model' : a?.how === 'exact' ? 'marked exactly by the code' : a?.how === 'pending' ? 'waiting for a marker' : 'not answered';
              const right = it.type === 'mcq' ? `${(it.answer ?? '').toUpperCase()}) ${it.options?.['abcd'.indexOf(it.answer ?? '')] ?? ''}` : it.answer ?? '';
              return h(`div.schq${a && a.got === a.max ? '.ok' : a && a.got > 0 ? '.part' : '.no'}` as 'div',
                h('div.schqh', h('b', `${i + 1}.`), h('span', it.q), h('em', `${a?.got ?? 0}/${it.marks}`)),
                it.options ? h('div.schopts', it.options.map((o, k) => `${'ABCD'[k]}) ${o}`).join('   ')) : null,
                h('div.schans', h('small', 'HIS ANSWER'), h('p', a?.given || '—')),
                h('div.schans', h('small', it.type === 'short' || it.type === 'extended' ? 'MODEL ANSWER' : 'RIGHT ANSWER'), h('p', right)),
                it.rubric ? h('div.schans', h('small', 'MARK SCHEME'), h('p', it.rubric)) : null,
                h('div.schnote', `${how}${a?.note ? ` · ${a.note}` : ''}`),
              );
            }),
            d.paper.source ? h('div.note', `${d.paper.source}${d.paper.licence ? ` · ${d.paper.licence}` : ''}`) : null,
          );
        },
        (e) => clear(body, h('div.note', String((e as Error)?.message ?? e))),
      );
    }

    // ======================= official papers
    const STAGE_GROUPS: [StageId, string][] = [['ks2', 'Key Stage 2 SATs'], ['gcse', 'GCSE'], ['alevel', 'A-level']];
    /** Groups the owner opened or closed stay that way between repaints. */
    const groupOpen = new Map<string, boolean>();
    function officialRow(o: OfficialRow): HTMLElement {
      const here = work.get().fetching[o.id];
      const live = work.get().official.find((x) => x.id === o.id) ?? o;
      const canFetch = live.status === 'available' || live.status === 'failed';
      const b = named(button(live.status === 'failed' ? 'FETCH AGAIN' : 'FETCH', async (btn) => {
        btn.disabled = true;
        try {
          await fetchOfficial(o);
          toast(`${o.title}: read on this phone; Ghosty is making it into a paper`, 'ok');
        } catch (e) {
          toast(String((e as Error)?.message ?? e).slice(0, 200), 'bad');
        }
        void loadOfficial();
      }), live.status === 'failed' ? 'Fetch again' : 'Fetch');
      b.disabled = !!here;
      b.setAttribute('aria-label', `Fetch ${o.title}, ${o.series}`);
      return h(`div.schoff.st-${here ? 'fetching' : live.status}` as 'div', { 'data-id': o.id },
        h('div.schoffh', h('b', o.title), h('small', `${o.board}${o.code ? ` ${o.code}` : ''} · ${o.series}`)),
        h('div.schoffline', here ? `Fetching: ${here}` : live.line),
        o.note ? h('small.schoffnote', o.note) : null,
        h('small.schlicence', `${o.licenceShort} · kept private, never shared`),
        h('details.schabout', h('summary', 'Source, licence and boundaries'), h('p', `Licence: ${o.licence}`), h('p', `Source: ${o.source}.`), h('p', `Boundaries: ${o.boundaries}.`), h('p', `Parts: ${o.parts.map((x) => x.label).join(', ')}.`)),
        canFetch && !here ? h('div.keyrow', b) : null,
      );
    }
    function paintOfficial(): void {
      if (!official) return void clear(offP.body, h('div.note', officialError ? `The list of official papers could not be shown: ${officialError}` : 'Looking up the official papers…'));
      const now = view?.current.stage;
      const groups = STAGE_GROUPS.map(([id, words]) => {
        const rows = official!.filter((o) => o.stage === id);
        const ready = rows.filter((o) => o.status === 'ready').length;
        const busy = rows.some((o) => o.status === 'reading' || o.status === 'fetching' || !!work.get().fetching[o.id]);
        const d = h('details.schoffgrp', { open: groupOpen.get(id) ?? (id === now || busy) },
          h('summary', `${words} · ${rows.length} papers${ready ? ` · ${ready} fetched` : ''}`),
          ...rows.map(officialRow));
        d.addEventListener('toggle', () => groupOpen.set(id, d.open));
        return d;
      });
      clear(offP.body,
        h('div.note', 'The real papers, from the Standards and Testing Agency and the exam boards’ own sites: free, with their mark schemes and real boundaries. FETCH reads one on this phone; Ghosty turns it into a paper he sits once. They stay private: never shared, never put in the library, never used for training. Questions that need a picture are left out, with their marks, and the boundaries scaled to match.'),
        ...groups);
      const fetched = official.filter((o) => o.status === 'ready').length;
      offP.setStatus(Object.keys(work.get().fetching).length || official.some((o) => o.status === 'reading') ? 'READING' : `${fetched}/${official.length} FETCHED`, fetched ? 'ok' : 'off');
      schoolState.official = official.map((o) => ({ id: o.id, status: work.get().official.find((x) => x.id === o.id)?.status ?? o.status, line: o.line }));
    }
    async function loadOfficial(): Promise<void> {
      try {
        official = (await officialApi.list()).papers;
        officialError = '';
      } catch (e) {
        officialError = String((e as Error)?.message ?? e).slice(0, 160);
      }
      paintOfficial();
    }

    // ======================= nightly report + how marking works
    const nightly = button('NIGHTLY REPORT: ON', async (b) => {
      if (!view) return;
      b.disabled = true;
      try {
        view = { ...(await school.settings(!view.state.nightly)), remote: view.remote, gap: view.gap, practice: view.practice } as WiredView;
      } catch (e) {
        toast(String((e as Error)?.message ?? e).slice(0, 160), 'bad');
      }
      b.disabled = false;
      paint();
    }, 'schnightly');
    nightly.setAttribute('role', 'switch');
    function paintSettings(v: StageView): void {
      nightly.textContent = `NIGHTLY REPORT: ${v.state.nightly ? 'ON' : 'OFF'}`;
      nightly.setAttribute('aria-checked', String(v.state.nightly));
      nightly.classList.toggle('on', v.state.nightly);
      clear(
        setP.body,
        h('div.keyrow', nightly, h('span.note', v.state.nightly ? 'One notification in the morning when something happened: a paper sat, a stage passed, marks in.' : 'No school notifications.')),
        h('div.lab', 'HOW MARKING WORKS'),
        h('div.note.schhow', 'Exact answers (numbers, letters, multiple choice) are marked by the code. Written answers are marked by a stronger model against the mark scheme — you can spot-check every one under RESULTS. A paper still waiting for a marker has no final grade, so it cannot pass a stage. Official papers are graded against their real boundaries (the STA’s scaled scores, the boards’ grade boundaries); papers Ghosty writes use the same grade scale. Papers are never used to train him.'),
      );
    }

    // ======================= paint everything
    function paint(): void {
      paintReading();
      const st = sitting.get();
      schoolState.sitting = st.busy;
      schoolState.line = st.line;
      schoolState.brain = st.busy ? st.brain : plan?.brain && plan.here ? brainLine({ ...plan, brain: plan.brain }, false) : '';
      schoolState.resume = st.resume?.line ?? '';
      if (!view) {
        P.big.textContent = 'School';
        P.sub.textContent = schoolState.error ? 'The school record cannot be shown right now' : 'Looking up his record…';
        clear(ladderP.body, h('div.note', schoolState.error ? `Ghosty could not be reached, so the school record can't be shown: ${schoolState.error}` : 'Asking Ghosty for his school record…'));
        return;
      }
      const v = view;
      P.big.textContent = short(v.current.label);
      P.sub.textContent = `${v.stages.find((s) => s.id === v.current.stage)?.years ?? ''} · ${v.state.results.length ? `${v.state.results.length} paper${v.state.results.length === 1 ? '' : 's'} sat` : 'nothing sat yet'}${v.next ? ` · ${v.next} next` : ''}`;
      paintLadder(v);
      paintStage(v);
      // The phone's last paper, else the one the free GPU last sat (once it is filed).
      paintResult(st.last ?? (gpuPaper ? v.state.results.find((r) => r.paperId === gpuPaper) ?? null : null));
      paintPlacement(v);
      paintWeak(v);
      paintResults(v);
      paintSettings(v);
      paintOfficial();
      schoolState.stage = v.state.stage;
      schoolState.stages = v.stages.map((s: StageRow) => ({ id: s.id, status: s.status, papers: s.papers }));
      schoolState.banks = work.get().banks.map((b) => ({ stage: b.stage, subject: b.subject, kept: b.kept, target: b.target, done: b.done, line: b.line }));
      schoolState.working = work.get().running;
      schoolState.results = v.state.results.length;
      schoolState.gpu = { shown: gpuOk(), phase: remote?.phase ?? '', note: remote?.note ?? '', why: gpuWhy() };
      schoolState.gap = Object.fromEntries(Object.entries(v.gap ?? {}).map(([k, g]) => [k, g.line]));
      schoolState.practice = v.practice?.line ?? '';
      schoolState.last = st.last ? { grade: st.last.grade, raw: st.last.raw, max: st.last.max } : null;
    }

    async function refresh(): Promise<void> {
      try {
        const [v, sup, rd, pl] = await Promise.all([school.view() as Promise<WiredView>, offlineSupport().catch(() => ({ ok: false, reason: '' })), offlineReady().catch(() => false), sitting.get().busy ? Promise.resolve(plan) : sitPlan().catch(() => null)]);
        view = v;
        plan = pl;
        // The run on the free GPU comes with the record (the brain files a finished one first).
        if (v.remote) remote = v.remote;
        ensurePoll();
        can = sup.ok;
        ready = sup.ok && rd;
        // (a brain got or used since the offer to carry on was made: it is said again from what is here now)
        resumeNow();
        schoolState.error = '';
        // Something is being written or read: carry on with it while SCHOOL is on screen.
        if (shown && v.work.busy) startWork();
      } catch (e) {
        schoolState.error = String((e as Error)?.message ?? e).slice(0, 160);
      }
      paint();
    }

    // ======================= reading (part 3): the shelf, READ, the reading check, BORROW, the locks
    const readP = panel('READING', { cls: 'school.schreading' });
    P.right.append(readP.el);
    // Sections (ui/sections.ts; the navigation sheet): the ladder first, then the stage he is on, his results, his weak spots
    // (with the nightly report that follows them), the real papers with the reading shelf, and the placement test.
    sections(root, 'school', [
      { id: 'ladder', label: 'Ladder', match: /^THE LADDER/ },
      { id: 'stage', label: 'This stage', match: /^THIS STAGE/ },
      { id: 'results', label: 'Results', match: /^RESULTS/ },
      { id: 'weak', label: 'Weak spots', match: /^WEAK SPOTS/ },
      { id: 'papers', label: 'Papers', match: /^(OFFICIAL PAPERS|READING)/ },
      { id: 'placement', label: 'Placement', match: /^PLACEMENT/ },
    ]);
    let reading: ReadView | null = null;
    let readingError = '';
    /** Books being read in now (READ runs a part at a time while SCHOOL is open): their progress line. */
    const readingNow: Record<string, string> = {};
    /** The reading check being sat now, and the last one handed in. */
    let checkLive: { id: string; title: string; borrow: boolean; n: number; of: number; line: string } | null = null;
    let checkCtl: AbortController | null = null;
    let lastCheck: { line: string; passed: boolean } | null = null;
    async function loadReading(): Promise<void> {
      try {
        reading = await rcall<ReadView>('GET', '');
        readingError = '';
      } catch (e) {
        readingError = String((e as Error)?.message ?? e).slice(0, 160);
      }
      paintReading();
    }
    /** A book's row replaced by the brain's newer copy of it, wherever it is listed. */
    const patchRow = (r: ReadRow) => {
      if (!reading) return;
      const fix = (list: ReadRow[]) => list.map((x) => (x.id === r.id ? r : x));
      reading = { ...reading, shelf: fix(reading.shelf), borrowed: fix(reading.borrowed), ahead: reading.ahead.map((a) => ({ ...a, books: fix(a.books) })) };
    };

    /** READ: the next part, again and again until the book is in his library (leaving SCHOOL pauses it; READ carries on). */
    async function readBook(r: ReadRow): Promise<void> {
      if (readingNow[r.id] !== undefined) return;
      readingNow[r.id] = 'starting…';
      paintReading();
      try {
        for (let i = 0; i < 400; i++) {
          const res = await rcall<{ book: ReadRow; done: boolean }>('POST', '/read', { id: r.id });
          patchRow(res.book);
          readingNow[r.id] = res.book.parts ? `${r.kind === 'book' ? 'part' : 'section'} ${res.book.part} of ${res.book.parts}` : '…';
          paintReading();
          if (res.done) {
            toast(`${r.title}: read ✓ — it is in his library now`, 'ok');
            break;
          }
          if (!shown) break;
        }
      } catch (e) {
        toast(String((e as Error)?.message ?? e).slice(0, 200), 'bad');
      } finally {
        delete readingNow[r.id];
        void loadReading();
      }
    }

    /** A reading check (or a BORROW's check), sat on the offline brain like a paper: one question at a time, STOP keeps the answers. */
    async function sitCheck(r: ReadRow, borrow: boolean): Promise<void> {
      if (sitting.get().busy || checkLive) return;
      if (!ready) return void toast(notDownloaded, 'bad');
      const ctl = new AbortController();
      checkCtl = ctl;
      checkLive = { id: r.id, title: r.title, borrow, n: 0, of: 0, line: 'getting the check (the first time, a stronger model writes it from the book)…' };
      paintReading();
      const set = (o: Partial<NonNullable<typeof checkLive>>) => ((checkLive = checkLive ? { ...checkLive, ...o } : null), paintReading());
      try {
        await withModel('bench', async () => {
          const got = await rcall<{ paper: SitPaper; done: string[] }>('POST', borrow ? '/borrow' : '/check', { id: r.id });
          set({ line: 'getting ready (loading the model)…', of: got.paper.items.length, n: got.done.length });
          await loadOffline();
          const save = (answers: { id: string; given: string }[], final: boolean) => rcall<{ result?: { raw: number; max: number; pct: number; passed: boolean }; line?: string }>('POST', '/answers', { id: r.id, checkId: got.paper.id, answers, final });
          const { rest, stopped } = await runPaper(got.paper, { gen: sitGen, save: (a) => save(a, false), done: new Set(got.done), signal: ctl.signal, onProgress: (n, of) => set({ n, of, line: `Question ${n} of ${of}` }) });
          if (stopped) {
            await save(rest, false).catch(() => undefined);
            toast('Stopped: the answers so far are kept — SIT THE READING CHECK carries on', 'warn');
            return;
          }
          set({ line: 'handing it in for marking…' });
          const res = await save(rest, true);
          lastCheck = { line: res.line ?? '', passed: !!res.result?.passed };
          toast(res.line ?? 'Marked', res.result?.passed ? 'ok' : 'warn');
        }, { wait: false });
      } catch (e) {
        toast(String((e as Error)?.message ?? e).slice(0, 220), 'bad');
      } finally {
        if (checkCtl === ctl) checkCtl = null;
        checkLive = null;
        void loadReading();
      }
    }

    function bookRow(r: ReadRow, ahead: boolean): HTMLElement {
      const live = readingNow[r.id];
      const state = r.status === 'read' ? `Read ✓ ${r.readAt ? day(r.readAt) : ''}`.trim() : live !== undefined ? `Reading · ${live}` : r.status === 'reading' ? `Reading · ${r.kind === 'book' ? 'part' : 'section'} ${r.part} of ${r.parts || '?'}` : r.borrowed ? 'Borrowed · not read yet' : '';
      const c = r.check;
      const checkLine = c ? `Reading check: ${c.raw}/${c.max} (${c.pct}%) · ${c.passed ? 'passed ✓' : 'not passed'}${c.purpose === 'borrow' ? (c.passed ? ' · borrowed' : ' · locked until he moves up') : ''}` : '';
      const busy = sitting.get().busy || !!checkLive;
      const btns: HTMLElement[] = [];
      if (!r.ingest) btns.push(h('a.schlink', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'OPEN THE LINK'));
      else if (r.open) {
        if (r.status !== 'read') {
          const b = button(r.status === 'reading' ? 'CARRY ON READING' : 'READ', () => void readBook(r), r.status === 'none' || r.status === 'unread' ? 'on' : '');
          b.disabled = live !== undefined;
          b.setAttribute('aria-label', `Read ${r.title}`);
          btns.push(b);
        }
        if (!c) {
          const b = button('SIT THE READING CHECK', () => void sitCheck(r, false));
          b.disabled = busy || !ready;
          b.setAttribute('aria-label', `Sit the reading check for ${r.title}`);
          btns.push(b);
        }
      } else if (ahead && r.borrow) {
        const b = button('BORROW', () => void sitCheck(r, true), r.borrow.ok ? 'on' : '');
        b.disabled = !r.borrow.ok || busy || !ready;
        b.setAttribute('aria-label', `Borrow ${r.title}`);
        btns.push(b);
      }
      return h(`div.schbook${r.status === 'read' ? '.read' : ''}${r.borrowed ? '.borrowed' : ''}` as 'div', { dataset: { id: r.id } },
        h('div.schoffh', h('b', r.title), h('small', `${r.author}${r.years ? ` · ${r.years}` : ''}${r.subject ? ` · ${r.subject}` : ''}`)),
        h('small.schlicence', `${r.source} · ${r.licence}`),
        r.why ? h('small.schoffnote', r.why) : null,
        state ? h('div.schbookst', state) : null,
        checkLine ? h(`div.schbookck${c?.passed ? '.ok' : '.no'}` as 'div', checkLine) : null,
        r.error && r.status !== 'read' ? h('small.schoffnote', `Last try: ${r.error}`) : null,
        ahead && r.borrow && !r.borrowed ? h('small.schborrowwhy', r.borrow.why) : null,
        btns.length ? h('div.keyrow', ...btns) : null,
      );
    }

    function paintReading(): void {
      if (!reading) {
        clear(readP.body, h('div.note', readingError ? `The reading shelf could not be shown: ${readingError}` : 'Looking up his reading…'));
        schoolStateReading(null);
        return;
      }
      const v = reading;
      const stop = button('STOP', () => checkCtl?.abort(), 'warn');
      const live = checkLive
        ? h('div.schlive.schcheck',
            h('div.schliveh', h('b', checkLive.line), h('small', `${checkLive.borrow ? 'Borrowing check' : 'Reading check'} · ${checkLive.title}`)),
            checkLive.of ? bar('CHECK', checkLive.n / checkLive.of, `${checkLive.n}/${checkLive.of}`) : null,
            h('div.keyrow', stop),
          )
        : null;
      const readCount = v.read.length;
      clear(
        readP.body,
        h('div.note', `His shelf at ${v.label}: books to read now, like a real pupil — public-domain classics (in the UK, their authors died before ${v.publicDomainBefore}) and open textbooks. READ puts one in his library, chapter by chapter. SIT THE READING CHECK: ten questions on the book’s own words, sat on this phone and marked exactly; ${Math.round(v.pass * 100)}% passes. Checks never count towards passing a stage.`),
        live,
        lastCheck && !checkLive ? h(`div.schbookck.schlast${lastCheck.passed ? '.ok' : '.no'}` as 'div', lastCheck.line) : null,
        h('div.schbooks', ...v.shelf.map((r) => bookRow(r, false))),
        v.borrowed.length ? h('div.lab', 'BORROWED') : null,
        v.borrowed.length ? h('div.schbooks', ...v.borrowed.map((r) => bookRow(r, false))) : null,
        h('div.lab', 'BORROW FROM A HIGHER CLASS'),
        h('div.note.schrule', v.borrow.rule),
        h(`div.note.schborrowline${v.borrow.top ? '.ok' : ''}` as 'div', v.borrow.line),
        ...v.ahead.map((a) => h('details.schoffgrp.schahead', { dataset: { stage: a.stage } }, h('summary', `${a.label} shelf · ${a.years} · ${a.books.length} books`), h('div.schbooks', ...a.books.map((r) => bookRow(r, true))))),
        h('div.lab', 'WHAT IS LOCKED'),
        h('div.note.schlocks', v.locks.line),
        h('div.note', v.locks.never),
        readCount ? h('div.lab', 'READ') : null,
        readCount ? h('div.schreadlist', ...v.read.slice(0, 30).map((x) => h('small', `${x.title} · ${day(x.readAt)}${x.borrowed ? ' · borrowed' : ''}`))) : null,
      );
      readP.setStatus(checkLive ? 'CHECK' : Object.keys(readingNow).length ? 'READING' : `${readCount} READ`, checkLive || Object.keys(readingNow).length ? 'mid' : readCount ? 'ok' : 'off');
      schoolStateReading(v);
    }
    function schoolStateReading(v: ReadView | null): void {
      schoolState.reading = v
        ? { stage: v.stage, shelf: v.shelf.map((r) => ({ id: r.id, status: r.status, check: r.check ? `${r.check.raw}/${r.check.max}` : '' })), ahead: v.ahead.map((a) => a.stage), rule: v.borrow.rule, borrow: v.borrow.line, locks: v.locks.line, live: checkLive?.line ?? '', last: lastCheck?.line ?? '' }
        : null;
    }

    sitting.subscribe(paint);
    // Back on screen after the phone slept: carry on writing or reading.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && shown && (view?.work.busy || work.get().busy)) startWork();
    });
    work.subscribe((s, p) => {
      paint();
      // A bank or paper finished: what can be sat has changed.
      if ((p.busy && !s.busy) || s.banks.filter((b) => b.done).length !== p.banks.filter((b) => b.done).length) void refresh();
      if (s.official.some((o) => o.status === 'ready' && p.official.find((x) => x.id === o.id)?.status !== 'ready') || (p.running && !s.running)) void loadOfficial();
    });
    // Downloaded or deleted in SETTINGS meanwhile: look again.
    offlineBrain.subscribe((s, p) => {
      if (s.downloaded !== p.downloaded || s.model !== p.model) void refresh();
    });
    paint();
    return {
      enter() {
        shown = true;
        // Opened after a sitting that closed Ghosty: straight to the stage, where CARRY ON is.
        if (sitting.get().resume && !sitting.get().busy) revealSection('school', 'THIS STAGE');
        void refresh();
        void loadKeys();
        void loadOfficial();
        void loadReading();
      },
      leave() {
        shown = false;
        stopWork();
        ensurePoll();
      },
      describe() {
        return view ? `School: the offline brain is at ${view.current.label}; ${view.current.subjects.map((s) => `${s.label} ${s.latest ? s.latest.grade : 'not sat'}`).join(', ')}.` : 'School.';
      },
    };
  },
};

// ---------------------------------------------------------------------------------------
// Reading (part 3): the brain's /api/school/reading routes (apps/edge/src/school/reading.ts)
// ---------------------------------------------------------------------------------------

/** A book on a shelf, as the brain lists it. */
interface ReadRow {
  id: string;
  stage: StageId;
  kind: 'book' | 'textbook';
  title: string;
  author: string;
  source: string;
  licence: string;
  url: string;
  ingest: boolean;
  why?: string;
  years?: string;
  subject?: string;
  status: 'none' | 'unread' | 'reading' | 'read';
  part: number;
  parts: number;
  readAt?: number;
  borrowed?: boolean;
  error?: string;
  check: { raw: number; max: number; pct: number; passed: boolean; purpose: 'read' | 'borrow'; at: number } | null;
  open: boolean;
  borrow?: { ok: boolean; why: string };
}
interface ReadView {
  stage: StageId;
  label: string;
  shelf: ReadRow[];
  ahead: { stage: StageId; label: string; years: string; books: ReadRow[] }[];
  borrowed: ReadRow[];
  read: { id: string; title: string; stage: StageId; readAt: number; borrowed: boolean }[];
  borrow: { rule: string; top: boolean; reading: string[]; line: string };
  locks: { line: string; levels: { level: number; open: boolean; opensAt: string | null }[]; never: string };
  pass: number;
  publicDomainBefore: number;
}

async function rcall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api/school/reading${path}`, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(j?.error ?? (r.status === 401 ? 'Not signed in.' : `Ghosty could not be reached (${r.status}).`));
  return j as T;
}

// ---------------------------------------------------------------------------------------
// The free GPU (part 2b): /api/school/sit-remote and /api/school/remote (apps/edge/src/school/remote.ts)
// ---------------------------------------------------------------------------------------

/** The run as the brain shows it (`remoteView`). */
interface RemoteView {
  phase: 'idle' | 'queued' | 'running';
  note: string;
  paperId: string | null;
  stage: StageId | null;
  subject: string | null;
  title: string | null;
  startedAt: number | null;
  last: { paperId: string; title: string; at: number; raw?: number; max?: number; grade?: string; error?: string } | null;
}
/** GET /school with what this wiring added: the run, the gap per subject and the practice (older brains: absent). */
type WiredView = StageView & {
  remote?: RemoteView | null;
  gap?: Record<string, { stage: StageId; subject: string; line: string; paperId: string; at: number }>;
  practice?: { spots: number; checked: number; line: string } | null;
};

/** One call that keeps the status: a 409 ("one paper at a time") carries the run already going. */
async function gcall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const r = await fetch(`/api/school${path}`, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = ((await r.json().catch(() => null)) ?? {}) as T & { error?: string };
  if (r.status === 401) throw new Error(j.error ?? 'Not signed in.');
  return { status: r.status, body: j };
}
