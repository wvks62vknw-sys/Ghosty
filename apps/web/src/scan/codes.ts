/**
 * What a scanned code says, in plain parts: a web address (with its real domain picked out and
 * warnings for the tricks QR codes are used for), Wi-Fi details, a contact card, a place, an email,
 * a phone number, a text message, a book's ISBN, a product number, or just text. Nothing here
 * opens anything: the Lens shows the parts, and only the owner's tap on OPEN goes anywhere.
 */
import { digitsOf, isIsbn, isProductCode } from '../../../../packages/shared/src/scan';

export type CodeKind = 'url' | 'wifi' | 'contact' | 'geo' | 'email' | 'phone' | 'sms' | 'isbn' | 'product' | 'text';

export interface UrlParts {
  href: string;
  scheme: string;
  /** The whole host name ("login.paypal.com.example.ru"). */
  host: string;
  /** The part that says who owns it ("example.ru"): what the card highlights. */
  domain: string;
  /** Plain-English reasons to be careful; empty when nothing looks off. */
  warnings: string[];
}

export interface CodeInfo {
  kind: CodeKind;
  /** The text as scanned. */
  raw: string;
  url?: UrlParts;
  wifi?: { ssid: string; security: string; password: string; hidden: boolean };
  contact?: { name: string; org: string; phones: string[]; emails: string[]; urls: string[]; address: string };
  geo?: { lat: number; lon: number; label: string };
  email?: { to: string; subject: string; body: string };
  phone?: string;
  sms?: { to: string; body: string };
  /** The barcode number for a book or product. */
  code?: string;
}

/** Second-level labels under which a country's names are registered ("co.uk", "com.au"). */
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu', 'ltd', 'plc', 'me', 'sch', 'nhs', 'police', 'mod', 'gob', 'ne', 'or', 'go']);
/** Names that lookalike addresses borrow, so a code pointing at "paypal.com.secure-login.ru" is called out. */
const BRANDS = ['paypal', 'apple', 'icloud', 'google', 'microsoft', 'outlook', 'amazon', 'netflix', 'facebook', 'instagram', 'whatsapp', 'hmrc', 'gov', 'nhs', 'dvla', 'royalmail', 'evri', 'dpd', 'barclays', 'hsbc', 'lloyds', 'natwest', 'santander', 'monzo', 'revolut', 'halifax', 'nationwide', 'ebay', 'binance', 'coinbase'];
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 'tiny.cc', 's.id', 'qrco.de', 'qr.link']);

/** The owning part of a host name: the last two labels, or three under a country's "co.uk"-style label. */
export function registrableDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return h;
  const labels = h.split('.');
  if (labels.length <= 2) return h;
  const tld = labels[labels.length - 1]!;
  const second = labels[labels.length - 2]!;
  return tld.length === 2 && SECOND_LEVEL.has(second) ? labels.slice(-3).join('.') : labels.slice(-2).join('.');
}

