/**
 * SOUND: a sound check with the phone's microphone, in two ways.
 *
 * LISTEN — 5 or 10 seconds of whatever is playing, recorded raw (no echo cancelling, no noise
 * suppression, no automatic gain: those would hide exactly what we are listening for) → levels,
 * clipping, hum, boom and harshness (sound/analyse.ts) → one plain verdict ("clipping: turn the
 * volume down a couple of notches") with the third-octave spectrum drawn.
 *
 * TEST TONE — the phone plays a 1 kHz tone in ten steps from 10% to full level, then a sweep from
 * 40 Hz to 16 kHz, while the microphone listens to the speaker under test (the phone plugged into
 * it, or held near it) → the distortion at every step, where it starts ("distorts above ~70%
 * volume"), the speaker limiting, and the frequency response relative to 1 kHz.
 *
 * Everything is worked out on the phone; nothing is sent until ASK GHOSTY, which sends the report
 * in words (as the phone's own measurement, marked as data), never the recording. The camera is
 * switched off while SOUND is open. State for tests and the console: window.__ghosty.sound.
 */
import { clear, h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { askWithImage } from '../../vision/ask';
import { analyseRecording, analyseTestTone, describeListen, describeTone, hz, planSeconds, THD_LIMIT, TONE_PLAN, type Band, type ListenReport, type ToneReport } from '../../sound/analyse';
import type { LensContext, Mode, ModeOpts } from './index';

type Sub = 'listen' | 'tone';
type Phase = 'idle' | 'starting' | 'recording' | 'playing' | 'analysing' | 'done' | 'error';

/** What SOUND is doing, for tests and the console (window.__ghosty.sound). */
export interface SoundState {
  sub: Sub;
  phase: Phase;
  status: string;
  /** Live input level while recording, dBFS. */
  level: number;
  sampleRate: number;
  seconds: number;
  verdict: string;
  kind: string;
  findings: string[];
  /** What ASK GHOSTY sends (the report in words). */
  words: string;
  reply: string;
  error: string;
}

export const soundState: SoundState = { sub: 'listen', phase: 'idle', status: '', level: -100, sampleRate: 0, seconds: 0, verdict: '', kind: '', findings: [], words: '', reply: '', error: '' };

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.sound = soundState;
}

const LEAD_SEC = 0.5;

/** The microphone, raw: what the phone hears, with every voice-call "improvement" switched off. */
const RAW_AUDIO: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };

/** Why the microphone would not open, in words the owner can act on. */
function micMessage(e: unknown): string {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'The microphone is blocked: allow it for this site (iPhone: Settings → Safari → Microphone, or the aA menu → Website Settings)';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found on this device';
  if (name === 'NotReadableError') return 'The microphone is busy (another app is using it)';
  return `The microphone did not open: ${String((e as Error)?.message ?? e)}`;
}

/** The theme's colours for drawing (canvas cannot read CSS variables itself). */
function colours(): { c: string; a: string; r: string; ok: string; mute: string; line: string } {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => s.getPropertyValue(n).trim() || d;
  return { c: v('--c', '#62e4ff'), a: v('--a', '#ffb23e'), r: v('--r', '#ff4d5e'), ok: v('--ok', '#4fe3a8'), mute: v('--mute', '#7d93a3'), line: 'rgba(98, 228, 255, .16)' };
}

/** A canvas sized for crisp lines at this screen's pixel density; draw in CSS pixels. */
function sized(cv: HTMLCanvasElement, w: number, hh: number): CanvasRenderingContext2D | null {
  const k = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * k)) cv.width = Math.round(w * k);
  if (cv.height !== Math.round(hh * k)) cv.height = Math.round(hh * k);
  const c = cv.getContext('2d');
  c?.setTransform(k, 0, 0, k, 0, 0);
  c?.clearRect(0, 0, w, hh);
  return c;
}

const FONT = '500 9px "IBM Plex Mono", ui-monospace, monospace';

/**
 * Bars on a log-frequency axis: the third-octave spectrum (absolute dBFS) or the response
 * (relative to 1 kHz, a zero line drawn). Stark style: thin cyan bars, small mono labels.
 */
