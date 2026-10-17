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
