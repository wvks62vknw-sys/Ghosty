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
import { setTrainedModels } from '../../offline/brain';
import { button, panel, row, toast, type Panel } from '../../ui/components';
import { loadAll } from '../gym/store';

const KIND: Record<string, string> = {
  star: 'GYM puzzles and drills he solved himself (checked)',
  critique: 'puzzles fixed after the checker said why',
  judged: 'library answers he judged better (agreeing with the passage)',
  evol: 'harder tasks written by the online models',
  library: 'questions on your library',
  tool: 'tool calls',
  pref: 'your 👍 / 👎',
  dpo: 'better-vs-worse answer pairs',
  failure: "last week's mistakes again",
  redteam: 'requests to turn down',
  distill: 'online answers to your own questions',
  replay: 'earlier weeks (so nothing is forgotten)',
  general: 'general chat examples (OpenAssistant)',
  gym: 'GYM puzzles set',
  drill: 'drills set',
};

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
    const need = [!s.keys.kaggle ? 'Kaggle' : '', !s.keys.hf ? 'Hugging Face write token' : ''].filter(Boolean);
    out.append(
      h('div.note', `Ghosty can train the small brain on your phone by itself, every week, for free. It needs ${need.length === 2 ? 'two keys' : 'one more key'}:`),
      h(
        'ol.steps',
        ...(!s.keys.kaggle ? [h('li', 'Kaggle (free GPUs): in KEYS above press SHOW OPTIONAL KEYS, find "Kaggle (free GPUs for training)", press HOW TO GET IT and follow the steps. You make it at kaggle.com → Settings → API → Create New Token (confirm your phone number there first).')] : []),
        ...(!s.keys.hf ? [h('li', 'Hugging Face write token: in KEYS, find "Hugging Face write token (training)", press HOW TO GET IT. You make it at huggingface.co → Settings → Access Tokens → Create new token → Write.')] : []),
        h('li', 'That is all: Ghosty gathers the week\'s lessons, trains on Kaggle, and only keeps a new brain that beats the old one on its exam.'),
      ),
    );
    return out;
  };

  const scores = (r: TrainReport, prev: TrainReport | null) => {
    const box = h('div.trainscores');
    box.append(h('div.lab', 'EXAM: BEFORE → AFTER (LAST WEEK)'));
    for (const a of EXAM_AREAS as readonly ExamArea[]) {
      if (typeof r.before[a] !== 'number' && typeof r.after[a] !== 'number') continue;
      const up = (r.after[a] ?? 0) - (r.before[a] ?? 0);
      const last = prev?.after?.[a];
      const items = r.items?.[a];
      const rr = row(AREA_LABEL[a], `${pct(r.before[a])} → ${pct(r.after[a])}${typeof last === 'number' ? ` (last week ${pct(last)})` : ''}${items ? ` · ${items} questions` : ''}`, up > 0.0005 ? `+${Math.round(up * 100)}` : up < -0.0005 ? `${Math.round(up * 100)}` : '±0', { tone: up > 0.0005 ? 'up' : up < -0.0005 ? 'dn' : undefined, wrap: true });
      rr.dataset.area = a;
      box.append(rr);
    }
    box.append(row('AVERAGE', `${pct(examMean(r.before))} → ${pct(examMean(r.after))}`, r.gate.pass ? 'KEPT' : 'NOT KEPT', { tone: r.gate.pass ? 'up' : 'dn' }));
    box.append(h(`div.note.gate${r.gate.pass ? '.good' : '.bad'}` as 'div', r.gate.pass ? `Kept: ${r.gate.why}.` : `Not kept: ${r.gate.why}. The brain on your phone stays as it was.`));
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
      box.append(h('div.note', r.phases.map((x) => (x.skipped ? `${x.name} skipped (${x.skipped})` : `${x.name} ${minutes(x.minutes)}`)).join(' · ')));
    }
    if (r.rejected?.length) {
      box.append(h('div.lab', 'THROWN AWAY, AND WHY'));
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
    // the last good brains
    const activeLabel = s.models.find((m) => m.commit === s.active)?.label ?? 'the stock Qwen3 0.6B';
    p.body.append(h('div.lab', 'BRAINS KEPT'));
    for (const m of s.models) {
      const rr = row(m.label, `${pct(examMean(m.scores))} on its exam · ${m.commit.slice(0, 7)}`, m.commit === s.active ? 'IN USE' : null, { tone: m.commit === s.active ? 'up' : undefined, wrap: true });
      rr.dataset.model = m.commit;
      p.body.append(rr);
    }
    p.body.append(row('STOCK', 'Qwen3 0.6B as it came (always kept as the fallback)', s.active === null ? 'IN USE' : null, { tone: s.active === null ? 'up' : undefined, wrap: true }));
    p.body.append(h('div.note', `The phone uses: ${activeLabel}. A new brain is downloaded only when you choose it in SETTINGS → OFFLINE BRAIN.`));
    const now = act('TRAIN NOW', () => brain.selftrain.now(), () => 'Training started: gathering this week\'s lessons first', 'on');
    now.disabled = !keysOk || s.phase !== 'idle';
    const back = act('ROLLBACK', () => brain.selftrain.rollback(), (x) => `Back to ${x.models.find((m) => m.commit === x.active)?.label ?? 'the stock Qwen3'}`, 'warn');
    back.disabled = s.active === null;
    const priv = act(`MY LIBRARY & CHATS: ${s.privateData ? 'ON' : 'OFF'}`, () => brain.selftrain.privateData(!s.privateData), (x) => (x.privateData ? 'Training learns from your library, chats and ratings' : 'Training uses only puzzles, drills and general data'));
    p.body.append(h('div.keyrow', now, back, priv));
    p.body.append(h('div.note.small', 'The trained brain is stored on your Hugging Face account where anyone with its link could download it, and it learned from your library and the replies you rated. Turn MY LIBRARY & CHATS off to train only on puzzles, drills and general data.'));
    setTrainedModels(s.models, s.active);
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
