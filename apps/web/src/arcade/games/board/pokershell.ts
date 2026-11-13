/**
 * POKER in the arcade's frame (the rules and Ghosty's play are poker.ts; the Worker answers for him): the kit's menus (Play ·
 * Continue · How to play · Sound · Quit), a table on a canvas, FOLD · CHECK or CALL · BET or RAISE with the bet sizes under the
 * thumb (every key 44 pt or more), the pot and the stacks always said in chips, HINT (your chance of winning, "about 61%", said as
 * an estimate; one a hand, it costs the rating nothing), a hand's result in his voice with the winning hand named, a session of
 * 20 hands or a bust that moves the rating the way the boards' do, and the hand history (every card, every bet) after it. A
 * session is kept in the save store after every action and replays exactly (the shuffle is seeded). CHIPS ONLY: the card says so
 * in one line (CHIPS_LINE).
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles } from '../../engines/types';
import type { SaveStore } from '../../engines/saves';
import type { Intent } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { Synth } from '../audio';
import { accentHex, cssSize, fitCanvas, type GameEngine, haptic, hudButton, Loop, Overlay, Resolution } from '../kit';
import { finishRun, levelOf, bookOf as skillBook } from '../two/skill';
import { Asker } from './ask';
import { decidePoker } from './engine';
import { DAMAGED_SAVE, readSave } from './keep';
import type { BoardHandle } from './shell';
import { rngAt, secondsWords, thinkMs } from './kit';
import { act, aboutPercent, type Act, CHIPS_LINE, type Choice, deal, finishHand, type Hand, HANDS, handName, historyLines, type HandRec, legalOf, newSession, potOf, resultLine, type Seat, type Session, sessionScore, cardText, cardWords, viewOf, START_CHIPS, bigBlind, evaluate } from './poker';
import { afterGame, bookOf as ratingBook, near10, ratingTail, saveBook } from './rating';

const arg = (args: readonly string[] | undefined, k: string): string | null => {
  const hit = (args ?? []).find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : null;
};
const MIN_THINK_MS = 700;
const HISTORY_KEY = 'ghosty.arcade.poker.history';
const reduced = (): boolean => {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
const num = (n: number): string => Math.round(n).toLocaleString('en-GB');
const RULES = [
  'Heads-up hold\'em: you and Ghosty, two cards each, five on the table. Make the best five-card hand from your two and the five, or make him fold.',
  'The player on the button posts the small blind and acts first before the flop; the other acts first after it. Fold, check, call, bet or raise (to a total). A bet or raise is at least the last one; ALL IN is always allowed.',
  'A session is 20 hands, or until one of you has no chips left. The blinds rise with your level and every five hands. Whoever has more chips at the end wins the session, and that moves your rating and his.',
  `${CHIPS_LINE} There is nothing to put in and nothing to take out: the chips are only a score.`,
];
const SIZES = [
  { id: 'min', label: 'MIN', aria: 'The smallest bet or raise', frac: 0 },
  { id: 'half', label: '½ POT', aria: 'Half the pot', frac: 0.5 },
  { id: 'three', label: '¾ POT', aria: 'Three quarters of the pot', frac: 0.75 },
  { id: 'pot', label: 'POT', aria: 'The size of the pot', frac: 1 },
  { id: 'all', label: 'ALL IN', aria: 'All your chips', frac: -1 },
] as const;

interface Saved {
  seed: number;
  level: number;
  limit: number;
  start: number;
  /** Every hand's actions so far, as the moves made (the deals replay from the seed). */
  acts: { t: Act['t']; to?: number }[][];
  played: number;
  tell: { raises: number; bluffs: number };
}
export type PokerEngine = GameEngine<never> & { id: string };
export function makePokerEngine(entry: { ghosty: string }): PokerEngine {
  return { id: 'poker', start: (canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }) => startPoker(entry, canvas, intent, ev, opts) } as never;
}

