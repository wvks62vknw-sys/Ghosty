// Widgets in a real browser, through the same host page and security policy as the live app:
//  - Cloudflare's address for the host (/widget-host) carries the sandbox policy, not "never frame me"
//  - the example game from Ghosty's handbook runs, takes keyboard and touch input, and shows no errors
//  - storage and alert work inside the sandbox; script errors are shown on screen, not a blank page
//   node tests/widgets.spec.mjs [outDir]   (needs apps/edge `npm test` to have built the handbook)
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const { NEON_DODGE } = await import(new URL('../apps/edge/test/.build/knowledge/index.mjs', import.meta.url));
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const problems = [];

// 1. the host's address and its security policy
const redirect = await fetch(`${base}/widget-host.html`, { redirect: 'manual' });
const hostUrl = redirect.status >= 300 && redirect.status < 400 ? new URL(redirect.headers.get('location'), base).href : `${base}/widget-host.html`;
const host = await fetch(`${base}/widget-host`);
const csp = host.headers.get('content-security-policy') ?? '';
if (!/sandbox allow-scripts/.test(csp) || /frame-ancestors 'none'/.test(csp)) problems.push(`/widget-host has the wrong security policy (widgets would be blank): ${csp.slice(0, 120)}`);

async function widget(name, html, viewport, act) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => webkitNoise(e) || errors.push(e.message));
  await page.goto(hostUrl);
  // the host accepts a widget from its parent; at the top level the page is its own parent
  await page.evaluate((h) => window.postMessage({ ghostyWidget: h }, '*'), html);
  await page.waitForTimeout(600);
  await act(page);
  await page.screenshot({ path: `${out}/widget-${name}-${viewport.width}.png` });
  const banner = await page.evaluate(() => [...document.querySelectorAll('div')].map((d) => d.textContent).find((t) => /^Widget error/.test(t ?? '')) ?? '');
  await ctx.close();
  return { errors, banner };
}

for (const viewport of [{ width: 390, height: 780 }, { width: 1200, height: 800 }]) {
  // 2. the handbook's example game
  const g = await widget('game', NEON_DODGE, viewport, async (page) => {
    const canvas = await page.$('canvas');
    if (!canvas) return void problems.push(`[${viewport.width}] the example game drew no canvas`);
    const box = await canvas.boundingBox();
    if (!box || box.width < 150) problems.push(`[${viewport.width}] the game canvas did not fit the screen (${JSON.stringify(box)})`);
    await page.keyboard.press('Space');
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowLeft');
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.8);
    await page.waitForTimeout(1500);
    // it must be drawing: some non-background pixels
    const lit = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
      return n;
    });
    if (lit < 20) problems.push(`[${viewport.width}] the game canvas is blank`);
  });
  if (g.errors.length || g.banner) problems.push(`[${viewport.width}] example game errors: ${[...g.errors, g.banner].filter(Boolean).join(' | ')}`);
}

// 3. storage + alert inside the sandbox, and visible errors
const tools = await widget(
  'sandbox',
  '<!doctype html><html><head></head><body><p id="r">…</p><script>localStorage.setItem("k", "saved"); alert("hello"); document.getElementById("r").textContent = localStorage.getItem("k");</script></body></html>',
  { width: 600, height: 500 },
  async (page) => {
    const t = await page.textContent('#r');
    if (t !== 'saved') problems.push(`storage inside the sandbox failed (got "${t}")`);
    if (!(await page.evaluate(() => document.body.innerText.includes('hello')))) problems.push('alert() inside the sandbox showed nothing');
  },
);
if (tools.errors.length || tools.banner) problems.push(`sandbox widget errors: ${[...tools.errors, tools.banner].filter(Boolean).join(' | ')}`);
const broken = await widget('broken', '<!doctype html><html><head></head><body><script>missingFunction();</script></body></html>', { width: 600, height: 500 }, async () => {});
if (!/Widget error/.test(broken.banner)) problems.push('a widget with a script error did not show the error on screen');

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Widgets run clean: host policy, example game, sandbox storage/alerts, visible errors.');
process.exit(problems.length ? 1 : 0);
