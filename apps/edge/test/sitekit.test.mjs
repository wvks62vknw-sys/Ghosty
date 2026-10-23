// The website kit and the website project (packages/shared/src/sitekit, src/sitebuild.ts): every block
// draws valid, accessible HTML from its typed slots; every template makes a site that passes the quality
// gates and the publish gate with no model at all (the offline path); the gates catch what they claim
// to; the writers can never invent a number; pictures are credited; and the project runs its six steps
// from a request to a published link, resumably. Run from sites.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({
  stdin: {
    contents: `export * from '../../packages/shared/src/sitekit/index.ts';
export { BEHAVIOURS } from '../../packages/shared/src/sitekit/assemble.ts';
export * as SB from './src/sitebuild.ts';
export * as PJ from './src/projects.ts';
export { checkHtml } from './src/tools/check.ts';
export { siteTools, siteStore, PAGE_CSP } from './src/tools/sites.ts';
export { siteMessage } from '../web/src/offline/sitework.ts';
export { neurons, cost, FREE_NEURONS } from './src/neurons.ts';`,
    resolveDir: at('..'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outfile: at('./.build/sitekit.mjs'),
  logLevel: 'warning',
});
await build({ entryPoints: [at('../../web/src/offline/site.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/offline-site.mjs'), logLevel: 'warning' });
const K = await import('./.build/sitekit.mjs');
const { SB, PJ } = K;

// ── fixtures ──────────────────────────────────────────────────────────────────────

const PHOTO = K.commons('4/4d/Barber_cutting_hair_with_comb._Back_view_of_man_in_barber_shop.jpg', 6016, 4016, 'A barber at work', 'Nenad Stojkovic', 'CC BY 2.0', 'Barber cutting hair');
/** A business with every fact a block can need, all given by the "owner". */
const FULL = {
  request: 'build a website for my barber shop in Walsall',
  kind: 'barber',
  name: 'Fade & Co. Barbers',
  town: 'Walsall',
  address: '27 Park Street',
  postcode: 'WS1 1LY',
  lat: 52.58541,
  lon: -1.98305,
  phone: '07700 900461',
  email: 'hello@fadeandco.example',
  established: 2016,
  hours: [{ label: 'Mon–Fri', open: '9:00', close: '18:00', days: [1, 2, 3, 4, 5] }, { label: 'Sunday', closed: true, days: [0] }],
  services: [{ name: 'Skin fade', price: '£20', duration: '40 min' }, { name: 'Beard trim', price: '£10' }],
  reviews: [{ quote: 'Best fade I have had in years.', name: 'Jordan M.', rating: 5 }, { quote: 'Patient with my son.', name: 'Aisha R.', rating: 5 }],
  team: [{ name: 'Sam', role: 'Owner' }],
  accreditations: ['Fully insured'],
  products: [{ name: 'Beard oil', price: '£12' }],
  listings: [{ title: '3 bed semi', price: '£250,000' }],
  projects: [{ title: 'Shop refit', summary: 'New chairs' }],
  schedule: [{ time: '19:00', title: 'Doors' }],
  areas: ['Walsall', 'Bloxwich'],
  socials: { instagram: 'fadeandco' },
};

/** Sample content for a slot, shaped by its type (what a writer would produce). */
function sample(slot, key = 'x') {
  if (slot.t === 'text') return key === 'quote' ? FULL.reviews[0].quote : key === 'kind' ? 'quote' : key === 'slug' ? '' : key === 'value' ? '12' : `Sample ${key} words`.slice(0, Math.max(5, slot.max));
  if (slot.t === 'image') return PHOTO;
  if (slot.t === 'link') return { label: 'Book now', href: '#/' };
  if (slot.t === 'texts') return ['First point', 'Second point'];
  if (slot.t === 'number') return 4;
  if (slot.t === 'bool') return false;
  if (slot.t === 'list') return [0, 1, 2].slice(0, Math.min(3, slot.max)).map(() => Object.fromEntries(Object.entries(slot.of).map(([k, s]) => [k, sample(s, k)])));
  return '';
}
const sampleData = (def) => Object.fromEntries(Object.entries(def.slots).map(([k, s]) => [k, sample(s, k)]));

function onePage(def, brief = FULL) {
  const hasH1 = def.group === 'hero' || def.id === 'article';
  const sections = def.group === 'nav' || def.id.startsWith('footer') ? [{ block: 'page-header', data: { title: 'Test page', lead: 'Words.' } }] : [...(hasH1 ? [] : [{ block: 'page-header', data: { title: 'Test page', lead: 'A page for testing one block.' } }]), { block: def.id, data: sampleData(def) }];
  return {
    kind: brief.kind,
    name: brief.name,
    theme: { palette: 'barber', fonts: 'condensed', shape: 'sharp', scheme: 'dark' },
    tone: 'plain',
    header: def.group === 'nav' && def.id !== 'page-header' ? [{ block: def.id, data: sampleData(def) }] : [{ block: 'nav-classic', data: {} }],
    footer: def.group === 'footer' && def.id.startsWith('footer') ? [{ block: def.id, data: sampleData(def) }] : [{ block: 'footer-simple', data: {} }],
    pages: [{ slug: '', label: 'Home', title: 'Fade & Co. Barbers — barbers in Walsall', description: 'Fades, cuts and shaves in Walsall, with a booking form and prices, for testing every block.', sections: def.group === 'nav' && def.id !== 'page-header' ? [{ block: 'page-header', data: { title: 'Home page', lead: 'Words.' } }] : sections }],
    confirm: [],
  };
}

// ── blocks ────────────────────────────────────────────────────────────────────────

test('the kit has about forty blocks across every group, each with typed slots and its own scoped CSS', () => {
  assert.ok(K.BLOCK_LIST.length >= 40, `${K.BLOCK_LIST.length} blocks`);
  const groups = new Set(K.BLOCK_LIST.map((b) => b.group));
  for (const g of ['nav', 'hero', 'content', 'proof', 'commerce', 'media', 'form', 'cta', 'footer', 'blog']) assert.ok(groups.has(g), `no ${g} block`);
  assert.ok(K.BLOCK_LIST.filter((b) => b.group === 'hero').length >= 6, 'several heroes');
  for (const b of K.BLOCK_LIST) {
    assert.match(b.css, new RegExp(`\\.b-${b.id}\\b|\\.nav\\b|\\.foot\\b`), `${b.id} CSS is scoped`);
    assert.ok(b.about.length > 20, `${b.id} says what it is for`);
    assert.ok(typeof b.slots === 'object');
  }
});

test('every block draws valid HTML (the publish gate) and passes the accessibility, link and layout gates', () => {
  for (const def of K.BLOCK_LIST) {
    const plan = onePage(def);
    const a = K.assemble(plan, FULL);
    assert.deepEqual(a.dropped, [], `${def.id}: ${a.dropped.join('; ')}`);
    assert.ok(a.blocks.includes(def.id), `${def.id} was drawn`);
    const c = K.checkHtml(a.html);
    assert.deepEqual(c.errors, [], `${def.id} publish check: ${c.errors.join(' | ')}`);
    const g = K.runGates(a.html, plan, FULL);
    const bad = g.findings.filter((f) => f.level === 'error' && ['a11y', 'links', 'layout', 'honesty'].includes(f.gate));
    assert.deepEqual(bad.map((f) => f.text), [], `${def.id}: gates`);
  }
});

test('slot text is escaped: a writer cannot inject markup through any block', () => {
  const evil = '<img src=x onerror=alert(1)>';
  for (const def of K.BLOCK_LIST) {
    const plan = onePage(def);
    const sec = plan.pages[0].sections.find((s) => s.block === def.id) ?? plan.header[0];
    for (const k of Object.keys(sec.data)) if (typeof sec.data[k] === 'string') sec.data[k] = evil;
    const html = K.assemble(plan, FULL).html;
    assert.ok(!html.includes('<img src=x'), `${def.id} let markup through`);
  }
});

test('blocks that need the owner\'s real facts are left out without them (never invented reviews, team, awards)', () => {
  const bare = { ...FULL, reviews: undefined, team: undefined, accreditations: undefined, products: undefined, listings: undefined, projects: undefined };
  for (const id of ['testimonials-grid', 'testimonial-feature', 'team', 'logos', 'product-cards', 'property-listings', 'case-studies']) {
    const plan = onePage(K.BLOCKS[id], bare);
    const a = K.assemble(plan, bare);
    assert.ok(!a.blocks.includes(id), `${id} drawn without facts`);
    assert.match(a.dropped.join(' '), new RegExp(`${id} left out`));
  }
});

// ── design system ─────────────────────────────────────────────────────────────────

test('every palette passes WCAG AA for every text pair, light and dark', () => {
  for (const id of K.PALETTE_IDS) assert.deepEqual(K.contrastProblems({ palette: id, fonts: 'system', shape: 'soft', scheme: 'auto' }), [], id);
  assert.ok(K.contrast('#ffffff', '#000000') > 20.9);
  assert.equal(Math.round(K.contrast('#777777', '#ffffff') * 100) / 100, 4.48);
});

test('the theme CSS carries tokens, dark mode for auto, reduced motion and no fixed widths wider than a phone', () => {
  const css = K.themeCss({ palette: 'espresso', fonts: 'editorial', shape: 'round', scheme: 'auto' });
  for (const t of ['--step-5', '--space-xl', '--r-btn:999px', '--shadow-2', '--ease', 'prefers-color-scheme:dark', 'prefers-reduced-motion', ':focus-visible']) assert.ok(css.includes(t), t);
  assert.ok(!/(?:^|[;{])\s*width:\s*(?:[4-9]\d\d|\d{4,})px/m.test(css), 'no wide fixed widths');
  assert.equal(K.fontsHref('system'), '');
  assert.match(K.fontsHref('editorial'), /^https:\/\/fonts\.googleapis\.com\/css2\?family=Fraunces.*&display=swap$/);
});

// ── templates (the whole site with no model: the offline path) ────────────────────

test('every template builds a complete site from a one-line request with no model: valid, gated, small, honest', () => {
  for (const k of K.KINDS) {
    const brief = K.briefFrom(`a website for a ${k.label.toLowerCase()} in Dudley`, { kind: k.id });
    const { plan, brief: b } = K.planFrom(brief, { url: `https://ghosty.example/s/${k.id}` });
    assert.ok(plan.pages.length >= 3, `${k.id}: ${plan.pages.length} pages`);
    assert.ok(plan.confirm.length, `${k.id}: lists what to confirm`);
    const a = K.assemble(plan, b);
    assert.ok(a.html.length < 200_000, `${k.id}: ${a.html.length} bytes`);
    assert.deepEqual(K.checkHtml(a.html).errors, [], `${k.id} publish check`);
    const g = K.runGates(a.html, plan, b);
    assert.deepEqual(g.findings.filter((f) => f.level === 'error').map((f) => f.text), [], `${k.id} gates`);
    assert.ok(g.score >= 80, `${k.id} score ${g.score}`);
    assert.ok(!/testimonial|blockquote/.test(a.blocks.join(' ') + a.html.replace(/<script[\s\S]*?<\/script>/g, '').match(/<blockquote/g)?.join('') ?? ''), `${k.id}: no reviews were given, none shown`);
    assert.ok(a.html.includes(b.name.replace(/&/g, '&amp;')), `${k.id}: the name is on the page`);
  }
});

test('the brief: kind, town, name, phone, email, postcode, hours and prices read from plain words; what is missing is asked', () => {
  const t = 'Build a website for my friend\'s barber shop in Walsall called "Fade & Co", 07700 900461, fade@example.com, WS1 1LY. Mon-Fri 9-6, Sat 9-4, Sun closed. Skin fade £20, beard trim £10';
  const b = K.briefFrom(t);
  assert.equal(b.kind, 'barber');
  assert.equal(b.town, 'Walsall');
  assert.equal(b.name, 'Fade & Co');
  assert.equal(b.phone, '07700 900461');
  assert.equal(b.email, 'fade@example.com');
  assert.equal(b.postcode, 'WS1 1LY');
  assert.deepEqual(b.hours.map((h) => [h.label, h.open, h.close, h.closed ?? false, h.days.join('')]), [['Mon–Fri', '9:00', '18:00', false, '12345'], ['Saturday', '9:00', '16:00', false, '6'], ['Sunday', undefined, undefined, true, '0']]);
  assert.deepEqual(b.services.map((s) => [s.name, s.price]), [['Skin fade', '£20'], ['Beard trim', '£10']]);
  assert.deepEqual(K.missing(b).map((m) => m.key), ['about']);
  assert.equal(K.kindOf('a site for my plumbing business'), 'trades');
  assert.equal(K.kindOf('landing page for my app'), 'saas');
  assert.equal(K.kindOf('our dental practice'), 'clinic');
  assert.equal(K.townOf('a cafe based in Sutton Coldfield'), 'Sutton Coldfield');
  assert.deepEqual(K.missing(K.briefFrom('a website for a bakery')).map((m) => m.key).slice(0, 3), ['name', 'town', 'phone']);
});

// ── the gates catch what they claim to ────────────────────────────────────────────

test('the gates catch: missing alt, unlabelled fields, two h1s, broken routes, bad phone links, wide CSS, long words, clichés, fake reviews, uncredited photos', () => {
  const { plan, brief } = K.planFrom({ ...FULL });
  const good = K.assemble(plan, brief).html;
  const g0 = K.runGates(good, plan, brief);
  assert.equal(g0.errors, 0, K.formatGates(g0));
  const breakIt = (fn) => K.runGates(fn(good), plan, brief).findings.map((f) => f.text).join('\n');
  assert.match(breakIt((h) => h.replace(/<img ([^>]*?)alt="[^"]*"/, '<img $1')), /no alt text/);
  assert.match(breakIt((h) => h.replace(/<label for="[^"]+"/, '<label')), /has no label/);
  assert.match(breakIt((h) => h.replace('</h1>', '</h1><h1>Again</h1>')), /2 main headings/);
  assert.match(breakIt((h) => h.replace('href="#/prices"', 'href="#/pricez"')), /does not exist: #\/pricez/);
  assert.match(breakIt((h) => h.replace(/href="tel:[^"]+"/, 'href="tel:123"')), /phone link looks wrong/);
  assert.match(breakIt((h) => h.replace('</style>', '.x{width:900px}\n</style>')), /fixed width of 900px/);
  assert.match(breakIt((h) => h.replace(/<h1>[\s\S]*?<\/h1>/, '<h1>Supercalifragilisticexpialidocious</h1>')), /too long to fit across a phone/);
  assert.match(breakIt((h) => h.replace('</main>', '<p>Look no further for a cut.</p></main>')), /stock phrase "look no further"/);
  assert.match(breakIt((h) => h.replace('</main>', '<blockquote><p>Amazing service, ten out of ten.</p></blockquote></main>')), /not one the owner gave/);
  assert.match(breakIt((h) => h.replace(/<details class="credits"[\s\S]*?<\/details>/, '')), /no credits list/);
  assert.match(breakIt((h) => h.replace('lang="en-GB"', '')), /no language/);
  const lowContrast = K.runGates(good, { ...plan, theme: { ...plan.theme } }, brief);
  assert.equal(lowContrast.errors, 0);
});

// ── pictures and credits ──────────────────────────────────────────────────────────

test('pictures: Openverse and Commons results are kept only with a usable licence and size, with srcset and credit; the footer credits every one', () => {
  const ok = K.fromOpenverse({ url: 'https://live.staticflickr.com/65535/52811234567_abcdef1234_b.jpg', width: 2048, height: 1365, license: 'by-sa', license_version: '2.0', creator: 'Jane Doe', foreign_landing_url: 'https://www.flickr.com/photos/jane/52811234567', source: 'flickr', title: 'Barber chair' }, 'A barber chair');
  assert.equal(ok.credit.license, 'CC BY-SA 2.0');
  assert.equal(ok.credit.author, 'Jane Doe');
  assert.equal(ok.credit.source, 'Flickr');
  assert.deepEqual(ok.srcset.map(([, w]) => w), [400, 640, 800, 1024]);
  assert.match(ok.srcset[0][0], /_w\.jpg$/);
  assert.equal(K.fromOpenverse({ url: 'https://x.example/a.jpg', width: 3000, height: 2000, license: 'by-nc' }, 'x'), undefined, 'non-commercial refused');
  assert.equal(K.fromOpenverse({ url: 'https://x.example/a.jpg', width: 640, height: 480, license: 'cc0' }, 'x'), undefined, 'too small');
  assert.equal(K.fromOpenverse({ url: 'http://x.example/a.jpg', width: 3000, height: 2000, license: 'cc0' }, 'x'), undefined, 'not https');
  const c = K.fromCommons({ title: 'File:Shop.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Shop.jpg', width: 3000, height: 2000, mime: 'image/jpeg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Shop.jpg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: '<a href="x">Ann</a>' } } }] }, 'A shop');
  assert.equal(c.credit.author, 'Ann');
  assert.deepEqual(c.srcset.map(([, w]) => w), [500, 960, 1280, 1920]);
  assert.match(c.src, /\/thumb\/a\/ab\/Shop\.jpg\/960px-Shop\.jpg$/);
  assert.equal(K.fromCommons({ imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/S.jpg', width: 3000, height: 2000, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC BY-NC 4.0' } } }] }, 'x'), undefined);
  const u = K.fromUnsplash({ urls: { raw: 'https://images.unsplash.com/photo-1?ixid=a' }, width: 4000, height: 3000, user: { name: 'Kim' }, links: { html: 'https://unsplash.com/photos/1' } }, 'Cafe');
  assert.equal(u.credit.source, 'Unsplash');
  assert.equal(u.srcset.length, 4);
  // every stock picture is credited and its credit reaches the page
  for (const set of Object.values(K.STOCK)) for (const i of [set.hero, ...set.story, ...set.gallery]) {
    assert.ok(i.credit && i.credit.author && i.credit.licenseUrl && i.alt, i.src);
    assert.match(i.srcset[0][0], /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\//);
  }
  const { plan, brief } = K.planFrom({ ...FULL });
  const a = K.assemble(plan, brief);
  assert.deepEqual(K.uncredited(a.images), []);
  const credits = a.html.match(/<details class="credits"[\s\S]*?<\/details>/)[0];
  for (const i of a.images) assert.ok(credits.includes(K.esc(i.credit.author)), `credit for ${i.credit.author}`);
  assert.ok(credits.includes('creativecommons.org/licenses/by/2.0/'));
});

test('images are responsive and lazy: srcset + sizes, real width/height, only the first screen loads eagerly', () => {
  const { plan, brief } = K.planFrom({ ...FULL });
  const html = K.assemble(plan, brief).html.replace(/<script[\s\S]*?<\/script>/g, '');
  const imgs = html.match(/<img\b[^>]*>/g);
  for (const i of imgs) {
    assert.match(i, / width="\d+" height="\d+"/);
    assert.match(i, / srcset="[^"]+ \d+w/);
    assert.match(i, / sizes="/);
  }
  assert.ok(imgs.filter((i) => /loading="eager"/.test(i)).length <= 3);
});

// ── writers: never a new fact ─────────────────────────────────────────────────────

test('the writer\'s answer is applied only within limits and never adds a number, a link or a stock phrase', () => {
  const { plan, brief } = K.planFrom({ ...FULL });
  const w = K.writePrompt(plan, brief, 0);
  assert.ok(w.pieces.length > 5);
  assert.match(w.system, /^SITE WRITER/);
  assert.ok(!w.pieces.some((p) => p.text === 'Best fade I have had in years.'), 'reviews are never offered for rewriting');
  const answer = { 0: 'Walsall barbers', 1: 'Cuts from £15 today', 2: 'x'.repeat(500), 3: 'Visit https://evil.example', 4: 'Look no further for a fade' };
  const before = structuredClone(plan);
  const r = K.applyWrites(plan, w.pieces, answer, brief);
  assert.equal(r.changed, 1);
  assert.equal(r.refused.length, 4);
  assert.match(r.refused.join(' '), /adds numbers not in the facts \(15\)/);
  assert.match(r.refused.join(' '), /too long/);
  assert.match(r.refused.join(' '), /links/);
  assert.match(r.refused.join(' '), /stock phrase/);
  assert.notDeepEqual(plan, before);
  // a number already in the facts may be used
  assert.equal(K.rejectRewrite('Skin fades', 'Skin fades for £20', 60, brief), '');
  assert.deepEqual(K.jsonIn('Sure!\n```json\n{"a": "b {c}"}\n```'), { a: 'b {c}' });
  assert.equal(K.jsonIn('no json here'), null);
});

test('the planner and the critic: only valid looks; the hero, forms and map are never dropped; bad fixes are refused', () => {
  const { plan, brief } = K.planFrom({ ...FULL });
  const notes = K.applyPlan(plan, { palette: 'gym', fonts: 'nope', scheme: 'light', drop: ['hero-image', 'gallery-grid'], tone: 'bold and local' });
  assert.equal(plan.theme.palette, 'gym');
  assert.equal(plan.theme.fonts, 'condensed', 'an unknown font is ignored');
  assert.deepEqual(notes, ['kept hero-image', 'dropped gallery-grid']);
  const n = plan.pages[0].sections.length;
  const fx = K.applyFixes(plan, brief, { verdict: 'Good', fixes: [{ page: 'home', section: 0, kind: 'drop', why: 'x' }, { page: 'home', section: 1, kind: 'text', key: 'title', value: 'Prices from £14', why: 'cheaper' }, { page: 'home', section: 1, kind: 'tone', value: 'alt', why: 'rhythm' }, { page: 'nowhere', section: 0, kind: 'drop' }] });
  assert.equal(plan.pages[0].sections.length, n, 'the hero stays');
  assert.equal(fx.applied.length, 1);
  assert.match(fx.skipped.join(' '), /kept hero-image/);
  assert.match(fx.skipped.join(' '), /adds numbers/);
});

// ── behaviours ────────────────────────────────────────────────────────────────────

test('the page script parses and has no network calls (published pages are sandboxed)', () => {
  for (const [name, js] of Object.entries(K.BEHAVIOURS)) {
    if (!js) continue;
    assert.doesNotThrow(() => new Function(js), name);
    assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(js), `${name} uses the network`);
  }
  assert.match(K.PAGE_CSP, /frame-src[^;]*https:\/\/www\.openstreetmap\.org/);
});

// ── the website project ───────────────────────────────────────────────────────────

class MemStorage {
  m = new Map();
  async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))])) : this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b)); else this.m.set(k, structuredClone(v)); }
  async delete(k) { return Array.isArray(k) ? k.filter((x) => this.m.delete(x)).length : this.m.delete(k); }
  async list({ prefix = '' } = {}) { return new Map([...this.m].filter(([k]) => k.startsWith(prefix))); }
  alarm = null;
  async setAlarm(t) { this.alarm = t; }
  async getAlarm() { return this.alarm; }
}
function deps(storage, complete) {
  const notes = [];
  let busy = false;
  const env = { PUBLIC_ORIGIN: 'https://ghosty.example' };
  return {
    env,
    storage,
    library: { available: false },
    tools: [],
    tctx: { env, storage, origin: 'https://ghosty.example', vault: { get: async () => null }, emit() {}, progress() {} },
    system: async () => 'SYSTEM',
    notify: async (i) => notes.push(i),
    busy: { get: () => busy, set: (v) => (busy = v) },
    complete,
    notes,
  };
}
async function runAll(d, id) {
  for (let i = 0; i < 12; i++) {
    const job = (await (await import('./.build/sitekit.mjs')).PJ.loadProject(d, id));
    if (job.status !== 'active') return job;
    const sched = await d.storage.get('jobs');
    const pj = (sched ?? []).find((j) => j.kind === 'project' && j.text === id) ?? { id: 'j', kind: 'project', text: id };
    await PJ.runProjectStep(d, pj);
  }
  return PJ.loadProject(d, id);
}

