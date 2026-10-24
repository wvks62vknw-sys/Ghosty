/**
 * Flash cards with spaced repetition (a Leitner box): a card you know comes back after 1, 2, 4, 8 and
 * then 16 days; one you miss comes back today, after the others. Tap the card to turn it over, then
 * AGAIN or GOT IT. Cards are added, edited and deleted (with UNDO). LOGIC is pure.
 */
export const LOGIC = String.raw`var L = {
  GAPS: [0, 1, 2, 4, 8, 16],
  pad: function (n) { return (n < 10 ? '0' : '') + n; },
  addDays: function (key, n) { var p = key.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n, 12); return d.getFullYear() + '-' + L.pad(d.getMonth() + 1) + '-' + L.pad(d.getDate()); },
  add: function (st, q, a, id, today) {
    q = String(q || '').trim().slice(0, 200);
    a = String(a || '').trim().slice(0, 300);
    if (!q || !a || st.cards.length >= 1000) return false;
    st.cards.push({ id: id, q: q, a: a, box: 0, due: today, seen: 0 });
    return true;
  },
  find: function (st, id) { for (var i = 0; i < st.cards.length; i++) if (st.cards[i].id === id) return st.cards[i]; return null; },
  /** Cards due today or before: the least recently seen first, so a missed card waits its turn. */
  due: function (st, today) {
    return st.cards.filter(function (c) { return c.due <= today; }).sort(function (a, b) { return (a.seen || 0) - (b.seen || 0) || a.box - b.box; });
  },
  grade: function (st, id, ok, today, now) {
    var c = L.find(st, id);
    if (!c) return false;
    if (ok) { c.box = Math.min(5, c.box + 1); c.due = L.addDays(today, L.GAPS[c.box]); }
    else { c.box = 0; c.due = today; }
    c.seen = now;
    st.studied[today] = (st.studied[today] || 0) + 1;
    return true;
  },
  edit: function (st, id, q, a) { var c = L.find(st, id); q = String(q || '').trim(); a = String(a || '').trim(); if (!c || !q || !a) return false; c.q = q.slice(0, 200); c.a = a.slice(0, 300); return true; },
  remove: function (st, id) { var n = st.cards.length; st.cards = st.cards.filter(function (c) { return c.id !== id; }); return st.cards.length < n; },
  stats: function (st, today) { return { total: st.cards.length, due: L.due(st, today).length, learned: st.cards.filter(function (c) { return c.box >= 3; }).length }; },
  /** The day the next card falls due (after today), or null. */
  nextDue: function (st, today) { var later = st.cards.map(function (c) { return c.due; }).filter(function (d) { return d > today; }).sort(); return later[0] || null; }
};
`;

export const VIEW = String.raw`var flipped = false;
function manage(A) {
  var h = A.h, q = A.input({ placeholder: 'Front: the question', maxlength: 200, 'aria-label': 'Front' }), a = A.input({ placeholder: 'Back: the answer', maxlength: 300, 'aria-label': 'Back' });
  var list = A.state.cards.slice().reverse().map(function (c) {
    return h('li.rowi.cardrow', null, h('span.what', null, h('b', { text: c.q }), h('span', { text: c.a })),
      h('button.gbtn.del', { type: 'button', 'aria-label': 'Delete card ' + c.q, onclick: function () { A.closeSheet(); A.act('Card deleted', function (st) { return L.remove(st, c.id); }, true); } }, A.icon('trash')));
  });
  A.sheet('Cards', [A.field('New card', h('div.stack', null, q, a)),
    A.btn('ADD CARD', function () {
      if (A.act('Card added', function (st) { return L.add(st, q.value, a.value, A.uid(), A.day()); }) === false) { A.toast('Fill in both sides'); return; }
      q.value = ''; a.value = ''; q.focus();
    }),
    list.length ? h('ul.rows', null, list) : null]);
}
var SHAPE = {
  init: function (cfg) {
    var st = { cards: [], studied: {} }, today = A.day();
    (cfg.cards.cards || []).forEach(function (c, i) { L.add(st, c.q, c.a, 'k' + i, today); });
    return st;
  },
  fix: function (s) { return s && Array.isArray(s.cards) ? (s.studied = s.studied || {}, s) : null; },
  view: function (A) {
    var s = A.state, h = A.h, today = A.day(), st = L.stats(s, today), card = L.due(s, today)[0];
    var top = h('div.tools', null, h('p.count', { text: st.total ? st.due + ' due today · ' + st.total + ' ' + A.plural(st.total, 'card', 'cards') + ' · ' + st.learned + ' learned' : '' }), A.btn('CARDS', function () { manage(A); }, 'ghost sm'));
    if (!card) {
      flipped = false;
      var next = L.nextDue(s, today);
      return [top, A.card('hero', h('p.kick', { text: st.total ? 'All done for today' : 'No cards yet' }), h('p.status', { text: st.total ? (next ? 'The next cards are due ' + (next === L.addDays(today, 1) ? 'tomorrow' : A.when(A.dateOf(next).getTime()).replace(/ \d\d:\d\d$/, '')) + '.' : 'Every card is learned.') : 'Tap CARDS to add your first card: a question on the front, the answer on the back.' }), st.total ? null : A.btn('ADD CARDS', function () { manage(A); }))];
    }
    var face = h('button.flash' + (flipped ? '.flipped' : ''), { type: 'button', 'aria-label': flipped ? 'Answer: ' + card.a : 'Question: ' + card.q + '. Tap to see the answer.', onclick: function () { flipped = !flipped; A.render(); } },
      h('span.fside.front', null, h('span.kick', { text: 'Question' }), h('span.ftext', { text: card.q })),
      h('span.fside.back', null, h('span.kick', { text: 'Answer' }), h('span.ftext', { text: card.a })));
    var grade = function (ok) { flipped = false; A.act(ok ? 'Next one' : 'It comes back later today', function (stt) { return L.grade(stt, card.id, ok, today, Date.now()); }); };
    var btns = flipped ? h('div.row.ctrls', null, A.btn('AGAIN', function () { grade(false); }, 'ghost'), A.btn('GOT IT', function () { grade(true); }))
      : h('p.status', { text: 'Tap the card to see the answer' });
    return [top, h('div.scene', null, face), btns];
  },
  settings: function (A) { return A.h('div.sets', null, A.btn('ADD OR EDIT CARDS', function () { A.closeSheet(); manage(A); }, 'ghost')); }
};
`;
