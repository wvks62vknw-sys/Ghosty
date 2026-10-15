/**
 * Email over IMAP (read) and SMTP (send) with an app password, on Cloudflare TCP sockets.
 * Small and bounded on purpose: every read has a timeout, messages are fetched partially,
 * and MIME parsing caps parts and sizes. The socket connector is injectable for tests.
 */

export interface SocketLike {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  closed?: Promise<unknown>;
  close(): Promise<void> | void;
  startTls?(): SocketLike;
}

export type Connect = (host: string, port: number, tls: 'on' | 'starttls') => Promise<SocketLike>;

export interface MailConfig {
  address: string;
  password: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  smtpTls: 'on' | 'starttls';
}

export interface MailOptions {
  connect?: Connect;
  /** Per-read timeout in milliseconds (default 15 s). */
  timeoutMs?: number;
}

export interface MessageSummary {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  unread: boolean;
  messageId: string;
}

export interface FullMessage extends MessageSummary {
  cc: string;
  replyTo: string;
  references: string;
  text: string;
  attachments: string[];
  truncated: boolean;
}

export type MailErrorKind = 'auth' | 'network' | 'config' | 'unsupported' | 'protocol' | 'notfound';

export class MailError extends Error {
  kind: MailErrorKind;
  constructor(kind: MailErrorKind, message: string) {
    super(message);
    this.name = 'MailError';
    this.kind = kind;
  }
}

/** The real connector: Cloudflare Workers TCP sockets, loaded only when mail is used. */
export const defaultConnect: Connect = async (host, port, tls) => {
  const { connect } = await import('cloudflare:sockets');
  return connect({ hostname: host, port }, { secureTransport: tls, allowHalfOpen: false });
};

// ---------- account presets and the key format ----------

interface Preset {
  imap: string;
  smtp: string;
  smtpPort: number;
  smtpTls: 'on' | 'starttls';
  name: string;
}

const GMAIL: Preset = { imap: 'imap.gmail.com', smtp: 'smtp.gmail.com', smtpPort: 465, smtpTls: 'on', name: 'Gmail' };
const ICLOUD: Preset = { imap: 'imap.mail.me.com', smtp: 'smtp.mail.me.com', smtpPort: 587, smtpTls: 'starttls', name: 'iCloud' };
const YAHOO: Preset = { imap: 'imap.mail.yahoo.com', smtp: 'smtp.mail.yahoo.com', smtpPort: 465, smtpTls: 'on', name: 'Yahoo' };
const FASTMAIL: Preset = { imap: 'imap.fastmail.com', smtp: 'smtp.fastmail.com', smtpPort: 465, smtpTls: 'on', name: 'Fastmail' };
const AOL: Preset = { imap: 'imap.aol.com', smtp: 'smtp.aol.com', smtpPort: 465, smtpTls: 'on', name: 'AOL' };

export const PRESETS: Record<string, Preset> = {
  'gmail.com': GMAIL,
  'googlemail.com': GMAIL,
  'icloud.com': ICLOUD,
  'me.com': ICLOUD,
  'mac.com': ICLOUD,
  'yahoo.com': YAHOO,
  'ymail.com': YAHOO,
  'fastmail.com': FASTMAIL,
  'fastmail.fm': FASTMAIL,
  'aol.com': AOL,
};

const OUTLOOK_DOMAIN = /^(outlook|hotmail|live|msn|passport)\.[a-z.]+$/i;
const OUTLOOK_HOST = /(^|\.)(outlook\.com|office365\.com|hotmail\.com|live\.com)$/i;
export const OUTLOOK_MESSAGE =
  'Outlook.com, Hotmail and Live accounts can no longer be linked with an app password: Microsoft turned off password sign-in for IMAP/SMTP and only allows its own OAuth sign-in. Use a Gmail, iCloud, Yahoo or Fastmail address instead (you can forward your Outlook mail to it).';

