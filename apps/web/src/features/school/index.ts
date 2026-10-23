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
 * Papers are set and marked by the brain (/api/school, apps/edge/src/school); they are sat here, on the phone's
 * own model (school/sit.ts). State for specs at window.__ghosty.school.
 */
import type { PaperResult, StageId, StageRow, StageView } from '../../school/sit';
import { SUBJECT_LABEL } from '../../../../../packages/shared/src/school';
import { clear, h, icon } from '../../core/dom';
import { offlineBrain, offlineReady, offlineSupport } from '../../offline/brain';
import { notDownloaded, school, sitSubjects, sitting, stopSitting } from '../../school/sit';
import { go, type TabDef } from '../../shell/tabs';
import { bar, button, modal, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';

const LOCK = '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>';
const TICK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** "Key Stage 2 (SATs)" → "Key Stage 2". */
const short = (label: string) => label.replace(/\s*\(.*\)$/, '');
const pct = (r: Pick<PaperResult, 'raw' | 'max'>) => Math.round((r.raw / Math.max(1, r.max)) * 100);

/** What the tab shows, for tests and the console (window.__ghosty.school). */
export const schoolState = { stage: '', stages: [] as { id: string; status: string }[], results: 0, sitting: false, line: '', last: null as null | { grade: string; raw: number; max: number }, placement: [] as string[], error: '' };
function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.school = schoolState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

export const schoolTab: TabDef = {
  id: 'school',
  title: 'SCHOOL',
  icon: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2"/><path d="M12 14v6.5"/>',
  scene: 'backdrop',
  blurb: 'the offline brain goes to school',
  mount(root) {
    const P = page(root, { tag: 'SCHOOL', sub: 'the offline brain on this phone, from nursery up · top grades to move on', leftLabel: 'STAGE', rightLabel: 'REPORT', stack: true });
    expose();
    let view: StageView | null = null;
    /** The phone can run the offline brain / has it downloaded (null: not looked yet). */
    let can: boolean | null = null;
    let ready: boolean | null = null;
    let placementOpen = false;
    let placementPick: StageId | null = null;

    // ======================= panels
    const ladderP = panel('THE LADDER', { cls: 'school.schladder' });
    const stageP = panel('THIS STAGE', { cls: 'school.schstage' });
    const placeP = panel('PLACEMENT TEST', { cls: 'school.schplace' });
    const weakP = panel('WEAK SPOTS', { cls: 'school.schweak', grow: false });
    const resultsP = panel('RESULTS', { cls: 'school.schresults' });
    const setP = panel('NIGHTLY REPORT', { cls: 'school.schset', grow: false });
    P.left.append(ladderP.el, stageP.el, placeP.el);
    P.right.append(resultsP.el, weakP.el, setP.el);

    // ======================= sitting
    const start = (stage: StageId, subjects: string[]) => {
      if (sitting.get().busy) return;
      void sitSubjects(stage, subjects)
        .then((rs) => {
          const last = rs.at(-1);
          if (sitting.get().stopped) toast(rs.length ? 'Stopped: the answers so far were handed in' : 'Stopped', 'warn');
          else if (last) toast(`${stageLabel(stage)} ${subjectName(last.subject).toLowerCase()}: ${last.grade}`, last.top ? 'ok' : '');
        })
        .catch((e) => toast(String((e as Error)?.message ?? e).slice(0, 180), 'bad'))
        .finally(() => void refresh());
      paint();
    };
    const subjectName = (id: string) => SUBJECT_LABEL[id] ?? id;
    const stageLabel = (id: string) => short(view?.stages.find((s) => s.id === id)?.label ?? id);
    /** A button whose words are a name ("Key Stage 2", "GCSE"): the calm looks show them as written, not re-cased. */
    const named = (b: HTMLButtonElement, words: string) => ((b.dataset.label = words), b);

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
    const toSettings = button('DOWNLOAD IT IN SETTINGS', () => go('settings'));
    const resultCard = h('div.schresult');

    function paintResult(r: PaperResult | null): void {
      if (!r) return void clear(resultCard);
      const pending = r.marked.pending;
      clear(
        resultCard,
        h('div.schgrade', h('b', pending ? '…' : r.grade), h('span', `${r.raw}/${r.max} · ${pct(r)}%`)),
        h('div.schresline', `${stageLabel(r.stage)} ${subjectName(r.subject).toLowerCase()} · ${pending ? `${pending} written answer${pending === 1 ? '' : 's'} waiting for a marker: no final grade yet` : r.top ? 'top grades ✓' : 'not top grades yet'}`),
        button('SEE THE PAPER', () => openPaper(r)),
      );
      resultCard.classList.toggle('top', r.top);
      resultCard.classList.toggle('pending', !!pending);
    }

    function paintStage(v: StageView): void {
      const st = sitting.get();
      const cur = v.current;
      const busy = st.busy;
      const rows = cur.subjects.map((s) => {
        const r = s.latest;
        const grade = r ? (r.marked.pending ? 'marks pending' : `${r.grade} · ${r.raw}/${r.max}`) : 'not sat yet';
        const sitOne = button('SIT', () => start(cur.stage, [s.id]));
        sitOne.disabled = busy || !ready || !cur.papers;
        sitOne.setAttribute('aria-label', `Sit ${s.label}`);
        const now = busy && st.stage === cur.stage && st.subject === s.id;
        return h(`div.schsub${s.top ? '.top' : ''}${now ? '.live' : ''}` as 'div', h('span.schsubname', h('b', s.label), h('small', grade)), h(`span.schtop${s.top ? '.ok' : ''}` as 'span', s.top ? 'Top ✓' : r ? 'Not yet' : '—'), sitOne);
      });
      const done = cur.subjects.filter((s) => s.top).length;
      const live = busy
        ? h('div.schlive',
            h('div.schliveh', h('b', st.line || 'Sitting…'), h('small', `${subjectName(st.subject)}${st.left.length ? ` · then ${st.left.length} more` : ''}`)),
            st.of ? bar('PAPER', st.n / st.of, `${st.n}/${st.of}`) : null,
            h('div.note', 'Keep Ghosty open while he sits it. STOP hands in the answers so far.'),
          )
        : null;
      sitAll.disabled = busy || !ready || !cur.papers;
      stop.hidden = !busy;
      toSettings.hidden = ready !== false || can === false;
      const why =
        can === false
          ? 'This phone cannot run the offline brain, so he cannot sit exams on it.'
          : ready === false
            ? notDownloaded
            : !cur.papers
              ? `Papers for ${short(cur.label)} are not written yet: they come with the official papers. Earlier stages can still be sat for revision.`
              : '';
      const row = v.stages.find((s) => s.id === cur.stage);
      clear(
        stageP.body,
        h('div.schhead', h('b', short(cur.label)), h('small', `${row?.years ?? ''} · his stage now`)),
        h('div.note.schpass', `To move up: ${cur.pass}. ${done} of ${cur.subjects.length} subjects at top grades.`),
        h('div.schsubs', ...rows),
        live,
        why ? h('div.note.schwhy', why) : null,
        h('div.keyrow.schbtns', sitAll, stop, toSettings),
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
              b.disabled = !s.papers || busy;
              b.dataset.stage = s.id;
              if (!s.papers) b.title = 'Papers for this stage are not written yet';
              return h('div.schpick', b, h('small', s.papers ? `${s.years}${s.status === 'passed' ? ' · passed' : s.status === 'now' ? ' · now' : ''}` : 'papers not written yet'));
            }))
        : null;
      const go2 = pick
        ? h('div.schgo',
            h('div.note', `${short(pick.label)}: ${pick.subjects.length} papers (${pick.subjects.map((x) => subjectName(x)).join(', ')}). If he gets top grades, that stage and everything below it is done at once.`),
            named(button(`SIT ${short(pick.label).toUpperCase()}`, () => {
              placementOpen = false;
              start(pick.id, pick.subjects);
            }, 'on'), `Sit ${short(pick.label)}`),
          )
        : null;
      clear(placeP.body, h('div.note', 'He may sit any stage straight away. If he gets top grades, that stage and everything below it is done at once — training time goes only where he fails. Moving up still needs every subject.'), h('div.keyrow', placeBtn), list, go2);
      schoolState.placement = placementOpen ? v.stages.map((s) => s.id) : [];
    }

    // ======================= weak spots
    function paintWeak(v: StageView): void {
      if (!v.weak.length) return void clear(weakP.body, h('div.note', v.state.results.length ? 'No weak spots: every topic so far got full marks.' : 'Weak spots show after his first papers: the topics where he lost the most marks.'));
      clear(weakP.body, ...v.weak.map((w) => bar(w.topic.toUpperCase(), (w.of - w.lost) / Math.max(1, w.of), `${w.of - w.lost}/${w.of}`)), h('div.note', 'Share of marks he got in each topic, worst first, across his recent papers.'));
    }

    // ======================= results
    function paintResults(v: StageView): void {
      const rs = v.state.results;
      if (!rs.length) return void clear(resultsP.body, h('div.note', 'Nothing sat yet. SIT THE EXAM above sets him this stage’s papers, one subject at a time.'));
      clear(
        resultsP.body,
        h('div.schlist', ...rs.slice(0, 20).map((r) =>
          h(`button.schrow${r.top ? '.top' : ''}` as 'button', { type: 'button', onclick: () => openPaper(r), 'aria-label': `${r.title}: ${r.grade}, ${r.raw} out of ${r.max}` },
            h('span.schrowt', h('b', `${stageLabel(r.stage)} ${subjectName(r.subject).toLowerCase()}`), h('small', `${day(r.at)} · ${r.official ? 'official paper' : 'written by Ghosty'}${r.marked.pending ? ' · marks pending' : ''}`)),
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
            h('div.schpaperhd', h('b', `${res.grade} · ${res.raw}/${res.max}`), h('small', `${d.paper.official ? 'Official paper' : 'Written by Ghosty in the same style'} · sat ${day(res.at)} on ${res.where === 'phone' ? 'this phone' : 'the free GPU'} · ${res.model.split('@')[0]}`)),
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

    // ======================= nightly report + how marking works
    const nightly = button('NIGHTLY REPORT: ON', async (b) => {
      if (!view) return;
      b.disabled = true;
      try {
        view = await school.settings(!view.state.nightly);
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
        h('div.note.schhow', 'Exact answers (numbers, letters, multiple choice) are marked by the code. Written answers are marked by a stronger model against the mark scheme — you can spot-check every one under RESULTS. A paper still waiting for a marker has no final grade, so it cannot pass a stage. Papers are never used to train him.'),
      );
    }

    // ======================= paint everything
    function paint(): void {
      const st = sitting.get();
      schoolState.sitting = st.busy;
      schoolState.line = st.line;
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
      paintResult(st.last);
      paintPlacement(v);
      paintWeak(v);
      paintResults(v);
      paintSettings(v);
      schoolState.stage = v.state.stage;
      schoolState.stages = v.stages.map((s: StageRow) => ({ id: s.id, status: s.status }));
      schoolState.results = v.state.results.length;
      schoolState.last = st.last ? { grade: st.last.grade, raw: st.last.raw, max: st.last.max } : null;
    }

    async function refresh(): Promise<void> {
      try {
        const [v, sup, rd] = await Promise.all([school.view(), offlineSupport().catch(() => ({ ok: false, reason: '' })), offlineReady().catch(() => false)]);
        view = v;
        can = sup.ok;
        ready = sup.ok && rd;
        schoolState.error = '';
      } catch (e) {
        schoolState.error = String((e as Error)?.message ?? e).slice(0, 160);
      }
      paint();
    }

    sitting.subscribe(paint);
    // Downloaded or deleted in SETTINGS meanwhile: look again.
    offlineBrain.subscribe((s, p) => {
      if (s.downloaded !== p.downloaded || s.model !== p.model) void refresh();
    });
    paint();
    return {
      enter() {
        void refresh();
      },
      describe() {
        return view ? `School: the offline brain is at ${view.current.label}; ${view.current.subjects.map((s) => `${s.label} ${s.latest ? s.latest.grade : 'not sat'}`).join(', ')}.` : 'School.';
      },
    };
  },
};
