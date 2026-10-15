/**
 * The owner's email (linked with an app password in System → Keys → Email): check, search
 * and read mail (nothing is marked read unless asked), and send as the owner (always approved).
 */
import { addressList, listMessages, parseEmailKey, readMessage, sendMessage, type ListQuery, type MailConfig, type MessageSummary } from '../integrations/mail';
import { asData } from '../kernel/permissions';
import { arg, clip, type Tool, type ToolContext } from './types';

const NOT_LINKED = 'Email is not linked yet. Ask the owner to link it in System → Keys → Email (app password): paste their address, a space, then an app password (for Gmail: myaccount.google.com/apppasswords).';

async function account(ctx: Pick<ToolContext, 'vault'>): Promise<MailConfig> {
  const v = await ctx.vault.get('email');
  if (!v) throw new Error(NOT_LINKED);
  return parseEmailKey(v);
}

function summary(cfg: MailConfig, total: number, list: MessageSummary[], what: string): string {
  if (!list.length) return `No ${what} in ${cfg.address}.`;
  const lines = list.map((m) => `- [uid ${m.uid}]${m.unread ? ' (unread)' : ''} ${m.date.replace(/\s*\([^)]*\)\s*$/, '')} · ${m.from.slice(0, 120)} — ${m.subject.slice(0, 200) || '(no subject)'}`);
  const head = `${total} ${what} in ${cfg.address}${total > list.length ? ` (newest ${list.length} shown)` : ''}. Use read_email with a uid to open one.`;
  return `${head}\n${asData(`the inbox of ${cfg.address}`, lines.join('\n'))}`;
}

function limitOf(a: Record<string, unknown>, fallback: number): number {
  return Math.max(1, Math.min(30, Math.floor(arg.num(a, 'limit', fallback))));
}

/** Who and what an outgoing message is, worked out (and checked) before the owner approves it. */
async function outgoing(a: Record<string, unknown>, ctx: ToolContext): Promise<{ cfg: MailConfig; to: string[]; cc: string[]; subject: string; body: string; inReplyTo: string; references: string; about: string }> {
  const cfg = await account(ctx);
  const body = arg.str(a, 'body');
  let to = addressList(a.to ?? []);
  const cc = addressList(a.cc ?? []);
  let subject = arg.str(a, 'subject', false).replace(/[\r\n]+/g, ' ').trim();
  let inReplyTo = typeof a.in_reply_to === 'string' ? a.in_reply_to : '';
  let references = typeof a.references === 'string' ? a.references : '';
  let about = typeof a.about === 'string' ? a.about : '';
  const uid = a.reply_to_uid === undefined || a.reply_to_uid === null || a.reply_to_uid === '' ? 0 : arg.num(a, 'reply_to_uid');
  if (uid) {
    const orig = await readMessage(cfg, uid);
    inReplyTo = orig.messageId;
    references = `${orig.references} ${orig.messageId}`.trim();
    if (!to.length) to = addressList(orig.replyTo || orig.from);
    if (!subject) subject = /^re:/i.test(orig.subject) ? orig.subject : `Re: ${orig.subject}`;
    about = `a reply to "${orig.subject.slice(0, 120)}" from ${orig.from.slice(0, 120)}`;
  }
  if (!to.length) throw new Error('who should it go to? Give "to" (one or more email addresses).');
  if (to.length + cc.length > 20) throw new Error('at most 20 recipients per email');
  if (!subject) throw new Error('missing "subject"');
  return { cfg, to, cc, subject: subject.slice(0, 300), body: body.slice(0, 100_000), inReplyTo, references, about };
}

