// 3D STUDIO's CATALOGUE and MAKE · PHOTO on an iPhone 13 (WebGL through SwiftShader), with every outside
// service stubbed: the real catalogue index (/data/models3d.json, thousands of models) is searched in words
// ("kettle", "oak dining chair", a British word); thumbnails come through the brain; a card opens a real GLB
// "from Hugging Face" (stubbed with a Khronos sample) with its credit and licence on the scene and its source
// page linked; a Poly Haven model opens through the brain. MAKE IT finds a real model first, then on MAKE A NEW
// ONE asks the brain's generator (stubbed: its steps, the drawing, a model) and opens and keeps the result;
// when the generators are busy a stand-in built from shapes shows at once with the reason in words and
// TRY AGAIN; when nothing can draw the object ASK GHOSTY is offered; UNDO goes back to the model before.
// PHOTO → TEXTURED 3D shows the cut-out the brain sends and opens the textured model. The security policy
// blocks nothing and nothing sticks out sideways at 390 px.
import { isWebKit, launch, webkitNoise } from './browser.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const chairGlb = readFileSync(new URL('../apps/web/public/models/SheenChair.glb', import.meta.url));
const sofaGlb = readFileSync(new URL('../apps/web/public/models/GlamVelvetSofa.glb', import.meta.url));
const truckGlb = readFileSync(new URL('../apps/web/public/models/CesiumMilkTruck.glb', import.meta.url));
// a 2×2 PNG for thumbnails, the drawing and the cut-out
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP4z8DwnwEJMDEQAwBEOAH/5HBxEwAAAABJRU5ErkJggg==', 'base64');
const pngData = `data:image/png;base64,${PNG.toString('base64')}`;

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: !isWebKit,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:|GPU stall|WebGL/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

// ---- the outside world, stubbed ----
// Hugging Face's Objaverse files: any GLB asked for is the Sheen chair (with the CORS header Hugging Face sends).
const hfAsked = [];
await page.route('https://huggingface.co/datasets/allenai/objaverse/**', (route) => {
  hfAsked.push(route.request().url());
  return route.fulfill({ status: 200, contentType: 'model/gltf-binary', headers: { 'access-control-allow-origin': '*' }, body: chairGlb });
});
// The brain: Poly Haven's list (one sofa), its GLB, thumbnails, the generator and the photo maker.
const thumbsAsked = [];
await page.route('**/api/m3d/catalog', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ at: Date.now(), items: [{ id: 'ph:Sofa_01', name: 'Sofa 01', cat: 'sofas', group: 'Furniture', tags: ['sofa', 'couch'], licence: 'CC0', author: 'Some Haven Artist', source: 'Poly Haven', kb: 0, faces: 30000, thumb: 'https://cdn.polyhaven.com/asset_img/thumbs/Sofa_01.png?width=256', page: 'https://polyhaven.com/a/Sofa_01' }] }) }),
);
await page.route('**/api/m3d/ph/Sofa_01', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: sofaGlb }));
await page.route('**/api/m3d/thumb?**', (route) => {
  thumbsAsked.push(new URL(route.request().url()).searchParams.get('u'));
  return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
});
const lines = (...l) => l.map((x) => JSON.stringify(x)).join('\n') + '\n';
const generated = [];
let genAnswer = 'model';
await page.route('**/api/m3d/generate', (route) => {
  generated.push(JSON.parse(route.request().postData() ?? '{}'));
  if (genAnswer === 'busy') return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: lines({ step: 'drawing the object first…' }, { error: 'the free 3-D generators are busy right now — try again in a minute. Stable Fast 3D: number 9 in the queue', status: 503, code: 'busy' }) });
  if (genAnswer === 'no_picture') return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: lines({ error: 'nothing could draw the object first: Workers AI is not available here', status: 503, code: 'no_picture' }) });
  return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: lines({ step: 'drawing the object first…' }, { step: 'drawn by FLUX.1 schnell (Workers AI); now making it 3-D…', picture: pngData }, { step: 'shaping and painting the model: number 2 in the queue…' }, { model: { id: 'BBBBBBBBBBBBBBBB', title: generated.at(-1).prompt, at: Date.now(), bytes: truckGlb.length, maker: 'Stable Fast 3D', textured: true, credit: 'Made from a picture by Stable Fast 3D (Stability AI, Community Licence), via Hugging Face; drawn first by FLUX.1 schnell (Workers AI)' } }) });
});
await page.route('**/api/m3d/BBBBBBBBBBBBBBBB', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: truckGlb }));
await page.route('**/api/m3d/CCCCCCCCCCCCCCCC', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: chairGlb }));
await page.route(/\/api\/m3d(\?stream=1)?$/, (route) => {
  if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [] }) });
  return route.fulfill({ status: 200, contentType: 'application/x-ndjson', body: lines({ step: 'removing the background…' }, { step: 'shaping and painting the model…' }, { model: { id: 'CCCCCCCCCCCCCCCC', title: 'From a photo', at: Date.now(), bytes: chairGlb.length, maker: 'Stable Fast 3D', textured: true, credit: 'Made from a picture by Stable Fast 3D (Stability AI, Community Licence), via Hugging Face' }, cutout: pngData }) });
});

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });

