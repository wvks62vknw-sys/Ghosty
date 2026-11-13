/**
 * THE GAME STUDIO's screen (BRIEF-EDITOR-GAME-STUDIO): MY GAMES as a shelf of thumbnails with the three templates and BLANK, and
 * the editor as pills: ROOMS, SPRITES, CHARACTERS, THINGS, QUESTS, RULES, SOUND, PLAY, SHARE, AS AN APP. Everything saves 200 ms
 * after a change ("Saved" said once), UNDO is sixty deep and sits in the line, and the editor reopens on the room he left it on.
 */
import { clear, h } from '../core/dom';
import { confirmSheet, panel, toast, undo } from '../ui/components';
import { appPill, importBytes, playPill, rulesPill, sharePill, soundPill } from './ed-misc';
import { attempt, btn, type Ctx, type EdState, note, TABS, type Tab } from './ed-core';
import { charactersPill, questsPill, thingsPill } from './ed-people';
import { roomsPill } from './ed-rooms';
import { sketchRoom } from './ed-ask';
import { spritesPill } from './ed-sprites';
import { thumbnail } from './draw';
import { info, takeAsks, type StudioAsk } from './hub';
import { clone, firstRoom, type Game, History, hardProblems, problems, resizeRoom, TEMPLATES, template, type TemplateId, Refused } from './model';
import { autosave, getGame, keeps, listGames, type Meta, putGame, removeGame, room } from './store';

const LAST = 'ghosty.studio.last';
const lastOpen = (): { id: string; room: string; tab: Tab } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(LAST) ?? 'null') as { id: string; room: string; tab: Tab } | null;
    return v && typeof v.id === 'string' ? v : null;
  } catch {
    return null;
  }
};
const setLast = (v: { id: string; room: string; tab: Tab } | null) => {
  try {
    if (v) localStorage.setItem(LAST, JSON.stringify(v));
    else localStorage.removeItem(LAST);
  } catch {
    /* he reopens on the shelf */
  }
};
const KINDS: Record<string, string> = { platformer: 'Platformer', topdown: 'Top-down' };

/** What the hub card and the deck read, from the phone's own database. */
export async function refreshInfo(): Promise<void> {
  const all = await listGames().catch(() => []);
  info.games = all.length;
  info.last = all[0]?.name ?? '';
  info.loaded = true;
}

export interface Studio {
  stop(): void;
  context(): string;
  open(arg: string): void;
  enter(): void;
}

