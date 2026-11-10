/**
 * THE FLAP, as an Engine: Flappy mechanics in our own look (flap-sim.ts holds the rules). A ghost drifts between glowing
 * pillars: tap anywhere to flap, pass the gaps. Each level is faster, with a narrower gap, then sliding gaps and a gusting
 * wind; there is no top one. A pad: A, B or RT flaps. A keyboard: space or up.
 */
import { clamp } from '../kit';
import { BIRD_R, BIRD_X, botStep, centreOf, flapLearnable, type FlapObs, gapOf, GROUND, newRun, PILLAR_W, type Run, SIGMA, speedOf, step, targetOf, THETA0, WORLD_H, WORLD_W } from './flap-sim';
import { type Evt, makeEngine, type Rules, type View } from './shell';
import { FLAP_GHOSTY_ID, FLAP_ID, GAMES4 } from './shelf4';
import { playHeadless } from './shell';

const pipes = (n: number) => `${Math.round(n).toLocaleString('en-GB')} pillar${Math.round(n) === 1 ? '' : 's'}`;
const STARS = Array.from({ length: 40 }, (_, i) => [(i * 97) % 360, (i * 53) % 420, 0.4 + ((i * 31) % 10) / 12] as const);

const rules: Rules<Run> = {
  id: FLAP_ID,
  engine: 'flap',
  title: 'The Flap',
  line: 'Tap to flap through the pillars.',
  how: [
    'Tap anywhere to flap. The ghost falls between flaps, so tap in small bursts to climb and let it sink to come down.',
    'Fly through the gap in each glowing pillar: every one you pass is a point. Touch a pillar or the ground and the run is over.',
    'Higher levels are faster and the gap is narrower. From Level 4 the gaps slide up and down, and from Level 8 a wind gusts.',
  ],
  ghostyId: FLAP_GHOSTY_ID,
  words: pipes,
  target: targetOf,
  start: (o) => {
    const r = newRun(o.seed, o.level);
    r.calm = !!o.args?.includes('calm');
    return r;
  },
  step: (r, dt, inp) => step(r, dt, inp.pressed.has('a') || inp.pressed.has('up') || inp.pressed.has('x')),
  drain: (r) => r.events.splice(0) as unknown as Evt[],
  score: (r) => r.score,
  over: (r) => r.dead && r.deadT > 0.5,
  ends: (r) => (r.how === 'ground' ? { title: 'Down', tip: 'The ground is closer than it looks. Tap before you sink.' } : { title: 'Pillar', tip: 'Aim for the middle of the gap, not its edge.' }),
  bot: (r, th) => void botStep(r, th),
  practice: {
    id: FLAP_ID,
    theta0: THETA0,
    sigma: SIGMA,
    play: (theta, level, seed) => {
      const t = targetOf(level);
      const r = playHeadless({ start: (o) => newRun(o.seed, o.level), step: (r2, dt) => step(r2, dt, false), bot: (r2, th) => void botStep(r2, th), score: (r2) => r2.score, over: (r2) => r2.dead, drain: (r2) => r2.events.splice(0) as unknown as Evt[] }, theta, level, seed, t, 60 * 60 * 6);
      return { score: r.score, target: t, passed: r.passed };
    },
  },
  pointer: (r, p, api) => {
    if (p.kind === 'down') api.press('a');
  },
  sound: (s, e) => {
    const ev = e as unknown as { type: string; n?: number; how?: string };
    if (ev.type === 'flap') s.tone({ f: 380, to: 620, dur: 0.07, type: 'square', vol: 0.05 });
    else if (ev.type === 'pass') {
      s.tone({ f: 784 + (ev.n ?? 0) % 5 * 60, dur: 0.09, type: 'triangle', vol: 0.1 });
      if ((ev.n ?? 0) % 10 === 0) [988, 1319, 1568].forEach((f, i) => s.tone({ f, dur: 0.1, type: 'triangle', vol: 0.09, at: 0.05 + i * 0.06 }));
    } else if (ev.type === 'die') {
      s.noise({ dur: 0.18, f: 600, q: 0.7, vol: 0.2 });
      s.tone({ f: 220, to: 70, dur: 0.4, type: 'triangle', vol: 0.12 });
    }
  },
  haptic: (e) => ((e as unknown as { type: string }).type === 'die' ? 'hit' : (e as unknown as { type: string }).type === 'pass' ? 'tick' : null),
  say: (e) => ((e as unknown as { type: string; n?: number }).type === 'pass' && (e as unknown as { n: number }).n % 25 === 0 ? 'Smooth.' : null),
  music: { spec: { chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [-5, -1, 2]], scale: [0, 2, 4, 7, 9, 12], root: -9, bpm: [96, 128], hats: true, bass: [0, 8, 12], bassWave: 'sine', arpWave: 'triangle', leadWave: 'sine', level: 0.15, seed: 29 }, pace: (r) => clamp(r.score / 40, 0, 1) },
  peek: (r) => ({ y: r.y, vy: r.vy, started: r.started, dead: r.dead, how: r.how, pillars: r.pillars.length, speed: speedOf(r.level), gap: gapOf(r.level), x: r.pillars[0]?.x ?? 0 }),
  draw: (g, r, v: View) => {
    const k = Math.min(v.w / WORLD_W, v.h / WORLD_H);
    const ox = (v.w - WORLD_W * k) / 2;
    const oy = v.h - WORLD_H * k;
    const sky = g.createLinearGradient(0, 0, 0, v.h);
    sky.addColorStop(0, '#0a1030');
    sky.addColorStop(0.7, '#1b2a5c');
    sky.addColorStop(1, '#2d3f78');
    g.fillStyle = sky;
    g.fillRect(0, 0, v.w, v.h);
    g.fillStyle = '#fff';
    for (const [sx, sy, sz] of STARS) {
      const x = (((sx - r.dist * 0.04 * sz) % WORLD_W) + WORLD_W) % WORLD_W;
      g.globalAlpha = 0.35 + 0.25 * Math.sin(v.t * 2 + sx);
      g.fillRect(ox + x * k, oy + sy * k * 0.9, sz * 1.6 * k, sz * 1.6 * k);
    }
    g.globalAlpha = 1;
    const gap = gapOf(r.level);
    for (const p of r.pillars) {
      const c = centreOf(p, r.t, r.level);
      const x = ox + p.x * k, w = PILLAR_W * k;
      const topH = oy + (c - gap / 2) * k;
      const botY = oy + (c + gap / 2) * k;
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, '#1d4f66');
      grad.addColorStop(0.5, v.accent);
      grad.addColorStop(1, '#1d4f66');
      g.fillStyle = grad;
      g.fillRect(x, -10, w, topH + 10);
      g.fillRect(x, botY, w, oy + (WORLD_H - GROUND) * k - botY);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(x - 3 * k, topH - 14 * k, w + 6 * k, 14 * k);
      g.fillRect(x - 3 * k, botY, w + 6 * k, 14 * k);
    }
    // the ground
    g.fillStyle = '#10182e';
    g.fillRect(0, oy + (WORLD_H - GROUND) * k, v.w, v.h);
    g.fillStyle = v.accent;
    g.globalAlpha = 0.5;
    g.fillRect(0, oy + (WORLD_H - GROUND) * k, v.w, 2 * k);
    g.globalAlpha = 1;
    for (let i = 0; i < 12; i++) g.fillRect(ox + ((((i * 40 - r.dist) % 480) + 480) % 480 - 40) * k, oy + (WORLD_H - GROUND + 18) * k, 18 * k, 3 * k);
    // the ghost
    const bx = ox + BIRD_X * k, by = oy + r.y * k, br = BIRD_R * k;
    g.save();
    g.translate(bx, by);
    g.rotate(r.tilt * 0.5);
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath();
    g.arc(0, 0, br, Math.PI, 0);
    g.lineTo(br, br * 0.9);
    for (let i = 0; i < 4; i++) g.lineTo(br - (i + 0.5) * (br / 2), br * (0.9 + (i % 2 ? 0.1 : -0.15 + 0.2 * Math.sin(v.t * 14))));
    g.lineTo(-br, br * 0.9);
    g.closePath();
    g.fill();
    g.fillStyle = '#10182e';
    g.beginPath();
    g.arc(br * 0.3, -br * 0.15, br * 0.2, 0, 6.3);
    g.arc(-br * 0.25, -br * 0.15, br * 0.2, 0, 6.3);
    g.fill();
    g.restore();
    if (!r.started && !r.dead) {
      g.fillStyle = '#fff';
      g.font = '700 22px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(v.demo ? 'Ghosty playing' : 'Tap to flap', v.w / 2, oy + 220 * k);
      g.textAlign = 'left';
    }
    if (v.ghostyBest && !v.demo && r.score === v.ghostyBest - 1) {
      g.fillStyle = v.accent;
      g.font = '600 13px system-ui, sans-serif';
      g.fillText('Ghosty\'s best is next', 16, oy + 120 * k);
    }
  },
};

export const flapEngine = makeEngine(rules, GAMES4.find((g) => g.id === FLAP_ID)!);
export { rules as flapRules, flapLearnable };
export type { FlapObs };
