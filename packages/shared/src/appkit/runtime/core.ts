/**
 * The part of every mini-app's script that is the same for all of them (the shape's own logic and view
 * go between HEAD and BOOT): saved state on the phone (localStorage, never thrown on), UNDO for anything
 * destructive, the toast, the bottom sheet, the install hint, the offline service worker, the day
 * watcher and the status line. Plain browser JavaScript as text: it is pinned by hash in the page's
 * Content Security Policy, so nothing else can run there. DOM is built with h() and textContent only.
 */
export const CORE_HEAD = String.raw`'use strict';
var D = document, W = window;
var CFG = JSON.parse(D.getElementById('app-cfg').textContent || '{}');
var KEY = 'ghosty-app:' + CFG.id + ':' + CFG.shape;
var LIMIT = 200000;
var MAIN = D.getElementById('app-main');
var TOAST = D.getElementById('app-toast');
var SHEET = D.getElementById('app-sheet');
var A = { cfg: CFG, state: null, prefs: {}, saving: true, offline: 'wait' };

function put(el, c) {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { put(el, x); }); return; }
  el.append(c && c.nodeType ? c : D.createTextNode(String(c)));
}
/** h('button.btn.ghost', { text: 'UNDO', onclick: f }, kids…): every word goes in as text, never as markup. */
function h(sel, props) {
  var bits = String(sel).split('.');
  var el = D.createElement(bits[0] || 'div');
  if (bits.length > 1) el.className = bits.slice(1).join(' ');
  if (props) Object.keys(props).forEach(function (k) {
    var v = props[k];
    if (v === null || v === undefined || v === false) return;
    if (k === 'text') el.textContent = String(v);
    else if (k === 'value') el.value = String(v);
    else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  });
  for (var i = 2; i < arguments.length; i++) put(el, arguments[i]);
  return el;
}
var NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs) {
  var el = D.createElementNS(NS, tag);
  Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
  for (var i = 2; i < arguments.length; i++) put(el, arguments[i]);
  return el;
}
var PATHS = {
  x: 'M6 6l12 12M18 6L6 18', gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.4 7.4 0 0 1-1.8 1l-.3 2h-4l-.3-2a7.4 7.4 0 0 1-1.8-1l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 0 1 0-3L3 9.3l2-3.4 1.9.7a7.4 7.4 0 0 1 1.8-1l.3-2h4l.3 2a7.4 7.4 0 0 1 1.8 1l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 0 1 0 3z',
  up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', check: 'M5 12.5l4.5 4.5L19 7.5', trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  play: 'M8 5.5v13l11-6.5z', pause: 'M8 5v14M16 5v14', skip: 'M6 5.5v13l9-6.5zM18 5v14', reset: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5', share: 'M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1', swap: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4', pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7', search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8'
};
function icon(name) {
  return sv('svg', { viewBox: '0 0 24 24', 'class': 'i', 'aria-hidden': 'true' }, sv('path', { d: PATHS[name] || '' }));
}
A.h = h; A.sv = sv; A.icon = icon;

function pad(n) { return (n < 10 ? '0' : '') + n; }
A.pad = pad;
A.day = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
A.dateOf = function (key) { var p = String(key).split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
A.hm = function (t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
A.DAYS = DAYS;
A.when = function (t) {
  var d = new Date(t), now = new Date();
  if (A.day(d) === A.day(now)) return 'Today ' + A.hm(t);
  var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (A.day(d) === A.day(y)) return 'Yesterday ' + A.hm(t);
  return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
};
A.fmt = function (n, dp) {
  if (n === null || n === undefined || !isFinite(n)) return '–';
  return Number(n).toLocaleString('en-GB', { maximumFractionDigits: dp === undefined ? 2 : dp });
};
A.money = function (n) {
  if (n === null || n === undefined || !isFinite(n)) return '–';
  var s = Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '−£' : '£') + s;
};
A.parse = function (s) {
  var v = parseFloat(String(s === undefined || s === null ? '' : s).replace(/[£,\s]/g, ''));
  return isFinite(v) ? v : null;
};
A.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
A.plural = function (n, one, many) { return n === 1 ? one : many; };

// ── saved state: on this phone only ──
function readAll() {
  try { var raw = W.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
  catch (e) { A.saving = false; return null; }
}
function writeAll() {
  var text = JSON.stringify({ v: 1, s: A.state, p: A.prefs, at: Date.now() });
  if (text.length > LIMIT) { toast('Full: clear some old entries so new ones are kept.'); return false; }
  try { W.localStorage.setItem(KEY, text); A.saving = true; return true; }
  catch (e) { A.saving = false; status(); return false; }
}
A.save = writeAll;

// ── UNDO: a destructive change keeps what was there until the toast goes ──
var undoSnap = null, toastTimer = 0;
function undo() {
  if (undoSnap === null) return;
  A.state = JSON.parse(undoSnap);
  undoSnap = null;
  writeAll();
  render();
  toast('Put back');
}
/** Change the state, save it and draw again. With undoable, the toast offers UNDO. fn returning false: nothing changed. */
A.act = function (label, fn, undoable) {
  var before = JSON.stringify(A.state);
  var r = fn(A.state);
  if (r === false) return false;
  writeAll();
  render();
  if (undoable) { undoSnap = before; toast(label, true); }
  else if (label) toast(label);
  else if (undoSnap !== null) {
    // anything changed after a delete: UNDO would take that back too, so it is no longer offered
    undoSnap = null;
    var u = TOAST.querySelector('.tundo');
    if (u) u.remove();
  }
  return r;
};
function toast(msg, withUndo) {
  if (!withUndo) undoSnap = null;
  TOAST.replaceChildren(h('span.tmsg', { text: msg }));
  if (withUndo) TOAST.append(h('button.tundo', { type: 'button', text: 'UNDO', onclick: undo }));
  TOAST.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { TOAST.classList.remove('on'); if (withUndo) undoSnap = null; }, withUndo ? 6000 : 2200);
}
A.toast = toast;

// ── the bottom sheet ──
function closeSheet() { if (SHEET.open && SHEET.close) SHEET.close(); else SHEET.removeAttribute('open'); }
A.sheet = function (title, body, onClose) {
  SHEET.replaceChildren(
    h('div.shead', null, h('h2', { text: title }), h('button.gbtn', { type: 'button', 'aria-label': 'Close', onclick: closeSheet }, icon('x'))),
    h('div.sbody', null, body)
  );
  SHEET.onclose = function () { if (onClose) onClose(); };
  if (SHEET.showModal) { if (!SHEET.open) SHEET.showModal(); } else SHEET.setAttribute('open', '');
};
A.closeSheet = closeSheet;
SHEET.addEventListener('click', function (e) { if (e.target === SHEET) closeSheet(); });

// ── small parts every shape uses ──
A.btn = function (label, onclick, cls, extra) {
  var p = { type: 'button', onclick: onclick };
  if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
  return h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), p, label);
};
A.card = function (cls) { var kids = [].slice.call(arguments, 1); return h('section.card' + (cls ? '.' + cls : ''), null, kids); };
A.kick = function (text, right) { return h('div.kickrow', null, h('p.kick', { text: text }), right || null); };
A.empty = function (text) { return h('p.empty', { text: text }); };
A.field = function (label, input) { return h('label.field', null, h('span.flabel', { text: label }), input); };
A.input = function (props) {
  var p = { type: 'text', autocomplete: 'off' };
  Object.keys(props || {}).forEach(function (k) { p[k] = props[k]; });
  return h('input', p);
};
A.number = function (props) {
  var p = { type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'done' };
  Object.keys(props || {}).forEach(function (k) { p[k] = props[k]; });
  return h('input.numin', p);
};
A.seg = function (options, current, onpick, label) {
  return h('div.seg', { role: 'group', 'aria-label': label || 'Choose' }, options.map(function (o) {
    var on = o[0] === current;
    return h('button' + (on ? '.on' : ''), { type: 'button', 'aria-pressed': on ? 'true' : 'false', text: o[1], onclick: function () { onpick(o[0]); } });
  }));
};
/** A progress ring (0–1) with whatever goes in its middle. */
A.ring = function (frac, inner, size) {
  size = size || 220;
  var r = 46, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
  return h('div.ring', { style: 'width:' + size + 'px;height:' + size + 'px' },
    sv('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      sv('circle', { cx: 50, cy: 50, r: r, 'class': 'rtrack' }),
      sv('circle', { cx: 50, cy: 50, r: r, 'class': 'rfill', 'stroke-dasharray': c.toFixed(2), 'stroke-dashoffset': (c * (1 - f)).toFixed(2) })),
    h('div.rin', null, inner));
};
A.ringSet = function (ringEl, frac) {
  var circ = ringEl.querySelector('.rfill');
  if (!circ) return;
  var c = 2 * Math.PI * 46;
  circ.setAttribute('stroke-dashoffset', (c * (1 - Math.max(0, Math.min(1, frac || 0)))).toFixed(2));
};
`;

