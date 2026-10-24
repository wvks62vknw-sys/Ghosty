/**
 * The timer or routine: steps with durations (work and rest, focus and break, a recipe's stages), in
 * rounds; START, PAUSE, RESUME, SKIP, RESET (with UNDO), a bell and a buzz at each change while the app
 * is open, and the screen kept awake while it runs. Time is kept as "ends at" moments, so a reload, a
 * locked phone or a lost second never drifts it: on return it catches up step by step. LOGIC is pure.
 */
export const LOGIC = String.raw`var L = {
  total: function (steps) { return steps.reduce(function (s, x) { return s + x.secs; }, 0); },
  start: function (st, now) {
    if (!st.steps.length) return false;
    st.run = { i: 0, round: 1, endsAt: now + st.steps[0].secs * 1000, left: null };
    return true;
  },
  pause: function (st, now) {
    var r = st.run;
    if (!r || r.left !== null) return false;
    r.left = Math.max(0, r.endsAt - now);
    r.endsAt = null;
    return true;
  },
  resume: function (st, now) {
    var r = st.run;
    if (!r || r.left === null) return false;
    r.endsAt = now + r.left;
    r.left = null;
    return true;
  },
  /** On to the next step, timed from the moment the last one ended; 'finished' after the last round. */
  next: function (st, from) {
    var r = st.run;
    r.i++;
    if (r.i >= st.steps.length) { r.i = 0; r.round++; }
    if (r.round > st.rounds) { st.run = null; st.done = (st.done || 0) + 1; return 'finished'; }
    r.endsAt = from + st.steps[r.i].secs * 1000;
    return 'step';
  },
  /** Catch up with the clock: every step whose time is over moves on (several, after a long time away). */
  tick: function (st, now) {
    var out = { steps: 0, finished: false }, guard = 0;
    while (st.run && st.run.left === null && st.run.endsAt <= now && guard++ < 100000) {
      if (L.next(st, st.run.endsAt) === 'finished') out.finished = true;
      else out.steps++;
    }
    return out;
  },
  skip: function (st, now) {
    if (!st.run) return false;
    var paused = st.run.left !== null;
    var res = L.next(st, now);
    if (paused && st.run) { st.run.left = st.steps[st.run.i].secs * 1000; st.run.endsAt = null; }
    return res;
  },
  remaining: function (st, now) {
    var r = st.run;
    if (!r) return st.steps.length ? st.steps[0].secs * 1000 : 0;
    return r.left !== null ? r.left : Math.max(0, r.endsAt - now);
  },
  fmt: function (ms) {
    var s = Math.ceil(Math.max(0, ms) / 1000), hh = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (hh ? hh + ':' + (m < 10 ? '0' : '') + m : String(m)) + ':' + (x < 10 ? '0' : '') + x;
  },
  /** Steps typed as "Plank 60" or "Warm up 5m" (one a line) back into steps. */
  parse: function (text) {
    return String(text || '').split(/\n|,/).map(function (line) {
      var m = line.trim().match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?$/i);
      if (!m) return null;
      var n = parseFloat(m[2]), u = (m[3] || 's').toLowerCase();
      var secs = Math.round(u.charAt(0) === 'm' ? n * 60 : n);
      var name = m[1].replace(/[:\-–]+$/, '').trim().slice(0, 40) || 'Step';
      return secs > 0 && secs <= 86400 ? { name: name, secs: secs } : null;
    }).filter(Boolean).slice(0, 20);
  }
};
`;

