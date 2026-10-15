/**
 * Building games and mini-apps as instant widgets with GK, Ghosty's widget kit
 * (apps/web/public/widget-kit.js). The example game in "game-kit" is run by the browser
 * tests exactly as written here, so it is known to work — keep it that way.
 */
import type { Playbook } from './types';

export const NEON_DODGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Neon Dodge</title>
<script src="/widget-kit.js"></script>
</head>
<body>
<script>
const W = 360, H = 640;
const { ctx } = GK.canvas({ width: W, height: H });
GK.controls({ dpad: true, buttons: ['A'] });
const fx = GK.particles();
let player, rocks, score, spawn, speed, best = GK.highscore('dodge');

function reset() {
  player = { x: W / 2 - 18, y: H - 170, w: 36, h: 18 }; // above the touch pad on phones
  rocks = [];
  score = 0;
  spawn = 0.5;
  speed = 170;
}

function drawField(ctx) {
  GK.clear(ctx);
  for (let y = 0; y < H; y += 40) GK.line(ctx, 0, y, W, y, 'rgba(92,225,255,.06)', 1);
  GK.glow(ctx, GK.theme.bad, 10);
  for (const r of rocks) GK.rect(ctx, r.x, r.y, r.w, r.h, GK.theme.bad);
  GK.glow(ctx, GK.theme.accent, 14);
  GK.rect(ctx, player.x, player.y, player.w, player.h, GK.theme.accent);
  GK.glow(ctx);
  fx.draw(ctx);
  GK.text(ctx, 'SCORE ' + score, 12, 12, { size: 16 });
  GK.text(ctx, 'BEST ' + best, W - 12, 12, { size: 16, align: 'right', color: GK.theme.dim });
}

const game = GK.scenes({
  title: {
    enter() { reset(); },
    update() { if (GK.pressed('action') || GK.pointer.pressed) game.go('play'); },
    draw(ctx) {
      drawField(ctx);
      GK.text(ctx, 'NEON DODGE', W / 2, H / 2 - 70, { size: 34, align: 'center', color: GK.theme.accent, bold: true });
      GK.text(ctx, 'dodge the red blocks', W / 2, H / 2 - 20, { size: 16, align: 'center', color: GK.theme.dim });
      GK.text(ctx, 'TAP OR PRESS SPACE', W / 2, H / 2 + 20, { size: 16, align: 'center' });
    },
  },
  play: {
    enter() { reset(); GK.sound.jump(); },
    update(dt) {
      const move = (GK.key('right') ? 1 : 0) - (GK.key('left') ? 1 : 0);
      player.x += move * 320 * dt;
      if (GK.pointer.down) {
        const gap = GK.pointer.x - (player.x + player.w / 2);
        player.x += Math.sign(gap) * Math.min(Math.abs(gap), 420 * dt);
      }
      player.x = GK.clamp(player.x, 0, W - player.w);
      speed += 9 * dt;
      spawn -= dt;
      if (spawn <= 0) {
        spawn = GK.rand(0.3, 0.8) * (170 / speed);
        const s = GK.rand(18, 42);
        rocks.push({ x: GK.rand(0, W - s), y: -s, w: s, h: s });
      }
      for (const r of rocks) r.y += speed * dt;
      const before = rocks.length;
      rocks = rocks.filter((r) => r.y < H);
      score += before - rocks.length;
      fx.update(dt);
      if (rocks.some((r) => GK.hit(r, player))) {
        GK.sound.explode();
        fx.burst(player.x + player.w / 2, player.y + player.h / 2, { n: 40, color: GK.theme.bad, speed: 240 });
        game.go('over');
      }
    },
    draw: drawField,
  },
  over: {
    enter() { best = GK.highscore('dodge', score); this.wait = 0.7; },
    update(dt) {
      fx.update(dt);
      this.wait -= dt;
      if (this.wait <= 0 && (GK.pressed('action') || GK.pointer.pressed)) game.go('play');
    },
    draw(ctx) {
      drawField(ctx);
      GK.text(ctx, 'GAME OVER', W / 2, H / 2 - 50, { size: 32, align: 'center', color: GK.theme.bad, bold: true });
      GK.text(ctx, 'score ' + score + '   best ' + best, W / 2, H / 2, { size: 18, align: 'center' });
      GK.text(ctx, 'TAP OR PRESS SPACE', W / 2, H / 2 + 40, { size: 15, align: 'center', color: GK.theme.dim });
    },
  },
}, 'title');

