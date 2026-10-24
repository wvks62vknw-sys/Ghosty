// Ghosty's ears and voice (speech.ts): Groq's Whisper when the key is set, else Workers AI's
// turbo model with base64 audio and the classic one with raw bytes when that refuses; no
// recogniser at all says so; MeloTTS gives MP3 bytes with a day's cap and a cache; nothing
// secret ever comes back. Plus the phone's WAV helper (apps/web/src/assistant/wav.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('./.build/speech.mjs');
const W = await import('./.build/wav.mjs');

/** A stand-in for Workers AI that records every call and answers as told. */
function fakeAi(answers) {
  const calls = [];
  return {
    calls,
    async run(model, inputs) {
      calls.push({ model, inputs });
      const a = answers[model];
      if (a instanceof Error) throw a;
      if (typeof a === 'function') return a(inputs);
      if (a === undefined) throw new Error(`no such model ${model}`);
      return a;
    },
  };
}
const vaultWith = (keys) => ({ get: async (n) => keys[n] ?? null });
const bytes = (n = 4000) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * 7) & 0xff;
  return b.buffer;
};
const mp3 = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);

test('transcribe: Groq when the key is set; Workers AI turbo (base64) otherwise; the classic model (bytes) when turbo refuses; nothing without either', async () => {
  const real = globalThis.fetch;
  const groq = [];
  globalThis.fetch = async (url, init) => {
    groq.push({ url, auth: init.headers.Authorization, name: init.body.get('file').name, type: init.body.get('file').type });
    return new Response(JSON.stringify({ text: ' hello from groq ' }), { headers: { 'content-type': 'application/json' } });
  };
  try {
    const ai = fakeAi({ '@cf/openai/whisper-large-v3-turbo': { text: 'hello from turbo' }, '@cf/openai/whisper': { text: 'hello from classic' } });
    assert.equal(await S.transcribe({ AI: ai }, vaultWith({ groq: 'gsk_secret_key' }), bytes(), 'audio/wav'), 'hello from groq');
    assert.equal(groq.length, 1);
    assert.equal(groq[0].name, 'speech.wav');
    assert.equal(groq[0].type, 'audio/wav');
    assert.equal(ai.calls.length, 0, 'Workers AI was not asked while Groq answered');
    // no key: the turbo model, given the whole file as base64
    assert.equal(await S.transcribe({ AI: ai }, vaultWith({}), bytes(300), 'audio/ogg'), 'hello from turbo');
    assert.equal(ai.calls.at(-1).model, '@cf/openai/whisper-large-v3-turbo');
    assert.equal(ai.calls.at(-1).inputs.audio, Buffer.from(bytes(300)).toString('base64'));
    // turbo refuses: the classic model, given the bytes themselves
    const ai2 = fakeAi({ '@cf/openai/whisper-large-v3-turbo': new Error('5007: unsupported audio'), '@cf/openai/whisper': { text: 'hello from classic' } });
    assert.equal(await S.transcribe({ AI: ai2 }, vaultWith({}), bytes(300), 'audio/webm'), 'hello from classic');
    assert.deepEqual(ai2.calls.map((c) => c.model), ['@cf/openai/whisper-large-v3-turbo', '@cf/openai/whisper']);
    assert.deepEqual(ai2.calls[1].inputs.audio, [...new Uint8Array(bytes(300))]);
    // both refuse: a plain error, status 502
    const ai3 = fakeAi({ '@cf/openai/whisper-large-v3-turbo': new Error('busy'), '@cf/openai/whisper': new Error('neurons exhausted') });
    await assert.rejects(S.transcribe({ AI: ai3 }, vaultWith({}), bytes(300), 'audio/webm'), (e) => e.status === 502 && /neurons exhausted/.test(e.message));
    // Groq failing with Workers AI there: Workers AI takes over; with nothing else the Groq error stands
    globalThis.fetch = async () => new Response('rate limited', { status: 429 });
    assert.equal(await S.transcribe({ AI: ai }, vaultWith({ groq: 'gsk_secret_key' }), bytes(300), 'audio/wav'), 'hello from turbo');
    await assert.rejects(S.transcribe({}, vaultWith({ groq: 'gsk_secret_key' }), bytes(300), 'audio/wav'), (e) => e.status === 502 && /whisper 429/.test(e.message));
    // no key and no Workers AI: no recogniser
    await assert.rejects(S.transcribe({}, vaultWith({}), bytes(300), 'audio/wav'), (e) => e.status === 400 && /no speech recogniser/.test(e.message));
    // too big, or nothing at all
    await assert.rejects(S.transcribe({ AI: ai }, vaultWith({}), new ArrayBuffer(8_000_001), 'audio/wav'), (e) => e.status === 413);
    await assert.rejects(S.transcribe({ AI: ai }, vaultWith({}), new ArrayBuffer(10), 'audio/wav'), (e) => e.status === 400 && /empty/.test(e.message));
  } finally {
    globalThis.fetch = real;
  }
});