export function mountStudio(host: { left: HTMLElement; right: HTMLElement; big: HTMLElement; sub: HTMLElement }): Studio {
  const shelf = panel('MY GAMES', { status: '' });
  const game = panel('THE GAME', { status: '' });
  game.el.hidden = true;
  game.el.classList.add('stGame');
  shelf.el.classList.add('stShelf');
  const about = panel('ABOUT THE STUDIO', { cls: 'stAbout' });
  about.body.append(
    note('The first version makes 2-D games: platformers and top-down adventures, with rooms, doors, characters who talk and sell, things to find, quests, a save point and sound.'),
    note('3-D worlds, multiplayer and selling a game are not in it yet.', 'stHint'),
    note('A game you make stays on this phone until you tap Share or Put it on my sites. Nothing in a game reaches me unless you ask me for a sketch or a line.'),
    note('You can say “make a game” or “my games” in the chat, and “sketch a cave room with two ledges” once a game is open.'),
  );
  host.left.append(shelf.el, game.el);
  host.right.append(about.el);

  let hist: History | null = null;
  let current: Game | null = null;
  const state: EdState = { tab: 'rooms', roomId: '', tool: 'paint', letter: '#', zoom: 1, panX: 0, panY: 0, sel: null, spriteId: 'hero', tile: '', anim: 'idle', frame: 0, ink: 4, pen: 'pen', onion: false, at: null, npcId: '', thingId: '', questId: '' };
  let leave: (() => void)[] = [];
  const savedEl = h('span.stSaved', { 'aria-live': 'polite' });
  let savedTimer = 0;
  const said = h('p.stSay', { 'aria-live': 'polite' });
  let sayTimer = 0;
  const say = (t: string) => {
    said.textContent = t;
    said.classList.add('on');
    clearTimeout(sayTimer);
    sayTimer = window.setTimeout(() => said.classList.remove('on'), 7000);
  };
  const saver = autosave(
    () => hist!.game,
    () => {
      try {
        return thumbnail(hist!.game).toDataURL('image/png');
      } catch {
        return '';
      }
    },
    (k) => {
      void refreshInfo();
      savedEl.textContent = 'Saved';
      savedEl.classList.add('on');
      clearTimeout(savedTimer);
      savedTimer = window.setTimeout(() => savedEl.classList.remove('on'), 1600);
      if (!k.kept) say('This phone is keeping nothing here: your game lasts until this page closes. Share it to keep a copy.');
      if (k.gone.length) say(`Out of room: I let go of ${k.gone.join(', ')} to make space (the oldest first).`);
    },
  );

  // ---------------------------------------------------------------- the shelf
  const paintShelf = async () => {
    const list = await listGames();
    await refreshInfo();
    host.big.textContent = list.length ? `${list.length} game${list.length === 1 ? '' : 's'}` : 'No games yet';
    shelf.setStatus(list.length ? `${list.length} GAME${list.length === 1 ? '' : 'S'}` : 'EMPTY');
    const rm = await room();
    const empty = h('div.stEmpty', h('p.stSay2', 'No games yet. Pick a template and you are making one in a minute.'));
    const tpl = h('div.stTemplates', { role: 'group', 'aria-label': 'Make a game' },
      ...TEMPLATES.map((t) => h('button.stTpl', { type: 'button', dataset: { template: t.id }, 'aria-label': `Make a game: ${t.name}. ${t.line}`, onclick: () => void newGame(t.id) }, h('b', t.name), h('span', t.line))));
    const input = h('input', { type: 'file', accept: '.ghostygame,application/x-ghostygame,application/zip', hidden: true });
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.value = '';
      if (!f) return;
      const r = await importBytes(new Uint8Array(await f.arrayBuffer()), { say });
      if (r) {
        toast(r.said, 'ok');
        void paintShelf();
      }
    });
    const cards = list.map((m) => card(m));
    clear(shelf.body,
      list.length ? h('div.stGrid', { role: 'list', 'aria-label': 'My games' }, ...cards) : empty,
      h('h4.stH', list.length ? 'Make another' : 'Make one'),
      tpl,
      h('div.stRow', btn('Import a game', () => input.click(), '', 'Import a game file (.ghostygame)'), input),
      h('p.stNote.stRoom', rm.said),
      keeps() ? null : note('This phone is not letting me keep games here (a private window?): they last until this page closes. Share one to keep a copy.', 'stWarn'),
    );
  };
  const card = (m: Meta) => {
    const img = h('img.stThumb', { alt: '', width: 96, height: 64 });
    if (m.thumb) img.src = m.thumb;
    else img.classList.add('blank');
    const open = h('button.stOpen', { type: 'button', 'aria-label': `Open ${m.name}`, dataset: { game: m.id }, onclick: () => void openGame(m.id) }, img, h('span.stName', m.name), h('span.stMeta', `${KINDS[m.kind] ?? m.kind} · ${m.rooms} room${m.rooms === 1 ? '' : 's'}${m.maker ? ` · by ${m.maker}` : ''}`));
    const more = h('details.stMore', h('summary', { 'aria-label': `More for ${m.name}` }, '⋯'),
      btn('Duplicate', async () => {
        const g = await getGame(m.id);
        if (!g) return;
        const c = clone(g);
        c.id = `g${Date.now().toString(36)}`;
        c.name = `${g.name} copy`.slice(0, 40);
        await putGame(c, m.thumb);
        void paintShelf();
      }, '', `Duplicate ${m.name}`),
      btn('Delete', async () => {
        const g = await getGame(m.id);
        if (!g) return;
        if (!(await confirmSheet('Delete this game?', `“${m.name}” goes from this phone. You can put it back for a moment after.`, 'DELETE'))) return;
        await removeGame(m.id);
        void paintShelf();
        undo(`Deleted “${m.name}”.`, async () => {
          await putGame(g, m.thumb);
          void paintShelf();
        });
      }, 'warn', `Delete ${m.name}`));
    return h('article.stCard', { role: 'listitem' }, open, more);
  };

  // ---------------------------------------------------------------- the editor
  const ctx: Ctx = {
    get hist() {
      return hist!;
    },
    game: () => hist!.game,
    room: () => {
      const g = hist!.game;
      const r = g.rooms.find((x) => x.id === state.roomId) ?? firstRoom(g);
      if (r && r.id !== state.roomId) state.roomId = r.id;
      return r!;
    },
    state,
    change(fn) {
      hist!.push();
      try {
        fn(hist!.game);
      } catch (e) {
        hist!.drop();
        throw e;
      }
      saver.touch();
      paintEditor();
      return true;
    },
    push: () => hist!.push(),
    touch: () => saver.touch(),
    refresh: () => paintEditor(),
    go(tab) {
      state.tab = tab;
      paintEditor();
    },
    say,
    undo: () => {
      if (hist?.undo()) {
        saver.touch();
        paintEditor();
      }
    },
    redo: () => {
      if (hist?.redo()) {
        saver.touch();
        paintEditor();
      }
    },
    onLeave: (fn) => leave.push(fn),
    sketch: (wish) => void sketch(wish),
  };
  const pillOf: Record<Tab, (c: Ctx) => HTMLElement> = { rooms: roomsPill, sprites: spritesPill, characters: charactersPill, things: thingsPill, quests: questsPill, rules: rulesPill, sound: soundPill, play: playPill, share: sharePill, app: appPill };
  const body = h('div.stBody');
  const head = h('div.stHead');
  const pillsEl = h('div.secpills.stPills.scrolls', { role: 'tablist', 'aria-label': 'Parts of the game' });
  const probs = h('div.stProbs');
  clear(game.body, head, pillsEl, probs, said, body);

  function paintEditor() {
    if (!hist || !current) return;
    const g = hist.game;
    for (const f of leave.splice(0)) f();
    const scroll = window.scrollY;
    host.big.textContent = g.name;
    game.setStatus(`${g.rooms.length} ROOM${g.rooms.length === 1 ? '' : 'S'}`);
    clear(head,
      btn('‹ My games', () => void closeGame(), 'stBack', 'Back to my games'),
      h('b.stTitle', g.name),
      btn('Undo', () => ctx.undo(), 'stUndo', 'Undo the last change'),
      btn('Redo', () => ctx.redo(), 'stRedo', 'Redo'),
      savedEl);
    (head.querySelector('.stUndo') as HTMLButtonElement).disabled = !hist.canUndo;
    (head.querySelector('.stRedo') as HTMLButtonElement).disabled = !hist.canRedo;
    clear(pillsEl, ...TABS.map((t) => h('button.secpill', { type: 'button', role: 'tab', 'aria-selected': String(state.tab === t.id), dataset: { sec: t.id, case: 'keep' }, onclick: () => ctx.go(t.id) }, t.label)));
    pillsEl.querySelectorAll('.secpill').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.sec === state.tab));
    const hard = hardProblems(g);
    const soft = problems(g).filter((p) => !p.hard);
    clear(probs, ...(state.tab === 'rooms' || state.tab === 'quests' || state.tab === 'play' ? [] : []), ...(hard.length ? [h('p.stNote.stWarn', `${hard.length === 1 ? 'One thing' : `${hard.length} things`} to fix before it can be played: ${hard[0]!.text}`)] : soft.length ? [h('p.stNote.stHint', soft[0]!.text)] : []));
    const el = pillOf[state.tab](ctx);
    clear(body, el);
    const sel = pillsEl.querySelector('.secpill.on') as HTMLElement | null;
    if (sel) pillsEl.scrollLeft = Math.max(0, sel.offsetLeft - (pillsEl.clientWidth - sel.offsetWidth) / 2);
    window.scrollTo({ top: scroll });
    setLast({ id: g.id, room: state.roomId, tab: state.tab });
  }

  async function openGame(id: string, o: { room?: string; tab?: Tab } = {}) {
    const g = await getGame(id);
    if (!g) return false;
    current = g;
    hist = new History(g);
    state.roomId = o.room && g.rooms.some((r) => r.id === o.room) ? o.room : (firstRoom(g)?.id ?? '');
    state.tab = o.tab ?? 'rooms';
    state.sel = null;
    state.panX = 0;
    state.panY = 0;
    state.zoom = 1;
    state.tile = '';
    state.spriteId = g.sprites[0]?.id ?? '';
    state.letter = '#';
    state.at = null;
    shelf.el.hidden = true;
    game.el.hidden = false;
    paintEditor();
    wire(g);
    return true;
  }
  async function closeGame() {
    await saver.flush();
    for (const f of leave.splice(0)) f();
    hist = null;
    current = null;
    setLast(null);
    game.el.hidden = true;
    shelf.el.hidden = false;
    host.sub.textContent = SUB;
    await paintShelf();
  }
  async function newGame(t: TemplateId) {
    const g = template(t);
    await putGame(g, thumbnail(g).toDataURL('image/png'));
    await openGame(g.id);
  }
  const SUB = 'Make a 2-D game on this phone: rooms, characters, quests, a save point. Play it, share it, put it on your Home Screen.';
  host.sub.textContent = SUB;

  // what the specs read and drive (the editor's own state, never his data sent anywhere)
  function wire(g: Game) {
    const w = window as unknown as { __ghostyStudio?: Record<string, unknown> };
    w.__ghostyStudio = {
      ...(w.__ghostyStudio ?? {}),
      game: () => hist?.game ?? g,
      state,
      go: (t: Tab) => ctx.go(t),
      undoDepth: () => hist?.depth ?? 0,
      size: (rid: string, wd: number, ht: number) => attempt(ctx, () => resizeRoom(hist!.game.rooms.find((r) => r.id === rid)!, wd, ht)),
    };
  }

  // ---------------------------------------------------------------- what comes from outside: the chat
  const sketch = async (wish: string) => {
    if (!hist) return;
    const g = hist.game;
    const room0 = ctx.room();
    say(`Asking for a sketch: “${wish}”…`);
    const r = await sketchRoom(g, room0, wish);
    if ('error' in r) return say(r.error);
    attempt(ctx, (x) => {
      const rm = x.rooms.find((z) => z.id === room0.id)!;
      rm.rows = r.rows;
      rm.w = r.w;
      rm.h = r.h;
      rm.doors = rm.doors.filter((d) => d.x < r.w && d.y < r.h && rm.rows[d.y]![d.x] === 'D');
    });
    state.tab = 'rooms';
    paintEditor();
    say(`First draft: paint over it.${r.dropped ? ` ${r.dropped} tile${r.dropped === 1 ? '' : 's'} I could not read became air.` : ''}`);
  };
  let askedOpen = false;
  const stopAsks = takeAsks((a: StudioAsk) => {
    if (a.what === 'open' && a.id) {
      askedOpen = true;
      void openGame(a.id);
      return;
    }
    if (a.what === 'new') {
      if (!hist) shelf.el.scrollIntoView();
      return;
    }
    if (a.what === 'sketch' && a.wish) {
      if (hist) void sketch(a.wish);
      else void listGames().then(async (l) => (l[0] ? (await openGame(l[0].id), void sketch(a.wish!)) : undefined));
    }
  });

  // first paint: the shelf, and the game he left open
  void (async () => {
    await paintShelf();
    const last = lastOpen();
    if (last && !hist && !askedOpen) await openGame(last.id, { room: last.room, tab: last.tab === 'play' ? 'rooms' : last.tab });
  })();
  void Refused;

  return {
    stop() {
      stopAsks();
      void saver.flush();
      for (const f of leave.splice(0)) f();
    },
    enter() {
      if (!hist) void paintShelf();
    },
    context: () => (current ? `the game studio, editing “${current.name}”, on ${TABS.find((t) => t.id === state.tab)?.label.toLowerCase() ?? 'rooms'}, ${current.rooms.length} room${current.rooms.length === 1 ? '' : 's'}` : `the game studio, my games (${info.games})`),
    open(arg) {
      const t = TABS.find((x) => x.id === arg.toLowerCase());
      if (t && hist) ctx.go(t.id);
      else if (arg === 'new') shelf.el.scrollIntoView();
    },
  };
}
