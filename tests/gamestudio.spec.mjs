// THE GAME STUDIO (BRIEF-EDITOR-GAME-STUDIO), the real app at 440 × 956 and 390 × 844. (a) MAKE → THE GAME STUDIO in two taps, and
// "make a game" in the chat opens it; (b) the empty state's words and the three templates and BLANK; NEW from AN ADVENTURE lists
// its rooms; (c) a tile painted, FILL, ERASE, PICK, a door linked, pinch zoom; (d) the pixel editor draws a tile, mirrors it, adds a
// frame and plays the animation, and the tile is in the tray and paints; (e) a person with dialogue and a shop, a quest built, RULES
// changed; (f) PLAY in place: the pad, a coin counted, the dialogue box and NEXT, a buy refused and then made, the quest line
// advancing, the save point's "Saved", RESET; the whole quest walked by scripted inputs, saved, the page reloaded and CONTINUE
// restoring the room, hearts, coins and the quest step; (g) a quest that cannot be completed is said before PLAY; (h) SHARE's size
// said and the file read back equal, IMPORT lists it; (i) AS AN APP: the size said and under the target, the manifest, the policy
// pinning one script by its hash, the exported page running on its own, and the sites path's result said; (j) the ARCADE's MY GAMES
// row with PLAY and EDIT; (k) "Saved" said, the editor reopens on the same room, UNDO after a delete; (l) every control 44 pt,
// nothing sideways, BODY 21 clips nothing, the pixel editor's cells at least 22 pt at 390; (m) "make me a platformer about a fox" in the chat (the brain's `game` tool, BRIEF-KERNEL-3) opens the studio on a
// new game of the studio's own kit that plays from the ARCADE. Each step of the benchmark is timed.
//   BASE=http://localhost:8835 node tests/gamestudio.spec.mjs tests/.shots
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch();
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const times = [];
const timed = async (label, fn, budget = 6000) => {
  const t = Date.now();
  const r = await fn();
  const ms = Date.now() - t;
  times.push(`${label} ${ms} ms`);
  check(ms < budget, `speed: ${label} took ${ms} ms (budget ${budget})`);
  return r;
};
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const S = (page, fn, arg) => page.evaluate(({ src, arg }) => new Function('S', 'arg', `return (${src})(S, arg)`)(window.__ghostyStudio, arg), { src: fn.toString(), arg });
const click = (page, sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const pill = async (page, id) => {
  await click(page, `#pg-gamestudio .secpill[data-sec="${id}"]`);
  await page.waitForTimeout(350);
};

async function open(size) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: size, screen: size, ...UK });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|401|403/.test(m.text()) && errors.push(m.text()));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  if (await page.$('.logbtn')) await page.click('.logbtn');
  return { ctx, page, errors };
}
/** A tap on tile (x, y) of the room canvas. */
async function tapTile(page, x, y) {
  await page.evaluate(() => document.querySelector('.stCanvasBox')?.scrollIntoView({ block: 'center' }));
  const where = () => page.evaluate(([x, y]) => {
    const S = window.__ghostyStudio;
    const c = document.querySelector('.stCanvas').getBoundingClientRect();
    const cell = 24 * S.state.zoom;
    return { x: Math.round(c.left + S.state.panX + (x + 0.5) * cell), y: Math.round(c.top + S.state.panY + (y + 0.5) * cell) };
  }, [x, y]);
  // (the page may still be settling — a line fading in moves the canvas: it is tapped where it has stopped)
  let r = await where();
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(120);
    const n = await where();
    const still = n.x === r.x && n.y === r.y;
    r = n;
    if (still) break;
  }
  await page.mouse.move(r.x, r.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
}
const choose = (page, letter) => click(page, `#pg-gamestudio .stTile[data-letter="${letter}"]`);
const toolOf = (page, t) => click(page, `#pg-gamestudio .stTool[data-tool="${t}"]`);
const setSelect = (page, label, value) => page.evaluate(([label, value]) => {
  const el = [...document.querySelectorAll('#pg-gamestudio select')].find((s) => s.getAttribute('aria-label') === label);
  if (!el) return false;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}, [label, value]);
const typeInto = async (page, label, value, nth = 0) => {
  const loc = page.locator(`#pg-gamestudio [aria-label="${label}"]`).nth(nth);
  await loc.fill(value);
  await loc.evaluate((e) => e.dispatchEvent(new Event('change', { bubbles: true })));
};
const pressBtn = (page, label, nth = 0) => page.evaluate(([label, nth]) => [...document.querySelectorAll('#pg-gamestudio button')].filter((b) => (b.getAttribute('aria-label') || '').trim() === label || b.textContent.trim() === label)[nth]?.click(), [label, nth]);