test('audioExt: every type the phone or Telegram sends gets the extension a recogniser expects', () => {
  assert.equal(S.audioExt('audio/wav'), 'wav');
  assert.equal(S.audioExt('audio/x-wav; charset=binary'), 'wav');
  assert.equal(S.audioExt('audio/webm;codecs=opus'), 'webm');
  assert.equal(S.audioExt('audio/mp4'), 'mp4');
  assert.equal(S.audioExt('audio/ogg'), 'ogg');
  assert.equal(S.audioExt('audio/mpeg'), 'mp3');
  assert.equal(S.audioExt('video/mp4'), 'mp4');
  assert.equal(S.audioExt('application/octet-stream'), 'webm');
});

test('POST /stt: the recording in, { text } out; refusals in plain words and the right status', async () => {
  const ai = fakeAi({ '@cf/openai/whisper-large-v3-turbo': { text: 'turn the lights on' } });
  const post = (body, type = 'audio/wav', env = { AI: ai }, vault = vaultWith({})) => S.sttRoute(env, vault, new Request('https://ghosty.test/api/stt', { method: 'POST', headers: { 'content-type': type }, body }));
  const ok = await post(bytes());
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { text: 'turn the lights on' });
  const none = await post(bytes(), 'audio/wav', {});
  assert.equal(none.status, 400);
  assert.match((await none.json()).error, /no speech recogniser/);
  const notAudio = await post('{"x":1}', 'application/json');
  assert.equal(notAudio.status, 415);
  const big = await post(new Uint8Array(8_000_001).buffer);
  assert.equal(big.status, 413);
  assert.ok(!JSON.stringify(await (await post(bytes(), 'audio/wav', {}, vaultWith({ groq: 'gsk_never_shown' }))).text()).includes('gsk_never_shown'), 'a key never comes back');
});

test("speakable: a reply as the voice should read it (no links, markdown or code)", () => {
  assert.equal(S.speakable('See **this**: https://x.example/a\n```js\ncode\n```\nDone.'), 'See this : link. Done.');
  assert.equal(S.speakable('  '), '');
});