export const VIEW = String.raw`var refs = {}, actx = null, lock = null;
function unlock() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { actx = null; }
}
function bell(times) {
  try {
    if (actx) {
      var t0 = actx.currentTime;
      for (var i = 0; i < times; i++) {
        var o = actx.createOscillator(), g = actx.createGain(), t = t0 + i * 0.32;
        o.type = 'sine';
        o.frequency.value = i % 2 ? 1046.5 : 880;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g);
        g.connect(actx.destination);
        o.start(t);
        o.stop(t + 0.3);
      }
    }
  } catch (e) { /* no sound here */ }
  if (navigator.vibrate) navigator.vibrate(times > 1 ? [200, 100, 200] : 200);
}
function awake(on) {
  try {
    if (on && !lock && navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }, function () { /* fine without */ });
    if (!on && lock) { lock.release(); lock = null; }
  } catch (e) { lock = null; }
}
var SHAPE = {
  fast: true,
  init: function (cfg) { return { steps: cfg.timer.steps.slice(), rounds: cfg.timer.rounds, run: null, done: 0 }; },
  fix: function (s) { return s && Array.isArray(s.steps) && s.steps.length ? s : null; },
  start: function () { document.addEventListener('visibilitychange', function () { if (!document.hidden && A.state.run && A.state.run.left === null) awake(true); }); },
  tick: function (A) {
    var s = A.state;
    if (!s.run || s.run.left !== null) return;
    var ev = L.tick(s, Date.now());
    if (ev.finished) { bell(3); awake(false); A.save(); A.render(); A.toast('All done — well done'); return; }
    if (ev.steps) { bell(1); A.save(); A.render(); return; }
    var ms = L.remaining(s, Date.now());
    if (refs.time) refs.time.textContent = L.fmt(ms);
    if (refs.ring) A.ringSet(refs.ring, 1 - ms / (s.steps[s.run.i].secs * 1000));
  },
  view: function (A) {
    var s = A.state, h = A.h, r = s.run, now = Date.now();
    var cur = r ? s.steps[r.i] : s.steps[0];
    var ms = L.remaining(s, now);
    var frac = r ? 1 - ms / (cur.secs * 1000) : 0;
    refs.time = h('p.big.num.clock', { text: L.fmt(ms), 'aria-live': 'off' });
    refs.ring = A.ring(frac, [h('p.kick', { text: r ? (r.left !== null ? 'Paused' : 'Now') : 'Ready' }), refs.time, h('p.unit', { text: cur.name })], 240);
    var nextStep = r ? (r.i + 1 < s.steps.length ? s.steps[r.i + 1] : (r.round < s.rounds ? s.steps[0] : null)) : null;
    var sub = r ? (s.rounds > 1 ? 'Round ' + r.round + ' of ' + s.rounds : '') + (nextStep ? (s.rounds > 1 ? ' · ' : '') + 'Next: ' + nextStep.name : (s.rounds > 1 ? ' · ' : '') + 'Last step') : L.fmt(L.total(s.steps) * 1000 * s.rounds) + ' in all' + (s.rounds > 1 ? ' · ' + s.rounds + ' rounds' : '');
    var go = function (fn, label) { unlock(); A.act(label, function (st) { return fn(st, Date.now()); }); };
    var main = !r ? A.btn('START', function () { go(L.start, ''); awake(true); bell(1); }, 'big')
      : r.left !== null ? A.btn('RESUME', function () { go(L.resume, ''); awake(true); }, 'big')
      : A.btn('PAUSE', function () { go(L.pause, ''); awake(false); }, 'big');
    var ctrls = h('div.row.ctrls', null, main,
      r ? A.btn('SKIP', function () { unlock(); var res = A.act('', function (st) { return L.skip(st, Date.now()); }); if (res === 'finished') { awake(false); A.toast('All done — well done'); } else bell(1); }, 'ghost') : null,
      r ? A.btn('RESET', function () { awake(false); A.act('Timer reset', function (st) { st.run = null; }, true); }, 'ghost') : null);
    var hero = A.card('hero', refs.ring, h('p.status', { text: sub }), ctrls);
    var list = A.card('', A.kick(s.steps.length > 1 ? 'Steps' : 'Step', h('span.count', { text: s.done ? s.done + ' finished' : '' })),
      h('ol.steps', null, s.steps.map(function (x, i) {
        return h('li' + (r && r.i === i ? '.cur' : ''), null, h('span', { text: x.name }), h('span.num', { text: L.fmt(x.secs * 1000) }));
      })),
      h('p.note', { text: 'The bell rings while this app is open on screen. An iPhone pauses web apps in the background, so keep it open (the screen stays on while it runs).' }));
    return [hero, list];
  },
  settings: function (A) {
    var s = A.state, h = A.h;
    var steps = h('textarea', { rows: 6, 'aria-label': 'Steps', spellcheck: 'false' });
    steps.value = s.steps.map(function (x) { return x.name + ' ' + (x.secs % 60 === 0 ? x.secs / 60 + 'm' : x.secs + 's'); }).join('\n');
    var rounds = A.number({ value: s.rounds, inputmode: 'numeric', 'aria-label': 'Rounds' });
    return h('div.sets', null,
      A.field('Steps, one a line (for example "Plank 60s" or "Warm up 5m")', steps),
      A.field('Rounds', rounds),
      A.btn('SAVE', function () {
        var list = L.parse(steps.value), n = Math.round(A.parse(rounds.value) || 1);
        if (!list.length) { A.toast('Write at least one step with its time'); return; }
        A.act('Steps saved', function (st) { st.steps = list; st.rounds = Math.max(1, Math.min(99, n)); st.run = null; });
        A.closeSheet();
      }));
  }
};
`;
