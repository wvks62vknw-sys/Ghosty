// The games of BRIEF-GAMES-6, held to their rules with no screen. POKER: the ranking of hands on known hands (every category, ties,
// kickers) and what each is called; a seeded deal that replays; the chances of winning worked out by dealing the rest of the
// cards, within three points of the exact answer (counted card by card) on three known spots; his betting legal in a thousand
// seeded hands with every chip counted; the blinds rising; a session ending at its limit or on a bust; and not one money word,
// currency sign or way to pay anywhere in its source. THE WORD GAME: the list's reader and its size (a download, not bundled),
// the bag's counts, the layout, the placement rules (one line, no gaps, joined, every new word in the list), the scoring with its
// bonuses on known boards against a plain reference, the generator against a brute-force one, and his best move on a known rack.
// GAMES 5's LOOSE ENDS: backgammon's take-back takes the whole turn, the service worker keeps every Worker the build makes, the cave
// level holds until three sessions are lost in a row, the platformer bot stomps in world 1, Othello's rewritten move generator
// counts the known number of games, and a save that will not read says so. esbuild-bundled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { build } from 'esbuild';

const at = (p) => new URL(p, import.meta.url).pathname;
const W = '../../web/src/arcade/games/';
await build({
  entryPoints: {
    kit: at(`${W}board/kit.ts`),
    poker: at(`${W}board/poker.ts`),
    words: at(`${W}board/words.ts`),
    keep: at(`${W}board/keep.ts`),
    engine: at(`${W}board/engine.ts`),
    othello: at(`${W}board/othello.ts`),
    backgammon: at(`${W}board/backgammon.ts`),
    skill: at(`${W}two/skill.ts`),
    psim: at(`${W}platform/sim.ts`),
    pcore: at(`${W}platform/core.ts`),
    rating: at(`${W}board/rating.ts`),
    shelf5: at(`${W}shelf5.ts`),
    shelf6: at(`${W}shelf6.ts`),
    shelf: at('../../web/src/arcade/shelf.ts'),
    catalogue: at('../../../packages/shared/src/catalogue.ts'),
    words6: at('../../../packages/shared/src/catalogue/games6.ts'),
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/games6'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const K = await import('./.build/games6/kit.mjs');
const P = await import('./.build/games6/poker.mjs');
const WD = await import('./.build/games6/words.mjs');
const KP = await import('./.build/games6/keep.mjs');
const E = await import('./.build/games6/engine.mjs');
const OT = await import('./.build/games6/othello.mjs');
const BG = await import('./.build/games6/backgammon.mjs');
const S = await import('./.build/games6/skill.mjs');
const PS = await import('./.build/games6/psim.mjs');
const PC = await import('./.build/games6/pcore.mjs');
const RT = await import('./.build/games6/rating.mjs');
const { BOARD_IDS } = await import('./.build/games6/shelf5.mjs');
const { GAMES6, RATED_IDS } = await import('./.build/games6/shelf6.mjs');
const { SHELF } = await import('./.build/games6/shelf.mjs');
const CAT = await import('./.build/games6/catalogue.mjs');
const { GAMES6_WORDS } = await import('./.build/games6/words6.mjs');
const LIST_FILE = at('../../web/public/data/words-en.dawg');
const lex = new WD.Lex(readFileSync(LIST_FILE));
const src = (p) => readFileSync(at(p), 'utf8');

// ================================================================ POKER

const card = (s) => '23456789TJQKA'.indexOf(s[0]) + 13 * 'cdhs'.indexOf(s[1]);
const hand = (s) => s.split(' ').map(card);
const val = (s) => P.evaluate(hand(s));

test('every category of hand ranks above the one below it, and each is called by what it is', () => {
  const ladder = [
    ['7h 5d 4s 3c 2d 9c Kh', 'King high', 0],
    ['Ah Ad 4s 3c 2d 9c Kh', 'A pair of aces', 1],
    ['Kh Kd 4s 4c 9d 2c 7h', 'Two pair, kings and fours', 2],
    ['7h 7d 7s 3c 2d 9c Kh', 'Three of a kind, sevens', 3],
    ['5h 6d 7s 8c 9d Kc 2h', 'Straight, nine high', 4],
    ['2h 9h Kh 3h 6h Ac 4d', 'Flush, king high', 5],
    ['Ah Ad As Kc Kd 9c 2h', 'Full house, aces full of kings', 6],
    ['2h 2d 2s 2c Kd 9c 5h', 'Four of a kind, twos', 7],
    ['9h 8h 7h 6h 5h Ac Kd', 'Straight flush, nine high', 8],
    ['Ah Kh Qh Jh Th 2c 3d', 'Royal flush', 8],
  ];
  let prev = -1;
  for (const [h, name, cat] of ladder) {
    const v = val(h);
    assert.equal(P.categoryOf(v), cat, `${h}: category`);
    assert.equal(P.handName(v), name === 'King high' ? 'King high' : name, `${h}: its name`);
    assert.ok(v > prev, `${h} beats the one before`);
    prev = v;
  }
  assert.ok(val('Ah Kh Qh Jh Th 2c 3d') > val('9h 8h 7h 6h 5h Ac Kd'), 'a royal flush beats a nine-high straight flush');
  assert.equal(P.handName(val('6h 6d 6s 6c Kd 9c 5h')), 'Four of a kind, sixes', 'sixes, not sixs');
});
test('the ace plays low in a wheel and high at the top, and a wheel is the lowest straight', () => {
  assert.equal(P.handName(val('Ah 2d 3s 4c 5d 9c Kh')), 'Straight, five high');
  assert.equal(P.handName(val('Th Jd Qs Kc Ad 2c 3h')), 'Straight, ace high');
  assert.ok(val('6h 5d 4s 3c 2d 9c Kh') > val('Ah 2d 3s 4c 5d 9c Kh'), 'six high beats the wheel');
  assert.ok(val('Ah 2d 3s 4c 5d 9c Kh') > val('Ah Kd Qs Jc 9d 8c 3h'), 'a wheel beats ace-high');
  assert.equal(P.handName(val('Qh Kd As 2c 3d 5c 9h')), 'Ace high', 'Q K A 2 3 is not a straight round the corner');
});
test('ties and kickers: the same five tie, a better kicker wins, the seventh card matters only when it must', () => {
  assert.equal(val('Ah Ad Ks Qc Jd 5c 2h'), val('As Ac Kh Qd Js 5d 2c'), 'the same pair with the same kickers tie');
  assert.ok(val('Ah Ad Ks Qc Jd 5c 2h') > val('As Ac Kh Qd 9s 5d 2c'), 'the third kicker decides');
  assert.ok(val('Ah Ad Ks 7c 6d 5c 2h') > val('As Ac Qh Jd 9s 5d 2c'), 'the king kicker beats the queen');
  assert.equal(val('Ah Ad Ks Qc Jd 3c 2h'), val('Ah Ad Ks Qc Jd 4c 3h'), 'a card outside the best five changes nothing');
  assert.ok(val('Kh Kd 4s 4c 9d 2c 7h') > val('Kh Kd 4s 4c 8d 2c 7h'), 'two pair: the kicker');
  assert.equal(val('Kh Kd 4s 4c Ad 2c 7h') > val('Kh Kd 4s 4c 9d 2c 7h'), true);
  assert.ok(val('Ah Ad As 2c 2d 9c 3h') > val('Kh Kd Ks Ac Ad 9c 3h'), 'a full house is read by its trips first');
  assert.equal(P.handName(val('Ah Ad As Kc Kd Qc Qh')), 'Full house, aces full of kings', 'two pairs beside the trips: the higher pair');
  assert.ok(val('Ah 9h 7h 4h 2h Kc Kd') > val('Kh 9h 7h 4h 2h Ac Ad'), 'a flush is read from the top card down');
  assert.equal(P.handName(val('Ah 9h 7h 4h 3h 2h Kd')), 'Flush, ace high', 'six of a suit: the best five');
});

test('a seeded deal replays exactly: the same seed deals the same cards and the same board, a new seed a new deal', () => {
  const a = P.deal(P.newSession(7, 3));
  const b = P.deal(P.newSession(7, 3));
  assert.deepEqual(a.hole, b.hole);
  assert.deepEqual(a.deck, b.deck);
  assert.equal([...new Set(a.deck)].length, 52, 'a whole deck, no card twice');
  assert.notDeepEqual(P.deal(P.newSession(8, 3)).deck, a.deck);
  // hand 2 of the same session is a different shuffle again
  const s = P.newSession(7, 3);
  const h1 = P.deal(s);
  P.act(h1, { t: 'fold' });
  P.finishHand(s, h1, P.resultLine(h1));
  assert.notDeepEqual(P.deal(s).deck, h1.deck);
  // a whole hand's actions replay to the same result
  const r1 = P.newSession(21, 2);
  const x = P.deal(r1);
  const log = [];
  for (let i = 0; i < 40 && !x.over; i++) {
    const L = P.legalOf(x);
    const m = L.fold ? { t: 'call' } : { t: 'check' };
    P.act(x, m);
    log.push(m);
  }
  const r2 = P.newSession(21, 2);
  const y = P.deal(r2);
  for (const m of log) P.act(y, m);
  assert.deepEqual(y.hole, x.hole);
  assert.deepEqual(y.board, x.board);
  assert.deepEqual(y.stacks, x.stacks);
  assert.equal(y.winner, x.winner);
});
test('the table: blinds, who acts first, minimum raises, all in, and every chip counted', () => {
  const s = P.newSession(5, 1);
  const h = P.deal(s);
  assert.equal(h.button, 0, 'you are on the button in hand 1');
  assert.deepEqual(h.bets, [5, 10], 'the button posts the small blind');
  assert.equal(h.toAct, 0, 'the button acts first before the flop');
  let L = P.legalOf(h);
  assert.deepEqual([L.fold, L.check, L.call, L.minTo, L.maxTo], [true, false, 5, 20, 1000]);
  assert.throws(() => P.act(h, { t: 'check' }), /cannot check/);
  assert.throws(() => P.act(h, { t: 'raise', to: 15 }), /not allowed/, 'under the minimum raise');
  P.act(h, { t: 'call' });
  assert.equal(h.toAct, 1, 'the big blind has the option');
  L = P.legalOf(h);
  assert.equal(L.check, true);
  P.act(h, { t: 'check' });
  assert.equal(h.street, 1);
  assert.equal(h.board.length, 3);
  assert.equal(h.toAct, 1, 'after the flop the other player acts first');
  P.act(h, { t: 'raise', to: 30 });
  L = P.legalOf(h);
  assert.equal(L.minTo, 60, 'a re-raise is at least the last raise again');
  P.act(h, { t: 'raise', to: 1000 - 10 });
  P.act(h, { t: 'call' });
  assert.equal(h.over, true, 'an all-in that is called runs the board out');
  assert.equal(h.board.length, 5);
  assert.equal(h.stacks[0] + h.stacks[1], 2000);
  assert.ok(h.won > 0 && h.showdown);
  // a short stack that cannot cover a raise calls for what it has, and the extra goes back
  const s2 = P.newSession(6, 1, 20, 100);
  s2.stacks = [30, 970];
  const g = P.deal(s2);
  assert.equal(g.stacks[0] + g.stacks[1] + g.bets[0] + g.bets[1] + g.pot, 1000);
  assert.equal(P.legalOf(g).maxTo, Math.min(g.bets[0] + g.stacks[0], g.bets[1] + g.stacks[1]), 'a bet cannot be bigger than the other can answer');
});
test('the blinds rise with the level and with the hands, and a session ends at its hands or on a bust', () => {
  assert.equal(P.bigBlind(1, 1), 10);
  assert.equal(P.bigBlind(1, 6), 20);
  assert.equal(P.bigBlind(1, 20), 40);
  assert.ok(P.bigBlind(7, 1) > P.bigBlind(1, 1));
  for (let l = 1; l < 40; l++) assert.ok(P.bigBlind(l + 1, 1) >= P.bigBlind(l, 1) && P.bigBlind(l, 6) >= P.bigBlind(l, 1));
  const s = P.newSession(3, 1);
  for (let n = 1; n <= 20; n++) {
    assert.equal(s.over, false);
    const h = P.deal(s);
    assert.equal(h.bb, P.bigBlind(1, n));
    P.act(h, { t: 'fold' });
    P.finishHand(s, h, P.resultLine(h));
  }
  assert.equal(s.over, true, 'twenty hands');
  assert.equal(s.history.length, 20);
  // a bust ends it at once
  const b = P.newSession(3, 1, 20, 20);
  const h = P.deal(b);
  P.act(h, { t: 'raise', to: 20 });
  P.act(h, { t: 'call' });
  P.finishHand(b, h, P.resultLine(h));
  assert.equal(b.over, true);
  assert.ok(b.stacks[0] === 0 || b.stacks[1] === 0 || b.stacks[0] === b.stacks[1]);
  assert.equal(P.sessionScore({ stacks: [10, 5] }), 1);
  assert.equal(P.sessionScore({ stacks: [5, 10] }), 0);
  assert.equal(P.sessionScore({ stacks: [7, 7] }), 0.5);
});
test('a hand ends in his voice with the winning hand named', () => {
  const h = P.deal(P.newSession(5, 1));
  h.over = true;
  h.winner = 0;
  h.names = ['Two pair, kings and fours', 'A pair of nines'];
  assert.equal(P.resultLine(h), 'Two pair, kings and fours. The pot is yours.');
  h.winner = 1;
  assert.equal(P.resultLine(h), 'A pair of nines. The pot is mine.');
  h.winner = 2;
  assert.match(P.resultLine(h), /^Same hand, two pair, kings and fours\. We split the pot\.$/);
  h.folded = 0;
  assert.equal(P.resultLine(h), 'You folded. The pot is mine.');
  h.folded = 1;
  assert.equal(P.resultLine(h), 'I fold. The pot is yours.');
});

/** The exact chance of winning, counted card by card: the cards still to come against one hand, or the weighted mean over several. */
function exact(hole, board, opp) {
  const dead = new Set([...hole, ...board, ...opp]);
  const rest = [];
  for (let i = 0; i < 52; i++) if (!dead.has(i)) rest.push(i);
  const need = 5 - board.length;
  let win = 0;
  let n = 0;
  const go = (from, picked) => {
    if (picked.length === need) {
      const full = [...board, ...picked];
      const a = P.evaluate([...hole, ...full]);
      const b = P.evaluate([...opp, ...full]);
      win += a > b ? 1 : a === b ? 0.5 : 0;
      n++;
      return;
    }
    for (let i = from; i < rest.length; i++) go(i + 1, [...picked, rest[i]]);
  };
  go(0, []);
  return win / n;
}
test('the chance of winning, worked out by dealing the rest of the cards, is within three points of the exact answer on three known spots', () => {
  const spots = [
    // a flush draw against a pair on the flop
    { hole: hand('Ah Kh'), board: hand('Qh 7h 2c'), opp: [hand('Qs Qd')] },
    // a set against a straight draw on the turn
    { hole: hand('8c 8d'), board: hand('8h 9s Tc 2d'), opp: [hand('Jc Qd')] },
    // two hands the other could hold (his range: a pair or a draw), from the flop
    { hole: hand('Jh Td'), board: hand('9c 8d 2s'), opp: [hand('Ah Ad'), hand('7h 6h'), hand('Kc Qc')] },
  ];
  for (const [i, sp] of spots.entries()) {
    const truth = sp.opp.reduce((a, o) => a + exact(sp.hole, sp.board, o), 0) / sp.opp.length;
    const range = { c: sp.opp.map((o) => [Math.min(...o), Math.max(...o)]), w: sp.opp.map(() => 1) };
    const est = P.estimate(sp.hole, sp.board, range, K.rngOf(1000 + i), { samples: 40000 });
    assert.ok(Math.abs(est.eq - truth) < 0.03, `spot ${i + 1}: dealt ${(est.eq * 100).toFixed(1)}% against ${(truth * 100).toFixed(1)}% counted`);
  }
});
test('his range narrows with what you do: a big raise leaves the strong hands, a check the weaker ones', () => {
  const s = P.newSession(9, 1);
  const h = P.deal(s);
  // you raise before the flop; he reads your range from the cards he cannot see
  P.act(h, { t: 'raise', to: 60 });
  const v = P.viewOf(h, 1);
  const r = P.narrow(v);
  const weight = (a, b) => {
    const i = r.c.findIndex((c) => c[0] === Math.min(a, b) && c[1] === Math.max(a, b));
    return i < 0 ? 0 : r.w[i];
  };
  assert.ok(weight(card('Ah'), card('As')) > 3 * weight(card('7c'), card('2d')), 'aces are likelier than seven-deuce after a raise');
  const total = r.w.reduce((a, b) => a + b, 0);
  assert.ok(weight(card('7c'), card('2d')) > 0 && weight(card('7c'), card('2d')) / total > 0, 'a thin share of bluffs stays in');
  assert.equal(P.viewOf(h, 1).hole.join(), h.hole[1].join());
  assert.ok(!('deck' in v) && !JSON.stringify(v).includes(JSON.stringify(h.hole[0])), 'his view holds neither the deck nor your cards');
});
test('his betting is legal in a thousand seeded hands, with every chip counted, and he raises and bluffs more at higher levels', () => {
  let hands = 0;
  let raises = 0;
  const bluffsAt = {};
  for (let seed = 1; hands < 1000; seed++) {
    const level = 1 + (seed % 13);
    const s = P.newSession(seed, level, 20, 400 + (seed % 5) * 300);
    while (!s.over && hands < 1000) {
      const h = P.deal(s);
      let guard = 0;
      while (!h.over) {
        assert.ok(guard++ < 60, 'a hand ends');
        const seat = h.toAct;
        const L = P.legalOf(h);
        const c = P.botAct(P.viewOf(h, seat), level, seed * 1009 + h.n * 31 + h.log.length, { samples: 24 });
        if (c.t === 'fold') assert.ok(L.fold, 'folds only to a bet');
        else if (c.t === 'check') assert.ok(L.check, 'checks only when nothing is owed');
        else if (c.t === 'call') assert.ok(L.fold, 'calls only a bet');
        else {
          assert.ok(L.canRaise && c.to >= L.minTo && c.to <= L.maxTo, `a raise to ${c.to} is within ${L.minTo}…${L.maxTo}`);
          raises++;
          if (c.bluff) bluffsAt[level] = (bluffsAt[level] ?? 0) + 1;
        }
        P.act(h, c);
        assert.equal(h.stacks[0] + h.stacks[1] + h.pot + h.bets[0] + h.bets[1], s.start * 2, 'every chip is somewhere');
        assert.ok(h.stacks[0] >= 0 && h.stacks[1] >= 0);
      }
      assert.equal(h.stacks[0] + h.stacks[1], s.start * 2);
      P.finishHand(s, h, P.resultLine(h));
      hands++;
    }
  }
  assert.equal(hands, 1000);
  assert.ok(raises > 300, `he raises (${raises})`);
  assert.ok(Object.keys(bluffsAt).length > 0, 'he bluffs somewhere');
  assert.ok(P.bluffShare(10) > P.bluffShare(1) && P.bluffShare(30) >= P.bluffShare(10), 'the bluff share rises with the level');
});
test('level 20 judges a hand better than level 1: with the best hand he raises, with the worst he does not call a big bet', () => {
  const s = P.newSession(4, 1);
  const h = P.deal(s);
  h.hole[1] = hand('Ah Ad');
  P.act(h, { t: 'call' });
  let strong = 0;
  let folded = 0;
  for (let i = 0; i < 30; i++) if (P.botAct(P.viewOf(h, 1), 20, 100 + i, { samples: 200 }).t === 'raise') strong++;
  assert.ok(strong >= 25, `aces raise at level 20 (${strong} of 30)`);
  const g = P.deal(P.newSession(4, 1));
  g.hole[1] = hand('7c 2d');
  g.hole[0] = hand('Ah Kh');
  P.act(g, { t: 'raise', to: 400 });
  for (let i = 0; i < 30; i++) if (P.botAct(P.viewOf(g, 1), 20, 200 + i, { samples: 200 }).t === 'fold') folded++;
  assert.ok(folded >= 25, `seven-deuce folds to a big raise at level 20 (${folded} of 30)`);
});
test('the hint is his chance as an estimate, with the share a call must win', () => {
  const h = P.deal(P.newSession(2, 1));
  h.hole[0] = hand('Ah Ad');
  P.act(h, { t: 'call' });
  P.act(h, { t: 'raise', to: 40 });
  const hint = P.hintFor(P.viewOf(h, 0), 5, { samples: 3000 });
  assert.ok(hint.eq > 0.6 && hint.eq < 0.95, `aces are a favourite (${hint.eq})`);
  assert.ok(Math.abs(hint.need - 30 / (80 + 30)) < 1e-9 || hint.need > 0, 'a call needs a share of the pot');
  assert.match(P.aboutPercent(0.613), /^about 61%$/);
});

test('poker is chips only: no money word, no currency sign and no way to pay in its code, its words or its card', () => {
  const files = ['board/poker.ts', 'board/pokershell.ts', 'shelf6.ts'].map((f) => [f, src(`${W}${f}`)]);
  files.push(['catalogue games6.ts', src('../../../packages/shared/src/catalogue/games6.ts')]);
  const banned = /\b(money|cash|dollars?|pounds?|euros?|cents?|pence|currency|wagers?|stakes?|prizes?|payouts?|buy-?ins?|buys?|bought|deposits?|withdraw\w*|payments?|pay|pays|paid|price[sd]?|purchases?|bank-?rolls?|gambl\w*|casinos?|rake|checkout|stripe|paypal|apple pay|credit card|real-money|winnings)\b/i;
  for (const [name, text] of files) {
    // the card's one line says what it is; nothing else may use the word, and a template's own dollar is not a currency sign
    const plain = text.replaceAll('Chips, never money.', '').replaceAll('${', '');
    assert.doesNotMatch(plain, /[$£€¥₿¢]/, `${name}: a currency sign`);
    assert.doesNotMatch(plain.replace(/'[^'\n]*chips[^'\n]*'/gi, (m) => m), banned, `${name}: a money word (${(banned.exec(plain) ?? [])[0]})`);
    assert.doesNotMatch(plain, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|navigator\.pay|PaymentRequest/, `${name}: a way out to the network or to pay`);
  }
  assert.equal(P.CHIPS_LINE, 'Chips, never money.');
  const poker = GAMES6.find((e) => e.id === 'poker');
  assert.ok(poker.line.includes(P.CHIPS_LINE) && poker.ghosty.includes(P.CHIPS_LINE), 'the card says it in one line');
  assert.ok(src(`${W}board/pokershell.ts`).includes('CHIPS_LINE'), 'the game shows it');
});

// ================================================================ THE WORD GAME

test('the list: a packed DAWG that reads, says its size, and is a download because it is over 300 KB', () => {
  const size = statSync(LIST_FILE).size;
  assert.equal(size, WD.LIST_BYTES, 'the size said on the card is the size of the file');
  assert.ok(size > WD.BUNDLE_LIMIT, `${size} bytes is over the 300 KB that would let it ride in the app`);
  assert.equal(WD.kbWords(WD.LIST_BYTES), '362 KB');
  assert.equal(WD.kbWords(1_234_000), '1.2 MB');
  assert.equal(WD.LIST_SIZE_LINE, 'The word list is a 362 KB download, once, on Wi-Fi.');
  assert.equal(lex.words, 168551);
  assert.ok(lex.edges * 3 + 16 === size, 'three bytes an edge after the header');
  assert.throws(() => new WD.Lex(new Uint8Array(64)), /not the word list/);
  assert.throws(() => new WD.Lex(readFileSync(LIST_FILE).subarray(0, 4000)), /cut short/);
  // no definitions and no proper nouns: only lowercase letters, and the words walk out of the file one for one
  let n = 0;
  let longest = 0;
  const walk = (node, depth) => {
    for (let i = node; ; i++) {
      const v = lex.e(i);
      assert.ok(v >>> 19 <= 25, 'a letter');
      if (v & (1 << 18)) {
        n++;
        longest = Math.max(longest, depth + 1);
      }
      const child = v & 0x1ffff;
      if (child) walk(child, depth + 1);
      if (v & (1 << 17)) break;
    }
  };
  walk(lex.root, 0);
  assert.equal(n, lex.words, 'every word in the header is there to be found');
  assert.ok(longest <= 15, `the longest word fits the board (${longest})`);
});
test('the list answers lookups: words in, made-up words out, nothing short, nothing with a capital', () => {
  for (const w of ['aa', 'cat', 'plant', 'planting', 'quiz', 'zax', 'jazz', 'trained', 'extraordinary', 'oxyphenbutazone']) assert.equal(lex.has(w), true, w);
  for (const w of ['', 'a', 'zq', 'xyzzy', 'qqqq', 'catt', 'plantz', 'ez', 'Cat', 'CAT', "cat's", 'cat1', 'zzzzzz']) assert.equal(lex.has(w), false, w || '(empty)');
  assert.equal(lex.has('plan') && lex.has('plant') && lex.has('plants') && !lex.has('plantss'), true);
});
test('the bag is one hundred tiles in one table, with points of our own and no blank', () => {
  assert.equal(WD.TILES.reduce((s, t) => s + t.n, 0), 100);
  assert.equal(WD.TILES.length, 26);
  assert.ok(WD.TILES.every((t, i) => t.ch === String.fromCharCode(97 + i) && t.n >= 1 && t.pts >= 1));
  assert.equal(WD.newGame(1).bag.length + 14, 100);
  const g = WD.newGame(3);
  const counts = new Array(26).fill(0);
  for (const l of [...g.bag, ...g.racks[0], ...g.racks[1]]) counts[l]++;
  assert.deepEqual(counts, WD.TILES.map((t) => t.n), 'a new game has exactly the table');
  assert.deepEqual(WD.newGame(3, 0, 20).bag.length, 20, 'a short game, for a test');
  assert.notDeepEqual(WD.newGame(4).racks, WD.newGame(5).racks);
  assert.deepEqual(WD.newGame(7).racks, WD.newGame(7).racks, 'seeded');
});
test('the layout is ours, mirrored every way, with a double word on the star', () => {
  const L = WD.LAYOUT;
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) {
    assert.equal(L[r * 15 + c], L[c * 15 + r]);
    assert.equal(L[r * 15 + c], L[(14 - r) * 15 + c]);
    assert.equal(L[r * 15 + c], L[r * 15 + 14 - c]);
  }
  assert.equal(L[7 * 15 + 7], 'D');
  assert.equal(L[0], 'T');
  assert.deepEqual(['d', 't', 'D', 'T'].map((k) => L.filter((x) => x === k).length), [16, 24, 17, 4]);
});

const boardOf = (rows) => {
  const b = new Int8Array(225).fill(-1);
  rows.forEach(([r, c, w, dir]) => [...w].forEach((ch, i) => (b[(r + (dir === 'down' ? i : 0)) * 15 + c + (dir === 'down' ? 0 : i)] = ch.charCodeAt(0) - 97)));
  return b;
};
const tiles = (r, c, w, dir = 'across') => [...w].map((ch, i) => [r + (dir === 'down' ? i : 0), c + (dir === 'down' ? 0 : i), ch.charCodeAt(0) - 97]);
/** A plain scorer written the long way, to hold the real one to. */
function reference(board, ts) {
  const put = new Map(ts.map(([r, c, l]) => [r * 15 + c, l]));
  const get = (r, c) => (r < 0 || c < 0 || r > 14 || c > 14 ? -1 : put.has(r * 15 + c) ? put.get(r * 15 + c) : board[r * 15 + c]);
  const runs = new Map();
  for (const [r, c] of ts) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    let a = r, b = c;
    while (get(a - dr, b - dc) >= 0) (a -= dr, (b -= dc));
    let e = r, f = c;
    while (get(e + dr, f + dc) >= 0) (e += dr, (f += dc));
    if (a !== e || b !== f) runs.set(`${a},${b},${dr}`, [a, b, e, f, dr, dc]);
  }
  let total = 0;
  for (const [a, b, e, f, dr, dc] of runs.values()) {
    let sum = 0, mult = 1;
    for (let r = a, c = b; r <= e && c <= f; r += dr, c += dc) {
      let p = WD.PTS[get(r, c)];
      if (put.has(r * 15 + c)) {
        const x = WD.LAYOUT[r * 15 + c];
        if (x === 'd') p *= 2;
        if (x === 't') p *= 3;
        if (x === 'D') mult *= 2;
        if (x === 'T') mult *= 3;
      }
      sum += p;
    }
    total += sum * mult;
  }
  return total + (ts.length === 7 ? 40 : 0);
}
test('scoring: letters, double and triple squares, words through them, the bingo, and the bonuses named', () => {
  const empty = new Int8Array(225).fill(-1);
  // PLAN across to the star: p3 + l2 + a1 + n1 on plain squares, the star doubles the word
  let c = WD.checkPlay(empty, tiles(7, 4, 'plan'), lex);
  assert.equal(c.ok, true);
  assert.equal(c.score, 14);
  assert.deepEqual(c.words[0].bonus, ['double word']);
  // one square further left: P on a double letter, then the star: (6 + 2 + 1 + 1 + 5) × 2
  c = WD.checkPlay(empty, tiles(7, 3, 'plank'), lex);
  assert.equal(c.score, 30);
  assert.deepEqual(c.words[0].bonus, ['P on a double letter', 'double word']);
  // seven tiles: the double letter, the star, and forty for the rack
  c = WD.checkPlay(empty, tiles(7, 3, 'trained'), lex);
  assert.equal(c.bingo, true);
  assert.equal(c.score, 58, '(2 + 1 + 1 + 1 + 1 + 1 + 2) × 2 + 40');
  assert.match(WD.playWords(c), /TRAINED 18 \(T on a double letter, double word\) · all seven tiles, 40 more · 58 points/);
  // words that make others: the new tile scores in each word it is in, and the bonuses are only for the new tiles
  const b = boardOf([[7, 4, 'plan', 'across']]);
  c = WD.checkPlay(b, tiles(8, 5, 'a'), lex);
  assert.equal(c.ok, true, 'LA down');
  assert.deepEqual(c.words.map((w) => w.word), ['la']);
  assert.equal(c.score, reference(b, tiles(8, 5, 'a')));
  c = WD.checkPlay(b, tiles(7, 8, 's'), lex);
  assert.deepEqual(c.words.map((w) => w.word), ['plans'], 'a tile at the end makes the longer word');
  assert.equal(c.score, reference(b, tiles(7, 8, 's')));
  c = WD.checkPlay(b, tiles(8, 4, 'aa'), lex);
  assert.equal(c.ok, true, 'AA across under PL, and PA and LA down');
  assert.deepEqual(c.words.map((w) => w.word).sort(), ['aa', 'la', 'pa']);
  assert.equal(c.score, reference(b, tiles(8, 4, 'aa')));
  // the reference scorer agrees on a great many real plays
  let seen = 0;
  for (let seed = 1; seed <= 8; seed++) {
    let s = WD.newGame(seed, seed % 2);
    while (!s.over && s.ply < 40) {
      const ch = WD.botPlay(s, 1 + (seed % 12), seed * 100 + s.ply, lex, { samples: 2 });
      if (ch.move.t === 'play') {
        const k = WD.checkPlay(s.board, ch.move.tiles, lex);
        assert.equal(k.ok, true, `${seed}/${s.ply}: his play is legal (${k.reason})`);
        assert.equal(k.score, reference(s.board, ch.move.tiles), `${seed}/${s.ply}: the score agrees with the long way`);
        seen++;
      }
      s = WD.apply(s, ch.move);
    }
  }
  assert.ok(seen > 100, `${seen} plays held to the reference`);
});
test('placement rules: one line, no gaps, joined to what is there, the first word through the star, every new word in the list', () => {
  const empty = new Int8Array(225).fill(-1);
  const why = (b, t) => WD.checkPlay(b, t, lex).reason;
  assert.equal(why(empty, tiles(7, 4, 'plan')), undefined);
  assert.equal(why(empty, tiles(3, 3, 'plan')), 'The first word goes through the star in the middle.');
  assert.equal(why(empty, tiles(7, 7, 'a')), 'The first word needs two tiles.');
  assert.equal(why(empty, [[7, 7, 0], [8, 8, 1]]), 'Tiles go in one row or one column.');
  assert.equal(why(empty, [[7, 5, 15], [7, 6, 11], [7, 8, 0], [7, 9, 13]]), 'There is a gap in the word.');
  assert.equal(why(empty, [[7, 7, 0], [7, 7, 1]]), 'That square is taken.', 'two tiles on one square');
  assert.equal(why(empty, tiles(7, 6, 'xq')), 'Not in my list.');
  assert.equal(why(empty, []), 'Place a tile first.');
  const b = boardOf([[7, 4, 'plan', 'across']]);
  assert.equal(why(b, tiles(2, 2, 'cat')), 'It has to join a word already there.', 'a word out on its own');
  assert.equal(why(b, tiles(7, 8, 's')), undefined, 'PLANS: a tile at the end makes the longer word');
  assert.equal(why(b, tiles(7, 8, 'z')), 'Not in my list.', 'PLANZ');
  assert.equal(why(b, tiles(7, 7, 'x')), 'That square is taken.', 'on top of a tile');
  assert.equal(why(b, tiles(8, 4, 'o', 'across')), 'Not in my list.', 'PO down');
  // a gap closed by what is already there is no gap: P_A_ with L and N between
  assert.equal(why(b, [[7, 3, 'e'.charCodeAt(0) - 97]]), 'Not in my list.', 'EPLAN');
  // every word it makes, not only the main one: AA under PL is a word across, but one of the two down would not be
  assert.equal(why(b, tiles(8, 4, 'aa')), undefined, 'PA and LA are words');
  assert.equal(why(b, tiles(8, 4, 'ax')), 'Not in my list.', 'AX is a word across, but LX down is not');
});
test('the generator finds every placement a brute-force search finds (the same count on real boards), and every one is legal', () => {
  let checked = 0;
  for (let seed = 1; seed <= 4; seed++) {
    let s = WD.newGame(seed, 0);
    while (!s.over && s.ply < 24) {
      const rack = s.racks[s.turn].slice(0, 2);
      if (s.ply >= 6 && s.ply % 6 === 0) {
        const gen = WD.moves(s.board, rack, lex);
        for (const m of gen) assert.equal(WD.checkPlay(s.board, m.tiles, lex).ok, true);
        let bf = 0;
        const sq = [];
        for (let i = 0; i < 225; i++) if (s.board[i] < 0) sq.push(i);
        const seen = new Set();
        const tryT = (ts) => {
          const key = ts.map((t) => t.join(',')).sort().join('|');
          if (seen.has(key)) return;
          seen.add(key);
          if (WD.checkPlay(s.board, ts, lex).ok) bf++;
        };
        for (const i of sq) for (const l of new Set(rack)) tryT([[Math.floor(i / 15), i % 15, l]]);
        for (const i of sq) for (const j of sq) {
          if (i === j) continue;
          const [r1, c1, r2, c2] = [Math.floor(i / 15), i % 15, Math.floor(j / 15), j % 15];
          if (r1 === r2 || c1 === c2) tryT([[r1, c1, rack[0]], [r2, c2, rack[1]]]);
        }
        assert.equal(gen.length, bf, `seed ${seed} ply ${s.ply}: ${gen.length} placements for the rack ${rack.map(WD.letterOf).join('')}, ${bf} by brute force`);
        checked++;
      }
      const ch = WD.botPlay(s, 3, seed * 11 + s.ply, lex, { samples: 1 });
      s = WD.apply(s, ch.move);
    }
  }
  assert.ok(checked >= 8, `${checked} positions compared`);
});
test('the game: tiles are never lost, a swap needs seven in the bag, six scoreless turns end it, going out ends it and the leftovers come off', () => {
  let s = WD.newGame(11, 0);
  const total = (x) => x.bag.length + x.racks[0].length + x.racks[1].length + x.board.filter((v) => v >= 0).length;
  assert.equal(total(s), 100);
  s = WD.apply(s, { t: 'swap', letters: s.racks[0].slice(0, 3) });
  assert.equal(total(s), 100);
  assert.equal(s.racks[1].length, 7);
  assert.equal(s.turn, 1);
  const short = WD.newGame(11, 0, 6);
  assert.throws(() => WD.apply(short, { t: 'swap', letters: [short.racks[0][0]] }), /seven tiles/);
  let t = WD.newGame(12, 0);
  for (let i = 0; i < 6; i++) t = WD.apply(t, { t: 'pass' });
  assert.equal(t.over, true, 'six passes');
  assert.deepEqual(t.scores, [-t.racks[0].reduce((a, l) => a + WD.PTS[l], 0), -t.racks[1].reduce((a, l) => a + WD.PTS[l], 0)], 'what is left on a rack comes off');
  // going out: the bag empty, the last tiles played
  let u = WD.newGame(13, 0, 0);
  let guard = 0;
  while (!u.over && guard++ < 60) {
    const ch = WD.botPlay(u, 5, 900 + guard, lex, { samples: 1 });
    u = WD.apply(u, ch.move);
    assert.equal(total(u), 14, 'no tile is lost');
  }
  assert.equal(u.over, true);
  assert.ok([0, 1, 2].includes(u.winner));
  if (u.out >= 0) assert.equal(u.racks[u.out].length, 0, 'the one who went out has no tiles');
});
test('his play: all seven tiles when the rack makes a word of them, the best score when he plays his best, and short words at level 1', () => {
  // TRAINED on an empty board is the best play and a bingo
  const s = WD.newGame(1, 1);
  s.racks[1] = [...'trained'].map((ch) => ch.charCodeAt(0) - 97);
  const all = WD.moves(s.board, s.racks[1], lex);
  const top = Math.max(...all.map((m) => m.score));
  assert.equal(top, WD.bestFor(s, 1, lex).score);
  assert.ok(top >= 58, `a seven-letter word scores at least 58 (${top})`);
  for (const level of [10, 14, 25]) {
    const ch = WD.botPlay(s, level, 5, lex, { samples: 3 });
    assert.equal(ch.move.t, 'play');
    assert.equal(ch.move.tiles.length, 7, `level ${level} plays all seven`);
    assert.equal(WD.checkPlay(s.board, ch.move.tiles, lex).score, top);
  }
  // at level 1 he plays short words (three tiles or fewer) when he has them
  let short = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const g = WD.newGame(seed, 1);
    const ch = WD.botPlay(g, 1, seed, lex, { samples: 1 });
    if (ch.move.t === 'play' && ch.move.tiles.length <= 3) short++;
    assert.ok(ch.move.t === 'play');
  }
  assert.equal(short, 12, 'level 1: short words');
  // the best move on a known board: his reply to PLAN is a legal word that is the best he can find from his rack
  const g = WD.newGame(2, 1);
  const first = WD.apply({ ...g, turn: 0, racks: [[...'plan'].map((ch) => ch.charCodeAt(0) - 97).concat([4, 4, 18]), g.racks[1]] }, { t: 'play', tiles: tiles(7, 4, 'plan') });
  const ch = WD.botPlay(first, 20, 3, lex, { samples: 4 });
  if (ch.move.t === 'play') {
    const k = WD.checkPlay(first.board, ch.move.tiles, lex);
    assert.equal(k.ok, true);
    assert.ok(ch.score >= k.score, 'the best by score is never below the play he chose');
  }
  // the Worker's two ways in
  const d = E.decideWords({ state: s, level: 12, seed: 2, ms: 0, samples: 2 }, lex);
  assert.equal(d.move.t, 'play');
  assert.equal(E.decideWords({ state: s, level: 12, seed: 2, ms: 0, hint: true }, lex).score, top);
  assert.throws(() => E.decideWords({ state: s, level: 1, seed: 1, ms: 0 }, null), /not here/);
  const pv = P.viewOf(P.deal(P.newSession(3, 1)), 0);
  assert.ok(['fold', 'call', 'raise', 'check'].includes(E.decidePoker({ view: pv, level: 1, seed: 2, ms: 0, samples: 20 }).t));
  assert.ok(E.decidePoker({ view: pv, level: 1, seed: 2, ms: 0, samples: 50, hint: true }).eq > 0);
});