GK.loop(game.update, game.draw);
</script>
</body>
</html>`;

export const GAMES: Playbook[] = [
  {
    id: 'game-kit',
    title: 'GK widget kit reference + a complete working game (build games this way)',
    tags: ['game', 'games', 'kit', 'gk', 'canvas', 'arcade', 'play', 'build a game', 'make a game', 'widget', 'animation', 'sprite', 'controls'],
    body: `Games and mini-apps are built as instant widgets (create_widget) on GK, Ghosty's widget kit. GK does the hard, error-prone parts — screen fitting, the frame loop, keyboard + touch input, collisions, sound, particles, scenes, saving — so you write only the game itself. Include it in <head>: <script src="/widget-kit.js"></script> (added automatically if you forget).

API (all on the global GK):
SETUP   GK.canvas({ width: 480, height: 640, pixel?: bool, bg? }) → { canvas, ctx, width, height }. Draw in these game units; it scales to fit any screen.
LOOP    GK.loop(update(dt), draw(ctx)) → { pause(), resume(), stop() }. dt = seconds (≤ 0.05). Pauses while hidden.
SCENES  const game = GK.scenes({ title: {...}, play: {...}, over: {...} }, 'title'); GK.loop(game.update, game.draw); game.go('over', data).
        A scene is { enter(data), update(dt), draw(ctx), leave() } — all optional; 'this' is the scene object.
TIMERS  GK.after(sec, fn), GK.every(sec, fn) (game time, return cancel fns); const cd = GK.cooldown(0.25); if (cd.ready()) { cd.use(); ... }
KEYS    GK.key(name) held; GK.pressed(name) true once per press. Names: 'left' 'right' 'up' 'down' (arrows + WASD + touch pad), 'action' (Space/Enter/Z/touch A), 'A', 'B', 'pause', or any KeyboardEvent.code ('KeyR', 'Digit1').
TOUCH   GK.controls({ dpad: true, buttons: ['A', 'B'] }) — on-screen pad on phones, feeding the same names. GK.onSwipe(dir => ...) for swipe games.
POINTER GK.pointer = { x, y (game units), down, pressed, released } — pressed/released are true for one frame.
DRAW    GK.clear(ctx, color?), GK.rect(ctx, x, y, w, h, color), GK.strokeRect(...), GK.circle(ctx, x, y, r, color), GK.ring(...), GK.line(ctx, x1, y1, x2, y2, color, width), GK.poly(ctx, [[x, y], ...], color, fill?), GK.text(ctx, str, x, y, { size, color, align, baseline, bold }), GK.glow(ctx, color, blur) / GK.glow(ctx) to stop.
FX      const fx = GK.particles(); fx.burst(x, y, { n, color, speed, life, size, gravity }); fx.update(dt); fx.draw(ctx).
HITS    GK.hit(a, b) rects {x, y, w, h} (top-left); GK.hitCircle(a, b) circles {x, y, r}; GK.hitCircleRect(c, r); GK.inside(px, py, rect).
MATHS   GK.rand(a, b), GK.randInt(a, b) (inclusive), GK.pick(arr), GK.shuffle(arr), GK.clamp(v, a, b), GK.lerp(a, b, t), GK.dist(...), GK.angle(...).
GRID    GK.grid(cols, rows, fill) → { get(x, y), set(x, y, v), inside(x, y), each(fn(v, x, y)), clone(), cells } for puzzles, boards, tile maps.
SOUND   GK.sound.jump() coin() shoot() hit() explode() win() lose(), beep(freq, dur, type, vol), sweep(from, to, dur), noise(dur), mute(). Starts after the first tap/key.
SAVE    GK.save(key, value), GK.load(key, fallback), GK.highscore(name, score?) → best. (In-memory in the sandbox: survives restarts of the game, not reloads.)
THEME   GK.theme = { bg, panel, fg, accent, good, warn, bad, dim, font }.

COMPLETE EXAMPLE — a finished game: title screen, play, game over, score, best score, keyboard + touch + drag controls, rising difficulty, sound, particles, glow. Copy its structure for any arcade game.

${NEON_DODGE}`,
  },
  {
    id: 'game-design',
    title: 'Designing a game that is complete and fun (not a tech demo)',
    tags: ['game', 'games', 'game design', 'fun', 'levels', 'difficulty', 'juice', 'polish', 'playable', 'complete game'],
    body: `A "full functioning game" has ALL of these. Check every box before create_widget:
