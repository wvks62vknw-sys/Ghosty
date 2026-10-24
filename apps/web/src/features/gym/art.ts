/**
 * The GYM's pictures (BRIEF-IRON-BUILD step 3; OWNER-ISSUES 41 "the gym pics could be better"): every one of the 22
 * games as holographic line-art, 160 × 84, in the reactor's light. Chess, the maze, Sudoku, Connect 4, Go and Sokoban
 * are ported from the hand-drawn mock-ups (docs/build-plan/mockups/iron/build.mjs); the other sixteen are drawn here
 * in the same hand: thin lines, the move or the answer lit, his pieces filled, the other side outlined.
 *
 * They are pictures of each game, not readings: the card's numbers (level, mastery and its pass mark, the rating)
 * sit under the picture. Built with svgEl and textContent only. Classes as the mock-ups' (ln, ln2, lit, fl, fl2, mv,
 * tgt, path, gold, dg, hl, cur, disc, hole, win, trail, stone, tgt2, box), coloured in styles.css "Iron Man".
 */
import { svgEl } from '../../core/dom';

const f = (n: number) => +n.toFixed(2);
const rng = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

type El = SVGElement;
const P = (cls: string, d: string, extra: Record<string, string | number> = {}): El => svgEl('path', { class: cls, d, ...extra });
const C = (cls: string, cx: number, cy: number, r: number): El => svgEl('circle', { class: cls, cx: f(cx), cy: f(cy), r: f(r) });
const E = (cls: string, cx: number, cy: number, rx: number, ry: number): El => svgEl('ellipse', { class: cls, cx: f(cx), cy: f(cy), rx: f(rx), ry: f(ry) });
const R = (cls: string, x: number, y: number, w: number, hh: number, rx = 0): El => svgEl('rect', { class: cls, x: f(x), y: f(y), width: f(w), height: f(hh), rx });
const T = (cls: string, x: number, y: number, text: string): El => {
  const t = svgEl('text', { class: cls, x: f(x), y: f(y) });
  t.textContent = text;
  return t;
};
const PL = (cls: string, pts: [number, number][]): El => svgEl('polyline', { class: cls, fill: 'none', points: pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ') });

/** A board seen from in front: (u, v) in 0..1 to the picture. */
function persp(yT: number, yB: number, wT: number, wB: number) {
  return (u: number, v: number): [number, number] => {
    const vv = Math.pow(v, 0.85), w = wT + (wB - wT) * vv;
    return [80 + (u - 0.5) * w, yT + (yB - yT) * vv];
  };
}
/** A perspective board's lines and dark squares (chess, checkers). */
function board(Pp: (u: number, v: number) => [number, number], N: number): El[] {
  let g = '', sq = '';
  for (let i = 0; i <= N; i++) {
    const [a, b] = Pp(i / N, 0), [c, d] = Pp(i / N, 1);
    g += `M${f(a)} ${f(b)}L${f(c)} ${f(d)}`;
    const [e, hh] = Pp(0, i / N), [k, l] = Pp(1, i / N);
    g += `M${f(e)} ${f(hh)}L${f(k)} ${f(l)}`;
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      if ((i + j) % 2) {
        const q = [Pp(i / N, j / N), Pp((i + 1) / N, j / N), Pp((i + 1) / N, (j + 1) / N), Pp(i / N, (j + 1) / N)];
        sq += `M${q.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
      }
  return [P('fl2', sq), P('ln2', g)];
}

const ART: Record<string, () => El[]> = {
  chess() {
    const Pp = persp(10, 80, 92, 150), N = 8;
    const at = (i: number, j: number) => Pp((i + 0.5) / N, (j + 0.72) / N);
    const pc = (i: number, j: number, kind: 'p' | 'r' | 'k', cls: string): El[] => {
      const [x, y] = at(i, j), s = 0.55 + (j / N) * 0.6, H = 15 * s, W = 4.2 * s;
      let d = `M${f(x - W)} ${f(y)}h${f(2 * W)}M${f(x - W * 0.7)} ${f(y)}L${f(x - W * 0.45)} ${f(y - H * 0.55)}M${f(x + W * 0.7)} ${f(y)}L${f(x + W * 0.45)} ${f(y - H * 0.55)}`;
      if (kind === 'p') d += `M${f(x - W * 0.45)} ${f(y - H * 0.55)}h${f(W * 0.9)}`;
      const head = kind === 'p' ? C(cls, x, y - H * 0.72, 2.1 * s)
        : kind === 'r' ? P(cls, `M${f(x - W * 0.6)} ${f(y - H * 0.55)}v${f(-H * 0.4)}h${f(W * 0.35)}v${f(H * 0.15)}h${f(W * 0.5)}v${f(-H * 0.15)}h${f(W * 0.35)}v${f(H * 0.4)}`)
          : P(cls, `M${f(x - W * 0.5)} ${f(y - H * 0.55)}L${f(x)} ${f(y - H * 0.95)}L${f(x + W * 0.5)} ${f(y - H * 0.55)}M${f(x)} ${f(y - H * 0.95)}v${f(-H * 0.3)}M${f(x - W * 0.3)} ${f(y - H * 1.1)}h${f(W * 0.6)}`);
      return [P(cls, d), head];
    };
    const [ax, ay] = at(2, 6), [bx, by] = at(4, 3);
    return [
      ...board(Pp, N),
      ...pc(5, 1, 'k', 'ln'), ...pc(3, 2, 'p', 'ln'), ...pc(6, 2, 'p', 'ln'), ...pc(1, 3, 'r', 'ln'),
      ...pc(2, 6, 'r', 'lit'), ...pc(4, 5, 'p', 'lit'), ...pc(5, 6, 'k', 'lit'), ...pc(6, 5, 'p', 'lit'),
      P('mv', `M${f(ax)} ${f(ay - 10)}Q${f((ax + bx) / 2)} ${f(Math.min(ay, by) - 26)} ${f(bx)} ${f(by - 6)}`), C('tgt', bx, by - 2, 3.6),
    ];
  },
  maze() {
    const Cn = 12, Rn = 6, s = 12, x0 = 80 - (Cn * s) / 2, y0 = 6;
    const r = rng(5), seen = new Set<string>(), walls = new Set<string>();
    for (let i = 0; i < Cn; i++) for (let j = 0; j < Rn; j++) (walls.add(`h${i},${j}`), walls.add(`v${i},${j}`));
    const st: [number, number][] = [[0, 0]];
    seen.add('0,0');
    const par: Record<string, [number, number]> = {};
    while (st.length) {
      const [i, j] = st[st.length - 1]!;
      const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([a, b]) => [i + a, j + b] as [number, number]).filter(([a, b]) => a >= 0 && b >= 0 && a < Cn && b < Rn && !seen.has(`${a},${b}`));
      if (!nb.length) {
        st.pop();
        continue;
      }
      const [a, b] = nb[Math.floor(r() * nb.length)]!;
      if (a !== i) walls.delete(`v${Math.max(a, i)},${j}`);
      else walls.delete(`h${i},${Math.max(b, j)}`);
      seen.add(`${a},${b}`);
      par[`${a},${b}`] = [i, j];
      st.push([a, b]);
    }
    let d = `M${x0} ${y0}H${x0 + Cn * s}V${y0 + Rn * s}H${x0}Z`;
    for (const w of walls) {
      const [i, j] = w.slice(1).split(',').map(Number) as [number, number];
      if (w[0] === 'v' && i > 0) d += `M${x0 + i * s} ${y0 + j * s}v${s}`;
      if (w[0] === 'h' && j > 0) d += `M${x0 + i * s} ${y0 + j * s}h${s}`;
    }
    const path: [number, number][] = [];
    let cur: [number, number] | undefined = [Cn - 1, Rn - 1];
    while (cur) {
      path.push(cur);
      cur = par[`${cur[0]},${cur[1]}`];
    }
    const pts = path.reverse().map(([i, j]) => [x0 + (i + 0.5) * s, y0 + (j + 0.5) * s] as [number, number]);
    const gx = x0 + (Cn - 0.5) * s, gy = y0 + (Rn - 0.5) * s;
    let mud = '';
    for (const [i, j] of [[3, 1], [4, 1], [7, 4], [8, 4], [8, 3]] as const) for (let k = 1; k < 4; k++) mud += `M${x0 + i * s + k * 3} ${y0 + j * s + 1}l-3 ${s - 2}`;
    return [P('ln2', mud), P('ln', d), PL('path', pts), C('fl', x0 + 0.5 * s, y0 + 0.5 * s, 2.4), P('gold', `M${gx} ${gy - 4.5}l4 4.5-4 4.5-4-4.5z`)];
  },
  sudoku() {
    const s = 8.6, n = 9, x0 = 80 - (s * n) / 2, y0 = 3;
    let thin = '', thick = '';
    for (let k = 0; k <= n; k++) {
      const L = `M${f(x0 + k * s)} ${y0}v${f(n * s)}M${x0} ${f(y0 + k * s)}h${f(n * s)}`;
      if (k % 3) thin += L;
      else thick += L;
    }
    const giv = '5..7....3.8.1...9..4..3.6..2..9.4...7...5...3.6..8..1..5.2..8..9...6.4.1....3..2';
    const his = new Set([2, 11, 19, 30, 41, 47, 58, 66, 74]);
    const sol = '519746823683125497247839615125694378978213564364578912431962758892357146756481239';
    const out: El[] = [];
    const ci = 49, cxx = x0 + (ci % 9) * s, cyy = y0 + Math.floor(ci / 9) * s;
    out.push(R('hl', x0, cyy, n * s, s), R('hl', cxx, y0, s, n * s), P('ln2', thin), P('ln', thick));
    for (let i = 0; i < 81; i++) {
      const g = giv[i] !== '.', h2 = his.has(i);
      if (!g && !h2) continue;
      out.push(T(g ? 'dg' : 'dg his', x0 + ((i % 9) + 0.5) * s, y0 + (Math.floor(i / 9) + 0.5) * s + 2.5, sol[i]!));
    }
    out.push(R('cur', cxx, cyy, s, s));
    return out;
  },
  connect4() {
    const s = 11.5, x0 = 80 - 3.5 * s, y0 = 13;
    const B = ['.......', '.......', '...o...', '..xx...', '.oxox..', 'oxxoox.'];
    const out: El[] = [R('ln', x0 - 3, y0 - 3, 7 * s + 6, 6 * s + 6, 4)];
    for (let j = 0; j < 6; j++)
      for (let i = 0; i < 7; i++) {
        const ch = B[j]![i];
        out.push(C(ch === 'x' ? 'disc his' : ch === 'o' ? 'disc opp' : 'hole', x0 + (i + 0.5) * s, y0 + (j + 0.5) * s, 4.3));
      }
    const dx = x0 + 4.5 * s;
    out.push(P('ln2', `M${f(x0 - 8)} ${f(y0 + 6 * s + 3)}h${f(7 * s + 16)}`), P('trail', `M${f(dx)} ${y0 - 12}v-6`), C('disc his drop', dx, y0 - 6, 4.3),
      P('win', `M${f(x0 + 1.5 * s)} ${f(y0 + 5.5 * s)}L${f(x0 + 4.5 * s)} ${f(y0 + 2.5 * s)}`, { 'stroke-dasharray': '2 2.5' }));
    return out;
  },
  go() {
    const Pp = persp(10, 80, 96, 150), N = 9;
    let g = '';
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const [a, b] = Pp(t, 0.5 / N), [c, d] = Pp(t, 1 - 0.5 / N);
      g += `M${f(a)} ${f(b)}L${f(c)} ${f(d)}`;
      const [e, hh] = Pp(0.5 / N, t), [k, l] = Pp(1 - 0.5 / N, t);
      g += `M${f(e)} ${f(hh)}L${f(k)} ${f(l)}`;
    }
    const st = (i: number, j: number, cls: string) => {
      const [x, y] = Pp((i + 0.5) / N, (j + 0.5) / N), s = 0.6 + ((j + 0.5) / N) * 0.6;
      return E(cls, x, y, 4.2 * s, 3 * s);
    };
    const out: El[] = [P('ln2', g)];
    for (const [i, j] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]] as const) {
      const [x, y] = Pp((i + 0.5) / N, (j + 0.5) / N);
      out.push(C('fl', x, y, 0.9));
    }
    for (const [i, j] of [[3, 2], [4, 3], [5, 3], [3, 4], [5, 5], [2, 5], [6, 4]] as const) out.push(st(i, j, 'stone his'));
    for (const [i, j] of [[4, 2], [5, 2], [6, 3], [4, 5], [3, 6], [6, 5]] as const) out.push(st(i, j, 'stone opp'));
    out.push(st(4, 6, 'stone next'));
    return out;
  },
  sokoban() {
    const s = 11, M = ['##########', '#..#.....#', '#..b..##.#', '#.t#.b..t#', '#....p...#', '##########'], Cn = 10, x0 = 80 - (Cn * s) / 2, y0 = 9;
    let wall = '', hatch = '';
    const etc: El[] = [];
    M.forEach((row, j) => [...row].forEach((ch, i) => {
      const x = x0 + i * s, y = y0 + j * s;
      if (ch === '#') {
        wall += `M${x} ${y}h${s}v${s}h${-s}Z`;
        hatch += `M${x + 2} ${y + s}l${s - 2} ${-s + 2}M${x} ${y + s - 3}l${s - 4} ${-s + 4}`;
      }
      if (ch === 't') etc.push(P('tgt2', `M${x + s / 2} ${y + 2}l${s / 2 - 2} ${s / 2 - 2}-${s / 2 - 2} ${s / 2 - 2}-${s / 2 - 2}-${s / 2 - 2}z`));
      if (ch === 'b') etc.push(P('box', `M${x + 1.5} ${y + 1.5}h${s - 3}v${s - 3}h${-(s - 3)}zM${x + 1.5} ${y + 1.5}l${s - 3} ${s - 3}M${x + s - 1.5} ${y + 1.5}l${-(s - 3)} ${s - 3}`));
      if (ch === 'p') etc.push(C('fl', x + s / 2, y + s / 2, 3));
    }));
    const px = x0 + 5.5 * s, py = y0 + 4.5 * s;
    return [P('ln2', hatch), P('ln', wall), ...etc, P('path', `M${px} ${py}H${x0 + 6.5 * s}V${y0 + 3.5 * s + 1}`, { fill: 'none' })];
  },

  // ---------- the sixteen drawn here, in the same hand
  codebreaker() {
    // Mastermind: the hidden code behind its shield, four guesses, the last one his (lit), the pegs that answered.
    const xs = [58, 72, 86, 100], out: El[] = [R('ln', 44, 2, 88, 80, 6), P('ln2', 'M44 17h88M110 17v65')];
    for (const x of xs) out.push(R('tgt2', x - 4.5, 5.5, 9, 8, 2));
    const rows: [number, string, number, number][] = [[28, 'oooo', 1, 1], [44, 'oooo', 2, 1], [60, 'oooo', 2, 2], [74, 'xxxx', 4, 0]];
    for (const [y, kind, exact, near] of rows) {
      for (const x of xs) out.push(C(kind === 'x' ? 'disc his' : 'disc opp', x, y, 4.4));
      for (let k = 0; k < 4; k++) out.push(C(k < exact ? 'fl' : k < exact + near ? 'ln' : 'hole', 117 + (k % 2) * 7, y - 3 + Math.floor(k / 2) * 6, 1.6));
    }
    out.push(P('ln2', 'M48 74h-6'), P('lit', 'M49 70l-4 4 4 4'));
    return out;
  },
  colony() {
    // The colony on the ground: the dome, the solar panels (one being built), the mine below, the stored energy.
    const out: El[] = [P('ln2', 'M14 60H146'), P('ln', 'M34 60a20 20 0 0140 0'), P('ln2', 'M40 60a14 14 0 0128 0M54 40v-8M50 32h8')];
    for (const [x, lit] of [[88, true], [108, true], [128, false]] as const) {
      out.push(P(lit ? 'ln' : 'ln2', `M${x} 52l6-14h14l-6 14z`), P('ln2', `M${x + 3} 45h14M${x + 10} 38l-6 14`), P('ln2', `M${x + 10} 52v8`));
      if (lit) out.push(P('lit', `M${x + 6} 38h14`));
    }
    out.push(P('tgt2', 'M128 52l6-14h14l-6 14z'));
    out.push(P('path', 'M60 60v8l10 4 12-2 6 6', { fill: 'none' }), C('gold', 88, 76, 2.4));
    out.push(R('ln', 16, 22, 10, 30, 2), R('fl2', 17.5, 39, 7, 11.5), R('fl2', 17.5, 31, 7, 7), P('ln2', 'M19 20h4'));
    out.push(C('fl', 140, 14, 3.4), P('ln2', 'M140 5v3M140 20v3M131 14h3M146 14h3'));
    return out;
  },
  trust() {
    // The tournament: strategies round a ring, the pairs that keep cooperating lit, the ones that defect dashed.
    const cx = 80, cy = 42, rx = 54, ry = 30, k = 8;
    const pt = (i: number) => [cx + rx * Math.cos((i / k) * 2 * Math.PI - Math.PI / 2), cy + ry * Math.sin((i / k) * 2 * Math.PI - Math.PI / 2)] as const;
    const coop = [[0, 3], [0, 5], [3, 5], [1, 6], [3, 6]] as const;
    const dash = [[2, 7], [1, 4], [2, 5], [4, 7], [0, 2]] as const;
    const line = ([a, b]: readonly [number, number]) => {
      const [x0, y0] = pt(a), [x1, y1] = pt(b);
      return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
    };
    const out: El[] = [E('ln2', cx, cy, rx, ry), P('ln2', dash.map(line).join(''), { 'stroke-dasharray': '1.5 2' }), P('lit', coop.map(line).join(''))];
    for (let i = 0; i < k; i++) {
      const [x, y] = pt(i);
      out.push(C([0, 3, 5, 6].includes(i) ? 'disc his' : 'disc opp', x, y, 4));
    }
    return out;
  },
  tictactoe() {
    const x0 = 50, y0 = 9, s = 22;
    const X = (i: number, j: number) => {
      const x = x0 + i * s + 6, y = y0 + j * s + 6;
      return P('lit', `M${x} ${y}l10 10M${x + 10} ${y}l-10 10`);
    };
    const O = (i: number, j: number) => C('ln', x0 + (i + 0.5) * s, y0 + (j + 0.5) * s, 6);
    return [
      P('ln', `M${x0 + s} ${y0}v${3 * s}M${x0 + 2 * s} ${y0}v${3 * s}M${x0} ${y0 + s}h${3 * s}M${x0} ${y0 + 2 * s}h${3 * s}`),
      X(0, 0), X(1, 1), X(2, 2), O(2, 0), O(0, 2),
      P('win', `M${x0 + 4} ${y0 + 4}L${x0 + 3 * s - 4} ${y0 + 3 * s - 4}`, { 'stroke-dasharray': '2 2.5' }),
    ];
  },
  tiles() {
    // The 15-puzzle nearly solved: the tile he slides next lit, its way into the gap shown.
    const s = 16, x0 = 48, y0 = 10, order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0, 15];
    const out: El[] = [R('ln', x0 - 2, y0 - 2, 4 * s + 4, 4 * s + 4, 3)];
    order.forEach((v, i) => {
      const x = x0 + (i % 4) * s, y = y0 + Math.floor(i / 4) * s;
      if (!v) return void out.push(R('tgt2', x + 1.5, y + 1.5, s - 3, s - 3, 2));
      out.push(R(v === 15 ? 'cur' : 'ln2', x + 1, y + 1, s - 2, s - 2, 2), T(v === 15 ? 'dg his' : 'dg', x + s / 2, y + s / 2 + 2.2, String(v)));
    });
    out.push(P('mv', `M${x0 + 3.5 * s} ${y0 + 3.5 * s}h${-s + 4}`), P('lit', `M${x0 + 2.5 * s + 6} ${y0 + 3.5 * s - 3}l-3 3 3 3`));
    return out;
  },
  countdown() {
    // The numbers round: the target on the board, six tiles, the two he combines first joined and lit.
    const out: El[] = [R('ln', 52, 4, 56, 22, 4), T('dg big his', 80, 20, '952')];
    const nums = ['25', '50', '75', '100', '3', '6'];
    nums.forEach((v, i) => {
      const x = 22 + i * 20;
      out.push(R(i === 3 || i === 5 ? 'cur' : 'ln2', x, 50, 16, 14, 3), T(i === 3 || i === 5 ? 'dg his' : 'dg', x + 8, 59.5, v));
    });
    out.push(P('path', 'M90 50v-8h40v8M110 42v-10', { fill: 'none' }), T('dg', 110, 76, '× 6 = 600'), P('ln2', 'M80 26v6'));
    return out;
  },
  words() {
    // Word guess: three tries, the colours that answered, the last row the word (lit).
    const rows: [string, string][] = [['CRANE', 'o..o.'], ['SLOTH', '.x.xo'], ['GHOST', 'xxxxx']];
    const s = 13, x0 = 80 - 2.5 * s - 4, out: El[] = [];
    rows.forEach(([w, st], j) => {
      const y = 6 + j * (s + 4);
      [...w].forEach((ch, i) => {
        const x = x0 + i * (s + 2), k = st[i];
        out.push(R(k === 'x' ? 'cur' : k === 'o' ? 'fl2 edge' : 'ln2', x, y, s, s, 2), T(k === 'x' ? 'dg his' : 'dg', x + s / 2, y + s / 2 + 2.3, ch));
      });
    });
    for (let i = 0; i < 5; i++) out.push(R('hole', x0 + i * (s + 2), 6 + 3 * (s + 4), s, s - 4, 2));
    return out;
  },
  logic() {
    // A proof: the premises at the top, the steps joining them, the claim at the foot proved (ticked, lit).
    const box = (x: number, y: number, w: number, label: string, lit = false): El[] => [R(lit ? 'cur' : 'ln', x - w / 2, y - 6, w, 12, 3), T(lit ? 'dg his' : 'dg', x, y + 2, label)];
    return [
      ...box(36, 12, 22, 'P'), ...box(80, 12, 30, 'P → Q'), ...box(124, 12, 30, 'Q → R'),
      P('ln2', 'M36 18v8l22 8M80 18v16M124 18v26'), ...box(68, 40, 18, 'Q'),
      P('ln2', 'M68 46v8l12 6M124 50v4l-44 6'),
      ...box(80, 68, 18, 'R', true), P('lit', 'M94 66l3 3 6-7'),
    ];
  },
  brain() {
    // A tiny network: three layers wired, the strongest weights lit; beside it the two spirals it learns to tell apart.
    const L = [[24, 42], [16, 32, 52, 68], [42]].map((ys, k) => ys.map((y) => [26 + k * 34, y] as const));
    let wire = '', strong = '';
    L[0]!.forEach(([x0, y0], i) => L[1]!.forEach(([x1, y1], j) => ((i + j) % 2 ? (wire += `M${x0} ${y0}L${x1} ${y1}`) : (strong += `M${x0} ${y0}L${x1} ${y1}`))));
    L[1]!.forEach(([x0, y0], j) => (j === 1 || j === 2 ? (strong += `M${x0} ${y0}L${L[2]![0]![0]} ${L[2]![0]![1]}`) : (wire += `M${x0} ${y0}L${L[2]![0]![0]} ${L[2]![0]![1]}`)));
    const out: El[] = [P('ln2', wire), P('lit', strong)];
    for (const [x, y] of [...L[0]!, ...L[1]!]) out.push(C('disc opp', x, y, 3.6));
    out.push(C('disc his', L[2]![0]![0], L[2]![0]![1], 4.2));
    const sp = (arm: number, cls: string) => {
      for (let i = 2; i < 13; i++) {
        const t = i * 0.5 + arm * Math.PI;
        out.push(C(cls, 124 + Math.cos(t) * i * 1.6, 42 + Math.sin(t) * i * 1.6, 1.3));
      }
    };
    sp(0, 'fl');
    sp(1, 'ln');
    out.push(P('ln2', 'M100 42h6'));
    return out;
  },
  bughunt() {
    // A short program: the line numbers, the code, the one slip found (highlighted, the lens over it).
    const out: El[] = [R('ln', 30, 4, 100, 76, 5), P('ln2', 'M44 4v76')];
    const widths = [40, 56, 30, 48, 62, 36, 44];
    widths.forEach((w, i) => {
      const y = 13 + i * 10;
      out.push(T('dg', 37, y + 2, String(i + 1)));
      if (i === 4) out.push(R('hl', 45, y - 4.5, 84, 9));
      out.push(P(i === 4 ? 'lit' : 'ln2', `M${50 + (i % 3 === 1 ? 6 : 0)} ${y}h${w}`));
    });
    out.push(C('ln', 112, 53, 9), P('ln', 'M118.5 59.5l7 7'), P('lit', 'M106 53h12'));
    return out;
  },
  escape() {
    // The room: the back wall, the floor, the locked door with its keypad, the key he found (gold).
    return [
      P('ln', 'M40 10H120V64H40Z'), P('ln2', 'M40 64L16 82M120 64l24 18M40 10L16 2M120 10l24-8'),
      P('ln2', 'M58 64v-36h22v36'), C('fl', 76, 47, 1.4), R('ln', 92, 30, 14, 18, 2),
      P('ln2', 'M95 35h8M95 39h8M95 43h8'), R('cur', 94.5, 33.5, 4, 3), P('mv', 'M44 76q22-10 32-26'),
      C('gold', 40, 76, 2.6), P('gold', 'M42.6 76h7m-2.5 0v2.5'),
    ];
  },
  factcheck() {
    // A claim on its card, the facts it rests on, and the three answers: true, false, can't tell — one lit.
    return [
      R('ln', 34, 6, 92, 44, 5), P('ln2', 'M42 18h60M42 26h72M42 34h48'), C('fl', 108, 18, 1.6),
      P('ln2', 'M50 50v8M80 50v8M110 50v8'),
      C('cur', 50, 68, 8), P('lit', 'M46 68l3 3 5-6'),
      C('ln', 80, 68, 8), P('ln', 'M77 65l6 6M83 65l-6 6'),
      C('ln', 110, 68, 8), T('dg', 110, 70.5, '?'),
    ];
  },
  debate() {
    // The arena: two speakers, the facts each cites, and the judge's scales tipped to the true side.
    return [
      P('ln', 'M80 14v52M66 66h28'), P('lit', 'M52 24L108 34'), C('fl', 80, 29, 2),
      P('ln2', 'M52 24l-8 18h16zM108 34l-8 18h16z'), P('ln', 'M44 42q8 6 16 0'), P('lit', 'M100 52q8 6 16 0'),
      R('ln2', 12, 30, 22, 14, 4), P('ln2', 'M20 44l-3 5 7-5'), R('cur', 126, 18, 22, 14, 4), P('lit', 'M138 32l3 5-7-5'),
      P('ln2', 'M16 36h14M16 39h9'), P('lit', 'M130 24h14M130 27h9'),
    ];
  },
  checkers() {
    const Pp = persp(12, 80, 96, 150), N = 8;
    const at = (i: number, j: number) => Pp((i + 0.5) / N, (j + 0.55) / N);
    const man = (i: number, j: number, cls: string, king = false): El[] => {
      const [x, y] = at(i, j), s = 0.6 + (j / N) * 0.6;
      const out = [E(cls, x, y, 5 * s, 2.6 * s)];
      if (king) out.push(E(cls, x, y - 2.4 * s, 5 * s, 2.6 * s));
      return out;
    };
    const [ax, ay] = at(2, 5), [bx, by] = at(4, 3);
    return [
      ...board(Pp, N),
      ...man(1, 0, 'stone opp'), ...man(5, 0, 'stone opp'), ...man(3, 2, 'stone opp'), ...man(6, 1, 'stone opp'),
      ...man(2, 5, 'stone his'), ...man(5, 6, 'stone his'), ...man(0, 7, 'stone his'), ...man(6, 5, 'stone his', true),
      P('mv', `M${f(ax)} ${f(ay - 4)}Q${f((ax + bx) / 2)} ${f(Math.min(ay, by) - 18)} ${f(bx)} ${f(by - 3)}`), C('tgt', bx, by, 3.4),
    ];
  },
  poker() {
    // His hand fanned, the card on the board, the chips he bets with (the pot lit).
    const card = (x: number, y: number, rot: number, label: string, cls: string): El => {
      const g = svgEl('g', { transform: `rotate(${rot} ${x} ${y})` });
      g.append(R(cls, x - 11, y - 16, 22, 32, 3), T(cls === 'cur' ? 'dg his' : 'dg', x - 6, y - 8, label), T(cls === 'cur' ? 'dg his' : 'dg', x, y + 4, label === 'K' ? '♠' : label === 'Q' ? '♥' : '♦'));
      return g;
    };
    return [
      card(44, 44, -14, 'Q', 'ln'), card(62, 40, 0, 'K', 'cur'), card(110, 40, 0, 'J', 'ln2'),
      E('ln', 128, 72, 10, 3.4), E('ln', 128, 68, 10, 3.4), E('lit', 128, 64, 10, 3.4),
      E('ln2', 92, 74, 8, 2.8), E('ln2', 92, 70, 8, 2.8), P('ln2', 'M20 74H72'),
    ];
  },
  balance() {
    // The cart and its pole, held upright: the track, the wheels, the push he gives, the angle he keeps small.
    return [
      P('ln2', 'M10 70H150'), P('ln2', 'M20 66v8M140 66v8'),
      R('ln', 62, 54, 36, 12, 3), C('ln', 70, 68, 3), C('ln', 90, 68, 3),
      P('lit', 'M80 54L86 12'), C('fl', 86, 12, 2.6),
      P('ln2', 'M80 30a24 24 0 016 -0.8', { 'stroke-dasharray': '1.5 1.5' }), P('ln2', 'M80 54V10', { 'stroke-dasharray': '1.5 2.5' }),
      P('mv', 'M104 60h16'), P('lit', 'M116 57l4 3-4 3'),
    ];
  },
};

/** The game's picture (a quiet frame when a game has none drawn yet). */
export function gameArt(id: string): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 160 84', class: 'inst gymart', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true', focusable: 'false' });
  for (const e of (ART[id] ?? (() => [R('ln2', 40, 8, 80, 68, 6)]))()) svg.append(e);
  return svg;
}

/** The games that have a picture (all 22, tested). */
export const ART_IDS = Object.keys(ART);
