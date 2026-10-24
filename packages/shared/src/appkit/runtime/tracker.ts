/**
 * The tracker: an amount or a count per day (or week) towards a goal or under a limit, with today's
 * entries, the last seven days and a streak. Days are the phone's own days: at midnight today starts
 * at nothing and yesterday moves into the history. LOGIC is pure (tested in node); VIEW draws it.
 */
export const LOGIC = String.raw`var L = {
  pad: function (n) { return (n < 10 ? '0' : '') + n; },
  dayKey: function (d) { return d.getFullYear() + '-' + L.pad(d.getMonth() + 1) + '-' + L.pad(d.getDate()); },
  /** A week is known by its Monday. */
  weekKey: function (d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return L.dayKey(x); },
  keyOf: function (t, period) { var d = new Date(t); return period === 'week' ? L.weekKey(d) : L.dayKey(d); },
  /** The moment n days (or weeks) before now, at midday. */
  back: function (now, period, n) { return new Date(now.getFullYear(), now.getMonth(), now.getDate() - n * (period === 'week' ? 7 : 1), 12); },
  add: function (st, t, v) {
    if (typeof v !== 'number' || !isFinite(v)) return false;
    st.entries.push({ t: t, v: Math.round(v * 100) / 100 });
    st.entries.sort(function (a, b) { return a.t - b.t; });
    if (st.entries.length > 4000) st.entries.splice(0, st.entries.length - 4000);
    return true;
  },
  remove: function (st, t) {
    for (var i = 0; i < st.entries.length; i++) if (st.entries[i].t === t) { st.entries.splice(i, 1); return true; }
    return false;
  },
  inPeriod: function (st, key, period) { return st.entries.filter(function (e) { return L.keyOf(e.t, period) === key; }); },
  /** The period's amount: entries added up, or the latest reading; null when nothing was entered. */
  total: function (st, key, period, mode) {
    var es = L.inPeriod(st, key, period);
    if (!es.length) return null;
    if (mode === 'last') return es[es.length - 1].v;
    return Math.round(es.reduce(function (s, e) { return s + e.v; }, 0) * 100) / 100;
  },
  series: function (st, now, n, period, mode) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = L.back(now, period, i);
      var key = L.keyOf(d.getTime(), period);
      out.push({ key: key, d: d, v: L.total(st, key, period, mode) });
    }
    return out;
  },
  /** Did a period meet the goal? reach: at least the goal; limit: at most (nothing entered counts as within it). */
  met: function (v, goal, dir) { return dir === 'limit' ? (v === null || v <= goal) : (v !== null && v >= goal); },
  /** Periods in a row that met the goal, back from now (today still in progress does not break a "reach" streak). */
  streak: function (st, now, o) {
    if (!(o.goal > 0) || !st.entries.length) return 0;
    var first = L.keyOf(st.entries[0].t, o.period), n = 0;
    for (var i = 0; i < 1000; i++) {
      var key = L.keyOf(L.back(now, o.period, i).getTime(), o.period);
      if (key < first) break;
      var ok = L.met(L.total(st, key, o.period, o.mode), o.goal, o.dir);
      if (!ok && i === 0 && o.dir !== 'limit') continue;
      if (!ok) break;
      n++;
    }
    return n;
  }
};
`;

