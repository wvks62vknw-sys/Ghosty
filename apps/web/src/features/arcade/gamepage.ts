/**
 * A GAME'S PAGE (APPS ROUND, the console-class Arcade): every game on the shelf, and every game he made, opens to a page of
 * its own, as a console's store does: its title and line, its one key (GET with the size said, or PLAY), the screenshots
 * taken as he played, how to play it by touch, controller and keyboard, his record (sittings, time, when, the best), its
 * five trophies, and its licence and credit. Everything on it is kept on this phone; nothing is fetched to show it.
 */
import { clear, h } from '../../core/dom';
import { confirmSheet, modal } from '../../ui/components';
import { allScores } from '../../arcade/scores';
import type { ShelfEntry } from '../../arcade/shelf';
import { forgetStats, playTime, shotsOf, statOf, whenWords } from '../../arcade/stats';
import { gameTrophies, type Trophy } from '../../arcade/trophies';

export const PAGE_WORDS = {
  shots: 'SCREENSHOTS',
  noShots: 'Screenshots appear here as you play: I keep the latest four, on this phone only.',
  how: 'HOW TO PLAY',
  record: 'YOUR RECORD',
  never: 'Not played yet. Your sittings, time and best are kept here once you do.',
  trophies: 'TROPHIES',
  licence: 'LICENCE AND CREDIT',
  made: 'Made here: it plays at once, with nothing to fetch.',
  yours: 'Made by you in the game studio.',
  fetch: 'Fetched only when you tap GET, on Wi-Fi, with its size said; then it plays with no signal.',
  saves: 'Your saved games stay on this phone: load them from the game’s own menu to carry on.',
  forget: 'FORGET MY RECORD',
  forgot: 'Your record and screenshots for this game are gone. Your best score stays.',
};

/** What the page needs from the shelf: the key's words and what it does, the score line, the controls. */
export interface PageOf {
  entry: ShelfEntry;
  /** The card's key now: "PLAY", "GET · 2.5 MB", "STOP". */
  act(): string;
  /** Tap the card's key (the page closes first). */
  press(): void;
  /** The card's score line. */
  score(): string;
  /** How it plays, a line each (the card's controls). */
  controls: string[];
  /** Where its scores are kept, when not under its id (a studio game's `studio.<id>`). */
  scoreKey?: string;
}

const trophyRow = (t: Trophy) =>
  h('li.arctrophy', { dataset: { trophy: t.id, earned: String(t.earned) }, 'aria-label': `${t.name}: ${t.earned ? 'earned' : `not yet, ${Math.round(t.progress * 100)}% of the way`}. ${t.how}` },
    h('span.arcmedal', { 'aria-hidden': 'true' }, t.earned ? '★' : '☆'),
    h('span.arctname', h('b', t.name), h('span', ` ${t.how}`)),
    t.earned ? h('span.arctgot', 'EARNED') : h('span.arctbar', { 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(t.progress * 100)}%` })),
  );

/** The page's body, painted from what is kept now (exported for the spec's and a refresh's sake). */
export function gamePageBody(o: PageOf, onForget?: () => void): HTMLElement {
  const e = o.entry;
  const body = h('div.arcpage', { dataset: { page: e.id } });
  const paint = () => {
    const stat = statOf(e.id);
    const shots = shotsOf(e.id);
    const sc = allScores()[o.scoreKey ?? e.id];
    const key = h('button.arcact.arcpageact', { type: 'button', 'aria-label': `${o.act()}: ${e.title}` }, o.act());
    key.classList.add(/^PLAY/.test(o.act()) ? 'play' : /^STOP/.test(o.act()) ? 'stop' : 'get');
    key.addEventListener('click', () => o.press());
    const sec = (title: string, ...kids: (Node | string | null)[]) => h('section.arcpsec', { dataset: { sec: title.toLowerCase() } }, h('div.lab', title), ...kids);
    clear(body,
      h('p.arcline', e.line),
      h('p.arcghost', h('b', 'Ghosty'), ` ${e.ghosty}`),
      h('div.arcrow', key),
      sec(PAGE_WORDS.shots, shots.length
        ? h('div.arcshots', { role: 'list', 'aria-label': `Screenshots of ${e.title}` }, ...shots.slice().reverse().map((s) => h('img.arcshot', { role: 'listitem', src: s.src, alt: `${e.title}, ${whenWords(s.at)}`, loading: 'lazy' })))
        : h('p.arcnote', { dataset: { state: 'empty' } }, PAGE_WORDS.noShots)),
      sec(PAGE_WORDS.how, h('ul.arcctl', ...o.controls.map((t) => h('li', t)))),
      sec(PAGE_WORDS.record, stat
        ? h('dl.arcrec',
            h('dt', 'Sittings'), h('dd', String(stat.plays)),
            h('dt', 'Time played'), h('dd', playTime(stat.seconds)),
            h('dt', 'Last played'), h('dd', whenWords(stat.last)),
            h('dt', 'First played'), h('dd', whenWords(stat.first)),
            h('dt', 'Best'), h('dd', /^Not (played|won) yet/.test(o.score()) ? 'None yet' : o.score()))
        : h('p.arcnote', { dataset: { state: 'empty' } }, PAGE_WORDS.never)),
      sec(PAGE_WORDS.trophies, h('ul.arctrophies', ...gameTrophies(e.id, stat, sc).map(trophyRow))),
      sec(PAGE_WORDS.licence, ...(e.data
        ? [h('p.arcnote', h('b', 'Licence '), e.data.licence), h('p.arcnote', h('b', 'Credit '), e.data.credit), h('p.arcnote', PAGE_WORDS.fetch)]
        : [h('p.arcnote', e.engine === 'studio' ? PAGE_WORDS.yours : PAGE_WORDS.made)]),
        e.saves ? h('p.arcnote', PAGE_WORDS.saves) : null),
      stat || shots.length
        ? h('button.arcforget', { type: 'button', onclick: async () => {
            if (!(await confirmSheet(`Forget your record of ${e.title}?`, 'Its sittings, time and screenshots go from this phone. Your best score stays.', 'FORGET IT'))) return;
            forgetStats(e.id);
            paint();
            onForget?.();
          } }, PAGE_WORDS.forget)
        : null,
    );
  };
  paint();
  return body;
}

/** Open a game's page over the Arcade. */
export function openGamePage(o: PageOf, onClose?: () => void): { close(): void } {
  let m: { close(): void } | null = null;
  const body = gamePageBody({ ...o, press: () => (m?.close(), o.press()) }, onClose);
  m = modal(o.entry.title, body, onClose);
  return m;
}
