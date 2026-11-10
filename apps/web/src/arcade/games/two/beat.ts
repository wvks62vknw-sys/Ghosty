/**
 * THE BEAT, as an Engine: a rhythm platformer whose music is its level (beat-sim.ts holds the rules). The runner runs by
 * itself; each note of the song arrives as an obstacle on its beat. Tap anywhere or JUMP for a gap or spikes (a high
 * note), DUCK for a hanging bar (a low note), DASH for a wall (a chord). The song is made on the phone: the notes you
 * meet are the notes you hear, over a kick, hats and a bass. A pad: A jumps, B ducks, X dashes. A keyboard: up or space,
 * down, right.
 */
import { clamp } from '../kit';
import { type ControlApi, type Evt, makeEngine, playHeadless, type Rules, type View } from './shell';
import { type BeatEvent, beatLearnable, type BeatObs, botStep, LIVES, MOVES, newRun, type Run, SIGMA, step, targetOf, THETA0, TRACKS, WINDOW, activeAt } from './beat-sim';
import { BEAT_GHOSTY_ID, BEAT_ID, GAMES4 } from './shelf4';

const pts = (n: number) => `${Math.round(n).toLocaleString('en-GB')} points`;
const hz = (semi: number) => 440 * Math.pow(2, semi / 12);
const SKY = [['#0a0a24', '#2a1457'], ['#10244f', '#d98a5c'], ['#05101f', '#0f3a45']] as const;

