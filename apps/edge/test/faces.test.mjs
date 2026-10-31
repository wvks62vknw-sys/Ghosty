// THE FACE MODULE (apps/web/src/vision/facemath.ts, faces.ts, facestore.ts; OWNER-ISSUES 55, 56): the match maths with
// fixtures (two looks of one person match, two people do not, the thresholds, a near tie is nobody), the lining up of a
// face on SFace's template, the words ("this is Sam", "who's this?", "who am I?"), and the lines that do not move, read
// from the source itself: the face module's only way in is the live camera — no function takes a URL, a blob, a file,
// a picture or a canvas — it sends nothing anywhere but for its own model files, the faces live in their own IndexedDB
// on the phone, and BACKUP & RESTORE leaves them out. Last, the shipped model runs in the shipped runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
await build({ entryPoints: [at('../../web/src/vision/facemath.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/faces/facemath.mjs'), logLevel: 'warning' });
const F = await import('./.build/faces/facemath.mjs');
const ts = createRequire(import.meta.url)('typescript');
const WEB = new URL('../../web/', import.meta.url);
const src = (p) => readFileSync(new URL(p, WEB), 'utf8');
/** The code alone, without its comments (which talk about the brain, URLs and pictures in words). */
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/** A seeded random, so the fixtures are the same every run. */
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
const vec = (r) => Array.from({ length: 128 }, () => gauss(r));
/** A look of a person: their face plus the noise of one moment (light, angle) — `noise` 0.6 puts two looks at cosine ≈ 0.7. */
const look = (face, r, noise = 0.6) => F.normalize(face.map((x) => x + noise * gauss(r)));

// The fixtures: two people, five looks each, one look taken in bad light.
const r = rng(55);
const ADMIN = vec(r);
const SAM = vec(r);
const adminLooks = Array.from({ length: 5 }, () => look(ADMIN, r));
const samLooks = Array.from({ length: 3 }, () => look(SAM, r));
const people = [
  { id: 'me', name: 'You', me: true, looks: adminLooks.slice(0, 4).map(F.packLook), at: 1 },
  { id: 'p1', name: 'Sam', me: false, looks: samLooks.slice(0, 2).map(F.packLook), at: 2 },
];

test('the match maths: two looks of one person match, two people do not, and a near tie is nobody', () => {
  const same = F.cosine(adminLooks[0], adminLooks[1]);
  const apart = F.cosine(adminLooks[0], samLooks[0]);
  assert.ok(same > F.SURE, `two looks of him: ${same.toFixed(3)}`);
  assert.ok(Math.abs(apart) < F.MAYBE, `him and Sam: ${apart.toFixed(3)}`);
  // a new look of him (not one of those kept): him, sure — ADMIN
  const m = F.bestMatch(adminLooks[4], people);
  assert.equal(m.id, 'me');
  assert.equal(m.me, true);
  assert.equal(m.sure, true);
  // a new look of Sam: Sam, never him
  const s = F.bestMatch(samLooks[2], people);
  assert.equal(s.name, 'Sam');
  assert.equal(s.me, false);
  // somebody nobody introduced: nobody — no name, no guess
  assert.equal(F.bestMatch(look(vec(r), r), people), null);
  // a face exactly between him and Sam: nobody (never a guess between two)
  const between = F.normalize(ADMIN.map((x, i) => x + SAM[i]));
  assert.equal(F.bestMatch(between, people), null);
  // nothing known yet: nobody
  assert.equal(F.bestMatch(adminLooks[0], []), null);
});

test('the thresholds: SURE and above is "it\'s you", from MAYBE "I think it\'s you", below it nobody', () => {
  assert.equal(F.MAYBE, 0.363, "SFace's published threshold for the same person");
  assert.ok(F.SURE > F.MAYBE && F.SURE <= 0.5);
  // a vector at cosine c from the first kept look
  const unit = (c) => {
    const a = F.normalize(people[0].looks[0]);
    const v = vec(rng(9));
    const d = a.reduce((sum, x, i) => sum + x * v[i], 0);
    const o = F.normalize(v.map((x, i) => x - d * a[i]));
    return a.map((x, i) => c * x + Math.sqrt(1 - c * c) * o[i]);
  };
  const solo = [{ ...people[0], looks: [people[0].looks[0]] }];
  assert.deepEqual(F.bestMatch(unit(0.6), solo)?.sure, true);
  assert.deepEqual(F.bestMatch(unit(0.4), solo)?.sure, false, 'between the two: "I think it\'s you"');
  assert.equal(F.bestMatch(unit(0.3), solo), null, 'below MAYBE: nobody');
});

test('enrolling: a look of someone else in the middle of his five is dropped; looks are kept small', () => {
  const mixed = [adminLooks[0], adminLooks[1], samLooks[0], adminLooks[2], adminLooks[3]];
  const kept = F.steadyLooks(mixed);
  assert.equal(kept.length, 4);
  assert.ok(!kept.includes(samLooks[0]));
  const packed = F.packLook(adminLooks[0]);
  assert.equal(packed.length, 128);
  assert.ok(packed.every((x) => Math.round(x * 1e4) === x * 1e4 || Math.abs(Math.round(x * 1e4) - x * 1e4) < 1e-6));
  assert.ok(Math.abs(F.cosine(packed, adminLooks[0]) - 1) < 1e-4);
});

test('lining up: the eyes, nose and mouth onto SFace\'s 112 × 112 template, whatever the face\'s size, turn and place', () => {
  const T = F.FACE_TEMPLATE;
  // a face twice as big, turned 20°, moved
  const k = 2, a = (20 * Math.PI) / 180;
  const src = T.map(([x, y]) => [k * (Math.cos(a) * x - Math.sin(a) * y) + 300, k * (Math.sin(a) * x + Math.cos(a) * y) + 140]);
  const t = F.similarity(src, T);
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    assert.ok(Math.abs(t.a * x - t.b * y + t.tx - T[i][0]) < 1e-6 && Math.abs(t.b * x + t.a * y + t.ty - T[i][1]) < 1e-6, `point ${i}`);
  }
  // pixels into the model's layout: three planes, values as they are
  const chw = F.rgbaToRgbChw([10, 20, 30, 255, 40, 50, 60, 255], 2, 1);
  assert.deepEqual([...chw], [10, 40, 20, 50, 30, 60]);
  assert.ok(F.iou({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }) > 0.3);
});