test('build_website asks once, naming the link and the defaults it will use, and starts a six-step site project', async () => {
  const tool = K.siteTools.find((t) => t.name === 'build_website');
  assert.equal(tool.risk, 'confirm');
  const ctx = { env: { PUBLIC_ORIGIN: 'https://ghosty.example' }, storage: new MemStorage(), origin: 'https://ghosty.example' };
  const ap = await tool.approval({ request: "build a website for my friend's barber shop in Walsall" }, ctx);
  assert.match(ap.reason, /publish it at https:\/\/ghosty\.example\/s\/walsall-barber/);
  assert.match(ap.reason, /defaults for: name, phone, hours, services/);
  const out = await tool.run({ request: "build a website for my friend's barber shop in Walsall", name: 'Fade & Co' }, ctx);
  assert.match(out, /https:\/\/ghosty\.example\/s\/fade-co/);
  const [p] = await PJ.listProjects(ctx);
  assert.equal(p.kind, 'site');
  assert.deepEqual(p.steps.map((s) => s.title), SB.SITE_STEPS.map((s) => s.title));
  const job = await SB.loadSiteJob(ctx, p.id);
  assert.equal(job.brief.kind, 'barber');
  assert.equal(job.brief.town, 'Walsall');
});

test('a website from one request: six steps with a model — planned, written, built, gated, critiqued from the layout, kept as a draft with what to confirm, then published once confirmed', async () => {
  const st = new MemStorage();
  const calls = [];
  const d = deps(st, async (messages) => {
    const sys = messages[0].content;
    calls.push(sys.slice(0, 12));
    if (/^SITE PLANNER/.test(sys)) return { message: { role: 'assistant', content: '{"palette":"barber","fonts":"condensed","shape":"sharp","scheme":"dark","tone":"sharp and local","drop":[]}' } };
    if (/^SITE WRITER/.test(sys)) return { message: { role: 'assistant', content: '{"0":"Barbers in the heart of Walsall"}' } };
    if (/^SITE CRITIC/.test(sys)) return { message: { role: 'assistant', content: '{"verdict":"Strong and clear.","score":8,"fixes":[{"page":"home","section":1,"kind":"tone","value":"alt","why":"rhythm"}]}' } };
    throw new Error('unexpected call');
  });
  const ctx = { env: d.env, storage: st, origin: 'https://ghosty.example' };
  await SB.startSiteBuild({ request: "build a website for my friend's barber shop in Walsall called Fade & Co, 07700 900461", name: 'Fade & Co' }, ctx);
  const [p0] = await PJ.listProjects(ctx);
  const p = await runAll(d, p0.id);
  assert.equal(p.status, 'done', p.note);
  assert.deepEqual(calls.map((c) => c.slice(0, 11)).filter((c, i, a) => a.indexOf(c) === i), ['SITE PLANNE', 'SITE WRITER', 'SITE CRITIC']);
  assert.equal(await K.siteStore(undefined, st).get('fade-co'), undefined, 'typical hours and prices: not public until the owner confirms');
  const report = p.steps[5].result;
  assert.match(report, /Draft — not public yet\. It goes live at https:\/\/ghosty\.example\/s\/fade-co once you confirm/);
  assert.match(report, /layout analysis \(no screenshots were possible\)/);
  assert.match(report, /Please confirm: .*opening hours/);
  assert.match(report, /Fixed: .*alt background/);
  assert.equal(d.notes.length, 1, 'one notification, at the end');
  assert.match(d.notes[0].text, /Draft — not public yet/);
  // The owner confirms: the approval names the list, and the run puts the checked draft live.
  const tool = K.siteTools.find((t) => t.name === 'build_website');
  const ap = await tool.approval({ request: 'those are right, publish it', link_name: 'fade-co' }, ctx);
  assert.match(ap.reason, /Publish the website ".*Fade & Co.*" at https:\/\/ghosty\.example\/s\/fade-co\? You are confirming what I assumed: .*opening hours/);
  assert.match(await tool.run(ap.args, ctx), /live now at https:\/\/ghosty\.example\/s\/fade-co/);
  const site = await K.siteStore(undefined, st).get('fade-co');
  assert.ok(site, 'published');
  assert.match(site.html, /Barbers in the heart of Walsall/, 'the writer\'s words reached the page');
  assert.deepEqual(K.checkHtml(site.html).errors, []);
});

