/**
 * CHARACTERS, THINGS and QUESTS (BRIEF-EDITOR-GAME-STUDIO). The player's sprite, speed and jump on sliders with their numbers said;
 * people as cards (a sprite, a name, dialogue typed in the line above, a behaviour, a shop with prices); things as cards with what
 * each does; quests built a step at a time with a reward and the line as the player will read it.
 */
import { h } from '../core/dom';
import { toast, undo } from '../ui/components';
import { dialogueFor } from './ed-ask';
import { attempt, btn, type Ctx, field, note, numberField, plural, section, select, slider, text, toggle } from './ed-core';
import { BEHAVIOURS, DOES, type Does, ENEMY_KINDS, type Game, newNpc, newQuest, newThing, problems, stepWords, type Step } from './model';

const spriteOpts = (g: Game): [string, string][] => g.sprites.map((s) => [s.id, s.name]);
const thingOpts = (g: Game, none = ''): [string, string][] => [...(none ? ([['', none]] as [string, string][]) : []), ...g.things.map((t): [string, string] => [t.id, t.name])];
const doorOpts = (g: Game): [string, string][] => g.rooms.flatMap((r) => r.doors.map((d): [string, string] => [d.id, `${r.name}: door at ${d.x + 1}, ${d.y + 1}`]));
const DOES_WORDS: Record<Does, string> = { coin: 'A coin: adds to your coins', heart: 'A heart: mends hearts', key: 'A key: opens one door', quest: 'A quest item: kept for a quest', jump: 'A power: doubles the jump for a time', crates: 'A power: breaks crates for a time', sell: 'A sellable: sold to a shop for coins' };
const BEH_WORDS: Record<string, string> = { stand: 'Stands still', walk: 'Walks about', follow: 'Follows you', flee: 'Runs from you', patrol: 'Patrols between two tiles' };
const VALUE_WORDS: Record<Does, string> = { coin: 'Coins it gives', heart: 'Hearts it mends', key: '', quest: '', jump: 'Seconds it lasts', crates: 'Seconds it lasts', sell: 'Coins it sells for' };

