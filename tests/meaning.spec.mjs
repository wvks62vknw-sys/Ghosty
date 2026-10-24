// SEARCH BY MEANING on the phone, at the owner's screen size (440 × 956, UK). This browser has no usable WebGPU, so a
// tiny deterministic embedder stands in for the model (window.__ghostyEmbedder: a few "concepts" decide a text's
// direction) and a test engine for the offline brain (window.__ghostyOfflineEngine). Checked: SETTINGS → OFFLINE
// BRAIN says "Search by meaning", its size and Wi-Fi, and nothing is downloaded until ADD; after ADD the library
// copy on the phone is indexed in the background and the count shows ("x of N passages indexed") until every
// passage is done; ASK THE LIBRARY finds the photosynthesis passage for "how does a plant in the garden grow" (none of its
// words) and its small print says "by meaning"; the offline brain's prompt carries that passage (read from
// window.__ghosty.meaning); with the model removed the same search says "by keywords" and does not find it;
// nothing sticks out sideways and every button is 44 px tall.
//   node tests/meaning.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
// Its own title each run (a preview server that ran this before still holds the last one).
const TITLE = `Leaf chemistry ${Date.now().toString(36)}`;
const PHOTO = 'Photosynthesis: green leaves catch sunlight with chlorophyll and turn carbon dioxide and water into glucose and oxygen.';

const stubs = () => {
  // The stand-in model: what a text is about (botany, cooking, computing) decides its direction, and the rest of
  // its words pull it towards "something else", so one stray word in a long passage does not make it botany. The
  // question's prefix (the real model's) is read past, but recorded.
  const CONCEPTS = [
    ['plant', 'leaf', 'leaves', 'photosynth', 'chlorophyll', 'sunlight', 'glucose', 'garden', 'grow'],
    ['food', 'cook', 'recipe', 'pancake', 'flour', 'egg', 'batter', 'oven', 'meal'],
    ['search', 'binary', 'sort', 'array', 'algorithm', 'code', 'function', 'list'],
  ];
  const PREFIX = 'Represent this sentence for searching relevant passages: ';
  const vec = (text, kind) => {
    const words = text.replace(PREFIX, '').toLowerCase().match(/[a-z]+/g) ?? [];
    const v = CONCEPTS.map(() => 0);
    let other = 0;
    for (const w of words) {
      const i = CONCEPTS.findIndex((c) => c.some((x) => w.startsWith(x)));
      if (i >= 0) v[i]++;
      else other++;
      if (w === 'food') v[0] += 0.6;
    }
    // A question that names plants is about plants, not cooking (as the real model knows): otherwise a long study
    // note another spec filed on the shared preview, full of "food" and "plant" (the factory kind), outranks botany.
    if (kind === 'query' && v[0] > 0) v[1] *= 0.25;
    v.push(0.1 * other + 0.1);
    return v;
  };
  window.__ghostyEmbedder = {
    ready: false,
    loads: 0,
    unloads: 0,
    passages: 0,
    queries: [],
    idleMs: 800,
    load() {
      this.loads++;
    },
    unload() {
      this.unloads++;
    },
    async embed(texts, kind) {
      if (kind === 'query') this.queries.push(...texts);
      else this.passages += texts.length;
      // a little time per batch, so the count can be seen filling
      await new Promise((r) => setTimeout(r, 25));
      return texts.map((t) => vec(t, kind));
    },
  };
  window.__ghostyOfflineEngine = {
    ready: true,
    calls: [],
    idleMs: 500,
    async chat(messages, onToken) {
      this.calls.push(messages);
      for (const w of ['Plants ', 'make ', 'glucose ', 'from ', 'sunlight.']) {
        await new Promise((r) => setTimeout(r, 20));
        onToken(w);
      }
    },
  };
};

const ctx = await browser.newContext({ viewport: PHONE, ...UK });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('dialog', (d) => void d.accept());
await page.addInitScript(stubs);
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });

// ---- a passage that means the question without its words, saved from the LIBRARY tab (kept on the phone at once)
await page.evaluate(() => (location.hash = 'library'));
await page.waitForFunction(() => /PASSAGES/.test(document.querySelector('#pg-library .bigv')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => problems.push('the library tab never loaded'));
await page.fill('#pg-library input[aria-label="Title of the text"]', TITLE);
await page.fill('#pg-library textarea[aria-label="Text to save"]', PHOTO);
await page.click('#pg-library button:has-text("SAVE TEXT")');
await page.waitForFunction((t) => [...document.querySelectorAll('#pg-library .liblog .note')].some((n) => (n.textContent ?? '').includes(t) && /saved/.test(n.textContent ?? '')), TITLE, { timeout: 20000 }).catch(() => problems.push('the photosynthesis text was not saved'));
// The whole library copied to the phone first (the starter library), so the count has something to fill.
await page.waitForFunction(() => /on this device \(works offline\)/.test(document.querySelector('#pg-library .sub')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => problems.push('the library was never copied to the phone'));
// Before the model is here: keywords, said so; the question finds nothing about photosynthesis.
const ask = async (q) => {
  await page.evaluate(() => (location.hash = 'library'));
  await page.fill('#pg-library input[aria-label="Search the library"]', q);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /passages? · by/.test(document.querySelector('#pg-library .pn.ask h3 small')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => undefined);
  return page.evaluate(() => ({ status: document.querySelector('#pg-library .pn.ask h3 small')?.textContent ?? '', hits: [...document.querySelectorAll('#pg-library .rw.hit')].map((x) => x.textContent ?? '') }));
};
let r = await ask('how does a plant in the garden grow');
if (!/by keywords/.test(r.status)) problems.push(`before the model, the small print says "${r.status}"`);
if (r.hits.some((h) => h.includes(TITLE))) problems.push('keywords alone found the photosynthesis passage (the question shares none of its words): the test proves nothing');

// ---- SETTINGS → OFFLINE BRAIN → Search by meaning: the size, Wi-Fi, ADD; nothing downloaded before.
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'OFFLINE');
const blk = page.locator('#pg-settings .pn.offbrain .mnblock');
await blk.waitFor({ state: 'visible', timeout: 10000 }).catch(() => problems.push('no SEARCH BY MEANING in SETTINGS → OFFLINE BRAIN'));
const line0 = (await blk.locator('.mnline').textContent().catch(() => '')) ?? '';
if (!/Search by meaning: about 70 MB, once, on Wi-Fi/.test(line0)) problems.push(`the line before ADD reads "${line0}"`);
if ((await page.evaluate(() => window.__ghostyEmbedder.passages + window.__ghostyEmbedder.loads)) !== 0) problems.push('the meaning model was used before ADD');
if (!/on this phone only: nothing is sent anywhere[\s\S]*builds it again after Ghosty is reinstalled[\s\S]*English best/.test((await blk.textContent()) ?? '')) problems.push('the honest limits are not said');
// ADD shows its size as written ("Add · 70 MB": sentence case had made it "Add · 70 mb")
const addShown = await blk.locator('button:has-text("ADD")').evaluate((b) => ({ shown: b.dataset.label ?? '', tt: getComputedStyle(b, '::before').textTransform, content: getComputedStyle(b, '::before').content })).catch(() => null);
if (addShown?.shown !== 'Add · 70 MB' || addShown.tt !== 'none' || addShown.content !== '"Add · 70 MB"') problems.push(`ADD reads: ${JSON.stringify(addShown)}`);
await blk.locator('button:has-text("ADD")').click();
// The count shows while it fills,
const partial = await page
  .waitForFunction(() => {
    const t = document.querySelector('#pg-settings .mnblock .mncount')?.textContent ?? '';
    const m = t.replace(/,/g, '').match(/^(\d+) of (\d+) passages indexed/);
    return m && Number(m[1]) > 0 && Number(m[1]) < Number(m[2]) ? t : null;
  }, null, { timeout: 60000, polling: 50 })
  .then((h) => h.jsonValue())
  .catch(() => null);
if (!partial) problems.push('the count was never seen part way ("x of N passages indexed")');
await blk.scrollIntoViewIfNeeded().catch(() => undefined);
await page.screenshot({ path: `${out}/phone-meaning-indexing.png` });
// Then on until every passage has its vector.
const full = await page
  .waitForFunction(() => {
    const t = document.querySelector('#pg-settings .mnblock .mncount')?.textContent ?? '';
    const m = t.replace(/,/g, '').match(/^(\d+) of (\d+) passages indexed · searches go by meaning/);
    return m && m[1] === m[2] ? t : null;
  }, null, { timeout: 180000 })
  .then((h) => h.jsonValue())
  .catch(() => null);
if (!full) problems.push(`the index never finished: "${await blk.locator('.mncount').textContent().catch(() => '')}"`);
const line1 = (await blk.locator('.mnline').textContent().catch(() => '')) ?? '';
if (!/^Search by meaning: 70 MB, on this phone\./.test(line1)) problems.push(`the line after ADD reads "${line1}"`);
const ix = await page.evaluate(() => window.__ghosty?.meaning?.index?.() ?? null);
if (!ix || ix.indexed !== ix.total || ix.total < 2) problems.push(`window.__ghosty.meaning: ${JSON.stringify(ix)}`);
// 440 px: nothing sideways, every button 44 px tall.
const fit = await page.evaluate(() => {
  const el = document.querySelector('#pg-settings .mnblock');
  const wide = [...(el?.querySelectorAll('*') ?? [])].filter((x) => x.getBoundingClientRect().right > innerWidth + 1).map((x) => `${x.tagName.toLowerCase()}.${x.className}`);
  const small = [...(el?.querySelectorAll('button') ?? [])].filter((b) => b.getBoundingClientRect().height && b.getBoundingClientRect().height < 43.5).map((b) => `${b.textContent} ${Math.round(b.getBoundingClientRect().height)}px`);
  return { page: document.documentElement.scrollWidth - innerWidth, wide: wide.slice(0, 5), small };
});
if (fit.page > 0 || fit.wide.length) problems.push(`the meaning block sticks out sideways: page ${fit.page}px, ${fit.wide.join(', ')}`);
if (fit.small.length) problems.push(`buttons under 44 px: ${fit.small.join(', ')}`);
await page.screenshot({ path: `${out}/phone-meaning-settings.png` });

// ---- ASK THE LIBRARY, by meaning: the photosynthesis passage first, and the small print says so.
r = await ask('how does a plant in the garden grow');
if (!/^\d+ passages? · by meaning( · [\d,]+ newest by keywords)?$/.test(r.status)) problems.push(`with the index whole, the small print says "${r.status}"`);
// What "by meaning" must show: the first three hits include a passage about photosynthesis. On a shared preview the
// library also holds other specs' passages — the LEARN spec's "Course notes: photosynthesis" answers this very
// question, and a small embedding model can put a study note ("food marketing") first — so the hit may be this
// spec's own passage or another one on the same subject; the added passage itself must still be in the list, unless
// every hit is already about photosynthesis.
const topical = (h) => /photosynthesis/i.test(h) || h.includes(TITLE);
if (!r.hits.slice(0, 3).some(topical)) problems.push(`by meaning, no photosynthesis passage among the first three hits: ${r.hits.slice(0, 4).map((h) => h.slice(0, 80)).join(' | ')}`);
if (!r.hits.some((h) => h.includes(TITLE)) && !r.hits.every(topical)) problems.push(`the added passage is missing from the hits by meaning: ${r.hits.map((h) => h.slice(0, 60)).join(' | ')}`);
if (new Set(r.hits).size !== r.hits.length) problems.push('a passage is shown twice');
const queried = await page.evaluate(() => window.__ghostyEmbedder.queries.at(-1) ?? '');
if (queried !== 'Represent this sentence for searching relevant passages: how does a plant in the garden grow') problems.push(`the question was not given the model's query prefix: "${queried}"`);
await page.evaluate(() => document.querySelector('#pg-library .pn.ask')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/phone-meaning-library.png` });

// ---- The offline brain (the brain unreachable): its prompt carries the passage found by meaning.
await page.evaluate(() => (location.hash = 'core'));
await page.click('.logbtn').catch(() => undefined);
await page.route('**/api/chat', (route) => route.abort('internetdisconnected'));
await page.fill('#cin', 'how does a plant in the garden grow');
await page.keyboard.press('Enter');
await page.waitForFunction(() => [...document.querySelectorAll('.msg.off')].some((m) => /Plants make glucose from sunlight\./.test(m.textContent ?? '')), null, { timeout: 20000 }).catch(() => problems.push('no offline reply'));
const prompt = await page.evaluate(() => window.__ghosty?.meaning?.prompt?.() ?? null);
if (!prompt || prompt.how !== 'meaning' || !prompt.titles.some((t) => /photosynthesis/i.test(t) || t.startsWith('Leaf chemistry')) || !/Photosynthesis: green leaves catch sunlight|photosynthesis/i.test(prompt.system)) problems.push(`the offline brain's prompt (window.__ghosty.meaning.prompt) does not carry the passage by meaning: ${JSON.stringify(prompt).slice(0, 300)}`);
const told = await page.evaluate(() => window.__ghostyOfflineEngine.calls.at(-1)?.[0]?.content ?? '');
if (!/library on this phone[\s\S]*\[Leaf chemistry [a-z0-9]+\] Photosynthesis/.test(told)) problems.push(`the small model was not given the passage: ${told.slice(-300)}`);
// The meaning model left memory before the brain answered (a phone holds one model comfortably).
if ((await page.evaluate(() => window.__ghostyEmbedder.unloads)) < 1) problems.push('the meaning model stayed in memory when the offline brain answered');
await page.unroute('**/api/chat');
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/phone-meaning-offline-answer.png` });

// ---- The model removed: by keywords, honestly, and the passage is not found by its meaning.
await page.click('.logbtn').catch(() => undefined);
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'OFFLINE');
await blk.locator('button:has-text("REMOVE")').click();
await page.locator('.modal .confirm.sure button.sureyes').click({ timeout: 5000 }).catch(() => problems.push('REMOVE did not ask first'));
await page.waitForFunction(() => /about 70 MB, once, on Wi-Fi/.test(document.querySelector('#pg-settings .mnblock .mnline')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('REMOVE did not take the model off'));
r = await ask('how does a plant in the garden grow');
if (!/^\d+ passages? · by keywords$/.test(r.status)) problems.push(`with the model off, the small print says "${r.status}"`);
if (r.hits.some((h) => h.includes(TITLE))) problems.push('with the model off, the passage was still found by meaning');
await page.evaluate(() => document.querySelector('#pg-library .pn.ask')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/phone-meaning-keywords.png` });
await page.fill('#pg-library input[aria-label="Search the library"]', '');
await page.dispatchEvent('#pg-library input[aria-label="Search the library"]', 'search');
const idleLine = await page.evaluate(() => document.querySelector('#pg-library .pn.ask .askhow')?.textContent ?? '');
if (!/Searched by keywords/.test(idleLine)) problems.push(`the line before a search reads "${idleLine}"`);

await ctx.close();
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `Search by meaning run clean: ADD asked for once with its size; the index filled on the phone (${partial} … ${full}); "how does a plant in the garden grow" found the photosynthesis passage by meaning, said "by meaning", and the offline brain's prompt carried it; with the model removed, "by keywords".`);
process.exit(problems.length ? 1 : 0);
