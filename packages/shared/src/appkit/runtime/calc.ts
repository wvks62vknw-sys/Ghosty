/**
 * The calculator: tips and splitting the bill (in pence, so it always adds up), units (length, weight,
 * cooking volumes in UK measures, temperature, speed), fuel cost in miles per (UK) gallon, VAT, loan
 * repayments and percentages. The last inputs are kept, and a result can be saved to a short history
 * (delete and CLEAR with UNDO). LOGIC is pure; VIEW draws it and updates the answer as you type.
 */
export const LOGIC = String.raw`var L = {
  /** Bill and tip in pence; people never pay a penny too little: the pennies left over are said. */
  tip: function (bill, pct, people, roundUp) {
    if (!(bill > 0)) return null;
    people = Math.max(1, Math.floor(people || 1));
    pct = Math.max(0, pct || 0);
    var billP = Math.round(bill * 100), tipP = Math.round(billP * pct / 100), totalP = billP + tipP;
    if (roundUp) { totalP = Math.ceil(totalP / people / 100) * 100 * people; tipP = totalP - billP; }
    var base = Math.floor(totalP / people), extra = totalP - base * people;
    return { tip: tipP / 100, total: totalP / 100, each: base / 100, extra: extra, people: people };
  },
  UNITS: {
    length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, 'in': 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
    weight: { g: 0.001, kg: 1, oz: 0.028349523125, lb: 0.45359237, st: 6.35029318 },
    volume: { ml: 0.001, l: 1, tsp: 0.005, tbsp: 0.015, cup: 0.25, 'fl oz': 0.0284130625, pint: 0.56826125, gal: 4.54609 },
    temperature: { C: 1, F: 1, K: 1 },
    speed: { 'km/h': 1 / 3.6, mph: 0.44704, 'm/s': 1, knot: 0.5144444444 }
  },
  convert: function (v, from, to, cat) {
    if (typeof v !== 'number' || !isFinite(v)) return null;
    if (cat === 'temperature') {
      var c = from === 'C' ? v : from === 'F' ? (v - 32) * 5 / 9 : v - 273.15;
      return to === 'C' ? c : to === 'F' ? c * 9 / 5 + 32 : c + 273.15;
    }
    var t = L.UNITS[cat];
    if (!t || !(from in t) || !(to in t)) return null;
    return v * t[from] / t[to];
  },
  /** Miles at so many miles per UK gallon, at a pump price in pence a litre. */
  fuel: function (miles, mpg, ppl) {
    if (!(miles > 0) || !(mpg > 0)) return null;
    var litres = miles / mpg * 4.54609;
    return { litres: litres, cost: ppl > 0 ? litres * ppl / 100 : null, perMile: ppl > 0 ? litres * ppl / 100 / miles : null };
  },
  vat: function (amount, rate, add) {
    if (!(amount >= 0) || !(rate >= 0)) return null;
    var r = rate / 100;
    if (add) return { net: amount, vat: amount * r, gross: amount * (1 + r) };
    var net = amount / (1 + r);
    return { net: net, vat: amount - net, gross: amount };
  },
  /** A repayment loan: the monthly payment, what it all costs and the interest in it. */
  loan: function (principal, apr, years) {
    if (!(principal > 0) || !(years > 0) || !(apr >= 0)) return null;
    var n = Math.round(years * 12), r = apr / 100 / 12;
    var m = r ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n;
    return { monthly: m, total: m * n, interest: m * n - principal, months: n };
  },
  pct: function (mode, a, b) {
    if (typeof a !== 'number' || typeof b !== 'number') return null;
    if (mode === 'of') return a / 100 * b;
    if (mode === 'is') return b ? a / b * 100 : null;
    return a ? (b - a) / Math.abs(a) * 100 : null;
  }
};
`;