const EMAIL_RE = /^[^\s<>@,;:"()[\]\\]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/i;

function hostPort(tok: string, fallback: number): [string, number] {
  const [h, p] = tok.toLowerCase().split(':');
  const port = p ? Number(p) : fallback;
  if (!h || !Number.isInteger(port) || port < 1 || port > 65535) throw new MailError('config', `"${tok}" is not a valid host name`);
  return [h, port];
}

function checkHosts(cfg: MailConfig): MailConfig {
  if (!cfg.password) throw new MailError('config', 'the app password is missing: put it after your email address, separated by a space');
  if (OUTLOOK_HOST.test(cfg.imapHost) || OUTLOOK_HOST.test(cfg.smtpHost)) throw new MailError('unsupported', OUTLOOK_MESSAGE);
  for (const h of [cfg.imapHost, cfg.smtpHost]) if (!HOST_RE.test(h) || /^(localhost|[\d.]+)$/i.test(h)) throw new MailError('config', `"${h}" is not a valid mail server name`);
  return cfg;
}

/**
 * Reads the vault value for the 'email' key. Accepted forms:
 *   `you@gmail.com app-password`                       (known providers)
 *   `you@domain.com password imap.host smtp.host`       (any server; optional :port on each)
 *   a JSON MailConfig object
 */
export function parseEmailKey(value: string): MailConfig {
  const v = String(value ?? '').trim();
  if (!v) throw new MailError('config', 'no email account is linked');
  if (v.startsWith('{')) {
    let j: Partial<MailConfig>;
    try {
      j = JSON.parse(v) as Partial<MailConfig>;
    } catch {
      throw new MailError('config', 'the saved email settings are not valid JSON');
    }
    const address = String(j.address ?? '').trim();
    if (!EMAIL_RE.test(address)) throw new MailError('config', 'the saved email settings have no valid address');
    const domain = address.split('@')[1]!.toLowerCase();
    if (OUTLOOK_DOMAIN.test(domain)) throw new MailError('unsupported', OUTLOOK_MESSAGE);
    const p = PRESETS[domain];
    const imapHost = String(j.imapHost ?? p?.imap ?? '').toLowerCase();
    const smtpHost = String(j.smtpHost ?? p?.smtp ?? '').toLowerCase();
    if (!imapHost || !smtpHost) throw new MailError('config', `I don't know the mail servers for ${domain}; add imapHost and smtpHost`);
    const smtpPort = Number(j.smtpPort ?? (j.smtpHost ? 465 : p?.smtpPort ?? 465));
    return checkHosts({
      address,
      password: String(j.password ?? ''),
      imapHost,
      imapPort: Number(j.imapPort ?? 993),
      smtpHost,
      smtpPort,
      smtpTls: j.smtpTls === 'starttls' || j.smtpTls === 'on' ? j.smtpTls : smtpPort === 587 || smtpPort === 25 ? 'starttls' : 'on',
    });
  }
  let toks = v.split(/\s+/);
  let address = toks[0] ?? '';
  // The address and password pasted with no space between them (some forms strip spaces).
  if (toks.length === 1 && address.includes('@')) {
    const [local, rest] = address.split('@') as [string, string];
    const dom = Object.keys(PRESETS).find((d) => rest.toLowerCase().startsWith(d) && rest.length > d.length);
    if (dom) toks = [`${local}@${rest.slice(0, dom.length)}`, rest.slice(dom.length)];
    address = toks[0] ?? '';
  }
  if (!EMAIL_RE.test(address)) throw new MailError('config', 'start with your email address, then a space, then the app password (for example: you@gmail.com abcd efgh ijkl mnop)');
  const domain = address.split('@')[1]!.toLowerCase();
  if (OUTLOOK_DOMAIN.test(domain)) throw new MailError('unsupported', OUTLOOK_MESSAGE);
  let rest = toks.slice(1);
  let hosts: string[] = [];
  if (rest.length >= 3 && HOST_RE.test(rest[rest.length - 1]!) && HOST_RE.test(rest[rest.length - 2]!)) {
    hosts = rest.slice(-2);
    rest = rest.slice(0, -2);
  }
  if (!rest.length) throw new MailError('config', 'the app password is missing: put it after your email address, separated by a space');
  // Gmail and Yahoo show app passwords as four groups of four letters; the spaces are not part of it.
  const password = rest.length > 1 && rest.every((t) => /^[a-z0-9]{4}$/i.test(t)) ? rest.join('') : rest.join(' ');
  const preset = PRESETS[domain];
  let cfg: MailConfig;
  if (hosts.length) {
    const [imapHost, imapPort] = hostPort(hosts[0]!, 993);
    const [smtpHost, smtpPort] = hostPort(hosts[1]!, 465);
    cfg = { address, password, imapHost, imapPort, smtpHost, smtpPort, smtpTls: smtpPort === 587 || smtpPort === 25 ? 'starttls' : 'on' };
  } else if (preset) {
    cfg = { address, password, imapHost: preset.imap, imapPort: 993, smtpHost: preset.smtp, smtpPort: preset.smtpPort, smtpTls: preset.smtpTls };
  } else {
    throw new MailError('config', `I don't know the mail servers for ${domain}. Add them after the password: ${address} password imap.${domain} smtp.${domain} (Google Workspace: imap.gmail.com smtp.gmail.com).`);
  }
  return checkHosts(cfg);
}

function providerName(cfg: MailConfig): string {
  const p = Object.values(PRESETS).find((x) => x.imap === cfg.imapHost || x.smtp === cfg.smtpHost);
  return p?.name ?? cfg.imapHost;
}

function authHelp(cfg: MailConfig, server: string): string {
  const name = providerName(cfg);
  const said = server ? ` (server said: ${clean(server).slice(0, 160)})` : '';
  if (name === 'Gmail') return `Gmail rejected the password — use an App Password (myaccount.google.com/apppasswords, needs 2-Step Verification), not your normal Google password${said}.`;
  if (name === 'iCloud') return `iCloud rejected the password — use an app-specific password from account.apple.com → Sign-In and Security → App-Specific Passwords${said}.`;
  if (name === 'Yahoo' || name === 'AOL') return `${name} rejected the password — generate an app password in your ${name} account security settings and use that${said}.`;
  return `${name} rejected the address or password. If your provider offers app passwords, use one${said}.`;
}

/** Server text made safe to show: printable, single line. */
function clean(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------- bytes, strings and the line reader ----------

const enc = new TextEncoder();
const MAX_LINE = 2_000_000;
const MAX_LITERAL = 4_000_000;
export const BODY_LIMIT = 200_000;

/** Bytes → "binary string" (one char per byte), so MIME can be parsed before charset decoding. */
function bin(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
}

function bytesOf(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
  return b;
}

function errText(e: unknown): string {
  return String((e as Error)?.message ?? e).slice(0, 120);
}

class Conn {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buf = new Uint8Array(0);

  constructor(
    private sock: SocketLike,
    private timeout: number,
    readonly where: string,
  ) {
    this.reader = sock.readable.getReader();
    this.writer = sock.writable.getWriter();
  }

  private async fill(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new MailError('network', `${this.where} did not answer within ${Math.round(this.timeout / 1000)} s`)), this.timeout);
    });
    try {
      const r = await Promise.race([this.reader.read(), late]);
      if (r.done || !r.value) throw new MailError('network', `${this.where} closed the connection`);
      const next = new Uint8Array(this.buf.length + r.value.length);
      next.set(this.buf);
      next.set(r.value, this.buf.length);
      this.buf = next;
    } catch (e) {
      if (e instanceof MailError) throw e;
      throw new MailError('network', `could not talk to ${this.where} (${errText(e)})`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** One line without its CRLF, as a binary string. */
  async readLine(): Promise<string> {
    let from = 0;
    for (;;) {
      const i = this.buf.indexOf(10, from);
      if (i >= 0) {
        const line = this.buf.subarray(0, i > 0 && this.buf[i - 1] === 13 ? i - 1 : i);
        this.buf = this.buf.subarray(i + 1);
        return bin(line);
      }
      if (this.buf.length > MAX_LINE) throw new MailError('protocol', `${this.where} sent a line that is too long`);
      from = this.buf.length;
      await this.fill();
    }
  }

  async readBytes(n: number): Promise<string> {
    while (this.buf.length < n) await this.fill();
    const out = this.buf.subarray(0, n);
    this.buf = this.buf.subarray(n);
    return bin(out);
  }

  async write(data: string | Uint8Array): Promise<void> {
    try {
      await this.writer.write(typeof data === 'string' ? enc.encode(data) : data);
    } catch (e) {
      throw new MailError('network', `could not send to ${this.where} (${errText(e)})`);
    }
  }

  /** Switch a plain connection to TLS (SMTP STARTTLS). */
  startTls(): void {
    if (!this.sock.startTls) throw new MailError('protocol', `${this.where} needs STARTTLS, which this connection cannot do`);
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.sock = this.sock.startTls();
    this.reader = this.sock.readable.getReader();
    this.writer = this.sock.writable.getWriter();
    this.buf = new Uint8Array(0);
  }

  close(): void {
    try {
      this.reader.cancel().catch(() => undefined);
      this.writer.close().catch(() => undefined);
    } catch {
      /* already closed */
    }
    try {
      Promise.resolve(this.sock.close()).catch(() => undefined);
    } catch {
      /* already closed */
    }
  }
}

async function open(host: string, port: number, tls: 'on' | 'starttls', o: MailOptions): Promise<Conn> {
  const where = `${host}:${port}`;
  try {
    const s = await (o.connect ?? defaultConnect)(host, port, tls);
    return new Conn(s, o.timeoutMs ?? 15_000, where);
  } catch (e) {
    throw new MailError('network', `could not connect to ${where} (${errText(e)}). Check the server name.`);
  }
}

// ---------- IMAP ----------

type Arg = string | { lit: Uint8Array };

/** IMAP string argument: quoted when plain ASCII, otherwise sent as a literal. */
function q(s: string): Arg {
  if (/^[\x20-\x7e]*$/.test(s)) return `"${s.replace(/[\\"]/g, (m) => `\\${m}`)}"`;
  return { lit: enc.encode(s) };
}

/** One server response; literals are cut out into `lits` and marked by \0N\0 in `text`. */
interface Resp {
  text: string;
  lits: string[];
}

class Imap {
  private n = 0;

  constructor(
    private c: Conn,
    private cfg: MailConfig,
  ) {}

  private async resp(): Promise<Resp> {
    let line = await this.c.readLine();
    let text = '';
    const lits: string[] = [];
    for (;;) {
      const m = line.match(/\{(\d+)\}$/);
      if (!m) return { text: text + line, lits };
      const size = Number(m[1]);
      if (size > MAX_LITERAL) throw new MailError('protocol', 'the mail server sent a message that is too large');
      text += `${line.slice(0, line.length - m[0].length)}\u0000${lits.length}\u0000`;
      lits.push(await this.c.readBytes(size));
      line = await this.c.readLine();
    }
  }

  async greet(): Promise<void> {
    const r = await this.resp();
    if (!/^\* (OK|PREAUTH)\b/i.test(r.text)) throw new MailError('protocol', `${this.c.where} is not answering like a mail (IMAP) server: ${clean(r.text).slice(0, 120)}`);
  }

  async cmd(args: Arg[], what: string): Promise<Resp[]> {
    const tag = `G${++this.n}`;
    let line = tag;
    for (const a of args) {
      if (typeof a === 'string') {
        line += ` ${a}`;
        continue;
      }
      await this.c.write(`${line} {${a.lit.length}}\r\n`);
      for (;;) {
        const r = await this.resp();
        if (r.text.startsWith('+')) break;
        if (r.text.startsWith(`${tag} `)) throw this.fail(what, r.text.slice(tag.length + 1));
      }
      await this.c.write(a.lit);
      line = '';
    }
    await this.c.write(`${line}\r\n`);
    const out: Resp[] = [];
    for (;;) {
      const r = await this.resp();
      if (r.text.startsWith(`${tag} `)) {
        const rest = r.text.slice(tag.length + 1);
        if (!/^OK\b/i.test(rest)) throw this.fail(what, rest);
        return out;
      }
      if (out.length < 10_000) out.push(r);
    }
  }

  private fail(what: string, rest: string): MailError {
    if (/\bIMAP (access )?(is )?(disabled|not enabled)|enable IMAP/i.test(rest)) return new MailError('config', `IMAP is switched off for ${this.cfg.address}. Turn it on in your mail settings (Gmail: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP).`);
    if (what === 'login' && /^NO\b/i.test(rest)) return new MailError('auth', authHelp(this.cfg, rest.replace(/^NO\s*/i, '')));
    return new MailError(/NONEXISTENT|doesn't exist|not exist|unknown mailbox/i.test(rest) ? 'notfound' : 'protocol', `the mail server refused ${what}: ${clean(rest).slice(0, 160)}`);
  }

  async login(): Promise<void> {
    await this.cmd(['LOGIN', q(this.cfg.address), q(this.cfg.password)], 'login');
  }

  async logout(): Promise<void> {
    await this.cmd(['LOGOUT'], 'logout').catch(() => undefined);
  }
}

async function withImap<T>(cfg: MailConfig, o: MailOptions, fn: (s: Imap) => Promise<T>): Promise<T> {
  const c = await open(cfg.imapHost, cfg.imapPort, 'on', o);
  try {
    const s = new Imap(c, cfg);
    await s.greet();
    await s.login();
    const out = await fn(s);
    await s.logout();
    return out;
  } finally {
    c.close();
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function imapDate(s: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? new Date(`${s.trim()}T00:00:00Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) throw new MailError('config', `"${s}" is not a date I understand (use YYYY-MM-DD)`);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

function mailbox(folder?: string): Arg {
  const f = (folder ?? '').replace(/[\r\n]/g, '').trim();
  return !f || /^inbox$/i.test(f) ? 'INBOX' : q(f.slice(0, 200));
}

/** Body of a FETCH response: the literal, or a quoted string, or NIL. */
function fetchedBody(r: Resp): string {
  const lit = r.text.match(/BODY\[[^\]]*\](?:<\d+>)?\s*\u0000(\d+)\u0000/i);
  if (lit) return r.lits[Number(lit[1])] ?? '';
  const quoted = r.text.match(/BODY\[[^\]]*\](?:<\d+>)?\s*"((?:[^"\\]|\\.)*)"/i);
  return quoted ? quoted[1]!.replace(/\\(.)/g, '$1') : '';
}

export interface ListQuery {
  unread?: boolean;
  since?: string;
  from?: string;
  subject?: string;
  text?: string;
  limit?: number;
  folder?: string;
}

/** Newest first. `total` is how many messages matched before the limit. */
export async function listMessages(cfg: MailConfig, query: ListQuery, o: MailOptions = {}): Promise<{ total: number; messages: MessageSummary[] }> {
  const crit: Arg[] = [];
  let utf8 = false;
  const str = (key: string, v?: string) => {
    const s = (v ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, 200);
    if (!s) return;
    const a = q(s);
    if (typeof a !== 'string') utf8 = true;
    crit.push(key, a);
  };
  if (query.unread) crit.push('UNSEEN');
  if (query.since) crit.push('SINCE', imapDate(query.since));
  str('FROM', query.from);
  str('SUBJECT', query.subject);
  str('TEXT', query.text);
  if (!crit.length) crit.push('ALL');
  const limit = Math.max(1, Math.min(50, Math.floor(query.limit ?? 10)));
  return withImap(cfg, o, async (s) => {
    await s.cmd(['EXAMINE', mailbox(query.folder)], 'to open the mailbox');
    const found = await s.cmd(['UID SEARCH', ...(utf8 ? ['CHARSET UTF-8'] : []), ...crit], 'the search');
    const uids: number[] = [];
    for (const r of found) {
      const m = r.text.match(/^\* SEARCH\b(.*)$/i);
      if (m) for (const x of m[1]!.trim().split(/\s+/)) if (/^\d+$/.test(x)) uids.push(Number(x));
    }
    uids.sort((a, b) => b - a);
    const pick = uids.slice(0, limit);
    if (!pick.length) return { total: 0, messages: [] };
    const got = await s.cmd([`UID FETCH ${pick.join(',')} (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)])`], 'to fetch the messages');
    const byUid = new Map<number, MessageSummary>();
    for (const r of got) {
      const uid = Number(r.text.match(/\bUID (\d+)/i)?.[1] ?? NaN);
      if (!Number.isFinite(uid) || !/\bFETCH\b/i.test(r.text)) continue;
      const h = parseHeaders(fetchedBody(r));
      const flags = r.text.match(/FLAGS \(([^)]*)\)/i)?.[1];
      const prev = byUid.get(uid);
      byUid.set(uid, {
        uid,
        from: decodeHeader(h.get('from') ?? prev?.from ?? ''),
        to: decodeHeader(h.get('to') ?? prev?.to ?? ''),
        subject: decodeHeader(h.get('subject') ?? prev?.subject ?? ''),
        date: h.get('date') ?? prev?.date ?? '',
        unread: flags !== undefined ? !/\\Seen/i.test(flags) : prev?.unread ?? true,
        messageId: h.get('message-id') ?? prev?.messageId ?? '',
      });
    }
    return { total: uids.length, messages: pick.map((u) => byUid.get(u)).filter((m): m is MessageSummary => !!m) };
  });
}

/** One message, parsed to text. Nothing is marked read unless `markRead` is set. */
export async function readMessage(cfg: MailConfig, uid: number, o: MailOptions & { markRead?: boolean; folder?: string } = {}): Promise<FullMessage> {
  if (!Number.isInteger(uid) || uid < 1) throw new MailError('config', 'the message id must be a positive whole number (the uid from check_email)');
  return withImap(cfg, o, async (s) => {
    await s.cmd([o.markRead ? 'SELECT' : 'EXAMINE', mailbox(o.folder)], 'to open the mailbox');
    const got = await s.cmd([`UID FETCH ${uid} (UID FLAGS RFC822.SIZE BODY.PEEK[]<0.${BODY_LIMIT}>)`], 'to fetch the message');
    const r = got.find((x) => /\bFETCH\b/i.test(x.text) && new RegExp(`\\bUID ${uid}\\b`).test(x.text) && /BODY\[/i.test(x.text));
    if (!r) throw new MailError('notfound', `there is no message with id ${uid} in ${o.folder || 'the inbox'}`);
    const raw = fetchedBody(r);
    const size = Number(r.text.match(/RFC822\.SIZE (\d+)/i)?.[1] ?? raw.length);
    const flags = r.text.match(/FLAGS \(([^)]*)\)/i)?.[1] ?? '';
    if (o.markRead) await s.cmd([`UID STORE ${uid} +FLAGS.SILENT (\\Seen)`], 'to mark it read');
    const p = parseMessage(raw);
    const h = p.headers;
    return {
      uid,
      from: decodeHeader(h.get('from') ?? ''),
      to: decodeHeader(h.get('to') ?? ''),
      cc: decodeHeader(h.get('cc') ?? ''),
      replyTo: decodeHeader(h.get('reply-to') ?? ''),
      subject: decodeHeader(h.get('subject') ?? ''),
      date: h.get('date') ?? '',
      messageId: h.get('message-id') ?? '',
      references: h.get('references') ?? '',
      unread: !o.markRead && !/\\Seen/i.test(flags),
      text: p.text,
      attachments: p.attachments,
      truncated: size > raw.length,
    };
  });
}

// ---------- MIME ----------

const LATIN = new Set(['iso-8859-1', 'latin1', 'latin-1', 'windows-1252', 'cp1252', 'us-ascii', 'ascii']);

export function decodeBytes(b: Uint8Array, charset = 'utf-8'): string {
  const label = charset.trim().replace(/^"|"$/g, '').toLowerCase() || 'utf-8';
  if (label === 'us-ascii' || label === 'ascii' || label === 'utf8') return new TextDecoder('utf-8').decode(b);
  try {
    return new TextDecoder(label).decode(b);
  } catch {
    return LATIN.has(label) ? bin(b) : new TextDecoder('utf-8').decode(b);
  }
}

/** Raw 8-bit header text: UTF-8 when it is valid UTF-8, otherwise Latin-1. */
function plain8(s: string): string {
  if (!/[\x80-\xff]/.test(s)) return s;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytesOf(s));
  } catch {
    return s;
  }
}

function b64bytes(s: string): Uint8Array {
  let c = s.replace(/[^A-Za-z0-9+/]/g, '');
  const r = c.length % 4;
  if (r === 1) c = c.slice(0, -1);
  else if (r) c += '='.repeat(4 - r);
  try {
    return bytesOf(atob(c));
  } catch {
    return new Uint8Array(0);
  }
}

function qpBytes(s: string, header = false): Uint8Array {
  const t = header ? s.replace(/_/g, ' ') : s.replace(/=\r?\n/g, '');
  const out = new Uint8Array(t.length);
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    const hex = t[i] === '=' ? t.slice(i + 1, i + 3) : '';
    if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
      out[n++] = parseInt(hex, 16);
      i += 2;
    } else out[n++] = t.charCodeAt(i) & 255;
  }
  return out.subarray(0, n);
}

/** RFC 2047 encoded words (=?utf-8?B?…?= / =?iso-8859-1?Q?…?=) and raw 8-bit text, to a normal string. */
export function decodeHeader(v: string): string {
  const re = /=\?([^?\s]+)\?([bBqQ])\?([^?\s]*)\?=/g;
  let out = '';
  let last = 0;
  let prevEnd = -1;
  let cs = '';
  let pend: number[] = [];
  const flush = () => {
    if (pend.length) out += decodeBytes(Uint8Array.from(pend), cs);
    pend = [];
  };
  for (const m of v.matchAll(re)) {
    const at = m.index ?? 0;
    const gap = v.slice(last, at);
    const joined = prevEnd === last && /^\s*$/.test(gap);
    const charset = (m[1] ?? '').split('*')[0]!.toLowerCase();
    const bytes = /b/i.test(m[2] ?? '') ? b64bytes(m[3] ?? '') : qpBytes(m[3] ?? '', true);
    if (!joined || charset !== cs) flush();
    if (!joined) out += plain8(gap);
    cs = charset;
    for (const x of bytes) pend.push(x);
    last = at + m[0].length;
    prevEnd = last;
  }
  flush();
  out += plain8(v.slice(last));
  return out.replace(/\s+/g, ' ').trim();
}

/** Header block → lower-case name → unfolded value (first occurrence wins). */
export function parseHeaders(head: string): Map<string, string> {
  const h = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    const name = line.slice(0, i).trim().toLowerCase();
    if (!h.has(name) && h.size < 200) h.set(name, line.slice(i + 1).trim());
  }
  return h;
}

function splitMessage(raw: string): { headers: Map<string, string>; body: string } {
  if (/^\r?\n/.test(raw)) return { headers: new Map(), body: raw.replace(/^\r?\n/, '') };
  const m = raw.match(/\r?\n\r?\n/);
  if (!m || m.index === undefined) return { headers: parseHeaders(raw), body: '' };
  return { headers: parseHeaders(raw.slice(0, m.index)), body: raw.slice(m.index + m[0].length) };
}

/** `type/sub; a=b; c="d"` → value and lower-case params (RFC 2231 `name*=utf-8''…` decoded). */
function headerParams(v: string): { value: string; params: Record<string, string> } {
  const value = (v.split(';')[0] ?? '').trim().toLowerCase();
  const params: Record<string, string> = {};
  for (const m of v.matchAll(/;\s*([^=\s;]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/g)) {
    let key = (m[1] ?? '').toLowerCase();
    let val = (m[2] ?? '').trim();
    if (val.startsWith('"')) val = val.slice(1, -1).replace(/\\(.)/g, '$1');
    if (key.endsWith('*')) {
      key = key.slice(0, -1);
      const parts = val.split("'");
      if (parts.length >= 3) {
        const pct = parts.slice(2).join("'").replace(/%([0-9A-Fa-f]{2})/g, (_, x: string) => String.fromCharCode(parseInt(x, 16)));
        val = decodeBytes(bytesOf(pct), parts[0] || 'utf-8');
      }
    }
    if (!(key in params)) params[key] = val;
  }
  return { value, params };
}

function splitMultipart(body: string, boundary: string): string[] {
  const delim = `--${boundary}`;
  const parts: string[] = [];
  let cur: string[] | null = null;
  for (const line of body.split(/\r?\n/)) {
    if (line.startsWith(delim)) {
      const rest = line.slice(delim.length);
      if (rest.startsWith('--')) {
        if (cur) parts.push(cur.join('\r\n'));
        return parts;
      }
      if (/^\s*$/.test(rest)) {
        if (cur) parts.push(cur.join('\r\n'));
        if (parts.length >= 60) return parts;
        cur = [];
        continue;
      }
    }
    if (cur) cur.push(line);
  }
  if (cur) parts.push(cur.join('\r\n'));
  return parts;
}

function transferDecode(body: string, cte?: string): Uint8Array {
  const t = (cte ?? '').trim().toLowerCase();
  if (t === 'base64') return b64bytes(body);
  if (t === 'quoted-printable') return qpBytes(body);
  return bytesOf(body);
}

/** HTML mail → readable text (tags dropped, common entities decoded). */
export function htmlText(html: string): string {
  return html
    .replace(/<(head|script|style|noscript|svg|title)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|table|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d{1,6});/g, (_, n: string) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, n: string) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Found {
  plain: string[];
  html: string[];
  files: string[];
}

function walk(raw: string, f: Found, depth: number): void {
  if (f.plain.length + f.html.length + f.files.length >= 60) return;
  const { headers, body } = splitMessage(raw);
  const ct = headerParams(headers.get('content-type') ?? 'text/plain');
  const disp = headerParams(headers.get('content-disposition') ?? '');
  const name = decodeHeader(disp.params.filename ?? ct.params.name ?? '');
  const type = ct.value || 'text/plain';
  if (type.startsWith('multipart/') && ct.params.boundary && depth < 8) {
    for (const part of splitMultipart(body, ct.params.boundary)) walk(part, f, depth + 1);
    return;
  }
  if (type === 'message/rfc822' && depth < 8 && disp.value !== 'attachment') {
    walk(body, f, depth + 1);
    return;
  }
  if (disp.value === 'attachment' || (name && !type.startsWith('text/')) || (type !== 'text/plain' && type !== 'text/html')) {
    f.files.push(`${name || 'unnamed'} (${type})`);
    return;
  }
  const text = decodeBytes(transferDecode(body, headers.get('content-transfer-encoding')), ct.params.charset);
  (type === 'text/html' ? f.html : f.plain).push(text);
}

/** A raw message (possibly cut off) → headers, readable text and attachment names. */
export function parseMessage(raw: string): { headers: Map<string, string>; text: string; attachments: string[] } {
  const { headers } = splitMessage(raw);
  const f: Found = { plain: [], html: [], files: [] };
  walk(raw, f, 0);
  const text = (f.plain.length ? f.plain.join('\n\n') : f.html.map(htmlText).join('\n\n'))
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { headers, text, attachments: f.files };
}

// ---------- SMTP ----------

async function smtpReply(c: Conn): Promise<{ code: number; text: string }> {
  const lines: string[] = [];
  for (let i = 0; i < 200; i++) {
    const l = await c.readLine();
    if (!/^\d{3}([ -]|$)/.test(l)) throw new MailError('protocol', `${c.where} is not answering like a mail (SMTP) server: ${clean(l).slice(0, 120)}`);
    lines.push(l.slice(4));
    if (l[3] !== '-') return { code: Number(l.slice(0, 3)), text: lines.join(' ') };
  }
  throw new MailError('protocol', `${c.where} sent too long a reply`);
}

async function smtp(c: Conn, line: string | null, ok: number[], what: string): Promise<{ code: number; text: string }> {
  if (line !== null) await c.write(`${line}\r\n`);
  const r = await smtpReply(c);
  if (!ok.includes(r.code)) throw new MailError('protocol', `the mail server refused ${what}: ${r.code} ${clean(r.text).slice(0, 160)}`);
  return r;
}

function b64(s: string | Uint8Array): string {
  return btoa(typeof s === 'string' ? bin(enc.encode(s)) : bin(s));
}

/** Subject (or any header text) → RFC 2047 encoded words when it is not plain ASCII. */
export function encodeHeader(s: string): string {
  const one = s.replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7e]*$/.test(one)) return one;
  const words: string[] = [];
  let chunk = '';
  for (const ch of one) {
    if (chunk && enc.encode(chunk + ch).length > 45) {
      words.push(chunk);
      chunk = '';
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${b64(w)}?=`).join('\r\n ');
}

/** Text → quoted-printable UTF-8 with CRLF line ends and soft breaks at 76 characters. */
export function qpEncode(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const b = enc.encode(line);
      let out = '';
      let len = 0;
      for (let i = 0; i < b.length; i++) {
        const x = b[i]!;
        const safe = (x >= 33 && x <= 126 && x !== 61) || ((x === 32 || x === 9) && i < b.length - 1);
        const t = safe ? String.fromCharCode(x) : `=${x.toString(16).toUpperCase().padStart(2, '0')}`;
        if (len + t.length > 75) {
          out += '=\r\n';
          len = 0;
        }
        out += t;
        len += t.length;
      }
      return out;
    })
    .join('\r\n');
}

