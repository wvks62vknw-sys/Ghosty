/**
 * THE CAVE, as an Engine: one connected cave of twelve rooms of our own (rooms.ts, sim.ts), dark rock and glowing moss,
 * water that slows, drops that fall. ◀ ▲ ▶ under the left thumb; JUMP, FIRE, USE and MAP under the right; a pad: A jumps, X
 * fires, B uses, Y the map; a keyboard: arrows, space, X, Z, M. A lantern saves the place (the arcade's save store) and mends
 * the hearts; NEW GAME and CONTINUE; a pinch opens the map. Three tools found in order open the cave further. Ghosty plays it
 * too, and his furthest room and his time are on the card. This is OUR cave: Cave Story is a different game, not built here.
 */
import { h } from '../../../core/dom';
import { clamp } from '../kit';
import { TS } from '../platform/core';
import { CAVE_GHOSTY_ID, CAVE_ID, GAMES5 } from '../shelf5';
import { type ControlApi, type Evt, makeEngine, type Rules, type View } from '../two/shell';
import { botStep, bossOf, headless, loadRoom, type CaveEvent, caveLearnable, type Cmd, type Creature, clock, ENDING_BASE, isOver, newRun, readSave, restore, type Run, score, SIGMA, snapshot, step, targetOf, THETA0, toggleMap, weaponLevel, wordsOf, XP_AT } from './sim';
import { ROOMS, roomOf, RW, RH, type Tool, TOOL_FOUND } from './rooms';

const NO: Cmd = { left: false, right: false, up: false, jump: false, jumpPressed: false, fire: false, use: false };
const reduced = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
const argOf = (args: readonly string[] | undefined, k: string): string | null => {
  const hit = (args ?? []).find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : null;
};

