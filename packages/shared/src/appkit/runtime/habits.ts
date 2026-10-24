/**
 * The habit grid: a few habits, the last seven days as taps, today's tally, a streak for each, and
 * habits added, renamed and removed (with UNDO). LOGIC is pure.
 */
export const LOGIC = String.raw`var L = {
  pad: function (n) { return (n < 10 ? '0' : '') + n; },
  key: function (d) { return d.getFullYear() + '-' + L.pad(d.getMonth() + 1) + '-' + L.pad(d.getDate()); },
  minus: function (key, n) { var p = key.split('-'); return L.key(new Date(+p[0], +p[1] - 1, +p[2] - n, 12)); },
  /** The last n days, oldest first, ending today. */
  days: function (today, n) { var out = []; for (var i = n - 1; i >= 0; i--) out.push(L.minus(today, i)); return out; },
  toggle: function (st, id, day) {
    st.done[id] = st.done[id] || {};
    if (st.done[id][day]) delete st.done[id][day];
    else st.done[id][day] = 1;
    return true;
  },
  /** Days in a row done, back from today (today not done yet does not break it). */
  streak: function (st, id, today) {
    var d = st.done[id] || {}, n = 0;
    for (var i = 0; i < 3660; i++) {
      var k = L.minus(today, i);
      if (d[k]) n++;
      else if (i > 0) break;
    }
    return n;
  },
  count: function (st, id, days) { var d = st.done[id] || {}; return days.filter(function (k) { return d[k]; }).length; },
  add: function (st, name, id) { var t = String(name || '').trim().slice(0, 40); if (!t || st.habits.length >= 12) return false; st.habits.push({ id: id, name: t }); return true; },
  remove: function (st, id) { var n = st.habits.length; st.habits = st.habits.filter(function (x) { return x.id !== id; }); delete st.done[id]; return st.habits.length < n; },
  rename: function (st, id, name) { var t = String(name || '').trim().slice(0, 40); for (var i = 0; i < st.habits.length; i++) if (st.habits[i].id === id && t) { st.habits[i].name = t; return true; } return false; }
};
`;

export const VIEW = String.raw`var SHAPE = {
  init: function (cfg) { return { habits: cfg.habits.names.map(function (n, i) { return { id: 'h' + i, name: n }; }), done: {} }; },
  fix: function (s) { return s && Array.isArray(s.habits) && s.done ? s : null; },
  view: function (A) {
    var s = A.state, h = A.h, today = A.day(), days = L.days(today, 7);
    var doneToday = s.habits.filter(function (x) { return (s.done[x.id] || {})[today]; }).length;
    var head = h('div.hgrid.hhead', { 'aria-hidden': 'true' }, days.map(function (k) {
      var d = A.dateOf(k);
      return h('span' + (k === today ? '.today' : ''), null, h('b', { text: A.DAYS[d.getDay()].charAt(0) }), h('i', { text: String(d.getDate()) }));
    }));
    var rows = s.habits.map(function (x) {
      var st = L.streak(s, x.id, today);
      return h('li.habit', null,
        h('div.prow', null, h('p.pname', { text: x.name }), h('span.pill' + (st ? '.on' : ''), { text: st ? st + '-day streak' : 'No streak yet' })),
        h('div.hgrid', null, days.map(function (k) {
          var on = !!(s.done[x.id] || {})[k], d = A.dateOf(k);
          return h('button.dot' + (on ? '.on' : '') + (k === today ? '.today' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': x.name + ', ' + A.DAYS[d.getDay()] + ' ' + d.getDate() + (on ? ', done' : ''), onclick: function () { A.act('', function (st2) { return L.toggle(st2, x.id, k); }); } }, on ? A.icon('check') : null);
        })));
    });
    var top = A.card('hero.tally', h('p.kick', { text: 'Today' }), h('p.big.num', { text: doneToday + ' of ' + s.habits.length }), h('p.status', { text: !s.habits.length ? 'Add a habit to start' : doneToday === s.habits.length ? 'All done today — well done' : 'Tap a circle when you have done it' }));
    var grid = A.card('', s.habits.length ? [head, h('ul.habits', null, rows)] : A.empty('No habits yet. Add one below.'),
      A.btn('ADD A HABIT', function () {
        var name = A.input({ placeholder: 'For example: Walk 20 minutes', maxlength: 40, 'aria-label': 'Habit' });
        A.sheet('Add a habit', [A.field('Habit', name), A.btn('ADD', function () { if (A.act('Added', function (st) { return L.add(st, name.value, A.uid()); }) === false) A.toast(s.habits.length >= 12 ? 'Twelve habits at most' : 'Type a habit first'); else A.closeSheet(); })]);
        name.focus();
      }, 'ghost'));
    return [top, grid];
  },
  settings: function (A) {
    var s = A.state, h = A.h;
    return h('div.sets', null, A.field('Habits', h('ul.rows', null, s.habits.map(function (x) {
      var name = A.input({ value: x.name, maxlength: 40, 'aria-label': 'Habit name' });
      name.addEventListener('change', function () { A.act('Renamed', function (st) { return L.rename(st, x.id, name.value); }); });
      return h('li.rowi', null, name, h('button.gbtn.del', { type: 'button', 'aria-label': 'Remove ' + x.name, onclick: function () { A.closeSheet(); A.act('Removed ' + x.name, function (st) { return L.remove(st, x.id); }, true); } }, A.icon('trash')));
    }))));
  }
};
`;
