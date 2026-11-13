/**
 * SCHOOL's stand-in for the stronger model, used ONLY when the brain runs with the scripted test model
 * (env MOCK_LLM = "1": the preview server and the browser specs; llm/mock.ts is the chat's). It answers the bank
 * writer, the two checkers and the official paper's readers in their formats, from what it is shown, so the
 * WRITE THE PAPERS and FETCH flows can be driven end to end without a real model. Never used for real.
 */
import { CHECK_EXACT_SYSTEM, CHECK_SCHEME_SYSTEM, WRITER_SYSTEM } from './banks';
import type { Ask } from './mark';
import type { Sit } from './online';
import { READ_MARKS_SYSTEM, READ_QUESTIONS_SYSTEM, READ_TEXTS_SYSTEM } from './official';

let made = 0;

export const schoolMock: Ask = async (system, user) => {
  if (system === WRITER_SYSTEM) {
    const n = Number(user.match(/Write (\d+) NEW questions/)?.[1] ?? 4);
    const [min, max] = (user.match(/carries (\d+) to (\d+) marks/)?.slice(1) ?? ['1', '4']).map(Number) as [number, number];
    const topics = (user.match(/topic name exactly as written for "topic"\): ([^\n]+)\./)?.[1] ?? 'general').split('; ');
    return JSON.stringify(
      Array.from({ length: n }, (_, i) => {
        const k = ++made;
        const topic = topics[i % topics.length]!;
        const marks = Math.min(max, Math.max(min, 1 + (k % 3)));
        if (k % 5 === 0) return { topic, type: 'short', marks, q: `Explain one idea from ${topic} (mock question ${k}).`, answer: `One idea from ${topic}, explained.`, rubric: `${marks} marks: one idea (1), explained (1), with an example (1).` };
        const a = 3 + (k % 9);
        const b = 2 + (k % 7);
        return { topic, type: 'number', marks, q: `What is ${a} × ${b} + ${k}? (mock question ${k})`, answer: String(a * b + k) };
      }),
    );
  }
  if (system === CHECK_EXACT_SYSTEM) {
    return user
      .split(/\n\n/)
      .map((block, i) => {
        const m = block.match(/What is (\d+) × (\d+) \+ (\d+)\?/);
        const n = block.match(/(?:^|\n)\s*\d+\.\s*(?:What is )?(-?\d+(?:\.\d+)?)\s*([+×−-])\s*(-?\d+(?:\.\d+)?)/);
        const v = m ? Number(m[1]) * Number(m[2]) + Number(m[3]) : n ? (n[2] === '+' ? Number(n[1]) + Number(n[3]) : n[2] === '×' ? Number(n[1]) * Number(n[3]) : Number(n[1]) - Number(n[3])) : null;
        return `${i + 1}: ${v ?? 'not sure'}`;
      })
      .join('\n');
  }
  if (system === CHECK_SCHEME_SYSTEM) return user.split(/\n\n/).map((_, i) => `${i + 1}: SOUND`).join('\n');
  if (system === READ_TEXTS_SYSTEM) {
    const lines = user.split('\n');
    const out: string[] = [];
    lines.forEach((l, i) => {
      const t = l.match(/^Title: (.+)$/);
      if (t) out.push(`${t[1]} | ${(lines[i + 1] ?? '').split(/\s+/).slice(0, 8).join(' ')}`);
    });
    return out.join('\n');
  }
  if (system === READ_QUESTIONS_SYSTEM) {
    const qs = [...user.matchAll(/^(\d+)\s+(.+?)\s+\[(\d+) marks?\]\s*$/gm)].map((m) => ({
      n: m[1],
      q: m[2],
      marks: Number(m[3]),
      type: /\b(explain|describe|why)\b/i.test(m[2]!) ? 'short' : 'number',
      ...(/\bdiagram\b/i.test(m[2]!) ? { picture: true } : {}),
      ...(/\(text: ([^)]+)\)/.test(m[2]!) ? { text: m[2]!.match(/\(text: ([^)]+)\)/)![1] } : {}),
    }));
    return JSON.stringify(qs);
  }
  if (system === READ_MARKS_SYSTEM) {
    return JSON.stringify([...user.matchAll(/^(\d+)\s+Answer:\s*(.+?)\s*$/gm)].map((m) => ({ n: m[1], answer: m[2], rubric: `Award the marks for: ${m[2]}` })));
  }
  return '';
};

/**
 * SCHOOL's stand-in for the brain's own model sitting a question online (school/online.ts), ONLY with the scripted test
 * model: it writes its working out in full, then the answer line, as the real one is asked to. Never used for real.
 */
export const schoolMockSit: Sit = async (_system, _user, item) => {
  // (every other question it gets wrong, on purpose: the paper is marked for real, some marks and some none, and the shared
  // test record never reaches top grades, so no spec after it finds a stage or a reading level passed by the stand-in)
  const wrong = (Number(item.id.replace(/\D/g, '')) || 0) % 2 === 0;
  const right = item.type === 'mcq' ? (item.answer ?? 'a').toUpperCase() : item.type === 'extended' ? 'done' : item.answer ?? '';
  const answer = !wrong ? right : item.type === 'mcq' ? ('abcdefgh'.split('').find((l) => l !== (item.answer ?? 'a').toLowerCase()) ?? 'b').toUpperCase() : item.type === 'number' ? '987654321' : item.type === 'extended' ? 'done' : 'not sure';
  const working = [
    `Working: I read the question carefully (${item.marks} mark${item.marks === 1 ? '' : 's'}).`,
    item.type === 'mcq' ? `Step 1: I check each choice against what the question asks.\nStep 2: I pick the one that fits best.` : `Step 1: I set out what is known.\nStep 2: I work it through to ${answer}.`,
    item.type === 'extended' ? (wrong ? 'A short piece that misses the point.' : `${item.answer ?? 'My piece of writing, written out in full.'}`) : '',
    `Answer: ${answer}`,
  ].filter(Boolean);
  return { text: working.join('\n'), model: 'Stand-in · test model' };
};
