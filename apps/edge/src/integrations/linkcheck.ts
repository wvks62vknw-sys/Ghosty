/**
 * A SCAM OR A LINK, CHECKED (OWNER-ISSUES 55): "is this legit?", a forwarded text or a link → a real check, from public
 * records and with no keys, and a verdict in plain words with its reasons — never "safe" as a promise.
 *
 *   the domain's age and registrar   RDAP (integrations/recon.ts rdap: rdap.org → the registry)
 *   a lookalike of a brand           the brands scammers wear (the banks, HMRC, Royal Mail, DPD, Evri, Amazon, PayPal…):
 *                                    look-alike letters (homographs, "paypa1"), extra words ("royalmail-redelivery"),
 *                                    the brand's name on someone else's address, odd endings (.top, .xyz…)
 *   known-bad lists                  Cloudflare's malware-and-phishing resolver (1.1.1.2, over DNS-over-HTTPS), the
 *                                    OpenPhish community feed and the Phishing Army blocklist — all public and keyless.
 *                                    (URLhaus, which the brief named, closed its keyless API and downloads in 2025: its
 *                                    answers are now 401 and 410, checked on 31 Oct 2026.)
 *   the shape of the message         urgency, a fee to release a parcel, a link to "verify", a refund or a prize, a code
 *                                    asked for, "hi mum, new number"
 *
 * Each source that cannot be reached is said so, never counted as clean.
 */
import { rdap, registrable } from './recon';

export const CHECK_TIMEOUT_MS = 8000;
/** At most this many addresses are checked from one message. */
const MAX_LINKS = 3;
const DAY = 86_400_000;

export type Verdict = 'scam' | 'careful' | 'nothing';

export interface LinkCheck {
  verdict: Verdict;
  /** Why, in plain words, worst first. */
  reasons: string[];
  /** What was looked at: the addresses, and the sources that answered. */
  links: string[];
  checked: string[];
  /** Sources that could not be reached (never counted as a clean answer). */
  couldNot: string[];
  /** The brand it pretends to be, when it does. */
  brand?: string;
}

/** The brands UK scams wear most, with their own addresses. */
export const BRANDS: { name: string; words: string[]; domains: string[] }[] = [
  { name: 'HMRC', words: ['hmrc', 'taxrefund', 'govuk'], domains: ['hmrc.gov.uk', 'gov.uk'] },
  { name: 'Royal Mail', words: ['royalmail', 'royal-mail'], domains: ['royalmail.com', 'royalmail.co.uk', 'royalmailgroup.com'] },
  { name: 'DPD', words: ['dpd'], domains: ['dpd.co.uk', 'dpd.com', 'dpdlocal.co.uk', 'dpdgroup.com'] },
  { name: 'Evri', words: ['evri', 'hermes'], domains: ['evri.com', 'myhermes.co.uk'] },
  { name: 'Amazon', words: ['amazon', 'amzn'], domains: ['amazon.co.uk', 'amazon.com', 'amazon.de', 'amazon.fr', 'amzn.to', 'amazon.eu', 'primevideo.com'] },
  { name: 'PayPal', words: ['paypal'], domains: ['paypal.com', 'paypal.co.uk', 'paypal.me'] },
  { name: 'Barclays', words: ['barclays'], domains: ['barclays.co.uk', 'barclays.com'] },
  { name: 'HSBC', words: ['hsbc'], domains: ['hsbc.co.uk', 'hsbc.com'] },
  { name: 'Lloyds', words: ['lloyds', 'lloydsbank'], domains: ['lloydsbank.com', 'lloyds.com', 'lloydsbankinggroup.com'] },
  { name: 'NatWest', words: ['natwest'], domains: ['natwest.com'] },
  { name: 'Santander', words: ['santander'], domains: ['santander.co.uk', 'santander.com'] },
  { name: 'Halifax', words: ['halifax'], domains: ['halifax.co.uk'] },
  { name: 'Nationwide', words: ['nationwide'], domains: ['nationwide.co.uk'] },
  { name: 'Monzo', words: ['monzo'], domains: ['monzo.com', 'monzo.me'] },
  { name: 'Starling', words: ['starling', 'starlingbank'], domains: ['starlingbank.com'] },
  { name: 'Revolut', words: ['revolut'], domains: ['revolut.com', 'revolut.me'] },
  { name: 'TSB', words: ['tsb'], domains: ['tsb.co.uk'] },
  { name: 'DVLA', words: ['dvla'], domains: ['gov.uk'] },
  { name: 'TV Licensing', words: ['tvlicensing', 'tv-licensing', 'tvlicence'], domains: ['tvlicensing.co.uk'] },
  { name: 'Netflix', words: ['netflix'], domains: ['netflix.com'] },
  { name: 'Apple', words: ['apple', 'icloud', 'appleid'], domains: ['apple.com', 'icloud.com'] },
];

