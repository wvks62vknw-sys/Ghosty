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
export { siteMessage } from '../web/src/offline/sitework.ts';`,
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

test('a website from one request: six steps with a model — planned, written, built, gated, published, critiqued from the layout (no screenshot service), reported with the link', async () => {
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
  const site = await K.siteStore(undefined, st).get('fade-co');
  assert.ok(site, 'published');
  assert.match(site.html, /Barbers in the heart of Walsall/, 'the writer\'s words reached the page');
  assert.deepEqual(K.checkHtml(site.html).errors, []);
  const report = p.steps[5].result;
  assert.match(report, /Live: https:\/\/ghosty\.example\/s\/fade-co/);
  assert.match(report, /layout analysis \(no screenshots were possible\)/);
  assert.match(report, /Please confirm: .*opening hours/);
  assert.match(report, /Fixed: .*alt background/);
  assert.equal(d.notes.length, 1, 'one notification, at the end');
  assert.match(d.notes[0].text, /Live: https:\/\/ghosty\.example\/s\/fade-co/);
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
  const site = await K.siteStore(undefined, st).get('little-fern');
  assert.match(site.html, /Little Fern/);
  assert.match(p.steps[5].result, /Done without an AI model/);
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