test('the words: an introduction gives a name (never "fine" or "my house"); the questions are told apart', () => {
  assert.equal(F.introAsked('Ghosty, this is Sam'), 'Sam');
  assert.equal(F.introAsked('this is my cousin sam'), 'Sam');
  assert.equal(F.introAsked('Hey Ghosty, meet Jo Smith!'), 'Jo Smith');
  assert.equal(F.introAsked('say hello to my best mate Kev'), 'Kev');
  assert.equal(F.introAsked('this is my mum'), 'Mum');
  for (const t of ['this is fine', 'this is my house', 'this is it', 'this is a test', 'this is so good', 'what is this', 'this is me', 'stop', 'who is this'])
    assert.equal(F.introAsked(t), null, t);
  assert.equal(F.faceAsked('who am I?'), 'me');
  assert.equal(F.faceAsked('Ghosty, do you recognise me'), 'me');
  assert.equal(F.faceAsked('is this me?'), 'isme');
  assert.equal(F.faceAsked('is this you?'), 'isme');
  assert.equal(F.faceAsked("who's this?"), 'who');
  assert.equal(F.faceAsked('do you know who this is'), 'who');
  assert.equal(F.faceAsked('who is the prime minister'), null);
  assert.equal(F.faceAsked('stop'), null);
});

// ---------------------------------------------------------------- the lines that do not move, from the source

/** Every exported function and method in a file, with its parameters' types as written. */
function surface(file) {
  const sf = ts.createSourceFile(file, src(file), ts.ScriptTarget.ES2022, true);
  const out = [];
  const params = (fn) => fn.parameters.map((p) => ({ name: p.name.getText(sf), type: p.type ? p.type.getText(sf) : '(none)' }));
  const exported = (n) => ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export;
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) && exported(n)) out.push({ name: n.name.getText(sf), params: params(n) });
    if (ts.isClassDeclaration(n)) for (const m of n.members) if ((ts.isMethodDeclaration(m) || ts.isGetAccessor(m)) && !(ts.getCombinedModifierFlags(m) & ts.ModifierFlags.Private)) out.push({ name: `${n.name?.getText(sf)}.${m.name.getText(sf)}`, params: params(m) });
    if (ts.isVariableStatement(n) && exported(n)) for (const d of n.declarationList.declarations) if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) out.push({ name: d.name.getText(sf), params: params(d.initializer) });
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

const PICTURE = /\b(?:string|URL|Blob|File|FileList|Request|Response|ArrayBuffer|Uint8Array|Uint8ClampedArray|ImageBitmap|ImageData|HTMLImageElement|HTMLCanvasElement|OffscreenCanvas|CanvasImageSource|VideoFrame|ReadableStream|DataTransfer|any|unknown)\b/;

