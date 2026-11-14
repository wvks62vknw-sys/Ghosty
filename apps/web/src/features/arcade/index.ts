/**
 * THE ARCADE: real, free games playing entirely on this phone. The SHELF lists every game an engine here plays today
 * (arcade/shelf.ts, through arcade/engines: DOOM and Quake natively, the DOS classics in DOSBox, and the two games made
 * by us, which play at once with nothing to fetch and draw their own controls), one card a game: its
 * title, one plain line, its size, GET (his tap, on Wi-Fi, the size said on the button; on mobile data it says so and
 * waits) or PLAY, the scores, Ghosty's line, and a ⋯ with its licence, its credit, its controls and DELETE. THE FREE
 * LEVELS lists a dozen of the most-loved fan level packs for DOOM (arcade/levels.ts), each with its author, GET and
 * PLAY over Freedoom on DOOM's engine (the pack's WADs given to it with -file). The
 * PLAYER is a fresh full-screen canvas for each game under the TOUCH LAYER (a stick under the left thumb, drag-to-look
 * on the right half, buttons where the right thumb rests, small keys along the top, PAUSE → RESUME · GAME MENU · QUIT ·
 * SOUND · CONTROLS, with the frame rate) and the GAMEPAD LAYER (the standard mapping, read every frame); both fill the
 * one Intent the game's engine reads.
 */
import { netUnknown, secondTap, unknownNet } from '../learn/wifi';
import { draws } from '../../core/crash'; // [health] a draw that stays frozen is told, never a blank
import { headers } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { type Action, BTN, gameButtons, idle, type Intent, merge, PAD_BUTTONS, readPad, type TouchButton, touchLook, touchMove } from '../../arcade/input';
import type { DosButton } from '../../arcade/dos';
import { KEY_LINES, keysIntent, takes } from '../../arcade/keys';
import { gyroLook, gyroOn, type Rate, setGyro } from '../../arcade/gyro';
import { clampMove, layoutOf, nextScale, saveLayout } from '../../arcade/layout';
import { primeAudio } from '../../arcade/engines/audio';
import { dosStats, keyWord } from '../../arcade/engines/dos';
import { engineFor, filesFor, playsToday, readsFor } from '../../arcade/engines/index';
import { saveStore } from '../../arcade/engines/saves';
import type { EngineFiles, EngineHandle, EngineProbe } from '../../arcade/engines/types';
import { LEVELS, LEVELS_BASE, type LevelPack, needsDeh, packArgs, packReads, packWads } from '../../arcade/levels';
import { ratingTail } from '../../arcade/games/board/rating';
import { wordsOf as caveWords } from '../../arcade/games/cave/sim';
import { bookOf, levelOf } from '../../arcade/games/two/skill';
import { allScores, recordScore, recordSitting, type Score, sittingKey } from '../../arcade/scores';
import { type EngineId, type GameData, keptAs, SHELF, type ShelfEntry } from '../../arcade/shelf';
import { getFiles, isHere, offMobileData, onMobileData, type Progress, readKept, removeFiles, sizeWords } from '../../arcade/store';
import { go as goTab, type TabDef } from '../../shell/tabs';
import { ask as studioAsk } from '../../studio-game/hub';
import { listGames, type Meta } from '../../studio-game/store';
import { screenSays } from '../../shell/awareness';
import { button, panel } from '../../ui/components';
import { addShot, allStats, grab, playDays, playTime, recent, recordPlay, whenWords } from '../../arcade/stats';
import { newlyEarned, trophyRoom } from '../../arcade/trophies';
import { openGamePage } from './gamepage';
import { page } from '../../ui/page';
import { sayError } from '../../ui/hisWords';
import { fetchFailed, fetchMid, fetchStart, mobileData, retryKey, SHELF_NONE, startFailed } from './words';

/** What the spec and Ghosty read: the game on screen, what is kept here, the engines' numbers. */
export const arcadeState = {
  playing: '' as string,
  here: [] as string[],
  stats: dosStats,
  pad: false,
  intent: null as Intent | null,
  /** The native engine's own numbers while it plays (null for a DOS game, whose are `stats`). */
  probe: (): EngineProbe | null => null,
  /** Whether the last PLAY started its engine inside the tap itself ('tap') or once its files were read ('after'). */
  started: '' as '' | 'tap' | 'after',
  /** The words the last PLAY gave its engine's command line (a level pack's: its Freedoom phase and its WADs). */
  args: [] as string[],
};

const SOUND_KEY = 'ghosty.arcade.sound';
const soundOn = (): boolean => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};
const setSoundPref = (on: boolean) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* this visit only */
  }
};

/** The games on the shelf: what plays today, plus any a spec adds (window.__ghostyArcadeShelf). */
function shelf(): ShelfEntry[] {
  const extra = (window as unknown as { __ghostyArcadeShelf?: ShelfEntry[] }).__ghostyArcadeShelf ?? [];
  return [...SHELF, ...extra].filter(playsToday);
}

/** The free level packs, plus any a spec adds (window.__ghostyArcadeLevels). */
function levels(): LevelPack[] {
  return [...LEVELS, ...((window as unknown as { __ghostyArcadeLevels?: LevelPack[] }).__ghostyArcadeLevels ?? [])];
}

/** Ghosty's line when a fan-made level is finished. */
const PACK_DONE = 'A fan made that map for nothing but the love of it. On to the next.';