[ ] Title screen: name, one-line goal, how to start (tap / Space).
[ ] Core loop the owner can describe in one sentence (dodge, jump, match, shoot, merge, guess).
[ ] Controls on BOTH keyboard and touch (GK.controls / GK.pointer / GK.onSwipe) — Ghosty runs on phones.
[ ] Clear goal and failure: lives, timer, or a lose condition — and a win condition if the game has an end.
[ ] Score on screen + best score saved (GK.highscore).
[ ] Difficulty that rises (speed += k * dt, more enemies per level, shorter timers) — fair at the start.
[ ] Game over screen with score, best and "play again" — restart must fully reset state (one reset() function).
[ ] Pause (GK.pressed('pause') toggles loop.pause()/resume() or a paused flag) for longer games.
[ ] Feedback ("juice"): a sound + particles or flash for every hit, pickup and death; screen shake for big hits (offset drawing by GK.rand(-s, s) for a few frames).
[ ] Readable: high contrast on the dark background, nothing important under the touch pad (bottom 150px on phones).
[ ] No softlocks: every state has a way forward; nothing spawns inside the player; nothing leaves the play area forever.

Process:
1. Write the rules down first (entities, controls, scoring, win/lose, difficulty curve) in 5–10 lines.
2. Pick the matching recipe (study "game recipes") and the GK skeleton from the game-kit example.
3. Model the state as plain objects/arrays; one reset() builds a fresh state.
4. update(dt): input → movement (always × dt) → spawning → collisions → scoring → state changes. draw(ctx): background → world → effects → HUD.
5. Mentally play it: first 5 seconds, first death, restart, 2 minutes in (is it still possible?), phone with touch only.
6. Keep it in one HTML file under ~60 KB; prefer drawn shapes + glow over images (no external assets needed).

Ask yourself at the end: would the owner play it twice? If not, add one twist (power-up, combo multiplier, boss, daily seed, new enemy type).`,
  },
  {
    id: 'game-recipes',
    title: 'Game recipes: the core logic of popular game types',
    tags: ['game', 'games', 'platformer', 'snake', 'tetris', 'breakout', 'pong', 'flappy', 'shooter', 'asteroids', '2048', 'match', 'memory', 'puzzle', 'racing', 'tower defense', 'chess', 'quiz', 'physics', 'gravity', 'game recipes'],
    body: `All snippets are GK-based and frame-rate independent (multiply by dt).

PLATFORMER (gravity + jumping on solid ground):
  p = { x, y, w, h, vx: 0, vy: 0, onGround: false }; GRAVITY = 1800; JUMP = 650; RUN = 260
  p.vx = ((GK.key('right') ? 1 : 0) - (GK.key('left') ? 1 : 0)) * RUN
  if (p.onGround && GK.pressed('action')) { p.vy = -JUMP; GK.sound.jump(); }
  p.vy = Math.min(p.vy + GRAVITY * dt, 1200)
  move X then resolve X collisions against each solid rect; move Y then resolve Y (landing: p.y = s.y - p.h; p.vy = 0; p.onGround = true). Resolving axes separately prevents sticking in walls.
  Coyote time: allow a jump for 0.1 s after leaving a ledge. Camera: camX = GK.clamp(p.x - W / 2, 0, levelWidth - W); ctx.save(); ctx.translate(-camX, 0); …draw world…; ctx.restore(); then HUD.
  Levels as strings: ['......', '..##..', '######'] → '#' becomes a solid 32×32 rect.

SNAKE (grid, fixed step):
  grid 20×20, snake = [{x, y}...] head first, dir {x: 1, y: 0}; step every 0.12 s with GK.every or an accumulator (acc += dt; while (acc >= STEP) { acc -= STEP; tick(); }).
  Buffer the next direction from input; ignore a reverse (newDir.x === -dir.x && newDir.y === -dir.y).
  tick: head = {x: snake[0].x + dir.x, y: ...}; die if outside or hits body; unshift(head); if on food: score++, new food on a free cell (loop until free), else pop() the tail.

BREAKOUT / PONG:
  ball {x, y, r, vx, vy}; walls: if (b.x < b.r || b.x > W - b.r) b.vx *= -1 (and clamp back inside).
  Paddle hit: angle from where it hit: t = (b.x - (pad.x + pad.w / 2)) / (pad.w / 2); speed = Math.hypot(b.vx, b.vy) * 1.03; b.vx = speed * t * 0.8; b.vy = -Math.sqrt(speed * speed - b.vx * b.vx).
  Bricks: on GK.hitCircleRect(ball, brick): remove it, flip vy (or vx if hit from the side: compare overlap depths), score, particles. Level cleared when no bricks remain.
  Pong AI: paddle moves toward ball.y at a capped speed (beatable) with a small reaction delay.

FLAPPY:
  bird vy += GRAVITY * dt; on GK.pressed('action') || GK.pointer.pressed: vy = -FLAP. Pipes spawn every 1.4 s with a random gap (gap 150–180 px), move left at constant speed; score when a pipe passes the bird; die on hit or floor/ceiling.

