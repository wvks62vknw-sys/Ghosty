/**
 * The counter or scoreboard: one big count, or a score for each player, with big + and − buttons,
 * who is ahead, the last change, RESET with UNDO, and names and the step in Settings. LOGIC is pure.
 */
export const LOGIC = String.raw`var L = {
  find: function (st, id) { for (var i = 0; i < st.counters.length; i++) if (st.counters[i].id === id) return st.counters[i]; return null; },
  bump: function (st, id, d, t) {
    var c = L.find(st, id);
    if (!c || !isFinite(d) || !d) return false;
    c.n = Math.round((c.n + d) * 100) / 100;
    st.log.push({ t: t, id: id, d: d });
    if (st.log.length > 100) st.log.splice(0, st.log.length - 100);
    return true;
  },
  reset: function (st) { var any = st.counters.some(function (c) { return c.n !== 0; }); st.counters.forEach(function (c) { c.n = 0; }); st.log = []; return any; },
  add: function (st, name, id) { var t = String(name || '').trim().slice(0, 24); if (!t || st.counters.length >= 8) return false; st.counters.push({ id: id, name: t, n: 0 }); return true; },
  remove: function (st, id) { if (st.counters.length <= 1) return false; var n = st.counters.length; st.counters = st.counters.filter(function (c) { return c.id !== id; }); return st.counters.length < n; },
  rename: function (st, id, name) { var c = L.find(st, id), t = String(name || '').trim().slice(0, 24); if (!c || !t) return false; c.name = t; return true; },
  /** Who is ahead: one counter strictly above all the others (none on a tie, or with fewer than two). */
  leader: function (st) {
    if (st.counters.length < 2) return null;
    var max = Math.max.apply(null, st.counters.map(function (c) { return c.n; }));
    var top = st.counters.filter(function (c) { return c.n === max; });
    return top.length === 1 ? top[0].id : null;
  }
};
`;

export const VIEW = String.raw`var SHAPE = {
  init: function (cfg) { return { counters: cfg.counter.names.map(function (n, i) { return { id: 'c' + i, name: n, n: 0 }; }), step: cfg.counter.step || 1, log: [] }; },
  fix: function (s) { return s && Array.isArray(s.counters) && s.counters.length ? s : null; },
  view: function (A) {
    var s = A.state, h = A.h, lead = L.leader(s), one = s.counters.length === 1;
    var bump = function (c, d) { A.act('', function (st) { return L.bump(st, c.id, d, Date.now()); }); };
    var cards = s.counters.map(function (c) {
      return A.card(one ? 'hero.solo' : 'player' + (lead === c.id ? '.lead' : ''),
        h('div.prow', null, h('p.pname', { text: c.name }), lead === c.id ? h('span.pill.on', { text: 'AHEAD' }) : null),
        h('p.' + (one ? 'giant' : 'score') + '.num', { text: A.fmt(c.n, 2), 'aria-live': 'polite' }),
        h('div.row.bump', null,
          A.btn(A.icon('minus'), function () { bump(c, -s.step); }, 'ghost round', { 'aria-label': 'Take ' + A.fmt(s.step) + ' off ' + c.name }),
          A.btn(A.icon('plus'), function () { bump(c, s.step); }, 'round', { 'aria-label': 'Add ' + A.fmt(s.step) + ' to ' + c.name })));
    });
    var last = s.log[s.log.length - 1], who = last ? L.find(s, last.id) : null;
    var foot = h('div.tools', null,
      h('p.count', { text: who ? 'Last: ' + who.name + ' ' + (last.d > 0 ? '+' : '−') + A.fmt(Math.abs(last.d)) + ' at ' + A.hm(last.t) : 'Tap + to count' }),
      A.btn('RESET', function () { A.act('Back to zero', function (st) { return L.reset(st); }, true); }, 'ghost sm'));
    return [h('div.players' + (one ? '.single' : ''), null, cards), foot];
  },
  settings: function (A) {
    var s = A.state, h = A.h;
    var rows = s.counters.map(function (c) {
      var name = A.input({ value: c.name, maxlength: 24, 'aria-label': 'Name' });
      name.addEventListener('change', function () { A.act('Renamed', function (st) { return L.rename(st, c.id, name.value); }); });
      return h('li.rowi', null, name, s.counters.length > 1 ? h('button.gbtn.del', { type: 'button', 'aria-label': 'Remove ' + c.name, onclick: function () { A.closeSheet(); A.act('Removed ' + c.name, function (st) { return L.remove(st, c.id); }, true); } }, A.icon('trash')) : null);
    });
    var step = A.number({ value: s.step, 'aria-label': 'Count by' });
    step.addEventListener('change', function () { var v = A.parse(step.value); if (v && v > 0) A.act('Counting by ' + A.fmt(v), function (st) { st.step = v; }); });
    var fresh = A.input({ placeholder: 'Add a player or counter', maxlength: 24, 'aria-label': 'New name' });
    return h('div.sets', null,
      A.field('Names', h('ul.rows', null, rows)),
      h('div.row', null, fresh, A.btn('ADD', function () { if (A.act('Added', function (st) { return L.add(st, fresh.value, A.uid()); }) !== false) A.closeSheet(); else A.toast(s.counters.length >= 8 ? 'Eight at most' : 'Type a name first'); }, 'ghost')),
      A.field('Count by', step));
  }
};
`;
