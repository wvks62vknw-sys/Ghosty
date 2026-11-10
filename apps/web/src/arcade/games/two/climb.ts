/**
 * THE CLIMB, as an Engine: Doodle Jump mechanics in our own look (climb-sim.ts holds the rules). The jumper bounces by
 * itself; put a finger down anywhere and it steers towards it, or use the left and right keys or the stick; the screen
 * wraps at the edges. Land on platforms, avoid the ones that crumble, take the springs and the jet. Height is the score.
 */
import { clamp } from '../kit';
import { type Evt, makeEngine, playHeadless, type Rules, type View } from './shell';
import { aimOf, botSteer, climbLearnable, type ClimbObs, heightOf, newRun, PX_PER_M, type Run, SIGMA, step, targetOf, THETA0, WORLD_W, botStep } from './climb-sim';
import { CLIMB_GHOSTY_ID, CLIMB_ID, GAMES4 } from './shelf4';

const metres = (n: number) => `${Math.round(n).toLocaleString('en-GB')} m`;
let aim: number | null = null;
const CLOUDS = Array.from({ length: 9 }, (_, i) => [(i * 131) % 360, i * 170, 40 + (i * 17) % 40] as const);

const rules: Rules<Run> = {
  id: CLIMB_ID,
  engine: 'climb',
  title: 'The Climb',
  line: 'Bounce up the tower.',
  how: [
    'You bounce on your own. Put a finger down and slide it: the jumper steers towards it. Leave one edge of the screen and you come back in at the other.',
    'Land on platforms to keep going. Pale-brown ones crumble after one bounce, blue ones slide, a spring throws you high and a jet lifts you for a moment.',
    'Height is your score. Fall off the bottom of the screen and the run is over. Higher levels have platforms further apart and narrower, more that slide or crumble, and from Level 6 a wind.',
  ],
  ghostyId: CLIMB_GHOSTY_ID,
  words: metres,
  target: targetOf,
  start: (o) => {
    aim = null;
    const r = newRun(o.seed, o.level);
    r.calm = !!o.args?.includes('calm');
    return r;
  },
  step: (r, dt, inp) => {
    const bot = (r as Run & { botAim?: unknown }).botAim;
    if (bot) return step(r, dt, aimOf(r));
    step(r, dt, { ax: (inp.held.has('right') ? 1 : 0) - (inp.held.has('left') ? 1 : 0), aim });
  },
  drain: (r) => r.events.splice(0) as unknown as Evt[],
  score: (r) => heightOf(r),
  over: (r) => r.dead && r.deadT > 0.7,
  ends: () => ({ title: 'Fell', tip: 'Aim for the middle of a platform and skip the crumbling ones.' }),
  bot: (r, th, dt) => botStep(r, th, dt),
  practice: {
    id: CLIMB_ID,
    theta0: THETA0,
    sigma: SIGMA,
    play: (theta, level, seed) => {
      const t = targetOf(level);
      const r = playHeadless({ start: (o) => newRun(o.seed, o.level), step: (r2, dt) => step(r2, dt, botSteer(r2, theta)), bot: () => undefined, score: (r2) => heightOf(r2), over: (r2) => r2.dead, drain: (r2) => r2.events.splice(0) as unknown as Evt[] }, theta, level, seed, t, 60 * 60 * 5);
      return { score: r.score, target: t, passed: r.passed };
    },
  },
  pointer: (r, p, api) => {
    void api;
    if (p.kind === 'up') aim = null;
    else aim = (p.x / p.w) * WORLD_W;
  },
  sound: (s, e) => {
    const ev = e as unknown as { type: string; n?: number };
    if (ev.type === 'bounce') s.tone({ f: 330, to: 560, dur: 0.1, type: 'triangle', vol: 0.1 });
    else if (ev.type === 'spring') s.tone({ f: 260, to: 1100, dur: 0.25, type: 'square', vol: 0.07 });
    else if (ev.type === 'crumble') s.noise({ dur: 0.2, f: 500, q: 0.6, vol: 0.18 });
    else if (ev.type === 'jet') s.noise({ dur: 1.5, f: 700, to: 1400, q: 0.5, vol: 0.1 });
    else if (ev.type === 'milestone') [659, 784, 988].forEach((f, i) => s.tone({ f, dur: 0.12, type: 'triangle', vol: 0.09, at: i * 0.07 }));
    else if (ev.type === 'die') s.tone({ f: 300, to: 60, dur: 0.7, type: 'sawtooth', vol: 0.1 });
  },
  haptic: (e) => ((e as unknown as { type: string }).type === 'die' ? 'hit' : (e as unknown as { type: string }).type === 'spring' ? 'tick' : null),
  say: (e) => ((e as unknown as { type: string; n?: number }).type === 'milestone' ? `${(e as unknown as { n: number }).n} metres.` : null),
  music: { spec: { chords: [[0, 4, 7], [7, 11, 14], [5, 9, 12], [4, 7, 11]], scale: [0, 2, 4, 7, 9, 12, 14], root: -5, bpm: [100, 130], hats: true, kick: true, bass: [0, 8], bassWave: 'triangle', arpWave: 'square', leadWave: 'triangle', level: 0.16, seed: 31 }, pace: (r) => clamp(heightOf(r) / 400, 0, 1) },
  peek: (r) => ({ x: r.x, y: r.y, vy: r.vy, cam: r.cam, height: heightOf(r), dead: r.dead, jet: r.jetT > 0, platforms: r.platforms.length, bounces: Math.round(r.t) }),
  draw: (g, r, v: View) => {
    const k = v.w / WORLD_W;
    const sy = (wy: number) => v.h - (wy - r.cam) * k;
    const hue = Math.min(1, r.best / 12000);
    const sky = g.createLinearGradient(0, 0, 0, v.h);
    sky.addColorStop(0, hue < 0.5 ? '#16315f' : '#05060f');
    sky.addColorStop(1, hue < 0.5 ? '#6b8fc7' : '#1c2a55');
    g.fillStyle = sky;
    g.fillRect(0, 0, v.w, v.h);
    g.fillStyle = 'rgba(255,255,255,.14)';
    for (const [cx, cy, cw] of CLOUDS) {
      const y = v.h - (((cy - r.cam * 0.3) % 1500) + 1500) % 1500 * k * 0.6;
      g.beginPath();
      g.ellipse(cx * k, y, cw * k, cw * 0.4 * k, 0, 0, 6.3);
      g.fill();
    }
    for (const p of r.platforms) {
      const y = sy(p.y);
      if (y < -40 || y > v.h + 80) continue;
      const w = p.w * k, x = p.x * k - w / 2;
      g.globalAlpha = p.broken > 0 ? Math.max(0, 1 - p.broken * 2) : 1;
      g.fillStyle = p.kind === 'crumble' ? '#b89264' : p.kind === 'slide' ? '#5ea4e6' : '#6fd39a';
      g.fillRect(x, y, w, 12 * k);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(x, y, w, 3 * k);
      if (p.kind === 'crumble') {
        g.strokeStyle = '#6a5236';
        g.beginPath();
        g.moveTo(x + w * 0.3, y);
        g.lineTo(x + w * 0.4, y + 12 * k);
        g.moveTo(x + w * 0.7, y);
        g.lineTo(x + w * 0.62, y + 12 * k);
        g.stroke();
      }
      if (p.spring) {
        g.fillStyle = '#f2d24b';
        g.fillRect(p.x * k - 8 * k, y - 12 * k, 16 * k, 12 * k);
        g.fillStyle = '#c9a21c';
        g.fillRect(p.x * k - 8 * k, y - 5 * k, 16 * k, 3 * k);
      }
      if (p.jet) {
        g.fillStyle = v.accent;
        g.beginPath();
        g.arc(p.x * k, y - 14 * k, 9 * k, 0, 6.3);
        g.fill();
        g.fillStyle = '#fff';
        g.fillRect(p.x * k - 2 * k, y - 20 * k, 4 * k, 12 * k);
      }
      g.globalAlpha = 1;
    }
    // Ghosty's best height, a faint line
    if (v.ghostyBest && !v.demo) {
      const gy = sy(v.ghostyBest * PX_PER_M);
      if (gy > 0 && gy < v.h) {
        g.strokeStyle = v.accent;
        g.globalAlpha = 0.5;
        g.setLineDash([6, 6]);
        g.beginPath();
        g.moveTo(0, gy);
        g.lineTo(v.w, gy);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = v.accent;
        g.font = '600 12px system-ui, sans-serif';
        g.fillText('Ghosty', 8, gy - 4);
        g.globalAlpha = 1;
      }
    }
    // the jumper
    const px = r.x * k, py = sy(r.y);
    const s = 16 * k;
    for (const off of [0, -v.w, v.w]) {
      if (off && px + off < -s * 2 && px + off > v.w + s * 2) continue;
      g.save();
      g.translate(px + off, py);
      g.scale(r.face, 1);
      if (r.jetT > 0) {
        g.fillStyle = '#f09a4a';
        g.beginPath();
        g.moveTo(-6 * k, 0);
        g.lineTo(0, 24 * k + Math.random() * 10 * k);
        g.lineTo(6 * k, 0);
        g.fill();
      }
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(0, -s, s, Math.PI, 0);
      g.lineTo(s, -s * 0.1);
      g.lineTo(-s, -s * 0.1);
      g.closePath();
      g.fill();
      g.fillStyle = '#10182e';
      g.beginPath();
      g.arc(s * 0.35, -s * 1.15, s * 0.2, 0, 6.3);
      g.arc(-s * 0.2, -s * 1.15, s * 0.2, 0, 6.3);
      g.fill();
      g.restore();
    }
    if (v.demo) {
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.font = '600 13px system-ui, sans-serif';
      g.fillText('Ghosty playing', 16, v.h - 16);
    }
  },
};

export const climbEngine = makeEngine(rules, GAMES4.find((g) => g.id === CLIMB_ID)!);
export { rules as climbRules, climbLearnable };
export type { ClimbObs };
