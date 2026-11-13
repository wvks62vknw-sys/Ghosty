/**
 * RULES, SOUND, PLAY, SHARE and AS AN APP (BRIEF-EDITOR-GAME-STUDIO). PLAY tests the game in place with the pad; SHARE writes a
 * `.ghostygame` with its size said and reads one back; AS AN APP writes one self-contained page to the library with its size said,
 * and says honestly what PUT IT ON MY SITES can and cannot do from here.
 */
import { h } from '../core/dom';
import { saveStore } from '../arcade/engines/saves';
import { toast, undo } from '../ui/components';
import { addressOf, appPage, manifestOf, slugOf, TARGET_BYTES } from './app';
import { attempt, btn, chips, type Ctx, field, note, numberField, section, select, slider, text, toggle } from './ed-core';
import { PALETTES, hardProblems, type Game, problems } from './model';
import { mountPlayer } from './player';
import { PLAY_CSS } from './app';
import { fileName, MIME, readFile, sizeWords, writeGame } from './share';
import { getPage, keepPage, listPages, putGame, removePage, type PageMeta } from './store';
import { bars, eightBars, parseTune, PRESETS, startTune } from './tune';

// ---------------------------------------------------------------- RULES
export function rulesPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const r = g.rules;
  const root = h('div.stPill');
  root.append(
    section('What kind of game',
      chips([{ id: 'platformer' as const, label: 'Platformer' }, { id: 'topdown' as const, label: 'Top-down' }], g.kind, (k) => {
        if (k === g.kind) return;
        attempt(ctx, (x) => {
          x.kind = k;
          x.player.speed = k === 'platformer' ? 88 : 64;
        });
        ctx.say(k === 'topdown' ? 'Top-down: four-way movement, no gravity. Your rooms stay as they are: a floor wants walls round it.' : 'Platformer: gravity and a jump. Your rooms stay as they are: a platformer wants ground to stand on.');
      }),
      note(g.kind === 'platformer' ? 'A platformer: you run and jump, stomp foes and land on ledges.' : 'Top-down: you walk four ways on the same grid, with no gravity. Walls and water shape the way.')),
    section('How it ends',
      slider('Lives', r.lives, 1, 9, (v) => `${v} li${v === 1 ? 'fe' : 'ves'}`, (v) => (r.lives = v), ctx),
      field('The game ends', select([['lives', 'Only when the lives are gone'], ['quests', 'When the last quest is done'], ['room', 'When a room is reached']], r.end, (v) => attempt(ctx, () => (r.end = v as typeof r.end)), 'What ends the game')),
      r.end === 'room' ? field('The room', select(g.rooms.map((x): [string, string] => [x.id, x.name]), r.endRoom, (v) => attempt(ctx, () => (r.endRoom = v)), 'The room that ends the game')) : null,
      note('The Flag tile also ends a game: touch it and you have won.'),
      field('Timer', numberField(r.timer, 0, 3600, (v) => attempt(ctx, () => ((r.timer = v), undefined)), 'Timer in seconds, 0 for none'), r.timer ? `${Math.floor(r.timer / 60)} min ${r.timer % 60} s` : 'seconds; 0 is no timer'),
      toggle('Coins kept between rooms', r.keepCoins, (v) => attempt(ctx, () => (r.keepCoins = v)))),
    section('What the player sees',
      toggle('Hearts', g.ui.hearts, (v) => attempt(ctx, () => (g.ui.hearts = v))),
      toggle('Coins', g.ui.coins, (v) => attempt(ctx, () => (g.ui.coins = v))),
      toggle('Quest line', g.ui.quest, (v) => attempt(ctx, () => (g.ui.quest = v))),
      toggle('A sign’s words when stood on', g.ui.sign, (v) => attempt(ctx, () => (g.ui.sign = v)))),
    section('The world', field('Colours and sky', select(PALETTES.map((p): [string, string] => [p.id, p.name]), g.palette, (v) => attempt(ctx, () => (g.palette = v)), 'The world the game is set in'), 'New rooms take this; each room can have its own'),
      field('The game’s name', text(g.name, (v) => attempt(ctx, () => (g.name = v.trim().slice(0, 40) || g.name)), { aria: 'The game’s name', max: 40 }))),
  );
  return root;
}

