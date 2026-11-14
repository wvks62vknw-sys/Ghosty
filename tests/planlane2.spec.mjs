// THE PLAN AND HOME LANE, the next round (14 Nov 2026): one list and one morning page, the day timeline, goodnight, podcasts and the rest.
// The same harness as tests/planlane.spec.mjs (that spec holds the final round's checks and is at its time budget); this one runs the parts
// in tests/planlane2/<name>.mjs, each exporting run(H). PLANLANE_ONLY=<name>[,<name>] runs some of them.
//   BASE=http://localhost:8788 node tests/planlane2.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection, standDown } from './nav.mjs';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
// PLANLANE_ONLY=radio,agenda runs only those parts (tests/planlane/<name>.mjs) and skips the core checks below; unset, everything runs.
const ONLY = (process.env.PLANLANE_ONLY ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const core = !ONLY.length || ONLY.includes('core');
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 240)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const RAW = /undefined|\[object Object\]|TypeError|NetworkError|Failed to|HTTP \d|NaN/;
await standDown(base, KEY);

async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}

// ---- the browser
function wav(sec = 30, rate = 8000) {
  const n = sec * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 2000), 44 + i * 2);
  return b;
}
const TONE = wav();
const DIRECTORY = [
  { name: 'Spec Lane FM', url_resolved: 'https://spec-lane.test-radio.example/one', country: 'UK', countrycode: 'GB', tags: 'news', codec: 'MP3', bitrate: 128 },
  { name: 'Spec Lane Two', url_resolved: 'https://spec-lane.test-radio.example/two', country: 'UK', countrycode: 'GB', tags: 'news', codec: 'MP3', bitrate: 128 },
];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });

/** A paired phone at `viewport` in the look `world`, with `seed` put in its storage first and BODY at `body` (21 = his largest text; 0 = the default). */
async function phone(viewport, world = 'scan', seed = {}, body = 0) {
  // (paired by the key in storage, motion calm and no service worker: the app boots about 40% sooner, which keeps the run inside CI's eight
  // minutes; nothing checked here depends on the boot's motion. The pairing screen itself has its own specs.)
  const ctx = await browser.newContext({ viewport, ...UK, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(({ world, seed, body, key }) => {
    if (!localStorage.getItem('ghosty.ownerKey')) localStorage.setItem('ghosty.ownerKey', key);
    if (!localStorage.getItem('ghosty.settings'))
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(seed)) if (!localStorage.getItem(k)) localStorage.setItem(k, v);
    window.__specActions = {};
    if (navigator.mediaSession) {
      const set = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (a, fn) => { window.__specActions[a] = fn; return set(a, fn); };
    }
  }, { world, seed, body, key: KEY });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror (${world} ${viewport.width}): ${e.message}`));
  await page.route(/\/api\/proxy\?.*radio-browser/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(DIRECTORY) }));
  await page.route(/^https:\/\/spec-lane\.test-radio\.example\//, (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: TONE }));
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const open = async (page, tab) => {
  await page.evaluate((t) => (location.hash = t), tab);
  await page.waitForFunction((t) => document.body.dataset.tab === t && document.querySelector(`#pg-${t}`), tab, { timeout: 15000 });
};
/** Say something in the chat (as he types it), on the core screen. */
const chat = async (page, words) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
};
/**
 * Say `words` in the chat and wait for Ghosty's reply to THEM: the first reply drawn after his own message (found by the time it was sent,
 * `data-at`, on the page's own clock) whose words match `re`, up to `ms`. Never a count of replies (the log draws only its last 40 entries,
 * so after twenty turns a count stops growing even when the reply is there), never a fixed sleep, never the last message read at once.
 * Returns { ok, text (the reply's textContent), inner (its innerText, spaces folded) }; when no matching reply came, the newest reply after
 * his message (or '') so the check can say what was there.
 */
