/**
 * SCHOOL's stand-in for the stronger model, used ONLY when the brain runs with the scripted test model
 * (env MOCK_LLM = "1": the preview server and the browser specs; llm/mock.ts is the chat's). It answers the bank
 * writer, the two checkers and the official paper's readers in their formats, from what it is shown, so the
 * WRITE THE PAPERS and FETCH flows can be driven end to end without a real model. Never used for real.
 */
import { CHECK_EXACT_SYSTEM, CHECK_SCHEME_SYSTEM, WRITER_SYSTEM } from './banks';
import type { Ask } from './mark';
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