test('POST /tts: MP3 bytes from MeloTTS, a day cache for the phone, the sentence cache, the daily cap, no voice without Workers AI', async () => {
  S._testing.reset();
  const ai = fakeAi({ '@cf/myshell-ai/melotts': (inputs) => ({ audio: mp3.toString('base64') + (inputs.prompt.length % 2 ? '' : '') }) });
  const post = (body, env = { AI: ai }) => S.ttsRoute(env, new Request('https://ghosty.test/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const r = await post({ text: 'Hello, boss. Everything is **fine**.' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/mpeg');
  assert.equal(r.headers.get('cache-control'), 'private, max-age=86400');
  assert.equal(r.headers.get('content-length'), String(mp3.length));
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), new Uint8Array(mp3));
  assert.equal(ai.calls.length, 1);
  assert.deepEqual(ai.calls[0].inputs, { prompt: 'Hello, boss. Everything is fine .', lang: 'en' });
  // the same sentence again costs nothing
  assert.equal((await post({ text: 'Hello, boss. Everything is **fine**.' })).status, 200);
  assert.equal(ai.calls.length, 1, 'served from the cache');
  assert.equal(S._testing.spokenToday(), 1);
  // a long text is cut at 600 characters, and an empty one refused
  await post({ text: 'x'.repeat(700) });
  assert.equal(ai.calls.at(-1).inputs.prompt.length, 600);
  assert.equal((await post({ text: '   ' })).status, 400);
  assert.equal((await post({})).status, 400);
  // no Workers AI: no voice, 404
  const none = await post({ text: 'hello' }, {});
  assert.equal(none.status, 404);
  assert.match((await none.json()).error, /no voice/);
  // the model returning nothing, or throwing: 502
  const bad = fakeAi({ '@cf/myshell-ai/melotts': {} });
  assert.equal((await post({ text: 'quiet' }, { AI: bad })).status, 502);
  const broken = fakeAi({ '@cf/myshell-ai/melotts': new Error('neurons used up') });
  const b = await post({ text: 'broken' }, { AI: broken });
  assert.equal(b.status, 502);
  assert.match((await b.json()).error, /neurons used up/);
  // the day's cap: 2,000 new sentences, then 429 in plain words
  S._testing.reset();
  for (let i = 0; i < S.TTS_PER_DAY; i++) assert.equal((await post({ text: `sentence number ${i}` })).status, 200, `sentence ${i}`);
  const over = await post({ text: 'one more' });
  assert.equal(over.status, 429);
  assert.deepEqual(await over.json(), { error: 'voice allowance used up for today' });
  // a cached sentence still plays past the cap; the cache holds the last 60
  assert.equal((await post({ text: `sentence number ${S.TTS_PER_DAY - 1}` })).status, 200);
  assert.equal((await post({ text: 'sentence number 0' })).status, 429, 'long since dropped from the cache');
  S._testing.reset();
});

test('the WAV helper: 16 kHz mono 16-bit PCM with a correct header, channels mixed down and resampled', () => {
  const rate = 48_000;
  const n = 4800; // a tenth of a second
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    left[i] = Math.sin((2 * Math.PI * 440 * i) / rate);
    right[i] = 0;
  }
  const mono = W.toMono16k([left, right], rate);
  assert.equal(mono.length, 1600, 'a tenth of a second at 16 kHz');
  assert.ok(Math.max(...mono) > 0.35 && Math.max(...mono) <= 0.5, `mixed down to half the amplitude: ${Math.max(...mono)}`);
  const wav = W.encodeWav(mono);
  assert.equal(wav.byteLength, 44 + 1600 * 2);
  assert.deepEqual(W.readWavHeader(wav), { channels: 1, rate: 16_000, bits: 16, dataBytes: 3200 });
  const v = new DataView(wav);
  assert.equal(v.getUint32(4, true), 36 + 3200, 'RIFF size');
  assert.equal(v.getUint32(28, true), 32_000, 'bytes a second');
  assert.equal(v.getUint16(32, true), 2, 'block align');
  // samples are clamped and little-endian
  const loud = W.encodeWav(new Float32Array([1.5, -1.5, 0]), 8000);
  assert.equal(new DataView(loud).getInt16(44, true), 0x7fff);
  assert.equal(new DataView(loud).getInt16(46, true), -0x8000);
  assert.equal(new DataView(loud).getInt16(48, true), 0);
  assert.equal(W.readWavHeader(loud).rate, 8000);
  // not a WAV
  assert.equal(W.readWavHeader(new Uint8Array(100).buffer), null);
  assert.equal(W.readWavHeader(new ArrayBuffer(10)), null);
  // the same rate passes through; an 8 kHz source is interpolated up
  assert.equal(W.toMono16k([new Float32Array(100)], 16_000).length, 100);
  assert.equal(W.toMono16k([new Float32Array(100)], 8_000).length, 200);
  assert.equal(W.toMono16k([], 48_000).length, 0);
  assert.equal(S.audioExt('audio/wav'), 'wav', 'what the brain sees when the phone sends it');
});