const S = () => page.evaluate(() => window.__ghosty?.studio?.state() ?? null);
const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const pane = (label) => page.locator('#pg-studio .studioseg button', { hasText: label }).click();
const btn = (label) => page.locator('#pg-studio .studiobar button, #pg-studio .studiopanel button', { hasText: label }).first();
const sideways = () =>
  page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page');
    for (const el of document.querySelectorAll('#pg-studio button, #pg-studio input, #pg-studio select, #pg-studio img, #pg-studio a')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > innerWidth + 2 || r.left < -2)) out.push(`${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || el.getAttribute('alt') || '').trim().slice(0, 24)}`);
    }
    return out;
  });

await page.evaluate(() => (location.hash = 'studio'));
await until(() => window.__ghosty?.studio?.state().parts.length > 0, 60000, 'the studio did not open on its reactor');

// ---- CATALOGUE: search in words, thumbnails through the brain, a card opens with its credit ----
await pane('MODELS');
await page.fill('#pg-studio input[aria-label="Search the catalogue"]', 'kettle');
await btn('FIND').click();
await until(() => window.__ghosty.studio.state().hits.length > 0, 20000, 'searching "kettle" found nothing');
let st = await S();
if (st.catalogue < 3000) problems.push(`the catalogue has only ${st.catalogue} models`);
if (!st.hits.some((h) => /kettle/i.test(h.name))) problems.push(`"kettle" found no kettle: ${JSON.stringify(st.hits.slice(0, 5))}`);
if (!st.hits.every((h) => h.licence === 'CC0' || h.licence === 'CC BY 4.0')) problems.push('a model without a permissive licence is listed');
const cards = page.locator('#pg-studio .studiocard');
if (!(await cards.count())) problems.push('no cards for the hits');
await until(() => [...document.querySelectorAll('#pg-studio .studiocardimg')].some((i) => i.src.startsWith('blob:') && i.complete && i.naturalWidth > 0), 10000, 'no thumbnail showed');
if (!thumbsAsked.every((u) => /^https:\/\/(media\.sketchfab\.com|cdn\.polyhaven\.com)\//.test(u))) problems.push(`thumbnails asked from elsewhere: ${thumbsAsked.slice(0, 3)}`);
await page.screenshot({ path: `${out}/studiomake-search.png` });
// a British word for an American category, and a synonym
for (const [q, re] of [['telly', /tv|telev|monitor|screen/i], ['couch', /sofa|couch|settee|chesterfield/i]]) {
  await page.evaluate((q) => window.__ghosty.studio.search(q), q);
  st = await S();
  if (!st.hits.slice(0, 6).some((h) => re.test(h.name))) problems.push(`"${q}" did not find ${re}: ${st.hits.slice(0, 6).map((h) => h.name)}`);
}
// open one: the first chair for "oak dining chair"
await page.fill('#pg-studio input[aria-label="Search the catalogue"]', 'oak dining chair');
await btn('FIND').click();
await until(() => window.__ghosty.studio.state().hits.length > 0, 10000, '"oak dining chair" found nothing');
const firstName = (await S()).hits[0].name;
await cards.first().click();
await until((n) => window.__ghosty.studio.state().title === n && window.__ghosty.studio.state().parts.length > 0, 30000, `the catalogue model did not open: ${JSON.stringify((await S())?.title)}`, firstName);
st = await S();
if (!/ by .+ · (CC0|CC BY 4\.0)/.test(st.credit)) problems.push(`the opened model's credit has no author and licence: "${st.credit}"`);
if (!(await page.locator('#pg-studio .studiocredit').textContent()).includes(st.credit)) problems.push('the credit is not shown on the scene');
if (!(await page.locator('#pg-studio a.studiosource', { hasText: 'ITS PAGE ON' }).count())) problems.push('no link to the model\'s own page');
if (!hfAsked.length) problems.push('the model was not fetched from Hugging Face');
await page.screenshot({ path: `${out}/studiomake-opened.png` });
// a Poly Haven one, through the brain
await page.evaluate(() => window.__ghosty.studio.openCatalog('ph:Sofa_01'));
await until(() => window.__ghosty.studio.state().title === 'Sofa 01' && /Some Haven Artist · CC0/.test(window.__ghosty.studio.state().credit), 30000, `the Poly Haven model did not open with its credit: ${JSON.stringify((await S())?.credit)}`);
let wide = await sideways();
if (wide.length) problems.push(`MODELS sticks out sideways: ${wide.join(', ')}`);

// ---- MAKE ANYTHING: a real model first; MAKE A NEW ONE → the generator's steps, the drawing, the model ----
await pane('PHOTO');
const what = page.locator('#pg-studio input[aria-label="What to make"]');
await what.fill('a velvet couch');
await btn('MAKE IT').click();
await until(() => /^Found a real model: /.test(window.__ghosty.studio.state().makeNote), 30000, `MAKE IT did not open a real model first: ${JSON.stringify((await S())?.makeNote)}`);
if (generated.length) problems.push('the generator was asked although the catalogue had one');
await btn('MAKE A NEW ONE INSTEAD').click();
await until(() => window.__ghosty.studio.state().title === 'a velvet couch' && /^Made by Stable Fast 3D, with its colours/.test(window.__ghosty.studio.state().makeNote), 30000, `the generated model did not open: ${JSON.stringify((await S())?.makeNote)}`);
st = await S();
if (!/Stable Fast 3D/.test(st.credit)) problems.push(`the generated model is not credited: "${st.credit}"`);
if (!(await page.locator('#pg-studio img[alt="The picture it is being made from"]').isVisible())) problems.push('the drawing was not shown');
if (generated[0]?.prompt !== 'a velvet couch') problems.push(`the generator was asked ${JSON.stringify(generated)}`);
await until(() => window.__ghosty.studio.state().kept.includes('a velvet couch'), 5000, 'the made model was not kept on the phone');
await page.screenshot({ path: `${out}/studiomake-made.png` });
// busy: a stand-in at once, the reason in words, TRY AGAIN; UNDO goes back
genAnswer = 'busy';
await page.evaluate(() => window.__ghosty.studio.makeAnything('an oak dining table 180 cm', true));
await until(() => window.__ghosty.studio.state().standIn && /Not made: the free 3-D generators are busy right now — try again in a minute/.test(window.__ghosty.studio.state().makeNote), 20000, `no stand-in with the reason when busy: ${JSON.stringify((await S())?.makeNote)}`);
st = await S();
if (!st.parts.some((p) => p.name === 'Top') || st.parts.filter((p) => /^Leg/.test(p.name)).length !== 4) problems.push(`the stand-in table: ${st.parts.map((p) => p.name)}`);
if (!/stand-in/.test(st.credit)) problems.push(`the stand-in is not said to be one: "${st.credit}"`);
if (!(await btn('TRY AGAIN').isVisible())) problems.push('no TRY AGAIN after a busy generator');
await page.screenshot({ path: `${out}/studiomake-standin.png` });
await btn('UNDO').click();
await until(() => window.__ghosty.studio.state().title === 'a velvet couch', 20000, `UNDO did not go back to the model before: ${JSON.stringify((await S())?.title)}`);
// nothing can draw it here: ASK GHOSTY is offered
genAnswer = 'no_picture';
await page.evaluate(() => window.__ghosty.studio.makeAnything('a flux capacitor', true));
await until(() => [...document.querySelectorAll('#pg-studio .studiopanel button')].some((b) => b.textContent === 'ASK GHOSTY'), 20000, 'no ASK GHOSTY when nothing could draw it');
wide = await sideways();
if (wide.length) problems.push(`MAKE sticks out sideways: ${wide.join(', ')}`);

// ---- PHOTO → TEXTURED 3D: the cut-out is shown and the textured model opens ----
// a real photo-sized PNG drawn in the page (a red box on white)
const photo = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = 600;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 800, 600);
  g.fillStyle = '#c33';
  g.fillRect(250, 150, 300, 300);
  const b = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
});
await page.locator('#pg-studio input[type=file][accept="image/*"]').setInputFiles({ name: 'lamp.png', mimeType: 'image/png', buffer: Buffer.from(photo, 'base64') });
if (!(await until(() => !document.querySelector('#pg-studio img[alt="Your photo"]')?.hidden, 20000, 'the chosen photo is not shown')))
  problems.push(await page.evaluate(() => `photo: ${document.querySelector('#pg-studio img[alt="Your photo"]')?.outerHTML?.slice(0, 120)} · toasts: ${[...document.querySelectorAll('.toast, [class*=toast]')].map((t) => t.textContent).join(' | ')}`));
await btn('MAKE 3-D').click();
await until(() => window.__ghosty.studio.state().title === 'From a photo' && window.__ghosty.studio.state().parts.length > 0, 30000, `the photo model did not open: ${JSON.stringify((await S())?.photoNote)}`);
if (!(await page.locator('#pg-studio img[alt="Your photo with the background removed"]').isVisible())) problems.push('the cut-out was not shown');
if (!/^Made by Stable Fast 3D, with its colours/.test((await S()).photoNote)) problems.push(`the photo note: ${(await S()).photoNote}`);
if (!/Stable Fast 3D/.test((await S()).credit)) problems.push('the photo model is not credited');
await page.screenshot({ path: `${out}/studiomake-photo.png` });
wide = await sideways();
if (wide.length) problems.push(`PHOTO sticks out sideways: ${wide.join(', ')}`);

const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`security policy blocked: ${csp.join(' | ')}`);
await browser.close();
if (problems.length) {
  console.log(`studiomake spec (${isWebKit ? 'webkit' : 'chromium'}): ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log(`studiomake spec (${isWebKit ? 'webkit' : 'chromium'}): all good`);