/** A web address taken apart, with what to be careful about. */
export function urlParts(text: string): UrlParts | null {
  let u: URL;
  try {
    u = new URL(text.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  const domain = registrableDomain(host);
  const warnings: string[] = [];
  if (u.protocol === 'http:') warnings.push('Not secure: the page is not encrypted (http, not https). Never type a password or card number there.');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) warnings.push('It goes to a bare number address, not a named website: real companies rarely do that.');
  if (host.split('.').some((l) => l.startsWith('xn--'))) warnings.push('The name uses look-alike letters from another alphabet (it is written in "punycode"): it may imitate a real site.');
  if (u.username || u.password || /@/.test(text.split('?')[0]!.replace(/^https?:\/\//i, '').split('/')[0]!)) warnings.push('The address hides its real destination behind an "@": the site is the part after it.');
  const sub = host.slice(0, Math.max(0, host.length - domain.length)).replace(/\.$/, '');
  const brand = BRANDS.find((b) => (sub.split(/[.-]/).includes(b) || domain.replace(/\.[^.]+$/, '').split('-').includes(b)) && !domain.startsWith(`${b}.`));
  if (brand) warnings.push(`It mentions "${brand}" but the site really belongs to ${domain}: a common trick. Check before trusting it.`);
  if ((domain.match(/-/g) ?? []).length >= 2) warnings.push(`The site name ${domain} is a string of words joined by dashes, often a sign of a throwaway site.`);
  if (SHORTENERS.has(host)) warnings.push('A link shortener: the real destination is hidden until it is opened.');
  return { href: u.href, scheme: u.protocol.replace(':', ''), host, domain, warnings };
}

/** WIFI:T:WPA;S:name;P:pass;H:true;; (backslash escapes \; \, \: \\ \"). */
function parseWifi(text: string): CodeInfo['wifi'] | null {
  if (!/^WIFI:/i.test(text)) return null;
  const fields: Record<string, string> = {};
  const body = text.slice(5);
  let key = '';
  let val = '';
  let inVal = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c === '\\' && i + 1 < body.length) {
      if (inVal) val += body[++i];
      else key += body[++i];
      continue;
    }
    if (!inVal && c === ':') inVal = true;
    else if (inVal && c === ';') {
      fields[key.trim().toUpperCase()] = val;
      key = '';
      val = '';
      inVal = false;
    } else if (inVal) val += c;
    else key += c;
  }
  if (key) fields[key.trim().toUpperCase()] = val;
  const t = (fields.T ?? '').toUpperCase();
  return { ssid: fields.S ?? '', security: t === 'NOPASS' || !t ? 'open (no password)' : t, password: fields.P ?? '', hidden: /^true$/i.test(fields.H ?? '') };
}

function parseVcard(text: string): CodeInfo['contact'] | null {
  const vcard = /^BEGIN:VCARD/i.test(text);
  const mecard = /^MECARD:/i.test(text);
  if (!vcard && !mecard) return null;
  const c = { name: '', org: '', phones: [] as string[], emails: [] as string[], urls: [] as string[], address: '' };
  if (mecard) {
    for (const part of text.slice(7).split(/(?<!\\);/)) {
      const [k = '', ...rest] = part.split(':');
      const v = rest.join(':').replace(/\\(.)/g, '$1');
      const key = k.toUpperCase();
      if (key === 'N') c.name = v.split(',').reverse().join(' ').trim();
      else if (key === 'TEL') c.phones.push(v);
      else if (key === 'EMAIL') c.emails.push(v);
      else if (key === 'URL') c.urls.push(v);
      else if (key === 'ADR') c.address = v;
      else if (key === 'ORG') c.org = v;
    }
    return c;
  }
  // Folded lines (a line starting with a space continues the last) are joined first.
  for (const line of text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0]!.toUpperCase().replace(/^item\d+\./i, '');
    const v = line.slice(i + 1).replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim();
    if (key === 'FN') c.name = v;
    else if (key === 'N' && !c.name) c.name = v.split(';').slice(0, 2).reverse().join(' ').trim();
    else if (key === 'ORG') c.org = v.replace(/;/g, ' ').trim();
    else if (key === 'TEL') c.phones.push(v);
    else if (key === 'EMAIL') c.emails.push(v);
    else if (key === 'URL') c.urls.push(v);
    else if (key === 'ADR') c.address = v.split(';').filter(Boolean).join(', ');
  }
  return c;
}

function parseGeo(text: string): CodeInfo['geo'] | null {
  const m = text.match(/^geo:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:[,;][^?]*)?(?:\?(.*))?$/i);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
  const q = new URLSearchParams(m[3] ?? '').get('q') ?? '';
  return { lat, lon, label: q.replace(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?\s*/, '').replace(/^\((.*)\)$/, '$1') };
}