test('with no model free, the project waits once, then builds and publishes from the templates alone and says so', async () => {
  const st = new MemStorage();
  let asked = 0;
  const d = deps(st, async () => {
    asked++;
    throw Object.assign(new Error('Every model I can reach is cooling down after rate limits.'), { waitMs: 40_000 });
  });
  const ctx = { env: d.env, storage: st, origin: 'https://ghosty.example' };
  await SB.startSiteBuild({ request: 'a website for a cafe in Bilston called Little Fern' }, ctx);
  const [p0] = await PJ.listProjects(ctx);
  const p = await runAll(d, p0.id);
  assert.equal(p.status, 'done', p.note);
  assert.ok(asked >= 2, 'it asked for a model, waited once, then went ahead');
  assert.equal(await K.siteStore(undefined, st).get('little-fern'), undefined, 'a draft until confirmed');
  assert.match(p.steps[5].result, /Done without an AI model/);
  const job = await SB.loadSiteJob(ctx, p0.id);
  await SB.confirmSite(job, ctx);
  assert.match((await K.siteStore(undefined, st).get('little-fern')).html, /Little Fern/);
});

test('screenshots: the free keyless service\'s picture is used; a "generating" placeholder or a failure gives null', async () => {
  const real = globalThis.fetch;
  try {
    const jpeg = new Uint8Array(20_000).fill(7);
    globalThis.fetch = async (u) => {
      const url = String(u);
      if (url.startsWith('https://api.microlink.io/')) return new Response(JSON.stringify({ status: 'success', data: { screenshot: { url: 'https://iad.microlink.io/x.jpeg' } } }), { headers: { 'content-type': 'application/json' } });
      if (url === 'https://iad.microlink.io/x.jpeg') return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } });
      throw new TypeError('offline');
    };
    assert.match(await SB.screenshot('https://ghosty.example/s/a', 390, 844), /^data:image\/jpeg;base64,/);
    globalThis.fetch = async (u) => (String(u).includes('thum.io') ? new Response(new Uint8Array(30_000), { headers: { 'content-type': 'image/gif' } }) : new Response('{}', { status: 429 }));
    assert.equal(await SB.screenshot('https://ghosty.example/s/a', 390, 844), null);
  } finally {
    globalThis.fetch = real;
  }
});