const rules: Rules<Run> = {
  id: BEAT_ID,
  engine: 'beat',
  title: 'The Beat',
  line: 'Jump on the beat.',
  how: [
    'The song is the track. Every note you hear is an obstacle that reaches you on that note.',
    'Spikes and gaps (a high note): JUMP, or tap anywhere. A hanging bar (a low note): DUCK. A wall (a chord): DASH through it.',
    'Press a little before the note: the nearer the middle of your move lands to the note, the better the grade (PERFECT, GOOD, OK), and the more a combo is worth. Miss three and the run is over. Headphones help.',
  ],
  ghostyId: BEAT_GHOSTY_ID,
  words: pts,
  target: targetOf,
  reserve: 84,
  start: (o) => {
    const r = newRun(o.seed, o.level);
    if (o.args?.includes('calm')) (r.notes = []), (r.laid = 1e9);
    return r;
  },
  step: (r, dt, inp) => step(r, dt, inp.pressed),
  drain: (r) => r.events.splice(0).map((e) => ({ ...e, trk: r.track.id })) as unknown as Evt[],
  score: (r) => r.score,
  over: (r) => r.over && r.overT > 0.4,
  ends: (r) => ({ title: r.lives <= 0 ? 'Out of beats' : 'Song over', tip: r.perfects > r.hits / 2 ? 'Mostly PERFECT. Your timing is sharp.' : 'Press a touch before the note: the middle of the move should land on it.' }),
  bot: (r, th) => botStep(r, th),
  practice: {
    id: BEAT_ID,
    theta0: THETA0,
    sigma: SIGMA,
    play: (theta, level, seed) => {
      const t = targetOf(level);
      const none = new Set<string>();
      const r = playHeadless({ start: (o) => newRun(o.seed, o.level), step: (r2, dt) => step(r2, dt, none), bot: (r2, th) => botStep(r2, th), score: (r2) => r2.score, over: (r2) => r2.over, drain: (r2) => r2.events.splice(0) as unknown as Evt[] }, theta, level, seed, t, 60 * 60 * 6);
      return { score: r.score, target: t, passed: r.passed };
    },
  },
  controls: (api: ControlApi) => [
    api.button({ label: 'JUMP', aria: 'Jump', name: 'a', cls: 'g4act g4small g4wide' }),
    api.button({ label: 'DUCK', aria: 'Duck', name: 'b', cls: 'g4act g4small g4wide' }),
    api.button({ label: 'DASH', aria: 'Dash', name: 'x', cls: 'g4act g4small g4wide' }),
  ],
  pointer: (r, p, api) => {
    if (p.kind === 'down' && p.y < p.h - 100) api.press('a');
  },
  sound: (s, e) => {
    const ev = e as unknown as BeatEvent & { grade?: string; trk?: number };
    const tr = TRACKS[ev.trk ?? 0]!;
    switch (ev.type) {
      case 'note': {
        const semi = tr.root + tr.scale[ev.degree % tr.scale.length]! + (ev.move === 'jump' ? 12 : ev.move === 'duck' ? -12 : 0);
        if (ev.move === 'dash') [0, 4, 7].forEach((d) => s.tone({ f: hz(tr.root + d + 5), dur: 0.22, type: 'sawtooth', vol: 0.045, at: ev.delay }));
        else s.tone({ f: hz(semi), dur: ev.move === 'jump' ? 0.2 : 0.3, type: ev.move === 'jump' ? 'triangle' : 'square', vol: ev.move === 'jump' ? 0.12 : 0.08, at: ev.delay });
        break;
      }
      case 'tick': {
        s.tone({ f: 150, to: 45, dur: 0.18, type: 'sine', vol: 0.32, at: ev.delay });
        if (ev.beat % 4 === 0) s.tone({ f: hz(tr.root - 24 + tr.chords[(ev.beat / 4) % 4]![0]!), dur: 0.5, type: 'triangle', vol: 0.2, at: ev.delay });
        s.noise({ dur: 0.03, f: 8000, type: 'highpass', q: 0.7, vol: 0.05, at: ev.delay + 0.17 });
        break;
      }
      case 'grade': s.tone({ f: ev.grade === 'perfect' ? 1760 : ev.grade === 'good' ? 1320 : 990, dur: 0.07, type: 'sine', vol: 0.06 }); break;
      case 'miss': s.noise({ dur: 0.2, f: 300, q: 0.6, vol: 0.22 }); s.tone({ f: 120, to: 60, dur: 0.25, type: 'square', vol: 0.09 }); break;
      case 'over': s.tone({ f: 300, to: 70, dur: 0.8, type: 'sawtooth', vol: 0.1 }); break;
      case 'act': s.tone({ f: ev.move === 'jump' ? 440 : ev.move === 'duck' ? 200 : 300, to: ev.move === 'jump' ? 700 : 150, dur: 0.06, type: 'sine', vol: 0.04 }); break;
    }
  },
  haptic: (e) => {
    const t = (e as unknown as BeatEvent).type;
    const gr = (e as unknown as { grade?: string }).grade;
    return t === 'miss' ? 'hit' : t === 'grade' && gr === 'perfect' ? 'tick' : null;
  },
  say: (e) => {
    const ev = e as unknown as BeatEvent;
    return ev.type === 'grade' && ev.combo > 0 && ev.combo % 10 === 0 ? `Combo ${ev.combo}.` : null;
  },
  peek: (r) => ({ t: r.t, lives: r.lives, combo: r.combo, best: r.best, hits: r.hits, misses: r.misses, perfects: r.perfects, acting: r.act && activeAt(r) ? r.act.move : null, notes: r.notes.filter((n) => n.result === null).length, bpm: r.bpm, track: r.track.name, over: r.over }),
  draw: (g, r, v: View) => {
    const beat = 60 / r.bpm;
    const pulse = Math.exp(-(((r.t % beat) + beat) % beat / beat) * 4);
    const [top, bot] = SKY[r.track.id % 3]!;
    const sky = g.createLinearGradient(0, 0, 0, v.h);
    sky.addColorStop(0, top);
    sky.addColorStop(1, bot);
    g.fillStyle = sky;
    g.fillRect(0, 0, v.w, v.h);
    const gy = Math.round(v.h * 0.62);
    const px = v.w * 0.22;
    const speed = (v.w - px) / 1.9;
    const u = v.h / 956;
    // skyline
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let i = 0; i < 14; i++) {
      const bw = 50 + (i * 37) % 40, bh = 90 + (i * 61) % 170;
      const x = (((i * 78 - r.t * speed * 0.18) % (v.w + 120)) + v.w + 120) % (v.w + 120) - 60;
      g.fillRect(x, gy - bh * u, bw, bh * u);
    }
    g.fillStyle = v.accent;
    g.globalAlpha = 0.1 + 0.16 * pulse;
    g.fillRect(0, gy - 6, v.w, v.h);
    g.globalAlpha = 1;
    g.fillStyle = '#0c0f1c';
    g.fillRect(0, gy, v.w, v.h - gy);
    g.fillStyle = v.accent;
    g.globalAlpha = 0.5 + 0.5 * pulse;
    g.fillRect(0, gy, v.w, 3);
    g.globalAlpha = 1;
    // beat marks scrolling along the ground
    g.fillStyle = 'rgba(255,255,255,.3)';
    for (let k = -2; k < 20; k++) {
      const bt = (Math.floor(r.t / beat) + k) * beat;
      g.fillRect(px + (bt - r.t) * speed, gy + 10, 3, 8);
    }
    // the notes as obstacles
    for (const n of r.notes) {
      const x = px + (n.t - r.t) * speed;
      if (x < -80 || x > v.w + 80) continue;
      const fade = n.result === 'hit' ? Math.max(0, 1 - (r.t - n.t) * 3) : 1;
      if (fade <= 0) continue;
      g.globalAlpha = fade;
      if (n.move === 'jump') {
        g.fillStyle = n.result === 'miss' ? '#ec6a6a' : '#f2d24b';
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(x - 24 * u + i * 16 * u, gy);
          g.lineTo(x - 16 * u + i * 16 * u, gy - 34 * u);
          g.lineTo(x - 8 * u + i * 16 * u, gy);
          g.fill();
        }
      } else if (n.move === 'duck') {
        g.fillStyle = n.result === 'miss' ? '#ec6a6a' : '#b278e6';
        g.fillRect(x - 6 * u, 0, 3 * u, gy - 64 * u);
        g.fillRect(x + 16 * u, 0, 3 * u, gy - 64 * u);
        g.fillRect(x - 30 * u, gy - 64 * u, 66 * u, 20 * u);
        g.fillStyle = '#fff';
        g.fillRect(x - 24 * u, gy - 58 * u, 54 * u, 3 * u);
      } else {
        g.fillStyle = n.result === 'miss' ? '#ec6a6a' : v.accent;
        g.fillRect(x - 16 * u, gy - 100 * u, 32 * u, 100 * u);
        g.fillStyle = '#fff';
        g.font = `800 ${Math.round(26 * u)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText('>>', x, gy - 44 * u);
        g.textAlign = 'left';
      }
      g.globalAlpha = 1;
    }
    // the runner
    const a = activeAt(r);
    const bob = a ? 0 : Math.abs(Math.sin(r.t * (r.bpm / 60) * Math.PI)) * 5 * u;
    let rx = px, ry = gy - bob, sw = 30 * u, sh = 40 * u;
    if (a) {
      const f = (r.t - a.start) / WINDOW[a.move];
      if (a.move === 'jump') ry = gy - 4 * 130 * u * f * (1 - f);
      else if (a.move === 'duck') (sh = 22 * u), (sw = 38 * u);
      else (rx = px + 26 * u * Math.sin(f * Math.PI)), (sw = 44 * u), (sh = 32 * u);
    }
    if (a?.move === 'dash') {
      g.fillStyle = v.accent;
      g.globalAlpha = 0.35;
      g.fillRect(rx - 70 * u, ry - sh, 70 * u, sh);
      g.globalAlpha = 1;
    }
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(rx, ry - sh + sw / 2, sw / 2, Math.PI, 0);
    g.lineTo(rx + sw / 2, ry);
    g.lineTo(rx - sw / 2, ry);
    g.closePath();
    g.fill();
    g.fillStyle = '#10182e';
    g.beginPath();
    g.arc(rx + sw * 0.15, ry - sh + sw * 0.5, sw * 0.09, 0, 6.3);
    g.arc(rx - sw * 0.2, ry - sh + sw * 0.5, sw * 0.09, 0, 6.3);
    g.fill();
    // lives, the combo and the last grade
    for (let i = 0; i < LIVES; i++) {
      g.fillStyle = i < r.lives ? '#ec6a6a' : 'rgba(255,255,255,.2)';
      g.fillRect(16 + i * 22, 88, 16, 12);
    }
    g.font = '700 13px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillText(`${r.track.name} · ${Math.round(r.bpm)} bpm${r.combo > 1 ? ` · combo ${r.combo}` : ''}${v.demo ? ' · Ghosty playing' : ''}`, 16, 120);
    if (r.last && r.t - r.last.t < 0.7) {
      g.globalAlpha = clamp(1 - (r.t - r.last.t) / 0.7, 0, 1);
      g.fillStyle = r.last.grade === 'perfect' ? '#f2d24b' : r.last.grade === 'good' ? '#6fcf6f' : r.last.grade === 'ok' ? '#fff' : '#ec6a6a';
      g.font = '800 26px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(r.last.grade === 'miss' ? 'MISS' : r.last.grade.toUpperCase(), px + 30, gy - 160 * u - (r.t - r.last.t) * 30);
      g.textAlign = 'left';
      g.globalAlpha = 1;
    }
    if (r.t < 0.5) {
      g.fillStyle = '#fff';
      g.font = '700 20px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('Get ready', v.w / 2, gy - 220 * u);
      g.textAlign = 'left';
    }
  },
};

export const beatEngine = makeEngine(rules, GAMES4.find((g) => g.id === BEAT_ID)!);
export { rules as beatRules, beatLearnable };
export type { BeatObs };
void MOVES;