// ---------------------------------------------------------------- the pinch (two fingers apart: the map; together: away)
const fingers = new Map<number, { x: number; y: number }>();
let pinch0 = 0;
const spread = (): number => {
  const [a, b] = [...fingers.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};

const rules: Rules<Run> = {
  id: CAVE_ID,
  engine: 'cave',
  title: 'The Cave',
  line: 'Find your way out of the cave.',
  how: [
    'The cave is twelve rooms. ◀ ▶ walk, ▲ aims the blaster upward, JUMP jumps (hold for height), FIRE shoots, USE lights a lantern or speaks to someone, MAP shows where you have been. Pinch to open the map too.',
    'A lantern saves your place and mends your hearts. If you fall, you wake at the last one. Quit any time: CONTINUE puts you back at the last lantern, with what you found.',
    'Three tools open the cave further, in order: the Spring Boots (a second jump), the Blaster (it grows on crystals and loses a little when you are hurt) and the Lamp (it shows the steps that are only there for a light). Two things in the cave are bigger than you.',
  ],
  ghostyId: CAVE_GHOSTY_ID,
  words: wordsOf,
  target: targetOf,
  reserve: 176,
  persist: { name: 'cave.json', encode: (r) => JSON.stringify(snapshot(r)), decode: (raw) => readSave(JSON.parse(raw)) },
  start: (o) => {
    const save = o.resume ? readSave(o.resume) : null;
    const r = save ? restore(save, o.seed) : newRun(o.seed, o.level);
    r.calm = !!o.args?.includes('calm');
    const room = argOf(o.args, 'room');
    const tools = argOf(o.args, 'tools');
    const hearts = argOf(o.args, 'hearts');
    if (tools) for (const t of tools.split('+')) if (t in r.tools) r.tools[t as Tool] = true;
    if (room && ROOMS.some((q) => q.id === room)) {
      r.visited.add(room);
      r.p.x = 3 * TS + 3;
      r.p.y = 14 * TS - r.p.h;
      r.room = roomOf(room);
      import_load(r, room);
    }
    if (hearts) r.hearts = Math.max(1, Math.min(r.maxHearts, Number(hearts) || r.maxHearts));
    return r;
  },
  step: (r, dt, inp) => {
    if (inp.pressed.has('map') && !r.bot) toggleMap(r);
    const c: Cmd = r.bot ? NO : { left: inp.held.has('left'), right: inp.held.has('right'), up: inp.held.has('up'), jump: inp.held.has('a'), jumpPressed: inp.pressed.has('a'), fire: inp.held.has('x'), use: inp.pressed.has('b') };
    step(r, dt, c);
  },
  drain: (r) => r.events.splice(0) as unknown as Evt[],
  score,
  over: isOver,
  passed: (r) => r.ended,
  ends: (r) =>
    r.ended
      ? { title: 'The way out', tip: r.deaths ? 'Out, with a few bumps on the way.' : 'Out, and never once carried back to a lantern.', notes: [`Out in ${clock(r.time)} · ${r.crystals} crystals found · ${r.visited.size} of ${ROOMS.length} rooms seen`] }
      : { title: 'Not out yet', tip: 'The last lantern still has your place.', notes: [`${r.visited.size} of ${ROOMS.length} rooms seen · ${r.crystals} crystals`] },
  pauseLine: (r) => `${r.room.name}. ${r.visited.size} of ${ROOMS.length} rooms seen, ${r.crystals} crystals, ${clock(r.time)} so far. The last lantern keeps your place.`,
  bot: (r, th) => botStep(r, th),
  practice: {
    id: CAVE_ID,
    hold: true,
    theta0: THETA0,
    sigma: SIGMA,
    play: (theta, level, seed) => {
      const res = headless(theta, level, seed);
      return { score: res.score, target: targetOf(), passed: res.passed };
    },
  },
  card: (e, r) => (e.type === 'card' ? (r.cards.shift() ?? null) : null),
  controls: (api: ControlApi) => [
    h('div.g4grp.left', api.button({ label: '◀', aria: 'Move left', name: 'left', hold: true, cls: 'g4pm' }), api.button({ label: '▲', aria: 'Aim the blaster up', name: 'up', hold: true, cls: 'g4pm' }), api.button({ label: '▶', aria: 'Move right', name: 'right', hold: true, cls: 'g4pm' })),
    h('div.g4grp.right.grid', api.button({ label: 'JUMP', aria: 'Jump, hold for a higher jump', name: 'a', hold: true, cls: 'g4act g4small' }), api.button({ label: 'FIRE', aria: 'Fire the blaster', name: 'x', hold: true, cls: 'g4act g4small' }), api.button({ label: 'USE', aria: 'Light a lantern or speak', name: 'b', cls: 'g4act g4small' }), api.button({ label: 'MAP', aria: 'Show or hide the map', name: 'map', cls: 'g4act g4small' })),
  ],
  pointer: (r, p, api) => {
    if (p.kind === 'down') {
      fingers.set(p.id, { x: p.x, y: p.y });
      if (fingers.size === 2) pinch0 = spread();
    } else if (p.kind === 'move' && fingers.has(p.id)) {
      fingers.set(p.id, { x: p.x, y: p.y });
      if (fingers.size === 2 && r) {
        const d = spread();
        if (!r.mapOpen && d > pinch0 + 40) (api.press('map'), (pinch0 = d));
        else if (r.mapOpen && d < pinch0 - 40) (api.press('map'), (pinch0 = d));
      }
    } else if (p.kind === 'up') fingers.delete(p.id);
  },
  sound: (s, e) => {
    const ev = e as unknown as CaveEvent;
    const t = ev.type;
    if (t === 'jump') s.tone({ f: 260, to: 480, dur: 0.1, type: 'triangle', vol: 0.07 });
    else if (t === 'jump2') s.tone({ f: 420, to: 840, dur: 0.12, type: 'triangle', vol: 0.08 });
    else if (t === 'land') s.noise({ dur: 0.05, f: 200, q: 0.5, vol: 0.06 });
    else if (t === 'fire') s.tone({ f: 900 + (ev.n ?? 1) * 160, to: 300, dur: 0.08, type: 'square', vol: 0.05 });
    else if (t === 'hit') s.noise({ dur: 0.04, f: 1400, q: 0.8, vol: 0.07 });
    else if (t === 'kill') (s.tone({ f: 300, to: 90, dur: 0.18, type: 'sawtooth', vol: 0.08 }), s.noise({ dur: 0.1, f: 700, q: 0.6, vol: 0.1 }));
    else if (t === 'crystal') [1175, 1568].forEach((f, i) => s.tone({ f, dur: 0.08, type: 'sine', vol: 0.08, at: i * 0.05 }));
    else if (t === 'hurt') (s.tone({ f: 260, to: 90, dur: 0.28, type: 'sawtooth', vol: 0.1 }), s.noise({ dur: 0.1, f: 500, q: 0.6, vol: 0.12 }));
    else if (t === 'die') [330, 262, 196, 131].forEach((f, i) => s.tone({ f, dur: 0.2, type: 'triangle', vol: 0.12, at: i * 0.14 }));
    else if (t === 'save') [523, 659, 784, 1047].forEach((f, i) => s.tone({ f, dur: 0.22, type: 'sine', vol: 0.1, at: i * 0.1 }));
    else if (t === 'tool') [392, 523, 659, 784, 1047].forEach((f, i) => s.tone({ f, dur: 0.16, type: 'triangle', vol: 0.11, at: i * 0.09 }));
    else if (t === 'boss') [196, 262, 330, 392, 523, 659].forEach((f, i) => s.tone({ f, dur: 0.18, type: 'triangle', vol: 0.12, at: i * 0.11 }));
    else if (t === 'phase') (s.tone({ f: 120, to: 60, dur: 0.5, type: 'sawtooth', vol: 0.12 }), s.noise({ dur: 0.3, f: 300, q: 0.5, vol: 0.14 }));
    else if (t === 'door') s.noise({ dur: 0.08, f: 300, q: 0.4, vol: 0.05 });
    else if (t === 'bolt') s.tone({ f: 700, to: 200, dur: 0.18, type: 'square', vol: 0.06 });
    else if (t === 'slam') s.noise({ dur: 0.25, f: 120, q: 0.5, vol: 0.16 });
    else if (t === 'splash') s.tone({ f: 900, to: 500, dur: 0.05, type: 'sine', vol: 0.03 });
    else if (t === 'rubble') s.noise({ dur: 0.3, f: 220, q: 0.4, vol: 0.18 });
    else if (t === 'spawn' || t === 'drip') s.tone({ f: 500, to: 250, dur: 0.1, type: 'sine', vol: 0.05 });
    else if (t === 'end') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => s.tone({ f, dur: 0.3, type: 'triangle', vol: 0.12, at: i * 0.15 }));
  },
  haptic: (e) => {
    const t = (e as unknown as CaveEvent).type;
    return t === 'hurt' || t === 'die' || t === 'slam' ? 'hit' : t === 'kill' || t === 'crystal' || t === 'save' || t === 'tool' || t === 'phase' ? 'tick' : null;
  },
  say: (e, r) => {
    const ev = e as unknown as CaveEvent;
    if (ev.type === 'room') return ev.n === 1 ? null : roomOf(ev.id ?? '').name;
    if (ev.type === 'save') return 'Saved. Hearts mended.';
    if (ev.type === 'respawn') return 'You wake at the last lantern.';
    if (ev.type === 'phase') return ev.kind === 'boss1' ? (ev.n === 2 ? 'She calls her young.' : 'She is throwing goo!') : ev.n === 2 ? 'The Warden slams the floor.' : 'The Warden is furious.';
    if (ev.type === 'rubble') return null;
    if (ev.type === 'slip') return 'A fall costs a heart.';
    void r;
    return null;
  },
  music: { spec: { chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]], scale: [0, 3, 5, 7, 10], root: -24, bpm: [54, 72], hats: false, bass: [0, 8], bassWave: 'sine', arpWave: 'sine', leadWave: 'sine', level: 0.1, seed: 77 }, pace: (r) => clamp((bossOf(r) ? 0.9 : r.visited.size / 14), 0, 1) },
  peek: (r) => {
    const b = bossOf(r);
    return {
      room: r.room.id,
      roomN: r.room.n,
      x: r.p.x,
      y: r.p.y,
      vx: r.p.vx,
      vy: r.p.vy,
      onGround: r.p.onGround,
      hearts: r.hearts,
      maxHearts: r.maxHearts,
      tools: Object.keys(r.tools).filter((k) => r.tools[k as Tool]),
      crystals: r.crystals,
      weapon: weaponLevel(r.xp),
      visited: [...r.visited],
      saved: r.lantern ? r.lantern.room : null,
      mapOpen: r.mapOpen,
      boss: b ? { kind: b.kind, hp: b.hp, max: b.max, phase: b.phase } : null,
      bosses: [...r.bosses],
      time: r.time,
      deaths: r.deaths,
      ended: r.ended,
      dark: r.room.dark,
      creatures: r.creatures.filter((c) => c.alive).length,
      reduced: reduced(),
      camX: r.camX,
      parallax: reduced() ? 0 : r.camX * 0.3,
    };
  },
  draw: (g, r, v) => draw(g, r, v),
};