async function startPoker(entry: { ghosty: string }, canvas: HTMLCanvasElement, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }): Promise<BoardHandle> {
  const id = 'poker';
  const title = 'Poker';
  const t0 = performance.now();
  fitCanvas(canvas);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('This browser cannot draw the game.');
  const res = new Resolution();
  const accent = `#${accentHex(0x64d2ff).toString(16).padStart(6, '0')}`;
  const synth = new Synth(opts.sound);
  const saveName = 'board.poker.json';
  const argLevel = arg(opts.args, 'level');
  const argSeed = arg(opts.args, 'seed');
  const argHands = arg(opts.args, 'hands');
  const argStack = arg(opts.args, 'stack');
  const fast = (opts.args ?? []).includes('fast');

  // ---------------------------------------------------------------- state
  const read = readSave<Saved>(await opts.saves.get(saveName).catch(() => null), (x) => {
    const s = x as Saved | null;
    return !!s && typeof s === 'object' && Number.isFinite(s.seed) && Number.isFinite(s.level) && Array.isArray(s.acts) && s.acts.every((a) => Array.isArray(a)) && Number.isFinite(s.limit) && Number.isFinite(s.start);
  });
  let saved: Saved | null = read.saved;
  let damaged = read.damaged;
  if (damaged) void opts.saves.remove(saveName).catch(() => undefined);
  type Mode = 'title' | 'play' | 'paused' | 'over' | 'gone';
  let mode: Mode = 'title';
  let sess: Session = newSession(1, 1);
  let hand: Hand | null = null;
  let acts: { t: Act['t']; to?: number }[][] = [];
  let level = 1;
  let thinking = false;
  let hinting = false;
  let hintUsed = false;
  let hintText = '';
  let sizeId: (typeof SIZES)[number]['id'] = 'half';
  let ticket = 0;
  let lastLine = '';
  let outcome = '';
  let handLine = '';
  let ghostSaid = '';
  let tell = { raises: 0, bluffs: 0 };
  let played = ratingBook(id).you.games;
  let lastThink = { ms: 0, samples: 0, eq: 0.5, bluff: false };
  let pendingGhost: Choice | null = null;
  let firstFrameMs: number | null = null;
  let clock = 0;
  let size = { w: 0, h: 0, s: 0 };
  let safeTop = 0;
  const myLevel = () => (argLevel ? Math.max(1, Math.floor(Number(argLevel)) || 1) : levelOf(skillBook(id).you.r));

  // ---------------------------------------------------------------- the overlay
  const overlay = new Overlay(canvas, `g4.g4board.g6.g6poker`, title);
  const statusText = h('span.g5st', '');
  const dot = h('i.g5dot', { 'aria-hidden': 'true' });
  const status = h('div.g5status', { 'aria-hidden': 'true' }, statusText, dot);
  const head = h('div.g5head', { 'aria-hidden': 'true' }, h('b.g5title', title), h('span.g5lvl', ''), h('span.g5info', ''));
  const tagOpp = h('div.g6tag', { role: 'status' });
  const tagPot = h('div.g6tag.pot', { role: 'status' });
  const tagYou = h('div.g6tag', { role: 'status' });
  const btn = (label: string, aria: string, name: string, cls = '') => {
    const b = h(`button.g4btn.g4act.g4small${cls ? `.${cls}` : ''}` as 'button', { type: 'button', 'aria-label': aria, dataset: { act: name } }, label);
    const go = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      synth.wake();
      press(name);
      haptic(6);
    };
    b.addEventListener('pointerdown', go);
    b.addEventListener('click', (e) => e.detail === 0 && go(e));
    return b;
  };
  const foldBtn = btn('FOLD', 'Fold your hand', 'fold');
  const callBtn = btn('CHECK', 'Check', 'call');
  const raiseBtn = btn('BET', 'Bet', 'raise', 'on');
  const nextBtn = btn('NEXT HAND', 'Deal the next hand', 'next', 'on');
  const rowA = h('div.g4ctl.g5ctl.g6rowa', foldBtn, callBtn, raiseBtn, nextBtn);
  const sizeBtns = SIZES.map((s) => btn(s.label, s.aria, `size-${s.id}`));
  const rowB = h('div.g4ctl.g6rowb', ...sizeBtns);
  const hintBtn = btn('HINT', 'Hint: your chance of winning, as an estimate. One a hand, and it costs your rating nothing', 'hint');
  const histBtn = btn('HISTORY', 'The hands so far, every card and every bet', 'history');
  const rulesBtn = btn('RULES', 'The rules of this game', 'rules');
  const rowC = h('div.g4ctl.g5ctl.g6rowc', hintBtn, histBtn, rulesBtn);
  rowB.style.bottom = 'calc(var(--g-safe-bottom) + var(--g-s-1) + 62px)';
  rowC.style.bottom = 'calc(var(--g-safe-bottom) + var(--g-s-1) + 124px)';
  const pauseBtn = hudButton('g2pause.g4pause', '', 'Pause', () => openPause());
  overlay.layer.append(head, status, tagOpp, tagPot, tagYou, pauseBtn, rowC, rowB, rowA);
  try {
    const probe = h('div', { style: 'position:absolute;visibility:hidden;padding-top:var(--g-safe-top,0px)' });
    overlay.root.append(probe);
    safeTop = Math.round(parseFloat(getComputedStyle(probe).paddingTop) || 0);
    probe.remove();
  } catch {
    safeTop = 0;
  }
  overlay.root.dataset.mode = mode;
  const setMode = (m: Mode) => {
    mode = m;
    overlay.root.dataset.mode = m;
  };

  // ---------------------------------------------------------------- what he can do
  const handOver = (): boolean => !hand || hand.over;
  const humanTurn = (): boolean => mode === 'play' && !!hand && !hand.over && hand.toAct === 0 && !thinking;
  const sizeTo = (sid: (typeof SIZES)[number]['id']): number => {
    if (!hand) return 0;
    const L = legalOf(hand);
    const s = SIZES.find((x) => x.id === sid)!;
    if (s.frac < 0) return L.maxTo;
    if (s.frac === 0) return L.minTo;
    const pNow = potOf(hand);
    const to = Math.round(hand.bets[1] + (pNow + L.call) * s.frac);
    return Math.max(L.minTo, Math.min(L.maxTo, to));
  };
  const you = (): number => hand?.stacks[0] ?? sess.stacks[0];
  const him = (): number => hand?.stacks[1] ?? sess.stacks[1];
  const bbNow = (): number => hand?.bb ?? bigBlind(level, sess.n + 1);

  const paintTexts = () => {
    const lvl = head.querySelector('.g5lvl');
    if (lvl) lvl.textContent = `Level ${level}`;
    const info = head.querySelector('.g5info');
    const hn = hand?.n ?? sess.n;
    if (info) info.textContent = `Hand ${Math.min(hn || 1, sess.limit)} of ${sess.limit} · blinds ${Math.max(1, Math.floor(bbNow() / 2))}/${bbNow()}`;
    const L = hand && !hand.over ? legalOf(hand) : null;
    if (mode === 'over') statusText.textContent = outcome;
    else if (thinking || hinting) statusText.textContent = hinting ? 'Working out your chances…' : 'Ghosty is thinking…';
    else if (hand?.over) statusText.textContent = handLine;
    else if (humanTurn() && L) statusText.textContent = L.fold ? `Your move: ${num(L.call)} to call.` : 'Your move: check or bet.';
    else statusText.textContent = '';
    status.classList.toggle('busy', thinking || hinting);
    overlay.root.classList.toggle('g5thinking', thinking || hinting);
    // the table, in words and chips
    const bets = hand ? hand.bets : [0, 0];
    tagOpp.replaceChildren(h('b', `Ghosty · ${num(him())} chips`), bets[1] ? ` · bet ${num(bets[1])}` : '', ghostSaid ? h('div', ghostSaid) : '');
    tagPot.replaceChildren(h('b', hand?.over && hand.won ? (hand.winner === 2 ? `Split: ${num(hand.won)} chips` : hand.winner === 0 ? `You win ${num(hand.won)} chips` : `Ghosty wins ${num(hand.won)} chips`) : `Pot ${num(hand ? potOf(hand) : 0)} chips`));
    tagYou.replaceChildren(h('b', `You · ${num(you())} chips`), bets[0] ? ` · bet ${num(bets[0])}` : '');
    // the keys
    const turn = humanTurn();
    const over = !!hand?.over && mode === 'play';
    foldBtn.hidden = callBtn.hidden = raiseBtn.hidden = over;
    nextBtn.hidden = !over || sess.over;
    rowB.hidden = over;
    foldBtn.disabled = !turn || !L?.fold;
    callBtn.disabled = !turn;
    callBtn.textContent = L && L.fold ? (L.call >= you() && you() > 0 ? 'ALL IN' : `CALL ${num(L.call)}`) : 'CHECK';
    callBtn.setAttribute('aria-label', L && L.fold ? `Call ${num(L.call)} chips` : 'Check');
    const canRaise = turn && !!L?.canRaise;
    const to = canRaise ? sizeTo(sizeId) : 0;
    raiseBtn.disabled = !canRaise;
    raiseBtn.textContent = canRaise ? `${hand!.bets[1] ? 'RAISE' : 'BET'} ${num(to)}` : 'RAISE';
    raiseBtn.setAttribute('aria-label', canRaise ? `${hand!.bets[1] ? 'Raise to' : 'Bet'} ${num(to)} chips` : 'Raise');
    SIZES.forEach((s, i) => {
      const b = sizeBtns[i]!;
      b.disabled = !canRaise;
      b.classList.toggle('on', s.id === sizeId);
      b.setAttribute('aria-pressed', String(s.id === sizeId));
    });
    hintBtn.disabled = !turn || hintUsed;
    hintBtn.textContent = hintUsed ? 'HINT USED' : 'HINT';
    hintBtn.setAttribute('aria-disabled', String(hintBtn.disabled));
    for (const b of [foldBtn, callBtn, raiseBtn, hintBtn]) b.setAttribute('aria-disabled', String(b.disabled));
  };

  // ---------------------------------------------------------------- sound
  const sfx = (kind: string) => {
    if (kind === 'deal') [0, 0.07].forEach((at) => synth.noise({ dur: 0.05, f: 2400, q: 0.8, vol: 0.06, at }));
    else if (kind === 'chips') [0, 0.05, 0.1].forEach((at) => synth.tone({ f: 1500 + at * 3000, dur: 0.03, type: 'triangle', vol: 0.05, at }));
    else if (kind === 'check') synth.tone({ f: 260, dur: 0.05, type: 'sine', vol: 0.06 });
    else if (kind === 'fold') synth.noise({ dur: 0.1, f: 700, q: 0.5, vol: 0.06 });
    else if (kind === 'hint') [784, 1175].forEach((f, i) => synth.tone({ f, dur: 0.1, type: 'sine', vol: 0.08, at: i * 0.07 }));
    else if (kind === 'win') [523, 659, 784, 1047].forEach((f, i) => synth.tone({ f, dur: 0.16, type: 'triangle', vol: 0.11, at: i * 0.1 }));
    else if (kind === 'lose') [392, 330, 262, 196].forEach((f, i) => synth.tone({ f, dur: 0.2, type: 'triangle', vol: 0.1, at: i * 0.13 }));
    else if (kind === 'nope') synth.tone({ f: 160, dur: 0.08, type: 'square', vol: 0.05 });
  };

  // ---------------------------------------------------------------- Ghosty, in the Worker
  const asker = new Asker((m) => decidePoker({ ...(m as { view: any; level: number; seed: number; ms: number; samples?: number; hint?: boolean }), ms: Math.min(Number((m as { ms: number }).ms) || 0, 900) }));
  const ask = <T>(m: Record<string, unknown>) => asker.ask<T>({ kind: 'poker', ...m });

  // ---------------------------------------------------------------- the session
  const persist = () => {
    if (!sess || (sess.over && (!hand || hand.over))) {
      void opts.saves.remove(saveName).catch(() => undefined);
      saved = null;
      return;
    }
    const s: Saved = { seed: sess.seed, level: sess.level, limit: sess.limit, start: sess.start, acts, played, tell };
    saved = s;
    void opts.saves.put(saveName, new TextEncoder().encode(JSON.stringify(s))).catch(() => undefined);
  };
  /** The session as the save says it stands: hands finished, the hand in front of you. */
  const replay = (s: Saved): { sess: Session; hand: Hand | null } => {
    const ss = newSession(s.seed, s.level, s.limit, s.start);
    let hd: Hand | null = null;
    for (let i = 0; i < s.acts.length; i++) {
      hd = deal(ss);
      for (const a of s.acts[i]!) act(hd, a);
      if (hd.over && i < s.acts.length - 1) {
        finishHand(ss, hd, resultLine(hd));
        hd = null;
      } else if (hd.over) {
        // the last hand is over but not yet counted: it is counted when the result is shown
      }
    }
    return { sess: ss, hand: hd };
  };
  const begin = (resume: Saved | null) => {
    synth.wake();
    ticket++;
    thinking = false;
    hinting = false;
    pendingGhost = null;
    outcome = '';
    handLine = '';
    ghostSaid = '';
    hintText = '';
    overlay.closeMenu();
    if (resume) {
      try {
        const r = replay(resume);
        sess = r.sess;
        hand = r.hand;
        acts = resume.acts.map((a) => a.slice());
        level = resume.level;
        played = resume.played;
        tell = resume.tell ?? { raises: 0, bluffs: 0 };
        hintUsed = false;
        damaged = false;
        setMode('play');
        loop.start();
        if (hand && hand.over) {
          // closed on a finished hand: its result is said again and it is counted now
          showResult();
        } else if (!hand) nextHand();
        else {
          refresh();
          if (hand.toAct === 1) void ghostMove();
        }
        return;
      } catch {
        damaged = true;
        saved = null;
        void opts.saves.remove(saveName).catch(() => undefined);
        overlay.say(DAMAGED_SAVE, 4200);
      }
    }
    damaged = damaged && !!resume;
    const seed = argSeed ? Number(argSeed) || 1 : (Math.random() * 2 ** 31) | 0;
    level = myLevel();
    played = ratingBook(id).you.games;
    sess = newSession(seed, level, argHands ? Math.max(1, Math.floor(Number(argHands)) || HANDS) : HANDS, argStack ? Math.max(20, Math.floor(Number(argStack)) || START_CHIPS) : START_CHIPS);
    acts = [];
    tell = { raises: 0, bluffs: 0 };
    hand = null;
    setMode('play');
    loop.start();
    nextHand();
  };
  const nextHand = () => {
    hand = deal(sess);
    acts.push([]);
    hintUsed = false;
    hintText = '';
    handLine = '';
    ghostSaid = '';
    sizeId = 'half';
    sfx('deal');
    overlay.announce(`Hand ${hand.n}. Your cards: ${hand.hole[0].map(cardWords).join(' and ')}. ${hand.button === 0 ? 'You are on the button.' : 'Ghosty is on the button.'}`);
    persist();
    refresh();
    if (hand.over) return resolve();
    if (hand.toAct === 1) void ghostMove();
  };
  const refresh = () => paintTexts();
  const press = (name: string) => {
    if (name.startsWith('size-')) {
      if (!humanTurn()) return;
      sizeId = name.slice(5) as typeof sizeId;
      sfx('check');
      return refresh();
    }
    if (name === 'hint') return void askHint();
    if (name === 'rules') return openRules(() => closeToPlay());
    if (name === 'history') return openHistory(() => closeToPlay());
    if (name === 'next') {
      if (mode === 'play' && hand?.over && !sess.over) nextHand();
      return;
    }
    if (!humanTurn() || !hand) return sfx('nope');
    const L = legalOf(hand);
    if (name === 'fold' && L.fold) return humanAct({ t: 'fold' });
    if (name === 'call') return humanAct(L.fold ? { t: 'call' } : { t: 'check' });
    if (name === 'raise' && L.canRaise) return humanAct({ t: 'raise', to: sizeTo(sizeId) });
    sfx('nope');
  };
  const humanAct = (a: { t: Act['t']; to?: number }) => {
    if (!hand || hand.over) return;
    const rec = act(hand, a);
    acts[acts.length - 1]!.push(a);
    ghostSaid = '';
    sfx(rec.t === 'fold' ? 'fold' : rec.t === 'check' ? 'check' : 'chips');
    afterAct();
  };
  const afterAct = () => {
    persist();
    refresh();
    if (!hand) return;
    if (hand.over) return resolve();
    if (hand.toAct === 1) void ghostMove();
  };
  const said = (a: Act, open: boolean): string => (a.t === 'raise' ? `I ${open ? 'bet' : 'raise to'} ${num(a.to)}.` : a.t === 'call' ? `I call ${num(a.amt)}.` : a.t === 'check' ? 'I check.' : 'I fold.');
  const ghostMove = async () => {
    if (mode !== 'play' || !hand || hand.over) return;
    const my = ++ticket;
    thinking = true;
    refresh();
    const view = viewOf(hand, 1);
    const ms = fast ? 160 : Math.max(240, Math.round(thinkMs(level) * 0.6));
    const t1 = performance.now();
    const d = await ask<Choice>({ view, level, seed: sess.seed + hand.n * 7919 + hand.log.length * 31, ms });
    const wait = Math.max(0, MIN_THINK_MS - (performance.now() - t1));
    if (wait && !fast) await new Promise((r) => setTimeout(r, wait));
    if (my !== ticket || (mode as Mode) === 'gone') return;
    lastThink = { ms: Math.round(performance.now() - t1), samples: d.samples, eq: d.eq, bluff: d.bluff };
    thinking = false;
    if (mode !== 'play') {
      pendingGhost = d;
      return;
    }
    applyGhost(d);
  };
  const applyGhost = (d: Choice) => {
    if (!hand || hand.over) return;
    // a bet is a raise on a street where nobody has bet yet (before the flop the blinds are the bet)
    const open = hand.street > 0 && hand.bets[0] === 0;
    const rec = act(hand, { t: d.t, to: d.to });
    acts[acts.length - 1]!.push({ t: d.t, to: d.to });
    if (d.t === 'raise') {
      tell.raises++;
      if (d.bluff) tell.bluffs++;
    }
    ghostSaid = d.t === 'raise' ? `${open ? 'Bets' : 'Raises to'} ${num(rec.to)}` : d.t === 'call' ? `Calls ${num(rec.amt)}` : d.t === 'check' ? 'Checks' : 'Folds';
    overlay.announce(said(rec, open));
    sfx(rec.t === 'fold' ? 'fold' : rec.t === 'check' ? 'check' : 'chips');
    afterAct();
  };

  /** A hand has ended: said in his voice with the winning hand named; the next hand waits for a tap. */
  const resolve = () => {
    if (!hand) return;
    thinking = false;
    ticket++;
    showResult();
  };
  const showResult = () => {
    if (!hand) return;
    handLine = resultLine(hand);
    const rec = finishHand(sess, hand, handLine);
    void rec;
    if (hand.winner === 0) sfx('win');
    else if (hand.winner === 1) sfx('lose');
    else sfx('check');
    overlay.announce(`${handLine} You have ${num(hand.stacks[0])} chips, Ghosty ${num(hand.stacks[1])}.`);
    persist();
    refresh();
    if (sess.over) setTimeout(() => mode === 'play' && finishSession(), fast ? 200 : 1600);
  };

  const askHint = async () => {
    if (!humanTurn() || hintUsed || hinting || !hand) return;
    hintUsed = true;
    hinting = true;
    refresh();
    const my = ticket;
    const d = await ask<{ eq: number; need: number }>({ view: viewOf(hand, 0), level, seed: sess.seed ^ 0x5bd1e995 ^ hand.n, ms: fast ? 160 : 700, hint: true });
    hinting = false;
    if (my !== ticket || (mode as Mode) === 'gone') return;
    hintText = `Your chance of winning is ${aboutPercent(d.eq)}. That is an estimate, not a promise.${d.need > 0 ? ` Calling needs about ${Math.round(d.need * 100)}%.` : ''} A hint costs your rating nothing.`;
    sfx('hint');
    overlay.say(hintText, 5200);
    refresh();
  };

  const finishSession = () => {
    const youScore = sessionScore(sess);
    const before = ratingBook(id);
    const after = afterGame(before, youScore, level, Date.now());
    saveBook(id, after);
    played = after.you.games;
    let levelLine: string;
    if (youScore !== 0.5) {
      const o = finishRun(id, 'you', youScore === 1, 1, 1);
      levelLine = o.levelAfter > o.levelBefore ? `Level ${o.levelBefore} beaten. On to Level ${o.levelAfter}: he will think for about ${secondsWords(thinkMs(o.levelAfter) * 0.6)} a move.` : o.levelAfter < o.levelBefore ? `Back to Level ${o.levelAfter}: he will think for about ${secondsWords(thinkMs(o.levelAfter) * 0.6)} a move.` : `Level ${o.levelAfter} again.`;
      if (youScore === 1) recordScore(id, level);
    } else levelLine = 'Level the chips: your level stays where it is.';
    const d = (a: number, b: number) => (near10(a) === near10(b) ? 'no change' : `${near10(a).toLocaleString('en-GB')} to ${near10(b).toLocaleString('en-GB')}`);
    lastLine = `Your rating ${d(before.you.r, after.you.r)} · Ghosty's ${d(before.me.r, after.me.r)}`;
    outcome = youScore === 1 ? 'You won the session' : youScore === 0 ? 'Ghosty won the session' : 'The session is level';
    sfx(youScore === 1 ? 'win' : youScore === 0 ? 'lose' : 'check');
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify({ at: Date.now(), level, hands: sess.history }));
    } catch {
      /* the history lives for this visit only */
    }
    persist();
    refresh();
    showOver(levelLine);
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `Sound: ${synth.on ? 'on' : 'off'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const honest = () => 'Ghosty plays on this phone: a chance of winning worked out by dealing the rest of the cards, a range for your hand that narrows as you bet, and a bluff now and then. No learning runs here.';
  const lastHistory = (): HandRec[] => {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? 'null') as { hands?: HandRec[] } | null;
      return Array.isArray(raw?.hands) ? raw!.hands! : [];
    } catch {
      return [];
    }
  };
  const openTitle = () => {
    reopen = openTitle;
    setMode('title');
    loop.start();
    const past = lastHistory();
    overlay.menu({
      title,
      line: entry.ghosty,
      notes: [`Level ${myLevel()} · he thinks for about ${secondsWords(thinkMs(myLevel()) * 0.6)} a move · ${HANDS} hands or a bust`, ratingTail(id), CHIPS_LINE, honest(), ...(damaged ? [DAMAGED_SAVE] : [])],
      buttons: [
        ...(saved ? [{ label: 'Continue', aria: 'Continue your poker session', primary: true, act: () => begin(saved) }] : []),
        { label: saved ? 'New session' : 'Play', aria: `${saved ? 'Start a new session of' : 'Play'} poker`, primary: !saved, act: () => begin(null) },
        ...(past.length ? [{ label: 'Last session\'s hands', aria: 'Read the hands of the last session', act: () => openHistory(openTitle, past) }] : []),
        { label: 'How to play', act: () => openRules(openTitle) },
        soundBtn(openTitle),
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
    });
    draw();
  };
  const openRules = (back: () => void) => {
    reopen = () => openRules(back);
    const was = mode;
    if (mode === 'play') {
      setMode('paused');
      loop.stop();
    }
    const how = h('div.g2how', ...RULES.map((p) => h('p', p)), h('p', `A hint (one a hand) costs your rating nothing. Ghosty thinks for as long as the level says, and the level rises when you win a session and eases back when you lose one. There is no top level. A controller: A calls or checks, B folds, X bets or raises, START pauses. A keyboard: C, F, R, H, Enter.`), h('p', honest()));
    overlay.menu({ title: 'How to play', extra: how, buttons: [{ label: was === 'play' ? 'Back to the game' : 'Back', act: back }], kind: 'how' });
  };
  const openHistory = (back: () => void, list: HandRec[] = sess.history) => {
    reopen = () => openHistory(back, list);
    const was = mode;
    if (mode === 'play') {
      setMode('paused');
      loop.stop();
    }
    const body = h('div.g2how.g6hist', ...(list.length ? list.flatMap((r) => [h('p', h('b', historyLines(r)[0]!)), ...historyLines(r).slice(1).map((l) => h('p', l))]) : [h('p', 'No hand has been played yet.')]));
    overlay.menu({ title: 'The hands', extra: body, buttons: [{ label: was === 'play' ? 'Back to the game' : 'Back', act: back }], kind: 'how' });
  };
  const closeToPlay = () => {
    overlay.closeMenu();
    if (sess.over && hand?.over) setMode('over');
    else {
      setMode('play');
      loop.start();
      if (pendingGhost && !thinking) {
        const d = pendingGhost;
        pendingGhost = null;
        applyGhost(d);
      } else if (hand && !hand.over && hand.toAct === 1 && !thinking) void ghostMove();
    }
    refresh();
  };
  const openPause = () => {
    if (mode !== 'play') return;
    reopen = openPause;
    setMode('paused');
    loop.stop();
    overlay.menu({
      title: 'Paused',
      line: `Hand ${hand?.n ?? 1} of ${sess.limit}. You have ${num(you())} chips and Ghosty ${num(him())}. ${CHIPS_LINE}`,
      buttons: [
        { label: 'Resume', primary: true, act: () => closeToPlay() },
        { label: 'How to play', act: () => openRules(openPause) },
        { label: 'The hands', act: () => openHistory(openPause) },
        soundBtn(openPause),
        { label: 'Give up', aria: 'Give up this session: it counts as a loss', act: () => (setMode('play'), overlay.closeMenu(), giveUp()) },
        { label: 'Quit', aria: 'Quit to the arcade; the session is kept', act: () => void leave() },
      ],
      kind: 'pause',
    });
    draw();
  };
  const giveUp = () => {
    ticket++;
    thinking = false;
    sess.over = true;
    // the chips left in the hand go to him, and the session is a loss
    if (hand && !hand.over) {
      hand.over = true;
      hand.winner = 1;
      hand.folded = 0;
      hand.stacks[1] += hand.pot + hand.bets[0] + hand.bets[1];
      hand.pot = 0;
      hand.bets = [0, 0];
      finishHand(sess, hand, 'You gave up. The pot is mine.');
    }
    sess.stacks = [0, sess.stacks[0] + sess.stacks[1]];
    finishSession();
  };
  const showOver = (levelLine: string) => {
    setMode('over');
    loop.stop();
    reopen = overMenu;
    function overMenu() {
      overlay.menu({
        title: outcome,
        line: sessionScore(sess) === 1 ? 'Well played.' : sessionScore(sess) === 0.5 ? 'Neither of us gave an inch.' : 'Again? He does not tire, but you learn.',
        notes: [`You: ${num(sess.stacks[0])} chips · Ghosty: ${num(sess.stacks[1])} chips after ${sess.n} hands`, `He raised ${tell.raises} times and bluffed ${tell.bluffs}.`, lastLine, levelLine, ratingTail(id), CHIPS_LINE],
        buttons: [
          { label: 'Play again', primary: true, act: () => begin(null) },
          { label: 'The hands', act: () => openHistory(overMenu) },
          { label: 'Menu', act: () => (hand = null, openTitle()) },
          soundBtn(overMenu),
          { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    overMenu();
    overlay.announce(`${outcome}. ${lastLine}. ${levelLine}`);
    draw();
  };

  // ---------------------------------------------------------------- the table
  const KEYS: Record<string, string> = { c: 'call', f: 'fold', r: 'raise', h: 'hint', Enter: 'next', ' ': 'call' };
  const queued: string[] = [];
  const onKey = (e: KeyboardEvent) => {
    if (e.type !== 'keydown') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape' || k === 'p') {
      if (mode === 'play') openPause();
      return;
    }
    const n = KEYS[k];
    if (!n || mode !== 'play' || overlay.menuOpen) return;
    e.preventDefault();
    queued.push(n);
  };
  window.addEventListener('keydown', onKey);
  let prevHeld = new Set<string>();
  const layout = () => {
    const { w, h: hh } = size;
    const top = 112 + safeTop;
    const reserve = 196;
    const room = Math.max(200, hh - top - reserve);
    const cw = Math.max(34, Math.min(58, Math.floor((w - 56) / 5.4)));
    const ch = Math.round(cw * 1.42);
    const oppY = top + 34;
    const youY = top + room - ch - 28;
    const boardY = Math.round((oppY + ch + youY) / 2 - ch / 2) - 2;
    return { w, top, cw, ch, oppY, youY, boardY, room };
  };
  const rr = (x: number, y: number, w: number, hh: number, rad: number) => {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + hh, rad);
    g.arcTo(x + w, y + hh, x, y + hh, rad);
    g.arcTo(x, y + hh, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  };
  const drawCard = (x: number, y: number, w: number, hh: number, c: number | null, lit: boolean) => {
    rr(x, y, w, hh, 6);
    if (c === null) {
      g.fillStyle = '#1b2a3a';
      g.fill();
      g.strokeStyle = accent;
      g.globalAlpha = 0.7;
      g.lineWidth = 1.5;
      g.stroke();
      g.globalAlpha = 1;
      rr(x + 5, y + 5, w - 10, hh - 10, 3);
      g.strokeStyle = accent;
      g.globalAlpha = 0.35;
      g.stroke();
      g.globalAlpha = 1;
      return;
    }
    g.fillStyle = '#f4f1e8';
    g.fill();
    g.lineWidth = lit ? 3 : 1;
    g.strokeStyle = lit ? '#ffcf5c' : 'rgba(0,0,0,.35)';
    g.stroke();
    const red = ((c / 13) | 0) === 1 || ((c / 13) | 0) === 2;
    g.fillStyle = red ? '#c93a3a' : '#1a1d24';
    const t = cardText(c);
    g.font = `700 ${Math.round(w * 0.42)}px ui-sans-serif, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const suit = t.slice(-1);
    const rank = t.slice(0, -1);
    g.fillText(rank, x + w / 2, y + hh * 0.46);
    g.font = `700 ${Math.round(w * 0.5)}px ui-sans-serif, system-ui, sans-serif`;
    g.fillText(suit, x + w / 2, y + hh * 0.84);
  };
  const best5 = (hole: readonly [number, number], board: readonly number[]): Set<number> => {
    // the cards that make the winning hand shine at a showdown: those of the best five among the seven
    const all = [...hole, ...board];
    if (all.length < 5) return new Set();
    let bestV = -1;
    let pick: number[] = [];
    const n = all.length;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const rest = all.filter((_, i) => i !== a && i !== b);
      const v = evaluate(rest);
      if (v > bestV) ((bestV = v), (pick = rest));
    }
    return new Set(pick);
  };
  const draw = () => {
    fit();
    g.setTransform(res.scale, 0, 0, res.scale, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, size.h);
    bg.addColorStop(0, '#080b11');
    bg.addColorStop(1, '#10151e');
    g.fillStyle = bg;
    g.fillRect(0, 0, size.w, size.h);
    const L = layout();
    // the felt: a plate in the Machine's marks
    g.fillStyle = '#0d1118';
    rr(10, L.top - 4, size.w - 20, L.room + 10, 14);
    g.fill();
    g.strokeStyle = accent;
    g.globalAlpha = 0.4;
    g.lineWidth = 1;
    g.stroke();
    g.globalAlpha = 1;
    const gap = Math.round(L.cw * 0.12);
    const shownHis = !!hand && hand.showdown;
    const hl: [Set<number>, Set<number>] = hand && hand.showdown && hand.winner !== -1 ? (hand.winner === 2 ? [best5(hand.hole[0], hand.board), best5(hand.hole[1], hand.board)] : [hand.winner === 0 ? best5(hand.hole[0], hand.board) : new Set<number>(), hand.winner === 1 ? best5(hand.hole[1], hand.board) : new Set<number>()]) : [new Set<number>(), new Set<number>()];
    // Ghosty's two cards (backs until a showdown), yours, and the five on the table
    const pair = (y: number, cards: readonly [number, number] | null, who: Seat) => {
      const x = Math.round(size.w / 2 - L.cw - gap / 2);
      for (let i = 0; i < 2; i++) drawCard(x + i * (L.cw + gap), y, L.cw, L.ch, cards ? cards[i]! : null, !!cards && hl[who].has(cards[i]!));
    };
    if (hand) {
      pair(L.oppY, shownHis ? hand.hole[1] : null, 1);
      pair(L.youY, hand.hole[0], 0);
      const bx = Math.round((size.w - (5 * L.cw + 4 * gap)) / 2);
      for (let i = 0; i < 5; i++) {
        const c = hand.board[i];
        if (c === undefined) {
          rr(bx + i * (L.cw + gap), L.boardY, L.cw, L.ch, 6);
          g.strokeStyle = 'rgba(255,255,255,.14)';
          g.lineWidth = 1;
          g.stroke();
        } else drawCard(bx + i * (L.cw + gap), L.boardY, L.cw, L.ch, c, hl[0].has(c) || hl[1].has(c));
      }
      // the button
      const bxd = hand.button === 0 ? Math.round(size.w / 2 + L.cw + gap * 1.5 + 10) : Math.round(size.w / 2 + L.cw + gap * 1.5 + 10);
      const byd = (hand.button === 0 ? L.youY : L.oppY) + L.ch / 2;
      g.beginPath();
      g.arc(bxd, byd, 13, 0, 6.3);
      g.fillStyle = '#ffcf5c';
      g.fill();
      g.fillStyle = '#10151e';
      g.font = '700 13px ui-sans-serif, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('D', bxd, byd + 1);
      // whose move: a ring that breathes (still under reduced motion)
      const a = reduced() ? 1 : 0.6 + 0.4 * Math.sin(clock * 5);
      const turn = hand.over ? -1 : thinking ? 1 : hand.toAct;
      if (turn >= 0 && mode === 'play') {
        g.globalAlpha = a * 0.9;
        g.strokeStyle = turn === 1 ? '#ffcf5c' : accent;
        g.lineWidth = 2;
        const y = turn === 1 ? L.oppY : L.youY;
        rr(Math.round(size.w / 2 - L.cw - gap / 2) - 6, y - 6, 2 * L.cw + gap + 12, L.ch + 12, 10);
        g.stroke();
        g.globalAlpha = 1;
      }
    }
    // the tags sit with their cards
    const set = (el: HTMLElement, y: number) => (el.style.top = `${Math.round(y)}px`);
    set(tagOpp, L.top + 2);
    set(tagPot, L.boardY + L.ch + 8);
    set(tagYou, L.youY + L.ch + 6);
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };
  const fit = () => {
    const { w, h: hh } = cssSize(canvas);
    if (w === size.w && hh === size.h && res.scale === size.s) return;
    size = { w, h: hh, s: res.scale };
    canvas.width = Math.round(w * res.scale);
    canvas.height = Math.round(hh * res.scale);
  };
  const frame = (dt: number) => {
    clock += dt;
    if (overlay.menuOpen) overlay.menuPad(intent);
    if (mode === 'play' && !overlay.menuOpen) {
      for (const [a, n] of [['jump', 'call'], ['use', 'fold'], ['fire', 'raise']] as const) if (intent.held.has(a) && !prevHeld.has(a)) press(n);
      if (intent.held.has('pause') && !prevHeld.has('pause')) openPause();
      while (queued.length) press(queued.shift()!);
    }
    prevHeld = new Set(intent.held);
    intent.lookX = 0;
    intent.lookY = 0;
    draw();
    res.check(loop.stats);
  };
  const loop = new Loop(frame);
  let hostPaused = false;
  const onHidden = () => {
    if (document.hidden && mode === 'play') openPause();
  };
  document.addEventListener('visibilitychange', onHidden);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (size.w = 0)) : null;
  ro?.observe(canvas);
  let finished: Promise<void> | null = null;
  const done = (): Promise<void> =>
    (finished ??= (async () => {
      loop.stop();
      ticket++;
      asker.terminate();
      if (mode === 'play' || mode === 'paused') persist();
      setMode('gone');
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      ro?.disconnect();
      canvas.width = 0;
      canvas.height = 0;
      synth.close();
      overlay.destroy();
    })());
  const leave = async () => {
    await done();
    ev.onQuit?.();
  };
  openTitle();
  paintTexts();
  void rngAt;
  void handName;

  return {
    pause() {
      hostPaused = true;
      loop.stop();
    },
    resume() {
      hostPaused = false;
      if (mode === 'play') loop.start();
    },
    quit: done,
    setSound(on: boolean) {
      synth.setOn(on);
      if (overlay.menuOpen) reopen();
    },
    resetStats: () => loop.stats.reset(),
    peek: () => {
      const rb = ratingBook(id);
      const rect = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      };
      return {
        frames: loop.stats.frames,
        firstFrameMs,
        p50: loop.stats.interval(0.5),
        p95: loop.stats.interval(0.95),
        workP95: loop.stats.workMs(0.95),
        scale: res.scale,
        width: canvas.width,
        height: canvas.height,
        calls: 0,
        triangles: 0,
        paused: !loop.running || hostPaused,
        mode,
        level,
        rating: rb.you.r,
        ghostyRating: rb.me.r,
        state: {
          humanTurn: humanTurn(),
          thinking,
          hinting,
          status: statusText.textContent,
          hand: hand?.n ?? 0,
          limit: sess.limit,
          handsDone: sess.n,
          handOver: handOver(),
          street: hand?.street ?? 0,
          pot: hand ? potOf(hand) : 0,
          stacks: [you(), him()],
          bets: hand ? hand.bets.slice() : [0, 0],
          bb: bbNow(),
          button: hand?.button ?? 0,
          toAct: hand?.toAct ?? 0,
          board: hand ? hand.board.slice() : [],
          hole: hand ? hand.hole[0].slice() : [],
          his: hand?.showdown ? hand.hole[1].slice() : null,
          owed: hand && !hand.over ? legalOf(hand).call : 0,
          canRaise: !!hand && !hand.over && legalOf(hand).canRaise,
          raiseTo: hand && !hand.over && legalOf(hand).canRaise ? sizeTo(sizeId) : 0,
          sizeId,
          result: handLine,
          winner: hand?.winner ?? -1,
          names: hand?.names ?? ['', ''],
          outcome,
          last: lastThink,
          ghostSaid,
          hintUsed,
          hintText,
          tell,
          sessionOver: sess.over,
          historyLen: sess.history.length,
          total: you() + him() + (hand ? hand.pot + hand.bets[0] + hand.bets[1] : 0),
          reduced: reduced(),
          workerBad: asker.bad,
          saved: !!saved,
          thinkMs: thinkMs(level),
          best: scoreOf(id)?.best ?? 0,
          fold: rect(foldBtn),
          call: rect(callBtn),
          raise: rect(raiseBtn),
          next: rect(nextBtn),
        },
      };
    },
  };
}
