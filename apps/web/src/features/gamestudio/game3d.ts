/**
 * GAME STUDIO 3D on the GAME STUDIO screen (APPS ROUND, MAKE; he asked for "the ability to make 3d games"): six templates that
 * play in one tap, his own 3-D games kept on the phone, the player (touch stick, JUMP and FIRE, the keyboard and any controller,
 * a ghost of the last run) and the editor: the stage built by touch on a 1 m grid (add, move, raise, colour, bounce and friction
 * for each thing, the sky and gravity) and the logic as "when → then" blocks with no code. The game is game3d/model.ts; the
 * runtime, three.js and Rapier, is game3d/run.ts. The state is on window.__ghosty.game3d for the specs.
 */
import { clear, h } from '../../core/dom';
import { button, panel, toast } from '../../ui/components';
import { skeleton, stateCard } from '../../ui/appkit';
import { addThing, draftFromWords, makeDraft, type Draft, KIND_WORDS, KINDS, newRule, nudge, PALETTE_NAMES, readGames, ruleWords, SAVE_KEY, saveGame, template, THENS, THING_WORDS, WHENS, type Game3D, type Rule, type Then, type Thing, type ThingKind, type When } from '../../game3d/model';
import type { Run } from '../../game3d/run';

/** What the screen shows, for the specs. */
export const game3dState = {
  games: [] as Game3D[],
  /** The game open in the player or the editor. */
  open: '' as string,
  view: 'shelf' as 'shelf' | 'play' | 'edit',
  run: null as Run | null,
  /** The id of the thing selected in the editor. */
  selected: '' as string,
  /** The words the result banner says. */
  result: '',
  /** DESCRIBE A GAME: the draft from his words, and the changes he accepted. */
  draft: null as Draft | null,
  accepted: new Set<string>(),
};

const GHOST_KEY = 'ghosty.game3d.ghost';
const ADDABLE: ThingKind[] = ['block', 'ramp', 'platform', 'coin', 'gem', 'crate', 'pad', 'enemy', 'door', 'goal', 'bumper'];

function loadGames(): Game3D[] {
  try {
    return readGames(localStorage.getItem(SAVE_KEY));
  } catch {
    return [];
  }
}
function store(list: Game3D[]): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(list));
  } catch {
    toast('This phone would not keep the game (its storage is full or private).', 'warn');
  }
}
function ghostOf(id: string): { x: number; y: number; z: number }[] {
  try {
    const all = JSON.parse(localStorage.getItem(GHOST_KEY) ?? '{}') as Record<string, { x: number; y: number; z: number }[]>;
    return Array.isArray(all[id]) ? all[id]! : [];
  } catch {
    return [];
  }
}
function keepGhost(id: string, path: { x: number; y: number; z: number }[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(GHOST_KEY) ?? '{}') as Record<string, unknown>;
    all[id] = path.slice(0, 1800).map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100, z: Math.round(p.z * 100) / 100 }));
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 10))) delete all[k];
    localStorage.setItem(GHOST_KEY, JSON.stringify(all));
  } catch {
    /* the ghost is only for this visit */
  }
}

let opener: ((wish?: string) => void) | null = null;
let pendingWish: string | undefined | null = null;
/** From the chat: 3-D GAMES shown, and his description drafted there when he gave one. */
export function open3d(wish?: string): void {
  if (opener) opener(wish);
  else pendingWish = wish;
}