test('picture search: Openverse first, Commons next, every result credited; nothing usable gives an empty list, not an error', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = async (u) => {
      const url = String(u);
      if (url.startsWith('https://api.openverse.org/')) return new Response(JSON.stringify({ results: [{ url: 'https://live.staticflickr.com/1/2_abc_b.jpg', width: 2000, height: 1300, license: 'by', license_version: '2.0', creator: 'A', foreign_landing_url: 'https://flickr.com/x', source: 'flickr' }, { url: 'https://x.example/nc.jpg', width: 3000, height: 2000, license: 'by-nc' }] }));
      if (url.startsWith('https://commons.wikimedia.org/')) return new Response(JSON.stringify({ query: { pages: { 1: { title: 'File:B.jpg', imageinfo: [{ url: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/B.jpg', width: 2400, height: 1600, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC0' }, Artist: { value: 'B' } } }] } } } }));
      throw new TypeError('offline');
    };
    const r = await SB.findPictures('gym', 3);
    assert.equal(r.images.length, 2);
    assert.deepEqual(r.from, ['Openverse', 'Wikimedia Commons']);
    assert.ok(r.images.every((i) => i.credit));
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    assert.deepEqual((await SB.findPictures('gym', 3)).images, []);
  } finally {
    globalThis.fetch = real;
  }
});

