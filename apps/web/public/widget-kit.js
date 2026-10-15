/*
 * GK — Ghosty's widget kit. A small, dependable toolkit for games and mini-apps that run as
 * instant widgets. Include it with <script src="/widget-kit.js"></script> (Ghosty adds it by
 * itself when a widget uses GK). Everything is plain JavaScript; no build step.
 *
 * Games:  GK.canvas, GK.loop, GK.scenes, input (GK.key / GK.pressed / GK.pointer / GK.controls),
 *         drawing (GK.clear/rect/circle/line/text/glow), GK.sound, GK.particles, collisions,
 *         GK.grid, GK.cooldown, GK.save/load/highscore, maths helpers.
 * Apps:   GK.el, GK.app, GK.button, GK.input, GK.css, GK.theme.
 * The full reference with examples is Ghosty's "game-kit" playbook.
 */
(function () {
  'use strict';
  var GK = {};
  var theme = { bg: '#02070d', panel: '#071824', fg: '#e6f6ff', accent: '#5ce1ff', good: '#52f2b5', warn: '#ffd24d', bad: '#ff4d6a', dim: '#6b8a99', font: 'system-ui, -apple-system, Segoe UI, sans-serif' };
  GK.theme = theme;

  // ---------- maths ----------
  GK.rand = function (a, b) { if (b === undefined) { b = a === undefined ? 1 : a; a = 0; } return a + Math.random() * (b - a); };
  GK.randInt = function (a, b) { return Math.floor(GK.rand(a, b + 1)); };
  GK.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  GK.shuffle = function (arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  GK.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  GK.lerp = function (a, b, t) { return a + (b - a) * t; };
  GK.dist = function (x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); };
  GK.angle = function (x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); };
  /** Rectangles {x, y, w, h} (x, y = top-left) overlap? */
  GK.hit = function (a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; };
  /** Circles {x, y, r} (x, y = centre) overlap? */
  GK.hitCircle = function (a, b) { var r = a.r + b.r; var dx = a.x - b.x; var dy = a.y - b.y; return dx * dx + dy * dy < r * r; };
  /** Circle {x, y, r} overlaps rectangle {x, y, w, h}? */
  GK.hitCircleRect = function (c, r) { var nx = GK.clamp(c.x, r.x, r.x + r.w); var ny = GK.clamp(c.y, r.y, r.y + r.h); var dx = c.x - nx; var dy = c.y - ny; return dx * dx + dy * dy < c.r * c.r; };
  GK.inside = function (px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; };

  // ---------- canvas ----------
  var view = { canvas: null, ctx: null, width: 0, height: 0, scale: 1 };
  /**
   * Make the game canvas. width/height are the game's own units (default 480 × 640); the
   * canvas is scaled to fit the widget, sharp on every screen. Returns { canvas, ctx, width, height }.
   */
  GK.canvas = function (opts) {
    opts = opts || {};
    var w = opts.width || 480;
    var h = opts.height || 640;
    var c = document.createElement('canvas');
    c.style.cssText = 'display:block;margin:0 auto;touch-action:none;background:' + (opts.bg || theme.bg) + (opts.pixel ? ';image-rendering:pixelated' : '');
    document.documentElement.style.cssText += ';height:100%';
    document.body.style.cssText += ';height:100%;margin:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:' + theme.bg;
    (opts.parent || document.body).appendChild(c);
    var ctx = c.getContext('2d');
    view.canvas = c; view.ctx = ctx; view.width = w; view.height = h;
    function fit() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var s = Math.min(window.innerWidth / w, window.innerHeight / h);
      if (!isFinite(s) || s <= 0) s = 1;
      view.scale = s;
      c.style.width = Math.floor(w * s) + 'px';
      c.style.height = Math.floor(h * s) + 'px';
      c.width = Math.floor(w * s * dpr);
      c.height = Math.floor(h * s * dpr);
      ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
      ctx.imageSmoothingEnabled = !opts.pixel;
    }
    fit();
    window.addEventListener('resize', fit);
    bindPointer(c);
    return { canvas: c, ctx: ctx, width: w, height: h };
  };

  // ---------- input ----------
  var down = {};
  var hit = {};
  var ALIAS = {
    left: ['ArrowLeft', 'KeyA', 'pad:left'],
    right: ['ArrowRight', 'KeyD', 'pad:right'],
    up: ['ArrowUp', 'KeyW', 'pad:up'],
    down: ['ArrowDown', 'KeyS', 'pad:down'],
    action: ['Space', 'Enter', 'KeyZ', 'pad:A'],
    A: ['KeyZ', 'Space', 'pad:A'],
    B: ['KeyX', 'ShiftLeft', 'pad:B'],
    pause: ['KeyP', 'Escape', 'pad:pause'],
  };
  function codes(name) { return ALIAS[name] || [name]; }
  /** Is a key held? Use codes ('ArrowLeft', 'KeyA', 'Space') or aliases: left right up down action A B pause. */
  GK.key = function (name) { var c = codes(name); for (var i = 0; i < c.length; i++) if (down[c[i]]) return true; return false; };
  /** Was a key pressed this frame (true once per press)? Same names as GK.key. */
  GK.pressed = function (name) { var c = codes(name); for (var i = 0; i < c.length; i++) if (hit[c[i]]) return true; return false; };
  window.addEventListener('keydown', function (e) {
    if (!down[e.code]) hit[e.code] = true;
    down[e.code] = true;
    if (/^(Arrow|Space)/.test(e.code)) e.preventDefault();
    unlockAudio();
  });
  window.addEventListener('keyup', function (e) { down[e.code] = false; });
  window.addEventListener('blur', function () { down = {}; });

  /** Pointer (mouse or touch) in game units: x, y, down, and pressed / released (true for one frame). */
  var pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  GK.pointer = pointer;
  function bindPointer(c) {
    function pos(e) {
      var r = c.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * view.width;
      pointer.y = ((e.clientY - r.top) / r.height) * view.height;
    }
    c.addEventListener('pointerdown', function (e) { pos(e); pointer.down = true; pointer.pressed = true; unlockAudio(); try { c.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } });
    c.addEventListener('pointermove', pos);
    c.addEventListener('pointerup', function (e) { pos(e); pointer.down = false; pointer.released = true; });
    c.addEventListener('pointercancel', function () { pointer.down = false; });
  }

  var swipeFns = [];
  /** Swipe gestures anywhere: fn('left' | 'right' | 'up' | 'down'). */
  GK.onSwipe = function (fn) {
    if (!swipeFns.length) {
      var sx = 0, sy = 0, t = 0;
      window.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; t = Date.now(); });
      window.addEventListener('pointerup', function (e) {
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (Date.now() - t > 600 || Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
        var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        for (var i = 0; i < swipeFns.length; i++) swipeFns[i](dir);
      });
    }
    swipeFns.push(fn);
  };

  /**
   * On-screen touch controls (shown on touch screens; force with {always: true}).
   * {dpad: true, buttons: ['A', 'B']} → feeds left/right/up/down/A/B, readable with GK.key / GK.pressed.
   */
  GK.controls = function (opts) {
    opts = opts || {};
    var touch = opts.always || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!touch) return;
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:150px;pointer-events:none;z-index:10';
    function btn(label, code, css) {
      var b = document.createElement('div');
      b.textContent = label;
      b.style.cssText = 'position:absolute;width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:bold 18px ' + theme.font + ';color:' + theme.fg + ';background:rgba(92,225,255,.14);border:1px solid rgba(92,225,255,.5);pointer-events:auto;user-select:none;touch-action:none;' + css;
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); if (!down[code]) hit[code] = true; down[code] = true; b.style.background = 'rgba(92,225,255,.4)'; unlockAudio(); });
      var up = function () { down[code] = false; b.style.background = 'rgba(92,225,255,.14)'; };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
      box.appendChild(b);
    }
    if (opts.dpad !== false) {
      btn('◀', 'pad:left', 'left:12px;bottom:46px');
      btn('▶', 'pad:right', 'left:112px;bottom:46px');
      btn('▲', 'pad:up', 'left:62px;bottom:92px');
      btn('▼', 'pad:down', 'left:62px;bottom:4px');
    }
    var bs = opts.buttons || ['A'];
    for (var i = 0; i < bs.length; i++) btn(bs[i], 'pad:' + bs[i], 'right:' + (12 + i * 70) + 'px;bottom:' + (i % 2 ? 70 : 30) + 'px');
    document.body.appendChild(box);
  };

  // ---------- loop ----------
  /**
   * Run the game: update(dt) then draw(ctx) every frame; dt in seconds (capped at 0.05).
   * Pauses itself while the widget is hidden. Returns { stop, pause, resume, paused }.
   */
  GK.loop = function (update, draw) {
    var last = 0, raf = 0, ctl = { paused: false, stopped: false };
    function frame(t) {
      raf = requestAnimationFrame(frame);
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
      last = t;
      if (!ctl.paused && !document.hidden) {
        timers(dt);
        if (update) update(dt);
        if (draw) draw(view.ctx);
      }
      hit = {};
      pointer.pressed = false;
      pointer.released = false;
    }
    raf = requestAnimationFrame(frame);
    ctl.stop = function () { cancelAnimationFrame(raf); ctl.stopped = true; };
    ctl.pause = function () { ctl.paused = true; };
    ctl.resume = function () { ctl.paused = false; last = 0; };
    return ctl;
  };

  var pending = [];
  function timers(dt) {
    for (var i = pending.length - 1; i >= 0; i--) {
      var t = pending[i];
      t.left -= dt;
      if (t.left <= 0) {
        if (t.every) t.left += t.every; else pending.splice(i, 1);
        t.fn();
      }
    }
  }
  /** Run fn once after `sec` seconds of game time (paused with the game). Returns a cancel function. */
  GK.after = function (sec, fn) { var t = { left: sec, fn: fn }; pending.push(t); return function () { var i = pending.indexOf(t); if (i >= 0) pending.splice(i, 1); }; };
  /** Run fn every `sec` seconds of game time. Returns a cancel function. */
  GK.every = function (sec, fn) { var t = { left: sec, every: sec, fn: fn }; pending.push(t); return function () { var i = pending.indexOf(t); if (i >= 0) pending.splice(i, 1); }; };
  /** A cooldown: if (shot.ready()) { shot.use(); fire(); } */
  GK.cooldown = function (sec) { var at = 0; return { ready: function () { return performance.now() >= at; }, use: function () { at = performance.now() + sec * 1000; } }; };

  // ---------- scenes ----------
  /**
   * Screens such as title / play / over. Each scene: { enter(data), update(dt), draw(ctx), leave() }.
   * const sc = GK.scenes({ title: {...}, play: {...} }, 'title'); GK.loop(sc.update, sc.draw); sc.go('play')
   */
  GK.scenes = function (map, first) {
    var cur = null, name = '';
    var sc = {
      go: function (n, data) {
        if (!map[n]) throw new Error('no scene called ' + n);
        if (cur && cur.leave) cur.leave();
        cur = map[n]; name = n;
        if (cur.enter) cur.enter(data);
      },
      update: function (dt) { if (cur && cur.update) cur.update(dt); },
      draw: function (ctx) { if (cur && cur.draw) cur.draw(ctx); },
      get name() { return name; },
    };
    if (first) sc.go(first);
    return sc;
  };

  // ---------- drawing ----------
  GK.clear = function (ctx, color) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = color || theme.bg; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); };
  GK.rect = function (ctx, x, y, w, h, color) { ctx.fillStyle = color || theme.accent; ctx.fillRect(x, y, w, h); };
  GK.strokeRect = function (ctx, x, y, w, h, color, width) { ctx.strokeStyle = color || theme.accent; ctx.lineWidth = width || 2; ctx.strokeRect(x, y, w, h); };
  GK.circle = function (ctx, x, y, r, color) { ctx.fillStyle = color || theme.accent; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); };
  GK.ring = function (ctx, x, y, r, color, width) { ctx.strokeStyle = color || theme.accent; ctx.lineWidth = width || 2; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.stroke(); };
  GK.line = function (ctx, x1, y1, x2, y2, color, width) { ctx.strokeStyle = color || theme.accent; ctx.lineWidth = width || 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  GK.poly = function (ctx, points, color, fill) { if (points.length < 2) return; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]); ctx.closePath(); if (fill === false) { ctx.strokeStyle = color || theme.accent; ctx.stroke(); } else { ctx.fillStyle = color || theme.accent; ctx.fill(); } };
  /** Text: opts { size: 20, color, align: 'left' | 'center' | 'right', baseline: 'top' | 'middle' | 'alphabetic', bold } */
  GK.text = function (ctx, str, x, y, opts) {
    opts = opts || {};
    ctx.fillStyle = opts.color || theme.fg;
    ctx.font = (opts.bold ? 'bold ' : '') + (opts.size || 20) + 'px ' + (opts.font || theme.font);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'top';
    ctx.fillText(String(str), x, y);
  };
  /** Neon glow for whatever is drawn next; GK.glow(ctx) with no colour turns it off. */
  GK.glow = function (ctx, color, blur) { ctx.shadowColor = color || 'transparent'; ctx.shadowBlur = color ? (blur || 12) : 0; };

  // ---------- particles ----------
  /** const fx = GK.particles(); fx.burst(x, y, { n: 20, color, speed: 160, life: 0.6, size: 3 }); fx.update(dt); fx.draw(ctx) */
  GK.particles = function () {
    var list = [];
    return {
      burst: function (x, y, o) {
        o = o || {};
        var n = o.n || 16;
        for (var i = 0; i < n; i++) {
          var a = Math.random() * Math.PI * 2, s = (o.speed || 150) * (0.3 + Math.random() * 0.7);
          list.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: o.life || 0.6, max: o.life || 0.6, size: o.size || 3, color: o.color || theme.accent, g: o.gravity || 0 });
        }
      },
      update: function (dt) {
        for (var i = list.length - 1; i >= 0; i--) {
          var p = list[i];
          p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.life <= 0) list.splice(i, 1);
        }
      },
      draw: function (ctx) {
        for (var i = 0; i < list.length; i++) { var p = list[i]; ctx.globalAlpha = Math.max(0, p.life / p.max); GK.circle(ctx, p.x, p.y, p.size, p.color); }
        ctx.globalAlpha = 1;
      },
      get count() { return list.length; },
      clear: function () { list.length = 0; },
    };
  };

  // ---------- grid (puzzles, board games, tile maps) ----------
  /** GK.grid(cols, rows, fill) → { cols, rows, get(x, y), set(x, y, v), inside(x, y), each(fn(v, x, y)), clone() } */
  GK.grid = function (cols, rows, fill) {
    var cells = [];
    for (var i = 0; i < cols * rows; i++) cells.push(typeof fill === 'function' ? fill(i % cols, Math.floor(i / cols)) : fill === undefined ? null : fill);
    var g = {
      cols: cols, rows: rows, cells: cells,
      inside: function (x, y) { return x >= 0 && y >= 0 && x < cols && y < rows; },
      get: function (x, y) { return g.inside(x, y) ? cells[y * cols + x] : undefined; },
      set: function (x, y, v) { if (g.inside(x, y)) cells[y * cols + x] = v; },
      each: function (fn) { for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) fn(cells[y * cols + x], x, y); },
      clone: function () { var c = GK.grid(cols, rows); for (var i = 0; i < cells.length; i++) c.cells[i] = cells[i]; return c; },
    };
    return g;
  };

  // ---------- sound (Web Audio; starts after the first tap or key) ----------
  var ac = null;
  function unlockAudio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume().catch(function () {});
  }
  var muted = false;
  function tone(f1, f2, dur, type, vol) {
    if (!ac || muted) return;
    try {
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || 'square';
      o.frequency.setValueAtTime(f1, t);
      if (f2 && f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
      g.gain.setValueAtTime(vol || 0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }
  function noise(dur, vol) {
    if (!ac || muted) return;
    try {
      var n = Math.floor(ac.sampleRate * dur), b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = ac.createBufferSource(), g = ac.createGain();
      g.gain.value = vol || 0.2;
      s.buffer = b; s.connect(g); g.connect(ac.destination); s.start();
    } catch (e) { /* audio is optional */ }
  }
  GK.sound = {
    beep: function (freq, dur, type, vol) { tone(freq || 440, 0, dur || 0.1, type, vol); },
    sweep: function (from, to, dur, type, vol) { tone(from, to, dur || 0.2, type, vol); },
    noise: function (dur, vol) { noise(dur || 0.2, vol); },
    jump: function () { tone(300, 700, 0.15, 'square', 0.12); },
    coin: function () { tone(880, 0, 0.06, 'square', 0.12); setTimeout(function () { tone(1320, 0, 0.12, 'square', 0.12); }, 60); },
    shoot: function () { tone(900, 200, 0.12, 'sawtooth', 0.08); },
    hit: function () { tone(220, 80, 0.15, 'square', 0.15); noise(0.08, 0.1); },
    explode: function () { noise(0.45, 0.3); tone(120, 40, 0.4, 'sawtooth', 0.1); },
    win: function () { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0, 0.14, 'triangle', 0.15); }, i * 110); }); },
    lose: function () { [392, 330, 262].forEach(function (f, i) { setTimeout(function () { tone(f, 0, 0.22, 'triangle', 0.15); }, i * 180); }); },
    mute: function (m) { muted = m === undefined ? !muted : !!m; return muted; },
    unlock: unlockAudio,
  };
  window.addEventListener('pointerdown', unlockAudio);

  // ---------- saving ----------
  GK.save = function (key, value) { try { localStorage.setItem('gk:' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ } };
  GK.load = function (key, fallback) { try { var v = localStorage.getItem('gk:' + key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } };
  /** Record a score; returns the best so far. */
  GK.highscore = function (name, score) { var best = GK.load('hi:' + name, 0); if (typeof score === 'number' && score > best) { best = score; GK.save('hi:' + name, best); } return best; };

  // ---------- app UI ----------
  /** Element builder: GK.el('div.card#main', { onclick: fn, style: '...' }, 'text', child). Text is always safe. */
  GK.el = function (spec, props) {
    var m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    var el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, function (_, k, v) { if (k === '.') el.classList.add(v); else el.id = v; return ''; });
    var kids = Array.prototype.slice.call(arguments, 2);
    if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'style') el[k] = v;
      else el.setAttribute(k, String(v));
    });
    (function add(list) {
      list.forEach(function (k) {
        if (k == null || k === false) return;
        if (Array.isArray(k)) add(k); else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
      });
    })(kids);
    return el;
  };
  GK.css = function (text) { var s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); return s; };
  var styled = false;
  function baseCss() {
    if (styled) return;
    styled = true;
    GK.css(
      '.gk-app{max-width:720px;margin:0 auto;padding:16px;box-sizing:border-box;font-family:' + theme.font + ';color:' + theme.fg + '}' +
      '.gk-app h1{font-size:15px;letter-spacing:.25em;text-transform:uppercase;color:' + theme.accent + ';margin:0 0 14px}' +
      '.gk-card{background:' + theme.panel + ';border:1px solid rgba(92,225,255,.25);border-radius:8px;padding:12px;margin:0 0 10px}' +
      '.gk-btn{font:600 13px ' + theme.font + ';letter-spacing:.08em;color:' + theme.bg + ';background:' + theme.accent + ';border:0;border-radius:6px;padding:9px 14px;cursor:pointer;margin:2px}' +
      '.gk-btn.ghost{background:transparent;color:' + theme.accent + ';border:1px solid ' + theme.accent + '}' +
      '.gk-btn.bad{background:' + theme.bad + '}' +
      '.gk-btn:active{transform:translateY(1px)}' +
      '.gk-in{font:14px ' + theme.font + ';color:' + theme.fg + ';background:#031019;border:1px solid rgba(92,225,255,.35);border-radius:6px;padding:9px 10px;box-sizing:border-box;width:100%}' +
      '.gk-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
      '.gk-dim{color:' + theme.dim + ';font-size:12px}' +
      '.gk-big{font-size:40px;font-weight:200;letter-spacing:.05em}'
    );
  }
  /** A styled app page with a title; returns the element to put content in. */
  GK.app = function (title) {
    baseCss();
    var body = GK.el('div.gk-app', title ? GK.el('h1', title) : null);
    document.body.appendChild(body);
    return body;
  };
  GK.card = function () { baseCss(); return GK.el.apply(null, ['div.gk-card', null].concat(Array.prototype.slice.call(arguments))); };
  GK.button = function (label, onClick, kind) { baseCss(); return GK.el('button.gk-btn' + (kind ? '.' + kind : ''), { type: 'button', onclick: onClick }, label); };
  GK.input = function (placeholder, opts) { baseCss(); opts = opts || {}; return GK.el('input.gk-in', { placeholder: placeholder || '', type: opts.type || 'text', value: opts.value == null ? '' : opts.value }); };

  window.GK = GK;
})();
