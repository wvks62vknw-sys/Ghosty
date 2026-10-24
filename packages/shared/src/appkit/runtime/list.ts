/**
 * The list: to-dos, shopping, packing or any checklist. Add, tick off, reorder, delete, clear what is
 * done, start a packing list again — every destructive step with UNDO. LOGIC is pure; VIEW draws it.
 */
export const LOGIC = String.raw`var L = {
  clean: function (t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120); },
  add: function (st, text, id) {
    var t = L.clean(text);
    if (!t || st.items.length >= 500) return false;
    for (var i = 0; i < st.items.length; i++) if (!st.items[i].done && st.items[i].text.toLowerCase() === t.toLowerCase()) return false;
    st.items.push({ id: id, text: t, done: false });
    return true;
  },
  find: function (st, id) { for (var i = 0; i < st.items.length; i++) if (st.items[i].id === id) return i; return -1; },
  toggle: function (st, id) { var i = L.find(st, id); if (i < 0) return false; st.items[i].done = !st.items[i].done; return true; },
  rename: function (st, id, text) { var i = L.find(st, id), t = L.clean(text); if (i < 0 || !t) return false; st.items[i].text = t; return true; },
  /** Swap with the neighbour above (-1) or below (+1). */
  move: function (st, id, dir) {
    var i = L.find(st, id), j = i + dir;
    if (i < 0 || j < 0 || j >= st.items.length) return false;
    var x = st.items[i];
    st.items[i] = st.items[j];
    st.items[j] = x;
    return true;
  },
  remove: function (st, id) { var i = L.find(st, id); if (i < 0) return false; st.items.splice(i, 1); return true; },
  clearDone: function (st) { var n = st.items.length; st.items = st.items.filter(function (x) { return !x.done; }); return n - st.items.length; },
  /** Untick everything (a packing list for the next trip). */
  again: function (st) { var n = 0; st.items.forEach(function (x) { if (x.done) { x.done = false; n++; } }); return n; },
  counts: function (st) { var d = st.items.filter(function (x) { return x.done; }).length; return { left: st.items.length - d, done: d }; }
};
`;

export const VIEW = String.raw`var addBox = null;
var SHAPE = {
  init: function (cfg) {
    var st = { items: [], order: false };
    (cfg.list.items || []).forEach(function (t, i) { L.add(st, t, 'i' + i); });
    return st;
  },
  fix: function (s) { return s && Array.isArray(s.items) ? s : null; },
  view: function (A) {
    var s = A.state, h = A.h, kind = A.cfg.list.kind;
    if (!addBox) {
      var input = A.input({ placeholder: kind === 'shopping' ? 'Add something to buy' : kind === 'packing' ? 'Add something to pack' : kind === 'todo' ? 'Add a job' : 'Add an item', 'aria-label': 'New item', enterkeyhint: 'done', maxlength: 120 });
      var addIt = function (e) {
        if (e) e.preventDefault();
        var v = input.value;
        if (!L.clean(v)) { A.toast('Type something first'); input.focus(); return; }
        var ok = A.act('', function (st) { return L.add(st, v, A.uid()); });
        if (ok === false) A.toast('Already on the list');
        else input.value = '';
        input.focus();
      };
      addBox = h('form.card.addbox', { onsubmit: addIt }, h('div.row', null, input, A.btn('ADD', null, '', { type: 'submit' })));
    }
    var c = L.counts(s);
    var tools = h('div.tools', null,
      h('p.count', { text: s.items.length ? c.left + ' left' + (c.done ? ' · ' + c.done + ' done' : '') : '' }),
      s.items.length > 1 ? A.btn(s.order ? 'DONE' : 'REORDER', function () { A.act('', function (st) { st.order = !st.order; }); }, 'ghost sm') : null,
      c.done ? A.btn('CLEAR DONE', function () { A.act('Cleared ' + c.done + ' done', function (st) { return L.clearDone(st) > 0; }, true); }, 'ghost sm') : null,
      kind === 'packing' && c.done ? A.btn('START AGAIN', function () { A.act('Everything unticked', function (st) { return L.again(st) > 0; }, true); }, 'ghost sm') : null);
    var rows = s.items.map(function (it, i) {
      var tick = h('button.tick' + (it.done ? '.on' : ''), { type: 'button', 'aria-pressed': it.done ? 'true' : 'false', 'aria-label': (it.done ? 'Untick ' : 'Tick off ') + it.text, onclick: function () { A.act('', function (st) { return L.toggle(st, it.id); }); } }, A.icon('check'));
      var text = h('span.itext', { text: it.text, onclick: function () { if (!s.order) A.act('', function (st) { return L.toggle(st, it.id); }); } });
      var end = s.order
        ? h('span.ord', null,
            h('button.gbtn', { type: 'button', 'aria-label': 'Move ' + it.text + ' up', disabled: i === 0, onclick: function () { A.act('', function (st) { return L.move(st, it.id, -1); }); } }, A.icon('up')),
            h('button.gbtn', { type: 'button', 'aria-label': 'Move ' + it.text + ' down', disabled: i === s.items.length - 1, onclick: function () { A.act('', function (st) { return L.move(st, it.id, 1); }); } }, A.icon('down')))
        : h('button.gbtn.del', { type: 'button', 'aria-label': 'Delete ' + it.text, onclick: function () { A.act('Deleted', function (st) { return L.remove(st, it.id); }, true); } }, A.icon('trash'));
      return h('li.item' + (it.done ? '.done' : ''), null, tick, text, end);
    });
    var list = A.card('', rows.length ? h('ul.items', null, rows) : A.empty(kind === 'packing' ? 'Nothing to pack yet. Add the first thing above.' : 'Your list is empty. Add the first thing above.'));
    return [addBox, tools, list];
  },
  settings: function (A) {
    var h = A.h;
    return h('div.sets', null, h('p.aboutp', { text: 'Tap an item to tick it off. REORDER moves things up and down; CLEAR DONE takes ticked items away (UNDO puts them back).' }));
  }
};
`;