// ── offline, on the phone ─────────────────────────────────────────────────────────

test('offline: a website request is recognised, the answers are folded into the brief, and the worker builds a gated site', () => {
  for (const t of ['build me a website for my cafe', 'can you make a site for my plumbing business', 'I need a landing page for my app']) assert.ok(K.siteAsk(t), t);
  for (const t of ['unpublish site acme', 'what is a website', 'build me a timer']) assert.ok(!K.siteAsk(t), t);
  assert.equal(K.townOf("build a website for my friend's barber shop in walsall"), 'Walsall');
  const b = K.briefFrom('build me a website for my cafe in Bilston');
  const asked = K.missing(b).map((m) => m.key);
  assert.deepEqual(asked.slice(0, 3), ['name', 'phone', 'hours']);
  const m = K.mergeAnswers(b, "Little Fern, 01902 000512, Mon-Fri 8-4, Sat 9-3, Sun closed, flat white £3.20, everything's baked here every morning", asked);
  assert.equal(m.name, 'Little Fern');
  assert.equal(m.phone, '01902 000512');
  assert.equal(m.hours.length, 3);
  assert.deepEqual(m.services.map((x) => [x.name, x.price]), [['Flat white', '£3.20']]);
  assert.match(m.about, /baked here every morning/);
  let out;
  K.siteMessage({ site: 'build', req: 7, brief: m }, (r) => (out = r));
  assert.equal(out.req, 7);
  assert.ok(!out.error, out.error);
  assert.deepEqual(out.pages, ['Home', 'Menu', 'About', 'Visit']);
  assert.equal(out.problems, 0);
  assert.match(out.html, /Little Fern/);
  assert.match(out.html, /8:00–16:00/);
  assert.match(out.html, /href="tel:\+441902000512"/);
  assert.deepEqual(K.checkHtml(out.html).errors, []);
});

test("the phone's site questions: \"cancel\" drops them, and they never wait more than half an hour", async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const O = await import('./.build/offline-site.mjs');
  const ask = (at) => store.set('ghosty.offlineSite', JSON.stringify({ brief: { request: 'a website for my café' }, asked: ['name'], at }));
  ask(Date.now());
  assert.equal(O.offlineSiteTurn('Little Fern, Bilston'), true, 'the next message answers the questions');
  assert.equal(O.offlineSiteTurn('cancel that'), false, 'cancel is not an answer');
  assert.equal(O.pendingSite(), null, 'and it drops the questions');
  assert.equal(O.offlineSiteTurn("what's the weather?"), false, 'so the message after is an ordinary one');
  ask(Date.now() - 31 * 60_000);
  assert.equal(O.offlineSiteTurn("what's the weather?"), false, 'questions from over half an hour ago no longer take a message over');
  delete globalThis.localStorage;
});

// ── the adversarial review's fixes (docs/build-plan/BRIEF-WEBSITES-FIX.md) ─────────────

const KIND_IDS = ['cafe', 'restaurant', 'barber', 'salon', 'trades', 'gym', 'photographer', 'shop', 'clinic', 'estate', 'portfolio', 'event', 'charity', 'saas'];
const CLAIMS_1 = /insur|guarantee|registered|CP12|Gas Safe|NHS|refund|encrypted|walk-ins|recommend|repeat customers|referral/i;

