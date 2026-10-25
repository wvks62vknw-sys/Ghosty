// The training ground in a real browser: Ghosty's (scripted) first attempt fails the hidden
// tests in the sandboxed runner, the failures go back, the second attempt passes; the runner
// also survives code that never finishes.
//   node tests/training.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { DESKTOP, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const page = await browser.newPage({ viewport: DESKTOP, ...UK });
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => (location.hash = 'workshop'));
// (the panel's TRAIN, not the Workshop's Training pill, which has the same letters and is hidden on a wide screen)
await page.waitForSelector('#pg-workshop .pn button:has-text("TRAIN")', { timeout: 10000 });
await page.selectOption('#pg-workshop select[aria-label="Exercise level"]', '1');
await page.click('#pg-workshop .pn button:has-text("TRAIN")');
const solved = await page.waitForFunction(() => [...document.querySelectorAll('#pg-workshop .liblog .note.ok')].some((n) => /all \d+ tests pass \(attempt 2/.test(n.textContent ?? '')), null, { timeout: 30000 }).then(() => true).catch(() => false);
if (!solved) problems.push(`no exercise solved on the second attempt: ${(await page.$$eval('#pg-workshop .liblog .note', (n) => n.map((x) => x.textContent))).slice(0, 4).join(' | ')}`);
const sawFailure = await page.$$eval('#pg-workshop .liblog .note', (n) => n.some((x) => /attempt 1: \d+ of \d+ tests failed/.test(x.textContent ?? '')));
if (!sawFailure) problems.push('the failed first attempt was not reported');
await page.click('#pg-workshop button:has-text("STOP")').catch(() => undefined);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/training.png` });
// the sandbox: endless loops are stopped, and the code has no network
const sandbox = await page.evaluate(async () => {
  const f = [...document.querySelectorAll('iframe')].find((x) => x.getAttribute('title') === 'test runner');
  const run = (code) => new Promise((ok) => {
    const id = Math.random();
    const on = (e) => {
      if (e.data?.ghostyResult?.id === id) {
        removeEventListener('message', on);
        ok(e.data.ghostyResult.result);
      }
    };
    addEventListener('message', on);
    f.contentWindow.postMessage({ ghostyRun: { id, code, entry: 'f', tests: [{ args: [], expect: 1 }], timeout: 1500 } }, '*');
  });
  return { loop: await run('function f(){ for(;;){} }'), net: await run('function f(){ try { var x = new XMLHttpRequest(); x.open("GET", "https://example.com", false); x.send(); return 2 } catch (e) { return 1 } }') };
});
if (!/timed out/.test(sandbox.loop?.error ?? '')) problems.push(`endless loop not stopped: ${JSON.stringify(sandbox.loop)}`);
if (!sandbox.net?.results?.[0]?.ok) problems.push(`code in the sandbox reached the network: ${JSON.stringify(sandbox.net)}`);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Training run clean: failed attempt fed back, second attempt passes in the sandbox, endless loops stopped, no network.');
process.exit(problems.length ? 1 : 0);