/** Lines starting with "." get another "." (SMTP DATA transparency), and the end marker. */
export function dotStuff(data: string): string {
  return `${data
    .split('\r\n')
    .map((l) => (l.startsWith('.') ? `.${l}` : l))
    .join('\r\n')}\r\n.\r\n`;
}

/** "a@x.com, Name <b@y.com>; c@z.com" → validated bare addresses. */
export function addressList(v: unknown): string[] {
  const items = (Array.isArray(v) ? v.map(String) : String(v ?? '').split(/[,;]/)).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const it of items) {
    const a = (it.match(/<([^<>]+)>/)?.[1] ?? it).trim();
    if (!EMAIL_RE.test(a)) throw new MailError('config', `"${clean(it).slice(0, 80)}" is not a valid email address`);
    if (!out.some((x) => x.toLowerCase() === a.toLowerCase())) out.push(a);
  }
  return out;
}

export interface OutgoingMail {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}

const MSGID_RE = /^<[^<>\s]{1,250}>$/;

export function buildMessage(cfg: MailConfig, m: OutgoingMail, messageId: string, date = new Date()): string {
  const refs = (m.references ?? '').split(/\s+/).filter((x) => MSGID_RE.test(x)).slice(-20);
  const reply = m.inReplyTo && MSGID_RE.test(m.inReplyTo) ? m.inReplyTo : '';
  if (reply && !refs.includes(reply)) refs.push(reply);
  const head = [
    `From: ${cfg.address}`,
    `To: ${m.to.join(', ')}`,
    ...(m.cc?.length ? [`Cc: ${m.cc.join(', ')}`] : []),
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${date.toUTCString().replace(/GMT$/, '+0000')}`,
    `Message-ID: ${messageId}`,
    ...(reply ? [`In-Reply-To: ${reply}`] : []),
    ...(refs.length ? [`References: ${refs.join(' ')}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: quoted-printable',
    'X-Mailer: Ghosty',
  ];
  return `${head.join('\r\n')}\r\n\r\n${qpEncode(m.body)}`;
}

