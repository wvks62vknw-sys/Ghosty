/**
 * LINKS → EMAIL → TEST (planlane2:fixes, plan.u14): one sign-in to his mail with the address and app password he linked (IMAP, then
 * SMTP: the same check as when he linked it, integrations/mail.ts `testLogin`), reported as pass or fail. The answer carries only a
 * reason code, never the server's own text and never the password: the phone says each one in his words with the one next step
 * (apps/web/src/features/links/words.ts `emailTestWhy`).
 *
 *   POST /email/test → { works: true, address } | { works: false, why: EmailTestWhy, address? }
 */
import { MailError, parseEmailKey, testLogin, type MailOptions } from './integrations/mail';

/** Why a test did not pass: not linked, the database paused, the mail server out of reach (says nothing about the key), the server
 *  turned the sign-in down, IMAP switched off, the servers not known, an Outlook.com address, what was saved unusable, anything else. */
export type EmailTestWhy = 'not' | 'paused' | 'unreached' | 'signin' | 'imap' | 'servers' | 'outlook' | 'saved' | 'other';
export type EmailTest = { works: true; address: string } | { works: false; why: EmailTestWhy; address?: string };

/** A failed sign-in, as a reason code (the message is read here only to tell IMAP-off and unknown servers apart; it never leaves). */
export function emailFault(e: unknown): EmailTestWhy {
  if (!(e instanceof MailError)) return 'other';
  if (e.kind === 'unsupported') return 'outlook';
  if (e.kind === 'network') return 'unreached';
  if (e.kind === 'auth') return 'signin';
  if (e.kind === 'config') return /IMAP is switched off/i.test(e.message) ? 'imap' : /mail servers for|valid (host|mail server) name/i.test(e.message) ? 'servers' : 'saved';
  return 'other';
}

/** The test itself: `lookup` is the vault's (undefined while the database is paused), `o` the mail connector (a stand-in in tests). */
export async function emailTest(lookup: (name: string) => Promise<string | null | undefined>, o: MailOptions = {}): Promise<EmailTest> {
  const v = await lookup('email');
  if (v === undefined) return { works: false, why: 'paused' };
  if (!v) return { works: false, why: 'not' };
  let address: string | undefined;
  try {
    const cfg = parseEmailKey(v);
    address = cfg.address;
    await testLogin(cfg, { timeoutMs: 12_000, ...o });
    return { works: true, address: cfg.address };
  } catch (e) {
    return { works: false, why: emailFault(e), ...(address ? { address } : {}) };
  }
}
