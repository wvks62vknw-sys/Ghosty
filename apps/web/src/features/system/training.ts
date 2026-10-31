/**
 * SYSTEM → OFFLINE BRAIN TRAINING: the honest report card of the offline brain's weekly self-training
 * (apps/edge/src/selftrain on the brain, the notebook on Kaggle's free GPUs). What is happening now; this
 * week's exam score against last week's, area by area; what he trained on; how long it took; what was thrown
 * away and why; the last good models; TRAIN NOW, TRAIN FROM SCRATCH and ROLLBACK; which kind the next run is (weekly, or
 * the monthly retrain from the stock model on every week kept) and why; GPU HOURS: Kaggle's free hours left, when they
 * come back, what the next run needs and whether it will be a full run, a smaller one or a wait (the brain's words);
 * what ran on which of Kaggle's two cards, and in how many sessions; THE DAILY GPU: asked once (ALLOW, after a confirm
 * that says exactly what is made on his Hugging Face account and that nothing can cost money; NO THANKS), then its line
 * (what it added this week) and TURN OFF. With a key missing it says which, and where to get it, in plain steps. Opening it also tells the brain the GYM levels on this phone (the week's puzzles are
 * made at and just beyond them) and gives the offline brain the list of trained models to choose from.
 */
import { AREA_LABEL, baseById, EXAM_AREAS, examMean, stopWords, type ExamArea, type TrainReport, type TrainStatus } from '../../../../../packages/shared/src/selftrain';
import { brain } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { currentModel, setTrainedModels } from '../../offline/brain';
import { flushStars } from '../../offline/starbox';
import { button, confirmSheet, panel, row, toast, type Panel } from '../../ui/components';
import { loadAll } from '../gym/store';

