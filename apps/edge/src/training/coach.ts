/**
 * The training ground's brain side. The interface runs each trial (it executes the code in a
 * locked sandbox — Workers can't run generated code); the brain hands out exercises, asks the
 * model for a solution (showing it every failed test from earlier attempts), and records the
 * outcome. A solved exercise becomes a note in the library; one that needed several attempts
 * also becomes a lesson, so the same mistake isn't made again.
 */
import { addLesson } from '../knowledge';
import type { Library } from '../library/store';
import type { Msg, Router } from '../llm/router';
import { textOf } from '../llm/content';
import { EXERCISES, type Exercise } from './exercises';

export interface TrainingRecord {
  solved: boolean;
  attempts: number;
  at: number;
  model?: string;
  /** Attempts needed the first time it was solved. */
  firstSolve?: number;
}

const KEY = 'training';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const publicView = (e: Exercise) => ({ id: e.id, title: e.title, level: e.level, topic: e.topic, prompt: e.prompt, entry: e.entry, tests: e.tests });

/** The model's reply → just the code. */
export function extractCode(reply: string): string {
  const blocks = [...reply.matchAll(/```(?:js|javascript|ts|typescript|mjs)?[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]!);
  const code = blocks.length ? blocks.sort((a, b) => b.length - a.length)[0]! : reply;
  return code.trim();
}

export async function trainingRoute(req: Request, path: string, method: string, deps: { storage: DurableObjectStorage; router: Router; library: Library }): Promise<Response> {
  const records = (await deps.storage.get<Record<string, TrainingRecord>>(KEY)) ?? {};
  if (path === '/train' && method === 'GET') {
    return json({ exercises: EXERCISES.map((e) => ({ id: e.id, title: e.title, level: e.level, topic: e.topic })), records });
  }
  const ex = path.match(/^\/train\/exercise\/([\w-]+)$/);
  if (ex && method === 'GET') {
    const e = EXERCISES.find((x) => x.id === ex[1]);
    return e ? json(publicView(e)) : json({ error: 'no such exercise' }, 404);
  }
  if (path === '/train/attempt' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { id?: string; history?: { code: string; report: string }[] };
    const e = EXERCISES.find((x) => x.id === b.id);
    if (!e) return json({ error: 'no such exercise' }, 404);
    const history = (Array.isArray(b.history) ? b.history : []).slice(-2);
    const msgs: Msg[] = [
      {
        role: 'system',
        content: `You are Ghosty in the training ground: you write a solution, hidden tests run it, and you must fix every failure until all tests pass. Write correct, efficient modern JavaScript (no imports, no I/O, no globals besides what you define). Define \`${e.entry}\` exactly as specified. Before writing, think through the edge cases the task states (empty input, ties, rounding, ordering, invalid input). Solve the task in general — never special-case the inputs of failed tests. Reply with ONE \`\`\`js code block and nothing else.`,
      },
      { role: 'user', content: e.prompt },
    ];
    for (const h of history) {
      msgs.push({ role: 'assistant', content: `\`\`\`js\n${h.code.slice(0, 6000)}\n\`\`\`` });
      msgs.push({ role: 'user', content: `That failed the hidden tests:\n${h.report.slice(0, 2500)}\nFind the root cause (re-read the task's exact rules), fix it, and reply with the complete corrected code block.` });
    }
    try {
      // The owner pressed SOLVE and is watching: the chat lane, the best coder.
      const { message, model } = await deps.router.complete(msgs, [], undefined, { code: true, priority: 'chat' });
      return json({ code: extractCode(textOf(message.content)), model });
    } catch (err) {
      return json({ error: String((err as Error)?.message ?? err) }, 503);
    }
  }
  if (path === '/train/result' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { id?: string; solved?: boolean; attempts?: number; code?: string; model?: string; firstReport?: string };
    const e = EXERCISES.find((x) => x.id === b.id);
    if (!e) return json({ error: 'no such exercise' }, 404);
    const attempts = Math.max(1, Math.min(50, Number(b.attempts) || 1));
    const prev = records[e.id];
    records[e.id] = { solved: !!b.solved || !!prev?.solved, attempts: (prev?.attempts ?? 0) + attempts, at: Date.now(), model: b.model, firstSolve: prev?.firstSolve ?? (b.solved ? attempts : undefined) };
    await deps.storage.put(KEY, records);
    if (b.solved && typeof b.code === 'string' && deps.library.available) {
      await deps.library.note('notes_training', "Ghosty's training solutions", 'notes', {
        heading: `${e.title} (${e.topic})`,
        text: `Task: ${e.prompt.slice(0, 700)}\n\nVerified solution (passed all ${e.tests.length} hidden tests${attempts > 1 ? ` after ${attempts} attempts` : ' first time'}):\n${b.code.slice(0, 3000)}`,
      });
    }
    let lesson = '';
    if (b.solved && attempts > 1 && b.firstReport) {
      // One short, cheap call: what went wrong at first, as a rule for next time.
      try {
        const { message } = await deps.router.complete(
          [
            { role: 'system', content: 'Write ONE sentence (max 40 words): the cause of the first failure, then "Rule: …" — a general coding rule that prevents it. No preamble.' },
            { role: 'user', content: `Task "${e.title}": ${e.prompt.slice(0, 900)}\nFirst attempt failed:\n${b.firstReport.slice(0, 1200)}\nThe final, passing code:\n${String(b.code ?? '').slice(0, 1500)}` },
          ],
          [],
          undefined,
          { tier: 'small', priority: 'background', maxWaitMs: 0 },
        );
        lesson =textOf(message.content).trim().replace(/\s+/g, ' ').slice(0, 280);
        if (lesson.length > 20) await addLesson(deps.storage, lesson, ['training', e.topic]);
      } catch {
        /* the lesson is a bonus */
      }
    }
    return json({ record: records[e.id], lesson });
  }
  return json({ error: 'not found' }, 404);
}