/** Endings scam sites use far more than real businesses do. */
const ODD_TLDS = new Set('top xyz icu live online site click info shop buzz cyou rest fun monster sbs cfd tk ml ga cf gq zip mov support help vip win loan work bond lol quest mom rocks today life store'.split(' '));
/** Link shorteners: they hide where a link goes. */
const SHORTENERS = new Set('bit.ly tinyurl.com t.co ow.ly is.gd cutt.ly rb.gy shorturl.at tiny.cc buff.ly t.ly s.id rebrand.ly bl.ink short.io qrco.de'.split(' '));
/** Words a fake address adds to a brand's name. */
const BAIT = /(secure|verify|verification|login|log-in|signin|sign-in|update|account|support|refund|rebate|delivery|redelivery|parcel|tracking|track|billing|payment|pay|help|service|customer|claim|reschedule|fee|unlock|confirm|alert|notice|online)/;

// ---------------------------------------------------------------- the addresses in a message

/** The addresses in a message: links, and bare domains ("royalmail-redelivery.com"), at most three, in order. */
export function linksIn(text: string): { url: string; host: string; plain: boolean }[] {
  const out: { url: string; host: string; plain: boolean }[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    let u: URL;
    try {
      u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
    } catch {
      return;
    }
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!/\./.test(host) || seen.has(u.href) || out.length >= MAX_LINKS) return;
    seen.add(u.href);
    // `plain`: written out with http:// (a bare domain says nothing either way)
    out.push({ url: u.href, host, plain: /^http:\/\//i.test(raw) });
  };
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s<>"')\]]+/gi)) add(m[0].replace(/[.,;:!?]+$/, ''));
  for (const m of text.matchAll(/(?<![\w@./-])((?:[a-z0-9¡-￿](?:[a-z0-9¡-￿-]{0,62})\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,30}))(\/[^\s<>"')\]]*)?/giu)) {
    const whole = m[0].replace(/[.,;:!?]+$/, '');
    if (!out.some((o) => o.url.includes(m[1]!.toLowerCase()))) add(whole);
  }
  return out;
}

// ---------------------------------------------------------------- look-alikes

/** Punycode (RFC 3492): an "xn--" label back to its letters, so a homograph can be read. */
export function punyDecode(label: string): string {
  const input = label.toLowerCase().startsWith('xn--') ? label.slice(4) : label;
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const b = input.lastIndexOf('-');
  const out = b > 0 ? [...input.slice(0, b)].map((c) => c.codePointAt(0)!) : [];
  let n = 128, bias = 72, i = 0;
  const adapt = (delta: number, num: number, first: boolean) => {
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / num);
    let k = 0;
    while (delta > ((base - tMin) * tMax) >> 1) {
      delta = Math.floor(delta / (base - tMin));
      k += base;
    }
    return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
  };
  for (let pos = b > 0 ? b + 1 : 0; pos < input.length; ) {
    const old = i;
    for (let w = 1, k = base; ; k += base) {
      if (pos >= input.length) return label;
      const c = input.charCodeAt(pos++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      if (digit >= base) return label;
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    bias = adapt(i - old, out.length + 1, old === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

/** Letters from other alphabets that look like Latin ones, and the digit swaps scammers use. */
const CONFUSABLE: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', һ: 'h', ո: 'n', ս: 'u', ʟ: 'l', ӏ: 'l', ν: 'v', ο: 'o', α: 'a', ε: 'e', ι: 'i', κ: 'k', τ: 't', ρ: 'p', ⅼ: 'l', ı: 'i', ɑ: 'a', ʀ: 'r', ᴠ: 'v', ꮃ: 'w', ԝ: 'w',
};
/** A label as it reads to the eye: other alphabets' look-alikes and the usual digit swaps turned into plain letters. */
export function skeleton(label: string): string {
  return [...label.normalize('NFKC').toLowerCase()]
    .map((c) => CONFUSABLE[c] ?? c)
    .join('')
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w');
}

/** Edit distance, capped (anything past `max` is just "far"). */
export function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]!);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** The registrable domain's first label ("royalmail" of royalmail.co.uk). */
const nameOf = (domain: string) => domain.split('.')[0] ?? domain;

/** Does this host belong to the brand itself (its own domain or under it)? */
const ownedBy = (host: string, b: (typeof BRANDS)[number]) => b.domains.some((d) => host === d || host.endsWith(`.${d}`));

/**
 * What an address pretends to be, if anything: a brand's look-alike, a brand's name with bait words around it, the brand's
 * name under someone else's domain; with whether it is strong enough alone to call it a scam.
 */
export function lookalike(host: string): { brand: string; why: string; strong: boolean } | null {
  const domain = registrable(host);
  const labels = host.split('.');
  const unicode = labels.map((l) => (l.startsWith('xn--') ? punyDecode(l) : l));
  const shown = unicode.join('.');
  const homograph = unicode.some((l, i) => l !== labels[i]);
  const tld = labels.at(-1) ?? '';
  for (const b of BRANDS) {
    if (ownedBy(host, b)) return null;
    const own = b.domains.map((d) => nameOf(d));
    const reg = skeleton(nameOf(registrable(shown)));
    // letters from another alphabet that read as the brand ("pаypal.com" with a Cyrillic а)
    if (homograph && own.some((o) => reg === o || reg.replace(/-/g, '') === o)) return { brand: b.name, why: `"${shown}" is written with look-alike letters from another alphabet to read as ${b.name}: it is not ${b.name}'s address (${b.domains[0]})`, strong: true };
    // one or two letters off ("paypa1", "amaz0n", "evrl")
    const plain = nameOf(domain);
    if (own.some((o) => o.length >= 4 && plain !== o && (skeleton(plain) === o || editDistance(skeleton(plain), o, 2) <= (o.length >= 7 ? 2 : 1)))) return { brand: b.name, why: `"${domain}" is one or two letters off ${b.name}'s real address (${b.domains[0]})`, strong: true };
    // the brand's name with bait words, or anywhere in someone else's address ("royalmail-redelivery.com", "paypal.secure-login.top")
    const flat = skeleton(host.replace(/\./g, '-'));
    const word = b.words.find((w) => w.length >= 3 && flat.includes(w.replace(/-/g, '')) && (w.length >= 5 || new RegExp(`(^|[-.])${w}([-.]|$)`).test(flat)));
    if (word) {
      const bait = BAIT.test(flat.replace(word, ''));
      const odd = ODD_TLDS.has(tld);
      return { brand: b.name, why: `it uses the name ${b.name}${bait ? ' with extra words' : ''} but is not ${b.name}'s own address (${b.domains[0]})${odd ? `, and it ends in .${tld}` : ''}`, strong: bait || odd || domain !== host };
    }
  }
  return null;
}

// ---------------------------------------------------------------- the message itself

/** The shape of a scam message, in its own words: what pushes, what it wants. Each with how strong it is. */
const SHAPES: [RegExp, string, 1 | 2][] = [
  [/\b(?:hi|hey|hello) (?:mum|mom|dad)\b[\s\S]{0,80}\b(?:new (?:number|phone)|lost my phone|broke my phone|phone (?:broke|is broken))/i, 'it is the "hi mum, this is my new number" scam', 2],
  [/\b(?:(?:small|unpaid|outstanding|redelivery|re-delivery|customs|shipping|delivery|handling|postage) (?:fee|charge|payment)|pay (?:a |the )?(?:small )?(?:fee|charge)|£\s?[0-3]\.\d{2}\b)[\s\S]{0,120}|parcel (?:is )?(?:on hold|held|could not be delivered|waiting)|(?:could not|couldn'?t|unable to) deliver (?:your )?(?:parcel|package)/i, 'it asks for a small fee to release a parcel', 2],
  [/\b(?:verify|confirm|update|validate|re-?activate|unlock) (?:your )?(?:account|identity|details|information|payment|card|bank)|log ?in (?:here |now )?to (?:avoid|keep|restore|confirm)/i, 'it asks you to "verify" or update your details through a link', 2],
  [/\b(?:one[- ]time (?:pass)?code|otp|security code|verification code|pin)\b[\s\S]{0,40}\b(?:send|share|tell|reply|give)|\b(?:send|share|tell|reply with|give) (?:me |us )?(?:the |your )?(?:code|pin|otp)\b/i, 'it asks for a code or your PIN — no real company ever does', 2],
  [/\b(?:within|in the next) (?:24|48|12) ?(?:hours|hrs|h)\b|\b(?:immediately|urgent(?:ly)?|final (?:notice|warning|reminder)|last chance|act now|expires? today|right away)\b|\baccount (?:has been |will be |is )?(?:suspended|locked|blocked|restricted|closed|deactivated)|unusual (?:activity|sign-?in)|suspicious (?:activity|payment|transaction)/i, 'it rushes you (a deadline or a locked account)', 1],
  [/\b(?:tax )?(?:refund|rebate) (?:of|is|due|owed|pending|waiting)|you (?:are|'re) (?:owed|due) (?:a )?(?:refund|rebate|£)|\b(?:won|winner|prize|reward|gift ?card|free (?:iphone|gift))\b/i, 'it offers money you were not expecting (a refund, a prize)', 1],
  [/\b(?:arrest|warrant|court action|legal action|bailiffs?|police will|fine of £|penalty charge)\b/i, 'it threatens you (the police, court, a fine)', 1],
  [/\b(?:bitcoin|crypto|usdt|gift cards?|itunes cards?|western union|moneygram)\b/i, 'it wants paying in crypto, gift cards or a money transfer', 2],
];

export function messageShape(text: string): { why: string; weight: 1 | 2 }[] {
  const t = text.replace(/https?:\/\/\S+/g, ' ');
  return SHAPES.filter(([re]) => re.test(t)).map(([, why, weight]) => ({ why, weight }));
}

// ---------------------------------------------------------------- the public sources

const within = <T>(p: Promise<T>, ms: number): Promise<T> => Promise.race([p, new Promise<T>((_, bad) => setTimeout(() => bad(new Error('no answer in time')), ms))]);

/** Cloudflare's malware-and-phishing resolver: it answers 0.0.0.0 for an address on its block list. */
export async function blockedByCloudflare(host: string, ms = CHECK_TIMEOUT_MS): Promise<boolean> {
  const r = await fetch(`https://security.cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`answered ${r.status}`);
  const j = (await r.json()) as { Answer?: { data?: string }[]; Comment?: string[] };
  return (j.Answer ?? []).some((a) => a.data === '0.0.0.0') || (j.Comment ?? []).some((c) => /Censored|Blocked/i.test(c));
}

/** The OpenPhish community feed (a few hundred live phishing addresses, refreshed through the day). */
export async function onOpenPhish(url: string, host: string, ms = CHECK_TIMEOUT_MS): Promise<boolean> {
  const r = await fetch('https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt', { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`answered ${r.status}`);
  const lines = (await r.text()).split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);
  const u = url.toLowerCase().replace(/\/$/, '');
  return lines.some((l) => {
    const x = l.replace(/\/$/, '');
    if (x === u) return true;
    try {
      return new URL(l).hostname === host;
    } catch {
      return false;
    }
  });
}

/** The Phishing Army blocklist (domains, from PhishTank, OpenPhish, CERT.PL and others; free for personal use). */
export async function onPhishingArmy(host: string, ms = CHECK_TIMEOUT_MS): Promise<boolean> {
  const r = await fetch('https://phishing.army/download/phishing_army_blocklist.txt', { signal: AbortSignal.timeout(ms), cf: { cacheTtl: 4 * 3600, cacheEverything: true } } as RequestInit);
  if (!r.ok) throw new Error(`answered ${r.status}`);
  const text = `\n${(await r.text()).toLowerCase()}\n`;
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (text.includes(`\n${parts.slice(i).join('.')}\n`)) return true;
  return false;
}

const ago = (t: number, now: number): string => {
  const d = Math.max(0, Math.floor((now - t) / DAY));
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : d < 60 ? `${d} days ago` : d < 730 ? `${Math.round(d / 30)} months ago` : `${Math.floor(d / 365)} years ago`;
};

/**
 * The whole check: every address in the message (at most three) against RDAP, the look-alikes and the three lists, and
 * the message's own words. A source that fails is named in `couldNot`, never taken as a clean answer.
 */
export async function checkLink(text: string, opts: { now?: number; timeoutMs?: number } = {}): Promise<LinkCheck> {
  const now = opts.now ?? Date.now();
  const ms = opts.timeoutMs ?? CHECK_TIMEOUT_MS;
  const links = linksIn(text);
  const strong: string[] = [];
  const mild: string[] = [];
  const checked = new Set<string>();
  const couldNot = new Set<string>();
  let brand: string | undefined;
  for (const { url, host, plain } of links) {
    const domain = registrable(host);
    const shown = host.split('.').map((l) => (l.startsWith('xn--') ? punyDecode(l) : l)).join('.');
    const look = lookalike(host);
    if (look) {
      brand ??= look.brand;
      (look.strong ? strong : mild).push(look.why);
    }
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) mild.push(`${shown} is a bare number, not a name: real companies don't send links like that`);
    if (SHORTENERS.has(host)) mild.push(`${host} is a link shortener: it hides where the link really goes`);
    const tld = host.split('.').at(-1) ?? '';
    if (ODD_TLDS.has(tld) && !look) mild.push(`${shown} ends in .${tld}, an ending scam sites use a lot`);
    if (plain) mild.push(`the link to ${shown} isn't secure (http, not https)`);
    if (/@/.test(url.replace(/^https?:\/\//i, '').split('/')[0] ?? '')) strong.push(`the link hides its real address behind an "@"`);
    const [reg, cf, op, pa] = await Promise.allSettled([
      within(rdap(domain, { timeoutMs: ms }), ms + 500),
      within(blockedByCloudflare(host, ms), ms + 500),
      within(onOpenPhish(url, host, ms), ms + 500),
      within(onPhishingArmy(host, ms), ms + 500),
    ]);
    if (reg.status === 'fulfilled') {
      checked.add('the domain register (RDAP)');
      const born = reg.value.registered ? Date.parse(reg.value.registered) : NaN;
      const who = reg.value.registrar ? ` through ${reg.value.registrar}` : '';
      if (Number.isFinite(born)) {
        const days = (now - born) / DAY;
        if (days < 30) (look || brand ? strong : mild).push(`${domain} was registered ${ago(born, now)}${who}: brand-new addresses are how most scams start`);
        else if (days < 180) mild.push(`${domain} is young: registered ${ago(born, now)}${who}`);
        else checked.add(`${domain}: registered ${ago(born, now)}${who}`);
      } else if (reg.value.registrar) checked.add(`${domain}: registrar ${reg.value.registrar}`);
    } else couldNot.add(`the domain register (RDAP) didn't answer for ${domain}, so I can't say how old it is`);
    if (cf.status === 'fulfilled') {
      checked.add("Cloudflare's malware and phishing filter");
      if (cf.value) strong.push(`Cloudflare's security filter blocks ${shown} as malware or phishing`);
    } else couldNot.add("Cloudflare's malware filter didn't answer");
    if (op.status === 'fulfilled') {
      checked.add('the OpenPhish list');
      if (op.value) strong.push(`${shown} is on the OpenPhish list of live phishing sites`);
    } else couldNot.add("the OpenPhish list couldn't be read");
    if (pa.status === 'fulfilled') {
      checked.add('the Phishing Army blocklist');
      if (pa.value) strong.push(`${shown} is on the Phishing Army blocklist`);
    } else couldNot.add("the Phishing Army blocklist couldn't be read");
  }
  const shape = messageShape(text);
  for (const s of shape) (s.weight === 2 ? strong : mild).push(s.why);
  // a message that pushes AND wears a brand's name on a stranger's address is a scam however each part scores alone
  if (!strong.length && brand && shape.length) strong.push(...mild.splice(0, 1));
  const verdict: Verdict = strong.length ? 'scam' : mild.length ? 'careful' : 'nothing';
  return { verdict, reasons: [...strong, ...mild].filter((r, i, a) => a.indexOf(r) === i), links: links.map((l) => l.host), checked: [...checked], couldNot: [...couldNot], ...(brand ? { brand } : {}) };
}

/** The verdict in his words, with its reasons — never "safe". */
export function verdictWords(c: LinkCheck): string {
  const reasons = c.reasons.slice(0, 5);
  const list = reasons.map((r) => `• ${r.charAt(0).toUpperCase()}${r.slice(1)}.`).join('\n');
  const own = c.brand ? ` If it says it's from ${c.brand}, open ${c.brand}'s own app or type their address yourself.` : '';
  const head =
    c.verdict === 'scam'
      ? `That looks like a scam.${own} Don't tap the link, don't pay and don't reply.`
      : c.verdict === 'careful'
        ? `Be careful with this one.${own} Don't type a password or card number into it.`
        : `I can't find anything wrong with it — that isn't proof; don't type a password into it.`;
  const against = c.checked.filter((x) => !/registered|registrar/.test(x));
  const what = c.links.length ? `Checked ${c.links.join(', ')}${against.length ? ` against ${against.join(', ')}` : ''}.` : 'There was no link in it to check, so this is from its words alone.';
  const facts = c.checked.filter((x) => /registered|registrar/.test(x));
  const missing = c.couldNot.length ? `Couldn't check: ${c.couldNot.join('; ')}.` : '';
  return [head, list, [what, ...facts.map((f) => `${f.charAt(0).toUpperCase()}${f.slice(1)}.`)].filter(Boolean).join(' '), missing].filter(Boolean).join('\n');
}
