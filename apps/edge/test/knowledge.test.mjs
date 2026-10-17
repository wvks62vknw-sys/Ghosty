// Ghosty's handbook, its lessons, and the self-check rules that catch free-model mistakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const K = await import('./.build/knowledge/index.mjs');
const { selfCheck, placeholderProblem, shrinkProblem, duplicateDeclarations, unsafeDomProblem, bracketProblem } = await import('./.build/selfcheck.mjs');

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

class MemStorage {
  m = new Map();
  async get(k) {
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    this.m.set(k, structuredClone(v));
  }
}

// ---------- handbook ----------

test('every playbook is well formed and has a unique id', () => {
  const ids = new Set();
  for (const p of K.PLAYBOOKS) {
    assert.match(p.id, /^[a-z][a-z0-9-]+$/, p.id);
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.title.length > 10 && p.body.length > 200, `${p.id} has real content`);
    assert.ok(p.tags.length >= 3, `${p.id} has tags`);
  }
  assert.ok(K.PLAYBOOKS.length >= 15);
});

test('study finds the right playbook for what Ghosty is about to do', () => {
  const first = (q) => K.findPlaybooks(q)[0]?.id;
  assert.equal(first('add a new tab'), 'recipe-tab');
  assert.equal(first('add a panel with live data to the brief tab'), 'recipe-panel');
  assert.equal(first('new brain tool'), 'recipe-brain-tool');
  assert.equal(first('error TS2532 object is possibly undefined'), 'ci-errors');
  assert.equal(first('self-review'), 'self-review');
  assert.equal(first('write a python script'), 'python');
  assert.ok(K.findPlaybooks('write a python script').some((p) => p.id === 'coding-for-owner'));
  assert.equal(first('build a snake game'), 'game-recipes');
  assert.equal(first('make a game'), 'game-kit');
  assert.equal(first('dijkstra pathfinding'), 'algorithms');
  assert.equal(first('instant widget'), 'widgets');
  assert.equal(first('make a better version of yourself'), 'self-improvement');
  assert.equal(first('upgrade roadmap'), 'self-improvement');
  assert.deepEqual(K.findPlaybooks('zzzz qqqq'), []);
});

