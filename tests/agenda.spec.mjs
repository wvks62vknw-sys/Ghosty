// Drives the Agenda tab: add an event and a reminder by hand, let Ghosty set a reminder
// by chat, and check the notification pops up when the (emulated) alarm fires.
//   node tests/agenda.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK, openSection } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.evaluate(() => (location.hash = 'agenda'));
  await page.waitForSelector('#pg-agenda .pn');
  const narrow = viewport.width < 900;
  // add an event by hand
  await page.fill('#pg-agenda input[aria-label="Event title"]', `Dentist ${name}`);
  await page.click('#pg-agenda .keyrow button:has-text("ADD")');
  await page.waitForFunction((n) => document.querySelector('#pg-agenda')?.textContent?.includes(`Dentist ${n}`), name, { timeout: 8000 });
  await page.screenshot({ path: `${out}/${name}-agenda.png` });
  // a reminder by hand
  if (narrow) await openSection(page, 'agenda', 'Reminders');
  await page.fill('#pg-agenda input[aria-label="Reminder text"]', `Water plants ${name}`);
  await page.click('#pg-agenda .keyrow button:has-text("SET")');
  await page.waitForFunction((n) => document.querySelector('#pg-agenda')?.textContent?.includes(`Water plants ${n}`), name, { timeout: 8000 });
  // Ghosty sets a reminder that is due now → alarm → inbox → toast
  await page.screenshot({ path: `${out}/${name}-agenda-right.png` });
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  await page.fill('#cin', `remind me in 0 minutes to stretch ${name}`); // (its own words: the same words within a minute pop up once, by design)
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /REMINDER: stretch/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push(`[${name}] reminder toast never appeared`));
  await page.screenshot({ path: `${out}/${name}-reminder-toast.png` });
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'agenda'));
  await page.waitForTimeout(800);
  const badge = await page.evaluate(() => document.querySelector('#dock button[data-id="agenda"]')?.dataset.badge);
  if (!badge) problems.push(`[${name}] no unread badge on the Agenda tab`);
  // Leave the brain's agenda as found: this run's Dentist event goes (specs after this one read the agenda; a run that
  // crossed midnight UK found it still ahead on Home's Today card an hour later).
  const H = { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' };
  const ag = await fetch(`${base}/api/agenda`, { headers: H }).then((r) => r.json()).catch(() => null);
  for (const e of (ag?.events ?? []).filter((e) => e.title === `Dentist ${name}` && e.id)) await fetch(`${base}/api/agenda/events/${e.id}`, { method: 'DELETE', headers: H }).catch(() => undefined);
  await ctx.close();
}

await run('desktop', DESKTOP);
await run('phone', PHONE);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Agenda run clean.');
process.exit(problems.length ? 1 : 0);
