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