/** Load a room named on the command line (a spec's way to start where it needs to be). */
function import_load(r: Run, room: string): void {
  loadRoom(r, room, { x: r.p.x, y: r.p.y });
  r.events.length = 0;
}

// ---------------------------------------------------------------- the drawing

const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, rad: number) => {
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + hh, rad);
  g.arcTo(x + w, y + hh, x, y + hh, rad);
  g.arcTo(x, y + hh, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
};
const hash = (x: number, y: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function draw(g: CanvasRenderingContext2D, r: Run, v: View): void {
  const still = reduced();
  const def = r.room;
  const k = Math.min(v.w / (14 * TS), (v.h - 112 - v.reserve) / (RH * TS));
  const bandH = RH * TS * k;
  const ox = (v.w - 14 * TS * k) / 2;
  const oy = v.h - v.reserve - bandH - 8;
  const cam = Math.round(r.camX * k) / k;
  // the dark behind everything, with a faint far wall that drifts less than the near one
  const bg = g.createLinearGradient(0, 0, 0, v.h);
  bg.addColorStop(0, '#0a0814');
  bg.addColorStop(1, '#1a1428');
  g.fillStyle = bg;
  g.fillRect(0, 0, v.w, v.h);
  g.save();
  g.beginPath();
  g.rect(0, oy, v.w, bandH);
  g.clip();
  const par = still ? 0 : r.camX * 0.3 * k;
  g.fillStyle = '#17112a';
  for (let i = -1; i < 9; i++) {
    const x = i * 120 * k - (par % (120 * k));
    const hh = (50 + hash(i + 40, def.n) * 90) * k;
    g.beginPath();
    g.moveTo(x, oy + bandH);
    g.lineTo(x + 40 * k, oy + bandH - hh);
    g.lineTo(x + 100 * k, oy + bandH);
    g.fill();
  }
  g.translate(ox - cam * k, oy);
  g.scale(k, k);
  const tx0 = Math.max(0, Math.floor(cam / TS) - 1);
  const tx1 = Math.min(RW - 1, tx0 + 16);
  const glow = def.glow;
  const lamp = r.tools.lamp;
  // water behind the player
  for (let ty = 0; ty < RH; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = r.tiles[ty]![tx]!;
      const x = tx * TS;
      const y = ty * TS;
      if (c === '~') {
        g.fillStyle = 'rgba(70,140,220,.34)';
        g.fillRect(x, y, TS, TS);
        if (r.tiles[ty - 1]?.[tx] !== '~') {
          g.fillStyle = 'rgba(190,230,255,.6)';
          const w = still ? 0 : Math.sin(v.t * 2 + tx) * 1.2;
          g.fillRect(x, y + 1 + w, TS, 1.5);
        }
      }
    }
  for (let ty = 0; ty < RH; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const c = r.tiles[ty]![tx]!;
      const x = tx * TS;
      const y = ty * TS;
      if (c === '#') {
        const sh = 38 + Math.floor(hash(tx, ty) * 14);
        g.fillStyle = `rgb(${sh},${sh - 6},${sh + 12})`;
        g.fillRect(x, y, TS, TS);
        const open = ty > 0 && !'#xG'.includes(r.tiles[ty - 1]![tx]!);
        if (open) {
          g.fillStyle = glow;
          g.globalAlpha = 0.65;
          g.fillRect(x, y, TS, 2);
          for (let m = 0; m < 3; m++) g.fillRect(x + hash(tx + m, ty) * 12, y + 2, 2, 1 + Math.floor(hash(ty, tx + m) * 3));
          g.globalAlpha = 1;
        }
        g.fillStyle = 'rgba(0,0,0,.18)';
        g.fillRect(x, y + TS - 2, TS, 2);
        g.fillStyle = 'rgba(255,255,255,.05)';
        g.fillRect(x + 1, y + 1, 4, 3);
      } else if (c === 'x') {
        g.fillStyle = '#6e5a4c';
        rr(g, x + 0.5, y + 0.5, TS - 1, TS - 1, 3);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(x + 3, y + 4, 5, 3);
        g.fillRect(x + 8, y + 9, 5, 3);
      } else if (c === 'G') {
        g.fillStyle = '#3a2b45';
        g.fillRect(x, y, TS, TS);
        g.strokeStyle = def.glow;
        g.globalAlpha = 0.5;
        g.strokeRect(x + 1.5, y + 1.5, TS - 3, TS - 3);
        g.globalAlpha = 1;
      } else if (c === 'v' && lamp) {
        g.fillStyle = 'rgba(255,240,170,.85)';
        rr(g, x + 1, y + 2, TS - 2, 6, 3);
        g.fill();
        g.fillStyle = 'rgba(255,240,170,.22)';
        g.fillRect(x - 1, y + 8, TS + 2, 8);
      }
    }
  // lanterns, dwellers, things to take
  for (const s of def.spawns) {
    const x = s.x * TS;
    const y = s.y * TS;
    const key = s.id ?? `${def.id}:${s.kind}:${s.x}:${s.y}`;
    if (s.kind === 'lantern') {
      const lit = r.lantern?.room === def.id;
      const fl = still ? 1 : 0.85 + 0.15 * Math.sin(v.t * 8 + s.x);
      const gl = g.createRadialGradient(x + 8, y + 6, 1, x + 8, y + 6, 30);
      gl.addColorStop(0, `rgba(255,214,120,${(lit ? 0.5 : 0.25) * fl})`);
      gl.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = gl;
      g.fillRect(x - 24, y - 24, 64, 64);
      g.fillStyle = '#4a3a2c';
      g.fillRect(x + 7, y + 2, 2, 14);
      g.fillStyle = lit ? '#ffd27a' : '#c89a50';
      rr(g, x + 3, y + 1, 10, 9, 3);
      g.fill();
      g.fillStyle = '#fff6d0';
      g.fillRect(x + 6.5, y + 3, 3, 4 * fl);
    } else if (s.kind === 'npc') {
      g.fillStyle = '#6a5a8a';
      rr(g, x + 3, y + 3, 10, 13, 5);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(x + 5, y + 7, 2, 2);
      g.fillRect(x + 9, y + 7, 2, 2);
      g.fillStyle = '#10101a';
      g.fillRect(x + 6, y + 8, 1, 1);
      g.fillRect(x + 10, y + 8, 1, 1);
    } else if (s.kind === 'crystal' && !r.taken.has(key)) {
      const bob = still ? 0 : Math.sin(v.t * 3 + s.x) * 1;
      g.fillStyle = '#8af0ff';
      g.beginPath();
      g.moveTo(x + 8, y + 2 + bob);
      g.lineTo(x + 12, y + 8 + bob);
      g.lineTo(x + 8, y + 14 + bob);
      g.lineTo(x + 4, y + 8 + bob);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(x + 7, y + 5 + bob, 1.5, 4);
    } else if ((s.kind === 'boots' || s.kind === 'blaster' || s.kind === 'lamp') && !r.taken.has(key)) {
      const bob = still ? 0 : Math.sin(v.t * 3) * 1.5;
      const gl = g.createRadialGradient(x + 8, y + 8, 1, x + 8, y + 8, 20);
      gl.addColorStop(0, 'rgba(255,255,200,.5)');
      gl.addColorStop(1, 'rgba(255,255,200,0)');
      g.fillStyle = gl;
      g.fillRect(x - 14, y - 14, 44, 44);
      if (s.kind === 'boots') {
        g.fillStyle = '#ff7a5a';
        rr(g, x + 3, y + 4 + bob, 6, 9, 2);
        g.fill();
        g.fillRect(x + 3, y + 10 + bob, 10, 4);
        g.fillStyle = '#ffffff';
        g.fillRect(x + 3, y + 13 + bob, 10, 1.5);
      } else if (s.kind === 'blaster') {
        g.fillStyle = '#9aa8ff';
        rr(g, x + 2, y + 6 + bob, 12, 5, 2);
        g.fill();
        g.fillStyle = '#ffd34d';
        g.fillRect(x + 12, y + 7 + bob, 3, 3);
      } else {
        g.fillStyle = '#ffe07a';
        g.beginPath();
        g.arc(x + 8, y + 8 + bob, 5, 0, 6.3);
        g.fill();
        g.fillStyle = '#7a5a2a';
        g.fillRect(x + 6, y + 12 + bob, 4, 3);
      }
    } else if (s.kind === 'end' && r.bosses.has('boss2')) {
      const gl = g.createLinearGradient(x, y - 40, x + 40, y - 40);
      gl.addColorStop(0, 'rgba(255,255,230,0)');
      gl.addColorStop(1, 'rgba(255,255,230,.9)');
      g.fillStyle = gl;
      g.fillRect(x - 8, y - 40, 40, 64);
    }
  }
  for (const d of r.drips) {
    g.fillStyle = 'rgba(160,220,255,.9)';
    if (d.state === 1) {
      g.beginPath();
      g.ellipse(d.x, d.y, 1.8, 3, 0, 0, 6.3);
      g.fill();
    } else {
      const sw = Math.min(1, d.t / 2.4);
      g.beginPath();
      g.ellipse(d.x, 7 + sw * 2, 1.4 * sw + 0.6, 1.4 * sw + 0.6, 0, 0, 6.3);
      g.fill();
    }
  }
  for (const c of r.creatures) creature(g, c, v.t, still);
  for (const q of r.projs) {
    g.fillStyle = q.foe ? (q.kind === 'goo' ? '#8aff6a' : q.kind === 'wave' ? '#ff9a6a' : '#ff6aa8') : '#fff7a0';
    g.beginPath();
    g.ellipse(q.x + q.w / 2, q.y + q.h / 2, q.w / 2 + (q.kind === 'wave' ? 2 : 0), q.h / 2, 0, 0, 6.3);
    g.fill();
    if (!q.foe) {
      g.fillStyle = 'rgba(255,247,160,.35)';
      g.fillRect(q.x - q.vx * 0.03, q.y, q.vx * 0.03 + q.w, q.h);
    }
  }
  playerArt(g, r, v);
  // the dark, with a light round him
  if (def.dark) {
    const radius = lamp ? 120 : 58;
    const px = r.p.x + r.p.w / 2;
    const py = r.p.y + r.p.h / 2;
    const dk = g.createRadialGradient(px, py, radius * 0.35, px, py, radius);
    dk.addColorStop(0, 'rgba(6,4,14,0)');
    dk.addColorStop(1, 'rgba(6,4,14,.94)');
    g.fillStyle = dk;
    g.fillRect(cam - 8, -8, 14 * TS + 24, RH * TS + 16);
    g.fillStyle = 'rgba(6,4,14,.94)';
    g.fillRect(cam - 8, -8, Math.max(0, px - radius - cam + 8), RH * TS + 16);
    g.fillRect(px + radius, -8, 14 * TS + cam - px - radius + 16, RH * TS + 16);
    g.fillRect(px - radius, -8, radius * 2, Math.max(0, py - radius + 8));
    g.fillRect(px - radius, py + radius, radius * 2, RH * TS - py - radius + 8);
  }
  g.restore();
  // hearts, the blaster, the room, a boss's bar
  const hy = oy - 10;
  g.shadowColor = 'rgba(0,0,0,.5)';
  g.shadowBlur = 3;
  g.textBaseline = 'alphabetic';
  for (let i = 0; i < r.maxHearts; i++) heart(g, ox + i * 18, hy - 14, 14, i < r.hearts);
  g.font = '600 12px system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,255,255,.92)';
  const wl = weaponLevel(r.xp);
  g.fillText(`${r.tools.blaster ? `Blaster ${wl}` : 'No blaster yet'} · ◆ ${r.crystals}${wl < 3 && r.tools.blaster ? ` (${XP_AT[wl]! - r.xp} to next)` : ''}`, v.w - ox, hy);
  g.textAlign = 'left';
  g.fillText(def.name, ox, hy - 20 - 6);
  g.shadowBlur = 0;
  const b = bossOf(r);
  if (b) {
    const bw = v.w - ox * 2;
    const by = oy + 6;
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(ox, by, bw, 8);
    g.fillStyle = b.phase === 1 ? '#ffd34d' : b.phase === 2 ? '#ff9a4d' : '#ff5a5a';
    g.fillRect(ox, by, bw * Math.max(0, b.hp / b.max), 8);
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(ox + bw / 3, by - 1, 1.5, 10);
    g.fillRect(ox + (bw * 2) / 3, by - 1, 1.5, 10);
    g.fillStyle = '#fff';
    g.font = '700 11px system-ui, sans-serif';
    g.fillText(b.kind === 'boss1' ? 'THE BROOD MOTHER' : 'THE WARDEN', ox, by + 22);
  }
  if (r.dead) {
    g.fillStyle = `rgba(0,0,0,${Math.min(0.7, r.deadT)})`;
    g.fillRect(0, 0, v.w, v.h);
  }
  if (r.ended) {
    g.fillStyle = `rgba(255,255,240,${Math.min(0.9, r.endT * 0.7)})`;
    g.fillRect(0, 0, v.w, v.h);
  }
  if (r.mapOpen) map(g, r, v);
  if (v.demo) {
    g.fillStyle = '#fff';
    g.font = '700 14px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Ghosty playing', v.w / 2, oy + bandH + 24);
    g.textAlign = 'left';
  }
}