// ---------------------------------------------------------------- SOUND
export function soundPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const root = h('div.stPill');
  const own = text(g.tune, () => undefined, { aria: 'Your own eight bars', multiline: true, max: 600, placeholder: 'C4 E4 G4 - | C5:2 G4 E4 C4' }) as HTMLTextAreaElement;
  const count = h('p.stNote', { 'aria-live': 'polite' });
  const said = () => {
    const n = bars(own.value).length;
    const bad = own.value.split(/[\s|]+/).filter((t) => t && t !== '-' && !parseTune(t).length).length;
    count.textContent = own.value.trim() ? `${n} of 8 bars${n > 8 ? ': only the first 8 are kept' : ''}${bad ? `. ${bad} word${bad === 1 ? '' : 's'} not read as notes and left out.` : '.'}` : 'No tune of your own: the preset above plays.';
  };
  own.addEventListener('input', said);
  own.addEventListener('change', () => attempt(ctx, () => (g.tune = eightBars(own.value))));
  said();
  let stop: { stop(): void } | null = null;
  let actx: AudioContext | null = null;
  const preview = btn('Hear it', () => {
    stop?.stop();
    stop = null;
    try {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      actx ??= new C();
      void actx.resume();
      const t = own.value.trim() ? eightBars(own.value) : (PRESETS[g.music] ?? '');
      if (!t) return ctx.say('There is no tune to hear: choose a preset or type bars.');
      stop = startTune(actx, actx.destination, t);
      setTimeout(() => stop?.stop(), 9000);
    } catch {
      ctx.say('This phone would not play sound here.');
    }
  }, 'pri', 'Hear the tune');
  ctx.onLeave(() => stop?.stop());
  root.append(
    section('Music', field('A tune for the game', select([['', 'Silence'], ...PALETTES.map((p): [string, string] => [p.id, p.name])], g.music, (v) => attempt(ctx, () => (g.music = v)), 'The game’s music')),
      field('Or your own eight bars', own, 'notes like C4, F#3, Bb4; - is a rest; :2 is two beats; | ends a bar'), count, preview),
    section('Effects', toggle('Sound effects', g.fx, (v) => attempt(ctx, () => (g.fx = v))), note('Jumps, coins, doors, a hurt, a save and a win each have a sound of their own, made on the phone.')),
  );
  return root;
}

// ---------------------------------------------------------------- PLAY
export function playPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const root = h('div.stPill');
  const hard = hardProblems(g);
  if (hard.length) {
    root.append(section('Before you can play', ...hard.map((p) => h('div.stRow.stProb', note(p.text, 'stWarn'), btn('Fix it', () => ctx.go(p.at), '', 'Go to where it can be fixed')))));
    return root;
  }
  if (!document.getElementById('gpcss')) document.head.append(h('style', { id: 'gpcss' }, PLAY_CSS));
  const box = h('div.stPlay');
  const canvas = h('canvas.stPlayCanvas', { role: 'img', 'aria-label': `${g.name}, playing` });
  const ui = h('div.gpUi');
  box.append(canvas, ui);
  const live = h('p.stLive', { 'aria-live': 'polite' });
  const savedNote = h('p.stNote', { 'aria-live': 'polite' });
  const name = `studio-${g.id}`;
  const store = saveStore(name);
  let handle: ReturnType<typeof mountPlayer> | null = null;
  const at = ctx.state.at;
  ctx.state.at = null;
  const start = () => {
    handle?.stop();
    handle = mountPlayer({
      game: ctx.game(),
      canvas,
      ui,
      title: false,
      at: at ?? undefined,
      saves: {
        get: async () => {
          const b = await store.get(name);
          return b ? new TextDecoder().decode(b) : null;
        },
        put: (s) => void store.put(name, new TextEncoder().encode(s)).catch(() => undefined),
      },
      onSave: () => {
        savedNote.textContent = 'Saved.';
        window.setTimeout(() => (savedNote.textContent = ''), 2200);
        void refreshContinue();
      },
    });
    (window as unknown as { __ghostyStudio?: Record<string, unknown> }).__ghostyStudio = { ...((window as unknown as { __ghostyStudio?: Record<string, unknown> }).__ghostyStudio ?? {}), play: handle };
  };
  const cont = btn('Continue', async () => {
    if (!handle) return;
    if (!(await handle.continue())) ctx.say('There is no save yet: step on a save point first.');
  }, '', 'Continue from your last save point');
  const refreshContinue = async () => {
    cont.hidden = !(await handle?.hasSave());
  };
  const reset = btn('Reset', () => {
    ctx.state.at = null;
    handle?.reset();
    savedNote.textContent = '';
    void refreshContinue();
  }, 'pri', 'Reset: start the game again from the beginning');
  start();
  cont.hidden = true;
  void refreshContinue();
  const tick = window.setInterval(() => {
    if (!root.isConnected || !handle) return;
    const p = handle.peek();
    live.textContent = `${'♥'.repeat(Math.max(0, Number(p.hearts) || 0))} · ${p.coins} coin${p.coins === 1 ? '' : 's'} · ${p.quest || 'no quest'}`;
  }, 300);
  ctx.onLeave(() => {
    clearInterval(tick);
    handle?.stop();
    handle = null;
  });
  root.append(box, live, savedNote, h('div.stRow', reset, cont), note(at ? 'Playing from the tile you picked. Reset starts from the beginning.' : 'Playing in place. The pad is under your thumbs; a controller or the keyboard works too.'));
  return root;
}