/** Sends as the owner. Every reply code is checked; at most 20 recipients. */
export async function sendMessage(cfg: MailConfig, m: OutgoingMail, o: MailOptions = {}): Promise<{ accepted: string[]; messageId: string }> {
  const to = addressList(m.to);
  const cc = addressList(m.cc ?? []);
  const all = [...to, ...cc.filter((x) => !to.some((y) => y.toLowerCase() === x.toLowerCase()))];
  if (!to.length) throw new MailError('config', 'who should it go to? (no recipient)');
  if (all.length > 20) throw new MailError('config', `that is ${all.length} recipients; I send to at most 20 at a time`);
  const subject = m.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
  const body = m.body.slice(0, 100_000);
  const domain = cfg.address.split('@')[1] ?? 'localhost';
  const rnd = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const messageId = `<${rnd}.ghosty@${domain}>`;
  const c = await smtpSession(cfg, o);
  try {
    await smtp(c, `MAIL FROM:<${cfg.address}>`, [250], `sending from ${cfg.address}`);
    for (const r of all) await smtp(c, `RCPT TO:<${r}>`, [250, 251], `the recipient ${r}`);
    await smtp(c, 'DATA', [354], 'the message');
    await c.write(dotStuff(buildMessage(cfg, { ...m, to, cc, subject, body }, messageId)));
    await smtp(c, null, [250], 'the message');
    await smtp(c, 'QUIT', [221], 'QUIT').catch(() => undefined);
    return { accepted: all, messageId };
  } finally {
    c.close();
  }
}