/** "12 min", "45 s": how long he played. */
const timeWords = (s: number): string => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.max(0, Math.round(s))} s`);
/** The most a finished level scores: DOOM's kills, items and secrets, each out of 100; Quake's kills and secrets. */
const TOP: Partial<Record<EngineId, number>> = { doom: 300, quake: 200 };
/** A card's scores: a DOS game's is its longest sitting; DOOM and Quake score a finished level and keep the sitting too;
 *  the games made by us keep their own (the block world: blocks changed in a visit; the runner: a run's points). */
const scoreWords = (engine: EngineId, sc: Score | undefined, sit: Score | undefined): string => {
  const n = (v: number) => v.toLocaleString('en-GB');
  if (engine === 'voxel') return sc ? `Most blocks changed in a visit ${n(sc.best)} · last ${n(sc.last)}` : 'Not played yet';
  const mine: Partial<Record<EngineId, string>> = { blocks: 'Best duel', blast: 'Best grid', flap: 'Best flight', climb: 'Best climb', beat: 'Best song', kart: 'Best race', hopper: 'Best run', arena: 'Best round' };
  if (engine === 'cave') return sc ? `Furthest: ${caveWords(sc.best)} · last ${caveWords(sc.last)}` : 'Not played yet';
  if (engine === 'studio') return sc ? `Your best ${n(sc.best)} points · last ${n(sc.last)}` : 'Not played yet';
  if (engine === 'platform') return sc ? `Best run ${n(sc.best)} points · last ${n(sc.last)}` : 'Not played yet';
  if (BOARDS.has(engine)) return sc ? `Best win at level ${n(sc.best)}` : 'Not won yet';
  if (mine[engine]) return sc ? `${mine[engine]} ${n(sc.best)} · last ${n(sc.last)}` : 'Not played yet';
  if (engine === 'runner') return sc ? `Best run ${n(sc.best)} · last ${n(sc.last)}` : 'Not played yet';
  if (engine === 'dos') return sc ? `Longest sitting ${timeWords(sc.best)} · last ${timeWords(sc.last)}` : 'Not played yet';
  const parts = [...(sc ? [`Best ${sc.best} of ${TOP[engine]} · last ${sc.last}`] : []), ...(sit ? [`${sc ? 'longest' : 'Longest'} sitting ${timeWords(sit.best)}`] : [])];
  return parts.length ? parts.join(' · ') : 'Not played yet';
};

/** The five games with a level (games/two/skill.ts, no top one): yours and Ghosty's, on the card. */
const LEVELLED = new Set<string>(['blocks', 'blast', 'flap', 'climb', 'beat', 'platform', 'cave']);
/** The four board games, poker and the word game: a rating for each of you (the same Glicko-2 as the GYM's chess), not a level, ends the card. */
const BOARDS = new Set<string>(['draughts', 'othello', 'backgammon', 'connect4', 'poker', 'words']);
const levelTail = (e: ShelfEntry): string => {
  if (BOARDS.has(e.engine)) return ` · ${ratingTail(e.id)}`;
  if (!LEVELLED.has(e.engine)) return '';
  const b = bookOf(e.id);
  return ` · You: Level ${levelOf(b.you.r)} · Ghosty: Level ${levelOf(b.ghosty.r)}`;
};

/** The engine's own menu, by name. */
const menuOf = (e: ShelfEntry): string => (e.engine === 'quake' ? "Quake's" : e.engine === 'doom' ? "DOOM's" : "the game's");
/** What DOOM's and Quake's buttons do, in words (the CONTROLS sheet and VoiceOver). */
const nativeDoes = (e: ShelfEntry, a: Action): string =>
  (({
    fire: 'shoots; in the game’s menu it picks',
    use: 'opens doors and flips switches',
    jump: 'jumps',
    weapon: 'the next weapon; in the game’s menu it goes back',
    weaponPrev: 'the weapon before',
    map: 'the map, over the game',
    run: 'runs while held',
    menu: `${menuOf(e)} own menu: new game, save, load, options`,
  }) as Partial<Record<Action, string>>)[a] ?? '';

const PAD_WORDS: Partial<Record<number, string>> = { [BTN.A]: 'A', [BTN.B]: 'B', [BTN.X]: 'X', [BTN.Y]: 'Y', [BTN.LB]: 'LB', [BTN.RB]: 'RB', [BTN.LT]: 'LT', [BTN.RT]: 'RT', [BTN.SELECT]: 'VIEW', [BTN.START]: 'MENU', [BTN.LS]: 'L-STICK', [BTN.RS]: 'R-STICK' };

/** The CONTROLS sheet's lines: the stick, the drag, each button (and its key, or what it does), and the controller. */
function controlLines(e: ShelfEntry): string[] {
  if (e.madeByUs) return ['Its own controls are on the screen, and HOW TO PLAY in its menu shows them.', 'A game controller works too: the left stick and the d-pad move, A jumps, MENU pauses.', 'A keyboard works too: the arrow keys move, and its menu shows the rest.'];
  const c = e.dos?.controls;
  const out: string[] = [];
  if (c) out.push(`Left thumb: the stick presses the ${c.stick === 'wasd' ? 'W A S D keys' : 'arrow keys'}${c.run ? ', and runs when pushed all the way' : ''}.`);
  else out.push('Left thumb: the stick walks and strafes; pushed all the way, it runs.');
  if (!c) out.push(`Right half: drag to turn${e.engine === 'quake' ? ' and to look up and down' : ''}.`);
  else if (c.drag !== 'none') out.push('Right half: drag to turn and look.');
  const shown = gameButtons(e) as (TouchButton & Partial<DosButton>)[];
  for (const b of shown) out.push(c ? `${b.label}${b.key ? ` — ${b.cycle?.length ? b.cycle.map(keyWord).join(', ') : keyWord(b.key)}` : ''}` : `${b.label} — ${nativeDoes(e, b.act)}`);
  const labels = new Map(shown.map((b) => [b.act, b.label] as const));
  // a DOS game's pad presses only the slots its buttons fill; START is the player's PAUSE there, and DOOM's or Quake's
  // own menu in theirs (the player's PAUSE is the button at the top)
  const word = (a: Action): string | undefined => (a === 'pause' ? (c ? 'PAUSE' : 'GAME MENU') : (labels.get(a) ?? (c ? undefined : ({ weaponPrev: 'WEAPON BACK', run: 'RUN' } as Partial<Record<Action, string>>)[a])));
  const padLine = Object.entries(PAD_BUTTONS[e.engine])
    .filter(([, a]) => a && word(a))
    .map(([i, a]) => `${PAD_WORDS[Number(i)] ?? i} ${word(a!)}`);
  out.push(`A controller: the left stick and the d-pad move${!c || c.drag !== 'none' ? ', the right stick looks' : ''}; ${padLine.join(' · ')}.`);
  if (!c) out.push(`A keyboard: ${KEY_LINES.join(' ')}`);
  else out.push('A keyboard: the game’s own keys work as on a computer.');
  return out;
}

/** A card's title as the key to its page: a link-like key (Enter and Space open it too), so a card's own buttons stay its
 *  actions alone. */
const titleKey = (props: { 'aria-label': string }, text: string): HTMLAnchorElement => {
  const a = h('a.arcopen', { href: '#arcade', role: 'button', tabIndex: 0, dataset: { case: 'keep' }, ...props }, text);
  a.addEventListener('click', (ev) => ev.preventDefault());
  a.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      a.click();
    }
  });
  return a;
};

/** Keep a finger's moves on this element even when it slides off (a synthetic touch has nothing to capture). */
const capture = (el: Element, id: number) => {
  try {
    el.setPointerCapture?.(id);
  } catch {
    /* nothing to capture */
  }
};

/** A haptic tick where the phone has them (Android; iPhone Safari has no vibration). */
const vibrate = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration here */
  }
};

/** What PLAY starts: the card's game (its engine, controls and lines), where its scores and saves are kept, the card
 *  that says how it went, the kept files it reads ([where kept, name]) and any words for its engine's command line. */
interface Run {
  id: string;
  card: string;
  title: string;
  entry: ShelfEntry;
  reads: [string, string][];
  args?: string[];
}
const runOf = (e: ShelfEntry): Run => ({ id: e.id, card: e.id, title: e.title, entry: e, reads: readsFor(e) });
let playingTitle = '';

/** A card on the screen: what one GET keeps (where, and the package: none for a game made by us), and its title. */
interface CardOf {
  id: string;
  title: string;
  at: string;
  data: GameData | null;
  saves: boolean;
}

export const arcadeTab: TabDef = {
  id: 'arcade',
  title: 'ARCADE',
  icon: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="15.5" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
  scene: 'backdrop',
  blurb: `free classics, played on this phone · ${shelf().length} games`,
  now() {
    return arcadeState.here.length ? `${arcadeState.here.length} on this phone` : '';
  },
  /** Its card on the Learn hub (shell/hubcards.ts): LIVE while a game is playing. */
  status: () => (arcadeState.playing ? 'LIVE' : 'READY'),
  mount(root) {
    const P = page(root, { tag: 'ARCADE', sub: 'Free classics, playing on this phone. No accounts, no adverts.', leftLabel: 'SHELF', rightLabel: 'ABOUT', stack: true });
    expose();
    const games = shelf();
    /** Every card, by its id, with where its files are kept. */
    const cards = new Map<string, { el: HTMLElement; paint(): void; of: CardOf }>();
    /** Where kept files are on this phone (by where they are kept: one package can fill several cards). */
    const here = new Set<string>();
    const busy = new Map<string, AbortController>();
    const status = new Map<string, string>();
    /** What kind of line each card's status is (loading, offline, error): the page's own marks, read by the spec. */
    const kinds = new Map<string, 'loading' | 'offline' | 'error'>();
    /** The packages whose last fetch failed: their key reads RETRY with the size. */
    const failed = new Set<string>();
    const shelfPanel = panel('THE SHELF', { status: `${games.length} GAME${games.length === 1 ? '' : 'S'}`, cls: 'arcshelf' });
    const grid = h('div.arcgrid', { role: 'list' });
    shelfPanel.body.append(grid);
    /* state: arcade.shelf empty */
    if (!games.length) shelfPanel.body.append(h('div.arcnone', { dataset: { state: 'empty', case: 'keep' } }, h('b', SHELF_NONE.head), h('span', ` ${SHELF_NONE.line}`)));
    const about = panel('HOW IT PLAYS', { cls: 'arcabout' });
    about.body.append(
      h('p.arcnote', 'Each game is fetched once, on Wi-Fi, from the Internet Archive, checked against its known checksum and kept on this phone; it plays with no connection after that.'),
      h('p.arcnote', 'DOOM, Freedoom and Quake run on their own engines, built for the web from their published source; the other classics run in a DOS machine inside the page.'),
      h('p.arcnote', 'Only games whose own licence lets anyone pass them on are here: the free shareware episodes and the freeware releases, each named with its credit. Your saved games stay on this phone.'),
    );
    // THE FREE LEVELS: shown where Freedoom, which every pack plays over, is on the shelf
    const packs = games.some((g) => g.id === LEVELS_BASE) ? levels() : [];
    const levelsPanel = panel('THE FREE LEVELS', { status: `${packs.length} PACKS`, cls: 'arclevels' });
    const levelGrid = h('div.arcgrid', { role: 'list', 'aria-label': 'Free level packs for DOOM' });
    levelsPanel.body.append(h('p.arcnote', 'For DOOM: a dozen of the most-loved level packs fans made and gave away, from the idgames archive. Each plays over Freedoom on the same engine, so GET Freedoom on the shelf too.'), levelGrid);
    // MY GAMES (BRIEF-EDITOR-GAME-STUDIO): what he made in the game studio, each with PLAY at once and EDIT
    const myPanel = panel('MY GAMES', { status: '', cls: 'arcmygames' });
    const myGrid = h('div.arcgrid', { role: 'list', 'aria-label': 'Games you made' });
    myPanel.body.append(myGrid);
    // CONTINUE PLAYING and THE TROPHY ROOM (APPS ROUND): what he played last, and what he has earned, kept on this phone
    const contPanel = panel('CONTINUE PLAYING', { status: '', cls: 'arccont' });
    const contGrid = h('div.arcgrid.arccontgrid', { role: 'list', 'aria-label': 'Games you played lately' });
    contPanel.body.append(contGrid);
    const roomPanel = panel('THE TROPHY ROOM', { status: '', cls: 'arcroom' });
    P.left.append(contPanel.el, shelfPanel.el, myPanel.el, ...(packs.length ? [levelsPanel.el] : []));
    P.right.append(roomPanel.el, about.el);

    const ofGame = (e: ShelfEntry): CardOf => ({ id: e.id, title: e.title, at: keptAs(e), data: e.data, saves: e.saves });
    /** The cards one GET fills (a game, and any card sharing its package: Freedoom's two phases). */
    const sharing = (at: string) => [...cards.values()].filter((c) => c.of.at === at);
    const paintAll = () => {
      for (const c of cards.values()) c.paint();
    };
    /** Ready to play: on this phone, or made by us (nothing to fetch). */
    const ready = (g: ShelfEntry) => !!g.madeByUs || here.has(keptAs(g));
    const hero = () => {
      const n = games.filter(ready).length;
      P.big.textContent = n ? `${n} of ${games.length} ready` : `${games.length} game${games.length === 1 ? '' : 's'}`;
      arcadeState.here = games.filter(ready).map((g) => g.id);
    };

    /** The act button's look: STOP while it is being got, PLAY once here, else GET with the size said. */
    const setAct = (act: HTMLButtonElement, text: string, label: string, aria: string, cls: string) => {
      act.textContent = text;
      act.dataset.label = label; // shown in sentence case, the size's unit kept ("Get · 2.5 MB")
      act.setAttribute('aria-label', aria);
      act.className = `arcact ${cls}`;
    };

    const card = (e: ShelfEntry) => {
      const of = ofGame(e);
      const opener = titleKey({ 'aria-label': `${e.title}: its page, with screenshots, controls, trophies and licence` }, e.title);
      const title = h('h4.arctitle', opener);
      const line = h('p.arcline', e.line);
      const said = h('p.arcghost', h('b', 'Ghosty'), ` ${e.ghosty}`);
      const score = h('p.arcscore');
      const stat = h('p.arcstatus', { 'aria-live': 'polite' });
      const bar = h('div.arcbar', { role: 'progressbar', 'aria-label': `${e.title}: download`, 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i'));
      const act = h('button.arcact', { type: 'button' });
      const more = h('button.arcmore', { type: 'button', 'aria-label': e.madeByUs ? `More about ${e.title}: how it plays` : `More about ${e.title}: licence, controls, delete`, 'aria-expanded': 'false' }, '⋯');
      const details = h('div.arcdetails', { hidden: true });
      const el = h('article.arccard', { role: 'listitem', dataset: { id: e.id }, 'aria-label': e.title }, title, line, said, score, h('div.arcrow', act, more), stat, bar, details);
      const paint = () => {
        const kept = ready(e);
        const getting = busy.has(of.at);
        el.classList.toggle('kept', kept);
        el.classList.toggle('getting', getting);
        const all = allScores();
        score.textContent = scoreWords(e.engine, all[e.id], all[sittingKey(e.id)]) + levelTail(e);
        stat.textContent = status.get(e.id) ?? '';
        if (status.get(e.id) && kinds.get(e.id)) stat.dataset.state = kinds.get(e.id)!;
        else delete stat.dataset.state;
        bar.hidden = !getting;
        if (getting) setAct(act, 'STOP', 'Stop', `Stop getting ${e.title}`, 'stop');
        else if (kept) setAct(act, 'PLAY', 'Play', `Play ${e.title}`, 'play');
        else if (e.data && failed.has(of.at)) setAct(act, retryKey(sizeWords(e.data.bytes)), retryKey(sizeWords(e.data.bytes)), `Retry getting ${e.title}, ${sizeWords(e.data.bytes)}, on Wi-Fi`, 'get');
        else if (e.data) setAct(act, `GET · ${sizeWords(e.data.bytes)}`, `Get · ${sizeWords(e.data.bytes)}`, `Get ${e.title}, ${sizeWords(e.data.bytes)}, on Wi-Fi`, 'get');
        clear(details,
          ...(e.data
            ? [h('p.arcnote', h('b', 'Licence '), e.data.licence), h('p.arcnote', h('b', 'Credit '), e.data.credit)]
            : [h('p.arcnote', 'Made here, by Ghosty: it plays at once, with nothing to fetch and nothing to delete.')]),
          h('ul.arcctl', ...controlLines(e).map((t) => h('li', t))),
          kept && e.data ? button('DELETE FROM THIS PHONE', () => void del(of), 'arcdel') : null,
        );
        const del2 = details.querySelector<HTMLButtonElement>('.arcdel');
        del2?.setAttribute('aria-label', `Delete ${e.title} from this phone (your saved games stay)`);
      };
      // the files are read from the moment his finger lands on PLAY, so the engine can start inside the tap itself
      act.addEventListener('pointerdown', () => {
        if (ready(e) && !busy.has(of.at)) readAhead(runOf(e));
      });
      act.addEventListener('click', () => {
        if (busy.has(of.at)) busy.get(of.at)!.abort();
        else if (ready(e)) play(runOf(e));
        else void get(of);
      });
      more.addEventListener('click', () => {
        details.hidden = !details.hidden;
        more.setAttribute('aria-expanded', String(!details.hidden));
      });
      opener.addEventListener('click', () => pageOf(e, act, () => score.textContent ?? ''));
      cards.set(e.id, { el, paint, of });
      paint();
      return el;
    };

    /** A game's page (gamepage.ts), its key the card's own. */
    const pageOf = (e: ShelfEntry, act: HTMLButtonElement, score: () => string, scoreKey?: string) =>
      openGamePage({ entry: e, act: () => act.textContent ?? '', press: () => act.click(), score, controls: controlLines(e), scoreKey }, () => paintRoom());
    clear(grid, ...games.map(card));

    // a level pack's card: its title, its author, its line, what it plays over, GET or PLAY, its scores
    const packCard = (p: LevelPack) => {
      const key = `level:${p.id}`;
      const of: CardOf = { id: key, title: p.title, at: p.id, data: p.data, saves: true };
      const baseEntry = games.find((g) => keptAs(g) === LEVELS_BASE && (g.plays ?? []).includes(`${p.base}.wad`)) ?? null;
      const baseOf = cards.get(LEVELS_BASE)?.of ?? null;
      const phase = p.base === 'freedoom1' ? 'Phase 1' : 'Phase 2';
      const run = (): Run | null =>
        baseEntry ? { id: p.id, card: key, title: p.title.toUpperCase(), entry: { ...baseEntry, id: p.id, title: p.title.toUpperCase(), done: PACK_DONE }, reads: packReads(p), args: packArgs(p) } : null;
      const score = h('p.arcscore');
      const stat = h('p.arcstatus', { 'aria-live': 'polite' });
      const bar = h('div.arcbar', { role: 'progressbar', 'aria-label': `${p.title}: download`, 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i'));
      const act = h('button.arcact', { type: 'button' });
      const more = h('button.arcmore', { type: 'button', 'aria-label': `More about ${p.title}: licence, credit, delete`, 'aria-expanded': 'false' }, '⋯');
      const details = h('div.arcdetails', { hidden: true });
      const el = h('article.arccard.arcpack', { role: 'listitem', dataset: { level: p.id }, 'aria-label': `${p.title}, by ${p.author}` },
        h('h4.arctitle', p.title),
        h('p.arcby', `by ${p.author}`),
        h('p.arcline', p.line),
        h('p.arcover', `Plays over Freedoom: ${phase}.`),
        needsDeh(p) ? h('p.arcdeh', 'Its DeHackEd patch is not read by this engine, so its names and messages are the original engine’s.') : null,
        score, h('div.arcrow', act, more), stat, bar, details);
      const paint = () => {
        const kept = here.has(p.id);
        const baseHere = here.has(LEVELS_BASE);
        const getting = busy.has(p.id) || (kept && !baseHere && busy.has(LEVELS_BASE));
        el.classList.toggle('kept', kept);
        el.classList.toggle('getting', getting);
        const all = allScores();
        score.textContent = scoreWords('doom', all[p.id], all[sittingKey(p.id)]);
        stat.textContent = status.get(key) ?? '';
        if (status.get(key) && kinds.get(key)) stat.dataset.state = kinds.get(key)!;
        else delete stat.dataset.state;
        bar.hidden = !getting;
        if (getting) setAct(act, 'STOP', 'Stop', `Stop getting ${busy.has(p.id) ? p.title : 'Freedoom'}`, 'stop');
        else if (!kept && failed.has(p.id)) setAct(act, retryKey(sizeWords(p.data.bytes)), retryKey(sizeWords(p.data.bytes)), `Retry getting ${p.title}, ${sizeWords(p.data.bytes)}, on Wi-Fi`, 'get');
        else if (!kept) setAct(act, `GET · ${sizeWords(p.data.bytes)}`, `Get · ${sizeWords(p.data.bytes)}`, `Get ${p.title}, ${sizeWords(p.data.bytes)}, on Wi-Fi`, 'get');
        else if (!baseHere && baseOf?.data) setAct(act, `GET FREEDOOM · ${sizeWords(baseOf.data.bytes)}`, `Get Freedoom · ${sizeWords(baseOf.data.bytes)}`, `${p.title} plays over Freedoom: get Freedoom, ${sizeWords(baseOf.data.bytes)}, on Wi-Fi`, 'get');
        else setAct(act, 'PLAY', 'Play', `Play ${p.title}`, 'play');
        clear(details,
          h('p.arcnote', h('b', 'Licence '), p.data.licence),
          h('p.arcnote', h('b', 'Credit '), p.data.credit),
          h('p.arcnote', h('b', 'Loads '), `${packWads(p).join(', ')} over Freedoom: ${phase}, with DOOM's own controls.`),
          kept ? button('DELETE FROM THIS PHONE', () => void del(of), 'arcdel') : null,
        );
        details.querySelector<HTMLButtonElement>('.arcdel')?.setAttribute('aria-label', `Delete ${p.title} from this phone (Freedoom and your saved games stay)`);
      };
      act.addEventListener('pointerdown', () => {
        const r = run();
        if (r && here.has(p.id) && here.has(LEVELS_BASE) && !busy.has(p.id) && !busy.has(LEVELS_BASE)) readAhead(r);
      });
      act.addEventListener('click', () => {
        const r = run();
        if (busy.has(p.id)) busy.get(p.id)!.abort();
        else if (!here.has(p.id)) void get(of);
        else if (!here.has(LEVELS_BASE)) {
          if (busy.has(LEVELS_BASE)) busy.get(LEVELS_BASE)!.abort();
          else if (baseOf) void get(baseOf, [key]);
        } else if (r) play(r);
      });
      more.addEventListener('click', () => {
        details.hidden = !details.hidden;
        more.setAttribute('aria-expanded', String(!details.hidden));
      });
      cards.set(key, { el, paint, of });
      paint();
      return el;
    };
    clear(levelGrid, ...packs.map(packCard));
    hero();

    // ---- GET: his tap, the size already said; on mobile data it waits for Wi-Fi
    const get = async (of: CardOf, also: string[] = []) => {
      const data = of.data;
      if (!data) return; // a game made by us: nothing to fetch
      // (a phone that cannot tell Wi-Fi from mobile data: the first tap says so with the size; the second is his yes)
      if (netUnknown() && !secondTap(`game:${of.at}`)) {
        for (const c of sharing(of.at)) (status.set(c.of.id, unknownNet(sizeWords(data.bytes))), c.paint());
        return;
      }
      const ctl = new AbortController();
      busy.set(of.at, ctl);
      // the cards this GET fills, and any that asked for it (a level pack fetching the Freedoom it plays over)
      const filling = () => [...sharing(of.at), ...also.flatMap((k) => (cards.get(k) ? [cards.get(k)!] : []))];
      const say = (t: string, kind?: 'loading' | 'offline' | 'error') => {
        for (const c of filling()) {
          status.set(c.of.id, t);
          if (kind) kinds.set(c.of.id, kind);
          else kinds.delete(c.of.id);
          c.paint();
        }
      };
      failed.delete(of.at);
      try {
        if (onMobileData()) {
          /* state: arcade.shelf offline */
          say(mobileData(sizeWords(data.bytes)), 'offline');
          await Promise.race([offMobileData(ctl.signal), new Promise((_, reject) => ctl.signal.addEventListener('abort', () => reject(new DOMException('Stopped', 'AbortError')), { once: true }))]);
        }
        /* state: arcade.shelf loading */
        say(fetchStart(sizeWords(data.bytes)), 'loading');
        const onProgress = (p: Progress) => {
          const pct = p.phase === 'download' ? Math.round((p.got / p.total) * 90) : p.phase === 'check' ? 92 : p.phase === 'unpack' ? 95 : 99;
          for (const c of filling()) {
            const b = c.el.querySelector<HTMLElement>('.arcbar');
            b?.style.setProperty('--p', `${pct}%`);
            b?.setAttribute('aria-valuenow', String(pct));
          }
          const t = p.phase === 'download' ? fetchMid(sizeWords(p.got), sizeWords(p.total), Math.min(100, Math.round((p.got / p.total) * 100))) : p.phase === 'check' ? 'Checking it is the right file…' : p.phase === 'unpack' ? 'Unpacking on this phone…' : 'Keeping it on this phone…';
          if (status.get(of.id) !== t) say(t, 'loading');
        };
        // (`headers`: the owner's key, for Ghosty's own copy of the Archive's file, which the Worker streams to him alone)
        await getFiles({ id: of.at, data }, onProgress, { signal: ctl.signal, ownHeaders: headers });
        here.add(of.at);
        say(`On this phone. ${of.saves ? 'Saved games stay here too.' : ''}`.trim());
        vibrate(15);
      } catch (err) {
        const stopped = (err as Error)?.name === 'AbortError';
        if (!stopped) failed.add(of.at);
        /* state: arcade.shelf error */
        say(stopped ? 'Stopped. Nothing was kept.' : fetchFailed(sayError(err, 'get that game')), stopped ? undefined : 'error');
      } finally {
        busy.delete(of.at);
        paintAll();
        hero();
      }
    };

    const del = async (of: CardOf) => {
      const data = of.data;
      if (!data) return; // a game made by us: nothing to delete
      try {
        await removeFiles({ id: of.at, data });
      } catch (e) {
        for (const c of sharing(of.at)) status.set(c.of.id, sayError(e, 'delete that game'));
        paintAll();
        return;
      }
      here.delete(of.at);
      for (const c of sharing(of.at)) (kinds.delete(c.of.id), status.set(c.of.id, `Deleted from this phone (${sizeWords(data.bytes)} back). GET brings it back; your saved games stay.`));
      paintAll();
      hero();
    };

    // ---- PLAY's files, read ahead: from the finger landing on PLAY, so that its tap can start the engine at once
    const reading = new Map<string, { files: Promise<EngineFiles>; got: EngineFiles | null }>();
    const readAhead = (r: Run) => {
      const had = reading.get(r.id);
      if (had) return had;
      const entry: { files: Promise<EngineFiles>; got: EngineFiles | null } = { files: Promise.resolve({}), got: null };
      entry.files = (async () => {
        const kept: EngineFiles = {};
        for (const [at, name] of r.reads) {
          const b = await readKept(at, name);
          if (!b) throw new Error(`${name} is no longer on this phone: GET it again`);
          kept[name] = b;
        }
        entry.got = kept;
        return kept;
      })();
      entry.files.catch(() => undefined);
      reading.set(r.id, entry);
      // a finger that slid off PLAY: the bytes are let go
      setTimeout(() => reading.get(r.id) === entry && reading.delete(r.id), 15_000);
      return entry;
    };

    // ---- PLAY: the player over everything, its engine started inside the tap where the files are already read
    const play = (r: Run) => {
      const e = r.entry;
      const engine = engineFor(e);
      if (!engine || arcadeState.playing) return;
      primeAudio(); // first thing, inside the tap: the phone allows sound from here on
      arcadeState.playing = r.id;
      playingTitle = r.title;
      const p = player(e, r.title);
      arcadeState.intent = p.intent;
      arcadeState.probe = p.probe;
      document.body.append(p.el);
      document.documentElement.classList.add('arcplaying');
      const pending = readAhead(r);
      reading.delete(r.id); // the bytes go to the engine once; nothing here keeps them
      const said: string[] = [];
      const begin = (files: EngineFiles): Promise<EngineHandle> =>
        engine.start(p.canvas, filesFor(e, files), p.intent, {
          onError: (err) => p.fail(sayError(err, 'run that game')),
          onHit: () => vibrate(25),
          onQuit: () => p.quit(),
          onLevelDone: (sc, words) => {
            const best = recordScore(r.id, sc).isBest;
            const line = `${words ? `${words} ` : ''}${e.done}${best ? ' New best.' : ''}`;
            said.push(line);
            p.say(line);
          },
        }, { saves: saveStore(r.id), sound: soundOn(), args: r.args });
      arcadeState.started = pending.got ? 'tap' : 'after';
      arcadeState.args = r.args ?? [];
      const started = pending.got ? begin(pending.got) : pending.files.then(begin);
      const close = () => {
        p.stop();
        p.el.remove();
        document.documentElement.classList.remove('arcplaying');
        arcadeState.playing = '';
        arcadeState.intent = null;
        arcadeState.probe = () => null;
        paintAll();
        void paintMine();
        paintCont();
        paintRoom();
      };
      void (async () => {
        let handle: EngineHandle | null = null;
        try {
          handle = await started;
          p.ready(handle);
          const seconds = await p.done;
          const shot = grab(p.canvas) ?? p.lastShot();
          await handle.quit();
          // the record of play and a screenshot (stats.ts), and any trophy this sitting earned (trophies.ts)
          const before = trophyRoom(allStats(), allScores(), playDays().length);
          if (recordPlay(r.id, r.title, seconds, { mine: e.engine === 'studio' }) && shot) addShot(r.id, shot);
          const after = trophyRoom(allStats(), allScores(), playDays().length);
          const won = newlyEarned([...before.arcade, ...before.games.flatMap((g) => g.trophies)], [...after.arcade, ...after.games.flatMap((g) => g.trophies)]);
          lastTrophies = won.map((t) => t.name);
          if (e.madeByUs) {
            // a game made by us keeps its own score (scores.ts), and says its own lines
            kinds.delete(r.card); status.set(r.card, `Played ${timeWords(seconds)}.`);
          } else if (e.engine === 'dos') {
            const best = recordScore(r.id, seconds).isBest;
            kinds.delete(r.card); status.set(r.card, `${e.done} ${timeWords(seconds)} this time${best ? ', your longest yet' : ''}.`);
          } else {
            const best = recordSitting(r.id, seconds).isBest;
            kinds.delete(r.card); status.set(r.card, `${said.length ? `${said[said.length - 1]} ` : ''}${timeWords(seconds)} this time${best ? ', your longest sitting yet' : ''}.`);
          }
        } catch (err) {
          void sayError(err, 'start that game');
          kinds.set(r.card, 'error');
          status.set(r.card, startFailed(r.title.charAt(0) + r.title.slice(1).toLowerCase()));
          await handle?.quit().catch(() => undefined);
        } finally {
          if (lastTrophies.length) {
            status.set(r.card, `${status.get(r.card) ?? ''} Trophy: ${lastTrophies.join(', ')}.`.trim());
            lastTrophies = [];
          }
          close();
        }
      })();
    };
    let lastTrophies: string[] = [];

    // MY GAMES: the games of the studio, played by its own engine ('studio') on the arcade's frame
    const mine = (m: Meta): ShelfEntry => ({ id: `studio-${m.id}`, title: m.name.toUpperCase(), line: 'A game you made.', engine: 'studio', data: null, madeByUs: true, controls: ['move', 'jump'], saves: true, since: '', ghosty: 'Your own game. Walk about, talk, and finish what it asks.', done: 'Your best is kept.' });
    /** MY GAMES' cards, by their shelf id (`studio-<id>`), for CONTINUE PLAYING. */
    const myCards = new Map<string, { el: HTMLElement }>();
    const paintMine = async () => {
      myPanel.setStatus('…');
      let failed = '';
      const list = await listGames().catch((e) => ((failed = sayError(e, 'read your games')), [] as Meta[]));
      if (failed) {
        myPanel.setStatus('ERROR', 'off');
        clear(myGrid, h('div.note', { dataset: { state: 'error' } }, failed));
        return;
      }
      myPanel.setStatus(list.length ? `${list.length} GAME${list.length === 1 ? '' : 'S'}` : 'NONE YET');
      myCards.clear();
      const all = allScores();
      queueMicrotask(paintCont);
      clear(myGrid, ...(list.length
        ? list.map((m) => {
            const e = mine(m);
            const sc = all[`studio.${m.id}`];
            const playBtn = h('button.arcact.play', { type: 'button', 'aria-label': `Play ${m.name}`, dataset: { label: 'Play' } }, 'PLAY');
            playBtn.addEventListener('click', () => play({ id: e.id, card: e.id, title: e.title, entry: e, reads: [], args: [`game=${m.id}`] }));
            const editBtn = h('button.arcact.edit', { type: 'button', 'aria-label': `Edit ${m.name} in the game studio`, dataset: { label: 'Edit' } }, 'EDIT');
            editBtn.addEventListener('click', () => {
              studioAsk({ what: 'open', id: m.id });
              goTab('gamestudio');
            });
            const stat = h('p.arcstatus', { 'aria-live': 'polite' }, status.get(e.id) ?? '');
            const opener = titleKey({ 'aria-label': `${m.name}: its page, with screenshots, trophies and your record` }, m.name);
            opener.addEventListener('click', () => pageOf(e, playBtn, () => scoreWords('studio', allScores()[`studio.${m.id}`], undefined), `studio.${m.id}`));
            const el = h('article.arccard.arcmy', { role: 'listitem', dataset: { game: m.id }, 'aria-label': m.name },
              h('h4.arctitle', opener),
              h('p.arcline', `Made by you · ${m.rooms} room${m.rooms === 1 ? '' : 's'}${m.maker ? ` · a game by ${m.maker}` : ''}`),
              h('p.arcscore', scoreWords('studio', sc, undefined)),
              h('div.arcrow', playBtn, editBtn), stat);
            myCards.set(e.id, { el });
            return el;
          })
        : [h('p.arcnote', 'Nothing here yet. Make a game in MAKE → The game studio and it plays here.')]));
    };
    void paintMine();
    window.addEventListener('ghosty:studio-imported', () => void paintMine());

    // CONTINUE PLAYING: the games played lately, newest first, each with its key and its page
    const paintCont = () => {
      const known = (id: string) => cards.get(id) ?? myCards.get(id) ?? null;
      const list = recent(allStats(), 8).filter(([id]) => known(id)).slice(0, 4);
      contPanel.el.hidden = !list.length;
      contPanel.setStatus(list.length ? `${list.length} LATELY` : '');
      clear(contGrid, ...list.map(([id, st]) => {
        const c = known(id)!;
        const act = c.el.querySelector<HTMLButtonElement>('.arcact');
        const go = h('button.arcact', { type: 'button', 'aria-label': `${act?.textContent === 'PLAY' ? 'Continue' : act?.textContent ?? 'Open'}: ${st.title}` }, act?.textContent === 'PLAY' ? 'CONTINUE' : (act?.textContent ?? 'OPEN'));
        go.classList.add(act?.textContent === 'PLAY' ? 'play' : 'get');
        go.addEventListener('click', () => act?.click());
        const open = h('button.arcmore', { type: 'button', 'aria-label': `${st.title}: its page` }, '›');
        open.addEventListener('click', () => c.el.querySelector<HTMLElement>('.arcopen')?.click());
        return h('article.arccard.arccontcard', { role: 'listitem', dataset: { cont: id }, 'aria-label': st.title },
          h('h4.arctitle', st.title),
          h('p.arcscore', `Last played ${whenWords(st.last)} · ${st.plays} ${st.plays === 1 ? 'sitting' : 'sittings'} · ${playTime(st.seconds)}`),
          h('div.arcrow', go, open));
      }));
    };

    // THE TROPHY ROOM: the Arcade's five, then every played game's, earned first
    const paintRoom = () => {
      const room = trophyRoom(allStats(), allScores(), playDays().length);
      roomPanel.setStatus(`${room.earned} OF ${room.total}`);
      const medal = (t: { id: string; name: string; how: string; earned: boolean; progress: number }) =>
        h('li.arctrophy', { dataset: { trophy: t.id, earned: String(t.earned) }, 'aria-label': `${t.name}: ${t.earned ? 'earned' : `not yet, ${Math.round(t.progress * 100)}% of the way`}. ${t.how}` },
          h('span.arcmedal', { 'aria-hidden': 'true' }, t.earned ? '★' : '☆'),
          h('span.arctname', h('b', t.name), h('span', ` ${t.how}`)),
          t.earned ? h('span.arctgot', 'EARNED') : h('span.arctbar', { 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(t.progress * 100)}%` })));
      const total = Object.values(allStats()).reduce((n, x) => n + x.seconds, 0);
      roomPanel.body.replaceChildren(
        h('p.arcnote', room.games.length
          ? `${room.earned} earned · ${room.games.length} ${room.games.length === 1 ? 'game' : 'games'} played · ${playTime(total)} in all. Kept on this phone.`
          : 'Nothing earned yet. Play anything on the shelf, or a game you made, and trophies come.'),
        h('div.lab', 'THE ARCADE'),
        h('ul.arctrophies', ...room.arcade.map(medal)),
        ...room.games.slice(0, 12).flatMap((g) => [h('div.lab', { dataset: { roomgame: g.id } }, `${g.title} · ${g.trophies.filter((t) => t.earned).length} OF 5`), h('ul.arctrophies', ...g.trophies.filter((t) => t.earned).map(medal))].filter((x) => x.tagName !== 'UL' || x.childElementCount)),
      );
    };
    paintCont();
    paintRoom();

    // what is already on this phone
    void Promise.all([...new Map([...cards.values()].map((c) => [c.of.at, c.of] as const)).values()].map(async (of) => (of.data && (await isHere({ id: of.at, data: of.data })) ? here.add(of.at) : undefined))).then(() => {
      paintAll();
      hero();
    });

    return {
      enter() {
        paintAll();
      },
      // (BRIEF-SHELL pass 1) the game being played, else the shelf
      context: () => {
        const g = games.find((x) => x.id === arcadeState.playing);
        const title = g?.title ?? (arcadeState.playing ? playingTitle : '');
        return screenSays('arcade', 'Arcade', title ? `the arcade, playing ${title}` : `the arcade, ${games.length} free games on the shelf`, {
          looking: 'the arcade',
          ...(title ? { selected: { kind: 'item', id: `game:${arcadeState.playing}`, label: title, detail: 'playing' } } : {}),
        });
      },
      describe() {
        const g = games.find((x) => x.id === arcadeState.playing);
        return g ? `ARCADE: playing ${g.title}` : arcadeState.playing ? `ARCADE: playing ${playingTitle}` : `ARCADE: ${games.length} free games on the shelf, ${arcadeState.here.length} on this phone, ${packs.length} free DOOM level packs`;
      },
    };
  },
};

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.arcade = arcadeState), true);
  if (attach()) return;
  let n = 0;
  const timer = window.setInterval(() => {
    if (attach() || ++n > 40) clearInterval(timer);
  }, 500);
}

/** The player: a fresh canvas, the touch layer, the gamepad layer and PAUSE. `done` settles with the seconds played. A
 *  game made by us gets the canvas full screen and the gamepad layer only: it draws its own controls, menus and PAUSE
 *  over the canvas (in the canvas's parent), and its own pause action opens them. */
function player(e: ShelfEntry, title = e.title) {
  /** DOOM and Quake: the pause action is their own menu (engines/types.ts), so the player's PAUSE is its own button. */
  const native = e.engine === 'doom' || e.engine === 'quake';
  const made = !!e.madeByUs;
  const intent: Intent = idle();
  const touch: Intent = idle();
  let padIntent: Intent | null = null;
  // a canvas no engine has drawn on (DOOM draws in 2-D, Quake in WebGL), let go when the game ends
  const canvas = h('canvas.arccanvas', { width: 320, height: 200, role: 'img', 'aria-label': `${title}, playing` });
  const screen = h(`div.arcscreen.${e.engine}` as 'div', canvas);
  const loading = h('div.arcloading', { role: 'status' }, `Starting ${title}…`);
  const knob = h('i.arcknob');
  const base = h('div.arcbase', { 'aria-hidden': 'true' }, knob);
  const stickZone = h('div.arcstick', { role: 'application', 'aria-label': 'Move: put your left thumb down anywhere here and slide it' }, base);
  const dragOn = !e.dos || e.dos.controls.drag !== 'none';
  const lookZone = h('div.arclook', { role: 'application', 'aria-label': dragOn ? 'Look: drag with your right thumb' : 'Right thumb area' });
  const shown = gameButtons(e) as (TouchButton & Partial<DosButton>)[];
  const big = shown.filter((b) => !b.small).slice(0, 4);
  const small = shown.filter((b) => b.small);
  const holdBtn = (b: TouchButton & Partial<DosButton>, cls: string) => {
    const aria = native ? `${b.label}: ${nativeDoes(e, b.act)}` : `${b.label}${b.key ? ` (${b.cycle?.length ? 'next weapon' : keyWord(b.key)})` : ''}`;
    const el = h(`button.${cls}` as 'button', { type: 'button', 'aria-label': aria, dataset: { act: b.act, case: 'keep' } }, b.label);
    const on = (ev: PointerEvent) => {
      ev.preventDefault();
      capture(el, ev.pointerId);
      if (editing && cls === 'arcbtn') return drag(el, ev);
      touch.held.add(b.act);
      el.classList.add('on');
      if (cls === 'arcbtn') vibrate(8);
    };
    const off = () => {
      touch.held.delete(b.act);
      el.classList.remove('on');
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    return el;
  };
  const kbd = h('input.arckbd', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': 'Type to the game' });
  const kbdBtn = h('button.arckey', { type: 'button', 'aria-label': 'Keyboard: type to the game (a saved game\'s name, a cheat)' }, '⌨');
  kbdBtn.addEventListener('click', () => (document.activeElement === kbd ? kbd.blur() : kbd.focus()));
  const pauseBtn = h('button.arcpause', { type: 'button', 'aria-label': 'Pause' }, h('i'), h('i'));
  const keys = h('div.arckeys', ...small.map((b) => holdBtn(b, 'arckey')), ...(e.engine === 'dos' ? [kbdBtn] : []));
  const btns = h('div.arcbtns', ...big.map((b, i) => {
    const el = holdBtn(b, 'arcbtn');
    el.dataset.slot = String(i);
    return el;
  }));
  const padNote = h('div.arcpadnote', { role: 'status', hidden: true }, 'Controller connected');
  // a finished level's tally and Ghosty's line, over the game for a few seconds
  const saidNote = h('div.arcsaid', { role: 'status', hidden: true });
  const layer = h('div.arctouch', stickZone, lookZone, btns, keys, pauseBtn, padNote, saidNote);

  // the PAUSE sheet
  const sndBtn = h('button.arcm', { type: 'button', role: 'switch', 'aria-checked': String(soundOn()) });
  const paintSnd = () => {
    const on = soundOn();
    sndBtn.textContent = on ? 'SOUND: ON' : 'SOUND: OFF';
    sndBtn.setAttribute('aria-checked', String(on));
    sndBtn.setAttribute('aria-label', on ? 'Sound is on: turn it off' : 'Sound is off: turn it on');
  };
  paintSnd();
  const resumeBtn = h('button.arcm.resume', { type: 'button', 'aria-label': `Resume ${title}` }, 'RESUME');
  const gameMenuBtn = native ? h('button.arcm.gamemenu', { type: 'button', 'aria-label': `${menuOf(e)} own menu: new game and its skill, save, load, options` }, 'GAME MENU') : null;
  const quitBtn = h('button.arcm.quit', { type: 'button', 'aria-label': native ? `Quit ${title} (your saved games stay)` : `Quit ${title} (it saves first)` }, 'QUIT');
  const ctlBtn = h('button.arcm', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Controls: what each button and key does' }, 'CONTROLS');
  // the touch layout (arcade/layout.ts) and gyro aim (arcade/gyro.ts), from PAUSE
  const layoutBtn = big.length ? h('button.arcm.arclayout', { type: 'button', 'aria-label': 'Move the buttons: drag them to where your thumb rests, and change their size' }, 'MOVE THE BUTTONS') : null;
  const gyroBtn = native ? h('button.arcm.arcgyro', { type: 'button', role: 'switch' }) : null;
  const gyroNote = h('p.arcnote.arcgyronote', { 'aria-live': 'polite' });
  const paintGyro = () => {
    if (!gyroBtn) return;
    gyroBtn.textContent = gyroOn() ? 'GYRO AIM: ON' : 'GYRO AIM: OFF';
    gyroBtn.setAttribute('aria-checked', String(gyroOn()));
    gyroBtn.setAttribute('aria-label', gyroOn() ? 'Gyro aim is on: turning the phone turns the view. Turn it off' : 'Gyro aim is off: turn it on to aim by turning the phone');
  };
  paintGyro();
  const ctlList = h('ul.arcctl', { hidden: true }, ...controlLines(e).map((t) => h('li', t)));
  const fpsLine = h('p.arcnote.arcfps');
  const menu = h('div.arcmenu', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${title} paused`, hidden: true },
    h('div.arcsheet', h('h4', title), h('p.arcnote', native ? 'Paused. To keep your place, save from the GAME MENU: saved games stay on this phone.' : 'Paused. It saves when you quit.'), fpsLine, resumeBtn, ...(gameMenuBtn ? [gameMenuBtn] : []), quitBtn, sndBtn, ...(gyroBtn ? [gyroBtn, gyroNote] : []), ...(layoutBtn ? [layoutBtn] : []), ctlBtn, ctlList));
  // the layout's bar while he moves the buttons
  const sizeBtn = h('button.arcm.arcsize', { type: 'button' });
  const resetBtn = h('button.arcm.arcreset', { type: 'button', 'aria-label': 'Put the buttons back where they started' }, 'RESET');
  const doneBtn = h('button.arcm.arcdone', { type: 'button', 'aria-label': 'Done moving the buttons' }, 'DONE');
  const layoutBar = h('div.arclayoutbar', { role: 'dialog', 'aria-label': 'Move the buttons', hidden: true }, h('p.arcnote', 'Drag each button to where your thumb rests. It is kept for this kind of game.'), h('div.arclayoutkeys', sizeBtn, resetBtn, doneBtn));
  layer.append(layoutBar);
  const errBox = h('p.arcerr', { role: 'alert', hidden: true });
  const el = h('div.arcplayer', { role: 'region', 'aria-label': `${title}: the game` }, screen, ...(made ? [loading, errBox] : [layer, loading, menu, errBox, kbd]));

  let handle: EngineHandle | null = null;
  let finish: (seconds: number) => void = () => undefined;
  const done = new Promise<number>((r) => (finish = r));
  let played = 0;
  let since = 0;
  let paused = false;
  const clock = () => (since ? played + (performance.now() - since) / 1000 : played);
  const probe = (): EngineProbe | null => handle?.probe?.() ?? null;

  /** One small line: how fast it was going when he paused (the engine's own count over the last whole second). */
  const paintFps = () => {
    const pr = probe();
    const fps = pr ? pr.fps : dosStats.running ? dosStats.fps : 0;
    fpsLine.textContent = fps > 0 || pr ? `${fps} fps${pr?.level ? ` · ${pr.level}` : ''}${pr?.loadMs != null ? ` · ready in ${(pr.loadMs / 1000).toFixed(1)} s` : ''}` : '';
    fpsLine.hidden = !fpsLine.textContent;
  };
  const pause = () => {
    if (paused) return;
    // (still starting: PAUSE is the way out, never a screen he is stuck behind)
    if (!handle) return finish(clock());
    paintFps();
    paused = true;
    played = clock();
    since = 0;
    handle.pause();
    touch.held.clear();
    menu.hidden = false;
    resumeBtn.focus();
  };
  const resume = () => {
    if (!paused || !handle) return;
    if (editing) endEdit();
    paused = false;
    since = performance.now();
    menu.hidden = true;
    handle.resume();
  };
  /** A button pressed for him for a moment (GAME MENU's pause action): held for at least four frames and 160 ms, so a
   *  slow frame cannot swallow it (an engine that has opened its menu ignores it until it is let go). */
  let pulse: { act: Action; until: number; frames: number } | null = null;
  pauseBtn.addEventListener('click', pause);
  resumeBtn.addEventListener('click', resume);
  gameMenuBtn?.addEventListener('click', () => {
    resume();
    pulse = { act: 'pause', until: performance.now() + 160, frames: 4 };
  });
  quitBtn.addEventListener('click', () => {
    quitBtn.disabled = true;
    quitBtn.textContent = 'SAVING…';
    finish(clock());
  });
  sndBtn.addEventListener('click', () => {
    const on = !soundOn();
    setSoundPref(on);
    handle?.setSound(on);
    paintSnd();
  });
  // ---- MOVE THE BUTTONS: the game stays paused; each big button drags; SIZE cycles; RESET; DONE back to PAUSE
  let editing = false;
  let lay = layoutOf(e.engine);
  const paintLayout = () => {
    for (const b of btns.querySelectorAll<HTMLElement>('.arcbtn')) {
      const m = lay.moves[b.dataset.slot ?? ''] ?? [0, 0];
      b.style.transform = m[0] || m[1] || lay.scale !== 1 ? `translate(${m[0]}px, ${m[1]}px) scale(${lay.scale})` : '';
    }
    sizeBtn.textContent = `SIZE: ${Math.round(lay.scale * 100)}%`;
    sizeBtn.setAttribute('aria-label', `Button size ${Math.round(lay.scale * 100)}%: change it`);
  };
  paintLayout();
  const drag = (el: HTMLElement, ev: PointerEvent) => {
    const slot = el.dataset.slot ?? '';
    const start = lay.moves[slot] ?? [0, 0];
    const r = el.getBoundingClientRect();
    const centre: [number, number] = [r.left + r.width / 2 - start[0], r.top + r.height / 2 - start[1]];
    const x0 = ev.clientX;
    const y0 = ev.clientY;
    const move = (m: PointerEvent) => {
      lay.moves[slot] = clampMove(start[0] + m.clientX - x0, start[1] + m.clientY - y0, centre, [innerWidth, innerHeight]);
      paintLayout();
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      saveLayout(e.engine, lay);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const endEdit = () => {
    editing = false;
    layer.classList.remove('arcediting');
    layoutBar.hidden = true;
    saveLayout(e.engine, lay);
  };
  layoutBtn?.addEventListener('click', () => {
    editing = true;
    menu.hidden = true;
    layer.classList.add('arcediting');
    layoutBar.hidden = false;
    doneBtn.focus();
  });
  sizeBtn.addEventListener('click', () => {
    lay.scale = nextScale(lay.scale);
    paintLayout();
    saveLayout(e.engine, lay);
  });
  resetBtn.addEventListener('click', () => {
    lay = { moves: {}, scale: 1 };
    saveLayout(e.engine, null);
    paintLayout();
  });
  doneBtn.addEventListener('click', () => {
    endEdit();
    menu.hidden = false;
    resumeBtn.focus();
  });

  // ---- GYRO AIM: the phone's turning rate, read while it is on (an iPhone asks him first, inside this tap)
  let rate: Rate | null = null;
  const onMotion = (ev: DeviceMotionEvent) => {
    rate = ev.rotationRate ? { alpha: ev.rotationRate.alpha, beta: ev.rotationRate.beta, gamma: ev.rotationRate.gamma } : null;
  };
  const listenGyro = (on: boolean) => {
    if (on) window.addEventListener('devicemotion', onMotion);
    else (window.removeEventListener('devicemotion', onMotion), (rate = null));
  };
  if (native && gyroOn()) listenGyro(true);
  gyroBtn?.addEventListener('click', async () => {
    gyroNote.textContent = '';
    if (gyroOn()) {
      setGyro(false);
      listenGyro(false);
      return paintGyro();
    }
    const ask = (globalThis.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined)?.requestPermission;
    let ok = typeof DeviceMotionEvent !== 'undefined';
    if (ok && ask) ok = (await ask().catch(() => 'denied')) === 'granted';
    if (!ok) {
      gyroNote.textContent = 'This phone did not allow motion, so gyro aim stays off. You can allow it in Settings, Safari, Motion & Orientation Access.';
      return paintGyro();
    }
    setGyro(true);
    listenGyro(true);
    paintGyro();
  });

  ctlBtn.addEventListener('click', () => {
    ctlList.hidden = !ctlList.hidden;
    ctlBtn.setAttribute('aria-expanded', String(!ctlList.hidden));
  });
  const hidden = () => {
    if (document.visibilityState === 'hidden') pause();
  };
  if (!made) document.addEventListener('visibilitychange', hidden); // a game made by us pauses itself

  // ---- the stick: it lands under the thumb, the knob follows within its reach
  const R = 52;
  let stickId = -1;
  let ox = 0;
  let oy = 0;
  stickZone.addEventListener('pointerdown', (ev) => {
    if (stickId !== -1) return;
    ev.preventDefault();
    stickId = ev.pointerId;
    capture(stickZone, ev.pointerId);
    const r = stickZone.getBoundingClientRect();
    ox = ev.clientX;
    oy = ev.clientY;
    base.style.left = `${ox - r.left}px`;
    base.style.top = `${oy - r.top}px`;
    base.classList.add('on');
  });
  stickZone.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== stickId) return;
    const dx = ev.clientX - ox;
    const dy = ev.clientY - oy;
    const m = touchMove(dx, dy, R);
    touch.moveX = m.moveX;
    touch.moveY = m.moveY;
    const len = Math.hypot(dx, dy);
    const k = len > R ? R / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  });
  const stickOff = (ev: PointerEvent) => {
    if (ev.pointerId !== stickId) return;
    stickId = -1;
    touch.moveX = touch.moveY = 0;
    knob.style.transform = '';
    base.classList.remove('on');
    base.style.left = base.style.top = '';
  };
  stickZone.addEventListener('pointerup', stickOff);
  stickZone.addEventListener('pointercancel', stickOff);

  // ---- drag to look, on the right half: the degrees add up in the one Intent until the engine takes them
  let lookId = -1;
  let lx = 0;
  let ly = 0;
  lookZone.addEventListener('pointerdown', (ev) => {
    if (lookId !== -1 || !dragOn) return;
    ev.preventDefault();
    lookId = ev.pointerId;
    capture(lookZone, ev.pointerId);
    lx = ev.clientX;
    ly = ev.clientY;
  });
  lookZone.addEventListener('pointermove', (ev) => {
    if (ev.pointerId !== lookId) return;
    const l = touchLook(ev.clientX - lx, ev.clientY - ly);
    lx = ev.clientX;
    ly = ev.clientY;
    intent.lookX += l.lookX;
    intent.lookY += l.lookY;
  });
  const lookOff = (ev: PointerEvent) => {
    if (ev.pointerId === lookId) lookId = -1;
  };
  lookZone.addEventListener('pointerup', lookOff);
  lookZone.addEventListener('pointercancel', lookOff);

  // ---- the keyboard layer (arcade/keys.ts): DOOM and Quake with a hardware keyboard; the other games read keys themselves
  const keysDown = new Set<string>();
  const onKey = (ev: KeyboardEvent) => {
    if (!native || ev.target === kbd || !takes(ev.code)) return;
    if (ev.type === 'keydown' && ev.code === 'Escape' && paused) return; // the PAUSE sheet's own Escape
    ev.preventDefault();
    if (ev.type === 'keydown') keysDown.add(ev.code);
    else keysDown.delete(ev.code);
  };
  const keysLost = () => keysDown.clear();
  if (native) {
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', keysLost);
  }

  // ---- every frame: the pad, then both layers into the one Intent the engine reads (updated in place)
  let raf = 0;
  let last = performance.now();
  let padStart = false;
  let swallowStart = false; // START closed the PAUSE sheet: it reaches the game again once let go
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    padIntent = null;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const r = readPad(pad, e.engine, dt);
      if (!r) continue;
      padIntent = r;
      if (!arcadeState.pad) {
        arcadeState.pad = true;
        padNote.hidden = false;
        setTimeout(() => (padNote.hidden = true), 2500);
      }
      break;
    }
    // START: with the sheet open it closes it; otherwise a DOS game's START is the player's PAUSE, and DOOM's or
    // Quake's goes through to the game, whose own menu it opens
    const start = !!padIntent?.held.has('pause');
    if (start && !padStart) {
      if (paused) {
        resume();
        swallowStart = true;
      } else if (!native && !made) pause();
    }
    if (!start) swallowStart = false;
    padStart = start;
    if (paused) {
      intent.moveX = intent.moveY = 0;
      intent.held.clear();
      return;
    }
    const k = native && keysDown.size ? keysIntent(keysDown, dt) : null;
    if (rate) {
      const g = gyroLook(rate, window.screen.orientation?.angle ?? 0, dt);
      intent.lookX += g.lookX;
      intent.lookY += g.lookY;
    }
    const m = merge(merge(touch, padIntent), k);
    if (k) intent.lookX += k.lookX;
    intent.moveX = m.moveX;
    intent.moveY = m.moveY;
    intent.held.clear();
    for (const a of m.held) if (a !== 'pause' || ((native || made) && !swallowStart)) intent.held.add(a);
    if (pulse) {
      intent.held.add(pulse.act);
      if (--pulse.frames <= 0 && now >= pulse.until) pulse = null;
    }
    if (padIntent) {
      intent.lookX += padIntent.lookX;
      intent.lookY += padIntent.lookY;
    }
  };
  raf = requestAnimationFrame(frame);
  draws('arcade', true);
  // a screenshot every half minute of play, inside a frame so a WebGL game's picture is still there (stats.ts keeps the last)
  let shot: string | null = null;
  const shooter = window.setInterval(() => {
    if (paused || document.hidden) return;
    requestAnimationFrame(() => (shot = grab(canvas) ?? shot));
  }, 30_000);

  let sayTimer = 0;
  return {
    el,
    canvas,
    intent,
    done,
    probe,
    ready(hd: EngineHandle) {
      handle = hd;
      loading.hidden = true;
      since = performance.now();
    },
    /** The game ended itself (its own QUIT, and yes): back to the shelf. */
    quit() {
      finish(clock());
    },
    say(text: string) {
      saidNote.textContent = text;
      saidNote.hidden = false;
      clearTimeout(sayTimer);
      sayTimer = window.setTimeout(() => (saidNote.hidden = true), 7000);
    },
    fail(message: string) {
      errBox.hidden = false;
      if (made || !handle) {
        // no PAUSE of the player's here (or it never started): the way back is on the message
        const back = h('button.arcm.quit', { type: 'button', 'aria-label': 'Back to the shelf' }, 'BACK TO THE SHELF');
        back.addEventListener('click', () => finish(clock()));
        clear(errBox, `${title} stopped: ${message}.`, back);
        return;
      }
      errBox.textContent = `${title} stopped: ${message}. Quit to go back.`;
      pause();
    },
    /** The last good screenshot taken while it played (null: none yet). */
    lastShot: () => shot,
    stop() {
      clearInterval(shooter);
      draws('arcade', false);
      cancelAnimationFrame(raf);
      clearTimeout(sayTimer);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', keysLost);
      listenGyro(false);
      kbd.blur();
      // the canvas's pixels go back to the phone (each game is given a new one)
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    },
  };
}
