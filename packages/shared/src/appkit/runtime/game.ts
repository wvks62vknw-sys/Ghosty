/**
 * The game: Merge (the sliding-tiles number game). Swipe or use the arrow keys; equal tiles join and
 * score; one UNDO a move; the best score is kept on the phone. LOGIC is pure (random numbers passed in).
 */
export const LOGIC = String.raw`var L = {
  empty: function () { var g = []; for (var i = 0; i < 16; i++) g.push(0); return g; },
  /** One row slid towards its start: equal neighbours join once. */
  slide: function (row) {
    var vals = row.filter(function (x) { return x; }), out = [], score = 0;
    for (var i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) { out.push(vals[i] * 2); score += vals[i] * 2; i++; }
      else out.push(vals[i]);
    }
    while (out.length < 4) out.push(0);
    return { row: out, score: score, moved: out.some(function (v, j) { return v !== row[j]; }) };
  },
  move: function (g, dir) {
    var out = g.slice(), score = 0, moved = false;
    for (var k = 0; k < 4; k++) {
      var idx = [];
      for (var j = 0; j < 4; j++) idx.push(dir === 'left' ? k * 4 + j : dir === 'right' ? k * 4 + 3 - j : dir === 'up' ? j * 4 + k : (3 - j) * 4 + k);
      var r = L.slide(idx.map(function (i) { return g[i]; }));
      idx.forEach(function (i, j) { out[i] = r.row[j]; });
      score += r.score;
      if (r.moved) moved = true;
    }
    return { grid: out, score: score, moved: moved };
  },
  spawn: function (g, rnd) {
    var free = [];
    g.forEach(function (v, i) { if (!v) free.push(i); });
    if (!free.length) return -1;
    var at = free[Math.floor(rnd() * free.length)];
    g[at] = rnd() < 0.9 ? 2 : 4;
    return at;
  },
  canMove: function (g) {
    for (var i = 0; i < 16; i++) {
      if (!g[i]) return true;
      if (i % 4 < 3 && g[i] === g[i + 1]) return true;
      if (i < 12 && g[i] === g[i + 4]) return true;
    }
    return false;
  },
  fresh: function (rnd) { var g = L.empty(); L.spawn(g, rnd); L.spawn(g, rnd); return g; },
  /** A whole turn: slide, then a new tile; nothing happens when nothing can slide that way. */
  turn: function (st, dir, rnd) {
    if (st.over) return false;
    var m = L.move(st.grid, dir);
    if (!m.moved) return false;
    st.prev = { grid: st.grid, score: st.score };
    st.grid = m.grid;
    st.score += m.score;
    st.best = Math.max(st.best, st.score);
    st.last = L.spawn(st.grid, rnd);
    if (!st.won && st.grid.indexOf(2048) >= 0) st.won = true;
    st.over = !L.canMove(st.grid);
    return true;
  },
  undo: function (st) { if (!st.prev) return false; st.grid = st.prev.grid; st.score = st.prev.score; st.prev = null; st.over = false; st.last = -1; return true; }
};
`;

export const VIEW = String.raw`var touch = null;
function play(dir) {
  var wasWon = A.state.won;
  var ok = A.act('', function (st) { return L.turn(st, dir, Math.random); });
  if (ok === false) return;
  if (A.state.won && !wasWon) A.toast('2048! Keep going if you like');
  else if (A.state.over) A.toast('No moves left — UNDO or NEW GAME');
}
var SHAPE = {
  init: function () { return { grid: L.fresh(Math.random), score: 0, best: 0, prev: null, over: false, won: false, last: -1 }; },
  fix: function (s) { return s && Array.isArray(s.grid) && s.grid.length === 16 ? s : null; },
  start: function () {
    document.addEventListener('keydown', function (e) {
      var k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
      if (!k || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) return;
      e.preventDefault();
      play(k);
    });
  },
  view: function (A) {
    var s = A.state, h = A.h;
    var board = h('div.board', { role: 'grid', 'aria-label': 'Board. Swipe or use the arrow keys.' }, s.grid.map(function (v, i) {
      return h('div.cell', null, v ? h('span.tile.t' + Math.min(v, 4096) + (i === s.last ? '.pop' : ''), { text: String(v) }) : null);
    }));
    board.addEventListener('pointerdown', function (e) { touch = { x: e.clientX, y: e.clientY }; });
    board.addEventListener('pointerup', function (e) {
      if (!touch) return;
      var dx = e.clientX - touch.x, dy = e.clientY - touch.y;
      touch = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    var chips = h('div.row.scores', null,
      h('div.chipbox', null, h('span.kick', { text: 'Score' }), h('b.num', { text: A.fmt(s.score, 0) })),
      h('div.chipbox', null, h('span.kick', { text: 'Best' }), h('b.num', { text: A.fmt(s.best, 0) })));
    var pad = h('div.dpad', { 'aria-label': 'Arrows' }, [['up', 'up'], ['left', 'left'], ['down', 'down'], ['right', 'right']].map(function (d) {
      return h('button.gbtn.d' + d[0], { type: 'button', 'aria-label': 'Slide ' + d[0], onclick: function () { play(d[0]); } }, A.icon(d[1] === 'left' || d[1] === 'right' ? 'up' : d[1]));
    }));
    var ctrls = h('div.row.ctrls', null,
      A.btn('UNDO', function () { A.act('', function (st) { return L.undo(st); }); }, 'ghost', { disabled: !s.prev }),
      A.btn('NEW GAME', function () { A.act('New game', function (st) { var b = st.best; Object.assign(st, SHAPE.init()); st.best = b; }, true); }, s.over ? '' : 'ghost'));
    return [chips, h('div.boardwrap' + (s.over ? '.over' : ''), null, board, s.over ? h('p.overlay', { text: 'No moves left' }) : null), ctrls, pad, h('p.note', { text: 'Slide the tiles: two the same join into one. Reach 2048 if you can.' })];
  }
};
`;
