/**
 * MONEY, EFFORTLESS (THE APPS ROUND, the money lane): the two statement files UK banks give besides CSV and PDF, read in code on
 * their way to his own brain. OFX (Money / Quicken "web connect", SGML or XML: every <STMTTRN> with its date, amount, name and memo,
 * and the closing <LEDGERBAL>) and QIF (Quicken interchange: one record a "^", D date, T amount, P payee, M memo). Nothing here
 * reaches a bank or the network: it reads the text he gave.
 */
import type { Statement, Txn } from './spending';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** OFX's own tag value: `<TAG>value` (SGML, no closing tag) or `<TAG>value</TAG>` (XML). */
function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block);
  return (m?.[1] ?? '').trim();
}
/** "20261103120000[0:GMT]" or "20261103" → "2026-11-03". */
function ofxDate(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
const plain = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** True when the text is an OFX file (its header or its <OFX> root). */
export const isOfx = (text: string): boolean => /OFXHEADER\s*:|<\?OFX\b|<OFX>/i.test(text.slice(0, 4000));
/** True when the text is a QIF file (its "!Type:" header). */
export const isQif = (text: string): boolean => /^\s*!Type:/i.test(text);

/** An OFX statement's transactions, oldest first; `balance` is the closing ledger balance when the file gives one. */
export function readOfx(text: string): Statement & { balance?: { amount: number; on: string }; account?: string } {
  const rows: Txn[] = [];
  let skipped = 0;
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)) {
    const b = m[1]!;
    const d = ofxDate(tag(b, 'DTPOSTED') || tag(b, 'DTUSER'));
    const a = Number(tag(b, 'TRNAMT').replace(/,/g, ''));
    const words = plain([tag(b, 'NAME'), tag(b, 'MEMO')].filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(' '));
    if (!d || !Number.isFinite(a) || !words) {
      skipped++;
      continue;
    }
    rows.push({ d, t: words.slice(0, 120), a: r2(a) });
  }
  rows.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0));
  const bal = /<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>|<\/STMTRS>)/i.exec(text)?.[1];
  const balAmt = bal ? Number(tag(bal, 'BALAMT')) : NaN;
  const balOn = bal ? ofxDate(tag(bal, 'DTASOF')) : '';
  // the closing balance stands on the newest row of that day or before, so safe to spend can count from it
  if (Number.isFinite(balAmt) && rows.length) {
    let i = rows.length - 1;
    while (i > 0 && balOn && rows[i]!.d > balOn) i--;
    rows[i] = { ...rows[i]!, b: r2(balAmt) };
  }
  const org = tag(text, 'ORG');
  // the account, as its last four digits (never the whole number): "Account ending 4321"
  const acct = tag(text, 'ACCTID').replace(/\D/g, '').slice(-4);
  return { rows, shape: 'ofx', bank: org, skipped, ...(acct ? { account: `Account ending ${acct}` } : {}), ...(Number.isFinite(balAmt) ? { balance: { amount: r2(balAmt), on: balOn } } : {}) };
}

/** "03/11/2026", "3/11/26", "11/03'26" (US, when the first part is over 12 the other way), "2026-11-03" → "2026-11-03". */
function qifDate(s: string): string {
  const t = s.trim().replace(/'/g, '/').replace(/\s+/g, '');
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (!m) return '';
  let day = +m[1]!;
  let mon = +m[2]!;
  // UK files put the day first; a month over 12 means the file is American (month first)
  if (mon > 12 && day <= 12) [day, mon] = [mon, day];
  const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return '';
  return `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A QIF statement's transactions, oldest first. */
export function readQif(text: string): Statement {
  const rows: Txn[] = [];
  let skipped = 0;
  for (const rec of text.split(/^\^\s*$/m)) {
    let d = '';
    let a = NaN;
    const words: string[] = [];
    for (const line of rec.split(/\r?\n/)) {
      const k = line.charAt(0);
      const v = line.slice(1).trim();
      if (k === 'D') d = qifDate(v);
      else if (k === 'T' || k === 'U') a = Number(v.replace(/[£,\s]/g, ''));
      else if ((k === 'P' || k === 'M') && v && !words.includes(v)) words.push(v);
    }
    if (!d && !words.length && !Number.isFinite(a)) continue;
    if (!d || !Number.isFinite(a) || !words.length) {
      skipped++;
      continue;
    }
    rows.push({ d, t: plain(words.join(' ')).slice(0, 120), a: r2(a) });
  }
  rows.sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0));
  return { rows, shape: 'qif', bank: '', skipped };
}
