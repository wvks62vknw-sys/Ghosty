// Self-study: one topic an hour read into the library, no AI and no keys. Network faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const { Library } = await import('./.build/library/store.mjs');
const S = await import('./.build/library/study.mjs');

class MemStorage {
  m = new Map();
  sql = sqlStorage();
  async get(k) { return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined; }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
}

const seen = [];
let wikiDown = false;
globalThis.fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  seen.push(url.hostname + url.pathname);
  const j = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
  const html = (t, b) => new Response(`<html><head><title>${t}</title></head><body><p>${b}</p></body></html>`, { headers: { 'content-type': 'text/html' } });
  if (url.hostname === 'developer.mozilla.org' && url.pathname === '/api/v1/search') return j({ documents: [{ mdn_url: '/en-US/docs/Web/JavaScript/Event_loop' }] });
  if (url.hostname === 'developer.mozilla.org') return html('The event loop - MDN', 'JavaScript has a runtime model based on an event loop, which is responsible for executing the code, collecting and processing events, and executing queued sub-tasks.');
  if (url.hostname === 'en.wikipedia.org' && url.pathname === '/w/api.php') return wikiDown ? new Response('rate limited', { status: 429 }) : j({ query: { search: [{ title: 'Collision detection' }] } });
  if (url.hostname === 'en.wikipedia.org') return html('Collision detection', 'Collision detection is the computational problem of detecting an intersection of two or more objects, used in video games and physics simulations with bounding boxes and spatial partitioning.');
  return new Response('not faked', { status: 599 });
};

test('a study session reads the next topic into the library and logs it', async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  const s1 = await S.studySession(st, lib);
  assert.equal(s1.i, 1);
  assert.equal(s1.last.topic, S.CURRICULUM[0][0]);
  assert.match(s1.last.title, /event loop/i);
  assert.ok(s1.last.passages >= 1);
  assert.ok((await lib.search('event loop queued sub-tasks')).length, 'what it read is searchable');
  assert.ok(lib.doc('notes_study'), 'study log kept');
  // the same source again is skipped, not stored twice
  st.m.set(S.STUDY_KEY, { ...(await S.loadStudy(st)), i: 0 });
  const s2 = await S.studySession(st, lib);
  assert.match(s2.last.title, /already in the library/);
});

test("questions the library couldn't answer are studied first; failures are kept for later", async () => {
  const st = new MemStorage();
  const lib = new Library(st, {});
  await S.noteGap(st, 'how does collision detection work in games?');
  await S.noteGap(st, 'thanks'); // not a question
  assert.deepEqual((await S.loadStudy(st)).gaps, ['how does collision detection work in games?']);
  wikiDown = true;
  const failed = await S.studySession(st, lib);
  assert.match(failed.last.error, /429/);
  assert.equal(failed.gaps.length, 1, 'kept to try again');
  wikiDown = false;
  const ok = await S.studySession(st, lib);
  assert.equal(ok.last.topic, 'how does collision detection work in games?');
  assert.match(ok.last.title, /Collision detection/);
  assert.equal(ok.gaps.length, 0);
});

test('switched off, it does nothing', async () => {
  const st = new MemStorage();
  st.m.set(S.STUDY_KEY, { on: false, i: 0, gaps: [], sessions: 0 });
  const n = seen.length;
  const s = await S.studySession(st, new Library(st, {}));
  assert.equal(s.sessions, 0);
  assert.equal(seen.length, n);
});