async function layout(page, label, size) {
  const r = await page.evaluate(() => {
    const W = innerWidth;
    const small = [...document.querySelectorAll('#pg-gamestudio :is(button:not(.swap), select, input:not([type=file]), textarea, summary)')].filter((b) => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden').filter((b) => {
      const r = b.getBoundingClientRect();
      return r.height < 43.4 || (r.width < 43.4 && b.tagName !== 'INPUT');
    }).map((b) => `${(b.getAttribute('aria-label') || b.textContent || b.className).slice(0, 24)} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
    const unnamed = [...document.querySelectorAll('#pg-gamestudio :is(button, select, input:not([type=file]), textarea)')].filter((b) => b.getClientRects().length && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => b.className);
    return { sw: document.documentElement.scrollWidth, W, small, unnamed };
  });
  check(r.sw <= r.W, `${label}: nothing sideways at ${size.width} (${r.sw} of ${r.W})`);
  check(r.small.length === 0, `${label}: every control is 44 pt${r.small.length ? `: ${r.small.slice(0, 4).join('; ')}` : ''}`);
  check(r.unnamed.length === 0, `${label}: every control is named for VoiceOver${r.unnamed.length ? `: ${r.unnamed.join(', ')}` : ''}`);
}

// (ONLY=390 or ONLY=440 runs one width, for a machine too busy to do both inside ten minutes)
for (const size of [PHONE, { width: 390, height: 844 }].filter((z) => !process.env.ONLY || String(z.width) === process.env.ONLY)) {
  const W = size.width;
  const { ctx, page, errors } = await open(size);
  console.log(`\n== ${W} × ${size.height}`);
  // (a) two taps from Home, and the chat's words
  await timed(`${W}: MAKE → THE GAME STUDIO in two taps`, async () => {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
    await click(page, '#dock .tabcap button[data-area="make"]');
    await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="gamestudio"]', { timeout: 10000 });
    const gpill = await page.evaluate(() => {
      const p = document.querySelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="gamestudio"]');
      return { text: p.textContent.trim(), tag: p.tagName, label: p.getAttribute('aria-label'), ids: [...new Set([...document.querySelectorAll('#pg-area-make .hubtile')].map((e) => e.dataset.id))] };
    });
    check(gpill.tag === 'BUTTON' && gpill.text === 'GAME STUDIO' && /^Open /.test(gpill.label ?? ''), `${W}: MAKE's GAME STUDIO pill: ${JSON.stringify(gpill).slice(0, 200)}`);
    check(gpill.ids.length === 8 && !gpill.ids.includes('gamestudio'), `${W}: MAKE shows ${gpill.ids.length} cards, eight are expected with the studio folded under EDITORS: ${gpill.ids.join(',')}`);
    await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="gamestudio"]');
    await page.waitForSelector('#pg-gamestudio .stTpl', { timeout: 15000 });
  }, 7000);
  check(await page.evaluate(() => location.hash.replace('#', '').startsWith('gamestudio')), `${W}: the second tap opened the game studio`);
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  await page.fill('#cin', 'make a game');
  await page.keyboard.press('Enter');
  check(await until(page, () => location.hash.startsWith('#gamestudio'), null, 8000), `${W}: “make a game” in the chat opens the studio`);
  await page.waitForSelector('#pg-gamestudio .stTpl');
  // (b) the empty state and the templates
  const empty = await page.evaluate(() => ({ say: document.querySelector('#pg-gamestudio .stEmpty')?.textContent ?? '', tpl: [...document.querySelectorAll('#pg-gamestudio .stTpl b')].map((b) => b.textContent), about: document.querySelector('#pg-gamestudio .stAbout')?.textContent ?? '' }));
  check(/No games yet\. Pick a template and you are making one in a minute\./.test(empty.say), `${W}: the empty state says what to do (${empty.say.slice(0, 60)})`);
  check(empty.tpl.length === 4 && /platformer/i.test(empty.tpl[0]) && /adventure/i.test(empty.tpl[1]) && /collect/i.test(empty.tpl[2]) && /blank/i.test(empty.tpl[3]), `${W}: the three templates and blank (${empty.tpl.join(' · ')})`);
  check(/3-D worlds, multiplayer and selling a game are not in it yet/.test(empty.about), `${W}: “?” says what the first version leaves out`);
  await layout(page, `${W} shelf`, size);
  await page.screenshot({ path: `${out}/gs-${W}-shelf.png` });
  await timed(`${W}: NEW from AN ADVENTURE`, async () => {
    await click(page, '.stTpl[data-template="adventure"]');
    await page.waitForSelector('#pg-gamestudio .stPills');
    await page.waitForSelector('#pg-gamestudio .stCanvas');
  }, 7000);
  const chips = await page.$$eval('#pg-gamestudio .stPill > .stChips:first-child .stChip', (b) => b.map((x) => x.textContent));
  check(chips.includes('The village') && chips.includes('The cave'), `${W}: the adventure lists its rooms (${chips.join(', ')})`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/gs-${W}-rooms.png` });

  // (c) paint, fill, erase, pick, a door, pinch zoom
  await timed(`${W}: a tile painted, FILL, ERASE, PICK`, async () => {
    await choose(page, '~');
    await tapTile(page, 3, 6);
    check((await S(page, (S) => S.game().rooms[0].rows[6][3])) === '~', `${W}: PAINT put water under the finger`);
    await choose(page, 'B');
    for (let i = 0; i < 4; i++) await tapTile(page, 4 + i, 9);
    check((await S(page, (S) => S.game().rooms[0].rows[9].slice(4, 8))) === 'BBBB', `${W}: a row of crates in four taps`);
    await toolOf(page, 'erase');
    await tapTile(page, 5, 9);
    check((await S(page, (S) => S.game().rooms[0].rows[9][5])) === '.', `${W}: ERASE cleared a tile`);
    await toolOf(page, 'pick');
    await tapTile(page, 4, 9);
    check((await S(page, (S) => S.state.letter)) === 'B', `${W}: PICK took the crate`);
    await choose(page, 'p');
    await toolOf(page, 'fill');
    const before = await S(page, (S) => S.game().rooms[0].rows.join('').split('.').length - 1);
    await tapTile(page, 10, 8);
    const after = await S(page, (S) => S.game().rooms[0].rows.join('').split('.').length - 1);
    check(before - after > 30, `${W}: FILL painted a region (${before - after} tiles; ${JSON.stringify(await S(page, (S) => [S.state.tool, S.state.letter, S.state.roomId, S.game().rooms[0].rows[13]]))})`);
  }, 12000);
  await S(page, (S) => S.go('rooms'));
  await choose(page, 'D');
  await toolOf(page, 'paint');
  await tapTile(page, 1, 1);
  const linked = await timed(`${W}: a door placed and linked`, async () => {
    await page.waitForSelector('#pg-gamestudio .stInspect select', { timeout: 5000 });
    const ok = await setSelect(page, 'The room this door opens into', 'cave');
    await page.waitForTimeout(300);
    return ok;
  });
  check(linked && (await S(page, (S) => S.game().rooms[0].doors.find((d) => d.x === 1 && d.y === 1)?.room)) === 'cave', `${W}: the door opens into the cave`);
  // pinch zoom with two touches
  const z0 = await S(page, (S) => S.state.zoom);
  await page.evaluate(() => {
    const c = document.querySelector('.stCanvas');
    const r = c.getBoundingClientRect();
    const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerType: 'touch', isPrimary: id === 1 }));
    ev('pointerdown', 1, r.width / 2 - 20, 100);
    ev('pointerdown', 2, r.width / 2 + 20, 100);
    for (let i = 1; i <= 8; i++) {
      ev('pointermove', 1, r.width / 2 - 20 - i * 6, 100);
      ev('pointermove', 2, r.width / 2 + 20 + i * 6, 100);
    }
    ev('pointerup', 1, 0, 0);
    ev('pointerup', 2, 0, 0);
  });
  check((await S(page, (S) => S.state.zoom)) > z0 * 1.3, `${W}: a pinch zooms the room`);
  await S(page, (S) => (S.state.zoom = 1, S.state.panX = 0, S.state.panY = 0));
  await layout(page, `${W} rooms`, size);

  // (d) the pixel editor
  await pill(page, 'sprites');
  await timed(`${W}: one tile drawn in the pixel editor and placed`, async () => {
    await pressBtn(page, '+ Tile');
    await page.waitForSelector('#pg-gamestudio .stPix');
    await page.evaluate(() => document.querySelector('.stPix').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(100);
    const box = await page.locator('#pg-gamestudio .stPix').boundingBox();
    const cell = box.width / 16;
    check(cell >= 22 - 0.01, `${W}: the pixel editor's cells are ${cell.toFixed(1)} pt (22 or more)`);
    await click(page, '#pg-gamestudio .stInk[data-ink="9"]');
    for (const [cx, cy] of [[2, 2], [3, 2], [4, 2], [2, 3]]) {
      await page.mouse.move(box.x + (cx + 0.5) * cell, box.y + (cy + 0.5) * cell);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(60);
    }
    const px = await S(page, (S) => S.game().tiles[0].px);
    check(px[2 * 16 + 2] === '9' && px[2 * 16 + 4] === '9', `${W}: four pixels drawn in violet`);
    await pressBtn(page, 'Mirror');
    const m = await S(page, (S) => S.game().tiles[0].px);
    check(m[2 * 16 + 13] === '9' && m[2 * 16 + 2] === '0', `${W}: MIRROR flipped the tile`);
    await pressBtn(page, 'Use in a room');
    await page.waitForSelector('#pg-gamestudio .stTile[data-letter="A"]');
    await tapTile(page, 9, 9);
    check((await S(page, (S) => S.game().rooms[0].rows[9][9])) === 'A', `${W}: his own tile is in the tray and paints`);
  }, 12000);
  await pill(page, 'sprites');
  await click(page, '#pg-gamestudio .stChips[aria-label="What to draw"] .stChip');
  await page.waitForTimeout(300);
  await timed(`${W}: the player's walk given a second frame`, async () => {
    await pressBtn(page, 'Walk');
    await page.waitForTimeout(250);
    const n0 = await S(page, (S) => S.game().sprites[0].anims.walk.length);
    await pressBtn(page, 'Duplicate');
    await page.waitForTimeout(250);
    const n1 = await S(page, (S) => S.game().sprites[0].anims.walk.length);
    check(n1 === n0 + 1, `${W}: the walk has ${n1} frames`);
    await pressBtn(page, 'Play the animation');
    await page.waitForTimeout(500);
    const live = await page.evaluate(() => document.querySelector('#pg-gamestudio .stPrev p')?.textContent ?? '');
    check(/Playing walk: frame \d of \d/.test(live), `${W}: PLAY runs the animation (${live})`);
    await pressBtn(page, 'Stop');
  });
  await layout(page, `${W} sprites`, size);
  await page.screenshot({ path: `${out}/gs-${W}-sprites.png` });

  // (e) a person, a shop, a thing, a quest, rules
  await pill(page, 'characters');
  await timed(`${W}: one person with two lines and a shop selling a key for five coins`, async () => {
    await typeInto(page, 'A new character’s name', 'Boro');
    await pressBtn(page, 'Add person');
    await page.waitForSelector('#pg-gamestudio details[data-npc="boro"]');
    for (const line of ['Welcome, traveller.', 'Mind the cave.']) {
      await page.locator('#pg-gamestudio details[data-npc="boro"] [aria-label="A line for Boro"]').fill(line);
      await pressBtn(page, 'Add line for Boro'.replace('Add line for Boro', 'Add a line for Boro'));
      await page.waitForTimeout(200);
    }
    await pressBtn(page, 'Add an item to Boro’s shop');
    await page.waitForTimeout(200);
    await setSelect(page, 'Shop item 1', 'cave-key');
    await page.waitForTimeout(200);
    const ok = await S(page, (S) => { const n = S.game().npcs.find((x) => x.id === 'boro'); return n.lines.length === 2 && n.shop[0].thing === 'cave-key' && n.shop[0].price === 5; });
    check(ok, `${W}: Boro has two lines and sells the key for 5 coins`);
  }, 12000);
  await pill(page, 'rooms');
  await choose(page, 'N');
  await toolOf(page, 'paint');
  await tapTile(page, 8, 10);
  await page.waitForSelector('#pg-gamestudio .stInspect select');
  await setSelect(page, 'Which character stands here', 'boro');
  await page.waitForTimeout(250);
  check((await S(page, (S) => S.game().rooms[0].marks['8,10'])) === 'boro', `${W}: Boro stands in the village`);
  await pill(page, 'rooms');
  await click(page, '#pg-gamestudio .stChips .stChip[aria-label="Room The cave"]');
  await page.waitForTimeout(300);
  await choose(page, 'c');
  await tapTile(page, 10, 3);
  await pill(page, 'rooms');
  await page.waitForTimeout(200);
  await pill(page, 'quests');
  await timed(`${W}: a quest made (talk to Boro, collect three coins, reach the cave, a chest as the reward)`, async () => {
    await typeInto(page, 'A new quest’s name', 'Boro’s errand');
    await pressBtn(page, 'Add quest');
    await page.waitForSelector('#pg-gamestudio details[data-quest="boro-s-errand"]');
    // the first quest card (Mara’s) comes first; this quest is the last card's sheet
    const stepBtn = async (name) => page.evaluate((name) => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; [...c.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name)?.click(); }, name);
    const sel = async (label, value) => page.evaluate(([label, value]) => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; const s = [...c.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === label); s.value = value; s.dispatchEvent(new Event('change', { bubbles: true })); }, [label, value]);
    const num = async (label, value) => page.evaluate(([label, value]) => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; const s = [...c.querySelectorAll('input')].find((x) => x.getAttribute('aria-label') === label); s.value = value; s.dispatchEvent(new Event('change', { bubbles: true })); }, [label, value]);
    await stepBtn('Step: Talk to');
    await sel('Who to talk to', 'boro');
    await stepBtn('Add the step');
    await page.waitForTimeout(250);
    await stepBtn('Step: Collect');
    await sel('What to collect', 'coin');
    await num('How many', '3');
    await stepBtn('Add the step');
    await page.waitForTimeout(250);
    await stepBtn('Step: Reach');
    await sel('Which room to reach', 'cave');
    await stepBtn('Add the step');
    await page.waitForTimeout(250);
    // the reward: a chest
    await page.evaluate(() => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; [...c.querySelectorAll('button')].find((b) => /^Kept in a chest/.test(b.getAttribute('aria-label')))?.click(); });
    await page.waitForTimeout(250);
    await page.evaluate(() => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; const s = [...c.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'A thing as a reward'); s.value = 'heart'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForTimeout(250);
    const q = await S(page, (S) => S.game().quests.find((x) => x.id === 'boro-s-errand'));
    check(q.steps.length === 3 && q.steps[0].t === 'talk' && q.steps[1].n === 3 && q.steps[2].t === 'reach' && q.reward.inChest && q.reward.item === 'heart', `${W}: the quest has its three steps and a chest reward`);
  }, 15000);
  const readsAs = await page.evaluate(() => [...document.querySelectorAll('#pg-gamestudio .stRead')].pop()?.textContent ?? '');
  check(/The player reads: Boro’s errand: Talk to Boro/.test(readsAs), `${W}: the quest line as the player reads it (${readsAs})`);
  // the chest placed in the cave holds that reward
  await pill(page, 'rooms');
  await click(page, '#pg-gamestudio .stChips .stChip[aria-label="Room The cave"]');
  await page.waitForTimeout(300);
  await tapTile(page, 10, 3);
  await toolOf(page, 'paint');
  await choose(page, 'c');
  await tapTile(page, 10, 3);
  await page.waitForTimeout(300);
  await setSelect(page, 'What the chest holds', 'q:boro-s-errand');
  await page.waitForTimeout(300);
  check((await S(page, (S) => S.game().rooms[1].marks['10,3'])) === 'q:boro-s-errand', `${W}: a chest in the cave keeps the quest's reward`);
  await pill(page, 'rules');
  await page.evaluate(() => { const r = document.querySelector('#pg-gamestudio .stRange'); r.value = '5'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(300);
  await setSelect(page, 'What ends the game', 'quests');
  await page.waitForTimeout(250);
  check(await S(page, (S) => S.game().rules.lives === 5 && S.game().rules.end === 'quests'), `${W}: RULES changed (5 lives, ends with the last quest)`);
  await layout(page, `${W} rules`, size);
  for (const t of ['characters', 'things', 'quests', 'sound', 'share', 'app']) {
    await pill(page, t);
    await page.waitForTimeout(400);
    await layout(page, `${W} ${t}`, size);
  }

  // (k) saved, said once, the editor reopens on the same room, undo after a delete
  await pill(page, 'rooms');
  await click(page, '#pg-gamestudio .stChips .stChip[aria-label="Room The cave"]');
  await page.waitForTimeout(300);
  await choose(page, 'o');
  await tapTile(page, 5, 5);
  check(await until(page, () => document.querySelector('#pg-gamestudio .stSaved')?.classList.contains('on'), null, 4000), `${W}: “Saved” fades in after a change`);
  await page.waitForTimeout(2200);
  check(!(await page.evaluate(() => document.querySelector('#pg-gamestudio .stSaved').classList.contains('on'))), `${W}: and fades again`);
  // a second village door is not needed: delete the cave and bring it back
  await page.evaluate(() => document.querySelector('#pg-gamestudio .stDet summary').click());
  await pressBtn(page, 'Delete the room The cave');
  await page.waitForTimeout(400);
  check((await S(page, (S) => S.game().rooms.length)) === 1, `${W}: the cave is deleted`);
  await click(page, '.undofloat button');
  await page.waitForTimeout(500);
  check((await S(page, (S) => S.game().rooms.length)) === 2, `${W}: UNDO in the line brings it back`);
  await click(page, '#pg-gamestudio .stChips .stChip[aria-label="Room The cave"]');
  await page.waitForTimeout(600);
  await S(page, (S) => S.go('rooms'));

  if (W === 440) {
    // (f) PLAY in place, the whole quest by scripted inputs
    await pill(page, 'play');
    await page.waitForSelector('#pg-gamestudio .stPlayCanvas');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/gs-${W}-play.png` });
    const peek = () => S(page, (S) => S.play.peek());
    check((await peek()).hearts === 3, `${W}: PLAY shows the hearts live (${(await peek()).hearts})`);
    const playedLive = await page.evaluate(() => document.querySelector('#pg-gamestudio .stLive')?.textContent ?? '');
    check(/♥♥♥ · 0 coins · Mara’s key: Talk to Mara/.test(playedLive), `${W}: the quest line and hearts are live (${playedLive})`);
    // the pad: a thumb on ▶ moves the hero
    const x0 = (await peek()).x;
    await page.evaluate(() => {
      const b = document.querySelector('#pg-gamestudio .gpPad [data-act="right"]');
      b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true }));
      setTimeout(() => b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true })), 500);
    });
    await page.waitForTimeout(800);
    check((await peek()).x > x0 + 8, `${W}: the pad's ▶ walks the hero`);
    await click(page, '#pg-gamestudio .stRow .stBtn.pri');
    await page.waitForTimeout(300);
    await timed(`${W}: PLAY the quest walked through by scripted inputs to its end`, async () => {
      const w = (x, y, o) => S(page, (S, a) => S.play.walk(a.x, a.y, a.o), { x, y, o });
      const tap = (n) => S(page, (S, n) => S.play.tap(n), n);
      // Mara first (her quest), then Boro's
      // collect coins: walk over every coin of the village
      const coins = await S(page, (S) => { const out = []; S.game().rooms[0].rows.forEach((r, y) => [...r].forEach((c, x) => c === 'o' && out.push([x, y]))); return out; });
      // Boro: talk (the dialogue box and NEXT), the shop refuses with no coins
      await w(8, 11);
      await tap('a');
      await page.waitForSelector('#pg-gamestudio .gpBox', { timeout: 5000 });
      check(/Boro/.test(await page.locator('#pg-gamestudio .gpBox h3').textContent()), `${W}: the dialogue box names who speaks`);
      const nextBox = await page.locator('#pg-gamestudio .gpBox button').boundingBox();
      check(nextBox.height >= 44 && nextBox.width >= 44, `${W}: NEXT is 44 pt (${Math.round(nextBox.width)}×${Math.round(nextBox.height)})`);
      for (let i = 0; i < 4; i++) {
        if (await page.$('#pg-gamestudio .gpBox')) await click(page, '#pg-gamestudio .gpBox button');
        await page.waitForTimeout(150);
      }
      await page.waitForSelector('#pg-gamestudio .gpSheet[data-sheet="shop"]', { timeout: 5000 });
      await click(page, '#pg-gamestudio .gpSheet [data-act="buy"]');
      await page.waitForTimeout(300);
      check(/You need 5 coins for the cave key, and you have 0\./.test(await page.locator('#pg-gamestudio .gpSheet').textContent()), `${W}: a buy with too few coins is refused, in words`);
      await click(page, '#pg-gamestudio .gpSheet [data-act="done"]');
      await page.waitForTimeout(300);
      for (const [x, y] of coins) await w(x, y);
      check((await peek()).coins === 8, `${W}: eight coins counted (${(await peek()).coins})`);
      await w(8, 11);
      await tap('a');
      await page.waitForSelector('#pg-gamestudio .gpBox', { timeout: 5000 });
      for (let i = 0; i < 4; i++) {
        if (await page.$('#pg-gamestudio .gpBox')) await click(page, '#pg-gamestudio .gpBox button');
        await page.waitForTimeout(150);
      }
      await page.waitForSelector('#pg-gamestudio .gpSheet[data-sheet="shop"]', { timeout: 5000 });
      await click(page, '#pg-gamestudio .gpSheet [data-act="buy"]');
      await page.waitForTimeout(300);
      await click(page, '#pg-gamestudio .gpSheet [data-act="done"]');
      await page.waitForTimeout(300);
      const p = await peek();
      check(p.coins === 3 && p.inv['cave-key'] === 1, `${W}: the key bought for five coins (${p.coins} left)`);
      // Mara's quest finishes with her key; the save point
      await w(3, 12);
      await page.waitForTimeout(400);
      check(/Saved/.test(await page.evaluate(() => document.querySelector('#pg-gamestudio .stNote[aria-live]')?.textContent ?? '')) || (await peek()).said === 'Saved.', `${W}: the save point says “Saved”`);
      await w(22, 8);
      await w(23, 8, { door: true });
      await page.waitForTimeout(300);
      check((await peek()).room === 'cave', `${W}: the door opened with the key and the cave is in front`);
      console.log('   walk to the cave:', JSON.stringify(await w(15, 3)), JSON.stringify(await peek()).slice(0, 160));
      await page.waitForTimeout(300);
      const q = await S(page, (S) => S.play.run().quests['boro-s-errand']);
      check(q.done === true, `${W}: the quest is done on reaching the cave`);
      console.log('   walk to the chest:', JSON.stringify(await w(10, 3)), JSON.stringify(await peek()).slice(0, 160));
      await tap('a');
      await page.waitForTimeout(300);
      check((await peek()).inv.heart === 1, `${W}: the chest reached and opened: its reward is in his things (${JSON.stringify(await peek())})`);
    }, 40000);
    // RESET, then CONTINUE after a reload
    await page.evaluate(() => { const s = window.__ghostyStudio; s.savedPeek = s.play.peek(); });
    await click(page, '#pg-gamestudio .stRow .stBtn.pri');
    await page.waitForTimeout(400);
    check((await peek()).coins === 0 && (await peek()).room === 'village', `${W}: RESET starts again from the start`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    await page.evaluate(() => (location.hash = 'gamestudio'));
    await page.waitForSelector('#pg-gamestudio .stPills', { timeout: 15000 });
    check(await page.evaluate(() => document.querySelector('#pg-gamestudio .stTitle')?.textContent === 'My adventure'), `${W}: the editor reopened on the same game`);
    check((await S(page, (S) => S.state.roomId)) === 'cave', `${W}: and on the same room (the cave)`);
    await pill(page, 'play');
    await page.waitForSelector('#pg-gamestudio .stPlayCanvas');
    await page.waitForTimeout(600);
    const cont = await until(page, () => ![...document.querySelectorAll('#pg-gamestudio button')].find((b) => b.getAttribute('aria-label') === 'Continue from your last save point')?.hidden, null, 6000);
    check(cont, `${W}: CONTINUE is offered after the reload`);
    await pressBtn(page, 'Continue from your last save point');
    await page.waitForTimeout(500);
    const back = await S(page, (S) => S.play.peek());
    check(back.room === 'village' && back.coins === 3 && back.hearts === 3 && (await S(page, (S) => S.play.run().quests['boro-s-errand'].i)) === 2, `${W}: CONTINUE restored the room, hearts, coins and quest step (${back.room}, ${back.coins} coins, ${back.hearts} hearts, ${back.quest})`);
  }

  // (g) a quest that cannot be completed is said before PLAY
  await pill(page, 'things');
  await typeInto(page, 'A new thing’s name', 'Moon gem');
  await pressBtn(page, 'Add thing');
  await page.waitForTimeout(300);
  await pill(page, 'quests');
  await typeInto(page, 'A new quest’s name', 'Gem hunt');
  await pressBtn(page, 'Add quest');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; [...c.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Step: Collect')?.click(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; const s = [...c.querySelectorAll('select')].find((x) => x.getAttribute('aria-label') === 'What to collect'); s.value = 'moon-gem'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.evaluate(() => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); const c = cards[cards.length - 1]; [...c.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Add the step')?.click(); });
  await page.waitForTimeout(300);
  await pill(page, 'play');
  const said = await page.evaluate(() => document.querySelector('#pg-gamestudio .stPill')?.textContent ?? '');
  check(/.Gem hunt. cannot be finished: it asks for 3 moon gems and the rooms hold 0/.test(said) , `${W}: a quest that cannot be completed is said before PLAY (${said.slice(0, 160)})`);
  check((await page.$('#pg-gamestudio .stPlayCanvas')) === null, `${W}: and PLAY does not start`);
  await S(page, (S) => S.go('quests'));
  await page.evaluate(() => { const cards = document.querySelectorAll('#pg-gamestudio details[data-quest]'); [...cards[cards.length - 1].querySelectorAll('button')].find((b) => /^Remove the quest/.test(b.getAttribute('aria-label')))?.click(); });
  await page.waitForTimeout(300);

  // (h) share: the size said, the file read back equal; import lists it
  await pill(page, 'share');
  const shareText = await page.evaluate(() => document.querySelector('#pg-gamestudio .stPill')?.textContent ?? '');
  const size1 = await S(page, (S) => S.shareSize);
  check(new RegExp(`The file is ${size1 < 1000 ? size1 + ' B' : size1 < 1e6 ? (Math.max(1, Math.round(size1 / 100) / 10)) + ' KB' : (Math.round(size1 / 1e5) / 10) + ' MB'}`).test(shareText), `${W}: SHARE says the file's size (${size1} bytes)`);
  check(await S(page, (S) => S.roundTrip()), `${W}: the .ghostygame reads back equal`);
  const bytes = await S(page, (S) => S.shareBytes());
  await page.evaluate(() => { window.__imp = false; addEventListener('ghosty:studio-imported', () => (window.__imp = true)); });
  await page.setInputFiles('#pg-gamestudio input[type=file]', { name: 'mine.ghostygame', mimeType: 'application/x-ghostygame', buffer: Buffer.from(bytes) });
  check(await until(page, () => window.__imp === true, null, 25000), `${W}: IMPORT took the file`);
  await page.evaluate(() => document.querySelector('#pg-gamestudio .stBack').click());
  await page.waitForSelector('#pg-gamestudio .stGrid');
  await page.waitForTimeout(600);
  const names = await page.$$eval('#pg-gamestudio .stOpen .stName', (n) => n.map((x) => x.textContent));
  check(names.length === 2 && names.every((n) => n === 'My adventure'), `${W}: IMPORT lists the game it read (${names.length} games on the shelf)`);
  await layout(page, `${W} shelf with games`, size);
  await page.screenshot({ path: `${out}/gs-${W}-shelf2.png` });
  await click(page, '#pg-gamestudio .stOpen');
  await page.waitForSelector('#pg-gamestudio .stPills');

  // (i) AS AN APP
  await pill(page, 'app');
  await page.waitForSelector('#pg-gamestudio .stSize[data-bytes]', { timeout: 10000 });
  const appBytes = Number(await page.evaluate(() => document.querySelector('#pg-gamestudio .stSize').dataset.bytes));
  check(appBytes > 20000 && appBytes < 400000, `${W}: the page is ${appBytes} bytes, under the 400 KB target`);
  console.log(`   app page: ${appBytes} bytes`);
  const sizeSaid = await page.evaluate(() => document.querySelector('#pg-gamestudio .stSize').textContent);
  check(/The page is [\d.]+ (KB|MB)/.test(sizeSaid) && /under the/.test(sizeSaid), `${W}: AS AN APP says the size before (${sizeSaid.slice(0, 60)})`);
  const html = await S(page, async (S) => S.appPage());
  const man = await S(page, (S) => S.manifest());
  check(man.name === 'My adventure' && man.display === 'standalone' && /^\/s\/my-adventure\/$/.test(man.start_url) && man.scope === man.start_url && man.icons[0].sizes === '512x512', `${W}: the manifest has name, standalone, start_url and scope`);
  const pin = await page.evaluate(async (html) => {
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
    const code = /<script>([\s\S]*)<\/script><\/body>/.exec(html)[1];
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
    const h = btoa(String.fromCharCode(...new Uint8Array(d)));
    return { csp, has: csp.includes(`'sha256-${h}'`), net: /connect-src 'none'/.test(csp) && /default-src 'none'/.test(csp), scripts: (html.match(/<script(?![^>]*application\/json)/g) ?? []).length };
  }, html);
  check(pin.has && pin.net && pin.scripts === 1, `${W}: its one script is pinned by hash and the policy has no network`);
  await pressBtn(page, 'Export the game as one page, kept in the library');
  check(await until(page, () => document.querySelector('#pg-gamestudio .stLibRow'), null, 6000), `${W}: the page is kept in the library`);
  await pressBtn(page, 'Put the page on my sites');
  await page.waitForTimeout(300);
  const sites = await page.evaluate(() => document.querySelector('#pg-gamestudio .stSites')?.textContent ?? '');
  check(/I can’t put this on your sites yet/.test(sites) && /needs a change to my server, which needs your word/.test(sites), `${W}: PUT IT ON MY SITES says honestly what stops it`);
  // the exported page runs on its own
  const own = await ctx.newPage();
  const ownErrors = [];
  own.on('pageerror', (e) => ownErrors.push(e.message));
  own.on('console', (m) => (m.type() === 'error' || /Content Security Policy|Refused/.test(m.text())) && ownErrors.push(m.text()));
  await own.setContent(html, { waitUntil: 'load' });
  await own.waitForSelector('.gpEnd button', { timeout: 8000 });
  const titleWords = await own.$$eval('.gpEnd button', (b) => b.map((x) => x.textContent));
  check(titleWords.includes('Play'), `${W}: the exported page opens on its own title (${titleWords.join(', ')})`);
  await own.click('.gpEnd button');
  await own.waitForSelector('.gpPad');
  await own.waitForTimeout(500);
  const lit = await own.evaluate(() => { const c = document.getElementById('c'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] || d[i + 1] || d[i + 2]) n++; return n; });
  check(lit > 50, `${W}: the exported page draws its game (${lit} lit samples)`);
  check(ownErrors.length === 0, `${W}: the exported page runs with no error and no policy refusal${ownErrors.length ? `: ${ownErrors[0]}` : ''}`);
  await own.close();

  // (j) the ARCADE's MY GAMES row
  await page.evaluate(() => (location.hash = 'arcade'));
  await page.waitForSelector('#pg-arcade .arcmy', { timeout: 10000 });
  const row = await page.$$eval('#pg-arcade .arcmy', (c) => c.map((x) => ({ t: x.querySelector('.arctitle')?.textContent, btns: [...x.querySelectorAll('button')].map((b) => b.textContent), score: x.querySelector('.arcscore')?.textContent })));
  check(row.length === 2 && row[0].btns.join() === 'PLAY,EDIT' && /Not played yet|Your best/.test(row[0].score), `${W}: the arcade's MY GAMES row shows the games with PLAY and EDIT (${row.length})`);
  await page.screenshot({ path: `${out}/gs-${W}-arcade.png` });
  if (W === 440) {
    await click(page, '#pg-arcade .arcmy .arcact.play');
    check(await until(page, () => document.querySelector('.g2ui .g2btn[data-id="play"], .g2ui .g2btn[data-id="new-game"], .g2ui .g2btn[data-id="continue"]'), null, 20000), `${W}: PLAY in the arcade opens the game's own menu`);
    const menu = await page.$$eval('.g2menu .g2btns button', (b) => b.map((x) => x.textContent));
    check(!/Level|Ghosty/.test(await page.locator('.g2menu').textContent()), `${W}: no level and no Ghosty on his game's menu (${menu.join(', ')})`);
    await page.evaluate(() => [...document.querySelectorAll('.g2menu .g2btns button')].find((b) => /Quit/.test(b.textContent))?.click());
    await page.waitForTimeout(500);
  }
  await click(page, '#pg-arcade .arcmy .arcact.edit');
  check(await until(page, () => location.hash.startsWith('#gamestudio') && document.querySelector('#pg-gamestudio .stPills'), null, 8000), `${W}: EDIT opens the game in the studio`);

  // (l) BODY 21 clips nothing
  await page.evaluate(() => (document.documentElement.dataset.body = '21'));
  await page.waitForTimeout(400);
  for (const t of ['rooms', 'characters', 'rules', 'share']) {
    await pill(page, t);
    const cut = await page.evaluate(() => [...document.querySelectorAll('#pg-gamestudio .stBody :is(button, summary, .stLab, .stNote, .stStepText, option)')].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').map((e) => (e.textContent || '').slice(0, 20)));
    const sw = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    check(cut.length === 0 && sw, `${W}: at BODY 21 ${t} clips nothing and stays inside${cut.length ? `: ${cut.join('; ')}` : ''}`);
  }
  await page.evaluate(() => delete document.documentElement.dataset.body);
  check(errors.length === 0, `${W}: no page error${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}
// (m) the brain's `game` tool (BRIEF-KERNEL-3): "make me a platformer about a fox" in the chat opens the studio on a new game, built from the studio's own kit and kept in the library; it plays from the ARCADE. (Its own context: the games above are counted at two.)
if (!process.env.ONLY || process.env.ONLY === '440') {
  const { ctx, page, errors } = await open(PHONE);
  console.log('\n== (m) a game made from the chat');
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', 'make me a platformer about a fox');
  await page.keyboard.press('Enter');
  check(await until(page, () => location.hash.startsWith('#gamestudio') && document.querySelector('#pg-gamestudio .stPills') && window.__ghostyStudio?.game?.().name === 'Fox Run', null, 30000), '(m) "make me a platformer about a fox" opens the studio on a new game, Fox Run');
  const g = await S(page, (S) => {
    const x = S.game();
    const count = (c) => x.rooms.reduce((n, r) => n + r.rows.reduce((m, row) => m + [...row].filter((ch) => ch === c).length, 0), 0);
    return { name: x.name, kind: x.kind, rooms: x.rooms.length, sprites: x.sprites.length, npcs: x.npcs.map((n) => [n.name, n.lines.length]), quests: x.quests.length, saves: count('V'), starts: count('P'), tiles: x.tiles.length };
  });
  check(g.kind === 'platformer' && g.rooms >= 1 && g.sprites >= 1 && g.npcs.length === 1 && g.npcs[0][0] === 'Old Badger' && g.npcs[0][1] === 2 && g.quests === 1 && g.saves >= 1 && g.starts >= 1 && g.tiles === 0, `(m) it has a room, a sprite, a person who talks, one quest, a save point and none of its own tiles: ${JSON.stringify(g)}`);
  check(await page.locator('#pg-gamestudio .stTitle').textContent().then((t) => t === 'Fox Run'), '(m) the studio is open on it, to edit');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/gs-fox.png` });
  // it is in the library, and plays from the ARCADE
  await page.evaluate(() => (location.hash = 'arcade'));
  await page.waitForSelector('#pg-arcade .arcmy', { timeout: 10000 });
  const mine = await page.$$eval('#pg-arcade .arcmy', (c) => c.map((x) => ({ t: x.querySelector('.arctitle')?.textContent, btns: [...x.querySelectorAll('button')].map((b) => b.textContent) })));
  check(mine.length === 1 && /Fox Run/.test(mine[0].t) && mine[0].btns.join() === 'PLAY,EDIT', `(m) the ARCADE's MY GAMES row lists Fox Run with PLAY and EDIT: ${JSON.stringify(mine)}`);
  await click(page, '#pg-arcade .arcmy .arcact.play');
  check(await until(page, () => document.querySelector('.g2ui .g2btn[data-id="play"], .g2ui .g2btn[data-id="new-game"], .g2ui .g2btn[data-id="continue"]'), null, 20000), '(m) PLAY from the ARCADE opens the game\'s own menu: it plays');
  await page.evaluate(() => [...document.querySelectorAll('.g2menu .g2btns button')].find((b) => /Quit/.test(b.textContent))?.click());
  // the open game: "make the first room wider" through ASK GHOSTY is a marked change; REJECT leaves it, ACCEPT resizes the room as one undo step
  await click(page, '#pg-arcade .arcmy .arcact.edit');
  await until(page, () => location.hash.startsWith('#gamestudio') && document.querySelector('#pg-gamestudio .stPills'), null, 15000);
  const wide0 = await S(page, (S) => [S.game().rooms[0].w, S.undoDepth()]);
  const ask = async () => {
    await page.fill('input[aria-label="What Ghosty should change in the game"]', 'make the first room wider');
    await page.locator('#pg-gamestudio .gkask button').filter({ hasText: /ask ghosty/i }).click();
  };
  await ask();
  check(await until(page, () => document.querySelectorAll('#pg-gamestudio .gkprop').length === 1, null, 25000), '(m) "make the first room wider" shows one marked change');
  check((await S(page, (S) => [S.game().rooms[0].w, S.undoDepth()])).join() === wide0.join() && new RegExp(`from ${wide0[0]} × \\d+ to ${wide0[0] + 8} × \\d+ tiles`).test(await page.locator('#pg-gamestudio .gkprop .gkline').first().textContent()), `(m) nothing is applied yet, and it says ${wide0[0]} to ${wide0[0] + 8} tiles`);
  await page.locator('#pg-gamestudio .gkprop button').filter({ hasText: /^reject$/i }).click();
  check((await page.locator('#pg-gamestudio .gkprop').count()) === 0 && (await S(page, (S) => S.game().rooms[0].w)) === wide0[0], '(m) REJECT leaves the room as it was');
  await ask();
  await until(page, () => document.querySelectorAll('#pg-gamestudio .gkprop').length === 1, null, 25000);
  await page.locator('#pg-gamestudio .gkprop button').filter({ hasText: /^accept$/i }).click();
  check(await until(page, (w) => window.__ghostyStudio.game().rooms[0].w === w, wide0[0] + 8, 8000), `(m) ACCEPT makes the room ${wide0[0] + 8} tiles wide`);
  check((await S(page, (S) => S.undoDepth())) === wide0[1] + 1, '(m) it is one undo step');
  check(errors.length === 0, `(m) no page error${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}
console.log(`\nbenchmark: ${times.join(' · ')}`);
await browser.close();
if (problems.length) {
  console.log(`\ngame studio spec: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('game studio spec: OK — a game made as he would in an afternoon (an adventure, a third room, a door, a tile, a walk frame, a person with a shop, a quest with a chest), played through to its end by scripted inputs, saved and continued after a reload, shared and read back, exported as an app whose page runs on its own, and listed in the arcade; every control 44 pt at both widths');
