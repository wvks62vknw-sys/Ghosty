// THE HALF-DONE ONES, FINISHED (planlane2:fixes): four things the last round left half done.
//  1. HOUSE SCRIPTS ASK FIRST: a Home Assistant script runs only after one confirm, every time ("Run Warm the house? I can’t see what a
//     script does, so I ask first."), on the screen and from the chat; a scene keeps its own rule (one tap, unless it sets the guarded set).
//  2. FOLLOW AND UNFOLLOW FROM THE SCREEN (plan.u13): SOCIAL's FOLLOW OR UNFOLLOW box makes a follow (or unfollow) DRAFT only (POST
//     /social/draft with kind and who); it waits in the queue for his APPROVE like a post; nothing is ever approved from here.
//  3. EMAIL TEST (plan.u14): LINKS → EMAIL's TEST asks only the brain's /email/test; a fail is said in his words (never the server's
//     text) and kept like the other checks; a pass clears it; a mail server out of reach is never kept as "not working".
//  4. ONE HEALTH LINE on LINKS: everything he linked is fine, or the one thing to fix first, from the very rows (SHOW ME goes there).
// His Home Assistant, his accounts and his mail are stood in by page.route on the phone's own calls. At 440 × 956 and 390 × 844 at BODY
// 21; the follow box and the health line in all seven looks.
import { openSection } from '../nav.mjs';

const MIN = 60_000;
const ADDRESS = 'spec.owner@gmail.com';
const json = (r, o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });
/** (the real condition, polled: never a fixed sleep) */
const until = async (fn, ms = 8000) => {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await new Promise((r) => setTimeout(r, 100))) if (await fn()) return true;
  return false;
};

function house(now) {
  const at = (m) => now - m * MIN;
  return [
    { id: 'light.hall_light', domain: 'light', name: 'Hall light', area: 'Hall', state: 'on', changed: at(40), brightness: 80, dimmable: true },
    { id: 'lock.front_door', domain: 'lock', name: 'Front door', area: 'Hall', state: 'locked', changed: at(600), guarded: true },
    { id: 'scene.movie_night', domain: 'scene', name: 'Movie night', area: '', state: 'unknown', changed: at(3000), members: ['light.hall_light'] },
    { id: 'scene.goodnight', domain: 'scene', name: 'Goodnight', area: '', state: 'unknown', changed: at(3000), members: ['light.hall_light', 'lock.front_door'], guarded: true },
    // (as the brain sends a script now: guarded; the phone asks by its kind as well, so an older brain's answer asks too)
    { id: 'script.warm_the_house', domain: 'script', name: 'Warm the house', area: '', state: 'off', changed: at(3000) },
  ];
}
async function standInHouse(page) {
  const box = { entities: house(Date.now()), calls: [] };
  await page.route(/\/api\/house(\?|$|\/)/, async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (url.pathname === '/api/house' && req.method() === 'GET') return json(r, { linked: true, entities: box.entities, line: '1 light on', marked: [], at: Date.now() });
    if (url.pathname === '/api/house/act' && req.method() === 'POST') {
      const b = JSON.parse(req.postData() ?? '{}');
      box.calls.push(b);
      const e = box.entities.find((x) => x.id === b.entity);
      // the brain's own rule, stood in: the guarded set and every script only from his tap with a confirm
      if ((e?.guarded || e?.domain === 'script') && !(b.origin === 'tap' && b.confirm)) return json(r, { ok: false, needs: 'confirm', text: `The ${e.name} needs your own tap, with a confirm.` });
      return json(r, { ok: true, text: `Done: the ${e?.name ?? b.entity} has run.`, entity: b.entity });
    }
    return r.fallback();
  });
  return box;
}

