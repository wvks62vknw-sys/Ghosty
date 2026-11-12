// A stand-in for the voice model, for tests/speaker.spec.mjs only: 256 numbers from a capture's own sound, so that the same voice reading
// different lines lands near itself and another voice lands away, the way the real model's numbers do. NOT the model, and nothing of the
// app: the page's filterbank, judge, store, words and screens are real; only the network's 26 MB of weights is replaced. The function is
// written as a string of plain script so the spec can hand it to the page (`page.addInitScript`) and the unit check can run it in Node.
// what every voice here has in common once the browser's microphone chain (echo cancelling, noise suppression, gain) has been over it, measured on captures of three voices and taken off (the real model's numbers are centred the same way by its training)
const REF = [0.0444,0.0474,0.0509,0.0547,0.0571,0.0594,0.0602,0.0596,0.0582,0.056,0.0546,0.0535,0.0507,0.0472,0.0463,0.0471,0.0477,0.0481,0.0487,0.0502,0.0514,0.0528,0.0535,0.0568,0.0577,0.0561,0.053,0.0501,0.0463,0.0431,0.0431,0.0426,0.0436,0.0453,0.0484,0.0522,0.055,0.0555,0.0541,0.0507,0.0441,0.0403,0.0392,0.0395,0.04,0.0398,0.0403,0.0393,0.0383,0.0371,0.0348,0.0324,0.0295,0.0256,0.0231,0.0213,0.0201,0.0197,0.0194,0.0185,0.0172,0.0133,0.0073,0.003,0.001,0.0011,0.0035,0.0039,-0.001,-0.0066,-0.0116,-0.0129,-0.0118,-0.012,-0.0129,-0.0155,-0.0187,-0.0213,-0.0232,-0.0243,-0.0255,-0.0245,-0.0254,-0.0281,-0.0318,-0.033,-0.0341,-0.032,-0.0318,-0.0348,-0.0385,-0.04,-0.0383,-0.0368,-0.0381,-0.0414,-0.0427,-0.0409,-0.0392,-0.0398,-0.0436,-0.0456,-0.0418,-0.0403,-0.0426,-0.0459,-0.048,-0.0478,-0.0483,-0.0515,-0.0554,-0.0547,-0.056,-0.0597,-0.0632,-0.0666,-0.0717,-0.0776,-0.0802,-0.0839,-0.0863,-0.0896,-0.0919,-0.0939,-0.0966,-0.0992,-0.0992,-0.0963,0.0621,0.0653,0.0672,0.0703,0.0736,0.0782,0.0803,0.0801,0.0789,0.075,0.0703,0.0655,0.06,0.0569,0.0599,0.0635,0.0627,0.0591,0.0577,0.0581,0.0593,0.0622,0.0648,0.0725,0.0741,0.0698,0.063,0.0574,0.051,0.0464,0.0464,0.0452,0.0451,0.0465,0.0519,0.0604,0.0671,0.0688,0.0653,0.0574,0.0433,0.0362,0.0343,0.0351,0.0363,0.0354,0.0358,0.0343,0.0335,0.0321,0.0277,0.0234,0.0193,0.0148,0.0123,0.0102,0.0092,0.0096,0.0096,0.0088,0.0071,0.0041,0.0013,0.0003,0.0001,0.0003,0.0009,0.0013,-0.0001,-0.0019,-0.0035,-0.0038,-0.0034,-0.0039,-0.0051,-0.0073,-0.0087,-0.0101,-0.0123,-0.0134,-0.0148,-0.014,-0.0149,-0.0177,-0.0224,-0.0241,-0.0258,-0.023,-0.0227,-0.027,-0.0329,-0.0354,-0.0327,-0.0307,-0.0325,-0.0379,-0.0404,-0.0372,-0.0341,-0.0353,-0.0427,-0.0472,-0.0404,-0.0367,-0.0406,-0.0477,-0.0531,-0.0522,-0.0539,-0.0615,-0.0711,-0.0724,-0.0763,-0.085,-0.0945,-0.1045,-0.1193,-0.1355,-0.144,-0.159,-0.1664,-0.1778,-0.1867,-0.1955,-0.2068,-0.2177,-0.218,-0.2052];
export const FAKE_EMBED = `(() => { const REF = ${JSON.stringify(REF)}; return (pcm) => {
  const RATE = 16000, F = 400, HOP = 400, N = 128;
  const frames = Math.floor((pcm.length - F) / HOP) + 1;
  if (frames < 20) return null;
  const en = new Float64Array(frames);
  for (let f = 0; f < frames; f++) { let s = 0; for (let i = 0; i < F; i++) s += pcm[f * HOP + i] ** 2; en[f] = s; }
  const loud = Float64Array.from(en).sort()[Math.floor(frames * 0.9)];
  const mel = (hz) => 2595 * Math.log10(1 + hz / 700), unmel = (m) => 700 * (10 ** (m / 2595) - 1);
  const freqs = Array.from({ length: N }, (_, i) => unmel(mel(120) + ((mel(3600) - mel(120)) * i) / (N - 1)));
  const acc = new Float64Array(N); let n = 0;
  for (let f = 0; f < frames; f++) {
    if (en[f] < loud * 0.05) continue;
    const row = new Float64Array(N); let mean = 0;
    for (let k = 0; k < N; k++) {
      const w = (2 * Math.PI * freqs[k]) / RATE, c = 2 * Math.cos(w); let s1 = 0, s2 = 0;
      for (let i = 0; i < F; i++) { const x = pcm[f * HOP + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (F - 1))); const s0 = x + c * s1 - s2; s2 = s1; s1 = s0; }
      row[k] = Math.log(s1 * s1 + s2 * s2 - c * s1 * s2 + 1e-9); mean += row[k];
    }
    mean /= N; for (let k = 0; k < N; k++) acc[k] += row[k] - mean; n++;
  }
  if (n < 20) return null;
  const mean = Array.from(acc, (v) => v / n);
  // the shape of the voice, and its square (so two voices that differ in the shape's size differ more): 256 numbers
  const m = mean.reduce((a, b) => a + b, 0) / N;
  const c = mean.map((v) => v - m);
  const e = [...c, ...c.map((v) => Math.sign(v) * v * v / 4)];
  const len = Math.sqrt(e.reduce((a, b) => a + b * b, 0)) || 1;
  return e.map((v, i) => v / len - REF[i]);
}; })()`;
export const fakeEmbed = (pcm) => (0, eval)(FAKE_EMBED)(pcm);