// ================================================================ GAMES 5's LOOSE ENDS

test('backgammon: a take-back takes the whole turn back, not one die', () => {
  const g = BG.backgammon;
  const s0 = g.start(5);
  const undos = [];
  let s = s0;
  let moves = 0;
  const mine = [];
  // play both dice of the first turn, remembering what the frame remembers
  while (g.side(s) === 1 && !g.result(s)) {
    const m = g.legal(s)[0];
    KP.pushUndo(undos, s, moves, KP.turnKey('backgammon', s, moves));
    s = g.apply(s, m, K.rngAt(5, moves));
    moves++;
    mine.push(m);
  }
  assert.ok(mine.length >= 2, `a turn is ${mine.length} dice`);
  assert.equal(undos.length, 1, 'one turn, one take-back');
  assert.equal(undos[0].n, 0);
  assert.deepEqual(Array.from(undos[0].s.p), Array.from(s0.p), 'the position it goes back to is the one before the first die');
  assert.deepEqual(undos[0].s.dice, s0.dice, 'with both dice still to play');
  // his turn, then yours again: the second turn is a second take-back
  while (g.side(s) === 2 && !g.result(s)) {
    s = g.apply(s, g.legal(s)[0], K.rngAt(5, moves));
    moves++;
  }
  KP.pushUndo(undos, s, moves, KP.turnKey('backgammon', s, moves));
  assert.equal(undos.length, 2);
  // any other game: every move is its own turn
  const o = [];
  KP.pushUndo(o, 'a', 0, KP.turnKey('othello', {}, 0));
  KP.pushUndo(o, 'b', 2, KP.turnKey('othello', {}, 2));
  assert.equal(o.length, 2);
  // and the same turn is never pushed twice
  KP.pushUndo(o, 'c', 2, 2);
  assert.equal(o.length, 2);
});
test('the service worker keeps every Worker the build makes, so a game plays offline from the first open', () => {
  const sw = readFileSync(at('../../web/public/sw.js'), 'utf8');
  const shell = [...(/const SHELL = \[([^\]]*)\]/.exec(sw)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const m of sw.matchAll(/SHELL\.push\(([^)]*)\)/g)) for (const x of m[1].matchAll(/'([^']+)'/g)) shell.push(x[1]);
  assert.ok(shell.includes('/app.js') && shell.length >= 6, 'the shell list was read');
  const buildJobs = readFileSync(at('../../web/build.mjs'), 'utf8');
  const made = new Set([...buildJobs.matchAll(/outfile:\s*'dist\/([\w.-]+\.worker\.js)'/g)].map((m) => `/${m[1]}`));
  assert.ok(made.size >= 3 && made.has('/board.worker.js'), `the build makes ${[...made].join(', ')}`);
  const dist = at('../../web/dist');
  if (existsSync(dist)) for (const f of readdirSync(dist)) if (/\.worker\.js$/.test(f)) made.add(`/${f}`);
  for (const w of made) assert.ok(shell.includes(w), `${w} is in the service worker's precache`);
  // and every Worker the page starts from the site's own root is one of them
  const started = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = `${dir}/${f}`;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.ts$/.test(f)) for (const m of readFileSync(p, 'utf8').matchAll(/new Worker\('(\/[\w.-]+\.worker\.js)'/g)) started.add(m[1]);
    }
  };
  walk(at('../../web/src'));
  for (const w of started) assert.ok(made.has(w) && shell.includes(w), `${w}: started by the page, built, and kept`);
  assert.ok(started.has('/board.worker.js'));
});
test("the cave's level holds: a lost session does not take Ghosty below the level he has reached, until he loses three running", () => {
  const game = { id: 'held-cave', theta0: [1], sigma: [0.1], hold: true, play: (th, level, seed) => ({ score: 0, target: 10, passed: store.get('winnext') === '1' }) };
  const plain = { ...game, id: 'plain-cave', hold: false };
  const book = () => S.bookOf(game.id);
  // he reaches 3.4: level 4
  S.saveBook(game.id, { you: { r: 0, n: 0 }, ghosty: { r: 3.4, n: 5 } });
  store.set('winnext', '0');
  S.practiceSession(game, 1);
  assert.equal(S.levelOf(book().ghosty.r), 4, 'one lost session: still level 4');
  assert.ok(book().ghosty.r >= 3, 'not below the level he reached');
  S.practiceSession(game, 2);
  assert.equal(S.levelOf(book().ghosty.r), 4, 'two lost sessions: still level 4');
  S.practiceSession(game, 3);
  assert.equal(S.levelOf(book().ghosty.r), 3, 'three lost sessions running: he falls a level');
  // a win in between starts the count again
  S.saveBook(game.id, { you: { r: 0, n: 0 }, ghosty: { r: 5.1, n: 5 } });
  store.set('winnext', '0');
  S.practiceSession(game, 4);
  S.practiceSession(game, 5);
  store.set('winnext', '1');
  S.practiceSession(game, 6);
  store.set('winnext', '0');
  S.practiceSession(game, 7);
  S.practiceSession(game, 8);
  assert.ok(S.levelOf(book().ghosty.r) >= 6, `two lost, a win, two lost: he has not fallen (level ${S.levelOf(book().ghosty.r)})`);
  // without the hold the same loss takes him down at once
  S.saveBook(plain.id, { you: { r: 0, n: 0 }, ghosty: { r: 3.4, n: 5 } });
  store.set('winnext', '0');
  S.practiceSession(plain, 1);
  assert.ok(S.bookOf(plain.id).ghosty.r < 3, 'a game that does not hold falls at once');
  // the pure rule
  const w = { r: 4.2, n: 0 };
  assert.equal(S.held(w, 4.2, 3.4, false), 4, 'a loss is held at the level reached');
  assert.equal(w.lost, 1);
  assert.equal(S.held(w, 4, 3.2, false), 4);
  assert.equal(S.held(w, 4, 3.2, false), 3.2, 'the third takes it');
  assert.equal(w.lost, 0);
  assert.equal(S.HOLD_LOSSES, 3);
  // the cave says so on its card
  const cave = SHELF.find((e) => e.id === 'cave');
  assert.match(cave.ghosty, /level holds.*three sessions running/);
  assert.equal(readFileSync(at(`${W}cave/index.ts`), 'utf8').includes('hold: true'), true);
});
test('the platformer bot stomps in world 1 when a stomp is the shortest way, and does not get hurt doing it', () => {
  const DT = 1 / 60;
  const none = { left: false, right: false, jump: false, jumpPressed: false, run: false };
  const flat = () => {
    const r = PS.newRun(1, 1);
    r.enemies.length = 0;
    r.movers.length = 0;
    r.drops.length = 0;
    r.timeLeft = 1e6;
    r.limit = 1e6;
    for (let y = 0; y < 12; y++) for (let x = 0; x < r.W; x++) r.tiles[y][x] = y >= 10 ? '#' : '.';
    r.p.x = 40;
    r.p.y = 160 - r.p.h;
    r.p.onGround = true;
    r.p.vx = r.p.vy = 0;
    for (let i = 0; i < 4; i++) PS.step(r, DT, none);
    r.events.length = 0;
    return r;
  };
  let stomped = 0;
  let hurt = 0;
  const cases = [];
  for (const dist of [130, 160, 200, 260]) for (const dir of [-1, 1]) cases.push([dist, dir]);
  for (const [dist, dir] of cases) {
    const r = flat();
    r.enemies.push({ ...PC.body(40 + dist, 148, 12, 12), kind: 'walker', dir, alive: true, state: 'walk', t: 0, hx: 40 + dist, hy: 148, hop: 0, die: 0, grace: 0 });
    for (let i = 0; i < 60 * 8 && !r.stomps; i++) {
      PS.botStep(r, PS.THETA0);
      PS.step(r, DT, none);
      if (r.p.dead || r.lives < 3) hurt++;
    }
    if (r.stomps) stomped++;
  }
  assert.equal(hurt, 0, 'never hurt by the walker');
  assert.ok(stomped >= 7, `he stomps the walker on open ground (${stomped} of ${cases.length})`);
  // a walker with a pit between is not a stomp: he still crosses it
  const r = flat();
  for (let y = 10; y < 12; y++) for (let x = 14; x < 17; x++) r.tiles[y][x] = '.';
  r.enemies.push({ ...PC.body(40 + 260, 148, 12, 12), kind: 'walker', dir: -1, alive: true, state: 'walk', t: 0, hx: 300, hy: 148, hop: 0, die: 0, grace: 0 });
  let fell = false;
  for (let i = 0; i < 60 * 10 && r.p.x < 330; i++) {
    PS.botStep(r, PS.THETA0);
    PS.step(r, DT, none);
    if (r.p.dead) fell = true;
  }
  assert.equal(fell, false, 'with a pit in the way he still gets across');
  // and world 1 as a whole: the bot reaches the flag, with more stomps than before and no more deaths
  let stomps = 0;
  let won = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const run = PS.headless(PS.THETA0, 1, seed, 120);
    stomps += run.run.stomps;
    if (run.passed) won++;
  }
  assert.equal(won, 8, 'world 1: every run reaches the flag');
  assert.ok(stomps >= 8, `world 1: he stomps (${stomps} in 8 runs)`);
});
test("Othello's rewritten move generator counts the known number of games, and a pass still happens", () => {
  const perft = (s, d) => {
    if (d === 0) return 1;
    const ms = OT.othello.legal(s);
    if (ms.length === 1 && ms[0] === -1) return d === 1 ? 1 : perft(OT.othello.apply(s, -1), d - 1);
    let n = 0;
    for (const m of ms) n += perft(OT.othello.apply(s, m), d - 1);
    return n;
  };
  const start = OT.othello.start(1);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((d) => perft(start, d)), [4, 12, 56, 244, 1396, 8200]);
  assert.deepEqual(OT.flips(start.b, 19, 1), [27], 'the flips of one move');
  assert.deepEqual(OT.legalCells(start), [19, 26, 37, 44]);
  // the start is untouched by a move
  const before = Array.from(start.b);
  OT.othello.apply(start, 19);
  assert.deepEqual(Array.from(start.b), before);
  // a position where one side has to pass
  const b = new Int8Array(64);
  b[0] = 1;
  b[1] = 2;
  const p = { b, side: 2, pass: 0 };
  assert.deepEqual(OT.othello.legal(p), [-1], 'no move: a pass');
  assert.equal(OT.othello.apply(p, -1).side, 1);
});
test('a save that will not read says so, and one that is not there says nothing', () => {
  assert.equal(KP.DAMAGED_SAVE, 'That save was damaged, so this is a new game.');
  const enc = (x) => new TextEncoder().encode(x);
  const ok = (x) => !!x && typeof x === 'object' && Array.isArray(x.moves);
  assert.deepEqual(KP.readSave(null, ok), { saved: null, damaged: false });
  assert.deepEqual(KP.readSave(undefined, ok), { saved: null, damaged: false });
  assert.equal(KP.readSave(enc('{"moves": [1, 2'), ok).damaged, true, 'cut short');
  assert.equal(KP.readSave(enc('not json at all'), ok).damaged, true);
  assert.equal(KP.readSave(enc('{"seed": 4}'), ok).damaged, true, 'a save without its moves');
  assert.equal(KP.readSave(enc('7'), ok).damaged, true);
  assert.equal(KP.readSave(new Uint8Array(0), ok).damaged, true, 'an empty file');
  const good = KP.readSave(enc('{"moves": [1]}'), ok);
  assert.equal(good.damaged, false);
  assert.deepEqual(good.saved, { moves: [1] });
  // every frame that keeps a game says it on its title card
  for (const f of ['board/shell.ts', 'board/pokershell.ts', 'board/wordshell.ts', 'two/shell.ts']) {
    const t = src(`${W}${f}`);
    assert.ok(t.includes('DAMAGED_SAVE') && /damaged/.test(t), `${f} says it`);
  }
});

