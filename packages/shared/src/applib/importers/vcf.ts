/** A contacts file (.vcf, exported from his address book): one card per person, the details he saved. No stats rank anyone. */
import { parseDay, propLine, unescapeText, unfold, type Rec } from './input';

export function contactRecords(text: string): Rec[] {
  const out: Rec[] = [];
  let c: Record<string, string> | null = null;
  for (const line of unfold(text)) {
    const p = propLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN' && /^VCARD$/i.test(p.value)) { c = {}; continue; }
    if (p.name === 'END' && /^VCARD$/i.test(p.value)) {
      if (c) {
        const n = (c.N ?? '').split(';').map(unescapeText);
        const name = unescapeText(c.FN ?? '') || [n[1], n[0]].filter(Boolean).join(' ') || unescapeText(c.ORG ?? '').split(';')[0];
        if (name) {
          const r: Rec = { _key: c.UID || `${name}|${c.TEL ?? c.EMAIL ?? ''}`, name };
          if (c.TEL) r.phone = c.TEL.replace(/^tel:/i, '');
          if (c.EMAIL) r.email = c.EMAIL.replace(/^mailto:/i, '');
          if (c.ORG) r.org = unescapeText(c.ORG).split(';').filter(Boolean).join(', ');
          const bday = c.BDAY ? /^(\d{4})-?(\d{2})-?(\d{2})/.exec(c.BDAY) : null;
          if (bday && bday[1] !== '1604') r.birthday = `${bday[1]}-${bday[2]}-${bday[3]}`;
          else if (c.BDAY) { const d = parseDay(c.BDAY); if (d) r.birthday = d; }
          if (c.NOTE) r.note = unescapeText(c.NOTE);
          out.push(r);
        }
      }
      c = null;
      continue;
    }
    if (c && !(p.name in c) && p.name !== 'PHOTO') c[p.name] = p.value;
  }
  return out;
}