function drawBands(c: CanvasRenderingContext2D, w: number, hh: number, bands: Band[], opts: { relative?: boolean; title: string }): void {
  const col = colours();
  const padL = 26;
  const padB = 14;
  const padT = 14;
  const plotW = w - padL - 4;
  const plotH = hh - padB - padT;
  const lo = opts.relative ? -30 : -90;
  const hi = opts.relative ? 15 : 0;
  const y = (d: number) => padT + plotH * (1 - (Math.max(lo, Math.min(hi, d)) - lo) / (hi - lo));
  const fx = (f: number) => padL + (plotW * Math.log(f / 20)) / Math.log(20000 / 20);
  c.font = FONT;
  c.fillStyle = col.mute;
  c.fillText(opts.title, padL, 10);
  c.strokeStyle = col.line;
  c.lineWidth = 1;
  for (let d = lo; d <= hi; d += opts.relative ? 15 : 30) {
    c.beginPath();
    c.moveTo(padL, y(d) + 0.5);
    c.lineTo(w - 4, y(d) + 0.5);
    c.stroke();
    c.fillText(`${d > 0 ? '+' : ''}${d}`, 2, y(d) + 3);
  }
  for (const [f, t] of [[50, '50'], [100, '100'], [1000, '1k'], [10000, '10k']] as const) c.fillText(t, fx(f) - 6, hh - 3);
  if (!bands.length) return;
  const bw = Math.max(2, plotW / 32);
  const base = opts.relative ? y(0) : y(lo);
  for (const b of bands) {
    const x = fx(b.f) - bw / 2;
    const top = y(b.db);
    const bad = opts.relative ? Math.abs(b.db) >= 8 : false;
    c.fillStyle = bad ? col.a : col.c;
    c.globalAlpha = 0.75;
    c.fillRect(x, Math.min(top, base), bw - 1, Math.max(1, Math.abs(base - top)));
    c.globalAlpha = 1;
  }
  if (opts.relative) {
    c.strokeStyle = col.c;
    c.beginPath();
    c.moveTo(padL, y(0) + 0.5);
    c.lineTo(w - 4, y(0) + 0.5);
    c.stroke();
  }
}

/** Distortion at each test-tone step: a bar per step, amber past the limit. */
function drawSteps(c: CanvasRenderingContext2D, w: number, hh: number, r: ToneReport): void {
  const col = colours();
  const padL = 26;
  const padB = 14;
  const padT = 14;
  const plotW = w - padL - 4;
  const plotH = hh - padB - padT;
  const max = 0.2;
  c.font = FONT;
  c.fillStyle = col.mute;
  c.fillText('DISTORTION AT EACH LEVEL', padL, 10);
  const y = (v: number) => padT + plotH * (1 - Math.min(max, v) / max);
  c.strokeStyle = col.line;
  for (const v of [0, 0.1, 0.2]) {
    c.beginPath();
    c.moveTo(padL, y(v) + 0.5);
    c.lineTo(w - 4, y(v) + 0.5);
    c.stroke();
    c.fillText(`${v * 100}%`, 2, y(v) + 3);
  }
  // the limit line
  c.strokeStyle = col.a;
  c.setLineDash([3, 3]);
  c.beginPath();
  c.moveTo(padL, y(THD_LIMIT) + 0.5);
  c.lineTo(w - 4, y(THD_LIMIT) + 0.5);
  c.stroke();
  c.setLineDash([]);
  const n = Math.max(1, r.steps.length);
  const bw = plotW / n;
  r.steps.forEach((s, i) => {
    const x = padL + i * bw + 2;
    c.fillStyle = !s.heard ? col.mute : s.thd >= THD_LIMIT ? col.a : col.c;
    c.globalAlpha = s.heard ? 0.8 : 0.3;
    const top = y(s.heard ? s.thd : 0.004);
    c.fillRect(x, top, bw - 4, Math.max(1, y(0) - top));
    c.globalAlpha = 1;
    c.fillStyle = col.mute;
    c.fillText(`${Math.round(s.level * 100)}`, x, hh - 3);
  });
}