test('review 1: no template makes a trust or legal claim the owner did not make; each appears once the owner says it', () => {
  for (const kind of KIND_IDS) {
    for (const words of ['build a website for my business', 'build a website for my plumbing and heating business', 'build a website for my physio clinic', 'build a website for my electrician business']) {
      const { plan, brief } = K.planFrom(K.briefFrom(words, { kind }));
      const html = K.assemble(plan, brief).html;
      const hit = html.match(CLAIMS_1);
      assert.equal(hit, null, `${kind} (${words}): "${hit && html.slice(Math.max(0, hit.index - 60), hit.index + 40)}"`);
      for (const p of ['no card needed', 'card and cash', 'no joining fee', 'public beta']) assert.ok(!html.toLowerCase().includes(p), `${kind}: ${p}`);
      assert.ok(plan.confirm.length >= 1, `${kind}: the typical promises are listed to confirm`);
    }
  }
  // The owner's own words bring the claim in.
  const barber = K.planFrom(K.briefFrom('build a website for my barber shop, walk-ins welcome, card and cash'));
  assert.match(K.assemble(barber.plan, barber.brief).html, /Walk-ins welcome/);
  const trades = K.planFrom(K.briefFrom('build a website for my plumbing business, fully insured and every job guaranteed', { kind: 'trades' }));
  const th = K.assemble(trades.plan, trades.brief).html;
  assert.match(th, /Are you insured\?/);
  assert.match(th, /Work guaranteed/);
  assert.ok(trades.plan.confirm.some((c) => /free written quotes/.test(c)), 'the remaining typical promises are listed');
});

test('review 2: the writer and the critic cannot add a claim without digits; the honesty gate flags a claim the owner did not make', () => {
  const b0 = SB.briefOf({ request: 'build a website for my plumbing business in Walsall', name: 'Pipe Pros', phone: '07700 900461' });
  const { plan, brief } = K.planFrom(b0);
  const old = 'Local plumbing and heating in Walsall — clear quotes, tidy work, and we answer the phone.';
  assert.notEqual(K.rejectRewrite(old, 'Gas Safe registered, award-winning', 240, brief), '');
  for (const c of ['Fully insured engineers', 'Voted the best plumber in Walsall', 'Rated five stars by over a thousand customers', 'NHS approved and a Which? Trusted Trader', 'Twenty years of experience', 'Verified and certified on Checkatrade']) assert.match(K.rejectRewrite(old, c, 240, brief), /claim the owner did not make/, c);
  assert.equal(K.rejectRewrite(old, 'Plumbing and heating across Walsall, with clear quotes and tidy work.', 240, brief), '', 'plain words still pass');
  // A claim the owner made may be used.
  const said = { ...brief, accreditations: ['Gas Safe registered'] };
  assert.equal(K.rejectRewrite(old, 'Gas Safe registered plumbing in Walsall.', 240, said), '');
  // The critic's text fixes go through the same check.
  const home = plan.pages[0];
  const i = home.sections.findIndex((s) => s.block === 'cta-banner');
  const fx = K.applyFixes(plan, brief, { fixes: [{ page: 'home', section: i, kind: 'text', key: 'title', value: 'Award-winning plumbers', why: 'trust' }] });
  assert.match(fx.skipped.join(' '), /claim the owner did not make/);
  // The gate reads the page for the same claims, against what the owner gave.
  const html = K.assemble(plan, brief).html.replace('</main>', '<p>Gas Safe registered and fully insured.</p></main>');
  const g = K.runGates(html, plan, brief, b0);
  assert.ok(g.findings.some((f) => f.gate === 'honesty' && /claim the owner did not make/.test(f.text)), K.formatGates(g));
  assert.equal(K.runGates(K.assemble(plan, brief).html, plan, brief, b0).findings.filter((f) => f.gate === 'honesty').length, 0, 'the template alone makes none');
});

test('review 3: no stars without a real rating, and no average unless every review was rated', () => {
  const unrated = { ...FULL, reviews: [{ quote: 'Decent cut, a bit slow.', name: 'Jo' }, { quote: 'Okay.', name: 'Sam' }] };
  const { plan, brief } = K.planFrom(unrated);
  const html = K.assemble(plan, brief).html;
  assert.ok(!/out of 5 stars/.test(html), 'no stars on unrated reviews');
  assert.ok(!/★/.test(html), 'no made-up average');
  const one = K.planFrom({ ...FULL, reviews: [{ quote: 'Fine.', name: 'Jo' }] });
  assert.ok(!/out of 5 stars/.test(K.assemble(one.plan, one.brief).html), 'a single unrated review has no stars either');
  const mixed = K.planFrom({ ...FULL, reviews: [{ quote: 'Great.', name: 'A', rating: 5 }, { quote: 'Fine.', name: 'B' }] });
  const mh = K.assemble(mixed.plan, mixed.brief).html;
  const figs = [...mh.matchAll(/<figure class="reveal">([\s\S]*?)<\/figure>/g)].map((m) => m[1]);
  assert.ok(figs.some((f) => /Great\./.test(f) && /out of 5 stars/.test(f)), 'the rated review has its stars');
  assert.ok(figs.filter((f) => /Fine\./.test(f)).every((f) => !/out of 5 stars/.test(f)), 'the unrated one has none');
  assert.ok(!/★/.test(mh), 'no average from a partly rated set');
  const rated = K.planFrom({ ...FULL });
  assert.match(K.assemble(rated.plan, rated.brief).html, /5\.0★/, 'real ratings still give an average');
});

