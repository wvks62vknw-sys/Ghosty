// THE REAL SPEAKER MODEL FOR HIS VOICE (STARS 171; BRIEF-SPEAKER): the filterbank the voice model is fed, the judge for its 256-number
// embeddings, the old features as the fallback, the record's shape, and the lines that do not move, read from the source: nothing that
// confirms, pays, unlocks or approves reads the speaker score, a stranger is never named, no vendor's model name is anywhere.
// The model's own numbers are tests/speaker.spec.mjs's business (stood in there); here they are made up, seeded.
// Imported at the end of speech.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { build } from 'esbuild';
import { say, VOICES, RATE } from '../../../tests/voicegen.mjs';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: { fbank: at('../../web/src/assistant/speakerfbank.ts'), judge: at('../../web/src/assistant/speakerjudge.ts'), voiceprint: at('../../web/src/assistant/voiceprint.ts'), files: at('../../web/src/offline/speakerfiles.ts') }, bundle: true, format: 'esm', platform: 'neutral', outdir: at('./.build/speaker'), outExtension: { '.js': '.mjs' }, logLevel: 'warning' });
const FB = await import('./.build/speaker/fbank.mjs');
const J = await import('./.build/speaker/judge.mjs');
const V = await import('./.build/speaker/voiceprint.mjs');
const FILES = await import('./.build/speaker/files.mjs');
const web = (p) => readFileSync(new URL(`src/${p}`, new URL('../../web/', import.meta.url)), 'utf8');
const code = (p) => web(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

// ---- made-up embeddings: a voice is a seeded direction, a line read is that voice and a little of the room
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const base = (seed) => J.norm(Array.from({ length: J.EMB_LEN }, ((r) => () => gauss(r))(rng(seed))));
/** The voice with `room` of something else mixed in (0: the voice itself, 1: all room). */
const line = (voice, seed, room = 0.8) => J.norm(voice.map((x, i) => x + room * gauss(rng(seed * 1000 + i)) / 16));
const VA = base(1);
const VB = base(2);
const VC = base(3);
const enrolled = (v, s) => J.enrolEmb([0, 1, 2].map((i) => line(v, s + i)));
const withEmb = (print, emb) => ({ ...print, v: 1, looks: [], pooled: [], floor: 1, emb });
const known = (...vs) => vs.map(([id, name, me, emb]) => ({ id, name, me, print: withEmb({}, emb) }));
const kind = (w) => (w.kind === 'person' ? `person:${w.name}` : w.kind);

test('the filterbank has the shape the model takes: frames of 80, centred, deterministic, and nothing of a recording', () => {
  const pcm = say('A', 0, { seed: 3, lead: 0.5, tail: 0.5 });
  const a = FB.fbank(pcm);
  const b = FB.fbank(pcm);
  assert.ok(a && a.frames > 100 && a.data.length === a.frames * 80);
  assert.deepEqual(Array.from(a.data), Array.from(b.data), 'the same sound gives the same numbers');
  for (let m = 0; m < 80; m++) {
    let s = 0;
    for (let f = 0; f < a.frames; f++) s += a.data[f * 80 + m];
    assert.ok(Math.abs(s / a.frames) < 1e-3, 'each band has its mean taken off');
  }
  assert.ok(a.data.every(Number.isFinite));
  // the silence either side is cut: a capture with ten seconds of room round the line gives the line's frames
  const padded = new Float32Array(RATE * 10 + pcm.length);
  padded.set(pcm, RATE * 5);
  assert.ok(Math.abs(FB.fbank(padded).frames - a.frames) <= 25, 'the room at both ends is cut off');
  assert.equal(FB.fbank(new Float32Array(RATE * 3)), null, 'a silent capture is not embedded');
  assert.equal(FB.fbank(say('A', 0, { seed: 3 }).subarray(0, RATE * 0.5)), null, 'under a second of speech is not embedded');
  const long = new Float32Array(RATE * 30);
  for (let i = 0; i < long.length; i++) long[i] = 0.3 * Math.sin(i * 0.05) * (0.6 + 0.4 * Math.sin(i * 0.0007));
  assert.ok(FB.fbank(long).frames <= FB.MAX_SPEECH * 100 + 1, 'a long capture is cut to its middle');
});

test('the enrolment keeps the lines and their centre, never a recording; the accept line comes from the enrolment itself', () => {
  const A = enrolled(VA, 10);
  assert.equal(A.looks.length, 3);
  assert.ok(A.looks.every((l) => l.length === 256) && A.pooled.length === 256);
  assert.ok(Math.abs(J.cosine(A.pooled, A.pooled) - 1) < 1e-9, 'the centre has length 1');
  assert.ok(A.accept >= J.ACCEPT_MIN && A.accept <= J.ACCEPT_MAX);
  const steady = J.enrolEmb([0, 1, 2].map((i) => line(VA, 20 + i, 0.2)));
  const shaky = J.enrolEmb([0, 1, 2].map((i) => line(VA, 30 + i, 1.4)));
  assert.ok(steady.accept >= shaky.accept, 'a voice that wanders between the lines gets a lower line, a steady one a higher');
  assert.equal(J.enrolEmb([line(VA, 1), line(VA, 2)]), null, 'two lines are not enough');
  assert.equal(J.enrolEmb([line(VA, 1), line(VA, 2), null]), null, 'a line with no numbers is not a line');
  assert.equal(J.enrolEmb([line(VA, 1), line(VA, 2), [NaN, ...line(VA, 3).slice(1)]]), null, 'a hurt line is not a line');
  assert.ok(J.isEmb(JSON.parse(JSON.stringify(A))), 'it survives IndexedDB (structured clone) and JSON');
  assert.ok(!J.isEmb({ ...A, pooled: A.pooled.slice(1) }) && !J.isEmb({ ...A, accept: NaN }) && !J.isEmb(null));
});

test('the judge: him is YOU, a person he introduced is their name, a third voice is a voice I do not know, and every doubt fails closed', () => {
  const A = enrolled(VA, 10);
  const B = enrolled(VB, 50);
  const K = known(['me', 'You', true, A], ['v1', 'Sam', false, B]);
  assert.equal(kind(J.judgeEmb(K, line(VA, 90, 0.5)).who), 'owner');
  assert.equal(kind(J.judgeEmb(K, line(VB, 91, 0.5)).who), 'person:Sam');
  const c = J.judgeEmb(K, line(VC, 92, 0.5));
  assert.equal(kind(c.who), 'unknown');
  assert.equal(c.who.why, 'voice', 'a voice nothing like either is certainly another');
  // only him known: a stranger is never given his name, nor anyone's
  assert.equal(kind(J.judgeEmb(known(['me', 'You', true, A]), line(VB, 93, 0.5)).who), 'unknown');
  // no one known: nothing to say
  assert.equal(kind(J.judgeEmb([], line(VA, 94)).who), 'unknown');
  // a voice between the accept line and the reject line is not sure: a voice I do not know
  const blend = J.norm(VA.map((x, i) => 0.4 * x + 0.9 * VC[i]));
  const mid = J.judgeEmb(known(['me', 'You', true, A]), blend);
  assert.ok(mid.d > J.REJECT && mid.d < A.accept, 'a likeness between the two lines');
  assert.equal(kind(mid.who), 'unknown', `likeness ${mid.d.toFixed(2)} is under his accept line ${A.accept.toFixed(2)}`);
  // two voices that both claim it: unknown. (two near-identical records)
  const twin = known(['me', 'You', true, A], ['v2', 'Twin', false, enrolled(VA, 10)]);
  assert.equal(kind(J.judgeEmb(twin, line(VA, 95, 0.4)).who), 'unknown', 'two claimants are nobody');
  assert.equal(J.judgeEmb(twin, line(VA, 95, 0.4)).who.why, 'unsure');
  // the label is a word and a name he gave, never a number
  assert.ok(Object.keys(J.judgeEmb(K, line(VB, 96)).who).every((k) => ['kind', 'id', 'name', 'why'].includes(k)));
});

test('the old features judge whenever the model has no numbers: not on the phone, a record made before it, or a voice made without it', () => {
  const read = (v) => [0, 1, 2].map((s) => V.features(say(v, s, { seed: 3 + s, lead: 0.5, tail: 0.5 })));
  const A = V.enrol(read('A'));
  const B = V.enrol(read('B'));
  assert.equal(A.emb, undefined, 'no model numbers when the model gave none');
  assert.ok(V.isPrint(A) && V.isPrint(JSON.parse(JSON.stringify(A))), 'a record made before the model is still a voice');
  const later = V.features(say('A', 3, { seed: 43, lead: 0.5, tail: 0.5 }));
  const K = [{ id: 'me', name: 'You', me: true, print: A }, { id: 'v1', name: 'Sam', me: false, print: B }];
  const r = V.judgeBest(K, later);
  assert.equal(r.via, 'features');
  assert.equal(kind(r.who), 'owner', 'it is him by the phone’s own features, as before');
  // an embedding with nobody to compare it to (the people known have none): the features still judge
  assert.equal(V.judgeBest(K, { ...later, emb: line(VA, 1) }).via, 'features');
  // with the model's numbers on every voice and on the capture, the model judges
  const Am = { ...A, emb: enrolled(VA, 10) };
  const Bm = { ...B, emb: enrolled(VB, 50) };
  const Km = [{ id: 'me', name: 'You', me: true, print: Am }, { id: 'v1', name: 'Sam', me: false, print: Bm }];
  const m = V.judgeBest(Km, { ...later, emb: line(VB, 97, 0.5) });
  assert.equal(m.via, 'model');
  assert.equal(kind(m.who), 'person:Sam');
  // the enrolment keeps the model's numbers beside the features when all three lines have them
  const withModel = V.enrol(read('A').map((l, i) => ({ ...l, emb: line(VA, 10 + i) })));
  assert.ok(withModel.emb && withModel.emb.looks.length === 3 && V.isPrint(withModel));
  assert.equal(V.enrol(read('A').map((l, i) => (i ? { ...l, emb: line(VA, 10 + i) } : l))).emb, undefined, 'a line the model missed: the features alone');
  assert.ok(!V.isPrint({ ...withModel, emb: { ...withModel.emb, pooled: [1] } }), 'a hurt model record is no voice');
  // two people who sound too alike are not both kept
  assert.ok(V.soundsLike(Km, { ...A, emb: enrolled(VA, 70) }), 'the same voice again is refused as a second person');
  assert.equal(V.soundsLike([{ id: 'v1', name: 'Sam', me: false, print: Bm }], { ...A, emb: enrolled(VC, 80) }), null, 'a different voice is added');
});

test('the pack: the model and its worker are pinned to the files, the size said covers them, the runtime is the namer and the faces’', () => {
  const root = at('../../web/public');
  for (const [url, bytes] of FILES.VOICE_MODEL_ROWS) assert.equal(statSync(root + url).size, bytes, `${url} is the size pinned`);
  assert.equal(FILES.VOICE_MODEL_PIN.bytes, 26530309);
  const parts = FILES.VOICE_MODEL_ROWS.filter(([u]) => /voice-model\.onnx\.part\d$/.test(u));
  assert.deepEqual(parts.map(([u]) => u), FILES.VOICE_MODEL_PIN.parts, 'the model is two parts, in order');
  assert.equal(parts.reduce((n, [, b]) => n + b, 0), FILES.VOICE_MODEL_PIN.bytes, 'the parts add up to the model');
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  for (const f of walk(root)) assert.ok(statSync(f).size <= 25 * 2 ** 20, `${f.slice(root.length)} is within the 25 MiB the host takes`);
  assert.ok(!existsSync(root + '/vendor/speaker/voice-model.onnx'), 'the whole file is not kept: the host would refuse it');
  assert.ok(FILES.VOICE_PACK_BYTES > 26530309 && FILES.VOICE_PACK_BYTES < 45e6, 'about 41 MB with the runtime');
  const pack = code('offline/speakerpack.ts');
  assert.ok(/shared: true/.test(pack) && /EYES_CACHE/.test(pack) && !/https?:\/\//.test(pack), 'a pack in the Lens’s cache, this site’s own files, no other address');
});

test('NEVER A LOCK, read from the source: nothing that confirms, pays, unlocks or approves looks at a voice; a stranger is never named', () => {
  const VOICE = /voiceknown|voiceprint|voicestore|speakermodel|speakerjudge|speakerfbank|voicetag|lastScore|speaker\.get\(/;
  for (const p of ['ui/components.ts', 'house/sheet.ts', 'house/links.ts', 'features/house/index.ts', 'features/agenda/spending.ts', 'features/social/queue.ts', 'features/links/drafts.ts', 'features/workshop/draftcard.ts', 'features/homeadmin/sheet.ts', 'features/core/cards.ts', 'api/brain.ts', 'features/lens/people.ts', 'features/system/training.ts']) {
    assert.ok(!VOICE.test(code(p)), `${p} (a place something is confirmed or approved) never reads a voice`);
  }
  const session = web('assistant/session.ts');
  const a = session.indexOf('export async function answerApproval');
  assert.ok(!/voice|speaker|heard|hear\(|who\b/.test(session.slice(a, session.indexOf('/** Approvals being followed', a))), 'answerApproval does not look at a voice');
  // the voice modules reach nothing that confirms: no approval, no guarded set, no payment, no unlock
  for (const p of ['assistant/speakerjudge.ts', 'assistant/speakermodel.ts', 'assistant/speakerfbank.ts', 'assistant/voiceknown.ts', 'offline/speakerpack.ts']) {
    assert.ok(!/approv|confirm|ALWAYS_CONFIRM|guarded|unlock|payment|spend/i.test(code(p)), `${p} never touches a confirm`);
  }
  // the brain's own gates (the edge) have no knowledge of a speaker score
  const edge = (dir) => readdirSync(at(`../src/${dir}`)).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(at(`../src/${dir}/${f}`), 'utf8')).join('\n');
  assert.ok(!/speakerjudge|voiceknown|voiceprint|speaker score|speakerScore/.test(edge('kernel') + edge('tools')), 'the brain’s gates never read a voice score');
  // a stranger is never named, searched or profiled: the label for a voice that matches nobody carries no name and no search
  const judge = code('assistant/speakerjudge.ts');
  assert.ok(!/fetch\(|search|lookup|profile\(/.test(judge) && /why: 'voice'/.test(judge));
  const known = code('assistant/voiceknown.ts');
  assert.ok(/label: 'unknown'/.test(known) && !/label: \{ name: (?!r\.who\.name)/.test(known));
});