// ---------------------------------------------------------------- CHARACTERS
export function charactersPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const root = h('div.stPill');
  const p = g.player;
  const top = g.kind === 'topdown';
  root.append(section('The player',
    field('Wears', select(spriteOpts(g), p.sprite, (v) => attempt(ctx, () => (p.sprite = v)), 'The player’s sprite')),
    slider('Speed', p.speed, 40, 160, (v) => `Walks at ${v}`, (v) => (p.speed = v), ctx, 4),
    top ? note('Jump height is for platformers: a top-down hero does not jump.') : slider('Jump', p.jump, 200, 480, (v) => `Jumps ${v} (${Math.round((v * v) / (2 * 950))} px high)`, (v) => (p.jump = v), ctx, 10),
    slider('Hearts', p.hearts, 1, 9, (v) => `${v} heart${v === 1 ? '' : 's'}`, (v) => (p.hearts = v), ctx),
  ));
  root.append(section('Foes wear', ...ENEMY_KINDS.map((k) => field(k[0]!.toUpperCase() + k.slice(1), select(spriteOpts(g), g.enemySprites[k] ?? k, (v) => attempt(ctx, () => (g.enemySprites[k] = v)), `The sprite a ${k} wears`)))));

  // people
  const name = text('', () => undefined, { aria: 'A new character’s name', placeholder: 'A name, then Add person', max: 30 });
  const add = () => {
    const v = (name as HTMLInputElement).value.trim();
    if (!v) return ctx.say('Type a name first.');
    attempt(ctx, (x) => {
      const n = newNpc(x, v);
      x.npcs.push(n);
      ctx.state.npcId = n.id;
    });
  };
  root.append(section('People', h('div.stAsk', name, btn('Add person', add, 'pri', 'Add a character')), g.npcs.length ? null : note('No people yet. A person talks, can run a shop, and can be the one a quest sends you to.')));
  for (const n of g.npcs) {
    const line = text('', () => undefined, { aria: `A line for ${n.name}`, placeholder: 'Type what they say, then Add line', max: 200 });
    const addLine = () => {
      const v = (line as HTMLInputElement).value.trim();
      if (!v) return ctx.say('Type the line first.');
      attempt(ctx, () => n.lines.push({ text: v, once: false }));
    };
    const shopRows = n.shop.map((it, i) => h('div.stRow.stShop',
      select(thingOpts(g), it.thing, (v) => attempt(ctx, () => (it.thing = v)), `Shop item ${i + 1}`),
      numberField(it.price, 0, 9999, (v) => attempt(ctx, () => (it.price = v)), `Price in coins of item ${i + 1}`),
      h('span.stUnit', 'coins'),
      btn('✕', () => attempt(ctx, () => n.shop.splice(i, 1)), 'warn stIcon', `Remove item ${i + 1} from the shop`)));
    const open = ctx.state.npcId === n.id;
    const det = h('details.stDet.stCard', { open, dataset: { npc: n.id } }, h('summary', `${n.name} · ${plural(n.lines.length, 'line')}${n.shop.length ? ` · shop of ${n.shop.length}` : ''}`),
      field('Name', text(n.name, (v) => attempt(ctx, () => (n.name = v.trim().slice(0, 30) || n.name)), { aria: 'Character name', max: 30 })),
      field('Wears', select(spriteOpts(g), n.sprite, (v) => attempt(ctx, () => (n.sprite = v)), `Sprite of ${n.name}`)),
      field('Behaviour', select(BEHAVIOURS.map((b): [string, string] => [b, BEH_WORDS[b]!]), n.behaviour, (v) => attempt(ctx, () => (n.behaviour = v as typeof n.behaviour)), `How ${n.name} moves`)),
      h('div.stAsk', line, btn('Add line', addLine, 'pri', `Add a line for ${n.name}`)),
      ...n.lines.map((l, i) => h('div.stRow.stLine',
        text(l.text, (v) => attempt(ctx, () => (l.text = v.slice(0, 200))), { aria: `${n.name} line ${i + 1}`, max: 200 }),
        btn(l.once ? 'Once' : 'Always', () => attempt(ctx, () => (l.once = !l.once)), '', `Line ${i + 1} is said ${l.once ? 'once only' : 'every time'}: tap to change`),
        btn('✕', () => attempt(ctx, () => n.lines.splice(i, 1)), 'warn stIcon', `Remove line ${i + 1}`))),
      n.lines.length ? note('Lines are said in order. A line marked Once is skipped after it has been said.') : null,
      btn('Draft lines with Ghosty', async (b) => {
        b.disabled = true;
        b.textContent = 'Writing…';
        const r = await dialogueFor(ctx.game(), n);
        b.disabled = false;
        b.textContent = 'Draft lines with Ghosty';
        if ('error' in r) return ctx.say(r.error);
        attempt(ctx, () => r.lines.forEach((t) => n.lines.push({ text: t, once: false })));
        ctx.say(`First draft: edit it. ${r.lines.length} lines added for ${n.name}.`);
      }, '', `Ask Ghosty for dialogue for ${n.name}`),
      section('Shop', note(n.shop.length ? `${n.name} sells ${plural(n.shop.length, 'thing')}. Buying takes coins.` : `${n.name} has no shop. Add a thing to sell.`), ...shopRows,
        btn('Add item', () => (g.things.length ? attempt(ctx, () => n.shop.push({ thing: g.things.find((t) => t.id !== 'coin')?.id ?? g.things[0]!.id, price: 5 })) : ctx.say('Make a thing in THINGS first.')), '', `Add an item to ${n.name}’s shop`)),
      btn('Remove person', () => {
        attempt(ctx, (x) => {
          x.npcs = x.npcs.filter((q) => q.id !== n.id);
          for (const r of x.rooms) for (const k of Object.keys(r.marks)) if (r.marks[k] === n.id && r.rows[Number(k.split(',')[1])]?.[Number(k.split(',')[0])] === 'N') r.marks[k] = '';
        });
        undo(`Removed ${n.name}.`, () => ctx.undo());
      }, 'warn', `Remove ${n.name}`));
    det.addEventListener('toggle', () => det.open && (ctx.state.npcId = n.id));
    root.append(det);
  }
  void toast;
  return root;
}