export function game3dPanel(): HTMLElement {
  const pn = panel('3-D GAMES', { cls: 'gs3', grow: false });
  game3dState.games = loadGames();
  const shelf = h('div.gs3shelf');
  const mine = h('div.gs3mine');
  const stage = h('div.gs3stage', { hidden: true });
  pn.body.append(h('p.note', 'Real 3-D games, made and played on your phone: pick one to play now, then EDIT it into your own.'), shelf, mine, stage);
  expose();

  const save = (g: Game3D) => {
    game3dState.games = saveGame(game3dState.games, g);
    store(game3dState.games);
  };

  // DESCRIBE A GAME: his words read into a template and marked changes, each to accept or reject, then MAKE IT
  const said = h('input', { type: 'text', placeholder: 'e.g. a night platformer with 10 coins and low gravity', 'aria-label': 'Describe a game', enterKeyHint: 'go', maxLength: 160 });
  const draftBox = h('div.gs3draft', { 'aria-live': 'polite' });
  const draftIt = () => {
    const d = draftFromWords(said.value);
    game3dState.draft = d;
    game3dState.accepted = new Set(d?.changes.map((c) => c.id) ?? []);
    paintDraft();
  };
  said.addEventListener('keydown', (e) => e.key === 'Enter' && draftIt());
  function paintDraft(): void {
    const d = game3dState.draft;
    if (!d) return void clear(draftBox, said.value.trim() ? h('p.note', 'Tell me a little more: what kind of game, and what is in it.') : null);
    clear(draftBox,
      h('p.gs3rulewords', `A ${KIND_WORDS[d.kind].name.toLowerCase()}, from ${d.because}.${d.changes.length ? ' The changes, each yours to keep or not:' : ' Nothing else to change: MAKE IT plays the template.'}`),
      ...d.changes.map((c) => {
        const on = game3dState.accepted.has(c.id);
        const b = button(on ? 'ACCEPTED' : 'REJECTED', () => {
          if (on) game3dState.accepted.delete(c.id);
          else game3dState.accepted.add(c.id);
          paintDraft();
        }, on ? 'on' : '');
        b.setAttribute('aria-pressed', String(on));
        b.dataset.change = c.id;
        return h('div.gs3rule', { dataset: { change: c.id, state: on ? 'accepted' : 'rejected' } }, h('p.gs3rulewords', `${on ? '+' : '−'} ${c.words}`), b);
      }),
      h('div.row.wrap', button('MAKE IT', () => {
        const g = makeDraft(d, game3dState.accepted);
        game3dState.draft = null;
        said.value = '';
        clear(draftBox);
        save(g);
        paintMine();
        void play(g);
      }, 'on'), button('CANCEL', () => ((game3dState.draft = null), clear(draftBox)))),
    );
  }

  function paintShelf(): void {
    clear(shelf,
      h('div.lab', 'DESCRIBE A GAME'),
      h('div.keyrow', said, button('DRAFT IT', draftIt, 'on')),
      draftBox,
      h('div.lab', 'START FROM A TEMPLATE'), h('div.gs3cards', ...KINDS.map((k) => {
      const b = h('button.gs3card', { type: 'button', dataset: { kind: k }, 'aria-label': `Play the ${KIND_WORDS[k].name} template` }, h('b', KIND_WORDS[k].name), h('span', KIND_WORDS[k].line));
      b.addEventListener('click', () => {
        const g = template(k);
        save(g);
        paintMine();
        void play(g);
      });
      return b;
    })));
  }
  function paintMine(): void {
    const list = game3dState.games;
    if (!list.length) {
      /* state: gamestudio.threed empty */
      const card = stateCard('empty', 'No 3-D games of your own yet. Tap a template above: it plays at once, and it’s yours to change.', { word: 'PLAY THE PLATFORMER', run: () => {
        const g = template('platformer');
        save(g);
        paintMine();
        void play(g);
      } });
      card.classList.add('gs3none');
      card.dataset.state = 'empty';
      return void clear(mine, card);
    }
    clear(mine, h('div.lab', `MY 3-D GAMES · ${list.length}`), ...list.map((g) => h('div.gs3game', { dataset: { game: g.id } },
      h('div.gs3gametext', h('b', g.name), h('small', `${KIND_WORDS[g.kind].name} · ${g.things.length} things · ${g.rules.length} rules`)),
      h('div.row.wrap', button('PLAY', () => void play(g), 'on'), button('EDIT', () => edit(g)), button('DELETE', () => {
        game3dState.games = game3dState.games.filter((x) => x.id !== g.id);
        store(game3dState.games);
        paintMine();
      })),
    )));
  }

  // ---------------------------------------------------------------- the player
  let keyOff: (() => void) | null = null;
  let padTimer = 0;
  async function play(g: Game3D, from?: Thing): Promise<void> {
    stopRun();
    game3dState.open = g.id;
    game3dState.view = 'play';
    game3dState.result = '';
    const host = h('div.gs3view');
    const hud = h('div.gs3hud', { 'aria-live': 'polite' });
    const said = h('div.gs3said', { 'aria-live': 'polite' });
    const banner = h('div.gs3banner', { hidden: true, role: 'alert' });
    const stick = h('div.gs3stick', { role: 'application', 'aria-label': 'The stick: drag to move' }, h('i.gs3knob'));
    const jump = h('button.gs3act', { type: 'button', 'aria-label': g.kind === 'shooter' ? 'Fire' : 'Jump' }, g.kind === 'shooter' ? 'FIRE' : 'JUMP');
    const status = h('div.gs3status', { dataset: { state: 'loading' } }, skeleton(2, 'Loading the 3-D engine and physics'), h('p.note', 'Loading the 3-D engine and physics…'));
    const top = h('div.gs3top', h('b', g.name), h('span', KIND_WORDS[g.kind].controls), button('STOP', () => close(), 'warn'));
    clear(stage, top, h('div.gs3frame', host, hud, said, banner, stick, ...(g.kind === 'kart' || g.kind === 'marble' || g.kind === 'explorer' ? [] : [jump])), status);
    stage.hidden = false;
    shelf.hidden = true;
    mine.hidden = true;
    stage.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
    const { Run } = await import('../../game3d/run');
    const run = new Run(host, g, ghostOf(g.id));
    game3dState.run = run;
    const paintHud = () => {
      const s = run.info.state;
      if (!s) return;
      hud.textContent = [`Score ${s.score}`, Number.isFinite(s.left) ? `Time ${Math.ceil(s.left)}` : '', g.lives ? `Lives ${s.lives}` : ''].filter(Boolean).join(' · ');
      said.textContent = s.said;
      if (s.over) {
        game3dState.result = s.over === 'won' ? `You won! Score ${s.score}.` : `Not this time. Score ${s.score}.`;
        keepGhost(g.id, run.trail);
        clear(banner, h('b', game3dState.result), h('div.row.wrap', button('PLAY AGAIN', () => void play(g), 'on'), button('EDIT', () => edit(g)), button('BACK', () => close())));
        banner.hidden = false;
      }
    };
    run.onChange = paintHud;
    // the stick: a drag anywhere in its circle, read as soon as it moves (never from the frame loop)
    const knob = stick.firstElementChild as HTMLElement;
    const setStick = (cx: number, cy: number) => {
      const r = stick.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, (cx - (r.left + r.width / 2)) / (r.width / 2)));
      const dy = Math.max(-1, Math.min(1, (cy - (r.top + r.height / 2)) / (r.height / 2)));
      run.input.sx = -dx;
      run.input.sy = -dy;
      knob.style.transform = `translate(${dx * 30}px, ${dy * 30}px)`;
    };
    const endStick = () => {
      run.input.sx = 0;
      run.input.sy = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerdown', (e) => {
      stick.setPointerCapture(e.pointerId);
      setStick(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', (e) => e.buttons && setStick(e.clientX, e.clientY));
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
    const act = (on: boolean) => {
      if (g.kind === 'shooter') run.input.fire = on;
      else run.input.jump = on;
    };
    jump.addEventListener('pointerdown', () => act(true));
    jump.addEventListener('pointerup', () => act(false));
    jump.addEventListener('pointerleave', () => act(false));
    // first person: a drag on the view turns it
    let lx = -1;
    host.addEventListener('pointerdown', (e) => (lx = e.clientX));
    host.addEventListener('pointermove', (e) => {
      if (lx < 0 || !e.buttons) return;
      run.input.look += (e.clientX - lx) * 0.006;
      lx = e.clientX;
    });
    host.addEventListener('pointerup', () => (lx = -1));
    // the keyboard and controllers
    const keys = new Set<string>();
    const fromKeys = () => {
      run.input.sx = (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('d') ? 1 : 0);
      run.input.sy = (keys.has('ArrowUp') || keys.has('w') ? 1 : 0) - (keys.has('ArrowDown') || keys.has('s') ? 1 : 0);
      act(keys.has(' '));
    };
    const kd = (e: KeyboardEvent) => {
      if (game3dState.view !== 'play' || (e.target as HTMLElement)?.matches?.('input, textarea, select')) return;
      keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      fromKeys();
    };
    const ku = (e: KeyboardEvent) => {
      keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      fromKeys();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    keyOff = () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
    padTimer = window.setInterval(() => {
      const gp = navigator.getGamepads?.().find((x) => x && x.connected);
      if (!gp) return;
      const [ax = 0, ay = 0] = gp.axes;
      if (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
        run.input.sx = -ax;
        run.input.sy = -ay;
      } else if (!keys.size) {
        run.input.sx = 0;
        run.input.sy = 0;
      }
      act(!!gp.buttons[0]?.pressed);
    }, 50);
    const ok = await run.start();
    if (!ok) {
      /* state: gamestudio.threed error */
      status.dataset.state = 'error';
      clear(status, stateCard('error', run.info.error, { word: 'TRY AGAIN', run: () => void play(g) }));
      return;
    }
    delete status.dataset.state;
    // PLAY FROM HERE: the player starts just above the thing he picked in the editor
    if (from) run.teleport({ x: from.x, y: from.y + from.h / 2 + 0.6, z: from.z });
    status.textContent = from ? `Playing from the ${THING_WORDS[from.kind].toLowerCase()} you picked.` : run.info.ghost ? 'Racing your last run’s ghost (the pale ball).' : 'Play it, then EDIT it into your own.';
    paintHud();
  }
  function stopRun(): void {
    if (game3dState.run) {
      const r = game3dState.run;
      if (r.info.mode === 'play' && r.trail.length > 5) keepGhost(game3dState.open, r.trail);
      r.stop();
    }
    game3dState.run = null;
    keyOff?.();
    keyOff = null;
    clearInterval(padTimer);
  }
  function close(): void {
    stopRun();
    game3dState.view = 'shelf';
    stage.hidden = true;
    clear(stage);
    shelf.hidden = false;
    mine.hidden = false;
    paintMine();
  }

  // ---------------------------------------------------------------- the editor
  function edit(g: Game3D): void {
    stopRun();
    game3dState.open = g.id;
    game3dState.view = 'edit';
    game3dState.selected = '';
    shelf.hidden = true;
    mine.hidden = true;
    stage.hidden = false;
    const changed = () => {
      save(g);
      paint();
    };
    const name = h('input', { type: 'text', value: g.name, 'aria-label': 'The game’s name', maxLength: 40 });
    name.addEventListener('change', () => {
      g.name = name.value.trim().slice(0, 40) || KIND_WORDS[g.kind].name;
      changed();
    });
    const sel = (label: string, options: [string, string][], value: string, set: (v: string) => void) => {
      const s = h('select', { 'aria-label': label }, ...options.map(([v, l]) => h('option', { value: v }, l)));
      s.value = value;
      s.addEventListener('change', () => set(s.value));
      return s;
    };
    const num = (label: string, value: number, set: (v: number) => void, step = '0.1') => {
      const i = h('input', { type: 'number', step, value: String(value), 'aria-label': label, inputMode: 'decimal' });
      i.addEventListener('change', () => {
        const v = Number(i.value);
        if (Number.isFinite(v)) set(v);
      });
      return i;
    };
    const body = h('div.gs3edit');
    function paint(): void {
      const t = g.things.find((x) => x.id === game3dState.selected);
      clear(body,
        h('div.gs3top', h('b', 'EDITING'), button('PLAY IT', () => void play(g), 'on'), button('DONE', () => close())),
        h('div.wbf', h('label', 'Name'), name),
        h('div.lab', 'THE WORLD'),
        h('div.wbf', h('label', 'Sky'), sel('The sky', [['0d1620', 'Night'], ['3a6f9c', 'Day'], ['c8743a', 'Sunset'], ['10202a', 'Forest']], g.sky.toString(16).padStart(6, '0'), (v) => ((g.sky = parseInt(v, 16)), changed()))),
        h('div.wbf', h('label', 'Fog'), sel('The fog', [['0', 'None'], ['0.012', 'Light'], ['0.03', 'Thick'], ['0.06', 'Dense']], String(g.fog), (v) => ((g.fog = Number(v)), changed()))),
        h('div.wbf', h('label', 'Sunlight'), sel('The sunlight', [['0.5', 'Dim'], ['1.5', 'Normal'], ['2.3', 'Bright']], String(g.light ?? 1.5), (v) => ((g.light = Number(v)), changed()))),
        h('div.wbf', h('label', 'Gravity'), num('Gravity, metres a second squared', g.gravity, (v) => ((g.gravity = Math.max(0, Math.min(30, v))), changed())), h('span.wbu', 'm/s²')),
        h('div.wbf', h('label', 'Clock'), num('Seconds on the clock (0 for none)', g.time, (v) => ((g.time = Math.max(0, Math.round(v))), changed()), '5'), h('span.wbu', 's')),
        h('div.lab', `THE STAGE · ${g.things.length} THINGS`),
        h('div.row.wrap.gs3add', ...ADDABLE.map((k) => {
          const b = button(`+ ${THING_WORDS[k].toUpperCase()}`, () => {
            const near = t ?? g.things[g.things.length - 1];
            const added = addThing(g, k, { x: (near?.x ?? 0) + 2, z: near?.z ?? 0 });
            game3dState.selected = added.id;
            changed();
          });
          b.dataset.add = k;
          return b;
        })),
        h('div.gs3things', ...g.things.map((x) => {
          const b = button(`${THING_WORDS[x.kind]} · ${x.x}, ${x.z}`, () => ((game3dState.selected = x.id), paint()), x.id === game3dState.selected ? 'on' : '');
          b.dataset.thing = x.id;
          return b;
        })),
        ...(t ? [thingEditor(t)] : [h('p.note', 'Tap a thing above to move it, raise it, colour it or change how it bounces.')]),
        h('div.lab', `THE RULES · ${g.rules.length}`),
        h('p.note', 'Logic without code: when this happens, then do that.'),
        ...g.rules.map((r) => ruleEditor(r)),
        h('div.row.wrap', button('+ ADD A RULE', () => ((g.rules = [...g.rules, newRule('touch', 'score', { what: 'coin', arg: '1' })]), changed()))),
      );
    }
    function thingEditor(t: Thing): HTMLElement {
      const step = (dx: number, dy: number, dz: number) => () => ((nudge(t, dx, dy, dz)), changed());
      return h('div.gs3thing', { dataset: { thing: t.id } },
        h('b', `${THING_WORDS[t.kind]} at ${t.x}, ${t.y}, ${t.z} m`),
        h('div.row.wrap.gs3nudge',
          button('← LEFT', step(1, 0, 0)), button('RIGHT →', step(-1, 0, 0)), button('↑ AWAY', step(0, 0, 1)), button('↓ NEARER', step(0, 0, -1)), button('RAISE', step(0, 0.5, 0)), button('LOWER', step(0, -0.5, 0)),
        ),
        h('div.wbf', h('label', 'Colour'), sel('Its colour', PALETTE_NAMES.map((n, i) => [String(i), n]), String(t.c), (v) => ((t.c = Number(v)), changed()))),
        h('div.wbf', h('label', 'Bounce'), num('Bounce, 0 to 1.2', t.bounce, (v) => ((t.bounce = Math.max(0, Math.min(1.2, v))), changed()))),
        h('div.wbf', h('label', 'Friction'), num('Friction, 0 to 1.5', t.friction, (v) => ((t.friction = Math.max(0, Math.min(1.5, v))), changed()))),
        h('div.wbf', h('label', 'Moves'), sel('How it moves', [['fixed', 'Stays put'], ['dynamic', 'Falls and gets pushed'], ['moving', 'Moves on a path']], t.body, (v) => {
          t.body = v as Thing['body'];
          if (t.body === 'moving' && !t.move) t.move = { axis: 'x', range: 2, speed: 1 };
          changed();
        })),
        h('div.row.wrap', button('PLAY FROM HERE', () => void play(g, t), 'on'), button('DELETE IT', () => {
          g.things = g.things.filter((x) => x.id !== t.id);
          game3dState.selected = '';
          changed();
        }, 'warn')),
      );
    }
    function ruleEditor(r: Rule): HTMLElement {
      const kinds: [string, string][] = (Object.keys(THING_WORDS) as ThingKind[]).map((k) => [k, THING_WORDS[k]]);
      const needsWhat = r.when === 'touch' || r.when === 'all' || r.when === 'cover';
      const needsN = r.when === 'score';
      const needsArg = r.then === 'score' || r.then === 'time' || r.then === 'say' || r.then === 'open';
      const arg = r.then === 'open'
        ? sel('What it opens', [['goal', 'The goal'], ['door', 'The door']], r.arg ?? 'goal', (v) => ((r.arg = v), changed()))
        : h('input', { type: 'text', value: r.arg ?? '', 'aria-label': r.then === 'say' ? 'What to say' : 'How many', maxLength: 80 });
      if (arg instanceof HTMLInputElement) arg.addEventListener('change', () => ((r.arg = arg.value.slice(0, 80)), changed()));
      return h('div.gs3rule', { dataset: { rule: r.id } },
        h('p.gs3rulewords', ruleWords(r)),
        h('div.row.wrap',
          sel('When', WHENS, r.when, (v) => ((r.when = v as When), changed())),
          ...(needsWhat ? [sel('Which thing', kinds, r.what ?? 'coin', (v) => ((r.what = v as ThingKind), changed()))] : []),
          ...(needsN ? [num('The score', r.n ?? 1, (v) => ((r.n = Math.max(0, Math.round(v))), changed()), '1')] : []),
          sel('Then', THENS, r.then, (v) => ((r.then = v as Then), changed())),
          ...(needsArg ? [arg] : []),
          button('REMOVE', () => ((g.rules = g.rules.filter((x) => x.id !== r.id)), changed())),
        ),
      );
    }
    clear(stage, body);
    paint();
    stage.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
  }

  paintShelf();
  paintMine();
  opener = (wish) => {
    if (game3dState.view !== 'shelf') close();
    if (wish) {
      said.value = wish;
      draftIt();
    }
    requestAnimationFrame(() => pn.el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior }));
  };
  if (pendingWish !== null) {
    const w = pendingWish;
    pendingWish = null;
    setTimeout(() => opener?.(w ?? undefined), 0);
  }
  return pn.el;
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => {
    if (!w.__ghosty) return false;
    w.__ghosty.game3d = game3dState;
    return true;
  };
  if (attach()) return;
  let n = 0;
  const t = setInterval(() => {
    if (attach() || ++n > 60) clearInterval(t);
  }, 250);
}