const ACCOUNTS = [
  { id: 'bluesky', name: 'Bluesky', who: 'spec.bsky.social', max: 300, follows: true },
  { id: 'mastodon', name: 'Mastodon', who: '@spec@mastodon.social', max: 500, follows: true },
  { id: 'discord', name: 'Discord', who: 'Spec bot in Spec server', max: 2000, follows: false },
  { id: 'channel', name: 'your Telegram channel', who: null, max: 4096, follows: false },
];
async function standInSocial(page, o = {}) {
  const s = { asked: [], bodies: [], drafts: [], accounts: o.accounts ?? ACCOUNTS, offline: false };
  let n = 0;
  await page.route(/\/api\/social(\/|\?|$)/, async (r) => {
    const u = new URL(r.request().url());
    const m = r.request().method();
    s.asked.push(`${m} ${u.pathname}`);
    if (s.offline) return r.abort('internetdisconnected');
    if (u.pathname === '/api/social' && m === 'GET') return json(r, { accounts: s.accounts, drafts: s.drafts, sent: [] });
    if (u.pathname === '/api/social/draft') {
      const b = JSON.parse(r.request().postData() ?? '{}');
      s.bodies.push(b);
      if (s.hold) await s.hold;
      const d = { id: `fol${++n}`, account: b.account, kind: b.kind ?? 'post', text: b.text ?? '', ...(b.who ? { who: b.who } : {}), state: 'waiting', at: Date.now() + n, expires: Date.now() + 86400_000, from: 'phone' };
      s.drafts.push(d);
      return json(r, { draft: d });
    }
    return json(r, { error: 'not in this spec' }, 500);
  });
  return s;
}

