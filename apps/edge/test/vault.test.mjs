// The vault's KV mirror: keys saved while the database is paused are kept at once, a brain that
// restarts in a fresh isolate during the pause reads them (and its own vault key) from KV, and
// they are written to the database after the reset without any device's help.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { Vault, _testing } = await import('./.build/kernel/vault.mjs');

const quota = () => {
  throw new Error('Exceeded allowed rows read in Durable Objects free tier.');
};
class MemStorage {
  m = new Map();
  down = false;
  async get(k) {
    if (this.down) quota();
    return this.m.get(k);
  }
  async put(k, v) {
    if (this.down) quota();
    this.m.set(k, v);
  }
  async delete(k) {
    if (this.down) quota();
    return this.m.delete(k);
  }
}
class FakeKv {
  m = new Map();
  /** A key KV refuses to write (its own limit, a blip). */
  failFor = null;
  async get(k) {
    return this.m.get(k) ?? null;
  }
  async put(k, v) {
    if (k === this.failFor) throw new Error('KV put failed');
    this.m.set(k, String(v));
  }
  async delete(k) {
    this.m.delete(k);
  }
}

test("the brain's own vault key and every key's ciphertext are mirrored into KV; nothing readable is", async () => {
  _testing.forgetVaultKey();
  const storage = new MemStorage();
  const kv = new FakeKv();
  const v = new Vault(storage, { VAULT: kv });
  await v.set('groq', 'gsk_plain_value');
  assert.ok(storage.m.get('vaultkey'), 'the own key is in the database');
  assert.equal(kv.m.get('vaultkey'), storage.m.get('vaultkey'), 'and mirrored');
  assert.equal(kv.m.get('vault:groq'), storage.m.get('vault:groq'), 'the same ciphertext in both');
  assert.ok(!kv.m.get('vault:groq').includes('gsk_plain_value'));
  await v.set('groq', '');
  assert.ok(!storage.m.has('vault:groq'), 'removed from the database');
  assert.equal(kv.m.get('vault:groq'), '-', 'the mirror marks it removed (so a removal made during a pause is never mistaken for "never mirrored")');
  assert.equal(await v.get('groq'), null);
});

test('a key saved during the pause is kept in KV and used after a restart in a fresh isolate, then written to the database by the brain itself', async () => {
  _testing.forgetVaultKey();
  const storage = new MemStorage();
  const kv = new FakeKv();
  const first = new Vault(storage, { VAULT: kv });
  await first.set('gemini', 'AIza_before'); // makes the own key while the database works
  storage.down = true;
  await first.set('groq', 'gsk_during');
  assert.equal(await first.waiting(), 1);
  assert.equal(await first.get('groq'), 'gsk_during', 'in use at once');
  assert.deepEqual(JSON.parse(kv.m.get('vault:dirty')), ['groq']);

  // A fresh isolate during the pause: no memory, no device copy, the database throws.
  _testing.forgetVaultKey();
  const second = new Vault(storage, { VAULT: kv });
  assert.equal(await second.get('groq'), 'gsk_during', 'from the mirror, with the own key from the mirror');
  assert.equal(await second.get('gemini'), 'AIza_before');
  assert.equal(await second.lookup('tavily'), undefined, 'a key never saved: not known (not "unset")');
  assert.equal(await second.waiting(), 1, 'the waiting list came from KV');
  assert.equal(await second.flushDirty(true), 1, 'still paused: still waiting');

  // The reset: the next flush writes it to the database.
  storage.down = false;
  assert.equal(await second.flushDirty(true), 0);
  assert.ok(storage.m.has('vault:groq'));
  assert.ok(!kv.m.has('vault:dirty'), 'nothing waiting any more');
  _testing.forgetVaultKey();
  const third = new Vault(storage, { VAULT: kv });
  assert.equal(await third.get('groq'), 'gsk_during', 'from the database now');
  assert.equal(await third.lookup('tavily'), null, 'database back: unset keys are known to be unset');
});

test('with the database paused and no mirror, the vault still answers from the device copy and secrets', async () => {
  _testing.forgetVaultKey();
  const storage = new MemStorage();
  const v = new Vault(storage, { VAULT_KEY: Buffer.alloc(32, 9).toString('base64'), GROQ_KEY: 'gsk_secret' });
  storage.down = true;
  assert.equal(await v.get('groq'), 'gsk_secret');
  assert.equal(await v.lookup('gemini'), undefined);
  assert.equal(await v.waiting(), 0);
});

