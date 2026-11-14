/** A bank statement download (OFX or QFX, the older SGML form or XML): every transaction, spending and money in apart. */
import { round, type Rec } from './input';

/** OFX's "20261114120000[0:GMT]" → 2026-11-14. */
export const ofxDay = (s: string): string => (/^(\d{4})(\d{2})(\d{2})/.test(s) ? s.replace(/^(\d{4})(\d{2})(\d{2}).*$/, '$1-$2-$3') : '');

export function statementRecords(text: string): Rec[] {
  const out: Rec[] = [];
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const body = block.split(/<\/STMTTRN>/i)[0];
    const tag = (t: string) => new RegExp(`<${t}>([^<\\r\\n]*)`, 'i').exec(body!)?.[1]?.trim() ?? '';
    const date = ofxDay(tag('DTPOSTED'));
    const amt = Number(tag('TRNAMT').replace(',', '.'));
    if (!date || !Number.isFinite(amt)) continue;
    const payee = tag('NAME') || tag('PAYEE') || tag('MEMO') || 'Transaction';
    const r: Rec = { _key: tag('FITID') || `${date}|${amt}|${payee}`, date, payee };
    if (amt < 0) r.spent = round(-amt, 2); else r.received = round(amt, 2);
    const memo = tag('MEMO');
    if (memo && memo !== payee) r.memo = memo;
    out.push(r);
  }
  return out;
}
