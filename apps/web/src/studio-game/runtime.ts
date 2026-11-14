/**
 * ONE RUNTIME PLAYS ANY GAME, in the arcade (BRIEF-EDITOR-GAME-STUDIO): an Engine with the id `studio`, built on two/shell's
 * makeEngine as THE PLATFORMER is, so it gets the frame for free: the fixed-step loop, the menus (Play · How to play · Sound ·
 * Quit, CONTINUE from the arcade's SaveStore), the pad, the keyboard and a controller, pause when the page is hidden, haptics
 * on a hurt and a pick-up, reduced motion stilling the parallax. The rules are play.ts's, the drawing draw.ts's. A game of his
 * is `plain`: no level and no Ghosty beside it, only his best.
 */
import { h } from '../core/dom';
import type { EngineEvents, EngineFiles } from '../arcade/engines/types';
import type { Intent } from '../arcade/input';
import type { SaveStore } from '../arcade/engines/saves';
import { type ControlApi, type Evt, makeEngine, type Rules } from '../arcade/games/two/shell';
import type { GameEngine } from '../arcade/games/kit';
import { type Game, hardProblems, thingIcon } from './model';
import { buy, closeSheet, dropItem, drain, type Input, newPlay, nextLine, type Play, questLine, scoreOf, sell, snap, step, useItem } from './play';
import { drawPlay, frameCanvas } from './draw';
import { getGame } from './store';
import { NoteTune, tuneOf } from './tune';

export const STUDIO_ID = (gameId: string) => `studio.${gameId}`;
const pts = (n: number) => `${Math.round(n).toLocaleString('en-GB')} point${Math.round(n) === 1 ? '' : 's'}`;
// What a run scores lives in play.ts now (the page's own player scores its high-score table with it, sites.u10).
export { scoreOf };

const icon = (does: Parameters<typeof thingIcon>[0]) => {
  const c = frameCanvas(thingIcon(does));
  const n = document.createElement('canvas');
  n.width = n.height = 32;
  const g = n.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, 32, 32);
  return n;
};