export const VIEW = String.raw`var SHAPE = {
  init: function (cfg) { var o = cfg.tracker; return { entries: [], goal: o.goal, unit: o.unit, unit1: o.unit1, amounts: o.amounts.slice(), dir: o.dir, period: o.period }; },
  fix: function (s, cfg) {
    if (!s || !Array.isArray(s.entries)) return null;
    var o = cfg.tracker;
    ['goal', 'unit', 'unit1', 'amounts', 'dir', 'period'].forEach(function (k) { if (s[k] === undefined) s[k] = o[k]; });
    return s;
  },
  opts: function (A) { var s = A.state, o = A.cfg.tracker; return { goal: s.goal, dir: s.dir, period: s.period, mode: o.mode }; },
  val: function (A, v, short) {
    var s = A.state, o = A.cfg.tracker;
    if (o.money) return A.money(v);
    if (v === null) return '–';
    return A.fmt(v, 1) + (short ? '' : ' ' + (v === 1 ? s.unit1 : s.unit));
  },
  view: function (A) {
    var s = A.state, o = A.cfg.tracker, h = A.h, now = new Date();
    var opts = SHAPE.opts(A);
    var key = L.keyOf(now.getTime(), s.period);
    var tot = L.total(s, key, s.period, o.mode);
    var goal = s.goal > 0 ? s.goal : 0;
    var shown = tot === null ? 0 : tot;
    var frac = goal ? shown / goal : (tot === null ? 0 : 1);
    var word = s.period === 'week' ? 'this week' : 'today';
    var line;
    if (!goal) line = tot === null ? 'Nothing yet ' + word : 'So far ' + word;
    else if (o.mode === 'last') line = tot === null ? 'No reading yet ' + word : (s.dir === 'limit' ? (tot <= goal ? 'At or under your target of ' + SHAPE.val(A, goal) : SHAPE.val(A, Math.round((tot - goal) * 100) / 100) + ' above your target') : (tot >= goal ? 'Goal reached' : SHAPE.val(A, Math.round((goal - tot) * 100) / 100) + ' short of ' + SHAPE.val(A, goal)));
    else if (s.dir === 'limit') line = shown <= goal ? SHAPE.val(A, Math.round((goal - shown) * 100) / 100) + ' left of ' + SHAPE.val(A, goal) : SHAPE.val(A, Math.round((shown - goal) * 100) / 100) + ' over your limit';
    else line = shown >= goal ? 'Goal reached — well done' : SHAPE.val(A, Math.round((goal - shown) * 100) / 100) + ' to go';
    var over = goal && s.dir === 'limit' && shown > goal;
    var big = o.money ? A.money(shown) : A.fmt(shown, 1);
    var hero = A.card('hero' + (over ? '.over' : ''),
      A.ring(frac, [h('p.kick', { text: s.period === 'week' ? 'This week' : 'Today' }), h('p.big.num', { text: big }), h('p.unit', { text: o.money ? (goal ? 'of ' + A.money(goal) : '') : (goal ? 'of ' + A.fmt(goal, 1) + ' ' + s.unit : s.unit) })]),
      h('p.status', { text: line }));
    var add = function (v) {
      A.act((o.money ? A.money(v) : '+' + A.fmt(v, 1) + ' ' + (v === 1 ? s.unit1 : s.unit)) + ' added', function (st) { return L.add(st, Date.now(), v); });
    };
    var quick = h('div.quick');
    if (o.mode === 'last') {
      s.amounts.forEach(function (v) { quick.append(A.btn(A.fmt(v, 1), function () { add(v); }, 'ghost chip')); });
    } else {
      s.amounts.forEach(function (v) { quick.append(A.btn((o.money ? '+' + A.money(v) : '+' + A.fmt(v, 1) + ' ' + (v === 1 ? s.unit1 : s.unit)).toUpperCase(), function () { add(v); }, s.amounts.length === 1 ? 'wide' : '')); });
    }
    var other = A.number({ placeholder: o.mode === 'last' ? 'Reading' : 'Other amount', 'aria-label': o.mode === 'last' ? 'Reading (' + s.unit + ')' : 'Other amount' });
    var addOther = function () {
      var v = A.parse(other.value);
      if (v === null) { A.toast('Type a number first'); other.focus(); return; }
      add(v);
    };
    other.addEventListener('keydown', function (e) { if (e.key === 'Enter') addOther(); });
    hero.append(quick, h('div.row.addrow', null, other, A.btn(o.mode === 'last' ? 'SAVE' : 'ADD', addOther, 'ghost')));

    var es = L.inPeriod(s, key, s.period).slice().reverse();
    var list = A.card('', A.kick(s.period === 'week' ? 'This week' : 'Today', h('span.count', { text: es.length ? es.length + ' ' + A.plural(es.length, 'entry', 'entries') : '' })),
      es.length ? h('ul.rows', null, es.slice(0, 50).map(function (e) {
        return h('li.rowi', null,
          h('span.when', { text: s.period === 'week' ? A.when(e.t) : A.hm(e.t) }),
          h('span.what.num', { text: o.mode === 'last' ? SHAPE.val(A, e.v) : (e.v < 0 ? '' : '+') + SHAPE.val(A, e.v) }),
          h('button.gbtn.del', { type: 'button', 'aria-label': 'Remove ' + SHAPE.val(A, e.v), onclick: function () { A.act('Removed', function (st) { return L.remove(st, e.t); }, true); } }, A.icon('trash')));
      })) : A.empty(o.mode === 'last' ? 'No reading yet ' + word + '. Type it above.' : 'Nothing yet ' + word + '. Tap ' + (o.money ? 'an amount' : '+' + A.fmt(s.amounts[0] || 1, 1)) + ' when you have some.'));

    var ser = L.series(s, now, 7, s.period, o.mode);
    var max = Math.max(goal, ser.reduce(function (m, x) { return Math.max(m, x.v || 0); }, 0)) || 1;
    var streak = L.streak(s, now, opts);
    var bars = h('div.bars', { role: 'img', 'aria-label': 'The last 7 ' + (s.period === 'week' ? 'weeks' : 'days') + ': ' + ser.map(function (x) { return x.v === null ? 'none' : SHAPE.val(A, x.v); }).join(', ') });
    ser.forEach(function (x, i) {
      var ok = goal && x.v !== null && L.met(x.v, goal, s.dir);
      bars.append(h('div.bar' + (i === ser.length - 1 ? '.now' : '') + (ok ? '.ok' : ''), null,
        h('span.bv.num', { text: x.v === null ? '' : (o.money ? A.money(x.v).replace('.00', '') : A.fmt(x.v, 0)) }),
        h('span.bt', null, h('i', { style: 'height:' + Math.round(Math.max(x.v ? 4 : 0, (x.v || 0) / max * 100)) + '%' }), goal ? h('b.gl', { style: 'bottom:' + Math.round(goal / max * 100) + '%' }) : null),
        h('span.bl', { text: s.period === 'week' ? x.d.getDate() + '/' + (x.d.getMonth() + 1) : A.DAYS[x.d.getDay()].charAt(0) })));
    });
    var hist = A.card('', A.kick(s.period === 'week' ? 'Last 7 weeks' : 'Last 7 days', goal ? h('span.pill' + (streak ? '.on' : ''), { text: streak ? streak + ' ' + (s.period === 'week' ? A.plural(streak, 'week', 'weeks') : A.plural(streak, 'day', 'days')) + ' in a row' : 'No streak yet' }) : null), bars);
    return [hero, list, hist];
  },
  settings: function (A) {
    var s = A.state, o = A.cfg.tracker, h = A.h;
    var goal = A.number({ value: s.goal || '', placeholder: 'No goal', 'aria-label': 'Goal' });
    var unit = A.input({ value: s.unit, maxlength: 16, 'aria-label': 'Unit' });
    var amounts = A.input({ value: s.amounts.join(', '), inputmode: 'decimal', 'aria-label': 'Quick amounts' });
    var saveIt = function () {
      var g = A.parse(goal.value);
      var am = amounts.value.split(',').map(A.parse).filter(function (x) { return x !== null; }).slice(0, 6);
      A.act('Settings saved', function (st) {
        st.goal = g !== null && g > 0 ? g : 0;
        if (!o.money && unit.value.trim()) { st.unit = unit.value.trim().slice(0, 16); if (st.unit !== s.unit) st.unit1 = st.unit; }
        if (am.length || o.mode === 'last') st.amounts = am;
      });
      A.closeSheet();
    };
    return h('div.sets', null,
      A.field((s.dir === 'limit' ? 'Limit' : 'Goal') + (s.period === 'week' ? ' each week' : ' each day') + (o.money ? ' (£)' : ''), goal),
      o.money ? null : A.field('Unit', unit),
      A.field('Quick buttons (comma between)', amounts),
      A.field('The goal is', A.seg([['reach', 'At least this'], ['limit', 'At most this']], s.dir, function (v) { A.act('', function (st) { st.dir = v; }); A.closeSheet(); }, 'Goal or limit')),
      A.field('Count by', A.seg([['day', 'Day'], ['week', 'Week']], s.period, function (v) { A.act('', function (st) { st.period = v; }); A.closeSheet(); }, 'Day or week')),
      A.btn('SAVE', saveIt));
  }
};
`;