// ---------------------------------------------------------------- SHARE
async function offerFile(name: string, bytes: Uint8Array, type: string): Promise<'shared' | 'saved'> {
  const blob = new Blob([bytes as BlobPart], { type });
  const file = new File([blob], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  try {
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
export async function importBytes(bytes: Uint8Array, ctx?: { say(t: string): void }): Promise<{ id: string; name: string; said: string } | null> {
  const r = readFile(bytes);
  if (!r) {
    ctx?.say('That is not a game file I can read. A game made in Ghosty’s studio ends in .ghostygame.');
    return null;
  }
  const g = r.game;
  const metaIds = (await import('./store')).listGames;
  if ((await metaIds()).some((m) => m.id === g.id)) g.id = `${g.id}-${Date.now().toString(36)}`;
  await putGame(g);
  window.dispatchEvent(new CustomEvent('ghosty:studio-imported', { detail: { id: g.id, name: g.name } }));
  const said = `Imported “${g.name}”${r.maker ? `, a game by ${r.maker}` : ''}. ${r.lost ? `It kept ${Math.max(0, r.read - r.lost)} of the ${r.read} parts it read: ${r.lost} could not be used.` : `All ${r.read} parts kept.`}`;
  ctx?.say(said);
  return { id: g.id, name: g.name, said };
}
export function sharePill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const root = h('div.stPill');
  const bytes = writeGame(g);
  const input = h('input', { type: 'file', accept: '.ghostygame,application/x-ghostygame,application/zip', hidden: true });
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const r = await importBytes(new Uint8Array(await f.arrayBuffer()), ctx);
    if (r) ctx.go('rooms');
  });
  const result = h('p.stNote', { 'aria-live': 'polite' });
  root.append(
    section('Share this game',
      note(`The file is ${sizeWords(bytes.length)}: the game itself and a picture of each of its sprites. It is a .ghostygame, and it opens in anyone’s Ghosty game studio.`),
      field('Your name on it (optional)', text(g.maker, (v) => attempt(ctx, () => (g.maker = v.trim().slice(0, 40))), { aria: 'Your name on the file', max: 40 }), 'shown to whoever opens it as “a game by …”'),
      btn(`Share · ${sizeWords(bytes.length)}`, async () => {
        const how = await offerFile(fileName(ctx.game()), writeGame(ctx.game()), MIME);
        result.textContent = how === 'shared' ? 'Sent to the share sheet.' : `Saved ${fileName(ctx.game())} (${sizeWords(bytes.length)}) to this phone’s downloads.`;
      }, 'pri', `Share the game as a file, ${sizeWords(bytes.length)}`), result),
    section('Open a game someone sent', note('A .ghostygame from a friend becomes yours to change, and says who made it.'), btn('Import a game', () => input.click(), '', 'Import a game file'), input),
  );
  const w = window as unknown as { __ghostyStudio?: Record<string, unknown> };
  w.__ghostyStudio = { ...(w.__ghostyStudio ?? {}), shareSize: bytes.length, roundTrip: () => JSON.stringify(readFile(writeGame(ctx.game()))?.game) === JSON.stringify(readFile(writeGame(readFile(writeGame(ctx.game()))!.game))?.game) && readFile(writeGame(ctx.game()))?.game.name === ctx.game().name, shareBytes: () => [...writeGame(ctx.game())] };
  return root;
}