test('automatic flushes wait a few minutes after a failed try; forced ones do not', async () => {
  _testing.forgetVaultKey();
  const storage = new MemStorage();
  const kv = new FakeKv();
  const v = new Vault(storage, { VAULT_KEY: Buffer.alloc(32, 1).toString('base64'), VAULT: kv });
  storage.down = true;
  await v.set('groq', 'gsk_x');
  assert.equal(await v.flushDirty(), 1, 'tried and failed');
  storage.down = false;
  assert.equal(await v.flushDirty(), 1, 'the automatic one waits');
  assert.equal(await v.flushDirty(true), 0, 'the forced one writes');
});

test('a key the mirror never took is not deleted from the database by the flush after a restart (missing is not "removed")', async () => {
  _testing.forgetVaultKey();
  const storage = new MemStorage();
  const kv = new FakeKv();
  kv.failFor = 'vault:cerebras'; // KV refuses this key's writes throughout
  const v1 = new Vault(storage, { VAULT: kv });
  await v1.set('cerebras', 'csk_first'); // the database took it; the mirror did not
  assert.equal(await v1.get('cerebras'), 'csk_first');
  assert.equal(await v1.waiting(), 0);
  assert.ok(!kv.m.has('vault:cerebras'));
  storage.down = true;
  await v1.set('cerebras', 'csk_second'); // paused: memory only, and on the waiting list
  assert.equal(await v1.get('cerebras'), 'csk_second');
  assert.equal(await v1.waiting(), 1);
  // a restart during the pause, then the reset
  _testing.forgetVaultKey();
  storage.down = false;
  const v2 = new Vault(storage, { VAULT: kv });
  assert.equal(await v2.flushDirty(true), 0, 'nothing is left waiting');
  assert.equal(await v2.get('cerebras'), 'csk_first', 'the database keeps the key it had: the newer value was never mirrored, so there was nothing to write — and nothing to delete');
});

test("a key removed during the pause stays removed after a restart: the device's older copy does not bring it back", async () => {
  _testing.forgetVaultKey();
  const storage = new MemStorage();
  const kv = new FakeKv();
  const v1 = new Vault(storage, { VAULT: kv });
  await v1.set('groq', 'gsk_secret');
  const { backup } = await v1.backup('owner-key', ['groq']); // the phone's copy still carries it
  storage.down = true;
  await v1.set('groq', '');
  assert.equal(await v1.get('groq'), null);
  assert.equal(kv.m.get('vault:groq'), '-');
  _testing.forgetVaultKey();
  const v2 = new Vault(storage, { VAULT: kv }); // a fresh isolate, still paused
  assert.equal(await v2.warm('owner-key', backup), true);
  assert.equal(await v2.lookup('groq'), null, 'known to be removed, not "unknown" and not the older device copy');
  assert.equal(await v2.has('groq'), false);
  storage.down = false;
  assert.equal(await v2.flushDirty(true), 0);
  assert.ok(!storage.m.has('vault:groq'), 'removed from the database after the reset');
});

// ---------------------------------------------------------------------------------------
// The phone's daily backup (backup.ts): ciphertext only, kept in KV under backup:<day>, the
// newest 7 days, never more than KV's 25 MiB, and only for the owner.
// ---------------------------------------------------------------------------------------
import { build } from 'esbuild';