export const VIEW = String.raw`var CATS = { length: ['Length', 'cm', 'in'], weight: ['Weight', 'kg', 'lb'], volume: ['Cooking', 'ml', 'cup'], temperature: ['Temperature', 'C', 'F'], speed: ['Speed', 'mph', 'km/h'] };
var NAMES = { mm: 'millimetres', cm: 'centimetres', m: 'metres', km: 'kilometres', 'in': 'inches', ft: 'feet', yd: 'yards', mi: 'miles', g: 'grams', kg: 'kilograms', oz: 'ounces', lb: 'pounds', st: 'stone', ml: 'millilitres', l: 'litres', tsp: 'teaspoons', tbsp: 'tablespoons', cup: 'cups (250 ml)', 'fl oz': 'fluid ounces (UK)', pint: 'pints (UK)', gal: 'gallons (UK)', C: '°C', F: '°F', K: 'kelvin', 'km/h': 'km/h', mph: 'mph', 'm/s': 'm/s', knot: 'knots' };
function line(label, value, big) { return A.h('div.res' + (big ? '.main' : ''), null, A.h('span', { text: label }), A.h('b.num', { text: value })); }
var SHAPE = {
  init: function (cfg) {
    return { kind: cfg.calc.kind, tip: { bill: '', pct: 12.5, people: 2, round: false }, units: { cat: 'length', from: 'cm', to: 'in', v: '' }, fuel: { miles: '', mpg: 45, ppl: 140 }, vat: { amount: '', rate: 20, add: true }, loan: { p: '', apr: 5, years: 25 }, pct: { mode: 'of', a: '', b: '' }, saved: [] };
  },
  fix: function (s, cfg) { if (!s || !Array.isArray(s.saved)) return null; var d = SHAPE.init(cfg); Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; }); return s; },
  /** The answer for the inputs as they are now: lines to show and one line to save. */
  answer: function (A) {
    var s = A.state, p = A.parse;
    if (s.kind === 'tip') {
      var t = s.tip, r = L.tip(p(t.bill), p(t.pct), p(t.people), t.round);
      if (!r) return null;
      var lines = [line(r.people > 1 ? 'Each person pays' : 'To pay', A.money(r.each), true)];
      if (r.extra) lines.push(line('So it adds up', r.extra + ' of you ' + A.plural(r.extra, 'pays', 'pay') + ' 1p more (' + A.money(r.each + 0.01) + ')'));
      lines.push(line('Tip', A.money(r.tip)), line('Total', A.money(r.total)));
      return { lines: lines, save: A.money(r.total) + ' with a ' + A.fmt(p(t.pct), 1) + '% tip' + (r.people > 1 ? ': ' + A.money(r.each) + ' each for ' + r.people + (r.extra ? ' (' + r.extra + ' pay 1p more)' : '') : '') };
    }
    if (s.kind === 'units') {
      var u = s.units, v = p(u.v), out = L.convert(v, u.from, u.to, u.cat);
      if (out === null) return null;
      var txt = A.fmt(out, Math.abs(out) < 10 ? 3 : 2) + ' ' + NAMES[u.to];
      return { lines: [line(A.fmt(v, 3) + ' ' + NAMES[u.from] + ' is', txt, true)], save: A.fmt(v, 3) + ' ' + NAMES[u.from] + ' = ' + txt };
    }
    if (s.kind === 'fuel') {
      var f = s.fuel, x = L.fuel(p(f.miles), p(f.mpg), p(f.ppl));
      if (!x) return null;
      return { lines: [line('Fuel cost', x.cost === null ? '–' : A.money(x.cost), true), line('Fuel', A.fmt(x.litres, 1) + ' litres'), line('Per mile', x.perMile === null ? '–' : A.fmt(x.perMile * 100, 1) + 'p')], save: A.fmt(p(f.miles), 0) + ' miles at ' + A.fmt(p(f.mpg), 0) + ' mpg: ' + (x.cost === null ? A.fmt(x.litres, 1) + ' litres' : A.money(x.cost)) };
    }
    if (s.kind === 'vat') {
      var w = s.vat, y = L.vat(p(w.amount), p(w.rate), w.add);
      if (!y) return null;
      return { lines: [line(w.add ? 'With VAT' : 'Without VAT', A.money(w.add ? y.gross : y.net), true), line('VAT', A.money(y.vat)), line(w.add ? 'Without VAT' : 'With VAT', A.money(w.add ? y.net : y.gross))], save: A.money(y.net) + ' + ' + A.fmt(p(w.rate), 1) + '% VAT ' + A.money(y.vat) + ' = ' + A.money(y.gross) };
    }
    if (s.kind === 'loan') {
      var l = s.loan, z = L.loan(p(l.p), p(l.apr), p(l.years));
      if (!z) return null;
      return { lines: [line('Each month', A.money(z.monthly), true), line('Paid back in all', A.money(z.total)), line('Of which interest', A.money(z.interest))], save: A.money(p(l.p)) + ' over ' + A.fmt(p(l.years), 1) + ' years at ' + A.fmt(p(l.apr), 2) + '%: ' + A.money(z.monthly) + ' a month' };
    }
    var q = s.pct, a = p(q.a), b = p(q.b), res = L.pct(q.mode, a, b);
    if (res === null || !isFinite(res)) return null;
    var label = q.mode === 'of' ? A.fmt(a, 2) + '% of ' + A.fmt(b, 2) + ' is' : q.mode === 'is' ? A.fmt(a, 2) + ' is this much of ' + A.fmt(b, 2) : 'From ' + A.fmt(a, 2) + ' to ' + A.fmt(b, 2) + ' is';
    var val = q.mode === 'of' ? A.fmt(res, 2) : (q.mode === 'change' && res > 0 ? '+' : '') + A.fmt(res, 2) + '%';
    return { lines: [line(label, val, true)], save: label + ' ' + val };
  },
  view: function (A) {
    var s = A.state, h = A.h, k = s.kind;
    var out = h('div.results', { 'aria-live': 'polite' });
    var show = function () {
      var r = SHAPE.answer(A);
      out.replaceChildren.apply(out, r ? r.lines : [A.empty('Fill in the numbers above.')]);
    };
    var bind = function (obj, key, label, props) {
      var el = A.number(Object.assign({ value: obj[key], 'aria-label': label }, props || {}));
      el.addEventListener('input', function () { obj[key] = el.value; show(); A.save(); });
      return A.field(label, el);
    };
    var form;
    if (k === 'tip') {
      var t = s.tip;
      form = [bind(t, 'bill', 'Bill (£)', { placeholder: '0.00' }),
        A.field('Tip', A.seg([[0, 'None'], [10, '10%'], [12.5, '12.5%'], [15, '15%'], [20, '20%']], A.parse(t.pct), function (v) { A.act('', function (st) { st.tip.pct = v; }); }, 'Tip')),
        h('div.row.people', null, h('span.flabel', { text: 'People' }),
          h('button.gbtn', { type: 'button', 'aria-label': 'One fewer person', onclick: function () { A.act('', function (st) { st.tip.people = Math.max(1, (A.parse(st.tip.people) || 1) - 1); }); } }, A.icon('minus')),
          h('b.num.pcount', { text: String(A.parse(t.people) || 1) }),
          h('button.gbtn', { type: 'button', 'aria-label': 'One more person', onclick: function () { A.act('', function (st) { st.tip.people = Math.min(50, (A.parse(st.tip.people) || 1) + 1); }); } }, A.icon('plus'))),
        A.field('Round each share up to the next pound', A.seg([[false, 'No'], [true, 'Yes']], !!t.round, function (v) { A.act('', function (st) { st.tip.round = v; }); }, 'Round up'))];
    } else if (k === 'units') {
      var u = s.units, keys = Object.keys(L.UNITS[u.cat]);
      var pick = function (key, label) {
        var sel = h('select', { 'aria-label': label, onchange: function () { A.act('', function (st) { st.units[key] = sel.value; }); } }, keys.map(function (x) { return h('option', { value: x, text: NAMES[x], selected: x === u[key] }); }));
        return A.field(label, sel);
      };
      form = [A.field('Measure', h('select', { 'aria-label': 'Measure', onchange: function (e) { var c = e.target.value; A.act('', function (st) { st.units.cat = c; st.units.from = CATS[c][1]; st.units.to = CATS[c][2]; }); } }, Object.keys(CATS).map(function (c) { return h('option', { value: c, text: CATS[c][0], selected: c === u.cat }); }))),
        bind(u, 'v', 'Amount', { placeholder: '0' }),
        h('div.row.two', null, pick('from', 'From'), h('button.gbtn.swap', { type: 'button', 'aria-label': 'Swap', onclick: function () { A.act('', function (st) { var x = st.units.from; st.units.from = st.units.to; st.units.to = x; }); } }, A.icon('swap')), pick('to', 'To'))];
    } else if (k === 'fuel') {
      var f = s.fuel;
      form = [bind(f, 'miles', 'Distance (miles)', { placeholder: '0' }), h('div.row.two', null, bind(f, 'mpg', 'Miles per gallon'), bind(f, 'ppl', 'Price (pence a litre)'))];
    } else if (k === 'vat') {
      var w = s.vat;
      form = [bind(w, 'amount', 'Amount (£)', { placeholder: '0.00' }),
        A.field('The amount is', A.seg([[true, 'Before VAT'], [false, 'With VAT']], !!w.add, function (v) { A.act('', function (st) { st.vat.add = v; }); }, 'Amount is')),
        bind(w, 'rate', 'VAT rate (%)')];
    } else if (k === 'loan') {
      var l = s.loan;
      form = [bind(l, 'p', 'Amount borrowed (£)', { placeholder: '0' }), h('div.row.two', null, bind(l, 'apr', 'Interest a year (%)'), bind(l, 'years', 'Years'))];
    } else {
      var q = s.pct;
      form = [A.field('Work out', A.seg([['of', 'X% of Y'], ['is', 'X is ?% of Y'], ['change', 'Change X → Y']], q.mode, function (v) { A.act('', function (st) { st.pct.mode = v; }); }, 'Work out')),
        h('div.row.two', null, bind(q, 'a', 'X', { placeholder: '0' }), bind(q, 'b', 'Y', { placeholder: '0' }))];
    }
    show();
    var card = A.card('calc', h('div.form', null, form), out,
      h('div.row', null, A.btn('SAVE', function () {
        var r = SHAPE.answer(A);
        if (!r) { A.toast('Fill in the numbers first'); return; }
        A.act('Saved below', function (st) { st.saved.unshift({ id: A.uid(), text: r.save, at: Date.now() }); st.saved = st.saved.slice(0, 50); });
      }, 'ghost')));
    if (k === 'loan') card.append(h('p.note', { text: 'A guide for a repayment loan at a fixed rate. Your lender’s figures may differ (fees, rate changes).' }));
    var saved = s.saved.length ? A.card('', A.kick('Saved', A.btn('CLEAR', function () { A.act('Cleared', function (st) { st.saved = []; }, true); }, 'ghost sm')),
      h('ul.rows', null, s.saved.map(function (x) {
        return h('li.rowi', null, h('span.what', { text: x.text }), h('span.when', { text: A.when(x.at) }),
          h('button.gbtn.del', { type: 'button', 'aria-label': 'Delete', onclick: function () { A.act('Deleted', function (st) { st.saved = st.saved.filter(function (y) { return y.id !== x.id; }); }, true); } }, A.icon('trash')));
      }))) : null;
    return [card, saved];
  }
};
`;
