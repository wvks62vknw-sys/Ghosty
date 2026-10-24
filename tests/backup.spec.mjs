// Keeping the owner's data (SYSTEM → STORAGE, BACKUP & RESTORE) and the pairing form, in a real browser:
//  - the pairing form is a proper sign-in form (iPhone's Passwords can save and fill the key) and still pairs;
//  - the STORAGE line says in plain words whether the phone keeps Ghosty's data;
//  - BACK UP NOW seals what lives only on the phone and the brain keeps ciphertext only;
//  - each phone's copies are kept apart (listed as "this phone");
//  - then everything is wiped (localStorage + IndexedDB, like Safari after 7 days), the phone pairs
//    again; BACK UP NOW asks first on a phone with no backup record; a FAILED backup does not turn
//    off the wiped-phone guard; the daily backup does NOT put the empty phone over the good copy;
//  - RESTORE brings the courses/flashcards, the space plan, radio favourites and a library document
//    back, reloads at once, and nothing on the page can save over the restored data before that;
//  - storage protection is asked for at start-up only where asking makes no pop-up (not Firefox in a tab).
//   BASE=http://localhost:8852 node tests/backup.spec.mjs [outDir]
//   ENGINE=webkit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/wk/browsers … (Safari's engine)
import { chromium, webkit } from 'playwright';
import { PHONE, UK, openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await engine.launch(process.env.ENGINE === 'webkit' ? {} : { executablePath: process.env.CHROMIUM ?? undefined });
// No service worker: in WebKit, requests from a page it controls would slip past page.route below.
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
let dialogs = [];
let dismissDialogs = false;
page.on('dialog', (d) => {
  dialogs.push(d.message());
  void (dismissDialogs ? d.dismiss() : d.accept());
});

const pair = async () => {
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
};
const toSystem = async () => {
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForSelector('#pg-system .storageline', { state: 'attached', timeout: 10000 });
  await openPanel(page, 'system', 'BACKUP');
};

// ---- 1. the pairing form
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
// (WebKit can show the form a moment before the stylesheet applies to it: give it that moment.)
await page.waitForFunction(() => {
  const u = document.querySelector('#pairform .pairuser');
  return !!u && getComputedStyle(u).position === 'absolute';
}, null, { timeout: 5000 }).catch(() => undefined);
const form = await page.evaluate(() => {
  const f = document.querySelector('form#pairform');
  const user = f?.querySelector('input[autocomplete="username"]');
  const key = document.querySelector('#pair input');
  const unlock = document.querySelector('#pair button.on');
  return {
    form: !!f,
    userInForm: !!user && user.form === f,
    userValue: user?.value,
    userName: user?.getAttribute('name'),
    userBefore: !!user && !!key && !!(user.compareDocumentPosition(key) & Node.DOCUMENT_POSITION_FOLLOWING),
    userHidden: !!user && user.getBoundingClientRect().width <= 1 && user.getBoundingClientRect().height <= 1 && getComputedStyle(user).display !== 'none',
    userRect: user ? JSON.stringify(user.getBoundingClientRect()) : '',
    keyType: key?.getAttribute('type'),
    keyAuto: key?.getAttribute('autocomplete'),
    keyName: key?.getAttribute('name'),
    keyInForm: key?.form === f,
    unlockSubmits: unlock?.getAttribute('type') === 'submit' && unlock?.form === f,
    tip: document.querySelector('#pair .pairtip')?.textContent ?? '',
    offline: [...document.querySelectorAll('#pair button')].find((b) => b.textContent === 'CONTINUE OFFLINE')?.getAttribute('type'),
  };
});
check(form.form && form.keyInForm && form.userInForm, `the key and the username are not in one <form>: ${JSON.stringify(form)}`);
check(form.userValue === 'Ghosty owner' && form.userName === 'username' && form.userBefore && form.userHidden, `username field wrong: ${JSON.stringify(form)}`);
check(form.keyType === 'password' && form.keyAuto === 'current-password' && form.keyName === 'password', `key field is not a saved-password field: ${JSON.stringify(form)}`);
check(form.unlockSubmits, 'UNLOCK does not submit the form');
check(form.offline === 'button', 'CONTINUE OFFLINE would submit the form');
check(/Tip: let iPhone save this in Passwords — next time Face ID fills it in\./.test(form.tip), `tip line missing: "${form.tip}"`);
// A wrong key first (Enter in the field submits, no page load), then the right one.
await page.fill('#pair input', 'not-the-key-0000000000');
await page.press('#pair input', 'Enter');
await page.waitForFunction(() => /not accepted/.test(document.querySelector('#pair p.note')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('a wrong key was not refused in place'));
check(await page.$('#pair') !== null, 'the form went away after a wrong key');
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
check((await page.$('#pairform')) === null, 'the sign-in form is still there after pairing (Safari needs it gone to offer saving)');
check((await page.evaluate(() => localStorage.getItem('ghosty.ownerKey'))) === KEY, 'pairing did not keep the key');

// ---- 2. seed what lives only on this phone, then look at STORAGE
// The library document below was added while the brain could not take it: its upload keeps failing,
// so it stays "on this device only" (the brain's own documents are never in the backup — it has them).
await page.route('**/api/library/docs', (r) => (r.request().method() === 'POST' ? r.abort() : r.continue()));
await page.evaluate(async () => {
  const card = { id: 'card-1', course: 'c1', front: 'BACKUP-MARKER-front', back: 'back', added: 1, ef: 2.5, reps: 1, interval: 1, due: Date.now() + 86_400_000, lapses: 0, last: Date.now() };
  localStorage.setItem('ghosty.learn', JSON.stringify({ courses: [{ id: 'c1', topic: 'bridges', title: 'Bridges 101', level: 'beginner', minutes: 30, lessons: 3, done: 1, next: 2, nextTitle: 'Arches' }], cards: [card], full: {}, quizzes: [], pending: [], pendingDone: [], synced: 0 }));
  localStorage.setItem('ghosty.space', JSON.stringify({ plan: { v: 1, room: { w: 512, d: 333 }, items: [{ id: 'piano', kind: 'sofa3', label: 'Grand piano', w: 150, d: 150, x: 10, y: 10, rot: 0 }] }, measures: [] }));
  localStorage.setItem('ghosty.radio.favs', JSON.stringify([{ name: 'Marker FM', url: 'https://radio.example/marker' }]));
  // A document kept only on this phone (the brain has not got it yet).
  await new Promise((ok, bad) => {
    const r = indexedDB.open('ghosty-library', 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pass')) db.createObjectStore('pass', { keyPath: ['doc', 'n'] });
    };
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(['docs', 'pass'], 'readwrite');
      tx.objectStore('docs').put({ id: 'local-marker', title: 'Marker notes', source: 'typed on the phone', kind: 'note', pages: 1, count: 1, chars: 26, at: Date.now() });
      tx.objectStore('pass').put({ doc: 'local-marker', n: 0, text: 'BACKUP-MARKER passage text' });
      tx.oncomplete = () => {
        db.close();
        ok();
      };
      tx.onerror = () => bad(tx.error);
    };
    r.onerror = () => bad(r.error);
  });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await toSystem();
const line = await page.textContent('#pg-system .storageline');
check(/^STORAGE: (PROTECTED( · [\d.]+ MB used)?|NOT PROTECTED — .+)$/.test(line ?? ''), `storage line not in plain words: "${line}"`);
if (/NOT PROTECTED/.test(line ?? '')) {
  const canAsk = await page.evaluate(() => !!navigator.storage?.persisted);
  if (canAsk) {
    check(/add Ghosty to your Home Screen \(Share → Add to Home Screen\) so iPhone keeps your data|press PROTECT/.test(line), `no Home Screen advice: "${line}"`);
    check(!!(await page.$('#pg-system button:has-text("PROTECT")')), 'no PROTECT button while not protected');
  } else check(/cannot be asked|add Ghosty to your Home Screen/.test(line), `no plain words for a browser that cannot be asked: "${line}"`);
}

// ---- 3. BACK UP NOW
// (The brain may already hold copies from other phones — another run on the same preview: each phone's are its own.)
const listNow = () => page.evaluate(async (key) => (await (await fetch('/api/backup', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } })).json()).backups, KEY);
const startCount = (await listNow()).length;
const before = Date.now();
await page.click('#pg-system button:has-text("BACK UP NOW")');
await page.waitForFunction((t) => (JSON.parse(localStorage.getItem('ghosty.backup.last') ?? 'null')?.at ?? 0) >= t, before, { timeout: 30000 }).catch(() => problems.push('BACK UP NOW never finished'));
check((await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.backup.last') ?? 'null')?.ok)) === true, `BACK UP NOW failed: ${await page.textContent('#pg-system .backupmsg').catch(() => '')}`);
await page.waitForSelector('#pg-system [data-backup]', { timeout: 30000 }).catch(async () => problems.push(`no backup listed after BACK UP NOW: ${await page.textContent('#pg-system .backupmsg').catch(() => '')}`));
const myDevice = await page.evaluate(() => localStorage.getItem('ghosty.device'));
const kept = await page.evaluate(async ([key, device]) => {
  const h = { 'x-ghosty': '1', 'x-ghosty-key': key };
  const list = await (await fetch('/api/backup', { headers: h })).json();
  const b = list.backups.find((x) => x.device === device) ?? [...list.backups].sort((x, y) => y.at - x.at)[0];
  const one = b ? await (await fetch(`/api/backup/${b.device ? `${b.device}/${b.day}` : b.id}`, { headers: h })).json() : null;
  return { list, mine: b ?? null, text: JSON.stringify(one) };
}, [KEY, myDevice]);
check(kept.list.backups?.length === startCount + 1, `brain lists ${kept.list.backups?.length} backups (${startCount} before)`);
check(/^[A-Za-z0-9_-]{8,64}$/.test(myDevice ?? '') && kept.mine?.device === myDevice, `the backup is not kept under this phone's own id: ${myDevice} / ${JSON.stringify(kept.list.backups)}`);
const mineRow = `#pg-system [data-backup="${kept.mine?.id}"]`;
check(/this phone ·/.test((await page.textContent(mineRow).catch(() => '')) ?? ''), 'the list does not say which phone a copy is from');
check(!/MARKER|Bridges|piano/i.test(kept.text), 'the brain holds readable data — the backup must be sealed on the phone');
check(/"kdf":"PBKDF2-SHA256"/.test(kept.text) && /"ct":"/.test(kept.text), `not a sealed envelope: ${kept.text.slice(0, 200)}`);
await page.screenshot({ path: `${out}/backup-system.png`, fullPage: true });

// ---- 4. Safari wipes everything (and the owner key with it)
await page.evaluate(async () => {
  localStorage.clear();
  await new Promise((ok) => {
    const r = indexedDB.deleteDatabase('ghosty-library');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await pair();
const gone = await page.evaluate(() => ({ learn: localStorage.getItem('ghosty.learn'), space: localStorage.getItem('ghosty.space') }));
check(!/MARKER/.test(gone.learn ?? '') && !/piano/i.test(gone.space ?? ''), 'the wipe did not wipe');
await toSystem();
await page.waitForSelector('#pg-system .wiped', { timeout: 10000 }).catch(() => problems.push('no "restore first" advice on a wiped phone with backups in the brain'));
// BACK UP NOW on a phone with no backup record, while the brain has copies: it asks first (Cancel: nothing sent).
dialogs = [];
dismissDialogs = true;
await page.click('#pg-system button:has-text("BACK UP NOW")');
await page.waitForTimeout(1500);
dismissDialogs = false;
check(dialogs.some((m) => m.startsWith('This phone has no backup record. Backing up now could replace a good copy from today with an empty phone. Restore first?')), `BACK UP NOW did not ask first on a wiped phone: ${JSON.stringify(dialogs)}`);
check((await listNow()).length === startCount + 1, 'BACK UP NOW sent a backup although the owner said Cancel');
// A backup that FAILS must not turn the guard off: the brain refuses once, the owner says OK to back up anyway.
await page.route('**/api/backup', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'KV was not reachable' }) }) : r.continue()));
await page.click('#pg-system button:has-text("BACK UP NOW")');
await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.backup.last') ?? 'null')?.ok === false, null, { timeout: 30000 }).catch(() => problems.push('the failed backup was not recorded'));
await page.unroute('**/api/backup');
// Four hours later (past the 3-hour wait after a failure), Ghosty is opened again.
await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem('ghosty.backup.last'));
  localStorage.setItem('ghosty.backup.last', JSON.stringify({ ...l, at: Date.now() - 4 * 3_600_000 }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await toSystem();
await page.waitForSelector('#pg-system .wiped', { timeout: 10000 }).catch(() => problems.push('a failed backup turned off the "restore first" guard'));
// The daily backup (20 s after start) must not put the empty phone over the good copy now.
await page.waitForTimeout(23000);
const still = await listNow();
check(still.length === startCount + 1 && still.find((x) => x.id === kept.mine?.id)?.at === kept.mine?.at, `the daily backup made or replaced a copy on a wiped phone: ${JSON.stringify(still)}`);
check(/Linux|Mac|Windows|iPhone|Device|Android|iPad/.test((await page.textContent(mineRow).catch(() => '')) ?? ''), 'a copy from before the wipe (another id now) is not listed by its phone\'s name');

// ---- 5. RESTORE
// Something on the page keeps saving its old, empty state (as the stores do: the inbox check every 45 s, a
// save already waiting). Before the fix it wrote over the restored courses in the seconds before the reload.
await page.evaluate(() => {
  const empty = JSON.stringify({ courses: [], cards: [], full: {}, quizzes: [], pending: [], pendingDone: [], synced: 0 });
  localStorage.setItem('ghosty.learn', empty);
  setInterval(() => {
    try {
      localStorage.setItem('ghosty.learn', empty);
    } catch {
      /* frozen */
    }
  }, 20);
});
const reloaded = page.waitForEvent('load', { timeout: 30000 }).then(() => true, () => false);
await page.click(`${mineRow} button:has-text("RESTORE")`);
check(await reloaded, 'Ghosty did not reload after the restore');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await toSystem();
await page.waitForFunction(() => /Put back:/.test(document.querySelector('#pg-system .backupmsg')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push('no restore report after the reload'));
const report = (await page.textContent('#pg-system .backupmsg').catch(() => '')) ?? '';
check(/courses, lessons and flashcards/.test(report) && /space plan/.test(report) && /1 document kept only on this phone put back/.test(report), `restore report: "${report}"`);
check(!/chat history/.test(report), `the report claims chat history came back from the backup: "${report}"`);
await page.screenshot({ path: `${out}/backup-restored.png`, fullPage: true });
const back = await page.evaluate(async () => {
  const doc = await new Promise((ok) => {
    const r = indexedDB.open('ghosty-library');
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('pass')) return ok(null);
      const g = db.transaction('pass', 'readonly').objectStore('pass').get(['local-marker', 0]);
      g.onsuccess = () => ok(g.result?.text ?? null);
      g.onerror = () => ok(null);
    };
    r.onerror = () => ok(null);
  });
  return { learn: localStorage.getItem('ghosty.learn') ?? '', space: localStorage.getItem('ghosty.space') ?? '', favs: localStorage.getItem('ghosty.radio.favs') ?? '', key: localStorage.getItem('ghosty.ownerKey'), doc };
});
check(/BACKUP-MARKER-front/.test(back.learn) && /Bridges 101/.test(back.learn), 'flashcards/courses not back');
check(/Grand piano/.test(back.space) && /"w":512/.test(back.space), 'space plan not back');
check(/Marker FM/.test(back.favs), 'radio favourites not back');
check(back.doc === 'BACKUP-MARKER passage text', `library document not back: ${back.doc}`);
check(back.key === KEY, 'the owner key was lost by the restore');

// ---- 6. storage protection at start-up: asked for in Chrome / Safari (no pop-up), not in a Firefox tab (a pop-up every start)
for (const [ua, wantAsk] of [
  ['Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', false],
  [undefined, true],
]) {
  const c = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block', ...(ua ? { userAgent: ua } : {}) });
  await c.addInitScript(() => {
    window.__persistAsked = 0;
    if (navigator.storage) {
      Object.defineProperty(navigator.storage, 'persisted', { value: async () => false, configurable: true });
      Object.defineProperty(navigator.storage, 'persist', { value: async () => (window.__persistAsked++, false), configurable: true });
    }
  });
  const p = await c.newPage();
  p.on('pageerror', (e) => problems.push(`pageerror (${ua ? 'Firefox' : 'default'}): ${e.message}`));
  await p.goto(base, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#pair input', { timeout: 20000 });
  await p.fill('#pair input', KEY);
  await p.click('#pair button.on');
  await p.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await p.waitForTimeout(1500);
  const { asked, api } = await p.evaluate(() => ({ asked: window.__persistAsked, api: !!navigator.storage }));
  // (WebKit's Linux build has no navigator.storage at all: nothing to ask there.)
  if (api) check(wantAsk ? asked >= 1 : asked === 0, `${ua ? 'Firefox in a tab' : 'this browser'}: storage.persist() called ${asked} time(s) at start-up`);
  else console.log(`(no navigator.storage in this engine: the ${ua ? 'Firefox' : 'default'} start-up check was skipped)`);
  await c.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Backup run clean: sign-in form for Passwords, storage line, sealed backup per phone, asks first on a wiped phone, a failed backup keeps the guard, restore with everything back and nothing saved over it, no storage pop-up in Firefox.');
process.exit(problems.length ? 1 : 0);