test('the builder kit: the app page kit and the quality loop are found for web apps, stay small, and the kit page checks clean', async () => {
  const ids = K.findPlaybooks('web app').map((p) => p.id);
  assert.ok(ids.includes('app-page-kit') && ids.includes('quality-loop'), ids.join(', '));
  const first = (q) => K.findPlaybooks(q)[0]?.id;
  assert.equal(first('app page kit'), 'app-page-kit');
  assert.equal(first('quality loop'), 'quality-loop');
  assert.equal(first('motion and 3d'), 'motion-3d');
  assert.equal(first('make a game'), 'game-kit', 'games still go to the game kit');
  assert.equal(first('instant widget'), 'widgets');
  for (const id of ['app-page-kit', 'quality-loop', 'motion-3d']) {
    const p = K.PLAYBOOKS.find((x) => x.id === id);
    assert.ok(p, id);
    assert.ok(p.body.length <= 9000, `${id} is ${p.body.length} characters (9,000 at most: it is injected into coding turns)`);
  }
  const kit = K.PLAYBOOKS.find((p) => p.id === 'app-page-kit').body;
  assert.ok(kit.includes(K.APP_KIT_PAGE), 'the playbook carries the page itself');
  for (const must of [/Welcome to the realm/, /prefers-reduced-motion/, /prefers-color-scheme/, /env\(safe-area-inset/, /clamp\(/, /<dialog/, /localStorage/, /<symbol id="i-/, /class="octo"/]) assert.match(K.APP_KIT_PAGE, must);
  const loop = K.PLAYBOOKS.find((p) => p.id === 'quality-loop').body;
  assert.match(loop, /WHAT GREAT LOOKS LIKE/);
  assert.match(loop, /12 MOST COMMON MISTAKES/);
  assert.ok((loop.match(/^\d+\. /gm) ?? []).length >= 26, 'steps, 8 lines of great, 12 mistakes');
  const motion = K.PLAYBOOKS.find((p) => p.id === 'motion-3d').body;
  for (const must of [/perspective/, /requestAnimationFrame/, /pathLength/, /animation-timeline: scroll\(\)/, /prefers-reduced-motion/]) assert.match(motion, must);
  // the example page passes the gate exactly as written
  const { checkHtml } = await import('./.build/tools/check.mjs');
  const r = checkHtml(K.APP_KIT_PAGE);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test('the full-stack handbook: architecture, auth, APIs, schemas, validation, UI → backend, state, iPhone layout', () => {
  const first = (q) => K.findPlaybooks(q)[0]?.id;
  assert.ok(K.findPlaybooks('clean architecture separation of concerns').some((p) => p.id === 'clean-architecture'));
  assert.equal(first('clean-architecture'), 'clean-architecture');
  assert.equal(first('jwt login with sessions and password hashing'), 'auth');
  assert.equal(first('crud api endpoints in express'), 'crud-api');
  assert.equal(first('database schema with foreign keys'), 'database-schema');
  assert.equal(first('validate form input against sql injection'), 'validation');
  assert.equal(first('reverse engineer the backend for a product card'), 'ui-to-backend');
  assert.equal(first('react hook with loading and error state'), 'state-and-errors');
  assert.equal(first('iphone 13 responsive layout'), 'mobile-390');
  const body = (id) => K.PLAYBOOKS.find((p) => p.id === id).body;
  // the rules that matter most are really in there
  assert.match(body('auth'), /HttpOnly; Secure; SameSite=Lax/);
  assert.match(body('auth'), /timingSafeEqual/);
  assert.match(body('database-schema'), /NEVER float/);
  assert.match(body('ui-to-backend'), /Product card → products: title TEXT.*price NUMERIC\(10,2\).*images TEXT\[\]/);
  assert.match(body('mobile-390'), /clamp\(/);
  assert.match(body('mobile-390'), /@container/);
  assert.match(body('mobile-390'), /transform and opacity/);
  // and every code turn is told to use them
  const e = K.engineeringEssentials('boss');
  assert.match(e, /separate layers/);
  assert.match(e, /mobile 390/);
});

test('the full-stack templates are valid code (SQL parses, JavaScript compiles)', () => {
  const body = (id) => K.PLAYBOOKS.find((p) => p.id === id).body;
  // the validator template, run for real
  const src = body('validation').match(/export function validateProduct[\s\S]*?\n  }\n/)[0].replace('export ', '');
  const HttpError = class extends Error { constructor(status, message, fields) { super(message); this.status = status; this.fields = fields; } };
  const validateProduct = new Function('HttpError', `${src}; return validateProduct;`)(HttpError);
  assert.deepEqual(validateProduct({ title: ' Loaf ', price: '3.5', images: ['https://x.example/a.jpg'], role: 'admin' }), { title: 'Loaf', price: 3.5, images: ['https://x.example/a.jpg'] });
  assert.throws(() => validateProduct({ title: '', price: -1, images: ['http://x'] }), (e) => e.status === 422 && Object.keys(e.fields).length === 3);
  // the tiny store template
  const store = body('state-and-errors').match(/function createStore[\s\S]*?\n  }\n/)[0];
  const createStore = new Function(`${store}; return createStore;`)();
  const s = createStore({ n: 0 });
  const seen = [];
  s.subscribe((x) => seen.push(x.n));
  s.set((x) => ({ n: x.n + 1 }));
  assert.deepEqual(seen, [0, 1]);
});

test('playbook code examples point at files and exports that really exist', () => {
  const src = (p) => readFileSync(join(ROOT, p), 'utf8');
  const components = src('apps/web/src/ui/components.ts');
  for (const name of ['panel', 'row', 'pager', 'button', 'spark', 'bar', 'dial', 'toast', 'modal', 'empty']) assert.match(components, new RegExp(`export function ${name}\\b`));
  assert.match(src('apps/web/src/engine/scheduler.ts'), /export function onFrame\(/);
  assert.match(src('apps/web/src/ui/page.ts'), /export function page\(/);
  assert.match(src('apps/web/src/features/index.ts'), /import \{ coreTab \} from '\.\/core';/);
  assert.match(src('apps/web/src/features/index.ts'), /\[coreTab, eyeTab,/);
  assert.match(src('apps/edge/src/tools/extra.ts'), /export const extraTools: Tool\[\]/);
  assert.match(src('apps/edge/src/index.ts'), /'api\.frankfurter\.app'/);
});

test('the system prompt tells Ghosty it can rebuild AND publish a live website', () => {
  const prompt = readFileSync(join(ROOT, 'apps/edge/src/prompt.ts'), 'utf8');
  assert.match(prompt, /rebuild any website from a link and PUBLISH it live/);
  assert.match(prompt, /never reply that you can't host or publish/i);
  assert.match(prompt, /study_site[\s\S]*publish_site/);
});

test('the always-on essentials stay short (free models have small limits)', () => {
  const e = K.engineeringEssentials('boss');
  assert.ok(e.includes('boss'));
  assert.ok(e.length < 1600, `essentials are ${e.length} characters`);
});

// ---------- lessons ----------

test('lessons: learned, de-duplicated when re-learned, ranked, removable', async () => {
  const s = new MemStorage();
  await assert.rejects(K.addLesson(s, 'short'), /real sentence/);
  const a = await K.addLesson(s, 'TS2532 in the brief tab: indexed an array without a fallback. Rule: always use arr[i]! or ?? for indexed values.', ['typescript']);
  assert.equal(a.repeat, false);
  const again = await K.addLesson(s, 'TS2532 brief tab: indexed array without fallback. Rule: always use arr[i]! or ?? for indexed values.');
  assert.equal(again.repeat, true);
  assert.equal(again.lesson.hits, 2);
  await K.addLesson(s, 'Feeds from a new host fail with 403 until the host is added to FEED_HOSTS. Rule: check FEED_HOSTS first.', ['feed']);
  const list = await K.loadLessons(s);
  assert.equal(list.length, 2);
  assert.equal(K.topLessons(list)[0].hits, 2, 'most repeated first');
  assert.equal(await K.removeLesson(s, 'feed_hosts'), 1);
  assert.equal((await K.loadLessons(s)).length, 1);
});

test('lessons are capped, dropping the least useful', async () => {
  const s = new MemStorage();
  for (let i = 0; i < 90; i++) await K.addLesson(s, `Lesson number ${i} about topic${i} alpha${i} beta${i}: Rule ${i}.`);
  const list = await K.loadLessons(s);
  assert.equal(list.length, 80);
  assert.ok(K.topLessons(list).reduce((n, l) => n + l.text.length, 0) <= 1800);
});

// ---------- self-check rules ----------

const big = Array.from({ length: 80 }, (_, i) => `export const v${i} = ${i};`).join('\n');

test('self-check: a division after "return <name>" is not read as a regex, a real regex after return still is', () => {
  assert.equal(bracketProblem("function f(t) {\n  const letters = 3;\n  return letters / t.replace(/\\s/g, '').length < 0.4 && t.length > 2;\n}\n"), null);
  assert.equal(bracketProblem("const ok = (x) => { return /ab+c/.test(x) ? 1 : 0; };\n"), null);
  assert.equal(bracketProblem("const r = a / b / c;\nconst q = typeof x / 2;\n"), null);
  assert.match(bracketProblem("function g() {\n  return (1 + 2;\n}\n") ?? '', /never closed|closes/);
});

test('self-check: placeholder comments that would delete code are caught', () => {
  assert.match(placeholderProblem('import x;\n// ... existing code ...\nexport const y = 1;', 'import x;\n'), /placeholder/);
  assert.match(placeholderProblem('  // rest of the file unchanged\n', null), /placeholder/);
  assert.match(placeholderProblem('/* ... */', ''), /placeholder/);
  assert.equal(placeholderProblem('// Fetch the forecast for the next 24 hours\nconst a = 1;', null), null);
  assert.equal(placeholderProblem('// ... existing code\n', '// ... existing code\n'), null, 'already there before');
});

test('self-check: a whole file replaced by a fragment is caught', () => {
  assert.match(shrinkProblem('export const v0 = 0;\n', big), /shrink from 80 to 2 lines/);
  assert.equal(shrinkProblem(big.split('\n').slice(0, 70).join('\n'), big), null);
  assert.equal(shrinkProblem('x', null), null);
});

test('self-check: names declared twice are caught, overloads are fine', () => {
  assert.match(duplicateDeclarations('const a = 1;\nexport const b = 2;\nconst a = 3;\n', 'const a = 1;\n'), /declares "a" 2 times/);
  assert.equal(duplicateDeclarations('function f(a: string): void;\nfunction f(a: number): void;\nfunction f(a: unknown) {\n}\n', null), null);
  assert.equal(duplicateDeclarations('function x() {\n  const a = 1;\n}\nfunction y() {\n  const a = 2;\n}\n', null), null, 'nested names are fine');
});

test('self-check: dynamic innerHTML and eval are caught', () => {
  assert.match(unsafeDomProblem('el.innerHTML = `<b>${name}</b>`;', ''), /textContent/);
  assert.match(unsafeDomProblem('el.innerHTML = data.html;', ''), /textContent/);
  assert.match(unsafeDomProblem('const f = eval(code);', ''), /eval/);
  assert.equal(unsafeDomProblem("el.innerHTML = '';", ''), null);
  assert.equal(unsafeDomProblem('row.textContent = name;', ''), null);
});

const base = {
  'apps/web/src/features/index.ts': "import { coreTab } from './core';\nexport const TABS = [coreTab];\n",
  'apps/web/src/features/core/index.ts': 'export const coreTab = {};\n',
  'apps/web/src/api/feed.ts': 'export function fetchJson() {}\nexport class Feed {}\n',
  'apps/edge/src/index.ts': "const FEED_HOSTS = new Set([\n  'api.open-meteo.com',\n]);\n",
};
const read = async (p) => base[p] ?? null;
const tree = Object.keys(base);
const write = (path, content) => ({ path, content, before: base[path] ?? null });

test('self-check: npm packages, unregistered tabs and unknown feed hosts are caught', async () => {
  let p = await selfCheck([write('apps/web/src/util.ts', "import dayjs from 'dayjs';\nexport const x = dayjs;\n")], tree, read);
  assert.match(p.join('\n'), /package "dayjs"/);

  p = await selfCheck([write('apps/web/src/features/clocks/index.ts', 'export const clocksTab = {};\n')], tree, read);
  assert.match(p.join('\n'), /new tab.*does not import it/);
  p = await selfCheck(
    [write('apps/web/src/features/clocks/index.ts', 'export const clocksTab = {};\n'), write('apps/web/src/features/index.ts', "import { clocksTab } from './clocks';\nimport { coreTab } from './core';\nexport const TABS = [coreTab, clocksTab];\n")],
    tree,
    read,
  );
  assert.deepEqual(p, []);

  const feed = (host) => write('apps/web/src/data/thing.ts', `import { Feed, fetchJson } from '../api/feed';\nexport const thing = new Feed('t', () => fetchJson<{ a: number }>('https://${host}/v1/x', 300), 60000);\n`);
  assert.match((await selfCheck([feed('api.example.com')], tree, read)).join('\n'), /api\.example\.com.*FEED_HOSTS/);
  assert.deepEqual(await selfCheck([feed('api.open-meteo.com')], tree, read), []);
});

test('self-check: every file already in Ghosty passes, even as if newly written (no false alarms)', async () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      // public/vendor: third-party libraries served as-is (Leaflet, MapLibre) — not Ghosty's code to check
      if (['node_modules', '.git', 'dist', '.build', '.wrangler-dry'].includes(name) || ((name === 'data' || name === 'vendor') && dir.endsWith('public'))) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|mjs|css|md|json)$/.test(name)) files.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, 'apps'));
  walk(join(ROOT, 'packages'));
  walk(join(ROOT, 'tests'));
  files.push('MAP.md', 'README.md', 'SETUP.md');
  const all = new Map(files.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]));
  const staged = [...all].map(([path, content]) => ({ path, content, before: null }));
  const problems = await selfCheck(staged, [...all.keys()], async (p) => all.get(p) ?? null);
  assert.deepEqual(problems, []);
});
