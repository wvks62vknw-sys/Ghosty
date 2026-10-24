/**
 * SYSTEM → OFFLINE BRAIN TRAINING: the honest report card of the offline brain's weekly self-training
 * (apps/edge/src/selftrain on the brain, the notebook on Kaggle's free GPUs). What is happening now; this
 * week's exam score against last week's, area by area; what he trained on; how long it took; what was thrown
 * away and why; the last good models; TRAIN NOW and ROLLBACK. With a key missing it says which, and where to
 * get it, in plain steps. Opening it also tells the brain the GYM levels on this phone (the week's puzzles are
 * made at and just beyond them) and gives the offline brain the list of trained models to choose from.
 */
import { AREA_LABEL, EXAM_AREAS, examMean, type ExamArea, type TrainReport, type TrainStatus } from '../../../../../packages/shared/src/selftrain';
import { brain } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { currentModel, setTrainedModels } from '../../offline/brain';
import { button, panel, row, toast, type Panel } from '../../ui/components';
import { loadAll } from '../gym/store';

const KIND: Record<string, string> = {
  star: 'puzzles he solved himself (each answer checked)',
  critique: 'puzzles he got right after being told why he was wrong',
  judged: 'library answers he picked as better (and the book agreed)',
  evol: 'harder questions written by the online AIs',
  library: 'questions about your own library',
  tool: 'examples of using tools (weather, reminders…)',
  pref: 'your 👍 and 👎',
  dpo: 'pairs of a better and a worse answer',
  failure: "last week's mistakes, tried again",
  redteam: 'requests he should turn down',
  distill: 'online AI answers to your own questions',
  replay: 'earlier weeks, so he does not forget',
  general: 'everyday conversation examples (OpenAssistant)',
  gym: 'GYM puzzles set',
  drill: 'quick quiz questions set',
  school: 'school practice questions (each answer checked twice)',
  voice: 'his replies rewritten to sound like a person',
};

/** The parts of a Kaggle run, in plain words. */
const STEP: Record<string, string> = { setup: 'getting ready', exam_before: 'test of the current brain', star: 'practising puzzles', critique: 'fixing mistakes', judge: 'checking library answers', sft: 'learning', dpo: 'learning what is better', exam_after: 'test of the new brain', publish: 'saving the new brain' };

const PHASE: Record<TrainStatus['phase'], string> = { idle: 'IDLE', collect: 'GATHERING', upload: 'UPLOADING', push: 'STARTING', running: 'TRAINING', failed: 'STOPPED' };