export async function run(H) {
  const { check, log, RAW } = H;

  // ---- 1. the pure words and rules, from the very files the page and the brain are built from
  const S = await H.pure('packages/shared/src/house.ts');
  const script = { id: 'script.bedtime', domain: 'script', name: 'Bedtime' };
  check(S.isGuarded(script) === true && S.asksFirst({ domain: 'script' }) && !S.asksFirst({ domain: 'scene' }) && S.asksFirst({ domain: 'scene', guarded: true }), '[house rules] every script asks first; a scene only when it sets the guarded set');
  const a = S.scriptAsk('Bedtime');
  check(`${a.head} ${a.line}` === 'Run Bedtime? I can’t see what a script does, so I ask first.', `[house words] the one confirm: ${a.head} ${a.line}`);
  const chatV = S.policy(script, 'turn_on', { origin: 'chat' });
  const tapV = S.policy(script, 'turn_on', { origin: 'tap' });
  const jobV = S.policy(script, 'turn_on', { origin: 'job' });
  const yesV = S.policy(script, 'turn_on', { origin: 'tap', confirm: true });
  check(!chatV.ok && chatV.needs === 'confirm' && !tapV.ok && tapV.needs === 'confirm' && !jobV.ok && !jobV.needs && yesV.ok, `[house rules] the brain runs a script only on his tap with a confirm, never from words or a job: ${JSON.stringify([chatV, tapV, jobV, yesV])}`);
  check(/never runs your script “Bedtime”/.test(jobV.why) && /can’t see what a script does/.test(chatV.why), `[house rules] each refusal says why: ${jobV.why} | ${chatV.why}`);
  check(S.policy({ id: 'scene.movie', domain: 'scene', name: 'Movie', members: ['light.a'] }, 'turn_on', { origin: 'chat', all: [{ id: 'light.a', domain: 'light' }] }).ok, '[house rules] a plain scene still runs from his words');
  const SW = await H.pure('apps/web/src/features/social/words.ts');
  check(/^Write their handle first, like @sam@mastodon\.social/.test(SW.whoProblem('  ', 'mastodon')) && /^That is not one handle/.test(SW.whoProblem('sam smith', 'bluesky')) && SW.whoProblem('@sam.bsky.social', 'bluesky') === '', '[follow words] the handle checked before the brain is asked');
  check(SW.followMade('unfollow', '@ann@toot.example', 'Mastodon') === 'Draft made: unfollow @ann@toot.example on Mastodon. It waits above for your APPROVE; nothing happens until you tap it.', `[follow words] made: ${SW.followMade('unfollow', '@ann@toot.example', 'Mastodon')}`);
  const W = await H.pure('apps/web/src/features/links/words.ts');
  const rows = (...st) => st.map(([name, state]) => ({ name, panel: name.toUpperCase(), state }));
  const h1 = W.healthWords(rows(['your email', 'linked'], ['Spotify', 'failing'], ['Telegram', 'waiting'], ['GitHub', 'broken']));
  check(h1.kind === 'fix' && h1.panel === 'SPOTIFY' && h1.line === 'Fix Spotify first: it is linked, but not working. The reason and the next step are in its panel.', `[health] the first linked-but-not-working row first: ${JSON.stringify(h1)}`);
  const h2 = W.healthWords(rows(['your email', 'linked'], ['Telegram', 'waiting'], ['GitHub', 'broken']));
  check(h2.panel === 'GITHUB' && /^Fix GitHub first: it is not working/.test(h2.line), `[health] then a row not working: ${JSON.stringify(h2)}`);
  check(W.healthWords(rows(['your email', 'linked'], ['Telegram', 'waiting'])).line === 'Finish Telegram first: it has one step left.', '[health] then one step left');
  check(W.healthWords(rows(['your email', 'linked'], ['Spotify', 'linked'], ['GitHub', 'not'])).line === 'Everything you linked is fine: all 2 work.', `[health] all fine: ${W.healthWords(rows(['your email', 'linked'], ['Spotify', 'linked'], ['GitHub', 'not'])).line}`);
  check(W.healthWords(rows(['your email', 'not'])).kind === 'none' && W.healthWords(rows(['your email', 'checking'])).kind === 'checking' && /can’t reach my brain/.test(W.healthWords(rows(['your email', 'offline'])).line), '[health] nothing linked, checking and the brain out of reach each said');
  const whys = ['signin', 'imap', 'servers', 'outlook', 'unreached', 'busy', 'paused', 'not', 'saved', 'other', undefined].map((x) => W.emailTestWhy(x));
  check(whys.every((x) => x.length > 20 && !RAW.test(x) && !/NO \[|AUTHENTICATIONFAILED|imap\.gmail|\d{3} /.test(x)), `[email test] each reason in his words: ${whys.join(' | ')}`);
  check(W.emailTestKept('signin') && W.emailTestKept('imap') && !W.emailTestKept('unreached') && !W.emailTestKept('busy') && !W.emailTestKept('paused'), '[email test] a server out of reach, one asking me to wait (or a paused brain) is never kept as not working');
  check(W.emailTestWhy('busy') === 'Your mail server asked me to wait. Nothing has changed: tap TEST again in a minute.', `[email test] a server asking me to wait: ${W.emailTestWhy('busy')}`);
  log('fixes: pure rules and words');

  // ---- 2. HOUSE SCRIPTS ASK FIRST, at both sizes, BODY 21 (the chat at 440)
  for (const vp of [H.PHONE, H.PHONE2]) {
    const T = `[house ${vp.width}]`;
    const { ctx, page } = await H.phone(vp, 'scan', {}, 21);
    const box = await standInHouse(page);
    await H.open(page, 'house');
    check(await page.waitForSelector('#pg-house .housescene[data-entity="script.warm_the_house"]', { timeout: 20000 }).then(() => true, () => false), `${T} the script is on the scenes row`);
    const lab = await page.getAttribute('#pg-house .housescene[data-entity="script.warm_the_house"]', 'aria-label');
    check(lab === 'Run Warm the house (asks your confirm)', `${T} the script's key says it asks: ${lab}`);
    // a plain scene: one tap, no sheet
    await page.click('#pg-house .housescene[data-entity="scene.movie_night"]');
    check(await until(() => box.calls.some((c) => c.entity === 'scene.movie_night')), `${T} Movie night runs on one tap: ${JSON.stringify(box.calls)}`);
    check(!(await page.$('.confirm.sure')), `${T} and asks nothing`);
    box.calls.length = 0;
    // the script: the sheet first, nothing asked of the house; NO leaves it alone
    await page.click('#pg-house .housescene[data-entity="script.warm_the_house"]');
    const up = await page.waitForSelector('.confirm.sure', { timeout: 5000 }).then(() => true, () => false);
    const sheet = await page.evaluate(() => `${[...document.querySelectorAll('body *')].some((e) => !e.children.length && e.textContent.trim() === 'Run Warm the house?') ? 'Run Warm the house? ' : ''}${document.querySelector('.confirm.sure')?.textContent ?? ''}`);
    check(up && /^Run Warm the house\? I can’t see what a script does, so I ask first\./.test(sheet) && box.calls.length === 0, `${T} the script asks first, and nothing has run: ${sheet.slice(0, 160)} · ${JSON.stringify(box.calls)}`);
    const f = await H.fit(page, '.confirm.sure');
    check(!f.small.length && !f.cut.length, `${T} the confirm fits at BODY 21: ${JSON.stringify(f)}`);
    await page.screenshot({ path: `${H.out}/planlane2-fixes-script-${vp.width}.png` });
    await page.keyboard.press('Escape');
    await page.waitForSelector('.confirm.sure', { state: 'detached', timeout: 5000 }).catch(() => page.getByRole('button', { name: /^(no|cancel|not now|keep)/i }).first().click().catch(() => undefined));
    check(box.calls.length === 0, `${T} turned down, the script never runs: ${JSON.stringify(box.calls)}`);
    // asked again, RUN IT: one call, with his confirm
    await page.click('#pg-house .housescene[data-entity="script.warm_the_house"]');
    await page.waitForSelector('.confirm.sure', { timeout: 5000 }).catch(() => undefined);
    await page.getByRole('button', { name: /^run it$/i }).click({ timeout: 5000 }).catch(() => check(false, `${T} no RUN IT key`));
    check(await until(() => box.calls.length >= 1), `${T} confirmed, the script runs`);
    check(box.calls.length === 1 && box.calls[0].entity === 'script.warm_the_house' && box.calls[0].confirm === true && box.calls[0].origin === 'tap', `${T} once, with his confirm: ${JSON.stringify(box.calls)}`);
    const fit = await H.fit(page, '#pg-house');
    check(!fit.small.length && !fit.sideways && !fit.cut.length, `${T} fit: ${JSON.stringify(fit)}`);
    check(/A script always asks first/.test(await page.textContent('#pg-house .housescenenote').catch(() => '')), `${T} the note under the scenes says scripts ask`);
    if (vp.width === 440) {
      box.calls.length = 0;
      const r = await H.ask(page, 'run warm the house', /Warm the house/);
      check(r.ok && /Run Warm the house\? I can’t see what a script does, so I ask first\./.test(r.text) && /Tap RUN WARM THE HOUSE, then RUN IT, and it runs\./.test(r.text) && !/say yes/i.test(r.text) && box.calls.length === 0, `${T} chat "run warm the house" asks first, names the real keys and runs nothing: ${r.text.slice(-160)} · ${JSON.stringify(box.calls)}`);
      // (the reply's own key, found by its words and tapped: the last one in the log)
      const tapped = await page.waitForFunction(() => {
        const b = [...document.querySelectorAll('#pg-core button')].filter((x) => /^run warm the house$/i.test((x.textContent ?? '').trim())).at(-1);
        if (!b) return false;
        b.click();
        return true;
      }, null, { timeout: 8000 }).then(() => true, () => false);
      if (!tapped) check(false, `${T} no RUN WARM THE HOUSE key in the reply: ${await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg')].slice(-1).map((m) => `${m.textContent.slice(0, 200)} KEYS ${[...m.querySelectorAll('button')].map((b) => `${b.className}:${b.textContent}`).join(', ')}`).join(' || '))}`);
      check(await page.waitForSelector('.confirm.sure', { timeout: 5000 }).then(() => true, () => false) && box.calls.length === 0, `${T} the reply's key brings the one confirm`);
      await page.getByRole('button', { name: /^run it$/i }).click({ timeout: 5000 }).catch(() => undefined);
      check(await until(() => box.calls.length >= 1) && box.calls[0].confirm === true && box.calls[0].entity === 'script.warm_the_house', `${T} confirmed from the chat, it runs once: ${JSON.stringify(box.calls)}`);
      box.calls.length = 0;
      const m = await H.ask(page, 'run movie night', /Movie night/);
      check(m.ok && box.calls.some((c) => c.entity === 'scene.movie_night' && c.origin === 'chat'), `${T} a plain scene still runs from his words: ${m.text.slice(-100)}`);
    }
    await ctx.close();
  }
  log('fixes: scripts ask first');

  // ---- 3. FOLLOW OR UNFOLLOW on SOCIAL, at both sizes, BODY 21
  for (const vp of [H.PHONE, H.PHONE2]) {
    const T = `[follow ${vp.width}]`;
    const { ctx, page } = await H.phone(vp, 'scan', {}, 21);
    const s = await standInSocial(page);
    await H.open(page, 'social');
    check(await page.waitForSelector('#pg-social .socfollow input.socwho', { timeout: 15000 }).then(() => true, () => false), `${T} the FOLLOW box is drawn`);
    const picks = await page.$$eval('#pg-social .socfollow [role=group] button', (b) => b.map((x) => `${x.textContent.trim()}:${x.getAttribute('aria-pressed')}`));
    check(picks.join(',') === 'Bluesky:true,Mastodon:false', `${T} only his linked accounts that have follows, the first chosen: ${picks.join(',')}`);
    check((await page.getAttribute('#pg-social .socfollow input.socwho', 'placeholder')) === 'e.g. @sam.bsky.social', `${T} the example is Bluesky's`);
    // FOLLOW with no handle: said, nothing asked
    await page.click('#pg-social .socfollow button:has-text("FOLLOW")');
    check(/^Write their handle first/.test(await page.textContent('#pg-social .socfmsg')) && !s.bodies.length, `${T} no handle: said, and no draft asked for`);
    await page.click('#pg-social .socfollow [role=group] button:has-text("Mastodon")');
    check((await page.getAttribute('#pg-social .socfollow input.socwho', 'placeholder')) === 'e.g. @sam@mastodon.social', `${T} Mastodon chosen, its own example`);
    await page.fill('#pg-social .socfollow input.socwho', '@ann@toot.example');
    await page.click('#pg-social .socfollow button:has-text("UNFOLLOW")');
    check(await until(() => s.bodies.length === 1), `${T} UNFOLLOW asks for one draft`);
    check(JSON.stringify(s.bodies[0]) === JSON.stringify({ account: 'mastodon', kind: 'unfollow', who: '@ann@toot.example', text: '', from: 'phone' }), `${T} an unfollow draft for Mastodon: ${JSON.stringify(s.bodies[0])}`);
    check(await until(async () => /^Draft made: unfollow @ann@toot\.example on Mastodon\./.test(await page.textContent('#pg-social .socfmsg'))), `${T} said: ${await page.textContent('#pg-social .socfmsg')}`);
    // it waits in the queue above, with APPROVE; nothing was approved
    check(await until(async () => /Unfollow @ann@toot\.example/.test(await page.textContent('#pg-social .socq').catch(() => ''))), `${T} the draft waits in the queue`);
    check(!s.asked.some((x) => /approve/.test(x)) && (await page.locator('#pg-social .socq button', { hasText: /^APPROVE$/ }).count()) >= 1, `${T} with APPROVE under his thumb, never approved from here: ${s.asked.join(', ')}`);
    check((await page.inputValue('#pg-social .socfollow input.socwho')) === '', `${T} the box is cleared for the next one`);
    // FOLLOW on Bluesky, kept on the phone while he types (a reload keeps the account and the handle; once, at 440)
    await page.click('#pg-social .socfollow [role=group] button:has-text("Bluesky")');
    await page.fill('#pg-social .socfollow input.socwho', '@nasa.gov');
    if (vp.width === 440) {
      await page.reload();
      await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
      await H.open(page, 'social');
      await page.waitForSelector('#pg-social .socfollow input.socwho', { timeout: 15000 }).catch(() => undefined);
      check((await page.inputValue('#pg-social .socfollow input.socwho')) === '@nasa.gov' && (await page.getAttribute('#pg-social .socfollow [role=group] button:has-text("Bluesky")', 'aria-pressed')) === 'true', `${T} his handle and account kept on the phone through a reload`);
    }
    await page.click('#pg-social .socfollow button:has-text("FOLLOW")');
    check(await until(() => s.bodies.length === 2) && s.bodies[1].kind === 'follow' && s.bodies[1].account === 'bluesky' && s.bodies[1].who === '@nasa.gov', `${T} FOLLOW on Bluesky: ${JSON.stringify(s.bodies[1])}`);
    const f = await H.fit(page, '#pg-social');
    check(!f.small.length && !f.sideways && !f.cut.length, `${T} fit: ${JSON.stringify(f)}`);
    check(!RAW.test(await page.textContent('#pg-social .socfollow')), `${T} no raw words`);
    await page.locator('#pg-social .socfollow').screenshot({ path: `${H.out}/planlane2-fixes-follow-${vp.width}.png` }).catch(() => undefined);
    // the brain not answering: said so (once, at 440)
    if (vp.width !== 440) {
      await ctx.close();
      continue;
    }
    s.offline = true;
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
    await H.open(page, 'social');
    check(await until(async () => /can’t reach my brain, so I can’t make a follow draft/.test(await page.textContent('#pg-social .socfollow').catch(() => '')), 15000), `${T} the brain out of reach is said in the box`);
    await ctx.close();
  }
  {
    // only Discord linked: no account with follows, said with the way on
    const { ctx, page } = await H.phone(H.PHONE, 'scan', {}, 21);
    await standInSocial(page, { accounts: ACCOUNTS.map((x) => (x.id === 'discord' ? x : { ...x, who: null })) });
    await H.open(page, 'social');
    check(await until(async () => /Link Bluesky or Mastodon under Accounts first/.test(await page.textContent('#pg-social .socfollow').catch(() => '')), 15000) && !(await page.$('#pg-social .socfollow input.socwho')), '[follow] no account with follows: said, and no box to type in');
    await ctx.close();
  }
  {
    // a slow brain: he leaves the page and comes back while the follow draft is made; the fresh copy keeps FOLLOW off (never twice)
    const { ctx, page } = await H.phone(H.PHONE, 'scan', {}, 21);
    const s = await standInSocial(page);
    let release;
    s.hold = new Promise((ok) => (release = ok));
    await H.open(page, 'social');
    await page.waitForSelector('#pg-social .socfollow input.socwho', { timeout: 15000 }).catch(() => undefined);
    await page.fill('#pg-social .socfollow input.socwho', '@nasa.gov');
    await page.click('#pg-social .socfollow button:has-text("FOLLOW")');
    check(await until(() => s.bodies.length === 1), '[follow slow] one draft asked for');
    await openSection(page, 'social', 'Accounts');
    await openSection(page, 'social', 'Waiting');
    await page.waitForSelector('#pg-social .socfollow input.socwho', { timeout: 15000 }).catch(() => undefined);
    const st = await page.evaluate(() => ({ off: [...document.querySelectorAll('#pg-social .socfollow button')].filter((b) => /^(UN)?FOLLOW$/.test((b.textContent ?? '').trim())).map((b) => b.disabled), msg: document.querySelector('#pg-social .socfmsg')?.textContent ?? '' }));
    check(st.off.length === 2 && st.off.every(Boolean) && st.msg === 'Making the draft…', `[follow slow] the fresh copy keeps FOLLOW and UNFOLLOW off and says it is being made: ${JSON.stringify(st)}`);
    await page.click('#pg-social .socfollow button:has-text("FOLLOW")', { force: true, timeout: 2000 }).catch(() => undefined);
    s.hold = null;
    release();
    check(await until(async () => /^Draft made: follow @nasa\.gov on Bluesky\./.test(await page.textContent('#pg-social .socfmsg').catch(() => ''))), `[follow slow] the live copy says it was made: ${await page.textContent('#pg-social .socfmsg').catch(() => '')}`);
    check((await page.inputValue('#pg-social .socfollow input.socwho')) === '' && s.bodies.length === 1, `[follow slow] the box cleared, one draft only: ${s.bodies.length}`);
    await ctx.close();
  }
  log('fixes: follow from SOCIAL');

  // ---- 4. EMAIL TEST and THE ONE HEALTH LINE on LINKS, at both sizes, BODY 21
  for (const vp of [H.PHONE, H.PHONE2]) {
    const T = `[links ${vp.width}]`;
    const { ctx, page } = await H.phone(vp, 'scan', {}, 21);
    const asked = [];
    let answer = { works: false, why: 'signin', address: ADDRESS };
    await page.route(/\/api\/email\//, (r) => {
      const u = new URL(r.request().url());
      asked.push(`${r.request().method()} ${u.pathname}`);
      if (u.pathname === '/api/email/status') return json(r, { linked: true, address: ADDRESS, server: 'imap.gmail.com' });
      if (u.pathname === '/api/email/test') return answer === 'abort' ? r.abort('internetdisconnected') : json(r, answer);
      return json(r, { error: 'not in this spec' }, 500);
    });
    await H.open(page, 'links');
    await openSection(page, 'links', 'Accounts');
    await page.waitForFunction(() => !/^Checking/.test(document.querySelector('#pg-links .lkhealth')?.textContent ?? 'Checking'), null, { timeout: 15000 }).catch(() => undefined);
    const panelOf = (title) => page.evaluate((title) => {
      const p = [...document.querySelectorAll('#pg-links .pn')].find((x) => (x.querySelector('h3 .ptitle')?.textContent ?? '').startsWith(title));
      return p ? { status: p.querySelector('h3 small')?.textContent ?? '', body: (p.querySelector('.bd')?.textContent ?? '').replace(/\s+/g, ' ').trim(), keys: [...p.querySelectorAll('.bd button')].map((b) => b.textContent.trim()) } : null;
    }, title);
    const healthNow = () => page.evaluate(() => {
      const e = document.querySelector('#pg-links .lkhealth');
      const b = e?.querySelector('button');
      return { kind: e?.dataset.health ?? '', line: e?.querySelector('.lkhealthline')?.textContent ?? '', go: !!b && !b.hidden && !!b.offsetParent };
    });
    let e = await panelOf('EMAIL');
    check(e?.status === `Linked as ${ADDRESS}` && e.keys.includes('TEST'), `${T} EMAIL linked, with TEST: ${JSON.stringify(e)}`);
    // (a row in LINKS' list: one tap opens it as its own page on a phone)
    await page.locator('#pg-links .pn > h3', { hasText: 'EMAIL' }).first().click().catch(() => undefined);
    await page.waitForFunction(() => (document.querySelector('#pg-links .pn.pushed h3 .ptitle')?.textContent ?? '').startsWith('EMAIL'), null, { timeout: 8000 }).catch(() => undefined);
    // TEST: the brain says his mail turned the sign-in down → linked, but not working, in his words, kept; the health line names email first
    await page.locator('#pg-links .pn', { hasText: 'EMAIL' }).first().locator('button', { hasText: /^TEST$/ }).click({ timeout: 5000 }).catch(() => check(false, `${T} no TEST key on EMAIL`));
    check(await until(async () => (await panelOf('EMAIL'))?.status === 'Linked, but not working'), `${T} a failed TEST: linked, but not working`);
    e = await panelOf('EMAIL');
    check(/turned down the address or the app password/.test(e.body) && /Tested just now: it didn’t work\./.test(e.body) && !RAW.test(e.body), `${T} the reason in his words, and the check's line: ${e.body.slice(0, 240)}`);
    check(asked.includes('POST /api/email/test') && asked.every((x) => /\/api\/email\/(status|test)$/.test(x)), `${T} TEST asked only the brain's check: ${asked.join(', ')}`);
    let hl = await healthNow();
    check(hl.kind === 'fix' && hl.line === 'Fix your email first: it is linked, but not working. The reason and the next step are in its panel.' && hl.go, `${T} the health line names the one thing to fix first, with SHOW ME: ${JSON.stringify(hl)}`);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.links.checks') ?? '{}'));
    check(kept.email?.ok === false && kept.email.who === ADDRESS, `${T} the failed TEST is kept on the phone, like the other checks: ${JSON.stringify(kept.email)}`);
    const fl = await H.fit(page, '#pg-links');
    check(!fl.small.length && !fl.sideways && !fl.cut.length, `${T} fit: ${JSON.stringify(fl)}`);
    await page.screenshot({ path: `${H.out}/planlane2-fixes-links-${vp.width}.png` });
    // no signal: a toast, never kept as a fail and never clears the last check
    answer = 'abort';
    await page.locator('#pg-links .pn', { hasText: 'EMAIL' }).first().locator('button', { hasText: /^TEST$/ }).click({ timeout: 5000 }).catch(() => undefined);
    check(await until(async () => (await panelOf('EMAIL'))?.status === 'Linked, but not working'), `${T} with no signal the last check stands`);
    // the mail server out of reach: said, not kept
    answer = { works: true, address: ADDRESS };
    await page.locator('#pg-links .pn', { hasText: 'EMAIL' }).first().locator('button', { hasText: /^TEST$/ }).click({ timeout: 5000 }).catch(() => undefined);
    check(await until(async () => (await panelOf('EMAIL'))?.status === `Linked as ${ADDRESS}`), `${T} a TEST that passes clears it`);
    e = await panelOf('EMAIL');
    check(/Tested just now: it works\./.test(e.body), `${T} and says it works: ${e.body.slice(0, 200)}`);
    // the health line, from the very rows: email no longer named; whatever it names, that panel's own line agrees
    hl = await healthNow();
    const named = /^(?:Fix|Finish) (.+?) first/.exec(hl.line)?.[1];
    const rowsSay = await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn')].map((p) => ({ t: p.querySelector('h3 .ptitle')?.textContent ?? '', s: p.querySelector('h3 small')?.textContent ?? '' })));
    const bad = rowsSay.filter((r) => /not working|Not working|One step left/i.test(r.s));
    check(!/your email/.test(hl.line) && (hl.kind === 'ok' ? !bad.length : !!named && bad.length > 0), `${T} the health line agrees with the rows: ${JSON.stringify(hl)} · ${JSON.stringify(bad)}`);
    if (hl.go) {
      await page.locator('#pg-links .lkhealth button').click();
      const shown = await until(() => page.evaluate(() => {
        const t = document.querySelector('#pg-links .lkhealth .lkhealthline')?.textContent ?? '';
        return [...document.querySelectorAll('#pg-links .pn')].some((p) => p.offsetParent && t.length > 0 && p.getBoundingClientRect().height > 0 && /not working|Not working|One step left/i.test(p.querySelector('h3 small')?.textContent ?? ''));
      }));
      check(shown, `${T} SHOW ME brings that panel into view`);
    }
    await ctx.close();
  }
  log('fixes: email TEST and the health line');

  // ---- 5. the seven looks: the FOLLOW box and the health line drawn right, nothing sideways, every key 44 pt
  {
    const { ctx, page } = await H.phone(H.PHONE, 'scan', {}, 21);
    await standInSocial(page);
    for (const w of H.WORLDS) {
      await page.evaluate((w) => {
        const s = JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}');
        s.look = { ...(s.look ?? {}), world: w };
        localStorage.setItem('ghosty.settings', JSON.stringify(s));
      }, w);
      await page.reload();
      await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
      await H.open(page, 'social');
      await page.waitForSelector('#pg-social .socfollow input.socwho', { timeout: 15000 }).catch(() => check(false, `[looks ${w}] no FOLLOW box`));
      const f = await H.fit(page, '#pg-social .socfollow');
      const vis = await page.evaluate(() => {
        const b = document.querySelector('#pg-social .socfollow');
        const cs = b && getComputedStyle(b.querySelector('b') ?? b);
        return !!b && b.getBoundingClientRect().height > 40 && cs.color !== cs.backgroundColor;
      });
      check(vis && !f.small.length && !f.sideways && !f.cut.length, `[looks ${w}] FOLLOW box: ${JSON.stringify(f)}`);
      await H.open(page, 'links');
      await page.waitForSelector('#pg-links .lkhealth', { timeout: 15000 }).catch(() => check(false, `[looks ${w}] no health line`));
      const g = await H.fit(page, '#pg-links .lkhealth');
      const hv = await page.evaluate(() => {
        const e = document.querySelector('#pg-links .lkhealth');
        return !!e && e.getBoundingClientRect().width > 100 && (e.textContent ?? '').length > 10;
      });
      check(hv && !g.small.length && !g.sideways && !g.cut.length, `[looks ${w}] health line: ${JSON.stringify(g)}`);
    }
    await ctx.close();
  }
  log('fixes: seven looks');
}