function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean): void {
  g.save();
  g.translate(x, y);
  g.beginPath();
  g.moveTo(s / 2, s * 0.9);
  g.bezierCurveTo(-s * 0.3, s * 0.35, s * 0.15, -s * 0.2, s / 2, s * 0.28);
  g.bezierCurveTo(s * 0.85, -s * 0.2, s * 1.3, s * 0.35, s / 2, s * 0.9);
  g.closePath();
  if (full) {
    g.fillStyle = '#ff5a7a';
    g.fill();
  } else {
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 1.2;
    g.stroke();
  }
  g.restore();
}

function map(g: CanvasRenderingContext2D, r: Run, v: View): void {
  const cw = 26;
  const gap = 8;
  const gxs = ROOMS.map((q) => q.gx);
  const gys = ROOMS.map((q) => q.gy);
  const w = (Math.max(...gxs) + 1) * (cw + gap);
  const hh = (Math.max(...gys) + 1) * (cw + gap) + 30;
  const x0 = (v.w - Math.min(w, v.w - 24)) / 2;
  const sc = Math.min(1, (v.w - 24) / w);
  const y0 = v.h * 0.32;
  g.save();
  g.fillStyle = 'rgba(8,6,16,.88)';
  rr(g, 12, y0 - 36, v.w - 24, hh * sc + 80, 14);
  g.fill();
  g.translate(x0, y0);
  g.scale(sc, sc);
  g.font = '700 11px system-ui, sans-serif';
  g.fillStyle = '#fff';
  g.fillText('THE MAP', 0, -14);
  for (const q of ROOMS) {
    const seen = r.visited.has(q.id);
    const x = q.gx * (cw + gap);
    const y = q.gy * (cw + gap) + 4;
    // a door shows when this side has been seen
    for (const [side, e] of Object.entries(q.exits)) {
      if (!e || !seen) continue;
      const o = roomOf(e.to);
      g.strokeStyle = r.visited.has(o.id) ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.3)';
      g.setLineDash(r.visited.has(o.id) ? [] : [3, 3]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + cw / 2, y + cw / 2);
      g.lineTo(o.gx * (cw + gap) + cw / 2, o.gy * (cw + gap) + 4 + cw / 2);
      g.stroke();
      void side;
    }
    g.setLineDash([]);
    const known = seen || Object.values(roomsAround(q.id)).some((id) => r.visited.has(id));
    if (!known) continue;
    g.fillStyle = seen ? q.glow : 'rgba(255,255,255,.12)';
    g.globalAlpha = seen ? 0.85 : 1;
    rr(g, x, y, cw, cw, 6);
    g.fill();
    g.globalAlpha = 1;
    if (!seen) {
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.textAlign = 'center';
      g.fillText('?', x + cw / 2, y + cw / 2 + 4);
      g.textAlign = 'left';
    } else {
      g.fillStyle = '#10101a';
      g.textAlign = 'center';
      g.fillText(String(q.n), x + cw / 2, y + cw / 2 + 4);
      g.textAlign = 'left';
      if (q.spawns.some((s) => s.kind === 'lantern')) {
        g.fillStyle = r.lantern?.room === q.id ? '#fff' : '#ffd27a';
        g.fillRect(x + cw - 6, y + 2, 4, 5);
      }
    }
    if (q.id === r.room.id) {
      g.strokeStyle = '#fff';
      g.lineWidth = 2.5;
      rr(g, x - 3, y - 3, cw + 6, cw + 6, 8);
      g.stroke();
    }
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.font = '600 12px system-ui, sans-serif';
  g.textAlign = 'center';
  const opened = (Object.keys(TOOL_FOUND) as Tool[]).filter((t) => r.tools[t]).length;
  g.fillText(`${r.visited.size} of ${ROOMS.length} rooms · ${opened} of 3 tools · pinch in or tap MAP to close`, v.w / 2, y0 + hh * sc + 30);
  g.textAlign = 'left';
}
const roomsAround = (id: string): string[] => {
  const q = roomOf(id);
  return Object.values(q.exits).map((e) => e!.to);
};