// ---------------------------------------------------------------- THINGS
export function thingsPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const root = h('div.stPill');
  const name = text('', () => undefined, { aria: 'A new thing’s name', placeholder: 'A name, then Add thing', max: 30 });
  let does: Does = 'quest';
  root.append(section('Things', h('div.stAsk', name, select(DOES.map((d): [string, string] => [d, DOES_WORDS[d]!]), does, (v) => (does = v as Does), 'What the new thing does'), btn('Add thing', () => {
    const v = (name as HTMLInputElement).value.trim();
    if (!v) return ctx.say('Type a name first.');
    attempt(ctx, (x) => {
      const t = newThing(x, v, does);
      x.things.push(t);
      ctx.state.thingId = t.id;
    });
  }, 'pri', 'Add a thing')), g.things.length ? null : note('No things yet. Coins, keys, hearts, powers and quest items are things.')));
  for (const t of g.things) {
    const door = t.does === 'key' ? field('Opens', select([['', 'Choose a door'], ...doorOpts(g)], t.door, (v) => attempt(ctx, () => (t.door = v)), `The door the ${t.name} opens`), g.rooms.some((r) => r.doors.length) ? '' : 'Make a door in ROOMS first') : null;
    const det = h('details.stDet.stCard', { open: ctx.state.thingId === t.id, dataset: { thing: t.id } }, h('summary', `${t.name} · ${DOES_WORDS[t.does].split(':')[0]}`),
      field('Name', text(t.name, (v) => attempt(ctx, () => (t.name = v.trim().slice(0, 30) || t.name)), { aria: 'Thing name', max: 30 })),
      field('What it does', select(DOES.map((d): [string, string] => [d, DOES_WORDS[d]!]), t.does, (v) => attempt(ctx, () => (t.does = v as Does)), `What the ${t.name} does`)),
      VALUE_WORDS[t.does] ? field(VALUE_WORDS[t.does]!, numberField(t.value, 0, 9999, (v) => attempt(ctx, () => (t.value = v)), VALUE_WORDS[t.does]!)) : null,
      door,
      field('Looks like', select(spriteOpts(g), t.sprite, (v) => attempt(ctx, () => (t.sprite = v)), `The sprite of the ${t.name}`)),
      btn('Remove thing', () => {
        if (t.id === 'coin') return ctx.say('Coins are the one thing every game keeps.');
        attempt(ctx, (x) => {
          x.things = x.things.filter((q) => q.id !== t.id);
          for (const n of x.npcs) n.shop = n.shop.filter((s) => s.thing !== t.id);
        });
        undo(`Removed ${t.name}.`, () => ctx.undo());
      }, 'warn', `Remove ${t.name}`));
    det.addEventListener('toggle', () => det.open && (ctx.state.thingId = t.id));
    root.append(det);
  }
  return root;
}

