// LINKS (FINAL ROUND, planlane): everything Ghosty is plugged into, as one connections screen.
//  - the pure words: each state said one way (not linked, linked as …, linked but not working, one step left, checking, paused, the brain
//    out of reach), the top line counted from the very rows, "1 model ready", the last check's line, and email's and Spotify's reasons
//    in his words (never the server's raw text);
//  - the screen: the top line agrees with the panels' own lights; no "1 models"; an email whose check failed is "Linked, but not working"
//    with the reason and CHANGE ACCOUNT, never "Linked"; the brain out of reach says so with TRY AGAIN (never the link form, never an
//    empty panel); Spotify's TEST asks only the brain's /spotify/test and keeps what it said across a reload; a SEND TEST the brain could
//    not take is never said as "no device has notifications on";
//  - at 440 × 956 and 390 × 844 at BODY 21, and in all seven looks: every key 44 pt, nothing sideways, no word cut.
// The brain's answers are stood in with page.route, so each state is drawn on purpose.
import { openSection } from '../nav.mjs';

const ADDRESS = 'spec.owner@gmail.com';
const json = (r, o, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(o) });

/** Open LINKS on `section` and wait until no connection there still says "Checking…". */
async function openLinks(H, page, section = 'Accounts') {
  await H.open(page, 'links');
  await openSection(page, 'links', section);
  await page.waitForFunction(() => {
    const t = [...document.querySelectorAll('#pg-links .pn > h3 small')].map((s) => s.textContent ?? '');
    return t.length && !t.some((x) => x === 'Checking…');
  }, null, { timeout: 15000 }).catch(() => undefined);
}
/** One panel's status line, its notes and its keys (`title`: the start of its title). */
const panelOf = (page, title) =>
  page.evaluate((title) => {
    const p = [...document.querySelectorAll('#pg-links .pn')].find((x) => (x.querySelector('h3 .ptitle')?.textContent ?? '').startsWith(title));
    if (!p) return null;
    return {
      status: p.querySelector('h3 small')?.textContent ?? '',
      light: p.querySelector('h3 .light')?.className ?? '',
      body: (p.querySelector('.bd')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      keys: [...p.querySelectorAll('.bd button')].map((b) => (b.textContent ?? '').trim()),
    };
  }, title);
/** Open a panel that is a row in LINKS' list (one tap opens it as its own page on a phone). */
async function pushPanel(page, title) {
  const open = await page.evaluate((title) => !!document.querySelector('#pg-links .pn.pushed') && (document.querySelector('#pg-links .pn.pushed h3 .ptitle')?.textContent ?? '').startsWith(title), title);
  if (open) return;
  await page.locator('#pg-links .pn > h3', { hasText: title }).first().click().catch(() => undefined);
  // (the real condition: that panel pushed open, within 8 s)
  await page.waitForFunction((title) => (document.querySelector('#pg-links .pn.pushed h3 .ptitle')?.textContent ?? '').startsWith(title), title, { timeout: 8000 }).catch(() => undefined);
}
async function back(page) {
  await page.evaluate(() => (location.hash = 'core'));
  // (the real condition: the chat screen is the one shown)
  await page.waitForFunction(() => document.body.dataset.tab === 'core', null, { timeout: 8000 }).catch(() => undefined);
}

export async function run(H) {
  const { check, log, RAW } = H;
  // ---- the pure words
  const W = await H.pure('apps/web/src/features/links/words.ts');
  {
    check(W.stateTag('not') === 'Not linked' && W.stateTag('linked', ADDRESS) === `Linked as ${ADDRESS}` && W.stateTag('failing') === 'Linked, but not working' && W.stateTag('checking') === 'Checking…', 'each state said one way');
    check(W.stateTag('offline') === 'Can’t reach my brain' && W.stateTag('paused') === 'Not known while paused' && W.stateTag('waiting') === 'One step left', 'the brain out of reach, paused, one step left');
    check(W.stateLight('linked') === 'ok' && W.stateLight('failing') === 'off' && W.stateLight('not') === 'mid', 'the lights: lit, red, amber');
    const rows = [{ id: 'a', state: 'linked' }, { id: 'b', state: 'failing' }, { id: 'c', state: 'not' }, { id: 'd', state: 'not' }, { id: 'e', state: 'waiting' }];
    const hw = W.heroWords(rows);
    check(hw.big === '2 linked' && hw.sub === '1 not working · 1 with one step left · 2 not linked', `the top line counts the rows: ${JSON.stringify(hw)}`);
    check(W.heroWords([{ id: 'a', state: 'not' }]).big === 'Nothing linked yet', 'nothing linked is said so');
    check(W.heroWords([{ id: 'a', state: 'linked' }]).sub === 'Everything here is linked and working.', 'all well is said so');
    check(/can’t reach my brain/i.test(W.heroWords([{ id: 'a', state: 'offline' }]).sub), 'the brain out of reach is said at the top');
    check(W.modelsReady(1) === '1 model ready' && W.modelsReady(3) === '3 models ready' && W.modelsReady(0) === 'No models ready', `never "1 models": ${W.modelsReady(1)}`);
    const now = new Date(2026, 10, 13, 10, 42).getTime();
    check(W.checkLine({ ok: true, at: now - 5000 }, now) === 'Tested just now: it works.', W.checkLine({ ok: true, at: now - 5000 }, now));
    check(W.checkLine({ ok: false, at: now - 3600_000 }, now) === 'Tested at 09:42: it didn’t work.', W.checkLine({ ok: false, at: now - 3600_000 }, now));
    check(/^Tested on Thu,? 12 Nov at 10:42: it works\.$/.test(W.checkLine({ ok: true, at: now - 86400_000 }, now)), W.checkLine({ ok: true, at: now - 86400_000 }, now));
    const raw = 'could not connect to imap.gmail.com:993 (TypeError: Network connection lost.). Check the server name.';
    check(/couldn’t reach your mail server/.test(W.emailWhy(raw)) && !/TypeError|993/.test(W.emailWhy(raw)), `email's network failure in his words: ${W.emailWhy(raw)}`);
    check(/app password/.test(W.emailWhy('NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)')) && /CHANGE ACCOUNT/.test(W.emailWhy('')), 'email: a refused password, and the default, each with the one next step');
    check(!/JSON/.test(W.emailWhy('the saved email settings are not valid JSON')), 'email: a developer word never reaches him');
    check(/UNLINK/.test(W.spotifyWhy('signin')) && /TEST again/.test(W.spotifyWhy('reach')) && /in a minute/.test(W.spotifyWhy('busy')), 'Spotify: each reason with its one next step');
    check(/TRY AGAIN/.test(W.OFFLINE_LINE('your email')) && /TRY AGAIN/.test(W.TELEGRAM.offline), 'the brain out of reach always says TRY AGAIN');
    // (fix stage) what was found untrue, now said true
    check(!/still works/.test(W.PAUSED_LINE('email')) && !/still works/.test(W.TELEGRAM.paused) && /Nothing you (linked|paired) is lost/.test(W.PAUSED_LINE('email') + W.TELEGRAM.paused), `paused never promises the link still works: ${W.PAUSED_LINE('email')}`);
    check(!/in a minute/.test(W.emailWhy(raw)) && W.emailUnreached(raw) && !W.emailUnreached('NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)'), 'a mail server out of reach is not kept as failing, and promises no "try again" there is no key for');
    check(W.stateTag('broken') === 'Not working' && W.stateLight('broken') === 'off', 'broken: not working, red');
    const hb = W.heroWords([{ id: 'a', state: 'linked' }, { id: 'b', state: 'broken' }, { id: 'c', state: 'not' }]);
    check(hb.big === '1 linked' && hb.sub === '1 not working · 1 not linked', `blocked notifications or no AI model ready count as not working, never as linked: ${JSON.stringify(hb)}`);
    check(W.stateDial('checking') === '…' && W.stateDial('offline') === '?' && W.stateDial('paused') === '?' && W.stateDial('not') === 'OFF' && W.stateDial('failing') === 'FIX' && W.stateDial('broken') === 'FIX' && W.stateDial('linked') === 'ON', 'the dials say OFF only when not linked');
    const tNet = W.keyWhy('tomtom', 'could not reach the service (TypeError: fetch failed)');
    const t5 = W.keyWhy('tomtom', 'the service answered 503; try again in a minute');
    const tBad = W.keyWhy('tomtom', 'the service says this key is not valid. Copy it again (no spaces).');
    check(!tNet.kept && !t5.kept && tBad.kept && /TomTom says this key is not valid/.test(tBad.why), `TomTom: only a key TomTom calls not valid is kept as failing: ${JSON.stringify([tNet, t5, tBad])}`);
    check([tNet, t5, tBad].every((w) => !RAW.test(w.why) && !/TypeError|fetch failed|503|\.\./.test(w.why)), `TomTom's reasons in his words: ${[tNet.why, t5.why, tBad.why].join(' | ')}`);
    const gW = W.keyWhy('github', 'the token can read but not write. It needs "Contents: Read and write".');
    check(gW.kept && /Read and write/.test(gW.why) && W.keyWhy('github', 'GitHub says this token is not valid. Copy it again.').kept && !W.keyWhy('github', 'GitHub answered 502').kept, `GitHub: a token that cannot write is kept as failing: ${gW.why}`);
  }
  log('links: pure words');

  // ---- the screen at both sizes, at BODY 21
  for (const vp of [H.PHONE, H.PHONE2]) {
    const wd = vp.width;
    // 1. the preview's own brain: the top line agrees with the panels' lights, and nothing says "1 models"
    {
      const { ctx, page } = await H.phone(vp, 'scan', {}, 21);
      await openLinks(H, page, 'Services');
      const seen = await page.evaluate(() => {
        const mine = ['EMAIL', 'SPOTIFY', 'TELEGRAM', 'PHONE', 'LIVE TRAFFIC', 'AI BRAIN', 'GITHUB'];
        const all = [...document.querySelectorAll('#pg-links .pn')].filter((p) => !/^NOTIFICATIONS$/.test(p.querySelector('h3 .ptitle')?.textContent ?? ''));
        const n = all.filter((p) => mine.some((m) => (p.querySelector('h3 .ptitle')?.textContent ?? '').startsWith(m)) && !/CHANNEL/.test(p.querySelector('h3 .ptitle')?.textContent ?? '')).length;
        // every row on the screen counts, his social accounts and Home Assistant too (their own words: LINKED)
        const st = all.map((p) => ({ t: p.querySelector('h3 small')?.textContent ?? '', l: p.querySelector('h3 .light')?.className ?? '' }));
        return { n, rows: all.length, linked: st.filter((s) => /^Linked|^LINKED|^Notifications on$|model/.test(s.t) && !/^No models/.test(s.t)).length, st, big: document.querySelector('#pg-links .bigv')?.textContent ?? '', sub: document.querySelector('#pg-links .hero .sub')?.textContent ?? '' };
      });
      check(seen.n === 7, `[${wd}] the seven connections are drawn: ${seen.n}`);
      check(seen.big === (seen.linked ? `${seen.linked} linked` : 'Nothing linked yet'), `[${wd}] the top line agrees with the rows: "${seen.big}" for ${JSON.stringify(seen.st)}`);
      check(!seen.st.some((s) => /\b1 models\b|^OFF$|^LIVE$|ONLINE/.test(s.t)), `[${wd}] the rows say their state in his words: ${seen.st.map((s) => s.t).join(' | ')}`);
      check(!RAW.test(seen.sub) && seen.sub.length > 5, `[${wd}] the line under it: ${seen.sub}`);
      for (const s of ['Accounts', 'This phone', 'Services']) {
        await openSection(page, 'links', s);
        const f = await H.fit(page, '#pg-links');
        check(!f.small.length && !f.sideways && !f.cut.length, `[${wd}] LINKS → ${s} fits at BODY 21: ${JSON.stringify(f)}`);
      }
    // 2. an email whose check failed when he linked it: never "Linked"; the reason and CHANGE ACCOUNT; the top line says 1 not working
      await back(page);
      await page.evaluate((a) => localStorage.setItem('ghosty.links.checks', JSON.stringify({ email: { ok: false, at: Date.now() - 30_000, who: a, why: 'Your mail server turned down the address or the app password. Make a new app password, tap CHANGE ACCOUNT and paste it.' } })), ADDRESS);
      await page.route(/\/api\/email\/status/, (r) => json(r, { linked: true, address: ADDRESS, server: 'imap.gmail.com' }));
      await openLinks(H, page, 'Accounts');
      let e = await panelOf(page, 'EMAIL');
      check(e?.status === 'Linked, but not working' && /off/.test(e?.light ?? ''), `[${wd}] a failed check is never "Linked": ${e?.status}`);
      await pushPanel(page, 'EMAIL');
      e = await panelOf(page, 'EMAIL');
      check(/turned down the address or the app password/.test(e?.body ?? '') && /Tested just now: it didn’t work\./.test(e?.body ?? '') && e?.keys.includes('CHANGE ACCOUNT') && e?.keys.includes('UNLINK'), `[${wd}] the reason, the last test and the one next step: ${JSON.stringify(e)}`);
      const sub = await page.textContent('#pg-links .hero .sub');
      check(/1 not working/.test(sub ?? ''), `[${wd}] the top line says 1 not working: ${sub}`);
      const f = await H.fit(page, '#pg-links');
      check(!f.small.length && !f.sideways && !f.cut.length, `[${wd}] EMAIL (not working) fits: ${JSON.stringify(f)}`);
      if (wd === 440) await page.screenshot({ path: `${H.out}/planlane-links-email-failing-${wd}.png` });
      // the saved details the brain cannot use: said in his words, never its developer words
      await back(page);
      await page.unroute(/\/api\/email\/status/);
      await page.route(/\/api\/email\/status/, (r) => json(r, { linked: true, problem: 'the saved email settings are not valid JSON' }));
      await openLinks(H, page, 'Accounts');
      e = await panelOf(page, 'EMAIL');
      check(e?.status === 'Linked, but not working' && !/JSON/.test(e?.body ?? '') && /CHANGE ACCOUNT/.test(e?.body ?? ''), `[${wd}] a problem the brain reports is said in his words: ${JSON.stringify(e)}`);
      await ctx.close();
    }
    // 3. the brain out of reach, on a phone that has never had an answer from it (a phone that had one shows the last answer it kept):
    //    each connection says so with TRY AGAIN; no link form as if not linked; no empty panel
    {
      const { ctx, page } = await H.phone(vp, 'scan', {}, 21);
      await page.route(/\/api\/(email\/status|spotify\/status|telegram\/status|status|push\/devices|push\/test)(\?|$)/, (r) => r.abort('failed'));
      await openLinks(H, page, 'Accounts');
      const e = await panelOf(page, 'EMAIL');
      check(e?.status === 'Can’t reach my brain' && /TRY AGAIN/.test(e?.keys.join(',') ?? '') && !e?.keys.includes('LINK EMAIL'), `[${wd}] EMAIL with the brain out of reach: ${JSON.stringify(e)}`);
      const s = await panelOf(page, 'SPOTIFY');
      check(s?.status === 'Can’t reach my brain' && !s?.keys.includes('LINK SPOTIFY'), `[${wd}] SPOTIFY with the brain out of reach: ${JSON.stringify(s)}`);
      const big = await page.textContent('#pg-links .hero .sub');
      check(/can’t reach my brain/i.test(big ?? ''), `[${wd}] the top line says the brain is out of reach: ${big}`);
      await openSection(page, 'links', 'Services');
      for (const t of ['GITHUB', 'LIVE TRAFFIC', 'AI BRAIN']) {
        const p = await panelOf(page, t);
        check(p?.status === 'Can’t reach my brain' && /TRY AGAIN/.test(p?.body ?? '') && p.body.length > 20, `[${wd}] ${t} with the brain out of reach is not empty: ${JSON.stringify(p)}`);
      }
      // SEND TEST the brain could not take: never "no device has notifications on"
      await openSection(page, 'links', 'This phone');
      await pushPanel(page, 'PHONE');
      await page.locator('#pg-links button', { hasText: 'SEND TEST' }).first().click({ timeout: 5000 }).catch(() => check(false, `[${wd}] no SEND TEST key`));
      await page.waitForFunction(() => (document.querySelector('#toasts')?.textContent ?? '').length > 5, null, { timeout: 5000 }).catch(() => undefined);
      const toast = (await page.textContent('#toasts').catch(() => '')) ?? '';
      check(toast && !/No device has notifications on/i.test(toast) && !RAW.test(toast), `[${wd}] a test the brain could not take is said as that: ${toast}`);
      const f = await H.fit(page, '#pg-links');
      check(!f.small.length && !f.sideways && !f.cut.length, `[${wd}] LINKS with the brain out of reach fits: ${JSON.stringify(f)}`);
      if (wd === 440) await page.screenshot({ path: `${H.out}/planlane-links-offline-${wd}.png` });
      await ctx.close();
    }
  }
  log('links: the screen at 440 and 390');

  // 4. Spotify's TEST: asks only /spotify/test; a failure is "Linked, but not working" with its one next step, kept across a reload; a pass clears it
  {
    const { ctx, page } = await H.phone(H.PHONE, 'scan', {}, 21);
    const asked = [];
    let works = false;
    await page.route(/\/api\/spotify\//, (r) => {
      const u = new URL(r.request().url());
      asked.push(`${r.request().method()} ${u.pathname}`);
      if (u.pathname.endsWith('/status')) return json(r, { linked: true, name: 'Spec Owner', product: 'premium', clientId: 'abc' });
      if (u.pathname.endsWith('/test')) return json(r, works ? { works: true, name: 'Spec Owner', product: 'premium' } : { works: false, why: 'signin' });
      return json(r, { error: 'not in this spec' }, 500);
    });
    await openLinks(H, page, 'Accounts');
    let s = await panelOf(page, 'SPOTIFY');
    check(s?.status === 'Linked as Spec Owner', `Spotify linked says who: ${s?.status}`);
    await pushPanel(page, 'SPOTIFY');
    await page.locator('#pg-links .pn button', { hasText: /^TEST$/ }).first().click({ timeout: 5000 }).catch(() => check(false, 'no Spotify TEST key'));
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-links .pn')].some((p) => (p.querySelector('h3 .ptitle')?.textContent ?? '').startsWith('SPOTIFY') && p.querySelector('h3 small')?.textContent === 'Linked, but not working'), null, { timeout: 5000 }).catch(() => undefined);
    s = await panelOf(page, 'SPOTIFY');
    check(s?.status === 'Linked, but not working' && /no longer accepts my sign-in/.test(s?.body ?? '') && /Tested just now: it didn’t work\./.test(s?.body ?? ''), `a failed TEST: ${JSON.stringify(s)}`);
    check(asked.includes('POST /api/spotify/test') && asked.every((a) => /\/api\/spotify\/(status|test)$/.test(a)), `TEST asked only the brain's check: ${asked.join(', ')}`);
    const f = await H.fit(page, '#pg-links');
    check(!f.small.length && !f.sideways && !f.cut.length, `SPOTIFY after a failed TEST fits: ${JSON.stringify(f)}`);
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await openLinks(H, page, 'Accounts');
    s = await panelOf(page, 'SPOTIFY');
    check(s?.status === 'Linked, but not working', `the failed TEST is kept on the phone across a reload: ${s?.status}`);
    works = true;
    await pushPanel(page, 'SPOTIFY');
    await page.locator('#pg-links .pn button', { hasText: /^TEST$/ }).first().click({ timeout: 5000 }).catch(() => check(false, 'no Spotify TEST key after a reload'));
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-links .pn')].some((p) => (p.querySelector('h3 .ptitle')?.textContent ?? '').startsWith('SPOTIFY') && p.querySelector('h3 small')?.textContent === 'Linked as Spec Owner'), null, { timeout: 5000 }).catch(() => undefined);
    s = await panelOf(page, 'SPOTIFY');
    check(s?.status === 'Linked as Spec Owner' && /Tested just now: it works\./.test(s?.body ?? ''), `a TEST that passes clears it: ${JSON.stringify(s)}`);
    await page.screenshot({ path: `${H.out}/planlane-links-spotify-440.png` });
    await ctx.close();
  }
  log('links: Spotify TEST');

  // 6. (fix stage) GitHub, Telegram, Spotify, the devices' ✕ and NOTIFICATIONS: each says what is true
  {
    const { ctx, page } = await H.phone(H.PHONE, 'scan', {}, 21);
    let repo = 'spec/ghosty';
    await page.route(/\/api\/status(\?|$)/, async (r) => {
      const res = await r.fetch();
      const st = await res.json();
      const keys = (st.keys ?? []).filter((k) => k.name !== 'github').concat([{ name: 'github', label: 'GitHub', set: true, hint: 'github_pat_…', link: 'https://github.com/settings/tokens', need: 'optional', why: 'self-editing', steps: ['Make a token.'] }]);
      return json(r, { ...st, keys, repo, repoReady: !!repo });
    });
    // a token saved whose check failed: never "Linked as …" with OPEN WORKSHOP; the reason and the form to replace it
    await page.evaluate(() => localStorage.setItem('ghosty.links.checks', JSON.stringify({ github: { ok: false, at: Date.now() - 30_000, why: 'GitHub says this key is not valid. Copy it again with no spaces, then paste it below.' }, spotify: { ok: false, at: Date.now() - 30_000, who: 'Spec Owner', why: 'Spotify no longer accepts my sign-in. Tap UNLINK, then link Spotify again.' } })));
    await openLinks(H, page, 'Services');
    let g = await panelOf(page, 'GITHUB');
    check(g?.status === 'Linked, but not working' && /not valid/.test(g?.body ?? '') && g?.keys.includes('REPLACE') && !g?.keys.includes('OPEN WORKSHOP'), `GitHub: a failed token check is never "Linked": ${JSON.stringify(g)}`);
    // the brain's repository not named: said so, and no token is asked for (a new one could never fix it)
    repo = null;
    await back(page);
    await openLinks(H, page, 'Services');
    g = await panelOf(page, 'GITHUB');
    check(g?.status === 'Not linked' && /GITHUB_REPO/.test(g?.body ?? '') && !/cannot edit my repository/.test(g?.body ?? '') && !g?.keys.includes('REPLACE'), `GitHub with no repository named: ${JSON.stringify(g)}`);
    // Spotify not linked: the check about the last link is forgotten, so linking the same account again starts clean
    await page.route(/\/api\/spotify\/status/, (r) => json(r, { linked: false, name: null, product: null, clientId: null }));
    await page.route(/\/api\/telegram\/status/, (r) => json(r, { linked: true, paired: true, bot: 'specbot', name: 'Spec Owner' }));
    let tgTest = 'abort';
    await page.route(/\/api\/telegram\/test/, (r) => (tgTest === 'abort' ? r.abort('failed') : json(r, { sent: false, error: 'I couldn’t reach Telegram just now. Try again in a minute.' }, 502)));
    await back(page);
    await openLinks(H, page, 'Accounts');
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.links.checks') ?? '{}'));
    check(!kept.spotify, `Spotify not linked forgets the last link's check: ${JSON.stringify(kept)}`);
    // Telegram TEST with no signal: a toast, never kept as Telegram not working
    await pushPanel(page, 'TELEGRAM');
    await page.locator('#pg-links .pn button', { hasText: /^TEST$/ }).first().click({ timeout: 5000 }).catch(() => check(false, 'no Telegram TEST key'));
    // (the real condition: the TEST has answered: TELEGRAM's own status no longer "Checking…", within 10 s)
    await page.waitForFunction(() => {
      const p = [...document.querySelectorAll('#pg-links .pn')].find((x) => (x.querySelector('h3 .ptitle')?.textContent ?? '').startsWith('TELEGRAM'));
      const st = p?.querySelector('h3 small')?.textContent ?? '';
      return !!st && !/checking/i.test(st);
    }, null, { timeout: 10000 }).catch(() => undefined);
    let t = await panelOf(page, 'TELEGRAM');
    const kept2 = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.links.checks') ?? '{}'));
    check(t?.status === 'Linked as @specbot' && !kept2.telegram, `a TEST with no signal is not kept as Telegram not working: ${t?.status} ${JSON.stringify(kept2)}`);
    // the brain's own "could not send": kept, and said as not working
    tgTest = 'brain';
    await page.locator('#pg-links .pn button', { hasText: /^TEST$/ }).first().click({ timeout: 5000 }).catch(() => check(false, 'no Telegram TEST key (2)'));
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-links .pn')].some((p) => (p.querySelector('h3 .ptitle')?.textContent ?? '').startsWith('TELEGRAM') && p.querySelector('h3 small')?.textContent === 'Linked, but not working'), null, { timeout: 5000 }).catch(() => undefined);
    t = await panelOf(page, 'TELEGRAM');
    check(t?.status === 'Linked, but not working' && /Tap TEST to try again/.test(t?.body ?? ''), `the brain's own failed send is kept: ${JSON.stringify(t)}`);
    await ctx.close();
  }
  {
    // each device's ✕ is a 44 pt key; NOTIFICATIONS out of reach says so with TRY AGAIN
    const { ctx, page } = await H.phone(H.PHONE2, 'scan', {}, 21);
    await page.route(/\/api\/push\/devices/, (r) => json(r, { devices: [{ id: 'd1', label: 'Spec phone', at: Date.now() - 60_000 }] }));
    await page.route(/\/api\/push\/prefs/, (r) => r.abort('failed'));
    await openLinks(H, page, 'This phone');
    await pushPanel(page, 'PHONE');
    const x = await page.$eval('#pg-links .rw .n.del', (n) => { const b = n.getBoundingClientRect(); return { w: b.width, h: b.height }; }).catch(() => null);
    check(x && x.w >= 44 && x.h >= 44, `a device's ✕ is 44 pt: ${JSON.stringify(x)}`);
    await back(page);
    await openLinks(H, page, 'This phone');
    await pushPanel(page, 'NOTIFICATIONS');
    const n = await panelOf(page, 'NOTIFICATIONS');
    check(/can’t reach/.test(n?.body ?? '') && n?.keys.includes('TRY AGAIN'), `NOTIFICATIONS out of reach: ${JSON.stringify(n)}`);
    const f = await H.fit(page, '#pg-links');
    check(!f.small.length && !f.sideways && !f.cut.length, `NOTIFICATIONS out of reach fits: ${JSON.stringify(f)}`);
    await ctx.close();
  }
  log('links: fix stage');

  // 5. the seven looks: the not-working email and its keys hold in every world (390 wide; The Scan at BODY 21)
  for (const world of H.WORLDS) {
    const seed = { 'ghosty.links.checks': JSON.stringify({ email: { ok: false, at: Date.now() - 30_000, who: ADDRESS, why: 'Your mail server turned down the address or the app password. Make a new app password, tap CHANGE ACCOUNT and paste it.' } }) };
    const { ctx, page } = await H.phone(H.PHONE2, world, seed, world === 'scan' ? 21 : 0);
    await page.route(/\/api\/email\/status/, (r) => json(r, { linked: true, address: ADDRESS, server: 'imap.gmail.com' }));
    await openLinks(H, page, 'Accounts');
    await pushPanel(page, 'EMAIL');
    const e = await panelOf(page, 'EMAIL');
    check(e?.status === 'Linked, but not working', `[${world}] the email says it is not working: ${e?.status}`);
    const f = await H.fit(page, '#pg-links');
    check(!f.small.length && !f.sideways && !f.cut.length, `[${world}] LINKS fits: ${JSON.stringify(f)}`);
    const colours = await page.$eval('#pg-links .lkwhy', (n) => ({ c: getComputedStyle(n).color, bg: getComputedStyle(document.body).backgroundColor, shown: !!n.getClientRects().length })).catch(() => null);
    check(colours && colours.shown && colours.c !== colours.bg, `[${world}] the reason is drawn in a colour of the look: ${JSON.stringify(colours)}`);
    await ctx.close();
  }
  log('links: seven looks');
}