async function smtpAuth(c: Conn, cfg: MailConfig): Promise<void> {
  await c.write(`AUTH PLAIN ${b64(`\u0000${cfg.address}\u0000${cfg.password}`)}\r\n`);
  const r = await smtpReply(c);
  if (r.code === 235) return;
  if (r.code === 535 || r.code === 534 || r.code === 530) throw new MailError('auth', authHelp(cfg, r.text));
  throw new MailError('protocol', `the mail server refused to sign in: ${r.code} ${clean(r.text).slice(0, 160)}`);
}

/** Connect, greet, EHLO, STARTTLS when the server needs it, and sign in. */
async function smtpSession(cfg: MailConfig, o: MailOptions): Promise<Conn> {
  const domain = cfg.address.split('@')[1] ?? 'localhost';
  const c = await open(cfg.smtpHost, cfg.smtpPort, cfg.smtpTls, o);
  try {
    await smtp(c, null, [220], 'the connection');
    await smtp(c, `EHLO ${domain}`, [250], 'EHLO');
    if (cfg.smtpTls === 'starttls') {
      await smtp(c, 'STARTTLS', [220], 'to switch to a secure connection (STARTTLS)');
      c.startTls();
      await smtp(c, `EHLO ${domain}`, [250], 'EHLO');
    }
    await smtpAuth(c, cfg);
    return c;
  } catch (e) {
    c.close();
    throw e;
  }
}

/** Signs in to both servers (reading and sending) without touching any mail. */
export async function testLogin(cfg: MailConfig, o: MailOptions = {}): Promise<void> {
  await withImap(cfg, o, async () => undefined);
  const c = await smtpSession(cfg, o);
  try {
    await smtp(c, 'QUIT', [221], 'QUIT').catch(() => undefined);
  } finally {
    c.close();
  }
}