// ---------------------------------------------------------------- QUESTS
export function questsPill(ctx: Ctx): HTMLElement {
  const g = ctx.game();
  const root = h('div.stPill');
  const bad = problems(g).filter((p) => p.at === 'quests');
  const name = text('', () => undefined, { aria: 'A new quest’s name', placeholder: 'A name, then Add quest', max: 40 });
  root.append(section('Quests', h('div.stAsk', name, btn('Add quest', () => {
    const v = (name as HTMLInputElement).value.trim();
    if (!v) return ctx.say('Type a name first.');
    attempt(ctx, (x) => {
      const q = newQuest(x, v);
      x.quests.push(q);
      ctx.state.questId = q.id;
    });
  }, 'pri', 'Add a quest')), g.quests.length ? null : note('No quests yet. A quest is steps in order: talk to someone, collect things, reach a place, defeat foes.'), ...bad.map((p) => note(p.text, p.hard ? 'stWarn' : 'stHint'))));
  for (const q of g.quests) {
    const first = q.steps[0];
    const readsAs = first ? `${q.name}: ${stepWords(g, first, 0)}` : 'No steps yet';
    // a step is added one at a time, from this sheet
    const kind = { v: 'talk' as Step['t'] };
    const sheet = h('div.stSheet.stAddStep');
    const paintSheet = () => {
      const pick = h('div.stAddPick');
      if (kind.v === 'talk') {
        const sel = select(g.npcs.map((n): [string, string] => [n.id, n.name]), g.npcs[0]?.id ?? '', () => undefined, 'Who to talk to');
        pick.append(g.npcs.length ? sel : note('Add a person first.'), btn('Add step', () => g.npcs.length && attempt(ctx, () => q.steps.push({ t: 'talk', npc: sel.value })), 'pri', 'Add the step'));
      } else if (kind.v === 'collect') {
        const sel = select(thingOpts(g), g.things.find((t) => t.id === 'coin')?.id ?? g.things[0]?.id ?? '', () => undefined, 'What to collect');
        const n = numberField(3, 1, 999, () => undefined, 'How many');
        pick.append(sel, n, btn('Add step', () => attempt(ctx, () => q.steps.push({ t: 'collect', thing: sel.value, n: Number(n.value) || 1 })), 'pri', 'Add the step'));
      } else if (kind.v === 'reach') {
        const sel = select(g.rooms.map((r): [string, string] => [r.id, r.name]), g.rooms[0]?.id ?? '', () => undefined, 'Which room to reach');
        pick.append(sel, btn('Add step', () => attempt(ctx, () => q.steps.push({ t: 'reach', room: sel.value })), 'pri', 'Add the step'));
      } else {
        const sel = select(ENEMY_KINDS.map((k): [string, string] => [k, k]), 'walker', () => undefined, 'Which foe');
        const n = numberField(2, 1, 999, () => undefined, 'How many');
        pick.append(sel, n, btn('Add step', () => attempt(ctx, () => q.steps.push({ t: 'defeat', kind: sel.value, n: Number(n.value) || 1 })), 'pri', 'Add the step'));
      }
      sheet.replaceChildren(h('div.stChips', { role: 'group', 'aria-label': 'What kind of step' }, ...([['talk', 'Talk to'], ['collect', 'Collect'], ['reach', 'Reach'], ['defeat', 'Defeat']] as const).map(([id, label]) => h('button.stChip', { type: 'button', 'aria-pressed': String(kind.v === id), 'aria-label': `Step: ${label}`, onclick: () => ((kind.v = id), paintSheet()) }, label))), pick);
    };
    paintSheet();
    const steps = q.steps.map((s, i) => h('div.stRow.stStep',
      h('span.stStepText', `${i + 1}. ${stepWords(g, s, 0)}`),
      btn('↑', () => i > 0 && attempt(ctx, () => q.steps.splice(i - 1, 0, ...q.steps.splice(i, 1))), 'stIcon', `Move step ${i + 1} up`),
      btn('↓', () => i < q.steps.length - 1 && attempt(ctx, () => q.steps.splice(i + 1, 0, ...q.steps.splice(i, 1))), 'stIcon', `Move step ${i + 1} down`),
      btn('✕', () => attempt(ctx, () => q.steps.splice(i, 1)), 'warn stIcon', `Remove step ${i + 1}`)));
    const w = q.reward;
    const det = h('details.stDet.stCard', { open: ctx.state.questId === q.id, dataset: { quest: q.id } }, h('summary', `${q.name} · ${plural(q.steps.length, 'step')}`),
      field('Name', text(q.name, (v) => attempt(ctx, () => (q.name = v.trim().slice(0, 40) || q.name)), { aria: 'Quest name', max: 40 })),
      h('div.stSteps', ...steps),
      section('Add a step', sheet),
      section('Reward',
        h('div.stTwo', field('Coins', numberField(w.coins, 0, 9999, (v) => attempt(ctx, () => (w.coins = v)), 'Coins as a reward')), field('A thing', select(thingOpts(g, 'No thing'), w.item, (v) => attempt(ctx, () => (w.item = v)), 'A thing as a reward'))),
        field('Opens a door', select([['', 'No door'], ...doorOpts(g)], w.door, (v) => attempt(ctx, () => (w.door = v)), 'A door the reward opens')),
        field('Says', text(w.line, (v) => attempt(ctx, () => (w.line = v.slice(0, 200))), { aria: 'A line said as the reward', max: 200, placeholder: 'A line said when it is done' })),
        toggle('Kept in a chest', w.inChest, (v) => attempt(ctx, () => (w.inChest = v))),
        w.inChest ? note('Put a Chest tile in a room and choose “Reward of this quest” for what it holds.') : null),
      note(`The player reads: ${readsAs}`, 'stRead'),
      btn('Remove quest', () => {
        attempt(ctx, (x) => (x.quests = x.quests.filter((z) => z.id !== q.id)));
        undo(`Removed the quest “${q.name}”.`, () => ctx.undo());
      }, 'warn', `Remove the quest ${q.name}`));
    det.addEventListener('toggle', () => det.open && (ctx.state.questId = q.id));
    root.append(det);
  }
  return root;
}