test('review 4: after a model wait the confirm list survives, and the writer gets only the owner\'s facts with the typical ones marked', async () => {
  const st = new MemStorage();
  let planner = 0;
  const writerAsked = [];
  const d = deps(st, async (messages) => {
    const sys = messages[0].content;
    if (/^SITE PLANNER/.test(sys) && planner++ === 0) throw Object.assign(new Error('Every model I can reach is cooling down after rate limits.'), { waitMs: 40_000 });
    if (/^SITE PLANNER/.test(sys)) return { message: { role: 'assistant', content: '{"palette":"barber"}' } };
    if (/^SITE WRITER/.test(sys)) {
      writerAsked.push(messages[1].content);
      return { message: { role: 'assistant', content: '{}' } };
    }
    return { message: { role: 'assistant', content: '{"verdict":"Fine.","fixes":[]}' } };
  });
  const ctx = { env: d.env, storage: st, origin: 'https://ghosty.example' };
  await SB.startSiteBuild({ request: "build a website for my friend's barber shop in Walsall", name: 'Fade & Co', phone: '07700 900461' }, ctx);
  const [p0] = await PJ.listProjects(ctx);
  const p = await runAll(d, p0.id);
  assert.equal(planner, 2, 'the planner waited once, then answered');
  const report = p.steps.map((s) => s.result ?? '').join('\n');
  assert.match(report, /opening hours \(typical ones are shown\)/);
  assert.match(report, /services and prices \(typical ones/);
  const job = await SB.loadSiteJob(ctx, p0.id);
  assert.equal(job.facts.hours, undefined, 'the owner\'s facts are never filled in');
  assert.ok(job.brief.hours?.length, 'the page is still drawn with typical hours');
  assert.ok(writerAsked.length, 'the writer was asked');
  for (const u of writerAsked) {
    const facts = u.split('\n\n')[0];
    assert.ok(!/^Services:|^Hours:/m.test(facts), `typical prices or hours handed over as facts:\n${facts}`);
    assert.match(facts, /NOT confirmed by the owner.*opening hours/);
  }
  // Numbers from the typical prices are not the owner's: the writer may not move them into other words.
  const { plan } = K.planFrom(job.facts);
  assert.match(K.rejectRewrite('Book your chair', 'Cuts from £18', 60, job.facts), /adds numbers/);
  assert.ok(plan.confirm.length);
});

test('review 5: the build looks up its link first — never a silent overwrite — and names a link cannot spell never share one', async () => {
  const tool = K.siteTools.find((t) => t.name === 'build_website');
  const st = new MemStorage();
  const ctx = { env: { PUBLIC_ORIGIN: 'https://ghosty.example' }, storage: st, origin: 'https://ghosty.example' };
  await K.siteStore(undefined, st).put({ name: 'fade-co', title: 'Fade & Co — barbers in Walsall', html: '<!doctype html><html><body>old</body></html>', source: '', at: 1 });
  await K.siteStore(undefined, st).put({ name: 'walsall-barber', title: "Aunt May's knitting", html: '<!doctype html><html><body>other</body></html>', source: '', at: 1 });
  const same = await tool.approval({ request: 'build a website for my barber shop in Walsall', name: 'Fade & Co' }, ctx);
  assert.match(same.reason, /replaces "Fade & Co — barbers in Walsall"/, same.reason);
  assert.equal(same.args.link_name, 'fade-co');
  const other = await tool.approval({ request: 'build a website for my barber shop in Walsall' }, ctx);
  assert.ok(/replac/.test(other.reason) || other.args.link_name !== 'walsall-barber', other.reason);
  assert.equal(other.args.link_name, 'walsall-barber-2', 'another business moves to the next free link');
  assert.ok(!/replac/.test(other.reason));
  // The run uses exactly the link that was approved.
  assert.match(await tool.run(other.args, ctx), /\/s\/walsall-barber-2\b/);
  // Arabic, Chinese and emoji names: three different links (all used to be "site-barber").
  const names = ['مقص الذهب', '金剪刀理发店', '🔥💈'].map((name) => SB.siteNameOf({ name }, SB.briefOf({ request: 'build a website for my barber shop', name })));
  assert.equal(new Set(names).size, 3, names.join(' '));
  for (const n of names) assert.match(n, /^[a-z0-9-]{3,48}$/);
  assert.equal(SB.siteNameOf({ name: 'مقص الذهب' }, SB.briefOf({ request: 'build a website for my barber shop', name: 'مقص الذهب' })), names[0], 'the same name always gives the same link');
  assert.equal(SB.siteNameOf({ name: 'Fade & Co' }, SB.briefOf({ request: 'x', name: 'Fade & Co' })), 'fade-co');
});

test('review 6: a picture for the site is charged to the shared free-AI ledger first; no room, no https address or no count left means no model call', async () => {
  let ran = 0;
  const kvm = new Map();
  const kv = { get: async (k, t) => (kvm.has(k) ? (t === 'json' ? JSON.parse(kvm.get(k)) : kvm.get(k)) : null), put: async (k, v) => void kvm.set(k, typeof v === 'string' ? v : v) };
  const jpeg = Buffer.from(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(200).fill(1)])).toString('base64');
  const AI = { run: async () => { ran++; return { image: jpeg }; } };
  const ctx = { env: { AI, SITES: kv }, origin: 'https://ghosty.example' };
  // Plain http: nothing a published page could show, so nothing is spent.
  assert.equal(await SB.makePicture({ ...ctx, origin: 'http://localhost:8787' }, 'A cafe'), null);
  assert.equal(ran, 0);
  // Today's picture count used up: checked before the model.
  const day = new Date().toISOString().slice(0, 10);
  kvm.set(`pic:count:${day}`, '40');
  assert.equal(await SB.makePicture(ctx, 'A cafe'), null);
  assert.equal(ran, 0, 'the daily count is read before the model runs');
  kvm.delete(`pic:count:${day}`);
  // With room: charged to the ledger, made, kept at an https address.
  const before = (await K.neurons().today()).by.image ?? 0;
  const made = await SB.makePicture(ctx, 'A cafe counter. Morning light');
  assert.match(made?.src ?? '', /^https:\/\/ghosty\.example\/i\//);
  assert.equal(ran, 1);
  assert.equal(((await K.neurons().today()).by.image ?? 0) - before, K.cost.image(6), 'charged before it ran');
  // The shared ledger full: no call.
  const used = (await K.neurons().today()).used;
  await K.neurons().charge('chat', K.FREE_NEURONS - used);
  assert.equal(await SB.makePicture(ctx, 'A cafe'), null);
  assert.equal(ran, 1, 'ai.run is never called when the free allowance is used up');
});

test('review 7: free library photos are never shown as the business\'s own work; photographer and portfolio galleries come only from the owner; no GymNation photo', () => {
  for (const kind of ['photographer', 'portfolio']) {
    const { plan, brief } = K.planFrom(K.briefFrom('build a website for my photography business in Leeds', { kind }));
    const work = plan.pages.find((p) => p.slug === 'work');
    assert.ok(!work || !work.sections.some((s) => s.block === 'gallery-grid'), `${kind}: no stock gallery on the work page`);
    assert.ok(!plan.pages.flatMap((p) => p.sections).some((s) => s.block === 'gallery-grid'), `${kind}: no stock gallery at all`);
    const html = K.assemble(plan, brief).html;
    assert.ok(!/href="#\/work"/.test(html) || work, `${kind}: no link to a missing work page`);
    assert.ok(plan.confirm.some((c) => /no gallery of your work yet/.test(c)));
    // With the owner's own pictures, the work page shows them (and only them).
    const own = { ...PHOTO, src: 'https://owner.example/wedding-1.jpg', srcset: undefined, credit: undefined };
    const withOwn = K.planFrom({ ...K.briefFrom('build a website for my photography business', { kind }), photos: [own, { ...own, src: 'https://owner.example/wedding-2.jpg' }] });
    const grid = withOwn.plan.pages.find((p) => p.slug === 'work').sections.find((s) => s.block === 'gallery-grid');
    assert.deepEqual(grid.data.images.map((i) => i.image.src), ['https://owner.example/wedding-1.jpg', 'https://owner.example/wedding-2.jpg']);
  }
  const ownWork = /\b(our work|selected work|portfolio|from the salon|what is cooking|from the pass|last time|the craft|inside)\b/i;
  for (const kind of KIND_IDS) {
    const { plan } = K.planFrom(K.briefFrom('build a website for my business', { kind }));
    for (const p of plan.pages) for (const s of p.sections) {
      const pics = K.imagesIn(s.data).filter((i) => i.credit);
      if (pics.length && /gallery|social|services-cards/.test(s.block)) assert.ok(!ownWork.test(`${s.data.eyebrow ?? ''} ${s.data.title ?? ''}`), `${kind}/${p.slug || 'home'}: ${s.block} "${s.data.eyebrow} ${s.data.title}"`);
      if (s.block === 'services-cards') assert.equal(pics.length, 0, `${kind}: no library photos as the services`);
    }
  }
  for (const set of Object.values(K.STOCK)) for (const i of [set.hero, ...set.story, ...set.gallery]) assert.ok(!/GymNation/i.test(i.src + JSON.stringify(i.credit)), i.src);
});

