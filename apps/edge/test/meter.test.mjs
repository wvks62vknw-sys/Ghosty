// The database meter: counts every row the brain reads and writes against Cloudflare's free
// daily allowance, by the work that caused it; keeps the day's counts in KV; says when optional
// work should wait.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Meter, DAILY_READS, DAILY_WRITES, SPARE_LEVEL } = await import('./.build/meter.mjs');

class FakeKv {
  m = new Map();
  puts = 0;
  async get(k, type) {
    const v = this.m.get(k);
    if (v == null) return null;
    return type === 'json' ? JSON.parse(v) : v;
  }
  async put(k, v) {
    this.puts++;
    this.m.set(k, String(v));
  }
  async delete(k) {
    this.m.delete(k);
  }
}

/** A storage like the Durable Object's key-value API, plus an SQL cursor that reports rows like Cloudflare's. */
function fakeStorage() {
  const m = new Map();
  return {
    m,
    async get(k) {
      return Array.isArray(k) ? new Map(k.map((x) => [x, m.get(x)])) : m.get(k);
    },
    async put(k, v) {
      if (typeof k === 'string') m.set(k, v);
      else for (const [a, b] of Object.entries(k)) m.set(a, b);
    },
    async delete(k) {
      return Array.isArray(k) ? k.filter((x) => m.delete(x)).length : m.delete(k);
    },
    async list() {
      return new Map(m);
    },
    async setAlarm() {},
    sql: {
      databaseSize: 4096,
      exec(query) {
        // Pretend: a SELECT reads 7 rows as they are consumed; a write writes 2 rows at once.
        const write = /^\s*(INSERT|UPDATE|DELETE)/i.test(query);
        const rows = write ? [] : [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }, { a: 5 }, { a: 6 }, { a: 7 }];
        let i = 0;
        const c = {
          get rowsRead() {
            return i;
          },
          rowsWritten: write ? 2 : 0,
          toArray() {
            i = rows.length;
            return rows;
          },
          one() {
            i = 1;
            return rows[0];
          },
          [Symbol.iterator]() {
            return {
              next() {
                if (i < rows.length) return { value: rows[i++], done: false };
                return { value: undefined, done: true };
              },
            };
          },
        };
        return c;
      },
    },
  };
}

test('key-value reads and writes are counted, one row per key, under the label in force', async () => {
  const meter = new Meter(null);
  const s = meter.wrapStorage(fakeStorage());
  await s.put('a', 1);
  await s.put({ b: 2, c: 3 });
  meter.label = 'chat';
  await s.get('a');
  await s.get(['b', 'c']);
  await s.delete('a');
  await meter.as('mirror', () => s.list());
  const snap = meter.snapshot();
  assert.equal(snap.writes, 4, 'put a, put b+c, delete a');
  assert.equal(snap.reads, 3 + 2, 'get a, get b+c, list of the 2 left');
  const by = Object.fromEntries(snap.by.map((b) => [b.label, b]));
  assert.equal(by.other.w, 3);
  assert.equal(by.chat.r, 3);
  assert.equal(by.chat.w, 1);
  assert.equal(by.mirror.r, 2);
  assert.equal(meter.label, 'chat', 'as() restores the label');
  assert.equal(snap.limits.reads, DAILY_READS);
  assert.equal(snap.limits.writes, DAILY_WRITES);
  assert.ok(snap.resetAt > Date.now() && snap.resetAt - Date.now() <= 86_400_000);
});

test('SQL rows are counted from the cursor: writes when run, reads as they are consumed', () => {
  const meter = new Meter(null);
  const s = meter.wrapStorage(fakeStorage());
  s.sql.exec('INSERT INTO t VALUES (1)');
  assert.equal(meter.snapshot().writes, 2);
  assert.equal(s.sql.exec('SELECT * FROM t').toArray().length, 7);
  assert.equal(meter.snapshot().reads, 7);
  s.sql.exec('SELECT * FROM t').one();
  assert.equal(meter.snapshot().reads, 8);
  let n = 0;
  for (const _ of s.sql.exec('SELECT * FROM t')) n++;
  assert.equal(n, 7);
  assert.equal(meter.snapshot().reads, 15);
  assert.equal(s.sql.databaseSize, 4096);
});

test('a cursor without counters (the test shim) counts one row per statement', () => {
  const meter = new Meter(null);
  const s = meter.wrapStorage({ sql: { exec: () => ({ toArray: () => [], one: () => null, rowsWritten: 0 }) } });
  s.sql.exec('SELECT 1').toArray();
  s.sql.exec('INSERT INTO t VALUES (1)');
  const snap = meter.snapshot();
  assert.equal(snap.reads, 1);
  assert.equal(snap.writes, 1);
});

test('spare() says no once most of either allowance is used', () => {
  const meter = new Meter(null);
  assert.ok(meter.spare());
  meter.read(Math.floor(DAILY_READS * (SPARE_LEVEL - 0.01)), 'search');
  assert.ok(meter.spare());
  meter.read(Math.ceil(DAILY_READS * 0.02), 'search');
  assert.ok(!meter.spare(), 'reads past the spare level');
  const m2 = new Meter(null);
  m2.write(DAILY_WRITES, 'storm');
  assert.ok(!m2.spare());
  assert.ok(m2.level() >= 1);
});

test('the counts are kept in KV (at most every few minutes) and taken back after a restart', async () => {
  const kv = new FakeKv();
  const meter = new Meter(kv);
  await meter.load();
  meter.read(120, 'chat');
  meter.write(3, 'chat');
  await meter.flush();
  assert.equal(kv.puts, 1, 'first flush writes');
  meter.read(5, 'chat');
  await meter.flush();
  assert.equal(kv.puts, 1, 'a second flush within a few minutes waits');
  await meter.flush(true);
  assert.equal(kv.puts, 2, 'force writes');
  const again = new Meter(kv);
  again.read(10, 'alarm');
  await again.load();
  const snap = again.snapshot();
  assert.equal(snap.reads, 135, "the morning's reads plus this lifetime's");
  assert.equal(snap.writes, 3);
  assert.deepEqual(snap.by.map((b) => b.label).sort(), ['alarm', 'chat']);
});

test('as() keeps the label for the whole of an async job and restores it after', async () => {
  const meter = new Meter(null);
  meter.label = 'route:chat';
  const p = meter.as('study', async () => {
    assert.equal(meter.label, 'study');
    await new Promise((r) => setTimeout(r, 2));
    meter.read(1);
  });
  await p;
  assert.equal(meter.label, 'route:chat');
  assert.equal(meter.snapshot().by[0].label, 'study');
});
