// THE EDITORS' SPEC HARNESS (FINAL ROUND, carried into the NEXT ROUND): one phone-opening, measuring and checking kit that each editors spec
// runs its own parts with. Each part is a file `export default async function (h)`; h = { browser, open, check, until, settle, measure, body21,
// problems, base, out, LOOKS, PHONE, SMALL, KEY }. The spec words split the parts so none runs long on CI (480 s a spec there):
//   editorslane  — documents, spreadsheets, presentations (tests/editorslane-{docs,sheets,slides}.mjs)
//   editorslane2 — the workspace, photo, video (tests/editorslane-{workspace,photo,video}.mjs)
//   editorsnext  — the NEXT ROUND's new tools (every tests/editorsnext-*.mjs)
// PARTS=a,b limits a run to those parts.
import { mkdirSync, readdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const look = (world, ground = 'graphite') => ({ ground, world, night: ground, switches: {} });
const LOOKS = {
  scan: look('scan'),
  map: look('map', 'slate'),
  eye: look('eye'),
  orbit: look('orbit', 'black'),
  grown: look('grown'),
  ink: look('ink', 'warm'),
  glass: look('glass'),
};
const SMALL = { width: 390, height: 844 };
let browser;
const launchBrowser = launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** A fresh phone: the owner's key, a look, a viewport, an optional text size (BODY 21 = 'xl'), optional localStorage seeds. */
async function open({ look = LOOKS.scan, viewport = PHONE, seed = {}, textSize = null, init = null, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', acceptDownloads: true, reducedMotion });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(({ key, look, seed, textSize }) => {
    if (!localStorage.getItem('spec.editorslane.seeded')) {
      localStorage.setItem('spec.editorslane.seeded', '1');
      const settings = { name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } };
      if (textSize) settings.textSize = textSize;
      localStorage.setItem('ghosty.settings', JSON.stringify(settings));
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look, seed, textSize });
  if (init) await page.addInitScript(init);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('the boot never ended'));
  return { ctx, page };
}
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const settle = (page) => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);

/** Every visible key inside `root` is 44 × 44 or more, nothing is wider than the screen, and no visible label is cut (ellipsis or clipped). */
async function measure(page, root, where) {
  const bad = await page.evaluate((sel) => {
    const out = [];
    const W = window.innerWidth;
    const scope = document.querySelector(sel) ?? document.body;
    for (const el of scope.querySelectorAll('button, [role="button"], input[type="checkbox"], input[type="range"], select, a.btn')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (el.closest('[aria-hidden="true"], .sr-only')) continue;
      const name = (el.getAttribute('aria-label') || el.textContent || el.title || el.tagName).trim().slice(0, 40);
      if (el.tagName !== 'INPUT' && (r.width < 43.5 || r.height < 43.5)) out.push(`${name}: ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.right > W + 1 && !el.closest('[data-scrolls], .scroller, [style*="overflow"]')) {
        let p = el.parentElement;
        let scrolls = false;
        while (p && p !== document.body) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') { scrolls = true; break; }
          p = p.parentElement;
        }
        if (!scrolls) out.push(`${name}: off the screen at ${Math.round(r.right)}`);
      }
      if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow === 'ellipsis') out.push(`${name}: words cut`);
    }
    if (document.documentElement.scrollWidth > W + 1) out.push(`the page goes sideways (${document.documentElement.scrollWidth} > ${W})`);
    return out;
  }, root);
  check(bad.length === 0, `${where}: every key 44 pt, nothing sideways, no words cut${bad.length ? ` (${bad.slice(0, 6).join('; ')})` : ''}`);
}

/** BODY 21: the largest text the phone allows (the app's own switch, as the editors' specs set it). */
const body21 = async (page) => {
  await page.evaluate(() => { document.documentElement.dataset.body = '21'; });
  await page.waitForTimeout(250);
};


/** Runs the named part files (relative to tests/) one after another, then prints the result and exits. */
export async function runParts(title, files, clean) {
  browser = await launchBrowser;
  const want = (process.env.PARTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = { browser, open, check, until, settle, measure, body21, problems, base, out, LOOKS, PHONE, SMALL, KEY };
  const T0 = Date.now();
  check(files.length > 0, `${title}: its parts are here (${files.join(', ')})`);
  for (const f of files) {
    const name = f.replace(/^editors(?:lane|next)-/, '').replace(/\.mjs$/, '');
    if (want.length && !want.includes(name)) continue;
    const t = Date.now();
    console.log(`\n== ${name}`);
    try {
      const mod = await import(new URL(f, import.meta.url).href);
      await mod.default(h);
    } catch (e) {
      check(false, `${name}: the part ran to its end (${e?.stack?.split('\n').slice(0, 3).join(' | ')})`);
    }
    console.log(`== ${name}: ${Date.now() - t} ms`);
  }
  console.log(`\n${title} ran in ${Date.now() - T0} ms`);
  await browser.close();
  console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : clean);
  process.exit(problems.length ? 1 : 0);
}