export function createSoundMode(L: LensContext): Mode {
  const S = soundState;
  let sub: Sub = 'listen';
  let seconds = 5;
  /** Everything a run opened, closed on leaving or when it ends. */
  let run: { ctx: AudioContext; stream: MediaStream; nodes: AudioNode[]; timer: number; raf: number } | null = null;
  let runGen = 0;
  let lastListen: ListenReport | null = null;
  let lastTone: ToneReport | null = null;
  let asking = false;

  const status = (text: string, light?: 'ok' | 'mid' | 'off') => {
    S.status = text;
    L.status(text, light);
  };
  /** Scroll the Lens panel (not the page) so a card that just appeared starts in view. */
  const reveal = (el: HTMLElement) =>
    requestAnimationFrame(() => {
      const p = L.panel.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (r.top < p.top || r.top > p.bottom - 60) L.panel.scrollTo({ top: L.panel.scrollTop + r.top - p.top - 8, behavior: 'smooth' });
    });

  // ---- the two ways' switches
  const subBtns = new Map<Sub, HTMLButtonElement>();
  const subRow = h('div.lenschips.soundsubs');
  for (const [id, label] of [['listen', 'LISTEN'], ['tone', 'TEST TONE']] as const) {
    const b = button(label, () => setSub(id));
    subBtns.set(id, b);
    subRow.append(b);
  }
  const lenBtns = ([5, 10] as const).map((s) => button(`${s} S`, () => {
    seconds = s;
    lenBtns.forEach((b, i) => b.classList.toggle('on', [5, 10][i] === s));
  }));
  lenBtns[0]!.classList.add('on');
  const lenRow = h('div.lenschips', h('small.soundlab', 'RECORD FOR'), ...lenBtns);
  const goBtn = button('RECORD', () => void start(), 'warn');
  const stopBtn = button('STOP', () => stop('stopped'));
  stopBtn.hidden = true;
  const howListen = h('div.note', 'Play the music (or the sound you are unsure about) at the volume you normally use, hold the phone a metre or two from the speaker, keep quiet, then RECORD. Ghosty listens for clipping, hum, boomy bass and harsh treble. Nothing is sent anywhere.');
  const howTone = h('div.note', `The phone plays a 1 kHz tone getting louder in 10 steps, then a sweep from low to high (${Math.round(planSeconds() + LEAD_SEC + 0.6)} s in all). For the speaker under test, plug the phone into it (cable or Bluetooth) at your usual volume — or hold the phone close to it — and keep the room quiet. The tone is loud at the end: turn the speaker down first if you are unsure.`);
  const meter = h('div.soundmeter', h('i'));
  meter.hidden = true;
  const verdict = h('div.soundverdict');
  const findings = h('ul.soundfind');
  const rows = h('div.soundrows');
  const chartA = h('canvas.soundchart', { 'aria-label': 'chart' });
  const chartB = h('canvas.soundchart', { 'aria-label': 'chart' });
  const q = h('textarea.lensq', { rows: 2, placeholder: 'Ask about it (e.g. "what should I change on my Sony soundbar?")', 'aria-label': 'Your question about the sound check' });
  const askBtn = button('ASK GHOSTY', () => void ask(), 'on');
  const replyModel = h('small');
  const replyText = h('div');
  const reply = h('div.lensreply', replyModel, replyText);
  reply.hidden = true;
  const result = h('div.soundcard', h('small', 'RESULT'), verdict, findings, rows, chartA, chartB, q, h('div.row', askBtn), reply);
  result.hidden = true;
  const body = h('div.stackf', lenRow, howListen, howTone, h('div.row', goBtn, stopBtn), meter);
  const root = h('div.stackf', subRow, body, result);

  const setSub = (s: Sub) => {
    if (run) stop('stopped');
    sub = s;
    S.sub = s;
    for (const [id, b] of subBtns) b.classList.toggle('on', id === s);
    lenRow.hidden = s !== 'listen';
    howListen.hidden = s !== 'listen';
    howTone.hidden = s !== 'tone';
    goBtn.textContent = s === 'listen' ? 'RECORD' : 'START TEST';
    const shown = s === 'listen' ? lastListen : lastTone;
    if (shown) (s === 'listen' ? showListen(lastListen!) : showTone(lastTone!));
    else {
      result.hidden = true;
      L.clearOverlay();
      L.lines('', '');
    }
    if (!run) status(s === 'listen' ? 'LISTEN: play your music, then RECORD' : 'TEST TONE: connect the speaker, then START TEST', 'ok');
  };

  /** Close everything a run opened (microphone, audio graph, timers). */
  const release = () => {
    if (!run) return;
    clearTimeout(run.timer);
    cancelAnimationFrame(run.raf);
    for (const n of run.nodes) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
    for (const t of run.stream.getTracks()) t.stop();
    void run.ctx.close().catch(() => undefined);
    run = null;
    meter.hidden = true;
    goBtn.hidden = false;
    stopBtn.hidden = true;
    goBtn.disabled = false;
  };

  const stop = (why: string) => {
    runGen++;
    release();
    S.phase = 'idle';
    status(why === 'stopped' ? 'stopped · nothing kept' : why, 'mid');
  };

  /** The live level meter (panel bar + viewfinder), from the newest block of samples. */
  const drawLive = (peakDb: number, elapsed: number, total: number) => {
    const frac = Math.max(0, Math.min(1, (peakDb + 60) / 60));
    const bar = meter.firstElementChild as HTMLElement;
    bar.style.width = `${Math.round(frac * 100)}%`;
    bar.className = peakDb > -1 ? 'hot' : '';
    const c = L.overlay();
    if (!c) return;
    const { size } = L.view();
    const col = colours();
    const w = size.w - 32;
    const y = size.h / 2;
    c.fillStyle = 'rgba(2, 7, 13, .55)';
    c.fillRect(16, y - 30, w, 60);
    c.strokeStyle = col.line;
    c.strokeRect(16.5, y - 29.5, w - 1, 59);
    c.fillStyle = peakDb > -1 ? col.r : peakDb > -6 ? col.a : col.c;
    c.fillRect(20, y - 6, (w - 8) * frac, 12);
    c.font = FONT;
    c.fillStyle = col.mute;
    c.fillText(`INPUT ${peakDb > -99 ? peakDb.toFixed(0) : '–∞'} dBFS`, 22, y - 14);
    c.fillText(`${elapsed.toFixed(1)} / ${total.toFixed(1)} s`, 22, y + 24);
  };

  /** One run: open the microphone (and, for TEST TONE, play the plan), record, analyse, show. */
  const start = async () => {
    if (run || S.phase === 'starting' || S.phase === 'analysing') return;
    const gen = ++runGen;
    S.error = '';
    S.reply = '';
    reply.hidden = true;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx || !navigator.mediaDevices?.getUserMedia) {
      S.phase = 'error';
      S.error = 'This browser cannot record sound';
      return void status(S.error, 'off');
    }
    // Made and resumed inside the tap: iOS only lets sound start from the owner's own touch.
    const ctx = new Ctx();
    void ctx.resume().catch(() => undefined);
    S.phase = 'starting';
    goBtn.disabled = true;
    status('opening the microphone…', 'mid');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: RAW_AUDIO, video: false });
    } catch (e) {
      void ctx.close().catch(() => undefined);
      goBtn.disabled = false;
      if (gen !== runGen) return;
      S.phase = 'error';
      S.error = micMessage(e);
      toast(S.error, 'warn');
      return void status(S.error, 'off');
    }
    if (gen !== runGen) {
      for (const t of stream.getTracks()) t.stop();
      void ctx.close().catch(() => undefined);
      return;
    }
    await ctx.resume().catch(() => undefined);
    // SOUND may have been left while the audio was starting: give the microphone back at once.
    if (gen !== runGen) {
      for (const t of stream.getTracks()) t.stop();
      void ctx.close().catch(() => undefined);
      return;
    }
    S.sampleRate = ctx.sampleRate;
    const src = ctx.createMediaStreamSource(stream);
    // ScriptProcessor: deprecated but everywhere (iOS included), and an AudioWorklet would need a module file of its own
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
    const nodes: AudioNode[] = [src, proc, mute];
    const chunks: Float32Array[] = [];
    let got = 0;
    const total = sub === 'listen' ? seconds : LEAD_SEC + planSeconds() + 0.6;
    const want = Math.round(total * ctx.sampleRate);
    let peakDb = -100;
    proc.onaudioprocess = (ev) => {
      if (gen !== runGen || got >= want) return;
      const data = ev.inputBuffer.getChannelData(0);
      const copy = new Float32Array(Math.min(data.length, want - got));
      copy.set(data.subarray(0, copy.length));
      chunks.push(copy);
      got += copy.length;
      let p = 0;
      for (let i = 0; i < copy.length; i++) p = Math.max(p, Math.abs(copy[i]!));
      peakDb = 20 * Math.log10(Math.max(p, 1e-6));
      S.level = peakDb;
      if (got >= want) void finish();
    };
    run = { ctx, stream, nodes, timer: 0, raf: 0 };
    // a stuck microphone (no samples arriving) must not hang the screen
    run.timer = window.setTimeout(() => {
      if (gen === runGen && got < want) {
        if (got > ctx.sampleRate) void finish();
        else stop("No sound arrived from the microphone: check it isn't muted or used by another app");
      }
    }, (total + 4) * 1000);
    if (sub === 'tone') {
      const t0 = ctx.currentTime + LEAD_SEC;
      const p = TONE_PLAN;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.value = p.freq;
      g.gain.setValueAtTime(0, ctx.currentTime);
      p.levels.forEach((lv, i) => g.gain.setValueAtTime(lv, t0 + i * p.stepSec));
      g.gain.setValueAtTime(0, t0 + p.levels.length * p.stepSec);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 - 0.05);
      osc.stop(t0 + p.levels.length * p.stepSec + 0.05);
      const s0 = t0 + p.levels.length * p.stepSec + p.gapSec;
      const sw = ctx.createOscillator();
      const sg = ctx.createGain();
      sw.frequency.setValueAtTime(p.sweep.from, s0);
      sw.frequency.exponentialRampToValueAtTime(p.sweep.to, s0 + p.sweep.sec);
      sg.gain.setValueAtTime(0, ctx.currentTime);
      sg.gain.setValueAtTime(p.sweep.level, s0);
      sg.gain.setValueAtTime(0, s0 + p.sweep.sec);
      sw.connect(sg).connect(ctx.destination);
      sw.start(s0);
      sw.stop(s0 + p.sweep.sec + 0.05);
      nodes.push(osc, g, sw, sg);
      S.phase = 'playing';
      status('playing the test tone · keep quiet…', 'mid');
    } else {
      S.phase = 'recording';
      status(`listening for ${seconds} s · keep quiet…`, 'mid');
    }
    goBtn.hidden = true;
    stopBtn.hidden = false;
    meter.hidden = false;
    result.hidden = true;
    const began = performance.now();
    const frame = () => {
      if (!run || gen !== runGen) return;
      drawLive(peakDb, Math.min(total, (performance.now() - began) / 1000), total);
      run.raf = requestAnimationFrame(frame);
    };
    run.raf = requestAnimationFrame(frame);

    const finish = async () => {
      if (gen !== runGen || !run) return;
      const rate = ctx.sampleRate;
      release();
      const x = new Float32Array(got);
      let o = 0;
      for (const c of chunks) {
        x.set(c, o);
        o += c.length;
      }
      S.phase = 'analysing';
      status('working it out…', 'mid');
      // let the status paint before the sums
      await new Promise((r) => setTimeout(r, 30));
      if (gen !== runGen) return;
      try {
        if (sub === 'listen') showListen((lastListen = analyseRecording(x, rate)));
        else showTone((lastTone = analyseTestTone(x, rate)));
        S.phase = 'done';
      } catch (e) {
        S.phase = 'error';
        S.error = `Could not work it out: ${String((e as Error)?.message ?? e)}`;
        status(S.error, 'off');
      }
    };
  };

  const row = (k: string, v: string) => h('div.scankv', h('b', k), h('span', v));
  const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

  /** The chart in the panel, and the same big over the viewfinder. */
  const charts = (draw: (c: CanvasRenderingContext2D, w: number, hh: number) => void, draw2?: (c: CanvasRenderingContext2D, w: number, hh: number) => void) => {
    const w = Math.max(240, Math.min(560, L.panel.clientWidth - 24));
    const a = sized(chartA, w, 120);
    if (a) draw(a, w, 120);
    chartA.style.width = `${w}px`;
    chartA.style.height = '120px';
    chartB.hidden = !draw2;
    if (draw2) {
      const b = sized(chartB, w, 120);
      if (b) draw2(b, w, 120);
      chartB.style.width = `${w}px`;
      chartB.style.height = '120px';
    }
    const c = L.overlay();
    if (c) {
      const { size } = L.view();
      // under the status line, over the scene lines
      c.fillStyle = 'rgba(2, 7, 13, .62)';
      c.fillRect(8, 26, size.w - 16, size.h - 52);
      c.save();
      c.translate(8, 28);
      draw(c, size.w - 16, size.h - 56);
      c.restore();
    }
  };

  const fill = (verdictText: string, kind: string, items: { text: string; level: number }[], kvs: [string, string][], words: string) => {
    S.verdict = verdictText;
    S.kind = kind;
    S.findings = items.map((f) => f.text);
    S.words = words;
    verdict.textContent = verdictText.charAt(0).toUpperCase() + verdictText.slice(1);
    verdict.className = `soundverdict ${items[0]?.level === 2 ? 'bad' : items[0]?.level === 1 ? 'mid' : 'ok'}`;
    clear(findings, ...items.slice(1).map((f) => h('li', f.text)));
    clear(rows, ...kvs.map(([k, v]) => row(k, v)));
    result.hidden = false;
    reply.hidden = !S.reply;
    status(verdictText, items[0]?.level === 2 ? 'off' : items[0]?.level === 1 ? 'mid' : 'ok');
    reveal(result);
  };

  const showListen = (r: ListenReport) => {
    fill(
      r.verdict,
      r.kind,
      r.findings,
      [
        ['PEAK', `${r.levels.peakDb.toFixed(1)} dBFS`],
        ['RMS', `${r.levels.rmsDb.toFixed(1)} dBFS`],
        ['CREST', `${r.levels.crestDb.toFixed(1)} dB${r.levels.crestDb < 8 && !r.tone ? ' (squashed)' : ''}`],
        ['FLAT TOPS', `${pct(r.clipping.flatShare)}${r.clipping.fullScaleRuns ? ` · mic overloaded ${r.clipping.fullScaleRuns}×` : ''}`],
        ['HUM', r.hum ? `${r.hum.freq} Hz (+${r.hum.prominenceDb.toFixed(0)} dB)` : 'none'],
        ...(r.tone ? ([['TONE', `${hz(r.tone.freq)} · ${pct(r.tone.thd)} distortion`]] as [string, string][]) : []),
        ['FLATNESS', `${r.flatness.toFixed(2)} (0 tone · 1 noise)`],
      ],
      describeListen(r),
    );
    L.lines(`LISTEN · ${r.seconds.toFixed(1)} s · ${(r.sampleRate / 1000).toFixed(1)} kHz`, `peak ${r.levels.peakDb.toFixed(1)} dBFS`);
    charts((c, w, hh) => drawBands(c, w, hh, r.bands.filter((b) => b.f >= 31), { title: 'SPECTRUM · THIRD-OCTAVES · dBFS' }));
  };

  const showTone = (r: ToneReport) => {
    const kvs: [string, string][] = r.heard
      ? [
          ['CLEAN UP TO', r.cleanUpTo === null ? 'full volume' : r.cleanUpTo === 0 ? 'not even 10%' : `~${Math.round(r.cleanUpTo * 100)}%`],
          ['AT FULL', r.steps.length ? `${pct(r.steps[r.steps.length - 1]!.thd)} distortion` : '—'],
          ['LIMITING', r.limiting ? 'yes: stops getting louder' : 'no'],
          ['BASS DOWN TO', r.bassLimit ? `~${hz(r.bassLimit)}` : `${hz(TONE_PLAN.sweep.from)} or lower`],
        ]
      : [];
    fill(r.verdict, r.kind, r.findings, kvs, describeTone(r));
    L.lines(r.heard ? 'TEST TONE · 1 kHz steps + sweep' : 'TEST TONE', r.heard && r.cleanUpTo !== null ? `clean up to ${Math.round(r.cleanUpTo * 100)}%` : r.heard ? 'clean to 100%' : '');
    if (r.heard) charts((c, w, hh) => drawBands(c, w, hh, r.response, { relative: true, title: 'RESPONSE · dB vs 1 kHz' }), (c, w, hh) => drawSteps(c, w, hh, r));
    else {
      chartA.hidden = true;
      chartB.hidden = true;
      L.clearOverlay();
    }
    if (r.heard) chartA.hidden = false;
  };

  /** The report in words to Ghosty, as the phone's own measurement (data), with the owner's question. */
  const ask = async () => {
    if (!S.words || asking) return;
    asking = true;
    askBtn.disabled = true;
    const question = q.value.trim() || 'Here is a sound check from my phone. What does it mean, and what should I change?';
    try {
      status('asking Ghosty…', 'mid');
      const r = await askWithImage(question, null, (ev) => {
        if (ev.t === 'tool') status(`Ghosty: ${ev.name.replace(/_/g, ' ')}…`, 'mid');
      }, { seen: S.words });
      S.reply = r.text || r.error || '';
      replyModel.textContent = r.text ? r.model || 'GHOSTY' : 'PROBLEM';
      replyText.textContent = S.reply;
      reply.hidden = !S.reply;
      if (S.reply) reveal(reply);
      status(r.text ? 'answered' : `problem: ${r.error ?? 'no answer'}`, r.text ? 'ok' : 'off');
    } finally {
      asking = false;
      askBtn.disabled = false;
    }
  };

  return {
    id: 'sound',
    enter(_opts?: ModeOpts) {
      expose();
      clear(L.panel);
      L.panel.append(root);
      // the microphone needs no camera: switch it off (battery, and its own sound pipeline)
      if (L.state.camera === 'on' || L.state.camera === 'starting') L.stopCamera();
      setSub(sub);
    },
    leave() {
      if (run) stop('stopped');
      runGen++;
      L.clearOverlay();
    },
  };
}