/** Durable Object storage, in memory, for the ledger tests. */
class Store {
  m = new Map();
  async get(k) { return structuredClone(this.m.get(k)); }
  async put(k, v) { this.m.set(k, structuredClone(v)); }
}

test("POST /tts with a voice: Aura's natural British voices within the day's share of the shared Workers AI ledger, then the plain voice; the reason said; the old request stays MeloTTS", async () => {
  S._testing.reset();
  const store = new Store();
  const ledger = new S.NeuronLedger(store);
  const aura = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 9, 9, 9, 9]);
  const ai = fakeAi({
    '@cf/myshell-ai/melotts': () => ({ audio: mp3.toString('base64') }),
    // the binding answers Aura with a stream of MP3 bytes
    '@cf/deepgram/aura-2-en': () => new ReadableStream({ start(c) { c.enqueue(aura); c.close(); } }),
    '@cf/deepgram/aura-1': () => new Response(aura),
  });
  const post = (body, env = { AI: ai }, l = ledger) => S.ttsRoute(env, new Request('https://ghosty.test/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), l);
  // 'auto': the most natural British voice (Aura 2, Draco), charged to the ledger and kept in storage
  const r = await post({ text: 'Morning. Kettle is on.', voice: 'auto' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-voice'), 'draco');
  assert.equal(r.headers.get('x-voice-note'), null);
  assert.equal(r.headers.get('x-voice-reason'), null);
  assert.deepEqual(new Uint8Array(await r.arrayBuffer()), aura);
  assert.deepEqual(ai.calls.at(-1), { model: '@cf/deepgram/aura-2-en', inputs: { text: 'Morning. Kettle is on.', speaker: 'draco', encoding: 'mp3' } });
  assert.equal(store.m.get('ai:neurons').by.voice, Math.ceil('Morning. Kettle is on.'.length * 1.37 * 2), 'Aura 2 counts double, and the count is in storage');
  // a named voice, Aura 1
  const h = await post({ text: 'Hello.', voice: 'helios' });
  assert.equal(h.headers.get('x-voice'), 'helios');
  assert.deepEqual(ai.calls.at(-1).inputs, { text: 'Hello.', speaker: 'helios', encoding: 'mp3' });
  // the same sentence in the same voice comes from the cache; in another voice it does not
  const n = ai.calls.length;
  await post({ text: 'Hello.', voice: 'helios' });
  assert.equal(ai.calls.length, n);
  await post({ text: 'Hello.', voice: 'melo' });
  assert.equal(ai.calls.length, n + 1);
  assert.equal(ai.calls.at(-1).model, '@cf/myshell-ai/melotts');
  // no voice at all (older copies of the app, Telegram): the plain voice, as before
  assert.equal((await post({ text: 'Plain old voice.' })).headers.get('x-voice'), 'melo');
  // the share used up: the plain voice speaks, and the reason says "not again today"
  const big = 'word '.repeat(110).trim();
  let last;
  for (let i = 0; i < 6; i++) last = await post({ text: `${i} ${big}`, voice: 'draco' });
  assert.ok(store.m.get('ai:neurons').by.voice <= S.VOICE_SHARE, `share kept: ${store.m.get('ai:neurons').by.voice}`);
  assert.equal(last.status, 200);
  assert.equal(last.headers.get('x-voice'), 'melo');
  assert.equal(last.headers.get('x-voice-reason'), 'share');
  assert.match(last.headers.get('x-voice-note'), /share for the natural voice is used up/);
  // an eviction (a new brain, a new ledger on the same storage) still knows: no natural voice
  S._testing.reset();
  const after = await post({ text: `after a restart ${big}`, voice: 'draco' }, { AI: ai }, new S.NeuronLedger(store));
  assert.equal(after.headers.get('x-voice'), 'melo', 'the share is not forgotten by a restart');
  assert.equal(after.headers.get('x-voice-reason'), 'share');
  // Aura failing: the plain voice says it, and the reason is a passing error (try again soon), not the share
  S._testing.reset();
  const flaky = fakeAi({ '@cf/myshell-ai/melotts': () => ({ audio: mp3.toString('base64') }), '@cf/deepgram/aura-2-en': new Error('3040: capacity') });
  const f = await post({ text: 'Still speaking.', voice: 'pandora' }, { AI: flaky }, new S.NeuronLedger(new Store()));
  assert.equal(f.status, 200);
  assert.equal(f.headers.get('x-voice'), 'melo');
  assert.equal(f.headers.get('x-voice-reason'), 'error');
  assert.match(f.headers.get('x-voice-note'), /did not answer \(3040: capacity\)/);
  // an unknown voice name is the plain voice
  assert.equal((await post({ text: 'Who?', voice: 'bogus' }, { AI: ai }, new S.NeuronLedger(new Store()))).headers.get('x-voice'), 'melo');
  S._testing.reset();
});

test('the Workers AI ledger: one count for every use, kept in storage; hearing always has room, nicer voices give way first', async () => {
  S._testing.reset();
  const store = new Store();
  const ledger = new S.NeuronLedger(store);
  // the fallback brain and hearing have used most of the day: the natural voice must leave its reserve
  await ledger.charge('chat', 5500);
  await ledger.charge('stt', 600);
  const aura = fakeAi({ '@cf/myshell-ai/melotts': () => ({ audio: mp3.toString('base64') }), '@cf/deepgram/aura-2-en': () => new Response(new Uint8Array([1, 2, 3])) });
  const tts = (body, l = ledger) => S.ttsRoute({ AI: aura }, new Request('https://ghosty.test/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), l);
  const r = await tts({ text: 'A short line.', voice: 'draco' });
  assert.equal(r.headers.get('x-voice'), 'melo', 'with 6,100 of 10,000 gone the natural voice gives way');
  assert.equal(r.headers.get('x-voice-reason'), 'share');
  assert.ok(!aura.calls.some((c) => c.model.includes('aura')), 'Aura was never asked');
  // nearly everything gone: even the plain voice gives way, hearing still works
  await ledger.charge('chat', 3400);
  const plain = await tts({ text: 'Another line here.', voice: 'melo' });
  assert.equal(plain.status, 429);
  assert.match((await plain.json()).error, /kept for hearing you/);
  const ear = fakeAi({ '@cf/openai/whisper-large-v3-turbo': () => ({ text: 'still hearing you' }) });
  assert.equal(await S.transcribe({ AI: ear }, vaultWith({}), bytes(32_044), 'audio/wav', ledger), 'still hearing you');
  const day = store.m.get('ai:neurons');
  assert.equal(day.by.stt, 600 + Math.ceil((32_000 / 32_000 / 60) * 47), 'a second of WAV is counted');
  assert.equal(day.used, 5500 + 600 + 3400 + day.by.stt - 600 + (day.by['plain-voice'] ?? 0));
  // background model work (study, projects, the weekly self-training factory) gives way long before the owner's chat
  const bg = new S.NeuronLedger(new Store());
  await bg.charge('chat', 6600);
  assert.equal(await bg.room('background', 50), false, 'background work leaves 3,500 for the rest');
  assert.equal(await bg.room('chat', 50), true, 'the owner\'s chat still has room');
  // the count is per UTC day
  const fresh = new S.NeuronLedger(store);
  assert.equal(await fresh.room('voice', 100, Date.now() + 86_400_000), true, 'a new day starts empty');
  S._testing.reset();
});

// ---------- barge-in (apps/web/src/assistant/barge.ts): the owner talking over Ghosty, from a made-up microphone ----------

const { BargeDetector } = await (async () => {
  const { build } = await import('esbuild');
  const out = await build({ entryPoints: [new URL('../../web/src/assistant/barge.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
})();

/** A fake microphone: readings every 20 ms from `level(t)`, with a little noise; the time the detector fired, or -1. */
function run(level, ms = 4000, opts) {
  const d = new BargeDetector(opts);
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.004;
  for (let t = 0; t <= ms; t += 20) if (d.feed(Math.max(0, level(t) + noise()), t, true)) return { at: t, d };
  return { at: -1, d };
}

test("barge-in: Ghosty's own echo, however steady or bumpy, never counts; the owner's voice does, within 300 ms", () => {
  // the echo left after cancellation: steady, then a loud syllable now and then (60 ms bursts)
  const echo = (t) => 0.03 + (t % 700 < 60 ? 0.06 : 0) + 0.01 * Math.sin(t / 37);
  assert.equal(run(echo).at, -1, 'Ghosty hearing itself must not stop itself');
  // a cough or a tap on the table: short and loud
  assert.equal(run((t) => echo(t) + (t > 1500 && t < 1600 ? 0.5 : 0)).at, -1, 'a click or a cough is not the owner talking');
  // the owner starts talking at 1.5 s over the echo
  const talk = run((t) => echo(t) + (t >= 1500 ? 0.2 : 0));
  assert.ok(talk.at > 1500, 'not before they talk');
  assert.ok(talk.at - 1500 <= 300, `heard within 300 ms (took ${talk.at - 1500} ms)`);
  // and knows when the voice began, to keep the first words (an echo burst just before may be joined to it)
  assert.ok(talk.d.speechStart >= 1400 && talk.d.speechStart <= 1500, `voice began at ${talk.d.speechStart}`);
  // a quiet room with no echo: a soft voice is enough
  const soft = run((t) => 0.004 + (t >= 1000 ? 0.05 : 0));
  assert.ok(soft.at > 1000 && soft.at - 1000 <= 300, `soft voice heard (at ${soft.at})`);
  // speech that breaks for a moment (between syllables) is still one voice
  const choppy = run((t) => 0.005 + (t >= 1000 && (t - 1000) % 140 < 100 ? 0.15 : 0));
  assert.ok(choppy.at > 1000 && choppy.at - 1000 <= 300, `syllables bridged (at ${choppy.at})`);
  // nothing during the first moments, while it learns the echo
  assert.equal(run((t) => 0.3, 280).at, -1);
  // it fires once only
  const d = new BargeDetector();
  let fired = 0;
  for (let t = 0; t < 3000; t += 20) if (d.feed(t > 500 ? 0.3 : 0.01, t)) fired++;
  assert.equal(fired, 1);
  // junk readings are treated as silence
  assert.equal(run(() => NaN).at, -1);
});

test("barge-in: echo with gaps between words and sentences (0.03, 0.05, 0.08 RMS) never fires; the owner over it still does, within 300 ms", () => {
  for (const E of [0.03, 0.05, 0.08]) {
    // speech-like echo: 300 ms of words, 120 ms of quiet room between them
    const words = (t) => (t % 420 < 300 ? E * (0.7 + 0.3 * Math.sin(t / 13)) : 0.003);
    assert.equal(run(words, 8000).at, -1, `echo ${E} with gaps between words`);
    // a clip that starts with 200 ms of silence, then 2.2 s sentences with 0.8 s between them
    const sentences = (t) => (t < 200 ? 0.002 : t % 3000 > 2200 ? 0.003 : E);
    assert.equal(run(sentences, 8000).at, -1, `echo ${E} with silence first and gaps between sentences`);
    // the owner starts talking at 4.1 s, over the echo (in a gap or not)
    for (const gen of [words, sentences]) {
      const talk = run((t) => gen(t) + (t >= 4100 ? 0.25 : 0), 8000);
      assert.ok(talk.at >= 4100 && talk.at - 4100 <= 300, `echo ${E}: the owner heard at ${talk.at}`);
    }
  }
  // between clips the detector is paused: the silence then does not count, and the next clip's echo does not fire it
  const d = new BargeDetector();
  let t = 0;
  for (; t < 1000; t += 20) assert.equal(d.feed(0.05, t), false);
  d.pause();
  for (t = 3000; t < 4000; t += 20) assert.equal(d.feed(t < 3040 ? 0.06 : 0.05, t), false, 'the next clip begins');
  assert.ok(d.floor >= d.learned && d.learned > 0.04, `floor ${d.floor}, learned ${d.learned}`);
});

// ---------- what is read aloud (apps/web/src/assistant/spoken.ts): numbers, times, lists and short forms in one breath ----------

const SPOKEN_TS = new URL('../../web/src/assistant/spoken.ts', import.meta.url).pathname;
async function bundle(path) {
  const { build } = await import('esbuild');
  const out = await build({ entryPoints: [path], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}
const SP = await bundle(process.env.SPOKEN_TS ?? SPOKEN_TS);
const said = (reply) => SP.sentences(SP.clean(reply));

test('read aloud: a price, a time, a decimal and "e.g." are never split; list markers are not said; no doubled stops', () => {
  const plan = "Here's the plan for Saturday:\n\n1. **Leave by 8.30am** — the M25 has 12.5 miles of roadworks.\n2. Fuel is about £1.42 a litre.\n3. Lunch at the Red Lion, e.g. the pie.\n- Dr. Patel is at St. Mary's until 5.";
  const parts = said(plan);
  assert.deepEqual(parts, [
    "Here's the plan for Saturday.",
    'Leave by 8.30am — the M25 has 12.5 miles of roadworks.',
    'Fuel is about £1.42 a litre.',
    'Lunch at the Red Lion, e.g. the pie.',
    "Dr. Patel is at St. Mary's until 5.",
  ]);
  // every piece ends a sentence the way it was written: no "roadworks.." or "Saturday:."
  for (const p of parts) assert.doesNotMatch(p, /[.!?:;,]\.$/, p);
  // ordinary sentences still split where they end, questions and exclamations too
  assert.deepEqual(said('It is 14.5°C. Bring a coat! Want the week ahead?'), ['It is 14.5°C.', 'Bring a coat!', 'Want the week ahead?']);
  // a sentence too long for one clip is cut at a comma, and nothing is lost
  const long = `${'word '.repeat(40)}and then, ${'more '.repeat(60)}end.`;
  const cut = SP.sentences(long, 300);
  assert.ok(cut.every((p) => p.length <= 300) && cut.join(' ').replace(/\s+/g, ' ') === long.replace(/\s+/g, ' ').trim(), JSON.stringify(cut));
  // links and code are not read out
  assert.equal(SP.clean('See https://example.org/x for it.\n```js\nlet a = 1;\n```\nDone'), 'See link for it. Done');
});

test('read aloud: a cited answer is said without its [n] markers, its SOURCES list or its check line', () => {
  const cited = 'The Thames is 215 miles long [1], the longest river wholly in England [2].\n\nSOURCES\n[1] River Thames - Wikipedia https://en.wikipedia.org/wiki/River_Thames\n[2] Rivers of England https://example.org/rivers\n\n✓ 2 of 2 claims found in the sources';
  assert.deepEqual(said(cited), ['The Thames is 215 miles long, the longest river wholly in England.']);
  // an ordinary reply that happens to mention sources is left alone
  assert.deepEqual(said('Two sources agree on it.'), ['Two sources agree on it.']);
});

test('read aloud by itself: a long reply stops after about half a minute and says the rest is on screen; a short one is said whole', () => {
  const long = said(`Here's Saturday:\n\n1. Leave by 8.30am.\n2. Fuel is £1.42 a litre.\n\n${'The forecast is dry with a light breeze from the west and highs of 14.5°C, so a jacket is enough. '.repeat(12)}`);
  const out = SP.brief(long);
  assert.equal(out.at(-1), 'The rest is on screen.');
  const chars = out.join(' ').length;
  assert.ok(chars <= 520 && chars >= 300, `about half a minute of speech: ${chars} characters`);
  assert.deepEqual(out.slice(0, -1), long.slice(0, out.length - 1), 'whole sentences, from the start');
  const short = said('It is 14.5°C. Bring a coat!');
  assert.deepEqual(SP.brief(short), short);
  // one very long first sentence is still said (cut into clips as usual), never nothing
  assert.equal(SP.brief(['x'.repeat(600), 'and more.'])[0], 'x'.repeat(600));
});