export function rulesFor(game: Game): Rules<Play> {
  const top = game.kind === 'topdown';
  const thingName = (id: string) => game.things.find((t) => t.id === id)?.name ?? id;
  const row = (left: (Node | string)[], right: (Node | string)[]) => h('div.stRow', h('span.stL', ...left), h('span.stR', ...right));
  const rules: Rules<Play> = {
    id: STUDIO_ID(game.id),
    engine: 'studio',
    title: game.name,
    line: game.maker ? `A game by ${game.maker}.` : 'A game you made.',
    how: top
      ? ['Move with the pad: up, down, left and right. A talks to a person, opens a chest and goes through a door; walk into a door to go through it. B is your things: use one, or drop it.', 'The line at the top is your quest. Coins you pick up are yours to spend with anyone who sells. A save point keeps your place and your hearts.']
      : ['◀ ▶ move, JUMP jumps (hold for higher), USE talks to a person, opens a chest and goes through a door (up works for doors too). ITEMS opens your things.', 'The line at the top is your quest. A save point keeps your place and mends your hearts. Land on a foe to stomp it.'],
    ghostyId: `${STUDIO_ID(game.id)}.ghosty`,
    words: pts,
    target: () => 1,
    reserve: top ? 168 : 150,
    plain: true,
    start: (o) => newPlay(game, { resume: typeof o.resume === 'string' ? o.resume : null }),
    step: (r, dt, inp) => {
      const pressed = new Set(inp.pressed);
      if (pressed.has('x') || pressed.has('c')) pressed.add('items');
      const i: Input = { held: inp.held, pressed };
      step(r, dt, i);
    },
    drain: (r) => drain(r) as unknown as Evt[],
    score: scoreOf,
    over: (r) => r.over !== '',
    passed: (r) => r.over === 'won',
    ends: (r) => (r.over === 'won' ? { title: 'You did it', tip: r.why, notes: [`${r.coins} coin${r.coins === 1 ? '' : 's'} · ${Object.values(r.quests).filter((q) => q.done).length} quest${Object.values(r.quests).filter((q) => q.done).length === 1 ? '' : 's'} done`] } : { title: 'Game over', tip: r.why || 'Try again from your last save, or from the start.', notes: [`${r.coins} coin${r.coins === 1 ? '' : 's'} kept`] }),
    bot: () => undefined,
    practice: { id: STUDIO_ID(game.id), theta0: [], sigma: [], play: () => ({ score: 0, target: 1, passed: false }) },
    controls: (api: ControlApi) => (top
      ? [
          h('div.g4grp.left.dpad', api.button({ label: '▲', aria: 'Up', name: 'up', hold: true, cls: 'g4pm stU' }), api.button({ label: '◀', aria: 'Left', name: 'left', hold: true, cls: 'g4pm stL' }), api.button({ label: '▶', aria: 'Right', name: 'right', hold: true, cls: 'g4pm stR' }), api.button({ label: '▼', aria: 'Down', name: 'down', hold: true, cls: 'g4pm stD' })),
          h('div.g4grp.right', api.button({ label: 'ITEMS', aria: 'Your things', name: 'items', cls: 'g4act g4small' }), api.button({ label: 'USE', aria: 'Use: talk, open, go through', name: 'a', cls: 'g4act g4small g4wide' })),
        ]
      : [
          h('div.g4grp.left', api.button({ label: '◀', aria: 'Move left', name: 'left', hold: true, cls: 'g4pm' }), api.button({ label: '▶', aria: 'Move right', name: 'right', hold: true, cls: 'g4pm' })),
          h('div.g4grp.right', api.button({ label: 'ITEMS', aria: 'Your things', name: 'items', cls: 'g4act g4small' }), api.button({ label: 'USE', aria: 'Use: talk, open, go through', name: 'b', cls: 'g4act g4small' }), api.button({ label: 'JUMP', aria: 'Jump, hold for a higher jump', name: 'a', hold: true, cls: 'g4act g4small g4wide' })),
        ]),
    sound: (s, e) => {
      if (!game.fx) return;
      const t = e.type;
      if (t === 'jump') s.tone({ f: 300, to: 560, dur: 0.1, type: 'square', vol: 0.05 });
      else if (t === 'coin') [988, 1319].forEach((f, i) => s.tone({ f, dur: 0.07, type: 'square', vol: 0.06, at: i * 0.05 }));
      else if (t === 'pick' || t === 'heal') [660, 880, 1100].forEach((f, i) => s.tone({ f, dur: 0.08, type: 'triangle', vol: 0.08, at: i * 0.06 }));
      else if (t === 'stomp' || t === 'kill') s.tone({ f: 220, to: 90, dur: 0.12, type: 'square', vol: 0.08 });
      else if (t === 'hurt') (s.tone({ f: 330, to: 110, dur: 0.3, type: 'sawtooth', vol: 0.1 }), s.noise({ dur: 0.1, f: 500, q: 0.6, vol: 0.1 }));
      else if (t === 'die') [440, 330, 247, 165].forEach((f, i) => s.tone({ f, dur: 0.16, type: 'triangle', vol: 0.12, at: i * 0.12 }));
      else if (t === 'spring') s.tone({ f: 200, to: 900, dur: 0.22, type: 'triangle', vol: 0.1 });
      else if (t === 'door' || t === 'unlock') [392, 523].forEach((f, i) => s.tone({ f, dur: 0.1, type: 'triangle', vol: 0.09, at: i * 0.07 }));
      else if (t === 'talk' || t === 'dlgend') s.tone({ f: 520, dur: 0.05, type: 'square', vol: 0.04 });
      else if (t === 'buy') [784, 1047].forEach((f, i) => s.tone({ f, dur: 0.08, type: 'triangle', vol: 0.09, at: i * 0.06 }));
      else if (t === 'refuse' || t === 'locked') s.tone({ f: 150, dur: 0.18, type: 'sawtooth', vol: 0.07 });
      else if (t === 'save') [659, 880, 1175].forEach((f, i) => s.tone({ f, dur: 0.12, type: 'triangle', vol: 0.1, at: i * 0.08 }));
      else if (t === 'quest' || t === 'step' || t === 'chest') [523, 659, 784, 1047].forEach((f, i) => s.tone({ f, dur: 0.1, type: 'triangle', vol: 0.1, at: i * 0.07 }));
      else if (t === 'win') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => s.tone({ f, dur: 0.14, type: 'triangle', vol: 0.11, at: i * 0.09 }));
    },
    haptic: (e) => (e.type === 'hurt' || e.type === 'die' ? 'hit' : e.type === 'coin' || e.type === 'pick' || e.type === 'heal' || e.type === 'buy' ? 'tick' : null),
    say: (e) => (e.type === 'say' ? ((e as unknown as { text?: string }).text ?? null) : null),
    card: (e, r) => (e.type === 'talk' && r.dialog ? { title: r.dialog.name, pages: r.dialog.pages } : null),
    closed: (r) => {
      while (r.dialog) nextLine(r);
    },
    pauseLine: (r) => `${questLine(r) || 'No quest in this game.'} · ${r.coins} coin${r.coins === 1 ? '' : 's'} · ${r.hearts} heart${r.hearts === 1 ? '' : 's'}`,
    makeTune: (s) => {
      const t = tuneOf(game);
      return t ? new NoteTune(s, t) : null;
    },
    persist: { name: `studio-${game.id}`, encode: snap, decode: (raw) => (raw.startsWith('{') ? raw : null) },
    sheet: (r, api) => {
      const sh = r.sheet;
      if (!sh) return null;
      const note = h('p.stNote', { 'aria-live': 'polite' }, r.said || '');
      const done = () => {
        closeSheet(r);
        api.close();
      };
      if (sh.kind === 'shop') {
        const n = game.npcs.find((x) => x.id === sh.npc);
        const list = (n?.shop ?? []).map((it, i) =>
          row([icon(game.things.find((t) => t.id === it.thing)?.does ?? 'quest'), ` ${thingName(it.thing)}`], [`${it.price} coin${it.price === 1 ? '' : 's'} `, h('button.g2btn.pri.stBtn', { type: 'button', 'aria-label': `Buy the ${thingName(it.thing).toLowerCase()} for ${it.price} coins`, onclick: () => (buy(r, sh.npc, i), api.redo()) }, 'Buy')]),
        );
        const sellable = game.things.filter((t) => t.does === 'sell' && (r.inv[t.id] ?? 0) > 0).map((t) => row([` ${t.name} × ${r.inv[t.id]}`], [`${t.value} coin${t.value === 1 ? '' : 's'} `, h('button.g2btn.stBtn', { type: 'button', 'aria-label': `Sell the ${t.name.toLowerCase()} for ${t.value} coins`, onclick: () => (sell(r, t.id), api.redo()) }, 'Sell')]));
        return { title: n?.name ?? 'Shop', line: `You have ${r.coins} coin${r.coins === 1 ? '' : 's'}.`, extra: h('div.stSheet', ...list, ...sellable, note), buttons: [{ label: 'Done', aria: 'Close the shop', primary: true, act: done }] };
      }
      const mine = game.things.filter((t) => (r.inv[t.id] ?? 0) > 0);
      const list = mine.length
        ? mine.map((t) =>
            row([icon(t.does), ` ${t.name}${(r.inv[t.id] ?? 0) > 1 ? ` × ${r.inv[t.id]}` : ''}`], [
              h('button.g2btn.stBtn', { type: 'button', 'aria-label': `Use the ${t.name.toLowerCase()}`, onclick: () => (useItem(r, t.id), api.redo()) }, 'Use'),
              h('button.g2btn.stBtn', { type: 'button', 'aria-label': `Drop the ${t.name.toLowerCase()}`, onclick: () => (dropItem(r, t.id), api.redo()) }, 'Drop'),
            ]),
          )
        : [h('p.stNote', 'You are not carrying anything yet.')];
      return { title: 'Your things', line: `${r.coins} coin${r.coins === 1 ? '' : 's'} · ${r.hearts} of ${game.player.hearts} hearts`, extra: h('div.stSheet', ...list, note), buttons: [{ label: 'Done', aria: 'Close your things', primary: true, act: done }] };
    },
    peek: (r) => ({
      room: r.rid,
      x: r.b.x,
      y: r.b.y,
      hearts: r.hearts,
      lives: r.lives,
      coins: r.coins,
      quest: questLine(r),
      questSteps: Object.fromEntries(Object.entries(r.quests).map(([k, v]) => [k, v.i])),
      done: Object.entries(r.quests).filter(([, v]) => v.done).map(([k]) => k),
      inv: r.inv,
      dialog: r.dialog ? { npc: r.dialog.npc, i: r.dialog.i, pages: r.dialog.pages.length } : null,
      sheet: r.sheet?.kind ?? null,
      over: r.over,
      said: r.said,
      sign: r.sign,
      topdown: top,
      gravity: !top,
      face: r.face,
    }),
    draw: (g, r, v) => drawPlay(g, r, { w: v.w, h: v.h, t: v.t, reserve: v.reserve }),
  };
  return rules;
}

/** The engine the arcade starts for one of his games (`game=<id>` in its words): the game is read from the phone's own database. */
export const studioEngine: GameEngine<never> & { id: string } = {
  id: 'studio',
  start: async (canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }) => {
    const id = (opts.args ?? []).find((a) => a.startsWith('game='))?.slice(5);
    const game = id ? await getGame(id) : null;
    if (!game) throw new Error('That game is not on this phone any more.');
    const bad = hardProblems(game)[0];
    if (bad) throw new Error(bad.text);
    return makeEngine(rulesFor(game), { ghosty: game.maker ? `By ${game.maker}. Walk about, talk, and finish what it asks.` : 'Your own game. Walk about, talk, and finish what it asks.' }).start(canvas, files, intent, ev, opts);
  },
} as never;