await build({ entryPoints: [new URL('../src/backup.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'neutral', outfile: new URL('./.build/backup.mjs', import.meta.url).pathname, logLevel: 'warning' });
const BK = await import('./.build/backup.mjs');
const brainMod = await import('./.build/brain.mjs');

/** The SITES namespace as the brain uses it: strings in, JSON out. */
class SitesKv {
  m = new Map();
  async get(k, type) {
    if (!this.m.has(k)) return null;
    return type === 'json' ? JSON.parse(this.m.get(k)) : this.m.get(k);
  }
  async put(k, v) {
    this.m.set(k, String(v));
  }
  async delete(k) {
    this.m.delete(k);
  }
}
class AgentStorage {
  m = new Map();
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() { return null; }
}

const b64 = (n) => Buffer.from(Array.from({ length: n }, (_, i) => i % 256)).toString('base64');
/** An envelope shaped like the phone's (the brain cannot open it either way). */
const sealed = (ctBytes = 64, at = Date.now()) => ({ v: 1, kdf: 'PBKDF2-SHA256', iter: 310000, salt: b64(16), iv: b64(12), ct: b64(ctBytes), at });
const DAY = 86_400_000;

test('backup store: one copy per day, today replaces today, only the newest 7 are kept', async () => {
  const kv = new SitesKv();
  const t0 = Date.parse('2026-10-01T09:00:00Z');
  for (let d = 0; d < 9; d++) await BK.storeBackup(kv, JSON.stringify(sealed(64 + d)), t0 + d * DAY);
  const list = await BK.listBackups(kv);
  assert.deepEqual(list.map((b) => b.id), ['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03']);
  assert.ok(!kv.m.has('backup:2026-10-01') && !kv.m.has('backup:2026-10-02'), 'older copies are deleted from KV, not only from the list');
  assert.ok(kv.m.has('backup:2026-10-09'));
  // Again on the same day (BACK UP NOW): replaces that day's copy, still 7.
  const again = await BK.storeBackup(kv, JSON.stringify(sealed(500)), t0 + 8 * DAY + 3_600_000);
  assert.equal(again.backup.id, '2026-10-09');
  assert.equal((await BK.listBackups(kv)).length, 7);
  assert.equal((await BK.getBackup(kv, '2026-10-09')).ct, b64(500));
  assert.ok(list[0].size > 0 && list[0].at > 0);
});

test('backup store: refuses anything that is not a sealed envelope, and anything over 25 MiB, in plain words', async () => {
  const kv = new SitesKv();
  await assert.rejects(BK.storeBackup(kv, JSON.stringify({ learn: { cards: [] } })), /not an encrypted Ghosty backup/);
  await assert.rejects(BK.storeBackup(kv, 'not json'), /not an encrypted Ghosty backup/);
  await assert.rejects(BK.storeBackup(kv, JSON.stringify({ ...sealed(), iter: 1000 })), /not an encrypted/, 'a weak key derivation is refused too');
  const big = JSON.stringify(sealed(19 * 1024 * 1024 + 10)); // base64 grows it past 25 MiB
  assert.ok(big.length > BK.MAX_BACKUP_BYTES);
  await assert.rejects(BK.storeBackup(kv, big), (e) => e.status === 413 && /at most 25 MB/.test(e.message) && /Nothing was saved/.test(e.message));
  assert.equal(kv.m.size, 0, 'nothing was written');
});

test('backup routes: owner only, store / list / fetch one, and the size refusal over HTTP', async (t) => {
  const OWNER_KEY = 'backup-owner-key-0123456789abcdef';
  const kv = new SitesKv();
  const state = { storage: new AgentStorage(), waitUntil: () => undefined };
  const env = { OWNER_KEY, MOCK_LLM: '1', SITES: kv };
  let agent;
  env.AGENT = { idFromName: (n) => n, get: () => ({ fetch: (r) => (agent ??= new brainMod.GhostyAgent(state, env)).fetch(r) }) };
  const ctx = { waitUntil: () => undefined };
  const call = (path, init = {}, key = OWNER_KEY) =>
    brainMod.default.fetch(new Request(`https://ghosty.test${path}`, { ...init, headers: { 'content-type': 'application/json', 'x-ghosty': '1', ...(key ? { 'x-ghosty-key': key } : {}), ...(init.headers ?? {}) } }), env, ctx);

  assert.equal((await call('/api/backup', {}, '')).status, 401, 'no key: refused');
  assert.equal((await call('/api/backup', {}, 'wrong-key-0123456789abcdef')).status, 401, 'wrong key: refused');
  assert.equal((await call('/api/backup', { method: 'POST', body: JSON.stringify(sealed()) }, '')).status, 401);
  assert.equal(kv.m.size, 0);
  const put = await call('/api/backup', { method: 'POST', body: JSON.stringify(sealed(80)) });
  assert.equal(put.status, 200, await put.clone().text());
  const { backup } = await put.json();
  assert.match(backup.id, /^\d{4}-\d{2}-\d{2}$/);
  const list = await (await call('/api/backup')).json();
  assert.equal(list.backups.length, 1);
  assert.equal(list.keep, 7);
  const one = await (await call(`/api/backup/${backup.id}`)).json();
  assert.equal(one.backup.ct, b64(80), 'the same ciphertext comes back');
  assert.equal((await call('/api/backup/2001-01-01')).status, 404);

  const bad = await call('/api/backup', { method: 'POST', body: JSON.stringify({ plain: 'text' }) });
  assert.equal(bad.status, 400);
  const big = await call('/api/backup', { method: 'POST', body: JSON.stringify(sealed(19 * 1024 * 1024 + 10)) });
  assert.equal(big.status, 413);
  assert.match((await big.json()).error, /at most 25 MB/);
  assert.equal((await (await call('/api/backup')).json()).backups.length, 1, 'the refused one was not kept');

  // No KV bound: a plain answer, not a crash.
  delete env.SITES;
  agent = undefined;
  const none = await call('/api/backup');
  assert.equal(none.status, 503);
  assert.match((await none.json()).error, /SITES KV/);
});
