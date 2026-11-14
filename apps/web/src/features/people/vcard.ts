/**
 * vCards for YOUR PEOPLE (APPS ROUND, MEMORY lane: "vCard import and export"): his own contacts file read on the phone, each card's
 * name, phones, emails, address and birthday, then kept on his brain through the people pack's own words (note, contact, birthday);
 * and everyone he told me about written back out as one .vcf for his phone's Contacts. Pure: the parser and writer are tested on their
 * own. Nothing is looked up about anyone: only what the file holds.
 */

export interface Card {
  name: string;
  phones: string[];
  emails: string[];
  address: string;
  /** "YYYY-MM-DD", or "--MM-DD" with no year. */
  born: string;
  note: string;
}

/** A vCard value back to plain text (\n, \, and \; undone). */
const unescape = (v: string): string => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
const escape = (v: string): string => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Every card in a .vcf file (3.0 or 4.0; folded lines unfolded). Cards with no name are left out; at most 500. */
export function parseVcf(text: string): Card[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: Card[] = [];
  let c: Card | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^BEGIN:VCARD$/i.test(line)) c = { name: '', phones: [], emails: [], address: '', born: '', note: '' };
    else if (/^END:VCARD$/i.test(line)) {
      if (c?.name) out.push(c);
      c = null;
    } else if (c) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0]!.replace(/^item\d+\./i, '').toUpperCase();
      const val = line.slice(i + 1);
      if (key === 'FN') c.name = unescape(val);
      else if (key === 'N' && !c.name) {
        const [family = '', given = ''] = val.split(';').map(unescape);
        c.name = `${given} ${family}`.trim();
      } else if (key === 'TEL' && val.trim()) c.phones.push(unescape(val).replace(/^tel:/i, ''));
      else if (key === 'EMAIL' && val.trim()) c.emails.push(unescape(val).replace(/^mailto:/i, ''));
      else if (key === 'ADR' && !c.address) c.address = val.split(';').map(unescape).filter(Boolean).join(', ');
      else if (key === 'BDAY') {
        const v = val.trim();
        const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(v) ?? /^--(\d{2})-?(\d{2})/.exec(v);
        if (m) c.born = m.length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `--${m[1]}-${m[2]}`;
      } else if (key === 'NOTE') c.note = unescape(val).slice(0, 200);
    }
    if (out.length >= 500) break;
  }
  return out;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** A birthday as he would say it ("12 June 1980", "12 June"), for the people pack's own words. */
export function bornWords(born: string): string {
  const m = /^(?:(\d{4})|-)-(\d{2})-(\d{2})$/.exec(born);
  if (!m) return '';
  const mo = MONTHS[Number(m[2]) - 1];
  return mo ? `${Number(m[3])} ${mo}${m[1] ? ` ${m[1]}` : ''}` : '';
}

/** What the brain is told for one card: the people pack's actions and their words, in order. */
export function cardSays(c: Card): { action: string; args: Record<string, string> }[] {
  const out: { action: string; args: Record<string, string> }[] = [{ action: 'note', args: { who: c.name, words: `${c.name}${c.note ? ` ${c.note}` : ' is in my contacts'}` } }];
  if (c.phones[0]) out.push({ action: 'contact', args: { who: c.name, words: `${c.name}'s number is ${c.phones[0]}` } });
  if (c.emails[0]) out.push({ action: 'contact', args: { who: c.name, words: `${c.name}'s email is ${c.emails[0]}` } });
  if (c.address) out.push({ action: 'contact', args: { who: c.name, words: `${c.name}'s address is ${c.address}` } });
  const b = bornWords(c.born);
  if (b) out.push({ action: 'birthday', args: { who: c.name, words: `${c.name}'s birthday is ${b}` } });
  return out;
}

/** Everyone, as one .vcf (vCard 3.0) for the phone's Contacts. */
export function writeVcf(people: { name: string; phone?: string; email?: string; address?: string; born?: string; rel?: string }[]): string {
  return people
    .filter((p) => p.name.trim())
    .map((p) => {
      const parts = p.name.trim().split(/\s+/);
      const family = parts.length > 1 ? parts[parts.length - 1]! : '';
      const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0]!;
      // (the people pack keeps "MM-DD" when he gave no year: vCard's "--MM-DD")
      const born = /^\d{4}-\d{2}-\d{2}$/.test(p.born ?? '') ? p.born : /^\d{2}-\d{2}$/.test(p.born ?? '') ? `--${p.born}` : '';
      return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escape(p.name.trim())}`, `N:${escape(family)};${escape(given)};;;`, p.phone ? `TEL;TYPE=CELL:${escape(p.phone)}` : '', p.email ? `EMAIL:${escape(p.email)}` : '', p.address ? `ADR;TYPE=HOME:;;${escape(p.address)};;;;` : '', born ? `BDAY:${born}` : '', p.rel ? `NOTE:${escape(p.rel)}` : '', 'END:VCARD'].filter(Boolean).join('\r\n');
    })
    .join('\r\n');
}
