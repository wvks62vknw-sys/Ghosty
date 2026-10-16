// Exporting the library to a branch of Ghosty's own repository as Markdown: what Ghosty wrote,
// not the owner's uploads or the built-in texts; batches of 40; the branch made once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const { Library } = await import('./.build/library/store.mjs');
const X = await import('./.build/library/export.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
}

function fakeGitHub() {
  const g = { branches: { main: 'base0' }, commits: [], created: [], moved: [] };
  g.defaultBranch = async () => 'main';
  g.headSha = async (b) => { if (!g.branches[b]) throw new Error(`404 no branch ${b}`); return g.branches[b]; };
  g.createBranch = async (name, sha) => { g.created.push([name, sha]); g.branches[name] = sha; };
  g.commitStaged = async (base, message, staged) => { g.commits.push({ base, message, staged }); return `sha${g.commits.length}`; };
  g.moveBranch = async (name, sha) => { g.moved.push([name, sha]); g.branches[name] = sha; };
  return g;
}

async function filled(lib) {
  const add = async (id, title, kind, passages, extra = {}) => {
    lib.createDoc({ id, title, source: 'self-study', kind, ...extra });
    await lib.addPassages(id, passages);
    if (!extra.adding) lib.finish(id);
  };
  await add('read_physics', 'Reading: Physics', 'study', [{ text: 'Newton first law text.', heading: "Newton's laws" }, { text: 'More on the first law.', heading: "Newton's laws" }, { text: 'Energy is conserved.', heading: 'Energy' }]);
  await add('digest_physics', 'Study notes: Physics', 'digest', [{ text: 'SUMMARY\nForces change motion.', heading: "Newton's laws" }]);
  await add('notes_study', "Ghosty's study log", 'notes', [{ text: '2026-10-16 read Newton.', heading: 'Studied: Newton' }]);
  await add('study_quiz', "Ghosty's drills", 'study', [{ text: 'Q: 2+2\nResult: RIGHT', heading: 'arithmetic · right' }]);
  await add('d-upload1', 'My tax return', 'notes', [{ text: 'private numbers', heading: '' }]); // the owner's own document
  await add('self_code', 'My code', 'code', [{ text: 'export const x = 1', heading: 'a.ts' }], { builtin: true });
  await add('read_half', 'Reading: half done', 'study', [{ text: 'still importing', heading: 'x' }], { adding: true });
}

test('exports what Ghosty wrote as one Markdown file per notebook, with a README, on a branch made from the default branch', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await filled(lib);
  const g = fakeGitHub();
  const r = await X.exportLibrary(g, lib, 'owner/Ghosty');
  assert.deepEqual(r, { branch: 'library', files: 4, passages: 6, left: 0, url: 'https://github.com/owner/Ghosty/tree/library' });
  assert.deepEqual(g.created, [['library', 'base0']], 'the branch starts from the default branch');
  assert.deepEqual(g.moved, [['library', 'sha1']]);
  const c = g.commits[0];
  assert.equal(c.base, 'base0');
  assert.match(c.message, /^Library export: 4 notebooks, 6 passages$/);
  const paths = c.staged.map((f) => f.path).sort();
  assert.deepEqual(paths, ['README.md', 'library/digest-physics.md', 'library/notes-study.md', 'library/read-physics.md', 'library/study-quiz.md']);
  const phys = c.staged.find((f) => f.path === 'library/read-physics.md').content;
  assert.match(phys, /^# Reading: Physics\n\n_self-study_\n\n## Newton's laws\n\nNewton first law text\.\n\nMore on the first law\.\n\n## Energy\n\nEnergy is conserved\.\n$/);
  const readme = c.staged.find((f) => f.path === 'README.md').content;
  assert.match(readme, /\[Reading: Physics\]\(library\/read-physics\.md\) — 3 passages/);
  assert.ok(!JSON.stringify(c.staged).includes('private numbers'), "the owner's own documents stay out");
  assert.ok(!JSON.stringify(c.staged).includes('export const x'), 'built-in texts stay out');
  assert.ok(!paths.includes('library/read-half.md'), 'unfinished notebooks wait');
  // the next export reuses the branch
  const r2 = await X.exportLibrary(g, lib, 'owner/Ghosty');
  assert.equal(r2.files, 4);
  assert.equal(g.created.length, 1, 'the branch is made once');
  assert.equal(g.commits[1].base, 'sha1', 'on top of the last export');
});

test('a big library goes in batches of 40, continued with an offset', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  for (let i = 0; i < 45; i++) {
    const id = `digest_d${String(i).padStart(2, '0')}`;
    lib.createDoc({ id, title: `Notes ${i}`, source: 'written by Ghosty', kind: 'digest' });
    await lib.addPassages(id, [{ text: `note ${i}`, heading: 't' }]);
    lib.finish(id);
  }
  const g = fakeGitHub();
  const r1 = await X.exportLibrary(g, lib, 'o/r');
  assert.equal(r1.files, 40);
  assert.equal(r1.left, 5);
  const r2 = await X.exportLibrary(g, lib, 'o/r', { offset: 40 });
  assert.equal(r2.files, 5);
  assert.equal(r2.left, 0);
  assert.equal(g.commits[1].staged.length, 6, 'five notebooks and the README');
  assert.ok(g.commits[1].staged.some((f) => f.path === 'library/digest-d44.md'));
});

test('exportable: only finished notebooks Ghosty wrote', () => {
  const ok = (d) => X.exportable({ status: 'ready', ...d });
  assert.ok(ok({ id: 'read_maths', kind: 'study' }));
  assert.ok(ok({ id: 'digest_maths', kind: 'digest' }));
  assert.ok(ok({ id: 'notes_study', kind: 'notes' }));
  assert.ok(ok({ id: 'study_quiz', kind: 'study' }));
  assert.ok(!ok({ id: 'd-abc', kind: 'notes' }));
  assert.ok(!ok({ id: 'read_maths', kind: 'study', builtin: true }));
  assert.ok(!ok({ id: 'read_maths', kind: 'study', status: 'adding' }));
});
