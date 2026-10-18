// Never useless, in the real interface on a phone: with every model cooling down (the scripted
// model's "no model:" phrase), a simple ask still gets its raw answer and the exact time the first
// model is back, anything else gets that time plus the key tip, and the next ordinary turn answers
// as usual. Runs against the preview server (node tests/preview-server.mjs <port>).
//   BASE=http://localhost:8802 node tests/direct.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 15000 });
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.waitForTimeout(800);
// phone width: open the log first
await page.click('.logbtn');
const ask = async (text) => {
  await page.fill('#cin', text);
  await page.keyboard.press('Enter');
};
const bodyText = () => page.evaluate(() => document.body.innerText);
const seen = (re, timeout = 10000) => page.waitForFunction((src) => new RegExp(src, 'm').test(document.body.innerText), re.source, { timeout }).then(() => true, () => false);

// 1. a fact to remember, with the model working
await ask('remember my dog is Rex');
if (!(await seen(/I’ll remember that|I already know that/))) problems.push('the ordinary turn before the fallback did not answer');

// 2. the time, with no model: the raw answer and when the first model is back
await ask('no model: what time is it');
if (!(await seen(/No AI model is free right now \(the first is back at \d\d:\d\d\)\. The raw answer:/))) problems.push('the time was not answered without a model');
if (!/It is \w{3} \d{1,2} \w{3} \d{4}, \d\d:\d\d/.test(await bodyText())) problems.push('no local time in the raw answer');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/direct-time.png` });

// 3. memory, with no model: the list_memory tool runs and its raw text is the answer
await ask('no model: what do you remember about me');
if (!(await seen(/The raw answer:\n[^\n]*my dog is Rex/i))) problems.push('memory was not listed without a model');
if (!(await seen(/Recalling memory/, 5000))) problems.push('the tool that answered (list_memory, "Recalling memory") is not shown in the log');

// 4. anything else: the exact time the first model is back, and the one tip
await ask('no model: tell me a joke');
if (!(await seen(/The first model is back at \d\d:\d\d\. Tip: a free key in SYSTEM \(Groq, Cerebras or NVIDIA\) means never waiting\./))) problems.push('the no-model message lacks the time or the tip');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/direct-tip.png` });

// 5. the model is back: an ordinary reply, and nothing stuck from the fallback
await ask('hello');
if (!(await seen(/Mock reply to: hello/))) problems.push('an ordinary turn after the fallback did not answer');
if (await page.locator('.convo .log .act.live').count()) problems.push('a tool row is still live after the turns ended');

await browser.close();
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('direct spec ok: three answers without a model, the back-at time and the tip, then an ordinary reply');