function creature(g: CanvasRenderingContext2D, c: Creature, t: number, still: boolean): void {
  if (!c.alive && c.flash <= 0) return;
  const x = c.x;
  const y = c.y;
  g.save();
  const fl = c.flash > 0 && Math.floor(t * 30) % 2 === 0;
  const col = (a: string) => (fl ? '#ffffff' : a);
  const dir = c.dir > 0 ? 1 : -1;
  const wob = still ? 0 : Math.sin(t * 10 + x);
  switch (c.kind) {
    case 'crawler':
      g.fillStyle = col('#7a4a6a');
      rr(g, x, y + 2, c.w, c.h - 2, 5);
      g.fill();
      g.fillStyle = col('#9a6a8a');
      g.fillRect(x + 2, y + 3, c.w - 4, 2);
      g.fillStyle = '#fff';
      g.fillRect(x + (dir > 0 ? 7 : 2), y + 4, 3, 3);
      g.fillStyle = '#10101a';
      g.fillRect(x + (dir > 0 ? 8.5 : 3), y + 5, 1.4, 1.6);
      g.fillStyle = col('#5a3050');
      g.fillRect(x + 1 + wob, y + c.h - 2, 3, 2);
      g.fillRect(x + c.w - 4 - wob, y + c.h - 2, 3, 2);
      break;
    case 'flutter':
      g.fillStyle = col('#8a6ad0');
      g.beginPath();
      g.ellipse(x + 6, y + 5, 4, 3.5, 0, 0, 6.3);
      g.fill();
      g.fillStyle = col('#b49aff');
      g.beginPath();
      g.moveTo(x + 3, y + 4);
      g.lineTo(x - 4, y + wob * 3);
      g.lineTo(x + 3, y + 8);
      g.moveTo(x + 9, y + 4);
      g.lineTo(x + 16, y + wob * 3);
      g.lineTo(x + 9, y + 8);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(x + 4, y + 3, 1.6, 2);
      g.fillRect(x + 7, y + 3, 1.6, 2);
      break;
    case 'slug':
      g.fillStyle = col('#6aa86a');
      rr(g, x, y, c.w, c.h, 5);
      g.fill();
      g.fillStyle = col('#8acf8a');
      g.fillRect(x + 2, y + 2, c.w - 4, 2);
      g.fillStyle = '#fff';
      g.fillRect(x + 3, y + 5, 3, 3);
      g.fillRect(x + 8, y + 5, 3, 3);
      break;
    case 'frog':
      g.fillStyle = col(c.onGround ? '#4aa86a' : '#5ad07e');
      rr(g, x, y + (c.onGround ? 2 : 0), c.w, c.h - (c.onGround ? 2 : 0), 4);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(x + 1.5, y, 3.4, 3.4);
      g.fillRect(x + 7, y, 3.4, 3.4);
      g.fillStyle = '#10301e';
      g.fillRect(x + 2.6, y + 1, 1.5, 1.8);
      g.fillRect(x + 8, y + 1, 1.5, 1.8);
      break;
    case 'spike':
      g.fillStyle = col('#d0506a');
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(x + i * 4, y + c.h);
        g.lineTo(x + i * 4 + 2, y + (i === 1 ? 0 : 3));
        g.lineTo(x + i * 4 + 4, y + c.h);
        g.fill();
      }
      g.fillStyle = col('#7a2a44');
      g.fillRect(x, y + c.h - 3, c.w, 3);
      break;
    case 'fish':
      g.fillStyle = col('#ff9a5a');
      g.beginPath();
      g.ellipse(x + 6, y + 4, 5.5, 3.5, 0, 0, 6.3);
      g.fill();
      g.beginPath();
      g.moveTo(x + (dir > 0 ? 0 : c.w), y + 4);
      g.lineTo(x + (dir > 0 ? -3 : c.w + 3), y + 4 + wob * 2 - 2);
      g.lineTo(x + (dir > 0 ? -3 : c.w + 3), y + 4 + wob * 2 + 2);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(x + (dir > 0 ? 8 : 2), y + 2.5, 1.6, 1.6);
      break;
    case 'boss1':
      g.fillStyle = col(c.stagger > 0 ? '#c08ad0' : '#8a4a8a');
      rr(g, x, y + 2, c.w, c.h - 2, 12);
      g.fill();
      g.fillStyle = col('#b06ab0');
      g.fillRect(x + 6, y + 5, c.w - 12, 4);
      g.fillStyle = '#fff';
      g.fillRect(x + (dir > 0 ? 28 : 8), y + 9, 7, 7);
      g.fillRect(x + (dir > 0 ? 36 : 16), y + 9, 7, 7);
      g.fillStyle = c.phase === 3 ? '#ff2a4a' : '#10101a';
      g.fillRect(x + (dir > 0 ? 31 : 9), y + 11, 3, 4);
      g.fillRect(x + (dir > 0 ? 39 : 17), y + 11, 3, 4);
      g.fillStyle = col('#5a2a5a');
      for (let i = 0; i < 4; i++) g.fillRect(x + 4 + i * 11 + wob, y + c.h - 4, 7, 4);
      break;
    case 'boss2': {
      g.fillStyle = col(c.stagger > 0 ? '#ffd0ff' : '#e06ab0');
      g.beginPath();
      g.arc(x + c.w / 2, y + c.h / 2, c.w / 2 - 1, 0, 6.3);
      g.fill();
      g.fillStyle = col('#ff9ad8');
      g.beginPath();
      g.arc(x + c.w / 2, y + c.h / 2, c.w / 2 - 8, 0, 6.3);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(x + c.w / 2, y + c.h / 2, 7, 0, 6.3);
      g.fill();
      g.fillStyle = c.phase === 3 ? '#ff2a4a' : '#20102a';
      g.beginPath();
      g.arc(x + c.w / 2 + dir * 2, y + c.h / 2, 3.5, 0, 6.3);
      g.fill();
      g.strokeStyle = 'rgba(255,200,240,.7)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = (still ? 0 : t * 0.8) + i * 1.05;
        g.beginPath();
        g.moveTo(x + c.w / 2 + Math.cos(a) * (c.w / 2), y + c.h / 2 + Math.sin(a) * (c.w / 2));
        g.lineTo(x + c.w / 2 + Math.cos(a) * (c.w / 2 + 6), y + c.h / 2 + Math.sin(a) * (c.w / 2 + 6));
        g.stroke();
      }
      break;
    }
  }
  g.restore();
}