/** The end of every script: start-up, the install hint, offline, the status line and the day watcher. */
export const CORE_BOOT = String.raw`
// ── the status line under the app ──
function status() {
  var el = D.getElementById('app-status');
  var saved = A.saving ? 'Saved on this phone' : 'Not saving in this browser (private browsing?): changes last until you close it';
  var off = A.offline === 'yes' ? 'Works offline' : A.offline === 'no' ? 'Needs a connection to open' : 'Getting ready to work offline…';
  el.textContent = saved + ' · ' + off;
}
A.status = status;

function render() {
  var kids = SHAPE.view(A).filter(Boolean);
  MAIN.replaceChildren.apply(MAIN, kids);
  status();
}
A.render = render;

// ── put it on the Home Screen ──
var deferred = null;
function standalone() {
  return (W.matchMedia && W.matchMedia('(display-mode: standalone)').matches) || W.navigator.standalone === true;
}
function hint() {
  var el = D.getElementById('app-hint');
  if (standalone() || A.prefs.hint === 'off') { el.hidden = true; return; }
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var dismiss = function () { A.prefs.hint = 'off'; writeAll(); hint(); };
  var kids = [h('p.kick', { text: 'Put it on your Home Screen' })];
  if (deferred) {
    kids.push(h('p.hintp', { text: 'It opens full screen from its own icon and works offline.' }),
      h('div.row', null, A.btn('INSTALL', function () {
        var d = deferred;
        deferred = null;
        d.prompt();
        if (d.userChoice) d.userChoice.then(function () { hint(); });
      }), A.btn('NOT NOW', dismiss, 'ghost')));
  } else if (ios) {
    kids.push(h('p.hintp', null, 'In Safari, tap ', h('span.sharei', null, icon('share')), ' Share, then ', h('b', { text: 'Add to Home Screen' }), '. It opens full screen from its own icon and works offline.'),
      A.btn('GOT IT', dismiss, 'ghost sm'));
  } else {
    kids.push(h('p.hintp', { text: "Open your browser's menu and choose Install app (or Add to Home screen). It opens full screen from its own icon and works offline." }),
      A.btn('GOT IT', dismiss, 'ghost sm'));
  }
  el.replaceChildren.apply(el, kids);
  el.hidden = false;
}
W.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; hint(); });
W.addEventListener('appinstalled', function () { A.prefs.hint = 'off'; writeAll(); hint(); });

// ── offline: a tiny service worker keeps this page (and only this page) on the phone ──
function offline() {
  var base = CFG.base;
  if (location.pathname === base.slice(0, -1)) {
    try { history.replaceState(null, '', base + location.search + location.hash); } catch (e) { /* stays as it is */ }
  }
  if (!('serviceWorker' in navigator) || location.pathname.indexOf(base) !== 0) { A.offline = 'no'; status(); return; }
  // (not navigator.serviceWorker.ready: a page first opened as /s/<name>, without the slash, is outside the scope until it reloads)
  navigator.serviceWorker.register(base + 'page', { scope: base }).then(function (reg) {
    var on = function () { A.offline = 'yes'; status(); };
    if (reg.active) return on();
    var sw = reg.installing || reg.waiting;
    if (sw) sw.addEventListener('statechange', function () { if (sw.state === 'activated') on(); else if (sw.state === 'redundant') { A.offline = 'no'; status(); } });
  }, function () { A.offline = 'no'; status(); });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* the browser decides */ });
}

function about() {
  return [
    h('p.kick', { text: 'What it does' }), h('p.aboutp', { text: CFG.does }),
    h('p.kick', { text: 'What it saves' }), h('p.aboutp', { text: CFG.saves }),
    h('p.aboutp.mute', { text: "A mini-app on your Ghosty, not an App Store app: it works offline once opened, but it can't send notifications or do anything while it is closed. Nothing you add is sent anywhere." }),
    A.btn('ERASE EVERYTHING', function () {
      closeSheet();
      A.act('Erased', function () { A.state = SHAPE.init(CFG); }, true);
    }, 'ghost danger')
  ];
}
function settings() {
  A.sheet('Settings', [SHAPE.settings ? SHAPE.settings(A) : null, h('div.about', null, about())], render);
}

// ── start ──
(function boot() {
  var saved = readAll();
  A.prefs = (saved && saved.p) || {};
  var s = saved && saved.v === 1 && saved.s ? SHAPE.fix(saved.s, CFG) : null;
  A.state = s || SHAPE.init(CFG);
  D.getElementById('app-set').addEventListener('click', settings);
  render();
  hint();
  offline();
  if (SHAPE.start) SHAPE.start(A);
  var lastDay = A.day();
  var beat = function () {
    var k = A.day();
    if (k !== lastDay) { lastDay = k; render(); }
    if (SHAPE.tick) SHAPE.tick(A);
  };
  setInterval(beat, SHAPE.fast ? 250 : 1000);
  D.addEventListener('visibilitychange', function () { if (!D.hidden) { beat(); render(); } });
  W.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    var again = readAll();
    if (again && again.s) { A.state = SHAPE.fix(again.s, CFG) || A.state; render(); }
  });
  W.addEventListener('error', function (e) { toast('Something went wrong: ' + String(e.message || 'a script error').slice(0, 120)); });
})();
`;