const ask = async (page, words, re = /\S/, ms = 20000) => {
  const t0 = await page.evaluate(() => Date.now());
  await chat(page, words);
  const find = ({ t0, src, flags, any }) => {
    const rx = new RegExp(src, flags);
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
    if (mine < 0) return null;
    const replies = msgs.slice(mine + 1).filter((m) => !m.classList.contains('me'));
    const r = any ? replies.at(-1) : replies.find((m) => rx.test(m.textContent ?? ''));
    return r ? { text: r.textContent ?? '', inner: (r.innerText ?? '').replace(/\s+/g, ' ').trim() } : null;
  };
  const arg = { t0, src: re.source, flags: re.flags.replace('g', ''), any: false };
  const got = await page.waitForFunction(find, arg, { timeout: ms }).then((h) => h.jsonValue(), () => null);
  if (got) return { ok: true, ...got };
  const seen = await page.evaluate(find, { ...arg, any: true }).catch(() => null);
  return { ok: false, text: seen?.text ?? '', inner: seen?.inner ?? '' };
};
/** Every visible key under `sel` that is under 44 pt, and whether the page scrolls sideways, and any word cut. */
const fit = async (page, sel) => {
  // (once the screen's entrance has finished: mid-way every key reads a fraction short. The real condition, never a fixed sleep.)
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  return page.evaluate((sel) => {
    const small = [...document.querySelectorAll(`${sel} button`)].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width && r.height && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(b).visibility !== 'hidden';
    }).map((b) => `${(b.getAttribute('aria-label') ?? b.textContent).trim().slice(0, 30)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
    const pg = document.querySelector(sel.split(' ')[0]);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1 || (pg && pg.scrollWidth > pg.clientWidth + 1);
    const cut = [...document.querySelectorAll(`${sel} :is(b, small, span, p)`)].filter((e) => {
      if (!e.offsetParent || e.children.length) return false;
      const cs = getComputedStyle(e);
      return cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1;
    }).map((e) => e.textContent.slice(0, 30));
    return { small, sideways: !!sideways, cut };
  }, sel);
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---- 6. THE PARTS: each screen's own checks (tests/planlane/<name>.mjs, each exporting `run(H)`), in name order, with the harness above
const H = { browser, phone, open, fit, check, log, pure, chat, ask, out, base, KEY, today, PHONE, PHONE2, WORLDS, RAW, TONE, DIRECTORY };
const partsDir = new URL('./planlane2/', import.meta.url);
// (split in two for CI's eight minutes: this spec runs these parts; tests/planlane3.spec.mjs runs the rest of tests/planlane2/, the same way)
const MINE = ['onelist', 'timeline', 'podcasts'];
const parts = existsSync(partsDir) ? readdirSync(partsDir).filter((f) => f.endsWith('.mjs') && MINE.includes(f.replace(/\.mjs$/, ''))).sort() : [];
// Two lanes at once (CI's eight minutes): the parts that read his diary on the shared preview brain run one after another in the first
// (the agenda adds and removes its own event, so Home and the Brief never see it half-way); the parts whose sources are all stood in by
// page.route run in the second. A part named in neither joins the first.
const LANES = [['onelist', 'timeline'], ['podcasts']];
const named = parts.map((f) => f.replace(/\.mjs$/, '')).filter((n) => !ONLY.length || ONLY.includes(n));
const lanes = [named.filter((n) => !LANES[1].includes(n)).sort((a, b) => (LANES[0].indexOf(a) + 1 || 99) - (LANES[0].indexOf(b) + 1 || 99)), LANES[1].filter((n) => named.includes(n))];
await Promise.all(lanes.map(async (lane) => {
  for (const name of lane) {
    const m = await import(new URL(`${name}.mjs`, partsDir).href);
    const t = Date.now();
    try {
      await m.run(H);
    } catch (e) {
      check(false, `[${name}] the part stopped: ${String(e?.stack ?? e).slice(0, 400)}`);
    }
    log(`part ${name} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  }
}));

await browser.close();
console.log(`${checks} checks, ${problems.length} problems`);
if (problems.length) {
  console.log(problems.map((p) => `- ${p}`).join('\n'));
  process.exit(1);
}
console.log('PLANLANE2 OK');