test('review 8: the phone\'s website questions never take over a message that is not their answers; only a website FOR something is an ask', async () => {
  for (const t of ['do you know the website for the council tax?', 'I need to check the NHS website for my prescription', 'can you make sure the site visit is booked', 'I want to go back to that site we found yesterday', 'set up the home page widget']) assert.equal(K.siteAsk(t), false, t);
  for (const t of ['build me a website for my cafe', 'can you make a site for my plumbing business', 'I need a landing page for my app', "build a website for my friend's barber shop in walsall", 'I want a new website for my gym', 'build me a website']) assert.ok(K.siteAsk(t), t);
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const O = await import('./.build/offline-site.mjs');
  store.set('ghosty.offlineSite', JSON.stringify({ brief: K.briefFrom('build me a website for my cafe'), asked: ['name', 'town', 'phone', 'hours', 'about'], at: Date.now() }));
  assert.equal(O.offlineSiteTurn('remind me to ring Dr Patel at 4pm about my blood test results, my NHS number is 943 476 5919, and pick up Amira from school'), false);
  assert.equal(O.offlineSiteTurn("what's the weather tomorrow?"), false);
  assert.equal(O.offlineSiteTurn('play some jazz'), false);
  assert.ok(O.pendingSite(), 'the questions keep waiting for their answers');
  assert.equal(O.offlineSiteTurn('Little Fern, Bilston'), true);
  assert.equal(O.offlineSiteTurn('01902 000512, Mon-Fri 8-4'), true);
  assert.equal(O.offlineSiteTurn('just build it'), true);
  delete globalThis.localStorage;
});

test('review 9: an email with anything after the address never reaches the page, its links or its form', () => {
  const evil = 'owner@fade.example?bcc=spy@evil.example';
  const b = SB.briefOf({ request: 'build a website for my barber shop in Walsall', name: 'Fade', email: evil, phone: '01922 000000' });
  assert.equal(b.email, undefined, 'refused at the brief');
  const { plan, brief } = K.planFrom(b);
  assert.ok(!/bcc/i.test(K.assemble(plan, brief).html));
  // Even a brief that carries one (the phone, an old job) is cleaned when the page is assembled.
  const dirty = K.planFrom({ ...K.briefFrom('build a website for my barber shop in Walsall'), name: 'Fade', email: evil });
  const html = K.assemble(dirty.plan, dirty.brief).html;
  assert.ok(!/bcc|evil\.example/i.test(html), 'no bcc anywhere in the html');
  assert.equal(K.mailHref(evil), 'mailto:');
  assert.equal(K.mailHref('hello@fadeandco.example', 'Hi there'), 'mailto:hello@fadeandco.example?subject=Hi%20there');
  // The form script checks the address itself before making a mailto: link.
  assert.match(K.BEHAVIOURS.form, /test\(mailTo\)\)mailTo=''/);
  // And the gate refuses a mailto: that carries more than a subject and a body.
  const good = K.assemble(K.planFrom({ ...FULL }).plan, FULL).html;
  const g = K.runGates(good.replace(/href="mailto:[^"]*"/, 'href="mailto:a@b.example?bcc=c@d.example"'), K.planFrom({ ...FULL }).plan, FULL);
  assert.ok(g.findings.some((f) => /email link looks wrong/.test(f.text)));
  // A clean address still works everywhere.
  const ok = K.planFrom({ ...FULL });
  assert.match(K.assemble(ok.plan, ok.brief).html, /data-to-mail="hello@fadeandco\.example"/);
});

test('review 10: a build with unconfirmed defaults ends as a draft (not public); confirming publishes it; with nothing to confirm it goes live', async () => {
  const st = new MemStorage();
  const d = deps(st, async () => { throw new Error('model not available'); });
  const ctx = { env: d.env, storage: st, origin: 'https://ghosty.example' };
  await SB.startSiteBuild({ request: 'build a website for my gym in Dudley', name: 'Iron Works' }, ctx);
  const [p0] = await PJ.listProjects(ctx);
  const p = await runAll(d, p0.id);
  assert.equal(p.status, 'done', p.note);
  assert.equal(await K.siteStore(undefined, st).get('iron-works'), undefined, 'nothing public');
  assert.deepEqual(await K.siteStore(undefined, st).list(), []);
  const report = p.steps[5].result;
  assert.match(report, /^Draft — not public yet/);
  assert.match(report, /Please confirm: .*opening hours/);
  assert.ok(!/^Live:/m.test(report));
  const tool = K.siteTools.find((t) => t.name === 'build_website');
  // Confirming from the approval: it names what the owner is confirming, then publishes.
  const ap = await tool.approval({ request: 'build a website for my gym', name: 'Iron Works', confirm: true }, ctx);
  assert.match(ap.reason, /You are confirming what I assumed: .*opening hours/);
  assert.equal(ap.args.confirm, true);
  assert.match(await tool.run(ap.args, ctx), /live now at https:\/\/ghosty\.example\/s\/iron-works/);
  assert.match((await K.siteStore(undefined, st).get('iron-works')).html, /Iron Works/);
  await assert.rejects(tool.approval({ request: 'x', link_name: 'iron-works', confirm: true }, ctx), /no draft website is waiting/, 'the draft is gone once live');
  // A site with nothing left to confirm goes live at step 5, as before.
  const st2 = new MemStorage();
  const d2 = deps(st2, async () => { throw new Error('model not available'); });
  const ctx2 = { env: d2.env, storage: st2, origin: 'https://ghosty.example' };
  await SB.startSiteBuild({ request: 'build a website for my gym in Dudley', name: 'Iron Works' }, ctx2);
  const [q] = await PJ.listProjects(ctx2);
  for (let i = 0; i < 12; i++) {
    const job = await SB.loadSiteJob(ctx2, q.id);
    if (job.plan?.confirm.length) await st2.put(`sitejob:${q.id}`, { ...job, plan: { ...job.plan, confirm: [] } });
    const pj = (await PJ.loadProject(d2, q.id));
    if (pj.status !== 'active') break;
    await PJ.runProjectStep(d2, ((await st2.get('jobs')) ?? []).find((j) => j.kind === 'project' && j.text === q.id) ?? { id: 'j', kind: 'project', text: q.id });
  }
  assert.ok(await K.siteStore(undefined, st2).get('iron-works'), 'live with nothing to confirm');
  assert.match((await PJ.loadProject(d2, q.id)).steps[5].result, /^Live: https:\/\/ghosty\.example\/s\/iron-works/);
});