export const emailTools: Tool[] = [
  {
    name: 'check_email',
    description: "Check the owner's email inbox: newest unread messages (sender, subject, date, uid). Set unread=false for the newest messages whether read or not. Does not mark anything read.",
    parameters: {
      type: 'object',
      properties: {
        unread: { type: 'boolean', description: 'only unread messages (default true)' },
        limit: { type: 'number', description: 'how many (default 10, max 30)' },
      },
    },
    risk: 'auto',
    async run(a, ctx) {
      const cfg = await account(ctx);
      const unread = arg.bool(a, 'unread', true);
      const r = await listMessages(cfg, { unread, limit: limitOf(a, 10) });
      return summary(cfg, r.total, r.messages, unread ? 'unread messages' : 'messages');
    },
  },
  {
    name: 'search_email',
    description: "Search the owner's email by sender, subject, words in the message, date and/or unread. Returns sender, subject, date and uid of the newest matches. Use read_email to open one.",
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'sender name or address contains' },
        subject: { type: 'string', description: 'subject contains' },
        text: { type: 'string', description: 'words anywhere in the message' },
        since: { type: 'string', description: 'only messages on or after this date (YYYY-MM-DD)' },
        unread: { type: 'boolean', description: 'only unread messages' },
        folder: { type: 'string', description: 'mailbox to search (default INBOX; Gmail sent mail: "[Gmail]/Sent Mail")' },
        limit: { type: 'number', description: 'how many (default 10, max 30)' },
      },
    },
    risk: 'auto',
    async run(a, ctx) {
      const cfg = await account(ctx);
      const query: ListQuery = {
        from: arg.str(a, 'from', false),
        subject: arg.str(a, 'subject', false),
        text: arg.str(a, 'text', false),
        since: arg.str(a, 'since', false),
        unread: arg.bool(a, 'unread', false),
        folder: arg.str(a, 'folder', false),
        limit: limitOf(a, 10),
      };
      const r = await listMessages(cfg, query);
      return summary(cfg, r.total, r.messages, 'matching messages');
    },
  },
  {
    name: 'read_email',
    description: "Open one email from the owner's mailbox by its uid (from check_email or search_email) and read its text. Does not mark it read unless mark_read is true.",
    parameters: {
      type: 'object',
      properties: {
        uid: { type: 'number' },
        mark_read: { type: 'boolean', description: 'also mark it as read (default false)' },
        folder: { type: 'string', description: 'mailbox (default INBOX)' },
      },
      required: ['uid'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const cfg = await account(ctx);
      const m = await readMessage(cfg, arg.num(a, 'uid'), { markRead: arg.bool(a, 'mark_read', false), folder: arg.str(a, 'folder', false) });
      const head = [
        `From: ${m.from}`,
        `To: ${m.to}`,
        ...(m.cc ? [`Cc: ${m.cc}`] : []),
        `Date: ${m.date}`,
        `Subject: ${m.subject || '(no subject)'}`,
        ...(m.attachments.length ? [`Attachments: ${m.attachments.slice(0, 20).join(', ')}`] : []),
      ].join('\n');
      const body = clip(m.text || '(no readable text)', 6000) + (m.truncated ? '\n…[message is long; only the start was downloaded]' : '');
      return `Email uid ${m.uid}${m.unread ? ' (still unread)' : ''}. To answer it, use send_email with reply_to_uid ${m.uid}.\n${asData(`email from ${m.from.slice(0, 120) || 'unknown sender'}`, `${head}\n\n${body}`)}`;
    },
  },
  {
    name: 'send_email',
    description: "Send an email as the owner from their linked address. Always needs the owner's approval. To reply, give reply_to_uid (the uid of the email being answered); to and subject are then filled in from it.",
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'recipient address(es), comma-separated' },
        cc: { type: 'string', description: 'copy to (optional), comma-separated' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'plain text of the message' },
        reply_to_uid: { type: 'number', description: 'uid of the email this replies to (optional)' },
      },
      required: ['body'],
    },
    risk: 'confirm',
    /** Pin exactly who it goes to and what it says, and show the owner. */
    async approval(a, ctx) {
      const m = await outgoing(a, ctx);
      const preview = m.body.length > 400 ? `${m.body.slice(0, 400)}…` : m.body;
      return {
        args: { to: m.to, cc: m.cc, subject: m.subject, body: m.body, in_reply_to: m.inReplyTo, references: m.references, about: m.about },
        reason: `Send an email from ${m.cfg.address} to ${m.to.join(', ')}${m.cc.length ? ` (cc ${m.cc.join(', ')})` : ''}${m.about ? ` — ${m.about}` : ''}? Subject: "${m.subject}". Message: "${preview}"`,
      };
    },
    async run(a, ctx) {
      const m = await outgoing(a, ctx);
      const r = await sendMessage(m.cfg, { to: m.to, cc: m.cc, subject: m.subject, body: m.body, inReplyTo: m.inReplyTo, references: m.references });
      return `Sent from ${m.cfg.address} to ${r.accepted.join(', ')}: "${m.subject}".`;
    },
  },
];
