/**
 * EMAIL TRIAGE INTO THE BRIEF, the brain's two small doors (BRIEF-OCT-IDEAS-2 8). Only when his own email is linked (LINKS → EMAIL,
 * the same app password the check_email tool uses): nothing here reads more than that tool already does.
 *   GET  /guardian/mail/inbox → { linked, address?, messages: [{ uid, from, name, address, subject, date }] }  his newest unread,
 *        the sender and the subject only (the phone decides which need an answer, and never sees a body);
 *   POST /guardian/mail/send  { reply_to_uid, subject, body, confirm: true } → { sent, to }  a REPLY, written and edited on his phone, sent on his
 *        SEND tap. It can only answer a message of his inbox: the recipient is that message's sender (or its Reply-To), never a
 *        name the phone supplies, so it cannot be used to write to anyone he was not already writing with.
 * (Mounted from guardian.ts: agent.ts is not touched. A route of its own under /email would be the tidier home: NEEDS HIS WORD.)
 */
import { addressList, listMessages, parseEmailKey, readMessage, sendMessage, type MailOptions } from './integrations/mail';
import type { GuardDeps } from './guardstate';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** "Sam Jones" <sam@example.com> → Sam Jones. */
function nameOf(from: string): string {
  const n = from.replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
  return n || (addressList(from)[0] ?? '').split('@')[0] || '';
}

export interface MailDeps {
  vault: Pick<GuardDeps['vault'], 'get'>;
  /** For the tests: the mail connection stood in. */
  mail?: MailOptions;
}

export async function mailRoute(req: Request, path: string, method: string, d: MailDeps): Promise<Response> {
  const key = await d.vault.get('email').catch(() => '');
  if (!key) return path === '/guardian/mail/inbox' && method === 'GET' ? json({ linked: false, messages: [] }) : json({ error: 'email is not linked' }, 400);
  let cfg;
  try {
    cfg = parseEmailKey(key);
  } catch (e) {
    return json({ error: String((e as Error).message).slice(0, 200) }, 400);
  }
  if (path === '/guardian/mail/inbox' && method === 'GET') {
    try {
      const r = await listMessages(cfg, { unread: true, limit: 12 }, d.mail);
      return json({
        linked: true,
        address: cfg.address,
        messages: r.messages.map((m) => ({ uid: m.uid, from: m.from.slice(0, 160), name: nameOf(m.from).slice(0, 80), address: addressList(m.from)[0] ?? '', subject: m.subject.slice(0, 200), date: m.date })),
      });
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e).slice(0, 200) }, 502);
    }
  }
  if (path === '/guardian/mail/send' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { reply_to_uid?: unknown; subject?: unknown; body?: unknown; confirm?: unknown };
    // nothing is sent without his tap: the phone sends `confirm: true` only from the SEND key of the draft he is looking at
    if (b.confirm !== true) return json({ error: 'your SEND is needed' }, 400);
    const uid = Number(b.reply_to_uid);
    const body = typeof b.body === 'string' ? b.body.trim() : '';
    const subject = typeof b.subject === 'string' ? b.subject.replace(/[\r\n]+/g, ' ').trim() : '';
    if (!Number.isInteger(uid) || uid <= 0) return json({ error: 'a reply answers one of your emails' }, 400);
    if (!body) return json({ error: 'there is nothing to send yet: write the reply first' }, 400);
    try {
      const orig = await readMessage(cfg, uid, d.mail);
      const to = addressList(orig.replyTo || orig.from);
      if (!to.length) return json({ error: 'that email has no address to answer' }, 400);
      const r = await sendMessage(cfg, { to, subject: (subject || (/^re:/i.test(orig.subject) ? orig.subject : `Re: ${orig.subject}`)).slice(0, 300), body: body.slice(0, 100_000), inReplyTo: orig.messageId, references: `${orig.references} ${orig.messageId}`.trim() }, d.mail);
      return json({ sent: true, to: r.accepted });
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e).slice(0, 200) }, 502);
    }
  }
  return json({ error: 'not found' }, 404);
}