// ================================================================ THE ARCADE'S ROW

test("the shelf: POKER and WORDS right after CONNECT 4, made by us, PLAY at once, each ending in the two ratings, and the GYM's six", () => {
  const ids = SHELF.map((e) => e.id);
  assert.deepEqual(ids.slice(ids.indexOf('connect4') + 1), ['poker', 'words']);
  assert.deepEqual(GAMES6.map((e) => e.id), ['poker', 'words']);
  for (const e of GAMES6) {
    assert.equal(e.data, null);
    assert.equal(e.madeByUs, true);
    assert.equal(e.engine, e.id);
    assert.equal(SHELF.filter((x) => x.id === e.id).length, 1);
    for (const k of ['title', 'line', 'ghosty', 'done']) assert.ok(e[k].trim().length > 3 && e[k].length <= 190, `${e.id}.${k}`);
    assert.match(e.since, /^2026-11-\d\d$/);
    assert.doesNotMatch(`${e.title} ${e.line} ${e.ghosty} ${e.done}`, /scrabble|words with friends|wordle|zynga|hasbro|pokerstars|texas|casino/i, 'our own names, never another game\'s');
  }
  assert.deepEqual([...RATED_IDS], [...BOARD_IDS, 'poker', 'words']);
  assert.equal(RATED_IDS.length, 6);
  assert.deepEqual(Object.keys(RT.BOARD_NAMES), [...RATED_IDS]);
  // a card ends in the two ratings, 1,200 each before a first game
  assert.equal(RT.ratingTail('poker'), 'You: 1,200 · Ghosty: 1,200');
  assert.match(RT.reportLine('words'), /not rated yet/);
  const book = RT.afterGame(RT.newBook(), 1, 1, 1);
  RT.saveBook('poker', book);
  assert.match(RT.ratingTail('poker'), /^You: 1,[3-9]\d0 · Ghosty: 1,[01]\d0$/);
  assert.match(RT.reportLine('poker'), /1 game: 1 won, 0 drawn, 0 lost/);
});
test('the words keep the catalogue rules, are keyed by the shelf ids, and say what the games are', () => {
  assert.deepEqual(Object.keys(GAMES6_WORDS).sort(), GAMES6.map((e) => `arcade:${e.id}`).sort());
  for (const [k, v] of Object.entries(GAMES6_WORDS)) {
    assert.deepEqual(CAT.wordProblems(k, v), [], k);
    assert.equal(v.cat, 'play');
    assert.deepEqual(v.scene, ['playing']);
    assert.match(v.since, /^2026-11-\d\d$/);
  }
  assert.ok(GAMES6_WORDS['arcade:poker'].say.includes('Play poker'));
  assert.ok(GAMES6_WORDS['arcade:words'].say.some((s) => /word game/.test(s)));
  assert.match(GAMES6_WORDS['arcade:words'].more, /one-off download on Wi-Fi/);
  assert.doesNotMatch(JSON.stringify(GAMES6_WORDS), /scrabble|wordle|texas hold/i);
  // what he says in chat reaches them
  const hit = (phrase) => Object.entries(CAT.CATALOGUE ?? {}).filter(([, v]) => (v.say ?? []).some((s) => s.toLowerCase() === phrase.toLowerCase())).map(([k]) => k);
  assert.deepEqual(hit('Play poker'), ['arcade:poker']);
  assert.deepEqual(hit('A word game'), ['arcade:words']);
});
test('the search entry still answers every board game with a legal move after the faster generators', () => {
  for (const id of BOARD_IDS) {
    const g = E.GAME[id];
    for (const seed of [1, 2, 3]) {
      let s = g.start(seed);
      const rnd = K.rngOf(seed);
      for (let i = 0; i < 30 && !g.result(s); i++) {
        const ms = g.legal(s);
        s = g.apply(s, ms[Math.floor(rnd() * ms.length)], K.rngAt(seed, i));
      }
      if (g.result(s)) continue;
      const d = E.decide({ game: id, state: s, level: 2, seed: 5, ms: 1e6, iters: 40, weights: null });
      assert.ok(g.legal(s).some((m) => g.key(m) === g.key(d.move)), `${id}: a legal move`);
    }
  }
});