/** A scanned code's text (and the format the reader named) → what it is. */
export function classifyCode(raw: string, format = ''): CodeInfo {
  const text = String(raw ?? '').trim();
  const fmt = format.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digits = digitsOf(text);
  const linear = /^(EAN|UPC|ISBN)/.test(fmt);
  if ((linear || !fmt || /^\d[\d\s-]+$/.test(text)) && /^\d{8,14}$|^\d{9}[\dX]$/i.test(digits)) {
    if (isIsbn(digits)) return { kind: 'isbn', raw: text, code: digits };
    if (isProductCode(digits)) return { kind: 'product', raw: text, code: digits };
  }
  const url = /^https?:\/\//i.test(text) ? urlParts(text) : /^www\.[^\s]+\.[a-z]{2,}/i.test(text) ? urlParts(`http://${text}`) : null;
  if (url) return { kind: 'url', raw: text, url };
  const wifi = parseWifi(text);
  if (wifi) return { kind: 'wifi', raw: text, wifi };
  const contact = parseVcard(text);
  if (contact) return { kind: 'contact', raw: text, contact };
  const geo = parseGeo(text);
  if (geo) return { kind: 'geo', raw: text, geo };
  const mail = text.match(/^mailto:([^?]*)(?:\?(.*))?$/i);
  if (mail) {
    const q = new URLSearchParams(mail[2] ?? '');
    return { kind: 'email', raw: text, email: { to: decodeURIComponent(mail[1] ?? ''), subject: q.get('subject') ?? '', body: q.get('body') ?? '' } };
  }
  const matmsg = text.match(/^MATMSG:TO:([^;]*);(?:SUB:([^;]*);)?(?:BODY:([^;]*);)?/i);
  if (matmsg) return { kind: 'email', raw: text, email: { to: matmsg[1] ?? '', subject: matmsg[2] ?? '', body: matmsg[3] ?? '' } };
  const tel = text.match(/^tel:([+\d\s().-]{3,})$/i);
  if (tel) return { kind: 'phone', raw: text, phone: tel[1]!.trim() };
  const sms = text.match(/^(?:smsto|sms):([+\d\s().-]{3,})(?::([\s\S]*))?(?:\?body=([\s\S]*))?$/i);
  if (sms) return { kind: 'sms', raw: text, sms: { to: sms[1]!.trim(), body: sms[2] ?? decodeURIComponent(sms[3] ?? '') } };
  return { kind: 'text', raw: text };
}

/** The scanned code as a few plain lines (what ASK GHOSTY and SAVE send). */
export function describeCode(c: CodeInfo): string {
  switch (c.kind) {
    case 'url':
      return [`A web address: ${c.url!.href}`, `Site: ${c.url!.domain}`, ...c.url!.warnings.map((w) => `Warning: ${w}`)].join('\n');
    case 'wifi':
      return `Wi-Fi network: ${c.wifi!.ssid || '(no name)'}\nSecurity: ${c.wifi!.security}${c.wifi!.hidden ? '\nHidden network' : ''}`;
    case 'contact': {
      const k = c.contact!;
      return [`Contact: ${k.name || '(no name)'}`, k.org && `Organisation: ${k.org}`, ...k.phones.map((p) => `Phone: ${p}`), ...k.emails.map((e) => `Email: ${e}`), ...k.urls.map((u) => `Web: ${u}`), k.address && `Address: ${k.address}`].filter(Boolean).join('\n');
    }
    case 'geo':
      return `A place: ${c.geo!.lat}, ${c.geo!.lon}${c.geo!.label ? ` (${c.geo!.label})` : ''}`;
    case 'email':
      return `An email to ${c.email!.to}${c.email!.subject ? `\nSubject: ${c.email!.subject}` : ''}${c.email!.body ? `\n${c.email!.body}` : ''}`;
    case 'phone':
      return `A phone number: ${c.phone}`;
    case 'sms':
      return `A text message to ${c.sms!.to}${c.sms!.body ? `: ${c.sms!.body}` : ''}`;
    case 'isbn':
      return `A book's barcode (ISBN ${c.code})`;
    case 'product':
      return `A product barcode: ${c.code}`;
    default:
      return c.raw;
  }
}