TOP-DOWN SHOOTER / ASTEROIDS:
  ship angle a, thrust: vx += Math.cos(a) * THRUST * dt; friction vx *= Math.pow(0.4, dt); wrap: x = (x + W) % W.
  Bullets from a cooldown: if (GK.key('action') && gun.ready()) { gun.use(); bullets.push({ x, y, vx: Math.cos(a) * 500, vy: ..., life: 1 }); }
  Remove dead entities with list = list.filter(e => e.life > 0) — never splice while iterating forward.
  Asteroids split: on hit, if r > 15 push two smaller rocks with random velocities.

TETRIS:
  board GK.grid(10, 20, 0); pieces as 4×4 matrices; rotate: m[r][c] → m[c][N - 1 - r]; a move/rotation is allowed if no filled cell would be out of bounds or overlapping (else try a wall kick of ±1, else cancel).
  Gravity step (0.8 s, faster per level); lock when it can't move down; clear full rows (filter rows, add empty rows on top); score 100/300/500/800 for 1–4 lines; game over if a new piece overlaps on spawn.

2048:
  For each move, process each row in the move direction: drop zeros, merge equal neighbours once (left to right), pad with zeros. Only spawn a new 2 (90%) or 4 if the board changed. Lose when no empty cell and no equal neighbours. Animate by lerping tile positions (optional).

MATCH-3:
  Swap two adjacent cells; find runs of ≥ 3 horizontally and vertically (mark, then remove together); if none, swap back. Gravity: per column, move non-empty cells down; refill from the top; repeat finding matches until stable (cascades, combo multiplier).

MEMORY / CARD GAMES:
  cards = GK.shuffle([...symbols, ...symbols]).map(s => ({ s, open: false, done: false })); flip two; if equal → done, else close both after 0.7 s (GK.after) and block input meanwhile.

QUIZ / WORD GAMES (DOM, not canvas): use GK.app + GK.button; keep questions in an array; shuffle; track score; show the right answer after each guess. Word lists must be in the file (no network needed).

TOWER DEFENSE:
  path = array of waypoints; enemies move toward path[e.i] and advance i when close (dist < speed * dt); towers find the nearest enemy in range each cooldown and spawn a projectile that homes on it; waves with growing hp/count; money from kills buys towers on click (GK.pointer.pressed, snap to grid).

RACING (top-down): car angle += steer * turnRate * (speed / max) * dt; speed += accel * dt with drag; off-track if the pixel/cell under the car is grass → slow down; laps by checkpoints in order.

BOARD GAMES (tic-tac-toe, connect four, chess-lite): GK.grid for the board; pure functions legalMoves(state), apply(state, move), winner(state). AI: minimax with alpha-beta (depth 4–6 for small boards) or a scored random move for easy mode.`,
  },
  {
    id: 'app-widgets',
    title: 'Mini-apps as widgets (tools, trackers, dashboards) with GK',
    tags: ['app', 'mini app', 'tool', 'tracker', 'todo', 'list', 'calculator', 'converter', 'timer', 'dashboard', 'form', 'widget', 'ui'],
    body: `Non-game widgets use the DOM, not a canvas. Pattern — state + one render() function:

<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="/widget-kit.js"></script></head><body><script>
const root = GK.app('Shopping list');
let items = GK.load('items', []);
const input = GK.input('Add an item…');
const list = GK.el('div');
function add() {
  const t = input.value.trim();
  if (!t) return;
  items.push({ t, done: false });
  input.value = '';
  save();
}
function save() { GK.save('items', items); render(); }
function render() {
  list.replaceChildren(...items.map((it, i) => GK.card(
    GK.el('div.gk-row',
      GK.el('span', { style: { flex: 1, textDecoration: it.done ? 'line-through' : 'none' }, onclick: () => { it.done = !it.done; save(); } }, it.t),
      GK.button('✕', () => { items.splice(i, 1); save(); }, 'ghost')))));
  if (!items.length) list.append(GK.el('p.gk-dim', 'Nothing yet.'));
}
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
root.append(GK.card(GK.el('div.gk-row', input, GK.button('ADD', add))), list);
render();
</script></body></html>

Rules:
- Text goes in with GK.el / textContent — never innerHTML with user or fetched text.
- One source of truth (the state variables); every change calls save()/render().
- Timers: setInterval for clocks is fine in widgets (they are separate from Ghosty's frame loop); keep one and clear it when stopped.
- Data from the internet: fetch() works only from APIs that allow any origin (Access-Control-Allow-Origin: *), e.g. api.open-meteo.com, api.frankfurter.app, api.coingecko.com. Show a loading state and an error message; never leave the widget blank.
- Storage: GK.save/GK.load (in memory inside the sandbox — tell the owner data resets when the widget is reopened, or offer a permanent version as a self-edit).
- Charts: draw on a small canvas (GK.canvas is for full-screen games; for a chart create a <canvas>, set width/height, draw lines/bars yourself).`,
  },
];