const pct = (x: number | undefined) => (typeof x === 'number' ? `${Math.round(x * 100)}%` : '—');
const minutes = (m: number) => (m >= 90 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const when = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** The panel; `refresh()` reloads it from the brain. */
export function trainingPanel(): Panel & { refresh(): void } {
  const p = panel('OFFLINE BRAIN TRAINING', { grow: false, cls: 'selftrain' });
  let st: TrainStatus | null = null;
  let busy = false;

  const act = (label: string, fn: () => Promise<TrainStatus>, done: (s: TrainStatus) => string, cls = '') =>
    button(label, async (b) => {
      if (busy) return;
      busy = true;
      b.disabled = true;
      try {
        st = await fn();
        toast(done(st), 'ok');
        paint();
      } catch (e) {
        toast(String((e as Error)?.message ?? e).slice(0, 200), 'warn');
      } finally {
        busy = false;
        b.disabled = false;
      }
    }, cls);

  const keySteps = (s: TrainStatus) => {
    const out = h('div.trainkeys');
    const need = [!s.keys.kaggle ? 'Kaggle' : '', !s.keys.hf ? 'Hugging Face' : ''].filter(Boolean);
    out.append(
      h('div.note', `Ghosty can teach the small brain on your phone by itself, every week, for free. It needs ${need.length === 2 ? 'two keys' : 'one more key'}:`),
      h(
        'ol.steps',
        ...(!s.keys.kaggle ? [h('li', 'Kaggle (free computers to train on): in KEYS above press SHOW OPTIONAL KEYS, find "Kaggle (free GPUs for training)", press HOW TO GET IT and follow the steps. You make it at kaggle.com → Settings → API Tokens → Generate New Token (confirm your phone number there first).')] : []),
        ...(!s.keys.hf ? [h('li', 'Hugging Face (where the brain is kept, privately): in KEYS, find "Hugging Face token (training)", press HOW TO GET IT. You make two private spaces there and a token that can only reach those two.')] : []),
        h('li', "That is all: Ghosty gathers the week's lessons, trains on Kaggle, and only keeps a new brain that does better than the old one in its test."),
      ),
    );
    return out;
  };

  const scores = (r: TrainReport, prev: TrainReport | null) => {
    const box = h('div.trainscores');
    box.append(h('div.lab', 'TEST: OLD BRAIN → NEW BRAIN (LAST WEEK)'));
    for (const a of EXAM_AREAS as readonly ExamArea[]) {
      if (typeof r.before[a] !== 'number' && typeof r.after[a] !== 'number') continue;
      const up = (r.after[a] ?? 0) - (r.before[a] ?? 0);
      // last week on the same fixed questions when both weeks have them (part of the test changes every week)
      const last = r.core && prev?.core ? prev.core.after?.[a] : prev?.after?.[a];
      const items = r.items?.[a];
      const rr = row(AREA_LABEL[a], `${pct(r.before[a])} → ${pct(r.after[a])}${typeof last === 'number' ? ` (last week ${pct(last)})` : ''}${items ? ` · ${items} questions` : ''}`, up > 0.0005 ? `+${Math.round(up * 100)}` : up < -0.0005 ? `${Math.round(up * 100)}` : '±0', { tone: up > 0.0005 ? 'up' : up < -0.0005 ? 'dn' : undefined, wrap: true });
      rr.dataset.area = a;
      box.append(rr);
    }
    box.append(row('AVERAGE', `${pct(examMean(r.before))} → ${pct(examMean(r.after))}`, r.gate.pass ? 'KEPT' : 'NOT KEPT', { tone: r.gate.pass ? 'up' : 'dn' }));
    box.append(h(`div.note.gate${r.gate.pass ? '.good' : '.bad'}` as 'div', r.gate.pass ? `Kept: ${r.gate.why}. (Both brains were tested exactly as your phone would run them.)` : `Not kept: ${r.gate.why}. Nothing changed on your phone.`));
    return box;
  };

  const details = (r: TrainReport) => {
    const box = h('div.traindetail');
    const trained = Object.entries(r.trained ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (trained.length) {
      box.append(h('div.lab', 'WHAT HE TRAINED ON'));
      for (const [k, n] of trained) box.append(row(null, KIND[k] ?? k, fmt.n(n), { wrap: true }));
    }
    const total = (r.phases ?? []).reduce((a, x) => a + (x.minutes || 0), 0);
    if (r.phases?.length) {
      box.append(h('div.lab', `HOW LONG: ${minutes(total)} ON KAGGLE`));
      box.append(h('div.note', r.phases.map((x) => (x.skipped ? `${STEP[x.name] ?? x.name} skipped (${x.skipped})` : `${STEP[x.name] ?? x.name} ${minutes(x.minutes)}`)).join(' · ')));
    }
    if (r.rejected?.length) {
      box.append(h('div.lab', 'LEFT OUT, AND WHY'));
      for (const x of r.rejected.slice(0, 12)) box.append(row(null, x.why, fmt.n(x.n), { wrap: true }));
    }
    if (r.error) box.append(h('div.note.bad', `The run stopped: ${r.error}`));
    return box;
  };

  function paint(): void {
    clear(p.body);
    if (!st) {
      p.setStatus('', 'off');
      p.body.append(h('div.note', 'The brain is not reachable right now, so the training report cannot be shown.'));
      return;
    }
    const s = st;
    const keysOk = s.keys.kaggle && s.keys.hf;
    p.setStatus(!keysOk ? `NEEDS ${Number(!s.keys.kaggle) + Number(!s.keys.hf)} KEY${!s.keys.kaggle && !s.keys.hf ? 'S' : ''}` : PHASE[s.phase], !keysOk ? 'mid' : s.phase === 'idle' ? 'ok' : 'mid');
    p.body.append(h('div.note.trainnote', s.note));
    if (!keysOk) p.body.append(keySteps(s));
    if (keysOk && s.phase === 'idle' && s.next) p.body.append(row('NEXT RUN', when(s.next)));
    const gathered = Object.entries(s.gathered ?? {}).filter(([, n]) => n > 0);
    if (gathered.length) p.body.append(row('GATHERED', gathered.map(([k, n]) => `${n} ${k}`).join(' · '), null, { wrap: true }));
    if (s.ratings.up + s.ratings.down) p.body.append(row('YOUR RATINGS', `${s.ratings.up} 👍 · ${s.ratings.down} 👎 waiting for the next run`, null, { wrap: true }));
    const r = s.report;
    if (r) {
      p.body.append(h('div.lab.trainweek', `WEEK ${r.week}${r.finishedAt ? ` · ${when(r.finishedAt)}` : ''}`));
      if (Object.keys(r.before ?? {}).length) p.body.append(scores(r, s.previous));
      p.body.append(details(r));
    } else if (keysOk) p.body.append(h('div.note', 'No training run yet. The first one starts on its own, or press TRAIN NOW.'));
    // Honest: until a run has come back, none of this has worked for real.
    if (!r || (!r.published && !Object.keys(r.after ?? {}).length)) p.body.append(h('div.note.small.untried', 'Not tried for real yet: no week has finished on Kaggle. The first run may stop with a problem; if it does, it says so here.'));
    // the last good brains
    const recommended = s.models.find((m) => m.commit === s.active);
    p.body.append(h('div.lab', 'BRAINS KEPT'));
    for (const m of s.models) {
      const rr = row(m.label, `${pct(examMean(m.scores))} in its test · ${m.commit.slice(0, 7)}`, m.commit === s.active ? 'RECOMMENDED' : null, { tone: m.commit === s.active ? 'up' : undefined, wrap: true });
      rr.dataset.model = m.commit;
      p.body.append(rr);
    }
    p.body.append(row('STOCK', 'Qwen3 0.6B as it came (always there to go back to)', s.active === null ? 'RECOMMENDED' : null, { tone: s.active === null ? 'up' : undefined, wrap: true }));
    const onPhone = currentModel().label;
    p.body.append(h('div.note.phoneuses', `Recommended: ${recommended?.label ?? 'the stock Qwen3 0.6B'}. This phone is set to: ${onPhone}. A new brain is only downloaded when you press DOWNLOAD in SETTINGS → OFFLINE BRAIN.`));
    const now = act('TRAIN NOW', () => brain.selftrain.now(), () => "Training started: gathering this week's lessons first", 'on');
    now.disabled = !keysOk || s.phase !== 'idle';
    const back = act('ROLLBACK', () => brain.selftrain.rollback(), (x) => `The newest brain is gone; back to ${x.models.find((m) => m.commit === x.active)?.label ?? 'the stock Qwen3'}`, 'warn');
    back.disabled = s.active === null;
    const priv = act(`MY LIBRARY & CHATS: ${s.privateData ? 'ON' : 'OFF'}`, () => brain.selftrain.privateData(!s.privateData), (x) => (x.privateData ? 'Training learns from your library, chats and ratings (kept private)' : 'Training uses only puzzles, quizzes and general examples'));
    p.body.append(h('div.keyrow', now, back, priv));
    p.body.append(
      h(
        'div.note.small.privacy',
        s.privateData
          ? 'Kept private: the lessons and the trained brain sit in two private spaces on your Hugging Face account; only Ghosty can open them, and your phone gets the brain through Ghosty. With MY LIBRARY & CHATS on, the brain learns from your library, your chats and the replies you rated.'
          : 'MY LIBRARY & CHATS is off: new weeks learn only from puzzles, quizzes and general examples, earlier weeks that held your text are left out, and training starts from the newest brain that never saw it (or the stock one).',
      ),
    );
    const note = setTrainedModels(s.models, s.active, s.weights);
    if (note) toast(note, 'warn');
  }

  async function refresh(): Promise<void> {
    try {
      st = await brain.selftrain.status();
    } catch {
      st = null;
    }
    paint();
    // The GYM levels on this phone, for the week's puzzles (quietly; an old brain without the route is fine).
    try {
      const levels: Record<string, number> = {};
      for (const [id, rec] of await loadAll()) levels[id] = rec.level;
      if (Object.keys(levels).length) await brain.selftrain.gym(levels);
    } catch {
      /* not reachable: next time */
    }
  }

  return Object.assign(p, { refresh: () => void refresh() });
}
