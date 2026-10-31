// A SCAM OR A LINK, CHECKED (integrations/linkcheck.ts, the check_link tool; OWNER-ISSUES 55): from public records with no
// keys — RDAP, the look-alikes of the brands scammers wear, Cloudflare's malware filter, the OpenPhish and Phishing Army
// lists, the message's own shape — with recorded answers (guardian.fixture.json): a known scam, a look-alike, a clean
// domain, an unreachable register; the verdict with its reasons, never "safe"; the protective mood fed by a scam caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, Mem, NOW, web } from './guardian-kit.mjs';

const T = await import('./.build/tools/index.mjs');

test('check_link: a known scam, a look-alike, a clean domain and an unreachable register — with reasons, and never "safe"', async () => {
  web.rdap = { 'example.co.uk': 'rdap_old', 'royalmail-redelivery-uk.com': 'rdap_new' };
  web.cf = { 'evri-parcel-fee.live': 'cf_blocked' };
  // a known scam: on the lists, and the shape of one
  const scam = await L.checkLink('Evri: your parcel is on hold. Pay the £1.45 redelivery fee within 24 hours: https://evri-parcel-fee.live/pay', { now: NOW });
  assert.equal(scam.verdict, 'scam');
  assert.ok(scam.reasons.some((r) => /Cloudflare's security filter blocks/.test(r)));
  assert.ok(scam.reasons.some((r) => /OpenPhish/.test(r)));
  assert.ok(scam.reasons.some((r) => /Phishing Army/.test(r)));
  assert.ok(scam.reasons.some((r) => /small fee to release a parcel/.test(r)));
  assert.equal(scam.brand, 'Evri');
  // look-alikes: extra words on a brand, a digit for a letter, letters from another alphabet
  const look = await L.checkLink('Royal Mail: we missed you. Reschedule at royalmail-redelivery-uk.com', { now: NOW });
  assert.equal(look.verdict, 'scam');
  assert.ok(look.reasons.some((r) => /uses the name Royal Mail with extra words but is not Royal Mail's own address \(royalmail\.com\)/.test(r)), look.reasons.join(' | '));
  assert.ok(look.reasons.some((r) => /registered 5 days ago through Cheap Names Inc\./.test(r)), look.reasons.join(' | '));
  assert.equal(L.lookalike('paypa1.com').brand, 'PayPal');
  assert.equal(L.lookalike('xn--pypal-4ve.com').brand, 'PayPal', 'a Cyrillic а');
  assert.match(L.lookalike('xn--pypal-4ve.com').why, /look-alike letters from another alphabet/);
  assert.equal(L.lookalike('www.paypal.com'), null, "PayPal's own address");
  assert.equal(L.lookalike('amazon.co.uk'), null);
  assert.equal(L.lookalike('hmrc.gov.uk'), null);
  assert.equal(L.punyDecode('xn--pypal-4ve'), 'pаypal');
  // a clean, old domain: nothing found, said as no proof
  const clean = await L.checkLink('https://www.example.co.uk/menu', { now: NOW });
  assert.equal(clean.verdict, 'nothing');
  const words = L.verdictWords(clean);
  assert.match(words, /^I can't find anything wrong with it — that isn't proof; don't type a password into it\./);
  assert.match(words, /Example\.co\.uk: registered 22 years ago through Nominet Example Registrar|example\.co\.uk: registered/i);
  // the register does not answer: said so, never taken as clean
  web.rdap = {};
  web.down.add('rdap.org');
  const unreachable = await L.checkLink('have a look at example.co.uk', { now: NOW });
  web.down.delete('rdap.org');
  assert.ok(unreachable.couldNot.some((x) => /RDAP\) didn't answer for example\.co\.uk/.test(x)));
  assert.match(L.verdictWords(unreachable), /Couldn't check: the domain register \(RDAP\) didn't answer/);
  // a message with no link: judged on its words alone
  const mum = await L.checkLink("Hi Mum, I broke my phone, this is my new number. Can you send me £200 for a bill? x", { now: NOW });
  assert.equal(mum.verdict, 'scam');
  assert.match(L.verdictWords(mum), /no link in it to check, so this is from its words alone/);
  for (const c of [scam, look, clean, unreachable, mum]) assert.doesNotMatch(L.verdictWords(c), /\bsafe\b/i, 'never "safe"');
});

test('check_link, the tool: the protective mood is fed by a scam it caught; the words go back as written', async () => {
  web.rdap = { 'royalmail-redelivery-uk.com': 'rdap_new' };
  const tool = T.toolByName.get('check_link');
  const storage = new Mem();
  const out = await tool.run({ text: 'royalmail-redelivery-uk.com' }, { storage, vault: { get: async () => null }, env: {}, emit: () => undefined });
  assert.match(out, /^That looks like a scam\. If it says it's from Royal Mail, open Royal Mail's own app or type their address yourself\./);
  assert.equal((await storage.get('mood')).kind, 'protective');
});

test('check_link sits in the guardian group, turned on by "is this legit?" and its family', () => {
  const g = T.TOOL_GROUPS.find((x) => x.name === 'guardian');
  assert.ok(g.tools.some((t) => t.name === 'check_link'));
  const on = (t) => T.selectGroups(t, new Set(), false).on.some((x) => x.name === 'guardian');
  for (const t of ['is this a scam?', 'is this legit', 'dodgy text from royal mail', 'is this real']) assert.ok(on(t), t);
});
