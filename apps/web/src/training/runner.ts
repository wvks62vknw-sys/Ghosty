/**
 * Runs code Ghosty wrote against an exercise's tests, in public/runner.html: a sandboxed
 * frame with no network access, where each run gets a fresh Web Worker that is killed after
 * a time limit.
 */
import { h } from '../core/dom';

export interface TestResult {
  ok: boolean;
  got?: string;
  error?: string;
}
export type RunResult = { results: TestResult[] } | { error: string };

let frame: HTMLIFrameElement | null = null;
let ready: Promise<void> | null = null;
const waiting = new Map<number, (r: RunResult) => void>();
let seq = 0;

function boot(): Promise<void> {
  if (ready) return ready;
  frame = h('iframe', { title: 'test runner', src: '/runner', style: { display: 'none' } });
  frame.setAttribute('sandbox', 'allow-scripts');
  ready = new Promise((ok) => frame!.addEventListener('load', () => ok(), { once: true }));
  addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow) return;
    const d = (e.data as { ghostyResult?: { id: number; result: RunResult } }).ghostyResult;
    if (!d) return;
    waiting.get(d.id)?.(d.result);
    waiting.delete(d.id);
  });
  document.body.append(frame);
  return ready;
}

export async function runTests(code: string, entry: string, tests: { args: unknown[]; expect: unknown }[], timeout = 4000): Promise<RunResult> {
  await boot();
  const id = ++seq;
  return new Promise((ok) => {
    waiting.set(id, ok);
    frame!.contentWindow!.postMessage({ ghostyRun: { id, code, entry, tests, timeout } }, '*');
    setTimeout(() => {
      if (waiting.has(id)) {
        waiting.delete(id);
        ok({ error: 'the test runner did not answer' });
      }
    }, timeout + 3000);
  });
}

/** A short report of the failures, for the model (args, expected, got). */
export function failureReport(r: RunResult, tests: { args: unknown[]; expect: unknown; note?: string }[]): string {
  if ('error' in r) return r.error;
  const lines: string[] = [];
  r.results.forEach((x, i) => {
    if (x.ok || lines.length >= 6) return;
    const t = tests[i]!;
    lines.push(`- ${JSON.stringify(t.args).slice(0, 240)} → expected ${JSON.stringify(t.expect).slice(0, 200)}, got ${x.error ? `error: ${x.error}` : x.got}${t.note ? ` (${t.note})` : ''}`);
  });
  const failed = r.results.filter((x) => !x.ok).length;
  return `${failed} of ${r.results.length} tests failed:\n${lines.join('\n')}`;
}