const KIND: Record<string, string> = {
  star: 'puzzles he solved himself (each answer checked)',
  checked: 'answers THINK HARDER and the GYM worked out on your phone (each passed an exact check)',
  daily: 'practice answers from the daily GPU on Hugging Face (each passed the checker)',
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
const STEP: Record<string, string> = { setup: 'getting ready', exam_before: 'test of the current brain', star: 'practising puzzles', school: 'school practice', critique: 'fixing mistakes', judge: 'checking library answers', sft_known: 'learning (first part)', sft: 'learning', dpo: 'learning what is better', exam_after: 'test of the new brain', publish: 'saving the new brain' };

const PHASE: Record<TrainStatus['phase'], string> = { idle: 'IDLE', collect: 'GATHERING', upload: 'UPLOADING', push: 'STARTING', running: 'TRAINING', failed: 'STOPPED' };

const pct = (x: number | undefined) => (typeof x === 'number' ? `${Math.round(x * 100)}%` : '—');
const minutes = (m: number) => (m >= 90 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);
const when = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** The panel; `refresh()` reloads it from the brain. */
export function trainingPanel(): Panel & { refresh(): void } {
  const p = panel('OFFLINE BRAIN TRAINING', { grow: false, cls: 'selftrain' });
  let st: TrainStatus | null = null;
  let busy = false;

  /** `ask`: what cannot be undone, said first in a one-tap confirm ([title, words]). */
  const act = (label: string, fn: () => Promise<TrainStatus>, done: (s: TrainStatus) => string, cls = '', ask?: [string, string]) =>
    button(label, async (b) => {
      if (busy) return;
      if (ask && !(await confirmSheet(ask[0], ask[1], label))) return;
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
      // Kaggle's two cards: practice on the second beside the learning on the first, and what that saved
      const c = r.cards;
      const both = c && c.count >= 2;
      const where = [both ? `Two GPUs: practice and tests on the second while he learned on the first${c.saved_minutes ? `, ${minutes(c.saved_minutes)} saved` : ''}.` : c?.count === 1 ? 'One GPU: each part in turn.' : '', (r.sessions ?? 1) > 1 ? `Done in ${r.sessions} sessions: each saved its place and the next carried on.` : '', r.plan?.mode === 'economy' ? r.plan.why : ''].filter(Boolean);
      if (where.length) box.append(h('div.note.small.traincards', where.join(' ')));
    }
    if (r.rejected?.length) {
      box.append(h('div.lab', 'LEFT OUT, AND WHY'));
      for (const x of r.rejected.slice(0, 12)) box.append(row(null, x.why, fmt.n(x.n), { wrap: true }));
    }
    // in his words: the install step's own sentence names the pin; never the raw error (SMALL-GAPS A)
    if (r.error) box.append(h('div.note.bad', `${r.install ? 'The run stopped before training. ' : 'The run stopped: '}${stopWords(r)}.`));
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
    if (keysOk && s.phase === 'idle' && s.next) p.body.append(row('NEXT RUN', `${when(s.next)}${s.kind ? ` · ${s.kind.scratch ? 'retrain from scratch' : 'weekly'}` : ''}`, null, { wrap: true }));
    // Kaggle's free hours: left, back when, what the next run needs and which mode (the brain's words)
    if (keysOk && s.gpu) {
      const g = row('GPU HOURS', s.gpu.line, s.gpu.mode === 'full' ? 'FULL RUN' : s.gpu.mode === 'economy' ? 'SMALLER RUN' : 'WAITING', { tone: s.gpu.mode === 'full' ? 'up' : s.gpu.mode === 'wait' ? 'dn' : undefined, wrap: true });
      g.dataset.mode = s.gpu.mode;
      g.classList.add('trainquota');
      p.body.append(g);
    }
    if (keysOk && s.plan?.mode === 'economy') p.body.append(h('div.note.small.traineconomy', `This run: ${s.plan.why} Fewer earlier weeks are replayed and fewer practice answers tried; the test is the same.`));
    // Weekly (adds the week to the brain in use) or the monthly retrain from scratch, and why: the brain decides as a run starts.
    if (keysOk && s.kind?.why) {
      const k = row(s.kind.now ? 'THIS RUN' : 'NEXT KIND', s.kind.scratch ? `Retrain from scratch: the stock ${baseById(s.base).label}, every week kept` : 'Weekly: adds this week to the brain in use', null, { wrap: true });
      k.dataset.kind = s.kind.scratch ? 'scratch' : 'weekly';
      p.body.append(k, h('div.note.small.trainkind', `${s.kind.why} Either way the new brain must pass the same test, and ROLLBACK works the same.`));
    }
    const gathered = Object.entries(s.gathered ?? {}).filter(([, n]) => n > 0);
    if (gathered.length) p.body.append(row('GATHERED', gathered.map(([k, n]) => `${n} ${k}`).join(' · '), null, { wrap: true }));
    if (s.ratings.up + s.ratings.down) p.body.append(row('YOUR RATINGS', `${s.ratings.up} 👍 · ${s.ratings.down} 👎 waiting for the next run`, null, { wrap: true }));
    const r = s.report;
    if (r) {
      p.body.append(h('div.lab.trainweek', `WEEK ${r.week}${r.scratch ? ' · RETRAINED FROM SCRATCH' : ''}${r.finishedAt ? ` · ${when(r.finishedAt)}` : ''}`));
      if (Object.keys(r.before ?? {}).length) p.body.append(scores(r, s.previous));
      p.body.append(details(r));
    } else if (keysOk) p.body.append(h('div.note', 'No training run yet. The first one starts on its own, or press TRAIN NOW.'));
    // Honest: until a run has come back, none of this has worked for real.
    if (!r || (!r.published && !Object.keys(r.after ?? {}).length)) p.body.append(h('div.note.small.untried', 'Not tried for real yet: no week has finished on Kaggle. The first run may stop with a problem; if it does, it says so here.'));
    // the last good brains (of every base: after a switch the old chain stays, for ROLLBACK)
    const base = baseById(s.base);
    const several = s.models.some((m) => baseById(m.base).id !== base.id);
    const recommended = s.models.find((m) => m.commit === s.active);
    if (s.switchedFrom && s.switchedFrom !== base.id) {
      // A base switch (SETTINGS → OFFLINE BRAIN): the training starts again from the new base, and says so.
      p.body.append(h('div.note.trainbase', `Training now follows ${base.label}, the brain chosen in SETTINGS → OFFLINE BRAIN: a fresh start from the stock ${base.label}, tested against that same brain. Your ${baseById(s.switchedFrom).label} brains are kept: ROLLBACK goes back to them.`));
    } else if (base.id !== 'qwen3-0.6b') p.body.append(h('div.note.trainbase', `Training follows ${base.label}, the brain chosen in SETTINGS → OFFLINE BRAIN.`));
    p.body.append(h('div.lab', 'BRAINS KEPT'));
    for (const m of s.models) {
      const rr = row(m.label, `${pct(examMean(m.scores))} in its test · ${m.commit.slice(0, 7)}${several ? ` · ${baseById(m.base).label}` : ''}`, m.commit === s.active ? 'RECOMMENDED' : null, { tone: m.commit === s.active ? 'up' : undefined, wrap: true });
      rr.dataset.model = m.commit;
      p.body.append(rr);
    }
    p.body.append(row('STOCK', `${base.label} as it came (always there to go back to)`, s.active === null ? 'RECOMMENDED' : null, { tone: s.active === null ? 'up' : undefined, wrap: true }));
    const onPhone = currentModel().label;
    p.body.append(h('div.note.phoneuses', `Recommended: ${recommended?.label ?? `the stock ${base.label}`}. This phone is set to: ${onPhone}. A new brain is only downloaded when you press DOWNLOAD in SETTINGS → OFFLINE BRAIN.`));
    const now = act('TRAIN NOW', () => brain.selftrain.now(), () => "Training started: gathering this week's lessons first", 'on');
    now.disabled = !keysOk || s.phase !== 'idle';
    // the monthly retrain whenever he wants it (with a run under way: the next run is one)
    const scratch = act('TRAIN FROM SCRATCH', () => brain.selftrain.scratch(), (x) => (x.phase === 'idle' ? 'Retraining from scratch: it starts in a moment' : 'This run carries on; the next one retrains from scratch'));
    scratch.disabled = !keysOk;
    // ROLLBACK drops the brain in use for good: a one-tap confirm says so first. Back from a new base's stock build to
    // the old chain drops nothing (choosing the base again in SETTINGS → OFFLINE BRAIN undoes it): no question.
    const dropping = s.active !== null;
    const back = act('ROLLBACK', () => brain.selftrain.rollback(), (x) => (x.base !== s.base ? `Back to your ${baseById(x.base).label} brains: ${x.models.find((m) => m.commit === x.active)?.label ?? `the stock ${baseById(x.base).label}`}` : `The newest brain is gone; back to ${x.models.find((m) => m.commit === x.active)?.label ?? `the stock ${baseById(x.base).label}`}`), 'warn', dropping ? ['Roll back the offline brain?', `${recommended?.label ?? 'The recommended brain'} is dropped for good (never offered again); the one before it, or the stock ${base.label}, takes its place. A new week can train a better one.`] : undefined);
    back.disabled = s.active === null && !(s.switchedFrom && s.switchedFrom !== base.id);
    // THE DAILY GPU: a second, small pool of free GPU minutes on his own Hugging Face account (asked once)
    const pool = s.pool;
    let poolBox: HTMLElement | null = null;
    if (keysOk && pool) {
      const box = h('div.trainpool');
      box.append(h('div.lab', 'THE DAILY GPU (HUGGING FACE)'));
      if (pool.offer) {
        box.append(h('div.note', 'Hugging Face lends a free account about 5 minutes of a big GPU every day. Ghosty can use them to practise puzzles for next week\'s training, on top of Kaggle. It needs a small Space on your Hugging Face account.'));
        const yes = act('ALLOW', () => brain.selftrain.pool(true), () => 'Setting up the daily GPU', 'on', [
          'Make a Space on your Hugging Face account?',
          'Ghosty makes one Space called ghosty-daily-gpu on your Hugging Face account (private if Hugging Face allows it; if not, it holds none of your data and only Ghosty can use it), puts its code and two secrets in it (your Hugging Face token, so it can read your private training data, and a key), and uses about 5 free GPU minutes a day. Nothing can cost money: a free account cannot buy GPU time, and Ghosty stops if your account is PRO or has a card on it.',
        ]);
        const no = act('NO THANKS', () => brain.selftrain.pool(false), () => 'The daily GPU is not used');
        box.append(h('div.keyrow', yes, no));
      } else {
        const r = row(pool.phase === 'ready' ? 'IN USE' : pool.phase === 'setup' ? 'SETTING UP' : pool.phase === 'failed' ? 'STOPPED' : 'OFF', pool.note, pool.week ? `${fmt.n(pool.week)} THIS WEEK` : null, { wrap: true, tone: pool.phase === 'failed' ? 'dn' : undefined });
        r.dataset.pool = pool.phase;
        box.append(r);
        if (pool.week) box.append(h('div.note.small.poolweek', `${fmt.n(pool.week)} checked samples this week from the daily GPU${pool.waiting ? ` (${fmt.n(pool.waiting)} waiting for the next run)` : ''}.`));
        if (pool.phase === 'ready' || pool.phase === 'setup') box.append(h('div.keyrow', act('TURN OFF', () => brain.selftrain.pool(false), () => 'The daily GPU is off')));
        else box.append(h('div.keyrow', act('ALLOW', () => brain.selftrain.pool(true), () => 'Setting up the daily GPU', 'on')));
      }
      poolBox = box;
    }
    const priv = act(`MY LIBRARY & CHATS: ${s.privateData ? 'ON' : 'OFF'}`, () => brain.selftrain.privateData(!s.privateData), (x) => (x.privateData ? 'Training learns from your library, chats and ratings (kept private)' : 'Training uses only puzzles, quizzes and general examples'));
    p.body.append(h('div.keyrow', now, scratch, back, priv));
    p.body.append(
      h(
        'div.note.small.privacy',
        s.privateData
          ? 'Kept private: the lessons and the trained brain sit in two private spaces on your Hugging Face account; only Ghosty can open them, and your phone gets the brain through Ghosty. With MY LIBRARY & CHATS on, the brain learns from your library, your chats and the replies you rated.'
          : 'MY LIBRARY & CHATS is off: new weeks learn only from puzzles, quizzes and general examples, earlier weeks that held your text are left out, and training starts from the newest brain that never saw it (or the stock one).',
      ),
    );
    if (poolBox) p.body.append(poolBox);
    const note = setTrainedModels(s.models, s.active, s.weights, s.base);
    if (note) toast(note, 'warn');
  }

  async function refresh(): Promise<void> {
    try {
      st = await brain.selftrain.status();
    } catch {
      st = null;
    }
    paint();
    // Checked work waiting on this phone goes to the brain for next week's run (quietly; it waits otherwise).
    void flushStars();
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