test('the face module\'s only way in is the live camera: no function takes a URL, a blob, a file, a picture or a canvas', () => {
  const fns = surface('src/vision/faces.ts');
  assert.ok(fns.some((f) => f.name === 'FaceEngine.look'), JSON.stringify(fns.map((f) => f.name)));
  for (const f of fns) for (const p of f.params) assert.doesNotMatch(p.type, PICTURE, `${f.name}(${p.name}: ${p.type})`);
  // the one that looks takes the live camera (and a choice of faces), and checks it is live before anything else
  const lookFn = fns.find((f) => f.name === 'FaceEngine.look');
  assert.deepEqual(lookFn.params.map((p) => p.type), ['LiveCamera', '(faces: FaceSeen[]) => number[]']);
  const engineSrc = src('src/vision/faces.ts');
  assert.match(engineSrc, /async look\(cam: LiveCamera[^)]*\)[^{]*\{\s*if \(!isLive\(cam\)\) throw new Error\(NOT_LIVE\);/, 'the live check comes first');
  assert.match(engineSrc, /instanceof MediaStream/);
  assert.match(engineSrc, /CanvasCaptureMediaStreamTrack/, 'a picture drawn into a stream is not a camera');
  // the store takes names and numbers, never a picture
  for (const f of surface('src/vision/facestore.ts')) for (const p of f.params) assert.doesNotMatch(p.type.replace(/^string$/, ''), PICTURE, `${f.name}(${p.name}: ${p.type})`);
});

test('nothing leaves the phone: the face code fetches only its own model files, the store and the maths no network at all', () => {
  const NET = /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts)\s*\(|\bbrain\.|\/api\//;
  for (const f of ['src/vision/facemath.ts', 'src/vision/facestore.ts', 'src/features/settings/faces.ts']) assert.doesNotMatch(code(f), NET, f);
  // faces.ts: only fetchModel on its own two files (the vendored ones), nothing else
  const engine = code('src/vision/faces.ts');
  assert.doesNotMatch(engine.replace(/fetchModel\(FACE_FILES\.(?:detector|model),/g, ''), NET);
  assert.match(engine, /detector: '\/vendor\/faces\/blaze_face_short_range\.tflite'/);
  assert.match(engine, /model: '\/vendor\/faces\/face_recognition_sface_2021dec_int8\.onnx'/);
  // the worker has no network of its own
  assert.doesNotMatch(readFileSync(new URL('public/vendor/faces/worker.mjs', WEB), 'utf8'), /\bfetch\(|XMLHttpRequest|WebSocket/);
  // PEOPLE never puts a face turn in the chat (the chat's recent turns go to the brain) and never tells the brain who is in view
  const people = code('src/features/lens/people.ts');
  assert.doesNotMatch(people, /\bchat\.set|\bbrain\.|from '\.\.\/\.\.\/api\/brain'/);
  assert.match(src('src/features/lens/index.ts'), /if \(S\.mode === 'people'\) return `\$\{bits\[0\]\}\.`;/, 'the brain hears only that PEOPLE is open');
  // what is said in PEOPLE goes in the phone's own voice only
  assert.match(people, /speak\(text, \{ here: true \}\)/);
});

test('BACKUP & RESTORE leaves the faces out; the faces have their own database on the phone', () => {
  const backup = src('src/features/system/backup.ts');
  const keys = [...backup.matchAll(/\{ key: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10, keys.join(','));
  for (const k of keys) assert.doesNotMatch(k, /face|people|guardian|panic/i, `the backup takes ${k}`);
  assert.doesNotMatch(backup.replace(/^\s*\*.*$/gm, ''), /ghosty-faces|facestore|knownFaces/, 'the backup code never reads the faces');
  assert.match(backup, /the faces this phone knows/i, 'and says so where it lists what is left out');
  assert.match(src('src/vision/facestore.ts'), /export const FACE_DB = 'ghosty-faces';/);
});

test('the shipped models: small, free, vendored with their licence; SFace runs in the shipped runtime and gives 128 numbers', async () => {
  const dir = new URL('public/vendor/faces/', WEB);
  const det = statSync(new URL('blaze_face_short_range.tflite', dir)).size;
  const emb = statSync(new URL('face_recognition_sface_2021dec_int8.onnx', dir)).size;
  assert.ok(det < 300_000 && emb < 10_500_000, `${det} + ${emb} bytes`);
  assert.match(readFileSync(new URL('LICENSE-sface.txt', dir), 'utf8'), /Apache License\s+Version 2\.0/);
  // the NAME mode's runtime (onnxruntime-web, WebAssembly), as the phone's worker loads it
  const ortDir = new URL('public/vendor/clip/', WEB);
  const ort = await import(new URL('ort.wasm.min.mjs', ortDir).href);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = ortDir.pathname;
  ort.env.logLevel = 'error';
  const session = await ort.InferenceSession.create(readFileSync(new URL('face_recognition_sface_2021dec_int8.onnx', dir)), { executionProviders: ['wasm'], logSeverityLevel: 3 });
  // a smooth picture of 112 × 112 (no face: the arithmetic, not a person)
  const pic = (shift, gain) => {
    const a = new Float32Array(3 * 112 * 112);
    for (let c = 0; c < 3; c++) for (let y = 0; y < 112; y++) for (let x = 0; x < 112; x++) a[c * 12544 + y * 112 + x] = Math.min(255, gain * (120 + 80 * Math.sin((x + shift) / 9) * Math.cos(y / 13) + 20 * c));
    return a;
  };
  const run = async (d) => F.normalize((await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', d, [1, 3, 112, 112]) }))[session.outputNames[0]].data);
  const a = await run(pic(0, 1));
  assert.equal(a.length, 128);
  assert.deepEqual(await run(pic(0, 1)), a, 'the same picture gives the same numbers');
  const brighter = await run(pic(0, 1.08));
  const other = await run(pic(37, 0.7));
  assert.ok(F.cosine(a, brighter) > F.cosine(a, other), `a brighter copy stays nearer (${F.cosine(a, brighter).toFixed(3)}) than another picture (${F.cosine(a, other).toFixed(3)})`);
});