// ---------------------------------------------------------------- AS AN APP
let playerSrc: Promise<string> | null = null;
/** The runtime's script as built (one fetch; the phone keeps it for offline). */
export const loadPlayer = (): Promise<string> =>
  (playerSrc ??= fetch('/studio-player.js').then((r) => {
    if (!r.ok) throw new Error('the runtime did not load');
    return r.text();
  }).catch((e) => {
    playerSrc = null;
    throw e;
  }));

/** Why PUT IT ON MY SITES cannot be done from here, and what stops it, in plain words. */
export const SITES_LINE = 'I can’t put this on your sites yet: that needs a change to my server, which needs your word. The file in the library is yours.';

export function appPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const root = h('div.stPill');
  const bad = hardProblems(g);
  const size = h('p.stNote.stSize', { 'aria-live': 'polite' }, 'Measuring the page…');
  const lib = h('div.stLib');
  const sites = h('div.stSites', { 'aria-live': 'polite' });
  let html = '';
  const measure = async () => {
    try {
      html = appPage(ctx.game(), { player: await loadPlayer() });
      const n = html.length;
      size.textContent = `The page is ${sizeWords(n)}, one file that plays offline${n <= TARGET_BYTES ? ` (under the ${sizeWords(TARGET_BYTES)} target)` : `: over the ${sizeWords(TARGET_BYTES)} target, so trim the sprites or rooms`}.`;
      size.dataset.bytes = String(n);
    } catch {
      size.textContent = 'I could not load the game runtime to measure the page: connect once and try again (after that it works offline).';
    }
  };
  void measure();
  const paintLib = async () => {
    const pages = await listPages();
    lib.replaceChildren(
      ...(pages.length
        ? pages.map((p: PageMeta) => h('div.stRow.stLibRow', h('span', `${p.name}.html · ${sizeWords(p.bytes)}`),
            btn('Save file', async () => {
              const t = await getPage(p.id);
              if (t) await offerFile(`${slugOf({ name: p.name })}.html`, new TextEncoder().encode(t), 'text/html');
            }, '', `Save ${p.name} as a file`),
            btn('Remove', async () => {
              const t = await getPage(p.id);
              await removePage(p.id);
              void paintLib();
              undo(`Removed ${p.name}.html from the library.`, async () => {
                if (t) await keepPage(p.id, p.name, t);
                void paintLib();
              });
            }, 'warn', `Remove ${p.name} from the library`)))
        : [note('Nothing in the library yet.')]),
    );
  };
  void paintLib();
  const man = manifestOf(g);
  root.append(
    section('Export as an app',
      size,
      note(`It installs from its address ${addressOf(g)}: name “${String(man.name)}”, standalone, start ${String(man.start_url)}, scope ${String(man.scope)}.`),
      note('The page runs only its own script, pinned by its hash, and reaches nowhere on the network.'),
      ...(bad.length ? [note(`Fix these first: ${bad[0]!.text}`, 'stWarn')] : []),
      btn('Export as an app', async () => {
        if (!html) await measure();
        if (!html) return ctx.say('The page is not ready: the runtime did not load.');
        const meta = await keepPage(g.id, ctx.game().name, html);
        void paintLib();
        toast(`Kept in the library: ${meta.name}.html, ${sizeWords(meta.bytes)}.`, 'ok');
        ctx.say(`Kept in the library: ${meta.name}.html, ${sizeWords(meta.bytes)}.`);
      }, 'pri', 'Export the game as one page, kept in the library')),
    section('In the library', lib),
    section('Put it on my sites',
      note(navigator.onLine === false ? 'You are offline. Everything here works; putting it on your sites waits for a connection, and says so then.' : `Your sites are the public pages I publish for you at /s/<name>. This game would be ${addressOf(g)}.`),
      btn('Put it on my sites', () => sites.replaceChildren(h('p.stWarn', SITES_LINE), note('Until then the file in the library is yours: save it, or open it from your Files.')), '', 'Put the page on my sites'),
      sites),
  );
  const w = window as unknown as { __ghostyStudio?: Record<string, unknown> };
  w.__ghostyStudio = { ...(w.__ghostyStudio ?? {}), appPage: async () => (await measure(), html), manifest: () => manifestOf(ctx.game()) };
  void problems;
  return root;
}
