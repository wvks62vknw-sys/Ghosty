// The node side of tasks.mjs (bundled by build.mjs with the GYM's games and the brain's drills): the
// notebook writes one JSON request per line on stdin and reads one JSON answer per line on stdout.
//   {"id": 1, "op": "make",  "task": {"game": "maze", "level": 3, "seed": 42}}          → {"id": 1, "prompt": "…"}
//   {"id": 2, "op": "check", "task": {"drill": 4, "seed": 7}, "answer": "…"}            → {"id": 2, "correct": true, "score": 1, "why": "…"}
//   {"id": 3, "op": "games"}                                                           → {"id": 3, "games": [...], "drills": 40}
//   {"id": 4, "op": "reportcard"}                                                      → {"id": 4, "texts": [...]}  (the phone's REPORT CARD
//      questions, word for word: never trained on, so it measures the model's own skill — gym/bench.ts reportCardTexts)
// A bad line gets {"id", "error"}; the process never stops on one.
import { ANSWER_HINT, checkTask, makeTask, TASK_GAMES } from '../../apps/web/src/gym/tasks.ts';
import { grade, makeDrill, SKILLS } from '../../apps/edge/src/library/drills.ts';
import { reportCardTexts } from '../../apps/web/src/gym/bench.ts';

export function handle(req) {
  const id = req?.id ?? null;
  try {
    if (req.op === 'games') return { id, games: TASK_GAMES(), drills: SKILLS.length };
    if (req.op === 'reportcard') return { id, texts: reportCardTexts() };
    const t = req.task ?? {};
    if (typeof t.game === 'string') {
      if (req.op === 'make') return { id, prompt: makeTask(t.game, t.level, t.seed).prompt };
      if (req.op === 'check') return { id, ...checkTask(t.game, t.level, t.seed, String(req.answer ?? '')) };
    } else if (Number.isInteger(t.drill)) {
      const d = makeDrill(t.drill, t.seed);
      if (req.op === 'make') return { id, prompt: `${d.q}\n\n${ANSWER_HINT}`, skill: d.skill };
      if (req.op === 'check') {
        const ok = grade(d, String(req.answer ?? ''));
        return { id, correct: ok, score: ok ? 1 : 0, why: ok ? 'right' : `The answer is ${d.answer}.` };
      }
    }
    return { id, error: 'unknown request' };
  } catch (e) {
    return { id, error: String(e?.message ?? e).slice(0, 200) };
  }
}

// Run as a program (node tasks.mjs): answer stdin line by line.
const proc = globalThis.process;
if (proc?.argv?.[1] && /tasks\.mjs$/.test(proc.argv[1])) {
  let buf = '';
  proc.stdin.setEncoding('utf8');
  proc.stdin.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let out;
      try {
        out = handle(JSON.parse(line));
      } catch {
        out = { id: null, error: 'not JSON' };
      }
      proc.stdout.write(`${JSON.stringify(out)}\n`);
    }
  });
}