function playerArt(g: CanvasRenderingContext2D, r: Run, v: View): void {
  const p = r.p;
  if (p.inv > 0 && Math.floor(v.t * 20) % 2 === 0 && !r.dead) return;
  const sq = p.sq;
  const w = p.w * (1 + sq * 0.8);
  const hgt = p.h * (1 - sq * 0.7);
  const x = p.x + p.w / 2 - w / 2;
  const y = p.y + p.h - hgt;
  const run = Math.abs(p.vx) > 4 && p.onGround ? Math.sin(p.anim * 16) : 0;
  // a little light of his own
  const gl = g.createRadialGradient(p.x + 5, p.y + 7, 1, p.x + 5, p.y + 7, r.tools.lamp ? 46 : 28);
  gl.addColorStop(0, 'rgba(255,240,200,.22)');
  gl.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gl;
  g.fillRect(p.x - 50, p.y - 50, 110, 110);
  g.fillStyle = v.accent;
  rr(g, x, y, w, hgt - 3, 3);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.28)';
  g.fillRect(x + 1.5, y + 1.5, w - 3, 2);
  g.fillStyle = '#0d1424';
  const vx = p.face > 0 ? x + w * 0.4 : x + 1.5;
  g.fillRect(vx, y + hgt * 0.22, w * 0.55, hgt * 0.2);
  g.fillStyle = '#fff';
  g.fillRect(vx + (p.face > 0 ? w * 0.3 : 1.2), y + hgt * 0.26, 2, 2);
  g.fillStyle = '#0d1424';
  g.fillRect(x + 1 + run * 1.5, y + hgt - 3, w * 0.4, 3);
  g.fillRect(x + w * 0.55 - run * 1.5, y + hgt - 3, w * 0.4, 3);
  if (r.tools.blaster) {
    g.fillStyle = '#9aa8ff';
    g.fillRect(p.face > 0 ? x + w - 1 : x - 4, y + hgt * 0.5, 5, 3);
  }
  if (r.tools.boots) {
    g.fillStyle = '#ff7a5a';
    g.fillRect(x + 1, y + hgt - 3, w - 2, 1.5);
  }
}

export const caveEngine = makeEngine(rules, GAMES5.find((e) => e.id === CAVE_ID)!);
export { rules as caveRules, caveLearnable, ENDING_BASE };
