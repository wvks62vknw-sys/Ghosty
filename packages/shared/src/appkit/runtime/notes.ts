/**
 * The notes pad: notes written and kept as you type, pinned ones first, then the newest; search;
 * delete with UNDO. LOGIC is pure.
 */
export const LOGIC = String.raw`var L = {
  add: function (st, id, now) { st.notes.unshift({ id: id, text: '', at: now, pinned: false }); if (st.notes.length > 500) st.notes.length = 500; return id; },
  find: function (st, id) { for (var i = 0; i < st.notes.length; i++) if (st.notes[i].id === id) return st.notes[i]; return null; },
  edit: function (st, id, text, now) { var n = L.find(st, id), t = String(text).slice(0, 20000); if (!n || n.text === t) return false; n.text = t; n.at = now; return true; },
  pin: function (st, id) { var n = L.find(st, id); if (!n) return false; n.pinned = !n.pinned; return true; },
  remove: function (st, id) { var k = st.notes.length; st.notes = st.notes.filter(function (x) { return x.id !== id; }); return st.notes.length < k; },
  /** Empty notes left behind by NEW NOTE are tidied away. */
  tidy: function (st) { var k = st.notes.length; st.notes = st.notes.filter(function (x) { return x.text.trim(); }); return k - st.notes.length; },
  sorted: function (st, q) {
    var words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return st.notes.filter(function (x) { var t = x.text.toLowerCase(); return words.every(function (w) { return t.indexOf(w) >= 0; }); })
      .sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at; });
  },
  title: function (text) { var t = String(text).trim().split('\n')[0].trim(); return t ? t.slice(0, 80) : 'New note'; },
  snippet: function (text) { var lines = String(text).trim().split('\n'); return lines.slice(1).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120); }
};
`;

export const VIEW = String.raw`var query = '', searchBox = null;
function open(A, id) {
  var n = L.find(A.state, id);
  if (!n) return;
  var area = A.h('textarea.notearea', { rows: 12, 'aria-label': 'Note', placeholder: 'Start typing. The first line is the title.' });
  area.value = n.text;
  var timer = 0;
  area.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { L.edit(A.state, id, area.value, Date.now()); A.save(); }, 300);
  });
  var finished = false;
  var finish = function () {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (L.find(A.state, id)) L.edit(A.state, id, area.value, Date.now());
    L.tidy(A.state);
    A.save();
    A.render();
  };
  A.sheet(n.text.trim() ? L.title(n.text) : 'New note', [area, A.h('div.row', null,
    A.btn(n.pinned ? 'UNPIN' : 'PIN', function () { finish(); A.closeSheet(); A.act(n.pinned ? 'Unpinned' : 'Pinned', function (st) { return L.pin(st, id); }); }, 'ghost'),
    A.btn('DELETE', function () { finished = true; clearTimeout(timer); L.edit(A.state, id, area.value, Date.now()); A.closeSheet(); A.act('Note deleted', function (st) { return L.remove(st, id); }, true); }, 'ghost danger'),
    A.btn('DONE', function () { finish(); A.closeSheet(); }))], finish);
  area.focus();
}
var SHAPE = {
  init: function () { return { notes: [] }; },
  fix: function (s) { return s && Array.isArray(s.notes) ? s : null; },
  view: function (A) {
    var s = A.state, h = A.h;
    if (!searchBox) {
      searchBox = A.input({ type: 'search', placeholder: 'Search notes', 'aria-label': 'Search notes', enterkeyhint: 'search' });
      searchBox.addEventListener('input', function () { query = searchBox.value; A.render(); searchBox.focus(); });
    }
    var bar = h('div.row.notebar', null, searchBox, A.btn('NEW NOTE', function () { var id = A.uid(); L.add(A.state, id, Date.now()); A.save(); open(A, id); }));
    var list = L.sorted(s, query);
    var cards = list.map(function (n) {
      return h('li', null, h('button.nbtn', { type: 'button', onclick: function () { open(A, n.id); } },
        h('span.ntitle', null, n.pinned ? h('span.pin', null, A.icon('pin')) : null, L.title(n.text)),
        L.snippet(n.text) ? h('span.nsnip', { text: L.snippet(n.text) }) : null,
        h('span.when', { text: A.when(n.at) })));
    });
    return [bar, A.card('', cards.length ? h('ul.notes', null, cards) : A.empty(s.notes.length ? 'No note has those words.' : 'No notes yet. Tap NEW NOTE to write one.'))];
  }
};
`;
